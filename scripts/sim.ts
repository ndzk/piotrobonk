// Headless balance simulation: the real game code (bundled for Node, nothing drawn) played by the bot at four
// skill levels, on the daily seeds, for every station and kurs. Prints a Markdown report and keeps the raw
// runs in .sim/. See BALANCE.md for what the numbers mean and what they have to be.
// Usage: node scripts/sim.ts [--runs=100] [--kurs=spokojny,normalnie,opoznienie] [--stacja=fabryczna,...]
//   [--bot=afk,weak,medium,good] [--drabinka=0,5,10] [--watki=7] [--od=2026-01-01] [--nazwa=wyniki]
//   [--modyfikatory=kanar,tlok,...] (each ladder modifier alone on the chosen kurs: what one rung costs)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashSeed } from '../src/core/rng.ts';
import { buildWorker, runPool, SIM_DIR } from './sim/pool.ts';
import { report, SKILLS, STATIONS } from './sim/report.ts';
import type { Job, RunResult } from './sim/types.ts';
import type { ModifierId } from '../src/content/difficulty.ts';

const arg = (name: string): string[] | null => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3).split(',') ?? null;
const runs = Number(arg('runs')?.[0] ?? 100);
const kursy = (arg('kurs') ?? ['spokojny', 'normalnie', 'opoznienie']) as Job['difficulty'][];
const stations = arg('stacja') ?? STATIONS;
const skills = (arg('bot') ?? [...SKILLS]).filter((b): b is Job['skill'] => (SKILLS as readonly string[]).includes(b));
const ladder = (arg('drabinka') ?? ['0']).map(Number);
const threads = Number(arg('watki')?.[0] ?? 7);
const from = new Date(`${arg('od')?.[0] ?? '2026-01-01'}T12:00:00Z`);
const name = arg('nazwa')?.[0] ?? 'wyniki';
/** --warianty=plik.json: { "nazwa": { "skill": "good", "tune": { ... } }, ... } played alongside (or instead of) the bots. */
const variantFile = arg('warianty')?.[0];
const variants: Record<string, { skill: Job['skill']; tune: Job['tune'] }> = variantFile ? (JSON.parse(readFileSync(variantFile, 'utf8')) as Record<string, { skill: Job['skill']; tune: Job['tune'] }>) : {};

/** The codzienny kurs seeds of consecutive days, the same list for every combination (paired comparisons). */
const seeds = Array.from({ length: runs }, (_, k) => {
  const d = new Date(from.getTime() + k * 86_400_000);
  return hashSeed(`piotrobonk:kurs:${d.toISOString().slice(0, 10)}`);
});

const jobs: Job[] = [];
for (const difficulty of kursy)
  for (const lv of ladder)
    for (const skill of skills)
      for (const station of stations)
        for (const seed of seeds) jobs.push({ id: jobs.length, seed, station, difficulty, skill, ladder: lv, cap: skill === 'afk' ? 900 : 1500 });
for (const difficulty of kursy)
  for (const lv of ladder)
    for (const [variant, v] of Object.entries(variants))
      for (const station of stations)
        for (const seed of seeds) jobs.push({ id: jobs.length, seed, station, difficulty, skill: v.skill, variant, tune: v.tune, ladder: lv, cap: 1500 });
for (const difficulty of kursy)
  for (const mod of (arg('modyfikatory') ?? []) as ModifierId[])
    for (const skill of skills)
      for (const station of stations)
        for (const seed of seeds) jobs.push({ id: jobs.length, seed, station, difficulty, skill, variant: `${skill}+${mod}`, mod, ladder: 0, cap: 1500 });

const file = await buildWorker();
const t0 = Date.now();
let last = 0;
const results = await runPool<RunResult>(file, jobs, {
  threads,
  onResult: (done, total) => {
    if (Date.now() - last > 15_000 || done === total) {
      last = Date.now();
      const s = (Date.now() - t0) / 1000;
      process.stderr.write(`${String(done)}/${String(total)} runów, ${s.toFixed(0)} s, zostało ~${((s / done) * (total - done)).toFixed(0)} s\n`);
    }
  },
});
mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, `${name}.json`), JSON.stringify(results));
const md = report(results, `Symulacja: ${String(runs)} seedów dziennych od ${from.toISOString().slice(0, 10)}`);
writeFileSync(join(SIM_DIR, `${name}.md`), md);
console.log(md);
const stuck = results.filter((r) => r.outcome === 'timeout');
if (stuck.length) console.log(`\nUtknęło ${String(stuck.length)} runów, np. ${stuck.slice(0, 5).map((r) => `${r.station}/${r.difficulty}/${r.skill}/${String(r.seed)} w stanie ${r.state} po ${String(r.time)} s`).join('; ')}`);
console.log(`\n${String(results.length)} runów w ${((Date.now() - t0) / 1000).toFixed(0)} s`);
