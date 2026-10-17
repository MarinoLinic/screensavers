import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, STORAGE_KEY, LEGACY_STORAGE_KEY, HABITATS, HABITAT_ORDER, BIOMES, BIOME_ORDER, familyOf,
  COMMUNITIES, COMMUNITY_ORDER, DESERT_LIGHT_ORDER,
  applyHabitat, loadSettings, saveSettings, validateSettings,
} from '../js/settings.js';

test('validateSettings passes a clean object through', () => {
  const { settings, warnings } = validateSettings({ ...DEFAULTS, seed: 5 });
  assert.deepEqual(settings, { ...DEFAULTS, seed: 5 });
  assert.equal(warnings.length, 0);
});

test('malformed roots fall back to defaults', () => {
  for (const bad of [null, undefined, 7, 'x', true, [1, 2], ['reef'], Object.create(null)]) {
    const { settings } = validateSettings(bad);
    assert.deepEqual(settings, { ...DEFAULTS }, `root ${JSON.stringify(bad)}`);
  }
});

test('validateSettings rejects bad enums, bools, ranges, unknowns', () => {
  const { settings, warnings } = validateSettings({
    habitat: 'mars', community: 'sharks', pixelSize: 5, cycleInterval: 60,
    population: 4, speed: 9, seed: 'abc',
    visitors: 'yes', sunRays: 1, bubbles: null, plankton: 0,
    scanlines: 'off', vegetation: {}, autoCycle: 'true',
    paused: true, panelOpen: true, bogus: {},
  });
  for (const k of Object.keys(DEFAULTS)) {
    if (k === 'version') continue;
    assert.equal(settings[k], DEFAULTS[k], `${k} should revert to default`);
  }
  assert.ok(!('paused' in settings) && !('panelOpen' in settings) && !('bogus' in settings));
  assert.ok(warnings.length >= 14, `expected many warnings, got ${warnings.length}`);
});

test('prototype members can never smuggle enum values', () => {
  // every one of these is a real Object.prototype name; none is a habitat
  for (const v of ['constructor', 'hasOwnProperty', '__proto__', 'toString', 'valueOf']) {
    assert.equal(validateSettings({ habitat: v }).settings.habitat, DEFAULTS.habitat, v);
    assert.equal(validateSettings({ community: v }).settings.community, DEFAULTS.community, v);
  }
  // an object sporting prototype-chain keys still validates clean
  const proto = { habitat: 'abyss' };
  const raw = Object.create(proto);
  assert.equal(validateSettings(raw).settings.habitat, DEFAULTS.habitat,
    'inherited (not own) values must be ignored');
});

test('range edges inclusive, integers rounded', () => {
  const { settings } = validateSettings({ population: 48, speed: 2, seed: 2147483647 });
  assert.equal(settings.population, 48);
  assert.equal(settings.speed, 2);
  assert.equal(settings.seed, 2147483647);
  const edges = validateSettings({ population: 7, speed: 0.24, seed: -1 }).settings;
  assert.equal(edges.population, DEFAULTS.population);
  assert.equal(edges.speed, DEFAULTS.speed);
  assert.equal(edges.seed, DEFAULTS.seed);
  assert.equal(validateSettings({ population: 24.6, seed: 3.9 }).settings.population, 25);
  assert.equal(validateSettings({ population: 24.6, seed: 3.9 }).settings.seed, 4);
});

test('numeric strings accepted; empty/null/bool rejected', () => {
  assert.equal(validateSettings({ speed: '1.5' }).settings.speed, 1.5);
  assert.equal(validateSettings({ speed: '' }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: '  ' }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: null }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: true }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ speed: Infinity }).settings.speed, DEFAULTS.speed);
  assert.equal(validateSettings({ seed: '42' }).settings.seed, 42);
});

test('ten biome families contain seventeen unique scenes; communities and lights exact', () => {
  assert.equal(BIOME_ORDER.length,10);
  assert.equal(HABITAT_ORDER.length,17);
  assert.equal(new Set(HABITAT_ORDER).size,17);
  assert.deepEqual(BIOMES.marine.scenes,['reef','kelp','lagoon','abyss']);
  assert.equal(BIOMES.mediterranean.scenes.length,4);
  for(const family of BIOME_ORDER) for(const h of BIOMES[family].scenes) assert.equal(familyOf(h),family);
  assert.deepEqual(new Set(Object.keys(HABITATS)), new Set(HABITAT_ORDER));
  for (const key of HABITAT_ORDER) {
    assert.ok(HABITATS[key].label && HABITATS[key].blurb, `${key} card data`);
    assert.equal(validateSettings({ habitat: key }).settings.habitat, key);
  }
  // biome kinds: four waters + desert is land
  for (const key of ['reef', 'kelp', 'lagoon', 'abyss']) {
    assert.equal(HABITATS[key].kind, 'water', key);
  }
  assert.equal(HABITATS.desert.kind, 'land');
  assert.equal(DEFAULTS.habitat, 'desert', 'fresh installs open on the desert');
  assert.equal(DEFAULTS.population, 12, 'sparse land fauna default');
  assert.equal(DEFAULTS.desertLight, 'golden');
  assert.deepEqual(DESERT_LIGHT_ORDER, ['golden', 'day', 'night']);
  for (const l of DESERT_LIGHT_ORDER) {
    assert.equal(validateSettings({ desertLight: l }).settings.desertLight, l);
  }
  for (const bad of ['dusk', 'constructor', 3, null]) {
    assert.equal(validateSettings({ desertLight: bad }).settings.desertLight, 'golden');
  }
  assert.deepEqual(COMMUNITY_ORDER, ['mixed', 'reef', 'jellies']);
  for (const key of COMMUNITY_ORDER) {
    assert.ok(COMMUNITIES[key].label, key);
    assert.equal(validateSettings({ community: key }).settings.community, key);
  }
  for (const px of [2, 3, 4]) {
    assert.equal(validateSettings({ pixelSize: px }).settings.pixelSize, px);
  }
  for (const bad of [0, 2.5, '3', true, null]) {
    assert.equal(validateSettings({ pixelSize: bad }).settings.pixelSize, 3);
  }
  for (const iv of [45, 90, 180]) {
    assert.equal(validateSettings({ cycleInterval: iv }).settings.cycleInterval, iv);
  }
  for (const bad of [30, '90', true, null]) {
    assert.equal(validateSettings({ cycleInterval: bad }).settings.cycleInterval, 90);
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

test('legacy tidal-pixel.v1 migrates into pixel-biomes.v1', () => {
  const legacyBlob = JSON.stringify({
    version: 1, seed: 4242, habitat: 'abyss', community: 'jellies',
    population: 33, visitors: false, pixelSize: 4, speed: 1.5,
  });
  const bag = new Map([[LEGACY_STORAGE_KEY, legacyBlob]]);
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  const { settings } = loadSettings(store);
  assert.equal(settings.habitat, 'abyss', 'legacy habitat survives');
  assert.equal(settings.population, 33, 'legacy population survives');
  assert.equal(settings.seed, 4242);
  assert.equal(settings.community, 'jellies');
  assert.equal(settings.visitors, false);
  assert.equal(settings.desertLight, 'golden', 'new keys get defaults');
  // a clean copy is written forward; the legacy blob is left alone
  assert.ok(bag.has(STORAGE_KEY), 'migrated copy saved under the new key');
  assert.equal(bag.get(LEGACY_STORAGE_KEY), legacyBlob, 'legacy key untouched');
});

test('corrupt new key never falls through to legacy', () => {
  const bag = new Map();
  bag.set(STORAGE_KEY, '{corrupt');
  bag.set(LEGACY_STORAGE_KEY, JSON.stringify({ version: 1, habitat: 'abyss', seed: 7 }));
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  const { settings } = loadSettings(store);
  assert.equal(settings.habitat, 'desert', 'defaults, not the legacy pick');
  assert.equal(settings.seed, 1995);
});

test('save/load roundtrip; runtime keys never persisted', () => {
  const bag = new Map();
  const store = {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, v),
  };
  const mine = {
    ...DEFAULTS, seed: 4242, habitat: 'abyss', community: 'jellies',
    population: 33, visitors: false, sunRays: false, scanlines: true,
    pixelSize: 4, autoCycle: true, cycleInterval: 180,
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

test('applyHabitat changes ONLY the habitat id — everything survives', () => {
  const weird = {
    ...DEFAULTS, seed: 9, community: 'jellies', population: 8,
    speed: 2, visitors: false, sunRays: false, bubbles: false,
    plankton: false, scanlines: true, pixelSize: 4, vegetation: false,
    autoCycle: true, cycleInterval: 45,
  };
  for (const key of HABITAT_ORDER) {
    const out = applyHabitat(weird, key);
    assert.equal(out.habitat, key);
    for (const k of Object.keys(DEFAULTS)) {
      if (k === 'habitat' || k === 'version') continue;
      assert.equal(out[k], weird[k], `${key} clobbered ${k}`);
    }
  }
  assert.equal(applyHabitat({ ...DEFAULTS }, 'nope').habitat, DEFAULTS.habitat);
});
