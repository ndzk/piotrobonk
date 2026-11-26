// Round 11: round 10's wspin perches, mortal (W0) on many seeds, and with a bunny hop in place once there (H).
// node scripts/redteam/r11-wspin-hop.mjs -> specs/r11-wspinh.json
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const w = JSON.parse(readFileSync(new URL('r10-wspin.json', dir), 'utf8')).filter((s) => s.exploit.godTrip === 60);
const out = [];
for (const s of w) {
  const base = s.name.slice(4);
  const e = s.exploit;
  out.push({ ...s, name: `W0-${base}`, seeds: 48, seedTag: 'rt11w0', trace: undefined, exploit: { ...e, godTrip: 0 } });
  out.push({ ...s, name: `W0H-${base}`, seeds: 48, seedTag: 'rt11w0', trace: undefined, exploit: { ...e, godTrip: 0, hop: true } });
  out.push({ ...s, name: `W60H-${base}`, seeds: 16, seedTag: 'rt11w60', trace: undefined, exploit: { ...e, hop: true } });
}
writeFileSync(new URL('r11-wspinh.json', dir), JSON.stringify(out));
console.log(out.reduce((n, s) => n + s.seeds, 0), 'jobs');
