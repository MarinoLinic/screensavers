import { SPRITES, DECOR } from './sprites.js';
import { DESERT_SPRITES } from './desert-sprites.js';
import { BIOME_SPRITES, BIOME_SPECIES } from './biome-sprites.js';
import { paintBiomeBackdrop, createBiomeVegetation, paintBiomeVegetation } from './biome-art.js';
import { isMarine } from './terrain.js';
import { paintShipwreck } from './marine-details.js';
import {
  DESERT_SPECIES, paintDesertBackdrop,
  createDesertVegetation, paintDesertVegetation,
} from './desert-art.js';

// Every sprite sheet the atlas knows about: aquatic + desert.
export const ALL_SPRITES = Object.freeze({ ...SPRITES, ...DESERT_SPRITES, ...BIOME_SPRITES });

export const SPECIES = Object.freeze({
  clown: { label: 'Clownfish', habitats: ['reef', 'lagoon','trop-atoll'], role: 'fish', motion:'swim', speed: 15 },
  tang: { label: 'Blue tang', habitats: ['reef', 'kelp', 'lagoon'], role: 'fish', speed: 19 },
  butterfly: { label: 'Butterflyfish', habitats: ['reef', 'lagoon','trop-beach'], role: 'fish', motion:'swim', speed: 12 },
  wrasse: { label: 'Ribbon wrasse', habitats: ['reef', 'kelp'], role: 'fish', speed: 22 },
  angel: { label: 'Angelfish', habitats: ['reef', 'kelp', 'lagoon'], role: 'fish', speed: 10 },
  lion: { label: 'Lionfish', habitats: ['reef', 'lagoon'], role: 'fish', speed: 8 },
  jelly: { label: 'Moon jelly', habitats: ['kelp', 'lagoon', 'abyss'], role: 'fish', speed: 4 },
  lantern: { label: 'Lantern angler', habitats: ['abyss'], role: 'fish', speed: 9 },
  turtle: { label: 'Green sea turtle', habitats: ['reef', 'kelp', 'lagoon','trop-beach','trop-atoll'], role: 'visitor', motion:'swim', speed: 9 },
  ray: { label: 'Manta ray', habitats: ['reef', 'kelp', 'lagoon', 'abyss'], role: 'visitor', speed: 13 },
  seahorse: { label: 'Seahorse', habitats: ['reef', 'kelp', 'lagoon'], role: 'fish', speed: 3 },
  crab: { label: 'Reef crab', habitats: ['reef', 'kelp', 'lagoon', 'abyss','trop-beach','trop-atoll'], role: 'bottom', motion:'bottom', speed: 3 },
  ...DESERT_SPECIES,
  ...BIOME_SPECIES,
});

export function createSpriteAtlas(makeCanvas) {
  const atlas = {};
  for (const [id, sprite] of Object.entries(ALL_SPRITES)) {
    // Sprites may carry explicit pose rows (frames:[rows,rows,rows]) —
    // desert art does — while aquatic sprites deform their base rows via
    // tail/fin rules. Either way every frame canvas shares one size.
    const frameRows = sprite.frames || [sprite.rows, sprite.rows, sprite.rows];
    const width = Math.max(...frameRows.map(rows => Math.max(...rows.map(r => r.length)))) + 4;
    const height = Math.max(...frameRows.map(rows => rows.length)) + 4;
    atlas[id] = [0, 1, 2].map(frame => {
      const rows = frameRows[frame] || frameRows[0];
      const canvas = makeCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const bend = [0, 1, -1][frame];
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < rows[y].length; x++) {
          const ink = rows[y][x];
          if (ink === '.') continue;
          if (!sprite.palette[ink]) throw new Error(`Unknown ${id} pixel "${ink}"`);
          let dx = 0, dy = 0;
          if (sprite.tail && x < sprite.tail) dy = bend;
          if (sprite.animate === 'tentacles' && y > 15) {
            dx = Math.round(Math.sin(y * 0.48 + frame * 2.1));
          }
          if (sprite.animate === 'flippers' && (y < 7 || y > 21)) dx = bend;
          if (sprite.animate === 'wings' && (y < 9 || y > 20)) dx = bend;
          if (sprite.animate === 'legs' && y > 11) dx = y % 2 ? bend : -bend;
          ctx.fillStyle = sprite.palette[ink];
          ctx.fillRect(x + 2 + dx, y + 2 + dy, 1, 1);
        }
      }
      return canvas;
    });
  }
  return atlas;
}

const PALETTES = {
  reef: {
    water: ['#519b96', '#2c858a', '#216c7e', '#1a526c', '#163b58'],
    haze: '#397d83', far: '#255667', sand: ['#597b79', '#70918a', '#8ba593', '#b5b598'],
    rock: ['#254750', '#38636a', '#54817d', '#8d9a82'],
    coral: [['#843f62', '#bc647f', '#ed9a9e'], ['#ae653c', '#df9860', '#f6cd8c'], ['#266b73', '#439795', '#7bbbaa']],
  },
  kelp: {
    water: ['#718c71', '#507d72', '#326b67', '#255459', '#1b3f4d'],
    haze: '#477269', far: '#2a5551', sand: ['#3c6158', '#527366', '#728676', '#a4a585'],
    rock: ['#294948', '#3b6259', '#628173', '#93a28a'],
    coral: [['#47694e', '#729265', '#bac482'], ['#8d6652', '#bc8970', '#debc92'], ['#356961', '#529987', '#9cc19a']],
  },
  lagoon: {
    water: ['#525b88', '#3f5782', '#304970', '#223b5e', '#192a49'],
    haze: '#445c7a', far: '#293f60', sand: ['#3f526e', '#566b85', '#7a8a9e', '#adb4b0'],
    rock: ['#263b54', '#405570', '#657c91', '#99adaf'],
    coral: [['#634666', '#a27090', '#dba5b5'], ['#6e5c75', '#a694a0', '#d9c3b9'], ['#276275', '#499ab0', '#89d1cf']],
  },
  abyss: {
    water: ['#152d4b', '#102640', '#0e2037', '#0b1b30', '#091629'],
    haze: '#1d334d', far: '#172b42', sand: ['#172b40', '#22384d', '#345268', '#5a7d8b'],
    rock: ['#142336', '#20364c', '#345268', '#54778a'],
    coral: [['#285664', '#438e99', '#90e6d3'], ['#3d4268', '#79629b', '#c797d7'], ['#345471', '#6294b2', '#b4e2e7']],
  },
};

function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function stamp(ctx, piece, x, floor, palette = piece.palette) {
  const width = Math.max(...piece.rows.map(row => row.length));
  const left = Math.round(x - width / 2), top = Math.round(floor - piece.rows.length);
  for (let y = 0; y < piece.rows.length; y++) {
    for (let x = 0; x < piece.rows[y].length; x++) {
      const ink = piece.rows[y][x];
      if (ink !== '.') rect(ctx, palette[ink], left + x, top + y, 1, 1);
    }
  }
}

// Scanline rasterization, not antialiased canvas paths.
function poly(ctx, color, points) {
  ctx.fillStyle = color;
  const pts = points.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
  for (let y = lo; y <= hi; y++) {
    const hits = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        hits.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const x = Math.ceil(hits[i]), end = Math.floor(hits[i + 1]);
      if (end >= x) ctx.fillRect(x, y, end - x + 1, 1);
    }
  }
}

function line(ctx, color, x0, y0, x1, y1, thick = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  for (;;) {
    ctx.fillRect(x0 - Math.floor(thick / 2), y0 - Math.floor(thick / 2), thick, thick);
    if (x0 === x1 && y0 === y1) break;
    const e = 2 * err;
    if (e >= dy) { err += dy; x0 += sx; }
    if (e <= dx) { err += dx; y0 += sy; }
  }
}

function mix(a, b, t) {
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const av = rgb(a), bv = rgb(b);
  return '#' + av.map((v, i) => Math.round(v + (bv[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function rock(ctx, x, y, w, h, pal, variant = 0) {
  const at = points => points.map(([u, v]) => [x + u * w, y + v * h]);
  poly(ctx, pal[0], at([[0, 1], [.03, .54], [.19, .26], [.35, .19], [.44, .02], [.76, 0], [.9, .32], [1, .7], [1, 1]]));
  poly(ctx, pal[1], at([[.05, .54], [.22, .28], [.38, .24], [.48, .08], [.7, .04], [.77, .47], [.63, .7], [.67, 1], [.07, 1]]));
  poly(ctx, pal[2], at([[.2, .3], [.37, .24], [.48, .08], [.71, .04], [.65, .2], [.48, .24], [.4, .43], [.22, .45]]));
  poly(ctx, pal[3], at([[.37, .24], [.48, .08], [.7, .04], [.68, .11], [.5, .14], [.43, .29]]));
  line(ctx, pal[0], x + w * .7, y + h * .34, x + w * .77, y + h * .74, 1);
  line(ctx, pal[0], x + w * .77, y + h * .74, x + w * .92, y + h * .82, 1);
  line(ctx, pal[2], x + w * .1, y + h * .7, x + w * .3, y + h * .68, 1);
  if (variant % 2 === 0) line(ctx, pal[2], x + w * .4, y + h * .81, x + w * .53, y + h * .8, 1);
}

function branchCoral(ctx, x, y, height, pal, seed) {
  const rng = random(seed);
  const stem = Math.max(1, Math.round(height / 26));
  function branch(bx, by, angle, len, depth) {
    const ex = bx + Math.cos(angle) * len, ey = by + Math.sin(angle) * len;
    const thick = Math.max(1, Math.round((stem + depth) * .8));
    line(ctx, pal[0], bx, by, ex, ey, thick + 1);
    line(ctx, pal[1], bx - 1, by, ex - 1, ey, thick);
    line(ctx, pal[2], ex - 1, ey - 2, ex - 1, ey + 1, 2);
    if (depth > 0) {
      branch(ex, ey, angle - .35 - rng() * .3, len * (.66 + rng() * .16), depth - 1);
      branch(ex, ey, angle + .34 + rng() * .32, len * (.64 + rng() * .18), depth - 1);
    }
  }
  branch(x, y, -Math.PI / 2, height * .32, 4);
}

function plateCoral(ctx, x, y, width, pal) {
  for (let i = 0; i < 4; i++) {
    const w = width * (1 - i * .18), yy = y - i * 7;
    poly(ctx, pal[0], [[x - w * .5, yy], [x + w * .5, yy - 2], [x + w * .38, yy + 4], [x - w * .37, yy + 6]]);
    line(ctx, pal[1], x - w * .5, yy, x + w * .5, yy - 2, 2);
    line(ctx, pal[2], x - w * .46, yy - 1, x + w * .31, yy - 2, 1);
  }
  rect(ctx, pal[0], x - 2, y, 5, 9);
}

function sponge(ctx, x, y, height, pal) {
  for (const [off, scale] of [[-8, .7], [0, 1], [8, .84]]) {
    const top = y - height * scale;
    poly(ctx, pal[0], [[x + off - 4, y], [x + off - 5, top + 4], [x + off - 2, top], [x + off + 4, top], [x + off + 6, top + 4], [x + off + 4, y]]);
    rect(ctx, pal[1], x + off - 3, top + 5, 3, height * scale - 5);
    rect(ctx, pal[2], x + off - 2, top, 5, 2);
    rect(ctx, pal[0], x + off - 1, top + 2, 3, 2);
    for (let k = 9; k < height * scale; k += 7) rect(ctx, pal[1], x + off + 2, top + k, 1, 2);
  }
}

function wreck(ctx, x, y, width, pal) {
  const hull = [[0, -.13], [.14, -.07], [.23, -.18], [.66, -.1], [.95, -.18], [.83, .1], [.37, .15], [.1, .05]];
  poly(ctx, pal[0], hull.map(([u, v]) => [x + u * width, y + v * width]));
  poly(ctx, pal[1], [[x + width * .12, y - 2], [x + width * .9, y - 7], [x + width * .78, y + 6], [x + width * .3, y + 9]]);
  line(ctx, pal[2], x + width * .1, y - 2, x + width * .85, y - 7, 2);
  for (let i = 0; i < 4; i++) {
    const px = x + width * (.28 + i * .13);
    rect(ctx, pal[0], px, y - 2, 5, 5);
    rect(ctx, pal[2], px, y - 2, 4, 1);
  }
  line(ctx, pal[0], x + width * .5, y - 4, x + width * .42, y - width * .58, 3);
  line(ctx, pal[2], x + width * .49, y - 8, x + width * .41, y - width * .58, 1);
  line(ctx, pal[1], x + width * .22, y - width * .29, x + width * .69, y - width * .33, 2);
  line(ctx, pal[0], x + width * .23, y - width * .29, x + width * .19, y - 4, 1);
  line(ctx, pal[0], x + width * .69, y - width * .33, x + width * .79, y - 7, 1);
  // A torn, weed-coloured sail with a deliberate missing lower corner.
  poly(ctx, pal[1], [[x + width * .44, y - width * .51], [x + width * .58, y - width * .4], [x + width * .65, y - width * .34], [x + width * .54, y - width * .33], [x + width * .54, y - width * .23], [x + width * .47, y - width * .25]]);
}

function kelp(ctx, plant, time) {
  const { x, y, height, phase, pal } = plant;
  const bend = Math.sin(time * .38 + phase) * height * .046;
  const at = t => [x + Math.sin(t * 2.5 + phase) * height * .027 + bend * t * t, y - height * t];
  let last = [x, y];
  for (let i = 1; i <= 20; i++) {
    const p = at(i / 20);
    line(ctx, pal[0], ...last, ...p, 3);
    line(ctx, pal[1], last[0] - 1, last[1], p[0] - 1, p[1], 1);
    last = p;
  }
  for (let i = 2; i < 19; i++) {
    const t = i / 20, [px, py] = at(t);
    const dir = i % 2 ? -1 : 1;
    const reach = height * .14 * Math.sin(t * Math.PI) + 4;
    const rise = reach * .85 + Math.sin(time * .48 + phase + t * 3) * 2;
    const leaf = [[0, 2], [.22, -1], [.56, -rise * .22], [.83, -rise * .55], [1, -rise],
      [.86, -rise + 3], [.85, -rise * .42], [.63, 1], [.31, 4]];
    poly(ctx, pal[0], leaf.map(([u, v]) => [px + dir * reach * u, py + v]));
    poly(ctx, pal[1], [[px, py], [px + dir * reach * .56, py - rise * .22],
      [px + dir * reach, py - rise], [px + dir * reach * .75, py - rise * .32], [px + dir * reach * .3, py + 1]]);
    line(ctx, pal[2], px, py, px + dir * reach * .57, py - rise * .13, 1);
    line(ctx, pal[2], px + dir * reach * .57, py - rise * .13, px + dir * reach * .91, py - rise * .72, 1);
    rect(ctx, pal[1], px + dir * 3, py - 1, 3, 3);
  }
}

export function paintBackdrop(ctx, width, height, habitat, seed, options = {}) {
  if (habitat === 'desert') {
    paintDesertBackdrop(ctx, width, height, seed, options.desertLight || 'golden');
    return;
  }
  if (!isMarine(habitat)) {
    paintBiomeBackdrop(ctx, width, height, habitat, seed);
    return;
  }
  const p = PALETTES[habitat] || PALETTES.reef;
  const rng = random(seed ^ 0x517cc1b7);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  // A restrained, quantized ramp: broad calm colour fields, not pixel noise.
  for (let y = 0; y < height; y++) {
    const step = Math.floor(y / height * 40) / 40;
    const f = step * 3.999, index = Math.floor(f);
    rect(ctx, mix(p.water[index], p.water[Math.min(4, index + 1)], f - index), 0, y, width, 1);
  }
  if (habitat !== 'abyss') {
    ctx.globalAlpha = .12;
    for (let i = 0; i < 24; i++) {
      const x = rng() * width, y = rng() * height * .12;
      rect(ctx, p.sand[3], x, y, 6 + rng() * 27, 1);
      rect(ctx, p.sand[3], x + 3, y + 2, 3 + rng() * 15, 1);
    }
    ctx.globalAlpha = 1;
  }

  const ridge = [[0, height]];
  for (let x = 0; x <= width + 6; x += 6) {
    const y = height * .68 + Math.sin(x * .017 + seed) * height * .023 + Math.sin(x * .047) * height * .014;
    ridge.push([x, y]);
  }
  ridge.push([width, height]);
  poly(ctx, p.far, ridge);

  if (habitat === 'kelp') {
    for (let i = 0; i < Math.ceil(width / 32); i++) {
      kelp(ctx, { x: i * 33 + rng() * 16, y: height * .78, height: height * (.3 + rng() * .44), phase: rng() * 6, pal: [p.far, p.far, p.haze] }, 0);
    }
  } else {
    for (let i = 0; i < Math.ceil(width / 40); i++) {
      const x = i * 42 + rng() * 18;
      branchCoral(ctx, x, height * .77, 13 + rng() * 27, [p.far, p.far, p.haze], seed + i);
    }
  }

  const floor = [[0, height]];
  for (let x = 0; x <= width + 4; x += 4) {
    const y = height * .84 + Math.sin(x * .012 + 1.2) * height * .021 + Math.sin(x * .037) * 2;
    floor.push([x, y]);
  }
  floor.push([width, height]);
  poly(ctx, p.sand[0], floor);
  const terrace = floor.map(([x, y], i) => [x, i === 0 || i === floor.length - 1 ? y : y + height * .07]);
  poly(ctx, p.sand[1], terrace);
  for (let i = 0; i < Math.floor(width * height / 430); i++) {
    const x = rng() * width, y = height * (.87 + rng() * .13);
    const size = rng() * 4;
    rect(ctx, rng() < .55 ? p.sand[0] : p.sand[2], x, y, size + 1, 1);
    if (size > 3) rect(ctx, p.sand[3], x + 1, y - 1, 2, 1);
  }
  // Sand ripples taper toward the vanishing point.
  for (let i = 0; i < 8; i++) {
    const yy = height * (.86 + i * .017);
    const mid = width * .48 + Math.sin(i * .7) * width * .07;
    const span = width * (.05 + i * .018);
    line(ctx, p.sand[2], mid - span, yy + 2, mid, yy, 1);
    line(ctx, p.sand[2], mid, yy, mid + span * .7, yy + 1, 1);
  }

  if (habitat === 'reef') {
    rock(ctx, -width * .04, height * .71, width * .25, height * .27, p.rock);
    rock(ctx, width * .79, height * .65, width * .26, height * .31, p.rock, 1);
    rock(ctx, width * .57, height * .81, width * .12, height * .1, p.rock);
    wreck(ctx, width * .32, height * .82, Math.min(86, width * .22), [p.far, p.haze, p.sand[0]]);
    branchCoral(ctx, width * .13, height * .79, height * .17, p.coral[0], seed + 40);
    branchCoral(ctx, width * .87, height * .74, height * .19, p.coral[1], seed + 41);
    plateCoral(ctx, width * .08, height * .91, width * .14, p.coral[2]);
    plateCoral(ctx, width * .91, height * .87, width * .13, p.coral[0]);
    sponge(ctx, width * .63, height * .86, height * .075, p.coral[1]);
    stamp(ctx, DECOR.brain, width * .8, height * .97);
    stamp(ctx, DECOR.clam, width * .38, height * .985);
    stamp(ctx, DECOR.star, width * .58, height * .958);
  } else if (habitat === 'kelp') {
    rock(ctx, -width * .05, height * .83, width * .3, height * .2, p.rock);
    rock(ctx, width * .82, height * .76, width * .2, height * .23, p.rock);
    rock(ctx, width * .42, height * .8, width * .12, height * .1, p.rock);
    sponge(ctx, width * .18, height * .9, height * .09, p.coral[1]);
    plateCoral(ctx, width * .84, height * .91, width * .13, p.coral[0]);
    stamp(ctx, DECOR.brain, width * .24, height * .97, { ...DECOR.brain.palette, d: '#5e7151', m: '#91a575', h: '#c9cd97' });
    stamp(ctx, DECOR.star, width * .52, height * .955);
    stamp(ctx, DECOR.clam, width * .65, height * .99);
  } else if (habitat === 'lagoon') {
    paintShipwreck(ctx,width,height,seed);
    rock(ctx, -width * .06, height * .73, width * .31, height * .3, p.rock);
    branchCoral(ctx, width * .11, height * .81, height * .17, p.coral[0], seed + 60);
    branchCoral(ctx, width * .9, height * .8, height * .14, p.coral[2], seed + 61);
    plateCoral(ctx, width * .13, height * .93, width * .15, p.coral[1]);
    sponge(ctx, width * .76, height * .89, height * .1, p.coral[2]);
    for (let i = 0; i < 12; i++) {
      const x = width * (.27 + rng() * .28), y = height * (.89 + rng() * .1);
      rect(ctx, p.coral[2][0], x - 1, y - 1, 5, 4);
      rect(ctx, p.coral[2][2], x, y - 1, 2, 1);
    }
    stamp(ctx, DECOR.clam, width * .4, height * .97);
    stamp(ctx, DECOR.brain, width * .095, height * .99, { ...DECOR.brain.palette, d: '#705c85', m: '#ac93b2', h: '#ddc0cd' });
  } else {
    rock(ctx, -width * .02, height * .67, width * .23, height * .38, p.rock);
    rock(ctx, width * .83, height * .61, width * .2, height * .4, p.rock);
    for (let i = 0; i < 3; i++) {
      const x = width * (.16 + i * .075), hh = height * (.15 + i * .05);
      rock(ctx, x, height * .88 - hh, width * .043, hh, p.rock, i);
      rect(ctx, '#0a1829', x + width * .009, height * .88 - hh, width * .025, 2);
      rect(ctx, '#4c9394', x + width * .009, height * .88 - hh - 1, width * .025, 1);
    }
    // A half-buried ribcage: a small story in the deep, not a repeated prop.
    const bx = width * .45, by = height * .87, bw = width * .28;
    line(ctx, p.rock[2], bx, by, bx + bw, by - 3, 3);
    for (let i = 0; i < 7; i++) {
      const x = bx + bw * (i / 8), rise = Math.sin((i + 1) / 9 * Math.PI) * height * .07;
      line(ctx, p.rock[2], x, by - 1, x + 2, by - rise, 2);
      line(ctx, p.rock[3], x + 2, by - rise, x + 7, by - rise - 2, 1);
      line(ctx, p.rock[2], x + 7, by - rise - 2, x + 10, by - 4, 2);
    }
    branchCoral(ctx, width * .08, height * .85, height * .2, p.coral[0], seed + 70);
    branchCoral(ctx, width * .91, height * .79, height * .16, p.coral[1], seed + 71);
    sponge(ctx, width * .73, height * .89, height * .11, p.coral[2]);
    for (let i = 0; i < 32; i++) {
      const x = rng() * width, y = height * (.91 + rng() * .09);
      rect(ctx, p.coral[i % 3][0], x - 1, y - 1, 4, 4);
      rect(ctx, p.coral[i % 3][2], x, y, 1, 1);
    }
    stamp(ctx, DECOR.polyp, width * .63, height * .975);
    stamp(ctx, DECOR.polyp, width * .13, height * 1.02, { ...DECOR.polyp.palette, m: '#a48cbe', h: '#dab7df', w: '#f0d4ef' });
  }
}

function seaFan(ctx, plant, time) {
  const { x, y, height, pal, phase } = plant;
  const sway = Math.round(Math.sin(time * .29 + phase) * 1.5);
  const tips = [];
  for (let i = 0; i <= 12; i++) {
    const angle = -Math.PI / 2 + (i - 6) * .17;
    const len = height * (1 - Math.abs(i - 6) * .027);
    const px = x + Math.cos(angle) * len + sway, py = y + Math.sin(angle) * len;
    line(ctx, pal[0], x, y, px, py, 2);
    line(ctx, pal[1], x - 1, y - 2, px - 1, py, 1);
    tips.push([px, py]);
  }
  for (let ring = 1; ring <= 6; ring++) {
    const t = ring / 6;
    for (let i = 0; i < tips.length - 1; i++) {
      const a = tips[i], b = tips[i + 1];
      line(ctx, ring % 2 ? pal[0] : pal[1], x + (a[0] - x) * t, y + (a[1] - y) * t,
        x + (b[0] - x) * t, y + (b[1] - y) * t - 1, 1);
    }
  }
  for (const [px, py] of tips) rect(ctx, pal[2], px, py, 1, 2);
  line(ctx, pal[0], x, y + 4, x, y - height * .13, 4);
  line(ctx, pal[1], x - 1, y + 2, x - 1, y - height * .1, 1);
}

function anemone(ctx, plant, time) {
  const { x, y, height, pal, phase } = plant;
  for (let i = 0; i < 11; i++) {
    const xx = x + (i - 5) * 2;
    const hh = height * (.6 + .4 * Math.sin(i * .31 + .7));
    const sway = Math.round(Math.sin(time * .65 + phase + i * .3) * 2);
    line(ctx, pal[0], xx, y, xx - 2, y - hh * .5, 2);
    line(ctx, pal[1], xx - 2, y - hh * .5, xx + sway, y - hh, 2);
    rect(ctx, pal[2], xx + sway, y - hh, 2, 2);
  }
  poly(ctx, pal[0], [[x - 13, y], [x - 8, y - 3], [x + 8, y - 3], [x + 13, y], [x + 8, y + 4], [x - 8, y + 4]]);
  line(ctx, pal[1], x - 8, y, x + 8, y, 1);
}

export function createVegetation(width, height, habitat, seed, options = {}) {
  if (habitat === 'desert') {
    return createDesertVegetation(width, height, seed, options.desertLight || 'golden');
  }
  if (!isMarine(habitat)) return createBiomeVegetation(width, height, habitat, seed);
  const p = PALETTES[habitat] || PALETTES.reef;
  const rng = random(seed ^ 0x3a65d028), plants = [];
  const add = (kind, u, v, hh, palette, salt = 0) => plants.push({
    kind, x: Math.round(width * u), y: Math.round(height * v),
    height: Math.round(height * hh), pal: palette,
    phase: rng() * Math.PI * 2, seed: seed + salt,
  });
  const grassPal = habitat === 'abyss' ? ['#193c4d', '#2e6776', '#5fa9ac']
    : habitat === 'lagoon' ? ['#244859', '#427c84', '#8faeaa']
      : ['#215251', '#3b8171', '#94ac77'];
  if (habitat === 'kelp') {
    const warm = ['#334e3f', '#72895a', '#b3b77d'];
    const cool = ['#214f48', '#47836a', '#91b085'];
    for (const [u, hh] of [[.015, .77], [.08, .61], [.16, .44], [.86, .51], [.94, .73], [1.01, .87]]) {
      add('kelp', u, .98, hh, u < .1 || u > .95 ? warm : cool);
    }
    add('fan', .08, .98, .14, p.coral[1]);
    add('anemone', .73, .97, .04, p.coral[1]);
  } else if (habitat === 'reef') {
    add('fan', .035, .99, .22, p.coral[0]);
    add('fan', .96, .99, .2, p.coral[2]);
    add('coral', .17, .98, .16, p.coral[1], 123);
    add('coral', .88, 1, .24, p.coral[0], 124);
    add('sponge', .06, 1, .13, p.coral[1]);
    add('anemone', .3, .96, .045, p.coral[2]);
    add('anemone', .75, .99, .055, p.coral[0]);
  } else if (habitat === 'lagoon') {
    add('kelp', .012, 1, .34, grassPal);
    add('kelp', .995, 1, .37, grassPal);
    add('fan', .12, .99, .16, p.coral[0]);
    add('fan', .9, 1, .2, p.coral[2]);
    add('anemone', .27, .99, .035, p.coral[2]);
    add('anemone', .83, .99, .04, p.coral[2]);
  } else {
    add('fan', .025, 1, .18, p.coral[1]);
    add('fan', .97, 1, .22, p.coral[0]);
    add('coral', .82, 1, .13, p.coral[2], 125);
    add('anemone', .12, .98, .045, p.coral[0]);
    add('anemone', .74, 1, .065, p.coral[1]);
  }
  for (let i = 0; i < Math.ceil(width / 17); i++) {
    const u = rng();
    // Leave the central sandy clearing legible.
    if (u > .32 && u < .68 && rng() < .78) continue;
    add('grass', u, .95 + rng() * .055, .025 + rng() * .045, grassPal);
  }
  return plants.sort((a, b) => a.y - b.y);
}

export function paintVegetation(ctx, vegetation, time) {
  // Desert plant records are tagged biome:'desert' and painted wholesale by
  // the desert module; aquatic records keep their per-kind painters.
  if (vegetation.length && vegetation[0].biome === 'desert') {
    paintDesertVegetation(ctx, vegetation, time);
    return;
  }
  if (vegetation.length && vegetation[0].biome) {
    paintBiomeVegetation(ctx, vegetation, time);
    return;
  }
  for (const plant of vegetation) {
    const { x, y, height, pal, phase, seed } = plant;
    if (plant.kind === 'kelp') kelp(ctx, plant, time);
    else if (plant.kind === 'fan') seaFan(ctx, plant, time);
    else if (plant.kind === 'anemone') anemone(ctx, plant, time);
    else if (plant.kind === 'coral') branchCoral(ctx, x, y, height, pal, seed);
    else if (plant.kind === 'sponge') sponge(ctx, x, y, height, pal);
    else {
      for (let i = 0; i < 5; i++) {
        const base = x + (i - 2) * 2, spread = (i - 2) * 2;
        const sway = Math.sin(time * .5 + phase + i * .3) * 2;
        const top = y - height * (1 - Math.abs(i - 2) * .17);
        poly(ctx, i % 2 ? pal[0] : pal[1], [[base - 1, y], [base + spread * .4 + sway, top + 3], [base + spread + sway, top], [base + 1, y]]);
        rect(ctx, pal[2], base + spread + sway, top, 1, 1);
      }
    }
  }
}
