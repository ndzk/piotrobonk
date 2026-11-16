// Same seed, same game: plays a run, then others, then the first one again on the same worker, and compares.
// Usage: node scripts/sim/determinism.ts [station] [kurs] [bot] [seed]
import { buildWorker, runPool } from './pool.ts';
import type { Job, RunResult } from './types.ts';

const [station = 'andrzejow', difficulty = 'normalnie', skill = 'good', seed = '824145310'] = process.argv.slice(2);
const job = (id: number, s: number, st = station): Job => ({ id, station: st, difficulty: difficulty as Job['difficulty'], skill: skill as Job['skill'], seed: s, cap: 1500, trace: 0.1 });
const file = await buildWorker();
const rs = await runPool<RunResult>(file, [job(0, Number(seed)), job(1, 7, 'widzew'), job(2, 11), job(3, Number(seed))], { threads: 1 });
const key = (r: RunResult): string => JSON.stringify([r.outcome, r.time, r.level, r.kills, r.damageTaken, r.damageDealt, r.weapons]);
const a = rs[0].trace;
const b = rs[3].trace;
const k = a.findIndex((line, i) => line !== b[i]);
if (k >= 0) console.log(`pierwsza różnica:\n${a.slice(Math.max(0, k - 2), k + 2).join('\n')}\n---\n${b.slice(Math.max(0, k - 2), k + 2).join('\n')}`);
console.log(key(rs[0]) === key(rs[3]) ? 'deterministyczne' : 'RÓŻNE');
process.exitCode = key(rs[0]) === key(rs[3]) ? 0 : 1;
