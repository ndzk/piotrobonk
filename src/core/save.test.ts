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

  it('migrates a version 2 save: the story fields start empty, a player with runs skips the intro', () => {
    const save = readSave({ version: 2, save: { bottles: 7, runs: 3, inventory: [{ uid: 1, skin: 's', float: 0.2, seed: 1, stattrak: false, kills: 0 }] } });
    expect(save.bottles).toBe(7);
    expect(save.inventory).toHaveLength(1);
    expect(save.introSeen).toBe(true);
    expect(save.callsSeen).toEqual([]);
    expect(save.finished).toBe(0);
    expect(save.trophies).toEqual([]);
    expect(readSave({ version: 2, save: { runs: 0 } }).introSeen).toBe(false);
    expect(readSave({ version: 3, save: { trophies: ['filizanka', 'filizanka', 5], callsSeen: 'x' } })).toMatchObject({ trophies: ['filizanka'], callsSeen: [] });
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
    save.collected.push('skin-x');
    save.nextUid = 2;
    save.equip.gun = 1;
    save.equip.wraps.parasol = 1;
    save.stats.kills = 1200;
    save.achievements['pierwszy-run'] = 1_763_000_000_000;
    save.seen.bosses.push('biletomat');
    save.daily['2026-11-14'] = { score: 1900, code: 'abc.def' };
    saveSave(save);
    expect(loadSave()).toEqual(save);
  });

  it('version 3 saves get the compendium their progress implies, and nothing else', () => {
    const s = readSave({
      version: 3,
      save: {
        runs: 4,
        stations: { fabryczna: { cleared: 'normalnie', bestTime: 100, bestKills: 50 }, niciarniana: { cleared: null, bestTime: 0, bestKills: 0 } },
        inventory: [{ uid: 3, skin: 'ak-redline', float: 0.2, seed: 1, stattrak: false, kills: 0 }],
      },
    });
    expect(s.seen.enemies).toContain('golab');
    expect(s.seen.enemies).toContain('kontroler');
    expect(s.seen.enemies).not.toContain('lemur');
    expect(s.seen.bosses).toEqual(['biletomat']);
    expect(s.collected).toEqual(['ak-redline']);
    // One boss beaten, never finished: the counters say so instead of zero.
    expect(s.stats).toEqual({ bossKills: 1, slaps: 0 });
    expect(s.achievements).toEqual({});
  });

  it('a finished version 3 save counts its slaps and every boss, and has met the lemurs', () => {
    const all = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
    const s = readSave({
      version: 3,
      save: { runs: 30, finished: 2, stations: Object.fromEntries(all.map((id) => [id, { cleared: 'normalnie', bestTime: 200, bestKills: 400 }])) },
    });
    expect(s.stats.slaps).toBe(2);
    expect(s.stats.bossKills).toBe(9);
    expect(s.seen.enemies).toContain('lemur');
    expect(s.seen.bosses).toContain('bartek');
  });

  it('junk in the new fields is dropped, and only the last 30 days of the daily run are kept', () => {
    const daily: Record<string, unknown> = { nonsense: { score: 1, code: 'x' }, '2026-01-01': { score: 'lots' } };
    for (let d = 1; d <= 40; d++) daily[`2026-10-${String(d).padStart(2, '0')}`] = { score: d, code: `c${d}` };
    const s = readSave({ version: 4, save: { stats: { kills: 5, bins: -3, chests: 'many' }, achievements: { a: 1, b: 'x' }, daily } });
    expect(s.stats).toEqual({ kills: 5 });
    expect(s.achievements).toEqual({ a: 1 });
    expect(Object.keys(s.daily)).toHaveLength(30);
    expect(s.daily['2026-10-40']).toEqual({ score: 40, code: 'c40' });
    expect(s.daily['2026-01-01']).toBeUndefined();
  });
});
