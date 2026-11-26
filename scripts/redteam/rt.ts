// Red team runner: node scripts/redteam/rt.ts <spec.json> <out-name> [--watki=6]
// spec: [{ name, stations: [...], seeds: N, seedTag?: string, cap, boss?|exploit?|full? }] (see worker.ts RtJob).
// Bundles scripts/redteam/worker.ts into .sim/redteam-rt.mjs (never the shared .sim/worker.mjs), writes
// scripts/redteam/out/<out-name>.json and prints a summary.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { hashSeed } from '../../src/core/rng.ts';
import { TUNING } from '../../src/content/tuning.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { RtJob, RtResult } from './worker.ts';

const root = resolve(import.meta.dirname, '../..');
const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function buildRt(): Promise<string> {
  await build({
    root,
    configFile: false,
    publicDir: false,
    logLevel: 'error',
    define: { __APP_VERSION__: '"sim"', __GIT_SHA__: '"sim"', __CHANGELOG__: '[]' },
    build: { ssr: join(root, 'scripts/redteam/worker.ts'), outDir: SIM_DIR, emptyOutDir: false, target: 'node22', minify: false, rollupOptions: { output: { entryFileNames: process.env.RT_BUNDLE ?? 'redteam-rt.mjs' } } },
  });
  return join(SIM_DIR, process.env.RT_BUNDLE ?? 'redteam-rt.mjs');
}

type Spec = Omit<RtJob, 'id' | 'seed' | 'station'> & { name: string; stations: string[]; seeds: number; seedTag?: string; from?: number };
const [specFile, outName] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const specs = JSON.parse(readFileSync(specFile, 'utf8')) as Spec[];
const jobs: (RtJob & { name: string })[] = [];
for (const s of specs)
  for (const station of s.stations)
    for (let k = 0; k < s.seeds; k++) {
      const { name, stations: _s, seeds: _n, seedTag, from, ...rest } = s;
      jobs.push({ ...rest, name, id: jobs.length, station, seed: hashSeed(`${seedTag ?? 'redteam'}:${String((from ?? 0) + k)}`) });
    }
const file = await buildRt();
const t0 = Date.now();
const rs = await runPool<RtResult>(file, jobs, { threads: Number(arg('watki') ?? 6), onResult: (d, n) => process.stdout.write(`\r${String(d)}/${String(n)}`) });
const outDir = join(import.meta.dirname, 'out');
mkdirSync(outDir, { recursive: true });
const named = rs.map((r, k) => ({ ...r, name: jobs[k].name }));
writeFileSync(join(outDir, `${outName}.json`), JSON.stringify(named));

const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
};
/** Longest run of the same value in a list. */
const longest = (l: string[]): [number, string] => {
  let best = 0;
  let what = '';
  let n = 0;
  for (let k = 0; k < l.length; k++) {
    n = k > 0 && l[k] === l[k - 1] ? n + 1 : 1;
    if (n > best) {
      best = n;
      what = l[k];
    }
  }
  return [best, what];
};
console.log(`\n${String(rs.length)} jobs, ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
console.log('| name | station | won | dead | t/o | kill s (min / med) | min allowed | time (med / max) | >180 s | stun share | shield leaks | longest same name | longest same kind |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|');
for (const name of [...new Set(named.map((r) => r.name))])
  for (const st of [...new Set(named.filter((r) => r.name === name).map((r) => r.station))]) {
    const l = named.filter((r) => r.name === name && r.station === st);
    const won = l.filter((r) => r.outcome === 'won');
    const ttk = won.filter((r) => r.bossTo > 0).map((r) => r.bossTo - r.bossFrom);
    const names = l.map((r) => longest(r.attacks.map((a) => a[1])));
    const kinds = l.map((r) => longest(r.attacks.map((a) => a[2])));
    const ln = names.reduce((a, b) => (b[0] > a[0] ? b : a), [0, '']);
    const lk = kinds.reduce((a, b) => (b[0] > a[0] ? b : a), [0, '']);
    const fight = l.some((r) => r.bossFrom >= 0);
    console.log(
      `| ${name} | ${st} | ${String(won.length)} | ${String(l.filter((r) => r.outcome === 'dead').length)} | ${String(l.filter((r) => r.outcome === 'timeout').length)} | ${ttk.length ? `${Math.min(...ttk).toFixed(0)} / ${med(ttk).toFixed(0)}` : '–'} | ${String(TUNING.boss.fight[st]?.[0] ?? '')} | ${med(l.map((r) => r.time)).toFixed(0)} / ${Math.max(...l.map((r) => r.time)).toFixed(0)} | ${String(l.filter((r) => r.time > 180).length)} | ${fight ? (med(l.map((r) => r.stunShare)) * 100).toFixed(0) + '% / max ' + Math.max(...l.map((r) => r.stunLongest ?? 0)).toFixed(1) + ' s' : '–'} | ${String(l.reduce((s, r) => s + r.shieldLeaks, 0))} | ${fight ? `${String(ln[0])}× ${ln[1]} (${String(names.filter((x) => x[0] > 2).length)}/${String(l.length)} fights >2)` : '–'} | ${fight ? `${String(lk[0])}× ${lk[1]} (${String(kinds.filter((x) => x[0] > 2).length)}/${String(l.length)})` : '–'} |`,
    );
  }
process.exit(0);
