// Player settings persisted in localStorage. Every key is prefixed "piotrobonk:" (github.io is one origin).

import type { QualityId } from '../render/quality';

/** Actions whose keyboard key can be changed (Esc and the arrows always keep working, so nobody locks themselves out). */
export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'jump' | 'slide' | 'interact';
/** Actions whose gamepad button can be changed. */
export type PadAction = 'jump' | 'slide' | 'interact' | 'pause';

export const KEY_ACTIONS: KeyAction[] = ['up', 'down', 'left', 'right', 'jump', 'slide', 'interact'];
export const PAD_ACTIONS: PadAction[] = ['jump', 'slide', 'interact', 'pause'];
export const DEFAULT_KEYS: Record<KeyAction, string> = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', slide: 'ShiftLeft', interact: 'KeyE' };
/** Standard gamepad mapping: A, B, Y, Start. */
export const DEFAULT_PAD: Record<PadAction, number> = { jump: 0, slide: 1, interact: 3, pause: 9 };

export const FPS_LIMITS = [0, 30, 60, 120, 144] as const;
export const TEXT_SCALES = [1, 1.15, 1.3] as const;
export const TOUCH_SCALES = [1, 1.2, 1.4] as const;
const QUALITIES: (QualityId | 'auto')[] = ['auto', 'niskie', 'srednie', 'wysokie', 'ultra'];

export interface Settings {
  music: number;
  sfx: number;
  /** Menu clicks, toasts and other interface sounds. */
  ui: number;
  sensitivity: number;
  invertY: boolean;
  /** Vertical field of view, degrees. */
  fov: number;
  quality: QualityId | 'auto';
  /** Frames per second at most; 0 = the display's own rate. */
  fpsLimit: number;
  shake: boolean;
  /** Full-screen flashes (the slap, explosions, level-ups). Off for anyone sensitive to them. */
  flashes: boolean;
  textScale: number;
  /** Rarity and danger colours get shapes and a palette that does not rely on red against green. */
  colorblind: boolean;
  /** Gamepad rumble, and the phone's vibration. */
  vibration: boolean;
  /** Size of the touch buttons (thumbs differ). */
  touchScale: number;
  keys: Record<KeyAction, string>;
  pad: Record<PadAction, number>;
}

const KEY = 'piotrobonk:settings';
const VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  music: 0.7,
  sfx: 0.9,
  ui: 0.8,
  sensitivity: 1,
  invertY: false,
  fov: 70,
  quality: 'auto',
  fpsLimit: 0,
  shake: true,
  flashes: true,
  textScale: 1,
  colorblind: false,
  vibration: true,
  touchScale: 1,
  keys: { ...DEFAULT_KEYS },
  pad: { ...DEFAULT_PAD },
};

const CODE = /^[A-Za-z][A-Za-z0-9]{1,24}$/;

/** Loads settings, falling back to defaults for anything missing or malformed (and when storage is blocked). */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as { version?: number; settings?: Partial<Record<keyof Settings, unknown>> };
    return readSettings(data.settings ?? {});
  } catch {
    return defaults();
  }
}

const defaults = (): Settings => ({ ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS }, pad: { ...DEFAULT_PAD } });

/** Repairs stored (or imported) settings: anything missing, malformed or out of range gets its default. */
export function readSettings(s: Partial<Record<keyof Settings, unknown>>): Settings {
  const d = DEFAULT_SETTINGS;
  const num = (v: unknown, def: number, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
  const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
  const oneOf = <T>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def);
  const keys = { ...DEFAULT_KEYS };
  const k = (typeof s.keys === 'object' && s.keys !== null ? s.keys : {}) as Partial<Record<KeyAction, unknown>>;
  for (const a of KEY_ACTIONS) {
    const code = k[a];
    if (typeof code === 'string' && CODE.test(code) && code !== 'Escape') keys[a] = code;
  }
  const pad = { ...DEFAULT_PAD };
  const p = (typeof s.pad === 'object' && s.pad !== null ? s.pad : {}) as Partial<Record<PadAction, unknown>>;
  for (const a of PAD_ACTIONS) {
    const b = p[a];
    if (typeof b === 'number' && Number.isInteger(b) && b >= 0 && b < 20) pad[a] = b;
  }
  return {
    music: num(s.music, d.music, 0, 1),
    sfx: num(s.sfx, d.sfx, 0, 1),
    ui: num(s.ui, d.ui, 0, 1),
    sensitivity: num(s.sensitivity, d.sensitivity, 0.2, 3),
    invertY: bool(s.invertY, d.invertY),
    fov: Math.round(num(s.fov, d.fov, 55, 100)),
    quality: oneOf(s.quality, QUALITIES, d.quality),
    fpsLimit: oneOf(s.fpsLimit, FPS_LIMITS, 0),
    shake: bool(s.shake, d.shake),
    flashes: bool(s.flashes, d.flashes),
    textScale: oneOf(s.textScale, TEXT_SCALES, 1),
    colorblind: bool(s.colorblind, d.colorblind),
    vibration: bool(s.vibration, d.vibration),
    touchScale: oneOf(s.touchScale, TOUCH_SCALES, 1),
    keys,
    pad,
  };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, settings: s }));
  } catch {
    // Private mode or storage disabled: settings just do not persist.
  }
}

/**
 * Binds `code` to `action`. A key can do one thing: whatever action had it before gets this action's old
 * key (a swap), so no action is ever left without a key.
 */
export function bindKey(keys: Record<KeyAction, string>, action: KeyAction, code: string): void {
  const other = KEY_ACTIONS.find((a) => a !== action && keys[a] === code);
  if (other) keys[other] = keys[action];
  keys[action] = code;
}

/** Same for gamepad buttons. */
export function bindPad(pad: Record<PadAction, number>, action: PadAction, button: number): void {
  const other = PAD_ACTIONS.find((a) => a !== action && pad[a] === button);
  if (other) pad[other] = pad[action];
  pad[action] = button;
}
