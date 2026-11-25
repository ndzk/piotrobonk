// The model is the game's own data in arithmetic: it agrees with the tuning it reads, and its boss health and
// kill time are the inverse of each other.
import { describe, expect, it } from 'vitest';
import { TUNING } from '../content/tuning';
import { bossHp, bossHpFor, bossTtk, groupRate, hpMul, spawnedHp, touchesToDie } from './model';

describe('balance model', () => {
  it('reads the spawn rate and health curve from the tuning', () => {
    const keys = TUNING.waves.rate;
    expect(groupRate(keys[0][0])).toBeCloseTo(keys[0][1]);
    expect(groupRate(1e6)).toBeCloseTo(keys[keys.length - 1][1]);
    expect(hpMul(60, 'normalnie')).toBeCloseTo((1 + TUNING.waves.hpPerMinute) * TUNING.difficulty.normalnie.hp);
  });

  it('enemy health arriving grows minute by minute, and more on the harder kursy', () => {
    for (let m = 1; m < 9; m++) expect(spawnedHp(m, 'normalnie')).toBeGreaterThan(spawnedHp(m - 1, 'normalnie'));
    expect(spawnedHp(4, 'opoznienie')).toBeGreaterThan(spawnedHp(4, 'normalnie'));
    expect(touchesToDie(0, 'spokojny')).toBeGreaterThan(touchesToDie(0, 'normalnie'));
  });

  it('four or five touches finish Piotrek at the start of Normalnie, more later', () => {
    expect(touchesToDie(10, 'normalnie')).toBeGreaterThanOrEqual(4);
    expect(touchesToDie(10, 'normalnie')).toBeLessThanOrEqual(5);
    expect(touchesToDie(360, 'normalnie')).toBeLessThan(touchesToDie(10, 'normalnie'));
  });

  it("the boss damage limit holds every fight's minimum up to 3 times the limit's damage a second", () => {
    const { limitMargin, limitOverflow } = TUNING.boss;
    // Damage k times the limit's rate lands as 1 + overflow × (k - 1) of it: the kill takes margin / that.
    expect(limitMargin / (1 + limitOverflow * (3 - 1))).toBeGreaterThanOrEqual(1);
  });

  it('boss health and kill time are each other inverse', () => {
    const hp = bossHpFor('widzew', 'normalnie', 150, 100);
    const ttk = bossTtk('widzew', 'normalnie', (bossHp('widzew', 'normalnie') / hp) * 100);
    expect(ttk).toBeGreaterThan(0);
    expect(bossTtk('widzew', 'normalnie', bossHp('widzew', 'normalnie') / (150 - 2 * TUNING.boss.transition))).toBeCloseTo(150);
  });
});
