// Round 10 boss benches (HEAD 071c7dc): round 9's strongest kit (ZE + AUG, close 6) on fresh seeds at every station on
// Normalnie and on Opóźnienie (the extra phase and its two new combos), plus G3SG1 / MAG-7 with might x3.
// node scripts/redteam/r10-boss.mjs -> specs/r10-boss.json
import { readFileSync, writeFileSync } from 'node:fs';
const r9 = JSON.parse(readFileSync(new URL('./specs/r9-boss.json', import.meta.url), 'utf8'));
const ze = r9.find((s) => s.name === 'ZE-aug-c6');
const mmm = r9.find((s) => s.name === 'ZE-famas-c6-MMM');
const ALL = ze.stations;
const t = (s, name, stations, seeds, extra = {}, gun = s.boss.gun) => ({ ...s, name, stations, seeds, seedTag: 'rt10boss', boss: { ...s.boss, gun, ...extra } });
writeFileSync(new URL('./specs/r10-boss.json', import.meta.url), JSON.stringify([
  t(ze, 'ZE-aug-c6', ALL, 1),
  t(ze, 'ZE-aug-c6-opoz', ALL, 2, { kurs: 'opoznienie' }),
  t(mmm, 'ZE-g3sg1-MMM', ['widzew', 'koluszki'], 1, {}, 'g3sg1'),
  t(mmm, 'ZE-mag7-MMM', ['fabryczna', 'galkowek'], 1, {}, 'mag7'),
]));
