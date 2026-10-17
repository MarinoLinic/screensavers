import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, STORAGE_KEY, STYLE_ORDER, RECIPES, applyPreset, loadSettings,
  saveSettings, validateSettings, PRESETS,
} from '../js/settings.js';

test('validateSettings passes a clean object through', () => {
  const { settings, warnings } = validateSettings({ ...DEFAULTS, seed: 5 });
  assert.deepEqual(settings, { ...DEFAULTS, seed: 5 });
  assert.equal(warnings.length, 0);
});

test('validateSettings rejects NaN, unknowns, negatives, bad enums', () => {
  const { settings, warnings } = validateSettings({
    speed: NaN,
    pipeCount: -3,
    bends: 'fast',
    density: 17,
    mode: 'chaotic',
    joints: 'glue',
    camera: 4,
    seed: 'abc',
    lowRes: 'yes',
    preset: 'neon',
    unknownKey: 1,
  });
  assert.equal(settings.speed, DEFAULTS.speed);
  assert.equal(settings.pipeCount, DEFAULTS.pipeCount);
  assert.equal(settings.bends, DEFAULTS.bends);
  assert.equal(settings.density, DEFAULTS.density, 'out-of-range density rejected');
  assert.equal(settings.mode, DEFAULTS.mode);
  assert.equal(settings.joints, DEFAULTS.joints);
  assert.equal(settings.camera, DEFAULTS.camera);
  assert.equal(settings.seed, DEFAULTS.seed);
  assert.equal(settings.lowRes, DEFAULTS.lowRes);
  assert.equal(settings.preset, DEFAULTS.preset);
  assert.ok(!('unknownKey' in settings));
  assert.ok(!('facets' in settings));
  assert.ok(warnings.length >= 10, `expected warnings, got ${warnings.length}`);
});

test('validateSettings rejects out-of-range, rounds integers', () => {
  const { settings } = validateSettings({ speed: 99, pipeCount: 5.7, seed: 3.9 });
  assert.equal(settings.speed, DEFAULTS.speed);
  assert.equal(settings.pipeCount, 6);
  assert.equal(settings.seed, 4);
});

test('validateSettings accepts numeric strings for ranges', () => {
  const { settings } = validateSettings({ speed: '2.5' });
  assert.equal(settings.speed, 2.5);
});

test('density soft threshold is 0.1..0.95', () => {
  assert.equal(validateSettings({ density: 0.95 }).settings.density, 0.95);
  assert.equal(validateSettings({ density: 0.1 }).settings.density, 0.1);
  assert.equal(validateSettings({ density: 0.96 }).settings.density, DEFAULTS.density);
  assert.equal(validateSettings({ density: 0.09 }).settings.density, DEFAULTS.density);
  assert.equal(DEFAULTS.density, 0.65);
});

test('exactly ten styles in fixed keyboard order, six hues each', () => {
  assert.deepEqual(Object.keys(PRESETS), [...STYLE_ORDER]);
  assert.equal(STYLE_ORDER.length, 10);
  assert.deepEqual(STYLE_ORDER, [
    '1995', 'foundry', 'icebox', 'candy', 'porcelain',
    'verdigris', 'nocturne', 'solar', 'lagoon', 'graphite',
  ]);
  for (const key of STYLE_ORDER) {
    const p = PRESETS[key];
    assert.equal(p.hues.length, 6, `${key} must ship paletteSize 6 hues`);
    assert.ok(p.swatches.length >= 3, `${key} swatches`);
    assert.ok(p.label && p.blurb, `${key} needs label + material blurb`);
    for (const h of p.hues) assert.match(h, /^#[0-9a-f]{6}$/i, `${key} hue ${h}`);
    assert.match(p.bg, /^#[0-9a-f]{6}$/i, `${key} bg`);
  }
});

test('legacy v1 blobs: obsolete facets dropped, global switches kept', () => {
  const bag = new Map();
  bag.set(STORAGE_KEY, JSON.stringify({
    version: 1, seed: 7, preset: 'candy', facets: 6, lowRes: true,
    scanlines: true, joints: 'mixed', density: 0.8,
  }));
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  const { settings } = loadSettings(store);
  assert.equal(settings.seed, 7);
  assert.equal(settings.preset, 'candy');
  assert.equal(settings.lowRes, true, 'legacy retro switch must survive');
  assert.equal(settings.scanlines, true);
  assert.equal(settings.joints, 'mixed');
  assert.equal(settings.density, 0.8);
  assert.ok(!('facets' in settings), 'obsolete facets key must be dropped');
});

test('loadSettings survives malformed storage', () => {
  const junkStore = { getItem: () => '{not json', setItem: () => {} };
  assert.deepEqual(loadSettings(junkStore).settings, { ...DEFAULTS });
  const wrongVersion = {
    getItem: () => JSON.stringify({ version: 99, seed: 1 }),
    setItem: () => {},
  };
  assert.deepEqual(loadSettings(wrongVersion).settings, { ...DEFAULTS });
  const throwing = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
  };
  assert.deepEqual(loadSettings(throwing).settings, { ...DEFAULTS });
  assert.equal(saveSettings({ ...DEFAULTS }, throwing), false);
});

test('save/load round trip through a fake storage (no facets persisted)', () => {
  const bag = new Map();
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  const mine = { ...DEFAULTS, seed: 4242, mode: 'classic', preset: 'lagoon' };
  assert.equal(saveSettings(mine, store), true);
  const blob = bag.get(STORAGE_KEY);
  assert.ok(blob.includes('4242'));
  assert.ok(!blob.includes('facets'), 'persisted blob must not contain facets');
  const { settings, warnings } = loadSettings(store);
  assert.deepEqual(settings, mine);
  assert.equal(warnings.length, 0);
});

test('applyPreset changes ONLY the style id — globals survive every preset', () => {
  for (const key of STYLE_ORDER) {
    const out = applyPreset({
      ...DEFAULTS, seed: 9, joints: 'ball', lowRes: true, scanlines: true,
      camera: 'fixed', speed: 3.5, mode: 'classic', density: 0.2,
    }, key);
    assert.equal(out.preset, key);
    assert.equal(out.seed, 9);
    assert.equal(out.joints, 'ball');
    assert.equal(out.lowRes, true, `${key} clobbered lowRes`);
    assert.equal(out.scanlines, true, `${key} clobbered scanlines`);
    assert.equal(out.camera, 'fixed');
    assert.equal(out.speed, 3.5);
    assert.equal(out.mode, 'classic');
    assert.equal(out.density, 0.2);
    assert.ok(!('facets' in out));
  }
  assert.equal(applyPreset({ ...DEFAULTS }, 'nope').preset, DEFAULTS.preset);
});

test('auto-cycle + pixel flags: defaults, validation, roundtrip', () => {
  assert.equal(DEFAULTS.autoCycle, false);
  assert.equal(DEFAULTS.pixelMode, false);
  assert.equal(DEFAULTS.cycleInterval, 30);

  const { settings } = validateSettings(
    { autoCycle: true, pixelMode: true, cycleInterval: 60 });
  assert.equal(settings.autoCycle, true);
  assert.equal(settings.pixelMode, true);
  assert.equal(settings.cycleInterval, 60);
  // the full interval enum, including the 90-second option
  for (const ok of [15, 30, 60, 90, 120]) {
    assert.equal(validateSettings({ cycleInterval: ok }).settings.cycleInterval,
      ok, `cycleInterval ${ok} rejected`);
  }

  for (const bad of [0, 7, 45, '60', NaN, true]) {
    const out = validateSettings({ cycleInterval: bad });
    assert.equal(out.settings.cycleInterval, 30,
      `cycleInterval ${JSON.stringify(bad)} must be rejected to default`);
  }
  for (const bad of [1, 'yes', null]) {
    assert.equal(validateSettings({ autoCycle: bad }).settings.autoCycle, false);
    assert.equal(validateSettings({ pixelMode: bad }).settings.pixelMode, false);
  }

  // persistence roundtrip keeps the flags
  const bag = new Map();
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  const mine = { ...DEFAULTS, autoCycle: true, cycleInterval: 120, pixelMode: true };
  assert.equal(saveSettings(mine, store), true);
  assert.deepEqual(loadSettings(store).settings, mine);

  // legacy blobs absent the new keys fall back to the new defaults
  bag.set(STORAGE_KEY, JSON.stringify({ version: 1, preset: 'solar' }));
  const legacy = loadSettings(store).settings;
  assert.equal(legacy.autoCycle, false);
  assert.equal(legacy.pixelMode, false);
  assert.equal(legacy.cycleInterval, 30);
});

test('applyPreset preserves auto-cycle + pixel flags across all presets', () => {
  for (const key of STYLE_ORDER) {
    const out = applyPreset({
      ...DEFAULTS, autoCycle: true, cycleInterval: 120, pixelMode: true,
    }, key);
    assert.equal(out.preset, key);
    assert.equal(out.autoCycle, true, `${key} clobbered autoCycle`);
    assert.equal(out.cycleInterval, 120);
    assert.equal(out.pixelMode, true, `${key} clobbered pixelMode`);
  }
});

test('flow recipes pin exact speed/pipeCount/bends/density', () => {
  assert.deepEqual(RECIPES.quiet,
    { label: 'Quiet', speed: 0.55, pipeCount: 3, bends: 0.25, density: 0.65 });
  assert.deepEqual(RECIPES.balanced,
    { label: 'Balanced', speed: 1, pipeCount: 5, bends: 0.45, density: 0.65 });
  assert.deepEqual(RECIPES.rush,
    { label: 'Rush', speed: 2, pipeCount: 8, bends: 0.65, density: 0.75 });
});
