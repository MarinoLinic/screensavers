// PipeWorld: pure lattice-growth simulation, no DOM/three dependencies.
//
// Integer cubic lattice centered on the origin, 6 axis directions. Each path
// owns an ordered list of occupied cells; growth proceeds by weighted picks
// among free in-bounds neighbors, favoring continuation per the `bends`
// setting. Paths never reverse and never share a cell.
//
// Every in-flight step is `pending = {from, to, dir, progress, next}` where
// `next = {to, dir} | null` is a one-cell lookahead reservation: both
// pending.to and next.to are owned by the path, so the renderer always knows
// whether the growing tip will bend or cap before it arrives — no elbow pop.
//
// Lifecycle modes:
//   'living'  — at the density budget (or age limit, or slot pressure) the
//               oldest path retires: finished paths fade immediately, active
//               heads finish their in-flight segment first (retireRequested)
//               so the last bend stays put. Strictly one retirement at a time.
//   'classic' — at the density budget the whole scene fades, then reseeds.

import { Rng } from './rng.js';

export const DIRS = Object.freeze([
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]);
export const OPPOSITE = Object.freeze([1, 0, 3, 2, 5, 4]);
export const DIR_NAMES = Object.freeze(['+x', '-x', '+y', '-y', '+z', '-z']);

export const ENGINE_DEFAULTS = Object.freeze({
  dimension: 21,      // lattice edge length in cells (odd -> centered origin)
  fadeTime: 4.5,      // seconds for a path to fade out
  maxAge: 240,        // seconds before a path becomes retire-eligible
  maxPaths: 64,       // hard bound on live path objects (active + finished + fading)
  maxPathCells: 128,  // hard cap on committed cells per path
  baseRate: 4.5,      // cells/second at speed = 1
  paletteSize: 6,
  prewarmSteps: 160,  // instant commits so the scene is populated on load
  maxDt: 0.25,        // clamp on a single step's elapsed time (tab-return guard)
});

const ACTIVE = 'active';
const FINISHED = 'finished';
const FADING = 'fading';

export class PipeWorld {
  /**
   * @param {object} settings  validated user settings (mode, speed, pipeCount,
   *                           bends, density, seed)
   * @param {object} [opts]    ENGINE_DEFAULTS overrides (tests use small grids)
   */
  constructor(settings, opts = {}) {
    const cfg = { ...ENGINE_DEFAULTS, ...opts };
    this.cfg = cfg;
    this.dim = cfg.dimension;
    this.half = Math.floor(this.dim / 2); // coords in [-half, +half]
    this.totalCells = this.dim ** 3;
    this.settings = { ...settings };
    this.baseSeed = settings.seed >>> 0;
    this.seedCount = 0;
    this._reset(this.baseSeed);
  }

  _reset(seed) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    // Visual-only colour stream: salted so pulse picks never perturb the
    // physics rng — geometry is identical with colour requests on or off.
    this.colorRng = new Rng(this.seed ^ 0x85ebca6b);
    this.occupancy = new Map(); // cellKey -> pathId (includes reserved pending tips)
    this.paths = new Map();     // id -> path
    this.nextPathId = 1;
    this.time = 0;
    this.resetting = false;
    this.tintCursor = -1; // spreads palette hues across consecutive spawns
    this.stats = { spawned: 0, retired: 0, cycles: 0, commits: 0 };
    this.events = [];
    this._replenish();
    if (this.cfg.prewarmSteps > 0) this.prewarm(this.cfg.prewarmSteps);
  }

  /** New deterministic run from an explicit seed. */
  reseed(seed) {
    this.baseSeed = seed >>> 0;
    this.seedCount = 0;
    this._reset(this.baseSeed);
    this.settings.seed = this.seed; // engine copy stays in agreement
    this.events.push({ type: 'reset', seed: this.seed });
  }

  /** Next pattern: baseSeed + 1, wrapping inside the supported seed range. */
  reseedNext() {
    this.reseed((this.baseSeed + 1) % 2147483648);
  }

  /**
   * Live settings merge. Lowering pipeCount immediately finishes the excess
   * NEWEST active heads (they stay as sculpture until aged/density-retired);
   * raising it just lets _replenish add heads on the next steps.
   */
  updateSettings(next) {
    const prevTarget = this.settings.pipeCount;
    this.settings = { ...this.settings, ...next };
    const target = this.settings.pipeCount;
    if (target < prevTarget) {
      const actives = [];
      for (const p of this.paths.values()) if (p.state === ACTIVE) actives.push(p);
      actives.sort((a, b) => b.bornAt - a.bornAt); // newest first
      for (let i = 0; i < actives.length - target; i++) this._finish(actives[i]);
    }
  }

  _key(x, y, z) {
    return (x + this.half) * this.dim * this.dim + (y + this.half) * this.dim + (z + this.half);
  }

  inBounds(c) {
    return c[0] >= -this.half && c[0] <= this.half &&
           c[1] >= -this.half && c[1] <= this.half &&
           c[2] >= -this.half && c[2] <= this.half;
  }

  cellKey(c) {
    return this._key(c[0], c[1], c[2]);
  }

  _isFree(c) {
    return this.inBounds(c) && !this.occupancy.has(this.cellKey(c));
  }

  get densityBudget() {
    return Math.max(1, Math.floor(this.settings.density * this.totalCells));
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  // ---------------------------------------------------------------- growth

  _freeNeighbors(c, lastDir) {
    const out = [];
    for (let d = 0; d < 6; d++) {
      if (lastDir >= 0 && d === OPPOSITE[lastDir]) continue;
      const n = [c[0] + DIRS[d][0], c[1] + DIRS[d][1], c[2] + DIRS[d][2]];
      if (this._isFree(n)) out.push({ dir: d, cell: n });
    }
    return out;
  }

  /**
   * Weighted pick among free neighbors of `cur` (never reversing `lastDir`),
   * reserving the chosen cell for `path`. Returns {dir, cell} or null.
   */
  _chooseNext(path, cur, lastDir) {
    const options = this._freeNeighbors(cur, lastDir);
    if (options.length === 0) return null;
    const bends = this.settings.bends;
    const wContinue = 1 + (1 - bends) * 9; // bends=0 strongly prefers straight
    const wTurn = 1 + bends * 4;           // bends=1 mildly prefers turning
    const pick = this.rng.weighted(
      options.map((o) => ({ v: o, w: o.dir === lastDir ? wContinue : wTurn }))
    );
    this.occupancy.set(this.cellKey(pick.cell), path.id);
    return pick;
  }

  /** Reserve the one-cell lookahead for a pending step (null when capped/blocked). */
  _extendPending(path, pending) {
    // pending.to commits at cells.length+1, next.to at cells.length+2 — only
    // reserve when both stay inside the per-path cell cap.
    if (path.cells.length + 2 <= this.cfg.maxPathCells) {
      const pick = this._chooseNext(path, pending.to, pending.dir);
      if (pick) pending.next = { to: pick.cell, dir: pick.dir };
    }
  }

  /** Create the pending step leaving the path's current tip cell. */
  _planPending(path) {
    if (path.cells.length >= this.cfg.maxPathCells) return null;
    const cur = path.cells[path.cells.length - 1];
    const lastDir = path.dirs.length ? path.dirs[path.dirs.length - 1] : -1;
    const pick = this._chooseNext(path, cur, lastDir);
    if (!pick) return null;
    const pending = {
      from: cur.slice(), to: pick.cell, dir: pick.dir, progress: 0,
      next: null, tint: path.growthTint, // colour queued at plan time
    };
    this._extendPending(path, pending);
    return pending;
  }

  _spawn() {
    if (this.paths.size >= this.cfg.maxPaths) return false;
    const cell = this._randomFreeCell(true);
    if (!cell) return false;
    const id = this.nextPathId++;
    const size = this.cfg.paletteSize;
    // seeded start, then round-robin +1 so consecutive pipes never share a hue
    this.tintCursor = this.tintCursor < 0 ? this.rng.int(size) : (this.tintCursor + 1) % size;
    const path = {
      id,
      tint: this.tintCursor,
      growthTint: this.tintCursor, // colour queued for the NEXT segment
      tints: [],                 // committed colour per segment (bands)
      cells: [cell],
      dirs: [],
      pending: null,
      state: ACTIVE,
      fade: 0,
      bornAt: this.time,
      finishedAt: Infinity,
      retireRequested: false,
      terminalDir: null,
    };
    this.paths.set(id, path);
    this.occupancy.set(this.cellKey(cell), id);
    path.pending = this._planPending(path); // may be null -> single-cell stub
    if (!path.pending) this._finish(path);
    this.stats.spawned++;
    this.events.push({ type: 'spawn', path });
    return true;
  }

  _randomFreeCell(preferOpen) {
    // bounded rejection sampling first (deterministic), full scan as fallback
    for (let i = 0; i < 64; i++) {
      const c = [
        -this.half + this.rng.int(this.dim),
        -this.half + this.rng.int(this.dim),
        -this.half + this.rng.int(this.dim),
      ];
      if (this._isFree(c) && (!preferOpen || this._freeNeighbors(c, -1).length > 0)) {
        return c;
      }
    }
    const free = [];
    const open = [];
    for (let x = -this.half; x <= this.half; x++) {
      for (let y = -this.half; y <= this.half; y++) {
        for (let z = -this.half; z <= this.half; z++) {
          const c = [x, y, z];
          if (this._isFree(c)) {
            free.push(c);
            if (this._freeNeighbors(c, -1).length > 0) open.push(c);
          }
        }
      }
    }
    const pool = preferOpen && open.length ? open : free;
    return pool.length ? pool[this.rng.int(pool.length)] : null;
  }

  /** Release pending.to and pending.next.to reservations, if any. */
  _dropPending(path) {
    if (!path.pending) return;
    this.occupancy.delete(this.cellKey(path.pending.to));
    if (path.pending.next) this.occupancy.delete(this.cellKey(path.pending.next.to));
    path.pending = null;
  }

  /**
   * Immediate finish (shrink/emergency/tests): drops both reservations so the
   * renderer re-plans the tail into a clean cap — no dangling elbow.
   */
  _finish(path) {
    if (path.state !== ACTIVE) return;
    this._dropPending(path);
    path.retireRequested = false;
    path.terminalDir = null;
    path.state = FINISHED;
    path.finishedAt = this.time;
    this.events.push({ type: 'finish', pathId: path.id });
  }

  /** Begin the fade for a finished or gracefully-ended active path. */
  _beginFade(path) {
    if (path.state !== ACTIVE && path.state !== FINISHED) return;
    this._dropPending(path);
    path.retireRequested = false;
    path.state = FADING;
    path.fade = 0;
    this.stats.retired++;
    this.events.push({ type: 'fade', pathId: path.id });
  }

  _commit(path) {
    const p = path.pending;
    path.cells.push(p.to);
    path.dirs.push(p.dir);
    path.tints.push(p.tint); // the segment keeps the colour it grew with
    this.stats.commits++;
    // Cell events are a hint; renderers reconcile by comparing drawn counts,
    // so it is safe to drop them when an undrained backlog grows absurdly
    // (long headless runs). Lifecycle events are rare and always kept.
    if (this.events.length < 4096) this.events.push({ type: 'cell', path });

    if (path.retireRequested) {
      // Graceful retirement: the final step lands for real. If the lookahead
      // had pre-formed an elbow at this cell, keep it via terminalDir and cap
      // at its outgoing tangent; release the now-unused lookahead cell.
      if (p.next) {
        this.occupancy.delete(this.cellKey(p.next.to));
        path.terminalDir = p.next.dir !== p.dir ? p.next.dir : null;
      } else {
        path.terminalDir = null;
      }
      path.pending = null;
      path.retireRequested = false;
      this._beginFade(path);
      return;
    }

    if (p.next) {
      // Transfer the lookahead reservation into the new pending step — the
      // cell was already chosen and owned, never re-rolled — then reserve the
      // next-next cell so the coming tip knows its own bend in advance.
      path.pending = {
        from: p.to, to: p.next.to, dir: p.next.dir, progress: 0,
        next: null, tint: path.growthTint, // picks up any queued colour
      };
      this._extendPending(path, path.pending);
    } else {
      // Blocked or length-capped: this was planned in advance (next === null),
      // so the preview and the committed cap already agree.
      path.pending = null;
      this._finish(path);
    }
  }

  _release(path) {
    this._dropPending(path);
    for (const c of path.cells) this.occupancy.delete(this.cellKey(c));
    this.paths.delete(path.id);
    this.events.push({ type: 'remove', pathId: path.id });
  }

  // ---------------------------------------------------------------- step

  step(dt) {
    if (!(dt > 0)) return; // zero/negative dt = paused; NaN safe
    const d = Math.min(dt, this.cfg.maxDt);
    this.time += d;
    const rate = this.cfg.baseRate * this.settings.speed;

    for (const path of this.paths.values()) {
      if (path.state === ACTIVE) {
        if (path.retireRequested && !path.pending) {
          this._beginFade(path); // safety: a retiring head without work fades now
        } else if (path.pending) {
          path.pending.progress += rate * d;
          while (path.pending && path.pending.progress >= 1) {
            const rem = path.pending.progress - 1;
            this._commit(path);
            if (path.pending) path.pending.progress = rem;
          }
        }
      }
      if (path.state === FADING) {
        path.fade += d / this.cfg.fadeTime;
        if (path.fade >= 1) this._release(path);
      }
    }

    if (this.settings.mode === 'classic') {
      this._stepClassic();
    } else {
      this._stepLiving();
    }
  }

  _stepLiving() {
    // Triggers: soft density pressure, pipes older than maxAge, and slot
    // pressure — when spare path slots approach the pipeCount deficit while
    // heads are missing, retire early so replenish never stalls. Retirement is
    // strictly one-at-a-time: while a path is fading OR finishing its last
    // segment (retireRequested) nothing else begins retiring, so occupancy may
    // transiently overshoot the soft budget — the lattice is the hard bound.
    let active = 0, aged = false;
    for (const p of this.paths.values()) {
      if (p.state === FADING || p.retireRequested) continue;
      if (p.state === ACTIVE) active++;
      if (this.time - p.bornAt > this.cfg.maxAge) aged = true;
    }
    const overBudget = this.occupancy.size >= this.densityBudget;
    const slotPressure = this.paths.size >= this.cfg.maxPaths - this.settings.pipeCount;
    const starved = active < this.settings.pipeCount &&
      (slotPressure || this.occupancy.size >= this.totalCells);
    if (overBudget || aged || starved) this._retireOne();
    // Replenish runs unconditionally — new heads spawn into free slots while a
    // previous fade is still draining, so growth never waits for a release.
    this._replenish();
  }

  /**
   * Retire a single path: the oldest FINISHED pipe (born/id tiebreak) fades
   * immediately; only when none exist does the oldest ACTIVE head get marked
   * retireRequested — it completes its in-flight segment, then fades.
   * No-op while a retirement of any phase is already in flight.
   */
  _retireOne() {
    let retiring = false;
    let oldestFinished = null;
    let oldestActive = null;
    const older = (a, b) => a.bornAt !== b.bornAt ? a.bornAt < b.bornAt : a.id < b.id;
    for (const path of this.paths.values()) {
      if (path.state === FADING || path.retireRequested) { retiring = true; continue; }
      if (path.state === FINISHED) {
        if (!oldestFinished || older(path, oldestFinished)) oldestFinished = path;
      } else if (path.state === ACTIVE) {
        if (!oldestActive || older(path, oldestActive)) oldestActive = path;
      }
    }
    if (retiring) return;
    const target = oldestFinished || oldestActive;
    if (!target) return;
    if (target.state === FINISHED || !target.pending) {
      this._beginFade(target);
    } else {
      target.retireRequested = true;
    }
  }

  _stepClassic() {
    if (!this.resetting) {
      let active = 0;
      for (const p of this.paths.values()) if (p.state === ACTIVE) active++;
      const noRoom =
        this.paths.size >= this.cfg.maxPaths || this.occupancy.size >= this.totalCells;
      const stalled = active === 0 && noRoom; // no heads and nowhere to spawn
      if (this.occupancy.size < this.densityBudget && !stalled) {
        this._replenish(); // below budget: keep replacing finished heads
        return;
      }
      this.resetting = true;
      for (const path of this.paths.values()) {
        if (path.state === ACTIVE) this._finish(path);
        if (path.state === FINISHED) {
          path.state = FADING;
          path.fade = 0;
          this.events.push({ type: 'fade', pathId: path.id });
        }
      }
    }
    if (this.resetting && this.paths.size === 0) {
      this.resetting = false;
      this.stats.cycles++;
      this.seedCount++;
      this.seed = (this.baseSeed + this.seedCount) % 2147483648; // stay in supported seed range
      this.rng = new Rng(this.seed);
      this.colorRng = new Rng(this.seed ^ 0x85ebca6b);
      // Colour cycling in classic mode happens only here: each fresh scene
      // starts from a random palette phase instead of continuing the
      // round-robin. With autoCycle off the cursor rolls on as before.
      if (this.settings.autoCycle) {
        this.tintCursor = this.colorRng.int(this.cfg.paletteSize);
      }
      this.events.push({ type: 'reset', seed: this.seed, cycle: this.stats.cycles });
      this._replenish();
      this.prewarm(Math.min(24, this.cfg.prewarmSteps)); // never an empty box
    }
  }

  _replenish() {
    if (this.resetting) return;
    let active = 0;
    for (const p of this.paths.values()) if (p.state === ACTIVE) active++;
    // Hard bound: paths.size counts every retained path including the one
    // mid-fade — new heads spawn only while a slot is free.
    let guard = this.cfg.maxPaths;
    while (active < this.settings.pipeCount && this.paths.size < this.cfg.maxPaths && guard-- > 0) {
      if (!this._spawn()) break;
      active++;
    }
  }

  /**
   * Queue a new colour for every actively growing head — applied at the next
   * segment boundary, never mid-segment and never retroactively. Each head
   * gets its own roll from the visual-only colour stream, guaranteed
   * different from its queued colour. Returns how many heads queued a change.
   * No-op (0) when autoCycle is off or the mode is classic.
   */
  requestColorChange() {
    if (!this.settings.autoCycle || this.settings.mode !== 'living') return 0;
    const size = this.cfg.paletteSize;
    if (size <= 1) return 0;
    let changed = 0;
    for (const path of this.paths.values()) {
      if (path.state !== ACTIVE || !path.pending || path.retireRequested) {
        continue;
      }
      const old = path.growthTint;
      const pick = this.colorRng.int(size - 1);
      path.growthTint = pick >= old ? pick + 1 : pick;
      changed++;
    }
    return changed;
  }

  /** Instant commits so a fresh scene is already populated (deterministic). */
  prewarm(steps) {
    for (let i = 0; i < steps; i++) {
      let grew = false;
      for (const path of this.paths.values()) {
        if (path.state === ACTIVE && path.pending) {
          this._commit(path);
          grew = true;
        }
      }
      this._replenish();
      if (!grew) break;
    }
  }

  // ---------------------------------------------------------------- inspect

  counts() {
    let active = 0, finished = 0, fading = 0;
    for (const p of this.paths.values()) {
      if (p.state === ACTIVE) active++;
      else if (p.state === FINISHED) finished++;
      else fading++;
    }
    return {
      occupied: this.occupancy.size,
      budget: this.densityBudget,
      total: this.totalCells,
      paths: this.paths.size,
      active, finished, fading,
      retired: this.stats.retired,
      cycles: this.stats.cycles,
      spawned: this.stats.spawned,
      seed: this.seed,
      time: this.time,
    };
  }

  /** Deterministic state fingerprint for replay tests. */
  serialize() {
    const parts = [];
    for (const p of this.paths.values()) {
      const pend = p.pending
        ? `${p.pending.to.join(',')}/${p.pending.dir}@${p.pending.tint}` +
          (p.pending.next ? `>${p.pending.next.to.join(',')}/${p.pending.next.dir}` : '')
        : '-';
      parts.push(
        `${p.id}:${p.tint}:${p.growthTint}:${p.state}:` +
        `${p.cells.map((c) => c.join(',')).join(';')}` +
        `|${p.dirs.join(',')}|${p.tints.join(',')}|${pend}` +
        `|${p.terminalDir ?? ''}|${p.retireRequested ? 1 : 0}`
      );
    }
    parts.sort();
    return parts.join('\n');
  }
}
