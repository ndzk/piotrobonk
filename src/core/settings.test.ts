import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
  });
});

describe('settings', () => {
  it('round-trips under the piotrobonk: prefix', () => {
    saveSettings({ ...DEFAULT_SETTINGS, music: 0.3, invertY: true });
    expect([...store.keys()]).toEqual(['piotrobonk:settings']);
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, music: 0.3, invertY: true });
  });

  it('repairs malformed or out-of-range data', () => {
    store.set('piotrobonk:settings', JSON.stringify({ version: 1, settings: { music: 7, sfx: 'loud', sensitivity: -1 } }));
    const s = loadSettings();
    expect(s.music).toBe(1);
    expect(s.sfx).toBe(DEFAULT_SETTINGS.sfx);
    expect(s.sensitivity).toBe(0.2);
    store.set('piotrobonk:settings', '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
