import { audio } from '../audio/audio';
import { RARITY } from '../content/items';
import { UI } from '../content/ui';
import type { Input } from '../game/input';
import type { ChestReward } from '../game/progress';
import { Menu, enter, h, leave } from './dom';
import { icon } from './icons';

/** What a chest gave: an evolution (big reveal) or upgrades of owned items, or bottles. */
export class ChestScreen {
  readonly root = h('div', 'overlay chest');
  private readonly box = h('div', 'chest__box');
  private readonly next = h('button', 'btn', UI.chest.next);
  private readonly menu = new Menu(() => [this.next]);
  private onClose: (() => void) | null = null;
  private locked = 0;

  constructor(parent: HTMLElement) {
    this.next.addEventListener('click', () => {
      this.close();
    });
    this.root.append(this.box);
    this.root.hidden = true;
    parent.append(this.root);
  }

  open(reward: ChestReward, onClose: () => void): void {
    this.onClose = onClose;
    const C = UI.chest;
    const items: HTMLElement[] = [];
    if (reward.kind === 'evolution') {
      this.root.classList.add('is-evolution');
      const w = reward.weapon.def;
      const card = h('div', 'card card--legendary card--reveal');
      card.style.setProperty('--rarity', RARITY.legendary.color);
      const img = h('img', 'card__icon');
      img.src = icon(w.id);
      img.alt = '';
      card.append(h('div', 'card__rarity', `★ ${C.evolution}`), img, h('div', 'card__name', w.name), h('p', 'card__desc', w.description));
      items.push(h('h2', 'chest__title', C.evolution), h('p', 'chest__from', C.from.replace('{from}', reward.from).replace('{to}', w.name)), card);
      audio.play('evolve');
    } else {
      this.root.classList.remove('is-evolution');
      const row = h('div', 'chest__cards');
      reward.cards.forEach((c, i) => {
        const r = RARITY[c.rarity];
        const card = h('div', `card card--${c.rarity} card--reveal`);
        card.style.setProperty('--rarity', r.color);
        card.style.setProperty('--delay', `${200 + i * 160}ms`);
        const img = h('img', 'card__icon');
        img.src = icon(c.id);
        img.alt = '';
        const lines = h('ul', 'card__lines');
        for (const l of c.lines) lines.append(h('li', '', l));
        card.append(h('div', 'card__rarity', `${r.icon} ${r.name}`), img, h('div', 'card__name', c.name), h('div', 'card__level', `${UI.levelUp.level} ${c.level}`), lines);
        row.append(card);
      });
      if (reward.bottles > 0) row.append(h('div', 'chest__bottles', C.bottles.replace('{v}', String(reward.bottles))));
      items.push(h('h2', 'chest__title', C.title), row);
      audio.play('chestOpen');
    }
    this.box.replaceChildren(...items, this.next);
    enter(this.root);
    this.menu.focus(0, false);
    this.locked = performance.now() + (reward.kind === 'evolution' ? 1100 : 600);
  }

  private close(): void {
    if (performance.now() < this.locked || !this.onClose) return;
    audio.play('click');
    const done = this.onClose;
    this.onClose = null;
    leave(this.root);
    done();
  }

  handleInput(input: Input): void {
    if (performance.now() < this.locked) {
      input.flush();
      return;
    }
    if (input.consume('back') || input.consume('interact')) {
      this.close();
      return;
    }
    this.menu.handle(input);
  }
}
