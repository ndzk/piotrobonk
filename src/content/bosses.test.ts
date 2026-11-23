import { describe, expect, it } from 'vitest';
import { BOSSES, bossOf, type Attack } from './bosses';
import { ENEMIES } from './enemies';
import { STATIONS } from './stations/index';

describe('bosses', () => {
  it('every station has exactly one boss, the finale included', () => {
    for (const s of STATIONS) expect(bossOf(s.id), s.id).not.toBeNull();
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

  // BALANCE.md, bosses: three phases (the finale four), every phase two attacks the fight has not shown yet,
  // six at least in all, and something that only a jump, a slide or getting out of the way answers.
  it('every phase brings two new attacks, six or more in all, one that has to be jumped or dodged', () => {
    const key = (a: Attack): string => [a.kind, a.effect ?? '', a.look ?? '', a.name ?? ''].join('/');
    for (const b of BOSSES) {
      expect(b.phases.length, b.id).toBeGreaterThanOrEqual(b.station === 'koluszki' ? 4 : 3);
      const seen = new Set<string>();
      b.phases.forEach((p, k) => {
        const before = seen.size;
        for (const a of p.attacks) for (const x of a.then ? [a, a.then] : [a]) seen.add(key(x));
        expect(seen.size - before, `${b.id} phase ${String(k + 1)}`).toBeGreaterThanOrEqual(2);
      });
      expect(seen.size, b.id).toBeGreaterThanOrEqual(6);
      expect(b.phases.some((p) => p.attacks.some((a) => ['wave', 'charge', 'roll', 'beam'].includes(a.kind))), b.id).toBe(true);
      // The last phase has a combo.
      expect(b.phases[b.phases.length - 1].attacks.some((a) => a.then), b.id).toBe(true);
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
          // A summon and a magnet hurt through what they bring, not by themselves.
          if (a.kind !== 'summon' && a.kind !== 'magnet') expect(a.damage, `${b.id} ${a.kind}`).toBeGreaterThan(0);
          if (a.kind === 'summon') expect(ENEMIES.some((e) => e.id === a.spawn), `${b.id} summons ${a.spawn ?? '?'}`).toBe(true);
        }
      }
    }
  });
});
