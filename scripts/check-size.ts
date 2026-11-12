// Fails the build when the initial JS (entry chunk + its static imports) exceeds the gzip budget.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 1.5 * 1024 * 1024;

interface Chunk {
  file: string;
  isEntry?: boolean;
  imports?: string[];
}

const manifest = new Map(
  Object.entries(JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8')) as Record<string, Chunk>),
);
const initial = new Set<string>();
const visit = (key: string): void => {
  if (initial.has(key)) return;
  initial.add(key);
  for (const dep of manifest.get(key)?.imports ?? []) visit(dep);
};
for (const [key, chunk] of manifest) if (chunk.isEntry) visit(key);
if (initial.size === 0) {
  console.error('No entry chunk in the Vite manifest: cannot measure the budget.');
  process.exit(1);
}

let total = 0;
for (const key of initial) {
  const file = manifest.get(key)?.file;
  if (!file?.endsWith('.js')) continue;
  const size = gzipSync(readFileSync(`dist/${file}`)).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(9)} KiB  ${file}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(9)} KiB  initial JS gzip (budget ${BUDGET / 1024} KiB)`);
if (total > BUDGET) {
  console.error('Initial JS over budget.');
  process.exit(1);
}
