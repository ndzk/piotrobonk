// Where a simulated run spends its time: plays one run on the main thread under the profiler.
// Usage: node --cpu-prof --cpu-prof-dir=.sim/prof scripts/sim/profile.ts [station] [kurs] [bot] [seed]
import { pathToFileURL } from 'node:url';
import { buildWorker } from './pool.ts';
import type { Job, RunResult } from './types.ts';

const [station = 'widzew', difficulty = 'normalnie', skill = 'good', seed = '656369120'] = process.argv.slice(2);
const file = await buildWorker();
const mod = (await import(pathToFileURL(file).href)) as { run: (job: Job) => RunResult };
const t0 = performance.now();
const r = mod.run({ id: 0, station, difficulty: difficulty as Job['difficulty'], skill: skill as Job['skill'], seed: Number(seed), cap: 1500 });
console.log(`${r.outcome} po ${String(r.time)} s gry w ${((performance.now() - t0) / 1000).toFixed(1)} s`);
