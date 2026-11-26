// Round 9: requirement 4 from logged boss fights (out/<file>.json): distinct attacks per boss, the ones each phase
// brings that really came, the longest run of one attack, phase gates and stuns. node scripts/redteam/r9-variety.mjs f...
import { readFileSync } from 'node:fs';
const rs = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(new URL(`./out/${f}.json`, import.meta.url), 'utf8')));
for (const r of rs.filter((x) => x.attacks.length)) {
  const seen = new Set();
  const per = [];
  let run = 1, worst = 1, what = '';
  r.attacks.forEach((a, k) => {
    if (k && a[1] === r.attacks[k - 1][1]) run++; else run = 1;
    if (run > worst) [worst, what] = [run, a[1]];
  });
  const phases = [...new Set(r.attacks.map((a) => a[0]))];
  for (const ph of phases) {
    const names = new Set(r.attacks.filter((a) => a[0] === ph).map((a) => a[1]));
    const fresh = [...names].filter((n) => !seen.has(n));
    names.forEach((n) => seen.add(n));
    per.push(`P${ph + 1}:${names.size}/${fresh.length}new`);
  }
  const gates = (r.gates ?? []).map(([p, h, at]) => `${p}@${h}(${at})`).join(' ');
  console.log(`${r.name.padEnd(18)} ${r.station.padEnd(11)} ${String(seen.size).padStart(2)} distinct | ${per.join(' ')} | max run ${worst}x ${what} | gates ${gates} | stun ${(r.stunShare * 100).toFixed(0)}% longest ${r.stunLongest.toFixed(1)}s early ${r.earlyStuns}`);
}
