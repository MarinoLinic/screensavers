// Auto navigation. Two brains share one strict centerline walker:
// Wander picks exploratory targets weighted by visit history (never the
// exit), Smart BFS-routes to the nearest uncollected relic or anomaly and
// then the exit. Movement is exact: recenter onto the current cell center,
// turn in place to a cardinal heading, then advance along that axis only.
(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};
  const CONFIG = Maze3D.CONFIG;

  const HISTORY_SIZE = 4;
  const PREFER_MIN = 7;
  const PREFER_MAX = 16;
  const RANGE_CENTER = 11;
  const EPSILON = 1e-4;
  const ALIGN_EPSILON = 1e-6;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const normAngle = angle => {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  };

  class AutoPilot {
    constructor(config) {
      this.config = config || CONFIG;
      this.route = [];
      this.routeIndex = 0;
      this.target = null;
      this.phase = 'recenter';
      this.smart = false;
      this.items = null;
      this.interact = true;
      this.itemsPending = false;
    }

    reset(map, start, exit, seed, options) {
      this.map = map;
      this.width = map[0].length;
      this.height = map.length;
      this.exitKey = exit
        ? Math.floor(exit.y) * this.width + Math.floor(exit.x)
        : -1;
      this.exit = exit || null;
      this.rngState = (seed >>> 0) || 0x2f6e2b1;
      this.visitCounts = new Uint16Array(this.width * this.height);
      this.lastCellKey = -1;
      this.targetHistory = [];
      this.target = null;
      this.route = [];
      this.routeIndex = 0;
      this.phase = 'recenter';
      this.smart = !!(options && options.smart);
      this.items = (options && options.items) || null;
      this.interact = !options || options.interact !== false;
      this.itemsPending = this.smart && this.interact &&
        this.pendingItems().length > 0;
      if (start) {
        start.velocityForward = 0;
        start.velocityStrafe = 0;
        start.turnVelocity = 0;
        start.bob = 0;
        this.markPosition(start);
      }
    }

    // Live option refresh (mode or interactions toggled): forces a retarget.
    configure(options) {
      if (options && Object.hasOwn(options, 'smart')) {
        this.smart = !!options.smart;
      }
      if (options && Object.hasOwn(options, 'items')) {
        this.items = options.items;
      }
      if (options && Object.hasOwn(options, 'interact')) {
        this.interact = options.interact !== false;
      }
      this.target = null;
      this.route = [];
      this.routeIndex = 0;
      this.itemsPending = this.smart && this.interact &&
        this.pendingItems().length > 0;
    }

    random() {
      this.rngState = (Math.imul(this.rngState, 1664525) + 1013904223) >>> 0;
      return this.rngState / 4294967296;
    }

    key(cellX, cellY) {
      return cellY * this.width + cellX;
    }

    passable(cellX, cellY) {
      return !Maze3D.isWallCell(this.map, cellX, cellY);
    }

    markPosition(player) {
      const key = this.key(Math.floor(player.x), Math.floor(player.y));
      if (key !== this.lastCellKey) {
        if (this.visitCounts[key] < 65535) this.visitCounts[key] += 1;
        this.lastCellKey = key;
      }
    }

    bfsDistances(startX, startY) {
      const dist = new Int32Array(this.width * this.height).fill(-1);
      const queue = [this.key(startX, startY)];
      dist[queue[0]] = 0;
      for (let head = 0; head < queue.length; head += 1) {
        const cell = queue[head];
        const cx = cell % this.width;
        const cy = (cell / this.width) | 0;
        const next = dist[cell] + 1;
        const neighbors = [
          [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
          const k = this.key(nx, ny);
          if (k < 0 || k >= dist.length) continue;
          if (dist[k] === -1 && this.passable(nx, ny)) {
            dist[k] = next;
            queue.push(k);
          }
        }
      }
      return dist;
    }

    // Shortest path as adjacent cell centers; never smoothed or skipped.
    buildRoute(fromX, fromY, toX, toY) {
      const dist = this.bfsDistances(toX, toY);
      if (dist[this.key(fromX, fromY)] <= 0) return [];
      const cells = [];
      let cx = fromX;
      let cy = fromY;
      while (!(cx === toX && cy === toY)) {
        const current = dist[this.key(cx, cy)];
        const neighbors = [
          [cx + 1, cy], [cx, cy + 1], [cx - 1, cy], [cx, cy - 1],
        ];
        let moved = false;
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
          const next = dist[this.key(nx, ny)];
          if (next !== -1 && next < current) {
            cx = nx;
            cy = ny;
            moved = true;
            break;
          }
        }
        if (!moved) return [];
        cells.push({ x: cx + 0.5, y: cy + 0.5 });
      }
      return cells;
    }

    pendingItems() {
      if (!this.items) return [];
      const pending = [];
      for (const relic of this.items.relics || []) {
        if (!relic.collected) pending.push(relic);
      }
      for (const anomaly of this.items.anomalies || []) {
        if (!anomaly.consumed) pending.push(anomaly);
      }
      return pending;
    }

    // Nearest reachable pending pickup by BFS distance; deterministic ties by
    // cell key. Falls back to the exit once nothing remains to consume.
    chooseSmartTarget(player) {
      const cx = Math.floor(player.x);
      const cy = Math.floor(player.y);
      const dist = this.bfsDistances(cx, cy);
      const reachablePending = [];
      if (this.interact) {
        for (const item of this.pendingItems()) {
          const k = this.key(Math.floor(item.x), Math.floor(item.y));
          if (dist[k] !== -1) {
            reachablePending.push({ item, d: dist[k], k });
          }
        }
      }
      this.itemsPending = reachablePending.length > 0;
      let best = null;
      for (const { item, d, k } of reachablePending) {
        if (!best || d < best.d || (d === best.d && k < best.k)) {
          best = { item, d, k };
        }
      }
      if (best) {
        return { x: Math.floor(best.item.x), y: Math.floor(best.item.y) };
      }
      if (this.exit && dist[this.exitKey] > 0) {
        return { x: Math.floor(this.exit.x), y: Math.floor(this.exit.y) };
      }
      return null;
    }

    chooseTarget(player) {
      const cx = Math.floor(player.x);
      const cy = Math.floor(player.y);
      const dist = this.bfsDistances(cx, cy);
      const currentKey = this.key(cx, cy);
      const history = new Set(this.targetHistory);

      const scoreCell = (x, y, discourageHistory) => {
        const k = this.key(x, y);
        const visits = this.visitCounts[k];
        const heading = Math.cos(normAngle(
          Math.atan2(y + 0.5 - player.y, x + 0.5 - player.x) - player.angle));
        const rangePenalty = Math.abs(dist[k] - RANGE_CENTER) * 1.5;
        let score = -visits * 40 - rangePenalty + heading * 8 + this.random() * 2;
        if (discourageHistory && history.has(k)) score -= 60;
        return score;
      };

      let best = null;
      let bestScore = -Infinity;
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const k = this.key(x, y);
          const d = dist[k];
          if (d < PREFER_MIN || d > PREFER_MAX) continue;
          if (k === currentKey || k === this.exitKey || history.has(k)) continue;
          const score = scoreCell(x, y, false);
          if (score > bestScore) { bestScore = score; best = { x, y }; }
        }
      }
      if (best) return best;

      // Fallback: any reachable cell except current/exit; history discouraged.
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const k = this.key(x, y);
          if (dist[k] <= 0 || k === currentKey || k === this.exitKey) continue;
          const score = scoreCell(x, y, true);
          if (score > bestScore) { bestScore = score; best = { x, y }; }
        }
      }
      return best;
    }

    retireTarget() {
      if (this.target) {
        this.targetHistory.push(this.key(this.target.x, this.target.y));
        if (this.targetHistory.length > HISTORY_SIZE) this.targetHistory.shift();
        this.target = null;
      }
    }

    replan(player) {
      this.route = this.target
        ? this.buildRoute(
            Math.floor(player.x), Math.floor(player.y),
            this.target.x, this.target.y)
        : [];
      this.routeIndex = 0;
      if (this.route.length === 0) this.retireTarget();
    }

    acquireTarget(player) {
      this.retireTarget();
      this.target = this.smart
        ? this.chooseSmartTarget(player)
        : this.chooseTarget(player);
      this.route = this.target
        ? this.buildRoute(
            Math.floor(player.x), Math.floor(player.y),
            this.target.x, this.target.y)
        : [];
      this.routeIndex = 0;
      if (this.route.length === 0 && !this.smart) this.retireTarget();
    }

    getDebugState() {
      return {
        target: this.target ? { x: this.target.x, y: this.target.y } : null,
        routeIndex: this.routeIndex,
        routeLength: this.route.length,
        phase: this.phase,
        smart: this.smart,
        itemsPending: this.itemsPending,
      };
    }

    // Glide from any valid fractional position onto the own cell center.
    // This is the only place non-cardinal travel is allowed.
    recenter(player, dt, speed, canStand) {
      const cx = Math.floor(player.x) + 0.5;
      const cy = Math.floor(player.y) + 0.5;
      const dx = cx - player.x;
      const dy = cy - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= EPSILON) {
        player.x = cx;
        player.y = cy;
        this.phase = 'navigate';
        return 0;
      }
      const step = Math.min(speed * dt, dist);
      const nx = player.x + dx / dist * step;
      const ny = player.y + dy / dist * step;
      if (canStand(nx, ny)) {
        player.x = nx;
        player.y = ny;
        if (dist - step <= EPSILON) {
          player.x = cx;
          player.y = cy;
          this.phase = 'navigate';
        }
        return step;
      }
      // Diagonal blocked: slide along whichever axis still fits.
      let moved = 0;
      const mx = dx / dist * step;
      const my = dy / dist * step;
      if (mx !== 0 && canStand(player.x + mx, player.y)) {
        player.x += mx;
        moved += Math.abs(mx);
      }
      if (my !== 0 && canStand(player.x, player.y + my)) {
        player.y += my;
        moved += Math.abs(my);
      }
      if (moved === 0) this.phase = 'navigate';
      return moved;
    }

    // Advance the player along the route. Returns distance traveled so the
    // caller can drive footsteps and timing. Never cuts corners: the player
    // only translates on an exact cardinal heading after a stationary turn.
    advance(player, dt, speed, canStand) {
      if (!this.map || dt <= 0 || speed <= 0) return 0;
      const stand = canStand || (() => true);
      this.markPosition(player);

      if (this.phase === 'recenter') {
        return this.recenter(player, dt, speed, stand);
      }

      if (this.routeIndex >= this.route.length) {
        this.acquireTarget(player);
        if (this.routeIndex >= this.route.length) return 0;
      }

      const node = this.route[this.routeIndex];
      const dx = node.x - player.x;
      const dy = node.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= EPSILON) {
        player.x = node.x;
        player.y = node.y;
        this.routeIndex += 1;
        return 0;
      }

      const offAxis = Math.abs(dx) >= Math.abs(dy)
        ? Math.abs(dy) : Math.abs(dx);
      if (offAxis > EPSILON) {
        // Pushed off the centerline or the route went stale: rebuild from
        // this cell and glide back to its center before moving on.
        this.replan(player);
        this.phase = 'recenter';
        return 0;
      }

      // Turn in place until the heading is exactly the cardinal axis toward
      // the node; translation never happens mid-turn.
      const desired = Math.atan2(dy, dx);
      const error = normAngle(desired - player.angle);
      if (Math.abs(error) > ALIGN_EPSILON) {
        const maxTurn = this.config.autoTurnSpeed * dt;
        player.angle = normAngle(player.angle +
          clamp(error, -maxTurn, maxTurn));
        return 0;
      }
      // Snap to the aligned heading by applying the residual error so the
      // angle stays continuous across the -PI/+PI wrap.
      player.angle = normAngle(player.angle + error);

      // Move along the dominant (cardinal) axis only; the orthogonal
      // coordinate is pinned so rounding can never drift the centerline.
      const step = Math.min(speed * dt, dist);
      let nx;
      let ny;
      if (Math.abs(dx) >= Math.abs(dy)) {
        nx = player.x + Math.sign(dx) * step;
        ny = node.y;
      } else {
        nx = node.x;
        ny = player.y + Math.sign(dy) * step;
      }
      if (!stand(nx, ny)) {
        // Blocked: replan from here, and re-center if we got pushed off line.
        this.replan(player);
        if (this.route.length === 0) this.phase = 'recenter';
        return 0;
      }
      player.x = nx;
      player.y = ny;
      if (dist - step <= EPSILON) {
        player.x = node.x;
        player.y = node.y;
        this.routeIndex += 1;
      }
      return step;
    }
  }

  Maze3D.AutoPilot = AutoPilot;
})();
