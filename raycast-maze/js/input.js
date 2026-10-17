(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space',
  ]);

  class InputController {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.touch = new Set();
      this.mouseDX = 0;
      this.dragging = false;
      this.lastDragX = 0;
      // Set by the game while any modal is open; gameplay input is ignored.
      this.suspended = false;
      // Set by the game in autoplay: pointer lock is never requested.
      this.pointerLockBlocked = false;

      this.onKeyDown = event => {
        if (this.suspended || this.pointerLockBlocked) return;
        if (!GAME_KEYS.has(event.code)) return;
        if (Maze3D.isEditableTarget(event.target)) return;
        event.preventDefault();
        this.keys.add(event.code);
      };
      this.onKeyUp = event => {
        this.keys.delete(event.code);
      };
      this.onBlur = () => this.clear();
      this.onVisibility = () => {
        if (document.hidden) this.clear();
      };

      this.onCanvasClick = () => {
        if (this.suspended || this.pointerLockBlocked) return;
        if (document.pointerLockElement !== this.canvas &&
            this.canvas.requestPointerLock) {
          try {
            const result = this.canvas.requestPointerLock();
            if (result && result.catch) result.catch(() => {});
          } catch (error) {
            // Pointer lock unavailable (e.g. file:// or headless); drag look still works.
          }
        }
      };
      this.onMouseMove = event => {
        if (this.suspended || this.pointerLockBlocked) return;
        if (document.pointerLockElement === this.canvas) {
          this.mouseDX += event.movementX || 0;
        } else if (this.dragging) {
          this.mouseDX += event.clientX - this.lastDragX;
          this.lastDragX = event.clientX;
        }
      };
      this.onMouseDown = event => {
        if (this.suspended || this.pointerLockBlocked) return;
        if (event.button !== undefined && event.button !== 0) return;
        if (document.pointerLockElement !== this.canvas) {
          this.dragging = true;
          this.lastDragX = event.clientX;
        }
      };
      this.onMouseUp = () => {
        this.dragging = false;
      };

      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      document.addEventListener('visibilitychange', this.onVisibility);
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
      canvas.addEventListener('click', this.onCanvasClick);
      canvas.addEventListener('mousedown', this.onMouseDown);

      this.bindTouchControls();
    }

    bindTouchControls() {
      this.touchBindings = [];
      const buttons = document.querySelectorAll('[data-action]');
      buttons.forEach(button => {
        const action = button.getAttribute('data-action');
        const press = event => {
          event.preventDefault();
          if (this.suspended || this.pointerLockBlocked) return;
          if (event.pointerId !== undefined && button.setPointerCapture) {
            try { button.setPointerCapture(event.pointerId); } catch (error) {}
          }
          this.touch.add(action);
        };
        const release = event => {
          if (event && event.preventDefault) event.preventDefault();
          this.touch.delete(action);
        };
        button.addEventListener('pointerdown', press);
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('pointerleave', release);
        this.touchBindings.push({ button, press, release });
      });
    }

    sample() {
      // While a modal is up or autoplay drives, input stays neutral and any
      // stale keys/mouse deltas/touch state are dropped so leaving the mode
      // never produces a deferred movement or camera jump.
      if (this.suspended || this.pointerLockBlocked) {
        this.clear();
        return { forward: 0, strafe: 0, turn: 0, mouseTurn: 0, manual: false };
      }
      let forward = 0;
      let strafe = 0;
      let turn = 0;

      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
      if (this.keys.has('KeyD')) strafe += 1;
      if (this.keys.has('KeyA')) strafe -= 1;
      if (this.keys.has('ArrowRight')) turn += 1;
      if (this.keys.has('ArrowLeft')) turn -= 1;

      if (this.touch.has('forward')) forward += 1;
      if (this.touch.has('backward')) forward -= 1;
      if (this.touch.has('strafe-right')) strafe += 1;
      if (this.touch.has('strafe-left')) strafe -= 1;
      if (this.touch.has('right')) turn += 1;
      if (this.touch.has('left')) turn -= 1;

      forward = Math.max(-1, Math.min(1, forward));
      strafe = Math.max(-1, Math.min(1, strafe));
      turn = Math.max(-1, Math.min(1, turn));
      if (forward !== 0 && strafe !== 0) {
        forward *= Math.SQRT1_2;
        strafe *= Math.SQRT1_2;
      }

      const mouseTurn = this.mouseDX;
      this.mouseDX = 0;

      const manual = forward !== 0 || strafe !== 0 || turn !== 0 || mouseTurn !== 0;
      return { forward, strafe, turn, mouseTurn, manual };
    }

    clear() {
      this.keys.clear();
      this.touch.clear();
      this.mouseDX = 0;
      this.dragging = false;
    }

    destroy() {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      document.removeEventListener('visibilitychange', this.onVisibility);
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseUp);
      this.canvas.removeEventListener('click', this.onCanvasClick);
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.touchBindings.forEach(({ button, press, release }) => {
        button.removeEventListener('pointerdown', press);
        button.removeEventListener('pointerup', release);
        button.removeEventListener('pointercancel', release);
        button.removeEventListener('pointerleave', release);
      });
    }
  }

  Maze3D.InputController = InputController;
})();
