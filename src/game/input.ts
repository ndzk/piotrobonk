// Keyboard + mouse (pointer lock) + gamepad. Movement is read every sim step; presses are latched until
// consumed so a tap between two simulation steps is never lost.

export type Action = 'jump' | 'slide' | 'pause' | 'confirm' | 'back' | 'up' | 'down' | 'left' | 'right' | 'card1' | 'card2' | 'card3' | 'reroll' | 'skip' | 'banish' | 'debug' | 'interact';

const KEYS: Record<string, Action[]> = {
  Space: ['jump', 'confirm'],
  ShiftLeft: ['slide'],
  ShiftRight: ['slide'],
  ControlLeft: ['slide'],
  KeyC: ['slide'],
  Escape: ['pause', 'back'],
  KeyP: ['pause'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
  Backspace: ['back'],
  ArrowUp: ['up'],
  ArrowDown: ['down'],
  ArrowLeft: ['left'],
  ArrowRight: ['right'],
  KeyW: ['up'],
  KeyS: ['down'],
  KeyA: ['left'],
  KeyD: ['right'],
  Digit1: ['card1'],
  Digit2: ['card2'],
  Digit3: ['card3'],
  KeyR: ['reroll'],
  KeyX: ['skip'],
  KeyB: ['banish'],
  F1: ['debug'],
  KeyE: ['interact'],
  KeyF: ['interact'],
};

// Standard gamepad mapping.
const PAD: [number, Action[]][] = [
  [0, ['jump', 'confirm']],
  [1, ['slide', 'back']],
  [2, ['slide', 'reroll']],
  [3, ['skip', 'interact']],
  [9, ['pause']],
  [8, ['banish']],
  [12, ['up']],
  [13, ['down']],
  [14, ['left']],
  [15, ['right']],
];

export class Input {
  private readonly down = new Set<string>();
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
  /** Set by the bot (?bot=1) to drive the game instead of the player. */
  override: ((input: Input) => void) | null = null;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1' || e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Backspace') e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.usingPad = false;
      for (const a of KEYS[e.code] ?? []) this.latched.add(a);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });
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
    if (this.pointerLocked || this.override) return;
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

  /** Polls the gamepad and recomputes the movement vector. Call once per rendered frame. */
  poll(): void {
    let mx = 0;
    let my = 0;
    const k = (code: string): boolean => this.down.has(code);
    if (k('KeyW') || k('ArrowUp')) my += 1;
    if (k('KeyS') || k('ArrowDown')) my -= 1;
    if (k('KeyD') || k('ArrowRight')) mx += 1;
    if (k('KeyA') || k('ArrowLeft')) mx -= 1;
    this.held.clear();
    if (k('Space')) this.held.add('jump');
    if (k('ShiftLeft') || k('ShiftRight') || k('ControlLeft') || k('KeyC')) this.held.add('slide');

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
          for (const [idx, acts] of PAD) if (idx === i) for (const a of acts) this.latched.add(a);
        }
        if (b.pressed) for (const [idx, acts] of PAD) if (idx === i) for (const a of acts) this.held.add(a);
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
