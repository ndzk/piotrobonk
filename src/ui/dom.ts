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

/** mm:ss, or h:mm:ss once a counter passes an hour ("Czas do domu" adds up over many runs). */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  if (s < 3600) return `${String(Math.floor(s / 60)).padStart(2, '0')}:${ss}`;
  return `${Math.floor(s / 3600)}:${mm}:${ss}`;
}
