// Round 10: climb to the perches that held in the teleport test (r10-tp), cell by cell (worker 'wspin'), god mode for
// the first `god` s of the trip only, then stand. node scripts/redteam/r10-wspin.mjs -> specs/r10-wspin.json
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const T = ['sos', 'parasol', 'kawa', 'gwizdek', 'kurtka', 'kanapka', 'termos', 'nerka'];
const spots = [['andrzejow', 12, -2, 4.9], ['galkowek', -0.5, 28.5, 4.02], ['widzew', -44.5, 6, 8], ['widzew', -36, 6, 8], ['fabryczna', -17, 5, 3.3], ['zakowice', -28, 5, 6.2], ['justynow', 3.5, 28.5, 3.92], ['zakowice', 5.5, 27, 4.12]];
const out = [];
for (const [st, x, z, f] of spots) {
  const line = execFileSync('node', [fileURLToPath(new URL('./r10-cover.mjs', import.meta.url)), st, `--path=${x},${z},${f}`, '--dense'], { encoding: 'utf8' });
  const path = JSON.parse(line.slice(line.indexOf('[')));
  for (const god of [60, 0]) out.push({ name: `W${god}-${st}-${x},${z}-f${f}`, stations: [st], seeds: god ? 16 : 8, seedTag: 'rt10wspin', cap: 400, trace: 10, exploit: { kind: 'wspin', path, godTrip: god, cards: T } });
}
writeFileSync(new URL('./specs/r10-wspin.json', import.meta.url), JSON.stringify(out));
console.log(out.map((s) => `${s.name} ${s.exploit.path.length} cells`).join('\n'));
