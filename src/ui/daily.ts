// The codzienny kurs result card: your own after a run (with sharing), or someone's from a ?wynik= link
// (with a way into today's run). Same card, so a link opened on a phone looks like what was shared.

import { audio } from '../audio/audio';
import { WEAPONS } from '../content/items';
import { delayName, modifier, rankOf } from '../content/difficulty';
import { STATIONS, station } from '../content/stations/index';
import { UI } from '../content/ui';
import { dailyPlan, dailyScore, type DailyResult } from '../core/daily';
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

/** What else the card says: your day's best under your own, or your score next to someone else's. */
export interface DailyCardNotes {
  best?: number | null;
  /** Your own best of the shared card's day, when you played it. */
  mine?: number | null;
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
  open(r: DailyResult, today: string, actions: DailyCardActions, notes: DailyCardNotes = {}): void {
    this.actions = actions;
    this.opened = true;
    const D = UI.daily;
    const score = dailyScore(r);
    const pts = (v: number): string => D.score.replace('{v}', v.toLocaleString('pl-PL'));
    const stats = h('dl', 'daily__stats');
    const row = (k: string, v: string): void => {
      stats.append(h('dt', '', k), h('dd', '', v));
    };
    row(D.kills, r.kills.toLocaleString('pl-PL'));
    row(D.level, String(r.level));
    // The day's modifier (the same for everyone), and how far the sharer has climbed the delay ladder.
    if (!r.plain) row(D.modifier, modifier(dailyPlan(r.day, STATIONS.map((s) => s.id)).modifier).name);
    if (r.rung > 0) row(D.rung, `${delayName(r.rung)} · ${rankOf(r.rung, true).title}`);
    this.panel.style.setProperty('--frame', rankOf(r.rung, true).frame.color);
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
    // A ticket: the day and the line on the blue strip, the result on paper, the buttons under it.
    const head = h('div', 'daily__head');
    head.append(h('span', 'daily__kicker', actions.share ? D.title : D.foreign), h('span', 'daily__day', dayName(r.day)));
    const main = h('div', 'daily__main');
    main.append(h('p', 'daily__route', D.route), h('h2', 'daily__station', station(r.station).name), h('p', 'daily__score', pts(score)));
    // The boss fell: a red stamp under the score, like a conductor's on a ticket.
    if (r.cleared) main.append(h('div', 'daily__stamp', D.stamp));
    const { best = null, mine = null } = notes;
    if (best !== null && best > score) main.append(h('p', 'daily__note', D.best.replace('{v}', pts(best))));
    if (mine !== null) main.append(h('p', 'daily__note', D.mine.replace('{v}', pts(mine))));
    else if (actions.play && r.day === today) main.append(h('p', 'daily__note', D.compare));
    if (r.day !== today) main.append(h('p', 'daily__note', D.old));
    const side = h('div', 'daily__side');
    side.append(stats, arms);
    const body = h('div', 'daily__body');
    body.append(main, side);
    const foot = h('div', 'daily__foot');
    foot.append(buttons, status);
    this.panel.replaceChildren(head, body, foot);
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
