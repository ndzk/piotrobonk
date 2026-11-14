import { audio } from '../audio/audio';
import type { Input } from '../game/input';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}

/** Restarts a CSS animation tied to a class. */
export function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  el.getBoundingClientRect();
  el.classList.add(cls);
}

/** Shows an overlay with its enter animation. */
export function enter(el: HTMLElement): void {
  el.hidden = false;
  el.classList.remove('is-out');
  el.classList.add('is-in');
}

/** Plays the exit animation, then hides. */
export function leave(el: HTMLElement): void {
  if (el.hidden) return;
  el.classList.remove('is-in');
  el.classList.add('is-out');
  const done = (): void => {
    if (el.classList.contains('is-out')) el.hidden = true;
  };
  el.addEventListener('animationend', done, { once: true });
  // Reduced motion (no animation): hide right away.
  window.setTimeout(done, 400);
}

/** Keyboard/gamepad focus over a row or column of buttons. */
export class Menu {
  index = 0;

  constructor(
    private readonly buttons: () => HTMLButtonElement[],
    private readonly horizontal = false,
  ) {}

  focus(i: number, sound = true): void {
    const list = this.buttons().filter((b) => !b.disabled);
    if (!list.length) return;
    const next = ((i % list.length) + list.length) % list.length;
    if (next !== this.index && sound) audio.play('hover');
    this.index = next;
    for (const b of this.buttons()) b.classList.remove('is-focused');
    list[next]?.classList.add('is-focused');
  }

  handle(input: Input): void {
    const prev = this.horizontal ? 'left' : 'up';
    const next = this.horizontal ? 'right' : 'down';
    if (input.consume(prev)) this.focus(this.index - 1);
    if (input.consume(next)) this.focus(this.index + 1);
    if (input.consume('confirm')) {
      const list = this.buttons().filter((b) => !b.disabled);
      list[this.index]?.click();
    }
  }

  bindHover(): void {
    this.buttons().forEach((b) => {
      b.addEventListener('pointerenter', () => {
        const list = this.buttons().filter((x) => !x.disabled);
        const i = list.indexOf(b);
        if (i >= 0) this.focus(i);
      });
    });
  }
}

/**
 * Keyboard and gamepad focus for screens laid out in two dimensions (tabs, grids of tiles, action rows):
 * an arrow moves to the nearest enabled button in that direction, measured on screen.
 */
export class SpatialMenu {
  private current: HTMLButtonElement | null = null;

  constructor(private readonly buttons: () => HTMLButtonElement[]) {}

  get focused(): HTMLButtonElement | null {
    return this.current && this.current.isConnected && !this.current.disabled ? this.current : null;
  }

  focus(b: HTMLButtonElement | null, sound = true): void {
    if (b === this.current) return;
    this.current?.classList.remove('is-focused');
    this.current = b;
    if (!b) return;
    b.classList.add('is-focused');
    b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (sound) audio.play('hover');
  }

  /** Focuses the first enabled button if nothing valid has focus. */
  ensure(): void {
    if (this.focused) return;
    this.focus(this.buttons().find((b) => !b.disabled && b.offsetParent !== null) ?? null, false);
  }

  /** Mouse hover moves the keyboard focus too, so both never point at different things. */
  bind(b: HTMLButtonElement): void {
    b.addEventListener('pointerenter', () => {
      if (!b.disabled) this.focus(b, false);
    });
  }

  handle(input: Input): void {
    for (const [action, dx, dy] of [
      ['left', -1, 0],
      ['right', 1, 0],
      ['up', 0, -1],
      ['down', 0, 1],
    ] as const) {
      if (input.consume(action)) this.move(dx, dy);
    }
    if (input.consume('confirm')) {
      this.ensure();
      this.focused?.click();
    }
  }

  private move(dx: number, dy: number): void {
    const from = this.focused;
    if (!from) {
      this.ensure();
      return;
    }
    const a = from.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best: HTMLButtonElement | null = null;
    let bestScore = Infinity;
    for (const b of this.buttons()) {
      if (b === from || b.disabled || b.offsetParent === null) continue;
      const r = b.getBoundingClientRect();
      const ox = r.left + r.width / 2 - ax;
      const oy = r.top + r.height / 2 - ay;
      const along = ox * dx + oy * dy;
      if (along <= 4) continue;
      const across = Math.abs(ox * dy) + Math.abs(oy * dx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    if (best) this.focus(best);
  }
}

/** mm:ss, or h:mm:ss once a counter passes an hour ("Czas do domu" adds up over many runs). */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  if (s < 3600) return `${String(Math.floor(s / 60)).padStart(2, '0')}:${ss}`;
  return `${Math.floor(s / 3600)}:${mm}:${ss}`;
}
