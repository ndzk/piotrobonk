import { describe, expect, it } from 'vitest';
import { TUNING } from '../content/tuning';
import { Rng } from '../core/rng';
import { Director } from './director';

/** Runs a director for `seconds` at 60 Hz with a given damage and crowd, returning the multipliers and phases. */
function play(seed: number, kurs: 'spokojny' | 'normalnie', hurt: (t: number) => number, seconds = 300): { mul: number[]; phases: string[]; patterns: string[] } {
  const d = new Director();
  d.reset(new Rng(seed), TUNING.director[kurs]);
  const mul: number[] = [];
  const phases: string[] = [];
  const patterns: string[] = [];
  for (let k = 0; k < seconds * 60; k++) {
    const t = k / 60;
    mul.push(d.update(1 / 60, hurt(t), 20));
    phases.push(d.phase);
    if (d.pattern) {
      patterns.push(d.pattern);
      d.pattern = null;
    }
  }
  return { mul, phases, patterns };
}

describe('wave director', () => {
  it('is the same run for the same seed', () => {
    expect(play(7, 'normalnie', () => 0)).toEqual(play(7, 'normalnie', () => 0));
    expect(play(7, 'normalnie', () => 0).mul).not.toEqual(play(8, 'normalnie', () => 0).mul);
  });

  it('breathes: build-up, peak, fade and breather, each peak opening with a pattern', () => {
    const { phases, patterns, mul } = play(3, 'normalnie', () => 0);
    for (const p of ['build', 'peak', 'fade', 'relax']) expect(phases).toContain(p);
    expect(patterns.length).toBeGreaterThan(3);
    expect(Math.max(...mul)).toBeCloseTo(TUNING.director.normalnie.peakMul);
    expect(Math.min(...mul)).toBeCloseTo(TUNING.director.normalnie.relaxMul);
  });

  it('never rubber-bands on Normalnie: how the player is doing changes nothing', () => {
    const calm = play(11, 'normalnie', () => 0);
    const hurt = play(11, 'normalnie', (t) => (Math.floor(t) % 3 === 0 ? 0.05 : 0));
    expect(hurt.mul).toEqual(calm.mul);
    expect(hurt.phases).toEqual(calm.phases);
  });

  it('on Spokojny a player in trouble gets the breather sooner', () => {
    const calm = play(11, 'spokojny', () => 0);
    const hurt = play(11, 'spokojny', () => 0.002);
    const relax = (r: { phases: string[] }): number => r.phases.filter((p) => p === 'relax').length;
    expect(relax(hurt)).toBeGreaterThan(relax(calm));
  });
});
