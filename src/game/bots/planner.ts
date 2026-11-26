// The planning bots of the balance measurements (scripts/sim): they play by trying moves out on copies of the
// run (snapshots, src/game/replay.ts) and keeping the one that turned out best.
// - `oracle`: sees everything, reacts at once, tries a dozen directions plus bunny hops and slides a second
//   and a half ahead, and plays a given build (the optimizer's best). The ceiling: if it cannot win, nobody can.
// - `human`: the same planner with a person's limits: a quarter-second reaction (it plans on what it saw a
//   moment ago), only what is on screen (plus what the edge markers point at), half a second ahead, a shaky
//   aim and a wrong move or card now and then. It kites, hops and slides, and knows the strong builds.
// - `casual`: slower, shorter-sighted, sloppier, takes cards at random and never bunny hops.
// None of them is ever weakened to hit a target: the game is tuned to them, not the other way round.
// They drive the game from outside its frame (`beforeFrame`, called by the simulation's loop before every
// `game.frame`), so they exist in the headless simulation only.

import { PASSIVES, WEAPONS } from '../../content/items';
import { TUNING } from '../../content/tuning';
import { Rng } from '../../core/rng';
import type { Game } from '../game';
import type { Input } from '../input';
import { MARK } from '../hazards';
import { Kind } from '../pickups';
import type { Card } from '../progress';
import { restore, snapshot, type Snapshot } from '../replay';

export type PlannerKind = 'oracle' | 'human' | 'casual';

/** What to build: weapons and passives in the order they are wanted. */
export interface BuildPlan {
  weapons: string[];
  passives: string[];
}

export interface PlannerProfile {
  /**
   * Seconds between decisions: how often it corrects its course (a person steers all the time; the reaction time
   * is the delay, `react`, not this).
   */
  every: [number, number];
  /** Seconds between seeing and acting: decisions are planned on the run as it was this long ago. */
  react: [number, number];
  /** Seconds a candidate move is tried out for. */
  horizon: number;
  /** Directions tried (plus standing). */
  dirs: number;
  /** Also tries bunny hops and slides in the best few directions (or slides only). */
  moves: boolean | 'slide';
  /** Radians of error on the direction it runs in. */
  aim: number;
  /** Chance a decision takes the second best move. */
  blunder: number;
  /** Knows everything, or only what is on screen and what the edge markers show. */
  vision: 'all' | 'screen';
  /** Cards for its build plan, or at random. */
  cards: 'plan' | 'random';
  /** Chance a card is picked at random anyway. */
  cardBlunder: number;
  /** Seconds it looks at the cards. */
  think: number;
  /** Share of the slap bar's window it hits. */
  qte: number;
  /** Seconds a candidate is held in a rollout; after that it runs from the crowd (0: held to the end). */
  commit: number;
  /** Checks its own predictions against the live run (counts in `checks` and `misses`). */
  verify?: boolean;
  /** Plans lighter when nothing is within reach (see `decide`). */
  calm?: boolean;
  /** What a rollout's outcome is worth: per HP lost, per XP, per damage dealt, per unit of threat at the end, per metre towards the errand, at the edge. */
  w: { hp: number; xp: number; dealt: number; threat: number; goal: number; edge: number; walls: number; boss: number };
}

const W = { hp: 3, xp: 0.6, dealt: 0.004, threat: 2, goal: 1, edge: 40, walls: 1.5, boss: 3000 };
/** The four directions it looks for walls in, round where a rollout ends. */
const PROBE_X = [1, -1, 0, 0];
const PROBE_Z = [0, 0, 1, -1];

export const PLANNERS: Record<PlannerKind, PlannerProfile> = {
  oracle: { every: [0.2, 0.2], react: [0, 0], horizon: 1.5, dirs: 12, moves: true, aim: 0, blunder: 0, vision: 'all', cards: 'plan', cardBlunder: 0, think: 0.1, qte: 0.3, commit: 0, w: W, calm: true },
  human: { every: [0.12, 0.18], react: [0.22, 0.28], horizon: 0.5, dirs: 12, moves: true, aim: 0.12, blunder: 0.05, vision: 'screen', cards: 'plan', cardBlunder: 0.05, think: 0.6, qte: 0.5, commit: 0, w: W },
  // A casual player is the human with half a reaction time more, twice the shaky aim and the slips, a shorter
  // look ahead, no bunny hops (slides still: anyone presses that key), and cards picked at random.
  casual: { every: [0.2, 0.28], react: [0.33, 0.42], horizon: 0.4, dirs: 12, moves: 'slide', aim: 0.24, blunder: 0.1, vision: 'screen', cards: 'random', cardBlunder: 1, think: 1, qte: 0.8, commit: 0, w: W },
};

/** A build that is good without the optimizer (the boss bench's fastest pair of evolutions). */
export const DEFAULT_BUILD: BuildPlan = { weapons: ['parasol', 'gwizdek', 'teczka', 'gnat'], passives: ['klapki', 'zdrapka', 'okulary', 'kurtka', 'energetyk', 'kanapka'] };

const DT = 1 / 60;
/** How close the bots want to be to a boss: within reach of their longest weapon (at most 10 m, at least 3 m). */
const BOSS_REACH = 10;
/** A person's sense of what is around them: in sight within NEAR metres whatever the camera does, and what was
 * seen stays known for MEMORY seconds. The screen spans about 100° across. */
const NEAR = 5;
const MEMORY = 3;
const COS_HALF_VIEW = Math.cos((50 * Math.PI) / 180);
const EVOLVES = new Map<string, string>();
for (const w of WEAPONS) if (w.evolution) EVOLVES.set(w.id, w.evolution.passive);
const BASE = new Map<string, string>();
for (const w of WEAPONS) if (w.evolution) BASE.set(w.evolution.into, w.id);

type Mode = 0 | 1 | 2; // run, bunny hop, slide

interface Candidate {
  /** World direction (sin, cos of the angle), or 0, 0 to stand. */
  x: number;
  z: number;
  mode: Mode;
  score: number;
}

export class Planner {
  private readonly prof: PlannerProfile;
  private readonly rng: Rng;
  private readonly build: BuildPlan;
  /** What it is doing now. */
  private moveX = 0;
  private moveZ = 0;
  private mode: Mode = 0;
  private modeLeft = 0;
  /** The move being tried in a rollout (the override plays it instead of the chosen one). */
  private trying: Candidate | null = null;
  private decideIn = 0;
  private cardDelay = 0;
  /**
   * Decisions waiting out the reaction time, oldest first: each becomes what it does at its step (`at`, in
   * Game.steps). A decision made before the last one took effect does not cancel it: both happen, in turn.
   */
  private readonly queue: { at: number; c: Candidate }[] = [];
  private readonly cands: Candidate[] = [];
  private goalX = 0;
  private goalZ = 0;
  private goalW = 0;
  /** Where it was a moment ago (stuck detection), and until when it gives up on errands. */
  private stuckX = 0;
  private stuckZ = 0;
  private stuckT = 0;
  private noGoalUntil = 0;
  /** When each enemy (by uid) was last in sight (the human's memory of what is behind them). */
  private readonly lastSeen = new Map<number, number>();
  /** Rollouts played (cost accounting). */
  rollouts = 0;
  /** Fidelity check (oracle): the chosen move's predicted state one decision ahead against what happened. */
  checks = 0;
  misses = 0;
  private predicted: { t: number; hp: number; x: number; z: number } | null = null;
  private probeAt = -1;
  private probeSteps = 0;
  private probe: { hp: number; x: number; z: number } | null = null;

  constructor(
    private readonly game: Game,
    private readonly input: Input,
    seed: number,
    kind: PlannerKind,
    build: BuildPlan | null = null,
    tune: Partial<PlannerProfile> = {},
  ) {
    this.prof = { ...PLANNERS[kind], ...tune };
    this.rng = new Rng(seed ^ 0x51a7e);
    this.build = build ?? DEFAULT_BUILD;
    const n = this.prof.dirs;
    for (let k = 0; k < n; k++) this.cands.push({ x: Math.sin((k / n) * Math.PI * 2), z: Math.cos((k / n) * Math.PI * 2), mode: 0, score: 0 });
    this.cands.push({ x: 0, z: 0, mode: 0, score: 0 });
    input.override = (inp) => {
      this.drive(inp);
    };
  }

  /** Before every frame of the live run: plans when a decision is due. */
  beforeFrame(): void {
    const g = this.game;
    if (g.state !== 'playing') return;
    // The decision made a reaction time ago takes effect now.
    while (this.queue.length && this.queue[0].at <= g.steps) {
      const q = this.queue.shift();
      if (q) this.commit(q.c);
    }
    this.decideIn -= DT;
    if (this.decideIn > 0) return;
    const [a, b] = this.prof.every;
    const pr = this.predicted;
    if (pr && g.steps === pr.t) {
      this.checks++;
      const p = g.player;
      if (Math.abs(p.hp - pr.hp) > 1e-6 || Math.abs(p.pos.x - pr.x) > 1e-6 || Math.abs(p.pos.z - pr.z) > 1e-6) this.misses++;
    }
    this.predicted = null;
    this.decideIn = a + this.rng.next() * (b - a);
    this.decide();
  }

  // ---------- Deciding ----------

  private decide(): void {
    const g = this.game;
    const now = snapshot(g);
    const base = now;
    // Reaction time: what it decides now only starts after `lag` (meanwhile it keeps doing what it was doing,
    // and it knows that: every candidate is tried after that much of the current move).
    const [ra, rb] = this.prof.react;
    const lag = ra + this.rng.next() * (rb - ra);
    this.lead = Math.round(lag / DT);
    this.pickGoal();
    if (this.prof.vision === 'screen') this.look();
    // Nothing within reach (no body in 7 m, no warning or shot near, no boss): half the directions, a second
    // ahead, no hops or slides. Anything close and it plans in full again.
    const calm = this.prof.calm === true && this.isCalm();
    const steps = Math.max(6, Math.round((calm ? Math.min(1, this.prof.horizon) : this.prof.horizon) / DT));
    this.cands.forEach((c, k) => {
      c.mode = 0;
      c.score = calm && k % 2 === 1 && k < this.prof.dirs ? -Infinity : this.rollout(base, c, steps);
    });
    let best = this.ranked();
    // Bunny hops and slides in the best three directions.
    if (this.prof.moves && !calm) {
      const top = [...this.cands].filter((c) => c.x !== 0 || c.z !== 0).sort((p, q) => q.score - p.score).slice(0, 3);
      for (const c of top)
        for (const mode of [1, 2] as const) {
          if (mode === 1 && this.prof.moves === 'slide') continue;
          if (mode === 2 && !g.player.slideReady) continue;
          const v: Candidate = { x: c.x, z: c.z, mode, score: 0 };
          v.score = this.rollout(base, v, steps);
          if (v.score > best.score) best = v;
        }
    }
    // Fidelity check: the chosen move played once more, its state when the next decision comes kept.
    if (this.prof.verify && this.lead === 0) {
      const n = Math.round(this.decideIn / DT);
      this.probeAt = n;
      this.rollout(base, best, n + 1);
      this.probeAt = -1;
      if (this.probe) this.predicted = { t: this.probeSteps, ...this.probe };
    }
    restore(g, now);
    // Nothing pressed in a rollout may reach the live run.
    this.input.flush();
    this.input.hold('jump', false);
    // A person picks the second best now and then.
    if (this.prof.blunder > 0 && this.rng.next() < this.prof.blunder) {
      // (There are always at least two: the directions and standing still.)
      best = [...this.cands].sort((p, q) => q.score - p.score)[1];
    }
    const aim = (this.rng.next() - 0.5) * 2 * this.prof.aim;
    const ang = Math.atan2(best.x, best.z) + aim;
    const still = best.x === 0 && best.z === 0;
    const choice: Candidate = { x: still ? 0 : Math.sin(ang), z: still ? 0 : Math.cos(ang), mode: best.mode, score: best.score };
    if (this.lead > 0) this.queue.push({ at: g.steps + this.lead, c: choice });
    else this.commit(choice);
  }

  /** Steps of the current move every rollout plays before its candidate (the reaction time). */
  private lead = 0;

  /** A decision becomes what it does. */
  private commit(c: Candidate): void {
    this.moveX = c.x;
    this.moveZ = c.z;
    this.mode = c.mode;
    this.modeLeft = c.mode === 2 ? 0.05 : 0;
    if (c.mode === 2) this.input.press('slide');
  }

  /** The boss's health left, 0..1 (1 with no boss). */
  private bossHealth(): number {
    const g = this.game;
    const i = g.bossIndex;
    return i >= 0 ? g.enemies.hp[i] / g.enemies.maxHp[i] : 1;
  }

  /** Nothing dangerous within reach (see `decide`). */
  private isCalm(): boolean {
    const g = this.game;
    const p = g.player.pos;
    return g.bossIndex < 0 && g.enemies.query(p.x, p.z, 7) === 0 && !g.hazards.near(p.x, p.z, 9);
  }

  /** The best plain candidate. */
  private ranked(): Candidate {
    let best = this.cands[0];
    for (const c of this.cands) if (c.score > best.score) best = c;
    return best;
  }

  /** Plays a candidate from a snapshot for `steps` steps and scores how it went. */
  private rollout(from: Snapshot, c: Candidate, steps: number): number {
    const g = this.game;
    restore(g, from);
    if (this.prof.vision === 'screen') this.hideUnseen();
    const p = g.player;
    const hp0 = p.hp;
    const lvl0 = g.level;
    const xp0 = g.xp;
    const dealt0 = g.log.damageDealt;
    const boss0 = this.bossHealth();
    const x0 = p.pos.x;
    const z0 = p.pos.z;
    // A copy: running from the crowd after the committed part turns it, not the candidate.
    const t: Candidate = { x: c.x, z: c.z, mode: c.mode, score: 0 };
    // First the reaction time: what it is doing now, and the earlier decisions as they take effect; then the
    // candidate.
    const lead = this.lead;
    const step0 = g.steps;
    this.trying = lead > 0 ? { x: this.moveX, z: this.moveZ, mode: this.mode === 2 ? 0 : this.mode, score: 0 } : t;
    if (lead === 0 && c.mode === 2) this.input.press('slide');
    let k = 0;
    let over = false;
    this.probe = null;
    const hold = lead + (this.prof.commit > 0 ? Math.round(this.prof.commit / DT) : steps);
    steps += lead;
    for (; k < steps; k++) {
      if (k < lead) for (const q of this.queue) if (q.at === step0 + k) this.trying = { x: q.c.x, z: q.c.z, mode: q.c.mode === 2 ? 0 : q.c.mode, score: 0 };
      if (k === lead && lead > 0) {
        this.trying = t;
        if (c.mode === 2) this.input.press('slide');
      }
      if (k >= hold && (k - hold) % 10 === 0) this.flee(t);
      g.frame(DT);
      if (k + 1 === this.probeAt) {
        this.probe = { hp: p.hp, x: p.pos.x, z: p.pos.z };
        this.probeSteps = g.steps;
      }
      if (g.state !== 'playing') {
        over = true;
        break;
      }
    }
    this.trying = null;
    this.rollouts++;
    const dead = over && (g.state === 'dying' || g.state === 'dead');
    if (dead) return -1e6 + k;
    const won = over && (g.state === 'cleared' || g.state === 'call' || g.state === 'finale');
    if (won) return 1e6;
    let s = 0;
    // Health lost (and gained) is what counts most.
    const w = this.prof.w;
    s -= (hp0 - p.hp) * w.hp;
    // Experience picked up, damage dealt.
    s += ((g.level - lvl0) * 50 + (g.level === lvl0 ? g.xp - xp0 : 0)) * w.xp;
    s += (g.log.damageDealt - dealt0) * w.dealt;
    // The boss coming down is what ends the fight (a percent of its bar is worth about a touch avoided).
    s += (boss0 - this.bossHealth()) * w.boss;
    s -= this.threat() * w.threat;
    // The errand of the moment: closer to it is better.
    if (this.goalW > 0) {
      const moved = (p.pos.x - x0) * this.goalX + (p.pos.z - z0) * this.goalZ;
      s += moved * this.goalW * w.goal;
    }
    // Walls round where it ends up: one way less to run each (and the crowd piles up against them).
    let walls = 0;
    for (let q = 0; q < 4; q++) if (g.world.blocked(p.pos.x + PROBE_X[q] * 2.5, p.pos.y, p.pos.z + PROBE_Z[q] * 2.5, TUNING.player.radius)) walls++;
    s -= walls * w.walls;
    // Keeping on the way it was going (when nothing else decides, it does not dither or turn into a wall).
    s += (c.x * this.moveX + c.z * this.moveZ) * 0.2;
    // Room to run: the arena's edge and corners are where a crowd catches Piotrek.
    const r = Math.hypot(p.pos.x, p.pos.z) / g.world.limit;
    if (r > 0.75) s -= (r - 0.75) * w.edge;
    return s;
  }

  /** After a candidate's committed part: away from the bodies within 8 m (and in from the edge). */
  private flee(c: Candidate): void {
    const g = this.game;
    const e = g.enemies;
    const p = g.player.pos;
    const n = e.query(p.x, p.z, 8);
    let ax = 0;
    let az = 0;
    for (let k = 0; k < n; k++) {
      const i = e.found[k];
      const d2 = Math.max(0.25, e.foundD2[k]);
      ax -= (e.x[i] - p.x) / d2;
      az -= (e.z[i] - p.z) / d2;
    }
    const r = Math.hypot(p.x, p.z);
    const lim = g.world.limit;
    if (r > lim * 0.6) {
      ax -= (p.x / r) * (r / lim) * 0.5;
      az -= (p.z / r) * (r / lim) * 0.5;
    }
    const m = Math.hypot(ax, az);
    if (m < 1e-6) return;
    c.x = ax / m;
    c.z = az / m;
  }

  /** How much trouble Piotrek are in at the end of a rollout: bodies close by, weighed by what they hit for. */
  private threat(): number {
    const g = this.game;
    const e = g.enemies;
    const p = g.player.pos;
    const n = e.query(p.x, p.z, 10);
    let t = 0;
    // Bodies round Piotrek: what their touch would cost (Game.contact), by how likely it is to land soon (close
    // ones), and the crowd in sight that will be close in a second or two (anyone sees it on screen).
    const T = TUNING.combat.touch;
    let sectors = 0;
    for (let k = 0; k < n; k++) {
      const i = e.found[k];
      const def = e.types[e.type[i]].def;
      const touch = (T.flat + T.per * def.damage) * (e.damage[i] / Math.max(1e-6, def.damage));
      const d = Math.sqrt(e.foundD2[k]);
      const near = Math.max(0, 1 - d / 5);
      const far = 1 - d / 10;
      t += near * near * touch * 0.5 + far * far * touch * 0.05;
      // Which of eight directions the bodies within 6 m are in.
      if (d < 6) sectors |= 1 << (Math.floor(((Math.atan2(e.x[i] - p.x, e.z[i] - p.z) + Math.PI) / (Math.PI * 2)) * 8) & 7);
    }
    // Surrounded: five or more directions blocked is a trap closing.
    let blocked = 0;
    for (let s = 0; s < 8; s++) if (sectors & (1 << s)) blocked++;
    if (blocked >= 5) t += (blocked - 4) * 10;
    // Standing in a warning on the ground (a slam or blast still to come, a zone): it is drawn, anyone sees it.
    const hz = g.hazards;
    for (let m = 0; m < hz.markN; m++) {
      const o = m * MARK;
      const r = hz.mark[o + 2] + 0.5;
      if ((hz.mark[o] - p.x) ** 2 + (hz.mark[o + 1] - p.z) ** 2 >= r * r) continue;
      // The sooner it goes off, the worse (a lingering zone bites now).
      const left = hz.mark[o + 4] - hz.mark[o + 3];
      t += hz.mark[o + 5] * (left > 0 ? Math.max(0.3, 1.5 - left) : 1);
    }
    return t;
  }

  /** A person's view: enemies behind the camera and far off are not there (bosses and elites are marked). */
  /** On screen now (the camera's cone, from about 5 m behind Piotrek), or close enough to hear and feel. */
  private inSight(i: number): boolean {
    const g = this.game;
    const e = g.enemies;
    const p = g.player.pos;
    const dx = e.x[i] - p.x;
    const dz = e.z[i] - p.z;
    if (dx * dx + dz * dz < NEAR * NEAR) return true;
    // The camera looks along (-sin yaw, -cos yaw); the screen spans about 100° across.
    const fx = -Math.sin(g.cam.yaw);
    const fz = -Math.cos(g.cam.yaw);
    const cx = dx + fx * 5;
    const cz = dz + fz * 5;
    return (cx * fx + cz * fz) / Math.hypot(cx, cz) >= COS_HALF_VIEW;
  }

  /**
   * What the screen's edge markers point at (Game.threatMarkers): winding up, aiming, throwing or leaping enemies,
   * the Nocne Kanary, elites, and a bus already on its way. A person knows about those wherever they are.
   */
  private marked(i: number): boolean {
    const e = this.game.enemies;
    const b = e.types[e.type[i]].def.behavior;
    return e.elite[i] === 1 || e.windingUp(i) || e.aiming(i) || e.throwing(i) || e.charging(i) || b === 'night' || (b === 'jumper' && (e.chargeState[i] === 1 || e.chargeState[i] === 2));
  }

  /** What it has seen: every enemy in sight now is remembered (by its uid) for MEMORY seconds. */
  private look(): void {
    const g = this.game;
    const e = g.enemies;
    for (let i = 0; i < e.count; i++) if (this.inSight(i)) this.lastSeen.set(e.uid[i], g.time);
    if (this.lastSeen.size > 4000) for (const [uid, t] of this.lastSeen) if (t < g.time - MEMORY) this.lastSeen.delete(uid);
  }

  private hideUnseen(): void {
    const g = this.game;
    const e = g.enemies;
    const boss = g.bossIndex;
    for (let i = 0; i < e.count; i++) {
      if (i === boss || this.marked(i)) continue;
      // Seen a moment ago (or in sight now): a person keeps track of it.
      if (this.inSight(i) || (this.lastSeen.get(e.uid[i]) ?? -1e9) >= g.time - MEMORY) continue;
      e.x[i] += 1000;
      e.z[i] += 1000;
    }
    e.rebuildHash();
    // And they stay away: the leash would bring stragglers back round (restored with the snapshot).
    (g as unknown as { leashTimer: number }).leashTimer = 1e9;
  }

  /** The errand of the moment: food when hurt, an affordable chest, a coffee machine, experience nearby. */
  private pickGoal(): void {
    const g = this.game;
    const p = g.player.pos;
    const health = g.player.hp / g.player.maxHp;
    this.goalW = 0;
    // Stuck (meant to move, has not for a second): whatever it was after is behind something; forget it for a while.
    if (this.moveX !== 0 || this.moveZ !== 0) {
      if (Math.hypot(p.x - this.stuckX, p.z - this.stuckZ) > 1) {
        this.stuckX = p.x;
        this.stuckZ = p.z;
        this.stuckT = g.time;
      } else if (g.time - this.stuckT > 1) this.noGoalUntil = g.time + 3;
    }
    if (g.time < this.noGoalUntil) return;
    const want = (x: number, z: number, w: number): void => {
      const dx = x - p.x;
      const dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3 || w <= this.goalW) return;
      this.goalX = dx / d;
      this.goalZ = dz / d;
      this.goalW = w;
    };
    const pk = g.pickups;
    // The finale: a lemur on its way to Bartek's cup is the first thing to stop.
    const e = g.enemies;
    for (let i = 0; i < e.count; i++) {
      if (e.types[e.type[i]].def.behavior !== 'courier') continue;
      const d = Math.hypot(e.x[i] - p.x, e.z[i] - p.z);
      if (d < 40) want(e.x[i], e.z[i], 2.5 * (1 - d / 60));
    }
    // A boss out of reach: close in to weapon range (anyone playing walks up to what they have to kill; the
    // rollouts alone never see a boss 20 m off come down, and the bot used to circle there until the last train).
    const bi = g.bossIndex;
    if (bi >= 0) {
      const d = Math.hypot(e.x[bi] - p.x, e.z[bi] - p.z);
      let reach = 0;
      for (const w of g.load.weapons) reach = Math.max(reach, w.def.base.range ?? 0);
      const near = Math.max(3, Math.min(BOSS_REACH, reach - 1.5));
      if (d > near) want(e.x[bi], e.z[bi], Math.min(1.2, 0.3 + (d - near) * 0.1));
    }
    if (health < 0.7) {
      for (let i = 0; i < pk.count; i++) {
        if (pk.kindOf(i) !== Kind.Food) continue;
        const d = Math.hypot(pk.posX(i) - p.x, pk.posZ(i) - p.z);
        if (d < 30) want(pk.posX(i), pk.posZ(i), (1.5 + (0.7 - health) * 3) * (1 - d / 45));
      }
    }
    for (const c of g.interact.chests) {
      if (!c.active || c.open >= 0 || c.price > g.bottles || Math.abs(c.y - p.y) > 1.5) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < 45) want(c.x, c.z, (c.price === 0 ? 2 : 1.4) * (1 - d / 70));
    }
    if (g.bossIndex < 0 && health < 0.85) {
      for (const c of g.interact.coffees) {
        if (c.used || Math.abs(c.y - p.y) > 1.5) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 30) want(c.x, c.z, (0.6 + (0.85 - health) * 2) * (1 - d / 45));
      }
    }
    if (this.goalW < 0.4) {
      let best = -1;
      let bestD = 16;
      for (let i = 0; i < pk.count; i++) {
        if (pk.kindOf(i) === Kind.Food) continue;
        const d = Math.hypot(pk.posX(i) - p.x, pk.posZ(i) - p.z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) want(pk.posX(best), pk.posZ(best), 0.4);
    }
  }

  // ---------- Driving (every frame, live and in rollouts) ----------

  private drive(inp: Input): void {
    const g = this.game;
    const c = this.trying;
    if (c) {
      this.steer(inp, c.x, c.z, c.mode);
      return;
    }
    if (g.state === 'levelup') {
      this.cardDelay += DT;
      if (this.cardDelay > this.prof.think) {
        this.cardDelay = 0;
        this.chooseCard(inp);
      }
      return;
    }
    if (g.state === 'finale') {
      const w = g.slapWindow;
      if (w) {
        if (Math.abs(w.pos - w.centre) < w.width * this.prof.qte) inp.press('confirm');
        return;
      }
    }
    if (g.state === 'chest' || g.state === 'cleared' || g.state === 'finale' || g.state === 'credits') {
      this.cardDelay += DT;
      if (this.cardDelay > 1.2) {
        this.cardDelay = 0;
        inp.press(g.state === 'chest' ? 'interact' : 'confirm');
      }
      return;
    }
    this.cardDelay = 0;
    if (g.state !== 'playing') return;
    // Errands: open the chest it walked up to.
    const p = g.player.pos;
    for (const ch of g.interact.chests) if (ch.active && ch.open < 0 && ch.price <= g.bottles && (ch.x - p.x) ** 2 + (ch.z - p.z) ** 2 < 2.4) inp.press('interact');
    this.steer(inp, this.moveX, this.moveZ, this.mode);
  }

  /** Runs one way (world direction), hopping or sliding as asked, and turns the camera after it. */
  private steer(inp: Input, x: number, z: number, mode: Mode): void {
    const g = this.game;
    const yaw = g.cam.yaw;
    inp.moveY = x * -Math.sin(yaw) + z * -Math.cos(yaw);
    inp.moveX = x * Math.cos(yaw) + z * -Math.sin(yaw);
    const hop = mode === 1 && (x !== 0 || z !== 0);
    // Jump buffered before every landing: the bunny hop keeps the speed.
    if (hop) inp.press('jump');
    inp.hold('jump', hop);
    if (x !== 0 || z !== 0) {
      let d = Math.atan2(-x, -z) - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      g.cam.yaw += d * 0.06;
    }
  }

  // ---------- Cards ----------

  private chooseCard(inp: Input): void {
    const g = this.game;
    const cards = g.offered;
    if (!cards.length) return;
    let pick = 0;
    if (this.prof.cards === 'random' || this.rng.next() < this.prof.cardBlunder) pick = Math.floor(this.rng.next() * cards.length);
    else {
      let best = -Infinity;
      cards.forEach((c, i) => {
        const v = this.cardValue(c);
        if (v > best) {
          best = v;
          pick = i;
        }
      });
      // Nothing for the plan: a reroll while there are some.
      if (best < 2 && g.cardCounters.rerolls > 0) {
        inp.press('reroll');
        return;
      }
    }
    inp.press(pick === 0 ? 'card1' : pick === 1 ? 'card2' : 'card3');
  }

  /** How much a card does for the build plan. */
  private cardValue(c: Card): number {
    const g = this.game;
    const load = g.load;
    const rarity = TUNING.cards.multiplier[c.rarity];
    if (c.kind === 'fallback') return 0.5;
    const owned = (id: string): boolean => load.weapons.some((w) => w.def.id === id || BASE.get(w.def.id) === id);
    if (c.kind === 'weapon') {
      const at = this.build.weapons.indexOf(c.id);
      if (at >= 0) return (owned(c.id) ? 6 : 10 - at) * rarity;
      // Off the plan: only while the plan's weapons are not all on offer.
      return owned(c.id) ? 1.5 * rarity : 1;
    }
    let v = 1;
    const at = this.build.passives.indexOf(c.id);
    if (at >= 0) v = 6 - at * 0.5;
    // The passive an owned weapon of the plan evolves with.
    for (const w of load.weapons) if (EVOLVES.get(w.def.id) === c.id) v = Math.max(v, 8);
    const pas = PASSIVES.find((x) => x.id === c.id);
    if (pas?.stat === 'armor' || pas?.stat === 'regen') v += (1 - g.player.hp / g.player.maxHp) * 3;
    return v * rarity;
  }
}

/** Puts a planning bot in charge of the input. */
export function attachPlanner(input: Input, game: Game, seed: number, kind: PlannerKind, build: BuildPlan | null = null, tune: Partial<PlannerProfile> = {}): Planner {
  return new Planner(game, input, seed, kind, build, tune);
}
