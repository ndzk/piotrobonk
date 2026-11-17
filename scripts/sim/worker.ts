// One simulation worker: the real Game, built once against the stubbed browser (./shim), plays runs on demand.
// Bundled by scripts/sim.ts (Vite SSR build) and started as a worker thread; jobs come in as messages.
import './shim';
import { parentPort } from 'node:worker_threads';
import type { WebGLRenderer } from 'three';
import { hashSeed } from '../../src/core/rng';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { newSave } from '../../src/core/save';
import { Game } from '../../src/game/game';
import { Input } from '../../src/game/input';
import { attachBot, botDebug } from '../../src/game/bot';
import type { SettingsScreen } from '../../src/ui/settings';
import { clearTimers, realNow, stub, tick } from './shim';
import type { Job, RunResult } from './types';
import { weaponDef, weaponMaxLevel } from '../../src/game/progress';

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

/** The game itself, for one-off checks on the main thread (staged encounters). */
export { game, tick };

/** One run (exported for profiling on the main thread: scripts/sim/profile.ts). */
export function run(job: Job): RunResult {
  clearTimers();
  input.flush();
  // The day's seed and the station together: every stop of a day plays its own cards and spawns (with the day's
  // seed alone the nine stops of a day drew the same, and four days were four samples, not 36).
  const seed = hashSeed(`${String(job.seed)}:${job.station}`);
  attachBot(input, game, seed, job.skill, job.tune ?? {});
  game.start(seed, job.station, job.difficulty, null, job.ladder ?? 0, job.mod ?? null);
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
  let nextTrace = 0;
  while (game.time < job.cap && frames < job.cap * 60 * 3) {
    tick(DT * 1000);
    game.frame(DT);
    frames++;
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
  };
}

parentPort?.on('message', (job: Job) => {
  parentPort?.postMessage(run(job));
});
