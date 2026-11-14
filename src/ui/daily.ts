// The codzienny kurs result card: your own after a run (with sharing), or someone's from a ?wynik= link
// (with a way into today's run). Same card, so a link opened on a phone looks like what was shared.

import { audio } from '../audio/audio';
import { WEAPONS } from '../content/items';
import { station } from '../content/stations/index';
import { UI } from '../content/ui';
import { dailyScore, type DailyResult } from '../core/daily';
import type { Input } from '../game/input';
import { enter, fmtTime, h, leave, SpatialMenu } from './dom';
import { icon } from './icons';

export interface DailyCardActions {
  /** Your own result: share it. Returns what happened, for the line under the buttons. */
  share?: () => Promise<string>;
  /** Someone else's: go and play today's run. */
  play?: () => void;
  close: () => void;
}

/** "14 listopada 2026" for a YYYY-MM-DD day (noon, so no time zone can move it to another date). */
export const dayName = (day: string): string => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${day}T12:00:00`));

export class DailyCard {
  readonly root = h('div', 'overlay daily');
  private readonly panel = h('div', 'panel daily__panel');
  private readonly menu = new SpatialMenu(() => [...this.panel.querySelectorAll<HTMLButtonElement>('button')]);
  private actions: DailyCardActions | null = null;
  private opened = false;

  constructor(parent: HTMLElement) {
    this.root.append(this.panel);
    this.root.hidden = true;
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** `today` is the current day: a link to an older run says so. */
  open(r: DailyResult, today: string, actions: DailyCardActions, best: number | null = null): void {
    this.actions = actions;
    this.opened = true;
    const D = UI.daily;
    const score = dailyScore(r);
    const stats = h('dl', 'daily__stats');
    const row = (k: string, v: string): void => {
      stats.append(h('dt', '', k), h('dd', '', v));
    };
    row(D.kills, String(r.kills));
    row(D.level, String(r.level));
    row(D.time, fmtTime(r.time));
    row(D.boss, r.cleared ? D.bossYes : D.bossNo);
    const arms = h('div', 'daily__weapons');
    for (const id of r.weapons) {
      const img = h('img', 'daily__weapon');
      img.src = icon(id);
      img.alt = WEAPONS.find((w) => w.id === id)?.name ?? id;
      img.title = img.alt;
      arms.append(img);
    }
    const status = h('p', 'daily__status');
    const buttons = h('div', 'daily__buttons');
    if (actions.share) {
      const share = h('button', 'btn', D.share);
      share.addEventListener('click', () => {
        audio.play('click');
        void actions.share?.().then((text) => {
          status.textContent = text;
        });
      });
      buttons.append(share);
    }
    if (actions.play) {
      const play = h('button', 'btn', D.play);
      play.addEventListener('click', () => {
        audio.play('start');
        this.close();
        actions.play?.();
      });
      buttons.append(play);
    }
    const close = h('button', 'btn btn--ghost', actions.share ? D.back : D.close);
    close.addEventListener('click', () => {
      this.close();
    });
    buttons.append(close);
    const lines: HTMLElement[] = [
      h('p', 'daily__kicker', `${D.title} · ${dayName(r.day)}`),
      h('h2', 'daily__station', station(r.station).name),
      h('p', 'daily__score', D.score.replace('{v}', score.toLocaleString('pl-PL'))),
    ];
    if (best !== null && best > score) lines.push(h('p', 'daily__best', D.best.replace('{v}', best.toLocaleString('pl-PL'))));
    if (r.day !== today) lines.push(h('p', 'daily__old', D.old));
    this.panel.replaceChildren(...lines, stats, arms, buttons, status);
    for (const b of buttons.querySelectorAll('button')) this.menu.bind(b);
    enter(this.root);
    this.menu.focus(buttons.querySelector('button'), false);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    audio.play('back');
    leave(this.root);
    this.actions?.close();
  }

  handleInput(input: Input): void {
    if (!this.opened) return;
    if (input.consumeAny('back', 'pause')) {
      this.close();
      input.flush();
      return;
    }
    this.menu.handle(input);
    input.flush();
  }
}
