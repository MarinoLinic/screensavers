// UI behaviour tests for 3D Maze: drives the real game.js against a minimal
// DOM stub so keyboard handling, modals, HUD, feed and autoplay wiring are
// exercised end to end. No dependencies.
//   node tests/ui.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let failures = 0;
const fail = msg => { failures += 1; console.log('FAIL  ' + msg); };
const ok = (cond, msg) => { if (!cond) fail(msg); };

// ---------- DOM stub ----------

const makeHarness = storageSeed => {
  const elements = {};
  const winListeners = {};
  const docListeners = {};
  let rafCb = null;
  let now = 0;
  const calls = {
    pointerLock: 0, audioUnlock: 0,
    toBlob: 0, downloads: [], revoked: [], objectUrls: 0,
  };

  const makeEl = (tag = 'div') => {
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      parentNode: null,
      attributes: {},
      style: {
        setProperty(k, v) { this[k] = String(v); },
      },
      rect: { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 },
      value: '',
      selectedIndex: -1,
      focused: false,
      scrolled: false,
      offsetWidth: 0,
      isContentEditable: false,
      listeners: {},
      _text: '',
    };
    el.classList = {
      _s: new Set(),
      add(...cs) { cs.forEach(c => this._s.add(c)); },
      remove(...cs) { cs.forEach(c => this._s.delete(c)); },
      toggle(c, force) {
        const on = force === undefined ? !this._s.has(c) : force;
        if (on) this._s.add(c); else this._s.delete(c);
        return on;
      },
      contains(c) { return this._s.has(c); },
    };
    Object.defineProperty(el, 'textContent', {
      get() { return el._text; },
      set(v) { el._text = String(v); el.children.length = 0; },
    });
    Object.defineProperty(el, 'options', { get() { return el.children; } });
    Object.defineProperty(el, 'firstChild', {
      get() { return el.children[0] || null; },
    });
    el.setAttribute = (k, v) => { el.attributes[k] = String(v); };
    el.getAttribute = k => el.attributes[k];
    el.addEventListener = (t, f) => {
      (el.listeners[t] = el.listeners[t] || []).push(f);
    };
    el.removeEventListener = (t, f) => {
      const a = el.listeners[t] || [];
      const i = a.indexOf(f);
      if (i >= 0) a.splice(i, 1);
    };
    el.dispatchEvent = (t, e = {}) => {
      e.type = e.type || t;
      e.target = e.target || el;
      e.preventDefault = e.preventDefault || function () { this.defaultPrevented = true; };
      (el.listeners[t] || []).slice().forEach(f => f(e));
    };
    el.appendChild = c => { c.parentNode = el; el.children.push(c); return c; };
    el.removeChild = c => {
      const i = el.children.indexOf(c);
      if (i >= 0) { el.children.splice(i, 1); c.parentNode = null; }
      return c;
    };
    el.remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    el.focus = () => { el.focused = true; document.activeElement = el; };
    el.blur = () => { el.focused = false; };
    el.click = () => el.dispatchEvent('click');
    el.scrollIntoView = () => { el.scrolled = true; };
    el.getBoundingClientRect = () => el.rect;
    return el;
  };

  const document = {
    hidden: false,
    pointerLockElement: null,
    fullscreenElement: null,
    activeElement: null,
    documentElement: makeEl('html'),
    body: makeEl('body'),
    getElementById: id => elements[id] || (elements[id] = makeEl('div')),
    createElement: tag => {
      const el = makeEl(tag);
      // Anchors record the download the game asks the browser to perform.
      if (String(tag).toLowerCase() === 'a') {
        el.click = () => {
          if (calls.anchorThrow) {
            calls.anchorThrow = false;
            throw new Error('anchor click refused');
          }
          calls.downloads.push({ href: el.href, name: el.download });
        };
      }
      return el;
    },
    querySelectorAll: () => [],
    addEventListener: (t, f) => {
      (docListeners[t] = docListeners[t] || []).push(f);
    },
    removeEventListener: () => {},
    exitPointerLock() { document.pointerLockElement = null; },
  };

  const store = { ...(storageSeed || {}) };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };

  const window = {
    innerWidth: 1280,
    innerHeight: 720,
    document,
    localStorage,
    addEventListener: (t, f) => {
      (winListeners[t] = winListeners[t] || []).push(f);
    },
    removeEventListener: () => {},
  };

  const canvas = document.getElementById('c');
  canvas.requestPointerLock = () => {
    calls.pointerLock += 1;
    document.pointerLockElement = canvas;
    return { catch() {} };
  };
  // PNG export stub: tests drive the blob result to cover success, null
  // blob, deferred-resolution and guard paths.
  let blobResult = { type: 'image/png', size: 4321 };
  let blobDefer = false;
  const blobCbs = [];
  canvas.toBlob = cb => {
    calls.toBlob += 1;
    if (blobDefer) blobCbs.push(cb);
    else cb(blobResult);
  };
  elements['level-select'] = makeEl('section');
  elements['level-select'].classList.add('hidden');
  elements['level-notes'] = makeEl('section');
  elements['level-notes'].classList.add('hidden');
  elements['intro'] = makeEl('section');

  // Touch pad buttons matching index.html's data-action layout so the
  // InputController binds real press/release handlers under test.
  const touchButtons = {};
  ['strafe-left', 'left', 'right', 'strafe-right', 'forward', 'backward']
    .forEach(action => {
      const b = makeEl('button');
      b.setAttribute('data-action', action);
      b.setPointerCapture = () => {};
      touchButtons[action] = b;
    });
  document.querySelectorAll = sel =>
    (sel === '[data-action]' ? Object.values(touchButtons) : []);

  const sandbox = {
    console,
    window,
    document,
    LEVELS: [],
    setTimeout,
    clearTimeout,
    performance: { now: () => now },
    requestAnimationFrame: cb => { rafCb = cb; return 1; },
    URL: {
      createObjectURL() {
        if (calls.urlThrow) {
          calls.urlThrow = false;
          throw new Error('object URL refused');
        }
        calls.objectUrls += 1;
        return `blob:mock-${calls.objectUrls}`;
      },
      revokeObjectURL(u) { calls.revoked.push(u); },
    },
  };
  sandbox.window.Maze3D = sandbox.Maze3D = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Minimal ResizeObserver stub so game.js takes the observed path; tests
  // can also fire window resize for the fallback path.
  const roInstances = [];
  sandbox.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; roInstances.push(this); }
    observe(el) { this.targets.push(el); }
    unobserve() {}
    disconnect() {}
  };

  const load = rel => vm.runInContext(
    fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });

  for (let i = 1; i <= 50; i += 1) load(`levels/level${i}.js`);
  ['js/config.js', 'js/settings.js', 'js/audio.js', 'js/input.js',
    'js/autopilot.js', 'js/interactions.js', 'js/entities.js'].forEach(load);

  // Texture + renderer stubs: the UI under test never renders pixels.
  const M = sandbox.Maze3D;
  const fakeImage = { width: 1, height: 1 };
  const fakeTextures = {
    walls: {}, floors: {}, ceilings: {}, relics: {},
    creatures: { rat: [fakeImage] },
    exit: fakeImage, inversion: fakeImage,
  };
  M.createTextures = () => fakeTextures;
  M.enrichTextures = t => t;
  M.expandTextures = t => t;
  M.expandCivilizationTextures = t => t;
  M.expandAestheticTextures = t => t;
  M.installLevelTextureVariants = t => t;
  M.Renderer = class {
    constructor(c, t, cfg, opts) {
      this.state = null;
      this.opts = opts || {};
      this.lowResCalls = [];
    }
    resize() {}
    setLevel() {}
    setLowRes(v) { this.lowResCalls.push(!!v); this.lowRes = !!v; }
    render(state) { this.state = state; }
  };
  const AudioProto = M.AudioEngine.prototype;
  const origUnlock = AudioProto.unlock;
  AudioProto.unlock = function () {
    calls.audioUnlock += 1;
    return origUnlock.apply(this, arguments);
  };

  load('game.js');

  const fireKey = (code, opts = {}) => {
    const event = {
      code,
      repeat: !!opts.repeat,
      ctrlKey: !!opts.ctrlKey,
      altKey: !!opts.altKey,
      metaKey: !!opts.metaKey,
      target: opts.target || { tagName: 'BODY' },
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    (winListeners.keydown || []).forEach(f => f(event));
    return event;
  };
  const fireKeyUp = code => {
    (winListeners.keyup || []).forEach(f => f({ code }));
  };
  const pump = ms => {
    const frames = Math.max(1, Math.round(ms / 16));
    for (let i = 0; i < frames; i += 1) {
      now += 16;
      const cb = rafCb;
      if (cb) cb(now);
    }
  };
  const fireResize = () => {
    (winListeners.resize || []).forEach(f => f({ type: 'resize' }));
  };
  const triggerObservers = () => {
    roInstances.forEach(ro => ro.cb([], ro));
  };
  const fireMouseMove = ev => {
    (winListeners.mousemove || []).forEach(f => f(ev));
  };
  const fireMouseDown = ev => {
    (canvas.listeners.mousedown || []).forEach(f => f(ev));
  };
  const fireMouseUp = () => {
    (winListeners.mouseup || []).forEach(f => f({}));
  };
  const fireTouch = (action, type = 'pointerdown') => {
    touchButtons[action].dispatchEvent(type, { pointerId: 1 });
  };

  return {
    sandbox, document, window, elements, calls, store, touchButtons,
    fireKey, fireKeyUp, fireResize, triggerObservers, pump, roInstances,
    fireMouseMove, fireMouseDown, fireMouseUp, fireTouch,
    setBlobResult: v => { blobResult = v; },
    setBlobDefer: v => { blobDefer = v; },
    flushBlobs: () => { while (blobCbs.length) blobCbs.shift()(blobResult); },
    newGame: () => new sandbox.Maze3D.Game(),
  };
};

const readStore = h =>
  JSON.parse(h.store['maze3d.settings.v1'] || '{}');

// ---------- Tests ----------

// 1. Fresh game: intro visible, world paused until enter.
{
  const h = makeHarness();
  const g = h.newGame();
  ok(!g.started, 'fresh game should not start');
  ok(!h.elements.intro.classList.contains('hidden'), 'intro should be visible');
  h.pump(500);
  ok(g.elapsed === 0, 'world should be paused behind the intro');
  ok(g.input.suspended, 'input suspended while intro open');
}

// 2. Persisted auto boots straight in: no intro, no pointer lock, no audio
// unlock (no user gesture yet).
{
  const h = makeHarness({ 'maze3d.settings.v1': JSON.stringify({ auto: true }) });
  const g = h.newGame();
  ok(g.started, 'persisted auto should auto-start');
  ok(h.elements.intro.classList.contains('hidden'), 'intro hidden on auto boot');
  ok(h.calls.pointerLock === 0, 'pointer lock requested without gesture');
  ok(h.calls.audioUnlock === 0, 'audio unlocked without gesture');
  ok(g.auto === true, 'auto flag restored');
}

// 3. T turns auto on and dismisses the intro automatically.
{
  const h = makeHarness();
  const g = h.newGame();
  h.fireKey('KeyT');
  ok(g.auto === true, 'T should enable auto');
  ok(g.started, 'T should dismiss the intro');
  ok(h.elements.intro.classList.contains('hidden'), 'intro hidden after T');
  ok(h.calls.audioUnlock === 1, 'T gesture unlocks audio exactly once');
  ok(h.calls.pointerLock === 0, 'auto must not request pointer lock');
  ok(h.document.pointerLockElement === null, 'no lock held when auto engages');
  ok(readStore(h).auto === true, 'auto persisted');
}

// 4. Manual Enter still enters and takes pointer lock + audio gesture.
{
  const h = makeHarness();
  const g = h.newGame();
  h.fireKey('Enter');
  ok(g.started, 'Enter should start the game');
  ok(h.calls.pointerLock === 1, 'manual enter should request pointer lock');
  ok(h.calls.audioUnlock === 1, 'manual enter should unlock audio');
}

// 5. U toggles the brain and persists; mode works while auto is off too.
{
  const h = makeHarness();
  const g = h.newGame();
  ok(g.autoSmart === true, 'autoSmart defaults to true');
  h.fireKey('KeyU');
  ok(g.autoSmart === false, 'U toggles brain to wander');
  ok(g.ui.autoBrainButton.textContent.includes('WANDER'), 'brain label updates');
  ok(readStore(h).autoSmart === false, 'brain persisted');
  const g2 = makeHarness({
    'maze3d.settings.v1': JSON.stringify({ autoSmart: false }),
  }).newGame();
  ok(g2.autoSmart === false, 'autoSmart persisted across instances');
}

// 6. H hides all HUD, is never persisted, and new games restore it.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  h.fireKey('KeyM');
  ok(g.showMap === true, 'M enables minimap');
  h.pump(50);
  ok(g.renderer.state.showMap === true, 'minimap renders when on');
  h.fireKey('KeyH');
  ok(g.showHUD === false, 'H hides HUD');
  ok(h.document.body.classList.contains('hud-off'), 'hud-off class applied');
  h.pump(50);
  ok(g.renderer.state.showMap === false, 'minimap suppressed with HUD off');
  ok(!('showHUD' in readStore(h)), 'showHUD must not persist');
  // A fresh Game in the same document must visibly restore the HUD even
  // while hud-off is still on <body> from the previous instance.
  const g3 = h.newGame();
  ok(g3.showHUD === true, 'new game always shows HUD');
  ok(!h.document.body.classList.contains('hud-off'),
    'new game clears hud-off in the same document');
}

// 7. Level picker: arrows move/repeat/clamp with focus, Enter + dblclick load.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  h.fireKey('KeyL');
  ok(g.levelSelectOpen, 'L opens picker');
  ok(h.elements['level-list'].focused, 'picker focuses the list');
  ok(g.input.suspended, 'gameplay input suspended in picker');

  h.fireKey('ArrowDown');
  ok(h.elements['level-list'].value === '1', 'arrow down moves selection');
  h.fireKey('ArrowDown', { repeat: true });
  ok(h.elements['level-list'].value === '2', 'held arrow repeats');
  h.fireKey('ArrowUp', { repeat: true });
  ok(h.elements['level-list'].value === '1', 'held arrow up repeats');
  h.fireKey('End');
  ok(h.elements['level-list'].value === '49', 'End jumps to last');
  h.fireKey('ArrowDown');
  ok(h.elements['level-list'].value === '49', 'selection clamps at end');
  h.fireKey('Home');
  ok(h.elements['level-list'].value === '0', 'Home jumps to first');

  const px = g.player.x;
  const py = g.player.y;
  h.fireKey('KeyW');
  h.pump(200);
  ok(g.player.x === px && g.player.y === py, 'no movement while picking');
  ok(!g.input.keys.has('KeyW'), 'suspended input ignores gameplay keys');

  h.elements['level-list'].value = '7';
  h.elements['level-list'].dispatchEvent('dblclick');
  ok(g.levelIndex === 7, 'double click loads the sector');
  ok(!g.levelSelectOpen, 'picker closes after load');

  g.openLevelSelect();
  h.elements['level-list'].value = '3';
  const before = g.levelIndex;
  h.elements['level-list'].dispatchEvent('click');
  ok(g.levelIndex === before && g.levelSelectOpen,
    'single click only highlights, does not load');
  h.fireKey('Enter');
  ok(g.levelIndex === 3, 'Enter loads highlighted sector');
  ok(!g.levelSelectOpen, 'picker closes after Enter');

  g.openLevelSelect();
  h.fireKey('Escape');
  ok(!g.levelSelectOpen, 'Escape closes picker');
}

// 8. Notes dialog: real metadata, world paused, Escape/B/button close.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  h.pump(100);
  h.fireKey('KeyB');
  ok(g.notesOpen, 'B opens notes');
  ok(h.elements['notes-title'].textContent.includes('RED BRICK RUN'),
    'notes show the level name');
  ok(h.elements['notes-setting'].textContent === h.sandbox.LEVELS[0].description,
    'notes show the description');
  ok(h.elements['notes-creatures'].textContent.length > 0,
    'notes show creature text');
  ok(h.elements['notes-items'].textContent.length > 0,
    'notes show pickup text');
  const t0 = g.elapsed;
  h.pump(400);
  ok(g.elapsed === t0, 'world paused while notes open');
  h.fireKey('Escape');
  ok(!g.notesOpen, 'Escape closes notes');
  h.fireKey('KeyB');
  ok(g.notesOpen, 'B reopens notes');
  h.elements['notes-close'].click();
  ok(!g.notesOpen, 'close button closes notes');
  g.openNotes();
  g.openLevelSelect();
  ok(!g.notesOpen && g.levelSelectOpen,
    'opening picker replaces notes (one dialog at a time)');
  h.fireKey('Escape');
}

// 9. Same-frame creature + relic + anomaly events each get their own feed
// entry and are consumed exactly once.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  const p = g.player;
  g.creatures.creatures[0].x = p.x;
  g.creatures.creatures[0].y = p.y;
  g.relics[0].x = p.x;
  g.relics[0].y = p.y;
  g.inversions[0].x = p.x;
  g.inversions[0].y = p.y;
  h.pump(50);
  const feed = h.elements['encounter-feed'];
  ok(feed.children.length === 3,
    `expected 3 same-frame feed entries, got ${feed.children.length}`);
  const texts = feed.children.map(c => c.textContent);
  ok(new Set(texts).size === texts.length, 'feed entries must be distinct');
  ok(texts.some(t => /KNOCKBACK|SLOWED 2\.4S|MOUSE LOOK REVERSED 3S|SPEED BOOST 5S/.test(t)),
    'feed explains the creature effect in words');
  ok(texts.some(t => /DISK 1\/3 - BOOST 3S/.test(t)),
    'feed includes relic pickup with boost duration');
  ok(texts.some(t => /ANOMALY/.test(t)), 'feed includes anomaly');
  ok(g.relics[0].collected && g.inversions[0].consumed,
    'pickups consumed exactly once');
  h.pump(50);
  ok(feed.children.length === 3, 'consumed pickups do not refire');
}

// 10. Smart + interactions off routes to the exit and completes.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  h.fireKey('KeyT');
  h.fireKey('KeyI');
  ok(!g.interactionsEnabled, 'I disables interactions');
  ok(g.autopilot.itemsPending === false,
    'smart skips pickups it cannot consume');
  let guard = 0;
  while (g.levelIndex === 0 && guard < 4000) {
    h.pump(16);
    guard += 1;
  }
  ok(g.levelIndex === 1, 'smart exits the level with interactions off');
}

// 11. Pointer lock stays off in auto even via picker double-click load.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  h.fireKey('KeyT');
  h.calls.pointerLock = 0;
  g.openLevelSelect();
  h.elements['level-list'].value = '5';
  h.elements['level-list'].dispatchEvent('dblclick');
  ok(g.levelIndex === 5, 'dblclick loads in auto');
  ok(h.calls.pointerLock === 0, 'no pointer lock in auto');
}

// 12. Switching manual -> auto releases a held pointer lock.
{
  const h = makeHarness();
  const g = h.newGame();
  h.fireKey('Enter');
  ok(h.document.pointerLockElement === h.elements.c,
    'manual enter holds pointer lock');
  h.fireKey('KeyT');
  ok(g.auto === true, 'T enables auto from manual play');
  ok(h.document.pointerLockElement === null,
    'auto releases the manually held pointer lock');
}

// 13. Feed text explains real effects; auto bumps never shove or turn.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  const feed = h.elements['encounter-feed'];
  const feedTexts = () => feed.children.map(c => c.textContent);
  const touchOnce = type => {
    let fired = false;
    g.creatures.consumeContact = () => {
      if (fired) return null;
      fired = true;
      return { type, x: g.player.x, y: g.player.y, phase: 0 };
    };
    h.pump(50);
    g.creatures.consumeContact = () => null;
  };

  h.fireKey('KeyT'); // auto on
  g.autopilot.advance = () => 0; // isolate: hold still, contact path is real
  const px = g.player.x;
  const py = g.player.y;
  const pa = g.player.angle;
  touchOnce('rat');
  ok(g.player.x === px && g.player.y === py && g.player.angle === pa,
    'auto contact does not move or turn the player');
  ok(feedTexts().includes('RAT - AUTO HOLDS COURSE'),
    'auto bump feed explains course is held');

  touchOnce('spider');
  ok(feedTexts().includes('SPIDER - SLOWED 2.4S'),
    'slow effect named with duration');
  touchOnce('bat');
  ok(feedTexts().includes('BAT - MOUSE LOOK REVERSED 3S'),
    'reverse effect explains mouse-look');
  touchOnce('dolphin');
  ok(feedTexts().includes('DOLPHIN - SPEED BOOST 5S'),
    'boost effect named with duration');
  ok(feed.children.length <= 4, 'feed capacity stays bounded');

  h.fireKey('KeyT'); // auto off -> manual
  const a0 = g.player.angle;
  touchOnce('rat');
  ok(g.player.angle !== a0, 'manual bump perturbs heading');
  ok(feedTexts().includes('RAT - KNOCKBACK'),
    'manual bump feed says knockback');
}

// 14. Level load clears the feed and any leftover flash ring.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  g.pushFeed('TEST - ENTRY', 'contact');
  g.flashEvent('relic');
  ok(h.elements['event-flash'].className.includes('flash-relic'),
    'flash ring is shown');
  g.loadLevel(1);
  ok(h.elements['encounter-feed'].children.length === 0,
    'feed cleared on level load');
  ok(h.elements['event-flash'].className === '',
    'flash cleared on level load');
}

// 15. level.start stays pristine: autopilot resets write onto the player.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  h.pump(100);
  const keys = Object.keys(h.sandbox.LEVELS[0].start).sort();
  ok(keys.join(',') === 'angle,x,y',
    `level.start keys must stay x/y/angle, got ${keys.join(',')}`);
}

// 16. Chrome measurement publishes --controls-height/--touch-height through
// the ResizeObserver path and the resize fallback.
{
  const h = makeHarness();
  h.newGame();
  ok(h.roInstances.length === 1, 'chrome ResizeObserver installed');
  ok(h.roInstances[0].targets.length === 2,
    'observer watches controls and touch controls');
  const shell = h.elements['game-shell'];
  h.elements.controls.rect.height = 88;
  h.elements['touch-controls'].rect.height = 104;
  h.triggerObservers();
  ok(shell.style['--controls-height'] === '88px',
    `--controls-height measured, got ${shell.style['--controls-height']}`);
  ok(shell.style['--touch-height'] === '104px',
    `--touch-height measured, got ${shell.style['--touch-height']}`);
  h.elements['touch-controls'].rect.height = 0;
  h.fireResize();
  ok(shell.style['--touch-height'] === '0px',
    'resize fallback remeasures when observer is absent');
}

// 17. Editable targets never leak gameplay keys or fire game shortcuts.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  const editable = { tagName: 'DIV', isContentEditable: true };
  for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' }, editable]) {
    h.fireKey('KeyW', { target });
    ok(!g.input.keys.has('KeyW'),
      `${target.tagName} leaked KeyW into gameplay keys`);
  }
  h.fireKey('KeyB', { target: editable });
  ok(!g.notesOpen, 'shortcut fired while contenteditable focused');
  h.fireKey('KeyL', { target: { tagName: 'INPUT' } });
  ok(!g.levelSelectOpen, 'picker shortcut fired while input focused');
  const ev = h.fireKey('KeyW');
  ok(g.input.keys.has('KeyW'), 'body target should register KeyW');
  ok(ev.defaultPrevented, 'game key does not prevent default');
  h.fireKeyUp('KeyW');
  h.fireKey('KeyQ');
  ok(!g.input.keys.has('KeyQ'), 'non-game key was tracked');
}

// 18. Modal suspension blocks mouse drag, mouse deltas and touch presses.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  ok(!g.input.suspended, 'started game should not be suspended');
  h.document.pointerLockElement = null; // exercise the drag-look path
  h.fireMouseDown({ button: 2, clientX: 0 });
  ok(!g.input.dragging, 'right button must not start a drag');
  h.fireMouseDown({ button: 0, clientX: 100 });
  ok(g.input.dragging, 'left-drag should engage look');
  h.fireMouseMove({ clientX: 140 });
  ok(g.input.mouseDX === 40, `drag delta ${g.input.mouseDX} !== 40`);
  g.openNotes();
  ok(g.input.suspended, 'modal does not suspend input');
  ok(g.input.mouseDX === 0 && !g.input.dragging,
    'suspension did not flush the pending drag');
  h.fireMouseDown({ button: 0, clientX: 0 });
  ok(!g.input.dragging, 'mousedown ignored while suspended');
  h.fireMouseMove({ clientX: 60, movementX: 60 });
  ok(g.input.mouseDX === 0, 'mousemove ignored while suspended');
  h.fireTouch('forward');
  ok(!g.input.touch.has('forward'), 'touch press ignored while suspended');
  const neutral = g.input.sample();
  ok(neutral.forward === 0 && neutral.strafe === 0 &&
    neutral.turn === 0 && neutral.mouseTurn === 0 && !neutral.manual,
    'suspended sample is not neutral');
  h.fireTouch('forward', 'pointerup');
  g.closeNotes();
  ok(!g.input.suspended, 'input stays suspended after notes close');
}

// 19. Autoplay suppresses mouse and touch and flushes stale deltas.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  h.fireKey('KeyT');
  ok(g.auto && g.input.pointerLockBlocked, 'auto should block pointer input');
  h.fireMouseDown({ button: 0, clientX: 0 });
  ok(!g.input.dragging, 'mousedown ignored in auto');
  h.fireMouseMove({ clientX: 80, movementX: 80 });
  ok(g.input.mouseDX === 0, 'mousemove accumulated in auto');
  h.fireTouch('forward');
  ok(!g.input.touch.has('forward'), 'touch press registered in auto');
  g.input.mouseDX = 25; // injected mid-frame: must never be sampled
  g.input.keys.add('KeyW');
  const s = g.input.sample();
  ok(s.forward === 0 && s.strafe === 0 && s.turn === 0 &&
    s.mouseTurn === 0 && !s.manual, 'auto sample is not neutral');
  ok(g.input.mouseDX === 0 && !g.input.keys.has('KeyW'),
    'auto sample did not flush stale input');
  h.fireKey('KeyT');
  ok(!g.input.pointerLockBlocked, 'leaving auto keeps input blocked');
}

// 20. No deferred camera jump: queued look deltas die on mode switches.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  // Pointer lock is held: movementX queues a look delta in mouseDX.
  h.fireMouseMove({ movementX: 300 });
  ok(g.input.mouseDX === 300, 'look delta should queue before the frame');
  h.fireKey('KeyT'); // auto: flushes the queue
  h.pump(100);
  h.fireKey('KeyT'); // manual again
  h.pump(50);        // first manual samples pass
  const angle = g.player.angle;
  h.pump(300);
  ok(g.player.angle === angle,
    'stale look delta jumped the camera after auto');
}

// 21. Relic label: BOOST for partial/creature boosts, OVERDRIVE only while
// the completed-set overdrive timer actually runs.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  const R = h.sandbox.Maze3D.INTERACTION_RULES;
  const label = () => h.elements['relic-label'].textContent;

  g.boostTimer = R.creatureBoostDuration;
  g.updateRelicLabel();
  ok(/ - BOOST$/.test(label()) && !label().includes('OVERDRIVE'),
    `creature boost mislabeled: ${label()}`);

  // Real collection: drive the player over every relic through updatePickups.
  for (const relic of g.relics) {
    g.player.x = relic.x;
    g.player.y = relic.y;
    g.updatePickups();
  }
  ok(g.relicsFound === g.relics.length, 'relic walk did not collect the set');
  ok(g.overdriveTimer === R.overdriveDuration,
    `overdrive timer ${g.overdriveTimer} !== ${R.overdriveDuration}`);
  ok(g.boostTimer === R.overdriveDuration,
    'completed set lost its movement boost');
  ok(/ - OVERDRIVE$/.test(label()),
    `completed set should read OVERDRIVE: ${label()}`);

  // Once overdrive expires a later creature boost must read BOOST again.
  g.overdriveTimer = 0.001;
  h.pump(50);
  ok(g.overdriveTimer === 0 && g.boostTimer > 0,
    `timers did not decay: od=${g.overdriveTimer} boost=${g.boostTimer}`);
  g.applyCreatureContact(
    { type: 'fish', x: g.player.x, y: g.player.y, phase: 0 });
  ok(/ - BOOST$/.test(label()) && !label().includes('OVERDRIVE'),
    `post-overdrive boost mislabeled: ${label()}`);

  // Level load and toggling interactions off clear both timers.
  g.loadLevel(0);
  ok(g.boostTimer === 0 && g.overdriveTimer === 0,
    'level load did not clear boost/overdrive timers');
  g.boostTimer = 2;
  g.overdriveTimer = 2;
  g.toggleInteractions();
  ok(g.boostTimer === 0 && g.overdriveTimer === 0,
    'interactions-off did not clear boost/overdrive timers');
  g.toggleInteractions();
  g.updateRelicLabel();
  ok(!label().includes('BOOST') && !label().includes('OVERDRIVE'),
    `expired boost still labeled: ${label()}`);
}

// 22. Contact effect magnitudes all come from INTERACTION_RULES.
{
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  const R = h.sandbox.Maze3D.INTERACTION_RULES;
  const feedTexts = () =>
    h.elements['encounter-feed'].children.map(c => c.textContent);
  const contact = type => g.applyCreatureContact(
    { type, x: g.player.x, y: g.player.y, phase: 0 });
  contact('spider');
  ok(g.slowTimer === R.slowDuration, 'slow timer not rule-derived');
  contact('fish');
  ok(g.boostTimer === R.creatureBoostDuration,
    'creature boost timer not rule-derived');
  ok(feedTexts().includes(`FISH - SPEED BOOST ${R.creatureBoostDuration}S`),
    'boost feed duration not rule-derived');
  contact('bat');
  ok(g.reverseMouseTimer === R.reverseDuration,
    'reverse timer not rule-derived');
  const a = g.player.angle;
  contact('rat');
  ok(Math.abs(Math.abs(g.player.angle - a) - R.bumpTurn) < 1e-9,
    `bump turn ${Math.abs(g.player.angle - a)} !== ${R.bumpTurn}`);
  ok(Object.isFrozen(R), 'INTERACTION_RULES not frozen');
}

// 23. Screenshot: C and the footer button export the canvas as a PNG blob
// download; guards and failure paths never leak a download or a URL. Async
// because the object URL revoke is deferred a tick (browser-safe timing).
const screenshotChecks = async () => {
  const h = makeHarness();
  const g = h.newGame();
  g.enter(true);
  const status = () => h.elements['status-label'].textContent;
  const tick = () => new Promise(r => setTimeout(r, 5));

  h.fireKey('KeyC');
  ok(h.calls.toBlob === 1, 'C should request one canvas PNG');
  ok(h.calls.downloads.length === 1, 'capture should trigger one download');
  ok(/^maze3d-sector-1-\d{4}.*\.png$/.test(h.calls.downloads[0].name),
    `bad screenshot name: ${h.calls.downloads[0] && h.calls.downloads[0].name}`);
  ok(h.calls.downloads[0].href === 'blob:mock-1',
    'download should use the object URL');
  ok(status().includes('SCREENSHOT SAVED'),
    `status did not confirm save: ${status()}`);
  await tick();
  ok(h.calls.revoked.length === 1 && h.calls.revoked[0] === 'blob:mock-1',
    'blob URL must be revoked (deferred tick) after the click');

  h.elements['screenshot-button'].click();
  ok(h.calls.toBlob === 2 && h.calls.downloads.length === 2,
    'screenshot button should capture once');
  await tick();
  ok(h.calls.revoked.length === 2, 'button capture must revoke its URL');

  // Null blob: failure status, no download, no dangling object URL.
  h.setBlobResult(null);
  g.captureScreenshot();
  ok(h.calls.toBlob === 3 && h.calls.downloads.length === 2,
    'null blob must not download');
  ok(h.calls.objectUrls === 2, 'null blob must not mint an object URL');
  ok(status() === 'SCREENSHOT FAILED',
    `null blob should surface failure: ${status()}`);

  // Deferred resolution: the sector may change before toBlob calls back —
  // the download must still be named for the captured sector.
  h.setBlobResult({ type: 'image/png', size: 1 });
  h.setBlobDefer(true);
  h.fireKey('KeyC');
  ok(h.calls.toBlob === 4 && h.calls.downloads.length === 2,
    'deferred capture should queue, not download yet');
  g.loadLevel(2);
  h.flushBlobs();
  h.setBlobDefer(false);
  ok(h.calls.downloads.length === 3, 'deferred capture must still download');
  ok(h.calls.downloads[2].name.startsWith('maze3d-sector-1-'),
    `deferred capture named wrong sector: ${h.calls.downloads[2].name}`);
  g.loadLevel(0);

  // createObjectURL throws inside the async callback: failure status, no
  // download, no exception escaping.
  h.calls.urlThrow = true;
  h.fireKey('KeyC');
  ok(h.calls.toBlob === 5 && h.calls.downloads.length === 3,
    'URL failure must not download');
  ok(status() === 'SCREENSHOT FAILED', `URL failure status: ${status()}`);

  // anchor.click throws: failure status AND the minted URL still revoked.
  h.calls.anchorThrow = true;
  h.fireKey('KeyC');
  ok(h.calls.toBlob === 6 && h.calls.downloads.length === 3,
    'click failure must not download');
  ok(status() === 'SCREENSHOT FAILED', `click failure status: ${status()}`);
  await tick();
  ok(h.calls.revoked.includes('blob:mock-3') || h.calls.revoked.length >= 3,
    'URL must be revoked even when the click throws');

  // Modifier chords must not capture (Ctrl+C is copy, not screenshot).
  h.fireKey('KeyC', { ctrlKey: true });
  h.fireKey('KeyC', { altKey: true });
  ok(h.calls.toBlob === 6, 'ctrl/alt chords must not capture');

  // Guards: repeat, editable targets, and open modals suppress capture.
  h.fireKey('KeyC', { repeat: true });
  ok(h.calls.toBlob === 6, 'key repeat must not recapture');
  h.fireKey('KeyC', { target: { tagName: 'INPUT' } });
  ok(h.calls.toBlob === 6, 'capture fired while editing');
  g.openNotes();
  h.fireKey('KeyC');
  ok(h.calls.toBlob === 6, 'capture fired while notes open');
  g.closeNotes();
  g.openLevelSelect();
  h.fireKey('KeyC');
  ok(h.calls.toBlob === 6, 'capture fired while picker open');
  h.fireKey('Escape');

  // S stays movement, not a shortcut.
  h.fireKey('KeyS');
  ok(h.calls.toBlob === 6, 'S must not capture');
  ok(g.input.keys.has('KeyS'), 'S should remain the backward key');
  h.fireKeyUp('KeyS');
};

// 24. Display toggles: scanlines [G] + low res [Q] default ON (legacy look),
// persist, drive the overlay/body class/renderer, and respect every guard.
const toggleChecks = async () => {
  // Legacy defaults: absent keys mean scanlines + low-res ON.
  {
    const h = makeHarness();
    const g = h.newGame();
    ok(g.scanlines === true, 'scanlines should default ON (legacy look)');
    ok(g.lowRes === true, 'lowRes should default ON (legacy look)');
    ok(g.renderer.opts.lowRes === true,
      'renderer must be constructed with the persisted lowRes flag');
    ok(h.elements.scanlines.hidden !== true,
      'scanlines overlay visible by default');
    ok(h.document.body.classList.contains('low-res'),
      'low-res body class applied by default');
    ok(g.ui.mapButton.textContent === 'MAP [M]: OFF',
      `map label missing key hint: ${g.ui.mapButton.textContent}`);
    ok(g.ui.scanlinesButton.textContent === 'SCANLINES [G]: ON');
    ok(g.ui.lowResButton.textContent === 'LOW RES [Q]: ON');
  }

  // Explicit persisted false: reload restores OFF for both.
  {
    const h = makeHarness({ 'maze3d.settings.v1': JSON.stringify({
      scanlines: false, lowRes: false }) });
    const g = h.newGame();
    ok(g.scanlines === false, 'persisted scanlines=false not restored');
    ok(g.lowRes === false, 'persisted lowRes=false not restored');
    ok(g.renderer.opts.lowRes === false, 'renderer built with lowRes=false');
    ok(h.elements.scanlines.hidden === true,
      'overlay hidden when scanlines off');
    ok(!h.document.body.classList.contains('low-res'),
      'low-res class absent when off');
    ok(g.ui.scanlinesButton.textContent === 'SCANLINES [G]: OFF');
    ok(g.ui.lowResButton.textContent === 'LOW RES [Q]: OFF');
  }

  // Toggle paths: keys + buttons, persistence, no level/input side effects.
  {
    const h = makeHarness();
    const g = h.newGame();
    g.enter(true);
    const level0 = g.levelIndex;
    const status = () => h.elements['status-label'].textContent;

    h.fireKey('KeyG');
    ok(g.scanlines === false, 'G did not toggle scanlines');
    ok(h.elements.scanlines.hidden === true, 'overlay did not hide');
    ok(readStore(h).scanlines === false, 'scanlines not persisted');
    ok(g.ui.scanlinesButton.textContent === 'SCANLINES [G]: OFF');
    ok(status().includes('SCANLINES'), 'toggle should report status');
    h.elements['scanlines-button'].click();
    ok(g.scanlines === true, 'scanlines button did not toggle back');
    ok(h.elements.scanlines.hidden !== true, 'overlay did not re-show');
    ok(readStore(h).scanlines === true, 're-enable not persisted');

    h.fireKey('KeyQ');
    ok(g.lowRes === false, 'Q did not toggle low res');
    ok(g.renderer.lowResCalls.length === 1 &&
      g.renderer.lowResCalls[0] === false,
      'renderer.setLowRes(false) not called once');
    ok(!h.document.body.classList.contains('low-res'),
      'low-res class not removed');
    ok(readStore(h).lowRes === false, 'lowRes not persisted');
    h.elements['low-res-button'].click();
    ok(g.lowRes === true && g.renderer.lowResCalls[1] === true,
      'low-res button did not toggle back');
    ok(h.document.body.classList.contains('low-res'),
      'low-res class not restored');

    ok(g.levelIndex === level0, 'quality toggles must not reload the level');
    ok(g.input.suspended === false, 'quality toggles suspended input');
    ok(!g.levelSelectOpen && !g.notesOpen,
      'quality toggles opened a modal');

    // Guards: repeat, modifier chords, editable targets, open modals.
    const calls0 = g.renderer.lowResCalls.length;
    const scan0 = g.scanlines;
    h.fireKey('KeyQ', { repeat: true });
    h.fireKey('KeyG', { repeat: true });
    ok(g.renderer.lowResCalls.length === calls0 && g.scanlines === scan0,
      'repeated Q/G must not toggle');
    h.fireKey('KeyQ', { ctrlKey: true });
    h.fireKey('KeyG', { altKey: true });
    h.fireKey('KeyQ', { metaKey: true });
    ok(g.renderer.lowResCalls.length === calls0 && g.scanlines === scan0,
      'modifier chords must not toggle');
    h.fireKey('KeyQ', { target: { tagName: 'INPUT' } });
    h.fireKey('KeyG', { target: { tagName: 'TEXTAREA' } });
    ok(g.renderer.lowResCalls.length === calls0 && g.scanlines === scan0,
      'editable targets must not toggle');
    g.openNotes();
    h.fireKey('KeyQ');
    h.fireKey('KeyG');
    ok(g.renderer.lowResCalls.length === calls0 && g.scanlines === scan0,
      'modal-open Q/G must not toggle');
    g.closeNotes();

    // M label survives refreshes with its key hint.
    h.fireKey('KeyM');
    ok(g.ui.mapButton.textContent === 'MAP [M]: ON',
      `map on label: ${g.ui.mapButton.textContent}`);
    h.fireKey('KeyM');
    ok(g.ui.mapButton.textContent === 'MAP [M]: OFF',
      `map off label: ${g.ui.mapButton.textContent}`);
  }

  // Static label check on the real footer markup.
  {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const label of ['MAP [M]', 'FULLSCREEN [F]', 'RESET [R]',
      'SCANLINES [G]', 'LOW RES [Q]', 'SHOT [C]']) {
      ok(html.includes(label), `index.html footer missing "${label}"`);
    }
    ok(/id="hint-text"[\s\S]*?Q LOW RES[\s\S]*?R RESET/.test(html),
      'hint text must document Q and R');
  }
};

screenshotChecks().then(toggleChecks).then(() => {
  console.log(failures === 0 ? 'UI ALL VALID' : `${failures} UI FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}, (err) => {
  fail(`screenshot checks threw: ${err && err.stack || err}`);
  console.log(`${failures} UI FAILURES`);
  process.exit(1);
});
