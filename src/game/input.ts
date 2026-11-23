// Keyboard + mouse (pointer lock) + gamepad + the touch controls. Movement is read every sim step; presses
// are latched until consumed so a tap between two simulation steps is never lost. Keys and pad buttons for
// the game's actions follow the player's bindings (settings).

import { DEFAULT_KEYS, DEFAULT_PAD, KEY_ACTIONS, PAD_ACTIONS, type KeyAction, type PadAction } from '../core/settings';

export const ACTIONS = ['jump', 'slide', 'pause', 'confirm', 'back', 'up', 'down', 'left', 'right', 'card1', 'card2', 'card3', 'reroll', 'skip', 'banish', 'debug', 'interact', 'tabPrev', 'tabNext'] as const;
export type Action = (typeof ACTIONS)[number];

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


/**
 * One axis of a stick past its dead zone (the other axis gives the stick's tilt): 0 inside, then rescaled so
 * the edge of the dead zone is 0 and full tilt is 1.
 */
function deadZone(a: number, other: number): number {
  const m = Math.hypot(a, other);
  if (m < 0.18) return 0;
  return a * (Math.min(1, (m - 0.18) / 0.82) / m);
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
    // Every frame: no closures, tuples or objects built here (CLAUDE.md: no allocations in the game loop).
    let mx = 0;
    let my = 0;
    const d = this.down;
    const b = this.keys;
    if (d.has(b.up) || d.has('ArrowUp')) my += 1;
    if (d.has(b.down) || d.has('ArrowDown')) my -= 1;
    if (d.has(b.right) || d.has('ArrowRight')) mx += 1;
    if (d.has(b.left) || d.has('ArrowLeft')) mx -= 1;
    this.held.clear();
    if (d.has(b.jump)) this.held.add('jump');
    for (const code of this.slideKeys) {
      if (!d.has(code)) continue;
      this.held.add('slide');
      break;
    }
    mx += this.touch.x;
    my += this.touch.y;
    if (this.touch.jump) this.held.add('jump');
    if (this.touch.slide) this.held.add('slide');

    this.padLookX = 0;
    this.padLookY = 0;
    let pad: Gamepad | null = null;
    if (typeof navigator.getGamepads === 'function') {
      for (const p of navigator.getGamepads()) {
        if (p?.connected) {
          pad = p;
          break;
        }
      }
    }
    if (pad) {
      const lx = deadZone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const ly = deadZone(pad.axes[1] ?? 0, pad.axes[0] ?? 0);
      const rx = deadZone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      const ry = deadZone(pad.axes[3] ?? 0, pad.axes[2] ?? 0);
      if (lx || ly || rx || ry) this.usingPad = true;
      mx += lx;
      my -= ly;
      this.padLookX = rx;
      this.padLookY = ry;
      const buttons = pad.buttons;
      for (let i = 0; i < buttons.length; i++) {
        const pressed = buttons[i].pressed;
        const was = this.padButtons[i] ?? false;
        const acts = this.padActions[i] as Action[] | undefined;
        if (pressed && !was) {
          this.usingPad = true;
          if (acts) for (const a of acts) this.latched.add(a);
        }
        if (pressed && acts) for (const a of acts) this.held.add(a);
        this.padButtons[i] = pressed;
      }
      // Left stick flicks act as menu navigation.
      const sx = Math.abs(lx) > 0.6 ? Math.sign(lx) : 0;
      const sy = Math.abs(ly) > 0.6 ? Math.sign(ly) : 0;
      if (sx && sx !== this.padStickLatch.x) this.latched.add(sx > 0 ? 'right' : 'left');
      if (sy && sy !== this.padStickLatch.y) this.latched.add(sy > 0 ? 'down' : 'up');
      this.padStickLatch.x = sx;
      this.padStickLatch.y = sy;
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

  /** Held (`which` 0) or latched (1) actions as a bit set over `ACTIONS`, for replays. */
  bits(which: 0 | 1): number {
    const set = which === 0 ? this.held : this.latched;
    let b = 0;
    for (let k = 0; k < ACTIONS.length; k++) if (set.has(ACTIONS[k])) b |= 1 << k;
    return b;
  }

  /** A recorded frame's input, exactly as the game read it (replays). */
  replayFrame(moveX: number, moveY: number, held: number, latched: number, lookX: number, lookY: number, padLookX: number, padLookY: number): void {
    this.moveX = moveX;
    this.moveY = moveY;
    this.held.clear();
    this.latched.clear();
    for (let k = 0; k < ACTIONS.length; k++) {
      if (held & (1 << k)) this.held.add(ACTIONS[k]);
      if (latched & (1 << k)) this.latched.add(ACTIONS[k]);
    }
    this.lookX = lookX;
    this.lookY = lookY;
    this.padLookX = padLookX;
    this.padLookY = padLookY;
  }

  /** Drops every pending press (when switching screens). */
  flush(): void {
    this.latched.clear();
    this.lookX = 0;
    this.lookY = 0;
  }

  /** The mouse/touch look gathered since the last call, in `lookOutX` / `lookOutY` (no tuple per frame). */
  takeLook(): void {
    this.lookOutX = this.lookX;
    this.lookOutY = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
  }

  lookOutX = 0;
  lookOutY = 0;
}
