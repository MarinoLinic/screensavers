import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { OrbitCamera } from '../js/orbit.js';

function fakeEl() {
  const listeners = {};
  return {
    listeners,
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    setPointerCapture() {},
    fire(t, e) { (listeners[t] || []).forEach((f) => f(e)); },
  };
}

const makeOrbit = () => {
  const el = fakeEl();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  return { el, orbit: new OrbitCamera(cam, el, { distance: 40 }) };
};

test('right-drag produces a positive yaw delta (drag right = orbit right)', () => {
  const { el, orbit } = makeOrbit();
  const yaw0 = orbit.yaw;
  el.fire('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  el.fire('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
  assert.ok(orbit.yaw > yaw0, `dx>0 must increase yaw: ${yaw0} -> ${orbit.yaw}`);
  assert.ok(Math.abs(orbit.yaw - yaw0 - 60 * 0.0052) < 1e-9);
  // and pitch responds to vertical drag
  const p0 = orbit.pitch;
  el.fire('pointermove', { pointerId: 1, clientX: 160, clientY: 140 });
  assert.ok(orbit.pitch > p0);
  el.fire('pointerup', { pointerId: 1 });
  assert.equal(orbit.dragging, false);
});

test('non-left buttons never start a drag', () => {
  const { el, orbit } = makeOrbit();
  const yaw0 = orbit.yaw;
  el.fire('pointerdown', { button: 2, pointerId: 7, clientX: 100, clientY: 100 });
  assert.equal(orbit.dragging, false);
  el.fire('pointermove', { pointerId: 7, clientX: 200, clientY: 100 });
  assert.equal(orbit.yaw, yaw0, 'right-button drag must not orbit');
});

test('lostpointercapture reliably ends the drag', () => {
  const { el, orbit } = makeOrbit();
  el.fire('pointerdown', { button: 0, pointerId: 3, clientX: 0, clientY: 0 });
  assert.equal(orbit.dragging, true);
  el.fire('lostpointercapture', { pointerId: 3 });
  assert.equal(orbit.dragging, false);
  const yaw0 = orbit.yaw;
  el.fire('pointermove', { pointerId: 3, clientX: 50, clientY: 0 });
  assert.equal(orbit.yaw, yaw0, 'released pointer must not orbit');
});

test('step reports camera movement for the dirty-check render loop', () => {
  const { el, orbit } = makeOrbit();
  // constructor already marked moved once
  assert.equal(orbit.step(0.016, false), true);
  assert.equal(orbit.step(0.016, false), false, 'still camera reports false');
  orbit.autoRotate = false;
  assert.equal(orbit.step(0.016, true), false, 'autoRotate off -> no motion');
  orbit.autoRotate = true;
  assert.equal(orbit.step(0.016, true), true, 'auto-rotate reports motion');
  // drag between frames reports on the next step
  el.fire('pointerdown', { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
  el.fire('pointermove', { pointerId: 1, clientX: 30, clientY: 0 });
  assert.equal(orbit.step(0.016, false), true, 'pending drag deltas report');
});
