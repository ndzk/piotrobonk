// Round 8 boss benches: round 7's ZE/ZK with the CS gun that wins once haste and extra shots are in (scripts/redteam/
// r8-gun.ts: AUG / SG 553 146 single vs USP 95). node scripts/redteam/r8-boss.mjs [file] -> specs/<file>.json
import { writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const EVO = new Set(['teczka-prezesa', 'bilet-sieciowy', 'espresso', 'kebab', 'powerbank', 'parasol-burzowy', 'kontrola', 'zgrzewka', 'siec-trakcyjna', 'rozklad-2027']);
const MAXP = { okulary: [5, 0.6], zdrapka: [5, 0.9], 'bilet-ulgowy': [2, 3], energetyk: [5, 0.6], kanapka: [5, 0.75], termos: [5, 0.75], nerka: [5, 2.25], kurtka: [5, 0.525], klapki: [5, 0.525], tabela: [5, 0.6] };
const w = (id) => (EVO.has(id) ? { id, level: 1, mults: [] } : { id, level: 8, mults: new Array(7).fill(1.5) });
const MHA = [{ stat: 'might', value: 0.15 }, { stat: 'haste', value: 0.12 }, { stat: 'area', value: 0.1 }];
const ZE = [['zgrzewka', 'espresso', 'gnat', 'siec-trakcyjna'], ['kanapka', 'termos', 'bilet-ulgowy', 'energetyk']];
const ZK = [['zgrzewka', 'kontrola', 'gnat', 'siec-trakcyjna'], ['kanapka', 'zdrapka', 'bilet-ulgowy', 'energetyk']];
const bench = (name, stations, seeds, [weapons, passives], gun, close, extra = {}) => ({
  name, stations, seeds, seedTag: 'rt8boss', cap: 1500,
  boss: { planner: 'oracle', levels: { weapons: weapons.map(w), passives: passives.map((p) => ({ id: p, level: MAXP[p][0], total: MAXP[p][1] })) }, buffs: MHA, gun, mortal: false, close, ...extra },
});
const file = process.argv[2] ?? 'r8-boss';
const sets = {
  'r8-boss': [
    bench('ZE-aug-c6', ['widzew', 'fabryczna', 'niciarniana'], 2, ZE, 'aug', 6),
    bench('ZE-aug-c6', ['bedon', 'zakowice', 'galkowek'], 1, ZE, 'aug', 6),
    bench('ZE-aug-c4', ['widzew', 'fabryczna'], 1, ZE, 'aug', 4),
    bench('ZE-sg556-c6', ['widzew'], 2, ZE, 'sg556', 6),
    bench('ZE-usp-c6', ['widzew'], 2, ZE, 'usp_silencer', 6),
    bench('ZK-aug-c6', ['widzew', 'zakowice'], 1, ZK, 'aug', 6),
  ],
  'r8-boss2': [
    bench('ZE-aug-c6', ['zakowice', 'widzew'], 3, ZE, 'aug', 6, {}),
    bench('ZE-aug-c6', ['niciarniana', 'fabryczna', 'bedon'], 2, ZE, 'aug', 6),
    bench('ZE-aug-c6', ['koluszki', 'justynow', 'andrzejow'], 1, ZE, 'aug', 6),
    bench('ZE-usp-c6', ['zakowice'], 2, ZE, 'usp_silencer', 6),
  ].map((s) => ({ ...s, seedTag: 'rt8boss2' })),
};
writeFileSync(new URL(`${file}.json`, dir), JSON.stringify(sets[file], null, 1));
