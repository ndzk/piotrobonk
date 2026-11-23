// Every weapon's damage per second at every level, against dummies (scripts/sim/worker.ts `dps`): a crowd
// (forty in a disc round Piotrek) and a single target. The numbers behind the weapon budgets in BALANCE.md.
// Usage: node scripts/sim/budget.ts [--bron=teczka,gnat] [--sekundy=20]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPONS } from '../../src/content/items.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import type { DpsJob, DpsResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = arg('bron')?.split(',');
const seconds = Number(arg('sekundy') ?? 20);
const list = WEAPONS.filter((w) => !only || only.includes(w.id));
const jobs: DpsJob[] = [];
for (const w of list)
  for (let level = 1; level <= w.levels.length + 1; level++)
    for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: w.id, level, scene, seconds } });
const file = await buildWorker();
const rs = await runPool<DpsResult>(file, jobs);
export interface Row {
  weapon: string;
  evolved: boolean;
  level: number;
  crowd: number;
  single: number;
}
const rows: Row[] = [];
for (const w of list)
  for (let level = 1; level <= w.levels.length + 1; level++) {
    const get = (scene: string): number => rs[jobs.findIndex((j) => j.dps.weapon === w.id && j.dps.level === level && j.dps.scene === scene)].dps;
    rows.push({ weapon: w.id, evolved: w.evolved === true, level, crowd: get('crowd'), single: get('single') });
  }
mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, 'budget.json'), JSON.stringify(rows));
const out = ['| broń | poziom | DPS w tłum | DPS w jeden cel |', '|---|---:|---:|---:|'];
for (const r of rows) out.push(`| ${r.weapon} | ${String(r.level)} | ${r.crowd.toFixed(0)} | ${r.single.toFixed(0)} |`);
console.log(out.join('\n'));
