// Round 9 spec writer (HEAD d1e7fb8): round 8's exploit suites on fresh seed tags.
// node scripts/redteam/r9-specs.mjs -> specs/r9-ex.json, r9-ex2.json, r9-slam.json, r9-again.json, r9-reset.json
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const fresh = (file, tag) => JSON.parse(readFileSync(new URL(file, dir), 'utf8')).map((s) => ({ ...s, seedTag: `${s.seedTag}-r9${tag}`, from: 0 }));
for (const [f, t] of [['r8-ex', 'a'], ['r8-ex2', 'b'], ['r8-slam', 'c'], ['r8-again', 'd'], ['r8-reset', 'e']]) writeFileSync(new URL(`${f.replace('r8', 'r9')}.json`, dir), JSON.stringify(fresh(`${f}.json`, t)));
