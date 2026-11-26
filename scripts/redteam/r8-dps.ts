// Round 8: single-target DPS of every weapon at its top level on the dummy bench, bare and with the boss build's
// passives (amount, haste, area, duration maxed), to rank what goes into a boss-killer's slots.
// RT_BUNDLE=redteam8-dps.mjs node scripts/redteam/r8-dps.ts [--watki=6]
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { WEAPONS } from '../../src/content/items.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { DpsJob, DpsResult } from '../sim/types.ts';

const root = resolve(import.meta.dirname, '../..');
const name = process.env.RT_BUNDLE ?? 'redteam8-dps.mjs';
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
  build: { ssr: join(root, 'scripts/redteam/worker.ts'), outDir: SIM_DIR, emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: name } } },
});
const SETS: Record<string, { id: string; level: number }[]> = {
  bare: [],
  ahad: [{ id: 'bilet-ulgowy', level: 2 }, { id: 'energetyk', level: 5 }, { id: 'okulary', level: 5 }, { id: 'termos', level: 5 }],
};
const jobs: DpsJob[] = [];
for (const w of WEAPONS) for (const set of Object.keys(SETS)) jobs.push({ id: jobs.length, dps: { weapon: w.id, level: w.levels.length + 1, scene: 'single', seconds: 20, passives: SETS[set], gun: w.id === 'gnat' ? 'usp_silencer' : undefined } });
const w = process.argv.find((a) => a.startsWith('--watki='));
const rs = await runPool<DpsResult>(join(SIM_DIR, name), jobs, { threads: Number(w?.slice(8) ?? 6) });
const rows = WEAPONS.map((wd) => ({ id: wd.id, bare: rs[jobs.findIndex((j) => j.dps.weapon === wd.id && !j.dps.passives?.length)].dps, ahad: rs[jobs.findIndex((j) => j.dps.weapon === wd.id && (j.dps.passives?.length ?? 0) > 0)].dps }));
rows.sort((a, b) => b.ahad - a.ahad);
console.log('| weapon | single bare | single +amount/haste/area/duration |\n|---|---:|---:|');
for (const r of rows) console.log(`| ${r.id} | ${r.bare.toFixed(0)} | ${r.ahad.toFixed(0)} |`);
process.exit(0);
