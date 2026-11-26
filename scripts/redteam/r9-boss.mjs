// Round 9 boss benches (HEAD d1e7fb8, hard limit, full bursts): round 8's ZE/ZK on fresh seeds at every station, the
// burst pistols and rifles, three Latte (might x3), and Opóźnienie (extra phase). node scripts/redteam/r9-boss.mjs
import { writeFileSync } from 'node:fs';
const EVO = new Set(['teczka-prezesa', 'bilet-sieciowy', 'espresso', 'kebab', 'powerbank', 'parasol-burzowy', 'kontrola', 'zgrzewka', 'siec-trakcyjna', 'rozklad-2027']);
const MAXP = { okulary: [5, 0.6], zdrapka: [5, 0.9], 'bilet-ulgowy': [2, 3], energetyk: [5, 0.6], kanapka: [5, 0.75], termos: [5, 0.75], nerka: [5, 2.25], kurtka: [5, 0.525], klapki: [5, 0.525], tabela: [5, 0.6] };
const w = (id) => (EVO.has(id) ? { id, level: 1, mults: [] } : { id, level: 8, mults: new Array(7).fill(1.5) });
const MHA = [{ stat: 'might', value: 0.15 }, { stat: 'haste', value: 0.12 }, { stat: 'area', value: 0.1 }];
const MMM = [{ stat: 'might', value: 0.15 }, { stat: 'might', value: 0.15 }, { stat: 'might', value: 0.15 }];
const ZE = [['zgrzewka', 'espresso', 'gnat', 'siec-trakcyjna'], ['kanapka', 'termos', 'bilet-ulgowy', 'energetyk']];
const ZK = [['zgrzewka', 'kontrola', 'gnat', 'siec-trakcyjna'], ['kanapka', 'zdrapka', 'bilet-ulgowy', 'energetyk']];
const ZP = [['zgrzewka', 'espresso', 'puszka', 'siec-trakcyjna'], ['okulary', 'termos', 'bilet-ulgowy', 'energetyk']];
const ALL = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
const bench = (name, stations, seeds, [weapons, passives], gun, close, extra = {}, buffs = MHA) => ({
  name, stations, seeds, seedTag: 'rt9boss', cap: 1500,
  boss: { planner: 'oracle', levels: { weapons: weapons.map(w), passives: passives.map((p) => ({ id: p, level: MAXP[p][0], total: MAXP[p][1] })) }, buffs, gun, mortal: false, close, ...extra },
});
writeFileSync(new URL('./specs/r9-boss.json', import.meta.url), JSON.stringify([
  bench('ZE-aug-c6', ALL, 2, ZE, 'aug', 6),
  bench('ZE-elite-c6', ['widzew', 'zakowice', 'koluszki'], 1, ZE, 'elite', 6),
  bench('ZE-famas-c6-MMM', ['widzew', 'fabryczna'], 1, ZE, 'famas', 6, {}, MMM),
  bench('ZK-aug-c6', ['widzew', 'galkowek'], 1, ZK, 'aug', 6),
  bench('ZP-c6-MMM', ['widzew', 'bedon'], 1, ZP, undefined, 6, {}, MMM),
  bench('ZE-aug-c6-opoz', ['widzew', 'zakowice'], 1, ZE, 'aug', 6, { kurs: 'opoznienie' }),
], null, 1));
