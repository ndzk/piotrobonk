import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CS_WEAPONS, GLOVES, KNIVES } from '../content/skins/catalog';
import { CASE_ODDS, SHOP, WEARS, buildDb, wearOf, type RawSnapshot, type SkinDb } from '../content/skins/index';
import { Rng } from '../core/rng';
import { caseOdds, openCase, sellPrice, tradeUp, tradeUpOutcomes, tradeUpProblem, type TradeUpInput } from './skins';

type Raw = RawSnapshot;

/** Two collections, one case each; collection B has no Classified skins. */
function fakeDb(): SkinDb {
  const skin = (r: number, c: string | undefined, f: [number, number] = [0, 1], st: 0 | 1 = 1): Raw['skins'][string] => ({ w: 'ak47', p: `P${r}${c ?? ''}`, r, s: 'custom', f, st, sv: 0, ...(c ? { c } : {}), pal: ['#ff0000'] });
  const raw: Raw = {
    fetched: '2026-11-14',
    weapons: { ak47: 'AK-47', knife_karambit: 'Karambit', sporty_gloves: 'Sport Gloves' },
    collections: [
      { id: 'A', name: 'Kolekcja A' },
      { id: 'B', name: 'Kolekcja B' },
    ],
    skins: {
      a2: skin(2, 'A', [0.1, 0.5]),
      a2b: skin(2, 'A'),
      a3: skin(3, 'A', [0, 0.8]),
      a4: skin(4, 'A'),
      a5: skin(5, 'A'),
      b2: skin(2, 'B'),
      b3: skin(3, 'B'),
      b3b: skin(3, 'B'),
      b5: skin(5, 'B'),
      k: { ...skin(6, undefined), w: 'knife_karambit' },
      g: { ...skin(6, undefined, [0.06, 0.8], 0), w: 'sporty_gloves' },
    },
    cases: [
      { id: 'caseA', name: 'Case A', date: '2014', items: ['a2', 'a2b', 'a3', 'a4', 'a5'], rare: ['k'] },
      { id: 'caseB', name: 'Case B', date: '2015', items: ['b2', 'b3', 'b3b', 'b5'], rare: ['g'] },
    ],
  };
  return buildDb(raw);
}

const input = (db: SkinDb, id: string, float = 0.2, stattrak = false): TradeUpInput => {
  const def = db.skins.get(id);
  if (!def) throw new Error(id);
  return { def, float, stattrak };
};

describe('cases', () => {
  it('hits the CS odds over a million openings', () => {
    const db = fakeDb();
    const c = db.cases[0];
    const rng = new Rng(2026);
    const N = 1_000_000;
    const tiers = new Map<number, number>();
    let stattrak = 0;
    let outside = 0;
    for (let k = 0; k < N; k++) {
      const d = openCase(c, rng);
      tiers.set(d.def.rarity, (tiers.get(d.def.rarity) ?? 0) + 1);
      if (d.stattrak) stattrak++;
      if (d.float < d.def.float[0] || d.float > d.def.float[1]) outside++;
    }
    expect(outside).toBe(0);
    for (const r of [2, 3, 4, 5, 6] as const) {
      const p = CASE_ODDS[r];
      // Within five standard deviations of a binomial draw.
      const sigma = Math.sqrt(N * p * (1 - p));
      expect(Math.abs((tiers.get(r) ?? 0) - N * p)).toBeLessThan(5 * sigma);
    }
    // The ★ pool is a knife here, so StatTrak™ applies to every drop.
    expect(Math.abs(stattrak / N - 0.1)).toBeLessThan(0.002);
  });

  it('gives a missing tier’s share to the tiers a case has', () => {
    const db = fakeDb();
    const odds = caseOdds(db.cases[1]);
    expect(odds[4]).toBe(0);
    expect(odds[2] + odds[3] + odds[5] + odds[6]).toBeCloseTo(1, 10);
    expect(odds[3] / odds[2]).toBeCloseTo(CASE_ODDS[3] / CASE_ODDS[2], 10);
  });

  it('never gives StatTrak™ to gloves', () => {
    const db = fakeDb();
    const rng = new Rng(5);
    for (let k = 0; k < 200_000; k++) {
      const d = openCase(db.cases[1], rng);
      if (d.def.id === 'g') expect(d.stattrak).toBe(false);
    }
  });
});

describe('wear', () => {
  it('maps floats onto the five CS conditions at the right boundaries', () => {
    expect(wearOf(0).short).toBe('FN');
    expect(wearOf(0.0699).short).toBe('FN');
    expect(wearOf(0.07).short).toBe('MW');
    expect(wearOf(0.15).short).toBe('FT');
    expect(wearOf(0.38).short).toBe('WW');
    expect(wearOf(0.45).short).toBe('BS');
    expect(wearOf(1).short).toBe('BS');
    expect(WEARS).toHaveLength(5);
  });
});

describe('trade-up', () => {
  it('needs ten skins of one tier, one StatTrak™ kind, below ★', () => {
    const db = fakeDb();
    const nine = Array.from({ length: 9 }, () => input(db, 'a2'));
    expect(tradeUpProblem(db, nine)).toBe('count');
    expect(tradeUpProblem(db, [...nine, input(db, 'a3')])).toBe('rarity');
    expect(tradeUpProblem(db, [...nine, input(db, 'a2', 0.2, true)])).toBe('stattrak');
    expect(tradeUpProblem(db, Array.from({ length: 10 }, () => input(db, 'k')))).toBe('top');
    expect(tradeUpProblem(db, [...nine, input(db, 'a2b')])).toBeNull();
  });

  it('draws the next tier from the inputs’ collections, weighted by inputs', () => {
    const db = fakeDb();
    // 5 from A (one Restricted outcome), 5 from B (two outcomes): a3 50%, b3 and b3b 25% each.
    const inputs = [...Array.from({ length: 5 }, () => input(db, 'a2')), ...Array.from({ length: 5 }, () => input(db, 'b2'))];
    const out = new Map(tradeUpOutcomes(db, inputs).map((o) => [o.def.id, o.chance]));
    expect(out.get('a3')).toBeCloseTo(0.5);
    expect(out.get('b3')).toBeCloseTo(0.25);
    expect(out.get('b3b')).toBeCloseTo(0.25);
    const rng = new Rng(9);
    const counts = new Map<string, number>();
    for (let k = 0; k < 40_000; k++) {
      const d = tradeUp(db, inputs, rng);
      if (!d) throw new Error('contract refused');
      expect(d.def.rarity).toBe(3);
      counts.set(d.def.id, (counts.get(d.def.id) ?? 0) + 1);
    }
    expect((counts.get('a3') ?? 0) / 40_000).toBeCloseTo(0.5, 1);
  });

  it('skips collections with nothing above, and maps the normalised float', () => {
    const db = fakeDb();
    // B has no Classified: three Restricted from B and seven from A all go to a4.
    const inputs = [...Array.from({ length: 7 }, () => input(db, 'a3', 0.4)), ...Array.from({ length: 3 }, () => input(db, 'b3', 0.5))];
    const d = tradeUp(db, inputs, new Rng(1));
    expect(d?.def.id).toBe('a4');
    // a3 spans 0–0.8 (0,4 → 0,5 of its range), b3 spans 0–1 (0,5): the average is 0,5 of a4's 0–1.
    expect(d?.float).toBeCloseTo(0.5, 10);
  });

  it('turns ten Covert skins into a ★ item from their cases', () => {
    const db = fakeDb();
    const inputs = Array.from({ length: 10 }, () => input(db, 'a5'));
    const d = tradeUp(db, inputs, new Rng(3));
    expect(d?.def.id).toBe('k');
    // StatTrak™ Covert inputs can never come out as gloves (no StatTrak™ gloves exist).
    const st = Array.from({ length: 10 }, () => input(db, 'b5', 0.3, true));
    expect(tradeUpProblem(db, st)).toBe('noOutcome');
  });
});

describe('recyklomat prices', () => {
  it('pays more for rarer, cleaner and StatTrak™ skins', () => {
    const db = fakeDb();
    const a2 = input(db, 'a2').def;
    const a5 = input(db, 'a5').def;
    expect(sellPrice(a5, 0.2, false)).toBeGreaterThan(sellPrice(a2, 0.2, false));
    expect(sellPrice(a2, 0.01, false)).toBeGreaterThan(sellPrice(a2, 0.9, false));
    expect(sellPrice(a2, 0.2, true)).toBeGreaterThan(sellPrice(a2, 0.2, false));
    expect(sellPrice(a2, 0.99, false)).toBeGreaterThanOrEqual(1);
    // A case is a gamble: on average it pays back less than it costs, like in CS.
    let ev = 0;
    for (const r of [2, 3, 4, 5, 6] as const) ev += CASE_ODDS[r] * SHOP.sell[r];
    expect(ev).toBeLessThan(SHOP.casePrice + SHOP.keyPrice);
  });
});

describe('snapshot', () => {
  const raw = JSON.parse(readFileSync('src/content/skins/snapshot.json', 'utf8')) as Raw;
  const db = buildDb(raw);
  it('has every real weapon case with contents, and a model for every weapon in them', () => {
    expect(db.cases.length).toBeGreaterThanOrEqual(40);
    for (const c of db.cases) {
      expect(c.items.length, c.name).toBeGreaterThan(0);
      expect(c.rare.length, c.name).toBeGreaterThan(0);
    }
    for (const s of db.skins.values()) {
      const known = s.weapon in CS_WEAPONS || s.weapon in KNIVES || s.weapon in GLOVES;
      expect(known, s.weapon).toBe(true);
      expect(s.palette.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.float[0]).toBeLessThan(s.float[1]);
    }
  });
});
