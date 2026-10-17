// Settings schema, habitats, validation, persistence.
// Pure module: no DOM imports so it runs under node --test.

export const STORAGE_KEY = 'pixel-biomes.v1';
export const LEGACY_STORAGE_KEY = 'tidal-pixel.v1'; // pre-rename key, migrated on read

export const DEFAULTS = Object.freeze({
  version: 1,
  habitat: 'desert',      // HABITAT_ORDER key
  population: 12,         // simultaneous creatures 8..48 (visitors excluded)
  community: 'mixed',     // 'mixed' | 'reef' | 'jellies' — water biomes only
  visitors: true,         // occasional big-animal crossings
  speed: 0.7,             // simulation pace multiplier 0.25..2
  sunRays: true,          // light shafts / sun glare
  bubbles: true,          // ambient rising bubbles / wind gusts
  plankton: true,         // drifting motes / dust motes
  scanlines: false,       // retro CRT stripes
  pixelSize: 3,           // logical pixel size on screen: 2 | 3 | 4
  vegetation: true,       // foreground plants / cacti & scrub
  autoCycle: false,       // rotate habitats on a wall-clock timer
  cycleInterval: 90,      // seconds between habitat pulses: 45|90|180
  tourScope: 'biomes',    // equal time per family, all scenes, or this family
  frameRate: 30,          // pixel animation needs fewer repaints than the display
  seed: 1995,
  desertLight: 'golden',  // 'golden' | 'day' | 'night' — Desert only
});

// Digits choose families. Next/previous traverse the flattened scene order.
// kind selects a marine, terrestrial, mixed water/land, or vacuum renderer.
export const BIOMES = Object.freeze({
  marine: { label: 'Marine', scenes: ['reef','kelp','lagoon','abyss'] },
  desert: { label: 'Desert', scenes: ['desert'] },
  jungle: { label: 'Jungle', scenes: ['jungle'] },
  forest: { label: 'Temperate forest', scenes: ['forest'] },
  tundra: { label: 'Tundra', scenes: ['tundra'] },
  mediterranean: { label: 'Mediterranean', scenes: ['med-cove','med-islands','med-harbour','med-terraces'] },
  steppe: { label: 'Steppe', scenes: ['steppe'] },
  river: { label: 'River', scenes: ['river'] },
  moon: { label: 'Moon', scenes: ['moon'] },
  tropical: { label: 'Tropical Island', scenes: ['trop-beach','trop-atoll'] },
});
export const BIOME_ORDER = Object.freeze(Object.keys(BIOMES));
export const HABITAT_ORDER = Object.freeze(BIOME_ORDER.flatMap(k=>BIOMES[k].scenes));
export const familyOf = habitat => BIOME_ORDER.find(k=>BIOMES[k].scenes.includes(habitat)) || 'desert';

export const HABITATS = Object.freeze({
  reef: {
    label: 'Coral Garden',
    blurb: 'Sunbeams over a crowded coral shelf',
    kind: 'water',
  },
  kelp: {
    label: 'Kelp Cathedral',
    blurb: 'Towering green-gold kelp columns',
    kind: 'water',
  },
  lagoon: {
    label: 'Moonlit Lagoon',
    blurb: 'Moonlight over a broken merchant ship and coral-covered timbers',
    kind: 'water',
  },
  abyss: {
    label: 'Midnight Trench',
    blurb: 'Black-navy water, cyan bioluminescence',
    kind: 'water',
  },
  desert: {
    label: 'Sandstone Arches',
    blurb: 'Sandstone arches, wind-shaped dunes and quiet desert life',
    kind: 'land',
  },
  jungle: {label:'Emerald Canopy',blurb:'Buttress roots, blue morphos and a hidden cascade',kind:'land'},
  forest: {label:'Mosswood Clearing',blurb:'Old oak, mossy timber and copper woodland life',kind:'land'},
  tundra: {label:'Silver Tundra',blurb:'Snow peaks, wind-polished stones and Arctic wildlife',kind:'land'},
  'med-cove': {label:'Limestone Cove',blurb:'Karst cliffs, a sea cave and glass-clear turquoise water',kind:'coast'},
  'med-islands': {label:'Adriatic Beach',blurb:'An Aleppo pine backshore, pale pebbles and clear blue shallows',kind:'coast'},
  'med-harbour': {label:'Adriatic Harbour',blurb:'Terracotta roofs, moored boats and dusk on the water',kind:'coast'},
  'med-terraces': {label:'Olive Terraces',blurb:'Dry-stone walls and silver olive groves above the sea',kind:'coast'},
  steppe: {label:'Feathergrass Sea',blurb:'A wide sky, wildflowers and quiet grassland wildlife',kind:'land'},
  river: {label:'Willow River',blurb:'Willow banks, a kingfisher and freshwater life below',kind:'river'},
  moon: {label:'Earthrise Station',blurb:'Silver crater rims, a survey rover and Earth in the black sky',kind:'space'},
  'trop-beach': {label:'Caribbean Palm Beach',blurb:'Curved coconut palms, a volcanic ridge and a white sand shore',kind:'coast'},
  'trop-atoll': {label:'Atoll Lagoon',blurb:'Low coral islands, thatched water villas and a wide turquoise lagoon',kind:'coast'},
});

export const DESERT_LIGHTS = Object.freeze({
  golden: { label: 'Golden hour' },
  day:    { label: 'Daylight' },
  night:  { label: 'Moonlit' },
});
export const DESERT_LIGHT_ORDER = Object.freeze(Object.keys(DESERT_LIGHTS));

export const COMMUNITIES = Object.freeze({
  mixed:   { label: 'Mixed reef life', hint: 'Everything the habitat supports.' },
  reef:    { label: 'Reef fish',       hint: 'Schooling fish and floor life, no drifters.' },
  jellies: { label: 'Jelly drift',     hint: 'A slow bloom of jellies with a few companions.' },
});
export const COMMUNITY_ORDER = Object.freeze(Object.keys(COMMUNITIES));

const RANGES = {
  population: [8, 48],
  speed: [0.25, 2],
  seed: [0, 2147483647],
};

const ENUMS = {
  habitat: HABITAT_ORDER,
  community: COMMUNITY_ORDER,
  pixelSize: [2, 3, 4],
  cycleInterval: [45, 90, 180],
  tourScope: ['biomes','scenes','family'],
  frameRate: [30,60],
  desertLight: DESERT_LIGHT_ORDER,
};

const INT_KEYS = new Set(['population', 'seed']);
const BOOL_KEYS = new Set([
  'visitors', 'sunRays', 'bubbles', 'plankton', 'scanlines', 'vegetation', 'autoCycle',
]);

/**
 * Sanitize an arbitrary object into a valid settings object.
 * Returns { settings, warnings } — non-object roots (arrays included),
 * unknown keys and malformed or out-of-range values all fall back to
 * defaults; values are rejected, never silently clamped. Prototype
 * members ('constructor', '__proto__', ...) are never valid enum values.
 */
export function validateSettings(raw) {
  const warnings = [];
  const out = { ...DEFAULTS };
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    if (raw != null) warnings.push('settings not an object; defaults applied');
    return { settings: out, warnings };
  }
  for (const key of Object.keys(DEFAULTS)) {
    if (key === 'version') continue;
    if (!Object.hasOwn(raw, key)) continue;
    const v = raw[key];
    if (key in ENUMS) {
      // Array.prototype.includes only accepts literal members, so
      // inherited Object properties can never smuggle a value through.
      if (ENUMS[key].includes(v)) {
        out[key] = v;
      } else {
        warnings.push(`${key}: rejected ${JSON.stringify(v)}`);
      }
    } else if (BOOL_KEYS.has(key)) {
      if (typeof v === 'boolean') {
        out[key] = v;
      } else {
        warnings.push(`${key}: rejected ${JSON.stringify(v)}`);
      }
    } else if (key in RANGES) {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof n === 'number' && Number.isFinite(n) && n >= RANGES[key][0] && n <= RANGES[key][1]) {
        out[key] = INT_KEYS.has(key) ? Math.round(n) : n;
      } else {
        warnings.push(`${key}: rejected ${JSON.stringify(v)}`);
      }
    }
  }
  return { settings: out, warnings };
}

/**
 * Habitat application: returns a sanitized settings object whose ONLY
 * change is the habitat id. Population, community, seed, atmosphere and
 * tour switches all survive untouched.
 */
export function applyHabitat(settings, habitatKey) {
  if (!Object.hasOwn(HABITATS, habitatKey)) return settings;
  return validateSettings({ ...settings, habitat: habitatKey }).settings;
}

export function habitatOf(settings) {
  return HABITATS[settings.habitat] || HABITATS[DEFAULTS.habitat];
}

/** Load persisted settings; any malformation yields defaults + warnings.
    Reads pixel-biomes.v1 first; only when it is entirely absent does the
    legacy tidal-pixel.v1 key get a look-in (then a clean copy is saved to
    the new key without deleting the old one). A corrupt new key falls back
    to defaults — never silently to legacy. */
export function loadSettings(storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return { settings: { ...DEFAULTS }, warnings: [] };
    const text = store.getItem(STORAGE_KEY);
    if (text == null) {
      const legacy = store.getItem(LEGACY_STORAGE_KEY);
      if (legacy != null) {
        const parsed = JSON.parse(legacy);
        if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
            && parsed.version === 1) {
          const migrated = validateSettings(parsed);
          saveSettings(migrated.settings, store); // copy forward; old key untouched
          return migrated;
        }
      }
      return { settings: { ...DEFAULTS }, warnings: [] };
    }
    const parsed = JSON.parse(text);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 1) {
      return {
        settings: { ...DEFAULTS },
        warnings: parsed ? ['settings version mismatch; defaults applied'] : [],
      };
    }
    return validateSettings(parsed);
  } catch (err) {
    return { settings: { ...DEFAULTS }, warnings: [`persisted settings unreadable: ${err.message}`] };
  }
}

/** Persist a sanitized copy; runtime state is never written. */
export function saveSettings(settings, storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    store.setItem(STORAGE_KEY, JSON.stringify(validateSettings(settings).settings));
    return true;
  } catch {
    return false;
  }
}
