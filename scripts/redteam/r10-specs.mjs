// Round 10 (HEAD 071c7dc): round 9's exploit suites on fresh seed tags, merged into one file so one pool runs them.
// node scripts/redteam/r10-specs.mjs -> specs/r10-ex.json
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const all = [];
for (const f of ['r9-slam', 'r9-slam2', 'r9-trasa', 'r9-ex', 'r9-ex2', 'r9-again', 'r9-reset'])
  for (const s of JSON.parse(readFileSync(new URL(`${f}.json`, dir), 'utf8')))
    all.push({ ...s, name: `${f.slice(3)}/${s.name}`, seedTag: `${s.seedTag}-r10`, from: 0, trace: undefined });
writeFileSync(new URL('r10-ex.json', dir), JSON.stringify(all));
console.log(all.reduce((n, s) => n + s.stations.length * s.seeds, 0), 'jobs');
