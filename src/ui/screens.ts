import { audio } from '../audio/audio';
import { UI } from '../content/ui';
import type { Input } from '../game/input';
import type { Settings } from '../core/settings';
import { Menu, enter, fmtTime, h, leave } from './dom';

/** Title overlay prompt: loading state, then "click to start" with the control list. */
export class StartPrompt {
  readonly root = h('div', 'start');
  private readonly prompt = h('div', 'start__prompt', UI.start.loading);

  constructor(parent: HTMLElement) {
    const controls = h('dl', 'start__controls');
    for (const [k, v] of UI.start.controls) controls.append(h('dt', '', k), h('dd', '', v));
    this.root.append(this.prompt, controls);
    parent.append(this.root);
  }

  ready(): void {
    this.prompt.textContent = UI.start.prompt;
    this.root.classList.add('is-ready');
  }

  show(on: boolean): void {
    if (on) enter(this.root);
    else leave(this.root);
  }
}

interface Option {
  label: string;
  value: () => string;
  change: (dir: 1 | -1) => void;
}

/** Pause: resume / quit plus the basic settings (adjust with ←/→ or by clicking). */
export class PauseScreen {
  readonly root = h('div', 'overlay pause');
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly options: (Option | null)[] = [];
  private readonly menu: Menu;

  constructor(parent: HTMLElement, onResume: () => void, onQuit: () => void, settings: Settings, onChange: (s: Settings) => void) {
    const P = UI.pause;
    const box = h('div', 'panel');
    const resume = h('button', 'btn', P.resume);
    const quit = h('button', 'btn btn--ghost', P.quit);
    resume.addEventListener('click', () => {
      audio.play('click');
      onResume();
    });
    quit.addEventListener('click', () => {
      audio.play('back');
      onQuit();
    });
    const pct = (v: number): string => `${Math.round(v * 100)}%`;
    const step = (v: number, dir: number, lo: number, hi: number, d: number): number => Math.round(Math.min(hi, Math.max(lo, v + dir * d)) * 100) / 100;
    const yesNo = (b: boolean): string => (b ? P.on : P.off);
    const commit = (): void => {
      onChange(settings);
    };
    const opts: Option[] = [
      { label: P.music, value: () => pct(settings.music), change: (d) => {
          settings.music = step(settings.music, d, 0, 1, 0.1);
          commit();
        } },
      { label: P.sfx, value: () => pct(settings.sfx), change: (d) => {
          settings.sfx = step(settings.sfx, d, 0, 1, 0.1);
          commit();
        } },
      { label: P.sensitivity, value: () => `${settings.sensitivity.toFixed(1).replace('.', ',')}×`, change: (d) => {
          settings.sensitivity = step(settings.sensitivity, d, 0.2, 3, 0.1);
          commit();
        } },
      { label: P.invertY, value: () => yesNo(settings.invertY), change: () => {
          settings.invertY = !settings.invertY;
          commit();
        } },
      { label: P.shake, value: () => yesNo(settings.shake), change: () => {
          settings.shake = !settings.shake;
          commit();
        } },
    ];
    const optionBox = h('div', 'pause__options');
    this.buttons.push(resume);
    this.options.push(null);
    for (const o of opts) {
      const b = h('button', 'option');
      const name = h('span', 'option__name', o.label);
      const val = h('span', 'option__value', o.value());
      b.append(name, val);
      b.addEventListener('click', (e) => {
        o.change(e.shiftKey ? -1 : 1);
        val.textContent = o.value();
        audio.play('click');
      });
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        o.change(-1);
        val.textContent = o.value();
        audio.play('click');
      });
      optionBox.append(b);
      this.buttons.push(b);
      this.options.push({ ...o, value: () => (val.textContent = o.value()) });
    }
    this.buttons.push(quit);
    this.options.push(null);
    box.append(h('h2', 'panel__title', P.title), h('p', 'panel__hint', P.hint), resume, optionBox, quit);
    this.root.append(box);
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new Menu(() => this.buttons);
    this.menu.bindHover();
  }

  open(): void {
    enter(this.root);
    this.menu.focus(0, false);
  }

  close(): void {
    leave(this.root);
  }

  handleInput(input: Input, resume: () => void): void {
    if (input.consume('pause') || input.consume('back')) {
      audio.play('click');
      resume();
      return;
    }
    const o = this.options[this.menu.index];
    for (const [action, dir] of [
      ['left', -1],
      ['right', 1],
    ] as const) {
      if (!input.consume(action) || !o) continue;
      o.change(dir);
      o.value();
      audio.play('click');
    }
    this.menu.handle(input);
  }
}

export interface Summary {
  time: number;
  level: number;
  kills: number;
  weapons: { name: string; damage: number }[];
  line: string;
}

export class SummaryScreen {
  readonly root = h('div', 'overlay summary');
  private readonly body = h('div', 'summary__body');
  private readonly buttons: HTMLButtonElement[];
  private readonly menu: Menu;

  constructor(parent: HTMLElement, onAgain: () => void, onMenu: () => void) {
    const box = h('div', 'panel panel--wide');
    const again = h('button', 'btn', UI.summary.again);
    const menu = h('button', 'btn btn--ghost', UI.summary.menu);
    again.addEventListener('click', () => {
      audio.play('start');
      onAgain();
    });
    menu.addEventListener('click', () => {
      audio.play('back');
      onMenu();
    });
    this.buttons = [again, menu];
    const row = h('div', 'panel__row');
    row.append(...this.buttons);
    box.append(h('h2', 'panel__title', UI.summary.title), this.body, row);
    this.root.append(box);
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new Menu(() => this.buttons, true);
    this.menu.bindHover();
  }

  open(s: Summary): void {
    const S = UI.summary;
    const stats = h('dl', 'summary__stats');
    const stat = (k: string, v: string): void => {
      stats.append(h('dt', '', k), h('dd', '', v));
    };
    stat(S.time, fmtTime(s.time));
    stat(S.level, String(s.level));
    stat(S.kills, String(s.kills));
    const chart = h('div', 'summary__chart');
    chart.append(h('h3', '', S.damage));
    const best = Math.max(1, ...s.weapons.map((w) => w.damage));
    for (const w of s.weapons) {
      const dps = w.damage / Math.max(1, s.time);
      const row = h('div', 'summary__bar');
      const fill = h('div', 'summary__fill');
      fill.style.setProperty('--w', String(w.damage / best));
      row.append(h('span', 'summary__name', w.name), fill, h('span', 'summary__value', dps.toFixed(1).replace('.', ',')));
      chart.append(row);
    }
    this.body.replaceChildren(h('p', 'panel__hint', s.line), stats, chart);
    enter(this.root);
    this.menu.focus(0, false);
  }

  close(): void {
    leave(this.root);
  }

  handleInput(input: Input): void {
    this.menu.handle(input);
  }
}
