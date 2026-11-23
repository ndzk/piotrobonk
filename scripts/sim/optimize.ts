// Build optimizer (BALANCE.md, "Buildy"): which four weapons and four passives play best, found by the Human bot
// playing them. Random plans first, then generations of the best ones crossed and mutated; every round keeps
// only the best and plays them on more seeds (successive halving). Writes .sim/optimizer.json (every plan's
// runs) and prints the ten best per station.
// Usage: node scripts/sim/optimize.ts [--start=48] [--pokolenia=2] [--dzieci=16] [--kurs=normalnie] [--bot=human] [--watki=14]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PASSIVES, WEAPONS } from '../../src/content/items.ts';
import { hashSeed, Rng } from '../../src/core/rng.ts';
import type { BuildPlan, PlannerKind } from '../../src/game/bots/planner.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import { STATIONS } from './report.ts';
import type { Job, RunResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const kurs = (arg('kurs') ?? 'normalnie') as Job['difficulty'];
const bot = (arg('bot') ?? 'human') as PlannerKind;
const threads = Number(arg('watki') ?? 14);
const rng = new Rng(hashSeed('optimizer'));
const BASE = WEAPONS.filter((w) => !w.evolved).map((w) => w.id);
const PARTNER = new Map(WEAPONS.filter((w) => w.evolution).map((w) => [w.id, w.evolution?.passive ?? '']));
const PASSIVE_IDS = PASSIVES.map((p) => p.id);
const seedOf = (k: number): number => hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10)}`);

const pick = <T>(list: readonly T[], not: readonly T[] = []): T => {
  const free = list.filter((x) => !not.includes(x));
  return free[Math.floor(rng.next() * free.length)];
};
const key = (b: BuildPlan): string => `${b.weapons.join('+')}/${b.passives.join('+')}`;

/** A random plan: four weapons, then mostly their evolution partners, then anything. */
function randomPlan(): BuildPlan {
  const weapons: string[] = [];
  while (weapons.length < 4) weapons.push(pick(BASE, weapons));
  const passives: string[] = [];
  for (const w of weapons) {
    const p = PARTNER.get(w);
    if (p && passives.length < 4 && !passives.includes(p) && rng.next() < 0.7) passives.push(p);
  }
  while (passives.length < 4) passives.push(pick(PASSIVE_IDS, passives));
  return { weapons, passives };
}

/** Weapons from one parent, passives from the other (with their partners kept where they fit), one mutation. */
function child(a: BuildPlan, b: BuildPlan): BuildPlan {
  const weapons = rng.next() < 0.5 ? [...a.weapons] : [...a.weapons.slice(0, 2), ...b.weapons.filter((w) => !a.weapons.slice(0, 2).includes(w))].slice(0, 4);
  while (weapons.length < 4) weapons.push(pick(BASE, weapons));
  let passives = rng.next() < 0.5 ? [...b.passives] : [...a.passives.slice(0, 2), ...b.passives.filter((p) => !a.passives.slice(0, 2).includes(p))].slice(0, 4);
  while (passives.length < 4) passives.push(pick(PASSIVE_IDS, passives));
  // One mutation: a weapon or a passive swapped for another.
  if (rng.next() < 0.5) weapons[Math.floor(rng.next() * 4)] = pick(BASE, weapons);
  else passives[Math.floor(rng.next() * 4)] = pick(PASSIVE_IDS, passives);
  passives = [...new Set(passives)];
  while (passives.length < 4) passives.push(pick(PASSIVE_IDS, passives));
  return { weapons, passives };
}

/** A run's score: a win is 1 plus the health it had at the end; a loss is how far it got (to the boss and into it). */
function score(r: RunResult): number {
  if (r.outcome === 'won') return 1 + Math.max(0, r.minHp) * 0.1;
  const toBoss = r.bossFrom > 0 ? 0.6 + 0.35 * (1 - Math.max(0, r.bossHp)) : 0.6 * Math.min(1, r.time / 360);
  return Math.min(0.99, toBoss);
}

const file = await buildWorker();
const runs = new Map<string, RunResult[]>();
const plans = new Map<string, BuildPlan>();
async function play(list: BuildPlan[], stations: readonly string[], seeds: number[]): Promise<void> {
  const jobs: Job[] = [];
  for (const b of list) {
    plans.set(key(b), b);
    for (const station of stations) for (const k of seeds) jobs.push({ id: jobs.length, seed: seedOf(k), station, difficulty: kurs, skill: 'good', variant: key(b), planner: bot, build: b, cap: 1500 });
  }
  const t0 = Date.now();
  const rs = await runPool<RunResult>(file, jobs, { threads, onResult: (d, n) => process.stdout.write(`\r${String(d)}/${String(n)}`) });
  console.log(` (${String(Math.round((Date.now() - t0) / 1000))} s)`);
  for (const r of rs) runs.set(r.variant, [...(runs.get(r.variant) ?? []), r]);
}
const mean = (b: BuildPlan): number => {
  const l = runs.get(key(b)) ?? [];
  return l.length ? l.reduce((s, r) => s + score(r), 0) / l.length : 0;
};
const best = (list: BuildPlan[], n: number): BuildPlan[] => [...list].sort((x, y) => mean(y) - mean(x)).slice(0, n);

// Round 1: random plans, three stations, one seed.
const start = Number(arg('start') ?? 48);
let pool: BuildPlan[] = [];
const seen = new Set<string>();
while (pool.length < start) {
  const p = randomPlan();
  if (seen.has(key(p))) continue;
  seen.add(key(p));
  pool.push(p);
}
console.log(`round 1: ${String(pool.length)} random plans`);
await play(pool, ['fabryczna', 'andrzejow', 'zakowice'], [0]);
// Round 2: the best third, every station, two more seeds.
pool = best(pool, Math.ceil(pool.length / 3));
console.log(`round 2: ${String(pool.length)} plans on every station`);
await play(pool, STATIONS, [1, 2]);
// Generations: children of the best, played like round 2; the best of everyone carry on.
for (let g = 0; g < Number(arg('pokolenia') ?? 2); g++) {
  const parents = best(pool, 8);
  const kids: BuildPlan[] = [];
  for (let tries = 0; kids.length < Number(arg('dzieci') ?? 16) && tries < 500; tries++) {
    const c = child(pick(parents), pick(parents));
    if (seen.has(key(c))) continue;
    seen.add(key(c));
    kids.push(c);
  }
  console.log(`generation ${String(g + 1)}: ${String(kids.length)} children`);
  await play(kids, ['fabryczna', 'andrzejow', 'zakowice'], [0]);
  await play(best(kids, Math.ceil(kids.length / 2)), STATIONS, [1, 2]);
  pool = best([...pool, ...kids], 12);
}
// Final: the best twelve on four more seeds everywhere.
const final = best(pool, 12);
console.log('final: 12 plans, four more seeds');
await play(final, STATIONS, [3, 4, 5, 6]);

mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, `optimizer-${kurs}-${bot}.json`), JSON.stringify({ plans: [...plans.values()], runs: Object.fromEntries(runs) }));
const out: string[] = [`# Optymalizator (${kurs}, bot ${bot})`, ''];
for (const st of STATIONS) {
  out.push(`## ${st}`, '', '| build | wygrane | wynik |', '|---|---:|---:|');
  const rows = final
    .map((b) => {
      const l = (runs.get(key(b)) ?? []).filter((r) => r.station === st);
      return { b, won: l.filter((r) => r.outcome === 'won').length, n: l.length, s: l.reduce((s, r) => s + score(r), 0) / Math.max(1, l.length) };
    })
    .sort((x, y) => y.s - x.s)
    .slice(0, 10);
  for (const r of rows) out.push(`| ${key(r.b)} | ${String(r.won)}/${String(r.n)} | ${r.s.toFixed(2)} |`);
  out.push('');
}
const overall = final.map((b) => ({ b, s: mean(b) })).sort((x, y) => y.s - x.s);
out.push('## Najlepsze ogólnie', '', ...overall.map((o) => `- ${key(o.b)}: ${o.s.toFixed(2)}`));
writeFileSync(join(SIM_DIR, `optimizer-${kurs}-${bot}.md`), out.join('\n'));
console.log(out.join('\n'));
