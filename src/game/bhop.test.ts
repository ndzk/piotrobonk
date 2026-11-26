import { describe, expect, it } from 'vitest';
import { TUNING } from '../content/tuning';
import { BHOP_BANK, BHOP_MULT, BHOP_NONE, BhopCombo } from './bhop';

const B = TUNING.bhop;

describe('bunny hop points', () => {
  it('only a bunny hop starts a chain, and the chain scores by the speed carried through the air', () => {
    const c = new BhopCombo();
    c.reset(0);
    c.jump(false);
    c.step(0.5, false, 10);
    expect(c.score).toBe(0);
    c.jump(true);
    c.step(0.5, false, 10);
    expect(c.score).toBeCloseTo(10 * 0.5 * B.points);
  });

  it('banks the chain once Piotrek stay on the ground, and keeps the record', () => {
    const c = new BhopCombo();
    c.reset(100);
    c.jump(true);
    c.step(0.5, false, 10);
    c.land();
    expect(c.step(B.endAfter / 2, true, 10)).toBe(BHOP_NONE);
    expect(c.step(B.endAfter, true, 10)).toBe(BHOP_BANK);
    expect(c.hops).toBe(0);
    expect(c.last).toBe(Math.floor(10 * 0.5 * B.points));
    expect(c.best).toBe(c.last);
    expect(c.total).toBe(c.last);
  });

  it('a hit loses the chain in progress', () => {
    const c = new BhopCombo();
    c.reset(0);
    c.jump(true);
    c.step(0.5, false, 10);
    c.fail();
    expect(c.score).toBe(0);
    expect(c.lost).toBe(true);
    expect(c.hops).toBe(0);
    expect(c.showFor).toBeGreaterThan(0);
  });

  it('the multiplier goes up with the score and down when the speed is gone', () => {
    const c = new BhopCombo();
    c.reset(0);
    c.jump(true);
    expect(c.step(B.multEvery + 0.1, false, 10)).toBe(BHOP_MULT);
    expect(c.mult).toBe(2);
    c.step(B.multDrop + 0.1, false, B.slow - 1);
    expect(c.mult).toBe(1);
  });
});
