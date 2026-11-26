// Round 9: exploit survivals past 180 s per name and station from out/<file>.json files. node scripts/redteam/r9-sum.mjs f1 f2 ...
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(2)) {
  const rs = JSON.parse(readFileSync(new URL(`./out/${f}.json`, import.meta.url), 'utf8'));
  const by = new Map();
  for (const r of rs) {
    const k = r.name;
    const o = by.get(k) ?? { n: 0, over: [], won: 0, max: 0 };
    o.n++;
    if (r.outcome === 'won') o.won++;
    if (r.time > 180) o.over.push(`${r.station}#${r.id}:${r.time}s:${r.outcome}`);
    o.max = Math.max(o.max, r.time);
    by.set(k, o);
  }
  console.log(`== ${f} (${rs.length} runs)`);
  for (const [k, o] of by) console.log(`${k.padEnd(20)} n=${o.n} won=${o.won} max=${o.max} >180: ${o.over.length} ${o.over.slice(0, 12).join(' ')}`);
}
