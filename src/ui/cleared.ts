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
    this.stats.replaceChildren(
      h('div', 'cleared__stat', `${UI.cleared.time}: ${fmtTime(info.time)}`),
      h('div', 'cleared__stat', UI.cleared.stats.replace('{v}', String(info.kills))),
    );
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
