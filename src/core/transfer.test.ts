import { describe, expect, it } from 'vitest';
import { newSave, SAVE_VERSION, type Save } from './save';
import { codeToSave, fileToSave, saveToCode, saveToFile } from './transfer';

function sample(): Save {
  const s = newSave();
  s.bottles = 1234;
  s.introSeen = true;
  s.trophies = ['filizanka'];
  s.inventory = Array.from({ length: 60 }, (_, i) => ({ uid: i + 1, skin: `skin-${i}`, float: i / 60, seed: i, stattrak: i % 7 === 0, kills: i * 3 }));
  s.collected = s.inventory.map((x) => x.skin);
  s.nextUid = 61;
  s.equip.gun = 5;
  s.stations.fabryczna = { cleared: 'normalnie', bestTime: 312, bestKills: 900 };
  return s;
}

describe('eksport i import zapisu', () => {
  it('plik wraca bez zmian', () => {
    const s = sample();
    expect(fileToSave(saveToFile(s))).toEqual(s);
  });

  it('kod wraca bez zmian, też połamany na linie przez czat', async () => {
    const s = sample();
    const code = await saveToCode(s);
    expect(code.startsWith('PB1-')).toBe(true);
    expect(code).toMatch(/^PB1-[\w-]+$/);
    expect(await codeToSave(code)).toEqual(s);
    const wrapped = code.replace(/(.{40})/g, '$1\n  ');
    expect(await codeToSave(wrapped)).toEqual(s);
  });

  it('cudzy JSON, śmieci i ucięty kod są odrzucane', async () => {
    expect(fileToSave('{"bottles": 5}')).toBe('invalid');
    expect(fileToSave('nie json')).toBe('invalid');
    expect(await codeToSave('hello')).toBe('invalid');
    const code = await saveToCode(sample());
    expect(await codeToSave(code.slice(0, code.length / 2))).toBe('invalid');
  });

  it('zapis z nowszej wersji gry nie jest wczytywany po kawałku', () => {
    const text = JSON.stringify({ app: 'piotrobonk', version: SAVE_VERSION + 1, save: sample() });
    expect(fileToSave(text)).toBe('newer');
  });

  it('starszy zapis przechodzi przez migracje', () => {
    const text = JSON.stringify({ app: 'piotrobonk', version: 1, save: { bottles: 40, runs: 3, stations: { fabryczna: { cleared: 'spokojny', bestTime: 100, bestKills: 50 } } } });
    const s = fileToSave(text);
    expect(s).not.toBe('invalid');
    if (typeof s === 'string') return;
    expect(s.bottles).toBe(40);
    expect(s.inventory).toEqual([]);
    expect(s.introSeen).toBe(true);
  });
});
