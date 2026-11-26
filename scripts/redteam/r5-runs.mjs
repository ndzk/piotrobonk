// Red team round 5: recompute from raw sim runs (.sim/<x>.json). node scripts/redteam/r5-runs.mjs <file.json>...
// Per variant × station: wins / runs, the fastest boss kill vs its minimum (TUNING.boss.fight[st][0]); per file the
// share of wins each weapon took part in (evolutions folded into their base weapon, as the bots.ts report does not).
import { readFileSync } from 'node:fs';
const MIN = { fabryczna: 120, niciarniana: 120, widzew: 120, andrzejow: 135, bedon: 135, justynow: 135, galkowek: 150, zakowice: 150, koluszki: 210 };
const EVO = { 'teczka-prezesa': 'teczka', 'bilet-sieciowy': 'bilet', espresso: 'kawa', kebab: 'sos', powerbank: 'telefon', 'parasol-burzowy': 'parasol', kontrola: 'gwizdek', zgrzewka: 'puszka', 'siec-trakcyjna': 'iskra', 'rozklad-2027': 'rozklad' };
const ST = Object.keys(MIN);
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const runs = Array.isArray(j) ? j : j.runs;
  console.log(`\n# ${f}: ${String(runs.length)} runs, kurs ${[...new Set(runs.map((r) => r.difficulty))].join(',')}`);
  const vs = [...new Set(runs.map((r) => r.variant))];
  console.log(`| variant | ${ST.join(' | ')} | all |\n|---|${ST.map(() => '---:').join('|')}|---:|`);
  for (const v of vs) {
    const cell = (l) => `${String(l.filter((r) => r.outcome === 'won').length)}/${String(l.length)}`;
    console.log(`| ${v} | ${ST.map((s) => cell(runs.filter((r) => r.variant === v && r.station === s))).join(' | ')} | ${cell(runs.filter((r) => r.variant === v))} |`);
  }
  // Pooled over variants, with a Wilson 95 % interval (5 runs a cell say little on their own).
  const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n)); return [(c - h) / d, (c + h) / d]; };
  console.log(`pooled: ${ST.map((s) => { const l = runs.filter((r) => r.station === s); const k = l.filter((r) => r.outcome === 'won').length; if (!l.length) return `${s} –`; const [lo, hi] = wilson(k, l.length); return `${s} ${String(k)}/${String(l.length)} ${((100 * k) / l.length).toFixed(0)}% [${(100 * lo).toFixed(0)}–${(100 * hi).toFixed(0)}]`; }).join(', ')}`);
  const kills = runs.filter((r) => r.bossTo > 0).map((r) => ({ s: r.station, v: r.variant, t: r.bossTo - r.bossFrom }));
  const under = kills.filter((k) => k.t < MIN[k.s]);
  console.log(`boss kills: ${String(kills.length)}, under minimum: ${String(under.length)} ${under.map((k) => `${k.v}@${k.s} ${k.t.toFixed(1)}s`).join(', ')}`);
  console.log(`fastest kill per station: ${ST.map((s) => { const t = kills.filter((k) => k.s === s).map((k) => k.t); return t.length ? `${s} ${Math.min(...t).toFixed(0)}/${String(MIN[s])}` : `${s} –`; }).join(', ')}`);
  const won = runs.filter((r) => r.outcome === 'won');
  const share = {};
  for (const r of won) for (const w of new Set((r.weapons ?? []).map((x) => EVO[x] ?? x))) share[w] = (share[w] ?? 0) + 1;
  console.log(`wins ${String(won.length)}: weapon in share of wins: ${Object.entries(share).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${((100 * n) / won.length).toFixed(0)}%`).join(', ')}`);
  // Share of all weapon damage dealt in wins, per weapon (the "carries the run" view).
  const dmg = {};
  let tot = 0;
  for (const r of won) for (const [w, d] of Object.entries(r.weaponDamage ?? {})) { const k = EVO[w] ?? w; dmg[k] = (dmg[k] ?? 0) + d; tot += d; }
  if (tot) console.log(`damage share in wins: ${Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([w, d]) => `${w} ${((100 * d) / tot).toFixed(0)}%`).join(', ')}`);
}
