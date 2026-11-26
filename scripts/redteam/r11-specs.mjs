// Round 11 (HEAD 54df758): round 10's suites (r10-ex, r10-wspin, r10-wspin2, r10-tp) on fresh seed tags.
// node scripts/redteam/r11-specs.mjs -> specs/r11-ex.json, r11-wspin.json, r11-tp.json
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('./specs/', import.meta.url);
const rd = (f) => JSON.parse(readFileSync(new URL(`${f}.json`, dir), 'utf8'));
const re = (l, tag) => l.map((s) => ({ ...s, seedTag: `${s.seedTag}-r11${tag}`, from: 0, trace: undefined }));
writeFileSync(new URL('r11-ex.json', dir), JSON.stringify(re(rd('r10-ex'), '')));
writeFileSync(new URL('r11-wspin.json', dir), JSON.stringify([...re(rd('r10-wspin'), 'a'), ...re(rd('r10-wspin2'), 'b')]));
writeFileSync(new URL('r11-tp.json', dir), JSON.stringify(re(rd('r10-tp'), '')));
for (const f of ['r11-ex', 'r11-wspin', 'r11-tp']) console.log(f, rd(f).reduce((n, s) => n + s.stations.length * s.seeds, 0), 'jobs');
