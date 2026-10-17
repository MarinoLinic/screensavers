// BiomeRenderer — true Canvas2D pixel renderer for BIOME.EXE.
// The canvas holds exactly the logical pixel grid (viewport / pixelSize,
// ceiled), is CSS-upscaled by the integer pixelSize and centred so at most
// ~2px is cropped. Everything drawn stays on the integer grid: sprites are
// blitted unscaled or at exact 2x, atmosphere uses fillRect scanline bands,
// image smoothing stays off everywhere. No WebGL, fonts, images or CDN.
// 'land' habitats skip the water layers entirely and let the desert art
// module paint its own atmosphere.

import {
  createSpriteAtlas, paintBackdrop, createVegetation, paintVegetation,
} from './art.js';
import { paintDesertAtmosphere } from './desert-art.js';
import { paintBiomeAtmosphere, scenePalette } from './biome-art.js';
import { HABITATS } from './settings.js';
import { isWetland, waterline, waterBounds } from './terrain.js';

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

// Deterministic tiny hash for ambient particles (not the scene seed).
const hash01 = (i, salt) => {
  let a = (i * 2654435761 + salt * 40503) >>> 0;
  a = Math.imul(a ^ (a >>> 15), 2246822519);
  return ((a ^ (a >>> 13)) >>> 0) / 4294967296;
};
const mod = (n, m) => ((n % m) + m) % m;

// Sun/moon shaft strength + explicit tint per habitat — abyss gets a
// whisper of cyan, lagoon a pale moonlight wash.
const RAY_STRENGTH = { reef: 1, kelp: 0.85, lagoon: 0.55, abyss: 0.28 };
const RAY_TINT = { reef: '#d8f8d7', kelp: '#f2deaa', lagoon: '#c8cff4', abyss: '#99e8df' };
const FAR_PICK = { reef: 'wrasse', kelp: 'wrasse', lagoon: 'tang', abyss: 'lantern' };
const BUBBLE_LIFE = 2.6; // seconds a tap burst keeps rising
const DUST_TINT = '#d9b56a'; // ochre gust streaks on land
const SHADOW_DAY = '#6c4434', SHADOW_NIGHT = '#182338';

export class BiomeRenderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.ctx = canvas.getContext('2d');
    this.atlas = null;        // speciesId -> [3 frame canvases]
    this.metrics = null;      // speciesId -> {w, h}
    this.halfCache = new Map(); // speciesId -> tinted 0.5x silhouette canvas
    this.backdrop = null;     // offscreen canvas
    this.backdropKey = '';
    this.vegetation = null;   // createVegetation records
    this.vegetationKey = '';
    this.vegLayer = null;     // painted foreground layer, refreshed at 8Hz
    this.vegLayerKey = '';
    this.vegTick = -1;
    this.vegetationPaints = 0;
    this.renders = 0;
    this.logicalW = 1;
    this.logicalH = 1;
    this._ensureAtlas();
    this.resize();
  }

  _isLand() { return HABITATS[this.settings.habitat]?.kind !== 'water'; }

  /** Resource cache key: land look (desertLight) is part of it. */
  _resKey() {
    const s = this.settings;
    return `${s.habitat}|${s.seed}|${s.desertLight}|${this.logicalW}x${this.logicalH}`;
  }

  // ------------------------------------------------------------ resources

  _ensureAtlas() {
    if (this.atlas) return;
    this.atlas = createSpriteAtlas(makeCanvas);
    // Bake distant variants once, onto integer grids. Runtime blits remain 1:1.
    this.smallAtlas={};
    for(const [id,frames] of Object.entries(this.atlas)) this.smallAtlas[id]=frames.map(frame=>{
      const canvas=makeCanvas(Math.max(1,Math.round(frame.width*.65)),Math.max(1,Math.round(frame.height*.65)));
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      ctx.drawImage(frame,0,0,canvas.width,canvas.height);return canvas;
    });
    this.metrics = {};
    for (const [id, frames] of Object.entries(this.atlas)) {
      this.metrics[id] = { w: frames[0].width, h: frames[0].height };
    }
  }

  /** Fit the logical pixel grid to the CSS viewport; returns true if the
      logical resolution changed. */
  resize() {
    // Measure the stage, not the canvas — the canvas's own CSS size is set
    // by this method, so clientWidth would bootstrap to the wrong value.
    const host = this.canvas.parentElement;
    const cssW = Math.max(1, (host && host.clientWidth) || window.innerWidth);
    const cssH = Math.max(1, (host && host.clientHeight) || window.innerHeight);
    const px = this.settings.pixelSize;
    // ceil guarantees the grid covers the viewport — no exposed seam; the
    // overflow (at most px-1) is shared between both edges, so each side
    // crops <=2px for every allowed pixelSize.
    const w = Math.max(1, Math.ceil(cssW / px));
    const h = Math.max(1, Math.ceil(cssH / px));
    // physical display size is always an integer multiple of the grid,
    // centred with integer CSS offsets — no fractional transform
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w * px}px`;
    this.canvas.style.height = `${h * px}px`;
    this.canvas.style.left = `${Math.floor((cssW - w * px) / 2)}px`;
    this.canvas.style.top = `${Math.floor((cssH - h * px) / 2)}px`;
    this.ctx.imageSmoothingEnabled = false;
    const changed = w !== this.logicalW || h !== this.logicalH;
    this.logicalW = w;
    this.logicalH = h;
    if (changed) {
      this.backdropKey = '';
      this.vegetationKey = '';
    }
    return changed;
  }

  setSettings(settings) {
    const prev = this.settings;
    this.settings = settings;
    if (!prev) return;
    if (prev.pixelSize !== settings.pixelSize) {
      this.resize();
      return; // resize already invalidated caches
    }
    if (prev.habitat !== settings.habitat || prev.seed !== settings.seed
        || prev.desertLight !== settings.desertLight) {
      this.backdropKey = '';
      this.vegetationKey = '';
    }
  }

  _ensureBackdrop() {
    const s = this.settings;
    const key = this._resKey();
    if (key === this.backdropKey && this.backdrop) return;
    if (!this.backdrop || this.backdrop.width !== this.logicalW || this.backdrop.height !== this.logicalH) {
      this.backdrop = makeCanvas(this.logicalW, this.logicalH);
    }
    const bctx = this.backdrop.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    paintBackdrop(bctx, this.logicalW, this.logicalH, s.habitat, s.seed,
      { desertLight: s.desertLight });
    this.backdropKey = key;
  }

  _ensureVegetation() {
    const s = this.settings;
    const key = this._resKey();
    if (key === this.vegetationKey && this.vegetation) return;
    this.vegetation = createVegetation(this.logicalW, this.logicalH, s.habitat, s.seed,
      { desertLight: s.desertLight });
    this.vegetationKey = key;
  }

  /** Tinted 0.5x silhouette of frame 0 — used for the distant school. */
  _halfSprite(speciesId) {
    if (this.halfCache.has(speciesId)) return this.halfCache.get(speciesId);
    const frame = this.atlas[speciesId][0];
    const w = Math.max(1, Math.round(frame.width / 2));
    const h = Math.max(1, Math.round(frame.height / 2));
    const c = makeCanvas(w, h);
    const cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(frame, 0, 0, w, h);
    cctx.globalCompositeOperation = 'source-in';
    cctx.fillStyle = '#0d2f42';
    cctx.fillRect(0, 0, w, h);
    this.halfCache.set(speciesId, c);
    return c;
  }

  // --------------------------------------------------------------- layers

  /** Light shafts: integer scanline bands at two discrete alpha levels,
      tinted per habitat and fading out with depth. */
  _drawRays(ctx, t, w, h) {
    const strength = RAY_STRENGTH[this.settings.habitat] ?? 0.5;
    if (strength <= 0) return;
    ctx.fillStyle = RAY_TINT[this.settings.habitat] || '#d8f8d7';
    const count = 5;
    for (let i = 0; i < count; i++) {
      const drift = Math.sin(t * 0.045 + i * 1.7) * 0.05;
      const topX = (0.12 + i * 0.19 + drift) * w;
      const tilt = 0.22 + 0.08 * Math.sin(i * 2.3);
      const shaftW = (0.045 + 0.03 * hash01(i, 7)) * w;
      const fade = 0.62 + 0.2 * Math.sin(t * 0.11 + i * 2.9);
      const top = h * 0.02, bottom = h * 0.72;
      for (let y = Math.round(top); y < bottom; y += 2) {
        const k = (y - top) / (bottom - top);
        const depthFade = Math.pow(1 - k, 1.3); // light thins toward the floor
        const aEdge = Math.round(14 * strength * fade * depthFade) / 255;
        const aCore = Math.round(28 * strength * fade * depthFade) / 255;
        if (aCore <= 0) continue;
        const xc = topX + tilt * y;
        const half = (shaftW * (0.6 + 0.7 * k)) / 2;
        ctx.globalAlpha = aEdge;
        ctx.fillRect(Math.round(xc - half), y, Math.round(half * 2), 2);
        ctx.globalAlpha = aCore;
        ctx.fillRect(Math.round(xc - half * 0.55), y, Math.round(half * 1.1), 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Distant school: tiny dark silhouettes of a real sprite, high and slow. */
  _drawFarSchool(ctx, t, w, h) {
    const want = FAR_PICK[this.settings.habitat];
    const pick = (want && this.atlas[want]) ? want
      : Object.keys(this.atlas)[0];
    if (!pick) return;
    const img = this._halfSprite(pick);
    const n = 7;
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < n; i++) {
      const speed = 6 + hash01(i, 31) * 5;
      const dir = i % 3 === 0 ? -1 : 1;
      const span = w + 2 * img.width;
      const travel = mod(hash01(i, 47) * span + speed * t, span);
      const x = dir > 0 ? -img.width + travel : w + img.width - travel;
      const y = h * (0.16 + hash01(i, 13) * 0.3) + Math.sin(t * 0.6 + i * 1.9) * 2;
      const px = Math.round(x), py = Math.round(y);
      if (dir < 0) {
        ctx.save();
        ctx.translate(px + img.width, py);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, px, py);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Drifting motes: 1px dots on the integer grid. */
  _drawPlankton(ctx, t, w, h) {
    const n = Math.max(24, Math.round(w * h / 2600));
    for (let i = 0; i < n; i++) {
      const x = mod(hash01(i, 101) * w + t * (1.5 + hash01(i, 103) * 2), w);
      const y = mod(hash01(i, 107) * h + Math.sin(t * 0.12 + i) * 4 + t * 0.6, h);
      const a = 0.14 + 0.2 * hash01(i, 109) * (0.6 + 0.4 * Math.sin(t * 0.7 + i * 2.1));
      ctx.globalAlpha = Math.round(a * 12) / 12; // quantised, no shimmer soup
      ctx.fillStyle = '#cfe8e4';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** Ambient bubbles: small outlined rect clusters rising and wrapping. */
  _drawAmbientBubbles(ctx, t, w, h) {
    const n = Math.max(8, Math.round(w / 55));
    for (let i = 0; i < n; i++) {
      const rise = 7 + hash01(i, 211) * 9;
      const size = 1 + Math.floor(hash01(i, 213) * 3); // 1..3 px
      const span = h * 0.9;
      const y = h - 4 - mod(hash01(i, 217) * span + rise * t, span);
      const x = mod(hash01(i, 219) * w + Math.sin(t * 0.8 + i * 2.4) * 2, w);
      if (y > h * 0.82) continue; // keep bubbles in open water
      ctx.globalAlpha = 0.22 + 0.2 * hash01(i, 223);
      ctx.fillStyle = '#bfeee9';
      const px = Math.round(x), py = Math.round(y);
      if (size === 1) {
        ctx.fillRect(px, py, 1, 1);
      } else {
        ctx.fillRect(px, py, size, 1);
        ctx.fillRect(px, py + size - 1, size, 1);
        ctx.fillRect(px, py, 1, size);
        ctx.fillRect(px + size - 1, py, 1, size);
        ctx.fillRect(px, py, 1, 1); // specular dot
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Tap bursts: bright bubble clusters in water; on land the tap kicks
      up six little ochre dust streaks that scatter outward and fade. */
  _drawBursts(ctx, bursts, t) {
    if (!bursts || !bursts.length) return;
    if (this._isLand()) {
      const wet=isWetland(this.settings.habitat),surface=waterline(this.settings.habitat,this.logicalH);
      for (const b of bursts.filter(b=>!wet||b.y<surface)) {
        const age = t - b.t0;
        if (age < 0 || age > BUBBLE_LIFE) continue;
        for (let i = 0; i < 6; i++) {
          const off = (hash01(i, 307) - 0.5) * 16;
          const out = off * (1 + age * 1.4);
          const rise = age * (7 + hash01(i, 311) * 9);
          const wob = Math.sin(age * 6 + i * 2.1) * 1.5;
          const a = 0.5 * (1 - age / BUBBLE_LIFE);
          ctx.globalAlpha = Math.round(a * 8) / 8;
          ctx.fillStyle = this.settings.habitat==='desert'?DUST_TINT:scenePalette(this.settings.habitat).leaf[3];
          ctx.fillRect(Math.round(b.x + out + wob), Math.round(b.y - rise - i), 2, 1);
        }
      }
      ctx.globalAlpha = 1;
      if(!wet) return;
      bursts=bursts.filter(b=>b.y>=surface);
    }
    for (const b of bursts) {
      const age = t - b.t0;
      if (age < 0 || age > BUBBLE_LIFE) continue;
      for (let i = 0; i < 7; i++) {
        const off = hash01(i, 307) * 14 - 7;
        const rise = age * (12 + hash01(i, 311) * 16);
        const wob = Math.sin(age * 5 + i * 1.7) * 2;
        const size = 1 + ((i + Math.floor(age * 4)) % 3 === 0 ? 1 : 0);
        const a = 0.55 * (1 - age / BUBBLE_LIFE);
        ctx.globalAlpha = Math.round(a * 8) / 8;
        ctx.fillStyle = '#d8f6f2';
        const px = Math.round(b.x + off + wob);
        const py = Math.round(b.y - rise - i * 2);
        if(isWetland(this.settings.habitat)&&py<waterline(this.settings.habitat,this.logicalH)) continue;
        ctx.fillRect(px, py, size + 1, 1);
        ctx.fillRect(px, py + size, size + 1, 1);
        ctx.fillRect(px, py, 1, size + 1);
        ctx.fillRect(px + size, py, 1, size + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** One creature record -> blit. Water creatures centre on (x, y); land
      creatures anchor 'feet' — r.y is the ground contact, so the sprite's
      bottom edge (minus its 2px art margin) sits on the dune line, with a
      small 2px ground shadow thrown behind the feet first. */
  _drawCreature(ctx, r) {
    const distant=this.settings.habitat==='med-terraces'&&r.anchor!=='feet';
    const smallMarine=!this._isLand()&&this.logicalW<220&&r.kind!=='visitor';
    const smallWet=isWetland(this.settings.habitat)&&this.logicalW<220&&r.motion==='swim'&&r.kind!=='visitor';
    const frames = (distant||smallMarine||smallWet?this.smallAtlas:this.atlas)[r.species];
    if (!frames || !frames.length || r.alpha <= 0) return;
    const frame = frames[r.frame % frames.length];
    const dw = frame.width * r.scale;
    const dh = frame.height * r.scale;
    const dx = Math.round(r.x - dw / 2);
    const feet = r.anchor === 'feet';
    const dy = feet ? Math.round(r.y - dh + 2 * r.scale) : Math.round(r.y - dh / 2);
    if(isWetland(this.settings.habitat)&&['swim','bottom','surface'].includes(r.motion)) {
      // Reveal swimmers progressively from behind solid banks/headlands.
      // Cropped integer source rectangles avoid both popping and cliff overlap.
      const [lo,hi]=waterBounds(this.settings.habitat,this.logicalW);
      const left=Math.max(dx,Math.ceil(lo)),right=Math.min(dx+dw,Math.floor(hi));
      if(right<=left) return;
      const visibleW=right-left,srcW=visibleW/r.scale;
      const srcX=r.dir<0 ? frame.width-(right-dx)/r.scale : (left-dx)/r.scale;
      ctx.globalAlpha=r.alpha;
      if(r.dir<0) {
        ctx.save();ctx.translate(right,dy);ctx.scale(-1,1);
        ctx.drawImage(frame,srcX,0,srcW,frame.height,0,0,visibleW,dh);ctx.restore();
      } else ctx.drawImage(frame,srcX,0,srcW,frame.height,left,dy,visibleW,dh);
      ctx.globalAlpha=1;
      return;
    }
    if (feet) {
      const gy = Number.isFinite(r.groundY) ? r.groundY : r.y;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = this.settings.habitat==='desert'
        ? this.settings.desertLight === 'night' ? SHADOW_NIGHT : SHADOW_DAY
        : scenePalette(this.settings.habitat).earth[0];
      const len = Math.max(4, Math.round(0.55 * dw));
      ctx.fillRect(Math.round(r.x - len / 2), Math.round(gy) - 1, len, 2);
    }
    ctx.globalAlpha = r.alpha;
    if (r.dir < 0) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(frame, dx, dy, dw, dh);
    }
    ctx.globalAlpha = 1;
  }

  /** Retro scanlines: every other row darkened on the logical grid. */
  _drawScanlines(ctx, w, h) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#000';
    for (let y = 1; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
  }

  /**
   * Foreground vegetation, cached at 8Hz: the sway only repaints when the
   * 8Hz tick changes or the habitat/seed/dims key moved; every render just
   * blits the transparent offscreen layer.
   */
  _drawVegetation(ctx, t, w, h) {
    this._ensureVegetation();
    if (!this.vegetation.length) return;
    const key = this._resKey();
    const tick = Math.floor(t * 8);
    if (!this.vegLayer || this.vegLayer.width !== w || this.vegLayer.height !== h) {
      this.vegLayer = makeCanvas(w, h);
      this.vegLayerKey = '';
    }
    if (tick !== this.vegTick || key !== this.vegLayerKey) {
      const vctx = this.vegLayer.getContext('2d');
      vctx.imageSmoothingEnabled = false;
      vctx.clearRect(0, 0, w, h);
      paintVegetation(vctx, this.vegetation, t);
      this.vegTick = tick;
      this.vegLayerKey = key;
      this.vegetationPaints++;
    }
    ctx.drawImage(this.vegLayer, 0, 0);
  }

  // ---------------------------------------------------------------- frame

  render(world) {
    this._ensureAtlas();
    const s = this.settings;
    const w = this.logicalW, h = this.logicalH;
    const t = world.simTime;
    const ctx = this.ctx;
    ctx.globalAlpha = 1;

    this._ensureBackdrop();
    ctx.drawImage(this.backdrop, 0, 0);

    if (this._isLand()) {
      // desert air (sun glare, dust, gusts) is painted by the desert art
      // module — the water layers below stay strictly underwater
      if (s.habitat !== 'desert') paintBiomeAtmosphere(ctx,w,h,s.habitat,t,s.seed,s);
      else paintDesertAtmosphere(ctx, w, h, t, s.seed, {
        desertLight: s.desertLight,
        sunRays: s.sunRays,
        bubbles: s.bubbles,
        plankton: s.plankton,
      });
    } else {
      if (s.sunRays) this._drawRays(ctx, t, w, h);
      this._drawFarSchool(ctx, t, w, h);
      if (s.plankton) this._drawPlankton(ctx, t, w, h);
      if (s.bubbles) this._drawAmbientBubbles(ctx, t, w, h);
    }

    const records = world.sample().slice().sort((a, b) => a.depth - b.depth);
    for (const r of records) this._drawCreature(ctx, r);

    this._drawBursts(ctx, world.bursts, t);
    if (s.vegetation) this._drawVegetation(ctx, t, w, h);
    if (s.scanlines) this._drawScanlines(ctx, w, h);
    this.renders++;
  }

  /** Current frame upscaled to physical display pixels, nearest-neighbour. */
  snapshotCanvas() {
    const px = this.settings.pixelSize;
    const out = makeCanvas(this.logicalW * px, this.logicalH * px);
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(this.canvas, 0, 0, out.width, out.height);
    return out;
  }

  diagnostics() {
    return {
      renders: this.renders,
      w: this.logicalW,
      h: this.logicalH,
      pixelSize: this.settings.pixelSize,
      species: this.atlas ? Object.keys(this.atlas).length : 0,
      backdropCached: this.backdropKey !== '',
      vegetationCount: this.vegetation ? this.vegetation.length : 0,
      vegetationPaints: this.vegetationPaints,
    };
  }
}

// Backwards-compatible name: the aquarium renderer grew into a biome one.
export const AquariumRenderer = BiomeRenderer;
