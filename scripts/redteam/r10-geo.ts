// Round 10: every station's collision (solid boxes, ramps, fence radius) dumped to out/r10-geo.json, for the cover scan
// (r10-cover.mjs). Bundles scripts/sim/worker.ts like rt.ts and starts each station once on the main thread.
// SIM_WORKER=redteam10 node scripts/redteam/r10-geo.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { SIM_DIR } from '../sim/pool.ts';

const root = resolve(import.meta.dirname, '../..');
const name = 'redteam10-geo.mjs';
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
  build: { ssr: join(root, 'scripts/sim/worker.ts'), outDir: SIM_DIR, emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: name } } },
});
const m = (await import(pathToFileURL(join(SIM_DIR, name)).href)) as { game: { start(...a: unknown[]): void; world: unknown } };
const ALL = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
const out: Record<string, unknown> = {};
for (const st of ALL) {
  m.game.start(1, st, 'normalnie', null, 0, null);
  const w = m.game.world as { boxes: number[]; ramps: unknown[]; limit: number; radius: number };
  out[st] = { boxes: [...w.boxes], ramps: w.ramps, limit: w.limit, radius: w.radius };
}
mkdirSync(join(import.meta.dirname, 'out'), { recursive: true });
writeFileSync(join(import.meta.dirname, 'out/r10-geo.json'), JSON.stringify(out));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${String((v as { boxes: number[] }).boxes.length / 6)} boxes`).join('\n'));
process.exit(0);
