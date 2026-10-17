// FlyWorld — the deterministic simulation behind 3D FLYING OBJECTS.
// Pure module: no DOM/three imports so it runs under node --test.
//
// Every body position/rotation is a closed-form function of accumulated
// simulation time, so results are frame-rate independent: the same total
// elapsed dt produces the same sample no matter how it was partitioned.
// Positions live entirely in world space; the renderer only draws them.

import { DEFAULTS, SHAPES, validateSettings } from './settings.js';

// Shared framing constants — the renderer's camera must agree with these so
// the engine's aspect-aware volume matches what is actually on screen.
export const VIEW = { dist: 26, fov: 45 };
export const EASE_SECONDS = 0.8;

const TAU = Math.PI * 2;

const FAMILY_POOLS = {
  classics: ['cube', 'sphere', 'teapot', 'torus'],
  polyhedra: ['cube', 'octahedron', 'icosahedron'],
  loops: ['torus', 'knot', 'rings'],
  satellites: ['satellite'],
  teapots: ['teapot'],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mod = (n, m) => ((n % m) + m) % m;
const wrap01 = (x) => mod(x, 1);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
const lerp = (a, b, k) => a + (b - a) * k;

/** Triangle-fold reflection bounce inside [lo, hi]. */
function fold(lo, hi, w) {
  const L = hi - lo;
  if (!(L > 0)) return lo;
  const m = mod(w - lo, 2 * L);
  return m <= L ? lo + m : lo + 2 * L - m;
}

/** Fade factor 0 at both ends of a 0..1 parameter, 1 in the middle. */
function seamFade(k, margin) {
  return clamp01(Math.min(k, 1 - k) / margin);
}

export class FlyWorld {
  constructor(settings) {
    this.settings = validateSettings(settings || DEFAULTS).settings;
    this.seed = this.settings.seed;
    this.aspect = 1;
    this.simTime = 0;
    this.rotationTime = 0; // separate accumulator so spin changes never snap
    this._easeT = EASE_SECONDS;      // first layout appears instantly
    this._from = new Map();          // id -> [x,y,z] captured at ease start
    this._disp = new Map();          // id -> [x,y,z] last displayed position
    this._generate();
  }

  /** classic and flowerbox fly exactly one large piece; count pref is kept. */
  _effCount(s) {
    return s.motion === 'classic' || s.motion === 'flowerbox' ? 1 : s.count;
  }

  get count() { return this.bodies.length; }
  get motion() { return this.settings.motion; }
  get family() { return this.settings.family; }

  // ------------------------------------------------------------ generation

  _shapePlan(rng, n) {
    // The Flower Box is a dedicated single shape, outside the mixed deck.
    if (this.settings.motion === 'flowerbox') return ['flowerbox'];
    const family = this.settings.family;
    if (family === 'mixed') {
      // Guarantee all ten shapes when n allows: shuffled full deck first,
      // then seeded picks for any extras.
      const deck = [...SHAPES];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push(i < deck.length ? deck[i] : deck[Math.floor(rng() * deck.length)]);
      }
      return out;
    }
    const pool = FAMILY_POOLS[family] || SHAPES;
    return Array.from({ length: n }, () => pool[Math.floor(rng() * pool.length)]);
  }

  _makeBody(rng, id, shape) {
    const r = rng;
    const dir = r() < 0.5 ? -1 : 1;
    let size = 0.65 + Math.pow(r(), 1.3) * 0.95; // 0.65..1.6, biased small
    if (id % 6 === 2) size *= 1.55;              // periodic hero pieces
    return {
      id,
      shape,
      paletteIndex: Math.floor(r() * 6),
      size,
      phase: r() * TAU,
      dir,
      // drift / classic
      p0: [r(), r(), r()],
      vel: [r() - 0.5, r() - 0.5, r() - 0.5],
      velRate: 0.5 + r() * 1.3,
      // orbit
      orbA: 0.3 + r() * 0.62,
      orbE: r() * 0.55,
      orbIncl: (r() - 0.5) * 1.7,
      orbNode: r() * TAU,
      orbRate: 0.05 + r() * 0.16,
      orbYOff: (r() - 0.5) * 0.5,
      // helix
      hRad: 0.3 + r() * 0.7,
      hPhase: r() * TAU,
      hRise: 0.04 + r() * 0.09,
      hAng: (0.3 + r() * 0.5) * dir,
      hOffY: r(),
      // vortex
      vRad: 0.55 + r() * 0.45,
      vPhase: r() * TAU,
      vRate: 0.045 + r() * 0.075,
      vAng: (0.4 + r() * 0.7) * dir,
      vOff: r(),
      // swarm
      sLag: r() * 2.6,
      sOff: [r() - 0.5, r() - 0.5, r() - 0.5],
      sWob: [0.3 + r() * 0.9, 0.3 + r() * 0.9, 0.3 + r() * 0.9],
      sWobP: [r() * TAU, r() * TAU, r() * TAU],
      sAmp: 0.9 + r() * 1.4,
      // independent tumble (rad/s at spin = 1)
      rot0: [r() * TAU, r() * TAU, r() * TAU],
      rotV: [(r() - 0.5) * 2.2, (r() - 0.5) * 2.2, (r() - 0.5) * 2.2],
    };
  }

  _generate() {
    const rng = mulberry32(this.seed >>> 0);
    const n = this._effCount(this.settings);
    const plan = this._shapePlan(rng, n);
    this.bodies = plan.map((shape, i) => {
      const b = this._makeBody(rng, i, shape);
      const solo = this.settings.motion === 'classic' || this.settings.motion === 'flowerbox';
      if (solo) b.size = 2.6; // one big hero
      return b;
    });
  }

  // ------------------------------------------------------------- settings

  /**
   * Live-merge new settings. Regeneration happens only when the body set
   * itself can change (seed, family, count, or a motion switch crossing
   * classic). Look/display/camera changes never regenerate or reset time.
   */
  updateSettings(s) {
    if (!s || s === this.settings) return;
    const prev = this.settings;
    const effBefore = this._effCount(prev);
    this.settings = s;
    const structural =
      s.seed !== prev.seed || s.family !== prev.family ||
      s.count !== prev.count || this._effCount(s) !== effBefore ||
      (s.motion === 'classic') !== (prev.motion === 'classic') ||
      (s.motion === 'flowerbox') !== (prev.motion === 'flowerbox');
    if (structural) {
      if (s.seed !== prev.seed) this.seed = s.seed;
      this._generate();
      // Entering the Flower Box centers the box immediately — no old-position
      // ease — while every other structural change still eases in.
      if (s.motion === 'flowerbox' && prev.motion !== 'flowerbox') {
        this.settleLayout();
      } else {
        this._beginEase();
      }
      return;
    }
    if (s.motion !== prev.motion || s.spread !== prev.spread || s.scale !== prev.scale) {
      this._beginEase();
    }
  }

  reseed(seed) {
    const n = Number.isFinite(seed) ? Math.round(seed) : DEFAULTS.seed;
    this.seed = Math.min(2147483647, Math.max(0, n));
    this.settings = { ...this.settings, seed: this.seed };
    this._generate();
    this._beginEase();
  }

  setAspect(aspect) {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    if (Math.abs(aspect - this.aspect) < 1e-4) return;
    this.aspect = aspect;
    this._beginEase(); // bounds moved -> ease to the new framing
  }

  /** Capture current displayed positions so targets ease in, not jump. */
  _beginEase() {
    this._from = new Map(this._disp);
    this._easeT = 0;
  }

  /**
   * Skip the layout ease outright: the next sample shows final targets.
   * Used while paused (step() is not running) so motion/spread/aspect
   * changes still take effect without advancing time or rotation.
   */
  settleLayout() {
    this._easeT = EASE_SECONDS;
    this._from = new Map();
  }

  // ------------------------------------------------------------- stepping

  /** Positive finite dt only; speed multiplies simulation time. */
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.simTime += dt * this.settings.speed;
    this.rotationTime += dt * this.settings.speed * this.settings.spin;
    this._easeT += dt;
  }

  // ------------------------------------------------------------- targets

  /**
   * Aspect-aware flight volume, scaled by spread. Width/height are measured
   * at the NEAREST allowed z-plane, so pieces drifting toward the camera
   * stay in frame — portrait stacks tighter instead of clipping offscreen.
   */
  _bounds() {
    const tan = Math.tan((VIEW.fov * Math.PI) / 360);
    const aspect = Math.max(0.35, this.aspect);
    const sp = this.settings.spread;
    // Narrow framings compress depth too: the wandering camera swings the
    // view cone, so deep pieces with lateral offsets would slip off-frame.
    const depth = Math.min(1, Math.max(0.45, aspect));
    const z0 = -12 * sp * depth;
    const z1 = 6 * sp * depth;
    const hh0 = tan * VIEW.dist;                 // half-height at z=0
    const hhN = tan * (VIEW.dist - z1);          // half-height at nearest z
    const bx = Math.min(hhN * aspect * 0.6, hh0 * aspect * 0.7, 15) * sp;
    const by = Math.min(hhN * 0.55, 8.5) * sp;
    return { x: bx, y: by, z0, z1, zc: (z0 + z1) / 2, zr: (z1 - z0) / 2 };
  }

  /** Closed-form target position + seam fade for a body at sim time t. */
  _target(b, t, B) {
    switch (this.settings.motion) {
      case 'orbit': return this._orbitPos(b, t, B);
      case 'helix': return this._helixPos(b, t, B);
      case 'vortex': return this._vortexPos(b, t, B);
      case 'swarm': return this._swarmPos(b, t, B);
      case 'classic': return this._classicPos(b, t, B);
      // Flower Box: centered, no flight — morphing is a renderer concern.
      case 'flowerbox': return { pos: [0, 0, 0], fade: 1 };
      case 'drift':
      default: return this._driftPos(b, t, B);
    }
  }

  _driftPos(b, t, B) {
    const k = b.velRate * 2.2; // world units/s at full tilt
    return {
      pos: [
        fold(-B.x, B.x, (b.p0[0] * 2 - 1) * B.x + b.vel[0] * k * t),
        fold(-B.y, B.y, (b.p0[1] * 2 - 1) * B.y + b.vel[1] * k * t),
        fold(B.z0, B.z1, B.z0 + b.p0[2] * (B.z1 - B.z0) + b.vel[2] * k * t),
      ],
      fade: 1,
    };
  }

  _orbitPos(b, t, B) {
    const ang = b.phase + b.dir * b.orbRate * TAU * t;
    const rBase = Math.min(B.x, B.y);
    const a = b.orbA * rBase;
    const c = a * Math.sqrt(1 - b.orbE * b.orbE);
    const ex = a * (Math.cos(ang) - b.orbE);
    const ey = c * Math.sin(ang);
    const si = Math.sin(b.orbIncl), ci = Math.cos(b.orbIncl);
    const y1 = ey * ci;
    const z1 = ey * si;
    const sn = Math.sin(b.orbNode), cn = Math.cos(b.orbNode);
    return {
      pos: [
        ex * cn + z1 * sn,
        y1 + b.orbYOff * B.y,
        (-ex * sn + z1 * cn) * 0.6,
      ],
      fade: 1,
    };
  }

  _helixPos(b, t, B) {
    const ang = b.hPhase + b.hAng * t;
    const k = wrap01(b.hOffY + b.hRise * t);
    const rBase = Math.min(B.x, B.y) * 0.8;
    const r = b.hRad * rBase;
    return {
      pos: [
        r * Math.cos(ang),
        -B.y + k * 2 * B.y,
        B.zc + r * 0.85 * Math.sin(ang),
      ],
      fade: seamFade(k, 0.1),
    };
  }

  _vortexPos(b, t, B) {
    const k = wrap01(b.vOff + b.vRate * t); // 0 deep -> 1 near viewer
    const ang = b.vPhase + b.vAng * t;
    const rBase = Math.min(B.x, B.y) * 0.95;
    const r = b.vRad * rBase * (0.16 + 0.84 * k);
    return {
      pos: [
        r * Math.cos(ang),
        r * Math.sin(ang) * 0.8,
        B.z0 + k * (B.z1 - B.z0),
      ],
      fade: seamFade(k, 0.08),
    };
  }

  _swarmPos(b, t, B) {
    // One shared ribbon curve; bodies trail it with a per-body lag.
    const ti = t - b.sLag;
    const pos = [
      B.x * 0.72 * Math.sin(0.21 * ti + 0.7),
      B.y * 0.7 * Math.sin(0.16 * ti + 2.1),
      B.zc + B.zr * 0.62 * Math.sin(0.12 * ti + 4.0),
    ];
    for (let i = 0; i < 3; i++) {
      pos[i] += b.sOff[i] * b.sAmp * Math.sin(b.sWob[i] * ti + b.sWobP[i]);
    }
    return { pos, fade: 1 };
  }

  _classicPos(b, t, B) {
    // A single slow reflect-bounce — the 90s screensaver memory.
    const k = b.velRate * 1.6;
    return {
      pos: [
        fold(-B.x * 0.85, B.x * 0.85, (b.p0[0] * 2 - 1) * B.x + b.vel[0] * k * t),
        fold(-B.y * 0.8, B.y * 0.8, (b.p0[1] * 2 - 1) * B.y + b.vel[1] * k * t),
        fold(B.z0 * 0.7, B.z1 * 0.7, b.p0[2] * (B.z1 - B.z0) * 0.7 + B.z0 * 0.7 + b.vel[2] * k * t),
      ],
      fade: 1,
    };
  }

  // -------------------------------------------------------------- sampling

  /**
   * Current display state. Positions ease from the previous layout for
   * ~0.8s after a structural change; rotations are pure functions of sim
   * time so they never reset. Returns fresh records each call.
   */
  sample() {
    const t = this.simTime;
    const B = this._bounds();
    const ease = this._easeT >= EASE_SECONDS ? 1 : smooth01(this._easeT / EASE_SECONDS);
    const rt = this.rotationTime;
    // Narrow framings shrink the Flower Box hero so it stays inside portrait.
    const heroFit = this.settings.motion === 'flowerbox'
      ? Math.min(1, this.aspect / 0.8)
      : 1;
    const bodies = [];
    for (const b of this.bodies) {
      const tgt = this._target(b, t, B);
      let pos = tgt.pos;
      if (ease < 1) {
        const from = this._from.get(b.id);
        if (from) {
          pos = [lerp(from[0], pos[0], ease), lerp(from[1], pos[1], ease), lerp(from[2], pos[2], ease)];
        }
      }
      this._disp.set(b.id, pos);
      bodies.push({
        id: b.id,
        shape: b.shape,
        paletteIndex: b.paletteIndex,
        position: [pos[0], pos[1], pos[2]],
        rotation: [
          b.rot0[0] + b.rotV[0] * rt,
          b.rot0[1] + b.rotV[1] * rt,
          b.rot0[2] + b.rotV[2] * rt,
        ],
        scale: b.size * this.settings.scale * heroFit,
        opacity: tgt.fade,
      });
    }
    return {
      bodies,
      time: t,
      count: bodies.length,
      seed: this.seed,
      motion: this.settings.motion,
      family: this.settings.family,
    };
  }
}
