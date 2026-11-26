// node scripts/redteam/r4.mjs <out.json>: per boss fight the kill time, phase lengths, distinct attacks seen per
// phase (and how many of them the fight had not seen before), the longest same-name run, the longest stun.
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const x of r) {
  if (x.bossFrom < 0) continue;
  const seen = new Set();
  const per = [];
  for (let p = 0; p < x.phaseAt.length; p++) {
    const names = x.attacks.filter((a) => a[0] === p).map((a) => a[1]);
    const fresh = [...new Set(names)].filter((n) => !seen.has(n));
    names.forEach((n) => seen.add(n));
    const len = (x.phaseAt[p + 1] ?? (x.bossTo > 0 ? x.bossTo : x.time)) - x.phaseAt[p];
    per.push(`P${p + 1} ${len.toFixed(0)}s ${names.length}atk ${new Set(names).size}dist ${fresh.length}new`);
  }
  let run = 0, best = 0;
  x.attacks.forEach((a, k) => { run = k > 0 && a[1] === x.attacks[k - 1][1] ? run + 1 : 1; best = Math.max(best, run); });
  console.log(`${x.name} ${x.station} ${x.outcome} kill ${x.bossTo > 0 ? (x.bossTo - x.bossFrom).toFixed(1) : '-'} | ${per.join(' | ')} | ${seen.size} distinct, max run ${best}, stun max ${x.stunLongest?.toFixed(1)}s share ${(x.stunShare * 100).toFixed(0)}% vuln ${(x.vulnShare * 100).toFixed(0)}%`);
}
