// The planning bots on fixed seeds: win rate, how long they last, health at the boss, and what it cost.
// Usage: node scripts/sim/bots.ts [--boty=oracle,human,casual] [--runs=4] [--kurs=normalnie] [--stacje=fabryczna,widzew]
//        [--build=parasol+gwizdek+teczka+gnat/klapki+zdrapka+okulary] [--watki=14] [--od=0 (first seed day)] [--cap=1500 (game seconds)] [--drabinka=0 (ladder rung: Normalnie only, the game ignores it on other kursy)]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPONS } from '../../src/content/items.ts';
import { hashSeed } from '../../src/core/rng.ts';
import type { BuildPlan, PlannerKind, PlannerProfile } from '../../src/game/bots/planner.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import { STATIONS } from './report.ts';
import type { Job, RunResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const kinds = (arg('boty') ?? 'oracle,human,casual').split(',') as PlannerKind[];
const runs = Number(arg('runs') ?? 4);
const kurs = (arg('kurs') ?? 'normalnie') as Job['difficulty'];
const stations = arg('stacje')?.split(',') ?? STATIONS;
const b = arg('build');
const plan = (x: string): BuildPlan => ({ weapons: x.split('/')[0].split('+'), passives: (x.split('/')[1] ?? '').split('+').filter(Boolean) });
const build: BuildPlan | undefined = b ? plan(b) : undefined;
/** The same seeds as every other measurement: codzienny kurs days from 1 January 2026. */
const from = Number(arg('od') ?? 0);
const seeds = Array.from({ length: runs }, (_, k) => hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 0, 1 + from + k)).toISOString().slice(0, 10)}`));

// --warianty=file.json: { name: [kind, profile changes] } played instead of the plain kinds, on the same seeds.
const vfile = arg('warianty');
// A variant may also change TUNING for its runs and play its own build:
// { name: [kind, profile changes, { "dotted.path": value }, "w1+w2/p1+p2"] }.
const variants: [string, PlannerKind, Partial<PlannerProfile>, Record<string, unknown>?, string?][] = vfile
  ? Object.entries(JSON.parse(readFileSync(vfile, 'utf8')) as Record<string, [PlannerKind, Partial<PlannerProfile>, Record<string, unknown>?, string?]>).map(([n, [k, t, w, p]]) => [n, k, t, w, p])
  : kinds.map((k) => [k, k, {}]);
const jobs: Job[] = [];
for (const [name, kind, ptune, tweak, own] of variants) {
  const bp = own ? plan(own) : build;
  for (const station of stations) for (const seed of seeds) jobs.push({ id: jobs.length, seed, station, difficulty: kurs, ladder: Number(arg('drabinka') ?? 0), skill: 'good', variant: name, planner: kind, ptune, ...(tweak ? { tweak } : {}), ...(bp ? { build: bp } : {}), cap: Number(arg('cap') ?? 1500) });
}
const file = await buildWorker();
const t0 = Date.now();
const rs = await runPool<RunResult>(file, jobs, { threads: Number(arg('watki') ?? 14), onResult: (d, n) => process.stdout.write(`\r${String(d)}/${String(n)}`) });
const wall = (Date.now() - t0) / 1000;
mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, `${arg('plik') ?? `bots-${kurs}`}.json`), JSON.stringify(rs));
const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
};
const out = [`\n# Boty planujące (${kurs}, ${String(rs.length)} runów, ${wall.toFixed(0)} s)`, '', '| bot | stacja | wygrane | czas (mediana) | HP przy bossie | HP<30% na run | wróg ≤5 m | rollouty/run | s/run |', '|---|---|---:|---:|---:|---:|---:|---:|---:|'];
for (const [kind] of variants)
  for (const st of stations) {
    const l = rs.filter((r) => r.variant === kind && r.station === st);
    const won = l.filter((r) => r.outcome === 'won').length;
    const hp = l.filter((r) => r.bossHp >= 0).map((r) => r.bossHp);
    out.push(`| ${kind} | ${st} | ${String(won)}/${String(l.length)} | ${med(l.map((r) => r.time)).toFixed(0)} s | ${hp.length ? `${(med(hp) * 100).toFixed(0)}%` : '–'} | ${(l.reduce((s, r) => s + r.lowEpisodes, 0) / l.length).toFixed(1)} | ${((l.reduce((s, r) => s + r.nearShare, 0) / l.length) * 100).toFixed(0)}% | ${med(l.map((r) => r.rollouts)).toFixed(0)} | ${(med(l.map((r) => r.ms)) / 1000).toFixed(1)} |`);
  }
console.log(out.join('\n'));

// "No weapon in more than ~30 % of the Human's wins" (BALANCE.md, "Bronie"): each weapon (an evolution counts as
// its base) by the share of wins it was held in at the end. Teczka is everyone's first weapon and is left out.
const base = (id: string): string => WEAPONS.find((w) => w.evolution?.into === id)?.id ?? id;
const share = ['', '| bot | wygrane | broń: udział w wygranych |', '|---|---:|---|'];
for (const [kind] of variants) {
  const wins = rs.filter((r) => r.variant === kind && r.outcome === 'won');
  const n: Record<string, number> = {};
  for (const r of wins) for (const w of new Set(r.weapons.map(base))) if (w !== 'teczka') n[w] = (n[w] ?? 0) + 1;
  const list = Object.entries(n).sort((a, b) => b[1] - a[1]).map(([w, c]) => `${w} ${((100 * c) / wins.length).toFixed(0)}%`);
  share.push(`| ${kind} | ${String(wins.length)} | ${list.join(', ') || '–'} |`);
}
console.log(share.join('\n'));
