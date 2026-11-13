import { describe, expect, it } from 'vitest';
import { PASSIVES, WEAPONS } from '../content/items';
import { TUNING } from '../content/tuning';
import { Rng } from '../core/rng';
import { applyCard, chestPrice, computeStats, damageTaken, evolvable, newLoadout, offerCards, openChest, rarityWeights, rollRarity, weaponDef, weaponMaxLevel, weaponStats, xpForLevel } from './progress';

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
    load.weapons = WEAPONS.filter((d) => !d.evolved)
      .slice(0, TUNING.cards.weaponSlots)
      .map((def) => ({ def, level: weaponMaxLevel(def), mults: [], damage: 0 }));
    for (const def of PASSIVES.slice(0, TUNING.cards.passiveSlots)) load.passives.push({ def, level: def.maxLevel, total: 1 });
    const cards = offerCards(load, new Rng(1), 0);
    expect(cards.map((c) => c.kind)).toEqual(['fallback']);
  });
});

describe('weapon stats', () => {
  it('rarity scales numeric upgrades but not counts', () => {
    const def = WEAPONS[0];
    const base = weaponStats({ def, level: 1, mults: [], damage: 0 });
    const common = weaponStats({ def, level: 2, mults: [1], damage: 0 });
    const legendary = weaponStats({ def, level: 2, mults: [TUNING.cards.multiplier.legendary], damage: 0 });
    expect(legendary.damage - base.damage).toBeCloseTo((common.damage - base.damage) * TUNING.cards.multiplier.legendary);
    const four = weaponStats({ def, level: 4, mults: [1, 1, 2.4], damage: 0 });
    expect(four.count).toBe(base.count + 1);
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

describe('content integrity', () => {
  it('every evolution points at an evolved weapon and an existing passive, each passive used once', () => {
    const used = new Set<string>();
    for (const w of WEAPONS.filter((x) => x.evolution)) {
      const e = w.evolution;
      if (!e) continue;
      expect(weaponDef(e.into).evolved).toBe(true);
      expect(PASSIVES.some((p) => p.id === e.passive)).toBe(true);
      expect(used.has(e.passive)).toBe(false);
      used.add(e.passive);
    }
  });

  it('every weapon has 7 level-ups with a card line for count upgrades', () => {
    for (const w of WEAPONS.filter((x) => !x.evolved)) {
      expect(w.levels).toHaveLength(7);
      for (const lv of w.levels) if (lv.add.count) expect(lv.text.length).toBeGreaterThan(0);
    }
  });
});

describe('evolutions and chests', () => {
  const maxed = (): ReturnType<typeof newLoadout> => {
    const load = newLoadout('kawa');
    load.weapons[0].level = weaponMaxLevel(load.weapons[0].def);
    return load;
  };

  it('needs max level and the paired passive', () => {
    const load = maxed();
    expect(evolvable(load)).toHaveLength(0);
    applyCard(load, { kind: 'passive', id: 'termos', name: '', description: '', level: 1, rarity: 'common', lines: [] });
    expect(evolvable(load)).toHaveLength(1);
    const reward = openChest(load, new Rng(1), 0);
    expect(reward.kind).toBe('evolution');
    expect(load.weapons[0].def.id).toBe('espresso');
    expect(evolvable(load)).toHaveLength(0);
  });

  it('never offers an evolved weapon or the base weapon of an owned evolution', () => {
    const load = maxed();
    applyCard(load, { kind: 'passive', id: 'termos', name: '', description: '', level: 1, rarity: 'common', lines: [] });
    openChest(load, new Rng(1), 0);
    const rng = new Rng(9);
    for (let i = 0; i < 300; i++) for (const c of offerCards(load, rng, 0)) expect(['kawa', 'espresso', 'teczka-prezesa'].includes(c.id)).toBe(false);
  });

  it('a chest without an evolution upgrades owned items', () => {
    const load = newLoadout();
    const reward = openChest(load, new Rng(4), 0);
    expect(reward.kind).toBe('upgrades');
    if (reward.kind === 'upgrades') expect(reward.cards.length).toBeGreaterThan(0);
  });

  it('chest prices rise', () => {
    expect(chestPrice(0, 8, 5)).toBe(8);
    expect(chestPrice(3, 8, 5)).toBe(23);
  });

  it('buffs and new passives feed the stats', () => {
    const load = newLoadout();
    load.buffs.push({ stat: 'might', value: 0.15 }, { stat: 'maxHp', value: 25 });
    applyCard(load, { kind: 'passive', id: 'bilet-ulgowy', name: '', description: '', level: 1, rarity: 'legendary', lines: [] });
    const s = computeStats(load);
    expect(s.might).toBeCloseTo(1.15);
    expect(s.maxHp).toBe(TUNING.player.maxHp + 25);
    expect(s.amount).toBeGreaterThanOrEqual(1);
  });
});
