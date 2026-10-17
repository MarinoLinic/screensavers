// Settings schema, presets, validation, persistence.
// Pure module: no DOM/three imports so it runs under node --test.

export const STORAGE_KEY = 'pipes3d.settings.v1';

export const DEFAULTS = Object.freeze({
  version: 1,
  mode: 'living',        // 'living' | 'classic'
  speed: 1.0,            // growth pace multiplier
  pipeCount: 5,          // concurrent growing heads 2..8
  bends: 0.45,           // 0 = ramrod straight, 1 = turns constantly
  density: 0.65,         // fraction of lattice cells used before recycling
  joints: 'elbows',      // 'elbows' | 'ball' | 'mixed'
  camera: 'orbit',       // 'orbit' | 'fixed'
  lowRes: false,
  scanlines: false,
  autoCycle: false,      // random colours for new growth in living mode
  cycleInterval: 30,     // seconds between colour requests
  pixelMode: false,      // isometric 2.5D pixel workshop look
  seed: 1337,
  preset: '1995',
});

// Style order is also the keyboard order: digit keys 1..9,0 select directly.
export const STYLE_ORDER = Object.freeze([
  '1995', 'foundry', 'icebox', 'candy', 'porcelain',
  'verdigris', 'nocturne', 'solar', 'lagoon', 'graphite',
]);

// Each preset is a palette + material + backdrop bundle ONLY — joints,
// display switches, seed, flow and camera are never touched by a style.
// Every style provides exactly paletteSize (6) hues.
export const PRESETS = Object.freeze({
  '1995': {
    label: '1995',
    blurb: 'Candy-metal originals',
    hues: ['#d43d2a', '#1f9e83', '#2a5fd4', '#d9a420', '#7a2ad4', '#2f9e44'],
    swatches: ['#d43d2a', '#1f9e83', '#2a5fd4'],
    shininess: 55,
    specular: '#8a8a8a',
    bg: '#0a0c11',
  },
  foundry: {
    label: 'Foundry',
    blurb: 'Copper, brass, cast steel',
    hues: ['#c96f2e', '#b08d46', '#8d99a4', '#7c4a2d', '#b03a2e', '#5d6b58'],
    swatches: ['#c96f2e', '#b08d46', '#8d99a4'],
    shininess: 34,
    specular: '#6e5a44',
    bg: '#0d0b09',
  },
  icebox: {
    label: 'Icebox',
    blurb: 'Cold chrome and fluorine',
    hues: ['#39c6d6', '#3a7bd4', '#b9c8d8', '#7a6fd4', '#2ad4a0', '#9fb4c8'],
    swatches: ['#39c6d6', '#3a7bd4', '#b9c8d8'],
    shininess: 70,
    specular: '#a8bcc8',
    bg: '#090d12',
  },
  candy: {
    label: 'Candy',
    blurb: 'Bubblegum injection plastic',
    hues: ['#e84393', '#f5a623', '#7ed321', '#9b51e0', '#ff5e3a', '#22b8cf'],
    swatches: ['#e84393', '#f5a623', '#9b51e0'],
    shininess: 45,
    specular: '#8f8f8f',
    bg: '#0e0a10',
  },
  porcelain: {
    label: 'Porcelain',
    blurb: 'Ivory, chalk, ink, celadon glaze',
    hues: ['#e8e2d4', '#f2eee2', '#2b2f36', '#9fc2b2', '#b7cdc5', '#c9bfae'],
    swatches: ['#e8e2d4', '#2b2f36', '#9fc2b2'],
    shininess: 85,
    specular: '#c8d0d8',
    bg: '#101010',
  },
  verdigris: {
    label: 'Verdigris',
    blurb: 'Copper, patina, warm teal metal',
    hues: ['#b06a3a', '#4fa08a', '#2e7d78', '#8a5a34', '#6fae9e', '#3f6e66'],
    swatches: ['#b06a3a', '#4fa08a', '#2e7d78'],
    shininess: 55,
    specular: '#7a8a80',
    bg: '#0a0f0c',
  },
  nocturne: {
    label: 'Nocturne',
    blurb: 'Midnight, cobalt, slate, warm silver',
    hues: ['#22315e', '#3a5bd0', '#6b7a94', '#b9c2d4', '#4a5a80', '#8d9ab5'],
    swatches: ['#22315e', '#3a5bd0', '#b9c2d4'],
    shininess: 60,
    specular: '#9aa4b8',
    bg: '#070a12',
  },
  solar: {
    label: 'Solar',
    blurb: 'Ochre, amber, coral heat',
    hues: ['#d9a420', '#e8862a', '#e05a3a', '#b0642a', '#f0b93e', '#c94f30'],
    swatches: ['#d9a420', '#e8862a', '#e05a3a'],
    shininess: 45,
    specular: '#8a7a6a',
    bg: '#100b08',
  },
  lagoon: {
    label: 'Lagoon',
    blurb: 'Sea green, turquoise, blue pearl',
    hues: ['#2a9e8f', '#3ec6c0', '#3a7bd4', '#7ad4c2', '#2a6e9e', '#9fe0d4'],
    swatches: ['#2a9e8f', '#3ec6c0', '#3a7bd4'],
    shininess: 78,
    specular: '#b8d8d8',
    bg: '#081014',
  },
  graphite: {
    label: 'Graphite',
    blurb: 'Silver, gunmetal, industrial slate',
    hues: ['#9aa2ac', '#5a626e', '#3d4450', '#c2c8d0', '#6e7884', '#4a4f58'],
    swatches: ['#9aa2ac', '#5a626e', '#c2c8d0'],
    shininess: 50,
    specular: '#8a929c',
    bg: '#0b0c0e',
  },
});

// Curated motion bundles — they touch speed/pipeCount/bends/density only.
export const RECIPES = Object.freeze({
  quiet:    { label: 'Quiet',    speed: 0.55, pipeCount: 3, bends: 0.25, density: 0.65 },
  balanced: { label: 'Balanced', speed: 1.0,  pipeCount: 5, bends: 0.45, density: 0.65 },
  rush:     { label: 'Rush',     speed: 2.0,  pipeCount: 8, bends: 0.65, density: 0.75 },
});

const RANGES = {
  speed: [0.25, 4],
  pipeCount: [2, 8],
  bends: [0, 1],
  density: [0.1, 0.95],
  seed: [0, 2147483647],
};

const ENUMS = {
  mode: ['living', 'classic'],
  joints: ['elbows', 'ball', 'mixed'],
  camera: ['orbit', 'fixed'],
  preset: Object.keys(PRESETS),
  cycleInterval: [15, 30, 60, 90, 120],
};

const INT_KEYS = new Set(['pipeCount', 'seed']);
const BOOL_KEYS = new Set(['lowRes', 'scanlines', 'autoCycle', 'pixelMode']);

/**
 * Sanitize an arbitrary object into a valid settings object.
 * Returns { settings, warnings } — unknown keys dropped (legacy `facets`
 * blobs included), malformed or out-of-range values rejected back to
 * defaults (never silently clamped).
 */
export function validateSettings(raw) {
  const warnings = [];
  const out = { ...DEFAULTS };
  if (raw == null || typeof raw !== 'object') {
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
 * Style application: returns a new settings object whose ONLY change is the
 * preset id. Display switches, joints, seed, flow and camera are untouched.
 */
export function applyPreset(settings, presetKey) {
  if (!PRESETS[presetKey]) return settings;
  return { ...settings, preset: presetKey };
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
    if (parsed == null || parsed.version !== 1) {
      return { settings: { ...DEFAULTS }, warnings: parsed ? ['settings version mismatch; defaults applied'] : [] };
    }
    return validateSettings(parsed);
  } catch (err) {
    return { settings: { ...DEFAULTS }, warnings: [`persisted settings unreadable: ${err.message}`] };
  }
}

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
