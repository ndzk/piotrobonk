// Merges the CI shards (gh run download <id> -D .sim/<prefix>-shards) into .sim/<prefix>-<step>.json:
// node scripts/measure/merge-shards.mjs <prefix>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const P = process.argv[2] ?? 'm';
const dir = `.sim/${P}-shards`;
const by = {};
for (const d of readdirSync(dir)) {
  const m = new RegExp(`^${P}-(.+)-(fabryczna|niciarniana|widzew|andrzejow|bedon|justynow|galkowek|zakowice|koluszki)$`).exec(d);
  if (!m) continue;
  for (const f of readdirSync(join(dir, d))) {
    const runs = JSON.parse(readFileSync(join(dir, d, f), 'utf8'));
    (by[m[1]] ??= []).push(...(Array.isArray(runs) ? runs : runs.runs));
  }
}
for (const [step, runs] of Object.entries(by)) {
  writeFileSync(`.sim/${P}-${step}.json`, JSON.stringify(runs));
  console.log(step, runs.length, 'runów', new Set(runs.map((r) => r.station)).size, 'stacji');
}
