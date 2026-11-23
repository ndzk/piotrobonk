// Boss kill times against the oracle with the best loadout it really builds (BALANCE.md, "Bossowie").
// 1) node scripts/sim/bossfight.ts --zestawy=a.json,b.json   picks, for every boss, the three strongest loadouts
//    any bot met it with in those runs (weapon power on the budget curve, different weapons each) and saves
//    scripts/sim/data/loadouts.json;
// 2) node scripts/sim/bossfight.ts [--seedy=6] [--watki=14]          the oracle, mortal, fights every boss with
//    that loadout on every seed: the fastest and the median kill, held against TUNING.boss.fight (exit 1 when a
//    boss dies faster than its minimum);
//    --kalibruj prints the boss health factor that puts the median in the middle of the band and the fastest
//    above the minimum.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPONS } from '../../src/content/items.ts';
import { TUNING } from '../../src/content/tuning.ts';
import { hashSeed } from '../../src/core/rng.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import { STATIONS } from './report.ts';
import type { Job, Loadout, RunResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DATA = join(import.meta.dirname, 'data', 'loadouts.json');
const BOSSES = STATIONS.filter((s) => s !== 'koluszki').concat('koluszki');

/** A loadout's weapon power on the budget curve (scripts/sim/budget.ts): what makes it the strongest. */
function power(l: Loadout): number {
  let p = 0;
  for (const w of l.weapons) {
    const def = WEAPONS.find((d) => d.id === w.id);
    if (!def) continue;
    p += def.evolved ? 150 : 100 * 1.125 ** (w.level - (def.levels.length + 1));
  }
  return p;
}

const source = arg('zestawy');
if (source) {
  const rs = source.split(',').flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as RunResult[]);
  const best: Record<string, Loadout[]> = {};
  const kit = (l: Loadout): string => l.weapons.map((w) => w.id).sort().join('+');
  for (const st of BOSSES) {
    const list = rs.filter((r) => r.station === st && r.bossLoadout).map((r) => r.bossLoadout as Loadout).sort((a, b) => power(b) - power(a));
    // The three strongest, no two with the same weapons.
    const picked: Loadout[] = [];
    for (const l of list) if (picked.length < 3 && !picked.some((x) => kit(x) === kit(l))) picked.push(l);
    if (picked.length) best[st] = picked;
  }
  mkdirSync(join(import.meta.dirname, 'data'), { recursive: true });
  writeFileSync(DATA, `${JSON.stringify(best, null, 1)}\n`);
  for (const [st, ls] of Object.entries(best)) for (const l of ls) console.log(`${st}: power ${power(l).toFixed(0)} — ${l.weapons.map((w) => `${w.id} ${String(w.level)}`).join(', ')}`);
  process.exit(0);
}

const loadouts = JSON.parse(readFileSync(DATA, 'utf8')) as Record<string, Loadout[]>;
const seeds = Number(arg('seedy') ?? 6);
const jobs: Job[] = [];
for (const st of BOSSES) {
  for (const l of loadouts[st] ?? [])
    for (let k = 0; k < seeds; k++)
      jobs.push({ id: jobs.length, seed: hashSeed(`bossfight:${String(k)}`), station: st, difficulty: 'normalnie', skill: 'good', variant: st, planner: 'oracle', bossBench: { weapons: [], passives: [], levels: l, mortal: true }, cap: 1500 });
}
const rs = await runPool<RunResult>(await buildWorker(), jobs, { threads: Number(arg('watki') ?? 14), onResult: (d, n) => process.stdout.write(`\r${String(d)}/${String(n)}`) });
mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, 'bossfight.json'), JSON.stringify(rs));
const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
};
let bad = 0;
const out = ['', '| boss | wygrane | najszybciej | mediana | minimum | cel | czynnik HP |', '|---|---:|---:|---:|---:|---:|---:|'];
for (const st of BOSSES) {
  const l = rs.filter((r) => r.station === st);
  if (!l.length) continue;
  const won = l.filter((r) => r.outcome === 'won' && r.bossTo > 0);
  const ttk = won.map((r) => r.bossTo - r.bossFrom);
  const [lo, hi] = TUNING.boss.fight[st];
  const fastest = ttk.length ? Math.min(...ttk) : NaN;
  const m = med(ttk);
  if (!(fastest >= lo)) bad++;
  // Kill time grows about in step with health past the phase changes: the factor that puts the median in the
  // middle of the band, raised if the fastest would still be under the minimum.
  const fixed = TUNING.boss.transition * 2;
  const want = Math.max((lo + hi) / 2 - fixed, 1) / Math.max(m - fixed, 1);
  const floor = Math.max(lo - fixed, 1) / Math.max(fastest - fixed, 1);
  out.push(`| ${st} | ${String(won.length)}/${String(l.length)} | ${fastest.toFixed(0)} s | ${m.toFixed(0)} s | ${String(lo)} s | ${String(lo)}–${String(hi)} s | ×${Math.max(want, floor).toFixed(2)} |`);
}
console.log(out.join('\n'));
console.log(bad ? `${String(bad)} bosses die faster than their minimum` : 'no boss dies faster than its minimum');
process.exit(bad ? 1 : 0);
