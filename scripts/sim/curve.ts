// The weapons' power budgets (BALANCE.md, "Bronie"), one definition for scripts/sim/budget.ts and the CI gate
// (scripts/sim/gate.ts): the reference curve, the utility discount and each weapon's PLAY factor.
import { WEAPONS, type WeaponDef } from '../../src/content/items.ts';

/** The reference curve: power at the top level, per level step, for an evolution, for utility weapons. */
export const CURVE = { top: 100, step: 1.125, evolution: 150, utility: 0.8, tolerance: 0.15 };
/**
 * What the bench cannot see, from real runs (BALANCE.md, "Bronie"): reach decides boss fights, so the weapons that
 * hit from 11-13 m won 3× as often with them as without (18 random build plans, Human, Normalnie) and the ones that
 * reach 4 m almost never. Their budgets move by at most 15 % either way (an evolution with its weapon).
 */
export const PLAY: Partial<Record<string, number>> = { telefon: 0.85, gnat: 0.85, gwizdek: 0.85, iskra: 0.85, sos: 1.15, parasol: 1.15, kawa: 1.15, puszka: 1.15, bilet: 1.1 };
export const baseOf = (w: WeaponDef): WeaponDef => WEAPONS.find((b) => b.evolution?.into === w.id) ?? w;
export function target(w: WeaponDef, level: number): number {
  const util = baseOf(w).perks?.some((p) => p === 'stun' || p === 'slow') ? CURVE.utility : 1;
  const play = PLAY[baseOf(w).id] ?? 1;
  if (w.evolved) return CURVE.evolution * util * play;
  return CURVE.top * CURVE.step ** (level - (w.levels.length + 1)) * util * play;
}

