// Every level of every weapon on the budget bench, deviation from the curve (as gate.ts computes it), only the
// ones off by more than 15 %. Uses the bundle scripts/redteam/dps.ts built (.sim/redteam-rt.mjs).
import { join } from 'node:path';
import { WEAPONS } from '../../src/content/items.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { DpsJob, DpsResult } from '../sim/types.ts';
const jobs: DpsJob[] = [];
for (const w of WEAPONS) for (let level = 1; level <= w.levels.length + 1; level++) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: w.id, level, scene, seconds: 20 } });
const rs = await runPool<DpsResult>(join(SIM_DIR, 'redteam-rt.mjs'), jobs, { threads: 6 });
for (const w of WEAPONS)
  for (let level = 1; level <= w.levels.length + 1; level++) {
    const get = (scene: string): number => rs[jobs.findIndex((j) => j.dps.weapon === w.id && j.dps.level === level && j.dps.scene === scene)].dps;
    const target = w.evolved ? 150 : 100 * 1.125 ** (level - (w.levels.length + 1));
    const p = Math.sqrt(get('crowd') * get('single'));
    if (Math.abs(p / target - 1) > 0.15) console.log(`${w.id} ${String(level)}: power ${p.toFixed(0)} vs ${target.toFixed(0)} (${((p / target - 1) * 100).toFixed(0)}%), crowd ${get('crowd').toFixed(0)}, single ${get('single').toFixed(0)}`);
  }
process.exit(0);
