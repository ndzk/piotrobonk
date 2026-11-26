// What passives do to each weapon's budget: every weapon at its top level on the budget bench (crowd and single
// dummy, as scripts/sim/budget.ts), bare and with Bilet Ulgowy 2 / Energetyk 5 / Okulary 5. The budget is fitted
// bare; a passive that multiplies one weapon and not another moves it off the curve in every real run.
// Needs the bundle rt.ts built (RT_BUNDLE, default redteam-rt.mjs). node scripts/redteam/amount.ts [--watki=6]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPONS } from '../../src/content/items.ts';
import { runPool, SIM_DIR } from '../sim/pool.ts';
import type { DpsJob, DpsResult } from '../sim/types.ts';

const SETS: Record<string, { id: string; level: number }[]> = {
  bare: [],
  bilet: [{ id: 'bilet-ulgowy', level: 2 }],
  energetyk: [{ id: 'energetyk', level: 5 }],
  okulary: [{ id: 'okulary', level: 5 }],
};
const jobs: (DpsJob & { set: string })[] = [];
for (const w of WEAPONS)
  for (const set of Object.keys(SETS))
    for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, set, dps: { weapon: w.id, level: w.levels.length + 1, scene, seconds: 20, passives: SETS[set] } });
const threads = Number(process.argv.find((a) => a.startsWith('--watki='))?.slice(8) ?? 6);
const rs = await runPool<DpsResult>(join(SIM_DIR, process.env.RT_BUNDLE ?? 'redteam-rt.mjs'), jobs, { threads });
const get = (w: string, set: string, scene: string): number => rs[jobs.findIndex((j) => j.dps.weapon === w && j.set === set && j.dps.scene === scene)].dps;
const out: string[] = ['| weapon | bare power | bilet power × | energetyk ×  | okulary × | bare single | bilet single × |', '|---|---:|---:|---:|---:|---:|---:|'];
for (const w of WEAPONS) {
  const pw = (set: string): number => Math.sqrt(get(w.id, set, 'crowd') * get(w.id, set, 'single'));
  const b = pw('bare');
  out.push(`| ${w.id} | ${b.toFixed(0)} | ${(pw('bilet') / b).toFixed(2)} | ${(pw('energetyk') / b).toFixed(2)} | ${(pw('okulary') / b).toFixed(2)} | ${get(w.id, 'bare', 'single').toFixed(0)} | ${(get(w.id, 'bilet', 'single') / get(w.id, 'bare', 'single')).toFixed(2)} |`);
}
writeFileSync(join(import.meta.dirname, 'out', 'amount.md'), out.join('\n'));
console.log(out.join('\n'));
process.exit(0);
