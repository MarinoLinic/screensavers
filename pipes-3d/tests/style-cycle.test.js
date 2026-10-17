import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StyleCycle } from '../js/style-cycle.js';
import { DEFAULTS } from '../js/settings.js';

const on = (extra = {}) =>
  ({ ...DEFAULTS, mode: 'living', autoCycle: true, cycleInterval: 15, ...extra });

test('disabled clears the timer and never pulses', () => {
  const c = new StyleCycle();
  const s = { ...DEFAULTS, autoCycle: false, cycleInterval: 15 };
  assert.equal(c.step(5, s), false);
  assert.equal(c.elapsed, 0, 'disabled clears accumulated time');
});

test('classic mode never pulses — even past the interval', () => {
  const c = new StyleCycle();
  const s = on({ mode: 'classic' });
  for (let i = 0; i < 20; i++) assert.equal(c.step(10, s), false);
  assert.equal(c.elapsed, 0, 'classic keeps the timer cleared');
  // switching back to living starts a fresh countdown, no carry-over
  assert.equal(c.step(14.9, on()), false);
  assert.equal(c.step(0.2, on()), true);
});

test('pulses exactly when the interval elapses', () => {
  const c = new StyleCycle();
  const s = on();
  assert.equal(c.step(10, s), false);
  assert.equal(c.step(4.9, s), false);
  assert.equal(c.step(0.2, s), true, 'one pulse at 15s');
});

test('cadence is wall-clock seconds, independent of growth speed', () => {
  for (const speed of [0.25, 4]) {
    const d = new StyleCycle();
    let pulsed = false;
    for (let i = 0; i < 15 && !pulsed; i++) pulsed = d.step(1, on({ speed }));
    assert.equal(pulsed, true, 'interval ticks on dt regardless of speed');
  }
  const c = new StyleCycle();
  assert.equal(c.step(90, on({ cycleInterval: 90 })), true, '90s option');
});

test('overshoot pulses once and keeps the remainder (modulo)', () => {
  const c = new StyleCycle();
  const s = on();
  assert.equal(c.step(19, s), true, 'one pulse per call');
  assert.ok(Math.abs(c.elapsed - 4) < 1e-9, 'remainder carried');
  assert.equal(c.step(11, s), true, 'remainder counts toward next tick');
});

test('bogus dt does not advance; bad interval clears', () => {
  const c = new StyleCycle();
  const s = on();
  assert.equal(c.step(0, s), false);
  assert.equal(c.step(-3, s), false);
  assert.equal(c.step(NaN, s), false);
  c.elapsed = 7;
  assert.equal(c.step(1, { ...s, cycleInterval: 'soon' }), false);
  assert.equal(c.elapsed, 0, 'invalid interval clears the timer');
});

test('reset() restarts the countdown (manual picks do not pulse early)', () => {
  const c = new StyleCycle();
  const s = on();
  c.step(14.9, s);
  c.reset();
  assert.equal(c.step(14.9, s), false, 'post-reset stays under interval');
  assert.equal(c.step(0.2, s), true);
});
