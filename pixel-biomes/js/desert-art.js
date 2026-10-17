import { DESERT_DECOR } from './desert-sprites.js';

export const DESERT_SPECIES = Object.freeze({
  lizard: { label: 'Sand lizard', habitats: ['desert'], role: 'ground', motion: 'crawl', speed: 6 },
  jerboa: { label: 'Jerboa', habitats: ['desert'], role: 'ground', motion: 'hop', speed: 10 },
  tortoise: { label: 'Desert tortoise', habitats: ['desert'], role: 'ground', motion: 'crawl', speed: 2 },
  scorpion: { label: 'Sand scorpion', habitats: ['desert'], role: 'ground', motion: 'crawl', speed: 2.5 },
  scarab: { label: 'Bronze scarab', habitats: ['desert'], role: 'ground', motion: 'crawl', speed: 4 },
  wheatear: { label: 'Desert wheatear', habitats: ['desert'], role: 'flyer', motion: 'fly', speed: 14 },
  fennec: { label: 'Fennec fox', habitats: ['desert'], role: 'visitor', motion: 'walk', speed: 8 },
  camel: { label: 'Dromedary', habitats: ['desert'], role: 'visitor', motion: 'walk', speed: 6 },
});

const LOOKS = {
  golden: {
    sky: ['#bc7e87', '#dda197', '#f1c4a3', '#f8ddae'],
    cloud: '#ffe3ba', sun: '#fff0bd', sunShade: '#f3c687',
    far: ['#a27d88', '#bd9390', '#dbaf9b'],
    rock: ['#794951', '#a76052', '#ca855f', '#f0b77b', '#f5c998'],
    sand: ['#c58c65', '#d5a375', '#e3b985', '#edce9c'],
    sandShade: '#b88564', pebble: '#8f6960',
    green: ['#38554f', '#59785c', '#8ba070', '#c7c797'],
    grass: ['#8c765b', '#b59b6c', '#e0c58a'],
    flower: ['#965775', '#d88c9b', '#f7c1b6', '#ffe7a0'],
  },
  day: {
    sky: ['#73a9c0', '#95c1cb', '#c2d7ce', '#f1e2bc'],
    cloud: '#edf0d8', sun: '#fff6d1', sunShade: '#eddaa2',
    far: ['#a4999a', '#c0aba0', '#dcc1ab'],
    rock: ['#84514c', '#ad6b53', '#d49165', '#efbd86', '#f5d19a'],
    sand: ['#c79974', '#d6ad80', '#e6c392', '#efdbac'],
    sandShade: '#bb926f', pebble: '#97715f',
    green: ['#355550', '#567e63', '#8ea876', '#c9d095'],
    grass: ['#8e7c58', '#b5a473', '#e4d294'],
    flower: ['#965374', '#de919a', '#ffd1b4', '#fff0ab'],
  },
  night: {
    sky: ['#151e37', '#252b46', '#424059', '#756274'],
    cloud: '#9890a0', sun: '#e7ecd5', sunShade: '#9caeb6',
    far: ['#343647', '#4b4155', '#6f5368'],
    rock: ['#252837', '#3d3545', '#5b4557', '#94727e', '#b49a9b'],
    sand: ['#544957', '#6d5965', '#867078', '#a29192'],
    sandShade: '#544553', pebble: '#3a3344',
    green: ['#283e47', '#416267', '#72908d', '#a9b8a1'],
    grass: ['#464555', '#6c6577', '#9a939e'],
    flower: ['#61465e', '#9c758a', '#d0a9b6', '#e4d9bc'],
  },
};

const palette = light => LOOKS[light] || LOOKS.golden;
const modulo = (n, m) => ((n % m) + m) % m;
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rect(ctx, color, x, y, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
function mix(a, b, t) {
  const av = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const bv = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + av.map((v, i) => Math.round(v + (bv[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function poly(ctx, color, points) {
  const pts = points.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const low = Math.min(...pts.map(p => p[1])), high = Math.max(...pts.map(p => p[1]));
  ctx.fillStyle = color;
  for (let y = low; y <= high; y++) {
    const cuts = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        cuts.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const x = Math.ceil(cuts[i]), end = Math.floor(cuts[i + 1]);
      if (end >= x) ctx.fillRect(x, y, end - x + 1, 1);
    }
  }
}
function line(ctx, color, x0, y0, x1, y1, thick = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  ctx.fillStyle = color;
  for (;;) {
    ctx.fillRect(x0 - Math.floor(thick / 2), y0 - Math.floor(thick / 2), thick, thick);
    if (x0 === x1 && y0 === y1) break;
    const e = error * 2;
    if (e >= dy) { error += dy; x0 += sx; }
    if (e <= dx) { error += dx; y0 += sy; }
  }
}
function stamp(ctx, piece, x, floor, overrides = {}) {
  const colors = { ...piece.palette, ...overrides };
  const width = Math.max(...piece.rows.map(row => row.length));
  const left = Math.round(x - width / 2), top = Math.round(floor - piece.rows.length);
  for (let y = 0; y < piece.rows.length; y++) {
    for (let x = 0; x < piece.rows[y].length; x++) {
      const pixel = piece.rows[y][x];
      if (pixel !== '.') rect(ctx, colors[pixel], left + x, top + y);
    }
  }
}

// The wildlife and the painted sand share this ground profile.
export function desertGroundY(width, height, x, depth) {
  const u = x / Math.max(1, width), d = Math.max(0, Math.min(1, depth));
  const relief = (Math.sin(u * 4.5 + 1.1) * 7 + Math.sin(u * 10.2 - .8) * 2.8) * (1 - d);
  return Math.round(height * (.68 + .28 * d) + relief * height / 300);
}

function octagon(ctx, color, x, y, r) {
  const k = r * .43;
  poly(ctx, color, [[x - k, y - r], [x + k, y - r], [x + r, y - k], [x + r, y + k],
    [x + k, y + r], [x - k, y + r], [x - r, y + k], [x - r, y - k]]);
}

function mesa(ctx, x, base, w, h, pal, seed) {
  const rng = random(seed), at = points => points.map(([u, v]) => [x + u * w, base - h + v * h]);
  const shape = [[0, 1], [.05, .73], [.15, .73], [.17, .27], [.23, .27], [.24, .04],
    [.7, .04], [.73, .12], [.82, .12], [.84, .47], [.9, .47], [.94, .81], [1, 1]];
  poly(ctx, pal[0], at(shape));
  poly(ctx, pal[1], at([[.17, .71], [.21, .28], [.27, .28], [.29, .08], [.65, .08],
    [.68, .5], [.76, .5], [.79, .82], [.87, .82], [.95, 1], [.1, 1]]));
  poly(ctx, pal[2], at([[.24, .04], [.7, .04], [.73, .12], [.8, .12], [.72, .18], [.28, .16]]));
  line(ctx, pal[3] || pal[2], x + w * .24, base - h * .96, x + w * .69, base - h * .96, 2);
  for (let i = 0; i < 8; i++) {
    const level = .2 + i * .09, left = .21 + rng() * .05, end = .65 + rng() * .08;
    line(ctx, i % 3 ? pal[0] : pal[2], x + w * left, base - h + h * level, x + w * end, base - h + h * level + 1, 1);
    if (i % 2 === 0) line(ctx, pal[2], x + w * left, base - h + h * level + 2, x + w * (left + .14), base - h + h * level + 2, 1);
  }
  line(ctx, pal[0], x + w * .55, base - h * .81, x + w * .52, base - h * .43, 1);
  line(ctx, pal[0], x + w * .52, base - h * .43, x + w * .59, base - h * .3, 1);
}

function stoneArch(ctx, x, base, w, h, pal) {
  const at = points => points.map(([u, v]) => [x + u * w, base - h + v * h]);
  // One concave horseshoe contour keeps the opening genuinely transparent.
  poly(ctx, pal[0], at([[0, 1], [.06, .65], [.1, .35], [.21, .14], [.35, .04], [.64, 0],
    [.81, .11], [.92, .3], [.94, .58], [1, 1], [.72, 1], [.69, .55], [.63, .39],
    [.48, .3], [.33, .37], [.24, .57], [.23, 1]]));
  poly(ctx, pal[1], at([[.05, 1], [.1, .65], [.15, .35], [.26, .17], [.39, .09], [.65, .06],
    [.81, .17], [.86, .32], [.88, .63], [.94, 1], [.8, 1], [.76, .53], [.68, .32],
    [.49, .23], [.3, .3], [.2, .54], [.18, 1]]));
  poly(ctx, pal[2], at([[.16, .34], [.26, .17], [.39, .09], [.65, .06], [.81, .17], [.78, .23],
    [.6, .16], [.39, .19], [.27, .27], [.22, .46]]));
  poly(ctx, pal[3], at([[.26, .17], [.39, .09], [.65, .06], [.79, .16], [.63, .11], [.42, .14], [.29, .23]]));
  for (let i = 0; i < 6; i++) {
    const yy = base - h * (.2 + i * .09);
    line(ctx, pal[i % 2 ? 0 : 2], x + w * .09, yy, x + w * .19, yy + 1, 1);
    line(ctx, pal[i % 2 ? 0 : 2], x + w * .81, yy - 4, x + w * .92, yy - 3, 1);
  }
  line(ctx, pal[0], x + w * .6, base - h * .9, x + w * .55, base - h * .75, 1);
  line(ctx, pal[0], x + w * .55, base - h * .75, x + w * .57, base - h * .67, 1);
  line(ctx, pal[2], x + w * .22, base - h * .57, x + w * .22, base - h * .2, 1);
}

function boulder(ctx, x, y, size, pal) {
  const h = size * .57;
  poly(ctx, pal[0], [[x - size / 2, y], [x - size * .38, y - h * .67], [x - size * .06, y - h],
    [x + size * .3, y - h * .88], [x + size / 2, y - h * .25], [x + size * .44, y + 2]]);
  poly(ctx, pal[1], [[x - size * .38, y - h * .6], [x - size * .06, y - h * .92], [x + size * .26, y - h * .83],
    [x + size * .12, y - h * .32], [x - size * .29, y - h * .23]]);
  line(ctx, pal[3], x - size * .07, y - h * .96, x + size * .25, y - h * .87, 1);
  line(ctx, pal[0], x + size * .04, y - h * .6, x + size * .1, y - h * .31, 1);
}

function blossom(ctx, x, y, pal, white = false) {
  const colors = white ? [pal[0], '#d8d4a4', '#fff0cb', '#e5bc6f'] : pal;
  rect(ctx, colors[0], x - 4, y - 2, 9, 4);
  rect(ctx, colors[1], x - 3, y - 4, 2, 3);
  rect(ctx, colors[1], x + 2, y - 4, 2, 3);
  rect(ctx, colors[1], x - 4, y - 1, 4, 3);
  rect(ctx, colors[1], x + 1, y - 1, 4, 3);
  rect(ctx, colors[2], x - 2, y - 3, 2, 2);
  rect(ctx, colors[2], x + 2, y - 3, 1, 2);
  rect(ctx, colors[3], x, y - 1, 2, 2);
}

function saguaro(ctx, x, y, height, pal, flowers, variant = 0) {
  const width = Math.max(5, Math.round(height * .115));
  const left = x - width / 2, top = y - height;
  poly(ctx, pal[0], [[left, y], [left, top + 3], [left + 2, top], [left + width - 2, top],
    [left + width, top + 3], [left + width, y]]);
  rect(ctx, pal[1], left + 1, top + 4, width - 3, height - 4);
  rect(ctx, pal[2], left + 2, top + 3, Math.max(2, width / 3), height - 3);
  line(ctx, pal[3], left + 2, top + 5, left + 2, y - 2, 1);
  for (let dx = 5; dx < width - 1; dx += 3) line(ctx, pal[0], left + dx, top + 8, left + dx, y, 1);

  for (const side of [-1, 1]) {
    const join = y - height * (side < 0 ? .4 : .56);
    const reach = height * (side < 0 ? .27 : .22);
    const end = x + side * reach;
    const armTop = join - height * (side < 0 ? .27 : .22) - variant * 2;
    const armW = Math.max(4, width - 1);
    poly(ctx, pal[0], [[x, join - armW / 2], [end - side * 2, join - armW / 2],
      [end - side * armW / 2, join - armW], [end - side * armW / 2, armTop + 2],
      [end - side * (armW / 2 - 2), armTop], [end + side * (armW / 2 - 2), armTop],
      [end + side * armW / 2, armTop + 2], [end + side * armW / 2, join],
      [end + side * 2, join + armW / 2], [x, join + armW / 2]]);
    line(ctx, pal[1], x, join - 1, end, join - 1, Math.max(2, armW - 2));
    line(ctx, pal[1], end, join - 2, end, armTop + 3, Math.max(2, armW - 2));
    line(ctx, pal[2], end - 1, join - 3, end - 1, armTop + 3, 2);
    line(ctx, pal[3], end - 2, join - 5, end - 2, armTop + 4, 1);
    for (let py = armTop + 8; py < join - 4; py += 6) rect(ctx, pal[0], end + 1, py);
    if (variant % 2 === 0 && side > 0) blossom(ctx, end, armTop + 1, flowers, true);
  }
  for (let py = top + 9; py < y - 4; py += 7) {
    rect(ctx, pal[3], left - 1, py);
    rect(ctx, pal[0], left + width, py + 2);
    rect(ctx, pal[0], x + 1, py - 2);
  }
}

function pricklyPear(ctx, x, y, height, pal, flowers) {
  const pads = [[0, 0, 1], [-.18, -.16, .83], [.18, -.23, .86],
    [-.34, -.42, .72], [-.12, -.48, .8], [.34, -.5, .78], [.11, -.7, .86]];
  for (const [u, v, scale] of pads) {
    const px = x + u * height, py = y + v * height - height * .15;
    const ww = height * .2 * scale, hh = height * .29 * scale;
    poly(ctx, pal[0], [[px - ww * .3, py - hh], [px + ww * .3, py - hh], [px + ww * .5, py - hh * .75],
      [px + ww * .5, py - hh * .22], [px + ww * .25, py], [px - ww * .25, py],
      [px - ww * .5, py - hh * .22], [px - ww * .5, py - hh * .75]]);
    poly(ctx, pal[1], [[px - ww * .3, py - hh + 2], [px + ww * .2, py - hh + 2],
      [px + ww * .32, py - hh * .3], [px, py - 2], [px - ww * .32, py - hh * .25]]);
    line(ctx, pal[2], px - ww * .2, py - hh + 3, px - ww * .25, py - hh * .28, 2);
    for (let j = 3; j < hh - 2; j += 4) {
      rect(ctx, pal[3], px - 1, py - hh + j);
      rect(ctx, pal[0], px + 2, py - hh + j + 1);
    }
    if (v < -.45) blossom(ctx, px, py - hh + 2, flowers);
  }
  rect(ctx, pal[0], x - 2, y - 8, 4, 8);
}

function dryGrass(ctx, plant, time) {
  const { x, y, height, pal, phase } = plant;
  for (let i = 0; i < 7; i++) {
    const dx = i - 3, sway = Math.sin(time * .55 + phase + i * .31) * 1.5;
    const top = y - height * (1 - Math.abs(dx) * .14);
    const tipX = x + dx * 2 + sway;
    line(ctx, pal[0], x + dx, y, tipX, top, 1);
    line(ctx, pal[1], x + dx - 1, y - 2, tipX - 1, top + 2, 1);
    if (i % 2 === 0) {
      line(ctx, pal[2], tipX - 1, top + 3, tipX + 2, top, 1);
      rect(ctx, pal[2], tipX + 1, top - 1);
    }
  }
}

function desertShrub(ctx, plant, time) {
  const { x, y, height, pal, phase } = plant;
  for (let i = 0; i < 5; i++) {
    const xx = x + (i - 2) * height * .2;
    const top = y - height * (.75 + .2 * Math.sin(i * 2.3));
    const drift = Math.round(Math.sin(time * .3 + phase) * .7);
    line(ctx, pal[0], x, y, xx + drift, top, 2);
    for (let j = 0; j < 3; j++) {
      const t = .4 + j * .2, px = x + (xx - x) * t, py = y + (top - y) * t;
      const side = j % 2 ? 1 : -1;
      line(ctx, pal[1], px, py, px + side * 4, py - 3, 1);
      rect(ctx, pal[2], px + side * 4 - 1, py - 4, 3, 2);
    }
    rect(ctx, pal[2], xx + drift - 1, top, 3, 2);
  }
}

export function createDesertVegetation(width, height, seed, light = 'golden') {
  const p = palette(light), rng = random(seed ^ 0x62e871d4), plants = [];
  const add = (kind, u, v, hh, colors, variant = 0) => plants.push({
    biome: 'desert', kind, x: Math.round(width * u), y: Math.round(height * v),
    height: Math.round(height * hh), pal: colors, flowers: p.flower,
    phase: rng() * Math.PI * 2, variant,
  });
  add('saguaro', .032, 1.01, .29, p.green, 1);
  add('saguaro', .94, .99, .34, p.green, 2);
  add('prickly', .115, 1.025, .115, p.green);
  add('prickly', .845, 1.015, .12, p.green);
  add('shrub', .2, 1, .064, p.grass);
  add('shrub', .755, 1, .062, p.grass);
  for (let i = 0; i < Math.ceil(width / 28); i++) {
    const u = rng();
    if (u > .32 && u < .65 && rng() < .65) continue;
    add('grass', u, .96 + rng() * .045, .028 + rng() * .023, p.grass);
  }
  return plants.sort((a, b) => a.y - b.y);
}

export function paintDesertVegetation(ctx, plants, time) {
  for (const plant of plants) {
    if (plant.kind === 'saguaro') saguaro(ctx, plant.x, plant.y, plant.height, plant.pal, plant.flowers, plant.variant);
    else if (plant.kind === 'prickly') pricklyPear(ctx, plant.x, plant.y, plant.height, plant.pal, plant.flowers);
    else if (plant.kind === 'shrub') desertShrub(ctx, plant, time);
    else dryGrass(ctx, plant, time);
  }
}

export function paintDesertBackdrop(ctx, width, height, seed, light = 'golden') {
  const p = palette(light), rng = random(seed ^ 0x187b635a);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < height; y++) {
    const t = Math.floor(Math.min(1, y / (height * .65)) * 36) / 36;
    const q = t * 2.999, index = Math.floor(q);
    rect(ctx, mix(p.sky[index], p.sky[Math.min(3, index + 1)], q - index), 0, y, width, 1);
  }
  const sunX = width * .73, sunY = height * .18, radius = Math.max(11, height * .06);
  if (light !== 'night') {
    for (let i = 5; i > 0; i--) {
      ctx.globalAlpha = .035;
      octagon(ctx, p.sun, sunX, sunY, radius + i * 4);
    }
    ctx.globalAlpha = 1;
    octagon(ctx, p.sunShade, sunX, sunY + 1, radius);
    octagon(ctx, p.sun, sunX - 1, sunY - 1, radius - 1);
    rect(ctx, p.sunShade, sunX - radius * .7, sunY + radius * .5, radius * 1.4, 1);
  } else {
    octagon(ctx, p.sunShade, sunX, sunY, radius);
    octagon(ctx, p.sun, sunX - 1, sunY - 1, radius - 1);
    octagon(ctx, p.sunShade, sunX + radius * .38, sunY + radius * .27, radius * .27);
    octagon(ctx, mix(p.sun, p.sunShade, .45), sunX - radius * .25, sunY - radius * .35, radius * .22);
    rect(ctx, p.sunShade, sunX - radius * .4, sunY + radius * .2, 2, 2);
    rect(ctx, p.sunShade, sunX + radius * .2, sunY - radius * .4, 3, 2);
    const stars = random(seed ^ 0x34ecc13);
    for (let i = 0; i < Math.ceil(width / 8); i++) {
      const x = stars() * width, y = stars() * height * .43;
      rect(ctx, mix(p.sky[0], p.sun, .35 + stars() * .45), x, y);
      if (i % 13 === 0) {
        rect(ctx, p.sunShade, x - 1, y, 3, 1);
        rect(ctx, p.sunShade, x, y - 1, 1, 3);
        rect(ctx, p.sun, x, y);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = width * (.12 + i * .32), y = height * (i === 2 ? .29 : .13 + i % 2 * .13);
    const w = Math.min(width * .2, 66), hh = 4 + i;
    const color = mix(p.sky[i % 2], p.cloud, light === 'night' ? .16 : .28);
    poly(ctx, color, [[x - w * .5, y + hh], [x - w * .38, y + 2], [x - w * .12, y + 2],
      [x, y - 1], [x + w * .23, y], [x + w * .29, y + 3], [x + w * .42, y + 3], [x + w * .5, y + hh]]);
    line(ctx, mix(color, p.cloud, .16), x - w * .3, y + hh, x + w * .35, y + hh, 1);
  }

  const ridge = [[0, height]];
  for (let x = 0; x <= width + 4; x += 4) {
    ridge.push([x, height * .51 + Math.sin(x / width * 11.3) * height * .027 + Math.sin(x / width * 27.7) * height * .013]);
  }
  ridge.push([width, height]);
  poly(ctx, p.far[0], ridge);
  mesa(ctx, width * .29, height * .64, width * .28, height * .18, [...p.far, p.far[2]], seed + 9);
  mesa(ctx, -width * .14, height * .69, width * .51, height * .35, p.rock, seed + 10);
  stoneArch(ctx, width * .59, height * .69, Math.min(width * .34, height * .48), height * .34, p.rock);
  mesa(ctx, width * .9, height * .73, width * .21, height * .22, p.rock, seed + 11);

  const dune = [[0, height]];
  for (let x = 0; x <= width + 4; x += 4) {
    dune.push([x, height * .64 + Math.sin(x / width * 5.5 + .3) * height * .045]);
  }
  dune.push([width, height]);
  poly(ctx, p.sand[0], dune);
  for (let layer = 0; layer < 4; layer++) {
    const depth = layer / 3, outline = [[0, height]];
    for (let x = 0; x <= width + 3; x += 3) outline.push([x, desertGroundY(width, height, x, depth)]);
    outline.push([width, height]);
    poly(ctx, p.sand[layer], outline);
    if (layer < 3) {
      for (let x = 0; x < width; x += 3) {
        rect(ctx, mix(p.sand[layer], p.sand[Math.min(3, layer + 1)], .3), x,
          desertGroundY(width, height, x, depth) + 2, 2, 1);
      }
    }
  }
  for (let i = 0; i < Math.floor(width * height / 680); i++) {
    const x = rng() * width, y = height * (.73 + rng() * .26);
    const size = 1 + rng() * 3;
    rect(ctx, rng() < .68 ? p.sandShade : p.sand[3], x, y, size, 1);
    if (size > 3.2) {
      rect(ctx, p.pebble, x + 1, y, 2, 1);
      rect(ctx, p.sand[3], x + 1, y - 1);
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = width * (.29 + rng() * .44), y = height * (.75 + i * .019);
    const span = 8 + i * 1.4;
    line(ctx, p.sandShade, x - span, y + 1, x, y, 1);
    line(ctx, p.sand[3], x, y, x + span * .63, y + 2, 1);
  }
  boulder(ctx, width * .06, height * .94, height * .19, p.rock);
  boulder(ctx, width * .86, height * .94, height * .14, p.rock);
  boulder(ctx, width * .53, height * .825, height * .075, p.rock);
  boulder(ctx, width * .71, height * .86, height * .09, p.rock);
  saguaro(ctx, width * .25, height * .735, height * .1, p.green, p.flower, 3);
  saguaro(ctx, width * .88, height * .77, height * .11, p.green, p.flower, 1);
  pricklyPear(ctx, width * .68, height * .85, height * .073, p.green, p.flower);
  for (let i = 0; i < 12; i++) {
    const x = rng() * width, depth = .12 + rng() * .62;
    dryGrass(ctx, { x, y: desertGroundY(width, height, x, depth), height: 3 + rng() * 5,
      pal: p.grass, phase: rng() * 6 }, 0);
  }
  const moonTint = light === 'night' ? { o: p.rock[0], d: p.rock[1], m: p.rock[2], h: p.rock[4], w: p.rock[4] } : {};
  stamp(ctx, DESERT_DECOR.skull, width * .32, height * .975, moonTint);
  stamp(ctx, DESERT_DECOR.amphora, width * .735, height * .89, moonTint);
  stamp(ctx, DESERT_DECOR.agave, width * .185, height * .968,
    { o: p.green[0], d: p.green[1], m: p.green[2], h: p.green[3] });
  stamp(ctx, DESERT_DECOR.agave, width * .77, height * .995,
    { o: p.green[0], d: p.green[1], m: p.green[2], h: p.green[3] });
  stamp(ctx, DESERT_DECOR.flower, width * .56, height * .97,
    { o: p.grass[0], d: p.grass[1], m: p.grass[2], h: p.flower[3], p: p.flower[1], w: p.flower[2] });
}

export function paintDesertAtmosphere(ctx, width, height, time, seed, options = {}) {
  const light = options.desertLight || 'golden', p = palette(light);
  const rng = random(seed ^ 0x3d4a21b7);
  ctx.globalAlpha = 1;
  if (options.sunRays && light !== 'night') {
    ctx.globalAlpha = .025 + .009 * Math.sin(time * .2);
    poly(ctx, p.sun, [[width * .58, height * .52], [width * .73, height * .42],
      [width, height * .82], [width * .79, height * .89]]);
  }
  if (options.plankton) {
    for (let i = 0; i < Math.ceil(width / 11); i++) {
      const x = modulo(rng() * width + time * (1.4 + rng() * 2.2), width);
      const y = height * (.48 + rng() * .5) + Math.sin(time * .4 + i) * 2;
      ctx.globalAlpha = light === 'night' ? .12 : .18 + rng() * .12;
      rect(ctx, p.grass[2], x, y);
    }
  }
  if (options.bubbles) {
    for (let i = 0; i < 9; i++) {
      const x = modulo(rng() * (width + 50) + time * (12 + i * .8), width + 50) - 25;
      const y = height * (.64 + rng() * .3) + Math.sin(time * .4 + i * 1.7) * 2;
      ctx.globalAlpha = .065 + .035 * Math.sin(time * .31 + i);
      rect(ctx, p.grass[2], x, y, 5 + rng() * 14, 1);
      rect(ctx, p.grass[2], x + 4, y + 2, 3 + rng() * 7, 1);
    }
    // Two light, wiry tumbleweeds; the rotation is snapped by the pixel grid.
    for (let i = 0; i < 2; i++) {
      const radius = i ? 5 : 7;
      const x = modulo(time * (4 + i * 2) + width * (.19 + i * .51), width + 40) - 20;
      const y = desertGroundY(width, height, x, .52 + i * .34) - radius;
      const spin = time * .8 + i * 2.1;
      ctx.globalAlpha = light === 'night' ? .45 : .58;
      const tips = [];
      for (let j = 0; j < 10; j++) {
        const angle = spin + j / 10 * Math.PI * 2;
        tips.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * .86]);
      }
      for (let j = 0; j < tips.length; j++) {
        line(ctx, p.grass[0], ...tips[j], ...tips[(j + 1) % tips.length], 1);
        line(ctx, p.grass[1], ...tips[j], ...tips[(j + 4) % tips.length], 1);
      }
      rect(ctx, p.grass[2], x - 2, y - 2, 2, 1);
    }
  }
  if (light === 'night') {
    const stars = random(seed ^ 0x34ecc13);
    for (let i = 0; i < Math.ceil(width / 8); i++) {
      const x = stars() * width, y = stars() * height * .43;
      stars();
      ctx.globalAlpha = Math.round((.12 + .12 * Math.sin(time * .37 + i * 2.3)) * 12) / 12;
      rect(ctx, p.sun, x, y);
    }
    const flight = modulo(time + 19, 53);
    if (flight < 1.1) {
      const x = width * .17 + flight * width * .22, y = height * .09 + flight * height * .055;
      ctx.globalAlpha = .55 * (1 - flight / 1.1);
      line(ctx, p.sunShade, x - 9, y - 3, x, y, 1);
      rect(ctx, p.sun, x, y);
    }
  }
  ctx.globalAlpha = 1;
}
