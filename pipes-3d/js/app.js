// PIPELINE app: wires the engine, renderer, overlay settings, persistence,
// keyboard. The stage always fills the viewport; the settings dialog is a
// runtime-only overlay that never reframes the scene.

import { PipeWorld, ENGINE_DEFAULTS } from './engine.js';
import { PipeRenderer } from './renderer.js';
import { StyleCycle } from './style-cycle.js';
import {
  DEFAULTS, PRESETS, RECIPES, STYLE_ORDER, STORAGE_KEY, applyPreset,
  loadSettings, saveSettings, validateSettings,
} from './settings.js';

const $ = (id) => document.getElementById(id);

const els = {
  canvas: $('gl'), stage: $('stage'), panel: $('panel'), backdrop: $('backdrop'),
  panelClose: $('panelClose'), headStatus: $('headStatus'),
  keystrip: $('keystrip'), restoreChip: $('restoreChip'),
  kSettings: $('kSettings'), kPause: $('kPause'), kNew: $('kNew'),
  kSnap: $('kSnap'), kFs: $('kFs'), kHide: $('kHide'),
  modeSel: $('modeSel'), speedIn: $('speedIn'), speedOut: $('speedOut'),
  pipeCountIn: $('pipeCountIn'), pipeCountOut: $('pipeCountOut'),
  bendsIn: $('bendsIn'), bendsOut: $('bendsOut'),
  densityIn: $('densityIn'), densityOut: $('densityOut'),
  jointsSel: $('jointsSel'), cameraSel: $('cameraSel'),
  lowResIn: $('lowResIn'), scanIn: $('scanIn'), scanlines: $('scanlines'),
  autoCycleIn: $('autoCycleIn'), cycleIntervalSel: $('cycleIntervalSel'),
  cycleHint: $('cycleHint'), pixelModeIn: $('pixelModeIn'),
  seedIn: $('seedIn'), seedBtn: $('seedBtn'), resetBtn: $('resetBtn'),
  recipes: $('recipes'), presets: $('presets'), modeHint: $('modeHint'),
  stPipes: $('stPipes'), stCells: $('stCells'), stRetired: $('stRetired'),
  stCycles: $('stCycles'), stSeed: $('stSeed'), stTime: $('stTime'),
  budgetNote: $('budgetNote'), webglFail: $('webglFail'),
};

// ------------------------------------------------------------------ state

const loaded = loadSettings();
let settings = loaded.settings;
let persistedCameraChoice = false;
try {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  // only a *valid* stored camera value counts as an explicit choice
  persistedCameraChoice =
    !!raw && typeof raw === 'object' && (raw.camera === 'orbit' || raw.camera === 'fixed');
} catch { /* malformed storage: treated as no explicit choice */ }

const reduceMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = typeof matchMedia === 'function'
  && matchMedia('(pointer: coarse)').matches;

let world = new PipeWorld(settings, { ...ENGINE_DEFAULTS });
let renderer = null;
let paused = false;        // runtime-only, never persisted
let panelOpen = false;     // runtime-only, never persisted
let chromeHidden = false;  // key strip hidden, runtime-only
let statusFlash = { text: null, until: 0 };
let renderDirty = true;
const invalidate = () => { renderDirty = true; };
// Automatic colour cycling: wall-clock seconds while running, runtime-only
// phase. The pulse only asks the world to queue fresh colours for the NEXT
// segments — presets, materials and committed pipes are untouched.
const cycle = new StyleCycle();

function flash(text) {
  statusFlash = { text, until: performance.now() + 2600 };
  updateStatusLine();
}

try {
  renderer = new PipeRenderer(els.canvas, settings, {
    dimension: world.dim, totalCells: world.totalCells, maxPaths: world.cfg.maxPaths,
  });
} catch (err) {
  els.webglFail.hidden = false;
  els.canvas.hidden = true;
  console.error('PIPELINE: WebGL init failed', err);
}

// Reduced-motion users get a still camera unless they explicitly chose one.
// In-memory only — nothing is persisted until the user touches the control.
if (reduceMotion && !persistedCameraChoice) settings.camera = 'fixed';

if (renderer) renderer.setDisplay(settings);

// ------------------------------------------------------------------ UI sync

const MODE_HINTS = {
  living: 'Living mode retires one old pipe at a time — the scene keeps breathing and never hard-resets.',
  classic: 'Classic mode fills the lattice, fades everything out, and reseeds — like the original screensaver.',
};

const CYCLE_HINTS = {
  living: 'Growing pipes pick a new random colour at the interval. Existing sections keep theirs.',
  classic: 'New colours on scene refresh only; no changes while filling.',
};

function setText(el, v) {
  if (el.textContent !== v) el.textContent = v; // no repetitive DOM writes
}

function syncUI() {
  els.modeSel.value = settings.mode;
  els.speedIn.value = settings.speed;
  setText(els.speedOut, `${Number(settings.speed).toFixed(2)}×`);
  els.pipeCountIn.value = settings.pipeCount;
  setText(els.pipeCountOut, String(settings.pipeCount));
  els.bendsIn.value = settings.bends;
  setText(els.bendsOut, Number(settings.bends).toFixed(2));
  els.densityIn.value = settings.density;
  setText(els.densityOut, Number(settings.density).toFixed(2));
  els.jointsSel.value = settings.joints;
  els.cameraSel.value = settings.camera;
  els.lowResIn.checked = settings.lowRes;
  els.scanIn.checked = settings.scanlines;
  els.autoCycleIn.checked = settings.autoCycle;
  els.cycleIntervalSel.value = String(settings.cycleInterval);
  els.cycleIntervalSel.disabled =
    !settings.autoCycle || settings.mode !== 'living';
  els.pixelModeIn.checked = settings.pixelMode;
  els.seedIn.value = settings.seed;
  setText(els.modeHint, MODE_HINTS[settings.mode]);
  setText(els.cycleHint, CYCLE_HINTS[settings.mode]);
  els.kPause.setAttribute('aria-pressed', String(paused));
  setText(els.kPause.lastChild, paused ? ' Resume' : ' Pause');
  document.body.classList.toggle('lowres', settings.lowRes);
  document.body.classList.toggle('pixelmode', settings.pixelMode);
  els.scanlines.hidden = !settings.scanlines;
  syncStyleUI();
}

/** Style highlight only — safe to call without touching field drafts. */
function syncStyleUI() {
  for (const b of els.presets.querySelectorAll('.preset-btn')) {
    b.setAttribute('aria-pressed', String(b.dataset.preset === settings.preset));
  }
}

function updateStatusLine() {
  const c = world.counts();
  const base = `${settings.mode} · seed ${c.seed} · ${c.occupied}/${c.budget} cells · ${c.active} live` +
    (paused ? ' · paused' : '');
  setText(els.headStatus,
    statusFlash.until > performance.now() ? statusFlash.text : base);
}

function updateStats() {
  if (!panelOpen) return; // stats live inside settings only
  const c = world.counts();
  setText(els.stPipes, `${c.active}+${c.finished}${c.fading ? '·⟳' + c.fading : ''}`);
  setText(els.stCells, `${c.occupied}/${c.budget}`);
  setText(els.stRetired, String(c.retired));
  setText(els.stCycles, String(c.cycles));
  setText(els.stSeed, String(c.seed));
  setText(els.stTime, `${Math.floor(c.time)}s`);
  setText(els.budgetNote,
    `Lattice ${world.dim}³ = ${c.total} cells · soft budget ${c.budget} · ` +
    `per-path cap ${world.cfg.maxPathCells} · max ${world.cfg.maxPaths} paths`);
  updateStatusLine();
}

function persist() {
  saveSettings(settings);
}

function setSetting(key, value) {
  const { settings: clean } = validateSettings({ ...settings, [key]: value });
  settings = clean;
  world.updateSettings(settings); // live merge; may finish surplus heads
  persist();
  invalidate();
}

/** Joints re-plan every path — shared geometry is never rebuilt. */
function applyJoints() {
  if (!renderer) return;
  renderer.settings = settings;
  renderer.rebuildAll(world);
  invalidate();
}

/**
 * Manual style switch: palette + material + backdrop only. Applies
 * immediately, restarts the colour-request countdown, and keeps the engine
 * settings copy in agreement — the world itself is never reseeded.
 */
function applyStyle(key) {
  if (!PRESETS[key]) return;
  settings = applyPreset(settings, key);
  world.updateSettings(settings);
  persist(); // once per pick, not per frame
  cycle.reset();
  if (renderer) renderer.applyStyle(world, settings);
  syncUI();
  invalidate();
  flash(`${PRESETS[key].label} applied`);
}

function applyDisplay() {
  document.body.classList.toggle('lowres', settings.lowRes);
  document.body.classList.toggle('pixelmode', settings.pixelMode);
  els.scanlines.hidden = !settings.scanlines;
  if (renderer) renderer.setDisplay(settings);
  invalidate();
}

// ------------------------------------------------------------------ panel

function setPanel(open) {
  if (open === panelOpen) return;
  panelOpen = open;
  els.panel.hidden = !open;
  els.panel.inert = !open;
  els.backdrop.hidden = !open;
  if (open) {
    updateStats();
    els.panelClose.focus();
  } else {
    els.canvas.focus({ preventScroll: true });
  }
}

els.panelClose.addEventListener('click', () => setPanel(false));
els.backdrop.addEventListener('click', () => setPanel(false));

// Focus trap + recovery inside the dialog.
els.panel.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = [...els.panel.querySelectorAll(
    'summary, button, select, input, [tabindex]'
  )].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const cur = document.activeElement;
  if (e.shiftKey && (cur === first || !els.panel.contains(cur))) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && cur === last) {
    e.preventDefault(); first.focus();
  }
});

// ------------------------------------------------------------------ presets

for (const [key, p] of Object.entries(PRESETS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'preset-btn';
  b.dataset.preset = key;
  b.setAttribute('aria-pressed', 'false');
  const idx = STYLE_ORDER.indexOf(key);
  const keyHint = idx >= 0 ? `<span class="pnum">[${(idx + 1) % 10}]</span>` : '';
  b.setAttribute('aria-label', `${p.label} style — ${p.blurb}`);
  const sw = p.swatches.map((c) => `<i style="background:${c}"></i>`).join('');
  b.innerHTML = `<span class="pname">${keyHint} ${p.label}</span>
    <span class="swatches">${sw}</span>
    <span class="pblurb">${p.blurb}</span>`;
  b.addEventListener('click', () => applyStyle(key));
  els.presets.appendChild(b);
}

function cycleStyle(step) {
  const i = STYLE_ORDER.indexOf(settings.preset);
  const next = STYLE_ORDER[(i + step + STYLE_ORDER.length) % STYLE_ORDER.length];
  applyStyle(next);
}

function selectStyle(i) {
  const key = STYLE_ORDER[i];
  if (key && key !== settings.preset) applyStyle(key);
}

for (const [key, r] of Object.entries(RECIPES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key-btn';
  b.textContent = r.label;
  b.setAttribute('aria-label',
    `${r.label} recipe — pace ${r.speed}, ${r.pipeCount} pipes, bends ${r.bends}, density ${r.density}`);
  b.addEventListener('click', () => {
    for (const [k, v] of Object.entries({
      speed: r.speed, pipeCount: r.pipeCount, bends: r.bends, density: r.density,
    })) settings = { ...settings, [k]: v };
    world.updateSettings(settings);
    persist();
    syncUI();
    invalidate();
    flash(`${r.label} flow applied`);
  });
  els.recipes.appendChild(b);
}

// ------------------------------------------------------------------ controls

els.modeSel.addEventListener('change', () => {
  setSetting('mode', els.modeSel.value);
  cycle.reset();
  syncUI();
  // A mode switch mid-flight can strand lifecycle state (e.g. a classic reset
  // in progress), so we intentionally start the same seed fresh.
  world.reseed(world.seed);
  flash('mode changed · fresh pattern');
});
els.speedIn.addEventListener('input', () => { setSetting('speed', Number(els.speedIn.value)); syncUI(); });
els.pipeCountIn.addEventListener('input', () => { setSetting('pipeCount', Number(els.pipeCountIn.value)); syncUI(); });
els.bendsIn.addEventListener('input', () => { setSetting('bends', Number(els.bendsIn.value)); syncUI(); });
els.densityIn.addEventListener('input', () => { setSetting('density', Number(els.densityIn.value)); syncUI(); });
els.jointsSel.addEventListener('change', () => { setSetting('joints', els.jointsSel.value); applyJoints(); });
els.lowResIn.addEventListener('change', () => { setSetting('lowRes', els.lowResIn.checked); applyDisplay(); });
els.scanIn.addEventListener('change', () => { setSetting('scanlines', els.scanIn.checked); applyDisplay(); });
els.cameraSel.addEventListener('change', () => { setSetting('camera', els.cameraSel.value); applyDisplay(); });
els.autoCycleIn.addEventListener('change', () => {
  setSetting('autoCycle', els.autoCycleIn.checked);
  cycle.reset();
  syncUI();
});
els.cycleIntervalSel.addEventListener('change', () => {
  setSetting('cycleInterval', Number(els.cycleIntervalSel.value));
  cycle.reset();
  syncUI();
});
els.pixelModeIn.addEventListener('change', () => {
  setSetting('pixelMode', els.pixelModeIn.checked);
  applyDisplay();
  syncUI();
});

const JOINT_CYCLE = ['elbows', 'ball', 'mixed'];
function cycleJoints() {
  const i = JOINT_CYCLE.indexOf(settings.joints);
  setSetting('joints', JOINT_CYCLE[(i + 1) % JOINT_CYCLE.length]);
  applyJoints();
  syncUI();
  flash(`joints: ${settings.joints}`);
}

function applySeed(seed, announce) {
  world.reseed(seed);
  cycle.reset();
  settings.seed = world.seed;
  els.seedIn.value = world.seed;
  persist();
  invalidate();
  updateStats();
  updateStatusLine();
  flash(announce);
}

function nextPattern() {
  world.reseedNext();
  cycle.reset();
  settings.seed = world.seed;
  els.seedIn.value = world.seed;
  persist();
  invalidate();
  flash('new pattern');
}

els.seedBtn.addEventListener('click', () => {
  const raw = els.seedIn.value.trim();
  const n = Number(raw);
  if (raw === '' || !Number.isInteger(n) || n < 0 || n > 2147483647) {
    flash('seed rejected: integer between 0 and 2147483647');
    return;
  }
  applySeed(n, `seed ${n} applied`);
});

els.resetBtn.addEventListener('click', () => {
  settings = { ...DEFAULTS }; // full reset — presets and retro switches too
  cycle.reset();
  world.updateSettings(settings);
  // recolor before replanning: rebuilt paths must get the default palette
  if (renderer) renderer.applyStyle(world, settings);
  applySeed(DEFAULTS.seed, 'defaults restored');
  syncUI();
  applyJoints();
  applyDisplay();
});

function setPaused(v) {
  paused = v;
  els.kPause.setAttribute('aria-pressed', String(paused));
  setText(els.kPause.lastChild, paused ? ' Resume' : ' Pause');
  invalidate();
  updateStatusLine();
}

function setChromeHidden(hidden) {
  chromeHidden = hidden;
  els.keystrip.hidden = hidden;
  // Coarse-pointer restore chip: keyboard users get Esc/O instead.
  els.restoreChip.hidden = !(hidden && coarsePointer);
  invalidate();
}

function toggleChromeHidden() {
  if (!chromeHidden) {
    if (panelOpen) setPanel(false); // H gives a clean view: settings close too
    setChromeHidden(true);
  } else {
    setChromeHidden(false);
  }
}

els.restoreChip.addEventListener('click', () => {
  setChromeHidden(false);
  setPanel(true);
});

function toggleFullscreen() {
  const el = document.documentElement; // whole document: strip + panel survive
  const p = document.fullscreenElement
    ? document.exitFullscreen()
    : el.requestFullscreen && el.requestFullscreen();
  if (p && p.catch) p.catch(() => flash('fullscreen refused'));
}
document.addEventListener('fullscreenchange', () => {
  if (renderer) renderer.resize();
  invalidate();
});

function snapshot() {
  if (!renderer) return;
  // freeze the name now: a delayed toBlob callback must still name the
  // seed that was on screen when the capture was requested
  const name = `pipeline-${world.seed}-${Date.now()}.png`;
  try {
    renderer.update(world); // commit queued engine events before the frame
    renderer.render();      // explicit frame: preserveDrawingBuffer stays off
  } catch (err) {
    flash('snapshot failed');
    return;
  }
  try {
    els.canvas.toBlob((blob) => {
      let url = null;
      try {
        if (!blob) throw new Error('empty blob');
        url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        flash('snapshot saved');
      } catch (err) {
        flash('snapshot failed');
      } finally {
        if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }, 'image/png');
  } catch (err) {
    flash('snapshot failed');
  }
}

// key strip
els.kSettings.addEventListener('click', () => setPanel(!panelOpen));
els.kPause.addEventListener('click', () => setPaused(!paused));
els.kNew.addEventListener('click', nextPattern);
els.kSnap.addEventListener('click', snapshot);
els.kFs.addEventListener('click', toggleFullscreen);
els.kHide.addEventListener('click', toggleChromeHidden);

// ------------------------------------------------------------------ keyboard

// Text-editing targets swallow every key except Escape (native editing wins);
// `O` must NOT toggle the panel while typing in a seed field.
const TEXT_EDITABLE =
  'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea';
const CONTENT_EDITABLE = '[contenteditable]:not([contenteditable="false"])';
// Space on these is the native activation — leave it alone.
const SPACE_NATIVE = 'button, select, input[type=checkbox], input[type=radio]';

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const t = e.target;
  if (e.key === 'Escape') {
    if (panelOpen) { e.preventDefault(); setPanel(false); }
    else if (chromeHidden) { e.preventDefault(); setChromeHidden(false); }
    return;
  }
  if (t && (t.isContentEditable ||
      (t.closest && (t.closest(TEXT_EDITABLE) || t.closest(CONTENT_EDITABLE))))) {
    return;
  }
  // Selects keep native typeahead/arrow/digit behavior; only O still
  // manages the panel (never inside a text input — guarded above).
  if (t && t.closest && t.closest('select') && e.code !== 'KeyO') return;
  switch (e.code) {
    case 'Space':
      if (t && t.closest && t.closest(SPACE_NATIVE)) return;
      e.preventDefault();
      setPaused(!paused);
      break;
    case 'KeyO': setPanel(!panelOpen); break;
    case 'KeyR': nextPattern(); break;
    case 'KeyS': case 'KeyC': snapshot(); break;
    case 'KeyF': toggleFullscreen(); break;
    case 'KeyH': toggleChromeHidden(); break;
    case 'KeyA':
      setSetting('camera', settings.camera === 'orbit' ? 'fixed' : 'orbit');
      applyDisplay();
      syncUI();
      break;
    case 'KeyJ': cycleJoints(); break;
    case 'KeyP': // pixel workshop toggle — documented inside the panel only
      setSetting('pixelMode', !settings.pixelMode);
      applyDisplay();
      syncUI();
      flash(settings.pixelMode ? 'pixel workshop on' : 'pixel workshop off');
      break;
    case 'BracketLeft': cycleStyle(-1); break;
    case 'BracketRight': cycleStyle(1); break;
    default: {
      const m = /^Digit(\d)$/.exec(e.code);
      if (m) selectStyle((Number(m[1]) + 9) % 10); // 1..9 -> 0..8, 0 -> 9
      break;
    }
  }
});

window.addEventListener('resize', () => {
  if (renderer) renderer.resize();
  invalidate();
});

// ------------------------------------------------------------------ loop

// Tab-return guard: don't let elapsed time jump the simulation forward, and
// do zero work while the page is hidden.
let last = performance.now();
document.addEventListener('visibilitychange', () => { last = performance.now(); });

let statAt = 0;

function frame(now) {
  if (document.hidden) {
    last = now;
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (renderer) {
    // orbit.step reports whether the camera actually moved (drag, wheel,
    // auto-rotate) so a paused, still scene costs no render at all.
    const camMoved = renderer.orbit.step(dt, settings.camera === 'orbit' && !paused);
    if (!paused) {
      // A colour pulse lands BEFORE the world step so queued tints apply at
      // whatever segment boundary is reached inside this same frame.
      if (cycle.step(dt, settings)) {
        const n = world.requestColorChange();
        if (n) flash('new colours queued for growing pipes');
      }
      world.step(dt);
    }
    if (!paused || camMoved || renderDirty) {
      renderer.update(world);
      renderer.render();
      renderDirty = false;
    }
  }
  if (panelOpen && now - statAt > 250) {
    statAt = now;
    updateStats();
  }
  requestAnimationFrame(frame);
}

syncUI();
updateStatusLine();
if (loaded.warnings.length) console.warn('PIPELINE settings:', loaded.warnings.join('; '));

// diagnostics for smoke tests / tinkering — intentionally small surface
window.PIPELINE = {
  version: 1,
  world,
  get settings() { return settings; },
  renderer: renderer || undefined,
  styleCycle: cycle,
  isPaused: () => paused,
  isPanelOpen: () => panelOpen,
  // Deterministic test hook: mirrors the frame() path (colour pulse before
  // world step) without waiting on wall-clock RAF. Honors the same
  // paused/hidden guards as frame().
  debugStep: (dt) => {
    if (paused || !renderer || document.hidden) return;
    if (cycle.step(dt, settings)) world.requestColorChange();
    world.step(dt);
  },
};

requestAnimationFrame(frame);
