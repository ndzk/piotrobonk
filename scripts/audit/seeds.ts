// Audit: which seed days (codzienny kurs from 2026-01-01) each result file used. Usage: node scripts/audit/seeds.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hashSeed } from '../../src/core/rng.ts';

const root = join(import.meta.dirname, '../..');
const day = new Map<number, number>();
for (let d = -400; d < 2000; d++) day.set(hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10)}`), d);
const files: string[] = [];
const walk = (dir: string): void => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.json')) files.push(p);
  }
};
walk(join(root, '.sim'));
walk(join(root, 'scripts/redteam'));
const seedsIn = (x: unknown, out: Set<number>): void => {
  if (Array.isArray(x)) for (const v of x) seedsIn(v, out);
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) {
    if (k === 'seed' && typeof v === 'number') out.add(v);
    else seedsIn(v, out);
  }
};
for (const f of files) {
  let j: unknown;
  try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
  const s = new Set<number>();
  seedsIn(j, s);
  if (!s.size) continue;
  const days = [...s].map((x) => day.get(x) ?? NaN);
  const known = days.filter((d) => !Number.isNaN(d)).sort((a, b) => a - b);
  const late = known.filter((d) => d >= 500);
  console.log(`${f.slice(root.length + 1)}  seeds ${s.size}  days ${known.length ? `${known[0]}..${known[known.length - 1]}` : '-'}  unknown ${days.length - known.length}${late.length ? `  >=500: ${[...new Set(late)].join(',')}` : ''}`);
}
