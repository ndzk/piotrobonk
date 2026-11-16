// The before/after table of BALANCE.md from two simulation result files (.sim/<name>.json).
// Usage: node scripts/sim/compare.ts .sim/przed.json .sim/po.json
import { readFileSync } from 'node:fs';
import { base, cell } from './report.ts';
import type { RunResult } from './types.ts';

const [beforeFile, afterFile] = process.argv.slice(2);
if (!beforeFile || !afterFile) throw new Error('node scripts/sim/compare.ts <przed.json> <po.json>');
const before = JSON.parse(readFileSync(beforeFile, 'utf8')) as RunResult[];
const after = JSON.parse(readFileSync(afterFile, 'utf8')) as RunResult[];

const pick = (rs: RunResult[], kurs: string, skill: string): RunResult[] => rs.filter((r) => r.difficulty === kurs && r.skill === skill && r.ladder === 0);
const pct = (v: number): string => (Number.isNaN(v) ? '—' : `${String(Math.round(v * 100))}%`);
const s0 = (v: number): string => (Number.isNaN(v) ? '—' : `${String(Math.round(v))} s`);
const f1 = (v: number): string => (Number.isNaN(v) ? '—' : v.toFixed(1).replace('.', ','));
const f0 = (v: number): string => (Number.isNaN(v) ? '—' : String(Math.round(v)));

/** Share of the good bot's wins on Normalnie that held the most common weapon (the start weapon aside). */
function topWeapon(rs: RunResult[]): string {
  const wins = rs.filter((r) => r.outcome === 'won');
  const n = new Map<string, number>();
  for (const r of wins) for (const w of new Set(r.weapons.map(base))) if (w !== 'teczka') n.set(w, (n.get(w) ?? 0) + 1);
  const top = [...n].sort((a, b) => b[1] - a[1])[0] as [string, number] | undefined;
  return top ? `${top[0]} ${pct(top[1] / Math.max(1, wins.length))}` : '—';
}

const rows: [string, (rs: RunResult[]) => string, string][] = [
  ['AFK, Normalnie: czas przeżycia', (rs) => s0(cell(pick(rs, 'normalnie', 'afk')).time), '< 90 s'],
  ['AFK, Spokojny: czas przeżycia', (rs) => s0(cell(pick(rs, 'spokojny', 'afk')).time), '< 180 s'],
  ['Spokojny, średni bot: wygrane', (rs) => pct(cell(pick(rs, 'spokojny', 'medium')).win), '~85%'],
  ['Normalnie, dobry bot: wygrane', (rs) => pct(cell(pick(rs, 'normalnie', 'good')).win), '60–65%'],
  ['Normalnie, średni bot: wygrane', (rs) => pct(cell(pick(rs, 'normalnie', 'medium')).win), '30–35%'],
  ['Normalnie, słaby bot: wygrane', (rs) => pct(cell(pick(rs, 'normalnie', 'weak')).win), '< 10%'],
  ['Opóźnienie 120 min, dobry bot: wygrane', (rs) => pct(cell(pick(rs, 'opoznienie', 'good')).win), '25–30%'],
  ['Normalnie (średni + dobry): sytuacje HP < 30% na run', (rs) => f1(cell([...pick(rs, 'normalnie', 'medium'), ...pick(rs, 'normalnie', 'good')]).low), '≥ 2'],
  ['Normalnie (średni + dobry): HP przy wejściu bossa', (rs) => pct(cell([...pick(rs, 'normalnie', 'medium'), ...pick(rs, 'normalnie', 'good')]).bossHp), '50–70%'],
  ['Normalnie, dobry bot: obrażenia otrzymane na minutę', (rs) => f0(cell(pick(rs, 'normalnie', 'good')).takenPerMin), '–'],
  ['Normalnie, dobry bot: leczenie na minutę', (rs) => f0(cell(pick(rs, 'normalnie', 'good')).healPerMin), '–'],
  ['Normalnie, dobry bot: czas walki z bossem (wygrane)', (rs) => s0(cell(pick(rs, 'normalnie', 'good')).bossKill), '–'],
  ['Normalnie, dobry bot: minuta 1. ewolucji', (rs) => f1(cell(pick(rs, 'normalnie', 'good')).evoMinute), '≥ 4,5'],
  ['Normalnie, dobry bot: najczęstsza broń w wygranych', (rs) => topWeapon(pick(rs, 'normalnie', 'good')), '≤ 30%'],
];

console.log('| miara | przed | po | cel |');
console.log('|---|---:|---:|---|');
for (const [what, f, target] of rows) console.log(`| ${what} | ${f(before)} | ${f(after)} | ${target} |`);
