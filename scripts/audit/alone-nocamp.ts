// Audit: the `alone` gate as in CI, and the same with the camping director off (TUNING.camping.after = 1e9),
// to see whether a lone weapon dies to the weapon's weakness or to the anti-camping waves.
// Usage: SIM_WORKER=audit node scripts/audit/alone-nocamp.ts [--watki=4]
import { WEAPONS } from '../../src/content/items.ts';
import { hashSeed } from '../../src/core/rng.ts';
import { buildWorker, runPool } from '../sim/pool.ts';
import type { Job, RunResult } from '../sim/types.ts';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const seedOf = (k: number): number => hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 2, 2 + 7 * k)).toISOString().slice(0, 10)}`);
const jobs: Job[] = [];
for (const mode of ['gate', 'nocamp'] as const)
  for (const w of WEAPONS)
    for (const station of ['fabryczna', 'zakowice'])
      jobs.push({ id: jobs.length, seed: seedOf(0), station, difficulty: 'normalnie', skill: 'afk', variant: `${mode}/${w.id}`, alone: w.id, cap: 480 + 300, ...(mode === 'nocamp' ? { tweak: { 'camping.after': 1e9 } } : {}) });
const rs = await runPool<RunResult>(await buildWorker(), jobs, { threads: Number(arg('watki') ?? 4) });
const out = ['| broń | bramka: po 8. min (fabryczna / żakowice) | bez kempingu: po 8. min |', '|---|---:|---:|'];
const f = (r: RunResult): string => (r.outcome === 'dead' ? `${(r.time - 480).toFixed(0)} s` : `żyje ${r.time.toFixed(0)} s`);
for (const w of WEAPONS) {
  const g = rs.filter((r) => r.variant === `gate/${w.id}`);
  const n = rs.filter((r) => r.variant === `nocamp/${w.id}`);
  out.push(`| ${w.id} | ${g.map(f).join(' / ')} | ${n.map(f).join(' / ')} |`);
}
console.log(out.join('\n'));
