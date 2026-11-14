import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_VERSION, furthest, loadSave, newSave, progressOf, readSave, recordClear, saveSave, unlocked, type Save } from './save';

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

  it('migrates a version 1 save: progress kept, empty inventory added', () => {
    const v1 = { version: 1, save: { bottles: 120, totalTime: 900, runs: 4, deaths: 2, difficulty: 'spokojny', stations: { fabryczna: { cleared: 'normalnie', bestTime: 250, bestKills: 800 } } } };
    const save = readSave(v1);
    expect(save.bottles).toBe(120);
    expect(save.difficulty).toBe('spokojny');
    expect(progressOf(save, 'fabryczna').cleared).toBe('normalnie');
    expect(save.inventory).toEqual([]);
    expect(save.equip).toEqual({ gun: null, knife: null, gloves: null, wraps: {} });
    expect(save.nextUid).toBe(1);
  });

  it('drops broken skins and equipment pointing at skins that are gone', () => {
    const save = readSave({
      version: SAVE_VERSION,
      save: {
        inventory: [{ uid: 7, skin: 'skin-a', float: 3, seed: 5000, stattrak: 'tak', kills: -1 }, { uid: 7, skin: 'duplikat' }, { uid: 0, skin: 'zly' }, 'śmieć', { uid: 12, skin: 'skin-b', float: 0.2, seed: 7, stattrak: true, kills: 33 }],
        nextUid: 3,
        equip: { gun: 12, knife: 99, gloves: 'x', wraps: { parasol: 7, teczka: 50 } },
      },
    });
    expect(save.inventory.map((s) => s.uid)).toEqual([7, 12]);
    expect(save.inventory[0]).toEqual({ uid: 7, skin: 'skin-a', float: 1, seed: 999, stattrak: false, kills: 0 });
    expect(save.equip).toEqual({ gun: 12, knife: null, gloves: null, wraps: { parasol: 7 } });
    // The counter never hands out a uid that is already taken.
    expect(save.nextUid).toBe(13);
  });

  it('starts over instead of half-reading a save from a newer build', () => {
    const save = readSave({ version: SAVE_VERSION + 1, save: { bottles: 5000 } });
    expect(save.bottles).toBe(0);
  });

  it('never overwrites newer progress from another tab or a newer build', () => {
    const save = loadSave();
    expect(saveSave(save)).toBe('ok');
    // Another tab writes after us: our next write must not clobber it.
    const stored = JSON.parse(localStorage.getItem('piotrobonk:save') ?? '{}') as { rev: number; save: Save };
    localStorage.setItem('piotrobonk:save', JSON.stringify({ ...stored, rev: stored.rev + 5, save: { ...stored.save, bottles: 999 } }));
    save.bottles = 1;
    expect(saveSave(save)).toBe('stale');
    expect(loadSave().bottles).toBe(999);
    // After reading it again this tab may write.
    const fresh = loadSave();
    fresh.bottles = 1000;
    expect(saveSave(fresh)).toBe('ok');
    // A save from a newer build is left alone.
    localStorage.setItem('piotrobonk:save', JSON.stringify({ version: SAVE_VERSION + 1, rev: 1, save: { bottles: 5 } }));
    expect(saveSave(fresh)).toBe('newer');
  });

  it('round-trips through storage', () => {
    const save: Save = newSave();
    save.bottles = 42;
    save.totalTime = 1234.5;
    save.difficulty = 'opoznienie';
    recordClear(save, 'a', 'normalnie', 360, 700);
    save.inventory.push({ uid: 1, skin: 'skin-x', float: 0.123, seed: 42, stattrak: true, kills: 9 });
    save.nextUid = 2;
    save.equip.gun = 1;
    save.equip.wraps.parasol = 1;
    saveSave(save);
    expect(loadSave()).toEqual(save);
  });
});
