// Audit: recomputes the final sweep's numbers straight from the result files (.sim/<prefix>-*.json).
// Usage: node scripts/audit/results.ts [prefix=h]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WEAPONS } from '../../src/content/items.ts';
import { TUNING } from '../../src/content/tuning.ts';
import { hashSeed } from '../../src/core/rng.ts';

const root = join(import.meta.dirname, '../..');
const prefix = process.argv[2] ?? 'h';
const day = new Map<number, number>();
for (let d = 0; d < 2000; d++) day.set(hashSeed(`piotrobonk:kurs:${new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10)}`), d);
const base = (id: string): string => WEAPONS.find((w) => w.evolution?.into === id)?.id ?? id;
const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
};
const pct = (n: number, d: number): string => (d ? `${((100 * n) / d).toFixed(1)}%` : '–');
interface R { station: string; difficulty: string; variant: string; ladder: number; seed: number; outcome: string; time: number; bossHp: number; bossFrom: number; bossTo: number; lowEpisodes: number; nearShare: number; weapons: string[]; passives: string[] }
for (const name of ['human', 'oracle', 'casual-spok', 'casual-norm', 'human-opo', 'oracle-top', 'random']) {
  const f = join(root, '.sim', `${prefix}-${name}.json`);
  if (!existsSync(f)) {
    console.log(`\n## ${prefix}-${name}: BRAK PLIKU`);
    continue;
  }
  const rs = JSON.parse(readFileSync(f, 'utf8')) as R[];
  const days = [...new Set(rs.map((r) => day.get(r.seed) ?? -1))].sort((a, b) => a - b);
  console.log(`\n## ${prefix}-${name}.json (${statSync(f).mtime.toISOString()}): ${String(rs.length)} runów, kursy ${[...new Set(rs.map((r) => r.difficulty))].join(',')}, drabinka ${[...new Set(rs.map((r) => r.ladder))].join(',')}, dni ${days.join(',')}, timeouty ${String(rs.filter((r) => r.outcome === 'timeout').length)}`);
  const variants = [...new Set(rs.map((r) => r.variant))];
  const stations = [...new Set(rs.map((r) => r.station))];
  for (const v of variants) {
    const l = rs.filter((r) => r.variant === v);
    const won = l.filter((r) => r.outcome === 'won');
    const cells = stations.map((s) => {
      const x = l.filter((r) => r.station === s);
      return `${s.slice(0, 5)} ${String(x.filter((r) => r.outcome === 'won').length)}/${String(x.length)}`;
    });
    console.log(`${v}: ${String(won.length)}/${String(l.length)} = ${pct(won.length, l.length)} | ${cells.join(' ')}`);
  }
  // Pooled over variants, per station.
  if (variants.length > 1)
    console.log(
      `razem: ${stations
        .map((s) => {
          const x = rs.filter((r) => r.station === s);
          return `${s.slice(0, 5)} ${pct(x.filter((r) => r.outcome === 'won').length, x.length)}`;
        })
        .join(' ')}`,
    );
  // Boss fight times of the wins (and of every fight that reached the boss).
  const fights = stations.map((s) => {
    const w = rs.filter((r) => r.station === s && r.outcome === 'won' && r.bossTo > 0).map((r) => r.bossTo - r.bossFrom);
    const min = TUNING.boss.fight[s]?.[0] ?? 0;
    return `${s.slice(0, 5)} min ${w.length ? Math.min(...w).toFixed(0) : '–'} med ${w.length ? med(w).toFixed(0) : '–'} (n ${String(w.length)}, poniżej minimum ${String(w.filter((t) => t < min).length)})`;
  });
  console.log(`walki z bossem (wygrane, s): ${fights.join('; ')}`);
  // Tension.
  const lows = rs.map((r) => r.lowEpisodes);
  const entry = rs.filter((r) => r.bossHp >= 0).map((r) => r.bossHp);
  const near = rs.map((r) => r.nearShare);
  console.log(`napięcie: HP<30% na run średnio ${(lows.reduce((a, b) => a + b, 0) / lows.length).toFixed(2)}, mediana ${med(lows).toFixed(1)}, runy z ≥3: ${pct(lows.filter((x) => x >= 3).length, lows.length)}; HP przy bossie mediana ${(med(entry) * 100).toFixed(0)}% (n ${String(entry.length)}), w 40–60%: ${pct(entry.filter((x) => x >= 0.4 && x <= 0.6).length, entry.length)}; wróg ≤5 m średnio ${(100 * near.reduce((a, b) => a + b, 0) / near.length).toFixed(0)}%, runy >50%: ${pct(near.filter((x) => x > 0.5).length, near.length)}`);
  // Weapon shares in wins, as bots.ts counts them (base weapon, Teczka left out), and with Teczka.
  const wins = rs.filter((r) => r.outcome === 'won');
  const n: Record<string, number> = {};
  for (const r of wins) for (const w of new Set(r.weapons.map(base))) n[w] = (n[w] ?? 0) + 1;
  console.log(`bronie w wygranych (${String(wins.length)}): ${Object.entries(n).sort((a, b) => b[1] - a[1]).map(([w, c]) => `${w} ${pct(c, wins.length)}`).join(', ')}`);
  const slots = wins.map((r) => new Set(r.weapons.map(base)).size - (r.weapons.map(base).includes('teczka') ? 1 : 0));
  if (wins.length) console.log(`  broni poza Teczką na wygraną: średnio ${(slots.reduce((a, b) => a + b, 0) / slots.length).toFixed(2)} z 10 → udział „równy” = ${((100 * slots.reduce((a, b) => a + b, 0)) / slots.length / 10).toFixed(0)}%`);
}
