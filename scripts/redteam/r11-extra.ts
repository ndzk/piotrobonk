// Round 11: Opóźnienie's extra phase as boss.ts lastPhase builds it at 54df758 (copied logic), and its picker (Boss.start /
// draw / count, copied) run 200 000 draws per boss: how often an attack lands three times in a row once a combo's
// opening part (a copy of attack X under the name "X i Y") is counted as what it is. node scripts/redteam/r11-extra.ts
import { BOSSES, type Attack } from '../../src/content/bosses.ts';
import { Rng } from '../../src/core/rng.ts';
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
  const combos: (Attack & { open: string })[] = [];
  for (let k = 0; k < 2 && ends.length && first.length; k++) {
    const a = first[k % first.length];
    const others = ends.filter((x) => key(x) !== key(a));
    if (!others.length) continue;
    const b = others[(k * 2) % others.length];
    combos.push({ ...a, then: { ...b }, name: `${key(a)} i ${key(b)}`, open: key(a) });
  }
  const attacks: Attack[] = [...last.attacks, ...extra, ...combos];
  const before = new Set(def.phases.flatMap((p) => p.attacks.map(key)));
  const fresh = [...new Set(attacks.map(key))].filter((n) => !before.has(n));
  // The picker, as Boss.start: bag, never a third repeat by name.
  const rng = new Rng(12345);
  let bag = 0, lastK = '', repeats = 0;
  const count = (a: Attack): void => { const k = key(a); repeats = k === lastK ? repeats + 1 : 1; lastK = k; };
  const draw = (bagged: boolean): number => {
    const skip = repeats >= 2;
    let n = 0;
    for (let k = 0; k < attacks.length; k++) if ((!bagged || !(bag & (1 << k))) && (!skip || key(attacks[k]) !== lastK)) n++;
    if (!n) return -1;
    let r = Math.floor(rng.next() * n);
    for (let k = 0; k < attacks.length; k++) {
      if ((bagged && bag & (1 << k)) || (skip && key(attacks[k]) === lastK)) continue;
      if (r-- === 0) return k;
    }
    return -1;
  };
  // What lands, combo openings by the attack they copy.
  const landed: string[] = [];
  const N = 200000;
  for (let t = 0; t < N; t++) {
    const full = (1 << attacks.length) - 1;
    if ((bag & full) === full) bag = 0;
    let k = draw(true);
    if (k < 0) k = draw(false);
    if (k < 0) k = Math.floor(rng.next() * attacks.length);
    bag |= 1 << k;
    const a = attacks[k] as Attack & { open?: string };
    count(a);
    landed.push(a.open ?? key(a));
    if (a.then) { count(a.then); landed.push(key(a.then)); }
  }
  let triples = 0, worst = 1, run = 1;
  for (let i = 1; i < landed.length; i++) {
    run = landed[i] === landed[i - 1] ? run + 1 : 1;
    if (run === 3) triples++;
    worst = Math.max(worst, run);
  }
  console.log(`${def.id.padEnd(14)} extra: ${String(new Set(attacks.map(key)).size)} names, new ${String(fresh.length)} (${fresh.join(' / ')}) | combos ${combos.map((c) => c.name).join(' ; ')} | landed 3x in a row: ${String(triples)} per ${String(N)} draws (${((triples / N) * 100).toFixed(2)}%), longest ${String(worst)}`);
}
