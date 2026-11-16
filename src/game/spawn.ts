// Which enemy a wave spawns. Pure, so the distribution can be unit tested: a dangling `else` here once made
// every wave a flock of pigeons for a whole run.

import { ENEMIES, type EnemyDef } from '../content/enemies';
import type { Rng } from '../core/rng';
import { TUNING } from '../content/tuning';

export interface SpawnPick {
  def: EnemyDef;
  index: number;
  /** Share of spawns (the type's weight, changed by a ladder modifier). */
  weight: number;
}

/** Types that take part in normal waves at `time` seconds into the run (`any`: ignore the unlock times). */
export function spawnOptions(time: number, any: boolean, out: SpawnPick[] = [], rushHour = false): SpawnPick[] {
  out.length = 0;
  for (let i = 0; i < ENEMIES.length; i++) {
    const def = ENEMIES[i];
    if (def.behavior === 'charger' || def.behavior === 'night' || def.weight <= 0) continue;
    if (!any && time < def.from) continue;
    out.push({ def, index: i, weight: def.weight * (rushHour && def.behavior === 'sprinter' ? TUNING.ladder.rushHour : 1) });
  }
  return out;
}

/** Health an enemy needs to be worth making an elite of (fodder is not). */
export const ELITE_MIN_HP = 20;

/**
 * A weighted roll among the unlocked types. An elite is a roll among the sturdier ones (its affixes make it
 * dangerous, so it no longer has to be the toughest); with none unlocked yet, the toughest there is.
 */
export function pickSpawn(options: readonly SpawnPick[], elite: boolean, rng: Rng): SpawnPick {
  let pick = options[0];
  if (elite) {
    let total = 0;
    for (const o of options) if (o.def.hp >= ELITE_MIN_HP) total += o.weight;
    if (total <= 0) {
      for (const o of options) if (o.def.hp > pick.def.hp) pick = o;
      return pick;
    }
    let roll = rng.next() * total;
    for (const o of options) {
      if (o.def.hp < ELITE_MIN_HP) continue;
      roll -= o.weight;
      if (roll < 0) return o;
    }
    return pick;
  }
  let total = 0;
  for (const o of options) total += o.weight;
  let roll = rng.next() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll < 0) return o;
  }
  return pick;
}
