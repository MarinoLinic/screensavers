// Renderer sync tests: drive PipeRenderer._syncPath/_updateTip against a
// prototype-level stub — real InstanceBatch slot logic and real THREE math,
// fake path fixtures, no WebGL context needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { DIRS } from '../js/engine.js';
import {
  elbowPlacement, planPending, pendingTipPoint, axisQuat, planTransition,
  makeTubeGeometry, makeElbowGeometry, makeBallGeometry,
} from '../js/geometry.js';
import { PipeRenderer } from '../js/renderer.js';
import { InstanceBatch } from '../js/batch.js';
import { PipeWorld, ENGINE_DEFAULTS } from '../js/engine.js';
import { PRESETS } from '../js/settings.js';

const mat = () => new THREE.MeshPhongMaterial({ color: 0xffffff });
const matT = () =>
  new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true });

/** Minimal OrbitCamera stand-in: same fields + update()/reset()/setHome. */
function fakeOrbit(camera) {
  const o = {
    yaw: 0.7, pitch: 0.42, dist: 40,
    home: { yaw: 0.7, pitch: 0.42, dist: 40 },
    autoRotate: true,
    camera,
    update() {
      const cp = Math.cos(this.pitch);
      this.camera.position.set(
        Math.cos(this.yaw) * cp * this.dist,
        Math.sin(this.pitch) * this.dist,
        Math.sin(this.yaw) * cp * this.dist);
      this.camera.lookAt(0, 0, 0);
    },
    reset() {
      this.yaw = this.home.yaw;
      this.pitch = this.home.pitch;
      this.dist = this.home.dist;
      this.update();
    },
    setHome(d) { this.home.dist = d; },
  };
  return o;
}

function makeRenderer(joints = 'elbows', hardCap = 16384) {
  const r = Object.create(PipeRenderer.prototype);
  const mk = (geo, m, reveal, name) => new InstanceBatch(geo, m, {
    capacity: 8, hardCap, reveal, name,
  });
  r.solid = {
    tube: mk(makeTubeGeometry(), mat(), false, 'tube'),
    elbow: mk(makeElbowGeometry(), mat(), true, 'elbow'),
    ball: mk(makeBallGeometry(), mat(), false, 'ball'),
  };
  r.fading = {
    tube: mk(makeTubeGeometry(), matT(), false, 'tube.f'),
    elbow: mk(makeElbowGeometry(), matT(), true, 'elbow.f'),
    ball: mk(makeBallGeometry(), matT(), false, 'ball.f'),
  };
  r.matSolid = mat();
  r.matFade = matT();
  r.matElbowSolid = mat();
  r.matElbowFade = matT();
  r._mats = [r.matSolid, r.matFade, r.matElbowSolid, r.matElbowFade];
  r.scene = new THREE.Scene();
  r.scene.background = new THREE.Color('#000000');
  r._fog = new THREE.Fog('#000000', 1, 100);
  r.scene.fog = r._fog;
  const hues = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
    .map((h) => new THREE.Color(h));
  r._palU = { uPixelMode: { value: 0 } };
  r.cameraPersp = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  r.cameraOrtho = new THREE.OrthographicCamera(-10, 10, 10, -10, -300, 700);
  r.camera = r.cameraPersp;
  r.pixelMode = false;
  r._savedView = null;
  r.orbit = fakeOrbit(r.cameraPersp);
  r.resize = () => {}; // no DOM/WebGL in the stub
  r.settings = { joints, pixelMode: false };
  r._dirQuat = DIRS.map(axisQuat);
  r._m4 = new THREE.Matrix4();
  r._v3 = new THREE.Vector3();
  r._sv3 = new THREE.Vector3();
  r._qI = new THREE.Quaternion();
  r._colors = hues;
  r.views = new Map();
  return r;
}

function fakePath(id, cells, dirs, pending, tint = 0) {
  return {
    id, state: 'active', tint, growthTint: tint,
    tints: dirs.map(() => tint), // engine history: one tint per committed dir
    terminalDir: null, cells, dirs, pending,
  };
}

const rgb = (handle) => {
  const a = handle.batch.mesh.instanceColor.array;
  return [a[handle.index * 3], a[handle.index * 3 + 1], a[handle.index * 3 + 2]];
};
const tintAt = (handle) => handle.batch.tintAttr.array[handle.index];

const m4 = (batch, handle) => {
  const m = new THREE.Matrix4();
  batch.getMatrix(handle, m);
  return m;
};
const pos = (m) => [m.elements[12], m.elements[13], m.elements[14]];
// instanceMatrix.array is float32 -> 1e-5 tolerance
const closeTo = (a, b, msg = '') =>
  assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-5),
    `${msg}: expected ${a} ~= ${b}`);

test('tip elbow is re-placed on every pending plan change (consecutive turns)', () => {
  const r = makeRenderer();
  const path = fakePath(1, [[0, 0, 0]], [], {
    from: [0, 0, 0], to: [1, 0, 0], dir: 0, progress: 0.9,
    next: { to: [1, 1, 0], dir: 2 },
  });
  r._syncPath(path);
  const view = r.views.get(1);
  const elbow = r.solid.elbow;
  assert.ok(view.tip.elbow, 'first turn should show a preview elbow');
  closeTo(m4(elbow, view.tip.elbow).elements,
    elbowPlacement(DIRS[0], DIRS[2], [1, 0, 0]).basis.elements);

  // Commit: the reserved next cell becomes the new pending step — and the
  // next-next lookahead bends again. The SAME tip elbow handle must now be
  // placed at the new bend, not still showing the old one.
  const handleBefore = view.tip.elbow;
  path.cells.push([1, 0, 0]);
  path.dirs.push(0);
  path.pending = {
    from: [1, 0, 0], to: [1, 1, 0], dir: 2, progress: 0.9,
    next: { to: [1, 1, 1], dir: 4 },
  };
  r._syncPath(path);
  assert.equal(view.tip.elbow, handleBefore, 'tip elbow handle is recycled');
  closeTo(m4(elbow, view.tip.elbow).elements,
    elbowPlacement(DIRS[2], DIRS[4], [1, 1, 0]).basis.elements,
    'elbow must move to the new bend on commit');

  // cap rides the new centerline and reveal matches the new plan fraction
  const plan = planPending(path, 'elbows');
  const tip = pendingTipPoint(plan, 0.9);
  closeTo(pos(m4(r.solid.ball, view.tip.cap)), tip.point, 'cap point');
  assert.ok(Math.abs(elbow.revealAttr.array[view.tip.elbow.index] - tip.arcFrac) < 1e-5,
    'reveal must track the new plan, not the old one');

  // Commit into a straight continuation: the preview elbow is freed.
  path.cells.push([1, 1, 0]);
  path.dirs.push(2);
  const elbowCount = elbow.count;
  path.pending = {
    from: [1, 1, 0], to: [1, 1, 1], dir: 4, progress: 0.5,
    next: { to: [1, 1, 2], dir: 4 },
  };
  r._syncPath(path);
  assert.equal(view.tip.elbow, null, 'straight step must free the preview elbow');
  // one committed elbow was added for the real bend at [1,1,0], the preview
  // tip elbow was freed -> net zero growth on the shared elbow batch
  assert.equal(elbow.count, elbowCount);

  // Turn again: a fresh preview elbow appears at the new bend.
  path.cells.push([1, 1, 1]);
  path.dirs.push(4);
  path.pending = {
    from: [1, 1, 1], to: [1, 1, 2], dir: 4, progress: 0.9,
    next: { to: [2, 1, 2], dir: 0 },
  };
  r._syncPath(path);
  assert.ok(view.tip.elbow, 'new turn should allocate a fresh preview elbow');
  closeTo(m4(elbow, view.tip.elbow).elements,
    elbowPlacement(DIRS[4], DIRS[0], [1, 1, 2]).basis.elements);
});

test('_syncPath on a stable finished path performs zero buffer writes', () => {
  const r = makeRenderer();
  const path = fakePath(2, [[0, 0, 0], [1, 0, 0], [1, 1, 0]], [0, 2], null);
  path.state = 'finished';
  r._syncPath(path);
  const counts = { matrix: 0, color: 0, reveal: 0, alloc: 0, free: 0 };
  const spy = (b) => {
    for (const [m, key] of [['setMatrix', 'matrix'], ['setColor', 'color'],
      ['setReveal', 'reveal'], ['alloc', 'alloc'], ['free', 'free']]) {
      const orig = b[m].bind(b);
      b[m] = (...a) => { counts[key]++; return orig(...a); };
    }
  };
  for (const set of [r.solid, r.fading]) for (const b of Object.values(set)) spy(b);
  r._syncPath(path);
  r._syncPath(path);
  assert.deepEqual(counts, { matrix: 0, color: 0, reveal: 0, alloc: 0, free: 0 },
    'finished-path re-sync must not touch any buffer');
});

test('reveal range is clamped and zeroed for capped (no-next) finishes', () => {
  const r = makeRenderer();
  const path = fakePath(3, [[0, 0, 0]], [], {
    from: [0, 0, 0], to: [1, 0, 0], dir: 0, progress: 0.6,
    next: null, // blocked/capped finish: no lookahead, no elbow preview
  });
  r._syncPath(path);
  const view = r.views.get(3);
  assert.equal(view.tip.elbow, null, 'no-next pending shows no preview elbow');
  assert.ok(view.tip.cap, 'cap still travels with the tip');
});

test('queued tint colours only the next segment — committed bands frozen', () => {
  const r = makeRenderer();
  const hues = r._colors;
  // In-flight segment planned with tint 0; a pulse queued growthTint 3.
  const path = fakePath(1, [[0, 0, 0], [1, 0, 0]], [0], {
    from: [1, 0, 0], to: [1, 1, 0], dir: 2, progress: 0.7,
    next: { to: [1, 1, 1], dir: 4 }, tint: 0,
  });
  path.tints = [0];
  path.growthTint = 3;
  r._syncPath(path);
  const view = r.views.get(1);
  assert.equal(view.tipTint, 0, 'in-flight tip keeps its planned tint');
  for (const rec of view.records) {
    closeTo(rgb(rec.handle), hues[0].toArray(), 'old record recolored');
  }
  for (const h of Object.values(view.tip)) {
    if (h) closeTo(rgb(h), hues[0].toArray(), 'preview recolored by pulse');
  }

  // Boundary commit: the segment that just landed keeps tint 0; the new
  // pending (carrying the queued tint 3) recolours the tip handles once.
  path.cells.push([1, 1, 0]);
  path.dirs.push(2);
  path.tints.push(0);
  path.pending = {
    from: [1, 1, 0], to: [1, 1, 1], dir: 4, progress: 0.5,
    next: null, tint: 3,
  };
  r._syncPath(path);
  assert.equal(view.tipTint, 3);
  for (const rec of view.records) {
    closeTo(rgb(rec.handle), hues[0].toArray(),
      'boundary commit must not repaint old records');
  }
  closeTo(rgb(view.tip.tube), hues[3].toArray(),
    'new segment shows the queued colour');
  closeTo(rgb(view.tip.cap), hues[3].toArray());

  // Second commit: tints [0,0,3] — one continuous path, two colour bands.
  path.cells.push([1, 1, 1]);
  path.dirs.push(4);
  path.tints.push(3);
  path.pending = null;
  r._syncPath(path);
  const bandTints = [...new Set(view.records.map((x) => x.tint))].sort();
  assert.deepEqual(bandTints, [0, 3], 'one path, two bands');
  for (const rec of view.records) {
    closeTo(rgb(rec.handle), hues[rec.tint].toArray(),
      `record painted wrong band (tint ${rec.tint})`);
    assert.equal(tintAt(rec.handle), rec.tint);
  }
});

test('manual applyStyle recolours by record tint — bands survive a theme', () => {
  const r = makeRenderer();
  const path = fakePath(1, [[0, 0, 0], [1, 0, 0], [1, 1, 0]], [0, 2], null);
  path.state = 'finished';
  path.tints = [0, 4];
  r._syncPath(path);
  const view = r.views.get(1);
  assert.ok(view.records.some((x) => x.tint === 4), 'fixture must be banded');

  r.applyStyle(null, { preset: 'candy', joints: 'elbows' });
  const hues = PRESETS.candy.hues.map((h) => new THREE.Color(h));
  for (const rec of view.records) {
    closeTo(rgb(rec.handle), hues[rec.tint].toArray(),
      `record must follow its own tint ${rec.tint}, not the view tint`);
  }
  assert.equal(r.matSolid.shininess, PRESETS.candy.shininess,
    'material follows the new style');
  assert.equal(r.scene.background.getHexString(),
    new THREE.Color(PRESETS.candy.bg).getHexString());
});

test('rebuildAll restores historical bands after a joints replan', () => {
  const r = makeRenderer('elbows');
  const path = fakePath(1,
    [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [0, 2, 4], null);
  path.state = 'finished';
  path.tints = [0, 4, 4];
  r._syncPath(path);
  r.settings = { joints: 'ball', pixelMode: false };
  r.rebuildAll({ paths: new Map([[1, path]]) });
  const view = r.views.get(1);
  const tints = view.records.map((x) => x.tint).sort();
  assert.deepEqual(tints, [0, 0, 0, 4, 4, 4, 4],
    'start cap + transition pieces must keep their band colours');
});

test('pixel mode: perspective -> iso -> perspective restores the view', () => {
  const r = makeRenderer();
  r.orbit.yaw = 0.3; r.orbit.pitch = 0.55; r.orbit.dist = 30;
  r.setDisplay({ joints: 'elbows', pixelMode: true, camera: 'orbit', lowRes: false });
  assert.equal(r.camera, r.cameraOrtho, 'ortho active in pixel mode');
  assert.equal(r.scene.fog, null, 'fog off for the flat 2.5D look');
  assert.equal(r.orbit.camera, r.cameraOrtho);
  assert.ok(Math.abs(r.orbit.yaw - Math.PI / 4) < 1e-9, 'iso yaw');
  assert.ok(Math.abs(r.orbit.pitch - Math.asin(1 / Math.sqrt(3))) < 1e-9,
    'iso pitch');
  assert.equal(r.orbit.autoRotate, false,
    'auto-orbit off in pixel mode without touching the camera setting');
  assert.equal(r._palU.uPixelMode.value, 1);
  // wheel zoom mirrors through the ortho zoom ratio
  r.orbit.dist = r.orbit.home.dist * 2;
  r._syncOrthoZoom();
  assert.ok(Math.abs(r.cameraOrtho.zoom - 0.5) < 1e-9, 'ortho zoom = home/dist');

  r.setDisplay({ joints: 'elbows', pixelMode: false, camera: 'orbit', lowRes: false });
  assert.equal(r.camera, r.cameraPersp, 'perspective restored');
  assert.equal(r.scene.fog, r._fog, 'fog restored');
  assert.equal(r.orbit.yaw, 0.3, 'saved perspective yaw restored');
  assert.equal(r.orbit.dist, 30, 'saved perspective dist restored');
  assert.equal(r.orbit.autoRotate, true);
  assert.equal(r._palU.uPixelMode.value, 0);
});

test('pixel mode quantizes tip progress — tube, reveal and cap share it', () => {
  const r = makeRenderer();
  r.pixelMode = true;
  const path = fakePath(1, [[0, 0, 0]], [], {
    from: [0, 0, 0], to: [1, 0, 0], dir: 0, progress: 0.9,
    next: { to: [1, 1, 0], dir: 2 },
  });
  r._syncPath(path);
  const view = r.views.get(1);
  const qp = Math.floor(0.9 * 12) / 12; // stepped growth: 10/12
  const tip = pendingTipPoint(planPending(path, 'elbows'), qp);
  closeTo(pos(m4(view.tip.cap.batch, view.tip.cap)), tip.point,
    'cap rides the QUANTIZED tip');
  assert.ok(view.tip.elbow);
  assert.ok(Math.abs(
    view.tip.elbow.batch.revealAttr.array[view.tip.elbow.index]
    - tip.arcFrac) < 1e-4, 'reveal tracks quantized progress');
});

test('max-speed growth stays exact across dt, joints and pixel modes', () => {
  // Expected committed-tube matrix, mirroring renderer._segMatrix: the tube
  // geometry spans y∈[0,1] (translated base), so the matrix anchors at the
  // trimmed segment start and scales its length.
  const segMatrix = (segStart, dirIdx, len) => new THREE.Matrix4().compose(
    new THREE.Vector3(segStart[0], segStart[1], segStart[2]),
    axisQuat(DIRS[dirIdx]),
    new THREE.Vector3(1, Math.max(0.001, len), 1));
  for (const pixel of [false, true]) {
    for (const joints of ['elbows', 'ball', 'mixed']) {
      for (const dt of [1 / 60, 1 / 30, 0.08, 0.25]) {
        const r = makeRenderer(joints);
        r.pixelMode = pixel;
        r.settings = { joints, pixelMode: pixel };
        const world = new PipeWorld({
          speed: 4, bends: 1, pipeCount: 8, density: 0.65,
          mode: 'living', seed: 1337, joints, autoCycle: true,
        }, { ...ENGINE_DEFAULTS });
        const check = (label) => {
          for (const path of world.paths.values()) {
            const v = r.views.get(path.id);
            assert.ok(v, `${label}: missing view for path ${path.id}`);
            assert.equal(v.committed, path.dirs.length,
              `${label}: committed count lagged after world.step + update`);
            // frozen per-instance colour: every record paints its own tint
            for (const rec of v.records) {
              closeTo(rgb(rec.handle),
                r._colors[rec.tint % r._colors.length].toArray(),
                `${label}: record RGB does not match its tint`);
              assert.equal(tintAt(rec.handle),
                rec.tint % r._colors.length,
                `${label}: tint attribute drifted`);
            }
            // the last transition's pieces all share its committed tint
            if (v.committed) {
              const wt = path.tints?.[v.committed - 1] ?? path.tint;
              for (const rec of v.tail) {
                assert.equal(rec.tint, wt,
                  `${label}: tail piece off the segment band`);
              }
            }
            if (v.committed) {
              const plan = planTransition(path, v.committed - 1, joints);
              assert.equal(v.endSig, plan.endSig,
                `${label}: tail endSig stale`);
              const tube = v.tail.find((x) => x.kind === 'tube');
              assert.ok(tube, `${label}: committed tube missing`);
              closeTo(m4(tube.handle.batch, tube.handle).elements,
                segMatrix(plan.segStart, plan.d, plan.segLen).elements,
                `${label}: tail tube off its segment`);
              if (plan.joint === 'elbow') {
                const er = v.tail.find((x) => x.kind === 'elbow');
                assert.ok(er, `${label}: committed elbow missing`);
                closeTo(m4(er.handle.batch, er.handle).elements,
                  elbowPlacement(DIRS[plan.d], DIRS[plan.nd], plan.B)
                    .basis.elements, `${label}: last bend misplaced`);
                assert.equal(
                  er.handle.batch.revealAttr.array[er.handle.index], 1,
                  `${label}: committed elbow must be fully revealed`);
                if (plan.terminalBend) {
                  const cap = v.tail.find((x) => x.kind === 'ball');
                  assert.ok(cap, `${label}: terminal cap missing`);
                  closeTo(pos(m4(cap.handle.batch, cap.handle)), plan.capPos,
                    `${label}: terminal cap not at outgoing tangent`);
                }
              } else if (plan.joint === 'ball' || plan.joint === 'cap') {
                const j = v.tail.find((x) => x.kind === 'ball');
                assert.ok(j, `${label}: ${plan.joint} joint ball missing`);
                closeTo(pos(m4(j.handle.batch, j.handle)), plan.capPos,
                  `${label}: ${plan.joint} joint off the cell`);
              }
            }
            if (path.pending) {
              const plan = planPending(path, joints);
              let p = Math.min(1, Math.max(0, path.pending.progress));
              if (pixel) p = Math.floor(p * 12) / 12; // stepped growth
              const tip = pendingTipPoint(plan, p);
              // tip colour = the tint captured when this pending was planned
              const wt = path.pending.tint ?? path.growthTint ?? path.tint;
              assert.equal(v.tipTint, wt, `${label}: tip tint drifted`);
              for (const k of ['tube', 'cap', 'elbow']) {
                const h = v.tip[k];
                if (h) closeTo(rgb(h),
                  r._colors[wt % r._colors.length].toArray(),
                  `${label}: tip ${k} RGB does not match queued tint`);
              }
              assert.ok(v.tip.cap, `${label}: tip cap missing`);
              closeTo(pos(m4(v.tip.cap.batch, v.tip.cap)), tip.point,
                `${label}: cap off the centerline`);
              if (plan.hasArc) {
                if (tip.arcFrac > 0) {
                  assert.ok(v.tip.elbow, `${label}: preview elbow missing`);
                  closeTo(m4(v.tip.elbow.batch, v.tip.elbow).elements,
                    elbowPlacement(DIRS[plan.d], DIRS[plan.nd], plan.B)
                      .basis.elements, `${label}: preview elbow misplaced`);
                  assert.ok(Math.abs(
                    v.tip.elbow.batch.revealAttr.array[v.tip.elbow.index]
                    - tip.arcFrac) < 1e-4,
                    `${label}: reveal fraction drifted`);
                }
              } else {
                assert.equal(v.tip.elbow, null,
                  `${label}: stray preview elbow on straight/cap step`);
              }
            } else {
              assert.equal(v.tip.tube, null, `${label}: tip leaked on finished`);
            }
          }
        };
        // Every world.step + update must leave the view exact — same frame.
        // Colour pulses land mid-run: bands appear only at segment bounds.
        for (let s = 0; s < 1200; s++) {
          if (s % 40 === 20) world.requestColorChange();
          world.step(dt);
          r.update(world); // drains events + syncs every path
          check(`[pixel=${pixel} ${joints} dt=${dt} step ${s}]`);
        }
      }
    }
  }
});
