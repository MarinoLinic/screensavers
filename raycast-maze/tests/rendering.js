// Rendering tests: drive the real Renderer against a recording software
// Canvas2D so projection math, fog compositing and z-buffer stripe checks
// are asserted on actual pixels and on the recorded draw calls.
//   node tests/rendering.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let failures = 0;
const fail = msg => { failures += 1; console.log('FAIL  ' + msg); };
const ok = (cond, msg) => { if (!cond) fail(msg); };

// ---------- Software Canvas2D ----------
// Real pixel buffers for the ops the renderer uses (fillRect, clearRect,
// drawImage, ImageData). Path/text calls are recorded so motif structure
// can be asserted without rasterizing strokes.

const parseColor = style => {
  if (typeof style !== 'string') return null;
  let m = style.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
  }
  m = style.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map(s => parseFloat(s));
    return [p[0] || 0, p[1] || 0, p[2] || 0,
      p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  return null;
};

const matMul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const matApply = (m, x, y) => [
  m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const matInvert = m => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return [1, 0, 0, 1, 0, 0];
  return [
    m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
};

class SoftCanvas {
  constructor() {
    this.tagName = 'CANVAS';
    this.width = 0;
    this.height = 0;
    this.style = {};
    this._pixels = null;
    this._ctx = null;
  }
  getContext() {
    if (!this._ctx) this._ctx = new SoftCtx(this);
    return this._ctx;
  }
  pixels() {
    const need = this.width * this.height * 4;
    if (!this._pixels || this._pixels.length !== need) {
      this._pixels = new Uint8ClampedArray(need);
    }
    return this._pixels;
  }
}

const NOOP_OPS = ['beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke',
  'fill', 'arc', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo',
  'arcTo', 'rect', 'clip', 'fillText', 'strokeText', 'strokeRect'];

class SoftCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.ops = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.imageSmoothingEnabled = true;
    this.lineWidth = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'left';
    this._m = [1, 0, 0, 1, 0, 0];
    this._stack = [];
    for (const op of NOOP_OPS) {
      this[op] = (...args) => this.ops.push({ op, args });
    }
  }

  save() {
    this._stack.push({
      m: this._m.slice(), a: this.globalAlpha,
      c: this.globalCompositeOperation,
    });
    this.ops.push({ op: 'save' });
  }
  restore() {
    const s = this._stack.pop();
    if (s) {
      this._m = s.m;
      this.globalAlpha = s.a;
      this.globalCompositeOperation = s.c;
    }
    this.ops.push({ op: 'restore' });
  }
  translate(x, y) { this._m = matMul(this._m, [1, 0, 0, 1, x, y]); }
  rotate(r) {
    const c = Math.cos(r);
    const s = Math.sin(r);
    this._m = matMul(this._m, [c, s, -s, c, 0, 0]);
  }
  scale(x, y) { this._m = matMul(this._m, [x, 0, 0, y, 0, 0]); }
  setTransform(a, b, c, d, e, f) { this._m = [a, b, c, d, e, f]; }

  _blend(dst, src) {
    const se = (src[3] / 255) * this.globalAlpha;
    if (this.globalCompositeOperation === 'source-atop') {
      const da = dst[3] / 255;
      if (da <= 0 || se <= 0) return;
      for (let i = 0; i < 3; i += 1) {
        dst[i] = src[i] * se + dst[i] * (1 - se);
      }
      return;
    }
    if (se <= 0) return;
    const da = dst[3] / 255;
    const ao = se + da * (1 - se);
    if (ao <= 0) { dst[3] = 0; return; }
    for (let i = 0; i < 3; i += 1) {
      dst[i] = (src[i] * se + dst[i] * da * (1 - se)) / ao;
    }
    dst[3] = ao * 255;
  }

  _eachPixel(x, y, w, h, fn) {
    if (w <= 0 || h <= 0) return;
    const inv = matInvert(this._m);
    const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]
      .map(p => matApply(this._m, p[0], p[1]));
    const W = this.canvas.width;
    const H = this.canvas.height;
    const loX = Math.max(0, Math.floor(Math.min(...corners.map(p => p[0]))));
    const hiX = Math.min(W - 1, Math.ceil(Math.max(...corners.map(p => p[0]))));
    const loY = Math.max(0, Math.floor(Math.min(...corners.map(p => p[1]))));
    const hiY = Math.min(H - 1, Math.ceil(Math.max(...corners.map(p => p[1]))));
    const px = this.canvas.pixels();
    for (let py = loY; py <= hiY; py += 1) {
      for (let pxX = loX; pxX <= hiX; pxX += 1) {
        const local = matApply(inv, pxX + 0.5, py + 0.5);
        const u = (local[0] - x) / w;
        const v = (local[1] - y) / h;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        fn(px, (py * W + pxX) * 4, u, v);
      }
    }
  }

  fillRect(x, y, w, h) {
    this.ops.push({
      op: 'fillRect', x, y, w, h,
      style: this.fillStyle, comp: this.globalCompositeOperation,
    });
    const color = parseColor(this.fillStyle);
    if (!color) return; // gradients record but do not rasterize
    this._eachPixel(x, y, w, h, (px, i) => this._blend(
      px.subarray(i, i + 4), color));
  }

  clearRect(x, y, w, h) {
    this.ops.push({ op: 'clearRect', x, y, w, h });
    this._eachPixel(x, y, w, h, (px, i) => {
      px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0;
    });
  }

  drawImage(src) {
    const a = Array.prototype.slice.call(arguments, 1);
    let sx = 0;
    let sy = 0;
    let sw = src.width;
    let sh = src.height;
    let dx;
    let dy;
    let dw;
    let dh;
    if (a.length === 2) {
      [dx, dy] = a; dw = sw; dh = sh;
    } else if (a.length === 4) {
      [dx, dy, dw, dh] = a;
    } else if (a.length === 6) {
      [sx, sy, sw, sh, dx, dy] = a; dw = sw; dh = sh;
    } else if (a.length === 8) {
      [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    } else {
      return;
    }
    this.ops.push({
      op: 'drawImage', src, sx, sy, sw, sh, dx, dy, dw, dh,
    });
    if (!src || !src.pixels) return;
    const spx = src.pixels();
    const srcW = src.width;
    this._eachPixel(dx, dy, dw, dh, (px, i, u, v) => {
      const tx = Math.min(srcW - 1, Math.max(0, Math.floor(sx + u * sw)));
      const ty = Math.min(src.height - 1, Math.max(0, Math.floor(sy + v * sh)));
      const si = (ty * srcW + tx) * 4;
      this._blend(px.subarray(i, i + 4),
        [spx[si], spx[si + 1], spx[si + 2], spx[si + 3]]);
    });
  }

  createImageData(w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    const px = this.canvas.pixels();
    const W = this.canvas.width;
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        const sx = x + col;
        const sy = y + row;
        const di = (row * w + col) * 4;
        if (sx < 0 || sy < 0 || sx >= W || sy >= this.canvas.height) continue;
        const si = (sy * W + sx) * 4;
        out[di] = px[si];
        out[di + 1] = px[si + 1];
        out[di + 2] = px[si + 2];
        out[di + 3] = px[si + 3];
      }
    }
    return { data: out, width: w, height: h };
  }
  putImageData(image, x, y) {
    this.ops.push({ op: 'putImageData', x, y, w: image.width, h: image.height });
    const px = this.canvas.pixels();
    const W = this.canvas.width;
    for (let row = 0; row < image.height; row += 1) {
      for (let col = 0; col < image.width; col += 1) {
        const dx = x + col;
        const dy = y + row;
        if (dx < 0 || dy < 0 || dx >= W || dy >= this.canvas.height) continue;
        const si = (row * image.width + col) * 4;
        const di = (dy * W + dx) * 4;
        px[di] = image.data[si];
        px[di + 1] = image.data[si + 1];
        px[di + 2] = image.data[si + 2];
        px[di + 3] = image.data[si + 3];
      }
    }
  }
  createRadialGradient() {
    return { addColorStop() {}, __gradient: true };
  }
  createLinearGradient() {
    return { addColorStop() {}, __gradient: true };
  }
}

// ---------- Harness ----------

const makeEnv = (vw, vh, extraLoads = []) => {
  const created = [];
  const document = {
    createElement: tag => {
      if (String(tag).toLowerCase() !== 'canvas') {
        return { tagName: String(tag).toUpperCase(), style: {} };
      }
      const c = new SoftCanvas();
      created.push(c);
      return c;
    },
  };
  const window = { innerWidth: vw, innerHeight: vh };
  const sandbox = { window, document, console };
  sandbox.window.Maze3D = sandbox.Maze3D = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const load = rel => vm.runInContext(
    fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  load('js/config.js');
  load('js/renderer.js');
  extraLoads.forEach(load);
  return {
    sandbox, document, window, created,
    M: sandbox.Maze3D,
    newRenderer: (textures, opts) => new sandbox.Maze3D.Renderer(
      document.createElement('canvas'), textures || {}, sandbox.Maze3D.CONFIG,
      opts),
  };
};

const solid = (w, h, color) => {
  const c = new SoftCanvas();
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
};

const px = (ctx, x, y) => ctx.getImageData(x, y, 1, 1).data;

// 9x9 room: open interior with a solid border wall.
const ROOM = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
];
const THEME = {
  wall: 'brick', floor: 'stone', ceiling: 'plaster',
  fogColor: [4, 8, 6], fogDistance: 17, particles: 'dust', moveScale: 1,
};
const LEVEL = { name: 'test', map: ROOM, theme: THEME };
const PLAYER = { x: 4.5, y: 4.5, angle: 0, bob: 0 };

const makeTextures = () => ({
  walls: { brick: solid(64, 64, '#91452f'), moss: solid(64, 64, '#66713d'), tech: solid(64, 64, '#405856') },
  floors: { stone: solid(64, 64, 'rgb(200, 0, 0)') },
  ceilings: { plaster: solid(64, 64, 'rgb(0, 0, 200)') },
  relics: {},
  creatures: {},
  exit: solid(48, 72, '#4cff7c'),
  inversion: solid(40, 40, '#2fd8e8'),
});

// ---------- Aspect-preserving resize + horizontal-FOV focal ----------

for (const [vw, vh] of [
  [1280, 720], [390, 844], [960, 540], [2000, 1200], [300, 500],
  [4000, 200], [200, 2000], [50, 50],
]) {
  const env = makeEnv(vw, vh);
  const r = env.newRenderer();
  const focal = r.width / (2 * Math.tan(env.M.CONFIG.fov / 2));
  ok(Math.abs(r.focalLength - focal) < 1e-9,
    `${vw}x${vh}: focalLength ${r.focalLength} !== ${focal}`);
  const aspectErr = Math.abs(r.width - r.height * vw / vh);
  ok(aspectErr <= 1,
    `${vw}x${vh}: buffer ${r.width}x${r.height} breaks viewport aspect`);
}
console.log('resize: shared scale keeps viewport aspect, focal is horizontal');

// ---------- One focal length for walls, floor and sprites ----------

{
  const env = makeEnv(1280, 720);
  const textures = makeTextures();
  const r = env.newRenderer(textures);
  const planeLen = Math.tan(env.M.CONFIG.fov / 2);
  const horizon = Math.round(r.height / 2);

  // Wall: centre column ray travels due east and meets the x=8 wall plane
  // 3.5 units out; its slice must be focal/perpDist tall, not height-based.
  r.render({
    map: ROOM, level: LEVEL, player: PLAYER,
    sprites: [], elapsed: 0, inversion: 0, showMap: false,
  });
  const wallSlices = r.sceneCtx.ops.filter(o =>
    o.op === 'drawImage' && o.src === textures.walls.brick);
  ok(wallSlices.length > 0, 'no wall texture slices recorded');
  const centre = wallSlices.find(o => Math.abs(o.dx - r.width / 2) <= 1);
  ok(centre, 'no wall slice at screen centre');
  if (centre) {
    const expected = r.focalLength / 3.5;
    ok(Math.abs(centre.dh - expected) < 1.5,
      `wall lineH ${centre.dh}, expected focal/3.5 ${expected}`);
    ok(Math.abs(centre.dh - r.height / 3.5) > 2,
      'wall height still derives from buffer height');
  }

  // Floor: the solid red floor texture is fog-mixed by row distance, so a
  // pixel's colour encodes posZ. Only the focal value matches.
  {
    const fctx = env.document.createElement('canvas');
    const r2 = new env.M.Renderer(fctx, textures, env.M.CONFIG);
    r2.renderFloorCeiling(PLAYER, horizon, THEME, 1, 0, 0, planeLen);
    const row = Math.min(r2.height - 1, horizon + 180);
    const p = row - horizon;
    const i = (row * r2.width + Math.floor(r2.width / 2)) * 4;
    const rr = r2.frame.data[i];
    const focalRow = 0.5 * r2.focalLength / p;
    const heightRow = 0.5 * r2.height / p;
    const focalR = 200 * (1 - Math.min(1, focalRow / 17)) +
      4 * Math.min(1, focalRow / 17);
    const heightR = 200 * (1 - Math.min(1, heightRow / 17)) +
      4 * Math.min(1, heightRow / 17);
    ok(Math.abs(rr - focalR) <= 3,
      `floor row fog ${rr}, focal posZ expects ${focalR.toFixed(1)}`);
    ok(Math.abs(rr - heightR) > 4,
      `floor row fog ${rr} still matches height posZ ${heightR.toFixed(1)}`);
  }

  // Sprite: square world sprite must project to equal pixel dimensions
  // scaled by focal/transformY.
  const img = solid(8, 8, 'rgb(0, 220, 0)');
  const noFog = { ...LEVEL, theme: { ...THEME, fogDistance: 1e9 } };
  r.render({
    map: ROOM, level: noFog, player: PLAYER,
    sprites: [{ x: 7.5, y: 4.5, width: 0.5, height: 0.5, vertical: 0,
      kind: 'creature', image: img }],
    elapsed: 0, inversion: 0, showMap: false,
  });
  const spriteOps = r.sceneCtx.ops.filter(o =>
    o.op === 'drawImage' && o.src === img);
  ok(spriteOps.length > 0, 'sprite was not drawn');
  if (spriteOps.length) {
    const spanX = Math.max(...spriteOps.map(o => o.dx + o.dw)) -
      Math.min(...spriteOps.map(o => o.dx));
    const spriteH = spriteOps[0].dh;
    const expected = r.focalLength / 3 * 0.5;
    ok(Math.abs(spriteH - expected) < 1.5,
      `sprite height ${spriteH}, expected focal*0.5/3 ${expected}`);
    ok(Math.abs(spanX - spriteH) <= 2,
      `square sprite spans ${spanX}x${spriteH}`);
  }
  console.log('projection: wall/floor/sprite all ride the same focal length');
}

// ---------- Sprite fog: tinted silhouette, never a rectangle ----------

{
  const env = makeEnv(1280, 720);
  const textures = makeTextures();
  const r = env.newRenderer(textures);
  const horizon = Math.round(r.height / 2);

  // 3x3 sprite: only the centre texel is opaque red.
  const img = new SoftCanvas();
  img.width = 3;
  img.height = 3;
  const ictx = img.getContext('2d');
  ictx.fillStyle = 'rgb(200, 0, 0)';
  ictx.fillRect(1, 1, 1, 1);

  const sprite = {
    x: 7.5, y: 4.5, width: 0.05, height: 0.05, vertical: -0.25,
    kind: 'creature', image: img,
  };

  r.render({
    map: ROOM, level: LEVEL, player: PLAYER, sprites: [],
    elapsed: 0, inversion: 0, showMap: false,
  });
  const bg = {
    corner: px(r.sceneCtx, 348, 245).slice(),
    centre: px(r.sceneCtx, 352, 248).slice(),
  };

  r.renderSprites([sprite], PLAYER, horizon, THEME, 1, 0, 0,
    Math.tan(env.M.CONFIG.fov / 2));

  // The fog scratch must have composited source-atop over the sprite.
  const fogOps = r.fogCtx.ops;
  ok(fogOps.some(o => o.op === 'drawImage' && o.src === img),
    'fog scratch never received the sprite');
  ok(fogOps.some(o => o.op === 'fillRect' && o.comp === 'source-atop'),
    'fog scratch did not tint with source-atop');
  ok(fogOps.every(o => o.op !== 'fillRect' ||
    o.comp === 'source-atop' || o.comp === 'source-over'),
    'unexpected composite op on fog scratch');
  const fogDraw = r.sceneCtx.ops.filter(o =>
    o.op === 'drawImage' && o.src === r.fogCanvas);
  ok(fogDraw.length > 0, 'tinted fog sprite never reached the scene');

  // No rectangular fog fillRect over the sprite box on the scene itself.
  const boxFill = r.sceneCtx.ops.filter(o => o.op === 'fillRect' &&
    o.x >= 340 && o.x <= 360 && o.w <= 2 && o.h >= 8 && o.h <= 12);
  ok(boxFill.length === 0,
    'scene received a rectangular fog fillRect over the sprite');

  // Corner texels are transparent: the background shows through exactly.
  const cornerAfter = px(r.sceneCtx, 348, 245);
  ok(Math.abs(cornerAfter[0] - bg.corner[0]) <= 1 &&
     Math.abs(cornerAfter[1] - bg.corner[1]) <= 1 &&
     Math.abs(cornerAfter[2] - bg.corner[2]) <= 1,
    `transparent corner was boxed in: ${[...cornerAfter]}`);

  // Centre texel: red fogged toward the fog colour, not raw red and not bg.
  const fog = Math.min(0.8, 3 / 17);
  const a = fog * 0.7;
  const expR = 200 * (1 - a) + 4 * a;
  const centreAfter = px(r.sceneCtx, 352, 248);
  ok(Math.abs(centreAfter[0] - expR) <= 4,
    `fogged centre ${centreAfter[0]}, expected ~${expR.toFixed(1)}`);
  ok(Math.abs(centreAfter[0] - bg.centre[0]) > 2 ||
     Math.abs(centreAfter[1] - bg.centre[1]) > 2 ||
     Math.abs(centreAfter[2] - bg.centre[2]) > 2,
    'centre pixel unchanged: sprite invisible');
  console.log('fog: silhouette preserved, centre tinted, no fog rectangles');
}

// ---------- Z-buffer is tested per pixel inside each stripe ----------

{
  const env = makeEnv(1280, 720);
  const r = env.newRenderer(makeTextures());
  const horizon = Math.round(r.height / 2);
  const img = solid(4, 4, 'rgb(0, 220, 0)');
  const sprite = {
    x: 7.5, y: 4.5, width: 0.1, height: 0.1, vertical: 0,
    kind: 'creature', image: img,
  };
  const renderAt = () => {
    r.sceneCtx.clearRect(0, 0, r.width, r.height);
    r.renderSprites([sprite], PLAYER, horizon, THEME, 1, 0, 0,
      Math.tan(env.M.CONFIG.fov / 2));
  };

  // transformY = 3; zbuffer 100 lets the sprite through, 1 blocks it.
  r.zbuffer = new Float32Array(r.width).fill(100);
  r.zbuffer[353] = 1; // second pixel of stripe [352,353] is behind a wall
  renderAt();
  ok(px(r.sceneCtx, 352, 198)[1] > 100, 'visible stripe pixel missing');
  ok(px(r.sceneCtx, 353, 198)[1] === 0,
    'occluded half-stripe leaked through the wall');
  ok(px(r.sceneCtx, 354, 198)[1] > 100, 'next stripe wrongly blocked');

  r.zbuffer.fill(100);
  r.zbuffer[352] = 1; // first pixel blocked, second must still draw
  renderAt();
  ok(px(r.sceneCtx, 352, 198)[1] === 0,
    'blocked pixel drawn over the wall');
  ok(px(r.sceneCtx, 353, 198)[1] > 100,
    'visible second pixel dropped with its neighbour');
  console.log('zbuffer: half-occluded stripes draw only the visible pixels');
}

// ---------- Floor anchoring uses the sprite's visible foot edge ----------

{
  const env = makeEnv(1280, 720);
  const r = env.newRenderer(makeTextures());
  const horizon = Math.round(r.height / 2);
  const noFogTheme = { ...THEME, fogDistance: 1e9 };

  // 8x8 sprite whose opaque band is rows 2..5: foot fraction must be 6/8.
  const img = new SoftCanvas();
  img.width = 8;
  img.height = 8;
  const ictx = img.getContext('2d');
  ictx.fillStyle = 'rgb(0, 220, 0)';
  ictx.fillRect(0, 2, 8, 4);

  ok(Math.abs(r.spriteFootFraction(img) - 6 / 8) < 1e-9,
    `foot fraction ${r.spriteFootFraction(img)} !== 0.75`);

  // Cached: a second read must not re-scan the image.
  let reads = 0;
  const grab = r.texturePixels.bind(r);
  r.texturePixels = t => { reads += 1; return grab(t); };
  r.spriteFootFraction(img);
  r.spriteFootFraction(img);
  r.texturePixels = grab;
  ok(reads === 0, `foot cache re-read the image ${reads} times`);

  // Fully transparent image anchors on its nominal bottom edge.
  const ghost = new SoftCanvas();
  ghost.width = 8;
  ghost.height = 8;
  ok(r.spriteFootFraction(ghost) === 1,
    'transparent image did not fall back to fraction 1');

  // The bottommost drawn pixel of a floor-anchored sprite sits on the floor
  // plane at its distance: horizon + 0.5 * focal/transformY.
  const sprite = {
    x: 7.5, y: 4.5, width: 0.5, height: 0.5, vertical: 0,
    floorAnchored: true, kind: 'creature', image: img,
  };
  r.zbuffer = new Float32Array(r.width).fill(1e9);
  r.sceneCtx.clearRect(0, 0, r.width, r.height);
  r.renderSprites([sprite], PLAYER, horizon, noFogTheme, 1, 0, 0,
    Math.tan(env.M.CONFIG.fov / 2));
  const column = Math.floor(r.width / 2);
  let bottom = -1;
  for (let y = r.height - 1; y >= 0; y -= 1) {
    if (px(r.sceneCtx, column, y)[3] > 0) { bottom = y; break; }
  }
  const floorRow = horizon + 0.5 * r.focalLength / 3;
  ok(bottom >= 0 && Math.abs(bottom + 0.5 - floorRow) <= 1,
    `visible foot row ${bottom}, floor plane expects ${floorRow.toFixed(1)}`);

  // A flying sprite keeps its hover anchor: the same image at vertical .2
  // must NOT land its foot on the floor plane.
  const flyer = { ...sprite, vertical: 0.2, floorAnchored: false };
  r.sceneCtx.clearRect(0, 0, r.width, r.height);
  r.renderSprites([flyer], PLAYER, horizon, noFogTheme, 1, 0, 0,
    Math.tan(env.M.CONFIG.fov / 2));
  let flyBottom = -1;
  for (let y = r.height - 1; y >= 0; y -= 1) {
    if (px(r.sceneCtx, column, y)[3] > 0) { flyBottom = y; break; }
  }
  const flyExpected = (horizon - 0.2 * (r.focalLength / 3)) +
    (6 / 8 - 0.5) * (r.focalLength / 3 * 0.5);
  ok(flyBottom >= 0 && Math.abs(flyBottom + 0.5 - flyExpected) <= 1.5,
    `flying foot row ${flyBottom}, hover anchor expects ${flyExpected.toFixed(1)}`);
  ok(Math.abs(flyBottom - bottom) > 5,
    'flying sprite ignored its hover anchor');
  console.log('foot anchor: visible edge on the floor, flyers hover');
}

// ---------- Wall variants: brick keeps its face, others keep motifs ----------

{
  const env = makeEnv(1280, 720, [
    'js/textures/core.js', 'js/textures/retro-pack.js',
    'js/textures/fantasy-pack.js', 'js/textures/civilizations-pack.js',
    'js/textures/aesthetic-pack.js', 'js/textures/level-variants.js',
  ]);
  const M = env.M;
  const textures = M.installLevelTextureVariants(
    M.expandAestheticTextures(
      M.expandCivilizationTextures(
        M.expandTextures(
          M.enrichTextures(M.createTextures())))));
  const base = textures.walls.brick;
  const before = base.getContext('2d').getImageData(0, 0, 64, 64).data.slice();

  const variant = textures.getWallVariant('brick');
  ok(variant !== base, 'brick variant returned the source itself');
  ok(textures.getWallVariant('brick') === variant,
    'variant cache did not return the same canvas');
  ok(textures.getVariantCount() === 1, 'variant cache is not lazy');

  const after = base.getContext('2d').getImageData(0, 0, 64, 64).data;
  let sourceDiffs = 0;
  for (let i = 0; i < before.length; i += 1) {
    if (before[i] !== after[i]) sourceDiffs += 1;
  }
  ok(sourceDiffs === 0, 'variant generation mutated the base brick texture');

  // Sparse wear: some pixels change, but no row becomes a drawn-over band.
  const vdata = variant.getContext('2d').getImageData(0, 0, 64, 64).data;
  let total = 0;
  let maxRow = 0;
  for (let y = 0; y < 64; y += 1) {
    let rowDiffs = 0;
    for (let x = 0; x < 64; x += 1) {
      const i = (y * 64 + x) * 4;
      if (vdata[i] !== after[i] || vdata[i + 1] !== after[i + 1] ||
          vdata[i + 2] !== after[i + 2]) {
        rowDiffs += 1;
      }
    }
    total += rowDiffs;
    if (rowDiffs > maxRow) maxRow = rowDiffs;
  }
  ok(total > 0, 'brick variant adds no wear at all');
  ok(total < 400, `brick variant overwrote ${total} pixels, not subtle`);
  ok(maxRow < 32,
    `row with ${maxRow} changed pixels looks like a horizontal band`);

  // Call record: no global source-atop recolor and no 64-wide band rect.
  const vops = variant.getContext('2d').ops;
  ok(!vops.some(o => o.op === 'fillRect' && o.comp === 'source-atop'),
    'brick variant still gets the global recolor pass');
  ok(!vops.some(o => o.op === 'fillRect' && o.w === 64 && o.h >= 4),
    'brick variant still draws a full-width band');

  // Other themes keep their recolor + motif pipeline (glyph uses strokes).
  const sand = textures.getWallVariant('sandstone');
  const sandOps = sand.getContext('2d').ops;
  ok(sandOps.some(o => o.op === 'fillRect' && o.comp === 'source-atop'),
    'other themes lost the tint pass');
  ok(sandOps.some(o => o.op === 'stroke'),
    'other themes lost their motif');
  console.log('variants: brick wears subtly, motifs intact elsewhere');
}

// ---------- Low-res / full-res quality toggle ----------

{
  // lowRes=false renders the buffer at full density: at 1280x720 the old
  // 0.55-scaled buffer would be 704x396, full-res is exactly 1280x720.
  const env = makeEnv(1280, 720);
  const lo = env.newRenderer(makeTextures()); // legacy default
  const hi = env.newRenderer(makeTextures(), { lowRes: false });
  ok(lo.width === 704 && lo.height === 396,
    `lowRes buffer ${lo.width}x${lo.height}, expected 704x396`);
  ok(hi.width === 1280 && hi.height === 720,
    `full-res buffer ${hi.width}x${hi.height}, expected 1280x720`);
  ok(hi.floorStepX === 1 && hi.floorStepY === 1 &&
    hi.rayStep === 1 && hi.spriteStep === 1,
    'full-res must sample every pixel (all steps 1)');
  ok(lo.floorStepX === 2 && lo.floorStepY === 2 &&
    lo.rayStep === 2 && lo.spriteStep === 2,
    'lowRes keeps the classic 2px sampling steps');
  ok(hi.ctx.imageSmoothingEnabled === true && lo.ctx.imageSmoothingEnabled === false,
    'smoothing flag must follow the mode');
  // Same focal model either way: aspect + focal length track the buffer.
  ok(Math.abs(hi.width / hi.height - 1280 / 720) < 0.01,
    'full-res buffer drifted off viewport aspect');
}

// setLowRes swaps density in place; toggling back restores the old buffer.
{
  const env = makeEnv(1280, 720);
  const r = env.newRenderer(makeTextures());
  ok(r.width === 704 && r.height === 396);
  r.setLowRes(false);
  ok(r.width === 1280 && r.height === 720,
    `after setLowRes(false): ${r.width}x${r.height}`);
  ok(r.rayStep === 1 && r.floorStepY === 1);
  r.setLowRes(true);
  ok(r.width === 704 && r.height === 396,
    'setLowRes(true) did not restore the classic buffer');
  ok(r.rayStep === 2 && r.floorStepY === 2 && r.spriteStep === 2);
}

// Full-res floor pass covers every row exactly once (hasSecondRow off) and
// every written pixel is opaque; low-res shares row pairs. Both must fill
// the frame with alpha=255 — including odd heights and portrait crops.
for (const [vw, vh, lowRes] of [
  [1280, 721, false], [1280, 721, true],   // odd height
  [801, 601, false],                      // odd both
  [300, 500, false],                      // portrait
  [4000, 200, false],                     // severely wide
  [200, 2000, false],                     // severely narrow
]) {
  const env = makeEnv(vw, vh);
  const r = env.newRenderer(makeTextures(), { lowRes });
  r.renderFloorCeiling(PLAYER, Math.round(r.height / 2), THEME, 1, 0, 0,
    Math.tan(env.M.CONFIG.fov / 2));
  let bad = 0;
  for (let i = 3; i < r.frame.data.length; i += 4) {
    if (r.frame.data[i] !== 255) bad += 1;
  }
  ok(bad === 0,
    `${vw}x${vh} lowRes=${lowRes}: ${bad} floor pixels not written opaque`);
  const aspectErr = Math.abs(r.width - r.height * vw / vh);
  ok(aspectErr <= 1,
    `${vw}x${vh} lowRes=${lowRes}: aspect drifted to ${r.width}x${r.height}`);
}

// Walls/sprites honor the per-mode ray + sprite steps.
{
  const env = makeEnv(1280, 720);
  const textures = makeTextures();
  const r = env.newRenderer(textures, { lowRes: false });
  r.render({
    map: ROOM, level: LEVEL, player: PLAYER,
    sprites: [], elapsed: 0, inversion: 0, showMap: false,
  });
  // rayStep 1: every column gets its own wall slice, no 2px spans
  const wallSlices = r.sceneCtx.ops.filter(o =>
    o.op === 'drawImage' && o.dw <= 2 && o.src && o.src.width === 64);
  ok(wallSlices.length > 0, 'full-res drew no wall slices');
  ok(wallSlices.every(o => o.dw === 1),
    'full-res wall columns must be single-pixel wide');
  const cols = new Set(wallSlices.map(o => Math.round(o.dx)));
  ok(cols.size === r.width,
    `full-res wall columns ${cols.size} !== ${r.width}`);
  console.log('quality toggle: buffer, steps, smoothing and coverage switch together');
}

console.log(failures === 0 ? 'RENDERING ALL VALID' : `${failures} RENDERING FAILURES`);
process.exit(failures === 0 ? 0 : 1);
