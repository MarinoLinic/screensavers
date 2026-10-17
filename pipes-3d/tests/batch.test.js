import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { InstanceBatch, nextPow2 } from '../js/batch.js';
import { makeElbowGeometry } from '../js/geometry.js';

const mat = () => new THREE.MeshPhongMaterial({ color: 0xffffff });
const geo = () => new THREE.BoxGeometry(0.1, 0.1, 0.1);
const M = (x, y, z, s = 1) => new THREE.Matrix4()
  .compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(),
    new THREE.Vector3(s, s, s));

test('alloc/free: packed slots with O(1) swap-delete keeping handles valid', () => {
  const b = new InstanceBatch(geo(), mat(), { capacity: 16 });
  const a = b.alloc(); const c = b.alloc(); const d = b.alloc();
  b.setMatrix(a, M(1, 0, 0));
  b.setMatrix(c, M(2, 0, 0));
  b.setMatrix(d, M(3, 0, 0));
  assert.equal(b.count, 3);
  assert.equal(b.mesh.count, 3);

  // freeing a middle slot moves the tail handle into it — same data
  const dIndex = d.index;
  b.free(a);
  assert.equal(b.count, 2);
  assert.equal(d.index, 0, 'tail handle must be re-indexed after swap-delete');
  const m = new THREE.Matrix4();
  b.getMatrix(d, m);
  assert.equal(m.elements[12], 3, 'moved slot kept its matrix');

  // freeing the tail pops without a move
  b.free(d);
  assert.equal(b.count, 1);
  assert.equal(c.index, 0);
  b.free(c);
  assert.equal(b.count, 0);
  assert.equal(b.mesh.visible, false, 'empty batch draws nothing');

  // double-free is a no-op, not corruption
  b.free(c);
  assert.equal(b.count, 0);
});

test('capacity doubles to the next power of two and stops at the hard cap', () => {
  const b = new InstanceBatch(geo(), mat(), { capacity: 4, hardCap: 16 });
  assert.equal(b.capacity, 4);
  const handles = [];
  for (let i = 0; i < 16; i++) {
    const h = b.alloc();
    assert.ok(h, `alloc ${i} failed`);
    b.setMatrix(h, M(i, 0, 0));
    handles.push(h);
  }
  assert.equal(b.capacity, 16, 'capacity should have grown 4->16');
  assert.ok(b.grows >= 2);
  // hard cap reached: further allocs fail cleanly
  assert.equal(b.alloc(), null);
  // matrices survived the growth copies
  const m = new THREE.Matrix4();
  b.getMatrix(handles[9], m);
  assert.equal(m.elements[12], 9);
  assert.equal(b.count, 16);
});

test('instanceReveal attribute lives on elbow batches and tracks slots', () => {
  const b = new InstanceBatch(makeElbowGeometry(), mat(),
    { capacity: 4, reveal: true });
  assert.ok(b.geometry.getAttribute('instanceReveal'), 'reveal attr missing');
  const a = b.alloc(); const c = b.alloc();
  b.setReveal(a, 0.5);
  b.setReveal(c, 1);
  assert.equal(b.geometry.getAttribute('instanceReveal').array[a.index], 0.5);
  // free a -> c moves into slot 0 with its reveal
  b.free(a);
  assert.equal(b.geometry.getAttribute('instanceReveal').array[c.index], 1);
  // growth preserves reveal values
  const more = [c];
  for (let i = 0; i < 6; i++) {
    const h = b.alloc();
    b.setReveal(h, 0.25);
    more.push(h);
  }
  assert.ok(b.capacity >= 8);
  assert.equal(
    b.geometry.getAttribute('instanceReveal').array.length >= 8, true);
  assert.equal(b.geometry.getAttribute('instanceReveal').array[c.index], 1);
});

test('growth disposes geometry while it still owns the old reveal attr', () => {
  const b = new InstanceBatch(makeElbowGeometry(), mat(),
    { capacity: 4, reveal: true });
  const oldAttr = b.geometry.getAttribute('instanceReveal');
  let disposeCount = 0;
  let attrAtDispose = null;
  b.geometry.addEventListener('dispose', () => {
    disposeCount++;
    attrAtDispose = b.geometry.getAttribute('instanceReveal');
  });
  const h = b.alloc();
  b.setReveal(h, 0.75);
  for (let i = 0; i < 6; i++) assert.ok(b.alloc(), 'alloc failed'); // grows 4->8
  assert.ok(disposeCount >= 1, 'geometry never disposed during growth');
  assert.equal(attrAtDispose, oldAttr,
    'dispose must fire while the OLD reveal attr is still attached, so its '
    + 'GPU buffer is released rather than orphaned');
  const newAttr = b.geometry.getAttribute('instanceReveal');
  assert.notEqual(newAttr, oldAttr, 'reveal attr must be replaced on growth');
  assert.equal(newAttr.array[h.index], 0.75, 'reveal values preserved');
});

test('transfer migrates a handle between batches preserving matrix/color', () => {
  const src = new InstanceBatch(geo(), mat(), { capacity: 8 });
  const dst = new InstanceBatch(geo(),
    new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true }),
    { capacity: 8 });
  const h = src.alloc();
  src.setMatrix(h, M(4, 5, 6));
  src.setColor(h, { r: 0.25, g: 0.5, b: 0.75 });
  const moved = InstanceBatch.transfer(h, dst);
  assert.ok(moved, 'transfer failed');
  assert.equal(src.count, 0);
  assert.equal(dst.count, 1);
  const m = new THREE.Matrix4();
  dst.getMatrix(moved, m);
  assert.equal(m.elements[12], 4);
  assert.equal(m.elements[13], 5);
  const c = dst.mesh.instanceColor.array;
  assert.ok(Math.abs(c[moved.index * 3] - 0.25) < 1e-6);
  assert.ok(Math.abs(c[moved.index * 3 + 1] - 0.5) < 1e-6);
  assert.ok(Math.abs(c[moved.index * 3 + 2] - 0.75) < 1e-6);
});

test('instanceTint lives on every batch and survives swap-delete/transfer/growth', () => {
  const src = new InstanceBatch(geo(), mat(), { capacity: 4 });
  const dst = new InstanceBatch(geo(),
    new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true }),
    { capacity: 8 });
  assert.ok(src.geometry.getAttribute('instanceTint'), 'tint attr missing');
  const a = src.alloc(); const c = src.alloc();
  src.setTint(a, 3);
  src.setTint(c, 5);
  src.free(a); // swap-delete: tail (c) moves into slot 0 with its tint
  assert.equal(c.index, 0);
  assert.equal(src.tintAttr.array[c.index], 5);
  const mv = InstanceBatch.transfer(c, dst);
  assert.ok(mv);
  assert.equal(dst.tintAttr.array[mv.index], 5, 'transfer must carry tint');

  // growth preserves tint values and disposes while the OLD attr is attached
  const small = new InstanceBatch(geo(), mat(), { capacity: 4, hardCap: 16 });
  const oldTint = small.geometry.getAttribute('instanceTint');
  let atDispose = null;
  small.geometry.addEventListener('dispose', () => {
    atDispose = small.geometry.getAttribute('instanceTint');
  });
  const hs = [];
  for (let i = 0; i < 4; i++) {
    const h = small.alloc();
    small.setTint(h, i);
    hs.push(h);
  }
  for (let i = 0; i < 4; i++) hs.push(small.alloc()); // forces 4 -> 8
  assert.ok(small.capacity >= 8);
  assert.equal(atDispose, oldTint,
    'dispose must see the OLD tint attr so its GPU buffer is released');
  assert.notEqual(small.tintAttr, oldTint, 'tint attr replaced on growth');
  assert.equal(small.tintAttr.array[hs[2].index], 2, 'tint preserved');
});

test('update ranges stay narrow (no whole-buffer re-uploads)', () => {
  const b = new InstanceBatch(geo(), mat(), { capacity: 64 });
  const h = b.alloc();
  b.setMatrix(h, M(1, 2, 3));
  const ranges = b.mesh.instanceMatrix.updateRanges;
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, h.index * 16);
  assert.equal(ranges[0].count, 16);
});

test('nextPow2', () => {
  assert.equal(nextPow2(1), 1);
  assert.equal(nextPow2(255), 256);
  assert.equal(nextPow2(256), 256);
  assert.equal(nextPow2(257), 512);
});
