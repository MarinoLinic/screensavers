import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, STORAGE_KEY, STYLE_ORDER, MOTIONS, MOTION_ORDER, FAMILIES,
  MATERIALS, PRESETS, applyPreset, loadSettings, saveSettings,
  validateSettings,
} from '../js/settings.js';

test('validateSettings passes a clean object through', () => {
  const { settings, warnings } = validateSettings({ ...DEFAULTS, seed: 5 });
  assert.deepEqual(settings, { ...DEFAULTS, seed: 5 });
  assert.equal(warnings.length, 0);
});

test('malformed roots fall back to defaults', () => {
  for (const bad of [null, undefined, 7, 'x', true, [1, 2], ['orbital']]) {
    const { settings } = validateSettings(bad);
    assert.deepEqual(settings, { ...DEFAULTS }, `root ${JSON.stringify(bad)}`);
  }
});

test('validateSettings rejects bad enums, bools, unknowns', () => {
  const { settings, warnings } = validateSettings({
    preset: 'neon', motion: 'spinny', family: 'junk', material: 'gold',
    camera: 'orbit', count: -2, speed: NaN, spin: 'fast', spread: 99,
    scale: 0.1, seed: 'abc', trails: 'yes', stars: 1, lowRes: null,
    scanlines: 0, autoCycle: 'true', cycleInterval: 30, paused: true,
    panelOpen: true, bogus: {},
  });
  for (const k of Object.keys(DEFAULTS)) {
    if (k === 'version') continue;
    assert.equal(settings[k], DEFAULTS[k], `${k} should revert to default`);
  }
  assert.ok(!('paused' in settings) && !('panelOpen' in settings) && !('bogus' in settings));
  assert.ok(warnings.length >= 15, `expected many warnings, got ${warnings.length}`);
});

test('range edges inclusive, integers rounded', () => {
  const { settings } = validateSettings({
    count: 40, speed: 3, spin: 0, spread: 1.5, scale: 0.5, seed: 2147483647,
  });
  assert.equal(settings.count, 40);
  assert.equal(settings.speed, 3);
  assert.equal(settings.spin, 0);
  assert.equal(settings.spread, 1.5);
  assert.equal(settings.scale, 0.5);
  assert.equal(settings.seed, 2147483647);
  const edges = validateSettings({ count: 0, speed: 0.14, spread: 0.49, scale: 1.9, seed: -1 }).settings;
  assert.equal(edges.count, DEFAULTS.count);
  assert.equal(edges.speed, DEFAULTS.speed);
  assert.equal(edges.spread, DEFAULTS.spread);
  assert.equal(edges.scale, DEFAULTS.scale);
  assert.equal(edges.seed, DEFAULTS.seed);
  assert.equal(validateSettings({ count: 16.6, seed: 3.9 }).settings.count, 17);
  assert.equal(validateSettings({ count: 16.6, seed: 3.9 }).settings.seed, 4);
});

test('numeric strings accepted; empty/null/bool rejected', () => {
  assert.equal(validateSettings({ speed: '2.5' }).settings.speed, 2.5);
  assert.equal(validateSettings({ speed: '' }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: '  ' }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: null }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: true }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: Infinity }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ seed: '42' }).settings.seed, 42);
});

test('eight presets in fixed keyboard order with required fields', () => {
  // '1997' is an integer-like key so object order differs; STYLE_ORDER is
  // the canonical keyboard/panel order and must cover every preset.
  assert.deepEqual(new Set(Object.keys(PRESETS)), new Set(STYLE_ORDER));
  assert.equal(STYLE_ORDER.length, 8);
  assert.deepEqual(STYLE_ORDER, [
    'orbital', '1997', 'porcelain', 'candy', 'foundry', 'tidal', 'sunset', 'spectral',
  ]);
  for (const key of STYLE_ORDER) {
    const p = PRESETS[key];
    assert.equal(p.hues.length, 6, `${key} needs 6 hues`);
    assert.ok(p.swatches.length >= 3 && p.label && p.blurb, `${key} card data`);
    assert.ok(Array.isArray(p.sky) && p.sky.length === 3, `${key} backdrop`);
    assert.ok(p.mat && Number.isFinite(p.mat.metalness) && Number.isFinite(p.mat.roughness), `${key} material default`);
    for (const h of [...p.hues, ...p.swatches, ...p.sky, p.light]) {
      assert.match(h, /^#[0-9a-f]{6}$/i, `${key} colour ${h}`);
    }
  }
});

test('motions and families ship the exact key sets', () => {
  assert.deepEqual(MOTION_ORDER, ['drift', 'orbit', 'helix', 'vortex', 'swarm', 'classic', 'flowerbox']);
  assert.deepEqual(Object.keys(FAMILIES), ['mixed', 'classics', 'polyhedra', 'loops', 'satellites', 'teapots']);
  assert.deepEqual(MATERIALS, ['auto', 'chrome', 'ceramic', 'glass', 'wireframe', 'checker']);
  for (const m of MOTION_ORDER) assert.ok(MOTIONS[m].hint && MOTIONS[m].label, m);
  for (const iv of [20, 45, 90, 180]) {
    assert.equal(validateSettings({ cycleInterval: iv }).settings.cycleInterval, iv);
  }
  for (const bad of [10, 30, '45', true, null]) {
    assert.equal(validateSettings({ cycleInterval: bad }).settings.cycleInterval, 45);
  }
});

test('loadSettings survives malformed storage, bad version, arrays', () => {
  const junk = { getItem: () => '{not json', setItem: () => {} };
  assert.deepEqual(loadSettings(junk).settings, { ...DEFAULTS });
  const wrongVersion = { getItem: () => JSON.stringify({ version: 99, seed: 1 }), setItem: () => {} };
  assert.deepEqual(loadSettings(wrongVersion).settings, { ...DEFAULTS });
  const arr = { getItem: () => JSON.stringify([1, 2, 3]), setItem: () => {} };
  assert.deepEqual(loadSettings(arr).settings, { ...DEFAULTS });
  const nul = { getItem: () => 'null', setItem: () => {} };
  assert.deepEqual(loadSettings(nul).settings, { ...DEFAULTS });
  const throwing = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
  };
  assert.deepEqual(loadSettings(throwing).settings, { ...DEFAULTS });
  assert.equal(saveSettings({ ...DEFAULTS }, throwing), false);
});

test('save/load roundtrip; runtime keys never persisted', () => {
  const bag = new Map();
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  const mine = {
    ...DEFAULTS, seed: 4242, preset: 'spectral', motion: 'vortex',
    family: 'teapots', count: 33, material: 'glass', trails: true,
    paused: true, panelOpen: true, chromeHidden: true, elapsed: 99,
  };
  assert.equal(saveSettings(mine, store), true);
  const blob = bag.get(STORAGE_KEY);
  for (const k of ['paused', 'panelOpen', 'chromeHidden', 'elapsed']) {
    assert.ok(!blob.includes(`"${k}"`), `${k} leaked into storage`);
  }
  const { settings, warnings } = loadSettings(store);
  const { paused, panelOpen, chromeHidden, elapsed, ...rest } = mine;
  assert.deepEqual(settings, rest);
  assert.equal(warnings.length, 0);
});

test('applyPreset changes ONLY the preset id — everything survives', () => {
  const weird = {
    ...DEFAULTS, seed: 9, material: 'wireframe', motion: 'vortex',
    family: 'satellites', count: 3, speed: 2.5, spin: 0, spread: 0.5,
    scale: 1.8, camera: 'fixed', trails: true, stars: false,
    lowRes: true, scanlines: true, autoCycle: true, cycleInterval: 180,
  };
  for (const key of STYLE_ORDER) {
    const out = applyPreset(weird, key);
    assert.equal(out.preset, key);
    for (const k of Object.keys(DEFAULTS)) {
      if (k === 'preset' || k === 'version') continue;
      assert.equal(out[k], weird[k], `${key} clobbered ${k}`);
    }
  }
  assert.equal(applyPreset({ ...DEFAULTS }, 'nope').preset, DEFAULTS.preset);
});

test('flowerbox is a persisted motion; old settings still default to drift', () => {
  assert.equal(validateSettings({ motion: 'flowerbox' }).settings.motion, 'flowerbox');
  assert.equal(validateSettings({ motion: 'blob' }).settings.motion, 'drift');
  const bag = new Map();
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  saveSettings({ ...DEFAULTS, motion: 'flowerbox', count: 24, family: 'teapots' }, store);
  const { settings } = loadSettings(store);
  assert.equal(settings.motion, 'flowerbox');
  assert.equal(settings.count, 24);
  assert.equal(settings.family, 'teapots');
  // a v1 blob written before flowerbox existed loads as drift
  const old = { getItem: () => JSON.stringify({ version: 1, motion: 'drift', seed: 5 }), setItem: () => {} };
  assert.equal(loadSettings(old).settings.motion, 'drift');
});
