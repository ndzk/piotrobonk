// Static count of each boss's attacks: distinct by name and by kind, new ones per phase (combo follow-ups included).
import { BOSSES, type Attack } from '../../src/content/bosses.ts';
const label = (a: Attack): string => a.name ?? (a.kind === 'summon' ? `summon:${a.spawn ?? ''}` : a.kind);
for (const b of BOSSES) {
  const names = new Set<string>();
  const kinds = new Set<string>();
  const per: string[] = [];
  for (const ph of b.phases) {
    const all = ph.attacks.flatMap((a) => (a.then ? [a, a.then] : [a]));
    const newN = [...new Set(all.map(label))].filter((n) => !names.has(n));
    const newK = [...new Set(all.map((a) => a.kind))].filter((k) => !kinds.has(k));
    all.forEach((a) => names.add(label(a)));
    all.forEach((a) => kinds.add(a.kind));
    per.push(`${String(ph.attacks.length)} attacks, new ${String(newN.length)} by name / ${String(newK.length)} by kind`);
  }
  console.log(`${b.id}: ${String(names.size)} names, ${String(kinds.size)} kinds | ${per.join(' ; ')}`);
}
