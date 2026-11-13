import { beforeEach, describe, expect, it } from 'vitest';
import { furthest, loadSave, newSave, progressOf, recordClear, saveSave, unlocked, type Save } from './save';

const ORDER = ['a', 'b', 'c'];

// Vitest runs in Node, which has no localStorage: a Map is enough for what the save code does with it.
beforeEach(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    },
  });
});

describe('save', () => {
  it('unlocks the next station only after the one before it is cleared', () => {
    const save = newSave();
    expect(unlocked(save, ORDER, 'a')).toBe(true);
    expect(unlocked(save, ORDER, 'b')).toBe(false);
    recordClear(save, 'a', 'normalnie', 400, 500);
    expect(unlocked(save, ORDER, 'b')).toBe(true);
    expect(unlocked(save, ORDER, 'c')).toBe(false);
    expect(furthest(save, ORDER)).toBe('b');
  });

  it('keeps the best time and the hardest difficulty', () => {
    const save = newSave();
    recordClear(save, 'a', 'normalnie', 400, 500);
    recordClear(save, 'a', 'spokojny', 300, 200);
    expect(progressOf(save, 'a')).toEqual({ cleared: 'normalnie', bestTime: 300, bestKills: 500 });
    recordClear(save, 'a', 'opoznienie', 500, 900);
    expect(progressOf(save, 'a')).toEqual({ cleared: 'opoznienie', bestTime: 300, bestKills: 900 });
  });

  it('repairs a malformed save instead of throwing', () => {
    localStorage.setItem('piotrobonk:save', JSON.stringify({ version: 1, save: { bottles: 'dużo', difficulty: 'latanie', stations: { a: { cleared: 7, bestTime: -5 }, b: null } } }));
    const save = loadSave();
    expect(save.bottles).toBe(0);
    expect(save.difficulty).toBe('normalnie');
    expect(save.stations.a).toEqual({ cleared: null, bestTime: 0, bestKills: 0 });
    expect(save.stations.b).toEqual({ cleared: null, bestTime: 0, bestKills: 0 });
  });

  it('round-trips through storage', () => {
    const save: Save = newSave();
    save.bottles = 42;
    save.totalTime = 1234.5;
    save.difficulty = 'opoznienie';
    recordClear(save, 'a', 'normalnie', 360, 700);
    saveSave(save);
    expect(loadSave()).toEqual(save);
  });
});
