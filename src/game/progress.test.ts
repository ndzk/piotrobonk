import { describe, expect, it } from 'vitest';
import { PASSIVES, WEAPONS } from '../content/items';
import { TUNING } from '../content/tuning';
import { Rng } from '../core/rng';
import { applyCard, computeStats, damageTaken, newLoadout, offerCards, rarityWeights, rollRarity, weaponMaxLevel, weaponStats, xpForLevel } from './progress';

describe('XP curve', () => {
  it('starts small and grows monotonically', () => {
    expect(xpForLevel(1)).toBe(TUNING.xp.base);
    for (let l = 1; l < 60; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });
});

describe('rarity', () => {
  it('matches the configured weights without luck (statistical, 200k rolls)', () => {
    const rng = new Rng(42);
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const n = 200_000;
    for (let i = 0; i < n; i++) counts[rollRarity(rng, 0)]++;
    const w = rarityWeights(0);
    const total = w.common + w.rare + w.epic + w.legendary;
    for (const k of ['common', 'rare', 'epic', 'legendary'] as const) expect(Math.abs(counts[k] / n - w[k] / total)).toBeLessThan(0.006);
  });

  it('luck shifts weight towards rarer cards', () => {
    const lucky = rarityWeights(1);
    const base = rarityWeights(0);
    expect(lucky.legendary / lucky.common).toBeGreaterThan(base.legendary / base.common);
  });
});

describe('cards', () => {
  it('offers three distinct cards that respect banishes and slots', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const load = newLoadout();
      load.banished.add('nerka');
      const cards = offerCards(load, rng, 0);
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map((c) => c.id)).size).toBe(3);
      expect(cards.some((c) => c.id === 'nerka')).toBe(false);
    }
  });

  it('never offers a fifth passive', () => {
    const load = newLoadout();
    for (const def of PASSIVES.slice(0, TUNING.cards.passiveSlots)) applyCard(load, { kind: 'passive', id: def.id, name: '', description: '', level: 1, rarity: 'common', lines: [] });
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) for (const c of offerCards(load, rng, 0)) if (c.kind === 'passive') expect(load.passives.some((p) => p.def.id === c.id)).toBe(true);
  });

  it('falls back to a heal when everything is maxed', () => {
    const load = newLoadout();
    const w = load.weapons[0];
    w.level = weaponMaxLevel(w.def);
    for (const def of PASSIVES.slice(0, TUNING.cards.passiveSlots)) load.passives.push({ def, level: def.maxLevel, total: 1 });
    const cards = offerCards(load, new Rng(1), 0);
    expect(cards.map((c) => c.kind)).toEqual(['fallback']);
  });
});

describe('weapon stats', () => {
  it('rarity scales numeric upgrades but not counts', () => {
    const def = WEAPONS[0];
    const common = weaponStats({ def, level: 2, mults: [1], damage: 0 });
    const legendary = weaponStats({ def, level: 2, mults: [TUNING.cards.multiplier.legendary], damage: 0 });
    expect(legendary.damage - def.base.damage).toBeCloseTo((common.damage - def.base.damage) * TUNING.cards.multiplier.legendary);
    const four = weaponStats({ def, level: 4, mults: [1, 1, 2.4], damage: 0 });
    expect(four.count).toBe(def.base.count + 1);
  });

  it('cooldown multipliers never go negative', () => {
    const def = WEAPONS[0];
    const s = weaponStats({ def, level: weaponMaxLevel(def), mults: new Array<number>(10).fill(TUNING.cards.multiplier.legendary), damage: 0 });
    expect(s.cooldown).toBeGreaterThan(0.2);
  });
});

describe('stats and damage', () => {
  it('passives add up', () => {
    const load = newLoadout();
    applyCard(load, { kind: 'passive', id: 'klapki', name: '', description: '', level: 1, rarity: 'common', lines: [] });
    applyCard(load, { kind: 'passive', id: 'klapki', name: '', description: '', level: 2, rarity: 'rare', lines: [] });
    const per = PASSIVES.find((p) => p.id === 'klapki')?.perLevel ?? 0;
    expect(computeStats(load).speed).toBeCloseTo(1 + per + per * TUNING.cards.multiplier.rare);
  });

  it('armour blocks a capped fraction and never goes below the minimum', () => {
    expect(damageTaken(10, 0.2)).toBeCloseTo(8);
    expect(damageTaken(10, 5)).toBeCloseTo(4);
    expect(damageTaken(1, 0.5)).toBe(TUNING.combat.minDamage);
  });

  it('does not offer Termos while nothing uses duration', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 300; i++) expect(offerCards(newLoadout(), rng, 0).some((c) => c.id === 'termos')).toBe(false);
  });

  it('count-only upgrades are always common and texts use a decimal comma', () => {
    const load = newLoadout();
    const w = load.weapons[0];
    w.level = 3;
    const rng = new Rng(5);
    for (let i = 0; i < 200; i++) {
      for (const c of offerCards(load, rng, 5)) {
        if (c.kind === 'weapon') expect(c.rarity).toBe('common');
        for (const l of c.lines) expect(l).not.toMatch(/\d\.\d/);
      }
    }
  });
});
