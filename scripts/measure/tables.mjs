// Tables for BALANCE.md from a measurement's raw runs (.sim/<prefix>-*.json). node scripts/measure/tables.mjs [prefix]
import { existsSync, readFileSync } from 'node:fs';
const P = process.argv[2] ?? "k";
const ST = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
const NAME = { fabryczna: 'Fabryczna', niciarniana: 'Niciarniana', widzew: 'Widzew', andrzejow: 'Andrzejów', bedon: 'Bedoń', justynow: 'Justynów', galkowek: 'Gałkówek', zakowice: 'Żakowice', koluszki: 'Koluszki' };
const load = (n) => (existsSync(`.sim/${P}-${n}.json`) ? ((j) => (Array.isArray(j) ? j : (j.runs ?? [])))(JSON.parse(readFileSync(`.sim/${P}-${n}.json`, 'utf8'))) : null);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '–');
const med = (l) => { if (!l.length) return NaN; const s = [...l].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const won = (r) => r.outcome === 'won';
const fight = (r) => (r.bossTo > 0 ? r.bossTo - r.bossFrom : NaN);
const days = (runs) => [...new Set(runs.map((r) => r.seed))].length;

function winTable(runs, title) {
  if (!runs) return `${title}: brak pliku\n`;
  const out = [`| stacja | wygrane | % | śmierć przed bossem | śmierć u bossa |`, `|---|---:|---:|---:|---:|`];
  let W = 0;
  for (const s of ST) {
    const l = runs.filter((r) => r.station === s);
    const w = l.filter(won).length;
    W += w;
    const pre = l.filter((r) => !won(r) && !(r.bossFrom > 0 && r.time > r.bossFrom)).length;
    out.push(`| ${NAME[s]} | ${w}/${l.length} | ${pct(w, l.length)} | ${pre} | ${l.length - w - pre} |`);
  }
  out.push(`| **razem** | **${W}/${runs.length}** | **${pct(W, runs.length)}** | | |`);
  return `${title} (${runs.length} runów, ${days(runs)} seedów)\n\n${out.join('\n')}\n`;
}

const human = load('human');
const oracle = load('oracle');
console.log(winTable(human, `Human, Normalnie, plany ${[...new Set((human ?? []).map((r) => r.variant))].join('+')}`));
if (human) {
  // Per variant per station.
  const vs = [...new Set(human.map((r) => r.variant))];
  const rows = [`| stacja | ${vs.join(' | ')} |`, `|---|${vs.map(() => '---:').join('|')}|`];
  for (const s of ST) rows.push(`| ${NAME[s]} | ${vs.map((v) => { const l = human.filter((r) => r.station === s && r.variant === v); return `${l.filter(won).length}/${l.length}`; }).join(' | ')} |`);
  console.log(rows.join('\n'), '\n');
  // Tension.
  const t = human;
  const low = t.map((r) => r.lowEpisodes ?? 0);
  const atBoss = t.filter((r) => r.bossFrom > 0 && r.bossHp != null).map((r) => r.bossHp);
  const near = t.map((r) => r.nearShare ?? 0);
  console.log(`napięcie Human: HP<30% na run ${(low.reduce((a, b) => a + b, 0) / low.length).toFixed(2)} (≥3: ${pct(low.filter((x) => x >= 3).length, low.length)}); HP przy bossie mediana ${Math.round(100 * med(atBoss))}%, w 40–60%: ${pct(atBoss.filter((x) => x >= 0.4 && x <= 0.6).length, atBoss.length)}; wróg ≤5 m średnio ${Math.round((100 * near.reduce((a, b) => a + b, 0)) / near.length)}% czasu, >50%: ${pct(near.filter((x) => x > 0.5).length, near.length)}\n`);
}
if (oracle) {
  console.log(winTable(oracle, 'Oracle, Normalnie, plan A'));
  const rows = ['| stacja | Oracle: walka (min / mediana) | Human: walka (mediana) | Human / Oracle | minimum | cel Oracle |', '|---|---:|---:|---:|---:|---|'];
  const T = { fabryczna: '120–150', niciarniana: '120–150', widzew: '120–150', andrzejow: '150–180', bedon: '150–180', justynow: '150–180', galkowek: '165–210', zakowice: '165–210', koluszki: '240–300' };
  const MIN = { fabryczna: 120, niciarniana: 120, widzew: 120, andrzejow: 135, bedon: 135, justynow: 135, galkowek: 150, zakowice: 150, koluszki: 210 };
  for (const s of ST) {
    const o = oracle.filter((r) => r.station === s && won(r)).map(fight).filter(Number.isFinite);
    const h = (human ?? []).filter((r) => r.station === s && won(r)).map(fight).filter(Number.isFinite);
    rows.push(`| ${NAME[s]} | ${o.length ? `${Math.round(Math.min(...o))} / ${Math.round(med(o))} s` : '–'} | ${h.length ? `${Math.round(med(h))} s` : '–'} | ${o.length && h.length ? `×${(med(h) / med(o)).toFixed(2)}` : '–'} | ${MIN[s]} s | ${T[s]} s |`);
  }
  console.log(rows.join('\n'), '\n');
}
for (const [n, t] of [['casual-spok', 'Casual, Spokojny'], ['casual-norm', 'Casual, Normalnie'], ['human-opo', 'Human, Opóźnienie 120 min, plan A'], ['oracle-top', 'Oracle, Normalnie + drabinka 19 (szczyt), plan A']]) console.log(winTable(load(n), t));
const random = load('random') && [...load('random'), ...(load('random2') ?? [])];
for (const [n, runs] of [['Human (wszystkie plany)', human], [`18 losowych planów (${random ? new Set(random.map((r) => r.seed)).size : 0} dni)`, random]]) {
  if (!runs) continue;
  const wins = runs.filter(won);
  const W = {};
  const A = {};
  const base = (id) => ({ 'teczka-prezesa': 'teczka', 'bilet-sieciowy': 'bilet', espresso: 'kawa', kebab: 'sos', powerbank: 'telefon', 'parasol-burzowy': 'parasol', kontrola: 'gwizdek', zgrzewka: 'puszka', 'siec-trakcyjna': 'iskra', 'rozklad-2027': 'rozklad' })[id] ?? id;
  for (const r of runs) for (const w of new Set((r.weapons ?? []).map(base))) { if (w === 'teczka') continue; A[w] = (A[w] ?? 0) + 1; if (won(r)) W[w] = (W[w] ?? 0) + 1; }
  const rows = ['| broń | w wygranych | we wszystkich runach | win rate z bronią | bez niej |', '|---|---:|---:|---:|---:|'];
  const wr = wins.length / runs.length;
  for (const w of Object.keys(A).sort((a, b) => (W[b] ?? 0) - (W[a] ?? 0))) {
    const withW = runs.filter((r) => (r.weapons ?? []).map(base).includes(w));
    const without = runs.filter((r) => !(r.weapons ?? []).map(base).includes(w));
    rows.push(`| ${w} | ${pct(W[w] ?? 0, wins.length)} | ${pct(A[w], runs.length)} | ${pct(withW.filter(won).length, withW.length)} | ${pct(without.filter(won).length, without.length)} |`);
  }
  console.log(`udział broni, ${n}: ${wins.length} wygranych z ${runs.length} (${pct(wins.length, runs.length)})\n\n${rows.join('\n')}\n`);
  void wr;
}
