// Audit: the same sim jobs on two Node versions, run by run. Usage: node scripts/audit/nodecmp.mjs <a.json> <b.json> [station,...]
// A run is matched by station, variant and seed; it is "identical" when every number below is equal to the last bit.
import { readFileSync } from 'node:fs';

const load = (f) => ((j) => (Array.isArray(j) ? j : (j.runs ?? [])))(JSON.parse(readFileSync(f, 'utf8')));
const [fa, fb, st] = process.argv.slice(2);
const only = st ? st.split(',') : null;
const a = load(fa).filter((r) => !only || only.includes(r.station));
const b = load(fb).filter((r) => !only || only.includes(r.station));
const key = (r) => `${r.station}|${r.variant}|${r.seed}`;
const B = new Map(b.map((r) => [key(r), r]));
const FIELDS = ['outcome', 'time', 'level', 'kills', 'damageTaken', 'damageDealt', 'rawDealt', 'bossFrom', 'bossTo', 'bossHp', 'lowEpisodes', 'minHp', 'nearShare'];
let same = 0;
let diff = 0;
let missing = 0;
for (const r of a) {
  const o = B.get(key(r));
  if (!o) {
    missing++;
    continue;
  }
  const bad = FIELDS.filter((f) => JSON.stringify(r[f]) !== JSON.stringify(o[f]) || JSON.stringify(r.weapons) !== JSON.stringify(o.weapons));
  if (bad.length) {
    diff++;
    if (diff <= 5) console.log(`DIFF ${key(r)}: ${bad.map((f) => `${f} ${JSON.stringify(r[f])} / ${JSON.stringify(o[f])}`).join('; ')}`);
  } else same++;
}
console.log(`${same} identical, ${diff} different, ${missing} without a match (of ${a.length})`);
