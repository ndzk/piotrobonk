// node scripts/redteam/gates.mjs out/<name>.json: kill time, vulnerable vs stun share, and how far above each
// phase threshold the phase changed (health skipped by a gate that fired on damage the limit then cut).
import { readFileSync } from 'node:fs';
for (const x of JSON.parse(readFileSync(process.argv[2], 'utf8'))) {
  const skipped = (x.gates ?? []).map(([p, h, at]) => `P${String(p + 1)}@${(h * 100).toFixed(2)}% (threshold ${(at * 100).toFixed(0)}%, skipped ${((h - at) * 100).toFixed(2)} pp)`);
  console.log(x.name, x.station, x.outcome, 'kill', (x.bossTo - x.bossFrom).toFixed(1), 'raw/landed', (x.raw / x.landed).toFixed(2), 'stun', `${(x.stunShare * 100).toFixed(0)}%`, 'vulnerable', `${((x.vulnShare ?? 0) * 100).toFixed(0)}%`, '|', skipped.join(' '));
}
