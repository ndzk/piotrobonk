// Static check of requirement 4 on the boss data: distinct attacks per boss, new ones per phase (by name, as
// boss.ts's attackKey counts them), and combos (`then`) that would chain one attack into itself.
import { BOSSES } from '../../src/content/bosses.ts';
const key = (a: { name?: string; kind: string }): string => a.name ?? a.kind;
for (const b of BOSSES) {
  const seen = new Set<string>();
  const perPhase: string[] = [];
  b.phases.forEach((p, k) => {
    const names = p.attacks.flatMap((a) => (a.then ? [key(a), key(a.then)] : [key(a)]));
    const fresh = [...new Set(names)].filter((n) => !seen.has(n));
    for (const n of names) seen.add(n);
    const self = p.attacks.filter((a) => a.then && key(a.then) === key(a)).map(key);
    perPhase.push(`P${String(k + 1)}: ${String(p.attacks.length)} atk, ${String(fresh.length)} new${self.length ? `, self-combo ${self.join(',')}` : ''}${p.attacks.length === 1 ? ' ONLY ONE' : ''}`);
  });
  console.log(`${b.id}: ${String(seen.size)} distinct | ${perPhase.join(' | ')}`);
}
