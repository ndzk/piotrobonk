// The planning bots on fixed seeds: win rate, how long they last, health at the boss, and what it cost.
// Usage: node scripts/sim/bots.ts [--boty=oracle,human,casual] [--runs=4] [--kurs=normalnie] [--stacje=fabryczna,widzew]
//        [--build=parasol+gwizdek+teczka+gnat/klapki+zdrapka+okulary] [--watki=14]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashSeed } from '../../src/core/rng.ts';
import type { BuildPlan, PlannerKind, PlannerProfile } from '../../src/game/bots/planner.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import { STATIONS } from './report.ts';
import type { Job, RunResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const kinds = (arg('boty') ?? 'oracle,human,casual').split(',') as PlannerKind[];
const runs = Number(arg('runs') ?? 4);
const kurs = (arg('kurs') ?? 'normalnie') as Job['difficulty'];
const stations = arg('stacje')?.split(',') ?? STATIONS;
const b = arg('build');
const build: BuildPlan | undefined = b ? { weapons: b.split('/')[0].split('+'), passives: (b.split('/')[1] ?? '').split('+').filter(Boolean) } : undefined;
/** The same seeds as every other measurement: codzienny kurs days from 1 January 2026. */
const seeds = Array.from({ length: runs }, (_, k) => hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10)}`));

// --warianty=file.json: { name: [kind, profile changes] } played instead of the plain kinds, on the same seeds.
const vfile = arg('warianty');
// A variant may also change TUNING for its runs: { name: [kind, profile changes, { "dotted.path": value }] }.
const variants: [string, PlannerKind, Partial<PlannerProfile>, Record<string, unknown>?][] = vfile
  ? Object.entries(JSON.parse(readFileSync(vfile, 'utf8')) as Record<string, [PlannerKind, Partial<PlannerProfile>, Record<string, unknown>?]>).map(([n, [k, t, w]]) => [n, k, t, w])
  : kinds.map((k) => [k, k, {}]);
const jobs: Job[] = [];
for (const [name, kind, ptune, tweak] of variants) for (const station of stations) for (const seed of seeds) jobs.push({ id: jobs.length, seed, station, difficulty: kurs, skill: 'good', variant: name, planner: kind, ptune, ...(tweak ? { tweak } : {}), ...(build ? { build } : {}), cap: 1500 });
const file = await buildWorker();
const t0 = Date.now();
const rs = await runPool<RunResult>(file, jobs, { threads: Number(arg('watki') ?? 14), onResult: (d, n) => process.stdout.write(`\r${String(d)}/${String(n)}`) });
const wall = (Date.now() - t0) / 1000;
mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, `${arg('plik') ?? `bots-${kurs}`}.json`), JSON.stringify(rs));
const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
};
const out = [`\n# Boty planujące (${kurs}, ${String(rs.length)} runów, ${wall.toFixed(0)} s)`, '', '| bot | stacja | wygrane | czas (mediana) | HP przy bossie | rollouty/run | s/run |', '|---|---|---:|---:|---:|---:|---:|'];
for (const [kind] of variants)
  for (const st of stations) {
    const l = rs.filter((r) => r.variant === kind && r.station === st);
    const won = l.filter((r) => r.outcome === 'won').length;
    const hp = l.filter((r) => r.bossHp >= 0).map((r) => r.bossHp);
    out.push(`| ${kind} | ${st} | ${String(won)}/${String(l.length)} | ${med(l.map((r) => r.time)).toFixed(0)} s | ${hp.length ? `${(med(hp) * 100).toFixed(0)}%` : '–'} | ${med(l.map((r) => r.rollouts)).toFixed(0)} | ${(med(l.map((r) => r.ms)) / 1000).toFixed(1)} |`);
  }
console.log(out.join('\n'));
