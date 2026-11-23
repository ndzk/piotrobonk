// Every weapon's damage per second at every level, against dummies (scripts/sim/worker.ts `dps`): a crowd
// (forty in a disc round Piotrek) and a single target. Its power is the geometric mean of the two (a weapon
// for crowds and one for bosses weigh the same), held against the reference curve (BALANCE.md, "Bronie"):
// 100 at the top level, 12,5 % less for every level below; an evolution 150; weapons that stun or slow 80 %.
// Usage: node scripts/sim/budget.ts                 the table
//        node scripts/sim/budget.ts --zapisz        refit src/content/budget.ts to the curve
//        node scripts/sim/budget.ts --sprawdz       exit 1 if any weapon at any level is off by more than 15 %
//        [--bron=teczka,gnat] [--sekundy=20] [--watki=14]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPON_BUDGET } from '../../src/content/budget.ts';
import { WEAPONS, type WeaponDef } from '../../src/content/items.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import type { DpsJob, DpsResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = arg('bron')?.split(',');
const seconds = Number(arg('sekundy') ?? 20);
const write = process.argv.includes('--zapisz');
const check = process.argv.includes('--sprawdz');
const list = WEAPONS.filter((w) => !only || only.includes(w.id));

/** The reference curve: power at the top level, per level step, for an evolution, for utility weapons. */
export const CURVE = { top: 100, step: 1.125, evolution: 150, utility: 0.8, tolerance: 0.15 };
const baseOf = (w: WeaponDef): WeaponDef => WEAPONS.find((b) => b.evolution?.into === w.id) ?? w;
export function target(w: WeaponDef, level: number): number {
  const util = baseOf(w).perks?.some((p) => p === 'stun' || p === 'slow') ? CURVE.utility : 1;
  if (w.evolved) return CURVE.evolution * util;
  return CURVE.top * CURVE.step ** (level - (w.levels.length + 1)) * util;
}

const jobs: DpsJob[] = [];
for (const w of list)
  for (let level = 1; level <= w.levels.length + 1; level++)
    for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: w.id, level, scene, seconds } });
const file = await buildWorker();
const rs = await runPool<DpsResult>(file, jobs, { threads: Number(arg('watki') ?? 14) });
interface Row {
  weapon: string;
  level: number;
  crowd: number;
  single: number;
  power: number;
  target: number;
}
const rows: Row[] = [];
for (const w of list)
  for (let level = 1; level <= w.levels.length + 1; level++) {
    const get = (scene: string): number => rs[jobs.findIndex((j) => j.dps.weapon === w.id && j.dps.level === level && j.dps.scene === scene)].dps;
    const crowd = get('crowd');
    const single = get('single');
    rows.push({ weapon: w.id, level, crowd, single, power: Math.sqrt(crowd * single), target: target(w, level) });
  }
mkdirSync(SIM_DIR, { recursive: true });
writeFileSync(join(SIM_DIR, 'budget.json'), JSON.stringify(rows));
const out = ['| broń | poziom | DPS w tłum | DPS w jeden cel | moc | cel | odchylenie |', '|---|---:|---:|---:|---:|---:|---:|'];
let off = 0;
for (const r of rows) {
  const dev = r.power / r.target - 1;
  if (Math.abs(dev) > CURVE.tolerance) off++;
  out.push(`| ${r.weapon} | ${String(r.level)} | ${r.crowd.toFixed(0)} | ${r.single.toFixed(0)} | ${r.power.toFixed(0)} | ${r.target.toFixed(0)} | ${dev >= 0 ? '+' : ''}${(dev * 100).toFixed(0)}% |`);
}
console.log(out.join('\n'));
if (write) {
  // Power is proportional to damage: the new multiplier is the old one times target over measured.
  const table: Record<string, number[]> = {};
  for (const w of WEAPONS) {
    const old = WEAPON_BUDGET[w.id] ?? [];
    table[w.id] = Array.from({ length: w.levels.length + 1 }, (_, k) => {
      const r = rows.find((x) => x.weapon === w.id && x.level === k + 1);
      const m = old[k] ?? 1;
      return r && r.power > 0 ? Math.round(m * (r.target / r.power) * 1000) / 1000 : m;
    });
  }
  const body = Object.entries(table)
    .map(([id, v]) => `  '${id}': [${v.join(', ')}],`)
    .join('\n');
  const head = [
    '// Weapon power budgets (BALANCE.md, "Bronie"): a damage multiplier per weapon and level that puts every weapon',
    '// on the reference curve. Written by `node scripts/sim/budget.ts --zapisz` from the dummy bench; checked in CI',
    '// by `node scripts/sim/budget.ts --sprawdz` (every weapon within ±15 % of its target at every level).',
    '// Generated: do not edit by hand.',
    '',
  ].join('\n');
  writeFileSync(join(import.meta.dirname, '../../src/content/budget.ts'), `${head}\nexport const WEAPON_BUDGET: Partial<Record<string, readonly number[]>> = {\n${body}\n};\n`);
  console.log('src/content/budget.ts refitted');
}
console.log(off ? `${String(off)} weapon levels off the curve by more than ${String(CURVE.tolerance * 100)}%` : `every weapon level within ±${String(CURVE.tolerance * 100)}% of the curve`);
process.exit(check && off ? 1 : 0);
