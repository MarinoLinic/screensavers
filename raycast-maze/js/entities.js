(() => {
  const Maze3D = window.Maze3D = window.Maze3D || {};

  const NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const RULES = Maze3D.INTERACTION_RULES;

  // Non-flying profiles carry no vertical: their floor anchor is derived
  // below so every ground sprite sits exactly on the floor plane.
  const PROFILES = {
    rat:       { width: .8,  height: .55 },
    fish:      { width: .85, height: .55, vertical: .12, flying: true },
    crab:      { width: .72, height: .42 },
    drone:     { width: .78, height: .58, vertical: .22, flying: true },
    alien:     { width: .62, height: .92 },
    scarab:    { width: .5,  height: .42 },
    mummy:     { width: .58, height: 1.08 },
    bat:       { width: .9,  height: .52, vertical: .26, flying: true },
    ghost:     { width: .72, height: .9,  vertical: .13, flying: true },
    marten:    { width: .85, height: .55 },
    gull:      { width: .95, height: .52, vertical: .31, flying: true },
    frostling: { width: .62, height: .88 },
    robot:     { width: .62, height: 1.0 },
    spider:    { width: .7,  height: .42 },
    gearbug:   { width: .56, height: .44 },
    skeleton:  { width: .58, height: 1.0 },
    raven:     { width: .82, height: .48, vertical: .30, flying: true },
    shroom:    { width: .66, height: .70 },
    shellback: { width: .76, height: .54 },
    knight:    { width: .62, height: 1.08 },
    jester:    { width: .62, height: 1.0 },
    zombie:    { width: .65, height: 1.0 },
    crawler:   { width: .82, height: .45 },
    mutant:    { width: .78, height: 1.0 },
    scavenger: { width: .64, height: .98 },
    neonbot:   { width: .64, height: .98 },
    gummy:     { width: .68, height: .78 },
    cupcake:   { width: .65, height: .75 },
    minotaur:  { width: .78, height: 1.13 },
    owl:       { width: .82, height: .52, vertical: .30, flying: true },
    parrot:    { width: .86, height: .52, vertical: .28, flying: true },
    outlaw:    { width: .64, height: 1.0 },
    tumbleweed:{ width: .75, height: .65 },
    snake:     { width: .88, height: .42 },
    jaguar:    { width: .92, height: .58 },
    monkey:    { width: .72, height: .78 },
    toySoldier:{ width: .58, height: 1.0 },
    windup:    { width: .65, height: .70 },
    shadow:    { width: .67, height: 1.05, vertical: .10, flying: true },
    kitsune:   { width: .90, height: .60 },
    spirit:    { width: .70, height: .96, vertical: .15, flying: true },
    eyeball:   { width: .70, height: .58, vertical: .25, flying: true },
    cloudling: { width: .85, height: .60, vertical: .24, flying: true },
    eagle:        { width: .88, height: .52, vertical: .30, flying: true },
    dragon:       { width: 1.05, height: .72, vertical: .22, flying: true },
    guardianLion: { width: .90, height: .68 },
    crane:        { width: .72, height: .78, vertical: .24, flying: true },
    camel:        { width: .95, height: .72 },
    falcon:       { width: .82, height: .48, vertical: .30, flying: true },
    quetzal:      { width: .88, height: .55, vertical: .30, flying: true },
    llama:        { width: .85, height: .72 },
    condor:       { width: 1.0, height: .58, vertical: .30, flying: true },
    legionary:    { width: .62, height: 1.05 },
    wolf:         { width: .88, height: .58 },
    elephant:     { width: 1.0, height: .75 },
    peacock:      { width: .85, height: .65 },
    lion:         { width: .92, height: .65 },
    viking:       { width: .65, height: 1.05 },
    turtle:       { width: .78, height: .45 },
    gecko:        { width: .75, height: .40 },
    dove:         { width: .78, height: .48, vertical: .30, flying: true },
    tiger:        { width: .92, height: .60 },
    bubbleling:   { width: .80, height: .80, vertical: .20, flying: true },
    dolphin:      { width: .95, height: .50, vertical: .14, flying: true },
    aquaBot:      { width: .62, height: 1.0 },
    frog:         { width: .70, height: .50 },
    polygonHound: { width: .90, height: .60 },
    staticWraith: { width: .70, height: .95, vertical: .14, flying: true },
    lowPolyRat:   { width: .80, height: .50 },
    glassKnight:  { width: .64, height: 1.05 },
    prismMoth:    { width: .80, height: .50, vertical: .28, flying: true },
    glassGolem:   { width: .75, height: 1.10 },
    vineNymph:    { width: .60, height: .95 },
    moth:         { width: .75, height: .50, vertical: .27, flying: true },
    fox:          { width: .88, height: .55 },
    butterfly:    { width: .70, height: .55, vertical: .30, flying: true },
    capybara:     { width: .95, height: .60 },
    sunDrone:     { width: .62, height: .95 },
    dieselTrooper:{ width: .64, height: 1.02 },
    propellerDrone:{ width: .80, height: .50, vertical: .30, flying: true },
    sootGremlin:  { width: .68, height: .62 },
    raptor:       { width: .80, height: .70 },
    mammoth:      { width: 1.05, height: .80 },
    pterodactyl:  { width: .90, height: .55, vertical: .28, flying: true },
    caveBeetle:   { width: .60, height: .50 },
    stag:         { width: .90, height: .70 },
    banshee:      { width: .68, height: .95, vertical: .15, flying: true },
    strayDog:     { width: .85, height: .55 },
    pigeon:       { width: .72, height: .45, vertical: .30, flying: true },
    maintenanceBot:{ width: .62, height: 1.0 },
    inkFox:       { width: .85, height: .55 },
    paperKnight:  { width: .62, height: 1.05 },
    bookworm:     { width: .80, height: .40 },
    quillSpirit:  { width: .66, height: .90, vertical: .16, flying: true },
  };

  // A ground sprite stands on the floor: its bottom edge sits half a unit
  // below eye level, so the anchor is always (height - 1) / 2.
  for (const key of Object.keys(PROFILES)) {
    const profile = PROFILES[key];
    if (!profile.flying) profile.vertical = (profile.height - 1) / 2;
    Object.freeze(profile);
  }
  Object.freeze(PROFILES);

  class CreatureSwarm {
    constructor() {
      this.creatures = [];
    }

    random() {
      this.rngState = (Math.imul(this.rngState, 1664525) + 1013904223) >>> 0;
      return this.rngState / 4294967296;
    }

    reset(map, options, seed) {
      this.map = map;
      this.width = map[0].length;
      this.height = map.length;
      this.rngState = (seed >>> 0) || 0x1b873c5;

      const startX = Math.floor(options.start.x);
      const startY = Math.floor(options.start.y);
      const avoid = (options.avoid || []).map(p => ({
        x: Math.floor(p.x), y: Math.floor(p.y),
      }));

      const candidates = [];
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          if (map[y][x] !== 0) continue;
          if (Math.abs(x - startX) + Math.abs(y - startY) <= 3) continue;
          if (avoid.some(p => Math.abs(x - p.x) + Math.abs(y - p.y) <= 2)) continue;
          candidates.push({ x, y });
        }
      }
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      const types = (options.types && options.types.length)
        ? options.types.slice() : ['rat'];
      for (let i = types.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }

      // Roster species spawn in pairs: creatureCount is 2 * types.length, and
      // if candidates run short we drop whole pairs rather than leave one
      // member of a species unsilently missing.
      const pairs = Math.min(
        types.length,
        Math.floor((options.count || 0) / 2),
        Math.floor(candidates.length / 2)
      );
      this.creatures = [];
      for (let p = 0; p < pairs; p += 1) {
        const type = types[p];
        for (let member = 0; member < 2; member += 1) {
          const cell = candidates[p * 2 + member];
          const creature = {
            type,
            x: cell.x + 0.5,
            y: cell.y + 0.5,
            cellX: cell.x,
            cellY: cell.y,
            targetX: cell.x + 0.5,
            targetY: cell.y + 0.5,
            prevX: -1,
            prevY: -1,
            speed: 0.58 + this.random() * 0.34,
            anim: this.random() * 4,
            phase: this.random() * Math.PI * 2,
            moving: false,
            contactCooldown: 0,
          };
          this.pickNextCell(creature);
          this.creatures.push(creature);
        }
      }
    }

    isWall(cellX, cellY) {
      return Maze3D.isWallCell(this.map, cellX, cellY);
    }

    // Chooses only the next waypoint; cellX/cellY always hold the last cell
    // the creature actually reached and are updated on arrival.
    pickNextCell(creature) {
      const options = [];
      for (const [dx, dy] of NEIGHBORS) {
        const nx = creature.cellX + dx;
        const ny = creature.cellY + dy;
        if (this.isWall(nx, ny)) continue;
        options.push({
          x: nx, y: ny,
          back: nx === creature.prevX && ny === creature.prevY,
        });
      }
      if (options.length === 0) {
        creature.moving = false;
        return;
      }
      const forward = options.filter(option => !option.back);
      const pool = forward.length > 0 ? forward : options;
      const next = pool[Math.floor(this.random() * pool.length) % pool.length];
      creature.targetX = next.x + 0.5;
      creature.targetY = next.y + 0.5;
      creature.moving = true;
    }

    // Waypoint reached: the cell just left becomes prev, the target cell
    // becomes current, then the next leg is picked.
    arrive(creature) {
      creature.prevX = creature.cellX;
      creature.prevY = creature.cellY;
      creature.cellX = Math.floor(creature.targetX);
      creature.cellY = Math.floor(creature.targetY);
      this.pickNextCell(creature);
    }

    // Movement walks waypoint to waypoint along cell centers; the whole
    // speed*dt budget is consumed so no distance is ever dropped.
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      for (const creature of this.creatures) {
        if (creature.contactCooldown > 0) {
          creature.contactCooldown = Math.max(0, creature.contactCooldown - dt);
        }
        creature.anim += dt * (creature.moving ? 10 : 4);
        let remaining = creature.speed * dt;
        while (remaining > 0 && creature.moving) {
          const dx = creature.targetX - creature.x;
          const dy = creature.targetY - creature.y;
          const distance = Math.hypot(dx, dy);
          if (distance <= 1e-9) {
            creature.x = creature.targetX;
            creature.y = creature.targetY;
            this.arrive(creature);
          } else if (distance <= remaining) {
            creature.x = creature.targetX;
            creature.y = creature.targetY;
            remaining -= distance;
            this.arrive(creature);
          } else {
            creature.x += dx / distance * remaining;
            creature.y += dy / distance * remaining;
            remaining = 0;
          }
        }
      }
    }

    consumeContact(player, radius = RULES.contactRadius) {
      for (const creature of this.creatures) {
        if (creature.contactCooldown > 0) continue;
        const dx = creature.x - player.x;
        const dy = creature.y - player.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        if (!Maze3D.hasLineOfSight(
          this.map, player.x, player.y, creature.x, creature.y)) {
          continue;
        }
        creature.contactCooldown = RULES.contactCooldown;
        return {
          type: creature.type,
          x: creature.x,
          y: creature.y,
          phase: creature.phase,
        };
      }
      return null;
    }

    getSprites(elapsed, textures) {
      const creatures = textures.creatures || {};
      const sprites = [];
      for (const creature of this.creatures) {
        const known = Object.hasOwn(PROFILES, creature.type);
        const profile = known ? PROFILES[creature.type] : PROFILES.rat;
        let frames = creatures[creature.type];
        if ((!frames || frames.length === 0) && !known) {
          frames = creatures.rat; // unknown species keeps the rat stand-in
        }
        if (!frames || frames.length === 0) continue;
        let vertical = profile.vertical;
        if (profile.flying) {
          vertical += Math.sin(elapsed * 2.4 + creature.phase) * 0.08;
        }
        sprites.push({
          x: creature.x,
          y: creature.y,
          width: profile.width,
          height: profile.height,
          vertical,
          floorAnchored: !profile.flying,
          kind: 'creature',
          creatureType: creature.type,
          image: frames[Math.floor(creature.anim) % frames.length],
        });
      }
      return sprites;
    }
  }

  Maze3D.CreatureSwarm = CreatureSwarm;
  Maze3D.CREATURE_PROFILES = PROFILES;
})();
