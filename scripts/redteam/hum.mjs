// node scripts/redteam/hum.mjs <.sim/file.json>: wins per station, boss kill times, weapons held in wins.
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const by = {};
for (const x of r) (by[`${x.variant} ${x.station}`] ??= []).push(x);
for (const [k, l] of Object.entries(by)) {
  const w = l.filter((x) => x.outcome === 'won');
  console.log(k, `wins ${w.length}/${l.length}`, 'times', l.map((x) => `${x.outcome[0]}${Math.round(x.time)}`).join(' '), 'kill', w.map((x) => Math.round(x.bossTo - x.bossFrom)).join(' '));
  for (const x of w) console.log('   won with', x.weapons.join(','), '|', x.passives.join(','));
}
