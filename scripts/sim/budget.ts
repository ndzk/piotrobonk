// Every weapon's damage per second at every level, against dummies (scripts/sim/worker.ts `dps`): a crowd
// (forty in a disc round Piotrek) and a single target. Its power is the geometric mean of the two (a weapon
// for crowds and one for bosses weigh the same), held against the reference curve (BALANCE.md, "Bronie"):
// 100 at the top level, 12,5 % less for every level below; an evolution 150; weapons that stun or slow 80 %;
// times each weapon's PLAY factor (its value in real runs the bench cannot see, at most ±15 %).
// Usage: node scripts/sim/budget.ts                 the table
//        node scripts/sim/budget.ts --zapisz        refit src/content/budget.ts to the curve
//        node scripts/sim/budget.ts --sprawdz       exit 1 if any weapon at any level is off by more than 15 %
//        node scripts/sim/budget.ts --cs [--zapisz|--sprawdz]   every CS gun on Gnat z CS at its top level,
//                                                    held against the default gun (the same power ±15 %)
//        [--bron=teczka,gnat] [--sekundy=20] [--watki=14]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUN_BUDGET, WEAPON_BUDGET } from '../../src/content/budget.ts';
import { WEAPONS, type WeaponDef } from '../../src/content/items.ts';
import { CS_WEAPONS, DEFAULT_GUN, isGloves, isKnife } from '../../src/content/skins/catalog.ts';
import { buildWorker, runPool, SIM_DIR } from './pool.ts';
import type { DpsJob, DpsResult } from './types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = arg('bron')?.split(',');
const seconds = Number(arg('sekundy') ?? 20);
const write = process.argv.includes('--zapisz');
const check = process.argv.includes('--sprawdz');
const list = WEAPONS.filter((w) => !only || only.includes(w.id));
const cs = process.argv.includes('--cs');
const guns = Object.keys(CS_WEAPONS).filter((k) => !isKnife(k) && !isGloves(k));
const gnat = WEAPONS.find((w) => w.id === 'gnat');
if (!gnat) throw new Error('no gnat');
const gnatTop = gnat.levels.length + 1;

/** The reference curve: power at the top level, per level step, for an evolution, for utility weapons. */
export const CURVE = { top: 100, step: 1.125, evolution: 150, utility: 0.8, tolerance: 0.15 };
/**
 * What the bench cannot see, from real runs (BALANCE.md, "Bronie"): reach decides boss fights, so the weapons that
 * hit from 11-13 m won 3× as often with them as without (18 random build plans, Human, Normalnie) and the ones that
 * reach 4 m almost never. Their budgets move by at most 15 % either way (an evolution with its weapon).
 */
export const PLAY: Partial<Record<string, number>> = { telefon: 0.85, gnat: 0.85, gwizdek: 0.85, sos: 1.15, parasol: 1.15, kawa: 1.15, puszka: 1.15, bilet: 1.1 };
const baseOf = (w: WeaponDef): WeaponDef => WEAPONS.find((b) => b.evolution?.into === w.id) ?? w;
export function target(w: WeaponDef, level: number): number {
  const util = baseOf(w).perks?.some((p) => p === 'stun' || p === 'slow') ? CURVE.utility : 1;
  const play = PLAY[baseOf(w).id] ?? 1;
  if (w.evolved) return CURVE.evolution * util * play;
  return CURVE.top * CURVE.step ** (level - (w.levels.length + 1)) * util * play;
}

const jobs: DpsJob[] = [];
if (cs) for (const gun of guns) for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: 'gnat', level: gnatTop, scene, seconds, gun } });
else
  for (const w of list)
    for (let level = 1; level <= w.levels.length + 1; level++)
      for (const scene of ['crowd', 'single'] as const) jobs.push({ id: jobs.length, dps: { weapon: w.id, level, scene, seconds } });
const file = await buildWorker();
const rs = await runPool<DpsResult>(file, jobs, { threads: Number(arg('watki') ?? 14) });

/** Writes both tables back (the one not refitted as it was). */
function save(weapons: Record<string, readonly number[]>, gunTable: Record<string, number>): void {
  const lines = [
    '// Weapon power budgets (BALANCE.md, "Bronie"): a damage multiplier per weapon and level that puts every weapon',
    '// on the reference curve. Written by `node scripts/sim/budget.ts --zapisz` from the dummy bench; checked in CI',
    '// by `node scripts/sim/budget.ts --sprawdz` (every weapon within ±15 % of its target at every level).',
    '// Generated: do not edit by hand.',
    '',
    'export const WEAPON_BUDGET: Partial<Record<string, readonly number[]>> = {',
    ...Object.entries(weapons).map(([id, v]) => `  '${id}': [${v.join(', ')}],`),
    '};',
    '',
    "/** Gnat z CS: a damage multiplier per CS gun, so every gun has the default one's power (±15 %). */",
    'export const GUN_BUDGET: Partial<Record<string, number>> = {',
    ...Object.entries(gunTable).map(([id, v]) => `  ${id}: ${String(v)},`),
    '};',
    '',
  ];
  writeFileSync(join(import.meta.dirname, '../../src/content/budget.ts'), lines.join(EOL));
}
/** Line ends of the generated file. */
const EOL = String.fromCharCode(10);
const weaponTable = (): Record<string, readonly number[]> => Object.fromEntries(WEAPONS.map((w) => [w.id, WEAPON_BUDGET[w.id] ?? Array.from({ length: w.levels.length + 1 }, () => 1)]));

if (cs) {
  const power = (gun: string): number => {
    const get = (scene: string): number => rs[jobs.findIndex((j) => j.dps.gun === gun && j.dps.scene === scene)].dps;
    return Math.sqrt(get('crowd') * get('single'));
  };
  const ref = power(DEFAULT_GUN);
  const out = ['| broń CS | moc | względem domyślnej |', '|---|---:|---:|'];
  let off = 0;
  const table: Record<string, number> = {};
  for (const g of guns) {
    const dev = power(g) / ref - 1;
    if (Math.abs(dev) > CURVE.tolerance) off++;
    out.push(`| ${g} | ${power(g).toFixed(0)} | ${dev >= 0 ? '+' : ''}${(dev * 100).toFixed(0)}% |`);
    table[g] = Math.round((GUN_BUDGET[g] ?? 1) * (ref / power(g)) * 1000) / 1000;
  }
  console.log(out.join(EOL));
  if (write) {
    table[DEFAULT_GUN] = GUN_BUDGET[DEFAULT_GUN] ?? 1;
    save(weaponTable(), table);
    console.log('GUN_BUDGET refitted');
  }
  console.log(off ? `${String(off)} CS guns off the default one by more than 15%` : 'every CS gun within ±15% of the default one');
  process.exit(check && off ? 1 : 0);
}
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
  save(table, Object.fromEntries(Object.entries(GUN_BUDGET).map(([k, v]) => [k, v ?? 1])));
  console.log('src/content/budget.ts refitted');
}
console.log(off ? `${String(off)} weapon levels off the curve by more than ${String(CURVE.tolerance * 100)}%` : `every weapon level within ±${String(CURVE.tolerance * 100)}% of the curve`);
process.exit(check && off ? 1 : 0);
