// The balance gate for CI (BALANCE.md, "Bramka"): every check of the difficulty spec the simulation can run in a
// few minutes, on fixed seeds, the same every time. Any check out of its bounds fails the build, and a red
// build does not deploy. Usage: node scripts/sim/gate.ts [--watki=4] [--tylko=snap,budget,cs,alone,exploits,boss,bots]
//  - snap:     snapshots restore exactly and replay the same (what the planning bots stand on);
//  - budget:   every weapon at every level within ±15 % of the power curve; cs: every CS gun within ±15 %;
//  - alone:    every weapon maxed on its own, standing still, dead within a minute after minute 8;
//  - exploits: no-skill strategies (circling, roofs, corners, standing, bunny hopping, coffee, rails) never last
//              past 3 minutes on Normalnie or Opóźnienie 120 min;
//  - boss:     no boss dies faster than its minimum (TUNING.boss.fight) to the oracle with the strongest loadout
//              measured at that boss (scripts/sim/data/loadouts.json);
//  - bots:     the Human and Casual bots on fixed seeds land in their bands (wide: few runs).
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { WEAPON_BUDGET } from '../../src/content/budget.ts';
import { WEAPONS } from '../../src/content/items.ts';
import { TUNING } from '../../src/content/tuning.ts';
import { hashSeed } from '../../src/core/rng.ts';
import type { ExploitKind } from '../../src/game/bots/exploits.ts';
import { buildWorker, runPool } from './pool.ts';
import { STATIONS } from './report.ts';
import type { CheckResult, DpsJob, DpsResult, Job, Loadout, RunResult, SnapJob } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const threads = Number(arg('watki') ?? Math.max(1, availableParallelism() - 1));
const only = arg('tylko')?.split(',');
const want = (part: string): boolean => !only || only.includes(part);
const file = await buildWorker();
const seedOf = (k: number): number => hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 2, 2 + 7 * k)).toISOString().slice(0, 10)}`);

let failed = 0;
const report = (ok: boolean, what: string): void => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'ŹLE '} ${what}`);
};
const t0 = Date.now();

if (want('snap')) {
  const jobs: SnapJob[] = STATIONS.map((station, id) => ({ id, snapcheck: { seed: seedOf(id), station, difficulty: 'normalnie', skill: 'good', at: [30, 150, 330], frames: 120 } }));
  const rs = await runPool<CheckResult>(file, jobs, { threads });
  for (const r of rs) report(r.ok, `snapshot ${jobs[r.id].snapcheck.station}: ${String(r.checked)} checks${r.problem ? ` — ${r.problem}` : ''}`);
}

if (want('budget')) {
  // The same bench as scripts/sim/budget.ts, at every level, crowd and single target.
  const jobs: DpsJob[] = [];
  for (const w of WEAPONS)
    for (let level = 1; level <= w.levels.length + 1; level++) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: w.id, level, scene, seconds: 20 } });
  const rs = await runPool<DpsResult>(file, jobs, { threads });
  const target = (id: string, level: number): number => {
    const w = WEAPONS.find((x) => x.id === id);
    if (!w) return 0;
    const base = WEAPONS.find((b) => b.evolution?.into === w.id) ?? w;
    const util = base.perks?.some((p) => p === 'stun' || p === 'slow') ? 0.8 : 1;
    return w.evolved ? 150 * util : 100 * 1.125 ** (level - (w.levels.length + 1)) * util;
  };
  let worst = 0;
  let worstAt = '';
  for (const w of WEAPONS)
    for (let level = 1; level <= w.levels.length + 1; level++) {
      const get = (scene: string): number => rs[jobs.findIndex((j) => j.dps.weapon === w.id && j.dps.level === level && j.dps.scene === scene)].dps;
      const dev = Math.abs(Math.sqrt(get('crowd') * get('single')) / target(w.id, level) - 1);
      if (dev > worst) {
        worst = dev;
        worstAt = `${w.id} ${String(level)}`;
      }
    }
  report(worst <= 0.15, `budżet broni: największe odchylenie ${(worst * 100).toFixed(1)}% (${worstAt}), limit 15%`);
  // Every weapon has its budget row and the hard limits exist.
  report(
    WEAPONS.every((w) => (WEAPON_BUDGET[w.id]?.length ?? 0) === w.levels.length + 1),
    'każda broń ma budżet na każdy poziom',
  );
  const L = TUNING.limits;
  report(L.minCooldown >= 0.6 && L.critCap <= 0.25 && L.weapon.count <= 8 && L.weapon.reach <= 6 && L.weapon.area <= 4 && L.weapon.seconds >= 0.15, 'twarde limity: szybkość ataku ≤ +40%, kryt ≤ 25%, ≤ 8 na salwę, aura ≤ 6 m, wybuch ≤ 4 m, ≥ 0,15 s');
}

if (want('cs')) {
  const { CS_WEAPONS, DEFAULT_GUN, isGloves, isKnife } = await import('../../src/content/skins/catalog.ts');
  const guns = Object.keys(CS_WEAPONS).filter((k) => !isKnife(k) && !isGloves(k));
  const top = (WEAPONS.find((w) => w.id === 'gnat')?.levels.length ?? 7) + 1;
  const jobs: DpsJob[] = [];
  for (const gun of guns) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: 'gnat', level: top, scene, seconds: 20, gun } });
  const rs = await runPool<DpsResult>(file, jobs, { threads });
  const power = (gun: string): number => {
    const get = (scene: string): number => rs[jobs.findIndex((j) => j.dps.gun === gun && j.dps.scene === scene)].dps;
    return Math.sqrt(get('crowd') * get('single'));
  };
  const ref = power(DEFAULT_GUN);
  const devs = guns.map((g) => [g, Math.abs(power(g) / ref - 1)] as const).sort((a, b) => b[1] - a[1]);
  report(devs[0][1] <= 0.15, `bronie CS: największe odchylenie ${(devs[0][1] * 100).toFixed(1)}% (${devs[0][0]}), limit 15%`);
}

if (want('alone')) {
  const jobs: Job[] = [];
  for (const w of WEAPONS) for (const station of ['fabryczna', 'zakowice']) jobs.push({ id: jobs.length, seed: seedOf(0), station, difficulty: 'normalnie', skill: 'afk', variant: w.id, alone: w.id, cap: 480 + 300 });
  const rs = await runPool<RunResult>(file, jobs, { threads });
  const lasted = rs.map((r) => (r.outcome === 'dead' ? r.time - 480 : Infinity));
  const worst = Math.max(...lasted);
  const who = rs[lasted.indexOf(worst)];
  report(worst <= 60, `broń sama od 8. minuty: najdłużej ${Number.isFinite(worst) ? `${worst.toFixed(0)} s` : 'przeżyła'} (${who.variant} na ${who.station}), limit 60 s`);
}

if (want('exploits')) {
  const EXPLOITS: ExploitKind[] = ['stoi', 'kolko', 'dach', 'rog', 'hop', 'kawa', 'tory'];
  const jobs: Job[] = [];
  for (const kurs of ['normalnie', 'opoznienie'] as const)
    for (const kind of EXPLOITS) for (const station of STATIONS) for (let k = 0; k < 2; k++) jobs.push({ id: jobs.length, seed: seedOf(k), station, difficulty: kurs, skill: 'afk', variant: `${kurs}/${kind}`, exploit: kind, cap: 900 });
  const rs = await runPool<RunResult>(file, jobs, { threads });
  for (const kind of EXPLOITS) {
    const l = rs.filter((r) => r.variant.endsWith(`/${kind}`));
    const over = l.filter((r) => r.outcome === 'won' || r.time > 180);
    report(over.length === 0, `exploit „${kind}”: ${String(over.length)}/${String(l.length)} runów ponad 3 minuty (najdłużej ${Math.max(...l.map((r) => r.time)).toFixed(0)} s)`);
  }
}

if (want('boss')) {
  // The oracle, mortal, with the strongest loadout any bot met each boss with (scripts/sim/bossfight.ts keeps
  // them in scripts/sim/data/loadouts.json): no boss may die faster than its minimum (TUNING.boss.fight).
  const loadouts = JSON.parse(readFileSync(join(import.meta.dirname, 'data', 'loadouts.json'), 'utf8')) as Partial<Record<string, Loadout[]>>;
  const jobs: Job[] = [];
  for (const station of STATIONS) {
    const l = loadouts[station]?.[0];
    if (!l) continue;
    for (let k = 0; k < 2; k++) jobs.push({ id: jobs.length, seed: seedOf(k), station, difficulty: 'normalnie', skill: 'good', variant: station, planner: 'oracle', bossBench: { weapons: [], passives: [], levels: l, mortal: true }, cap: 1500 });
  }
  const rs = await runPool<RunResult>(file, jobs, { threads });
  for (const station of STATIONS) {
    const l = rs.filter((r) => r.station === station && r.outcome === 'won' && r.bossTo > 0).map((r) => r.bossTo - r.bossFrom);
    const min = Math.min(...l);
    const floor = TUNING.boss.fight[station][0];
    report(l.length > 0 && min >= floor, `boss ${station}: najszybciej ${Number.isFinite(min) ? `${min.toFixed(0)} s` : '—'} (minimum ${String(floor)} s, wygrane ${String(l.length)}/2)`);
  }
}

if (want('bots')) {
  // Wide bands: four seeds per station; the full measurement (hundreds of runs) is scripts/sim/bots.ts.
  const BANDS: { bot: 'human' | 'casual'; kurs: Job['difficulty']; lo: number; hi: number }[] = [
    { bot: 'human', kurs: 'normalnie', lo: 0.1, hi: 0.6 },
    { bot: 'casual', kurs: 'spokojny', lo: 0.5, hi: 1 },
    { bot: 'casual', kurs: 'normalnie', lo: 0, hi: 0.4 },
  ];
  const jobs: Job[] = [];
  for (const b of BANDS) for (const station of STATIONS) for (let k = 0; k < 4; k++) jobs.push({ id: jobs.length, seed: seedOf(k), station, difficulty: b.kurs, skill: 'good', variant: `${b.bot}/${b.kurs}`, planner: b.bot, cap: 1500 });
  const rs = await runPool<RunResult>(file, jobs, { threads });
  for (const b of BANDS) {
    const l = rs.filter((r) => r.variant === `${b.bot}/${b.kurs}`);
    const win = l.filter((r) => r.outcome === 'won').length / l.length;
    report(win >= b.lo && win <= b.hi, `${b.bot} na ${b.kurs}: ${(win * 100).toFixed(0)}% wygranych (widełki ${String(b.lo * 100)}–${String(b.hi * 100)}%)`);
  }
  const stuck = rs.filter((r) => r.outcome === 'timeout');
  report(stuck.length === 0, `runy, które utknęły: ${String(stuck.length)}`);
}

console.log(`bramka w ${((Date.now() - t0) / 1000).toFixed(0)} s: ${failed ? `${String(failed)} ŹLE` : 'wszystko OK'}`);
process.exitCode = failed ? 1 : 0;
