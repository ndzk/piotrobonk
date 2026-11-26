// Audit: each boss's attacks from the data, counted by name (the repeat rule's key: name, else kind) and by kind,
// combo follow-ups included; new names per phase; dodge-type attacks. Usage: node scripts/audit/attacks.ts
import { BOSSES, type Attack } from '../../src/content/bosses.ts';

const key = (a: Attack): string => a.name ?? a.kind;
const flat = (l: readonly Attack[]): Attack[] => l.flatMap((a) => (a.then ? [a, ...flat([a.then])] : [a]));
for (const b of BOSSES) {
  const seen = new Set<string>();
  const kinds = new Set<string>();
  const perPhase: string[] = [];
  for (const p of b.phases) {
    const all = flat(p.attacks);
    const fresh = [...new Set(all.map(key))].filter((k) => !seen.has(k));
    perPhase.push(`${String(fresh.length)} (${fresh.join(', ')}) [${String(new Set(all.map(key)).size)} w fazie]`);
    for (const a of all) {
      seen.add(key(a));
      kinds.add(a.kind);
    }
  }
  const dodge = [...new Set(b.phases.flatMap((p) => flat(p.attacks)).filter((a) => ['wave', 'charge', 'roll'].includes(a.kind)).map((a) => `${key(a)}:${a.kind}`))];
  console.log(`${b.id}: fazy ${String(b.phases.length)}, nazwy ${String(seen.size)}, rodzaje ${String(kinds.size)} (${[...kinds].join(',')})`);
  perPhase.forEach((s, k) => console.log(`  faza ${String(k + 1)}: nowe ${s}`));
  console.log(`  skok/ślizg/unik: ${dodge.join('; ') || 'BRAK'}`);
}
