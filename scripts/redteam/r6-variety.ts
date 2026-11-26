// Round 6: requirement 4 on the data with summons left out (a summon calls minions; it hurts nothing by itself).
import { BOSSES } from '../../src/content/bosses.ts';
const key = (a: { name?: string; kind: string }): string => a.name ?? a.kind;
for (const b of BOSSES) {
  const seen = new Set<string>();
  const out: string[] = [];
  b.phases.forEach((p, k) => {
    const names = p.attacks.filter((a) => a.kind !== 'summon').flatMap((a) => (a.then ? [key(a), key(a.then)] : [key(a)]));
    const fresh = [...new Set(names)].filter((n) => !seen.has(n));
    for (const n of names) seen.add(n);
    out.push(`P${String(k + 1)} ${String(fresh.length)} new${fresh.length < 2 ? ' <2' : ''}`);
  });
  console.log(`${b.id}: ${String(seen.size)} distinct without summons${seen.size < 6 ? ' <6' : ''} | ${out.join(' | ')}`);
}
