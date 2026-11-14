// Pure skin logic (no DOM, no Three.js): opening cases with CS odds, floats and wear, trade-up contracts
// and the recyklomat's buy-back prices. Every random draw goes through a seeded Rng.

import { CASE_ODDS, CS_RARITIES, SHOP, STATTRAK_CHANCE, wearIndex, type CaseDef, type CsRarity, type SkinDb, type SkinDef } from '../content/skins/index';
import type { Rng } from '../core/rng';

/** A skin in the inventory. `uid` is unique per save; `seed` varies the pattern like CS's paint seed. */
export interface OwnedSkin {
  uid: number;
  skin: string;
  float: number;
  seed: number;
  stattrak: boolean;
  /** StatTrak™ kills, counted in runs. */
  kills: number;
}

export interface Drop {
  def: SkinDef;
  float: number;
  seed: number;
  stattrak: boolean;
}

/** Odds of every tier for this case: tiers it does not contain hand their share to the rest, pro rata. */
export function caseOdds(c: CaseDef): Record<CsRarity, number> {
  const present = new Set<CsRarity>(c.items.map((s) => s.rarity));
  if (c.rare.length) present.add(6);
  let total = 0;
  for (const r of CS_RARITIES) if (present.has(r)) total += CASE_ODDS[r];
  const out = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<CsRarity, number>;
  for (const r of CS_RARITIES) if (present.has(r)) out[r] = CASE_ODDS[r] / total;
  return out;
}

/** Odds and the skins of each tier, worked out once per case. */
const tiers = new WeakMap<CaseDef, { odds: Record<CsRarity, number>; pools: Record<CsRarity, SkinDef[]> }>();

function tiersOf(c: CaseDef): { odds: Record<CsRarity, number>; pools: Record<CsRarity, SkinDef[]> } {
  let t = tiers.get(c);
  if (!t) {
    const pools = { 2: [], 3: [], 4: [], 5: [], 6: c.rare } as Record<CsRarity, SkinDef[]>;
    for (const s of c.items) pools[s.rarity].push(s);
    t = { odds: caseOdds(c), pools };
    tiers.set(c, t);
  }
  return t;
}

export function rollRarity(c: CaseDef, rng: Rng): CsRarity {
  const odds = tiersOf(c).odds;
  let x = rng.next();
  for (const r of [6, 5, 4, 3, 2] as const) {
    x -= odds[r];
    if (x < 0) return r;
  }
  // Rounding left a sliver above 1: the most common tier the case has.
  for (const r of CS_RARITIES) if (odds[r] > 0) return r;
  return 2;
}

/** Float drawn uniformly between the skin's own minimum and maximum. */
export function rollFloat(def: SkinDef, rng: Rng): number {
  const [lo, hi] = def.float;
  return lo + (hi - lo) * rng.next();
}

function makeDrop(def: SkinDef, float: number, rng: Rng, stattrak: boolean): Drop {
  return { def, float, seed: rng.int(0, 1000), stattrak: stattrak && def.stattrak };
}

/** Opens a case: tier by CS odds, then a uniform skin of that tier, its float, StatTrak™ 10%. */
export function openCase(c: CaseDef, rng: Rng): Drop {
  const r = rollRarity(c, rng);
  const pool = tiersOf(c).pools[r];
  const def = pool[Math.floor(rng.next() * pool.length)];
  const stattrak = rng.next() < STATTRAK_CHANCE;
  return makeDrop(def, rollFloat(def, rng), rng, stattrak);
}

export type TradeUpProblem = 'count' | 'rarity' | 'collection' | 'stattrak' | 'top' | 'noOutcome';

export interface TradeUpInput {
  def: SkinDef;
  float: number;
  stattrak: boolean;
}

/** Every skin a contract can produce and its chance (CS rules: by inputs per collection, then uniform). */
export function tradeUpOutcomes(db: SkinDb, inputs: TradeUpInput[]): { def: SkinDef; chance: number }[] {
  if (!inputs.length) return [];
  const r = inputs[0].def.rarity;
  if (r >= 6) return [];
  const pools: SkinDef[][] = [];
  for (const i of inputs) {
    const col = i.def.collection;
    if (!col) continue;
    if (r === 5) {
      // Covert contracts give a ★ item from the rare pool of the cases behind the inputs' collections.
      const rare = new Map<string, SkinDef>();
      for (const c of db.casesOf.get(col) ?? []) for (const s of c.rare) if (!i.stattrak || s.stattrak) rare.set(s.id, s);
      pools.push([...rare.values()]);
    } else pools.push((db.byCollection.get(col) ?? []).filter((s) => s.rarity === r + 1 && (!i.stattrak || s.stattrak)));
  }
  const valid = pools.filter((p) => p.length > 0);
  const chances = new Map<SkinDef, number>();
  for (const p of valid) for (const s of p) chances.set(s, (chances.get(s) ?? 0) + 1 / valid.length / p.length);
  return [...chances].map(([def, chance]) => ({ def, chance }));
}

export function tradeUpProblem(db: SkinDb, inputs: TradeUpInput[]): TradeUpProblem | null {
  if (inputs.length !== SHOP.tradeUp) return 'count';
  const r = inputs[0].def.rarity;
  if (r >= 6) return 'top';
  if (inputs.some((i) => i.def.rarity !== r)) return 'rarity';
  if (inputs.some((i) => i.stattrak !== inputs[0].stattrak)) return 'stattrak';
  if (inputs.some((i) => !i.def.collection)) return 'collection';
  if (!tradeUpOutcomes(db, inputs).length) return 'noOutcome';
  return null;
}

/**
 * Signs a contract: one skin of the next tier. The output float is the average of the inputs' floats,
 * each normalised to its own skin's range, mapped onto the output's range (the CS2 rule since 2025).
 */
export function tradeUp(db: SkinDb, inputs: TradeUpInput[], rng: Rng): Drop | null {
  if (tradeUpProblem(db, inputs)) return null;
  const outcomes = tradeUpOutcomes(db, inputs);
  let x = rng.next();
  let def = outcomes[outcomes.length - 1].def;
  for (const o of outcomes) {
    x -= o.chance;
    if (x < 0) {
      def = o.def;
      break;
    }
  }
  let avg = 0;
  for (const i of inputs) {
    const [lo, hi] = i.def.float;
    avg += hi > lo ? (i.float - lo) / (hi - lo) : 0;
  }
  avg /= inputs.length;
  const [lo, hi] = def.float;
  return makeDrop(def, lo + (hi - lo) * avg, rng, inputs[0].stattrak);
}

/** Bottles the recyklomat pays for a skin. */
export function sellPrice(def: SkinDef, float: number, stattrak: boolean): number {
  const base = SHOP.sell[def.rarity] * SHOP.wearMul[wearIndex(float)] * (stattrak ? SHOP.stattrakMul : 1);
  return Math.max(1, Math.round(base));
}

export const casePrice = (): number => SHOP.casePrice + SHOP.keyPrice;
