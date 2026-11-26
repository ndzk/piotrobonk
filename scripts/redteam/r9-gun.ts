// Round 9: r8-gun.ts after d1e7fb8 (bursts finish before the next pull): every CS gun on Gnat at max level, bare and
// with Energetyk 5 + Bilet Ulgowy 2. RT_BUNDLE=redteam9-gun.mjs SIM_WORKER=redteam9 node scripts/redteam/r9-gun.ts [--watki=12]
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { WEAPONS } from '../../src/content/items.ts';
import { CS_WEAPONS, isGloves, isKnife } from '../../src/content/skins/catalog.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { DpsJob, DpsResult } from '../sim/types.ts';

const root = resolve(import.meta.dirname, '../..');
const name = process.env.RT_BUNDLE ?? 'redteam9-gun.mjs';
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
  build: { ssr: join(root, 'scripts/redteam/worker.ts'), outDir: SIM_DIR, emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: name } } },
});
const guns = Object.keys(CS_WEAPONS).filter((k) => !isKnife(k) && !isGloves(k));
const top = (WEAPONS.find((w) => w.id === 'gnat')?.levels.length ?? 7) + 1;
const EB = [{ id: 'energetyk', level: 5 }, { id: 'bilet-ulgowy', level: 2 }];
const jobs: (DpsJob & { set: string })[] = [];
for (const gun of guns) for (const set of ['bare', 'EB']) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, set, dps: { weapon: 'gnat', level: top, scene, seconds: 20, gun, passives: set === 'EB' ? EB : [] } });
const w = process.argv.find((a) => a.startsWith('--watki='));
const rs = await runPool<DpsResult>(join(SIM_DIR, name), jobs, { threads: Number(w?.slice(8) ?? 2) });
const get = (g: string, set: string, scene: string): number => rs[jobs.findIndex((j) => j.dps.gun === g && j.set === set && j.dps.scene === scene)].dps;
const rows = guns.map((g) => ({ g, bare: Math.sqrt(get(g, 'bare', 'crowd') * get(g, 'bare', 'single')), eb: Math.sqrt(get(g, 'EB', 'crowd') * get(g, 'EB', 'single')), s: get(g, 'EB', 'single'), c: get(g, 'EB', 'crowd') }));
rows.sort((a, b) => b.eb - a.eb);
const glock = rows.find((r) => r.g === 'glock');
for (const r of rows) console.log(`${r.g.padEnd(14)} bare ${r.bare.toFixed(0).padStart(4)} (${((r.bare / (glock?.bare ?? 1)) * 100).toFixed(0)}%)  E+B ${r.eb.toFixed(0).padStart(4)} (${((r.eb / (glock?.eb ?? 1)) * 100).toFixed(0)}%) single ${r.s.toFixed(0)} crowd ${r.c.toFixed(0)}  gain ${(r.eb / r.bare).toFixed(2)}`);
const e = rows.map((r) => r.eb);
console.log(`E+B spread: max/min ${(Math.max(...e) / Math.min(...e)).toFixed(2)}; bare max/min ${(Math.max(...rows.map((r) => r.bare)) / Math.min(...rows.map((r) => r.bare))).toFixed(2)}`);
process.exit(0);
