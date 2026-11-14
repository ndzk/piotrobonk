// Boss presentation: the half-screen intro, the health bar with the boss's name, phase banners and
// the shouts an attack makes.

import { UI } from '../content/ui';
import { enter, h, leave, replay } from './dom';

export class BossUi {
  readonly root = h('div', 'bossui');
  private readonly intro = h('div', 'boss-intro');
  private readonly introName = h('h2', 'boss-intro__name');
  private readonly introSub = h('p', 'boss-intro__sub');
  private readonly bar = h('div', 'bossbar');
  private readonly fill = h('div', 'bossbar__fill');
  private readonly name = h('div', 'bossbar__name');
  private readonly phase = h('div', 'bossbar__phase');
  private readonly shout = h('div', 'boss-shout');
  private shoutUntil = 0;
  private lastFill = -1;

  constructor(parent: HTMLElement) {
    this.intro.append(h('div', 'boss-intro__label', UI.boss.incoming), this.introName, this.introSub);
    this.bar.append(this.fill, this.name, this.phase);
    this.root.append(this.intro, this.bar, this.shout);
    this.root.hidden = true;
    this.intro.hidden = true;
    this.bar.hidden = true;
    this.shout.hidden = true;
    parent.append(this.root);
  }

  /** Half-screen title card. Lasts as long as the game keeps the intro state. */
  showIntro(name: string, subtitle: string): void {
    this.root.hidden = false;
    this.introName.textContent = name;
    this.introSub.textContent = subtitle;
    enter(this.intro);
    replay(this.intro, 'is-in');
  }

  hideIntro(): void {
    leave(this.intro);
  }

  showBar(name: string): void {
    this.root.hidden = false;
    enter(this.bar);
    this.name.textContent = name;
    this.phase.textContent = '';
    this.lastFill = -1;
    replay(this.bar, 'is-in');
  }

  setHealth(fraction: number): void {
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

  /** A short banner over the fight ("TRANSAKCJA ODRZUCONA"). */
  say(text: string, now: number): void {
    this.root.hidden = false;
    this.shout.hidden = false;
    this.shout.textContent = text;
    this.shoutUntil = now + 1.6;
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
