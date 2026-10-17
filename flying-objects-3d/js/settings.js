// Settings schema, presets, validation, persistence.
// Pure module: no DOM/three imports so it runs under node --test.

export const STORAGE_KEY = 'flyingObjects3d.settings.v1';

export const DEFAULTS = Object.freeze({
  version: 1,
  preset: 'orbital',      // STYLE_ORDER key
  motion: 'drift',        // MOTIONS key
  family: 'mixed',        // FAMILIES key
  count: 16,              // simultaneous objects 1..40
  speed: 0.75,            // simulation pace multiplier 0.15..3
  spin: 0.55,             // tumble rate 0..2
  spread: 1.0,            // formation volume 0.5..1.5
  scale: 1.0,             // object size multiplier 0.5..1.8
  material: 'auto',       // 'auto' | 'chrome' | 'ceramic' | 'glass' | 'wireframe' | 'checker'
  camera: 'drift',        // 'drift' | 'fixed'
  trails: false,
  stars: true,
  lowRes: false,
  scanlines: false,
  autoCycle: false,       // rotate presets on a wall-clock timer
  cycleInterval: 45,      // seconds between style pulses: 20|45|90|180
  seed: 1997,
});

// Style order is also the keyboard order: digit keys 1..8 select directly.
export const STYLE_ORDER = Object.freeze([
  'orbital', '1997', 'porcelain', 'candy',
  'foundry', 'tidal', 'sunset', 'spectral',
]);

// Material override choices. 'auto' defers to the preset's bundled material.
export const MATERIALS = Object.freeze([
  'auto', 'chrome', 'ceramic', 'glass', 'wireframe', 'checker',
]);

// Each preset bundles ONLY a palette + material default + backdrop lighting.
// Motion, family, count, seed, display switches and any material override
// are never touched by a style.
//   hues:      body colours (6)
//   swatches:  3 chips for the card
//   mat:       default surface profile (metalness/roughness/env/emissive)
//   sky:       backdrop gradient [zenith, horizon glow, nadir]
//   light:     key light tint
export const PRESETS = Object.freeze({
  orbital: {
    label: 'Orbital',
    blurb: 'Cool silver, teal, cobalt, amber — default chrome',
    hues: ['#c9d4e0', '#2fbfa8', '#2f5fd0', '#d9a03a', '#8fa2b8', '#3a8fc8'],
    swatches: ['#c9d4e0', '#2fbfa8', '#2f5fd0'],
    mat: { metalness: 0.95, roughness: 0.14, env: 1.25, emissive: 0 },
    sky: ['#060b18', '#0d2233', '#03060d'],
    light: '#cfe4ff',
  },
  '1997': {
    label: '1997',
    blurb: 'Candy-primary metallic, the original toy box',
    hues: ['#d43d2a', '#2a5fd4', '#d9a420', '#1f9e50', '#8a2ad4', '#e8e2d4'],
    swatches: ['#d43d2a', '#2a5fd4', '#d9a420'],
    mat: { metalness: 0.8, roughness: 0.24, env: 1.0, emissive: 0 },
    sky: ['#070b14', '#131a2a', '#04060c'],
    light: '#ffe8c8',
  },
  porcelain: {
    label: 'Porcelain',
    blurb: 'Ivory, celadon and coral ceramic, warm studio',
    hues: ['#f0e9dc', '#a8c8b4', '#e0785a', '#c9bfae', '#8fa8a0', '#e8d8c0'],
    swatches: ['#f0e9dc', '#a8c8b4', '#e0785a'],
    mat: { metalness: 0.02, roughness: 0.32, env: 0.9, emissive: 0 },
    sky: ['#171310', '#2a2018', '#0d0a08'],
    light: '#ffe4c0',
  },
  candy: {
    label: 'Candy',
    blurb: 'Saturated pop lacquer, showroom gloss',
    hues: ['#f040a0', '#ffb020', '#58d830', '#8048f0', '#ff5030', '#20c8e0'],
    swatches: ['#f040a0', '#ffb020', '#8048f0'],
    mat: { metalness: 0.15, roughness: 0.1, env: 1.35, emissive: 0 },
    sky: ['#0b0714', '#1c1030', '#060410'],
    light: '#f0d8ff',
  },
  foundry: {
    label: 'Foundry',
    blurb: 'Copper, brass and gunmetal under forge light',
    hues: ['#c96f2e', '#b08d46', '#6e7884', '#8a4a2a', '#b03a2e', '#4a5560'],
    swatches: ['#c96f2e', '#b08d46', '#6e7884'],
    mat: { metalness: 0.92, roughness: 0.3, env: 1.0, emissive: 0 },
    sky: ['#0c0806', '#241408', '#060402'],
    light: '#ffc890',
  },
  tidal: {
    label: 'Tidal',
    blurb: 'Blue, turquoise and pearl, deep-water shine',
    hues: ['#2a9e8f', '#3ec6c0', '#3a7bd4', '#9fe0d4', '#1f5a9e', '#d0ece8'],
    swatches: ['#2a9e8f', '#3ec6c0', '#3a7bd4'],
    mat: { metalness: 0.3, roughness: 0.18, env: 1.3, emissive: 0 },
    sky: ['#04101a', '#0a2a34', '#020810'],
    light: '#c0f0ff',
  },
  sunset: {
    label: 'Sunset',
    blurb: 'Amber, coral and warm metal at dusk',
    hues: ['#e8a030', '#e05a3a', '#c94f60', '#f0c060', '#a04878', '#e08848'],
    swatches: ['#e8a030', '#e05a3a', '#c94f60'],
    mat: { metalness: 0.75, roughness: 0.22, env: 1.1, emissive: 0 },
    sky: ['#120812', '#38160e', '#080408'],
    light: '#ffb890',
  },
  spectral: {
    label: 'Spectral',
    blurb: 'Icy electric holo — emissive edges, additive sheen',
    hues: ['#58e8ff', '#a080ff', '#40ffb0', '#e050ff', '#70a0ff', '#c0fff0'],
    swatches: ['#58e8ff', '#a080ff', '#40ffb0'],
    mat: { metalness: 0.6, roughness: 0.12, env: 1.6, emissive: 0.35 },
    sky: ['#050814', '#0e1430', '#020408'],
    light: '#b0c8ff',
  },
});

// Six fleet choreographies plus the simple Flower Box option.
// Keys are the canonical order for the panel buttons.
export const MOTIONS = Object.freeze({
  drift: {
    label: 'Drift',
    name: 'Free drift',
    hint: 'Weightless tumble; pieces glance off the edges of the view volume.',
  },
  orbit: {
    label: 'Orbit',
    name: 'Orbital lanes',
    hint: 'Tilted elliptical lanes at different depths, like a tabletop orrery.',
  },
  helix: {
    label: 'Helix',
    name: 'Corkscrew',
    hint: 'A rising coil conveyor; pieces fade out at the top and return below.',
  },
  vortex: {
    label: 'Vortex',
    name: 'Vortex',
    hint: 'A funnel streaming out of the deep toward the viewer; wraps fade.',
  },
  swarm: {
    label: 'Swarm',
    name: 'Swarm ribbon',
    hint: 'The set flows together along a weaving Lissajous ribbon.',
  },
  classic: {
    label: 'Classic',
    name: 'Classic bounce',
    hint: 'One large slow piece, like the original. Object count is kept but ignored.',
  },
  flowerbox: {
    label: 'Flower Box',
    name: 'Simple Flower Box',
    hint: 'One softly morphing, rotating box on a clean background. Family, count and spread are kept for the fleet.',
  },
});
export const MOTION_ORDER = Object.freeze(Object.keys(MOTIONS));

// Object families. 'mixed' guarantees all ten shapes when count allows.
export const FAMILIES = Object.freeze({
  mixed:      { label: 'Mixed set',    hint: 'One of everything, then a seeded shuffle.' },
  classics:   { label: 'Classics',     hint: 'Cubes, spheres, teapots, rings.' },
  polyhedra:  { label: 'Polyhedra',    hint: 'Cubes, octahedra, icosahedra.' },
  loops:      { label: 'Loops',        hint: 'Tori, knots and linked rings.' },
  satellites: { label: 'Satellites',   hint: 'Panel-winged orbiters only.' },
  teapots:    { label: 'Teapots',      hint: 'The whole fleet is porcelain.' },
});
export const FAMILY_ORDER = Object.freeze(Object.keys(FAMILIES));

// The ten cached shape types. Mixed families guarantee coverage of all ten
// once count >= 10.
export const SHAPES = Object.freeze([
  'cube', 'sphere', 'octahedron', 'icosahedron', 'torus',
  'knot', 'capsule', 'rings', 'teapot', 'satellite',
]);

const RANGES = {
  count: [1, 40],
  speed: [0.15, 3],
  spin: [0, 2],
  spread: [0.5, 1.5],
  scale: [0.5, 1.8],
  seed: [0, 2147483647],
};

const ENUMS = {
  preset: STYLE_ORDER,
  motion: MOTION_ORDER,
  family: FAMILY_ORDER,
  material: MATERIALS,
  camera: ['drift', 'fixed'],
  cycleInterval: [20, 45, 90, 180],
};

const INT_KEYS = new Set(['count', 'seed']);
const BOOL_KEYS = new Set(['trails', 'stars', 'lowRes', 'scanlines', 'autoCycle']);

/**
 * Sanitize an arbitrary object into a valid settings object.
 * Returns { settings, warnings } — non-object roots (arrays included),
 * unknown keys and malformed or out-of-range values all fall back to
 * defaults; values are rejected, never silently clamped.
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
    if (!(key in raw)) continue;
    const v = raw[key];
    if (key in ENUMS) {
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
 * Style application: returns a sanitized settings object whose ONLY change
 * is the preset id. Material overrides, seed, motion, family and display
 * switches all survive untouched.
 */
export function applyPreset(settings, presetKey) {
  if (!PRESETS[presetKey]) return settings;
  return validateSettings({ ...settings, preset: presetKey }).settings;
}

export function paletteOf(settings) {
  return PRESETS[settings.preset] || PRESETS[DEFAULTS.preset];
}

/** Load persisted settings; any malformation yields defaults + warnings. */
export function loadSettings(storage) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return { settings: { ...DEFAULTS }, warnings: [] };
    const text = store.getItem(STORAGE_KEY);
    if (text == null) return { settings: { ...DEFAULTS }, warnings: [] };
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
