import { UI } from '../content/ui';
import { h } from './dom';

export interface DebugHooks {
  stats: () => string;
  god: (on: boolean) => void;
  level: () => void;
  spawn: () => void;
  clear: () => void;
  vacuum: () => void;
  bottles: () => void;
}

/** F1 panel, only with ?debug=1. */
export class DebugPanel {
  readonly root = h('div', 'debug');
  private readonly text = h('pre', 'debug__stats');
  private next = 0;
  private god = false;

  constructor(
    parent: HTMLElement,
    private readonly hooks: DebugHooks,
  ) {
    const D = UI.debug;
    const godBtn = h('button', 'btn btn--small', D.god);
    godBtn.addEventListener('click', () => {
      this.god = !this.god;
      godBtn.classList.toggle('is-on', this.god);
      hooks.god(this.god);
    });
    const add = (label: string, fn: () => void): HTMLButtonElement => {
      const b = h('button', 'btn btn--small', label);
      b.addEventListener('click', fn);
      return b;
    };
    this.root.append(h('h3', '', D.title), this.text, godBtn, add(D.level, hooks.level), add(D.spawn, hooks.spawn), add(D.clear, hooks.clear), add(D.vacuum, hooks.vacuum), add(D.bottles, hooks.bottles));
    this.root.hidden = true;
    parent.append(this.root);
  }

  toggle(): void {
    this.root.hidden = !this.root.hidden;
  }

  update(now: number): void {
    if (this.root.hidden || now < this.next) return;
    this.next = now + 250;
    this.text.textContent = this.hooks.stats();
  }
}
