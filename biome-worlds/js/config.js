export const BIOMES = [
  { id: 'marine', family: 'Marine', accent: '#83cdd2', seed: 159 },
  { id: 'desert', family: 'Desert', accent: '#d5a06c', seed: 3099 },
  { id: 'jungle', family: 'Jungle', accent: '#77bba0', seed: 103 },
  { id: 'forest', family: 'Temperate forest', accent: '#9eaf6f', seed: 722 },
  { id: 'tundra', family: 'Tundra', accent: '#a6cce1', seed: 991 },
  { id: 'mediterranean', family: 'Mediterranean', accent: '#8dc5b7', seed: 4101 },
  { id: 'steppe', family: 'Steppe', accent: '#d0bd79', seed: 848 },
  { id: 'river', family: 'River', accent: '#83b5a5', seed: 632 },
  { id: 'moon', family: 'Moon', accent: '#c0b8d4', seed: 1969 },
  { id: 'island', family: 'Tropical island', accent: '#e0c384', seed: 507 }
].map(b=>({...b,name:b.family}));
export const AESTHETICS = [
  { id: 'natural', name: 'Natural' },
  { id: 'porcelain', name: 'Porcelain' },
  { id: 'nocturne', name: 'Nocturne' }
];
// Numeric shortcuts follow Pixel Biomes. Names are simply the biome names in both modes.
export const DEFAULTS = { biome: 'mediterranean', mode: 'landscape', aesthetic: 'natural', camera: 'drift', quality: 'balanced', speed: 1, tour: false, interval: 90, atmosphere: true };
export function sanitize(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const out = { ...DEFAULTS };
  for (const [key, choices] of Object.entries({ biome: BIOMES.map(b => b.id), mode: ['landscape','diorama'], aesthetic: AESTHETICS.map(a => a.id), camera: ['drift', 'orbit', 'still'], quality: ['low', 'balanced', 'high'] })) if (choices.includes(raw[key])) out[key] = raw[key];
  if ([45, 90, 180].includes(Number(raw.interval))) out.interval = Number(raw.interval);
  if (typeof raw.speed === 'number' && Number.isFinite(raw.speed)) out.speed = Math.max(.2, Math.min(2, raw.speed));
  for (const key of ['tour', 'atmosphere']) if (typeof raw[key] === 'boolean') out[key] = raw[key];
  return out;
}
export function nextBiome(id, step = 1) { return BIOMES[(BIOMES.findIndex(b => b.id === id) + step + BIOMES.length) % BIOMES.length].id; }
export function random(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function riverX(z) { return 2.7 * Math.sin(z * .31) - .8; }
export function riverDistance(x, z) { return Math.abs(x - riverX(z)); }
export function coastHeight(x, z) { return -.65 + .28 * x + .11 * z + 1.45 * Math.exp(-((x - 4) ** 2 + (z - 2) ** 2) / 26); }
export function islandHeight(x, z) { const r = Math.hypot((x + .5) / 1.16, z * 1.13); return .12 + 1.55 * Math.exp(-r * r / 27); }
export function clockStep(state, wallSeconds, settings, paused, hidden) {
  if (paused || hidden) return false;
  state.time += Math.min(.1, Math.max(0, wallSeconds)) * settings.speed;
  if (!settings.tour) { state.tourTime = 0; return false; }
  state.tourTime += Math.max(0, wallSeconds);
  if (state.tourTime >= settings.interval) { state.tourTime %= settings.interval; return true; }
  return false;
}
