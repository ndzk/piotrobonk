import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../content/enemies';
import { Rng } from '../core/rng';
import { ELITE_MIN_HP, pickSpawn, spawnOptions } from './spawn';

describe('spawn', () => {
  it('unlocks types over time and never picks the bus', () => {
    expect(spawnOptions(0, false).map((o) => o.def.id)).toEqual(['golab']);
    expect(spawnOptions(90, false).map((o) => o.def.id)).toEqual(['golab', 'szczur', 'zlomiarz', 'pasazer', 'kibic']);
    const late = spawnOptions(600, false).map((o) => o.def.id);
    expect(late).toContain('robotnik');
    expect(late).not.toContain('autobus');
    // The splitter's parcels and the last train's inspectors never come with a wave.
    expect(late).not.toContain('paczka');
    expect(late).not.toContain('kanar-nocny');
    expect(spawnOptions(0, true).length).toBe(ENEMIES.filter((d) => d.weight > 0 && d.behavior !== 'charger').length);
  });

  it('rush hour doubles the late passengers', () => {
    const plain = spawnOptions(600, false).find((o) => o.def.id === 'pasazer')?.weight ?? 0;
    const rush = spawnOptions(600, false, [], true).find((o) => o.def.id === 'pasazer')?.weight ?? 0;
    expect(rush).toBeCloseTo(plain * 2);
  });

  it('rolls every unlocked type, roughly by weight', () => {
    const rng = new Rng(7);
    const options = spawnOptions(600, false);
    const seen = new Map<string, number>();
    for (let i = 0; i < 20_000; i++) {
      const id = pickSpawn(options, false, rng).def.id;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    const total = options.reduce((s, o) => s + o.weight, 0);
    for (const o of options) {
      const share = (seen.get(o.def.id) ?? 0) / 20_000;
      expect(share, o.def.id).toBeGreaterThan(0);
      expect(Math.abs(share - o.weight / total), o.def.id).toBeLessThan(0.02);
    }
  });

  it('elites are sturdy types (the toughest there is before any is unlocked)', () => {
    const rng = new Rng(3);
    expect(pickSpawn(spawnOptions(10, false), true, rng).def.id).toBe('golab');
    expect(pickSpawn(spawnOptions(30, false), true, rng).def.id).toBe('szczur');
    expect(['zlomiarz', 'kibic']).toContain(pickSpawn(spawnOptions(90, false), true, rng).def.id);
    const kinds = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const def = pickSpawn(spawnOptions(240, false), true, rng).def;
      expect(def.hp).toBeGreaterThanOrEqual(ELITE_MIN_HP);
      kinds.add(def.id);
    }
    expect(kinds.size).toBeGreaterThan(3);
  });
});
