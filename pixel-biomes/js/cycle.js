// Automatic habitat-tour timer. Pure module: no DOM imports so it runs
// under node --test. It only decides WHEN to advance to the next habitat —
// the app applies the switch itself.
//
// The countdown runs on wall-clock seconds passed in by the caller, is
// independent of the simulation speed setting, and is runtime-only (never
// persisted). Pausing is handled by the caller simply not calling step() —
// elapsed is kept across nonpositive/invalid dt so a pause doesn't decay it.
export class TourCycle {
  constructor() {
    this.elapsed = 0;
  }

  reset() {
    this.elapsed = 0;
  }

  /** Seconds until the next pulse, or null when touring is off. */
  remaining(settings) {
    if (!settings || !settings.autoCycle) return null;
    const interval = Number(settings.cycleInterval);
    if (!Number.isFinite(interval) || interval <= 0) return null;
    return Math.max(0, interval - this.elapsed);
  }

  /**
   * @returns true once per interval while autoCycle is on, else false.
   *   Disabled flag or bad interval clear the timer; a nonpositive or
   *   nonfinite dt is ignored (elapsed is kept).
   */
  step(dt, settings) {
    if (!settings || !settings.autoCycle) {
      this.elapsed = 0;
      return false;
    }
    const interval = Number(settings.cycleInterval);
    if (!Number.isFinite(interval) || interval <= 0) {
      this.elapsed = 0;
      return false;
    }
    if (!Number.isFinite(dt) || dt <= 0) return false;
    this.elapsed += dt;
    if (this.elapsed < interval) return false;
    // One pulse per call even if dt overshot; the remainder carries over so
    // cadence stays honest on slow frames.
    this.elapsed %= interval;
    return true;
  }
}
