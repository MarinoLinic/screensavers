// Regression validation for 3D Maze. No dependencies.
//   node tests/validate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const WALL = t => t === 1 || t === 3 || t === 4;

let failures = 0;
const fail = msg => { failures += 1; console.log('FAIL  ' + msg); };

// ---------- Level data ----------

const levelDir = path.join(ROOT, 'levels');
const levelFiles = fs.readdirSync(levelDir)
  .filter(f => /^level\d+\.js$/.test(f))
  .map(f => ({ file: f, n: parseInt(f.match(/^level(\d+)\.js$/)[1], 10) }))
  .sort((a, b) => a.n - b.n);
levelFiles.forEach((entry, i) => {
  if (entry.n !== i + 1) fail(`level files not contiguous: ${entry.file}`);
});

const sandbox = { LEVELS: [] };
vm.createContext(sandbox);
levelFiles.forEach(({ file }) => {
  const full = path.join(levelDir, file);
  vm.runInContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: file });
});
const LEVELS = sandbox.LEVELS;

const NAMES = [
  'Red Brick Run', 'Sunken Ruins', 'Orbital Drift', "Pharaoh's Maze",
  'Night Chambers', 'Croatia: Stone & Sea', 'Frozen Signal', 'Neon Foundry',
  'Haunted Archive', 'Clockwork Core',
  'Midnight Cemetery', 'Mushroom Pipeworks', 'Crownstone Palace',
  'Dead Mall', 'Ashfall Wastes', 'Neon Megacity', 'Candy Catacombs',
  'Labyrinth of Olympus', 'Cursed Galleon', 'Dustbowl Mine',
  'Emerald Canopy', 'Toybox Trouble', 'Rain City Noir',
  'Moonlit Shrine', 'Lucid Dreamscape',
  'Gothic Keep', 'Deco Metropolis', 'Celestial Palace',
  'Desert Caravanserai', 'Jade Observatory', 'Sunstone Citadel',
  'Imperial Aqueduct', 'Monsoon Mandir', 'Angkor Roots',
  'Golden Sahel', 'Garden of Stars', 'Runestone Fjord',
  'Wayfinder Isles', 'Mosaic Basilica', 'Moon Gate Palace',
  'Aqua Utopia', 'Vertex Ward', 'Prism Cathedral', 'Nouveau Conservatory',
  'Sunleaf Habitat', 'Iron Zeppelin', 'Primeval Caverns', 'Knotstone Hollow',
  'Concrete Twilight', 'Inkbound Library',
];
if (LEVELS.length !== 50) fail(`expected 50 levels, got ${LEVELS.length}`);
LEVELS.forEach((level, i) => {
  if (level.name !== NAMES[i]) {
    fail(`level ${i + 1} name "${level.name}" !== "${NAMES[i]}"`);
  }
});

const WALL_KEYS = new Set(['brick', 'moss', 'tech', 'sandstone', 'coral', 'space',
  'obsidian', 'croatia', 'ice', 'foundry', 'archive', 'brass',
  'grave', 'pipe', 'royal', 'hospital', 'ruin', 'cyber', 'candy', 'marble',
  'ship', 'adobe', 'jungle', 'toy', 'noir', 'shrine', 'dream',
  'gothic', 'deco', 'chinese', 'caravan', 'maya', 'inca', 'roman', 'mandir',
  'khmer', 'sahel', 'persian', 'norse', 'polynesian', 'byzantine', 'korean',
  'frutiger', 'psx', 'stainedglass', 'nouveau', 'solarpunk', 'diesel',
  'prehistoric', 'celtic', 'brutalist', 'storybook']);
const FLOOR_KEYS = new Set(['stone', 'sand', 'water', 'space', 'terracotta',
  'ice', 'metal', 'wood', 'brass',
  'cobble', 'pipe', 'marble', 'tile', 'cracked', 'grid', 'candy', 'deck',
  'jungle', 'playmat', 'wet', 'tatami', 'cloud',
  'flagstone', 'deco', 'lacquer', 'mosaicSand', 'maya', 'inca', 'roman',
  'mandala', 'laterite', 'sahel', 'persian', 'norse', 'coralStone',
  'byzantine', 'ondol',
  'aqua', 'psx', 'prism', 'floralMosaic', 'solar', 'steel', 'cave', 'celtic',
  'concrete', 'paper']);
const CEILING_KEYS = new Set(['plaster', 'water', 'stars', 'sandstone', 'vault',
  'sky', 'ice', 'industrial', 'dark', 'brass',
  'night', 'royal', 'flicker', 'smoke', 'cyber', 'pastel', 'storm', 'timber',
  'canopy', 'nursery', 'nightcity', 'shrine', 'dreamsky',
  'gothic', 'deco', 'chinese', 'arabesque', 'maya', 'andes', 'roman',
  'mandir', 'khmer', 'sahel', 'persian', 'norse', 'ocean', 'byzantine',
  'korean',
  'blueSky', 'static', 'stainedglass', 'nouveau', 'canopySky', 'diesel',
  'cave', 'celtic', 'concrete', 'storybook']);
const PARTICLES = new Set(['dust', 'bubbles', 'stars', 'motes', 'sun', 'snow',
  'embers', 'sparks', 'mist', 'confetti', 'smoke', 'ash', 'rain', 'fireflies',
  'petals', 'clouds']);

const reachableFrom = level => {
  const map = level.map;
  const w = map[0].length;
  const sx = Math.floor(level.start.x);
  const sy = Math.floor(level.start.y);
  const seen = new Set([sy * w + sx]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [cx, cy] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.length ||
          seen.has(k) || WALL(map[ny][nx])) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
};

const makeCanStand = level => {
  const map = level.map;
  const isWall = (cx, cy) => cx < 0 || cy < 0 || cx >= map[0].length ||
    cy >= map.length || WALL(map[cy][cx]);
  const r = 0.2; // CONFIG.playerRadius
  return (x, y) =>
    !isWall(Math.floor(x - r), Math.floor(y - r)) &&
    !isWall(Math.floor(x + r), Math.floor(y - r)) &&
    !isWall(Math.floor(x - r), Math.floor(y + r)) &&
    !isWall(Math.floor(x + r), Math.floor(y + r));
};

// ---------- Runtime sandbox (game modules, no DOM needed) ----------

const simSandbox = { window: {}, console };
simSandbox.window.Maze3D = simSandbox.Maze3D = {};
vm.createContext(simSandbox);
for (const f of ['config.js', 'autopilot.js', 'interactions.js', 'entities.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), simSandbox);
}
const { CONFIG, AutoPilot, CreatureSwarm, CREATURE_PROFILES, CREATURE_EFFECTS,
  INTERACTION_RULES, hasLineOfSight, isWallCell } = simSandbox.Maze3D;

const PROFILES = new Set(Object.keys(CREATURE_PROFILES));

LEVELS.forEach((level, i) => {
  const tag = `L${i + 1} ${level.name}`;
  const map = level.map;
  const h = map.length;
  const w = map[0].length;
  const canStand = makeCanStand(level);

  map.forEach((row, y) => {
    if (row.length !== w) fail(`${tag} row ${y} not rectangular`);
  });
  for (let x = 0; x < w; x += 1) {
    if (!WALL(map[0][x]) || !WALL(map[h - 1][x])) fail(`${tag} open border at x=${x}`);
  }
  for (let y = 0; y < h; y += 1) {
    if (!WALL(map[y][0]) || !WALL(map[y][w - 1])) fail(`${tag} open border at y=${y}`);
  }

  let exitCount = 0;
  let passableCount = 0;
  let exit = null;
  map.forEach((row, y) => row.forEach((t, x) => {
    if (t === 2) { exitCount += 1; exit = { x, y }; }
    if (!WALL(t)) passableCount += 1;
  }));
  if (exitCount !== 1) fail(`${tag} has ${exitCount} exit tiles`);

  const seen = reachableFrom(level);
  if (seen.size !== passableCount) {
    fail(`${tag} only ${seen.size}/${passableCount} passable cells reachable`);
  }

  const checkPoint = (label, x, y) => {
    const t = (map[Math.floor(y)] || [])[Math.floor(x)];
    const k = Math.floor(y) * w + Math.floor(x);
    if (t === undefined || WALL(t)) fail(`${tag} ${label} (${x},${y}) in wall/OOB`);
    else if (!seen.has(k)) fail(`${tag} ${label} (${x},${y}) unreachable`);
    else if (!canStand(x, y)) fail(`${tag} ${label} (${x},${y}) not standable`);
  };
  checkPoint('start', level.start.x, level.start.y);
  (level.inversions || []).forEach((p, j) => checkPoint(`inversion${j}`, p.x, p.y));
  (level.relics || []).forEach((p, j) => checkPoint(`relic${j}`, p.x, p.y));
  if (exit) checkPoint('exit', exit.x + 0.5, exit.y + 0.5);
  if ((level.relics || []).length !== 3) {
    fail(`${tag} has ${(level.relics || []).length} relics, expected 3`);
  }
  if ((level.inversions || []).length !== 2) {
    fail(`${tag} has ${(level.inversions || []).length} anomalies, expected 2`);
  }

  for (const field of ['description', 'creatureDescription', 'powerupDescription']) {
    if (typeof level[field] !== 'string' || !level[field].trim()) {
      fail(`${tag} missing ${field}`);
    }
  }

  const theme = level.theme || {};
  if (!WALL_KEYS.has(theme.wall)) fail(`${tag} bad theme.wall "${theme.wall}"`);
  if (Object.hasOwn(theme, 'wallAlt')) {
    fail(`${tag} still has theme.wallAlt "${theme.wallAlt}"`);
  }
  if (!FLOOR_KEYS.has(theme.floor)) fail(`${tag} bad theme.floor "${theme.floor}"`);
  if (!CEILING_KEYS.has(theme.ceiling)) {
    fail(`${tag} bad theme.ceiling "${theme.ceiling}"`);
  }
  if (!PARTICLES.has(theme.particles)) {
    fail(`${tag} bad theme.particles "${theme.particles}"`);
  }
  (level.creatureTypes || []).forEach(t => {
    if (!PROFILES.has(t)) fail(`${tag} unknown creatureType "${t}"`);
  });
  if (level.creatureCount !== (level.creatureTypes || []).length * 2) {
    fail(`${tag} creatureCount ${level.creatureCount} !== ` +
      `2 * ${(level.creatureTypes || []).length} roster types`);
  }
});

// Every level has a unique primary wall key.
const wallNames = LEVELS.map(l => l.theme && l.theme.wall);
if (new Set(wallNames).size !== LEVELS.length) {
  fail(`theme.wall keys not unique across ${LEVELS.length} levels`);
}

// Every creature profile has exactly one known effect.
{
  const profileKeys = Object.keys(CREATURE_PROFILES).sort();
  const effectKeys = Object.keys(CREATURE_EFFECTS || {}).sort();
  if (JSON.stringify(profileKeys) !== JSON.stringify(effectKeys)) {
    fail('CREATURE_EFFECTS keys do not match CREATURE_PROFILES keys');
  }
  for (const [k, v] of Object.entries(CREATURE_EFFECTS || {})) {
    if (!['bump', 'slow', 'reverse', 'boost'].includes(v)) {
      fail(`CREATURE_EFFECTS.${k} has bad effect "${v}"`);
    }
  }
}

// ---------- Texture coverage (real pack constructors, stub 2D context) ----------
// A permissive recording-free canvas context: every method exists and returns
// permissive objects, so the real texture constructors execute end to end.
const anyObj = new Proxy(function () {}, {
  get(t, p) {
    if (p === Symbol.toPrimitive) return () => 0;
    return anyObj;
  },
  apply() { return anyObj; },
  set() { return true; },
});
const texSandbox = {
  window: {}, console,
  document: {
    createElement: tag => ({
      tagName: String(tag).toUpperCase(),
      width: 0, height: 0,
      getContext: () => anyObj,
      style: {},
    }),
  },
};
texSandbox.window.Maze3D = texSandbox.Maze3D = {};
vm.createContext(texSandbox);
for (const f of ['core.js', 'retro-pack.js', 'fantasy-pack.js',
  'civilizations-pack.js', 'aesthetic-pack.js', 'level-variants.js']) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'js', 'textures', f), 'utf8'), texSandbox,
    { filename: f });
}
{
  const M = texSandbox.Maze3D;
  const textures = M.installLevelTextureVariants(
    M.expandAestheticTextures(
      M.expandCivilizationTextures(
        M.expandTextures(
          M.enrichTextures(M.createTextures())))));
  LEVELS.forEach((level, i) => {
    const tag = `L${i + 1} textures`;
    if (!textures.walls[level.theme.wall]) fail(`${tag} missing wall ${level.theme.wall}`);
    if (!textures.floors[level.theme.floor]) fail(`${tag} missing floor ${level.theme.floor}`);
    if (!textures.ceilings[level.theme.ceiling]) {
      fail(`${tag} missing ceiling ${level.theme.ceiling}`);
    }
    if (!textures.relics[level.relicType]) fail(`${tag} missing relic ${level.relicType}`);
    (level.creatureTypes || []).forEach(t => {
      const frames = textures.creatures[t];
      if (!Array.isArray(frames) || frames.length === 0) {
        fail(`${tag} missing creature sprites for "${t}"`);
      }
    });
    try {
      textures.getWallVariant(level.theme.wall);
    } catch (error) {
      fail(`${tag} getWallVariant("${level.theme.wall}") threw ${error.message}`);
    }
  });
}

// ---------- Swarm roster: exactly two of every species ----------

LEVELS.forEach((level, i) => {
  const tag = `L${i + 1} swarm`;
  const exit = { x: 0, y: 0 };
  level.map.forEach((row, y) => row.forEach((t, x) => {
    if (t === 2) { exit.x = x; exit.y = y; }
  }));
  const canStand = makeCanStand(level);
  const avoid = [
    ...(level.inversions || []),
    ...(level.relics || []),
    { x: exit.x + 0.5, y: exit.y + 0.5 },
  ];
  for (const seed of [1, 73, 977]) {
    const swarm = new CreatureSwarm();
    swarm.reset(level.map, {
      types: level.creatureTypes,
      count: level.creatureCount,
      start: level.start,
      avoid,
    }, seed);
    const counts = {};
    const positions = new Set();
    for (const c of swarm.creatures) {
      counts[c.type] = (counts[c.type] || 0) + 1;
      const pk = `${c.x},${c.y}`;
      if (positions.has(pk)) fail(`${tag} seed ${seed} duplicate spawn cell ${pk}`);
      positions.add(pk);
      if (!canStand(c.x, c.y)) fail(`${tag} seed ${seed} spawn not standable ${pk}`);
    }
    for (const type of level.creatureTypes) {
      if (counts[type] !== 2) {
        fail(`${tag} seed ${seed} "${type}" spawned ${counts[type] || 0}, expected 2`);
      }
    }
    const extras = Object.keys(counts).filter(t => !level.creatureTypes.includes(t));
    if (extras.length) fail(`${tag} seed ${seed} stray species ${extras}`);
  }
});

// ---------- Swarm pair-cap edge cases ----------

// An oversized creatureCount must still cap at exactly two per roster
// species (count > 2 * types.length must not over-spawn).
{
  const swarm = new CreatureSwarm();
  swarm.reset(LEVELS[0].map, {
    types: ['rat', 'bat', 'spider'],
    count: 20,
    start: LEVELS[0].start,
    avoid: [],
  }, 7);
  const counts = {};
  for (const c of swarm.creatures) counts[c.type] = (counts[c.type] || 0) + 1;
  for (const type of Object.keys(counts)) {
    if (counts[type] !== 2) {
      fail(`oversized count spawned ${counts[type]} of "${type}", expected 2`);
    }
  }
  if (swarm.creatures.length !== 6) {
    fail(`oversized count should cap at 2 per species, got ${swarm.creatures.length}`);
  }
}

// Starved candidates: drop whole pairs, never spawn a lone member.
{
  const tinyMap = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ];
  // Start at (3,2) excludes all but cells (1,4) and (5,4): exactly one pair.
  const swarm = new CreatureSwarm();
  swarm.reset(tinyMap, {
    types: ['rat', 'bat', 'spider'],
    count: 6,
    start: { x: 3.5, y: 2.5 },
    avoid: [],
  }, 11);
  const counts = {};
  for (const c of swarm.creatures) counts[c.type] = (counts[c.type] || 0) + 1;
  for (const type of Object.keys(counts)) {
    if (counts[type] !== 2) {
      fail(`starved map spawned singleton "${type}" x${counts[type]}`);
    }
  }
  if (swarm.creatures.length !== 2) {
    fail(`starved map should spawn exactly one pair, got ${swarm.creatures.length}`);
  }
}

// ---------- Swarm motion: every step on grid rails at exactly speed*dt ----------
// Per update, positions must stay finite, standable, and on a cell-center
// grid line (corner turns only ever happen at a cell center). No update may
// move a creature more than speed*dt, and over 10 simulated seconds the
// odometer must equal speed*elapsed: no distance may be dropped.

LEVELS.forEach((level, i) => {
  const tag = `L${i + 1} swarm-motion`;
  const canStand = makeCanStand(level);
  const exit = { x: 0, y: 0 };
  level.map.forEach((row, y) => row.forEach((t, x) => {
    if (t === 2) { exit.x = x; exit.y = y; }
  }));
  const avoid = [
    ...(level.inversions || []),
    ...(level.relics || []),
    { x: exit.x + 0.5, y: exit.y + 0.5 },
  ];
  for (const seed of [1, 73, 977]) {
    const swarm = new CreatureSwarm();
    swarm.reset(level.map, {
      types: level.creatureTypes,
      count: level.creatureCount,
      start: level.start,
      avoid,
    }, seed);
    // Reconstruct per-update path length: legs run waypoint to waypoint,
    // so a mid-update turn has displacement < distance travelled. The
    // arrived cell is committed before pickNextCell runs, which gives a
    // per-creature waypoint trail to measure against.
    const wpLog = new Map(swarm.creatures.map(c => [c, []]));
    const pickNext = swarm.pickNextCell;
    swarm.pickNextCell = c => {
      wpLog.get(c).push([c.cellX + 0.5, c.cellY + 0.5]);
      return pickNext.call(swarm, c);
    };
    const traveled = swarm.creatures.map(() => 0);
    for (let step = 0; step < 600; step += 1) {
      const beforeX = swarm.creatures.map(c => c.x);
      const beforeY = swarm.creatures.map(c => c.y);
      swarm.update(1 / 60);
      swarm.creatures.forEach((c, ci) => {
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) {
          fail(`${tag} seed ${seed} non-finite position`);
          return;
        }
        if (!canStand(c.x, c.y)) {
          fail(`${tag} seed ${seed} left standable ground at ${c.x},${c.y}`);
        }
        const fx = c.x - Math.floor(c.x);
        const fy = c.y - Math.floor(c.y);
        if (Math.min(Math.abs(fx - 0.5), Math.abs(fy - 0.5)) > 1e-9) {
          fail(`${tag} seed ${seed} off grid line at ${c.x},${c.y}`);
        }
        const wps = wpLog.get(c);
        let pathLen = 0;
        let legX = beforeX[ci];
        let legY = beforeY[ci];
        wps.forEach(([wx, wy], wi) => {
          const leg = Math.hypot(wx - legX, wy - legY);
          if (wi > 0 && Math.abs(leg - 1) > 1e-9) {
            fail(`${tag} seed ${seed} waypoint leg ${leg} !== 1`);
          }
          pathLen += leg;
          legX = wx;
          legY = wy;
        });
        pathLen += Math.hypot(c.x - legX, c.y - legY);
        wps.length = 0;
        traveled[ci] += pathLen;
        if (pathLen > c.speed / 60 + 1e-9) {
          fail(`${tag} seed ${seed} moved ${pathLen} > speed*dt`);
        }
      });
    }
    swarm.creatures.forEach((c, ci) => {
      if (Math.abs(traveled[ci] - c.speed * 10) > 0.02) {
        fail(`${tag} seed ${seed} "${c.type}" traveled ` +
          `${traveled[ci].toFixed(3)}, expected ${(c.speed * 10).toFixed(3)}`);
      }
    });
    const counts = {};
    for (const c of swarm.creatures) counts[c.type] = (counts[c.type] || 0) + 1;
    for (const type of level.creatureTypes) {
      if (counts[type] !== 2) {
        fail(`${tag} seed ${seed} "${type}" roster now ${counts[type] || 0}`);
      }
    }
  }
});
console.log('swarm motion: 150 x 10s walks stayed on rails at full speed');

// ---------- Single creature on a tiny L corridor ----------

{
  const corridor = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ];
  const makeRunner = () => {
    const swarm = new CreatureSwarm();
    swarm.map = corridor;
    swarm.width = 7;
    swarm.height = 5;
    swarm.rngState = 1;
    const creature = {
      type: 'rat', x: 1.5, y: 1.5, cellX: 1, cellY: 1,
      targetX: 1.5, targetY: 1.5, prevX: -1, prevY: -1,
      speed: 1, anim: 0, phase: 0, moving: true, contactCooldown: 0,
    };
    swarm.pickNextCell(creature);
    swarm.creatures = [creature];
    return swarm;
  };

  // Forced path: east along row 1, south to row 3, west to the dead end at
  // (1,3), reverse, then east again. 10 units reaches (1.5,3.5); 1.7 more
  // leaves the runner mid-leg at (3.2,3.5). A single bulk update must land
  // exactly where many small updates do: leftover distance is never lost.
  const bulk = makeRunner();
  bulk.update(11.7);
  const split = makeRunner();
  for (let i = 0; i < 117; i += 1) split.update(0.1);
  const a = bulk.creatures[0];
  const b = split.creatures[0];
  if (Math.abs(a.x - b.x) > 1e-9 || Math.abs(a.y - b.y) > 1e-9) {
    fail(`bulk vs subdivided update diverged: (${a.x},${a.y}) vs (${b.x},${b.y})`);
  }
  if (Math.abs(a.x - 3.2) > 1e-9 || Math.abs(a.y - 3.5) > 1e-9) {
    fail(`L corridor run expected (3.2,3.5), got (${a.x},${a.y})`);
  }
  if (a.cellX !== 2 || a.cellY !== 3 || a.prevX !== 1 || a.prevY !== 3) {
    fail(`cell/prev bookkeeping wrong: cell ${a.cellX},${a.cellY} ` +
      `prev ${a.prevX},${a.prevY}`);
  }

  // Non-positive or non-finite dt must not mutate anything.
  const idle = makeRunner();
  const c0 = idle.creatures[0];
  const snap = JSON.stringify(c0);
  idle.update(0);
  idle.update(-0.5);
  idle.update(NaN);
  idle.update(Infinity);
  if (JSON.stringify(c0) !== snap) fail('idle update mutated the creature');

  // Cooldown clamps at zero instead of going negative.
  c0.moving = false;
  c0.contactCooldown = 0.05;
  idle.update(0.1);
  if (c0.contactCooldown !== 0) {
    fail(`contactCooldown ${c0.contactCooldown}, expected clamp to 0`);
  }

  // An isolated single cell has no neighbours: safe no-op, still standing.
  const pocket = [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ];
  const stuck = new CreatureSwarm();
  stuck.map = pocket;
  stuck.width = 3;
  stuck.height = 3;
  stuck.rngState = 1;
  const lonely = {
    type: 'rat', x: 1.5, y: 1.5, cellX: 1, cellY: 1,
    targetX: 1.5, targetY: 1.5, prevX: -1, prevY: -1,
    speed: 1, anim: 0, phase: 0, moving: true, contactCooldown: 0,
  };
  stuck.creatures = [lonely];
  stuck.update(0.5);
  if (lonely.x !== 1.5 || lonely.y !== 1.5 || lonely.moving) {
    fail('isolated cell creature should stop in place');
  }
  console.log('waypoint bookkeeping: bulk==subdivided, clamps and pockets safe');
}

// ---------- Creature profile invariants ----------

{
  for (const [key, profile] of Object.entries(CREATURE_PROFILES)) {
    if (!profile.flying) {
      if (profile.vertical !== (profile.height - 1) / 2) {
        fail(`profile ${key} vertical ${profile.vertical}, ` +
          `expected ${(profile.height - 1) / 2}`);
      }
      if (profile.height / 2 - profile.vertical !== 0.5) {
        fail(`profile ${key} feet do not rest on the floor plane`);
      }
    }
    if (!Object.isFrozen(profile)) fail(`profile ${key} is not frozen`);
  }
  if (!Object.isFrozen(CREATURE_PROFILES)) {
    fail('CREATURE_PROFILES registry is not frozen');
  }

  // Known species with missing sprite frames are skipped; unknown species
  // may still borrow the rat stand-in.
  const sparse = new CreatureSwarm();
  sparse.creatures = [
    { type: 'rat', x: 1.5, y: 1.5, anim: 0, phase: 0 },
    { type: 'goblin', x: 2.5, y: 1.5, anim: 0, phase: 0 },
  ];
  const noFrames = sparse.getSprites(0, { creatures: {} });
  if (noFrames.length !== 0) {
    fail(`missing frames should be skipped, got ${noFrames.length} sprites`);
  }
  const fallback = sparse.getSprites(0, { creatures: { rat: [{}] } });
  if (fallback.length !== 2 ||
      !fallback.some(s => s.creatureType === 'goblin')) {
    fail('unknown species lost the rat sprite fallback');
  }

  // floorAnchored mirrors the flying flag: ground sprites anchor their
  // visible foot edge on the floor, flying sprites keep a hover anchor.
  const allTypes = Object.keys(CREATURE_PROFILES);
  const frames = {};
  allTypes.forEach(t => { frames[t] = [{}]; });
  const anchored = new CreatureSwarm();
  anchored.creatures = allTypes.map((type, i) => ({
    type, x: 1.5 + i, y: 1.5, anim: 0, phase: 0,
  }));
  anchored.getSprites(0, { creatures: frames }).forEach(sprite => {
    if (sprite.floorAnchored !== !CREATURE_PROFILES[sprite.creatureType].flying) {
      fail(`${sprite.creatureType} floorAnchored !== !flying`);
    }
  });
}

// ---------- Contact requires line of sight ----------

{
  const OPEN = [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ];
  const CORNER_A = [
    [1, 1, 1, 1],
    [1, 0, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ];
  const CORNER_B = [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 0, 1],
    [1, 1, 1, 1],
  ];
  const WALL_MID = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1],
  ];
  const HALL = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ];
  const makeSwarm = (map, x, y) => {
    const swarm = new CreatureSwarm();
    swarm.map = map;
    swarm.width = map[0].length;
    swarm.height = map.length;
    swarm.creatures = [{
      type: 'rat', x, y,
      cellX: Math.floor(x), cellY: Math.floor(y),
      targetX: x, targetY: y, prevX: -1, prevY: -1,
      speed: 1, anim: 0, phase: 0, moving: false, contactCooldown: 0,
    }];
    return swarm;
  };

  // Same-cell / open diagonal geometry accepts.
  let swarm = makeSwarm(OPEN, 2.1, 2.1);
  const contact = swarm.consumeContact({ x: 1.8, y: 1.8 });
  if (!contact || contact.type !== 'rat') {
    fail('open diagonal contact inside radius rejected');
  }
  if (contact && swarm.creatures[0].contactCooldown !==
      INTERACTION_RULES.contactCooldown) {
    fail('contact cooldown did not use INTERACTION_RULES');
  }
  if (swarm.consumeContact({ x: 1.8, y: 1.8 }) !== null) {
    fail('cooling-down creature fired a second contact');
  }

  // Corner pinches reject even though the pair is close.
  if (makeSwarm(CORNER_A, 2.1, 2.1).consumeContact({ x: 1.8, y: 1.8 })) {
    fail('contact leaked around the (2,1) corner wall');
  }
  if (makeSwarm(CORNER_B, 2.1, 2.1).consumeContact({ x: 1.8, y: 1.8 })) {
    fail('contact leaked around the (1,2) corner wall');
  }

  // Straight wall blocks; removing it (same distances) accepts.
  if (makeSwarm(WALL_MID, 3.5, 1.5).consumeContact({ x: 1.5, y: 1.5 }, 2.5)) {
    fail('contact fired through a wall');
  }
  if (!makeSwarm(HALL, 3.5, 1.5).consumeContact({ x: 1.5, y: 1.5 }, 2.5)) {
    fail('straight open corridor rejected contact');
  }

  // Same-cell pair inside radius always sees each other.
  if (!makeSwarm(OPEN, 1.8, 1.6).consumeContact({ x: 1.5, y: 1.5 })) {
    fail('same-cell contact rejected');
  }

  // Line-of-sight primitives.
  if (!hasLineOfSight(OPEN, 1.5, 1.5, 2.5, 1.5)) {
    fail('LOS rejected adjacent open cells');
  }
  if (hasLineOfSight(OPEN, 1.5, 1.5, 1.5, 3.5)) {
    fail('LOS crossed the border wall');
  }
  if (hasLineOfSight(OPEN, 1.5, 1.5, 9.5, 1.5)) {
    fail('LOS reached outside the map');
  }
  if (!hasLineOfSight(OPEN, 1.2, 1.3, 1.8, 1.7)) {
    fail('LOS rejected a same-cell pair');
  }
  if (hasLineOfSight(OPEN, NaN, 1.5, 2.5, 1.5) ||
      hasLineOfSight(OPEN, 1.5, 1.5, Infinity, 1.5)) {
    fail('LOS accepted a non-finite coordinate');
  }
  if (!isWallCell(OPEN, -1, 0) || !isWallCell(OPEN, 0, 99) ||
      !isWallCell(OPEN, 3, 1)) {
    fail('isWallCell should treat out-of-bounds as solid');
  }
  console.log('contact LOS: walls and corners block, open pairs connect');
}

// ---------- Autopilot simulations ----------

const PICKUP_RADIUS = 0.45;
const RELIC_RADIUS = 0.42;

const findExit = level => {
  const exit = { x: 0, y: 0 };
  level.map.forEach((row, y) => row.forEach((t, x) => {
    if (t === 2) { exit.x = x; exit.y = y; }
  }));
  return exit;
};

const ANGLE_EPS = 1e-6;
const isCardinal = angle => {
  const q = angle / (Math.PI / 2);
  return Math.abs(q - Math.round(q)) < 1e-4;
};

// Drive the pilot exactly like game.js does in auto mode, with live item
// flags, boost/slow timers and the Smart exit guard. Returns a report.
const driveAuto = (level, index, options) => {
  const dt = options.dt || 1 / 60;
  const budget = options.budget || 600;
  const exit = findExit(level);
  const relics = level.relics.map(p => ({ x: p.x, y: p.y, collected: false }));
  const anomalies = level.inversions.map(p => ({ x: p.x, y: p.y, consumed: false }));
  const auto = new AutoPilot(CONFIG);
  const items = { relics, anomalies };
  // reset() zeroes velocity/bob on its start arg: pass a throwaway player
  // so the frozen level definitions are never mutated.
  const startObj = Object.assign({}, options.start || level.start);
  auto.reset(level.map, startObj, exit,
    options.seed || ((index + 1) * 613 + 17), {
      smart: !!options.smart,
      items,
      interact: options.interact !== false,
    });

  const canStand = makeCanStand(level);
  const moveScale = (level.theme && level.theme.moveScale) || 1;
  const player = {
    x: (options.start || level.start).x,
    y: (options.start || level.start).y,
    angle: (options.start || level.start).angle || 0,
  };

  let t = 0;
  let distance = 0;
  let completed = false;
  let wallHits = 0;
  let diagonalMoves = 0;
  let moveWhileTurning = 0;
  let nonCardinalMoves = 0;
  let overshoots = 0;
  let maxStall = 0;
  let stall = 0;
  let completedWhilePending = false;
  let switched = !options.switchAt;
  let contactsApplied = false;

  for (let step = 0; step < budget / dt; step += 1) {
    if (!switched && t >= options.switchAt) {
      auto.configure({
        smart: true, items, interact: options.interact !== false,
      });
      switched = true;
    }
    const boost = options.boostTimer > 0 ? 1.2 : 1;
    const slow = (options.slowTimer > 0 || contactsApplied) ? 0.55 : 1;
    const speed = CONFIG.moveSpeed * moveScale * boost * slow;
    const prevX = player.x;
    const prevY = player.y;
    const prevAngle = player.angle;
    const phase = auto.phase;
    const traveled = auto.advance(player, dt, speed, canStand);
    t += dt;
    if (options.boostTimer > 0) options.boostTimer -= dt;
    if (options.slowTimer > 0) options.slowTimer -= dt;

    if (!Number.isFinite(player.x) || !Number.isFinite(player.y) ||
        !Number.isFinite(player.angle) || !Number.isFinite(traveled)) {
      fail(`L${index + 1} non-finite autopilot state`);
      break;
    }
    if (!canStand(player.x, player.y)) wallHits += 1;

    const mdx = player.x - prevX;
    const mdy = player.y - prevY;
    const moved = Math.hypot(mdx, mdy);
    // The pilot snaps residual alignment error under 1e-6 before moving; a
    // real bounded turn is far larger than that micro-correction.
    const turned = Math.abs(player.angle - prevAngle) > 1e-5;
    if (phase === 'navigate') {
      if (moved > 1e-9) {
        if (Math.abs(mdx) > 1e-9 && Math.abs(mdy) > 1e-9) diagonalMoves += 1;
        if (!isCardinal(player.angle)) nonCardinalMoves += 1;
        if (moved > speed * dt + 1e-6) overshoots += 1;
      }
      if (turned && moved > 1e-9) moveWhileTurning += 1;
    }
    // A mid-route contact must never displace the player in auto mode.
    if (options.contactAt && !contactsApplied && t >= options.contactAt) {
      contactsApplied = true; // slow applied via speed factor next frames
    }

    for (const relic of relics) {
      if (!relic.collected && options.interact !== false &&
          Math.hypot(relic.x - player.x, relic.y - player.y) < RELIC_RADIUS) {
        relic.collected = true;
        if (options.liveBoost && relics.every(r => r.collected)) {
          options.boostTimer = Math.max(options.boostTimer || 0, 10);
        } else if (options.liveBoost) {
          options.boostTimer = Math.max(options.boostTimer || 0, 3);
        }
      }
    }
    for (const anomaly of anomalies) {
      if (!anomaly.consumed && options.interact !== false &&
          Math.hypot(anomaly.x - player.x, anomaly.y - player.y) < PICKUP_RADIUS) {
        anomaly.consumed = true;
      }
    }

    const pending = relics.some(r => !r.collected) ||
      anomalies.some(a => !a.consumed);
    const onExit = level.map[Math.floor(player.y)][Math.floor(player.x)] === 2;
    const nearExit = exit &&
      Math.hypot(exit.x + 0.5 - player.x, exit.y + 0.5 - player.y) < 0.45;
    if (onExit || nearExit) {
      const blocked = options.smart && options.interact !== false &&
        auto.itemsPending;
      if (blocked) {
        // Smart is not allowed to finish yet: keep driving.
      } else {
        completed = true;
        if (options.smart && options.interact !== false && pending) {
          completedWhilePending = true;
        }
        break;
      }
    }

    if (step * dt > 1) {
      if (traveled < 0.003) {
        stall += dt;
        if (stall > maxStall) maxStall = stall;
      } else {
        stall = 0;
      }
    }
    distance += traveled;
  }

  return {
    t, distance, completed, wallHits, diagonalMoves, moveWhileTurning,
    nonCardinalMoves, overshoots, maxStall, completedWhilePending,
    relics, anomalies, player, auto,
  };
};

const checkMoveRules = (report, tag) => {
  if (report.wallHits) fail(`${tag} entered walls ${report.wallHits} frames`);
  if (report.diagonalMoves) fail(`${tag} moved diagonally ${report.diagonalMoves} frames`);
  if (report.moveWhileTurning) {
    fail(`${tag} translated while turning ${report.moveWhileTurning} frames`);
  }
  if (report.nonCardinalMoves) {
    fail(`${tag} moved on non-cardinal heading ${report.nonCardinalMoves} frames`);
  }
  if (report.overshoots) {
    fail(`${tag} exceeded per-frame speed clamp ${report.overshoots} times`);
  }
};

// Smart: all 50 levels must collect every item then exit, at both timesteps.
const SMART_FOCUS = new Set([1, 7, 17, 28, 41, 50]);
LEVELS.forEach((level, i) => {
  for (const dt of (SMART_FOCUS.has(i + 1) ? [1 / 60, 1 / 30] : [1 / 60])) {
    const report = driveAuto(level, i, { dt, smart: true, liveBoost: true });
    const tag = `L${i + 1} smart dt=${dt.toFixed(4)}`;
    if (!report.completed) fail(`${tag} never reached the exit in 600s`);
    const pendingRelics = report.relics.filter(r => !r.collected).length;
    const pendingAnom = report.anomalies.filter(a => !a.consumed).length;
    if (pendingRelics || pendingAnom) {
      fail(`${tag} finished with ${pendingRelics} relics ${pendingAnom} anomalies pending`);
    }
    if (report.completedWhilePending) fail(`${tag} exited while items pending`);
    checkMoveRules(report, tag);
    if (report.maxStall > 6) fail(`${tag} stalled ${report.maxStall.toFixed(1)}s`);
    if (report.t > 0) {
      console.log(`${tag}: done t=${report.t.toFixed(1)}s dist=${report.distance.toFixed(0)}`);
    }
  }
});

// Smart with interactions off routes straight to the exit.
{
  const level = LEVELS[0];
  const report = driveAuto(level, 0, { dt: 1 / 60, smart: true, interact: false });
  if (!report.completed) fail('smart+interactions-off never reached exit');
  if (report.relics.some(r => r.collected)) {
    fail('smart+interactions-off collected a relic it cannot consume');
  }
  console.log(`L1 smart no-interact: done t=${report.t.toFixed(1)}s`);
}

// Wander: seeded smoke run, strict movement rules, deterministic.
LEVELS.forEach((level, i) => {
  const report = driveAuto(level, i, {
    dt: 1 / 60, smart: false, budget: 30, interact: false,
  });
  const tag = `L${i + 1} wander`;
  if (report.distance < 15) {
    fail(`${tag} moved only ${report.distance.toFixed(1)} in 30s`);
  }
  if (report.maxStall > 6) fail(`${tag} stalled ${report.maxStall.toFixed(1)}s`);
  checkMoveRules(report, tag);
});
for (const i of [0, 24, 49]) {
  const a = driveAuto(LEVELS[i], i, { dt: 1 / 60, smart: false, budget: 20, interact: false });
  const b = driveAuto(LEVELS[i], i, { dt: 1 / 60, smart: false, budget: 20, interact: false });
  if (Math.abs(a.player.x - b.player.x) > 1e-9 ||
      Math.abs(a.player.y - b.player.y) > 1e-9) {
    fail(`L${i + 1} wander not deterministic`);
  }
}
console.log('wander: all 50 smoke-ran, deterministic spot checks passed');

// Focused autopilot behaviour tests.
{
  const level = LEVELS[0];
  // Arbitrary initial heading and an off-center but valid position.
  const odd = driveAuto(level, 0, {
    dt: 1 / 60, smart: true,
    start: { x: level.start.x + 0.18, y: level.start.y - 0.12, angle: 2.7 },
  });
  if (!odd.completed) fail('smart failed from off-center/arbitrary heading');
  checkMoveRules(odd, 'L1 odd-start smart');

  // Switching brains mid-run recovers and still finishes.
  const sw = driveAuto(level, 0, {
    dt: 1 / 60, smart: false, switchAt: 6,
  });
  if (!sw.completed) fail('smart switch mid-run never completed');
  checkMoveRules(sw, 'L1 switched smart');

  // Speed swings and a mid-route contact keep the walk calm.
  const fx = driveAuto(level, 0, {
    dt: 1 / 60, smart: true,
    slowTimer: 0, boostTimer: 0, contactAt: 8,
  });
  if (!fx.completed) fail('smart with contact effects never completed');
  checkMoveRules(fx, 'L1 contact smart');
  console.log('focused autopilot checks passed');
}

console.log(failures === 0 ? 'ALL VALID' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
