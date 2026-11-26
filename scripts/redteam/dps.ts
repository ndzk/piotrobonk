// Single-target vs crowd DPS of every weapon at its top level and every CS gun on Gnat, with the shipped budgets
// (the same dummy bench as scripts/sim/budget.ts, results kept in scripts/redteam/out/dps.json, never .sim/budget.json).
// The budget holds the geometric mean of the two; a boss only ever feels the single-target number.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { WEAPONS } from '../../src/content/items.ts';
import { CS_WEAPONS, DEFAULT_GUN, isGloves, isKnife } from '../../src/content/skins/catalog.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { DpsJob, DpsResult } from '../sim/types.ts';

const root = resolve(import.meta.dirname, '../..');
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
  build: { ssr: join(root, 'scripts/redteam/worker.ts'), outDir: SIM_DIR, emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: 'redteam-rt.mjs' } } },
});
const jobs: DpsJob[] = [];
for (const w of WEAPONS) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: w.id, level: w.levels.length + 1, scene, seconds: 20 } });
const guns = Object.keys(CS_WEAPONS).filter((k) => !isKnife(k) && !isGloves(k));
const gnatTop = (WEAPONS.find((w) => w.id === 'gnat')?.levels.length ?? 7) + 1;
for (const gun of guns) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: 'gnat', level: gnatTop, scene, seconds: 20, gun } });
const rs = await runPool<DpsResult>(join(SIM_DIR, 'redteam-rt.mjs'), jobs, { threads: 6 });
const get = (pred: (j: DpsJob) => boolean): number => rs[jobs.findIndex(pred)].dps;
const rows: string[] = ['| weapon | crowd | single | power (geo mean) | single / power |', '|---|---:|---:|---:|---:|'];
const out: Record<string, { crowd: number; single: number }> = {};
for (const w of WEAPONS) {
  const c = get((j) => j.dps.weapon === w.id && !j.dps.gun && j.dps.scene === 'crowd');
  const s = get((j) => j.dps.weapon === w.id && !j.dps.gun && j.dps.scene === 'single');
  out[w.id] = { crowd: c, single: s };
  rows.push(`| ${w.id} | ${c.toFixed(0)} | ${s.toFixed(0)} | ${Math.sqrt(c * s).toFixed(0)} | ${(s / Math.sqrt(c * s)).toFixed(2)} |`);
}
rows.push('', '| CS gun | crowd | single | power | single vs default gun |', '|---|---:|---:|---:|---:|');
const ds = get((j) => j.dps.gun === DEFAULT_GUN && j.dps.scene === 'single');
for (const g of guns) {
  const c = get((j) => j.dps.gun === g && j.dps.scene === 'crowd');
  const s = get((j) => j.dps.gun === g && j.dps.scene === 'single');
  out[`gun:${g}`] = { crowd: c, single: s };
  rows.push(`| ${g} | ${c.toFixed(0)} | ${s.toFixed(0)} | ${Math.sqrt(c * s).toFixed(0)} | ${((s / ds - 1) * 100).toFixed(0)}% |`);
}
mkdirSync(join(import.meta.dirname, 'out'), { recursive: true });
writeFileSync(join(import.meta.dirname, 'out', 'dps.json'), JSON.stringify(out, null, 1));
console.log(rows.join('\n'));
process.exit(0);
