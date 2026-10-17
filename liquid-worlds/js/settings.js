export const SCENES = [
  { id: 'grotto', name: 'Argent Grotto', subtitle: 'Silver tides beneath the mountain', color: '#80dedf' },
  { id: 'foundry', name: 'The Crucible', subtitle: 'Liquid metal in an amber-lit foundry', color: '#e9a76c' },
  { id: 'forest', name: 'Verdant Reach', subtitle: 'A clear stream in the morning light', color: '#a7c984' },
];
export const STORAGE_KEY = 'liquid-worlds.v1';
export const DEFAULTS = Object.freeze({ scene: 'grotto', quality: 'balanced', speed: 1, activity: 1, camera: 'drift', cycle: false, interval: 90, bloom: true, seed: 2001 });
export const QUALITY = {
  low: { dpr: 0.85, reflection: 384, segments: 80, samples: 0 },
  balanced: { dpr: 1.25, reflection: 768, segments: 128, samples: 0 },
  high: { dpr: 1.75, reflection: 1280, segments: 192, samples: 2 },
};
const clamp = (v, a, b, fallback) => Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : fallback;
export function validate(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  return {
    scene: SCENES.some(s => s.id === raw.scene) ? raw.scene : DEFAULTS.scene,
    quality: Object.hasOwn(QUALITY, raw.quality) ? raw.quality : DEFAULTS.quality,
    speed: clamp(raw.speed, 0.25, 2, 1), activity: clamp(raw.activity, 0.25, 2, 1),
    camera: ['drift', 'fixed'].includes(raw.camera) ? raw.camera : 'drift',
    cycle: typeof raw.cycle === 'boolean' ? raw.cycle : false,
    interval: [30, 60, 90, 180, 300].includes(raw.interval) ? raw.interval : 90,
    bloom: typeof raw.bloom === 'boolean' ? raw.bloom : true,
    seed: Math.floor(clamp(raw.seed, 0, 2147483647, 2001)),
  };
}
export function load(storage) {
  try { return validate(JSON.parse(storage.getItem(STORAGE_KEY))); } catch { return { ...DEFAULTS }; }
}
export function save(storage, settings) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(validate(settings))); } catch { /* private mode or quota */ }
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Fixed-capacity ripple history. Simulation time, not wall time, controls age.
export class Ripples {
  constructor(capacity = 16) { this.capacity = capacity; this.events = Array.from({ length: capacity }, () => ({ x: 0, z: 0, born: -100, strength: 0 })); this.cursor = 0; }
  add(x, z, born, strength = 1) { Object.assign(this.events[this.cursor], { x, z, born, strength }); this.cursor = (this.cursor + 1) % this.capacity; }
  sample(x, z, time) {
    let h = 0;
    for (const e of this.events) {
      const age = time - e.born;
      if (age < 0 || age > 6) continue;
      const d = Math.hypot(x - e.x, z - e.z), front = d - age * 2.6;
      h += Math.sin(front * 8) * Math.exp(-front * front * 1.1) * Math.exp(-age * 0.65) * 0.085 * e.strength;
    }
    return h;
  }
}

export class SceneClock {
  constructor() { this.time = 0; this.cycleTime = 0; }
  step(dt, { paused = false, hidden = false, speed = 1, cycle = false, interval = 90 } = {}) {
    if (paused || hidden) return false;
    const elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.time += Math.min(0.05, elapsed) * speed;
    this.cycleTime += elapsed;
    if (cycle && this.cycleTime >= interval) { this.cycleTime = 0; return true; }
    return false;
  }
  resetCycle() { this.cycleTime = 0; }
}
