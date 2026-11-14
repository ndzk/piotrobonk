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
    const c = new Coffee();
    const start = c.level;
    let sips = 0;
    for (let k = 0; k < Math.round((T.sipEvery[0] * 3 + 0.05) / 0.01); k++) if (c.update(0.01, 0)) sips++;
    expect(sips).toBe(3);
    expect(c.level).toBeCloseTo(Math.max(0, start - 3 * T.sip), 5);
    expect(c.buffed).toBe(true);
    // A third-phase Bartek gulps much more often.
    const fast = new Coffee();
    let gulps = 0;
    for (let k = 0; k < 3000; k++) {
      fast.level = 1;
      if (fast.update(0.01, 2)) gulps++;
    }
    expect(gulps).toBeGreaterThan(sips);
  });

  it('cannot sip an empty cup, and lemurs fill it back up to the brim at most', () => {
    const c = new Coffee();
    c.level = 0;
    for (let k = 0; k < 400; k++) expect(c.update(0.05, 0)).toBe(false);
    for (let k = 0; k < 10; k++) c.refill();
    expect(c.level).toBe(1);
  });

  it('a full cup lasts most of the first phase on its own', () => {
    const c = new Coffee();
    let t = 0;
    while (c.level > 0.02 && t < 300) {
      c.update(0.05, 0);
      t += 0.05;
    }
    // Nine sips, four seconds apart: about 35 s of shield, falling off as he drinks.
    expect(t).toBeGreaterThan(28);
    expect(t).toBeLessThan(45);
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
