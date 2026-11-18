// The balance gate for CI: a quick run of the simulation on fixed seeds (the same every time, so the result is
// exact, not noisy). The bot is a sanity check, not the target (it plays worse than a person: BALANCE.md), so the
// bands catch a game that broke (unwinnable, or won standing still), not a few points either way. A change that
// moves the game out of them fails the build; the full measurement is `node scripts/sim.ts`.
// Usage: node scripts/sim-ci.ts [--watki=3]
import { availableParallelism } from 'node:os';
import { hashSeed } from '../src/core/rng.ts';
import { buildWorker, runPool } from './sim/pool.ts';
import { base, cell, STATIONS } from './sim/report.ts';
import type { Job, RunResult } from './sim/types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const threads = Number(arg('watki') ?? Math.max(1, availableParallelism() - 1));
/** Four codzienny kurs days, fixed: CI plays exactly the same 36 runs per bot and kurs every time. */
const SEEDS = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23'].map((d) => hashSeed(`piotrobonk:kurs:${d}`));

const COMBOS: { kurs: Job['difficulty']; skill: Job['skill']; ladder?: number }[] = [
  { kurs: 'spokojny', skill: 'afk' },
  { kurs: 'normalnie', skill: 'afk' },
  { kurs: 'spokojny', skill: 'medium' },
  { kurs: 'normalnie', skill: 'weak' },
  { kurs: 'normalnie', skill: 'medium' },
  { kurs: 'normalnie', skill: 'good' },
  { kurs: 'opoznienie', skill: 'good' },
  { kurs: 'normalnie', skill: 'good', ladder: 20 },
];

const jobs: Job[] = [];
for (const c of COMBOS) for (const station of STATIONS) for (const seed of SEEDS) jobs.push({ id: jobs.length, seed, station, difficulty: c.kurs, skill: c.skill, ladder: c.ladder ?? 0, cap: c.skill === 'afk' ? 600 : 1500 });

const file = await buildWorker();
const t0 = Date.now();
const rs = await runPool<RunResult>(file, jobs, { threads });
const pick = (kurs: string, skill: string, ladder = 0): RunResult[] => rs.filter((r) => r.difficulty === kurs && r.skill === skill && r.ladder === ladder);

interface Check {
  what: string;
  value: number;
  lo: number;
  hi: number;
  fmt: (v: number) => string;
}
const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
const sec = (v: number): string => `${v.toFixed(0)} s`;
const num = (v: number): string => v.toFixed(2);
const checks: Check[] = [];
const check = (what: string, value: number, lo: number, hi: number, fmt: (v: number) => string): void => {
  checks.push({ what, value, lo, hi, fmt });
};

check('AFK Normalnie: średni czas przeżycia', cell(pick('normalnie', 'afk')).time, 0, 95, sec);
check('AFK Spokojny: średni czas przeżycia', cell(pick('spokojny', 'afk')).time, 0, 190, sec);
check('Spokojny, średni bot: wygrane', cell(pick('spokojny', 'medium')).win, 0.65, 1, pct);
check('Normalnie, słaby bot: wygrane', cell(pick('normalnie', 'weak')).win, 0, 0.15, pct);
check('Normalnie, średni bot: wygrane', cell(pick('normalnie', 'medium')).win, 0.03, 0.4, pct);
check('Normalnie, dobry bot: wygrane', cell(pick('normalnie', 'good')).win, 0.12, 0.6, pct);
check('Opóźnienie 120 min, dobry bot: wygrane', cell(pick('opoznienie', 'good')).win, 0.02, 0.35, pct);
// 36 runs see a rate of a few per cent as 0 now and then: "above zero" is the full measurement's job (BALANCE.md).
check('ODWOŁANY (+5 h), dobry bot: wygrane', cell(pick('normalnie', 'good', 20)).win, 0, 0.15, pct);
const normal = [...pick('normalnie', 'medium'), ...pick('normalnie', 'good')];
// The target is 2 and is not reached yet (BALANCE.md, "Czego nie osiągnąłem"): the gate keeps it from falling.
check('Normalnie: sytuacje z HP < 30% na run', cell(normal).low, 0.5, 99, num);
check('Normalnie: HP przy wejściu bossa', cell(normal).bossHp, 0.35, 0.85, pct);
// No weapon may be needed to win: its share of the wins (the start weapon aside), pooled over the medium and good
// bots on Spokojny and Normalnie (one bot's few wins on a hard kurs would make it noise).
const wins = [...pick('spokojny', 'medium'), ...pick('normalnie', 'medium'), ...pick('normalnie', 'good')].filter((r) => r.outcome === 'won');
const share = new Map<string, number>();
for (const r of wins) for (const w of new Set(r.weapons.map(base))) if (w !== 'teczka') share.set(w, (share.get(w) ?? 0) + 1);
const top = [...share].sort((a, b) => b[1] - a[1])[0] as [string, number] | undefined;
check(`Najczęstsza broń w wygranych (${top?.[0] ?? '—'})`, top ? top[1] / Math.max(1, wins.length) : 0, 0, 0.55, pct);

let failed = 0;
for (const c of checks) {
  const ok = c.value >= c.lo && c.value <= c.hi;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'ŹLE '} ${c.what}: ${c.fmt(c.value)} (widełki ${c.fmt(c.lo)}–${c.fmt(c.hi)})`);
}
const stuck = rs.filter((r) => r.outcome === 'timeout');
if (stuck.length) {
  failed++;
  console.log(`ŹLE  ${String(stuck.length)} runów utknęło: ${stuck.map((r) => `${r.station}/${r.difficulty}/${r.skill} w stanie ${r.state}`).join(', ')}`);
}
console.log(`${String(rs.length)} runów w ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exitCode = failed ? 1 : 0;
