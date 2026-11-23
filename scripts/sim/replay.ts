// Proof that the headless simulation is the game: plays replays recorded in the browser and compares the
// state at every check, and checks that snapshots restore exactly. Exit code 1 on any difference.
// Usage: node scripts/sim/replay.ts <replay.json>...     play browser replays back
//        node scripts/sim/replay.ts --snap [--runs=2]    snapshot, play on, restore, play again: same state
//        node scripts/sim/replay.ts --self [--runs=2]    record bot runs here, play them back here
import { readFileSync } from 'node:fs';
import { hashSeed } from '../../src/core/rng.ts';
import type { Replay } from '../../src/game/replay.ts';
import { buildWorker, runPool } from './pool.ts';
import { STATIONS } from './report.ts';
import type { CheckResult, RecordJob, ReplayJob, SnapJob } from './types.ts';

const args = process.argv.slice(2);
const arg = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const runs = Number(arg('runs') ?? 2);
const file = await buildWorker();
let jobs: (ReplayJob | SnapJob)[];
let label: (k: number) => string;
if (args.includes('--snap')) {
  const list: SnapJob[] = [];
  for (const station of STATIONS)
    for (let k = 0; k < runs; k++)
      list.push({ id: list.length, snapcheck: { seed: hashSeed(`snap:${String(k)}`), station, difficulty: 'normalnie', skill: 'good', at: [20, 75, 150, 240, 330, 400], frames: 180 } });
  jobs = list;
  label = (k) => `${list[k].snapcheck.station} #${String(k % runs)}`;
} else if (args.includes('--self')) {
  const rec: RecordJob[] = [];
  for (const station of STATIONS) for (let k = 0; k < runs; k++) rec.push({ id: rec.length, record: { seed: hashSeed(`self:${String(k)}`), station, difficulty: 'normalnie', skill: 'good', seconds: 600 } });
  const made = await runPool<{ id: number; replay: Replay | null }>(file, rec);
  jobs = made.flatMap((m) => (m.replay ? [{ id: m.id, replay: m.replay }] : []));
  label = (k) => `${rec[k].record.station} #${String(k % runs)} (${String(made[k].replay?.frames.length ?? 0)} numbers)`;
} else {
  const paths = args.filter((a) => !a.startsWith('--'));
  jobs = paths.map((p, id) => ({ id, replay: JSON.parse(readFileSync(p, 'utf8')) as Replay }));
  label = (k) => paths[k];
}
const rs = await runPool<CheckResult>(file, jobs);
let bad = 0;
for (const [k, r] of rs.entries()) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${label(k)}: ${String(r.checked)} checks, ${String(r.steps)} steps, ${String(r.ms)} ms${r.problem ? ` — ${r.problem}` : ''}`);
}
console.log(bad ? `${String(bad)} of ${String(rs.length)} failed` : `all ${String(rs.length)} match`);
process.exit(bad || !rs.length ? 1 : 0);
