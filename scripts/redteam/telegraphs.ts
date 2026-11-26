// Shortest boss warnings per kurs (Attack.telegraph x kurs.telegraph, x the ladder's espresso at the top).
import { BOSSES } from '../../src/content/bosses.ts';
import { TUNING } from '../../src/content/tuning.ts';
const k = { normalnie: TUNING.difficulty.normalnie.telegraph, opoznienie: TUNING.difficulty.opoznienie.telegraph, espresso: TUNING.difficulty.normalnie.telegraph * TUNING.ladder.espressoTelegraph };
const rows: [number, string][] = [];
for (const b of BOSSES)
  for (const p of b.phases)
    for (const a of [...p.attacks, ...p.attacks.flatMap((x) => (x.then ? [x.then] : []))]) rows.push([a.telegraph, `${b.id} ${a.name ?? a.kind} (${a.kind}${a.speed ? `, ${String(a.speed)} m/s` : ''}${a.effect ? `, ${a.effect}` : ''})`]);
rows.sort((a, b) => a[0] - b[0]);
const seen = new Set<string>();
for (const [t, n] of rows) {
  if (seen.has(n)) continue;
  seen.add(n);
  if (t > 0.5) break;
  console.log(`${t.toFixed(2)} s base | Normalnie ${(t * k.normalnie).toFixed(2)} | Opóźnienie ${(t * k.opoznienie).toFixed(2)} | ladder espresso ${(t * k.espresso).toFixed(2)} | ${n}`);
}
