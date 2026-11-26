// Round 8 spec writer (HEAD 5706673): round 7's exploit suite on fresh seeds, plus camping-reset bots.
// node scripts/redteam/r8-specs.mjs  -> specs/r8-ex.json, specs/r8-ex2.json, specs/r8-reset.json
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const fresh = (file, tag, mul) =>
  JSON.parse(readFileSync(new URL(file, dir), 'utf8')).map((s) => ({ ...s, seedTag: `${s.seedTag}-r8${tag}`, seeds: s.seeds * mul, from: 0 }));
writeFileSync(new URL('r8-ex.json', dir), JSON.stringify(fresh('r7-ex.json', 'a', 3)));
writeFileSync(new URL('r8-ex2.json', dir), JSON.stringify(fresh('r7-ex2.json', 'b', 2)));
const ALL = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
const T = ['sos', 'parasol', 'kawa', 'gwizdek', 'kurtka', 'kanapka', 'termos', 'nerka'];
const K = ['kawa', 'puszka', 'sos', 'parasol', 'kurtka', 'kanapka', 'termos', 'nerka'];
const ex = (name, exploit, seeds = 24) => ({ name, stations: ALL, seeds, seedTag: 'rt8reset', cap: 400, exploit });
writeFileSync(new URL('r8-reset.json', dir), JSON.stringify([
  ex('sciana-p9b1.5', { kind: 'sciana', period: 9, back: 1.5 }),
  ex('sciana-p9b1.5-T', { kind: 'sciana', period: 9, back: 1.5, cards: T }),
  ex('sciana-p9b1.5-K', { kind: 'sciana', period: 9, back: 1.5, cards: K }),
  ex('sciana-p12b2-T', { kind: 'sciana', period: 12, back: 2, cards: T }),
  ex('sciana-p6b1-T', { kind: 'sciana', period: 6, back: 1, cards: T }),
  ex('tam-p9b1-T', { kind: 'tam', period: 9, back: 1, cards: T }),
  ex('tam-p9b1-hs-T', { kind: 'tam', period: 9, back: 1, cards: T, hop: true, slide: true }),
  ex('tam-p9b1-hs-K', { kind: 'tam', period: 9, back: 1, cards: K, hop: true, slide: true }),
]));
