// BiomeWorld — the deterministic simulation behind BIOME.EXE.
// Pure module: no DOM/canvas imports so it runs under node --test.
//
// Every creature position is a closed-form function of accumulated
// simulation time, so results are frame-rate independent: the same total
// elapsed dt produces the same sample no matter how it was partitioned.
// Positions are emitted in logical pixels; the renderer only draws them.
// Non-marine scenes mix terrain gaits, flyers, surface life and swimmers.

import { DEFAULTS, HABITATS, validateSettings } from './settings.js';
import { SPECIES } from './art.js';
import { groundY as terrainY, waterline, waterBounds } from './terrain.js';

const TAU = Math.PI * 2;

// art.js is a pure import (no canvas/DOM is created until
// createSpriteAtlas is called), so the engine and its tests share the one
// authoritative species table. The constructor still accepts an optional
// speciesTable seam for synthetic fixtures.
export const DEFAULT_SPECIES = SPECIES;

// Community composition, as species-id sets intersected with whatever the
// habitat actually supports.
const REEF_SET = new Set(['clown', 'tang', 'butterfly', 'wrasse', 'angel', 'lion', 'seahorse', 'crab']);
const JELLY_SET = new Set(['jelly', 'lantern']);
const JELLY_SHARE = 0.65; // fraction of a 'jellies' community drawn from the bloom set

const VISITOR_PERIOD = 120;  // seconds per crossing cycle incl. downtime
const BURST_LIFE = 2.5;      // seconds a tap burst attracts fish
const BURST_KEEP = 8;        // seconds burst records stay relevant
const MAX_BURSTS = 12;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small string hash so each habitat gets its own layout for the same seed.
function habitatSalt(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

const mod = (n, m) => ((n % m) + m) % m;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const shuffle = (arr, rng) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class BiomeWorld {
  constructor(settings, width = 480, height = 300, speciesTable = DEFAULT_SPECIES) {
    this.settings = validateSettings(settings || DEFAULTS).settings;
    this.species = speciesTable || DEFAULT_SPECIES;
    this.seed = this.settings.seed;
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.simTime = 0;
    this.spriteMetrics = null; // {speciesId: {w, h}} supplied by the renderer
    this.bursts = [];          // tap bubble bursts: {x, y, t0}
    this._generate();
  }

  get count() {
    let n = 0;
    for (const s of this.schools) n += s.members.length;
    return n;
  }
  get habitat() { return this.settings.habitat; }
  _isLand() { return HABITATS[this.settings.habitat]?.kind !== 'water'; }

  // ------------------------------------------------------------ generation

  _pool() {
    const hab = this.settings.habitat;
    const eligible = [];
    for (const [id, rec] of Object.entries(this.species)) {
      if (!rec || rec.role === 'visitor') continue;
      const habs = Array.isArray(rec.habitats) ? rec.habitats : [];
      if (habs.includes(hab)) eligible.push(id);
    }
    if (!eligible.length) {
      // Degenerate table/habitat combo: keep the scene alive with any
      // non-visitor species rather than an empty tank.
      for (const [id, rec] of Object.entries(this.species)) {
        if (rec && rec.role !== 'visitor') eligible.push(id);
      }
    }
    return eligible;
  }

  _visitorPool() {
    const hab = this.settings.habitat;
    const out = [];
    for (const [id, rec] of Object.entries(this.species)) {
      if (rec && rec.role === 'visitor' &&
          Array.isArray(rec.habitats) && rec.habitats.includes(hab)) {
        out.push(id);
      }
    }
    return out;
  }

  /**
   * Non-marine species assignment. Each scene uses its supported cast,
   * retaining the community preference for Marine. Every resident species
   * appears once when population permits; extras favour smaller fauna,
   * with caps on large birds and slow desert creatures.
   */
  _landPlan(rng, n) {
    const hab = this.settings.habitat;
    const normal = Object.entries(this.species)
      .filter(([, rec]) => rec && rec.role !== 'visitor'
        && Array.isArray(rec.habitats) && rec.habitats.includes(hab))
      .map(([id]) => id);
    if (!normal.length) return [];
    const plan = [];
    const counts = {};
    for (const id of shuffle(normal, rng)) {
      if (plan.length >= Math.min(n, normal.length)) break;
      plan.push(id);
      counts[id] = 1;
    }
    // Extras: favoured critters get double deck weight; large ones cap out.
    const FAVOURED = new Set(['lizard', 'jerboa', 'scarab', 'wheatear','squirrel','morpho','suslik','dragonfly','mullet','trout','perch']);
    const CAPS = { scorpion: 2, tortoise: 2, macaw: 2, woodpecker: 2, robin: 3, woodlandHare: 8, gull: 3, kingfisher: 2, crane: 3 };
    const deck = [...normal, ...normal.filter((id) => FAVOURED.has(id))];
    let guard = deck.length * 64 + n;
    while (plan.length < n && guard-- > 0) {
      const id = deck[Math.floor(rng() * deck.length)];
      if (CAPS[id] != null && (counts[id] || 0) >= CAPS[id]) continue;
      plan.push(id);
      counts[id] = (counts[id] || 0) + 1;
    }
    return plan;
  }

  /** Seeded species assignment honouring the community setting (water). */
  _speciesPlan(rng, n) {
    if (this._isLand()) return this._landPlan(rng, n);
    const eligible = this._pool();
    const community = this.settings.community;
    const plan = [];
    if (community === 'jellies') {
      // A real bloom in EVERY habitat: >=65% actual jellyfish. 'jelly'
      // participates even where its metadata omits the habitat (a bloom
      // drifts wherever it wants); the remainder stays habitat-eligible.
      if (this.species.jelly) {
        const nJelly = Math.ceil(n * JELLY_SHARE);
        for (let i = 0; i < nJelly; i++) plan.push('jelly');
        const rest = shuffle(eligible.filter((id) => id !== 'jelly'), rng);
        const deck = rest.length ? rest : [...JELLY_SET].filter((id) => this.species[id]);
        let k = 0;
        while (plan.length < n) plan.push(deck[k++ % deck.length]);
        return plan;
      }
      // species table without jellyfish — fall through to a mixed draw
    }
    let pool = eligible;
    if (community === 'reef') {
      // reef community excludes drifters even where the habitat hosts them
      pool = eligible.filter((id) => REEF_SET.has(id));
      if (!pool.length) {
        // habitat hosts no reef-capable species — fall back to the global
        // reef cast so the choice is never a silent no-op
        pool = [...REEF_SET].filter(
          (id) => this.species[id] && this.species[id].role !== 'visitor');
      }
      if (!pool.length) pool = eligible;
    }
    const deck = shuffle(pool, rng);
    for (let i = 0; i < n; i++) {
      plan.push(i < deck.length ? deck[i] : deck[Math.floor(rng() * deck.length)]);
    }
    return plan;
  }

  _generate() {
    const rng = mulberry32((this.seed ^ habitatSalt(this.settings.habitat)) >>> 0);
    const n = clamp(Math.round(this.settings.population), 8, 48);
    const plan = this._speciesPlan(rng, n);
    if (this._isLand()) {
      this._generateLand(rng, plan);
      return;
    }

    // Group same-species members into little schools of 2-5 so family fish
    // travel together instead of in rows.
    const bySpecies = new Map();
    plan.forEach((id, i) => {
      if (!bySpecies.has(id)) bySpecies.set(id, []);
      bySpecies.get(id).push(i);
    });

    const schools = [];
    for (const [speciesId, members] of bySpecies) {
      const rec = this.species[speciesId] || {};
      let idx = 0;
      while (idx < members.length) {
        const remaining = members.length - idx;
        let size = remaining;
        if (remaining > 5) size = 2 + Math.floor(rng() * 4); // 2..5
        else if (remaining >= 4 && rng() < 0.5) size = 2;
        const group = members.slice(idx, idx + size);
        idx += size;
        // Behaviour role: jelly and crab are pinned by id (the contract
        // fixes species IDs); other species follow their table role.
        const role = speciesId === 'jelly' ? 'jelly'
          : (speciesId === 'crab' || rec.role === 'bottom') ? 'bottom' : 'fish';
        const depth = rng() < 0.22 ? 0.62 + rng() * 0.38 : 0.15 + rng() * 0.45;
        // Schoolmate slots: evenly spaced along the swim direction plus a
        // small jitter, so members travel abreast instead of ghosting on
        // one shared path. Offsets are multiplied by the school scale at
        // sample time, inside the wrap so margins stay safe.
        const mid = (group.length - 1) / 2;
        schools.push({
          species: speciesId,
          role,
          members: group.map((creatureIndex, slot) => ({
            creatureIndex,
            ox: (slot - mid) * (role === 'jelly' ? 27 : 34) + (rng() - 0.5) * 6,
            oy: role === 'jelly' ? (slot - mid) * 26 + (rng() - 0.5) * 6
              : role === 'bottom' ? (rng() - 0.5) * 4
              : (slot % 2 ? 8 : -8) + (rng() - 0.5) * 6,
            phase: rng() * TAU,
          })),
          dir: rng() < 0.5 ? -1 : 1,
          vdir: rng() < 0.5 ? -1 : 1, // jelly vertical drift direction
          depth,
          scale: 1, // Keep resident fish small enough for the landscape to read.
          laneY: role === 'bottom' ? 0.86 + rng() * 0.05
            : role === 'jelly' ? rng() // used as vertical wrap phase
            : speciesId === 'seahorse' ? 0.55 + rng() * 0.23
            : 0.18 + rng() * 0.54,
          laneX: rng(),          // jelly sway anchor / general offset
          x0: rng(),
          speedMul: 0.8 + rng() * 0.45,
          bobAmp: role === 'fish' ? 2 + rng() * 4 : role === 'jelly' ? 0 : 1 + rng() * 2,
          bobRate: 0.5 + rng() * 1.1,
          phase: rng() * TAU,
          framePeriod: role === 'jelly' ? 0.3 + rng() * 0.14
            : role === 'bottom' ? 0.28 + rng() * 0.14
            : 0.15 + rng() * 0.1,
          framePhase: Math.floor(rng() * 3),
        });
      }
    }
    this.schools = schools;

    // Visitor slot: at most one turtle/ray crosses at a time. Species and
    // direction are chosen per 120s cycle, deterministically.
    this.visitor = null;
    if (this.settings.visitors) {
      const pool = this._visitorPool();
      if (pool.length) {
        this.visitor = {
          pool,
          phase: rng(),
          laneY: 0.3 + rng() * 0.35,
          bobAmp: 3 + rng() * 4,
          bobRate: 0.35 + rng() * 0.3,
          framePeriod: 0.28 + rng() * 0.12,
        };
      }
    }
    this.bursts = [];
  }

  /**
   * Non-marine cast: independently seeded single-member groups. Walkers
   * follow shared terrain; flyers, swimmers and surface birds use their
   * own lanes. Walk/crawl/hop advance in pause/active bursts.
   */
  _generateLand(rng, plan) {
    this.schools = plan.map((speciesId, index) => {
      const rec = this.species[speciesId] || {};
      const motion = rec.motion || 'crawl';
      const role = rec.role === 'flyer' ? 'flyer' : rec.role === 'swimmer' ? 'swimmer' : 'ground';
      const period = 6 + rng() * 4; // pause/advance cadence for walkers
      return {
        species: speciesId,
        role,
        motion,
        land: true,
        members: [{ creatureIndex: 0, ox: 0, oy: 0, phase: rng() * TAU }],
        dir: rng() < 0.5 ? -1 : 1,
        depth: motion === 'fly' ? 0.1 + rng() * 0.25 : 0.18 + mod(index*.61803398875+.12,1)*0.7,
        scale: 1,
        laneY: 0.15 + rng() * 0.2, // flyer band
        x0: (index / plan.length + rng() / plan.length * .6) % 1,
        speedMul: 0.8 + rng() * 0.45,
        period,
        restPhase: rng()*period,
        phase: rng() * TAU,
        framePeriod: motion === 'crawl' ? 0.22 + rng() * 0.18 : 0.14 + rng() * 0.08,
        framePhase: Math.floor(rng() * 3),
      };
    });

    this.visitor = null;
    if (this.settings.visitors) {
      const pool = this._visitorPool();
      if (pool.length) {
        this.visitor = {
          pool,
          land: true,
          // land visitors phase in sooner — the desert gets an early glimpse
          phase: 0.1 + rng() * 0.2,
          framePeriod: 0.22 + rng() * 0.08,
        };
      }
    }
    this.bursts = [];
  }

  // ------------------------------------------------------------- settings

  /**
   * Live-merge new settings. Regeneration happens only when the creature
   * set itself can change (seed, habitat, community, population, visitors).
   * Look/atmosphere changes never regenerate or reset time; a seed change
   * counts as a reseed and resets the clock.
   */
  updateSettings(s) {
    if (!s || s === this.settings) return;
    const prev = this.settings;
    this.settings = s;
    const structural =
      s.seed !== prev.seed || s.habitat !== prev.habitat ||
      s.community !== prev.community || s.population !== prev.population ||
      s.visitors !== prev.visitors;
    if (!structural) return;
    if (s.seed !== prev.seed) {
      this.seed = s.seed;
      this.simTime = 0; // reseed restarts the world clock
    }
    this._generate();
  }

  reseed(seed) {
    const n = Number.isFinite(seed) ? Math.round(seed) : DEFAULTS.seed;
    this.seed = clamp(n, 0, 2147483647);
    this.settings = { ...this.settings, seed: this.seed };
    this.simTime = 0;       // a reseed always restarts the world clock
    this._generate();       // ...and rebuilds the layout, even for a reapply
  }

  setSize(width, height) {
    const w = Math.round(width), h = Math.round(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    // Positions are closed-form functions of the bounds, so a resize is a
    // re-layout for free — no clock reset, no regeneration.
  }

  /** Renderer supplies measured sprite sizes so wrap margins fit the art. */
  setSpriteMetrics(metrics) {
    this.spriteMetrics = metrics && typeof metrics === 'object' ? metrics : null;
  }

  /** Canvas tap: local bubble burst + a brief fish-interest pull. */
  burst(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.bursts.push({ x, y, t0: this.simTime });
    if (this.bursts.length > MAX_BURSTS) this.bursts.splice(0, this.bursts.length - MAX_BURSTS);
  }

  // ------------------------------------------------------------- stepping

  /** Positive finite dt only; speed multiplies simulation time. */
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.simTime += dt * this.settings.speed;
    this.bursts = this.bursts.filter((b) => this.simTime - b.t0 < BURST_KEEP);
  }

  // -------------------------------------------------------------- helpers

  _margin(speciesId, role, scale) {
    const m = this.spriteMetrics && this.spriteMetrics[speciesId];
    const base = role === 'visitor' ? 170 : 64;
    if (m && Number.isFinite(m.w)) return Math.max(base, m.w * scale + 8);
    return base + 16 * scale;
  }

  _attraction(x, y) {
    let ax = 0, ay = 0;
    for (const b of this.bursts) {
      const age = this.simTime - b.t0;
      if (age < 0 || age > BURST_LIFE) continue;
      const dx = b.x - x, dy = b.y - y;
      const d = Math.hypot(dx, dy);
      if (d > 160 || d < 1) continue;
      const pull = (1 - age / BURST_LIFE) * (1 - d / 160) * 26;
      ax += (dx / d) * pull;
      ay += (dy / d) * pull;
    }
    return [ax, ay];
  }

  _schoolSample(s, member, t) {
    if (s.land) return this._landSample(s, member, t);
    const rec = this.species[s.species] || {};
    const W = this.width, H = this.height;
    const margin = this._margin(s.species, s.role, s.scale);
    const span = W + 2 * margin;
    const base = Number.isFinite(rec.speed) ? rec.speed : 12;
    let x, y;
    if (s.role === 'jelly') {
      // Vertical drift with wrap; slot offsets ride inside the modulo so
      // wrapped members keep their spacing and the margins stay safe.
      const vSpan = H + 2 * margin;
      const travel = mod(s.laneY * vSpan + member.oy * s.scale
        + s.vdir * base * 0.55 * s.speedMul * t, vSpan);
      y = -margin + travel;
      const swayAmp = 10 + s.bobAmp * 8;
      x = s.laneX * W + member.ox * s.scale
        + swayAmp * Math.sin(0.24 * t + member.phase);
    } else {
      // One shared school velocity; member.ox shifts the wrap phase, so
      // schoolmates are already separated at t=0 and never ghost-stack.
      const vx = base * s.speedMul;
      const travel = mod(s.x0 * span + member.ox * s.scale + vx * t, span);
      x = s.dir > 0 ? -margin + travel : W + margin - travel;
      const lanePx = s.laneY * H;
      const bob = s.bobAmp * Math.sin(s.bobRate * t + s.phase + member.phase);
      y = lanePx + member.oy * s.scale + bob;
    }
    const [ax, ay] = this._attraction(x, y);
    return {
      species: s.species,
      x: x + ax,
      y: y + ay,
      // jellies always face right; their drift direction is vertical-only
      dir: s.role === 'jelly' ? 1 : s.dir,
      scale: s.scale,
      depth: s.depth,
      alpha: s.role === 'bottom' ? 0.9
        : s.role === 'jelly' ? clamp(0.5 + 0.35 * s.depth, 0, 1)
        : clamp(0.7 + 0.3 * s.depth, 0, 1),
      frame: mod(Math.floor(t / s.framePeriod) + s.framePhase, 3),
      phase: s.phase + member.phase,
      role: s.role,
      kind: 'creature',
    };
  }

  /**
   * Ground walkers follow the shared contour in pause/advance bursts;
   * flyers and aquatic life use separate lanes. Hops add a vertical arc.
   */
  _landSample(s, member, t) {
    const rec = this.species[s.species] || {};
    const W = this.width, H = this.height;
    const margin = this._margin(s.species, s.role, s.scale);
    const span = W + 2 * margin;
    const base = Number.isFinite(rec.speed) ? rec.speed : 8;
    let x, y, groundY, moving = true;
    if (['swim','surface','bottom'].includes(s.motion)) {
      const [left,right] = waterBounds(this.habitat,W);
      const waterSpan = right-left+margin*2;
      const travel = mod(s.x0*waterSpan + base*s.speedMul*t,waterSpan);
      x = s.dir>0 ? left-margin+travel : right+margin-travel;
      const surf=waterline(this.habitat,H);
      const swimTop=this.habitat==='trop-atoll'?H*.71:surf+H*.045;
      y = s.motion==='surface' ? surf-3
        : s.motion==='bottom' ? terrainY(this.habitat,W,H,x,s.depth)-3
        : swimTop+(H*.90-swimTop)*(.12+s.depth*.88)+Math.sin(t*.5+s.phase)*2;
      // Water is bounded by the cliff/bank silhouettes, not the viewport.
      return {species:s.species,x,y,dir:s.dir,scale:1,depth:s.depth,alpha:.92,
        frame:s.motion==='bottom'?Math.floor(t*.6)%3:mod(Math.floor(t/s.framePeriod)+s.framePhase,3),
        role:s.role,motion:s.motion,anchor:'center',kind:'creature'};
    } else if (s.motion === 'fly') {
      const travel = mod(s.x0 * span + base * s.speedMul * t, span);
      x = s.dir > 0 ? -margin + travel : W + margin - travel;
      y = H * s.laneY + Math.sin(t * 0.5 + s.phase + member.phase) * 5;
    } else {
      // covered distance advances only during the active slice of each
      // period — a closed form, so pauses never jerk or teleport
      const active = s.period * 0.65;
      const gaitTime=t+(this.habitat==='desert'?0:s.restPhase);
      const covered = Math.floor(gaitTime / s.period) * active
        + Math.min(mod(gaitTime, s.period), active);
      const travel = mod(s.x0 * span + base * s.speedMul * covered, span);
      x = s.dir > 0 ? -margin + travel : W + margin - travel;
      const local = mod(gaitTime, s.period);
      moving = local < active;
      groundY = terrainY(this.habitat, W, H, x, s.depth);
      if (this.habitat==='med-terraces') {
        x = mod(x,W*.42);
        groundY=H*.735-3;
      }
      let hop = 0;
      if (s.motion === 'hop' && moving) {
        // eased in/out at the activity edges so the arc never snaps at a
        // rest boundary or period wrap
        const edge = Math.min(1, local / 0.25, (active - local) / 0.25);
        const ease = edge * edge * (3 - 2 * edge);
        hop = Math.max(0, Math.sin(t * 4 + member.phase)) * 6 * ease;
      }
      y = groundY - hop;
    }
    return {
      species: s.species,
      x, y,
      groundY,
      dir: s.dir,
      scale: s.scale,
      depth: s.depth,
      alpha: s.motion === 'fly' ? 0.95 : 1,
      frame: moving ? mod(Math.floor(t / s.framePeriod) + s.framePhase, 3) : 0,
      phase: s.phase + member.phase,
      role: s.role,
      motion: s.motion,
      anchor: s.motion === 'fly' ? 'center' : 'feet',
      kind: 'creature',
    };
  }

  _visitorSample(t) {
    const v = this.visitor;
    if (!v) return null;
    const W = this.width, H = this.height;
    const cycle = Math.floor(t / VISITOR_PERIOD + v.phase);
    const u = mod(t / VISITOR_PERIOD + v.phase, 1);
    const speciesId = v.pool[mod(cycle, v.pool.length)];
    const rec = this.species[speciesId] || {};
    const base = Number.isFinite(rec.speed) ? rec.speed : 12;
    if (v.land) {
      if(rec.motion==='swim') {
        const [left,right]=waterBounds(this.habitat,W);
        if(u>=.60) return null;
        const dir=mod(cycle,2)===0?1:-1;
        const k=u/.60,x=dir>0?left-70+k*(right-left+140):right+70-k*(right-left+140);
        const surf=waterline(this.habitat,H);
        const y=(this.habitat==='trop-atoll'?H*.79:surf+(H*.92-surf)*.49)+Math.sin(t*.3)*3;
        return {species:speciesId,x,y,dir,scale:1,depth:.55,alpha:1,
          frame:mod(Math.floor(t/v.framePeriod),3),role:'visitor',motion:'swim',anchor:'center',kind:'visitor'};
      }
      // one desert visitor at a time on the same 120s cadence — a fennec
      // pad-footed at 1x, a camel looming at 2x, feet on the dune line
      const scale = speciesId === 'camel' ? 2 : 1;
      const margin = this._margin(speciesId, 'visitor', scale);
      const span = W + 2 * margin;
      const cross = span / base;
      const activeFrac = Math.min(0.65, cross / VISITOR_PERIOD);
      if (u >= activeFrac) return null;
      const dir = mod(cycle, 2) === 0 ? 1 : -1;
      const k = u / activeFrac;
      const x = dir > 0 ? -margin + k * span : W + margin - k * span;
      const y = terrainY(this.habitat, W, H, x, 0.72);
      return {
        species: speciesId,
        x,
        y,
        groundY: y,
        dir,
        scale,
        depth: 0.72,
        alpha: 1,
        frame: mod(Math.floor(t / v.framePeriod) + cycle, 3),
        phase: v.phase * TAU,
        role: 'visitor',
        motion: 'walk',
        anchor: 'feet',
        kind: 'visitor',
      };
    }
    const margin = this._margin(speciesId, 'visitor', 2);
    const span = W + 2 * margin;
    const cross = span / base; // seconds on screen for the crossing
    const activeFrac = Math.min(0.65, cross / VISITOR_PERIOD);
    if (u >= activeFrac) return null; // offscreen downtime
    const dir = mod(cycle, 2) === 0 ? 1 : -1;
    const k = u / activeFrac;
    const x = dir > 0 ? -margin + k * span : W + margin - k * span;
    const y = v.laneY * H + v.bobAmp * Math.sin(v.bobRate * t + v.phase * TAU);
    return {
      species: speciesId,
      x, y, dir,
      scale: 2,
      depth: 0.5,
      alpha: 0.9,
      frame: mod(Math.floor(t / v.framePeriod) + cycle, 3),
      phase: v.phase * TAU,
      role: 'visitor',
      kind: 'visitor',
    };
  }

  // -------------------------------------------------------------- sampling

  /**
   * Current display state as fresh creature records:
   * {species, x, y, dir, scale, depth, alpha, frame, phase, role, kind}.
   * Every value is a pure function of simTime and the seeded layout.
   */
  sample() {
    const t = this.simTime;
    const out = [];
    for (const s of this.schools) {
      for (const m of s.members) {
        out.push(this._schoolSample(s, m, t));
      }
    }
    const vis = this._visitorSample(t);
    if (vis) out.push(vis);
    return out;
  }
}

// Backwards-compatible name: the aquarium is a biome now.
export const AquariumWorld = BiomeWorld;
