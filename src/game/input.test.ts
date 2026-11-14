import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYS, DEFAULT_PAD } from '../core/settings';
import { isReservedKey, keyMap, padMap } from './input';

describe('sterowanie', () => {
  it('domyślne klawisze robią to, co zawsze', () => {
    const m = keyMap(DEFAULT_KEYS);
    expect(m.Space).toEqual(['confirm', 'jump']);
    expect(m.KeyW).toEqual(['up']);
    expect(m.ShiftLeft).toEqual(['slide']);
    expect(m.KeyC).toEqual(['slide']);
    expect(m.KeyE).toEqual(['interact']);
    expect(m.KeyF).toEqual(['interact']);
    expect(m.Escape).toEqual(['pause', 'back']);
  });

  it('przepięty klawisz przejmuje akcję, a zapasowy znika, gdy jest zajęty', () => {
    const m = keyMap({ ...DEFAULT_KEYS, jump: 'KeyC', interact: 'KeyQ' });
    expect(m.KeyC).toEqual(['jump']);
    expect(m.Space).toEqual(['confirm']);
    expect(m.KeyQ).toEqual(['interact']);
    expect(m.KeyE).toBeUndefined();
  });

  it('pad: A zawsze zatwierdza, skok można przenieść', () => {
    const def = padMap(DEFAULT_PAD);
    expect(def[0]).toEqual(['confirm', 'jump']);
    expect(def[2]).toEqual(['reroll', 'slide']);
    const moved = padMap({ ...DEFAULT_PAD, jump: 2 });
    expect(moved[0]).toEqual(['confirm']);
    expect(moved[2]).toEqual(['reroll', 'jump']);
  });

  it('klawisze menu są zastrzeżone', () => {
    expect(isReservedKey('Escape')).toBe(true);
    expect(isReservedKey('Enter')).toBe(true);
    expect(isReservedKey('ArrowUp')).toBe(true);
    expect(isReservedKey('Space')).toBe(false);
    expect(isReservedKey('KeyJ')).toBe(false);
  });
});
