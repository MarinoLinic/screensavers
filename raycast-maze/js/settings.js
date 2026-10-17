// Persistent user settings via localStorage.
(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  const STORAGE_KEY = 'maze3d.settings.v1';
  const DEFAULTS = Object.freeze({
    auto: false,
    autoSmart: true,
    map: false,
    interactions: true,
    sound: true,
    // Legacy look is the default: CRT scanlines overlay + low-res sampling.
    scanlines: true,
    lowRes: true,
    lastLevel: 0,
  });

  class SettingsStore {
    constructor() {
      this.values = { ...DEFAULTS };
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          for (const key of ['auto', 'autoSmart', 'map', 'interactions',
            'sound', 'scanlines', 'lowRes']) {
            if (typeof parsed[key] === 'boolean') this.values[key] = parsed[key];
          }
          if (Number.isInteger(parsed.lastLevel) && parsed.lastLevel >= 0) {
            this.values.lastLevel = parsed.lastLevel;
          }
        }
      } catch (error) {
        this.values = { ...DEFAULTS };
      }
    }

    get(key) {
      return this.values[key];
    }

    set(key, value) {
      if (!(key in DEFAULTS)) return;
      this.values[key] = value;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
      } catch (error) {
        // Storage unavailable (private mode, quota); settings stay in memory.
      }
    }

    snapshot() {
      return { ...this.values };
    }
  }

  Maze3D.SettingsStore = SettingsStore;
})();
