import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StyleCycle } from '../js/cycle.js';
import { DEFAULTS } from '../js/settings.js';

const on = { ...DEFAULTS, autoCycle: true, cycleInterval: 20 };
const off = { ...DEFAULTS, autoCycle: false };

test('disabled cycle never pulses and clears elapsed', () => {
  const c = new StyleCycle();
  assert.equal(c.step(60, off), false);
  assert.equal(c.elapsed, 0);
  assert.equal(c.remaining(off), null);
});

test('pulse fires once per interval and carries remainder', () => {
  const c = new StyleCycle();
  assert.equal(c.step(10, on), false);
  assert.equal(c.remaining(on), 10);
  assert.equal(c.step(15, on), true);   // 25s elapsed > 20
  assert.ok(Math.abs(c.elapsed - 5) < 1e-9, 'overshoot carries over');
  assert.equal(c.step(14.9, on), false);
  assert.equal(c.step(0.2, on), true);  // 19.9 + 0.2 = 20.1 >= 20
});

test('nonpositive/invalid dt keeps elapsed (pause-safe)', () => {
  const c = new StyleCycle();
  c.step(10, on);
  c.step(0, on); c.step(-5, on); c.step(NaN, on);
  assert.equal(c.elapsed, 10, 'pause must not decay the countdown');
  assert.equal(c.step(10, on), true);
});

test('countdown is independent of the simulation speed', () => {
  const c = new StyleCycle();
  const slow = { ...on, speed: 0.15 };
  const fast = { ...on, speed: 3 };
  assert.equal(c.step(20, slow), true);
  c.reset();
  assert.equal(c.step(20, fast), true);
});

test('reset restarts the countdown; bad interval disables', () => {
  const c = new StyleCycle();
  c.step(19, on);
  c.reset();
  assert.equal(c.elapsed, 0);
  assert.equal(c.step(19, on), false);
  assert.equal(c.step(60, { ...on, cycleInterval: 0 }), false);
  assert.equal(c.elapsed, 0);
});
