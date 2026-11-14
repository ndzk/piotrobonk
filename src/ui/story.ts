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
  private onLine: (index: number) => void = () => undefined;
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

  /**
   * Plays the lines; `onDone(skipped)` tells whether the player skipped (or hung up) instead of reading on.
   * `onLine(i)` hears every line as it starts (the intro times its board to the announcement).
   */
  play(lines: Line[], onDone: (skipped: boolean) => void, onLine: (index: number) => void = () => undefined): void {
    this.lines = lines;
    this.index = 0;
    this.elapsed = 0;
    this.onDone = onDone;
    this.onLine = onLine;
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
    this.onLine(this.index);
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

  /** Closes it without telling anyone (the game was reset under it). */
  stop(): void {
    if (!this.open) return;
    this.open = false;
    leave(this.root);
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

/** A lemur on screen (over its head) or off it (an arrow on the screen edge pointing its way). */
export interface Marker {
  x: number;
  y: number;
  /** Radians, for the edge arrow; ignored on screen. */
  angle: number;
  onScreen: boolean;
}

const MARKERS = 8;

/**
 * The finale's HUD: Bartek's cup beside his health bar (it fills as a gauge and glows when he is shielded),
 * the lemur markers, the slap bar, the big "LIŚĆ!", and a full-screen fade for the cuts.
 */
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
  private readonly fade = h('div', 'finale__fade');
  private readonly markers: HTMLElement[] = [];
  private level = -1;

  constructor(parent: HTMLElement) {
    const mug = h('div', 'coffee__mug');
    const cup = h('div', 'coffee__cup');
    cup.append(this.fill);
    mug.append(cup, h('div', 'coffee__handle'));
    this.meter.append(mug, h('span', 'coffee__label', UI.finale.coffee));
    this.track.append(this.window, this.cursor);
    this.qte.append(h('div', 'qte__title', UI.finale.qte), this.track, this.hint);
    for (let i = 0; i < MARKERS; i++) {
      const m = h('div', 'lemur-mark');
      m.hidden = true;
      this.markers.push(m);
    }
    this.root.append(...this.markers, this.meter, this.note, this.qte, this.slap, this.fade);
    for (const el of [this.root, this.meter, this.qte, this.slap, this.fade]) el.hidden = true;
    parent.append(this.root);
  }

  showMeter(on: boolean): void {
    this.root.hidden = false;
    if (on) enter(this.meter);
    else {
      leave(this.meter);
      this.setMarkers(this.noMarkers, 0);
    }
  }

  private readonly noMarkers: Marker[] = [];

  setCoffee(level: number): void {
    const pct = Math.round(level * 100);
    if (pct === this.level) return;
    this.meter.classList.toggle('is-full', pct >= 60);
    if (this.level >= 0 && Math.abs(pct - this.level) >= 5) replay(this.meter, pct > this.level ? 'is-up' : 'is-down');
    this.level = pct;
    this.fill.style.height = `${pct}%`;
  }

  /** A short line by the cup ("Lemur doniósł dolewkę", "*siorb*", the hint at the start). */
  flash(text: string, long = false): void {
    this.note.textContent = text;
    this.note.classList.toggle('is-long', long);
    replay(this.note, 'is-in');
  }

  /** Places the first `count` markers (the rest hide). Called every frame with a preallocated list. */
  setMarkers(list: readonly Marker[], count: number): void {
    for (let i = 0; i < MARKERS; i++) {
      const el = this.markers[i];
      const m = i < count ? list[i] : null;
      if (!m) {
        if (!el.hidden) el.hidden = true;
        continue;
      }
      el.hidden = false;
      el.classList.toggle('is-edge', !m.onScreen);
      el.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
      el.style.setProperty('--angle', `${m.onScreen ? 0 : m.angle.toFixed(3)}rad`);
    }
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

  /** The big word stays until `hideSlap` (no reliance on an animation ending, so reduced motion shows it too). */
  showSlap(): void {
    this.root.hidden = false;
    enter(this.slap);
    replay(this.slap, 'is-in');
  }

  hideSlap(): void {
    leave(this.slap);
  }

  /** The screen covered by `color` at `opacity` (0 hides it): cuts, the knockout flash, the slap flash. */
  cover(color: string, opacity: number): void {
    this.root.hidden = false;
    this.fade.hidden = opacity <= 0.001;
    this.fade.style.background = color;
    this.fade.style.opacity = opacity.toFixed(3);
  }

  hideAll(): void {
    for (const el of [this.meter, this.qte, this.slap]) leave(el);
    this.cover('#000', 0);
    this.setMarkers(this.noMarkers, 0);
    this.level = -1;
  }
}

export interface Ending {
  /** "X h Y min" of the trip to the first finish. */
  home: string;
  /** Lines under it: the trophy, the reward. */
  extras: string[];
}

/** Seconds the closing card stays before the credits start to roll. */
const CARD_TIME = 7;
/** Credits roll speed, px per second. */
const ROLL_SPEED = 55;

/**
 * The closing card ("Normalnie 20 minut. Tobie zajęło…") and the credits rolling under music. The roll is
 * moved here, from the frame clock, so it can never end before or after the screen does. With reduced
 * motion it does not roll at all: the list stands in the middle and the arrows scroll it.
 */
export class Credits {
  readonly root = h('div', 'credits');
  private readonly card = h('div', 'credits__card');
  private readonly roll = h('div', 'credits__roll');
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly hint = h('p', 'credits__skip', UI.credits.skip);
  private onDone: () => void = () => undefined;
  private open = false;
  private time = 0;
  private rolled = false;

  constructor(parent: HTMLElement) {
    this.roll.append(h('h2', 'credits__title', UI.credits.title));
    for (const [role, who] of UI.credits.roles) {
      const row = h('div', 'credits__row');
      row.append(h('span', 'credits__role', role), h('span', 'credits__who', who));
      this.roll.append(row);
    }
    for (const note of UI.credits.notes) this.roll.append(h('p', 'credits__note', note));
    this.root.append(this.card, this.roll, this.hint);
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', (e) => {
      // A still list scrolls under a finger or the mouse: only a tap beside it ends the credits.
      if (this.still.matches && e.target instanceof Node && this.roll.contains(e.target)) return;
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
    this.rolled = false;
    this.card.replaceChildren(h('h2', 'credits__home-title', UI.finale.homeTitle), h('p', 'credits__home', UI.finale.home.replace('{v}', end.home)), ...end.extras.map((t) => h('p', 'credits__extra', t)));
    enter(this.card);
    this.roll.hidden = true;
    this.roll.classList.toggle('is-static', this.still.matches);
    this.hint.textContent = this.still.matches ? UI.credits.scroll : UI.credits.skip;
    this.roll.style.transform = '';
    this.roll.scrollTop = 0;
    enter(this.root);
  }

  tick(dt: number): void {
    if (!this.open) return;
    this.time += dt;
    if (this.time < CARD_TIME) return;
    if (!this.rolled) {
      this.rolled = true;
      leave(this.card);
      enter(this.roll);
    }
    const t = this.time - CARD_TIME;
    if (this.still.matches) {
      // Standing still: long enough to read, then the end.
      if (t > 30) this.close();
      return;
    }
    // From just under the screen until the last line has left the top.
    const travel = this.root.clientHeight + this.roll.offsetHeight;
    const y = this.root.clientHeight - t * ROLL_SPEED;
    this.roll.style.transform = `translate(-50%, ${y.toFixed(1)}px)`;
    if (t * ROLL_SPEED > travel + 40) this.close();
  }

  handleInput(input: Input): void {
    if (!this.open) return;
    if (this.still.matches && this.rolled) {
      if (input.consume('down')) this.roll.scrollBy({ top: 120 });
      if (input.consume('up')) this.roll.scrollBy({ top: -120 });
    }
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
