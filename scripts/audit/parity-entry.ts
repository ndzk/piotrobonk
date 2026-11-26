// Audit (bundled by scripts/audit/parity.ts): records a run in the simulation the way the browser records one,
// but driven by a planning bot (only the live frames are recorded, never the rollouts) or by the plain bot.
// The recording is then played back by scripts/sim/replay.ts in a fresh worker: if the rollouts (or an earlier
// job in the same Game) left any trace in the live state, the playback differs.
import { attachPlanner, game, input, tick } from '../sim/worker';
import { clearTimers } from '../sim/shim';
import { hashSeed } from '../../src/core/rng';
import { FRAME, Recorder, type Replay } from '../../src/game/replay';
import type { Input } from '../../src/game/input';
import { noGear } from '../../src/game/gear';
import type { PlannerKind } from '../../src/game/bots/planner';
import { attachBot } from '../../src/game/bot';

const DT = 1 / 60;

export function record(daySeed: number, station: string, kind: string, plan: string, cap: number): { replay: Replay | null; info: string; trace: string[] } {
  clearTimers();
  input.flush();
  const seed = hashSeed(`${String(daySeed)}:${station}`);
  const build = { weapons: plan.split('/')[0].split('+'), passives: (plan.split('/')[1] ?? '').split('+').filter(Boolean) };
  // 'good': the plain bot (no rollouts), the control for the method itself.
  const planner = kind === 'good' ? null : attachPlanner(input, game, seed, kind as PlannerKind, build);
  if (!planner) attachBot(input, game, seed, 'good', {});
  game.god = false;
  game.gear = { ...noGear(), gun: null };
  const rec = new Recorder(game, 'audit', 60, Number(process.env.AUDIT_DUMP ?? -1));
  game.start(seed, station, 'normalnie', null, 0, null);
  let frames = 0;
  let outcome = 'timeout';
  const trace: string[] = [];
  let lastStep = -1;
  while (game.time < cap && frames < cap * 180) {
    tick(DT * 1000);
    const a = game.onInput;
    const b = game.onStep;
    const c = game.onOutside;
    game.onInput = game.onStep = game.onOutside = null;
    planner?.beforeFrame();
    game.onInput = a;
    game.onStep = b;
    game.onOutside = c;
    game.frame(DT);
    frames++;
    if (game.steps !== lastStep && game.steps % 60 === 0) {
      lastStep = game.steps;
      trace.push(obs());
    }
    const s = game.state;
    if (s === 'dying' || s === 'dead') {
      outcome = 'dead';
      break;
    }
    if (s === 'cleared' || s === 'call' || s === 'finale' || game.knockedOut) {
      outcome = 'won';
      break;
    }
  }
  const info = `${station} ${kind}: ${outcome} at ${game.time.toFixed(1)} s (boss from ${game.log.bossFrom.toFixed(0)} s), ${String(frames)} frames, ${String(planner?.rollouts ?? 0)} rollouts`;
  const replay = rec.stop();
  input.override = null;
  return { replay, info, trace };
}

/** What the run looks like in play (no stale memory, no animation): one line per 60 steps. */
function obs(): string {
  const p = game.player;
  return `${String(game.steps)} ${game.state} t ${game.time.toFixed(4)} p ${p.pos.x.toFixed(4)},${p.pos.y.toFixed(4)},${p.pos.z.toFixed(4)} hp ${p.hp.toFixed(4)} n ${String(game.enemies.count)} k ${String(game.enemies.kills)} lv ${String(game.level)} xp ${game.xp.toFixed(3)} dealt ${game.log.damageDealt.toFixed(3)}`;
}

/** Plays a recording back on this Game (like playBack, without its checks) and traces it the same way. */
export function replayTrace(rep: Replay): string[] {
  clearTimers();
  input.flush();
  game.gear = { gun: rep.gear.gun, knife: rep.gear.knife, gloves: rep.gear.gloves, wraps: new Map(rep.gear.wraps) };
  [game.cam.sensitivity, game.cam.invertY] = rep.look;
  let f = 0;
  (input as Input).override = (inp) => {
    const a = rep.frames;
    const o = f * FRAME;
    inp.replayFrame(a[o + 1], a[o + 2], a[o + 3], a[o + 4], a[o + 5], a[o + 6], a[o + 7], a[o + 8]);
    game.cam.yaw = a[o + 9];
    game.cam.pitch = a[o + 10];
  };
  game.god = false;
  game.start(rep.seed, rep.station, rep.difficulty, rep.daily, rep.rung, rep.extra);
  (game as unknown as { bossAt: number }).bossAt = rep.bossAt;
  const outside = new Set(rep.outside);
  const n = rep.frames.length / FRAME;
  const trace: string[] = [];
  let lastStep = -1;
  for (f = 0; f < n; f++) {
    if (outside.has(f)) game.pause();
    const dt = rep.frames[f * FRAME];
    tick(dt * 1000);
    game.frame(dt);
    if (game.steps !== lastStep && game.steps % 60 === 0) {
      lastStep = game.steps;
      trace.push(obs());
    }
  }
  input.override = null;
  return trace;
}

/** The e2e replay test's boss case as the simulation plays it: the browser's bot (skill 'medium', seed as given,
 * no hashing), the boss brought in at `bossAt`, played to `until`; how far the fight got. */
export function bossProbe(seed: number, station: string, bossAt: number, until: number): string {
  clearTimers();
  input.flush();
  attachBot(input, game, seed);
  game.god = false;
  game.gear = { ...noGear(), gun: null };
  game.start(seed, station, 'normalnie', null, 0, null);
  (game as unknown as { bossAt: number }).bossAt = bossAt;
  let maxPhase = 0;
  while (game.time < until && game.state !== 'dead' && game.state !== 'dying' && game.state !== 'cleared') {
    tick(DT * 1000);
    game.frame(DT);
    const b = (game as unknown as { boss: { phaseNumber: number } | null }).boss;
    if (b) maxPhase = Math.max(maxPhase, b.phaseNumber);
  }
  const b = (game as unknown as { boss: { phaseNumber: number; health: number } | null }).boss;
  input.override = null;
  return `${station} seed ${String(seed)} boss at ${String(bossAt)} s: state ${game.state} at ${game.time.toFixed(1)} s, boss ${b ? `health ${(b.health * 100).toFixed(1)}%, highest phase ${String(maxPhase + 1)}` : 'none'}`;
}

/** What rung and modifiers a run really gets for a kurs and a requested rung (the sweep's --kurs with --drabinka). */
export function rungProbe(difficulty: 'spokojny' | 'normalnie' | 'opoznienie', rung: number): string {
  clearTimers();
  input.flush();
  input.override = null;
  game.start(1, 'fabryczna', difficulty, null, rung, null);
  const g = game as unknown as { rung: number; mods: Set<string>; kurs: { bossHp: number; extraPhase: boolean } };
  return `${difficulty} + drabinka ${String(rung)} -> game.rung ${String(g.rung)}, modyfikatory ${String(g.mods.size)} [${[...g.mods].join(',')}], bossHp ×${String(g.kurs.bossHp)}, extraPhase ${String(g.kurs.extraPhase)}`;
}
