// One simulation worker: the real Game, built once against the stubbed browser (./shim), plays runs on demand.
// Bundled by scripts/sim.ts (Vite SSR build) and started as a worker thread; jobs come in as messages.
import '../../src/core/libm';
import './shim';
import { parentPort } from 'node:worker_threads';
import type { WebGLRenderer } from 'three';
import { hashSeed } from '../../src/core/rng';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { newSave } from '../../src/core/save';
import { Game } from '../../src/game/game';
import { Input } from '../../src/game/input';
import { attachBot, botDebug } from '../../src/game/bot';
import { attachExploit } from '../../src/game/bots/exploits';
import { attachPlanner, type Planner } from '../../src/game/bots/planner';
import { PASSIVES } from '../../src/content/items';
import type { SettingsScreen } from '../../src/ui/settings';
import { clearTimers, realNow, stub, tick } from './shim';
import type { CheckResult, DpsJob, DpsResult, Job, Loadout, RecordJob, ReplayJob, RunResult, SnapJob } from './types';
import { FRAME, playBack, Recorder, restore, snapshot, stateDump, stateFields, stateHashes, type Replay } from '../../src/game/replay';
import { weaponDef, weaponMaxLevel } from '../../src/game/progress';
import { noGear } from '../../src/game/gear';

const input = new Input(stub() as unknown as HTMLElement, false);
const save = newSave();
const game = new Game(stub() as unknown as WebGLRenderer, stub() as unknown as HTMLElement, input, {
  debug: false,
  bot: true,
  headless: true,
  settings: DEFAULT_SETTINGS,
  settingsScreen: stub() as unknown as SettingsScreen,
  save,
  onSave: () => undefined,
  onQuit: () => undefined,
  onRoute: () => undefined,
  onFinish: () => ({ home: '', extras: [] }),
  onDaily: () => undefined,
});
game.setParticleDensity(0);

const DT = 1 / 60;
const trim = (a: Float32Array, n: number): number[] => Array.from(a.subarray(0, n), (v) => Math.round(v));

/** The game itself, for one-off checks on the main thread (staged encounters, timing). */
export { game, input, tick, snapshot, restore, stateHashes, attachPlanner };

/** One run (exported for profiling on the main thread: scripts/sim/profile.ts). */
export function run(job: Job): RunResult {
  clearTimers();
  input.flush();
  // The day's seed and the station together: every stop of a day plays its own cards and spawns (with the day's
  // seed alone the nine stops of a day drew the same, and four days were four samples, not 36).
  const seed = hashSeed(`${String(job.seed)}:${job.station}`);
  let planner: Planner | null = null;
  if (job.exploit) attachExploit(input, game, seed, job.exploit);
  else if (job.planner) planner = attachPlanner(input, game, seed, job.planner, job.build ?? null, job.ptune ?? {});
  else attachBot(input, game, seed, job.skill, job.tune ?? {});
  game.start(seed, job.station, job.difficulty, null, job.ladder ?? 0, job.mod ?? null);
  if (job.bossBench) {
    const g = game as unknown as { bossAt: number; refreshStats(): void; updateSlots(): void; arsenal: { reset(): void } };
    const b = job.bossBench;
    game.god = !b.mortal;
    if (b.levels) {
      game.load.weapons = b.levels.weapons.map((w) => ({ def: weaponDef(w.id), level: w.level, mults: [...w.mults], damage: 0 }));
      game.load.passives = b.levels.passives.flatMap((x) => {
        const def = PASSIVES.find((p) => p.id === x.id);
        return def ? [{ def, level: x.level, total: x.total }] : [];
      });
    } else {
      game.load.weapons = b.weapons.map((id) => {
        const def = weaponDef(id);
        const max = weaponMaxLevel(def);
        return { def, level: max, mults: new Array<number>(max - 1).fill(1), damage: 0 };
      });
      game.load.passives = b.passives.flatMap((id) => {
        const def = PASSIVES.find((p) => p.id === id);
        return def ? [{ def, level: def.maxLevel, total: def.perLevel * def.maxLevel }] : [];
      });
    }
    g.arsenal.reset();
    g.refreshStats();
    g.updateSlots();
    game.time = g.bossAt - 3;
  }
  if (job.alone) {
    const def = weaponDef(job.alone);
    const max = weaponMaxLevel(def);
    game.load.weapons = [{ def, level: max, mults: new Array<number>(max - 1).fill(1), damage: 0 }];
    const g = game as unknown as { bossAt: number; refreshStats(): void; updateSlots(): void; arsenal: { reset(): void } };
    g.arsenal.reset();
    g.refreshStats();
    g.updateSlots();
    g.bossAt = 1e9;
    // Played from the start (immortal, so the crowd at minute 8 is what it would be), mortal from minute 8.
    game.god = true;
  }
  if (job.bench) {
    const def = weaponDef(job.bench);
    const max = weaponMaxLevel(def);
    game.god = true;
    game.load.weapons = [{ def, level: max, mults: new Array<number>(max - 1).fill(1), damage: 0 }];
    game.time = 240;
    // Four times the health: no weapon one-shots the crowd, so what is measured is damage dealt, not overkill
    // and not how fast new enemies walk in.
    const g = game as unknown as { kurs: { hp: number } };
    g.kurs = { ...g.kurs, hp: 4 };
  }
  const t0 = realNow();
  let outcome: RunResult['outcome'] = 'timeout';
  let frames = 0;
  const trace: string[] = [];
  const crowd: number[] = [];
  let bossLoadout: Loadout | null = null;
  let nextTrace = 0;
  while (game.time < job.cap && frames < job.cap * 60 * 3) {
    tick(DT * 1000);
    planner?.beforeFrame();
    game.frame(DT);
    frames++;
    if (frames % 300 === 0 && game.state === 'playing') crowd.push(game.enemies.count);
    if (!bossLoadout && game.log.bossFrom >= 0)
      bossLoadout = {
        weapons: game.load.weapons.map((w) => ({ id: w.def.id, level: w.level, mults: [...w.mults] })),
        passives: game.load.passives.map((x) => ({ id: x.def.id, level: x.level, total: x.total })),
      };
    if (job.bench) {
      // No levels: the weapon is measured as it is, in a crowd three times as thick (so the best ones are not
      // capped by how many enemies there are to kill).
      game.xp = 0;
      if (frames % 20 === 0) for (let k = 0; k < 2; k++) (game as unknown as { spawnGroup(any: boolean, elite: boolean): void }).spawnGroup(false, false);
      if (game.time >= 359) break;
    }
    if (job.trace && game.time >= nextTrace) {
      nextTrace = game.time + job.trace;
      const p = game.player;
      const near = game.enemies.query(p.pos.x, p.pos.z, 2.5);
      const crowd = game.enemies.query(p.pos.x, p.pos.z, 8);
      trace.push(`${game.time.toFixed(1)} ${game.state} hp ${p.hp.toFixed(0)}/${p.maxHp.toFixed(0)} at ${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)},${p.pos.z.toFixed(1)} g ${p.onGround ? 1 : 0} v ${Math.hypot(p.vel.x, p.vel.z).toFixed(1)} mv ${input.moveX.toFixed(2)},${input.moveY.toFixed(2)} near ${String(near)} crowd ${String(crowd)} all ${String(game.enemies.count)} | dir ${String(botDebug.best)} worst ${botDebug.worst.toFixed(1)} score ${botDebug.score.toFixed(1)} goal ${botDebug.goal.toFixed(2)} n ${String(botDebug.n)}`);
    }
    const s = game.state;
    if (s === 'dying' || s === 'dead') {
      outcome = 'dead';
      break;
    }
    if (job.bossBench || job.alone) game.xp = 0;
    if (job.alone && game.time >= 480) game.god = false;
    if (s === 'cleared' || s === 'call' || s === 'finale' || game.knockedOut) {
      outcome = 'won';
      break;
    }
  }
  const log = game.log;
  const buckets = Math.min(log.dealt.length, Math.ceil(game.time / 30));
  const weapons = game.load.weapons.map((w) => w.def.id);
  const weaponDamage: Record<string, number> = {};
  for (const w of game.load.weapons) weaponDamage[w.def.id] = Math.round(w.damage);
  const hits = log.lastHits(5).map((h) => ({ who: h.source.who, what: h.source.what, damage: Math.round(h.damage * 10) / 10, ago: Math.round((game.time - h.time) * 10) / 10 }));
  return {
    id: job.id,
    station: job.station,
    difficulty: job.difficulty,
    skill: job.skill,
    variant: job.variant ?? job.skill,
    ladder: job.ladder ?? 0,
    seed: job.seed,
    outcome,
    state: game.state,
    time: Math.round(game.time * 10) / 10,
    level: game.level,
    kills: game.enemies.kills,
    bossHp: log.bossHp,
    bossFrom: log.bossFrom,
    bossTo: log.bossTo,
    lowEpisodes: log.lowEpisodes,
    minHp: log.minHp,
    damageTaken: Math.round(log.damageTaken),
    damageDealt: Math.round(log.damageDealt),
    rawDealt: Math.round(log.rawDealt),
    heal: { ...log.heal },
    taken: trim(log.taken, buckets),
    dealt: trim(log.dealt, buckets),
    spawnedHp: trim(log.spawnedHp, buckets),
    healed: trim(log.healed, buckets),
    firstEvolution: log.firstEvolution,
    evolutions: log.evolutions,
    elites: log.elites,
    weapons,
    weaponDamage,
    passives: game.load.passives.map((p) => `${p.def.id}:${String(p.level)}`),
    hits,
    bySource: Object.fromEntries([...log.bySource].map(([k, v]) => [`${k.who} · ${k.what}`, Math.round(v.damage)])),
    ms: Math.round(realNow() - t0),
    trace,
    crowd,
    rollouts: planner?.rollouts ?? 0,
    bossLoadout,
    fidelity: [planner?.checks ?? 0, planner?.misses ?? 0],
  };
}

/** Plays a recorded replay back and compares the state at every check. */
export function replay(job: ReplayJob): CheckResult {
  clearTimers();
  input.flush();
  const t0 = realNow();
  const r = playBack(game, job.replay, (dt) => {
    tick(dt * 1000);
  });
  return { id: job.id, ok: r.mismatch === null && r.checked > 0, checked: r.checked, steps: r.steps, problem: r.mismatch ? `step ${String(r.mismatch.step)}: ${r.mismatch.fields.join(', ')}${r.diff.length ? `\n${r.diff.join('\n')}` : ''}` : r.checked ? null : 'no checks', ms: Math.round(realNow() - t0) };
}

/** One weapon's damage per second against dummies (see DpsJob). */
export function dps(job: DpsJob): DpsResult {
  const c = job.dps;
  clearTimers();
  input.flush();
  input.override = null;
  const g = game as unknown as {
    bossAt: number;
    spawn(dt: number): void;
    refreshStats(): void;
    updateSlots(): void;
    arsenal: { reset(): void };
    runEvents: unknown[];
    rng: { spawn: import('../../src/core/rng').Rng };
  };
  // The CS gun Gnat fires like (the default one when none is given).
  game.gear = { ...noGear(), gun: c.gun ? { uid: 0, weapon: c.gun, name: c.gun, look: { finish: 'solid', palette: ['#888888'], float: 0, seed: 0 }, stattrak: false, rarity: 3 } : null };
  game.start(hashSeed(`dps:${c.weapon}:${String(c.level)}:${c.scene}`), 'galkowek', 'normalnie');
  // Nothing comes in but the dummies; Piotrek cannot die or level.
  g.spawn = () => undefined;
  g.runEvents.length = 0;
  g.bossAt = 1e9;
  game.god = true;
  const def = weaponDef(c.weapon);
  game.load.weapons = [{ def, level: c.level, mults: new Array<number>(c.level - 1).fill(1), damage: 0 }];
  game.load.passives = (c.passives ?? []).flatMap((p) => {
    const pd = PASSIVES.find((x) => x.id === p.id);
    return pd ? [{ def: pd, level: p.level, total: pd.perLevel * p.level }] : [];
  });
  g.arsenal.reset();
  g.refreshStats();
  g.updateSlots();
  const e = game.enemies;
  const p = game.player.pos;
  const n = c.scene === 'crowd' ? 40 : 1;
  // A plain walker on the ground (no fliers, no shooters).
  const type = Math.max(0, e.types.findIndex((t) => !t.def.flying && !t.def.shot && !t.def.explodes && !t.def.splits));
  const at: number[] = [];
  for (let k = 0; k < n; k++) {
    // A golden-angle disc: the same even spread every time.
    const r = c.scene === 'crowd' ? 1.5 + 7.5 * Math.sqrt((k + 0.5) / n) : 3.5;
    const a = c.scene === 'crowd' ? k * 2.399963229728653 : 0;
    at.push(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r);
    e.spawn(type, at[k * 2], at[k * 2 + 1], 1, 0, g.rng.spawn);
  }
  // Pinned where they stood (knockback would scatter them), harmless, and never dying.
  const pin = (): void => {
    for (let i = 0; i < e.count; i++) {
      e.x[i] = at[i * 2] ?? e.x[i];
      e.z[i] = at[i * 2 + 1] ?? e.z[i];
      e.speed[i] = 0;
      e.damage[i] = 0;
      e.maxHp[i] = 1e6;
      e.hp[i] = 1e6;
    }
  };
  pin();
  const warm = 120;
  let dealt0 = 0;
  let hits0 = 0;
  let t0 = 0;
  const frames = warm + Math.round(c.seconds * 60);
  for (let f = 0; f < frames; f++) {
    tick(DT * 1000);
    game.frame(DT);
    if (game.state === 'levelup' || game.state === 'chest') input.press('interact');
    game.xp = 0;
    pin();
    if (f === warm - 1) {
      dealt0 = game.log.damageDealt;
      hits0 = game.log.hitCount;
      t0 = game.time;
    }
  }
  // Per second of game time: a hitstop pauses the game, not the damage.
  const span = Math.max(1e-6, game.time - t0);
  return { id: job.id, dps: (game.log.damageDealt - dealt0) / span, hits: (game.log.hitCount - hits0) / span };
}

/** A bot run recorded the way the browser records one. */
export function record(job: RecordJob): { id: number; replay: Replay | null } {
  const c = job.record;
  clearTimers();
  input.flush();
  const seed = hashSeed(`${String(c.seed)}:${c.station}`);
  attachBot(input, game, seed, c.skill, {});
  const rec = new Recorder(game, 'sim');
  game.start(seed, c.station, c.difficulty);
  // To the end of the fight (won or lost), or the time asked for.
  for (let f = 0; game.time < c.seconds && f < c.seconds * 180; f++) {
    tick(DT * 1000);
    game.frame(DT);
    const s = game.state;
    if (s === 'dead' || s === 'cleared' || s === 'call' || s === 'finale') break;
  }
  input.override = null;
  return { id: job.id, replay: rec.stop() };
}

/** Snapshots taken, played on, restored and played again with the same input: the same state both times. */
export function snapcheck(job: SnapJob): CheckResult {
  const c = job.snapcheck;
  clearTimers();
  input.flush();
  const seed = hashSeed(`${String(c.seed)}:${c.station}`);
  attachBot(input, game, seed, c.skill, {});
  game.start(seed, c.station, c.difficulty);
  const t0 = realNow();
  const bot = input.override;
  let checked = 0;
  let problem: string | null = null;
  const fields = stateFields(game);
  const names = [...fields, 'camera'];
  const differ = (a: number[], b: number[]): string => names.filter((_, k) => a[k] !== b[k]).join(', ');
  for (const at of c.at) {
    while (game.time < at && game.state !== 'dead' && game.state !== 'dying') {
      tick(DT * 1000);
      game.frame(DT);
    }
    if (game.state === 'dead' || game.state === 'dying') break;
    const snap = snapshot(game);
    const before = stateHashes(game, fields);
    // First pass: the bot plays, every frame's input is kept.
    const frames: number[] = [];
    game.onInput = (dt) => {
      frames.push(dt, input.moveX, input.moveY, input.bits(0), input.bits(1), input.lookX, input.lookY, input.padLookX, input.padLookY, game.cam.yaw, game.cam.pitch);
    };
    for (let f = 0; f < c.frames; f++) {
      tick(DT * 1000);
      game.frame(DT);
    }
    game.onInput = null;
    const first = stateHashes(game, fields);
    const dumpA = process.env.SNAPDIFF ? process.env.SNAPDIFF.split(',').map((f) => stateDump(game, f)) : [];
    restore(game, snap);
    const back = stateHashes(game, fields);
    if (differ(before, back)) {
      problem = `t ${String(at)}: restore differs in ${differ(before, back)}`;
      break;
    }
    // Second pass: the same input again.
    let f = 0;
    input.override = (inp) => {
      const o = f * FRAME;
      inp.replayFrame(frames[o + 1], frames[o + 2], frames[o + 3], frames[o + 4], frames[o + 5], frames[o + 6], frames[o + 7], frames[o + 8]);
      game.cam.yaw = frames[o + 9];
      game.cam.pitch = frames[o + 10];
    };
    for (f = 0; f < c.frames; f++) {
      tick(DT * 1000);
      game.frame(DT);
    }
    input.override = bot;
    const second = stateHashes(game, fields);
    checked++;
    if (differ(first, second)) {
      problem = `t ${String(at)}: replayed from the snapshot, differs in ${differ(first, second)}`;
      if (process.env.SNAPDIFF) {
        const lines: string[] = [];
        process.env.SNAPDIFF.split(',').forEach((f, k) => {
          const b = stateDump(game, f);
          for (const [p, v] of dumpA[k]) if (b.get(p) !== v && lines.length < 40) lines.push(`${p}: ${v} / ${String(b.get(p))}`);
        });
        problem += `\n${lines.join('\n')}`;
      }
      break;
    }
  }
  return { id: job.id, ok: problem === null && checked > 0, checked, steps: game.steps, problem: problem ?? (checked ? null : 'nothing checked'), ms: Math.round(realNow() - t0) };
}

parentPort?.on('message', (job: Job | ReplayJob | SnapJob | RecordJob | DpsJob) => {
  if ('dps' in job) parentPort?.postMessage(dps(job));
  else if ('record' in job) parentPort?.postMessage(record(job));
  else if ('replay' in job) parentPort?.postMessage(replay(job));
  else if ('snapcheck' in job) parentPort?.postMessage(snapcheck(job));
  else parentPort?.postMessage(run(job));
});
