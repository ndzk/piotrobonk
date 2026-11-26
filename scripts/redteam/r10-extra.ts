// Round 10: Opóźnienie's extra phase as boss.ts lastPhase builds it at 071c7dc (copied logic), per boss: its attacks, which
// names are new to the fight, and whether the two combos are distinct. node scripts/redteam/r10-extra.ts
import { BOSSES, type Attack } from '../../src/content/bosses.ts';
const key = (a: Attack): string => a.name ?? a.kind;
for (const def of BOSSES) {
  const last = def.phases[def.phases.length - 1];
  const have = new Set(last.attacks.map(key));
  const extra: Attack[] = [];
  for (const p of def.phases.slice(0, -1)) {
    const fresh = p.attacks.filter((a) => !have.has(key(a)));
    if (!fresh.length) continue;
    const strongest = fresh.reduce((a, b) => (b.damage * (b.count ?? 1) > a.damage * (a.count ?? 1) ? b : a));
    extra.push(strongest);
    have.add(key(strongest));
  }
  const first = def.phases[0].attacks;
  const ends = last.attacks.filter((a) => !a.then);
  const combos: string[] = [];
  for (let k = 0; k < 2 && ends.length && first.length; k++) combos.push(`${key(first[k % first.length])} i ${key(ends[(k * 2) % ends.length])}`);
  const before = new Set(def.phases.flatMap((p) => p.attacks.map(key)));
  const all = [...last.attacks.map(key), ...extra.map(key), ...combos];
  const fresh = [...new Set(all)].filter((n) => !before.has(n));
  console.log(`${def.id.padEnd(14)} phases ${String(def.phases.length)} | extra phase ${String(new Set(all).size)} names, new ${String(fresh.length)}: ${fresh.join(' / ')} | first ${String(first.length)} ends ${String(ends.length)} (${ends.map(key).join(', ')})`);
}
