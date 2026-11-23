// "No weapon clears the waves alone": every weapon maxed on its own, Piotrek standing still, immortal to
// minute 8 of Normalnie (no boss), then mortal. Prints how long each lasted after minute 8; exit code 1 when
// any lasted over a minute.
// Usage: node scripts/sim/alone.ts [--runs=2] [--stacje=fabryczna,zakowice]
import { WEAPONS } from '../../src/content/items.ts';
import { hashSeed } from '../../src/core/rng.ts';
import { buildWorker, runPool } from './pool.ts';
import { STATIONS } from './report.ts';
import type { Job, RunResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const runs = Number(arg('runs') ?? 2);
const stations = arg('stacje')?.split(',') ?? STATIONS.filter((s) => s !== 'koluszki');
const jobs: Job[] = [];
for (const w of WEAPONS)
  for (const station of stations)
    for (let k = 0; k < runs; k++) jobs.push({ id: jobs.length, seed: hashSeed(`alone:${String(k)}`), station, difficulty: 'normalnie', skill: 'afk', variant: w.id, alone: w.id, cap: 480 + 300 });
const rs = await runPool<RunResult>(await buildWorker(), jobs);
let bad = 0;
const out = ['| broń | najdłużej po 8. minucie | mediana |', '|---|---:|---:|'];
for (const w of WEAPONS) {
  const t = rs.filter((r) => r.variant === w.id).map((r) => (r.outcome === 'dead' ? r.time - 480 : Infinity)).sort((a, b) => a - b);
  const worst = t[t.length - 1];
  if (worst > 60) bad++;
  out.push(`| ${w.id} | ${Number.isFinite(worst) ? `${worst.toFixed(0)} s` : 'przeżyła'} | ${t[Math.floor((t.length - 1) / 2)].toFixed(0)} s |`);
}
console.log(out.join('\n'));
console.log(bad ? `${String(bad)} weapons hold the waves off alone for over a minute` : 'every weapon alone dies within a minute');
process.exit(bad ? 1 : 0);
