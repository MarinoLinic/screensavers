// Art asset contract checks — exercised through a recording fake Canvas2D,
// so no real canvas implementation is needed under node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPRITES, DECOR } from '../js/sprites.js';
import { DESERT_SPRITES, DESERT_DECOR } from '../js/desert-sprites.js';
import { DESERT_SPECIES } from '../js/desert-art.js';
import { BIOME_SPRITES } from '../js/biome-sprites.js';
import {
  SPECIES, ALL_SPRITES, createSpriteAtlas, paintBackdrop,
  createVegetation, paintVegetation,
} from '../js/art.js';
import { HABITAT_ORDER, DESERT_LIGHT_ORDER } from '../js/settings.js';

function fakeCtx(canvas) {
  const calls = { fillRect: 0, styles: new Set() };
  return {
    canvas, calls,
    fillStyle: '#000', globalAlpha: 1, imageSmoothingEnabled: false,
    globalCompositeOperation: 'source-over',
    fillRect(x, y, w, h) {
      calls.fillRect++;
      calls.styles.add(this.fillStyle);
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h),
        'non-finite fillRect');
      assert.ok(w > 0 && h > 0, 'degenerate fillRect');
    },
    drawImage() {}, save() {}, restore() {}, translate() {}, scale() {},
  };
}

const makeFakeCanvas = (w, h) => {
  const c = { width: w, height: h, _ctx: null };
  c.getContext = () => (c._ctx ||= fakeCtx(c));
  return c;
};

test('aquatic, desert and new biome sheets match their species metadata', () => {
  const aqua = ['clown', 'tang', 'butterfly', 'wrasse', 'angel', 'lion',
    'jelly', 'lantern', 'turtle', 'ray', 'seahorse', 'crab'];
  const desert = ['lizard', 'jerboa', 'tortoise', 'scorpion', 'scarab',
    'wheatear', 'fennec', 'camel'];
  assert.deepEqual(Object.keys(SPRITES).sort(), [...aqua].sort());
  assert.deepEqual(Object.keys(DESERT_SPRITES).sort(), [...desert].sort());
  assert.deepEqual(new Set(Object.keys(ALL_SPRITES)),
    new Set([...aqua, ...desert,...Object.keys(BIOME_SPRITES)]), 'ALL_SPRITES merges all sheets');
  assert.deepEqual(new Set(Object.keys(SPECIES)), new Set(Object.keys(ALL_SPRITES)),
    'SPECIES keys must match ALL_SPRITES keys exactly');
  assert.equal(Object.keys(DESERT_SPECIES).length, 8);
});

test('SPECIES records carry the documented contract fields', () => {
  const habs = new Set(HABITAT_ORDER);
  for (const [id, rec] of Object.entries(SPECIES)) {
    assert.ok(typeof rec.label === 'string' && rec.label, `${id} label`);
    assert.ok(Array.isArray(rec.habitats) && rec.habitats.length > 0, `${id} habitats`);
    for (const h of rec.habitats) assert.ok(habs.has(h), `${id} bad habitat ${h}`);
    assert.ok(['fish', 'visitor', 'bottom', 'ground', 'flyer','swimmer'].includes(rec.role),
      `${id} role ${rec.role}`);
    assert.ok(Number.isFinite(rec.speed) && rec.speed > 0 && rec.speed <= 40, `${id} speed`);
  }
});

function checkSheet(id, sprite, frames) {
  assert.ok(sprite && typeof sprite === 'object', `${id} record`);
  const palette = sprite.palette;
  assert.ok(palette && typeof palette === 'object', `${id} palette`);
  const rowSets = frames ? sprite.frames : [sprite.rows];
  for (const [f, rows] of rowSets.entries()) {
    assert.ok(Array.isArray(rows) && rows.length > 0, `${id} frame ${f} rows`);
    for (const [y, row] of rows.entries()) {
      assert.ok(typeof row === 'string' && row.length > 0, `${id} frame ${f} row ${y} empty`);
      for (const ch of row) {
        assert.ok(ch === '.' || palette[ch], `${id} frame ${f} row ${y} unknown ink "${ch}"`);
      }
    }
  }
  for (const [k, v] of Object.entries(palette)) {
    assert.match(v, /^#[0-9a-f]{6}$/i, `${id} palette ${k}=${v}`);
  }
}

test('every non-dot sprite char is a valid palette entry; rows non-empty', () => {
  for (const [id, sprite] of Object.entries(SPRITES)) checkSheet(id, sprite, false);
  for (const [id, sprite] of Object.entries(BIOME_SPRITES)) checkSheet(id, sprite, Boolean(sprite.frames));
});

test('desert sprites honour the same palette contract, explicit frames', () => {
  for (const [id, sprite] of Object.entries(DESERT_SPRITES)) {
    checkSheet(id, sprite, Boolean(sprite.frames));
    if (sprite.frames) {
      assert.equal(sprite.frames.length, 3, `${id} must pose 3 frames`);
    }
  }
  // DESERT_DECOR is not creature art — separate palette contract
  for (const [id, piece] of Object.entries(DESERT_DECOR)) {
    checkSheet(`decor:${id}`, piece, false);
  }
});

test('DECOR pieces follow the same palette contract', () => {
  const ids = Object.keys(DECOR);
  assert.ok(ids.length >= 4, 'expected clam/brain/star/polyp decor');
  assert.deepEqual(ids.sort(), ['brain', 'clam', 'polyp', 'star']);
  for (const [id, piece] of Object.entries(DECOR)) {
    assert.ok(Array.isArray(piece.rows) && piece.rows.length > 0, `${id} rows`);
    const palette = piece.palette;
    assert.ok(palette && typeof palette === 'object', `${id} palette`);
    for (const [y, row] of piece.rows.entries()) {
      assert.ok(typeof row === 'string' && row.length > 0, `${id} row ${y} empty`);
      for (const ch of row) {
        assert.ok(ch === '.' || palette[ch], `${id} row ${y} unknown ink "${ch}"`);
      }
    }
    for (const [k, v] of Object.entries(palette)) {
      assert.match(v, /^#[0-9a-f]{6}$/i, `${id} palette ${k}=${v}`);
    }
  }
});

test('createSpriteAtlas returns exactly 3 integer-pixel frames per species', () => {
  const atlas = createSpriteAtlas(makeFakeCanvas);
  assert.deepEqual(new Set(Object.keys(atlas)), new Set(Object.keys(ALL_SPRITES)));
  for (const [id, frames] of Object.entries(atlas)) {
    assert.equal(frames.length, 3, `${id} must have 3 frames`);
    // every frame shares one canvas size — required for uniform blits
    assert.ok(frames.every((f) => f.width === frames[0].width && f.height === frames[0].height),
      `${id} frames must share dimensions`);
    for (const f of frames) {
      assert.ok(Number.isInteger(f.width) && Number.isInteger(f.height), `${id} integer dims`);
      assert.ok(f.width > 4 && f.height > 4 && f.width < 120 && f.height < 120, `${id} size ${f.width}x${f.height}`);
      assert.ok(f._ctx.calls.fillRect > 20, `${id} should paint real pixels`);
    }
    assert.ok(frames[0]._ctx.calls.fillRect > 0);
  }
});

test('paintBackdrop fills an opaque scene for every habitat and seed', () => {
  for (const habitat of HABITAT_ORDER) {
    for (const light of habitat === 'desert' ? DESERT_LIGHT_ORDER : [undefined]) {
      const c = makeFakeCanvas(160, 100);
      const ctx = c.getContext('2d');
      paintBackdrop(ctx, 160, 100, habitat, 1995,
        light ? { desertLight: light } : {});
      assert.ok(ctx.calls.fillRect >= 100, `${habitat}/${light} backdrop too sparse (${ctx.calls.fillRect})`);
      assert.ok(ctx.calls.styles.size > 5, `${habitat}/${light} should use many colours`);
    }
  }
  // the three desert lights must differ
  const sig = (light) => {
    const c = makeFakeCanvas(120, 80);
    const ctx = c.getContext('2d');
    const seen = [];
    const orig = ctx.fillRect.bind(ctx);
    ctx.fillRect = (x, y, w, h) => { seen.push(ctx.fillStyle); orig(x, y, w, h); };
    paintBackdrop(ctx, 120, 80, 'desert', 1995, { desertLight: light });
    return seen.join('|');
  };
  assert.notEqual(sig('golden'), sig('day'));
  assert.notEqual(sig('golden'), sig('night'));
});

test('createVegetation + paintVegetation produce drawable plant records', () => {
  for (const habitat of HABITAT_ORDER) {
    const opts = habitat === 'desert' ? { desertLight: 'golden' } : {};
    const veg = createVegetation(160, 100, habitat, 1995, opts);
    assert.ok(Array.isArray(veg), `${habitat} vegetation must be a list`);
    const c = makeFakeCanvas(160, 100);
    const ctx = c.getContext('2d');
    paintVegetation(ctx, veg, 1.25);
    // sway must not throw at other times and should draw something
    paintVegetation(ctx, veg, 9.9);
    if (veg.length) {
      assert.ok(ctx.calls.fillRect > 0, `${habitat} vegetation should paint`);
    }
  }
  // desert records are biome-tagged so paintVegetation dispatches correctly
  const desertVeg = createVegetation(160, 100, 'desert', 1995, { desertLight: 'day' });
  if (desertVeg.length) assert.equal(desertVeg[0].biome, 'desert');
});

test('backdrop is deterministic for a given seed and differs across seeds', () => {
  const coords = (seed) => {
    const c = makeFakeCanvas(120, 80);
    const ctx = c.getContext('2d');
    const seen = [];
    const orig = ctx.fillRect.bind(ctx);
    ctx.fillRect = (x, y, w, h) => { seen.push(`${x},${y},${w},${h},${ctx.fillStyle}`); orig(x, y, w, h); };
    paintBackdrop(ctx, 120, 80, 'reef', seed);
    return seen.join('|');
  };
  assert.equal(coords(7), coords(7));
  assert.notEqual(coords(7), coords(8));
});
