// Opóźnienie's extra phase (boss.ts lastPhase, copied logic): which attacks it adds, whether any is new, duplicates by name.
import { BOSSES, type Attack } from '../../src/content/bosses.ts';
const key = (a: Attack): string => a.name ?? a.kind;
for (const def of BOSSES) {
  const last = def.phases[def.phases.length - 1];
  const extra: Attack[] = [];
  for (const p of def.phases.slice(0, -1)) {
    const strongest = p.attacks.reduce((a, b) => (b.damage * (b.count ?? 1) > a.damage * (a.count ?? 1) ? b : a), p.attacks[0]);
    if (!last.attacks.includes(strongest)) extra.push(strongest);
  }
  const all = [...last.attacks, ...extra].map(key);
  const dup = all.filter((n, i) => all.indexOf(n) !== i);
  console.log(`${def.id}: extra phase ${String(all.length)} attacks, 0 new by construction; added ${extra.map(key).join(', ')}; duplicate names: ${dup.join(', ') || '-'}`);
}
