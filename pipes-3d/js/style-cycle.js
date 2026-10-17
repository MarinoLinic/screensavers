// Automatic colour-request timer. Pure module: no DOM/three imports so it
// runs under node --test. It only decides WHEN to ask the world for fresh
// colours — the engine picks the per-head tints itself.

/**
 * Counts wall-clock seconds while living-mode colour cycling is on and
 * pulses once per interval. Elapsed is runtime-only (never persisted);
 * reset it on manual style picks, toggle/interval/mode changes, reseeds
 * and new-pattern requests.
 */
export class StyleCycle {
  constructor() {
    this.elapsed = 0;
  }

  reset() {
    this.elapsed = 0;
  }

  /**
   * @returns true once per interval while autoCycle runs in living mode,
   *   else false. Disabled flag, classic mode or bad interval clear the
   *   timer; a nonpositive or nonfinite dt is ignored (elapsed is kept —
   *   pauses don't decay it).
   */
  step(dt, settings) {
    if (!settings || !settings.autoCycle || settings.mode !== 'living') {
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
    // One pulse per call even if dt overshot the interval; the remainder
    // carries over so cadence stays honest on slow frames.
    this.elapsed %= interval;
    return true;
  }
}
