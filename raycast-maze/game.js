// 3D Maze — coordinator. Raycasting lives in js/renderer.js,
// pathfinding in js/autopilot.js, critters in js/entities.js.
(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};
  const CONFIG = Maze3D.CONFIG;
  const TILES = Maze3D.TILES;
  const RULES = Maze3D.INTERACTION_RULES;

  const INVERSION_RESPONSE = 5.2;
  const ADVANCE_DELAY = 0.85;
  const STATUS_SECONDS = 2.4;
  const FEED_LIMIT = 4;
  const FEED_SECONDS = 4;

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const isEditableTarget = Maze3D.isEditableTarget;

  class MazeGame {
    constructor() {
      this.canvas = $('c');
      this.config = CONFIG;
      this.settings = new Maze3D.SettingsStore();
      this.audio = new Maze3D.AudioEngine(this.settings.get('sound'));
      this.textures = Maze3D.installLevelTextureVariants(
        Maze3D.expandAestheticTextures(
          Maze3D.expandCivilizationTextures(
            Maze3D.expandTextures(
              Maze3D.enrichTextures(Maze3D.createTextures())
            )
          )
        )
      );
      // Persisted display flags must exist before the Renderer is built.
      this.scanlines = this.settings.get('scanlines') !== false;
      this.lowRes = this.settings.get('lowRes') !== false;
      this.input = new Maze3D.InputController(this.canvas);
      this.autopilot = new Maze3D.AutoPilot(CONFIG);
      this.creatures = new Maze3D.CreatureSwarm();
      this.renderer = new Maze3D.Renderer(this.canvas, this.textures, CONFIG,
        { lowRes: this.lowRes });

      this.ui = {
        levelLabel: $('level-label'),
        relicLabel: $('relic-label'),
        statusLabel: $('status-label'),
        modeLabel: $('mode-label'),
        autoButton: $('auto-button'),
        autoBrainButton: $('auto-brain-button'),
        mapButton: $('map-button'),
        hudButton: $('hud-button'),
        fullscreenButton: $('fullscreen-button'),
        screenshotButton: $('screenshot-button'),
        scanlinesButton: $('scanlines-button'),
        lowResButton: $('low-res-button'),
        scanlinesEl: $('scanlines'),
        resetButton: $('reset-button'),
        previousButton: $('previous-button'),
        nextButton: $('next-button'),
        levelSelect: $('level-select'),
        levelList: $('level-list'),
        levelLoadButton: $('level-load-button'),
        levelSelectClose: $('level-select-close'),
        levelSelectButton: $('level-select-button'),
        notesButton: $('notes-button'),
        levelNotes: $('level-notes'),
        notesClose: $('notes-close'),
        notesTitle: $('notes-title'),
        notesSetting: $('notes-setting'),
        notesCreatures: $('notes-creatures'),
        notesItems: $('notes-items'),
        interactionButton: $('interaction-button'),
        soundButton: $('sound-button'),
        intro: $('intro'),
        enterButton: $('enter-button'),
        encounterFeed: $('encounter-feed'),
        eventFlash: $('event-flash'),
        shell: $('game-shell'),
        controlsBar: $('controls'),
        touchControls: $('touch-controls'),
      };

      this.levelIndex = 0;
      this.levelVisitSerial = 0;
      this.auto = this.settings.get('auto') === true;
      this.autoSmart = this.settings.get('autoSmart') === true;
      this.showMap = this.settings.get('map') === true;
      // HUD always starts visible for a new game and is never persisted.
      this.showHUD = true;
      document.body.classList.remove('hud-off');
      this.interactionsEnabled = this.settings.get('interactions') !== false;
      this.inversion = 0;
      this.inversionTarget = 0;
      this.complete = false;
      this.completeTimer = 0;
      this.elapsed = 0;
      this.bobPhase = 0;
      this.statusTimer = 0;
      this.relicsFound = 0;
      this.boostTimer = 0;
      this.overdriveTimer = 0;
      this.slowTimer = 0;
      this.reverseMouseTimer = 0;
      this.stepDistance = 0;
      this.started = false;
      this.levelSelectOpen = false;
      this.notesOpen = false;
      this.exitWarned = false;
      this.levelLoadedOnce = false;

      this.bindUI();
      this.buildLevelSelect();
      this.watchChrome();
      // Persisted display flags applied before the first frame.
      this.applyScanlines();
      document.body.classList.toggle('low-res', this.lowRes);
      const initial = clamp(
        Number(this.settings.get('lastLevel')) || 0, 0, LEVELS.length - 1
      );
      this.loadLevel(initial);
      this.input.pointerLockBlocked = this.auto;
      this.input.suspended = this.anyModalOpen();
      // Persisted autoplay boots straight into the maze: no pointer lock or
      // audio unlock is requested because there is no user gesture yet.
      if (this.auto) this.enter(false);
      this.lastTime = performance.now();
      requestAnimationFrame(time => this.frame(time));
    }

    bindUI() {
      this.ui.autoButton.addEventListener('click', () => this.toggleAuto());
      this.ui.autoBrainButton.addEventListener('click', () => this.toggleAutoBrain());
      this.ui.mapButton.addEventListener('click', () => this.toggleMap());
      this.ui.hudButton.addEventListener('click', () => this.toggleHUD());
      this.ui.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
      this.ui.screenshotButton.addEventListener('click', () => this.captureScreenshot());
      this.ui.scanlinesButton.addEventListener('click', () => this.toggleScanlines());
      this.ui.lowResButton.addEventListener('click', () => this.toggleLowRes());
      this.ui.resetButton.addEventListener('click', () => this.loadLevel(this.levelIndex));
      this.ui.previousButton.addEventListener('click', () => this.nextLevel(-1));
      this.ui.nextButton.addEventListener('click', () => this.nextLevel(1));
      this.ui.enterButton.addEventListener('click', () => this.enter(true));
      this.ui.levelSelectButton.addEventListener('click', () => this.toggleLevelSelect());
      this.ui.levelSelectClose.addEventListener('click', () => this.closeLevelSelect());
      this.ui.levelLoadButton.addEventListener('click', () => {
        this.selectLevel(Number(this.ui.levelList.value));
      });
      this.ui.levelList.addEventListener('dblclick', () => {
        this.selectLevel(Number(this.ui.levelList.value));
      });
      this.ui.notesButton.addEventListener('click', () => this.toggleNotes());
      this.ui.notesClose.addEventListener('click', () => this.closeNotes());
      this.ui.interactionButton.addEventListener('click', () => this.toggleInteractions());
      this.ui.soundButton.addEventListener('click', () => this.toggleSound());

      window.addEventListener('keydown', event => {
        // The sector picker handles its own keys, including key repeat so
        // held arrows scroll; this runs before the global repeat guard.
        if (this.levelSelectOpen) {
          switch (event.code) {
            case 'ArrowDown': this.setLevelSelection(Number(this.ui.levelList.value) + 1); break;
            case 'ArrowUp': this.setLevelSelection(Number(this.ui.levelList.value) - 1); break;
            case 'Home': this.setLevelSelection(0); break;
            case 'End': this.setLevelSelection(LEVELS.length - 1); break;
            case 'Enter':
              if (!event.repeat) this.selectLevel(Number(this.ui.levelList.value));
              break;
            case 'Escape':
            case 'KeyL':
              if (!event.repeat) this.closeLevelSelect();
              break;
            default: break;
          }
          event.preventDefault();
          return;
        }
        if (event.repeat) return;
        if (isEditableTarget(event.target)) return;
        if (this.notesOpen) {
          if (event.code === 'Escape' || event.code === 'KeyB') this.closeNotes();
          return;
        }
        switch (event.code) {
          case 'KeyL': this.toggleLevelSelect(); break;
          case 'KeyB': this.toggleNotes(); break;
          case 'KeyT': this.toggleAuto(); break;
          case 'KeyU': this.toggleAutoBrain(); break;
          case 'KeyH': this.toggleHUD(); break;
          case 'KeyI': this.toggleInteractions(); break;
          case 'KeyV': this.toggleSound(); break;
          case 'KeyM': this.toggleMap(); break;
          case 'KeyC':
            // ctrl/alt/meta chords (e.g. Ctrl+C) must not capture
            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
              this.captureScreenshot();
            }
            break;
          case 'KeyF': this.toggleFullscreen(); break;
          case 'KeyG':
            // modifier chords (e.g. Ctrl+G) must not toggle the overlay
            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
              this.toggleScanlines();
            }
            break;
          case 'KeyQ':
            if (!event.ctrlKey && !event.altKey && !event.metaKey) {
              this.toggleLowRes();
            }
            break;
          case 'KeyR': this.loadLevel(this.levelIndex); break;
          case 'KeyN': this.nextLevel(1); break;
          case 'KeyP': this.nextLevel(-1); break;
          case 'Enter':
            if (!this.started) this.enter(true);
            break;
          default: break;
        }
      });

      window.addEventListener('resize', () => this.renderer.resize());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) this.lastTime = performance.now();
      });
    }

    anyModalOpen() {
      return !this.started || this.levelSelectOpen || this.notesOpen;
    }

    // Freeze the world and release captured devices while a dialog is up.
    suspendForModal() {
      this.input.clear();
      this.input.suspended = true;
      this.player.velocityForward = 0;
      this.player.velocityStrafe = 0;
      this.player.turnVelocity = 0;
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    }

    resumeFromModal() {
      this.input.suspended = this.anyModalOpen();
      this.input.clear();
      this.canvas.focus();
    }

    enter(gesture = true) {
      this.started = true;
      this.ui.intro.classList.add('hidden');
      this.ui.intro.setAttribute('aria-hidden', 'true');
      this.canvas.focus();
      if (gesture) {
        this.audio.unlock();
        this.audio.play('ui');
        if (!this.auto && this.canvas.requestPointerLock) {
          try {
            const lock = this.canvas.requestPointerLock();
            if (lock && lock.catch) lock.catch(() => {});
          } catch (error) {
            // Pointer lock may be unavailable; drag look still works.
          }
        }
      }
      this.input.suspended = this.anyModalOpen();
    }

    isWallCell(cellX, cellY) {
      return Maze3D.isWallCell(this.map, cellX, cellY);
    }

    canStand(x, y) {
      const r = this.config.playerRadius;
      return !this.isWallCell(Math.floor(x - r), Math.floor(y - r)) &&
        !this.isWallCell(Math.floor(x + r), Math.floor(y - r)) &&
        !this.isWallCell(Math.floor(x - r), Math.floor(y + r)) &&
        !this.isWallCell(Math.floor(x + r), Math.floor(y + r));
    }

    autoOptions() {
      return {
        smart: this.autoSmart,
        items: { relics: this.relics, anomalies: this.inversions },
        interact: this.interactionsEnabled,
      };
    }

    loadLevel(index) {
      this.levelIndex = index;
      this.level = LEVELS[index];
      this.map = this.level.map;
      const start = this.level.start;
      this.player = {
        x: start.x,
        y: start.y,
        angle: start.angle || 0,
        velocityForward: 0,
        velocityStrafe: 0,
        turnVelocity: 0,
        bob: 0,
      };
      this.exit = null;
      for (let y = 0; y < this.map.length; y += 1) {
        for (let x = 0; x < this.map[y].length; x += 1) {
          if (this.map[y][x] === TILES.EXIT) this.exit = { x, y };
        }
      }
      this.inversions = (this.level.inversions || [])
        .map(point => ({ x: point.x, y: point.y, consumed: false }));
      this.relics = (this.level.relics || [])
        .map(point => ({ x: point.x, y: point.y, collected: false }));
      this.relicsFound = 0;
      this.boostTimer = 0;
      this.overdriveTimer = 0;
      this.slowTimer = 0;
      this.reverseMouseTimer = 0;
      this.stepDistance = 0;
      this.inversion = 0;
      this.inversionTarget = 0;
      this.complete = false;
      this.completeTimer = 0;
      this.elapsed = 0;
      this.bobPhase = 0;
      this.statusTimer = 0;
      this.exitWarned = false;

      const avoid = [
        ...this.level.inversions,
        ...this.level.relics,
        { x: this.exit.x + 0.5, y: this.exit.y + 0.5 },
      ];
      this.creatures.reset(this.map, {
        types: this.level.creatureTypes,
        count: this.level.creatureCount,
        start,
        avoid,
      }, (index + 1) * 977 + this.levelVisitSerial++ * 37);
      // Pass the live player, not level.start: reset() zeroes velocity/bob
      // fields on whatever object it receives and level data must stay clean.
      this.autopilot.reset(this.map, this.player, this.exit,
        (index + 1) * 613 + 17, this.autoOptions());

      this.ui.levelLabel.textContent =
        `${index + 1}/${LEVELS.length} - ${this.level.name.toUpperCase()}`;
      this.ui.statusLabel.textContent = '';
      if (this.ui.levelList) {
        this.ui.levelList.value = String(index);
      }
      this.settings.set('lastLevel', index);
      this.renderer.setLevel(this.map, this.level);
      if (this.levelLoadedOnce) this.audio.play('warp');
      this.levelLoadedOnce = true;
      this.clearFeed();
      this.closeNotes();
      this.updateRelicLabel();
      this.refreshModeLabels();
      this.input.clear();
    }

    updateRelicLabel() {
      const total = this.relics.length;
      let text = `${(this.level.relicType || 'relic').toUpperCase()} ${this.relicsFound}/${total}`;
      // OVERDRIVE runs on its own timer: creature or partial-relic boosts
      // during/after it are plain BOOST.
      if (this.overdriveTimer > 0) text += ' - OVERDRIVE';
      else if (this.boostTimer > 0) text += ' - BOOST';
      this.ui.relicLabel.textContent = text;
    }

    refreshModeLabels() {
      this.ui.modeLabel.textContent = this.auto ? 'MODE: AUTOMATIC' : 'MODE: MANUAL';
      this.ui.autoButton.textContent = this.auto ? 'AUTO [T]: ON' : 'AUTO [T]: OFF';
      this.ui.autoButton.setAttribute('aria-pressed', String(this.auto));
      this.ui.autoBrainButton.textContent =
        `AUTO BRAIN [U]: ${this.autoSmart ? 'SMART' : 'WANDER'}`;
      this.ui.autoBrainButton.setAttribute('aria-pressed', String(this.autoSmart));
      this.ui.mapButton.textContent = this.showMap ? 'MAP [M]: ON' : 'MAP [M]: OFF';
      this.ui.mapButton.setAttribute('aria-pressed', String(this.showMap));
      this.ui.scanlinesButton.textContent = this.scanlines
        ? 'SCANLINES [G]: ON' : 'SCANLINES [G]: OFF';
      this.ui.scanlinesButton.setAttribute('aria-pressed', String(this.scanlines));
      this.ui.lowResButton.textContent = this.lowRes
        ? 'LOW RES [Q]: ON' : 'LOW RES [Q]: OFF';
      this.ui.lowResButton.setAttribute('aria-pressed', String(this.lowRes));
      this.ui.hudButton.textContent = this.showHUD ? 'HUD [H]: ON' : 'HUD [H]: OFF';
      this.ui.hudButton.setAttribute('aria-pressed', String(this.showHUD));
      this.ui.interactionButton.textContent = this.interactionsEnabled
        ? 'INTERACTIONS [I]: ON' : 'INTERACTIONS [I]: OFF';
      this.ui.interactionButton.setAttribute('aria-pressed',
        String(this.interactionsEnabled));
      this.ui.soundButton.textContent = this.audio.enabled
        ? 'SOUND [V]: ON' : 'SOUND [V]: OFF';
      this.ui.soundButton.setAttribute('aria-pressed', String(this.audio.enabled));
    }

    showStatus(text) {
      this.ui.statusLabel.textContent = text;
      this.statusTimer = STATUS_SECONDS;
    }

    // Measure the bottom chrome so absolutely-positioned overlays (touch pad,
    // encounter feed) stack above whatever height the controls bar wraps to.
    measureChrome() {
      const shell = this.ui.shell;
      if (!shell || !shell.style || !shell.style.setProperty) return;
      const heightOf = el => (el && typeof el.getBoundingClientRect === 'function'
        ? el.getBoundingClientRect().height : 0);
      shell.style.setProperty(
        '--controls-height', `${heightOf(this.ui.controlsBar)}px`);
      shell.style.setProperty(
        '--touch-height', `${heightOf(this.ui.touchControls)}px`);
    }

    watchChrome() {
      this.measureChrome();
      if (typeof ResizeObserver === 'function') {
        this.chromeObserver = new ResizeObserver(() => this.measureChrome());
        for (const el of [this.ui.controlsBar, this.ui.touchControls]) {
          if (el) this.chromeObserver.observe(el);
        }
      }
      window.addEventListener('resize', () => this.measureChrome());
    }

    pushFeed(text, kind) {
      const feed = this.ui.encounterFeed;
      if (!feed) return;
      const entry = document.createElement('div');
      entry.className = `encounter-entry encounter-${kind}`;
      entry.textContent = text;
      feed.appendChild(entry);
      while (feed.children.length > FEED_LIMIT) {
        feed.removeChild(feed.firstChild);
      }
      setTimeout(() => {
        entry.classList.add('encounter-fading');
        setTimeout(() => {
          if (entry.parentNode === feed) feed.removeChild(entry);
        }, 400);
      }, FEED_SECONDS * 1000 - 400);
    }

    clearFeed() {
      if (this.ui.encounterFeed) this.ui.encounterFeed.textContent = '';
      if (this.ui.eventFlash) this.ui.eventFlash.className = '';
    }

    flashEvent(kind) {
      const flash = this.ui.eventFlash;
      if (!flash) return;
      flash.className = '';
      void flash.offsetWidth;
      flash.className = `flash-show flash-${kind}`;
    }

    toggleAuto() {
      this.auto = !this.auto;
      // T/button is a real user gesture: unlock audio once so enabling auto
      // from the intro does not leave a SOUND ON session silent.
      this.audio.unlock();
      this.input.pointerLockBlocked = this.auto;
      this.input.clear();
      if (this.auto) {
        // Autoplay never holds pointer lock; release a lock held manually.
        if (document.pointerLockElement && document.exitPointerLock) {
          try { document.exitPointerLock(); } catch (error) { /* ignore */ }
        }
        this.autopilot.reset(this.map, this.player, this.exit,
          (this.levelIndex + 1) * 613 + 17 + this.levelVisitSerial * 13,
          this.autoOptions());
      } else {
        this.player.velocityForward = 0;
        this.player.velocityStrafe = 0;
        this.player.turnVelocity = 0;
      }
      this.settings.set('auto', this.auto);
      this.refreshModeLabels();
      this.audio.play('ui');
      this.showStatus(this.auto ? 'AUTOMATIC NAVIGATION ENGAGED' : 'MANUAL CONTROL');
      if (this.auto && !this.started) this.enter(false);
    }

    toggleAutoBrain() {
      this.autoSmart = !this.autoSmart;
      this.settings.set('autoSmart', this.autoSmart);
      if (this.auto) {
        // Switching brains mid-run restarts navigation cleanly.
        this.autopilot.reset(this.map, this.player, this.exit,
          (this.levelIndex + 1) * 613 + 17 + this.levelVisitSerial * 13,
          this.autoOptions());
      }
      this.refreshModeLabels();
      this.audio.play('ui');
      this.showStatus(`AUTO BRAIN: ${this.autoSmart ? 'SMART' : 'WANDER'}`);
    }

    toggleHUD() {
      this.showHUD = !this.showHUD;
      document.body.classList.toggle('hud-off', !this.showHUD);
      this.measureChrome();
      this.refreshModeLabels();
      this.audio.play('ui');
    }

    toggleMap() {
      this.showMap = !this.showMap;
      this.settings.set('map', this.showMap);
      this.refreshModeLabels();
      this.audio.play('ui');
    }

    // CRT scanline overlay — a pure look toggle, independent of HUD and
    // render quality. Persisted across levels and reloads.
    toggleScanlines() {
      this.scanlines = !this.scanlines;
      this.settings.set('scanlines', this.scanlines);
      this.applyScanlines();
      this.refreshModeLabels();
      this.audio.play('ui');
      this.showStatus(this.scanlines ? 'SCANLINES ON' : 'SCANLINES OFF');
    }

    applyScanlines() {
      if (this.ui.scanlinesEl) this.ui.scanlinesEl.hidden = !this.scanlines;
    }

    // Render-quality toggle — swaps buffer scale/sample steps without
    // touching the level, player or input modes.
    toggleLowRes() {
      this.lowRes = !this.lowRes;
      this.settings.set('lowRes', this.lowRes);
      this.renderer.setLowRes(this.lowRes);
      document.body.classList.toggle('low-res', this.lowRes);
      this.refreshModeLabels();
      this.audio.play('ui');
      this.showStatus(this.lowRes ? 'LOW RES ON' : 'FULL RES ON');
    }

    toggleInteractions() {
      this.interactionsEnabled = !this.interactionsEnabled;
      if (!this.interactionsEnabled) {
        this.slowTimer = 0;
        this.reverseMouseTimer = 0;
        this.boostTimer = 0;
        this.overdriveTimer = 0;
        this.inversion = 0;
        this.inversionTarget = 0;
        this.player.turnVelocity = 0;
      }
      this.autopilot.configure(this.autoOptions());
      this.settings.set('interactions', this.interactionsEnabled);
      this.refreshModeLabels();
      this.audio.play('ui');
      this.showStatus(this.interactionsEnabled
        ? 'INTERACTIONS ON'
        : 'INTERACTIONS OFF - CONTACTS AND PICKUPS DISABLED');
    }

    toggleSound() {
      const enabled = !this.audio.enabled;
      this.audio.unlock();
      this.audio.setEnabled(enabled);
      this.settings.set('sound', enabled);
      this.refreshModeLabels();
      if (enabled) this.audio.play('ui');
    }

    toggleFullscreen() {
      const root = document.documentElement;
      if (!document.fullscreenElement) {
        if (root.requestFullscreen) {
          const request = root.requestFullscreen();
          if (request && request.catch) request.catch(() => {});
        }
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }

    // Export the current canvas scene as a PNG download. The canvas is a
    // plain 2D context, so toBlob captures the rendered frame directly —
    // no simulation advance, no UI overlays, no input-mode changes.
    captureScreenshot() {
      const canvas = this.canvas;
      if (!canvas || typeof canvas.toBlob !== 'function') {
        this.showStatus('SCREENSHOT UNSUPPORTED');
        return;
      }
      // Freeze naming inputs now: a delayed toBlob callback must still name
      // the sector that was on screen when the capture was requested.
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const name = `maze3d-sector-${this.levelIndex + 1}-${stamp}.png`;
      try {
        canvas.toBlob(blob => {
          // async: throws inside here never reach the outer try
          let url = null;
          try {
            if (!blob) throw new Error('empty blob');
            url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            this.showStatus(`SCREENSHOT SAVED - ${name}`);
          } catch (error) {
            this.showStatus('SCREENSHOT FAILED');
          } finally {
            // revoke a tick later so the download has actually started
            if (url) setTimeout(() => URL.revokeObjectURL(url), 0);
          }
        }, 'image/png');
      } catch (error) {
        this.showStatus('SCREENSHOT FAILED');
      }
    }

    nextLevel(step = 1) {
      this.loadLevel((this.levelIndex + step + LEVELS.length) % LEVELS.length);
    }

    buildLevelSelect() {
      const list = this.ui.levelList;
      list.textContent = '';
      LEVELS.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent =
          `${String(index + 1).padStart(2, '0')} - ${level.name.toUpperCase()}`;
        list.appendChild(option);
      });
    }

    setLevelSelection(index) {
      const list = this.ui.levelList;
      const clamped = clamp(index, 0, LEVELS.length - 1);
      list.value = String(clamped);
      list.selectedIndex = clamped;
      list.focus();
      const option = list.options && list.options[clamped];
      if (option && option.scrollIntoView) {
        option.scrollIntoView({ block: 'nearest' });
      }
    }

    openLevelSelect() {
      if (this.levelSelectOpen) return;
      if (this.notesOpen) this.closeNotes();
      this.levelSelectOpen = true;
      this.ui.levelSelect.classList.remove('hidden');
      this.ui.levelSelect.setAttribute('aria-hidden', 'false');
      this.suspendForModal();
      this.ui.levelList.value = String(this.levelIndex);
      this.ui.levelList.selectedIndex = this.levelIndex;
      this.ui.levelList.focus();
    }

    closeLevelSelect(recapture = false) {
      if (!this.levelSelectOpen) return;
      this.ui.levelSelect.classList.add('hidden');
      this.ui.levelSelect.setAttribute('aria-hidden', 'true');
      this.levelSelectOpen = false;
      this.resumeFromModal();
      if (recapture && !this.auto && this.canvas.requestPointerLock) {
        try {
          const lock = this.canvas.requestPointerLock();
          if (lock && lock.catch) lock.catch(() => {});
        } catch (error) {
          // Pointer lock may be unavailable; drag look still works.
        }
      }
    }

    toggleLevelSelect() {
      if (this.levelSelectOpen) this.closeLevelSelect();
      else this.openLevelSelect();
    }

    selectLevel(index) {
      if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) return;
      this.loadLevel(index);
      this.closeLevelSelect(true);
    }

    openNotes() {
      if (this.notesOpen) return;
      if (this.levelSelectOpen) this.closeLevelSelect();
      this.notesOpen = true;
      const level = this.level;
      this.ui.notesTitle.textContent =
        `SECTOR ${this.levelIndex + 1} - ${level.name.toUpperCase()}`;
      this.ui.notesSetting.textContent = level.description || '';
      this.ui.notesCreatures.textContent = level.creatureDescription || '';
      this.ui.notesItems.textContent = level.powerupDescription || '';
      this.ui.levelNotes.classList.remove('hidden');
      this.ui.levelNotes.setAttribute('aria-hidden', 'false');
      this.suspendForModal();
      this.ui.notesClose.focus();
    }

    closeNotes() {
      if (!this.notesOpen) return;
      this.notesOpen = false;
      this.ui.levelNotes.classList.add('hidden');
      this.ui.levelNotes.setAttribute('aria-hidden', 'true');
      this.resumeFromModal();
    }

    toggleNotes() {
      if (this.notesOpen) this.closeNotes();
      else this.openNotes();
    }

    completeLevel() {
      if (this.complete) return;
      this.complete = true;
      this.completeTimer = 0;
      this.player.velocityForward = 0;
      this.player.velocityStrafe = 0;
      this.player.turnVelocity = 0;
      this.showStatus('SECTOR COMPLETE - ADVANCING');
      this.audio.play('exit');
    }

    update(dt) {
      // World simulation is fully paused while any dialog is open (the
      // intro counts too), not just player motion.
      if (this.anyModalOpen()) return;

      this.elapsed += dt;
      this.creatures.update(dt);
      if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);
      if (this.overdriveTimer > 0) {
        this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
      }

      this.inversion += (this.inversionTarget - this.inversion) *
        (1 - Math.exp(-INVERSION_RESPONSE * dt));
      if (Math.abs(this.inversionTarget - this.inversion) < 0.002) {
        this.inversion = this.inversionTarget;
      }

      if (this.complete) {
        this.completeTimer += dt;
        if (this.completeTimer >= ADVANCE_DELAY) this.nextLevel(1);
        return;
      }

      if (this.slowTimer > 0) this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.reverseMouseTimer > 0) {
        this.reverseMouseTimer = Math.max(0, this.reverseMouseTimer - dt);
      }

      const player = this.player;
      const moveScale = (this.level.theme && this.level.theme.moveScale) || 1;
      const boost = this.boostTimer > 0 ? RULES.boostScale : 1;
      const slow = this.slowTimer > 0 ? RULES.slowScale : 1;
      let traveled = 0;

      if (this.auto) {
        traveled = this.autopilot.advance(player, dt,
          this.config.moveSpeed * moveScale * boost * slow,
          (x, y) => this.canStand(x, y));
        player.velocityForward = 0;
        player.velocityStrafe = 0;
        player.turnVelocity = 0;
        player.bob = 0;
      } else {
        const controls = this.input.sample();
        const mouseTurn = controls.mouseTurn *
          (this.reverseMouseTimer > 0 ? -1 : 1);
        const response = 1 - Math.exp(-this.config.acceleration * dt);
        const targetForward = controls.forward * this.config.moveSpeed *
          moveScale * boost * slow;
        const targetStrafe = controls.strafe * this.config.strafeSpeed *
          moveScale * boost * slow;
        player.velocityForward += (targetForward - player.velocityForward) * response;
        player.velocityStrafe += (targetStrafe - player.velocityStrafe) * response;
        player.turnVelocity += (controls.turn * this.config.turnSpeed -
          player.turnVelocity) * response;
        player.angle += player.turnVelocity * dt +
          mouseTurn * this.config.mouseSensitivity;

        const cos = Math.cos(player.angle);
        const sin = Math.sin(player.angle);
        const moveX = (cos * player.velocityForward -
          sin * player.velocityStrafe) * dt;
        const moveY = (sin * player.velocityForward +
          cos * player.velocityStrafe) * dt;
        const beforeX = player.x;
        const beforeY = player.y;
        if (moveX !== 0 && this.canStand(player.x + moveX, player.y)) {
          player.x += moveX;
        }
        if (moveY !== 0 && this.canStand(player.x, player.y + moveY)) {
          player.y += moveY;
        }
        traveled = Math.hypot(player.x - beforeX, player.y - beforeY);

        const speed = traveled / Math.max(dt, 1e-6);
        this.bobPhase += speed * dt * 4.4;
        const bobAmount = Math.min(1, speed / this.config.moveSpeed);
        player.bob = Math.sin(this.bobPhase) * 2.4 * bobAmount;
      }

      this.stepDistance += traveled;
      if (this.stepDistance >= 0.58) {
        this.stepDistance = 0;
        this.audio.play('step');
      }

      if (this.interactionsEnabled) {
        const contact = this.creatures.consumeContact(player, RULES.contactRadius);
        if (contact) this.applyCreatureContact(contact);
        this.updatePickups();
      }
      this.updateExit();
    }

    // A creature touch always produces the named effect; manual play also
    // takes the physical shove while autoplay holds its course.
    applyCreatureContact(contact) {
      const player = this.player;
      if (!this.auto) {
        const cdx = player.x - contact.x;
        const cdy = player.y - contact.y;
        const cd = Math.hypot(cdx, cdy) || 1;
        const nx = player.x + cdx / cd * RULES.knockbackDistance;
        const ny = player.y + cdy / cd * RULES.knockbackDistance;
        if (this.canStand(nx, ny)) {
          player.x = nx;
          player.y = ny;
        }
      }
      const name = contact.type
        .replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
      const effect = (Maze3D.CREATURE_EFFECTS || {})[contact.type] || 'bump';
      let effectText;
      if (effect === 'slow') {
        this.slowTimer = Math.max(this.slowTimer, RULES.slowDuration);
        this.audio.play('slow');
        effectText = `SLOWED ${RULES.slowDuration}S`;
      } else if (effect === 'reverse') {
        this.reverseMouseTimer = Math.max(
          this.reverseMouseTimer, RULES.reverseDuration);
        this.audio.play('reverse');
        effectText = `MOUSE LOOK REVERSED ${RULES.reverseDuration}S`;
      } else if (effect === 'boost') {
        this.boostTimer = Math.max(this.boostTimer, RULES.creatureBoostDuration);
        this.audio.play('boost');
        effectText = `SPEED BOOST ${RULES.creatureBoostDuration}S`;
      } else {
        if (!this.auto) {
          const fdx = contact.x - player.x;
          const fdy = contact.y - player.y;
          const c = Math.cos(player.angle);
          const s = Math.sin(player.angle);
          player.angle += (c * fdy - s * fdx >= 0 ? -1 : 1) * RULES.bumpTurn;
        }
        this.audio.play('bump');
        effectText = this.auto ? 'AUTO HOLDS COURSE' : 'KNOCKBACK';
      }
      this.pushFeed(`${name} - ${effectText}`, 'contact');
      this.flashEvent('contact');
    }

    updatePickups() {
      const player = this.player;
      for (const pickup of this.inversions) {
        if (pickup.consumed) continue;
        if (Math.hypot(pickup.x - player.x, pickup.y - player.y) <
            RULES.pickupRadius) {
          pickup.consumed = true;
          this.inversionTarget = this.inversionTarget === 1 ? 0 : 1;
          this.audio.play('inversion');
          this.pushFeed(this.inversionTarget === 1
            ? 'ANOMALY - WORLD ROLLED' : 'ANOMALY - WORLD RESTORED', 'anomaly');
          this.flashEvent('anomaly');
        }
      }

      for (const relic of this.relics) {
        if (relic.collected) continue;
        if (Math.hypot(relic.x - player.x, relic.y - player.y) <
            RULES.relicRadius) {
          relic.collected = true;
          this.relicsFound += 1;
          const relicName = (this.level.relicType || 'relic')
            .replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
          if (this.relicsFound >= this.relics.length) {
            this.boostTimer = Math.max(this.boostTimer, RULES.overdriveDuration);
            this.overdriveTimer = Math.max(
              this.overdriveTimer, RULES.overdriveDuration);
            this.audio.play('power');
            this.pushFeed(
              `${relicName} ${this.relicsFound}/${this.relics.length} - ` +
              `OVERDRIVE ${RULES.overdriveDuration}S`, 'relic');
          } else {
            this.boostTimer = Math.max(this.boostTimer, RULES.relicBoostDuration);
            this.audio.play('relic');
            this.pushFeed(
              `${relicName} ${this.relicsFound}/${this.relics.length} - ` +
              `BOOST ${RULES.relicBoostDuration}S`, 'relic');
          }
          this.flashEvent('relic');
          this.updateRelicLabel();
        }
      }
    }

    updateExit() {
      const player = this.player;
      const onExitTile =
        this.map[Math.floor(player.y)][Math.floor(player.x)] === TILES.EXIT;
      const nearExit = this.exit &&
        Math.hypot(this.exit.x + 0.5 - player.x, this.exit.y + 0.5 - player.y) <
          RULES.exitRadius;
      if (onExitTile || nearExit) {
        const exitBlocked = this.auto && this.autoSmart &&
          this.interactionsEnabled && this.autopilot.itemsPending;
        if (exitBlocked) {
          if (!this.exitWarned) {
            this.exitWarned = true;
            this.showStatus('FINISH RELICS + ANOMALIES BEFORE EXIT');
          }
        } else {
          this.completeLevel();
        }
      }
    }

    buildSprites() {
      const sprites = [];
      if (this.exit) {
        sprites.push({
          x: this.exit.x + 0.5,
          y: this.exit.y + 0.5,
          width: 0.9,
          height: 1.32,
          vertical: 0.16,
          kind: 'exit',
          image: this.textures.exit,
        });
      }
      for (const pickup of this.inversions) {
        if (pickup.consumed) continue;
        const pulse = Math.sin(this.elapsed * 3 + pickup.x) * 0.05;
        sprites.push({
          x: pickup.x,
          y: pickup.y,
          width: 0.46 + pulse,
          height: 0.46 + pulse,
          vertical: 0.04 + Math.sin(this.elapsed * 2.1 + pickup.y) * 0.07,
          kind: 'inversion',
          image: this.textures.inversion,
        });
      }
      this.relics.forEach((relic, i) => {
        if (relic.collected) return;
        sprites.push({
          x: relic.x,
          y: relic.y,
          width: 0.42,
          height: 0.42,
          vertical: 0.08 + Math.sin(this.elapsed * 2.2 + i * 1.7) * 0.06,
          kind: 'relic',
          image: this.textures.relics[this.level.relicType],
        });
      });
      return sprites.concat(this.creatures.getSprites(this.elapsed, this.textures));
    }

    updateHud(dt) {
      this.updateRelicLabel();
      if (this.statusTimer > 0) {
        this.statusTimer -= dt;
        return;
      }
      const minutes = Math.floor(this.elapsed / 60);
      const seconds = Math.floor(this.elapsed % 60);
      this.ui.statusLabel.textContent =
        `T+${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    frame(time) {
      const dt = Math.min(this.config.maxFrameTime,
        Math.max(0, (time - this.lastTime) / 1000));
      this.lastTime = time;
      if (!document.hidden) {
        this.update(dt);
        this.renderer.render({
          map: this.map,
          level: this.level,
          player: this.player,
          sprites: this.buildSprites(),
          elapsed: this.elapsed,
          inversion: this.inversion,
          showMap: this.showMap && this.showHUD,
        });
        this.updateHud(dt);
      }
      requestAnimationFrame(next => this.frame(next));
    }
  }

  Maze3D.Game = MazeGame;
  window.addEventListener('DOMContentLoaded', () => {
    Maze3D.game = new MazeGame();
  });
})();
