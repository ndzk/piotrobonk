// Round 11: the perches of r10-tp (P-*) with Piotrek bunny-hopping in place on them (trasa tp + hop): `perched`
// (enemies.ts) is true only on the frames Piotrek stand, so walkers under an open canopy may never climb.
// node scripts/redteam/r11-hop.mjs -> specs/r11-hop.json
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const tp = JSON.parse(readFileSync(new URL('r10-tp.json', dir), 'utf8')).filter((s) => s.name.startsWith('P-'));
const out = [];
for (const s of tp) out.push({ ...s, name: `H${s.name}`, seeds: 12, seedTag: 'rt11hop', trace: undefined, exploit: { ...s.exploit, hop: true } });
writeFileSync(new URL('r11-hop.json', dir), JSON.stringify(out));
console.log(out.length, 'specs', out.reduce((n, s) => n + s.seeds, 0), 'jobs');
