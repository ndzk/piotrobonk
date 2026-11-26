// Round 9: the slide-hop with no stick (r8-slam's slam-w-miejscu) on more seeds and card plans, plus hop-only and
// slide-only. node scripts/redteam/r9-slam2.mjs -> specs/r9-slam2.json
import { writeFileSync } from 'node:fs';
const ALL = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
const T = ['sos', 'parasol', 'kawa', 'gwizdek', 'kurtka', 'kanapka', 'termos', 'nerka'];
const K = ['kawa', 'puszka', 'sos', 'parasol', 'kurtka', 'kanapka', 'termos', 'nerka'];
const P = ['parasol', 'teczka', 'sos', 'kurtka', 'kanapka', 'termos', 'nerka', 'klapki'];
const ex = (name, x, seeds) => ({ name, stations: ALL, seeds, seedTag: 'rt9slam2', cap: 400, exploit: { kind: 'tam', period: 1e9, back: 0, ...x } });
writeFileSync(new URL('./specs/r9-slam2.json', import.meta.url), JSON.stringify([
  ex('hs', { hop: true, slide: true }, 32),
  ex('hs-T', { hop: true, slide: true, cards: T }, 32),
  ex('hs-K', { hop: true, slide: true, cards: K }, 24),
  ex('hs-P', { hop: true, slide: true, cards: P }, 24),
  ex('h-T', { hop: true, cards: T }, 12),
  ex('s-T', { slide: true, cards: T }, 12),
]));
