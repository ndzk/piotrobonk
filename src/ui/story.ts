// Story screens: the dialogue box with portraits (intro, the finale), Bartek D.'s video call between
// stations, the finale's coffee meter and slap bar, the big "LIŚĆ!", and the closing card with the credits.

import { audio } from '../audio/audio';
import type { Expression } from '../content/characters';
import { SPEAKERS, type Line, type Speaker } from '../content/dialogs';
import { UI } from '../content/ui';
import type { Input } from '../game/input';
import type { Portraits } from '../render/portraits';
import { SpatialMenu, enter, h, leave, replay } from './dom';

/** Letters per second of the typewriter. */
const TYPE_SPEED = 46;

/**
 * Lines one after another, typed out, each with the speaker's portrait. Confirm finishes the line or goes
 * to the next one; back skips the whole conversation. `variant: 'call'` dresses it as a video call.
 */
export class Dialogue {
  readonly root: HTMLElement;
  private readonly portrait = h('img', 'talk__face');
  private readonly name = h('div', 'talk__name');
  private readonly text = h('p', 'talk__text');
  private readonly next = h('button', 'btn btn--small', UI.dialog.next);
  private readonly skip: HTMLButtonElement;
  private readonly timer = h('span', 'call__timer');
  private readonly menu: SpatialMenu;
  private lines: Line[] = [];
  private index = 0;
  private shown = 0;
  private full = '';
  private elapsed = 0;
  private onDone: (skipped: boolean) => void = () => undefined;
  private open = false;

  constructor(
    parent: HTMLElement,
    private readonly portraits: Portraits,
    private readonly variant: 'box' | 'call',
  ) {
    this.root = h('div', variant === 'call' ? 'call' : 'talk');
    this.skip = h('button', 'btn btn--ghost btn--small', variant === 'call' ? UI.call.hangup : UI.dialog.skip);
    this.portrait.alt = '';
    const buttons = h('div', 'talk__buttons');
    buttons.append(this.next, this.skip);
    if (variant === 'call') {
      const head = h('div', 'call__head');
      head.append(h('span', 'call__dot'), h('span', 'call__who', UI.call.title), h('span', 'call__status', UI.call.status), this.timer);
      const screen = h('div', 'call__screen');
      screen.append(this.portrait, h('div', 'call__cup'));
      const sub = h('div', 'call__sub');
      sub.append(this.text);
      this.root.append(head, screen, sub, buttons);
    } else {
      const body = h('div', 'talk__body');
      body.append(this.name, this.text, h('p', 'talk__hint', UI.dialog.hint));
      this.root.append(this.portrait, body, buttons);
    }
    this.next.addEventListener('click', () => {
      this.advance();
    });
    this.skip.addEventListener('click', () => {
      this.finish(true);
    });
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target instanceof HTMLButtonElement) return;
      this.advance();
    });
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new SpatialMenu(() => [this.next, this.skip]);
    this.menu.bind(this.next);
    this.menu.bind(this.skip);
  }

  get playing(): boolean {
    return this.open;
  }

  /** Plays the lines; `onDone(skipped)` tells whether the player skipped (or hung up) instead of reading on. */
  play(lines: Line[], onDone: (skipped: boolean) => void): void {
    this.lines = lines;
    this.index = 0;
    this.elapsed = 0;
    this.onDone = onDone;
    this.open = true;
    enter(this.root);
    if (this.variant === 'call') audio.play('ring');
    this.show();
    this.menu.focus(this.next, false);
  }

  private show(): void {
    const line = this.lines[this.index];
    const who = SPEAKERS[line.speaker];
    this.name.textContent = who.name;
    this.root.style.setProperty('--speaker', who.color);
    this.full = line.text;
    this.shown = 0;
    this.text.textContent = '';
    this.setFace(line.speaker, line.face ?? 'neutral');
    replay(this.text, 'is-in');
  }

  private setFace(speaker: Speaker, face: Expression): void {
    void this.portraits.get(speaker, face).then((url) => {
      if (this.open) this.portrait.src = url;
    });
  }

  /** Typewriter and the call timer; call every frame while playing. */
  tick(dt: number): void {
    if (!this.open) return;
    this.elapsed += dt;
    if (this.variant === 'call') {
      const s = Math.floor(this.elapsed);
      this.timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
    if (this.shown >= this.full.length) return;
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.full.length, this.shown + dt * TYPE_SPEED);
    const now = Math.floor(this.shown);
    if (now === before) return;
    this.text.textContent = this.full.slice(0, now);
    // A soft blip every few letters, pitched per speaker: it reads as talking without being a voice.
    if (now % 3 === 0 && this.full[now - 1] !== ' ') {
      const speaker = this.lines[this.index].speaker;
      audio.play('blip', 0.35, speaker === 'bartek' ? 0.8 : speaker === 'piotrek' ? 1.15 : 0.95);
    }
  }

  private advance(): void {
    if (!this.open) return;
    if (this.shown < this.full.length) {
      this.shown = this.full.length;
      this.text.textContent = this.full;
      return;
    }
    audio.play('click');
    this.index++;
    if (this.index >= this.lines.length) this.finish(false);
    else this.show();
  }

  private finish(skipped: boolean): void {
    if (!this.open) return;
    this.open = false;
    if (skipped) audio.play('back');
    leave(this.root);
    this.onDone(skipped);
  }

  handleInput(input: Input): void {
    if (!this.open) return;
    if (input.consumeAny('back', 'pause')) {
      this.finish(true);
      return;
    }
    if (input.consume('confirm') || input.consume('jump') || input.consume('interact')) this.advance();
    input.consume('left');
    input.consume('right');
  }
}

/** The finale's HUD: Bartek's coffee next to his health bar, the slap bar, and the big "LIŚĆ!". */
export class FinaleUi {
  readonly root = h('div', 'finale');
  private readonly meter = h('div', 'coffee');
  private readonly fill = h('div', 'coffee__fill');
  private readonly qte = h('div', 'qte');
  private readonly track = h('div', 'qte__track');
  private readonly window = h('div', 'qte__window');
  private readonly cursor = h('div', 'qte__cursor');
  private readonly hint = h('p', 'qte__hint');
  private readonly slap = h('div', 'slap', UI.finale.slap);
  private readonly note = h('div', 'coffee__note');
  private level = -1;

  constructor(parent: HTMLElement) {
    const bar = h('div', 'coffee__bar');
    bar.append(this.fill);
    this.meter.append(h('span', 'coffee__label', UI.finale.coffee), bar, this.note);
    this.track.append(this.window, this.cursor);
    this.qte.append(h('div', 'qte__title', UI.finale.qte), this.track, this.hint);
    this.root.append(this.meter, this.qte, this.slap);
    for (const el of [this.root, this.meter, this.qte, this.slap]) el.hidden = true;
    parent.append(this.root);
  }

  showMeter(on: boolean): void {
    this.root.hidden = false;
    if (on) enter(this.meter);
    else leave(this.meter);
  }

  setCoffee(level: number): void {
    const pct = Math.round(level * 100);
    if (pct === this.level) return;
    this.meter.classList.toggle('is-full', pct >= 80);
    if (this.level >= 0) replay(this.meter, pct > this.level ? 'is-up' : 'is-down');
    this.level = pct;
    this.fill.style.width = `${pct}%`;
  }

  /** A short line under the meter ("Lemur doniósł dolewkę", "*siorb*"). */
  flash(text: string): void {
    this.note.textContent = text;
    replay(this.note, 'is-in');
  }

  showQte(key: string): void {
    this.root.hidden = false;
    this.hint.textContent = UI.finale.qteHint.replace('{key}', key);
    enter(this.qte);
  }

  setQte(pos: number, centre: number, width: number): void {
    this.cursor.style.left = `${pos * 100}%`;
    this.window.style.left = `${(centre - width / 2) * 100}%`;
    this.window.style.width = `${width * 100}%`;
  }

  missQte(): void {
    replay(this.qte, 'is-miss');
  }

  hideQte(): void {
    leave(this.qte);
  }

  showSlap(): void {
    enter(this.slap);
    replay(this.slap, 'is-in');
  }

  hideAll(): void {
    for (const el of [this.meter, this.qte, this.slap]) leave(el);
    this.level = -1;
  }
}

export interface Ending {
  /** "X h Y min" of the whole trip. */
  home: string;
  /** Lines under it: the trophy, the reward. */
  extras: string[];
}

/** The closing card ("Normalnie 20 minut. Tobie zajęło…") and the credits rolling under music. */
export class Credits {
  readonly root = h('div', 'credits');
  private readonly card = h('div', 'credits__card');
  private readonly roll = h('div', 'credits__roll');
  private onDone: () => void = () => undefined;
  private open = false;
  private time = 0;

  constructor(parent: HTMLElement) {
    this.roll.append(h('h2', 'credits__title', UI.credits.title));
    for (const [role, who] of UI.credits.roles) {
      const row = h('div', 'credits__row');
      row.append(h('span', 'credits__role', role), h('span', 'credits__who', who));
      this.roll.append(row);
    }
    for (const note of UI.credits.notes) this.roll.append(h('p', 'credits__note', note));
    this.root.append(this.card, this.roll, h('p', 'credits__skip', UI.credits.skip));
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', () => {
      if (this.time > 1.5) this.close();
    });
    parent.append(this.root);
  }

  get playing(): boolean {
    return this.open;
  }

  show(end: Ending, onDone: () => void): void {
    this.onDone = onDone;
    this.open = true;
    this.time = 0;
    this.card.replaceChildren(h('h2', 'credits__home-title', UI.finale.homeTitle), h('p', 'credits__home', UI.finale.home.replace('{v}', end.home)), ...end.extras.map((t) => h('p', 'credits__extra', t)));
    enter(this.root);
    replay(this.roll, 'is-rolling');
  }

  tick(dt: number): void {
    if (!this.open) return;
    this.time += dt;
    // The roll is a CSS animation of known length; when it is over, so are the credits.
    if (this.time > 42) this.close();
  }

  handleInput(input: Input): void {
    if (!this.open) return;
    if (this.time > 1.5 && input.consumeAny('back', 'confirm', 'pause')) this.close();
    input.flush();
  }

  private close(): void {
    if (!this.open) return;
    this.open = false;
    audio.play('click');
    leave(this.root);
    this.onDone();
  }
}
