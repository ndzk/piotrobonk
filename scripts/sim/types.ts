// Shapes shared by the simulation's worker, pool and report.
import type { ModifierId } from '../../src/content/difficulty';
import type { Difficulty } from '../../src/core/save';
import type { BotSkill, Profile } from '../../src/game/bot';

export interface Job {
  id: number;
  seed: number;
  station: string;
  difficulty: Difficulty;
  skill: BotSkill;
  /** Opóźnienie ladder level (0 = none). */
  ladder?: number;
  /** One ladder modifier on its own (the codzienny kurs's way), to measure what each one does. */
  mod?: ModifierId;
  /**
   * Weapon bench: this weapon alone at its top level (an evolution as it comes), Piotrek immortal, from minute 4
   * to the boss, no levels gained. Measures what the weapon does in a real crowd.
   */
  bench?: string;
  /** Game seconds after which a run counts as stuck. */
  cap: number;
  /** Seconds between trace lines (debugging the bot), 0/undefined = none. */
  trace?: number;
  /** A named variant of the bot's profile (comparing bots on the same seeds). */
  variant?: string;
  tune?: Partial<Profile>;
}

export interface RunResult {
  id: number;
  station: string;
  difficulty: Difficulty;
  skill: BotSkill;
  /** The variant's name, or the skill. */
  variant: string;
  ladder: number;
  seed: number;
  outcome: 'won' | 'dead' | 'timeout';
  state: string;
  time: number;
  level: number;
  kills: number;
  /** Health share when the boss came in (−1: never). */
  bossHp: number;
  bossFrom: number;
  bossTo: number;
  lowEpisodes: number;
  minHp: number;
  damageTaken: number;
  damageDealt: number;
  rawDealt: number;
  heal: Record<string, number>;
  /** Per 30 s bucket. */
  taken: number[];
  dealt: number[];
  spawnedHp: number[];
  healed: number[];
  firstEvolution: number;
  evolutions: number;
  elites: number;
  weapons: string[];
  weaponDamage: Record<string, number>;
  passives: string[];
  hits: { who: string; what: string; damage: number; ago: number }[];
  /** Damage taken per "who · what". */
  bySource: Record<string, number>;
  ms: number;
  trace: string[];
}
