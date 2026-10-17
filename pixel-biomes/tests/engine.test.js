import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BiomeWorld, AquariumWorld, DEFAULT_SPECIES } from '../js/engine.js';
import { SPECIES } from '../js/art.js';
import { desertGroundY } from '../js/desert-art.js';
import { DEFAULTS, HABITAT_ORDER } from '../js/settings.js';

const mk = (over = {}, w = 480, h = 300, species = DEFAULT_SPECIES) =>
  new BiomeWorld({ ...DEFAULTS, ...over }, w, h, species);

// Aquatic fixtures pin the water biome + original population so the legacy
// checks keep testing water even though fresh defaults land on desert.
const mkWater = (over = {}, w = 480, h = 300) =>
  mk({ habitat: 'reef', population: 24, ...over }, w, h);
// Land fixture: desert, explicit population.
const mkLand = (over = {}, w = 480, h = 300) =>
  mk({ habitat: 'desert', population: 12, ...over }, w, h);

function stepN(w, n, dt = 1 / 30) {
  for (let i = 0; i < n; i++) w.step(dt);
}

function finiteRec(r) {
  return Number.isFinite(r.x) && Number.isFinite(r.y)
    && Number.isFinite(r.depth) && Number.isFinite(r.alpha)
    && Number.isInteger(r.frame) && (r.dir === 1 || r.dir === -1);
}

test('seed is deterministic; different seeds differ', () => {
  const a = mk({ seed: 0 });
  const b = mk({ seed: 0 });
  const c = mk({ seed: 1 });
  stepN(a, 60); stepN(b, 60); stepN(c, 60);
  const sa = JSON.stringify(a.sample());
  assert.equal(sa, JSON.stringify(b.sample()), 'same seed must match');
  assert.notEqual(sa, JSON.stringify(c.sample()), 'seed 1 must differ');
  assert.equal(a.seed, 0);
});

test('equal elapsed partition produces the same sample', () => {
  const a = mk({ seed: 99 });
  const b = mk({ seed: 99 });
  a.step(2.4);
  for (let i = 0; i < 24; i++) b.step(0.1);
  const sa = a.sample();
  const sb = b.sample();
  assert.equal(sa.length, sb.length);
  for (let i = 0; i < sa.length; i++) {
    for (const k of ['x', 'y', 'depth', 'alpha', 'frame', 'dir']) {
      assert.ok(Math.abs(sa[i][k] - sb[i][k]) < 1e-9, `rec ${i} ${k} drifted`);
    }
  }
});

test('positions stay finite and bounded over a long run, all habitats', () => {
  for (const habitat of HABITAT_ORDER) {
    const w = mk({ habitat, population: 48, visitors: true });
    for (let i = 0; i < 40; i++) {
      stepN(w, 60, 0.1);
      for (const r of w.sample()) {
        assert.ok(finiteRec(r), `${habitat} bad record ${JSON.stringify(r)}`);
        assert.ok(r.x > -260 && r.x < w.width + 260, `${habitat} x=${r.x}`);
        assert.ok(r.y > -140 && r.y < w.height + 140, `${habitat} y=${r.y}`);
        assert.ok(r.alpha >= 0 && r.alpha <= 1, 'alpha range');
        assert.ok(r.scale === 1 || r.scale === 2, `scale ${r.scale}`);
      }
    }
  }
});

test('portrait sizing stays finite and in bounds', () => {
  const w = mk({ population: 48, visitors: true }, 130, 280);
  stepN(w, 600, 0.1);
  for (const r of w.sample()) {
    assert.ok(finiteRec(r));
    assert.ok(r.x > -260 && r.x < w.width + 260, `x=${r.x}`);
    assert.ok(r.y > -140 && r.y < w.height + 140, `y=${r.y}`);
  }
});

test('population setting is honoured and capped at 48', () => {
  const w = mk({ population: 8, visitors: false });
  assert.equal(w.count, 8);
  w.updateSettings({ ...w.settings, population: 48 });
  assert.equal(w.count, 48);
  // visitors never count against the population
  const v = mk({ population: 20, visitors: true });
  assert.equal(v.count, 20);
});

test('visitors:false emits no visitor records; true yields at most one', () => {
  const off = mkWater({ visitors: false });
  stepN(off, 5000, 0.05); // >250s — several visitor cycles
  assert.ok(off.sample().every((r) => r.kind !== 'visitor'));
  const on = mkWater({ visitors: true });
  let seen = 0;
  for (let i = 0; i < 60; i++) {
    stepN(on, 30, 0.1);
    const v = on.sample().filter((r) => r.kind === 'visitor');
    assert.ok(v.length <= 1, 'at most one visitor at a time');
    if (v.length) seen++;
  }
  assert.ok(seen > 0, 'a visitor should cross within ~3 minutes');
});

test('DEFAULT_SPECIES is the authoritative art.js table', () => {
  assert.equal(DEFAULT_SPECIES, SPECIES, 'engine default must be the real SPECIES, not a mirror');
  const w = mk({}); // constructed without an injected table
  assert.equal(w.species, SPECIES);
});

const WATER = ['reef', 'kelp', 'lagoon', 'abyss'];

test('communities constrain the species mix', () => {
  // reef community excludes drifters in EVERY water habitat
  for (const habitat of WATER) {
    const reef = mk({ community: 'reef', habitat, population: 40 });
    const ids = reef.sample().map((r) => r.species);
    assert.ok(ids.length > 0, `${habitat} reef community must not be empty`);
    assert.ok(ids.every((s) => s !== 'jelly' && s !== 'lantern'),
      `${habitat} reef community must exclude drifters, got ${[...new Set(ids)]}`);
  }
  // jellies community is an actual jellyfish bloom in EVERY water habitat
  for (const habitat of WATER) {
    const w = mk({ community: 'jellies', habitat, population: 24 });
    const ids = w.sample().map((r) => r.species);
    const nJelly = ids.filter((s) => s === 'jelly').length;
    assert.ok(nJelly >= Math.ceil(24 * 0.65),
      `${habitat} jellies community should be >=65% actual jellyfish, got ${nJelly}/24`);
  }
  const mixed = mk({ community: 'mixed', habitat: 'abyss' });
  assert.ok(mixed.count > 0);
});

test('land ignores the aquatic community entirely', () => {
  for (const community of ['mixed', 'reef', 'jellies']) {
    const w = mk({ habitat: 'desert', community, population: 24 });
    const ids = w.sample().map((r) => r.species);
    assert.ok(ids.length > 0, 'desert must not be empty');
    assert.ok(ids.every((s) => SPECIES[s].habitats.includes('desert')),
      `${community} leaked an aquatic species: ${[...new Set(ids)]}`);
    // the saved community is preserved, not rewritten
    assert.equal(w.settings.community, community);
  }
});

test('desert cast: all six residents at pop>=6, caps respected, count exact', () => {
  const RESIDENTS = ['lizard', 'jerboa', 'tortoise', 'scorpion', 'scarab', 'wheatear'];
  for (const pop of [8, 12, 24, 48]) {
    const w = mkLand({ population: pop, visitors: false });
    assert.equal(w.count, pop, `population ${pop}`);
    const ids = w.sample().map((r) => r.species);
    if (pop >= 6) {
      for (const id of RESIDENTS) {
        assert.ok(ids.includes(id), `desert must field a ${id} at pop ${pop}`);
      }
    }
    const tally = {};
    for (const id of ids) tally[id] = (tally[id] || 0) + 1;
    assert.ok((tally.scorpion || 0) <= 2, 'scorpions capped at 2');
    assert.ok((tally.tortoise || 0) <= 2, 'tortoises capped at 2');
    // single-member groups only — no fish-style schools on land
    assert.ok(w.schools.every((s) => s.members.length === 1),
      'terrestrial creatures are single-member groups');
  }
});

test('ground creatures anchor feet on the dune line; jerboa hops', () => {
  const w = mkLand({ population: 48, seed: 7 });
  stepN(w, 400, 0.1);
  for (const r of w.sample()) {
    if (r.role === 'visitor') continue;
    assert.ok(r.anchor === 'feet' || r.anchor === 'center', `${r.species} anchor`);
    if (r.role === 'ground') {
      assert.equal(r.anchor, 'feet', `${r.species} must be feet-anchored`);
      const gy = desertGroundY(w.width, w.height, r.x, r.depth);
      if (r.species === 'jerboa') {
        assert.ok(r.y <= gy + 0.001 && r.y >= gy - 7,
          `jerboa y=${r.y} vs ground ${gy}: on ground or in a <=6px hop`);
      } else {
        assert.equal(r.y, gy, `${r.species} feet must sit on desertGroundY`);
      }
    }
    if (r.role === 'flyer') {
      assert.equal(r.anchor, 'center');
      assert.ok(r.y < w.height * 0.45, `flyer ${r.species} flies high (y=${r.y})`);
    }
  }
});

test('jerboa hop eases out at activity edges — no snap at rest or wrap', () => {
  const w = mkLand({ population: 8, seed: 7 });
  const si = w.schools.findIndex((s) => s.species === 'jerboa');
  assert.ok(si >= 0, 'expected a jerboa');
  const school = w.schools[si];
  // pin the cadence and peak the sine exactly at the stop boundary —
  // without the envelope this would snap 6px down into the rest pose
  school.period = 10;
  const active = school.period * 0.65;
  school.members[0].phase = Math.PI / 2 - active * 4;
  const at = (t) => { w.simTime = t; return w.sample()[si]; };
  for (const t of [active - 1e-6, active + 1e-6, school.period - 1e-6, school.period + 1e-6]) {
    const r = at(t);
    assert.ok(Number.isFinite(r.groundY), 'ground records must emit groundY');
    assert.ok(Math.abs(r.groundY - r.y) < 0.001,
      `hop must be ~0 at t=${t.toFixed(6)}, got lift ${r.groundY - r.y}`);
  }
  const xBefore = at(active - 1e-6).x;
  const xAfter = at(active + 1e-6).x;
  assert.ok(Math.abs(xAfter - xBefore) < 0.01, 'x continuous across the stop');
  // mid-arc with the envelope fully open still reaches the 6px hop
  school.members[0].phase = Math.PI / 2 - 12; // sin(t*4+phase)=1 at t=3
  const mid = at(3);
  const lift = mid.groundY - mid.y;
  assert.ok(lift > 5.9 && lift <= 6, `mid-hop lift ${lift}`);
});

test('desert walkers pause-and-advance; resting pose is frame 0', () => {
  const w = mkLand({ population: 48, seed: 11 });
  const si = w.schools.findIndex((s) => s.motion === 'crawl');
  assert.ok(si >= 0, 'expected a crawler');
  const school = w.schools[si];
  // run long enough to catch both active and resting slices
  const frames = new Set();
  let sawRest = 0;
  const xs = {};
  for (let i = 0; i < 400; i++) {
    w.step(0.1);
    const sample = w.sample();
    const u = w.simTime % school.period;
    if (u >= school.period * 0.65) {
      assert.equal(sample[si].frame, 0, 'resting slice must show frame 0');
      sawRest++;
    }
    for (const r of sample) {
      if (r.role !== 'ground') continue;
      frames.add(`${r.species}:${r.frame}`);
      const prev = xs[r.species];
      xs[r.species] = prev ? [...prev, r.x] : [r.x];
    }
  }
  assert.ok(frames.size > 6, 'walk cycles must animate poses');
  assert.ok(sawRest > 20, `resting slices observed: ${sawRest}`);
  // positions advance overall but never teleport
  for (const [id, trail] of Object.entries(xs)) {
    const spread = Math.max(...trail) - Math.min(...trail);
    assert.ok(spread > 3, `${id} should have walked`);
  }
});

test('desert visitors are fennec/camel, one at a time, feet on ground', () => {
  const off = mkLand({ visitors: false });
  stepN(off, 3000, 0.05);
  assert.ok(off.sample().every((r) => r.kind !== 'visitor'));
  const w = mkLand({ visitors: true });
  let seen = new Set();
  for (let i = 0; i < 80; i++) {
    stepN(w, 40, 0.1);
    const v = w.sample().filter((r) => r.kind === 'visitor');
    assert.ok(v.length <= 1, 'one desert visitor at a time');
    for (const r of v) {
      seen.add(r.species);
      assert.ok(['fennec', 'camel'].includes(r.species), r.species);
      assert.equal(r.anchor, 'feet');
      assert.equal(r.y, desertGroundY(w.width, w.height, r.x, r.depth));
      assert.equal(r.scale, r.species === 'camel' ? 2 : 1);
    }
  }
  assert.ok(seen.size > 0, 'a desert visitor should appear');
});

test('desertLight is a look change — no regen, no clock reset', () => {
  const w = mkLand({ seed: 5 });
  stepN(w, 80, 0.1);
  const t = w.simTime;
  const ids = w.sample().map((r) => r.species).join(',');
  for (const light of ['day', 'night', 'golden']) {
    w.updateSettings({ ...w.settings, desertLight: light });
  }
  assert.equal(w.simTime, t, 'light change must keep the clock');
  assert.equal(w.sample().map((r) => r.species).join(','), ids,
    'light change must not repopulate');
});

test('land portrait + long run stay finite; taps never levitate animals', () => {
  const w = mkLand({ population: 48 }, 130, 280);
  w.burst(60, 60);
  stepN(w, 800, 0.1);
  for (const r of w.sample()) {
    assert.ok(finiteRec(r), JSON.stringify(r));
    assert.ok(r.x > -260 && r.x < 130 + 260, `x=${r.x}`);
    assert.ok(r.y > -40 && r.y < 280 + 40, `y=${r.y} should hug the terrain`);
    if (r.role === 'ground') {
      assert.equal(r.y <= desertGroundY(130, 280, r.x, r.depth), true,
        'tap bursts must not pull land animals off the ground');
    }
  }
});

test('schoolmates start separated — no ghost stacking at t=0', () => {
  const w = mk({ community: 'reef', habitat: 'reef', population: 40, visitors: false });
  const si = w.schools.findIndex((s) => s.role === 'fish' && s.members.length >= 2);
  assert.ok(si >= 0, 'expected a multi-member fish school');
  const school = w.schools[si];
  // record order follows school order: members of a school are consecutive
  const off = w.schools.slice(0, si).reduce((n, s) => n + s.members.length, 0);
  const before = w.sample();
  const xs = before.slice(off, off + school.members.length).map((r) => r.x);
  assert.equal(xs.length, school.members.length);
  assert.ok(new Set(xs.map((x) => Math.round(x))).size >= 2,
    'schoolmates should not coincide at t=0');
  // mutating a member's ox moves that member at a fixed simTime
  const x0 = before[off].x;
  school.members[0].ox += 10;
  const moved = w.sample();
  assert.notEqual(moved[off].x, x0, 'ox must feed the record x');
  assert.ok(Math.abs(moved[off].x - x0) >= 9,
    'ox shift should move the member by ~10*scale (possibly wrapped)');
});

test('same-seed reseed resets the clock and regenerates', () => {
  const w = mk({ seed: 5 });
  stepN(w, 100, 0.05);
  assert.ok(w.simTime > 0);
  w.burst(10, 10);
  w.reseed(5); // identical seed still counts as a reseed
  assert.equal(w.simTime, 0);
  assert.equal(w.bursts.length, 0);
  stepN(w, 60, 0.05);
  const a = JSON.stringify(w.sample());
  const ref = mk({ seed: 5 });
  stepN(ref, 60, 0.05);
  assert.equal(a, JSON.stringify(ref.sample()), 'reseeded world must reproduce seed layout');
});

test('jellies drift vertically and wrap inside generous bounds', () => {
  const w = mk({ community: 'jellies', habitat: 'lagoon', population: 24 });
  stepN(w, 3000, 0.1);
  const jellies = w.sample().filter((r) => r.role === 'jelly');
  assert.ok(jellies.length > 0, 'expected jellyfish in a jelly community');
  for (const r of jellies) {
    assert.ok(r.y > -140 && r.y < w.height + 140, `jelly y=${r.y}`);
    assert.equal(r.dir, 1, 'jellies face right');
  }
});

test('bottom species hug the floor band', () => {
  const w = mk({ community: 'reef', habitat: 'reef', population: 48, seed: 3 });
  stepN(w, 300, 0.1);
  const bottoms = w.sample().filter((r) => r.role === 'bottom');
  assert.ok(bottoms.length > 0, 'expected bottom dwellers in a reef community');
  for (const r of bottoms) {
    assert.ok(r.y > w.height * 0.7, `bottom y=${r.y} should be near floor`);
  }
});

test('invalid dt is ignored; negative and NaN do not corrupt', () => {
  const w = mk();
  w.step(-1); w.step(NaN); w.step(Infinity); w.step(0);
  assert.equal(w.simTime, 0);
  stepN(w, 10, 0.05);
  assert.ok(w.simTime > 0);
});

test('look/atmosphere changes never reset time or repopulate', () => {
  const w = mk({ seed: 5 });
  stepN(w, 60);
  const ids = w.sample().map((r) => `${r.species}`).join(',');
  const t = w.simTime;
  for (const k of ['sunRays', 'bubbles', 'plankton', 'scanlines', 'pixelSize', 'vegetation', 'speed', 'autoCycle', 'desertLight']) {
    const over = {
      sunRays: false, bubbles: false, plankton: false, scanlines: true,
      pixelSize: 4, vegetation: false, speed: 2, autoCycle: true,
      desertLight: 'night',
    }[k];
    w.updateSettings({ ...w.settings, [k]: over });
  }
  assert.equal(w.simTime, t, 'sim time must survive look changes');
  assert.equal(w.sample().map((r) => r.species).join(','), ids,
    'look changes must not repopulate');
});

test('habitat switch repopulates but preserves the clock', () => {
  const w = mk({ habitat: 'reef' });
  stepN(w, 100, 0.05);
  const t = w.simTime;
  w.updateSettings({ ...w.settings, habitat: 'abyss' });
  assert.equal(w.habitat, 'abyss');
  assert.equal(w.simTime, t, 'habitat swap keeps the world clock');
  assert.ok(w.count > 0);
});

test('seed change counts as a reseed and resets the clock', () => {
  const w = mk({ seed: 5 });
  stepN(w, 100, 0.05);
  assert.ok(w.simTime > 0);
  w.updateSettings({ ...w.settings, seed: 777 });
  assert.equal(w.seed, 777);
  assert.equal(w.simTime, 0, 'reseed must restart the world clock');
  w.reseed(42);
  assert.equal(w.seed, 42);
  assert.equal(w.simTime, 0);
});

test('resize re-lays out without touching the clock', () => {
  const w = mk({}, 480, 300);
  stepN(w, 100, 0.05);
  const t = w.simTime;
  w.setSize(130, 280);
  assert.equal(w.simTime, t);
  assert.equal(w.width, 130);
  for (const r of w.sample()) {
    assert.ok(finiteRec(r));
    assert.ok(r.x > -260 && r.x < 130 + 260, `x=${r.x}`);
  }
  w.setSize(0, -5); // invalid dims ignored
  assert.equal(w.width, 130);
  assert.equal(w.height, 280);
});

test('tap burst stays bounded and produces finite samples', () => {
  const w = mk();
  w.burst(100, 100);
  w.burst(NaN, Infinity); // ignored
  assert.equal(w.bursts.length, 1);
  for (let i = 0; i < 30; i++) w.burst(i, i);
  assert.ok(w.bursts.length <= 12, 'burst list is bounded');
  stepN(w, 60, 0.1);
  for (const r of w.sample()) assert.ok(finiteRec(r));
});

test('sample records carry the documented fields', () => {
  const w = mk({ population: 12 });
  stepN(w, 30, 0.1);
  for (const r of w.sample()) {
    for (const k of ['species', 'x', 'y', 'dir', 'scale', 'depth', 'frame', 'phase']) {
      assert.ok(k in r, `record missing ${k}`);
    }
    assert.ok(typeof r.species === 'string' && r.species.length > 0);
  }
});
