// Turns simulated runs into the numbers BALANCE.md talks about: win rates per station, kurs and bot, how long
// an AFK player lasts, health at the boss, low-health moments, damage and healing per minute, the player's
// damage against the enemies' health over time, the first evolution, and which weapons win.
import type { RunResult } from './types.ts';

export const STATIONS = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
export const SKILLS = ['afk', 'weak', 'medium', 'good'] as const;

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number): string => (Number.isNaN(x) ? '—' : `${Math.round(x * 100)}%`);
const f1 = (x: number): string => (Number.isNaN(x) ? '—' : x.toFixed(1));
const f0 = (x: number): string => (Number.isNaN(x) ? '—' : String(Math.round(x)));

export interface Cell {
  n: number;
  win: number;
  /** Mean seconds survived (all runs). */
  time: number;
  /** Mean health share on meeting the boss (runs that got there). */
  bossHp: number;
  reachedBoss: number;
  low: number;
  takenPerMin: number;
  healPerMin: number;
  /** Seconds to kill the boss (wins only). */
  bossKill: number;
  /** Minute of the first evolution (runs with one), and share of runs with one. */
  evoMinute: number;
  evoShare: number;
  dealtPerMin: number;
}

export function cell(rs: RunResult[]): Cell {
  const wins = rs.filter((r) => r.outcome === 'won');
  const boss = rs.filter((r) => r.bossHp >= 0);
  const evo = rs.filter((r) => r.firstEvolution >= 0);
  const minutes = (r: RunResult): number => Math.max(0.25, r.time / 60);
  const healed = (r: RunResult): number => Object.values(r.heal).reduce((a, b) => a + b, 0);
  return {
    n: rs.length,
    win: rs.length ? wins.length / rs.length : NaN,
    time: mean(rs.map((r) => r.time)),
    bossHp: mean(boss.map((r) => r.bossHp)),
    reachedBoss: rs.length ? boss.length / rs.length : NaN,
    low: mean(rs.map((r) => r.lowEpisodes)),
    takenPerMin: mean(rs.map((r) => r.damageTaken / minutes(r))),
    healPerMin: mean(rs.map((r) => healed(r) / minutes(r))),
    bossKill: mean(wins.filter((r) => r.bossTo >= 0).map((r) => r.bossTo - r.bossFrom)),
    evoMinute: mean(evo.map((r) => r.firstEvolution / 60)),
    evoShare: rs.length ? evo.length / rs.length : NaN,
    dealtPerMin: mean(rs.map((r) => r.damageDealt / minutes(r))),
  };
}

const group = <K extends string>(rs: RunResult[], key: (r: RunResult) => K): Map<K, RunResult[]> => {
  const m = new Map<K, RunResult[]>();
  for (const r of rs) {
    const k = key(r);
    let list = m.get(k);
    if (!list) {
      list = [];
      m.set(k, list);
    }
    list.push(r);
  }
  return m;
};

/** The bots in a set of runs: the four skills in order, then any named variants. */
function variants(rs: RunResult[]): string[] {
  const seen = [...new Set(rs.map((r) => r.variant))];
  return [...SKILLS.filter((s) => seen.includes(s)), ...seen.filter((v) => !(SKILLS as readonly string[]).includes(v))];
}

/** Win rate table: rows bot skills, columns stations, for one kurs (and ladder level). */
function winTable(rs: RunResult[]): string[] {
  const stations = STATIONS.filter((s) => rs.some((r) => r.station === s));
  const out = [`| bot | ${stations.join(' | ')} | razem |`, `|---|${stations.map(() => '---:').join('|')}|---:|`];
  for (const skill of variants(rs)) {
    const mine = rs.filter((r) => r.variant === skill);
    if (!mine.length) continue;
    const cells = stations.map((s) => pct(cell(mine.filter((r) => r.station === s)).win));
    out.push(`| ${skill} | ${cells.join(' | ')} | **${pct(cell(mine).win)}** |`);
  }
  return out;
}

function detailTable(rs: RunResult[]): string[] {
  const out = [
    '| bot | n | wygrane | przeżycie | doszedł do bossa | HP przy bossie | sytuacje HP<30% | obrażenia/min | leczenie/min | DPS gracza | czas bossa | 1. ewolucja (min) | runy z ewolucją |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const skill of variants(rs)) {
    const mine = rs.filter((r) => r.variant === skill);
    if (!mine.length) continue;
    const c = cell(mine);
    out.push(
      `| ${skill} | ${String(c.n)} | ${pct(c.win)} | ${f0(c.time)} s | ${pct(c.reachedBoss)} | ${pct(c.bossHp)} | ${f1(c.low)} | ${f0(c.takenPerMin)} | ${f0(c.healPerMin)} | ${f0(c.dealtPerMin / 60)} | ${f0(c.bossKill)} s | ${f1(c.evoMinute)} | ${pct(c.evoShare)} |`,
    );
  }
  return out;
}

/** Player damage per second against enemy health spawned per second, per minute of the run (one bot). */
function curveTable(rs: RunResult[]): string[] {
  const maxB = Math.max(0, ...rs.map((r) => r.dealt.length));
  const rows: string[] = ['| minuta | DPS gracza | HP wrogów/s | stosunek | obrażenia otrzymane/min | leczenie/min | żywych runów |', '|---:|---:|---:|---:|---:|---:|---:|'];
  for (let b = 0; b + 1 < maxB; b += 2) {
    // Only runs still alive through the whole minute, so deaths do not drag the curve down.
    const alive = rs.filter((r) => r.dealt.length > b + 1 && (r.bossFrom < 0 || r.bossFrom > (b + 2) * 30));
    if (alive.length < 5) break;
    const dps = mean(alive.map((r) => (r.dealt[b] + r.dealt[b + 1]) / 60));
    const hps = mean(alive.map((r) => (r.spawnedHp[b] + r.spawnedHp[b + 1]) / 60));
    const tk = mean(alive.map((r) => r.taken[b] + r.taken[b + 1]));
    const hl = mean(alive.map((r) => r.healed[b] + r.healed[b + 1]));
    rows.push(`| ${String(b / 2 + 1)} | ${f0(dps)} | ${f0(hps)} | ${(dps / Math.max(1, hps)).toFixed(2)} | ${f0(tk)} | ${f0(hl)} | ${String(alive.length)} |`);
  }
  return rows;
}

/** Weapons and pairs in the wins of one group of runs: how often they appear and their win rate. */
function weaponTable(rs: RunResult[]): string[] {
  const wins = rs.filter((r) => r.outcome === 'won');
  const all = new Map<string, { runs: number; wins: number }>();
  for (const r of rs) {
    for (const w of new Set(r.weapons.map(base))) {
      const e = all.get(w) ?? { runs: 0, wins: 0 };
      e.runs++;
      if (r.outcome === 'won') e.wins++;
      all.set(w, e);
    }
  }
  const out = ['| broń | w wygranych | win rate z nią |', '|---|---:|---:|'];
  for (const [w, e] of [...all].sort((a, b) => b[1].wins - a[1].wins)) out.push(`| ${w} | ${pct(e.wins / Math.max(1, wins.length))} | ${pct(e.wins / Math.max(1, e.runs))} |`);
  const pairs = new Map<string, { runs: number; wins: number }>();
  for (const r of rs) {
    const ws = [...new Set(r.weapons.map(base))].sort();
    for (let i = 0; i < ws.length; i++)
      for (let j = i + 1; j < ws.length; j++) {
        const k = `${ws[i]} + ${ws[j]}`;
        const e = pairs.get(k) ?? { runs: 0, wins: 0 };
        e.runs++;
        if (r.outcome === 'won') e.wins++;
        pairs.set(k, e);
      }
  }
  const top = [...pairs].filter(([, e]) => e.runs >= 8).sort((a, b) => b[1].wins / b[1].runs - a[1].wins / a[1].runs).slice(0, 6);
  out.push('', '| para broni (min. 8 runów) | runy | win rate |', '|---|---:|---:|');
  for (const [k, e] of top) out.push(`| ${k} | ${String(e.runs)} | ${pct(e.wins / e.runs)} |`);
  return out;
}

/** Evolved weapons count as the weapon they came from. */
const EVOLVED_FROM: Record<string, string> = {
  'teczka-prezesa': 'teczka',
  'bilet-sieciowy': 'bilet',
  espresso: 'kawa',
  kebab: 'sos',
  powerbank: 'telefon',
  'parasol-burzowy': 'parasol',
  kontrola: 'gwizdek',
  zgrzewka: 'puszka',
  'siec-trakcyjna': 'iskra',
  'rozklad-2027': 'rozklad',
};
export const base = (id: string): string => EVOLVED_FROM[id] ?? id;

/** Where all the damage comes from: share of the damage taken, by source. */
function sourceTable(rs: RunResult[]): string[] {
  const m = new Map<string, number>();
  let total = 0;
  for (const r of rs)
    for (const [k, v] of Object.entries(r.bySource)) {
      m.set(k, (m.get(k) ?? 0) + v);
      total += v;
    }
  const out = ['| źródło | udział w obrażeniach |', '|---|---:|'];
  for (const [k, n] of [...m].sort((a, b) => b[1] - a[1]).slice(0, 10)) out.push(`| ${k} | ${pct(n / Math.max(1, total))} |`);
  return out;
}

/** What killed the bots: the last hit of every death, by source. */
function killerTable(rs: RunResult[]): string[] {
  const deaths = rs.filter((r) => r.outcome === 'dead' && r.hits.length);
  const m = new Map<string, number>();
  for (const r of deaths) {
    const k = `${r.hits[0].who} · ${r.hits[0].what}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const out = ['| ostatni cios | udział w śmierciach |', '|---|---:|'];
  for (const [k, n] of [...m].sort((a, b) => b[1] - a[1]).slice(0, 8)) out.push(`| ${k} | ${pct(n / deaths.length)} |`);
  return out;
}

export function report(rs: RunResult[], title: string): string {
  const lines: string[] = [`# ${title}`, ''];
  const byKurs = group(rs, (r) => `${r.difficulty}${r.ladder ? ` +${String(r.ladder)}` : ''}`);
  for (const [kurs, list] of byKurs) {
    lines.push(`## Kurs: ${kurs}`, '', '### Win rate stacji', '', ...winTable(list), '', '### Szczegóły', '', ...detailTable(list), '');
    for (const skill of ['medium', 'good'] as const) {
      const mine = list.filter((r) => r.skill === skill);
      if (!mine.length) continue;
      lines.push(`### Krzywe (${skill})`, '', ...curveTable(mine), '');
    }
    const good = list.filter((r) => r.skill === 'good');
    if (good.length) lines.push('### Bronie (good)', '', ...weaponTable(good), '');
    const deaths = list.filter((r) => r.skill === 'medium' || r.skill === 'good');
    if (deaths.length) lines.push('### Co zabija (medium + good)', '', ...killerTable(deaths), '', '### Skąd obrażenia (medium + good)', '', ...sourceTable(deaths), '');
  }
  return lines.join('\n');
}
