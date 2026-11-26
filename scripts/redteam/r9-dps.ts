// Round 9: every weapon and evolution at its top level, power sqrt(crowd x single) on the dummy bench, bare and with
// Energetyk 5 + Bilet Ulgowy 2; Gnat on the default gun and on AUG. Is Gnat-AUG with E+B out of line with the rest?
// RT_BUNDLE=redteam9-dps.mjs SIM_WORKER=redteam9 node scripts/redteam/r9-dps.ts [--watki=12]
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { WEAPONS } from '../../src/content/items.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { DpsJob, DpsResult } from '../sim/types.ts';

const root = resolve(import.meta.dirname, '../..');
const name = process.env.RT_BUNDLE ?? 'redteam9-dps.mjs';
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
  build: { ssr: join(root, 'scripts/redteam/worker.ts'), outDir: SIM_DIR, emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: name } } },
});
const EB = [{ id: 'energetyk', level: 5 }, { id: 'bilet-ulgowy', level: 2 }];
const rows = [...WEAPONS.map((w) => ({ key: w.id, weapon: w.id, level: w.levels.length + 1, gun: undefined as string | undefined })), { key: 'gnat@aug', weapon: 'gnat', level: (WEAPONS.find((w) => w.id === 'gnat')?.levels.length ?? 7) + 1, gun: 'aug' }];
const jobs: (DpsJob & { key: string; set: string })[] = [];
for (const r of rows) for (const set of ['bare', 'EB']) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, key: r.key, set, dps: { weapon: r.weapon, level: r.level, scene, seconds: 20, gun: r.gun, passives: set === 'EB' ? EB : [] } });
const w = process.argv.find((a) => a.startsWith('--watki='));
const rs = await runPool<DpsResult>(join(SIM_DIR, name), jobs, { threads: Number(w?.slice(8) ?? 6) });
const get = (k: string, set: string, scene: string): number => rs[jobs.findIndex((j) => j.key === k && j.set === set && j.dps.scene === scene)].dps;
const out = rows.map((r) => ({ k: r.key, bare: Math.sqrt(get(r.key, 'bare', 'crowd') * get(r.key, 'bare', 'single')), eb: Math.sqrt(get(r.key, 'EB', 'crowd') * get(r.key, 'EB', 'single')), sb: get(r.key, 'bare', 'single'), se: get(r.key, 'EB', 'single') }));
out.sort((a, b) => b.eb - a.eb);
console.log('| weapon | power bare | power E+B | gain | single bare | single E+B |\n|---|---:|---:|---:|---:|---:|');
for (const r of out) console.log(`| ${r.k} | ${r.bare.toFixed(0)} | ${r.eb.toFixed(0)} | ${(r.eb / r.bare).toFixed(2)} | ${r.sb.toFixed(0)} | ${r.se.toFixed(0)} |`);
process.exit(0);
