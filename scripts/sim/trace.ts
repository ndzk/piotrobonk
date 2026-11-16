// Plays one run with a trace of the bot (debugging): node scripts/sim/trace.ts <station> <kurs> <bot> <seed> [every=0.5]
import { buildWorker, runPool } from './pool.ts';
import type { Job, RunResult } from './types.ts';

const [station = 'fabryczna', difficulty = 'normalnie', skill = 'good', seed = '1', every = '0.5'] = process.argv.slice(2);
const file = await buildWorker();
const job: Job = { id: 0, station, difficulty: difficulty as Job['difficulty'], skill: skill as Job['skill'], seed: Number(seed), cap: 1500, trace: Number(every) };
const [r] = await runPool<RunResult>(file, [job], { threads: 1 });
console.log(r.trace.join('\n'));
console.log(r.outcome, r.time, JSON.stringify(r.hits));
