import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../content/enemies';
import { Rng } from '../core/rng';
import { pickSpawn, spawnOptions } from './spawn';

describe('spawn', () => {
  it('unlocks types over time and never picks the bus', () => {
    expect(spawnOptions(0, false).map((o) => o.def.id)).toEqual(['golab']);
    expect(spawnOptions(90, false).map((o) => o.def.id)).toEqual(['golab', 'szczur', 'zlomiarz']);
    const late = spawnOptions(600, false).map((o) => o.def.id);
    expect(late).toContain('robotnik');
    expect(late).not.toContain('autobus');
    expect(spawnOptions(0, true).length).toBe(ENEMIES.filter((d) => d.weight > 0).length);
  });

  it('rolls every unlocked type, roughly by weight', () => {
    const rng = new Rng(7);
    const options = spawnOptions(600, false);
    const seen = new Map<string, number>();
    for (let i = 0; i < 20_000; i++) {
      const id = pickSpawn(options, false, rng).def.id;
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    const total = options.reduce((s, o) => s + o.def.weight, 0);
    for (const o of options) {
      const share = (seen.get(o.def.id) ?? 0) / 20_000;
      expect(share, o.def.id).toBeGreaterThan(0);
      expect(Math.abs(share - o.def.weight / total), o.def.id).toBeLessThan(0.02);
    }
  });

  it('elites are the toughest unlocked type', () => {
    const rng = new Rng(3);
    expect(pickSpawn(spawnOptions(10, false), true, rng).def.id).toBe('golab');
    expect(pickSpawn(spawnOptions(30, false), true, rng).def.id).toBe('szczur');
    expect(pickSpawn(spawnOptions(90, false), true, rng).def.id).toBe('zlomiarz');
    expect(pickSpawn(spawnOptions(200, false), true, rng).def.id).toBe('robotnik');
  });
});
