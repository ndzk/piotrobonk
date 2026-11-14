// Shown after a station's boss goes down and its track is back: what was beaten, how long it took,
// and the way on to the next stop.

import { audio } from '../audio/audio';
import { UI } from '../content/ui';
import type { Input } from '../game/input';
import { Menu, enter, fmtTime, h, leave } from './dom';

export interface ClearedInfo {
  boss: string;
  station: string;
  time: number;
  kills: number;
  /** Bottles banked from this run. */
  bottles: number;
  /** True when this clear beat the station's own record. */
  record: boolean;
  /** Name of the station this clear opened, when there is one. */
  opened: string;
  /** False at the end of the line (Koluszki). */
  hasNext: boolean;
}

export class ClearedScreen {
  readonly root = h('div', 'overlay cleared');
  open = false;
  private readonly title = h('h2', 'cleared__title', UI.cleared.title);
  private readonly body = h('p', 'cleared__body');
  private readonly stats = h('div', 'cleared__stats');
  private readonly next = h('button', 'btn');
  private readonly menu: Menu;
  private onNext: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    const panel = h('div', 'panel cleared__panel');
    panel.append(this.title, this.body, this.stats, this.next);
    this.root.append(panel);
    this.root.hidden = true;
    parent.append(this.root);
    this.next.addEventListener('click', () => {
      this.close();
    });
    this.menu = new Menu(() => [this.next]);
  }

  show(info: ClearedInfo, onNext: () => void): void {
    this.onNext = onNext;
    this.open = true;
    this.body.textContent = UI.cleared.body.replace('{name}', info.boss);
    const rows = [
      h('div', 'cleared__stat', `${UI.cleared.time}: ${fmtTime(info.time)}`),
      h('div', 'cleared__stat', UI.cleared.stats.replace('{v}', String(info.kills))),
      h('div', 'cleared__stat', UI.cleared.bottles.replace('{v}', String(info.bottles))),
    ];
    if (info.record) rows.unshift(h('div', 'cleared__record', UI.cleared.record));
    if (info.opened) rows.push(h('div', 'cleared__opened', UI.cleared.opened.replace('{v}', info.opened)));
    this.stats.replaceChildren(...rows);
    this.next.textContent = info.hasNext ? UI.cleared.next : UI.cleared.last;
    enter(this.root);
    this.menu.focus(0, false);
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    audio.play('click');
    leave(this.root);
    const done = this.onNext;
    this.onNext = null;
    done?.();
  }

  handleInput(input: Input): void {
    if (!this.open) return;
    if (input.consume('back')) {
      this.close();
      return;
    }
    this.menu.handle(input);
  }
}
