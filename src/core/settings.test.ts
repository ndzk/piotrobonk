import { beforeEach, describe, expect, it } from 'vitest';
import { bindKey, bindPad, DEFAULT_KEYS, DEFAULT_PAD, DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
  });
});

describe('settings', () => {
  it('round-trips under the piotrobonk: prefix', () => {
    saveSettings({ ...DEFAULT_SETTINGS, music: 0.3, invertY: true, quality: 'srednie', fpsLimit: 60, keys: { ...DEFAULT_KEYS, jump: 'KeyJ' } });
    expect([...store.keys()]).toEqual(['piotrobonk:settings']);
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, music: 0.3, invertY: true, quality: 'srednie', fpsLimit: 60, keys: { ...DEFAULT_KEYS, jump: 'KeyJ' } });
  });

  it('repairs malformed or out-of-range data', () => {
    store.set('piotrobonk:settings', JSON.stringify({ version: 1, settings: { music: 7, sfx: 'loud', sensitivity: -1, fov: 300, quality: 'kosmiczna', fpsLimit: 75, keys: { jump: 'Escape', up: 42, slide: 'KeyQ' }, pad: { jump: -3, slide: 2 } } }));
    const s = loadSettings();
    expect(s.music).toBe(1);
    expect(s.sfx).toBe(DEFAULT_SETTINGS.sfx);
    expect(s.sensitivity).toBe(0.2);
    expect(s.fov).toBe(100);
    expect(s.quality).toBe('auto');
    expect(s.fpsLimit).toBe(0);
    // Esc can never be taken from pause; junk keeps the default; a real key is kept.
    expect(s.keys).toEqual({ ...DEFAULT_KEYS, slide: 'KeyQ' });
    expect(s.pad).toEqual({ ...DEFAULT_PAD, slide: 2 });
    store.set('piotrobonk:settings', '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('version 1 settings keep what they had and get defaults for the rest', () => {
    store.set('piotrobonk:settings', JSON.stringify({ version: 1, settings: { music: 0.2, sfx: 0.5, sensitivity: 1.4, invertY: true, shake: false } }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, music: 0.2, sfx: 0.5, sensitivity: 1.4, invertY: true, shake: false });
  });

  it('rebinding a taken key swaps the two, so nothing is left unbound', () => {
    const keys = { ...DEFAULT_KEYS };
    bindKey(keys, 'jump', 'KeyE');
    expect(keys.jump).toBe('KeyE');
    expect(keys.interact).toBe('Space');
    bindKey(keys, 'up', 'KeyI');
    expect(keys.up).toBe('KeyI');
    expect(new Set(Object.values(keys)).size).toBe(Object.keys(keys).length);
    const pad = { ...DEFAULT_PAD };
    bindPad(pad, 'slide', 0);
    expect(pad).toEqual({ ...DEFAULT_PAD, slide: 0, jump: 1 });
  });
});
