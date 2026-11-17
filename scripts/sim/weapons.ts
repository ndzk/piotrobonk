// Weapon bench: every weapon at its top level and every evolution, alone, in a real crowd from minute 4 to the
// boss (Piotrek immortal, played by the good bot). Prints damage per second and kills per minute, side by side.
// Usage: node scripts/sim/weapons.ts [--runs=3] [--watki=7]
import { WEAPONS } from '../../src/content/items.ts';
import { hashSeed } from '../../src/core/rng.ts';
import { buildWorker, runPool } from './pool.ts';
import type { Job, RunResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const runs = Number(arg('runs') ?? 3);
const threads = Number(arg('watki') ?? 7);
const stations = ['fabryczna', 'widzew', 'zakowice'];
const seeds = Array.from({ length: runs }, (_, k) => hashSeed(`piotrobonk:bron:${String(k)}`));
const jobs: Job[] = [];
const skills: Job['skill'][] = ['good', 'afk'];
for (const skill of skills) for (const w of WEAPONS) for (const station of stations) for (const seed of seeds) jobs.push({ id: jobs.length, seed, station, difficulty: 'normalnie', skill, cap: 400, bench: w.id });
const file = await buildWorker();
const rs = await runPool<RunResult>(file, jobs, { threads });
const measure = (id: string, skill: string): { dps: number; kpm: number } => {
  const mine = rs.filter((r, k) => jobs[k].bench === id && jobs[k].skill === skill);
  const secs = mine.reduce((a, r) => a + Math.max(1, r.time - 240), 0);
  return { dps: mine.reduce((a, r) => a + r.damageDealt, 0) / secs, kpm: (mine.reduce((a, r) => a + r.kills, 0) / secs) * 60 };
};
// Moving (the good bot keeps its distance) and standing in the crowd (where auras and umbrellas shine): a
// weapon's worth is the better of the two, since a player picks the way to play it.
const rows = WEAPONS.map((w) => {
  const run = measure(w.id, 'good');
  const stand = measure(w.id, 'afk');
  return { id: w.id, evolved: w.evolved === true, dps: Math.max(run.dps, stand.dps), kpm: Math.max(run.kpm, stand.kpm), run, stand };
});
const base = rows.filter((r) => !r.evolved);
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 1;
const mBase = median(base.map((r) => r.run.dps));
const mEvo = median(rows.filter((r) => r.evolved).map((r) => r.run.dps));
// Enemies get four times their health in the bench (scripts/sim/worker.ts): damage dealt then measures the weapon,
// not overkill and not how many enemies there are to kill.
console.log('| broń | DPS w ruchu | DPS w tłumie | zabicia/min (lepsze) | względem mediany |');
console.log('|---|---:|---:|---:|---:|');
for (const r of [...rows].sort((a, b) => Number(a.evolved) - Number(b.evolved) || b.run.dps - a.run.dps)) console.log(`| ${r.evolved ? '★ ' : ''}${r.id} | ${r.run.dps.toFixed(0)} | ${r.stand.dps.toFixed(0)} | ${r.kpm.toFixed(0)} | ${((r.run.dps / (r.evolved ? mEvo : mBase)) * 100).toFixed(0)}% |`);

