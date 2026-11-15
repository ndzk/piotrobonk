import { describe, expect, it } from 'vitest';
import { BOSSES } from './bosses';
import { BOSS_TRACKS, STATION_TRACKS, TRACKS, type Track } from './music';

const all: Track[] = [...Object.values(TRACKS), ...Object.values(STATION_TRACKS), ...Object.values(BOSS_TRACKS)];

describe('muzyka', () => {
  it('każdy takt ma 16 kroków, a nuty są liczbami', () => {
    for (const t of all) {
      for (const row of [...t.kick, ...t.clap, ...t.hat, ...t.open]) expect(row, `${t.id}: ${row}`).toMatch(/^[x.]{16}$/);
      for (const row of [...t.bass, ...t.lead]) {
        const steps = row.split(/\s+/);
        expect(steps, `${t.id}: ${row}`).toHaveLength(16);
        for (const s of steps) expect(s === '.' || Number.isFinite(Number(s)), `${t.id}: ${s}`).toBe(true);
      }
    }
  });

  it('żadne dwie stacje ani żadni dwaj bossowie nie grają tej samej melodii ani tego samego basu', () => {
    const tunes = [...Object.values(STATION_TRACKS), ...Object.values(BOSS_TRACKS)];
    expect(new Set(tunes.map((t) => t.lead.join('|'))).size).toBe(tunes.length);
    expect(new Set(tunes.map((t) => t.bass.join('|'))).size).toBe(tunes.length);
  });

  it('każdy boss ma własny motyw, a stacje swój', () => {
    for (const b of BOSSES) expect(BOSS_TRACKS[b.id], b.id).toBeDefined();
    const ids = new Set(Object.values(BOSS_TRACKS).map((t) => t.id));
    expect(ids.size).toBe(BOSSES.length);
    expect(new Set(Object.values(STATION_TRACKS).map((t) => t.id)).size).toBe(Object.keys(STATION_TRACKS).length);
  });
});
