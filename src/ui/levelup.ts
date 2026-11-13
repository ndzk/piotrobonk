import { audio } from '../audio/audio';
import { RARITY } from '../content/items';
import { UI } from '../content/ui';
import type { Input } from '../game/input';
import type { Card } from '../game/progress';
import { Menu, enter, h, leave, replay } from './dom';
import { icon } from './icons';

export interface LevelUpActions {
  pick(i: number): void;
  reroll(): void;
  skip(): void;
  banish(i: number): void;
}

export interface Counters {
  rerolls: number;
  skips: number;
  banishes: number;
}

/** Level-up: three rarity cards plus reroll / skip / banish. */
export class LevelUpScreen {
  readonly root = h('div', 'overlay levelup');
  private readonly title = h('h2', 'levelup__title', UI.levelUp.title);
  private readonly subtitle = h('p', 'levelup__subtitle', UI.levelUp.subtitle);
  private readonly cardsRow = h('div', 'levelup__cards');
  private readonly actionsRow = h('div', 'levelup__actions');
  private readonly rerollBtn = h('button', 'btn btn--small');
  private readonly skipBtn = h('button', 'btn btn--small');
  private readonly banishBtn = h('button', 'btn btn--small');
  private cards: HTMLButtonElement[] = [];
  private banishing = false;
  private actions: LevelUpActions | null = null;
  private counters: Counters = { rerolls: 0, skips: 0, banishes: 0 };
  private readonly menu = new Menu(() => this.cards, true);
  private locked = 0;

  constructor(parent: HTMLElement) {
    const board = h('div', 'levelup__board');
    board.append(this.title, this.subtitle);
    this.actionsRow.append(this.rerollBtn, this.skipBtn, this.banishBtn);
    this.root.append(board, this.cardsRow, this.actionsRow);
    this.root.hidden = true;
    parent.append(this.root);
    this.rerollBtn.addEventListener('click', () => {
      this.doReroll();
    });
    this.skipBtn.addEventListener('click', () => {
      this.doSkip();
    });
    this.banishBtn.addEventListener('click', () => {
      this.toggleBanish();
    });
  }

  get visible(): boolean {
    return !this.root.hidden && !this.root.classList.contains('is-out');
  }

  open(cards: Card[], counters: Counters, actions: LevelUpActions, first: boolean): void {
    this.actions = actions;
    this.counters = counters;
    this.banishing = false;
    this.root.classList.remove('is-banishing');
    this.subtitle.textContent = UI.levelUp.subtitle;
    this.cardsRow.replaceChildren(...cards.map((c, i) => this.card(c, i)));
    this.cards = [...this.cardsRow.querySelectorAll<HTMLButtonElement>('.card')];
    this.menu.bindHover();
    this.menu.focus(0, false);
    this.updateButtons();
    // Ignore input for a moment so a held key does not pick a card by accident.
    this.locked = performance.now() + 380;
    if (first) enter(this.root);
    else {
      replay(this.cardsRow, 'is-refresh');
    }
  }

  close(): void {
    leave(this.root);
  }

  private card(c: Card, i: number): HTMLButtonElement {
    const r = RARITY[c.rarity];
    const b = h('button', `card card--${c.rarity}`);
    b.style.setProperty('--rarity', r.color);
    b.style.setProperty('--delay', `${i * 70}ms`);
    const rarity = h('div', 'card__rarity', `${r.icon} ${r.name}`);
    const img = h('img', 'card__icon');
    img.src = icon(c.id);
    img.alt = '';
    const name = h('div', 'card__name', c.name);
    const level = c.level === 1 && c.kind !== 'fallback' ? h('div', 'card__new', UI.levelUp.newItem) : h('div', 'card__level', c.kind === 'fallback' ? '' : `${UI.levelUp.level} ${c.level}`);
    const lines = h('ul', 'card__lines');
    for (const l of c.lines) lines.append(h('li', '', l));
    const desc = h('p', 'card__desc', c.description);
    const key = h('div', 'card__key', String(i + 1));
    b.append(rarity, img, name, level, lines, desc, key);
    b.addEventListener('click', () => {
      this.choose(i);
    });
    return b;
  }

  private choose(i: number): void {
    if (performance.now() < this.locked || !this.actions) return;
    if (this.banishing) {
      if (this.counters.banishes <= 0) return;
      audio.play('banish');
      this.cards[i]?.classList.add('is-banished');
      this.locked = performance.now() + 250;
      const actions = this.actions;
      window.setTimeout(() => {
        actions.banish(i);
      }, 220);
      return;
    }
    audio.play('pick');
    this.cards.forEach((c, k) => { c.classList.add(k === i ? 'is-picked' : 'is-dropped'); });
    this.locked = Infinity;
    const actions = this.actions;
    window.setTimeout(() => {
      actions.pick(i);
    }, 260);
  }

  private doReroll(): void {
    if (this.counters.rerolls <= 0 || performance.now() < this.locked || !this.actions) return;
    audio.play('reroll');
    this.actions.reroll();
  }

  private doSkip(): void {
    if (this.counters.skips <= 0 || performance.now() < this.locked || !this.actions) return;
    audio.play('skip');
    this.locked = Infinity;
    this.actions.skip();
  }

  private toggleBanish(): void {
    if (this.counters.banishes <= 0) return;
    this.banishing = !this.banishing;
    audio.play(this.banishing ? 'click' : 'back');
    this.root.classList.toggle('is-banishing', this.banishing);
    this.subtitle.textContent = this.banishing ? UI.levelUp.banishSubtitle : UI.levelUp.subtitle;
    this.updateButtons();
  }

  private updateButtons(): void {
    const L = UI.levelUp;
    this.rerollBtn.textContent = `${L.reroll} (${L.keys.reroll}) · ${this.counters.rerolls}`;
    this.skipBtn.textContent = `${L.skip} (${L.keys.skip}) · ${this.counters.skips}`;
    this.banishBtn.textContent = this.banishing ? `${L.cancel} (${L.keys.banish})` : `${L.banish} (${L.keys.banish}) · ${this.counters.banishes}`;
    this.rerollBtn.disabled = this.counters.rerolls <= 0;
    this.skipBtn.disabled = this.counters.skips <= 0;
    this.banishBtn.disabled = this.counters.banishes <= 0;
  }

  handleInput(input: Input): void {
    if (!this.visible) return;
    if (performance.now() < this.locked) {
      input.flush();
      return;
    }
    if (input.consume('card1')) this.choose(0);
    if (input.consume('card2')) this.choose(1);
    if (input.consume('card3')) this.choose(2);
    if (input.consume('reroll')) this.doReroll();
    if (input.consume('skip')) this.doSkip();
    if (input.consume('banish')) this.toggleBanish();
    if (input.consume('back') && this.banishing) this.toggleBanish();
    this.menu.handle(input);
  }
}
