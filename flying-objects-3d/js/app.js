// FLIGHT.SYS app: wires the FlyWorld engine, the three.js renderer, the
// overlay settings panel, persistence and the keyboard map. The stage always
// fills the viewport; the settings dialog is a runtime-only overlay that
// never reframes the scene.

import { FlyWorld } from './engine.js';
import { FlyRenderer } from './renderer.js';
import { StyleCycle } from './cycle.js';
import {
  DEFAULTS, PRESETS, MOTIONS, FAMILIES, STYLE_ORDER, MOTION_ORDER,
  STORAGE_KEY, applyPreset, loadSettings, saveSettings, validateSettings,
} from './settings.js';

const $ = (id) => document.getElementById(id);

const els = {
  canvas: $('gl'), stage: $('stage'), panel: $('panel'), backdrop: $('backdrop'),
  panelClose: $('panelClose'), headStatus: $('headStatus'),
  keystrip: $('keystrip'), restoreChip: $('restoreChip'),
  kSettings: $('kSettings'), kPause: $('kPause'), kNew: $('kNew'),
  kSnap: $('kSnap'), kFs: $('kFs'), kHide: $('kHide'),
  materialSel: $('materialSel'), autoCycleIn: $('autoCycleIn'),
  cycleIntervalSel: $('cycleIntervalSel'),
  familySel: $('familySel'), countIn: $('countIn'), countOut: $('countOut'),
  scaleIn: $('scaleIn'), scaleOut: $('scaleOut'), familyHint: $('familyHint'),
  motions: $('motions'), speedIn: $('speedIn'), speedOut: $('speedOut'),
  spinIn: $('spinIn'), spinOut: $('spinOut'),
  spreadIn: $('spreadIn'), spreadOut: $('spreadOut'), motionHint: $('motionHint'),
  cameraSel: $('cameraSel'), trailsIn: $('trailsIn'), starsIn: $('starsIn'),
  lowResIn: $('lowResIn'), scanIn: $('scanIn'), scanlines: $('scanlines'),
  displayHint: $('displayHint'),
  seedIn: $('seedIn'), seedBtn: $('seedBtn'), newBtn: $('newBtn'),
  resetBtn: $('resetBtn'), viewBtn: $('viewBtn'),
  presets: $('presets'),
  stCount: $('stCount'), stCalls: $('stCalls'), stTris: $('stTris'),
  stGeoms: $('stGeoms'), stSeed: $('stSeed'), stTime: $('stTime'),
  stageNote: $('stageNote'), webglFail: $('webglFail'), webglRetry: $('webglRetry'),
  toast: $('toast'),
};

// ------------------------------------------------------------------ state

const loaded = loadSettings();
let settings = loaded.settings;
let persistedCameraChoice = false;
try {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  // only a *valid* stored camera value counts as an explicit choice
  persistedCameraChoice =
    !!raw && typeof raw === 'object' && (raw.camera === 'drift' || raw.camera === 'fixed');
} catch { /* malformed storage: treated as no explicit choice */ }

const reduceMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = typeof matchMedia === 'function'
  && matchMedia('(pointer: coarse)').matches;

let world = new FlyWorld(settings);
let renderer = null;
let paused = false;        // runtime-only, never persisted
let panelOpen = false;     // runtime-only, never persisted
let chromeHidden = false;  // key strip hidden, runtime-only
let statusFlash = { text: null, until: 0 };
let renderDirty = true;
const invalidate = () => { renderDirty = true; };
// Automatic style cycling: wall-clock seconds while running, runtime-only.
const cycle = new StyleCycle();

let toastTimer = 0;

function flash(text) {
  statusFlash = { text, until: performance.now() + 2600 };
  updateStatusLine();
  updateToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(updateToast, 2650);
}

/** Transient bottom toast — status feedback, hidden with the chrome. */
function updateToast() {
  const alive = statusFlash.until > performance.now();
  if (alive && !chromeHidden) {
    els.toast.textContent = statusFlash.text;
    els.toast.hidden = false;
  } else {
    els.toast.hidden = true;
  }
}

try {
  renderer = new FlyRenderer(els.canvas, settings, {
    onContextLost: () => {
      els.webglFail.hidden = false;
      const h = els.webglFail.querySelector('h2');
      const p = els.webglFail.querySelector('p');
      if (h) h.textContent = 'WebGL context lost';
      if (p) p.textContent = 'The graphics context was dropped. Retry reloads the sculpture.';
    },
  });
} catch (err) {
  els.webglFail.hidden = false;
  els.canvas.hidden = true;
  console.error('FLYING_OBJECTS: WebGL init failed', err);
}

els.webglRetry.addEventListener('click', () => window.location.reload());

// Reduced-motion users get a still camera unless they explicitly chose one.
// In-memory only — nothing is persisted until the user touches the control.
if (reduceMotion) {
  paused = true;
  if (!persistedCameraChoice) settings.camera = 'fixed';
}

if (renderer) renderer.setDisplay(settings);

// ------------------------------------------------------------------ UI sync

function setText(el, v) {
  if (el.textContent !== v) el.textContent = v; // no repetitive DOM writes
}

function syncUI() {
  els.materialSel.value = settings.material;
  els.autoCycleIn.checked = settings.autoCycle;
  els.cycleIntervalSel.value = String(settings.cycleInterval);
  els.cycleIntervalSel.disabled = !settings.autoCycle;
  els.familySel.value = settings.family;
  els.countIn.value = settings.count;
  // Flower Box is a solo piece on a quiet stage: fleet and stage controls
  // are disabled but their values are kept for the return trip.
  const flowerbox = settings.motion === 'flowerbox';
  els.familySel.disabled = flowerbox;
  els.countIn.disabled = flowerbox;
  els.spreadIn.disabled = flowerbox;
  els.cameraSel.disabled = flowerbox;
  els.starsIn.disabled = flowerbox;
  els.trailsIn.disabled = flowerbox;
  setText(els.countOut, flowerbox ? `1 (saved ${settings.count})` : String(settings.count));
  els.scaleIn.value = settings.scale;
  setText(els.scaleOut, `${Number(settings.scale).toFixed(2)}×`);
  els.speedIn.value = settings.speed;
  setText(els.speedOut, `${Number(settings.speed).toFixed(2)}×`);
  els.spinIn.value = settings.spin;
  setText(els.spinOut, Number(settings.spin).toFixed(2));
  els.spreadIn.value = settings.spread;
  setText(els.spreadOut, Number(settings.spread).toFixed(2));
  els.cameraSel.value = settings.camera;
  els.trailsIn.checked = settings.trails;
  els.starsIn.checked = settings.stars;
  els.lowResIn.checked = settings.lowRes;
  els.scanIn.checked = settings.scanlines;
  els.seedIn.value = settings.seed;
  setText(els.motionHint, MOTIONS[settings.motion].hint);
  setText(els.familyHint, flowerbox
    ? 'Flower Box shows a single piece — family and count stay saved for the fleet.'
    : FAMILIES[settings.family].hint);
  setText(els.displayHint, flowerbox
    ? 'The stage stays quiet here: camera drift rests and star dust is off. Drag, wheel and double-click still answer; everything returns with the fleet.'
    : 'Drag to orbit, wheel to zoom, double-click to reset. The camera keeps answering while paused.');
  els.kPause.setAttribute('aria-pressed', String(paused));
  setText(els.kPause.lastChild, paused ? ' Resume' : ' Pause');
  document.body.classList.toggle('lowres', settings.lowRes);
  els.scanlines.hidden = !settings.scanlines;
  syncStyleUI();
  syncMotionUI();
}

/** Card highlight only — safe to call without touching field drafts. */
function syncStyleUI() {
  for (const b of els.presets.querySelectorAll('.preset-btn')) {
    b.setAttribute('aria-pressed', String(b.dataset.preset === settings.preset));
  }
}

function syncMotionUI() {
  for (const b of els.motions.querySelectorAll('.key-btn')) {
    b.setAttribute('aria-pressed', String(b.dataset.motion === settings.motion));
  }
}

function updateStatusLine() {
  const rem = cycle.remaining(settings);
  const base = `${settings.motion} · ${settings.preset} · seed ${world.seed} · ` +
    `${world.count} objects` + (paused ? ' · paused' : '') +
    (rem != null ? ` · next style ${Math.ceil(rem)}s` : '');
  setText(els.headStatus,
    statusFlash.until > performance.now() ? statusFlash.text : base);
}

function updateStats() {
  if (!panelOpen) return; // stats live inside settings only
  const d = renderer ? renderer.diagnostics() : null;
  setText(els.stCount, String(world.count));
  setText(els.stCalls, d ? String(d.calls) : '–');
  setText(els.stTris, d ? String(d.triangles) : '–');
  setText(els.stGeoms, d ? String(d.geometries) : '–');
  setText(els.stSeed, String(world.seed));
  setText(els.stTime, `${Math.floor(world.simTime)}s`);
  setText(els.stageNote,
    `${settings.family} · ${settings.motion} · ${settings.preset}/${settings.material}` +
    ` · camera ${settings.camera}` + (renderer ? ` · ${d.renders} frames` : ''));
  updateStatusLine();
}

function persist() {
  saveSettings(settings);
}

function setSetting(key, value) {
  const { settings: clean } = validateSettings({ ...settings, [key]: value });
  settings = clean;
  world.updateSettings(settings); // live merge; regenerates only when needed
  persist();
  invalidate();
}

/**
 * Style pick: palette + material + backdrop only. Applies immediately,
 * restarts the cycle countdown, never reseeds the world.
 */
function applyStyle(key) {
  if (!PRESETS[key]) return;
  settings = applyPreset(settings, key);
  world.updateSettings(settings); // preset is look-only: no regen, no reset
  persist(); // once per pick, not per frame
  cycle.reset();
  if (renderer) { renderer.settings = settings; }
  syncUI();
  invalidate();
  flash(`${PRESETS[key].label} applied`);
}

function applyDisplay() {
  document.body.classList.toggle('lowres', settings.lowRes);
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
  els.stage.inert = open; // canvas ignores drags while the dialog is up
  if (open) {
    updateStats();
    els.panelClose.focus();
  } else {
    els.stage.inert = false;
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

for (const key of STYLE_ORDER) {
  const p = PRESETS[key];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'preset-btn';
  b.dataset.preset = key;
  b.setAttribute('aria-pressed', 'false');
  const idx = STYLE_ORDER.indexOf(key);
  b.setAttribute('aria-label', `${p.label} style — ${p.blurb}`);
  const sw = p.swatches.map((c) => `<i style="background:${c}"></i>`).join('');
  b.innerHTML = `<span class="pname"><span class="pnum">[${idx + 1}]</span> ${p.label}</span>
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

function nextPresetKey() {
  const i = STYLE_ORDER.indexOf(settings.preset);
  return STYLE_ORDER[(i + 1) % STYLE_ORDER.length];
}

function selectStyle(i) {
  const key = STYLE_ORDER[i];
  if (key && key !== settings.preset) applyStyle(key);
}

// motion recipe buttons
for (const key of MOTION_ORDER) {
  const m = MOTIONS[key];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key-btn';
  b.dataset.motion = key;
  b.textContent = m.label;
  b.setAttribute('aria-pressed', 'false');
  b.setAttribute('aria-label', `${m.name} — ${m.hint}`);
  b.addEventListener('click', () => selectMotion(key));
  els.motions.appendChild(b);
}

function selectMotion(key) {
  if (!MOTIONS[key] || key === settings.motion) return;
  setSetting('motion', key);
  syncUI();
  flash(`${MOTIONS[key].name}`);
}

// ------------------------------------------------------------------ controls

els.materialSel.addEventListener('change', () => {
  setSetting('material', els.materialSel.value);
  if (renderer) renderer.settings = settings;
  flash(`material: ${els.materialSel.value}`);
});
els.familySel.addEventListener('change', () => {
  setSetting('family', els.familySel.value);
  syncUI();
});
els.countIn.addEventListener('input', () => { setSetting('count', Number(els.countIn.value)); syncUI(); });
els.scaleIn.addEventListener('input', () => { setSetting('scale', Number(els.scaleIn.value)); syncUI(); });
els.speedIn.addEventListener('input', () => { setSetting('speed', Number(els.speedIn.value)); syncUI(); });
els.spinIn.addEventListener('input', () => { setSetting('spin', Number(els.spinIn.value)); syncUI(); });
els.spreadIn.addEventListener('input', () => { setSetting('spread', Number(els.spreadIn.value)); syncUI(); });
els.cameraSel.addEventListener('change', () => { setSetting('camera', els.cameraSel.value); applyDisplay(); });
els.trailsIn.addEventListener('change', () => { setSetting('trails', els.trailsIn.checked); applyDisplay(); });
els.starsIn.addEventListener('change', () => { setSetting('stars', els.starsIn.checked); applyDisplay(); });
els.lowResIn.addEventListener('change', () => { setSetting('lowRes', els.lowResIn.checked); applyDisplay(); });
els.scanIn.addEventListener('change', () => { setSetting('scanlines', els.scanIn.checked); applyDisplay(); });
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

// family select options
for (const [key, f] of Object.entries(FAMILIES)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = f.label;
  els.familySel.appendChild(o);
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
  // next deterministic seed, wrapping at the 31-bit max back to 0
  applySeed(world.seed >= 2147483647 ? 0 : world.seed + 1, 'new arrangement');
}

els.seedBtn.addEventListener('click', () => {
  const raw = String(els.seedIn.value).trim();
  const n = Number(raw);
  if (raw === '' || !Number.isInteger(n) || n < 0 || n > 2147483647) {
    flash('seed rejected: integer between 0 and 2147483647');
    return;
  }
  applySeed(n, `seed ${n} applied`);
});

els.newBtn.addEventListener('click', nextPattern);

els.resetBtn.addEventListener('click', () => {
  settings = { ...DEFAULTS }; // full reset — presets and retro switches too
  cycle.reset();
  world.updateSettings(settings);
  if (renderer) renderer.settings = settings;
  applySeed(DEFAULTS.seed, 'defaults restored');
  syncUI();
  applyDisplay();
});

els.viewBtn.addEventListener('click', () => {
  if (renderer) renderer.cam.reset();
  invalidate();
  flash('view reset');
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
  updateToast(); // toast hides with the chrome; expired text stays dead
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
  try {
    const p = document.fullscreenElement
      ? document.exitFullscreen()
      : el.requestFullscreen && el.requestFullscreen();
    if (!p) { flash('fullscreen unavailable'); return; }
    if (p.catch) p.catch(() => flash('fullscreen refused'));
  } catch (err) {
    flash('fullscreen unavailable');
  }
}
document.addEventListener('fullscreenchange', () => {
  if (renderer) renderer.resize();
  invalidate();
});

function snapshot() {
  if (!renderer || renderer.contextLost) return;
  // freeze the name now: a delayed toBlob callback must still name the
  // seed that was on screen when the capture was requested
  const name = `flying-objects-${world.seed}-${Date.now()}.png`;
  try {
    if (paused) world.settleLayout(); // paused layouts still apply now
    renderer.settings = settings;
    renderer.update(world); // commit latest engine state into the frame
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
// `O` must NOT toggle the panel while typing in the seed field.
const TEXT_EDITABLE =
  'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea';
const CONTENT_EDITABLE = '[contenteditable]:not([contenteditable="false"])';
// Space on these is the native activation — leave it alone.
const SPACE_NATIVE = 'button, select, summary, input[type=checkbox], input[type=radio]';

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
      setSetting('camera', settings.camera === 'drift' ? 'fixed' : 'drift');
      applyDisplay();
      syncUI();
      break;
    case 'KeyG':
      setSetting('scanlines', !settings.scanlines);
      applyDisplay();
      syncUI();
      flash(settings.scanlines ? 'scanlines on' : 'scanlines off');
      break;
    case 'KeyQ':
      setSetting('lowRes', !settings.lowRes);
      applyDisplay();
      syncUI();
      flash(settings.lowRes ? 'low-res on' : 'low-res off');
      break;
    case 'BracketLeft': cycleStyle(-1); break;
    case 'BracketRight': cycleStyle(1); break;
    default: {
      const m = /^Digit([1-8])$/.exec(e.code);
      if (m) selectStyle(Number(m[1]) - 1);
      break;
    }
  }
});

window.addEventListener('resize', () => {
  if (renderer) {
    renderer.resize();
    world.setAspect(renderer.camera.aspect);
  }
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
  if (renderer && !renderer.contextLost) {
    // cam.step reports whether the camera actually moved (drag, wheel,
    // auto-drift) so a paused, still scene costs no render at all.
    const camMoved = renderer.cam.step(
      dt, settings.camera === 'drift' && !paused && settings.motion !== 'flowerbox');
    if (!paused) {
      if (cycle.step(dt, settings)) applyStyle(nextPresetKey());
      world.step(dt);
    }
    if (!paused || camMoved || renderDirty) {
      if (paused) world.settleLayout(); // apply pending layout without time
      renderer.settings = settings;
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

if (renderer) world.setAspect(renderer.camera.aspect);
syncUI();
updateStatusLine();
if (loaded.warnings.length) console.warn('FLYING_OBJECTS settings:', loaded.warnings.join('; '));

// diagnostics for smoke tests / tinkering — intentionally small surface
window.FLYING_OBJECTS = {
  version: 1,
  world,
  get settings() { return settings; },
  renderer: renderer || undefined,
  styleCycle: cycle,
  get paused() { return paused; },
  get panelOpen() { return panelOpen; },
  diagnostics: () => ({
    time: world.simTime,
    count: world.count,
    seed: world.seed,
    motion: world.motion,
    family: world.family,
    ...(renderer ? renderer.diagnostics() : {}),
  }),
  selectPreset: (key) => applyStyle(key),
  selectMotion: (key) => selectMotion(key),
  // Deterministic test hook: mirrors the frame() path (cycle pulse before
  // world step) without waiting on wall-clock RAF. Honors the same
  // paused/hidden guards as frame().
  debugStep: (dt) => {
    if (paused || !renderer || renderer.contextLost || document.hidden) return;
    if (cycle.step(dt, settings)) applyStyle(nextPresetKey());
    world.step(dt);
    renderer.settings = settings;
    renderer.update(world);
    renderer.render();
  },
};

requestAnimationFrame(frame);
