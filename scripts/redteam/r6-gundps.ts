// Round 6: single-target vs crowd DPS of every CS gun on Gnat at its top level (the dps.ts bench, guns only), to
// pick the boss bench's gun. Bundle .sim/redteam6-dps.mjs. node scripts/redteam/r6-gundps.ts [--watki=2]
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { WEAPONS } from '../../src/content/items.ts';
import { CS_WEAPONS, isGloves, isKnife } from '../../src/content/skins/catalog.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { DpsJob, DpsResult } from '../sim/types.ts';

const root = resolve(import.meta.dirname, '../..');
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
  build: { ssr: join(root, 'scripts/redteam/worker.ts'), outDir: SIM_DIR, emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: 'redteam6-dps.mjs' } } },
});
const guns = Object.keys(CS_WEAPONS).filter((k) => !isKnife(k) && !isGloves(k));
const top = (WEAPONS.find((w) => w.id === 'gnat')?.levels.length ?? 7) + 1;
const jobs: DpsJob[] = [];
for (const gun of guns) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: 'gnat', level: top, scene, seconds: 20, gun } });
const w = process.argv.find((a) => a.startsWith('--watki='));
const rs = await runPool<DpsResult>(join(SIM_DIR, 'redteam6-dps.mjs'), jobs, { threads: Number(w?.slice(8) ?? 2) });
const rows = guns.map((g) => {
  const c = rs[jobs.findIndex((j) => j.dps.gun === g && j.dps.scene === 'crowd')].dps;
  const s = rs[jobs.findIndex((j) => j.dps.gun === g && j.dps.scene === 'single')].dps;
  return { g, c, s };
});
rows.sort((a, b) => b.s - a.s);
for (const r of rows) console.log(`${r.g.padEnd(14)} single ${r.s.toFixed(0).padStart(4)} crowd ${r.c.toFixed(0).padStart(4)} power ${Math.sqrt(r.c * r.s).toFixed(0)}`);
process.exit(0);
