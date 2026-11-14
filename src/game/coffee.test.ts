import { describe, expect, it } from 'vitest';
import { TUNING } from '../content/tuning';
import { Rng } from '../core/rng';
import { Coffee, SlapBar } from './coffee';

const T = TUNING.finale;

describe('kopi luwak', () => {
  it('shields Bartek in proportion to the cup', () => {
    const c = new Coffee();
    c.level = 1;
    expect(c.taken).toBeCloseTo(1 - T.shield);
    c.level = 0;
    expect(c.taken).toBe(1);
  });

  it('sips on the phase schedule, draining the cup and buffing him', () => {
    const c = new Coffee({ ...T, lemurEvery: [999, 999, 999] });
    const start = c.level;
    let sips = 0;
    for (let k = 0; k < Math.round((T.sipEvery[0] * 3 + 0.05) / 0.01); k++) if (c.update(0.01, 0) === 'sip') sips++;
    expect(sips).toBe(3);
    expect(c.level).toBeCloseTo(Math.max(0, start - 3 * T.sip), 5);
    // A third-phase Bartek gulps much more often.
    const fast = new Coffee({ ...T, lemurEvery: [999, 999, 999] });
    fast.level = 1;
    let gulps = 0;
    for (let t = 0; t < 30; t += 0.01) if (fast.update(0.01, 2) === 'sip') gulps++;
    expect(gulps).toBeGreaterThan(sips);
  });

  it('cannot sip an empty cup, and lemurs fill it back up to the brim at most', () => {
    const c = new Coffee({ ...T, lemurEvery: [999, 999, 999] });
    c.level = 0;
    for (let t = 0; t < 20; t += 0.05) expect(c.update(0.05, 0)).not.toBe('sip');
    for (let k = 0; k < 10; k++) c.refill();
    expect(c.level).toBe(1);
  });

  it('sends for lemurs on its own timer', () => {
    const c = new Coffee();
    let calls = 0;
    for (let t = 0; t < T.lemurEvery[1] * 2 + T.lemurEvery[0]; t += 0.05) if (c.update(0.05, 1) === 'lemurs') calls++;
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(c.lemurs(2)).toBe(T.lemurCount[2]);
  });
});

describe('slap bar', () => {
  it('lands inside the window and misses outside it', () => {
    const bar = new SlapBar(new Rng(4));
    bar.pos = bar.centre;
    expect(bar.press()).toBe(true);
    bar.pos = bar.centre > 0.5 ? 0 : 1;
    expect(bar.press()).toBe(false);
  });

  it('widens after every miss up to the cap, so a player always gets there', () => {
    const bar = new SlapBar(new Rng(9));
    let w = bar.width;
    for (let k = 0; k < 20; k++) {
      bar.pos = bar.centre > 0.5 ? 0 : 1;
      bar.press();
      expect(bar.width).toBeGreaterThanOrEqual(w);
      w = bar.width;
    }
    expect(bar.width).toBe(T.qteMax);
    expect(bar.centre - bar.width / 2).toBeGreaterThanOrEqual(0);
    expect(bar.centre + bar.width / 2).toBeLessThanOrEqual(1);
  });

  it('sweeps back and forth within the bar', () => {
    const bar = new SlapBar(new Rng(1));
    for (let k = 0; k < 1000; k++) {
      bar.update(0.016);
      expect(bar.pos).toBeGreaterThanOrEqual(0);
      expect(bar.pos).toBeLessThanOrEqual(1);
    }
  });
});
