// Audit: records runs in ONE simulated Game, one after another (station:kind:cap[:day] each), and writes each
// recording to <outdir>/<n>-<station>-<kind>.json for `node scripts/sim/replay.ts <files>` (fresh workers).
// Usage: node scripts/audit/parity.ts <outdir> widzew:good:90 fabryczna:casual:60 ...
//        node scripts/audit/parity.ts --play <file.json>   plays one recording back as this process's FIRST run
//        and compares its trace (player, crowd, kills, level, damage every 60 steps) with the one recorded
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { hashSeed } from '../../src/core/rng.ts';

const root = resolve(import.meta.dirname, '../..');
const [outdir, ...specs] = process.argv.slice(2);
const play = outdir === '--play';
const probe = outdir === '--boss';
const rungs = outdir === '--rung';
if (!play && !probe && !rungs) mkdirSync(outdir, { recursive: true });
const name = `audit-parity-${String(process.pid)}.mjs`;
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
  build: { ssr: join(root, 'scripts/audit/parity-entry.ts'), outDir: join(root, '.sim'), emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: name } } },
});
const m = (await import(pathToFileURL(join(root, '.sim', name)).href)) as { record(d: number, s: string, k: string, p: string, c: number): { replay: unknown; info: string; trace: string[] }; replayTrace(r: unknown): string[]; bossProbe(seed: number, s: string, at: number, until: number): string; rungProbe(d: string, r: number): string };
if (rungs) {
  for (const [d, r] of [['opoznienie', 19], ['normalnie', 19], ['opoznienie', 0]] as const) console.log(m.rungProbe(d, r));
  process.exit(0);
}
if (probe) {
  for (const seed of specs.map(Number)) console.log(m.bossProbe(seed, 'zakowice', 45, 150));
  process.exit(0);
}
if (play) {
  const saved = JSON.parse(readFileSync(specs[0], 'utf8')) as { replay: unknown; trace: string[] };
  const t = m.replayTrace(saved.replay);
  const k = saved.trace.findIndex((line, i) => line !== t[i]);
  console.log(k < 0 && t.length === saved.trace.length ? `IDENTICAL in play: ${String(t.length)} samples (${saved.trace[saved.trace.length - 1]})` : `DIFFERS in play at sample ${String(k)} of ${String(saved.trace.length)}/${String(t.length)}:
  recorded ${saved.trace[k]}
  replayed ${t[k]}`);
  process.exit(0);
}
for (const [n, spec] of specs.entries()) {
  const [station, kind, cap = '1500', day = '900'] = spec.split(':');
  const daySeed = hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 0, 1 + Number(day))).toISOString().slice(0, 10)}`);
  const t0 = Date.now();
  const r = m.record(daySeed, station, kind, 'telefon+iskra+gnat+rozklad/kanapka+termos+bilet-ulgowy+zdrapka', Number(cap));
  const file = join(outdir, `${String(n)}-${station}-${kind}.json`);
  writeFileSync(file, JSON.stringify({ replay: r.replay, trace: r.trace }));
  console.log(`${r.info}; ${((Date.now() - t0) / 1000).toFixed(0)} s wall -> ${file}`);
}
