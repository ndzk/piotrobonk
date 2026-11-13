// Player settings persisted in localStorage. Every key is prefixed "piotrobonk:" (github.io is one origin).

export interface Settings {
  music: number;
  sfx: number;
  sensitivity: number;
  invertY: boolean;
  shake: boolean;
}

const KEY = 'piotrobonk:settings';
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = { music: 0.7, sfx: 0.9, sensitivity: 1, invertY: false, shake: true };

/** Loads settings, falling back to defaults for anything missing or malformed (and when storage is blocked). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const data = JSON.parse(raw) as { version?: number; settings?: Partial<Settings> };
    const s = data.settings ?? {};
    const num = (v: unknown, d: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    return {
      music: num(s.music, DEFAULT_SETTINGS.music, 0, 1),
      sfx: num(s.sfx, DEFAULT_SETTINGS.sfx, 0, 1),
      sensitivity: num(s.sensitivity, DEFAULT_SETTINGS.sensitivity, 0.2, 3),
      invertY: typeof s.invertY === 'boolean' ? s.invertY : DEFAULT_SETTINGS.invertY,
      shake: typeof s.shake === 'boolean' ? s.shake : DEFAULT_SETTINGS.shake,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, settings: s }));
  } catch {
    // Private mode or storage disabled: settings just do not persist.
  }
}
