// Round 10: spot runs (r10-spots*.json): survival per spot, after god mode ended (godTrip s), and whether Piotrek stood
// within 1,5 m of the spot on the right floor at the end. node scripts/redteam/r10-spotsum.mjs r10-spots3 [godTrip]
import { readFileSync } from 'node:fs';
const f = process.argv[2], god = Number(process.argv[3] ?? 40);
const rs = JSON.parse(readFileSync(new URL(`./out/${f}.json`, import.meta.url), 'utf8'));
const sp = JSON.parse(readFileSync(new URL(`./specs/${f}.json`, import.meta.url), 'utf8'));
const rows = [];
for (const s of sp) {
  const l = rs.filter((r) => r.name === s.name), [tx, tz] = s.exploit.path.at(-1), fl = Number(s.name.split('-f').at(-1));
  const on = (p) => Math.hypot(p[1] - tx, p[3] - tz) < 1.5 && Math.abs(p[2] - fl) < 0.6;
  const there = l.filter((r) => r.trail.length > 1 && on(r.trail.at(-1)));
  const t = l.map((r) => r.time).sort((a, b) => a - b);
  rows.push({ n: s.name, k: `${there.length}/${l.length}`, med: t[t.length >> 1], max: t.at(-1), over: l.filter((r) => r.time - god > 180).length, overThere: there.filter((r) => r.time - god > 180).length, hurt: there.length ? Math.max(...there.map((r) => r.trail.at(-1)[6])) : '-' });
}
rows.sort((a, b) => b.max - a.max);
for (const r of rows) console.log(`${r.n.padEnd(34)} at spot at end ${r.k.padStart(5)}  time med ${r.med.toFixed(0).padStart(4)} max ${r.max.toFixed(0).padStart(4)}  >180 after god ${r.over} (at spot ${r.overThere})`);
