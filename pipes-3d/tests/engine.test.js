import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PipeWorld, DIRS, OPPOSITE } from '../js/engine.js';
import { validateSettings, DEFAULTS } from '../js/settings.js';

function makeWorld(settingOver = {}, engineOver = {}) {
  const { settings } = validateSettings({ ...DEFAULTS, ...settingOver });
  return new PipeWorld(settings, { prewarmSteps: 0, ...engineOver });
}

/** Structural invariants: lattice legality, single ownership, connectivity. */
function assertWorldConsistent(world) {
  const owned = new Map();
  const claim = (c, id) => {
    const k = world.cellKey(c);
    assert.ok(!owned.has(k), `cell ${c} claimed twice`);
    owned.set(k, id);
    for (const v of c) {
      assert.ok(Number.isInteger(v), `non-integer coord in ${c}`);
    }
    assert.ok(world.inBounds(c), `cell ${c} out of bounds`);
  };
  for (const p of world.paths.values()) {
    for (const c of p.cells) claim(c, p.id);
    if (p.pending) {
      claim(p.pending.to, p.id);
      // the one-cell lookahead is owned too — no elbow may be planned into a
      // cell another pipe could take
      if (p.pending.next) claim(p.pending.next.to, p.id);
      assert.ok(p.pending.to.every((v, i) => v === p.pending.from[i] + DIRS[p.pending.dir][i]),
        'pending step not adjacent along dir');
      if (p.pending.next) {
        assert.ok(p.pending.next.to.every(
          (v, i) => v === p.pending.to[i] + DIRS[p.pending.next.dir][i]),
          'lookahead step not adjacent along dir');
      }
    }
    assert.ok(p.cells.length <= world.cfg.maxPathCells,
      `path ${p.id} exceeds maxPathCells`);
    // connectivity + no immediate reversal
    for (let i = 1; i < p.cells.length; i++) {
      const a = p.cells[i - 1];
      const b = p.cells[i];
      const d = p.dirs[i - 1];
      const dir = DIRS[d];
      assert.deepEqual(
        [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dir,
        `path ${p.id} step ${i} not connected along dir`
      );
      if (i >= 1) {
        assert.notEqual(p.dirs[i], OPPOSITE[d], `path ${p.id} reverses at ${i}`);
      }
    }
  }
  // occupancy map is exactly the union of owned cells
  assert.equal(world.occupancy.size, owned.size, 'occupancy size mismatch');
  for (const [k, id] of owned) {
    assert.equal(world.occupancy.get(k), id, `ownership mismatch at key ${k}`);
  }
}

test('deterministic replay: same seed and dt sequence -> same state', () => {
  const a = makeWorld({ seed: 42 });
  const b = makeWorld({ seed: 42 });
  const dts = [0.05, 0.1, 0.016, 0.05, 0.2, 0.033, 0.05, 0.12];
  for (let i = 0; i < 400; i++) {
    const dt = dts[i % dts.length];
    a.step(dt);
    b.step(dt);
  }
  assert.equal(a.serialize(), b.serialize());
  assert.equal(a.counts().occupied, b.counts().occupied);
});

test('different seeds diverge', () => {
  const a = makeWorld({ seed: 1 });
  const b = makeWorld({ seed: 2 });
  for (let i = 0; i < 80; i++) { a.step(0.1); b.step(0.1); }
  assert.notEqual(a.serialize(), b.serialize());
});

test('prewarmed scene is populated and consistent', () => {
  const w = makeWorld({ seed: 7 }, { prewarmSteps: 80 });
  assert.ok(w.counts().occupied > 10, 'expected a populated scene');
  assertWorldConsistent(w);
});

test('lattice legality under stress', () => {
  const w = makeWorld({ seed: 9, pipeCount: 8, bends: 0.8 }, { dimension: 7 });
  for (let i = 0; i < 4000; i++) w.step(0.05);
  assertWorldConsistent(w);
});

test('bounded after >=100k steps at high density', () => {
  const w = makeWorld(
    { seed: 5, pipeCount: 8, density: 0.85, speed: 4 },
    { dimension: 5, maxPaths: 10, prewarmSteps: 0 }
  );
  let resets = 0;
  let maxPaths = 0;
  let maxOccupied = 0;
  for (let i = 0; i < 100000; i++) {
    w.step(0.05);
    if (i % 500 === 0) {
      for (const ev of w.drainEvents()) if (ev.type === 'reset') resets++;
      maxPaths = Math.max(maxPaths, w.paths.size);
      maxOccupied = Math.max(maxOccupied, w.occupancy.size);
    }
    if (w.events.length > 8192) w.drainEvents();
  }
  const c = w.counts();
  assert.equal(resets, 0, 'living mode must never whole-scene reset');
  assert.ok(maxPaths <= 10, `paths unbounded: ${maxPaths}`);
  // density is a SOFT threshold: occupancy may overshoot while a single fade
  // runs — the lattice size is the hard bound
  assert.ok(maxOccupied <= 125, `occupancy over lattice: ${maxOccupied}`);
  assert.ok(c.retired > 0, 'no retirements in 5000 sim-seconds');
  assert.ok(c.occupied > 0, 'scene went empty');
  assert.ok(w.events.length <= 8192, 'event queue unbounded');
  assertWorldConsistent(w);
});

test('living retirement is strictly one-at-a-time and growth continues', () => {
  const w = makeWorld(
    { seed: 21, pipeCount: 8, density: 0.1, speed: 4 },
    { dimension: 9, prewarmSteps: 0 }
  );
  let maxFading = 0;
  let lastCommits = 0;
  let lastSpawned = 0;
  let growingWindows = 0;
  let spawnWindows = 0;
  let zeroHeadStreak = 0;
  let maxZeroHeadStreak = 0;
  const WINDOWS = 20;
  for (let i = 0; i < 20000; i++) {
    w.step(0.05);
    let fading = 0, active = 0;
    for (const p of w.paths.values()) {
      // retireRequested counts as a retirement in flight: at most one pipe
      // is ever anywhere in the retire pipeline
      if (p.state === 'fading' || p.retireRequested) fading++;
      if (p.state === 'active') active++;
    }
    maxFading = Math.max(maxFading, fading);
    // zero-head windows are bounded by roughly one fade duration: a slot
    // frees on release and replenish restarts growth
    if (active === 0) {
      zeroHeadStreak++;
      maxZeroHeadStreak = Math.max(maxZeroHeadStreak, zeroHeadStreak);
    } else {
      zeroHeadStreak = 0;
    }
    if (w.events.length > 8192) w.drainEvents();
    if (i % 1000 === 999) {
      if (w.stats.commits > lastCommits) growingWindows++;
      if (w.stats.spawned > lastSpawned) spawnWindows++;
      lastCommits = w.stats.commits;
      lastSpawned = w.stats.spawned;
    }
  }
  assert.ok(maxFading <= 1, `concurrent retirements: ${maxFading}`);
  // under sustained extreme pressure the loop is bursty (retire -> fade ->
  // release -> respawn): growth must keep happening in essentially every
  // 1000-step window, and dead stretches stay inside ~1.5x a fade duration
  assert.ok(growingWindows >= WINDOWS - 1, `growth stalled: ${growingWindows}/${WINDOWS}`);
  assert.ok(spawnWindows >= WINDOWS - 1, `no heads spawned: ${spawnWindows}/${WINDOWS}`);
  const maxDead = Math.ceil(w.cfg.fadeTime / 0.05) * 1.5;
  assert.ok(maxZeroHeadStreak <= maxDead,
    `zero-head streak ${maxZeroHeadStreak} steps exceeds ~1.5x fadeTime (${maxDead})`);
  assert.ok(w.stats.retired > 0, 'nothing retired under heavy density pressure');
  assert.ok(w.occupancy.size <= w.totalCells, 'occupancy exceeded lattice');
  assertWorldConsistent(w);
});

/** Settled fixture: finished-only world at maxPaths, below density budget. */
function stallFixture(over = {}) {
  const w = makeWorld(
    { seed: 13, pipeCount: 8, density: 0.9, speed: 4, ...over },
    { dimension: 3, maxPaths: 8, maxAge: 600, prewarmSteps: 0 }
  );
  for (const p of w.paths.values()) w._finish(p); // pending reservations released
  // 8 finished stubs, 8 occupied cells < budget floor(0.9*27)=24, zero heads
  assert.equal(w.counts().active, 0);
  assert.equal(w.paths.size, 8);
  assert.equal(w.occupancy.size, 8);
  assert.ok(w.occupancy.size < w.densityBudget);
  return w;
}

test('living recycles a finished-only world at maxPaths below budget', () => {
  const w = stallFixture();
  const beforeCommits = w.stats.commits;
  const beforeSpawned = w.stats.spawned;
  w.step(0.01);
  assert.equal(w.counts().fading, 1, 'exactly one pipe should begin fading');
  let resets = 0;
  for (let i = 0; i < 300; i++) { // ~15 sim-seconds >> fadeTime
    w.step(0.05);
    for (const ev of w.drainEvents()) {
      assert.notEqual(ev.type, 'reset', 'living mode issued a whole-scene reset');
      if (ev.type === 'reset') resets++;
    }
  }
  assert.equal(resets, 0);
  assert.ok(w.stats.spawned > beforeSpawned, 'no new heads spawned after release');
  assert.ok(w.stats.commits > beforeCommits, 'no growth after recycling');
  assertWorldConsistent(w);
});

test('classic resets when truly stalled (no heads, no room to spawn)', () => {
  const w = stallFixture({ mode: 'classic', seed: 2147483647 });
  w.step(0.01);
  assert.equal(w.resetting, true, 'stall should trigger reset despite budget not hit');
  assert.equal(w.counts().fading, 8, 'all finished pipes should be fading');
  for (let i = 0; i < 200 && w.resetting; i++) w.step(0.05);
  assert.equal(w.stats.cycles, 1, 'classic never completed a reset');
  assert.equal(w.seed, 0, 'auto-reseed should wrap past 2147483647');
  assert.ok(w.counts().active > 0, 'no active heads after reset');
  assertWorldConsistent(w);
});

test('classic below budget replenishes finished heads (no reset needed)', () => {
  const w = makeWorld(
    { seed: 3, mode: 'classic', pipeCount: 2, density: 0.9 },
    { dimension: 15, maxPaths: 16, prewarmSteps: 0 }
  );
  for (const p of w.paths.values()) w._finish(p);
  assert.equal(w.counts().active, 0);
  assert.equal(w.paths.size, 2);
  assert.equal(w.occupancy.size, 2);
  assert.ok(w.occupancy.size < w.densityBudget);
  assert.ok(w.paths.size < 16);
  const beforeCommits = w.stats.commits;
  w.step(0.01);
  assert.equal(w.counts().active, 2, 'finished heads were not replenished');
  assert.equal(w.paths.size, 4);
  assert.equal(w.resetting, false, 'must not reset while below budget');
  for (let i = 0; i < 200; i++) w.step(0.05);
  assert.ok(w.stats.commits > beforeCommits, 'no growth after replenishment');
  assertWorldConsistent(w);
});

test('seed 0 is distinct from seed 1 (no ||1 aliasing)', () => {
  const a = makeWorld({ seed: 0 });
  const b = makeWorld({ seed: 1 });
  for (let i = 0; i < 60; i++) { a.step(0.1); b.step(0.1); }
  assert.notEqual(a.serialize(), b.serialize());
  assert.equal(a.seed, 0);
});

test('reseedNext wraps at the supported seed range', () => {
  const w = makeWorld({ seed: 2147483647 });
  w.reseedNext();
  assert.equal(w.seed, 0);
  w.reseedNext();
  assert.equal(w.seed, 1);
});

test('updateSettings shrink finishes newest active heads immediately', () => {
  const w = makeWorld({ seed: 6, pipeCount: 6 }, { dimension: 9, prewarmSteps: 0 });
  for (let i = 0; i < 50; i++) w.step(0.1);
  const actives0 = w.counts().active;
  assert.ok(actives0 >= 5);
  w.updateSettings({ ...w.settings, pipeCount: 2 });
  const actives1 = w.counts().active;
  assert.ok(actives1 <= 2, `excess heads not finished: ${actives1}`);
  // finished heads remain as sculpture (still retained, still consistent)
  assert.ok(w.counts().paths > 2);
  assertWorldConsistent(w);
});

test('living mode recycles while growth continues (no empty scene)', () => {
  const w = makeWorld(
    { seed: 11, pipeCount: 4, density: 0.5, speed: 2 },
    { dimension: 7, maxAge: 20 }
  );
  let sawRetire = false;
  let minOccupied = Infinity;
  for (let i = 0; i < 30000; i++) {
    w.step(0.05);
    if (i % 200 === 0) {
      for (const ev of w.drainEvents()) {
        if (ev.type === 'fade') sawRetire = true;
        assert.notEqual(ev.type, 'reset', 'living issued a reset');
      }
      minOccupied = Math.min(minOccupied, w.occupancy.size);
    }
    if (w.events.length > 8192) w.drainEvents();
  }
  assert.ok(sawRetire, 'no pipe was ever retired');
  assert.ok(minOccupied > 0, 'scene hit empty in living mode');
  // recovery: heads may briefly sit at zero during a fade-release window,
  // but stepping must restore growth within fadeTime
  for (let i = 0; i < 200 && w.counts().active === 0; i++) w.step(0.05);
  assert.ok(w.counts().active > 0, 'growth stalled: no active heads');
  assertWorldConsistent(w);
});

test('classic mode fades everything and reseeds', () => {
  const w = makeWorld(
    { seed: 3, mode: 'classic', density: 0.3, pipeCount: 4 },
    { dimension: 5, prewarmSteps: 0 }
  );
  let sawReset = false;
  let newSeed = null;
  for (let i = 0; i < 60000 && !sawReset; i++) {
    w.step(0.05);
    for (const ev of w.drainEvents()) {
      if (ev.type === 'reset') { sawReset = true; newSeed = ev.seed; }
    }
  }
  assert.ok(sawReset, 'classic never reset within the window');
  assert.equal(newSeed, w.seed);
  assert.ok(w.stats.cycles >= 1);
  assert.ok(w.counts().occupied > 0, 'classic reset left an empty scene');
  assertWorldConsistent(w);
});

test('age limit forces retirement candidates (no permanent stall)', () => {
  const w = makeWorld(
    { seed: 4, pipeCount: 3, density: 0.9 },
    { dimension: 9, maxAge: 5, prewarmSteps: 0 }
  );
  for (let i = 0; i < 2000; i++) w.step(0.05); // 100 sim-seconds >> maxAge
  assert.ok(w.stats.retired > 0, 'aged pipes were never retired');
  assert.ok(w.counts().active > 0);
  assertWorldConsistent(w);
});

test('pause semantics: 0/negative/NaN dt do nothing; huge dt is capped', () => {
  const w = makeWorld({ seed: 8 });
  const s0 = w.serialize();
  const t0 = w.time;
  w.step(0); w.step(-1); w.step(NaN);
  assert.equal(w.time, t0);
  assert.equal(w.serialize(), s0);
  w.step(1000);
  assert.ok(w.time - t0 <= 0.25 + 1e-9, `dt not capped: ${w.time - t0}`);
});

test('reseed reproduces an identical run', () => {
  const a = makeWorld({ seed: 77 }, { prewarmSteps: 30 });
  const b = makeWorld({ seed: 1 }, { prewarmSteps: 30 });
  b.reseed(77);
  assert.equal(a.serialize(), b.serialize());
  for (let i = 0; i < 50; i++) { a.step(0.07); b.step(0.07); }
  assert.equal(a.serialize(), b.serialize());
});

test('lookahead reservation transfers across commit (next.to becomes pending.to)', () => {
  const w = makeWorld({ seed: 17, pipeCount: 3 }, { dimension: 9, prewarmSteps: 0 });
  // grow until some path has a reserved lookahead
  let path = null;
  for (let i = 0; i < 400 && !path; i++) {
    w.step(0.05);
    path = [...w.paths.values()].find((p) => p.state === 'active' && p.pending && p.pending.next);
  }
  assert.ok(path, 'no path ever carried a lookahead reservation');
  const before = path.pending;
  const expect = { to: before.next.to.slice(), dir: before.next.dir };
  // step until that pending commits — commit swaps in a new pending object
  for (let i = 0; i < 400 && path.pending === before; i++) w.step(0.05);
  assert.ok(path.pending && path.pending !== before, 'path finished unexpectedly');
  assert.deepEqual(path.pending.to, expect.to, 'committed pending != reserved next.to');
  assert.equal(path.pending.dir, expect.dir);
  assert.deepEqual(path.pending.from, path.cells[path.cells.length - 1],
    'new pending must leave the just-committed tip cell');
  assertWorldConsistent(w);
});

test('path length is hard-capped at maxPathCells', () => {
  const w = makeWorld(
    { seed: 31, pipeCount: 2, bends: 0.3, density: 0.95, speed: 4 },
    { dimension: 9, maxPathCells: 10, maxAge: 99999, prewarmSteps: 0 }
  );
  let sawCap = false;
  for (let i = 0; i < 20000; i++) {
    w.step(0.05);
    for (const p of w.paths.values()) {
      assert.ok(p.cells.length <= 10, `path ${p.id} grew past cap`);
      // near the cap the lookahead must not be reserved beyond it
      if (p.pending && p.pending.next) {
        assert.ok(p.cells.length + 2 <= 10, 'lookahead reserved beyond cap');
      }
      if (p.cells.length === 10) sawCap = true;
    }
    if (w.events.length > 4096) w.drainEvents();
  }
  assert.ok(sawCap, 'never reached the cap in 1000 sim-seconds');
  assertWorldConsistent(w);
});

test('living prefers the oldest FINISHED path over actives when retiring', () => {
  const w = stallFixture(); // 8 finished stubs at maxPaths, below budget
  // id 1 is the oldest (all bornAt tie at time 0 -> id tiebreak)
  w.step(0.01);
  const fading = [...w.paths.values()].filter((p) => p.state === 'fading');
  assert.equal(fading.length, 1);
  assert.equal(fading[0].id, 1, 'expected oldest finished path (id 1) to fade');
  assertWorldConsistent(w);
});

test('graceful retirement of an ACTIVE path completes its segment then fades', () => {
  const w = makeWorld(
    { seed: 23, pipeCount: 2, density: 0.95, speed: 2 },
    { dimension: 9, maxAge: 0.001, prewarmSteps: 0 }
  );
  // after the first step every active path is aged -> one gets retireRequested
  w.step(0.01);
  const req = [...w.paths.values()].filter((p) => p.retireRequested);
  assert.equal(req.length, 1, 'expected exactly one retireRequested path');
  const path = req[0];
  assert.equal(path.state, 'active');
  assert.ok(path.pending, 'retiring head keeps its in-flight segment');
  const cellsBefore = path.cells.length;
  // run until the segment lands and the fade starts
  for (let i = 0; i < 400 && path.state === 'active'; i++) w.step(0.02);
  assert.equal(path.state, 'fading', 'retiring path never began fading');
  assert.ok(!path.pending, 'fading path still held a pending step');
  assert.ok(path.cells.length === cellsBefore + 1,
    'graceful retirement should commit the final segment');
  assertWorldConsistent(w);
});

test('replacement heads grow while a fade is still draining', () => {
  const w = makeWorld(
    { seed: 29, pipeCount: 4, density: 0.4, speed: 1 },
    { dimension: 7, maxAge: 0.001, fadeTime: 4.5, prewarmSteps: 0 }
  );
  // First find a fade in flight, snapshot who exists at that moment, then
  // demand a genuinely NEW path be born and commit while it drains.
  let fadeId = -1;
  let knownIds = null;
  let commitsAtFade = 0;
  let spawnedDuringFade = false;
  let grewDuringFade = false;
  for (let i = 0; i < 6000 && !(spawnedDuringFade && grewDuringFade); i++) {
    w.step(0.05);
    let fading = null;
    for (const p of w.paths.values()) {
      if (p.state === 'fading' || p.retireRequested) fading = p;
    }
    if (fading) {
      if (knownIds === null) {
        fadeId = fading.id;
        knownIds = new Set(w.paths.keys());
        commitsAtFade = w.stats.commits;
      }
      if (fading.id === fadeId) {
        for (const p of w.paths.values()) {
          if (!knownIds.has(p.id) && p.state === 'active') {
            spawnedDuringFade = true;
          }
        }
        if (w.stats.commits > commitsAtFade) grewDuringFade = true;
      }
    }
    if (w.events.length > 4096) w.drainEvents();
  }
  assert.ok(knownIds !== null, 'no fade ever started');
  assert.ok(spawnedDuringFade,
    'no NEW head spawned while the fade was draining');
  assert.ok(grewDuringFade,
    'growth (commits) did not continue during the fade');
  assertWorldConsistent(w);
});

// -------------------------------------------------------- colour history

/** Force every active head to commit its pending step on the next step(). */
function commitAll(w) {
  for (const p of w.paths.values()) {
    if (p.state === 'active' && p.pending) p.pending.progress = 1;
  }
  w.step(0.001);
}

/** Geometry-only fingerprint: cells, dirs, pending — no colour fields. */
function geoFingerprint(w) {
  return [...w.paths.values()].map((p) =>
    `${p.id}:${p.state}:${p.cells.map((x) => x.join(',')).join(';')}|` +
    `${p.dirs.join(',')}|` +
    (p.pending
      ? `${p.pending.to.join(',')}/${p.pending.dir}` +
        (p.pending.next
          ? `>${p.pending.next.to.join(',')}/${p.pending.next.dir}` : '')
      : '-'))
    .sort().join('\n');
}

test('colour request queues a different tint per active head — nothing else moves', () => {
  const w = makeWorld({ seed: 42, autoCycle: true, pipeCount: 4 });
  for (let i = 0; i < 3; i++) commitAll(w);
  const rngState = w.rng.state;
  const seen = new Map();
  for (const p of w.paths.values()) {
    assert.equal(p.tints.length, p.dirs.length,
      'tints must track committed dirs');
    assert.equal(p.tints[0] ?? p.tint, p.tint,
      'first segment keeps the spawn tint');
    if (p.state === 'active' && p.pending && !p.retireRequested) {
      seen.set(p.id, { growth: p.growthTint, tip: p.pending.tint });
    }
  }
  assert.ok(seen.size > 0, 'fixture must have growing heads');
  const changed = w.requestColorChange();
  assert.equal(changed, seen.size, 'every growing head queued a colour');
  for (const [id, s0] of seen) {
    const p = w.paths.get(id);
    assert.notEqual(p.growthTint, s0.growth,
      `${id}: queued tint must differ`);
    assert.equal(p.pending.tint, s0.tip,
      `${id}: in-flight segment tint is frozen at plan time`);
    assert.equal(p.pending.next.tint ?? -1, -1,
      `${id}: lookahead reservation never captures a tint`);
  }
  assert.equal(w.rng.state, rngState,
    'colour picks must not consume physics rng');
});

test('queued colour lands at the next boundary; committed bands are frozen', () => {
  const w = makeWorld({ seed: 42, autoCycle: true, pipeCount: 3 });
  commitAll(w); commitAll(w);
  w.requestColorChange();
  const queued = new Map();
  for (const p of w.paths.values()) {
    if (p.state === 'active' && p.pending && !p.retireRequested) {
      queued.set(p.id,
        { oldTip: p.pending.tint, growth: p.growthTint, len: p.tints.length });
    }
  }
  commitAll(w);
  for (const [id, q] of queued) {
    const p = w.paths.get(id);
    if (!p || p.tints.length <= q.len) continue; // path may have finished
    assert.equal(p.tints[q.len], q.oldTip,
      `${id}: the in-flight segment committed its OLD tint`);
    if (p.pending) {
      assert.equal(p.pending.tint, q.growth,
        `${id}: new pending picked up the queued tint`);
    }
  }
  commitAll(w);
  for (const [id, q] of queued) {
    const p = w.paths.get(id);
    if (!p || p.tints.length <= q.len + 1) continue;
    assert.equal(p.tints[q.len + 1], q.growth,
      `${id}: next segment committed the new band`);
    assert.deepEqual(p.tints.slice(0, q.len).every((t, i) => true), true,
      `${id}: earlier history untouched`);
    assert.equal(p.tints.length, p.dirs.length);
  }
});

test('colour request guards: autoCycle off or classic mode -> no-op', () => {
  const off = makeWorld({ seed: 1, autoCycle: false });
  assert.equal(off.requestColorChange(), 0);
  assert.equal(off.serialize(), off.serialize());
  const cl = makeWorld({ seed: 1, autoCycle: true, mode: 'classic' });
  assert.equal(cl.requestColorChange(), 0);
  // finished paths are skipped even in living mode
  const w = makeWorld({ seed: 9, autoCycle: true, pipeCount: 4 });
  commitAll(w);
  const first = [...w.paths.values()].find((p) => p.state === 'active');
  w.updateSettings({ ...w.settings, pipeCount: 2 }); // finishes newest heads
  const finished = [...w.paths.values()].filter((p) => p.state === 'finished');
  assert.ok(finished.length > 0, 'fixture must contain a finished path');
  const growth0 = finished.map((p) => p.growthTint);
  const n = w.requestColorChange();
  finished.forEach((p, i) => assert.equal(p.growthTint, growth0[i],
    'finished path must never queue a colour'));
  assert.ok(n <= [...w.paths.values()].filter(
    (p) => p.state === 'active' && p.pending && !p.retireRequested).length);
  assert.ok(first);
});

test('classic auto colours never band mid-fill; phase refreshes on reset', () => {
  const w = makeWorld(
    { seed: 3, autoCycle: true, mode: 'classic', density: 0.95, speed: 2 },
    { dimension: 7 });
  // ~40s of growth at 2x — several would-be intervals pass, zero bands
  for (let i = 0; i < 200 && w.stats.cycles === 0; i++) w.step(0.25);
  for (const p of w.paths.values()) {
    assert.ok(p.tints.every((t) => t === p.tint),
      'classic path must stay one colour through the fill');
    if (p.pending) assert.equal(p.pending.tint, p.growthTint);
  }
  // keep stepping until the scene resets; the fresh cycle must repopulate
  for (let i = 0; i < 400 && w.stats.cycles === 0; i++) w.step(0.25);
  assert.ok(w.stats.cycles >= 1, 'classic scene reset did not happen');
  assert.ok(w.paths.size > 0, 'fresh cycle must spawn heads');
});

test('colour pulses are geometry-neutral and deterministic', () => {
  const a = makeWorld({ seed: 7, autoCycle: false, pipeCount: 4 });
  const b = makeWorld({ seed: 7, autoCycle: true, pipeCount: 4 });
  const c = makeWorld({ seed: 7, autoCycle: true, pipeCount: 4 });
  for (let i = 0; i < 1000; i++) {
    if (i % 50 === 25) { b.requestColorChange(); c.requestColorChange(); }
    a.step(0.05); b.step(0.05); c.step(0.05);
  }
  assert.equal(geoFingerprint(a), geoFingerprint(b),
    'colour pulses must not change geometry');
  assert.equal(a.rng.state, b.rng.state,
    'colour pulses must not consume physics rng');
  assert.equal(geoFingerprint(b), geoFingerprint(c),
    'same pulse schedule must give same geometry');
  assert.equal(b.serialize(), c.serialize(),
    'same pulse schedule must give same colour history');
  assert.ok([...b.paths.values()].some((p) => new Set(p.tints).size > 1),
    'expected at least one multi-colour path in the banded run');
});
