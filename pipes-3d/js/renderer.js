// Three.js renderer for PipeWorld — shared dense instance batches.
//
// Instead of per-path InstancedMeshes, the whole scene renders through six
// global batches: {tube, elbow, ball} x {opaque, fading}. Fading pieces are
// migrated into the transparent depthWrite=false set while a path fades and
// migrate back out never (freed on release). Draw calls stay <= 6 regardless
// of cell count or path count; geometries are fixed at 12 radial segments.
//
// Per-frame GPU writes are limited to the growing tips (a handful of
// instanceMatrix/instanceColor/instanceReveal update ranges) plus the shared
// fade opacity; committed sculpture is never touched. Commits, tail replans
// (forced finish) and graceful-retirement caps land through the same packed
// slot handles with O(1) swap-delete.
//
// The active elbow preview uses a per-instance `instanceReveal` attribute on
// the elbow geometries + an onBeforeCompile fragment discard driven by the
// torus' tubular uv.x — the moving cap ball covers the cut edge.
//
// Colour is frozen per instance at write time: each record carries the tint
// slot it grew with (`path.tints` history in the engine), so living-mode
// colour requests only recolour NEW segments — committed sculpture keeps its
// band. Manual style picks rewrite instanceColor once per record. Pixel mode
// adds a post-tonemap ordered-dither quantizer on the shared fragment shader.

import * as THREE from '../vendor/three.module.min.js';
import { DIRS } from './engine.js';
import {
  elbowPlacement, makeTubeGeometry, makeElbowGeometry, makeBallGeometry,
  planTransition, planPending, pendingTipPoint, axisQuat,
  BALL_SCALE, vAdd, vScale,
} from './geometry.js';
import { paletteOf } from './settings.js';
import { OrbitCamera } from './orbit.js';
import { InstanceBatch, nextPow2 } from './batch.js';

const KINDS = ['tube', 'elbow', 'ball'];
const HOME_VFOV = 50; // camera vertical fov in degrees
const MAX_DPR = 1.5;
const ISO_YAW = Math.PI / 4;
const ISO_PITCH = Math.asin(1 / Math.sqrt(3)); // true isometric elevation
const PIXEL_STEP = 12; // quantized growth steps in pixel mode

const smoothstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * MeshPhongMaterial wired to the shared pixel uniform.
 * - standard per-instance vColor supplies the frozen segment colour;
 * - elbow materials also discard torus fragments past `instanceReveal`;
 * - pixel mode posterizes to 16 levels/channel through a 4x4 ordered Bayer
 *   threshold indexed by the (coarse) buffer pixel.
 * `palU` is a shared {uniform-name: uniform-object} bag so one write lands
 * on every material that consumed it.
 */
function pipeMaterial(palU, opts, { elbow = false } = {}) {
  const m = new THREE.MeshPhongMaterial(opts);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPixelMode = palU.uPixelMode;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${elbow ? 'attribute float instanceReveal;\nvarying float vRevealU;\nvarying float vReveal;' : ''}`
      )
      .replace(
        '#include <uv_vertex>',
        elbow
          ? '#include <uv_vertex>\nvRevealU = uv.x;\nvReveal = instanceReveal;'
          : '#include <uv_vertex>'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uPixelMode;
${elbow ? 'varying float vRevealU;\nvarying float vReveal;' : ''}
// Branch-free 4x4 ordered Bayer, returns [0,1) at 1/16 granularity.
float pipesBayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float pipesBayer(vec2 a) {
  return pipesBayer2(a * 0.5) * 0.25 + pipesBayer2(a);
}`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        elbow
          ? '#include <clipping_planes_fragment>\nif (vRevealU > vReveal) discard;'
          : '#include <clipping_planes_fragment>'
      )
      .replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
if (uPixelMode > 0.5) {
  vec3 pq = clamp(gl_FragColor.rgb, vec3(0.0), vec3(1.0)) * 15.0;
  float pth = pipesBayer(gl_FragCoord.xy);
  gl_FragColor.rgb = floor(pq + vec3(pth)) / 15.0;
}`
      );
  };
  m.customProgramCacheKey = () => (elbow ? 'pipes-elbow-tint' : 'pipes-tint');
  return m;
}

export class PipeRenderer {
  constructor(canvas, settings, engineCfg) {
    this.canvas = canvas;
    this.settings = settings;
    this.palette = paletteOf(settings);
    this.dim = engineCfg.dimension;
    this.totalCells = engineCfg.totalCells ?? this.dim ** 3;
    this.maxPaths = engineCfg.maxPaths ?? 64;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.palette.bg);
    this._fog = new THREE.Fog(this.palette.bg, this.dim * 2.6, this.dim * 6);
    this.scene.fog = this._fog;

    // Two owned cameras: perspective for the classic look, orthographic for
    // the 2.5D pixel workshop. The orbit driver writes into whichever one is
    // active; ortho zoom derives from the same home/dist ratio.
    this.cameraPersp = new THREE.PerspectiveCamera(HOME_VFOV, 1, 0.1, 400);
    this.cameraOrtho = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 700);
    this.camera = this.cameraPersp;
    this.pixelMode = false;
    this._savedView = null; // perspective yaw/pitch/dist/home while in pixels
    this.orbit = new OrbitCamera(this.cameraPersp, canvas, {
      distance: 46, minDist: 8, maxDist: 260,
    });

    // Neutral studio rig: bright warm-neutral key, soft hemisphere fill,
    // cool rim for separation. No shadow maps, no environment assets.
    this.keyLight = new THREE.DirectionalLight(0xfff4e6, 2.1);
    this.keyLight.position.set(10, 16, 9);
    this.rimLight = new THREE.DirectionalLight(0x9fb8e8, 0.8);
    this.rimLight.position.set(-12, -5, -10);
    this.hemiLight = new THREE.HemisphereLight(0xe8ecf4, 0x1c2026, 0.95);
    this.scene.add(this.keyLight, this.rimLight, this.hemiLight);

    // ---- shared batches ----------------------------------------------------
    const hardCap = nextPow2(this.totalCells + this.maxPaths + 8);
    // Shared pixel-mode uniform: every pipe material resolves the same
    // object at compile time, so the toggle writes one scalar total.
    this._palU = { uPixelMode: { value: 0 } };

    const phong = {
      color: 0xffffff, // per-instance color supplies the palette hue
      specular: this.palette.specular,
      shininess: this.palette.shininess,
    };
    this.matSolid = pipeMaterial(this._palU, phong);
    this.matFade = pipeMaterial(this._palU, {
      ...phong, transparent: true, depthWrite: false,
    });
    this.matElbowSolid = pipeMaterial(this._palU, phong, { elbow: true });
    this.matElbowFade = pipeMaterial(this._palU, {
      ...phong, transparent: true, depthWrite: false,
    }, { elbow: true });
    this.matFade.opacity = 1;
    this.matElbowFade.opacity = 1;
    this._mats = [this.matSolid, this.matFade, this.matElbowSolid, this.matElbowFade];

    const mkBatch = (kind, mat, reveal) => new InstanceBatch(
      kind === 'tube' ? makeTubeGeometry()
        : kind === 'elbow' ? makeElbowGeometry()
        : makeBallGeometry(),
      mat, { capacity: 256, hardCap, reveal, name: kind }
    );
    this.solid = {
      tube: mkBatch('tube', this.matSolid, false),
      elbow: mkBatch('elbow', this.matElbowSolid, true),
      ball: mkBatch('ball', this.matSolid, false),
    };
    this.fading = {
      tube: mkBatch('tube', this.matFade, false),
      elbow: mkBatch('elbow', this.matElbowFade, true),
      ball: mkBatch('ball', this.matFade, false),
    };
    for (const set of [this.solid, this.fading]) {
      for (const k of KINDS) this.scene.add(set[k].mesh);
    }
    this._batches = KINDS.flatMap((k) => [this.solid[k], this.fading[k]]);

    this._colors = this.palette.hues.map((h) => new THREE.Color(h));
    this._dirQuat = DIRS.map(axisQuat);
    this._m4 = new THREE.Matrix4();
    this._v3 = new THREE.Vector3();
    this._sv3 = new THREE.Vector3();
    this._qI = new THREE.Quaternion();

    this.views = new Map(); // pathId -> view
    this.setDisplay(settings); // owns pixel-mode camera entry + resize
  }

  // ------------------------------------------------------------- setup

  /** Aspect-aware home distance: frame the lattice bounding sphere. */
  _fitHomeDistance() {
    const R = Math.sqrt(3) * (this.dim / 2 + 0.2);
    const vHalf = (HOME_VFOV * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * this.cameraPersp.aspect);
    return (R / Math.sin(Math.min(vHalf, hHalf))) * 1.02;
  }

  /**
   * Display-switch handling: perspective <-> isometric pixel mode,
   * auto-rotate enablement and backing-store sizing all live here. Entering
   * pixel mode parks the perspective view (restored on exit) and snaps the
   * orbit home to the classic isometric yaw/pitch.
   */
  setDisplay(settings) {
    const prev = this.pixelMode;
    this.settings = settings;
    this.pixelMode = !!settings.pixelMode;
    if (prev !== this.pixelMode) {
      if (this.pixelMode) {
        this._savedView = {
          yaw: this.orbit.yaw,
          pitch: this.orbit.pitch,
          dist: this.orbit.dist,
          home: { ...this.orbit.home },
        };
        this.orbit.camera = this.cameraOrtho;
        this.orbit.home = {
          yaw: ISO_YAW, pitch: ISO_PITCH, dist: this.orbit.home.dist,
        };
        this.orbit.reset();
        this.camera = this.cameraOrtho;
        this.scene.fog = null; // flat 2.5D: no depth cue
      } else {
        this.orbit.camera = this.cameraPersp;
        const s = this._savedView;
        if (s) {
          this.orbit.home = s.home;
          this.orbit.yaw = s.yaw;
          this.orbit.pitch = s.pitch;
          this.orbit.dist = s.dist;
          this.orbit.update();
        }
        this.camera = this.cameraPersp;
        this.scene.fog = this._fog;
      }
    }
    // Pixel mode suspends auto-orbit WITHOUT touching the persisted camera
    // preference; fixed stays fixed.
    this.orbit.autoRotate = settings.camera === 'orbit' && !this.pixelMode;
    this._palU.uPixelMode.value = this.pixelMode ? 1 : 0;
    this.resize();
  }

  /** Ortho zoom mirrors wheel zoom: ortho.zoom = home distance / dist. */
  _syncOrthoZoom() {
    const z = this.orbit.home.dist / this.orbit.dist;
    if (z !== this.cameraOrtho.zoom) {
      this.cameraOrtho.zoom = z;
      this.cameraOrtho.updateProjectionMatrix();
    }
  }

  resize() {
    const host = this.canvas.parentElement;
    const w = Math.max(2, host.clientWidth);
    const h = Math.max(2, host.clientHeight);
    const aspect = w / h;
    this.cameraPersp.aspect = aspect;
    this.cameraPersp.updateProjectionMatrix();
    // Iso frame: vertical half-extent covers the lattice bounding sphere,
    // widening on wide screens and padding on narrow ones.
    const halfH = (Math.sqrt(3) * (this.dim / 2 + 0.2) * 1.02) / Math.min(1, aspect);
    this.cameraOrtho.left = -halfH * aspect;
    this.cameraOrtho.right = halfH * aspect;
    this.cameraOrtho.top = halfH;
    this.cameraOrtho.bottom = -halfH;
    this.cameraOrtho.updateProjectionMatrix();
    this.orbit.setHome(this._fitHomeDistance());
    if (this.pixelMode) {
      // Crisp chunky blocks: the buffer is an integer fraction of the CSS
      // size (a 480x360-ish internal image, 320x240 under retro low-res),
      // upscaled by the browser with nearest-neighbor.
      const maxW = this.settings.lowRes ? 320 : 480;
      const maxH = this.settings.lowRes ? 240 : 360;
      const ps = Math.max(2, Math.ceil(w / maxW), Math.ceil(h / maxH));
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(
        Math.max(2, Math.floor(w / ps)), Math.max(2, Math.floor(h / ps)),
        false
      );
    } else if (this.settings.lowRes) {
      const iw = 640;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(iw, Math.max(2, Math.round((iw * h) / w)), false);
    } else {
      const pr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(w, h, false);
    }
  }

  // ------------------------------------------------------------- pieces

  _set(view) {
    return view.fading ? this.fading : this.solid;
  }

  _segMatrix(start, dirIdx, len) {
    const m = this._m4;
    m.compose(
      this._v3.set(start[0], start[1], start[2]),
      this._dirQuat[dirIdx],
      this._sv3.set(1, Math.max(0.001, len), 1)
    );
    return m;
  }

  _posMatrix(pos, scale = 1) {
    const m = this._m4;
    m.compose(
      this._v3.set(pos[0], pos[1], pos[2]),
      this._qI,
      this._sv3.set(scale, scale, scale)
    );
    return m;
  }

  _color(tint) {
    return this._colors[tint % this._colors.length];
  }

  _addPiece(view, kind, matrix, tint = view.tint) {
    const batch = this._set(view)[kind];
    const h = batch.alloc();
    if (!h) return null; // lattice-derived hard cap: keep going, drop the piece
    batch.setMatrix(h, matrix);
    batch.setColor(h, this._color(tint));
    batch.setTint(h, tint % this._colors.length);
    if (kind === 'elbow') batch.setReveal(h, 1);
    const rec = { kind, handle: h, tint }; // the colour it grew with — frozen
    view.records.push(rec);
    return rec;
  }

  /** Append the pieces for committed transition i, per current world state. */
  _applyTransition(view, path, i) {
    const plan = planTransition(path, i, this.settings.joints);
    // Every piece of this transition shares the segment's committed colour
    // (legacy fixtures without tints fall back to the start tint).
    const tint = path.tints?.[i] ?? path.tint;
    const tail = [];
    const tube = this._addPiece(view, 'tube',
      this._segMatrix(plan.segStart, plan.d, plan.segLen), tint);
    if (tube) tail.push(tube);
    if (plan.joint === 'elbow') {
      const el = this._addPiece(view, 'elbow',
        elbowPlacement(DIRS[plan.d], DIRS[plan.nd], plan.B).basis, tint);
      if (el) tail.push(el);
      if (plan.terminalBend) {
        const cap = this._addPiece(view, 'ball',
          this._posMatrix(plan.capPos), tint);
        if (cap) tail.push(cap);
      }
    } else if (plan.joint === 'ball' || plan.joint === 'cap') {
      const ball = this._addPiece(view, 'ball',
        this._posMatrix(plan.capPos), tint);
      if (ball) tail.push(ball);
    }
    view.tail = tail;
    view.endSig = plan.endSig;
    view.committed = i + 1;
  }

  /** Pop the pieces of the last applied transition (for re-planning). */
  _unapplyTransition(view) {
    for (const rec of view.tail) rec.handle.batch.free(rec.handle);
    if (view.tail.length) {
      const first = view.records.indexOf(view.tail[0]);
      if (first >= 0) view.records.splice(first);
    }
    view.tail = [];
    view.endSig = null;
    view.committed--;
  }

  _allocTip(view, kind) {
    const batch = this._set(view)[kind];
    const h = batch.alloc();
    if (h) {
      batch.setColor(h, this._color(view.tipTint));
      batch.setTint(h, view.tipTint % this._colors.length);
    }
    return h;
  }

  _clearTip(view) {
    for (const k of ['tube', 'cap', 'elbow']) {
      const h = view.tip[k];
      if (h) h.batch.free(h);
      view.tip[k] = null;
    }
    view.tipPending = null;
    view.tipPlan = null;
    view.tipTint = null;
  }

  /**
   * Rewrite the in-flight growth tip: trimmed tube, revealing elbow (when the
   * reserved next cell turns), and the travelling cap that covers the cut.
   * The plan is cached per pending object — only the transform writes repeat.
   */
  _updateTip(view, path) {
    const set = this._set(view);
    if (view.tipPending !== path.pending) {
      view.tipPlan = planPending(path, this.settings.joints);
      view.tipPending = path.pending;
      // The segment boundary is where queued colours land: the new tip (and
      // its preview elbow) take the colour captured when this pending step
      // was planned — a pulse mid-segment never repaints it.
      const tint = path.pending.tint ?? path.growthTint ?? path.tint;
      if (tint !== view.tipTint) {
        view.tipTint = tint;
        for (const k of ['tube', 'cap', 'elbow']) {
          const h = view.tip[k];
          if (h) {
            h.batch.setColor(h, this._color(tint));
            h.batch.setTint(h, tint % this._colors.length);
          }
        }
      }
      // The elbow is placed once per plan: re-place it for the new bend, or
      // free it outright when the new step ends straight or capped.
      if (view.tip.elbow) {
        if (view.tipPlan.hasArc) {
          set.elbow.setMatrix(view.tip.elbow, elbowPlacement(
            DIRS[view.tipPlan.d], DIRS[view.tipPlan.nd], view.tipPlan.B).basis);
          set.elbow.setReveal(view.tip.elbow, 0);
        } else {
          view.tip.elbow.batch.free(view.tip.elbow);
          view.tip.elbow = null;
        }
      }
    }
    const plan = view.tipPlan;
    let p = Math.min(1, Math.max(0, path.pending.progress));
    // Pixel workshop: growth advances in chunky visual steps. Tube, elbow
    // reveal and cap all consume the same quantized p so joints never lag.
    if (this.pixelMode) p = Math.floor(p * PIXEL_STEP) / PIXEL_STEP;
    const tip = pendingTipPoint(plan, p);

    if (!view.tip.tube) view.tip.tube = this._allocTip(view, 'tube');
    if (view.tip.tube) {
      set.tube.setMatrix(view.tip.tube, this._segMatrix(
        vAdd(plan.A, vScale(DIRS[plan.d], plan.s)), plan.d, tip.segShown));
    }

    if (tip.arcFrac > 0) {
      if (!view.tip.elbow) {
        view.tip.elbow = this._allocTip(view, 'elbow');
        if (view.tip.elbow) {
          set.elbow.setMatrix(view.tip.elbow,
            elbowPlacement(DIRS[plan.d], DIRS[plan.nd], plan.B).basis);
        }
      }
      if (view.tip.elbow) set.elbow.setReveal(view.tip.elbow, tip.arcFrac);
    } else if (view.tip.elbow) {
      set.elbow.setReveal(view.tip.elbow, 0);
    }

    if (!view.tip.cap) view.tip.cap = this._allocTip(view, 'ball');
    if (view.tip.cap) {
      const target =
        plan.endJoint === 'ball' || plan.endJoint === 'cap' ? BALL_SCALE : 1;
      const gt = Math.min(1, Math.max(0, (p - 0.55) / 0.45));
      const factor = (1 + (target - 1) * (gt * gt * (3 - 2 * gt))) / BALL_SCALE;
      set.ball.setMatrix(view.tip.cap, this._posMatrix(tip.point, factor));
    }
  }

  /** Move every piece between the opaque and fading batch sets. */
  _migrateView(view, fading) {
    const dst = fading ? this.fading : this.solid;
    for (const rec of view.records) {
      const h = InstanceBatch.transfer(rec.handle, dst[rec.kind]);
      if (h) rec.handle = h;
    }
    for (const k of ['tube', 'cap', 'elbow']) {
      const h = view.tip[k];
      if (h) {
        const moved = InstanceBatch.transfer(h, dst[k === 'cap' ? 'ball' : k]);
        if (moved) view.tip[k] = moved;
      }
    }
    view.fading = fading;
  }

  _createView(path) {
    const view = {
      records: [],
      committed: 0,
      tail: [],
      endSig: null,
      tip: { tube: null, cap: null, elbow: null },
      tipPending: null,
      tipPlan: null,
      tipTint: path.tint,
      fading: false,
      tint: path.tint,
      sig: '',
    };
    this.views.set(path.id, view);
    const cap = this._addPiece(view, 'ball', this._posMatrix(path.cells[0]));
    view.capStart = cap || null;
    return view;
  }

  _removeView(pathId) {
    const view = this.views.get(pathId);
    if (!view) return;
    this._clearTip(view);
    for (const rec of view.records) rec.handle.batch.free(rec.handle);
    this.views.delete(pathId);
  }

  _clearAll() {
    for (const id of [...this.views.keys()]) this._removeView(id);
  }

  /** Full replan used when the joints mode changes — geometry is untouched. */
  rebuildAll(world) {
    this._clearAll();
    for (const path of world.paths.values()) this._syncPath(path);
  }

  /**
   * Manual style pick: palette hues, material specular/shininess, backdrop —
   * no geometry rebuild, no reallocations. Every record is recoloured by its
   * OWN committed tint (and tips by the queued tip tint), so living-mode
   * colour bands stay distinct across a theme change. Called only for
   * explicit user picks — automatic colour requests never reach here.
   */
  applyStyle(world, settings) {
    const to = paletteOf(settings);
    this.settings = settings;
    this.palette = to;
    this._colors = to.hues.map((h) => new THREE.Color(h));
    for (const view of this.views.values()) {
      for (const rec of view.records) {
        rec.handle.batch.setColor(rec.handle, this._color(rec.tint));
      }
      for (const k of ['tube', 'cap', 'elbow']) {
        const h = view.tip[k];
        if (h) h.batch.setColor(h, this._color(view.tipTint ?? view.tint));
      }
    }
    for (const m of this._mats) {
      m.specular.set(to.specular);
      m.shininess = to.shininess;
    }
    this.scene.background.set(to.bg);
    if (this._fog) this._fog.color.set(to.bg);
  }

  // ------------------------------------------------------------- sync

  _syncPath(path) {
    let view = this.views.get(path.id);
    if (!view) view = this._createView(path);

    if ((path.state === 'fading') !== view.fading) {
      this._migrateView(view, path.state === 'fading');
    }

    // The structural signature covers everything that can change committed
    // geometry; progress along the pending step is handled by the tip below.
    const sig =
      `${path.dirs.length}|${path.pending ? path.pending.dir : '-'}` +
      `|${path.state}|${path.terminalDir ?? '-'}`;
    if (sig !== view.sig) {
      // re-plan the last committed transition if its end changed underneath
      // it (a forced finish deleted the step it was planned against)
      if (view.committed > 0 && view.tail.length) {
        const i = view.committed - 1;
        const plan = planTransition(path, i, this.settings.joints);
        if (plan.endSig !== view.endSig) this._unapplyTransition(view);
      }
      while (view.committed < path.dirs.length) {
        this._applyTransition(view, path, view.committed);
      }
      view.sig = sig;
    }

    if (path.pending) this._updateTip(view, path);
    else this._clearTip(view);
  }

  /** Advance visuals from the world. Call once per rendered frame. */
  update(world) {
    this.world = world;
    for (const ev of world.drainEvents()) {
      if (ev.type === 'remove') this._removeView(ev.pathId);
      else if (ev.type === 'reset') this._clearAll();
    }
    let fadeOpacity = 1;
    for (const path of world.paths.values()) {
      this._syncPath(path);
      if (path.state === 'fading') {
        fadeOpacity = Math.min(fadeOpacity, 1 - smoothstep(path.fade));
      }
    }
    this.matFade.opacity = fadeOpacity;
    this.matElbowFade.opacity = fadeOpacity;
  }

  render() {
    if (this.pixelMode) this._syncOrthoZoom();
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------- diag

  diag() {
    let pieces = 0;
    let capacity = 0;
    for (const b of this._batches) {
      pieces += b.count;
      capacity += b.capacity;
    }
    return {
      batches: this._batches.length,
      pieces,
      capacity,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      paths: this.views.size,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      yaw: this.orbit.yaw,
      pitch: this.orbit.pitch,
      dist: this.orbit.dist,
      home: this.orbit.home.dist,
      pixelMode: this.pixelMode,
      ortho: this.pixelMode,
      bands: [...this.views.values()]
        .filter((v) => new Set(v.records.map((r) => r.tint)).size > 1).length,
      pixelScale: this.pixelMode
        ? Math.max(2, Math.ceil(
            (this.canvas.clientWidth || 2)
              / (this.settings.lowRes ? 320 : 480)))
        : 1,
    };
  }

  /** Test/debug handle: tail state of one path's records. */
  debugPath(pathId) {
    const v = this.views.get(pathId);
    if (!v) return null;
    const counts = { tube: 0, elbow: 0, ball: 0 };
    for (const rec of v.records) counts[rec.kind]++;
    if (v.tip.tube) counts.tube++;
    if (v.tip.elbow) counts.elbow++;
    if (v.tip.cap) counts.ball++;
    const out = {
      counts,
      committed: v.committed,
      endSig: v.endSig,
      tail: v.tail.map((r) => r.kind),
      tipOn: !!v.tip.tube,
      fading: v.fading,
    };
    const lastTube = v.tip.tube ||
      (v.records.length ? [...v.records].reverse().find((r) => r.kind === 'tube')?.handle : null);
    if (lastTube) {
      const m = this._m4;
      lastTube.batch.getMatrix(lastTube, m);
      const e = m.elements;
      out.lastTubeLen = Math.hypot(e[4], e[5], e[6]); // column-1 norm = scale.y
    }
    return out;
  }

  dispose() {
    this._clearAll();
    for (const b of this._batches) b.dispose();
    for (const m of [this.matSolid, this.matFade, this.matElbowSolid, this.matElbowFade]) {
      m.dispose();
    }
    this.renderer.dispose();
  }
}
