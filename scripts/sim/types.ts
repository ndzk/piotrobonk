// Shapes shared by the simulation's worker, pool and report.
import type { ModifierId } from '../../src/content/difficulty';
import type { Difficulty } from '../../src/core/save';
import type { BotSkill, Profile } from '../../src/game/bot';
import type { ExploitKind } from '../../src/game/bots/exploits';

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
  /** An exploit bot instead of the skilled one (the skill is then only a label). */
  exploit?: ExploitKind;
  /**
   * Boss bench: this build from just before the boss, the bot playing: measures how fast the build kills the
   * boss. Weapon ids (evolutions as they are) and passive ids, at their top levels unless `levels` gives them
   * (a loadout as a run had it when its boss came: `Loadout`). Piotrek immortal unless `mortal`.
   */
  bossBench?: { weapons: string[]; passives: string[]; levels?: Loadout; mortal?: boolean };
  /**
   * One weapon alone, maxed (an evolution as it comes), Piotrek standing still and gaining nothing, no boss:
   * immortal to minute 8, then mortal. No weapon may hold the waves off on its own (dead within a minute).
   */
  alone?: string;
  /** A planning bot instead of the heuristic one (src/game/bots/planner.ts), with its build plan. */
  planner?: import('../../src/game/bots/planner').PlannerKind;
  build?: import('../../src/game/bots/planner').BuildPlan;
  /** TUNING values changed for this run only, by dotted path ("difficulty.normalnie.waves"): tuning sweeps. */
  tweak?: Record<string, unknown>;
  /** Changes to the planner's profile (comparing variants on the same seeds). */
  ptune?: Partial<import('../../src/game/bots/planner').PlannerProfile>;
}

/** What Piotrek carried: weapons with their levels and card rarities, passives with their levels. */
export interface Loadout {
  weapons: { id: string; level: number; mults: number[] }[];
  passives: { id: string; level: number; total: number }[];
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
  /** Living enemies every 5 s of play (against TUNING.waves.maxEnemies). */
  crowd: number[];
  /** Share of play with an enemy within 5 m (BALANCE.md, tension). */
  nearShare: number;
  /** Time near the boss by distance, 1 m bins (the last: 19 m and more), sampled four times a second. */
  bossDist: number[];
  /** What Piotrek carried when the boss came (null: it never came). */
  bossLoadout: Loadout | null;
  /** Rollouts a planning bot played, and its prediction checks (checked, missed). */
  rollouts: number;
  fidelity: [number, number];
}

/** A bot run recorded as a replay in the simulation itself (the replay machinery checked without a browser). */
export interface RecordJob {
  id: number;
  record: { seed: number; station: string; difficulty: Difficulty; skill: BotSkill; seconds: number };
}

/**
 * Weapon DPS bench (scripts/sim/budget.ts): one weapon at one level, Piotrek standing still and immortal,
 * no spawns, against dummies that neither move nor die. `crowd`: forty in a disc 1,5-9 m round Piotrek;
 * `single`: one, 3,5 m ahead. Damage dealt per second, measured after a 2-second warm-up.
 */
export interface DpsJob {
  id: number;
  dps: { weapon: string; level: number; scene: 'crowd' | 'single'; seconds: number; passives?: { id: string; level: number }[]; gun?: string };
}

export interface DpsResult {
  id: number;
  dps: number;
  hits: number;
}

/** A replay to play back and check (scripts/sim/replay.ts). */
export interface ReplayJob {
  id: number;
  replay: import('../../src/game/replay').Replay;
}

/**
 * Snapshot self-check: a bot run that, at each of `at` (game seconds), takes a snapshot, plays `frames` frames,
 * goes back and plays the same input again; both endings must hash the same, and the restore must give back
 * exactly the state of the snapshot.
 */
export interface SnapJob {
  id: number;
  snapcheck: { seed: number; station: string; difficulty: Difficulty; skill: BotSkill; at: number[]; frames: number };
}

export interface CheckResult {
  id: number;
  ok: boolean;
  /** What was compared, and the first thing that differed. */
  checked: number;
  steps: number;
  problem: string | null;
  ms: number;
}
