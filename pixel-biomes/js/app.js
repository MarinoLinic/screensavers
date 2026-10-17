// BIOME.EXE app: wires the BiomeWorld engine, the Canvas2D renderer,
// the Win95 settings window, persistence and the keyboard map. The scene
// always fills the viewport; the window is a runtime-only overlay that
// never reframes the world.

import { BiomeWorld } from './engine.js';
import { BiomeRenderer } from './renderer.js';
import {
  SPECIES, paintBackdrop, createVegetation, paintVegetation,
} from './art.js';
import { TourCycle } from './cycle.js';
import {
  DEFAULTS, HABITATS, HABITAT_ORDER, BIOMES, BIOME_ORDER, familyOf,
  applyHabitat, loadSettings, saveSettings, validateSettings,
} from './settings.js';

const $ = (id) => document.getElementById(id);

const els = {
  canvas: $('tank'), stage: $('stage'), chrome: $('chrome'), habTag: $('habTag'),
  panel: $('panel'), backdrop: $('backdrop'), panelClose: $('panelClose'),
  keystrip: $('keystrip'), restoreChip: $('restoreChip'), toast: $('toast'),
  kSettings: $('kSettings'), kPause: $('kPause'), kPrev: $('kPrev'), kNext: $('kNext'),
  kSnap: $('kSnap'), kFs: $('kFs'), kHide: $('kHide'),
  habitats: $('habitats'), habHint: $('habHint'),
  biomeSel: $('biomeSel'), tourScopeSel: $('tourScopeSel'), frameRateSel: $('frameRateSel'),
  atmosphereHint: $('atmosphereHint'),
  popIn: $('popIn'), popOut: $('popOut'), communitySel: $('communitySel'),
  communityHint: $('communityHint'), visitorsIn: $('visitorsIn'),
  visitorsLabel: $('visitorsLabel'),
  speedIn: $('speedIn'), speedOut: $('speedOut'),
  raysIn: $('raysIn'), bubblesIn: $('bubblesIn'), planktonIn: $('planktonIn'),
  vegIn: $('vegIn'), scanIn: $('scanIn'), pixelSel: $('pixelSel'),
  raysLabel: $('raysLabel'), bubblesLabel: $('bubblesLabel'),
  planktonLabel: $('planktonLabel'), vegLabel: $('vegLabel'),
  desertLightField: $('desertLightField'), desertLightSel: $('desertLightSel'),
  autoCycleIn: $('autoCycleIn'), cycleIntervalSel: $('cycleIntervalSel'),
  seedIn: $('seedIn'), seedBtn: $('seedBtn'), newBtn: $('newBtn'),
  resetBtn: $('resetBtn'),
};

const isLand = (habitat) => HABITATS[habitat]?.kind !== 'water';

// Labels that read differently on land vs underwater.
const LAND_LABELS = {
  rays: 'Sun glare', bubbles: 'Wind gusts', plankton: 'Dust motes',
  vegetation: 'Cacti & scrub', visitors: 'Visitors (fox & camel)',
  tap: 'Tap to raise a dust gust.',
};
const WATER_LABELS = {
  rays: 'Light rays', bubbles: 'Bubbles', plankton: 'Plankton motes',
  vegetation: 'Foreground vegetation', visitors: 'Visitors (turtle & ray)',
  tap: 'Tap the water for a bubble burst.',
};

// ------------------------------------------------------------------ state

const loaded = loadSettings();
let settings = loaded.settings;
const familySelections = new Map();

// ?habitat=<id> picks the startup biome in memory only — never persisted.
{
  const want = new URLSearchParams(location.search).get('habitat');
  if (want && Object.hasOwn(HABITATS, want) && want !== settings.habitat) {
    settings = { ...settings, habitat: want };
  }
}
familySelections.set(familyOf(settings.habitat), settings.habitat);

const reduceMotion = typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new BiomeRenderer(els.canvas, settings);
const world = new BiomeWorld(settings, renderer.logicalW, renderer.logicalH, SPECIES);
world.setSpriteMetrics(renderer.metrics);

let paused = false;        // runtime-only, never persisted
let panelOpen = false;     // runtime-only, never persisted
let chromeHidden = false;  // explicit H hide, runtime-only
let renderDirty = true;
const invalidate = () => { renderDirty = true; };
const cycle = new TourCycle();

let toastTimer = 0;
let statusFlash = { text: null, until: 0 };

// Chrome auto-fades after 8s of stillness; any pointer/keyboard nudge wakes it.
const IDLE_MS = 8000;
let lastActivity = performance.now();

function flash(text) {
  statusFlash = { text, until: performance.now() + 2600 };
  updateToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(updateToast, 2650);
}

function updateToast() {
  const alive = statusFlash.until > performance.now();
  if (alive && !chromeHidden) {
    els.toast.textContent = statusFlash.text;
    els.toast.hidden = false;
  } else {
    els.toast.hidden = true;
  }
}

if (reduceMotion) paused = true; // in-memory only; nothing persisted

// ------------------------------------------------------------------ UI sync

function setText(el, v) {
  if (el.textContent !== v) el.textContent = v;
}

function syncUI() {
  els.popIn.value = settings.population;
  setText(els.popOut, String(settings.population));
  els.communitySel.value = settings.community;
  els.visitorsIn.checked = settings.visitors;
  els.speedIn.value = settings.speed;
  setText(els.speedOut, `${Number(settings.speed).toFixed(2)}×`);
  els.raysIn.checked = settings.sunRays;
  els.bubblesIn.checked = settings.bubbles;
  els.planktonIn.checked = settings.plankton;
  els.vegIn.checked = settings.vegetation;
  els.scanIn.checked = settings.scanlines;
  els.pixelSel.value = String(settings.pixelSize);
  els.desertLightSel.value = settings.desertLight;
  els.autoCycleIn.checked = settings.autoCycle;
  els.cycleIntervalSel.value = String(settings.cycleInterval);
  els.cycleIntervalSel.disabled = !settings.autoCycle;
  els.tourScopeSel.value = settings.tourScope;
  els.tourScopeSel.disabled = !settings.autoCycle;
  els.frameRateSel.value = String(settings.frameRate);
  els.seedIn.value = settings.seed;
  els.kPause.setAttribute('aria-pressed', String(paused));
  setText(els.kPause.lastChild, paused ? ' Resume' : ' Pause');
  syncHabitatUI();
}

function syncHabitatUI() {
  const land = isLand(settings.habitat);
  const habitat = settings.habitat, family = familyOf(habitat);
  const wet = ['river','mediterranean','tropical'].includes(family);
  const moon = habitat==='moon';
  const L = land ? {...LAND_LABELS,
    vegetation:habitat==='desert'?'Cacti & scrub':wet?'Reeds & seagrass':'Foreground plants',
    plankton:habitat==='tundra'?'Snow flurries':wet?'Drifting motes':moon?'No atmosphere':'Pollen & motes',
    bubbles:wet?'Surface ripples':'Wind gusts',
    rays:moon?'No sunlight effects':wet?'Light on the water':habitat==='jungle'||habitat==='forest'?'Light shafts':'Sun glare',
    visitors:habitat==='desert'?'Visitors (fox & camel)':family==='forest'?'Visitors (deer & fox)':family==='tundra'?'Visitors (fox & caribou)':family==='steppe'?'Visitors (saiga)':family==='river'?'Visitors (otter)':family==='mediterranean'?'Visitors (dolphin)':family==='tropical'?'Visitors (turtle & dolphin)':moon?'Visitors (astronaut)':'Occasional visitors',
    tap:moon?'Tap to lift lunar dust.':wet?'Tap the water for a splash.':'Tap to stir the air.',
  } : WATER_LABELS;
  els.biomeSel.value = family;
  for (const b of els.habitats.querySelectorAll('.hab-btn')) {
    b.setAttribute('aria-pressed', String(b.dataset.habitat === habitat));
    b.hidden = familyOf(b.dataset.habitat)!==family;
  }
  const scenes=BIOMES[family].scenes;
  const i=scenes.indexOf(habitat);
  setText(els.habTag, `${BIOMES[family].label.toUpperCase()} / ${HABITATS[habitat].label.toUpperCase()}${scenes.length>1?` · ${i+1}/${scenes.length}`:''}`);
  setText(els.habHint, HABITATS[habitat].blurb + '.');
  // Community is an aquatic concept — on land it stays saved but inert,
  // and the panel says so instead of pretending the select does anything.
  els.communitySel.disabled = land;
  els.communityHint.hidden = !land;
  const hasVisitors=Object.values(SPECIES).some(r=>r.role==='visitor'&&r.habitats.includes(habitat));
  els.visitorsIn.disabled=!hasVisitors;
  if(!hasVisitors) L.visitors='Visitors (none in this scene)';
  els.raysIn.disabled=moon;
  els.bubblesIn.disabled=moon;
  els.planktonIn.disabled=moon;
  els.vegIn.disabled=moon;
  els.atmosphereHint.hidden=!moon;
  setText(els.visitorsLabel, L.visitors);
  setText(els.raysLabel, L.rays);
  setText(els.bubblesLabel, L.bubbles);
  setText(els.planktonLabel, L.plankton);
  setText(els.vegLabel, L.vegetation);
  els.desertLightField.hidden = habitat !== 'desert';
  els.canvas.setAttribute('aria-label',
    `Animated pixel-art ${HABITATS[settings.habitat].label} scene. ${L.tap}`);
}

// ------------------------------------------------------------------ settings

function persist() {
  saveSettings(settings);
}

function setSetting(key, value) {
  settings = validateSettings({ ...settings, [key]: value }).settings;
  world.updateSettings(settings);
  renderer.setSettings(settings);
  if (renderer.logicalW !== world.width || renderer.logicalH !== world.height) {
    world.setSize(renderer.logicalW, renderer.logicalH);
  }
  persist();
  syncUI();
  if(panelOpen) paintThumbs();
  invalidate();
}

/** Habitat pick: swaps backdrop + population layout, keeps every other
    setting and the world clock. */
function selectHabitat(key, announce = true) {
  if (!Object.hasOwn(HABITATS, key) || key === settings.habitat) return;
  settings = applyHabitat(settings, key);
  familySelections.set(familyOf(key),key);
  world.updateSettings(settings);
  renderer.setSettings(settings);
  persist();
  cycle.reset();
  syncUI();
  if(panelOpen) paintThumbs();
  invalidate();
  if (announce) flash(HABITATS[key].label);
}

function cycleHabitat(step) {
  const i = HABITAT_ORDER.indexOf(settings.habitat);
  selectHabitat(HABITAT_ORDER[(i + step + HABITAT_ORDER.length) % HABITAT_ORDER.length]);
}

function nextHabitatKey() {
  const family=familyOf(settings.habitat);
  if(settings.tourScope==='family') {
    const scenes=BIOMES[family].scenes;
    return scenes[(scenes.indexOf(settings.habitat)+1)%scenes.length];
  }
  if(settings.tourScope==='biomes') {
    const next=BIOME_ORDER[(BIOME_ORDER.indexOf(family)+1)%BIOME_ORDER.length];
    const scenes=BIOMES[next].scenes,previous=familySelections.get(next);
    return scenes[previous?(scenes.indexOf(previous)+1)%scenes.length:0];
  }
  const i = HABITAT_ORDER.indexOf(settings.habitat);
  return HABITAT_ORDER[(i + 1) % HABITAT_ORDER.length];
}

function selectFamily(family) {
  if(!BIOMES[family]) return;
  selectHabitat(familySelections.get(family)||BIOMES[family].scenes[0]);
}
for(const family of BIOME_ORDER) {
  const option=document.createElement('option');
  option.value=family;
  option.textContent=`${(BIOME_ORDER.indexOf(family)+1)%10}. ${BIOMES[family].label} · ${BIOMES[family].scenes.length} ${BIOMES[family].scenes.length===1?'scene':'scenes'}`;
  els.biomeSel.appendChild(option);
}
els.biomeSel.addEventListener('change',()=>selectFamily(els.biomeSel.value));
els.tourScopeSel.addEventListener('change',()=>{setSetting('tourScope',els.tourScopeSel.value);cycle.reset();});
els.frameRateSel.addEventListener('change',()=>setSetting('frameRate',Number(els.frameRateSel.value)));

// ------------------------------------------------------------ habitat cards

const THUMB_W = 160, THUMB_H = 100;
for (const key of HABITAT_ORDER) {
  const h = HABITATS[key];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hab-btn' + (BIOMES[familyOf(key)].scenes.length===1 ? ' wide' : '');
  b.dataset.habitat = key;
  b.setAttribute('aria-pressed', 'false');
  b.setAttribute('aria-label', `${h.label} habitat — ${h.blurb}`);
  const c = document.createElement('canvas');
  c.width = THUMB_W; c.height = THUMB_H;
  const name = document.createElement('span');
  name.className = 'hname';
  name.textContent = h.label;
  b.appendChild(c);
  b.appendChild(name);
  b.addEventListener('click', () => selectHabitat(key));
  els.habitats.appendChild(b);
}

// Thumbnails preview the real scene: full 480x300 artwork (backdrop +
// vegetation) downsampled nearest-neighbour onto the small card canvas.
const thumbSrc = document.createElement('canvas');
thumbSrc.width = 480; thumbSrc.height = 300;

function paintThumbs() {
  for (const b of els.habitats.querySelectorAll('.hab-btn')) {
    if(b.hidden) continue;
    const habitat = b.dataset.habitat;
    const thumbKey=`${habitat}|${world.seed}|${habitat==='desert'?settings.desertLight:''}`;
    if(b.dataset.thumbKey===thumbKey) continue;
    const sctx = thumbSrc.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    const opts = { desertLight: settings.desertLight };
    paintBackdrop(sctx, thumbSrc.width, thumbSrc.height, habitat, world.seed, opts);
    paintVegetation(sctx,
      createVegetation(thumbSrc.width, thumbSrc.height, habitat, world.seed, opts), 3.2);
    const c = b.querySelector('canvas');
    const cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(thumbSrc, 0, 0, c.width, c.height);
    b.dataset.thumbKey=thumbKey;
  }
}

// ------------------------------------------------------------------ panel

function setPanel(open) {
  if (open === panelOpen) return;
  panelOpen = open;
  els.panel.hidden = !open;
  els.panel.inert = !open;
  els.backdrop.hidden = !open;
  // the whole backdrop of chrome is inert while the dialog is up
  els.stage.inert = open;
  els.chrome.inert = open;
  els.keystrip.inert = open;
  els.restoreChip.inert = open;
  if (open) {
    paintThumbs();
    els.panelClose.focus();
  } else {
    els.canvas.focus({ preventScroll: true });
  }
  lastActivity = performance.now();
}

els.panelClose.addEventListener('click', () => setPanel(false));
els.backdrop.addEventListener('click', () => setPanel(false));

// Focus trap + recovery inside the dialog.
els.panel.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = [...els.panel.querySelectorAll(
    'button, select, input, summary, [tabindex]'
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

// ------------------------------------------------------------------ controls

els.popIn.addEventListener('input', () => setSetting('population', Number(els.popIn.value)));
els.communitySel.addEventListener('change', () => setSetting('community', els.communitySel.value));
els.visitorsIn.addEventListener('change', () => setSetting('visitors', els.visitorsIn.checked));
els.speedIn.addEventListener('input', () => setSetting('speed', Number(els.speedIn.value)));
els.raysIn.addEventListener('change', () => setSetting('sunRays', els.raysIn.checked));
els.bubblesIn.addEventListener('change', () => setSetting('bubbles', els.bubblesIn.checked));
els.planktonIn.addEventListener('change', () => setSetting('plankton', els.planktonIn.checked));
els.vegIn.addEventListener('change', () => setSetting('vegetation', els.vegIn.checked));
els.scanIn.addEventListener('change', () => setSetting('scanlines', els.scanIn.checked));
els.pixelSel.addEventListener('change', () => {
  setSetting('pixelSize', Number(els.pixelSel.value));
  world.setSize(renderer.logicalW, renderer.logicalH);
});
els.autoCycleIn.addEventListener('change', () => {
  setSetting('autoCycle', els.autoCycleIn.checked);
  cycle.reset();
});
els.cycleIntervalSel.addEventListener('change', () => {
  setSetting('cycleInterval', Number(els.cycleIntervalSel.value));
  cycle.reset();
});
els.desertLightSel.addEventListener('change', () => {
  setSetting('desertLight', els.desertLightSel.value);
  if (panelOpen) paintThumbs(); // desert thumb follows the light pick
});

function applySeed(seed, announce) {
  const { settings: clean } = validateSettings({ ...settings, seed });
  settings = clean;
  world.reseed(settings.seed);
  renderer.setSettings(settings); // backdrop cache keys on seed — refresh it
  persist();
  syncUI();
  paintThumbs();
  invalidate();
  flash(announce);
}

function nextPattern() {
  applySeed(world.seed >= 2147483647 ? 0 : world.seed + 1, 'new arrangement');
}

els.seedBtn.addEventListener('click', () => {
  const raw = String(els.seedIn.value).trim();
  const n = Number(raw);
  if (raw === '' || !Number.isInteger(n) || n < 0 || n > 2147483647) {
    flash('seed rejected: integer 0-2147483647');
    return;
  }
  applySeed(n, `seed ${n} applied`);
});

els.newBtn.addEventListener('click', nextPattern);

els.resetBtn.addEventListener('click', () => {
  settings = { ...DEFAULTS };
  familySelections.clear();
  familySelections.set(familyOf(settings.habitat),settings.habitat);
  cycle.reset();
  world.updateSettings(settings);
  renderer.setSettings(settings);
  world.setSize(renderer.logicalW, renderer.logicalH);
  applySeed(DEFAULTS.seed, 'defaults restored');
});

function setPaused(v) {
  paused = v;
  els.kPause.setAttribute('aria-pressed', String(paused));
  setText(els.kPause.lastChild, paused ? ' Resume' : ' Pause');
  invalidate();
}

function setChromeHidden(hidden) {
  chromeHidden = hidden;
  els.chrome.hidden = hidden;
  els.keystrip.hidden = hidden;
  els.restoreChip.hidden = !hidden;
  updateToast();
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

els.restoreChip.addEventListener('click', () => setChromeHidden(false));

function toggleFullscreen() {
  const el = document.documentElement;
  try {
    const p = document.fullscreenElement
      ? document.exitFullscreen()
      : el.requestFullscreen && el.requestFullscreen();
    if (!p) { flash('fullscreen unavailable'); return; }
    if (p.catch) p.catch(() => flash('fullscreen refused'));
  } catch {
    flash('fullscreen unavailable');
  }
}
document.addEventListener('fullscreenchange', () => {
  if (renderer.resize()) world.setSize(renderer.logicalW, renderer.logicalH);
  invalidate();
});

function snapshot() {
  // freeze the name now: a delayed toBlob must still name what was on screen
  const name = `biome-${settings.habitat}-${world.seed}-${Date.now()}.png`;
  try {
    renderer.render(world); // explicit frame so even a paused tank is fresh
  } catch {
    flash('snapshot failed');
    return;
  }
  try {
    renderer.snapshotCanvas().toBlob((blob) => {
      let url = null;
      try {
        if (!blob) throw new Error('empty blob');
        url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        flash('snapshot saved');
      } catch {
        flash('snapshot failed');
      } finally {
        if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    }, 'image/png');
  } catch {
    flash('snapshot failed');
  }
}

els.kSettings.addEventListener('click', () => setPanel(!panelOpen));
els.kPause.addEventListener('click', () => setPaused(!paused));
els.kPrev.addEventListener('click', () => cycleHabitat(-1));
els.kNext.addEventListener('click', () => cycleHabitat(1));
els.kSnap.addEventListener('click', snapshot);
els.kFs.addEventListener('click', toggleFullscreen);
els.kHide.addEventListener('click', toggleChromeHidden);

// -------------------------------------------------------------- tank input

// Tap the water: bubble burst + a ripple of fish interest.
els.canvas.addEventListener('pointerdown', (e) => {
  const rect = els.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((e.clientX - rect.left) / rect.width) * renderer.logicalW;
  const y = ((e.clientY - rect.top) / rect.height) * renderer.logicalH;
  world.burst(x, y);
  invalidate();
});

// ------------------------------------------------------------------ keyboard

// Text-editing targets swallow every key except Escape (native editing wins);
// `O` must NOT toggle the panel while typing in the seed field.
const TEXT_EDITABLE =
  'input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea';
const CONTENT_EDITABLE = '[contenteditable]:not([contenteditable="false"])';
// Space on these is the native activation — leave it alone.
const SPACE_NATIVE = 'button, select, input[type=checkbox], input[type=radio], summary';

function wake() {
  lastActivity = performance.now();
  if (!chromeHidden) document.body.classList.remove('idle');
}
for (const ev of ['pointermove', 'pointerdown', 'wheel', 'touchstart', 'keydown']) {
  window.addEventListener(ev, wake, { passive: true });
}

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
    case 'KeyS': snapshot(); break;
    case 'KeyF': toggleFullscreen(); break;
    case 'KeyH': toggleChromeHidden(); break;
    case 'ArrowLeft':
      if(panelOpen) return;
      e.preventDefault(); cycleHabitat(-1); break;
    case 'ArrowRight':
      if(panelOpen) return;
      e.preventDefault(); cycleHabitat(1); break;
    case 'BracketLeft':
    case 'KeyP': cycleHabitat(-1); break;
    case 'BracketRight':
    case 'KeyN': cycleHabitat(1); break;
    case 'KeyB': selectFamily(BIOME_ORDER[(BIOME_ORDER.indexOf(familyOf(settings.habitat))+1)%BIOME_ORDER.length]); break;
    default: {
      const m = /^Digit([0-9])$/.exec(e.code);
      if (m) selectFamily(BIOME_ORDER[(Number(m[1])+9)%10]);
      break;
    }
  }
});

window.addEventListener('resize', () => {
  if (renderer.resize()) world.setSize(renderer.logicalW, renderer.logicalH);
  invalidate();
});

// ------------------------------------------------------------------ loop

// Tab-return guard: don't let elapsed time jump the simulation forward, and
// do zero work while the page is hidden.
let last = performance.now();
let lastPaint=0;
document.addEventListener('visibilitychange', () => { last = performance.now(); });

function frame(now) {
  const elapsed = Math.max(0,(now-last)/1000);
  const dt = Math.min(elapsed, 0.1);
  last = now;
  if (!document.hidden) {
    if (!paused) {
      // tour runs on real active time, independent of sim speed
      if (cycle.step(elapsed, settings)) selectHabitat(nextHabitatKey());
      world.step(dt);
      if(renderDirty || now-lastPaint>=1000/settings.frameRate-.5) {
        renderer.render(world);
        lastPaint=now;
        renderDirty = false;
      }
    } else if (renderDirty) {
      renderer.render(world);
      renderDirty = false;
    }
    // chrome auto-fade
    const idle = !panelOpen && !chromeHidden && (now - lastActivity > IDLE_MS);
    document.body.classList.toggle('idle', idle);
  }
  requestAnimationFrame(frame);
}

syncUI();
if (loaded.warnings.length) console.warn('BIOME settings:', loaded.warnings.join('; '));

// diagnostics for smoke tests / tinkering — intentionally small surface;
// TIDAL kept as an alias for anything built against the aquatic era.
window.BIOME = window.TIDAL = {
  version: 1,
  world,
  renderer,
  get settings() { return { ...settings }; }, // a copy — no mutation leaks
  get paused() { return paused; },
  get panelOpen() { return panelOpen; },
  diagnostics: () => ({
    time: world.simTime,
    count: world.count,
    seed: world.seed,
    habitat: world.habitat,
    ...renderer.diagnostics(),
  }),
  selectHabitat: (key) => selectHabitat(key),
  setSetting: (key, value) => setSetting(key, value),
  // Deterministic test hook: mirrors the frame() path (tour pulse before
  // world step) without waiting on wall-clock RAF. Honors the same
  // paused/hidden guards as frame().
  debugStep: (dt) => {
    if (paused || document.hidden) return;
    if (cycle.step(dt, settings)) selectHabitat(nextHabitatKey());
    world.step(dt);
    renderer.render(world);
  },
};

requestAnimationFrame(frame);
