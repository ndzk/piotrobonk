// Boss presentation: the half-screen intro, the health bar with the boss's name, phase banners and
// the shouts an attack makes.

import { UI } from '../content/ui';
import { enter, h, leave, replay } from './dom';

export class BossUi {
  readonly root = h('div', 'bossui');
  private readonly intro = h('div', 'boss-intro');
  private readonly introLabel = h('div', 'boss-intro__label', UI.boss.incoming);
  private readonly introName = h('h2', 'boss-intro__name');
  private readonly introSub = h('p', 'boss-intro__sub');
  private readonly bar = h('div', 'bossbar');
  private readonly fill = h('div', 'bossbar__fill');
  private readonly name = h('div', 'bossbar__name');
  private readonly phase = h('div', 'bossbar__phase');
  private readonly shout = h('div', 'boss-shout');
  /** An arrow at the screen's edge towards the boss while it is off screen. */
  private readonly mark = h('div', 'boss-mark');
  private shoutUntil = 0;
  private announceUntil = 0;
  private lastFill = -1;
  /** The text size setting zooms the UI layer: screen positions are divided by it. */
  zoom = 1;

  constructor(parent: HTMLElement) {
    this.intro.append(this.introLabel, this.introName, this.introSub);
    this.bar.append(this.fill, this.name, this.phase);
    this.root.append(this.intro, this.bar, this.shout, this.mark);
    this.mark.hidden = true;
    this.root.hidden = true;
    this.intro.hidden = true;
    this.bar.hidden = true;
    this.shout.hidden = true;
    parent.append(this.root);
  }

  /** Half-screen title card. Lasts as long as the game keeps the intro state. */
  showIntro(name: string, subtitle: string, incoming: string = UI.boss.incoming): void {
    this.root.hidden = false;
    this.introLabel.textContent = incoming;
    this.introName.textContent = name;
    this.introSub.textContent = subtitle;
    enter(this.intro);
    replay(this.intro, 'is-in');
  }

  hideIntro(): void {
    leave(this.intro);
  }

  /** The edge arrow: hidden while the boss is on screen, else at (x, y) pointing along `angle`. */
  setMark(visible: boolean, x = 0, y = 0, angle = 0): void {
    if (this.mark.hidden === !visible && !visible) return;
    this.mark.hidden = !visible;
    if (!visible) return;
    this.mark.style.transform = `translate(${(x / this.zoom).toFixed(1)}px, ${(y / this.zoom).toFixed(1)}px)`;
    this.mark.style.setProperty('--angle', `${angle.toFixed(3)}rad`);
  }

  showBar(name: string): void {
    this.root.hidden = false;
    enter(this.bar);
    this.name.textContent = name;
    this.phase.textContent = '';
    this.lastFill = -1;
    replay(this.bar, 'is-in');
  }

  /** `braced`: the boss is at its damage limit (the bar dims, hits past it land weaker). */
  setHealth(fraction: number, braced = false): void {
    this.bar.classList.toggle('is-braced', braced);
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 1000) / 10;
    if (pct === this.lastFill) return;
    this.lastFill = pct;
    this.fill.style.width = `${pct}%`;
    this.bar.classList.toggle('is-low', pct < 25);
  }

  setPhase(index: number): void {
    this.phase.textContent = UI.boss.phase.replace('{v}', String(index + 1));
    replay(this.phase, 'is-in');
  }

  /**
   * A short banner over the fight ("TRANSAKCJA ODRZUCONA"). It waits out an announcement (an event, the last
   * train, rage, a new phase); an empty text clears both.
   */
  say(text: string, now: number): void {
    if (text && now < this.announceUntil) return;
    if (!text) this.announceUntil = 0;
    this.show(text, now, 1.6);
  }

  /** A banner that matters more than an attack's shout: it stays its time whatever the boss says. */
  announce(text: string, now: number): void {
    this.announceUntil = now + 2.6;
    this.show(text, now, 2.6);
  }

  private show(text: string, now: number, time: number): void {
    this.root.hidden = false;
    this.shout.hidden = false;
    this.shout.textContent = text;
    this.shoutUntil = now + time;
    replay(this.shout, 'is-in');
  }

  /** Call once a frame with the game clock, to clear an expired shout. */
  tick(now: number): void {
    if (!this.shout.hidden && now > this.shoutUntil) this.shout.hidden = true;
  }

  /** Fades the fight UI out; `instant` is for leaving the run altogether. */
  hide(instant = false): void {
    this.shout.hidden = true;
    if (instant) {
      this.root.hidden = true;
      this.intro.hidden = true;
      this.bar.hidden = true;
      return;
    }
    leave(this.intro);
    leave(this.bar);
    window.setTimeout(() => {
      if (this.bar.hidden) this.root.hidden = true;
    }, 400);
  }
}
