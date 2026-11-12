import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from './rng';

describe('Rng', () => {
  it('replays the same sequence for the same seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('diverges for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 100 }, () => a.next() === b.next()).filter(Boolean).length;
    expect(same).toBe(0);
  });

  it('restores a saved state', () => {
    const a = new Rng(99);
    a.next();
    const saved = a.state;
    const expected = [a.next(), a.next(), a.next()];
    a.state = saved;
    expect([a.next(), a.next(), a.next()]).toEqual(expected);
  });

  it('stays in range and is roughly uniform', () => {
    const r = new Rng(hashSeed('2026-11-12'));
    const buckets = new Array<number>(10).fill(0);
    const n = 200_000;
    for (let i = 0; i < n; i++) {
      const v = r.next();
      expect(v >= 0 && v < 1).toBe(true);
      buckets[Math.floor(v * 10)] = (buckets[Math.floor(v * 10)] ?? 0) + 1;
    }
    for (const count of buckets) expect(Math.abs(count / n - 0.1)).toBeLessThan(0.005);
  });

  it('int() covers the whole half-open range', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(r.int(3, 8));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('hashSeed is stable', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('2026-11-12')).toBe(hashSeed('2026-11-12'));
    expect(hashSeed('2026-11-12')).not.toBe(hashSeed('2026-11-13'));
  });
});
