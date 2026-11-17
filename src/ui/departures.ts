// The delay ladder as a PKP departure board: every rung is a departure to Koluszki with its delay and, under
// "Uwagi", the one modifier it adds. Opened from the route map once the line has been finished; the next rung
// opens when the one before it has been beaten.

import { audio } from '../audio/audio';
import { bottleMultiplier, delayName, LADDER, LADDER_MAX } from '../content/difficulty';
import { UI } from '../content/ui';
import type { Save } from '../core/save';
import { fillCount } from '../core/text';
import type { Input } from '../game/input';
import { enter, h, leave, Menu } from './dom';

/** The board's clock: the 17:42 to Koluszki (the intro's train), plus the delay. */
function departure(rung: number): string {
  const m = 17 * 60 + 42 + rung * 15;
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export class DepartureBoard {
  readonly root = h('div', 'overlay departures');
  private readonly list = h('div', 'departures__rows');
  private readonly note = h('p', 'departures__note');
  private readonly reward = h('p', 'departures__reward');
  private readonly back = h('button', 'btn btn--ghost', UI.departures.back);
  private rows: HTMLButtonElement[] = [];
  private readonly menu: Menu;
  private save: Save | null = null;
  private onPick: (rung: number) => void = () => undefined;
  private onClose: () => void = () => undefined;
  private openedAt = 0;
  private shown = -1;
  /** A mouse resting where the board opens must not pick a row for the player: hover counts once it moves. */
  private moved = false;
  /** How the last row was pressed: a touch first shows a rung, a second touch on it picks it. */
  private touch = false;

  constructor(parent: HTMLElement) {
    const panel = h('div', 'panel departures__panel');
    const head = h('div', 'departures__head');
    for (const c of UI.departures.columns) head.append(h('span', '', c));
    this.back.addEventListener('click', () => {
      this.close(true);
    });
    this.back.addEventListener('pointerenter', () => {
      if (this.moved) this.menu.focus(this.rows.length);
    });
    this.root.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.moved = true;
    });
    // What the rung does sits above the list (which scrolls on its own), so it is never below the fold.
    panel.append(h('h2', 'departures__title', UI.departures.title), h('p', 'departures__subtitle', UI.departures.subtitle), this.note, this.reward, head, this.list, this.back);
    this.root.append(panel);
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new Menu(() => [...this.rows, this.back]);
  }

  get isOpen(): boolean {
    return !this.root.hidden && !this.root.classList.contains('is-out');
  }

  open(save: Save, onPick: (rung: number) => void, onClose: () => void): void {
    this.save = save;
    this.onPick = onPick;
    this.onClose = onClose;
    this.rows = [];
    for (let rung = 0; rung <= LADDER_MAX; rung++) {
      const open = rung <= save.ladder.open;
      const beaten = rung > 0 && rung <= save.ladder.best;
      const b = h('button', 'departure');
      b.style.setProperty('--i', String(rung));
      if (!open) b.classList.add('is-locked');
      if (beaten) b.classList.add('is-beaten');
      if (rung === save.ladder.chosen) b.classList.add('is-chosen');
      const mod = rung > 0 ? LADDER[rung - 1] : null;
      b.append(
        h('span', 'departure__time', departure(rung)),
        h('span', 'departure__to', UI.departures.to),
        h('span', 'departure__delay', rung > 0 ? delayName(rung) : UI.departures.onTime),
        h('span', 'departure__note', !open ? UI.departures.locked : mod ? `${beaten ? '✓ ' : ''}${mod.name}` : UI.departures.plain),
      );
      b.addEventListener('pointerdown', (e) => {
        this.touch = e.pointerType !== 'mouse';
      });
      b.addEventListener('click', () => {
        // By touch there is no hover to read a rung first: the first tap shows it, the second takes it.
        if (this.touch && rung !== this.shown) {
          this.menu.focus(rung);
          this.describe(rung);
          audio.play('hover');
          return;
        }
        this.pick(rung);
      });
      b.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' || !this.moved) return;
        this.menu.focus(rung);
        this.describe(rung);
      });
      this.rows.push(b);
    }
    this.list.replaceChildren(...this.rows);
    this.moved = false;
    this.touch = false;
    enter(this.root);
    this.menu.focus(save.ladder.chosen, false);
    this.describe(save.ladder.chosen);
    this.openedAt = performance.now();
  }

  /** The focused rung's modifier, what it carries with it and what it pays. */
  private describe(rung: number): void {
    if (rung === this.shown || !this.save) return;
    this.shown = rung;
    const save = this.save;
    this.rows[rung]?.scrollIntoView({ block: 'nearest' });
    if (rung > save.ladder.open) {
      this.note.textContent = UI.departures.lockedHint.replace('{v}', delayName(rung - 1));
      this.reward.textContent = '';
      return;
    }
    const mod = rung > 0 ? LADDER[rung - 1] : null;
    this.note.textContent = mod ? `${mod.name}: ${mod.text}${rung > 1 ? ` ${fillCount(UI.departures.carries, String(rung - 1), rung - 1)}` : ''}` : UI.departures.plainHint;
    // A key on the house only for a rung not beaten yet (the plain kurs pays none).
    const mult = String(bottleMultiplier('normalnie', rung)).replace('.', ',');
    this.reward.textContent = (rung > 0 && rung > save.ladder.best ? UI.departures.reward : UI.departures.rewardPlain).replace('{v}', mult);
  }

  private pick(rung: number): void {
    const save = this.save;
    if (!save) return;
    if (rung > save.ladder.open) {
      audio.play('denied');
      return;
    }
    audio.play('start');
    this.onPick(rung);
    this.close(false);
  }

  close(withSound: boolean): void {
    if (withSound) audio.play('back');
    this.shown = -1;
    leave(this.root);
    this.onClose();
  }

  handleInput(input: Input): void {
    if (performance.now() - this.openedAt < 300) {
      input.flush();
      return;
    }
    if (input.consume('back')) {
      this.close(true);
      return;
    }
    this.menu.handle(input);
    const focused = this.rows.findIndex((r) => r.classList.contains('is-focused'));
    if (focused >= 0) this.describe(focused);
  }
}
