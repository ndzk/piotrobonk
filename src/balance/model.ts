// The difficulty as arithmetic (BALANCE.md, "Model"): minute by minute, how much enemy health arrives against
// what a build deals, what the enemies can hit for against what heals, and how long a boss lasts against a
// build's single-target damage. Pure functions of the game's own data, so the simulation's measurements can be
// held against them (scripts/sim/model.ts prints both side by side).

import { BOSSES, bossOf } from '../content/bosses';
import { ENEMIES } from '../content/enemies';
import { TUNING } from '../content/tuning';

export type Kurs = keyof typeof TUNING.difficulty;

/** Spawn groups per second at second `t` (TUNING.waves.rate, linear between its keys). */
export function groupRate(t: number): number {
  const keys = TUNING.waves.rate;
  for (let k = 0; k < keys.length - 1; k++) {
    const [ta, ra] = keys[k];
    const [tb, rb] = keys[k + 1];
    if (t >= ta && t < tb) return ra + ((rb - ra) * (t - ta)) / (tb - ta);
  }
  return keys[keys.length - 1][1];
}

/** What a spawned group holds on average at second `t`: enemies per group, and each one's health and touch. */
export function meanGroup(t: number): { count: number; hp: number; damage: number } {
  let w = 0;
  let n = 0;
  let hp = 0;
  let dmg = 0;
  for (const e of ENEMIES) {
    if (e.weight <= 0 || e.from > t) continue;
    w += e.weight;
    n += e.weight * e.group;
    hp += e.weight * e.group * e.hp;
    dmg += e.weight * e.group * e.damage;
  }
  return w > 0 ? { count: n / w, hp: hp / n, damage: dmg / n } : { count: 0, hp: 0, damage: 0 };
}

/** Enemy health multiplier at second `t` (Game.hpMul without the ladder). */
export const hpMul = (t: number, kurs: Kurs): number => (1 + (t / 60) * TUNING.waves.hpPerMinute) * TUNING.difficulty[kurs].hp;

/** Enemy damage multiplier at second `t` (Game.dmgMul without the ladder). */
export const dmgMul = (t: number, kurs: Kurs): number => (1 + (t / 60) * TUNING.combat.enemyDamagePerMinute) * TUNING.difficulty[kurs].damage;

/** Enemy health arriving in minute `m` (0-based) from the spawner alone (the director averages out to 1). */
export function spawnedHp(m: number, kurs: Kurs): number {
  let sum = 0;
  for (let s = 0; s < 60; s++) {
    const t = m * 60 + s + 0.5;
    const g = meanGroup(t);
    sum += groupRate(t) * g.count * g.hp * hpMul(t, kurs) * TUNING.difficulty[kurs].waves;
  }
  return sum;
}

/** What one touch from an average enemy costs Piotrek at second `t`, before armour. */
export const touch = (t: number, kurs: Kurs): number => meanGroup(t).damage * dmgMul(t, kurs);

/** Touches from the average enemy that kill Piotrek from full health at second `t` (BALANCE.md: 4-5 at the start). */
export const touchesToDie = (t: number, kurs: Kurs): number => TUNING.player.maxHp / Math.max(1e-6, touch(t, kurs));

/** A boss's health on a kurs (the extra phase does not add health; it is a share of the same bar). */
export function bossHp(station: string, kurs: Kurs): number {
  const b = bossOf(station);
  return b ? b.hp * TUNING.difficulty[kurs].bossHp : 0;
}

/**
 * Seconds a boss lasts against `dps` of single-target damage that lands: its health, plus the phase changes the
 * build cannot shorten (TUNING.boss.transition each).
 */
export function bossTtk(station: string, kurs: Kurs, dps: number): number {
  const b = bossOf(station);
  if (!b || dps <= 0) return Infinity;
  const phases = b.phases.length + (TUNING.difficulty[kurs].extraPhase ? 1 : 0);
  return bossHp(station, kurs) / dps + (phases - 1) * TUNING.boss.transition;
}

/** The boss health that makes a fight last `ttk` seconds against `dps` (what boss health is set from). */
export function bossHpFor(station: string, kurs: Kurs, ttk: number, dps: number): number {
  const b = bossOf(station);
  if (!b) return 0;
  const phases = b.phases.length + (TUNING.difficulty[kurs].extraPhase ? 1 : 0);
  return Math.max(0, ttk - (phases - 1) * TUNING.boss.transition) * dps;
}

/** Every boss, for tables. */
export const bossStations = (): string[] => BOSSES.map((b) => b.station);
