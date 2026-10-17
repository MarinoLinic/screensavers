import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TourCycle } from '../js/cycle.js';
import { DEFAULTS } from '../js/settings.js';

const on = { ...DEFAULTS, autoCycle: true, cycleInterval: 45 };
const off = { ...DEFAULTS, autoCycle: false };

test('disabled tour never pulses and clears elapsed', () => {
  const c = new TourCycle();
  assert.equal(c.step(60, off), false);
  assert.equal(c.elapsed, 0);
  assert.equal(c.remaining(off), null);
});

test('pulse fires once per interval and carries remainder', () => {
  const c = new TourCycle();
  assert.equal(c.step(30, on), false);
  assert.equal(c.remaining(on), 15);
  assert.equal(c.step(20, on), true);   // 50s elapsed > 45
  assert.ok(Math.abs(c.elapsed - 5) < 1e-9, 'overshoot carries over');
  assert.equal(c.step(39.9, on), false);
  assert.equal(c.step(0.2, on), true);  // 44.9 + 0.2 = 45.1 >= 45
});

test('nonpositive/invalid dt keeps elapsed (pause-safe)', () => {
  const c = new TourCycle();
  c.step(30, on);
  c.step(0, on); c.step(-5, on); c.step(NaN, on);
  assert.equal(c.elapsed, 30, 'pause must not decay the countdown');
  assert.equal(c.step(15, on), true);
});

test('countdown is independent of the simulation speed', () => {
  const c = new TourCycle();
  const slow = { ...on, speed: 0.25 };
  const fast = { ...on, speed: 2 };
  assert.equal(c.step(45, slow), true);
  c.reset();
  assert.equal(c.step(45, fast), true);
});

test('reset restarts the countdown; bad interval disables', () => {
  const c = new TourCycle();
  c.step(40, on);
  c.reset();
  assert.equal(c.elapsed, 0);
  assert.equal(c.step(40, on), false);
  assert.equal(c.step(60, { ...on, cycleInterval: 0 }), false);
  assert.equal(c.elapsed, 0);
});
