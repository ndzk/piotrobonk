// Round 9: stand on the spots where the no-stick slide-hop outlived 6 min at Widzew (r9-slam2 #382 and #862), and nearby.
// node scripts/redteam/r9-punkt.mjs -> specs/r9-punkt.json
import { writeFileSync } from 'node:fs';
const T = ['sos', 'parasol', 'kawa', 'gwizdek', 'kurtka', 'kanapka', 'termos', 'nerka'];
const sp = (name, at, x = {}, seeds = 12, stations = ['widzew']) => ({ name, stations, seeds, seedTag: 'rt9punkt', cap: 400, exploit: { kind: 'punkt', at, cards: T, ...x } });
writeFileSync(new URL('./specs/r9-punkt.json', import.meta.url), JSON.stringify([
  sp('A-38-17', [-38.3, -17]),
  sp('A-38-17-hop', [-38.3, -17], { hop: true }),
  sp('B-47+40', [-47, 39.9]),
  sp('B-47+40-hop', [-47, 39.9], { hop: true }),
  sp('C-40+0', [-40, 0]),
  sp('D-38-14', [-38, -14]),
  sp('E-47+36', [-47, 36]),
  sp('srodek', [0, 0], {}, 6),
]));
