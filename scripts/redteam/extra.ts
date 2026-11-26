// Opóźnienie's extra phase (boss.ts lastPhase): which attacks it adds and how many of them the fight has not seen.
import { BOSSES } from '../../src/content/bosses.ts';
const key = (a: { name?: string; kind: string }): string => a.name ?? a.kind;
for (const b of BOSSES) {
  const last = b.phases[b.phases.length - 1];
  const have = new Set(last.attacks.map(key));
  const extra: string[] = [];
  for (const p of b.phases.slice(0, -1)) {
    const fresh = p.attacks.filter((a) => !have.has(key(a)));
    if (!fresh.length) continue;
    const s = fresh.reduce((a, c) => (c.damage * (c.count ?? 1) > a.damage * (a.count ?? 1) ? c : a));
    extra.push(key(s));
    have.add(key(s));
  }
  console.log(`${b.id}: extra phase = last (${String(last.attacks.length)}) + [${extra.join(', ')}] -> ${String(have.size)} attacks, 0 never seen before`);
}
