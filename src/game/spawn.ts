// Which enemy a wave spawns. Pure, so the distribution can be unit tested: a dangling `else` here once made
// every wave a flock of pigeons for a whole run.

import { ENEMIES, type EnemyDef } from '../content/enemies';
import type { Rng } from '../core/rng';

export interface SpawnPick {
  def: EnemyDef;
  index: number;
}

/** Types that take part in normal waves at `time` seconds into the run (`any`: ignore the unlock times). */
export function spawnOptions(time: number, any: boolean, out: SpawnPick[] = []): SpawnPick[] {
  out.length = 0;
  for (let i = 0; i < ENEMIES.length; i++) {
    const def = ENEMIES[i];
    if (def.behavior === 'charger' || def.weight <= 0) continue;
    if (!any && time < def.from) continue;
    out.push({ def, index: i });
  }
  return out;
}

/** A weighted roll among the unlocked types, or the toughest one for an elite. */
export function pickSpawn(options: readonly SpawnPick[], elite: boolean, rng: Rng): SpawnPick {
  let pick = options[0];
  if (elite) {
    for (const o of options) if (o.def.hp > pick.def.hp) pick = o;
    return pick;
  }
  let total = 0;
  for (const o of options) total += o.def.weight;
  let roll = rng.next() * total;
  for (const o of options) {
    roll -= o.def.weight;
    if (roll < 0) return o;
  }
  return pick;
}
