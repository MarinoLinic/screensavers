import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlyWorld, VIEW } from '../js/engine.js';
import { DEFAULTS, SHAPES, MOTION_ORDER } from '../js/settings.js';

const mk = (over = {}) => new FlyWorld({ ...DEFAULTS, ...over });

function stepN(w, n, dt = 1 / 30) {
  for (let i = 0; i < n; i++) w.step(dt);
}

/** Step a world until its simTime matches target (exact final fractional step). */
function stepTo(w, simTime) {
  while (w.simTime < simTime - 1e-12) {
    w.step(Math.min(0.05, (simTime - w.simTime) / w.settings.speed));
  }
}

function finiteBody(b) {
  return b.position.every(Number.isFinite) && b.rotation.every(Number.isFinite)
    && Number.isFinite(b.scale) && Number.isFinite(b.opacity);
}

test('seed 0 is valid and deterministic; different seeds differ', () => {
  const a = mk({ seed: 0 });
  const b = mk({ seed: 0 });
  const c = mk({ seed: 1 });
  stepN(a, 60); stepN(b, 60); stepN(c, 60);
  const sa = JSON.stringify(a.sample().bodies);
  assert.equal(sa, JSON.stringify(b.sample().bodies), 'same seed must match');
  assert.notEqual(sa, JSON.stringify(c.sample().bodies), 'seed 1 must differ');
  assert.equal(a.seed, 0);
});

test('mixed family guarantees all ten shapes at count >= 10', () => {
  const w = mk({ family: 'mixed', count: 30 });
  const shapes = new Set(w.sample().bodies.map((b) => b.shape));
  for (const s of SHAPES) assert.ok(shapes.has(s), `mixed missing ${s}`);
});

test('families constrain the shape set', () => {
  const expect = {
    classics: new Set(['cube', 'sphere', 'teapot', 'torus']),
    polyhedra: new Set(['cube', 'octahedron', 'icosahedron']),
    loops: new Set(['torus', 'knot', 'rings']),
    satellites: new Set(['satellite']),
    teapots: new Set(['teapot']),
  };
  for (const [family, allowed] of Object.entries(expect)) {
    const w = mk({ family, count: 12, seed: 7 });
    for (const b of w.sample().bodies) {
      assert.ok(allowed.has(b.shape), `${family} produced ${b.shape}`);
    }
  }
});

test('all motions stay finite and bounded over 10k steps, all aspects', () => {
  const solo = (m) => m === 'classic' || m === 'flowerbox';
  const hh = Math.tan((VIEW.fov * Math.PI) / 360) * VIEW.dist;
  const checkSnap = (w, motion, aspect) => {
    const snap = w.sample();
    assert.ok(Number.isFinite(snap.time), `${motion} time`);
    assert.equal(snap.count, solo(motion) ? 1 : 20);
    const maxX = Math.max(15 * 1.5, hh * Math.max(0.35, aspect) * 0.7 * 1.5);
    const maxY = 8.5 * 1.5;
    const maxZ = 12 * 1.5;
    for (const b of snap.bodies) {
      assert.ok(finiteBody(b), `${motion} a${aspect} body ${b.id} finite`);
      // allow ~25% slack for ribbon/offsets and per-body radius
      assert.ok(Math.abs(b.position[0]) <= maxX * 1.25 + 3, `${motion} a${aspect} x=${b.position[0]}`);
      assert.ok(Math.abs(b.position[1]) <= maxY * 1.25 + 3, `${motion} a${aspect} y=${b.position[1]}`);
      assert.ok(b.position[2] >= -maxZ - 3 && b.position[2] <= maxZ + 3, `${motion} a${aspect} z=${b.position[2]}`);
      assert.ok(b.opacity >= 0 && b.opacity <= 1, `${motion} opacity`);
    }
  };
  for (const motion of MOTION_ORDER) {
    for (const aspect of [0.45, 1, 1.8, 3]) {
      const w = mk({ motion, count: 20, spread: 1.5, scale: 1.8 });
      w.setAspect(aspect);
      // sample every ~100 steps so wrap/transient states are exercised,
      // not just the final frame
      for (let i = 0; i < 100; i++) {
        stepN(w, 100, 0.05);
        checkSnap(w, motion, aspect);
      }
    }
  }
});

test('all motions produce distinct trajectories', () => {
  const paths = MOTION_ORDER.map((motion) => {
    const w = mk({ motion, seed: 42, count: 8 });
    w.setAspect(1.6);
    const pts = [];
    for (let i = 0; i < 40; i++) {
      w.step(0.1);
      pts.push(w.sample().bodies[0].position.map((v) => v.toFixed(3)).join(','));
    }
    return pts.join('|');
  });
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      assert.notEqual(paths[i], paths[j], `${MOTION_ORDER[i]} vs ${MOTION_ORDER[j]}`);
    }
  }
});

test('equal elapsed partition produces the same sample', () => {
  const a = mk({ seed: 99 });
  const b = mk({ seed: 99 });
  a.step(2.4);
  for (let i = 0; i < 24; i++) b.step(0.1);
  const sa = a.sample();
  const sb = b.sample();
  assert.equal(sa.bodies.length, sb.bodies.length);
  for (let i = 0; i < sa.bodies.length; i++) {
    for (let k = 0; k < 3; k++) {
      assert.ok(Math.abs(sa.bodies[i].position[k] - sb.bodies[i].position[k]) < 1e-9,
        `body ${i} axis ${k} drifted`);
      assert.ok(Math.abs(sa.bodies[i].rotation[k] - sb.bodies[i].rotation[k]) < 1e-9);
    }
  }
});

test('speed multiplies sim time; spin 0 freezes rotation only', () => {
  const slow = mk({ speed: 0.15 });
  const fast = mk({ speed: 3 });
  stepN(slow, 100, 0.05); stepN(fast, 100, 0.05);
  assert.ok(fast.simTime > slow.simTime);
  assert.ok(Math.abs(fast.simTime / slow.simTime - 20) < 0.01);

  const still = mk({ speed: 0.15 });
  still.settings = { ...still.settings, speed: 0 };
  stepN(still, 100);
  assert.equal(still.simTime, 0, 'speed 0 must freeze sim time');

  const nospin = mk({ spin: 0 });
  stepN(nospin, 100, 0.05);
  const s0 = nospin.sample().bodies[0];
  stepN(nospin, 100, 0.05);
  const s1 = nospin.sample().bodies[0];
  assert.deepEqual(s0.rotation, s1.rotation, 'spin 0 must freeze rotation');
  assert.notDeepEqual(s0.position, s1.position, 'positions must still move');
});

test('invalid dt is ignored; negative and NaN do not corrupt', () => {
  const w = mk();
  w.step(-1); w.step(NaN); w.step(Infinity); w.step(0);
  assert.equal(w.simTime, 0);
  stepN(w, 10, 0.05);
  assert.ok(w.simTime > 0);
});

test('look/display updates never reset time or regenerate bodies', () => {
  const w = mk({ seed: 5 });
  stepN(w, 60);
  const ids = w.sample().bodies.map((b) => `${b.id}:${b.shape}`).join(',');
  const t = w.simTime;
  for (const k of ['preset', 'material', 'camera', 'trails', 'stars', 'lowRes', 'scanlines', 'speed', 'spin']) {
    const over = {
      preset: 'candy', material: 'glass', camera: 'fixed', trails: true,
      stars: false, lowRes: true, scanlines: true, speed: 2, spin: 0.1,
    }[k];
    w.updateSettings({ ...w.settings, [k]: over });
  }
  assert.equal(w.simTime, t, 'sim time must survive look changes');
  assert.equal(w.sample().bodies.map((b) => `${b.id}:${b.shape}`).join(','), ids,
    'look changes must not regenerate bodies');
});

test('family/count/seed changes regenerate deterministically', () => {
  const w = mk({ count: 8 });
  const a = w.sample().bodies.map((b) => b.shape).join(',');
  w.updateSettings({ ...w.settings, count: 14 });
  assert.equal(w.count, 14);
  w.updateSettings({ ...w.settings, count: 8 });
  assert.equal(w.sample().bodies.map((b) => b.shape).join(','), a,
    'returning to the same count must reproduce the same bodies');
  w.updateSettings({ ...w.settings, seed: 777 });
  assert.equal(w.seed, 777);
  assert.notEqual(w.sample().bodies.map((b) => b.shape).join(','), a);
});

test('classic flies exactly one large object; count pref preserved', () => {
  const w = mk({ motion: 'classic', count: 33 });
  const snap = w.sample();
  assert.equal(snap.count, 1);
  assert.equal(w.settings.count, 33, 'count preference kept');
  assert.ok(snap.bodies[0].scale > 1.5, 'classic piece should be large');
  w.updateSettings({ ...w.settings, motion: 'drift' });
  assert.equal(w.sample().count, 33, 'leaving classic restores count');
});

test('classic boundary regenerates even when effective count is unchanged', () => {
  // count=1: drift -> classic -> drift must regenerate the hero size both ways
  const w = mk({ motion: 'drift', count: 1 });
  const driftScale = w.sample().bodies[0].scale;
  w.updateSettings({ ...w.settings, motion: 'classic' });
  const hero = w.sample().bodies[0];
  assert.equal(w.sample().count, 1);
  assert.equal(hero.scale, 2.6 * w.settings.scale, 'classic hero must be size 2.6');
  w.updateSettings({ ...w.settings, motion: 'drift' });
  const back = w.sample().bodies[0];
  assert.equal(back.scale, driftScale, 'leaving classic restores seeded size');
});

test('motion change eases from displayed positions, then settles', () => {
  const w = mk({ motion: 'drift' });
  w.setAspect(1.6);
  stepN(w, 120, 0.05);
  const before = w.sample().bodies.map((b) => [...b.position]);
  w.updateSettings({ ...w.settings, motion: 'orbit' });
  w.step(0.08); // ~10% into the ease window
  const mid = w.sample().bodies;
  for (const b of mid) assert.ok(finiteBody(b));
  // early in the ease, displayed positions must still be near the OLD layout
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const closeCount = mid.filter((b, i) => dist(b.position, before[i]) < 2).length;
  assert.ok(closeCount >= mid.length - 2, 'eased positions should start near the old layout');
  stepN(w, 120, 0.05); // well past the 0.8s ease
  const after = w.sample().bodies;
  // settled output must equal an independently constructed orbit world exactly
  const ref = mk({ motion: 'orbit', seed: w.seed });
  ref.setAspect(1.6);
  stepTo(ref, w.simTime);
  const refBodies = ref.sample().bodies;
  for (let i = 0; i < after.length; i++) {
    assert.ok(finiteBody(after[i]));
    assert.ok(dist(after[i].position, refBodies[i].position) < 0.01,
      `body ${i} should settle onto the orbit target`);
  }
});

test('settleLayout applies pending layout without stepping time', () => {
  const w = mk({ motion: 'drift', seed: 11 });
  w.setAspect(1.2);
  stepN(w, 60, 0.05);
  w.updateSettings({ ...w.settings, motion: 'orbit' });
  w.settleLayout(); // no step: paused-path equivalent
  const ref = mk({ motion: 'orbit', seed: 11 });
  ref.setAspect(1.2);
  stepTo(ref, w.simTime);
  const a = w.sample().bodies;
  const b = ref.sample().bodies;
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.deepEqual(a[i].position, b[i].position,
      `body ${i} must land exactly on the settled target`);
  }
  const t = w.simTime;
  w.settleLayout();
  assert.equal(w.simTime, t, 'settleLayout must not advance time');
});

test('spin changes never snap orientation; spin 0 freezes pose', () => {
  const w = mk({ spin: 0.5 });
  stepN(w, 100, 0.05);
  const rot0 = [...w.sample().bodies[0].rotation];
  w.updateSettings({ ...w.settings, spin: 0 });
  const rotAfterSet = [...w.sample().bodies[0].rotation];
  assert.deepEqual(rotAfterSet, rot0, 'setting spin 0 must not snap rotation');
  stepN(w, 50, 0.05);
  const p0 = w.sample().bodies[0];
  stepN(w, 50, 0.05);
  const p1 = w.sample().bodies[0];
  assert.deepEqual(p1.rotation, p0.rotation, 'spin 0 freezes the pose');
  assert.notDeepEqual(p1.position, p0.position, 'positions must still move');
  w.updateSettings({ ...w.settings, spin: 0.8 });
  const rotBeforeResume = [...w.sample().bodies[0].rotation];
  assert.deepEqual(rotBeforeResume, p1.rotation, 'raising spin must not snap');
  w.step(0.05);
  assert.notDeepEqual(w.sample().bodies[0].rotation, rotBeforeResume,
    'resumed spin advances from the frozen pose');
});

test('partition independence covers rotation accumulator too', () => {
  const a = mk({ seed: 7 });
  const b = mk({ seed: 7 });
  a.step(1.7);
  for (let i = 0; i < 17; i++) b.step(0.1);
  const ra = a.sample().bodies[0].rotation;
  const rb = b.sample().bodies[0].rotation;
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(ra[k] - rb[k]) < 1e-9);
});

test('flowerbox: one centered box, fleet prefs preserved, hero sized 2.6', () => {
  const w = mk({ motion: 'flowerbox', family: 'teapots', count: 30, spread: 1.5 });
  for (const dt of [0, 0.5, 1.3]) {
    if (dt) w.step(dt);
    const snap = w.sample();
    assert.equal(snap.count, 1);
    const b = snap.bodies[0];
    assert.equal(b.shape, 'flowerbox');
    assert.deepEqual(b.position, [0, 0, 0], 'box must stay centered');
    assert.ok(Number.isFinite(b.scale) && b.scale > 0);
  }
  assert.equal(w.settings.count, 30, 'count preference kept');
  assert.equal(w.settings.family, 'teapots', 'family preference kept');
});

test('flowerbox entry centers immediately; boundary regenerates both ways', () => {
  // count=1 drift -> flowerbox -> drift: structural on both crossings
  const w = mk({ motion: 'drift', count: 1 });
  stepN(w, 60, 0.05);
  const driftBody = w.sample().bodies[0];
  w.updateSettings({ ...w.settings, motion: 'flowerbox' });
  const box = w.sample().bodies[0]; // no step needed: entry settles at once
  assert.equal(box.shape, 'flowerbox');
  assert.deepEqual(box.position, [0, 0, 0], 'entry must not ease from old pos');
  assert.equal(box.scale, 2.6 * w.settings.scale * Math.min(1, w.aspect / 0.8));
  w.updateSettings({ ...w.settings, motion: 'drift' });
  const back = w.sample().bodies[0];
  assert.notEqual(back.shape, 'flowerbox', 'fleet shape restored');
  assert.equal(back.scale, driftBody.scale, 'seeded size restored');
  // count16 fleet -> flowerbox -> fleet restores the whole set
  const f = mk({ seed: 42 });
  const fleetShapes = f.sample().bodies.map((b) => b.shape).join(',');
  f.updateSettings({ ...f.settings, motion: 'flowerbox' });
  assert.equal(f.sample().count, 1);
  f.updateSettings({ ...f.settings, motion: 'drift' });
  const snap = f.sample();
  assert.equal(snap.count, 16);
  assert.equal(snap.bodies.map((b) => b.shape).join(','), fleetShapes);
  // classic <-> flowerbox at count 1 also crosses the boundary
  const c = mk({ motion: 'classic', count: 1 });
  c.updateSettings({ ...c.settings, motion: 'flowerbox' });
  assert.equal(c.sample().bodies[0].shape, 'flowerbox');
});

test('flowerbox paused select settles centered without time advance', () => {
  const w = mk({ seed: 9 });
  stepN(w, 40, 0.05);
  const t = w.simTime;
  const rt = w.rotationTime;
  w.updateSettings({ ...w.settings, motion: 'flowerbox' });
  w.settleLayout(); // the paused frame path
  const b = w.sample().bodies[0];
  assert.deepEqual(b.position, [0, 0, 0]);
  assert.equal(w.simTime, t, 'no time advance');
  assert.equal(w.rotationTime, rt, 'no rotation advance');
});

test('flowerbox hero shrinks to fit portrait aspects', () => {
  const wide = mk({ motion: 'flowerbox' });
  wide.setAspect(1.8);
  const tall = mk({ motion: 'flowerbox' });
  tall.setAspect(0.45);
  const ws = wide.sample().bodies[0].scale;
  const ts = tall.sample().bodies[0].scale;
  assert.ok(Number.isFinite(ws) && Number.isFinite(ts));
  assert.ok(ts < ws, 'portrait box must be smaller');
  assert.ok(Math.abs(ws - 2.6 * wide.settings.scale) < 1e-9, 'wide keeps 2.6');
});

test('portrait aspect narrows the horizontal volume', () => {
  const wide = mk({ motion: 'drift' }); wide.setAspect(3);
  const tall = mk({ motion: 'drift' }); tall.setAspect(0.45);
  stepN(wide, 4000, 0.05); stepN(tall, 4000, 0.05);
  const span = (w) => {
    let m = 0;
    for (const b of w.sample().bodies) m = Math.max(m, Math.abs(b.position[0]));
    return m;
  };
  assert.ok(span(tall) < span(wide), 'portrait must pack tighter horizontally');
});
