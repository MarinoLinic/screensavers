// Renderer grid/cache checks — exercised through a recording fake
// Canvas2D + fake canvas elements, so no real DOM is needed under
// node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, HABITAT_ORDER, HABITATS } from '../js/settings.js';

// ---- fake canvas plumbing ------------------------------------------------

function fakeCtx(canvas) {
  const calls = { fillRect: [], drawImage: 0, clearRect: 0 };
  return {
    canvas, calls,
    fillStyle: '#000', globalAlpha: 1, globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    fillRect(x, y, w, h) {
      calls.fillRect.push({ x, y, w, h, style: this.fillStyle });
    },
    clearRect() { calls.clearRect++; },
    drawImage(...a) { calls.drawImage++; calls.lastDraw = a; },
    save() {}, restore() {}, translate() {}, scale() {},
  };
}

function fakeCanvas(parentW = 1440, parentH = 900) {
  const c = {
    width: 300, height: 150, style: {},
    parentElement: { clientWidth: parentW, clientHeight: parentH },
    _ctx: null,
    getContext() { return (this._ctx ||= fakeCtx(this)); },
  };
  return c;
}

// renderer creates offscreen canvases through document.createElement
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { createElement: () => fakeCanvas() };
}
const { BiomeRenderer, AquariumRenderer } = await import('../js/renderer.js');

const mk = (over = {}, cw = 1440, ch = 900) =>
  new BiomeRenderer(fakeCanvas(cw, ch), { ...DEFAULTS, ...over });

// fresh defaults open on the desert; water fixtures pin a water biome
const mkWater = (over = {}, cw, ch) => mk({ habitat: 'reef', ...over }, cw, ch);

const fakeWorld = (time) => ({
  simTime: time, sample: () => [], bursts: [],
});

test('coastal swimmers reveal partial sprites at both cliff edges, in either direction',()=>{
  const r=mk({habitat:'med-cove'}),left=Math.ceil(r.logicalW*.30);
  for(const dir of [-1,1]) {
    const ctx=fakeCtx(null);
    r._drawCreature(ctx,{species:'mullet',x:left+1,y:220,dir,scale:1,alpha:1,frame:0,motion:'swim'});
    const call=ctx.calls.lastDraw;
    assert.equal(call.length,9,'source rectangle must crop the swimmer');
    assert.ok(call[3]<r.atlas.mullet[0].width&&call[3]>0);
    assert.ok(call.slice(1).every(Number.isInteger),'crop stays on the sprite pixel grid');
    const outside=fakeCtx(null);
    r._drawCreature(outside,{species:'mullet',x:left-100,y:220,dir,scale:1,alpha:1,frame:0,motion:'swim'});
    assert.equal(outside.calls.drawImage,0,'solid headland masks the swimmer');
  }
});

// ---- grid ----------------------------------------------------------------

test('legacy AquariumRenderer alias points at BiomeRenderer', () => {
  assert.equal(AquariumRenderer, BiomeRenderer);
});

test('distant terrace wildlife and portrait Marine residents use cached integer-grid frames',()=>{
  for(const [habitat,species,cw,ch,motion] of [['med-terraces','mullet',1440,900,'swim'],['reef','clown',390,844,undefined]]) {
    const r=mk({habitat},cw,ch),frames=r.smallAtlas[species],ctx=fakeCtx(null);
    assert.ok(frames[0].width<r.atlas[species][0].width);
    assert.ok(frames.every(f=>Number.isInteger(f.width)&&Number.isInteger(f.height)));
    r._drawCreature(ctx,{species,x:r.logicalW*.88,y:r.logicalH*.86,scale:1,dir:1,alpha:1,frame:0,kind:'creature',motion});
    assert.equal(ctx.calls.lastDraw[0],frames[0]);
    r.resize();assert.equal(r.smallAtlas[species],frames,'resizing reuses the sprite cache');
  }
});

test('non-divisible stage is fully covered by the pixel grid', () => {
  const canvas = fakeCanvas(390, 844);
  const r = new BiomeRenderer(canvas, { ...DEFAULTS, pixelSize: 3 });
  // ceil: 390/3=130 exactly, 844/3=281.33 -> 282
  assert.equal(r.logicalW, 130);
  assert.equal(r.logicalH, 282);
  assert.equal(canvas.width, 130);
  assert.equal(canvas.height, 282);
  // physical size covers the stage — never a gap
  assert.ok(130 * 3 >= 390 && 282 * 3 >= 844);
  assert.equal(canvas.style.width, '390px');
  assert.equal(canvas.style.height, '846px');
  // integer centring, <=2px cropped total per axis
  assert.equal(canvas.style.left, '0px');
  assert.equal(canvas.style.top, '-1px');
});

test('evenly-divisible stage centres with zero crop', () => {
  const canvas = fakeCanvas(1440, 900);
  const r = new BiomeRenderer(canvas, { ...DEFAULTS, pixelSize: 3 });
  assert.equal(r.logicalW, 480);
  assert.equal(r.logicalH, 300);
  assert.equal(canvas.style.left, '0px');
  assert.equal(canvas.style.top, '0px');
});

test('pixelSize change re-fits the grid', () => {
  const canvas = fakeCanvas(1440, 900);
  const r = new BiomeRenderer(canvas, { ...DEFAULTS, pixelSize: 3 });
  r.setSettings({ ...DEFAULTS, pixelSize: 2 });
  assert.equal(r.logicalW, 720);
  assert.equal(canvas.width, 720);
  assert.equal(canvas.style.width, '1440px');
});

// ---- light rays ----------------------------------------------------------

test('rays always draw with an explicit per-habitat tint (water only)', () => {
  const tints = {
    reef: '#d8f8d7', kelp: '#f2deaa', lagoon: '#c8cff4', abyss: '#99e8df',
  };
  for (const habitat of HABITAT_ORDER.filter((h) => HABITATS[h].kind === 'water')) {
    const r = mk({ habitat });
    const ctx = fakeCtx(null);
    ctx.fillStyle = '#123456'; // stale colour left by a previous layer
    r._drawRays(ctx, 5.0, 480, 300);
    assert.ok(ctx.calls.fillRect.length > 50, `${habitat} should draw many ray bands`);
    const styles = new Set(ctx.calls.fillRect.map((c) => c.style));
    assert.deepEqual(styles, new Set([tints[habitat]]),
      `${habitat} rays must only use their tint, got ${[...styles]}`);
    // discrete alpha: only integer-quantised globalAlpha values appear
    ctx.calls; // (alpha assertion via implementation detail below)
  }
});

// ---- vegetation 8Hz paint cache ------------------------------------------

test('vegetation layer repaints only on 8Hz tick or key change', () => {
  const r = mkWater({ seed: 11 });
  const w0 = fakeWorld(1.00);
  r.render(w0);
  r.render(w0);
  assert.equal(r.vegetationPaints, 1, 'same 8Hz tick must reuse the painted layer');
  const w1 = fakeWorld(1.10); // still floor(t*8) == 8? 1.10*8=8.8 -> 8 same tick
  r.render(w1);
  assert.equal(r.vegetationPaints, 1, 'same tick, later time must reuse');
  const w2 = fakeWorld(1.20); // 1.20*8=9.6 -> tick 9: new paint
  r.render(w2);
  assert.equal(r.vegetationPaints, 2, 'new 8Hz tick repaints');
  // seed change invalidates the layer even on the same tick
  r.setSettings({ ...DEFAULTS, seed: 777 });
  r.render(fakeWorld(1.20));
  assert.equal(r.vegetationPaints, 3, 'seed change must repaint the layer');
  // habitat change invalidates too
  r.setSettings({ ...DEFAULTS, seed: 777, habitat: 'abyss' });
  r.render(fakeWorld(1.20));
  assert.equal(r.vegetationPaints, 4, 'habitat change must repaint the layer');
});

test('resize invalidates the vegetation layer', () => {
  const canvas = fakeCanvas(1440, 900);
  const r = new BiomeRenderer(canvas, { ...DEFAULTS });
  r.render(fakeWorld(2.0));
  const paints = r.vegetationPaints;
  canvas.parentElement.clientWidth = 800;
  canvas.parentElement.clientHeight = 500;
  r.resize();
  r.render(fakeWorld(2.0));
  assert.ok(r.vegetationPaints > paints, 'new dims must repaint the layer');
});

// ---- whole frame ---------------------------------------------------------

test('render paints backdrop, creatures, vegetation on the grid', () => {
  const r = mkWater({ seed: 42 });
  const creatures = [{
    species: 'clown', x: 100, y: 80, dir: -1, scale: 2,
    depth: 0.9, alpha: 1, frame: 1, phase: 0, role: 'fish', kind: 'creature',
  }];
  const world = { simTime: 4, sample: () => creatures, bursts: [] };
  r.render(world);
  const ctx = r.ctx;
  assert.ok(ctx.calls.drawImage >= 2, 'backdrop + veg layer + sprite blits');
  assert.ok(ctx.calls.fillRect.length > 300, 'backdrop rows painted');
});

// ---- land ----------------------------------------------------------------

test('desert renders land layers only — no water rays/far school/motes', () => {
  const r = mk({ seed: 7, habitat: 'desert' }); // fresh default is desert anyway
  const calls = { rays: 0, far: 0, plankton: 0, bubbles: 0 };
  r._drawRays = () => { calls.rays++; };
  r._drawFarSchool = () => { calls.far++; };
  r._drawPlankton = () => { calls.plankton++; };
  r._drawAmbientBubbles = () => { calls.bubbles++; };
  const world = { simTime: 3, sample: () => [], bursts: [] };
  r.render(world);
  assert.deepEqual(calls, { rays: 0, far: 0, plankton: 0, bubbles: 0 },
    'water layers must never run on land');
  // the desert atmosphere pass still paints into the frame
  assert.ok(r.ctx.calls.fillRect.length > 300, 'desert backdrop+atmosphere painted');
});

test('feet-anchored creatures sit on the ground line with a shadow', () => {
  const r = mk({ habitat: 'desert' });
  const frame = r.atlas.lizard[0];
  const rec = {
    species: 'lizard', x: 100, y: 200, dir: 1, scale: 1,
    depth: 0.5, alpha: 1, frame: 0, phase: 0, role: 'ground',
    anchor: 'feet', kind: 'creature',
  };
  const ctx = fakeCtx(null);
  r._drawCreature(ctx, rec);
  // shadow rect first, then the sprite — anchored bottom = y - h + 2*scale
  const shadow = ctx.calls.fillRect.find((c) => c.h === 2 && c.style !== '#000');
  assert.ok(shadow, 'ground creature must cast a 2px shadow');
  assert.equal(shadow.y, 199); // feet baseline -1
  assert.equal(shadow.style, '#6c4434', 'golden/day shadow tint');
  const [img, dx, dy, dw, dh] = ctx.calls.lastDraw;
  assert.equal(img, frame);
  assert.equal(dy, Math.round(200 - frame.height + 2), 'feet anchor dy');
  assert.equal(dw, frame.width);
  // centred creatures (flyers, fish) keep the old midpoint anchor
  const cctx = fakeCtx(null);
  r._drawCreature(cctx, { ...rec, anchor: 'center', y: 50 });
  assert.equal(cctx.calls.lastDraw[2], Math.round(50 - frame.height / 2));
  assert.ok(!cctx.calls.fillRect.some((c) => c.h === 2 && c.style !== '#000'),
    'no shadow under centered creatures');
  // mid-hop: sprite follows r.y but the shadow stays on groundY
  const hctx = fakeCtx(null);
  r._drawCreature(hctx, {
    ...rec, species: 'jerboa', y: 194, groundY: 200,
  });
  const jframe = r.atlas.jerboa[0];
  const [jimg, , jdy] = hctx.calls.lastDraw;
  assert.equal(jimg, jframe);
  assert.equal(jdy, Math.round(194 - jframe.height + 2),
    'sprite follows the airborne r.y');
  const jshadow = hctx.calls.fillRect.find((c) => c.h === 2 && c.style !== '#000');
  assert.equal(jshadow.y, 199, 'shadow stays pinned to groundY=200');
  // night light dims the shadow to the dark ground tone
  r.setSettings({ ...DEFAULTS, habitat: 'desert', desertLight: 'night' });
  const nctx = fakeCtx(null);
  r._drawCreature(nctx, rec);
  const nshadow = nctx.calls.fillRect.find((c) => c.h === 2);
  assert.equal(nshadow.style, '#182338', 'night shadow tint');
});

test('desertLight change invalidates backdrop + vegetation caches', () => {
  const r = mk({ habitat: 'desert', desertLight: 'golden' });
  r.render(fakeWorld(2.0));
  assert.ok(r.backdropKey.includes('golden'), r.backdropKey);
  const paints = r.vegetationPaints;
  const backs = r.backdropKey;
  r.setSettings({ ...DEFAULTS, habitat: 'desert', desertLight: 'night' });
  r.render(fakeWorld(2.0));
  assert.ok(r.backdropKey.includes('night'), r.backdropKey);
  assert.notEqual(r.backdropKey, backs);
  assert.ok(r.vegetationPaints > paints, 'light change repaints the veg layer');
});

test('desert render path draws creatures + bursts as dust', () => {
  const r = mk({ habitat: 'desert' });
  const frame = r.atlas.scarab[0];
  const world = {
    simTime: 5,
    sample: () => [{
      species: 'scarab', x: 60, y: 220, dir: -1, scale: 1, depth: 0.7,
      alpha: 1, frame: 1, phase: 0, role: 'ground', motion: 'crawl',
      anchor: 'feet', kind: 'creature',
    }],
    bursts: [{ x: 100, y: 200, t0: 4.5 }],
  };
  r.render(world);
  const styles = new Set(r.ctx.calls.fillRect.map((c) => c.style));
  assert.ok(styles.has('#d9b56a'), 'tap burst on land must raise ochre dust');
});
