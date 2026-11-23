// Measurements behind POSTMORTEM.md: exploit bots against the skilled ones on the same seeds, the crowd
// against the entity cap, and how fast single weapons and full builds kill each boss.
// Usage: node scripts/sim/postmortem.ts [exploits|bench|crowd] [--runs=6] [--kurs=normalnie]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashSeed } from '../../src/core/rng.ts';
import type { ExploitKind } from '../../src/game/bots/exploits.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import { STATIONS } from './report.ts';
import type { Job, RunResult } from './types.ts';

const mode = process.argv[2] ?? 'exploits';
const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const runs = Number(arg('runs') ?? 6);
const kurs = (arg('kurs') ?? 'normalnie') as Job['difficulty'];
const seeds = Array.from({ length: runs }, (_, k) => hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10)}`));
// (Kept here: the game module imports without extensions, which Node alone does not resolve.)
const EXPLOITS: ExploitKind[] = ['stoi', 'kolko', 'dach', 'rog', 'hop', 'kawa', 'tory'];
const OFFENCE = ['energetyk', 'okulary', 'termos', 'bilet-ulgowy', 'zdrapka'];
const WEAPONS = ['teczka', 'bilet', 'kawa', 'sos', 'telefon', 'parasol', 'gwizdek', 'puszka', 'gnat', 'iskra', 'rozklad', 'teczka-prezesa', 'bilet-sieciowy', 'espresso', 'kebab', 'powerbank', 'parasol-burzowy', 'kontrola', 'zgrzewka', 'siec-trakcyjna', 'rozklad-2027'];
const BOSSES = STATIONS.filter((s) => s !== 'koluszki');

const jobs: Job[] = [];
const add = (j: Omit<Job, 'id'>): void => {
  jobs.push({ ...j, id: jobs.length });
};
if (mode === 'exploits' || mode === 'crowd') {
  for (const station of STATIONS)
    for (const seed of seeds) {
      if (mode === 'exploits') for (const kind of EXPLOITS) add({ seed, station, difficulty: kurs, skill: 'afk', variant: kind, exploit: kind, cap: 900 });
      for (const skill of ['medium', 'good'] as const) add({ seed, station, difficulty: kurs, skill, cap: 1500 });
    }
} else {
  const builds: [string, { weapons: string[]; passives: string[] }][] = WEAPONS.map((w) => [w, { weapons: [w], passives: OFFENCE }]);
  const extra = arg('builds');
  if (extra) for (const b of extra.split(';')) builds.push([b, { weapons: b.split('+'), passives: OFFENCE }]);
  for (const [name, build] of builds) for (const station of BOSSES) for (const seed of seeds.slice(0, 2)) add({ seed, station, difficulty: kurs, skill: 'good', variant: name, bossBench: build, cap: 1500 });
}

const file = await buildWorker();
const t0 = Date.now();
const rs = await runPool<RunResult>(file, jobs, { threads: 14 });
mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, `postmortem-${mode}.json`), JSON.stringify(rs));
const out: string[] = [`# ${mode} (${kurs}, ${String(rs.length)} runów, ${String(Math.round((Date.now() - t0) / 1000))} s)`, ''];
const group = <K extends string>(list: RunResult[], key: (r: RunResult) => K): Map<K, RunResult[]> => {
  const m = new Map<K, RunResult[]>();
  for (const r of list) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
};
const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
};
if (mode === 'exploits' || mode === 'crowd') {
  out.push('| bot | wygrane | > 3 min | czas życia (mediana) | czas życia (max) | najwięcej wrogów | próbki przy suficie |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const [v, list] of group(rs, (r) => r.variant)) {
    const won = list.filter((r) => r.outcome === 'won').length;
    const over = list.filter((r) => r.outcome === 'won' || r.time > 180).length;
    const crowd = list.flatMap((r) => r.crowd);
    out.push(`| ${v} | ${String(won)}/${String(list.length)} | ${String(over)}/${String(list.length)} | ${med(list.map((r) => r.time)).toFixed(0)} s | ${Math.max(...list.map((r) => r.time)).toFixed(0)} s | ${String(Math.max(...crowd))} | ${String(crowd.filter((c) => c >= 470).length)}/${String(crowd.length)} |`);
  }
  // The crowd over the run, by minute (all skilled runs).
  out.push('', '| minuta | wrogów (mediana, dobry bot) | max |', '|---:|---:|---:|');
  const good = rs.filter((r) => r.variant === 'good');
  for (let m = 0; m < 10; m++) {
    const v = good.flatMap((r) => r.crowd.slice(m * 12, m * 12 + 12));
    if (v.length) out.push(`| ${String(m)} | ${String(med(v))} | ${String(Math.max(...v))} |`);
  }
} else {
  out.push('| build | ' + BOSSES.join(' | ') + ' | min |', '|---|' + BOSSES.map(() => '---:').join('|') + '|---:|');
  for (const [v, list] of group(rs, (r) => r.variant)) {
    const ttk = BOSSES.map((st) => {
      const l = list.filter((r) => r.station === st && r.outcome === 'won' && r.bossTo > 0);
      return l.length ? Math.min(...l.map((r) => r.bossTo - r.bossFrom)) : NaN;
    });
    out.push(`| ${v} | ${ttk.map((t) => (Number.isNaN(t) ? '–' : t.toFixed(0))).join(' | ')} | ${Math.min(...ttk.filter((t) => !Number.isNaN(t))).toFixed(0)} |`);
  }
}
const text = out.join('\n');
writeFileSync(join(SIM_DIR, `postmortem-${mode}.md`), text);
console.log(text);
