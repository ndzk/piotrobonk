// Keyboard + mouse (pointer lock) + gamepad + the touch controls. Movement is read every sim step; presses
// are latched until consumed so a tap between two simulation steps is never lost. Keys and pad buttons for
// the game's actions follow the player's bindings (settings).

import { DEFAULT_KEYS, DEFAULT_PAD, KEY_ACTIONS, PAD_ACTIONS, type KeyAction, type PadAction } from '../core/settings';

export type Action = 'jump' | 'slide' | 'pause' | 'confirm' | 'back' | 'up' | 'down' | 'left' | 'right' | 'card1' | 'card2' | 'card3' | 'reroll' | 'skip' | 'banish' | 'debug' | 'interact' | 'tabPrev' | 'tabNext';

/** Keys that always do the same thing (menus, cards, pause): rebinding never takes them away. */
const FIXED_KEYS: Record<string, Action[]> = {
  Space: ['confirm'],
  Escape: ['pause', 'back'],
  KeyP: ['pause'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
  Backspace: ['back'],
  ArrowUp: ['up'],
  ArrowDown: ['down'],
  ArrowLeft: ['left'],
  ArrowRight: ['right'],
  Digit1: ['card1'],
  Digit2: ['card2'],
  Digit3: ['card3'],
  KeyR: ['reroll'],
  KeyX: ['skip'],
  KeyB: ['banish'],
  F1: ['debug'],
  PageUp: ['tabPrev'],
  PageDown: ['tabNext'],
};
/** Keys that cannot be given to an action: they are the menus' own (Space excepted: it can jump too). */
export const isReservedKey = (code: string): boolean => code !== 'Space' && code in FIXED_KEYS;

/** Second keys for an action, kept while nothing else is bound to them. */
// No Ctrl: held for a slide, Ctrl+W closes the browser tab mid-run.
const ALT_KEYS: [string, KeyAction][] = [
  ['ShiftRight', 'slide'],
  ['KeyC', 'slide'],
  ['KeyF', 'interact'],
];

/** Which actions every key code fires, for a set of bindings. */
export function keyMap(keys: Record<KeyAction, string>): Record<string, Action[]> {
  const map: Record<string, Action[]> = {};
  for (const [code, acts] of Object.entries(FIXED_KEYS)) map[code] = [...acts];
  const bound = new Set(Object.values(keys));
  for (const a of KEY_ACTIONS) (map[keys[a]] ??= []).push(a);
  for (const [code, a] of ALT_KEYS) if (!bound.has(code)) (map[code] ??= []).push(a);
  return map;
}

/** Gamepad buttons that keep their job: A confirms, B goes back, the d-pad navigates, X rerolls, Y skips. */
const FIXED_PAD: [number, Action[]][] = [
  [0, ['confirm']],
  [1, ['back']],
  [2, ['reroll']],
  [3, ['skip']],
  [4, ['tabPrev']],
  [5, ['tabNext']],
  [8, ['banish']],
  [12, ['up']],
  [13, ['down']],
  [14, ['left']],
  [15, ['right']],
];

/** Which actions every pad button fires, for a set of bindings (X also slides unless it was given away). */
export function padMap(pad: Record<PadAction, number>): Action[][] {
  const map: Action[][] = Array.from({ length: 20 }, () => []);
  for (const [i, acts] of FIXED_PAD) map[i].push(...acts);
  for (const a of PAD_ACTIONS) map[pad[a]].push(a);
  if (!PAD_ACTIONS.some((a) => pad[a] === 2)) map[2].push('slide');
  return map;
}

export class Input {
  private readonly down = new Set<string>();
  private keys: Record<KeyAction, string> = { ...DEFAULT_KEYS };
  private keyActions = keyMap(DEFAULT_KEYS);
  private padActions = padMap(DEFAULT_PAD);
  /** Held-down slide keys: the binding plus whichever second keys are still free. */
  private slideKeys: string[] = ['ShiftLeft', 'ShiftRight', 'KeyC'];
  private readonly latched = new Set<Action>();
  private readonly held = new Set<Action>();
  private padButtons: boolean[] = [];
  private padStickLatch = { x: 0, y: 0 };
  lookX = 0;
  lookY = 0;
  padLookX = 0;
  padLookY = 0;
  moveX = 0;
  moveY = 0;
  usingPad = false;
  /** The last thing used was a finger (prompts then say "Dotknij"). A phone starts out as one. */
  usingTouch = matchMedia('(pointer: coarse)').matches;
  /** Written by the touch controls: the stick (x right, y forward) and the held buttons. */
  readonly touch = { x: 0, y: 0, jump: false, slide: false };
  /** Set by the bot (?bot=1) to drive the game instead of the player. */
  override: ((input: Input) => void) | null = null;

  /** `listen = false` makes an input that only a bot drives (the hub's attract mode). */
  constructor(
    private readonly target: HTMLElement,
    private readonly listen = true,
  ) {
    if (!listen) return;
    window.addEventListener('keydown', (e) => {
      // Typing in a text box (the save code) is typing: only Esc still reaches the game (to leave the box).
      const t = e.target;
      if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && e.code !== 'Escape') return;
      if (e.code === 'F1' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Backspace') e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.usingPad = false;
      this.usingTouch = false;
      for (const a of this.keyActions[e.code] ?? []) this.latched.add(a);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });
    window.addEventListener(
      'pointerdown',
      (e) => {
        this.usingTouch = e.pointerType === 'touch';
        // Under pointer lock Chromium reports every finger at (0, 0): the stick would never move.
        if (this.usingTouch) this.unlockPointer();
      },
      { capture: true },
    );
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.target) return;
      this.lookX += e.movementX;
      this.lookY += e.movementY;
    });
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.target;
  }

  lockPointer(): void {
    // Fingers need no lock (and break under one); a mouse click takes it again.
    if (this.pointerLocked || this.override || this.usingTouch) return;
    const el = this.target as HTMLElement & { requestPointerLock(o?: { unadjustedMovement?: boolean }): Promise<void> | undefined };
    // Raw mouse input where supported; Safari and older browsers reject the option, so retry without it.
    const tryLock = (raw: boolean): void => {
      let result: Promise<void> | undefined;
      try {
        result = el.requestPointerLock(raw ? { unadjustedMovement: true } : undefined);
      } catch {
        if (raw) tryLock(false);
        return;
      }
      // Older Safari returns undefined instead of a promise.
      Promise.resolve(result).catch(() => {
        if (raw) tryLock(false);
      });
    };
    tryLock(true);
  }

  unlockPointer(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  /** The player's key and pad bindings (settings). */
  setBindings(keys: Record<KeyAction, string>, pad: Record<PadAction, number>): void {
    this.keys = { ...keys };
    this.keyActions = keyMap(keys);
    this.padActions = padMap(pad);
    this.slideKeys = Object.entries(this.keyActions)
      .filter(([, acts]) => acts.includes('slide'))
      .map(([code]) => code);
    this.down.clear();
  }

  /** Polls the gamepad and recomputes the movement vector. Call once per rendered frame. */
  poll(): void {
    if (!this.listen) {
      this.moveX = this.moveY = 0;
      this.override?.(this);
      return;
    }
    let mx = 0;
    let my = 0;
    const k = (code: string): boolean => this.down.has(code);
    const b = this.keys;
    if (k(b.up) || k('ArrowUp')) my += 1;
    if (k(b.down) || k('ArrowDown')) my -= 1;
    if (k(b.right) || k('ArrowRight')) mx += 1;
    if (k(b.left) || k('ArrowLeft')) mx -= 1;
    this.held.clear();
    if (k(b.jump)) this.held.add('jump');
    if (this.slideKeys.some(k)) this.held.add('slide');
    mx += this.touch.x;
    my += this.touch.y;
    if (this.touch.jump) this.held.add('jump');
    if (this.touch.slide) this.held.add('slide');

    this.padLookX = 0;
    this.padLookY = 0;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = pads.find((p) => p?.connected);
    if (pad) {
      const dz = (x: number, y: number): [number, number] => {
        const m = Math.hypot(x, y);
        if (m < 0.18) return [0, 0];
        const s = Math.min(1, (m - 0.18) / 0.82) / m;
        return [x * s, y * s];
      };
      const [lx, ly] = dz(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const [rx, ry] = dz(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      if (lx || ly || rx || ry) this.usingPad = true;
      mx += lx;
      my -= ly;
      this.padLookX = rx;
      this.padLookY = ry;
      pad.buttons.forEach((b, i) => {
        const was = this.padButtons[i] ?? false;
        if (b.pressed && !was) {
          this.usingPad = true;
          for (const a of this.padActions[i] ?? []) this.latched.add(a);
        }
        if (b.pressed) for (const a of this.padActions[i] ?? []) this.held.add(a);
        this.padButtons[i] = b.pressed;
      });
      // Left stick flicks act as menu navigation.
      const sx = Math.abs(lx) > 0.6 ? Math.sign(lx) : 0;
      const sy = Math.abs(ly) > 0.6 ? Math.sign(ly) : 0;
      if (sx && sx !== this.padStickLatch.x) this.latched.add(sx > 0 ? 'right' : 'left');
      if (sy && sy !== this.padStickLatch.y) this.latched.add(sy > 0 ? 'down' : 'up');
      this.padStickLatch = { x: sx, y: sy };
    }
    const m = Math.hypot(mx, my);
    this.moveX = m > 1 ? mx / m : mx;
    this.moveY = m > 1 ? my / m : my;
    this.override?.(this);
  }

  /** True once per press. */
  consume(a: Action): boolean {
    if (!this.latched.has(a)) return false;
    this.latched.delete(a);
    return true;
  }

  /**
   * Consumes all of the given actions and says whether any was pressed. Esc is both "back" and "pause":
   * `consume('back') || consume('pause')` would leave the other one latched for the next screen.
   */
  consumeAny(a: Action, b: Action, c?: Action): boolean {
    const x = this.latched.delete(a);
    const y = this.latched.delete(b);
    const z = c !== undefined && this.latched.delete(c);
    return x || y || z;
  }

  isHeld(a: Action): boolean {
    return this.held.has(a);
  }

  press(a: Action): void {
    this.latched.add(a);
  }

  hold(a: Action, on: boolean): void {
    if (on) this.held.add(a);
    else this.held.delete(a);
  }

  /** Drops every pending press (when switching screens). */
  flush(): void {
    this.latched.clear();
    this.lookX = 0;
    this.lookY = 0;
  }

  takeLook(): [number, number] {
    const v: [number, number] = [this.lookX, this.lookY];
    this.lookX = 0;
    this.lookY = 0;
    return v;
  }
}
