import { describe, expect, it } from 'vitest';
import { BOSSES, bossOf } from './bosses';
import { ENEMIES } from './enemies';
import { STATIONS } from './stations/index';

describe('bosses', () => {
  it('every station except the finale has exactly one boss', () => {
    for (const s of STATIONS) {
      if (s.id === 'koluszki') continue;
      expect(bossOf(s.id), s.id).not.toBeNull();
    }
    const stations = BOSSES.map((b) => b.station);
    expect(new Set(stations).size).toBe(stations.length);
    for (const b of BOSSES) expect(STATIONS.some((s) => s.id === b.station), b.id).toBe(true);
  });

  it('ids are unique and do not clash with an enemy id', () => {
    const ids = BOSSES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BOSSES) expect(ENEMIES.some((e) => e.id === b.id), b.id).toBe(false);
  });

  it('phases start at full health and only ever get harder', () => {
    for (const b of BOSSES) {
      expect(b.phases.length, b.id).toBeGreaterThanOrEqual(2);
      expect(b.phases[0].at, b.id).toBe(1);
      for (let i = 1; i < b.phases.length; i++) {
        expect(b.phases[i].at, `${b.id} phase ${i}`).toBeLessThan(b.phases[i - 1].at);
        expect(b.phases[i].at, `${b.id} phase ${i}`).toBeGreaterThan(0);
      }
    }
  });

  it('every attack is telegraphed and has sane numbers', () => {
    for (const b of BOSSES) {
      expect(b.hp, b.id).toBeGreaterThan(500);
      expect(b.radius, b.id).toBeGreaterThan(0.5);
      expect(b.palette.length, b.id).toBeGreaterThanOrEqual(3);
      for (const phase of b.phases) {
        expect(phase.attacks.length, b.id).toBeGreaterThan(0);
        for (const a of phase.attacks) {
          expect(a.telegraph, `${b.id} ${a.kind}`).toBeGreaterThanOrEqual(0.4);
          expect(a.cooldown, `${b.id} ${a.kind}`).toBeGreaterThan(a.telegraph);
          if (a.kind !== 'summon') expect(a.damage, `${b.id} ${a.kind}`).toBeGreaterThan(0);
          if (a.kind === 'summon') expect(ENEMIES.some((e) => e.id === a.spawn), `${b.id} summons ${a.spawn ?? '?'}`).toBe(true);
        }
      }
    }
  });
});
