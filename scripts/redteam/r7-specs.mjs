// Round 7 spec writer (HEAD ef7359e): boss benches with the re-budgeted weapons, the exploit suite again.
// node scripts/redteam/r7-specs.mjs  -> specs/r7-boss.json, specs/r7-ex.json
import { writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const EVO = new Set(['teczka-prezesa', 'bilet-sieciowy', 'espresso', 'kebab', 'powerbank', 'parasol-burzowy', 'kontrola', 'zgrzewka', 'siec-trakcyjna', 'rozklad-2027']);
// Legendary-card passives (perLevel x maxLevel x 1,5), as round 6's "max" benches.
const MAXP = { okulary: [5, 0.6], zdrapka: [5, 0.9], 'bilet-ulgowy': [2, 3], energetyk: [5, 0.6], kanapka: [5, 0.75], termos: [5, 0.75], nerka: [5, 2.25], kurtka: [5, 0.525] };
const R4P = { okulary: [5, 0.45], zdrapka: [5, 0.7], 'bilet-ulgowy': [2, 2], energetyk: [5, 0.48] };
const w = (id) => (EVO.has(id) ? { id, level: 1, mults: [] } : { id, level: 8, mults: new Array(7).fill(1.5) });
const MHA = [{ stat: 'might', value: 0.15 }, { stat: 'haste', value: 0.12 }, { stat: 'area', value: 0.1 }];
const bench = (name, stations, weapons, passives, P = MAXP, extra = {}) => ({
  name, stations, seeds: 1, seedTag: 'rt7boss', cap: 1500,
  boss: { planner: 'oracle', levels: { weapons: weapons.map(w), passives: passives.map((p) => ({ id: p, level: P[p][0], total: P[p][1] })) }, buffs: MHA, gun: 'usp_silencer', mortal: false, ...extra },
});
const CHANGED = ['fabryczna', 'widzew', 'bedon', 'galkowek', 'zakowice', 'koluszki'];
writeFileSync(new URL('r7-boss.json', dir), JSON.stringify([
  bench('C1L3c', CHANGED, ['teczka-prezesa', 'kontrola', 'gnat', 'siec-trakcyjna'], ['okulary', 'zdrapka', 'bilet-ulgowy', 'energetyk'], R4P),
  bench('ZK', CHANGED, ['zgrzewka', 'kontrola', 'gnat', 'siec-trakcyjna'], ['kanapka', 'zdrapka', 'bilet-ulgowy', 'energetyk']),
  bench('ZE', ['fabryczna', 'widzew', 'bedon'], ['zgrzewka', 'espresso', 'gnat', 'siec-trakcyjna'], ['kanapka', 'termos', 'bilet-ulgowy', 'energetyk']),
  bench('ZKE', ['fabryczna', 'widzew', 'bedon'], ['zgrzewka', 'kontrola', 'espresso', 'siec-trakcyjna'], ['kanapka', 'zdrapka', 'bilet-ulgowy', 'termos']),
], null, 1));
const ALL = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
const T = ['sos', 'parasol', 'kawa', 'gwizdek', 'kurtka', 'kanapka', 'termos', 'nerka'];
const K = ['kawa', 'puszka', 'sos', 'parasol', 'kurtka', 'kanapka', 'termos', 'nerka'];
const B = ['bilet', 'kawa', 'puszka', 'sos', 'kurtka', 'kanapka', 'klapki', 'termos'];
const ex = (name, exploit, seeds = 12) => ({ name, stations: ALL, seeds, seedTag: 'rt7ex', cap: 400, exploit });
writeFileSync(new URL('r7-ex.json', dir), JSON.stringify([
  ex('slamlap', { kind: 'slamlap' }),
  ex('slamlap-T', { kind: 'slamlap', cards: T }),
  ex('slamlap-K', { kind: 'slamlap', cards: K }),
  ex('slamdrift-m40-T', { kind: 'slamdrift', mag: 0.4, cards: T }),
  ex('slamdrift-m40-K', { kind: 'slamdrift', mag: 0.4, cards: K }),
  ex('hopslajd-K', { kind: 'hopslajd', cards: K }),
  ex('hopslajd-B', { kind: 'hopslajd', cards: B }),
], null, 1));
