// Dense shared instance batch: one InstancedMesh per (kind, opacity class),
// packed slot allocation with O(1) swap-delete, per-instance color, a
// per-instance `instanceTint` float (palette slot for shader-side palette
// crossfade) and an optional `instanceReveal` float (elbow bend preview).
//
// Handles are compact {batch, index} records; swap-delete rewrites the moved
// handle's index in place so callers never re-sync. Capacity grows by powers
// of two up to a lattice-derived hard cap — growth replaces the mesh and the
// custom instance attributes (buffer arrays cannot be resized in place).

import * as THREE from '../vendor/three.module.min.js';

const nextPow2 = (n) => {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
};

export class InstanceBatch {
  /**
   * @param {THREE.BufferGeometry} geometry  owned by this batch
   * @param {THREE.Material} material        shared with sibling batches
   * @param {object} opts  {capacity, hardCap, reveal, name}
   */
  constructor(geometry, material, opts = {}) {
    this.geometry = geometry;
    this.material = material;
    this.name = opts.name || 'batch';
    this.hardCap = Math.max(1, opts.hardCap || 256);
    this.capacity = Math.min(this.hardCap, nextPow2(opts.capacity || 256));
    this.reveal = !!opts.reveal;
    this.slots = [];   // slots[i] = handle occupying instance slot i
    this.count = 0;
    this.grows = 0;    // diagnostic: capacity growth events
    this._makeTintAttr(this.capacity);
    if (this.reveal) this._makeRevealAttr(this.capacity);
    this.mesh = this._makeMesh();
  }

  _makeTintAttr(cap) {
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceTint', attr);
    this.tintAttr = attr;
  }

  _makeRevealAttr(cap) {
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceReveal', attr);
    this.revealAttr = attr;
  }

  _makeMesh() {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    mesh.count = 0;
    mesh.visible = false; // empty batches cost no draw call
    mesh.frustumCulled = false; // instances span a bounded cube
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    color.setUsage(THREE.DynamicDrawUsage);
    color.array.fill(1);
    mesh.instanceColor = color;
    return mesh;
  }

  /** Grow capacity to at least `min` (powers of two, capped by hardCap). */
  _grow(min) {
    const cap = Math.min(this.hardCap, Math.max(this.capacity * 2, nextPow2(min)));
    if (cap <= this.capacity) return false;
    // geometry.dispose() releases the GPU buffers of its CURRENT attributes
    // (the renderer re-uploads the base buffers next frame) — it must run
    // while the old instanceTint/instanceReveal attributes are still attached
    // or their GPU buffers would be orphaned on every growth.
    const oldTint = this.tintAttr;
    const oldReveal = this.revealAttr || null;
    this.geometry.dispose();
    this._makeTintAttr(cap);
    this.tintAttr.array.set(oldTint.array.subarray(0, this.count));
    this.tintAttr.needsUpdate = true;
    if (this.reveal) {
      this._makeRevealAttr(cap);
      this.revealAttr.array.set(oldReveal.array.subarray(0, this.count));
      this.revealAttr.needsUpdate = true;
    }
    const old = this.mesh;
    this.capacity = cap; // _makeMesh sizes its buffers from this.capacity
    const mesh = this._makeMesh();
    mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.count * 16));
    mesh.instanceColor.array.set(old.instanceColor.array.subarray(0, this.count * 3));
    mesh.count = this.count;
    mesh.visible = this.count > 0;
    const parent = old.parent;
    if (parent) { parent.remove(old); parent.add(mesh); }
    old.dispose(); // instance buffers only; geometry is retained
    this.mesh = mesh;
    this.grows++;
    return true;
  }

  /** Allocate a slot; returns a handle or null when the hard cap is reached. */
  alloc() {
    if (this.count >= this.capacity && !this._grow(this.count + 1)) return null;
    const handle = { batch: this, index: this.count };
    this.slots.push(handle);
    this.count++;
    this.mesh.count = this.count;
    this.mesh.visible = true;
    return handle;
  }

  /** O(1) swap-delete: the last live slot moves into the freed index. */
  free(handle) {
    const i = handle.index;
    if (i < 0 || i >= this.count || this.slots[i] !== handle) return;
    const last = this.count - 1;
    if (i !== last) {
      this._copySlot(last, i);
      const moved = this.slots[last];
      moved.index = i;
      this.slots[i] = moved;
    }
    this.slots.pop();
    this.count--;
    this.mesh.count = this.count;
    if (this.count === 0) this.mesh.visible = false;
    handle.index = -1;
  }

  _copySlot(src, dst) {
    this.mesh.instanceMatrix.array.copyWithin(dst * 16, src * 16, src * 16 + 16);
    this.mesh.instanceMatrix.addUpdateRange(dst * 16, 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.array.copyWithin(dst * 3, src * 3, src * 3 + 3);
    this.mesh.instanceColor.addUpdateRange(dst * 3, 3);
    this.mesh.instanceColor.needsUpdate = true;
    this.tintAttr.array[dst] = this.tintAttr.array[src];
    this.tintAttr.addUpdateRange(dst, 1);
    this.tintAttr.needsUpdate = true;
    if (this.revealAttr) {
      this.revealAttr.array[dst] = this.revealAttr.array[src];
      this.revealAttr.addUpdateRange(dst, 1);
      this.revealAttr.needsUpdate = true;
    }
  }

  setMatrix(handle, m) {
    this.mesh.instanceMatrix.array.set(m.elements, handle.index * 16);
    this.mesh.instanceMatrix.addUpdateRange(handle.index * 16, 16);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  getMatrix(handle, out) {
    out.fromArray(this.mesh.instanceMatrix.array, handle.index * 16);
    return out;
  }

  setColor(handle, color) {
    const a = this.mesh.instanceColor.array;
    a[handle.index * 3] = color.r;
    a[handle.index * 3 + 1] = color.g;
    a[handle.index * 3 + 2] = color.b;
    this.mesh.instanceColor.addUpdateRange(handle.index * 3, 3);
    this.mesh.instanceColor.needsUpdate = true;
  }

  setTint(handle, v) {
    this.tintAttr.array[handle.index] = v;
    this.tintAttr.addUpdateRange(handle.index, 1);
    this.tintAttr.needsUpdate = true;
  }

  setReveal(handle, v) {
    this.revealAttr.array[handle.index] = v;
    this.revealAttr.addUpdateRange(handle.index, 1);
    this.revealAttr.needsUpdate = true;
  }

  /** Move a handle into `other` batch, preserving matrix/color/tint/reveal. */
  static transfer(handle, other) {
    const from = handle.batch;
    const next = other.alloc();
    if (!next) return null;
    const m = new THREE.Matrix4();
    from.getMatrix(handle, m);
    other.setMatrix(next, m);
    const i = handle.index;
    const c = from.mesh.instanceColor.array;
    other.setColor(next, { r: c[i * 3], g: c[i * 3 + 1], b: c[i * 3 + 2] });
    other.setTint(next, from.tintAttr.array[i]);
    if (from.revealAttr && other.revealAttr) {
      other.setReveal(next, from.revealAttr.array[i]);
    }
    from.free(handle);
    return next;
  }

  clear() {
    for (const h of this.slots) h.index = -1;
    this.slots.length = 0;
    this.count = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  dispose() {
    this.clear();
    this.mesh.dispose();
    this.geometry.dispose();
  }
}

export { nextPow2 };
