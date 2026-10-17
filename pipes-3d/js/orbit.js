// Minimal hand-rolled orbit control: drag to orbit, wheel to zoom,
// double-click to reset, optional slow auto-rotate. No OrbitControls import so
// the vendored three build stays the only dependency.

export class OrbitCamera {
  constructor(camera, dom, { distance = 34, minDist = 14, maxDist = 80 } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.minDist = minDist;
    this.maxDist = maxDist;
    this.home = { yaw: 0.7, pitch: 0.42, dist: distance };
    this.yaw = this.home.yaw;
    this.pitch = this.home.pitch;
    this.dist = distance;
    this.autoRotate = true;
    this.autoSpeed = 0.11; // rad/s
    this.dragging = false;
    this._pid = null;
    this._px = 0;
    this._py = 0;
    this._moved = true; // camera state changed since last step()
    this._bind();
    this.update();
  }

  _bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return; // left button only
      if (this._pid !== null) return;
      this._pid = e.pointerId;
      this._px = e.clientX;
      this._py = e.clientY;
      this.dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* capture optional */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._pid) return;
      const dx = e.clientX - this._px;
      const dy = e.clientY - this._py;
      this._px = e.clientX;
      this._py = e.clientY;
      this.yaw += dx * 0.0052; // drag right orbits right
      this.pitch = Math.min(1.35, Math.max(-1.35, this.pitch + dy * 0.0052));
      this._moved = true;
      this.update();
    });
    const end = (e) => {
      if (e.pointerId === this._pid) {
        this._pid = null;
        this.dragging = false;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * Math.exp(e.deltaY * 0.001)));
        this._moved = true;
        this.update();
      },
      { passive: false }
    );
    el.addEventListener('dblclick', () => this.reset());
  }

  reset() {
    this.yaw = this.home.yaw;
    this.pitch = this.home.pitch;
    this.dist = this.home.dist;
    this._moved = true;
    this.update();
  }

  /** Refit home distance (e.g. aspect change) preserving the zoom ratio. */
  setHome(dist) {
    const ratio = this.dist / this.home.dist;
    this.home.dist = dist;
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, dist * ratio));
    this._moved = true;
    this.update();
  }

  /**
   * Advance auto-rotation and report whether the camera moved this frame
   * (drag/wheel/reset between frames also count). The app uses the return
   * value to skip renderer work while paused and still.
   */
  step(dt, allowAuto) {
    let moved = this._moved;
    this._moved = false;
    if (allowAuto && this.autoRotate && !this.dragging) {
      this.yaw += this.autoSpeed * dt;
      moved = true;
    }
    if (moved) this.update();
    return moved;
  }

  update() {
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      Math.cos(this.yaw) * cp * this.dist,
      Math.sin(this.pitch) * this.dist,
      Math.sin(this.yaw) * cp * this.dist
    );
    this.camera.lookAt(0, 0, 0);
  }
}
