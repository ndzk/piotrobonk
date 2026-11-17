import { audio } from '../audio/audio';
import { UI } from '../content/ui';
import type { Input } from '../game/input';
import { Menu, enter, fmtTime, h, leave } from './dom';
import { BOTTLES } from '../content/items';
import { zl } from '../core/text';

/** Title overlay prompt: loading state, then "click to start" with the control list. */
export class StartPrompt {
  readonly root = h('div', 'start');
  private readonly prompt = h('div', 'start__prompt', UI.start.loading);
  private readonly controls = h('dl', 'start__controls');
  private line: string = UI.start.prompt;

  constructor(parent: HTMLElement) {
    this.root.append(this.prompt, this.controls);
    parent.append(this.root);
  }

  /** The control list (the player's own keys and buttons, or the touch layout) and the line that starts. */
  setControls(rows: readonly (readonly [string, string])[], line: string): void {
    this.controls.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', '', k), h('dd', '', v)]));
    this.line = line;
    if (this.root.classList.contains('is-ready')) this.prompt.textContent = line;
  }

  ready(): void {
    this.prompt.textContent = this.line;
    this.root.classList.add('is-ready');
  }

  show(on: boolean): void {
    if (on) enter(this.root);
    else leave(this.root);
  }
}

/** Pause: resume, the settings screen, or quit to the menu. */
export class PauseScreen {
  readonly root = h('div', 'overlay pause');
  private readonly buttons: HTMLButtonElement[];
  private readonly menu: Menu;

  constructor(parent: HTMLElement, onResume: () => void, onQuit: () => void, onSettings: () => void) {
    const P = UI.pause;
    const box = h('div', 'panel');
    const resume = h('button', 'btn', P.resume);
    const settings = h('button', 'btn btn--ghost', UI.settings.open);
    const quit = h('button', 'btn btn--ghost', P.quit);
    resume.addEventListener('click', () => {
      audio.play('click');
      onResume();
    });
    settings.addEventListener('click', () => {
      audio.play('click');
      onSettings();
    });
    quit.addEventListener('click', () => {
      audio.play('back');
      onQuit();
    });
    this.buttons = [resume, settings, quit];
    box.append(h('h2', 'panel__title', P.title), h('p', 'panel__hint', P.hint), resume, settings, quit, this.info);
    this.root.append(box);
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new Menu(() => this.buttons);
    this.menu.bindHover();
  }

  /** `info`: where the run stands (station, time, kurs) and the build, in small print under the buttons. */
  open(info = ''): void {
    if (info) this.info.textContent = info;
    enter(this.root);
    this.menu.focus(0, false);
  }

  private readonly info = h('p', 'pause__info');

  close(): void {
    leave(this.root);
  }

  handleInput(input: Input, resume: () => void): void {
    if (input.consumeAny('pause', 'back')) {
      audio.play('click');
      resume();
      return;
    }
    this.menu.handle(input);
  }
}

export interface Summary {
  time: number;
  level: number;
  kills: number;
  /** Damage per weapon and how long it was held (a weapon taken late is not judged on the whole run). */
  weapons: { name: string; damage: number; seconds: number }[];
  line: string;
  /** Bottles that went to the bank. */
  bottles: number;
  /** The last hits, newest first: who, with what, how much, how long before the end. */
  hits: { who: string; what: string; damage: number; ago: number }[];
}

export class SummaryScreen {
  readonly root = h('div', 'overlay summary');
  private readonly body = h('div', 'summary__body');
  private readonly buttons: HTMLButtonElement[];
  private readonly menu: Menu;

  constructor(parent: HTMLElement, onAgain: () => void, onMenu: () => void) {
    const box = h('div', 'panel panel--wide summary__panel');
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
    stat(S.bottles, `${s.bottles} (${zl(s.bottles * BOTTLES.deposit)})`);
    const chart = h('div', 'summary__chart');
    chart.append(h('h3', '', S.damage));
    const best = Math.max(1, ...s.weapons.map((w) => w.damage));
    for (const w of s.weapons) {
      const dps = w.damage / Math.max(1, w.seconds);
      const row = h('div', 'summary__bar');
      const fill = h('div', 'summary__fill');
      fill.style.setProperty('--w', String(w.damage / best));
      row.append(h('span', 'summary__name', w.name), fill, h('span', 'summary__value', dps.toFixed(1).replace('.', ',')));
      chart.append(row);
    }
    // "Co cię zajebało": the last five hits, the killing blow first, so a death is never a mystery.
    const death = h('div', 'summary__death');
    death.append(h('h3', '', UI.death.title));
    const list = h('ol', 'summary__hits');
    if (!s.hits.length) list.append(h('li', 'is-none', UI.death.none));
    s.hits.forEach((hit, k) => {
      const li = h('li', k === 0 ? 'is-last' : '');
      const when = k === 0 ? UI.death.killing : UI.death.ago.replace('{v}', hit.ago.toFixed(1).replace('.', ','));
      li.append(h('span', 'summary__hitdmg', `−${String(Math.max(1, Math.round(hit.damage)))}`), h('span', 'summary__hitwho', hit.who), h('span', 'summary__hitwhat', hit.what), h('span', 'summary__hitwhen', when));
      list.append(li);
    });
    death.append(list);
    this.body.replaceChildren(h('p', 'panel__hint', s.line), stats, death, chart);
    enter(this.root);
    this.menu.focus(0, false);
  }

  close(): void {
    leave(this.root);
  }

  handleInput(input: Input): void {
    // Esc or B: back to the menu (the second button).
    if (input.consume('back')) {
      this.buttons[1]?.click();
      return;
    }
    this.menu.handle(input);
  }
}
