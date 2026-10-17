import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deformFlowerBox } from '../js/flowerbox.js';

/**
 * Build a subdivided unit-cube surface the way BoxGeometry does: each face
 * gets its own vertex grid, so edge/corner points appear twice (seam
 * duplicates). Returns a Float32Array of [x,y,z] triples in [-1,1].
 */
function cubeSurface(n = 20) {
  const faces = [
    (u, v) => [1, v, u], (u, v) => [-1, v, -u],
    (u, v) => [u, 1, -v], (u, v) => [u, -1, v],
    (u, v) => [u, v, 1], (u, v) => [-u, v, -1],
  ];
  const vertsPerFace = (n + 1) * (n + 1);
  const base = new Float32Array(faces.length * vertsPerFace * 3);
  let o = 0;
  for (const f of faces) {
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const [x, y, z] = f(-1 + (2 * j) / n, -1 + (2 * i) / n);
        base[o++] = x; base[o++] = y; base[o++] = z;
      }
    }
  }
  return base;
}

const key3 = (a, i) => `${a[i]},${a[i + 1]},${a[i + 2]}`;

test('deform is deterministic at the same time, in place, no allocation', () => {
  const base = cubeSurface();
  const a = new Float32Array(base.length);
  const b = new Float32Array(base.length);
  const ret = deformFlowerBox(base, a, 3.7);
  deformFlowerBox(base, b, 3.7);
  assert.equal(ret, a, 'returns the output buffer');
  assert.deepEqual([...a], [...b], 'same time must give same morph');
});

test('different times modify the surface', () => {
  const base = cubeSurface();
  const a = new Float32Array(base.length);
  const b = new Float32Array(base.length);
  deformFlowerBox(base, a, 1.0);
  deformFlowerBox(base, b, 1.6);
  assert.notDeepEqual([...a], [...b]);
});

test('the base buffer is never modified', () => {
  const base = cubeSurface();
  const pristine = new Float32Array(base);
  const out = new Float32Array(base.length);
  for (const t of [0, 0.4, 2.2, 9.9]) deformFlowerBox(base, out, t);
  assert.deepEqual([...base], [...pristine]);
});

test('max abs coordinate stays within 1.4 across a range of times', () => {
  const base = cubeSurface(24);
  const out = new Float32Array(base.length);
  for (let t = 0; t < 60; t += 0.37) {
    deformFlowerBox(base, out, t);
    for (const v of out) {
      assert.ok(Number.isFinite(v));
      assert.ok(Math.abs(v) <= 1.4, `|${v}| at t=${t}`);
    }
  }
});

test('duplicated seam vertices stay exactly coincident', () => {
  const base = cubeSurface(8);
  const out = new Float32Array(base.length);
  for (const t of [0.9, 4.2]) {
    deformFlowerBox(base, out, t);
    // group vertex indices by identical base coordinate (the seam duplicates)
    const byBase = new Map();
    for (let i = 0; i < base.length; i += 3) {
      const k = key3(base, i);
      if (!byBase.has(k)) byBase.set(k, []);
      byBase.get(k).push(i);
    }
    let dupes = 0;
    for (const idx of byBase.values()) {
      if (idx.length < 2) continue;
      dupes++;
      for (let m = 1; m < idx.length; m++) {
        for (let k = 0; k < 3; k++) {
          // ===, not Object.is: a seam point may carry -0 in one face's grid
          assert.ok(out[idx[m] + k] === out[idx[0] + k],
            `seam split at t=${t}, vertex ${idx[0] / 3}`);
        }
      }
    }
    assert.ok(dupes > 10, 'test grid should contain real seam duplicates');
  }
});
