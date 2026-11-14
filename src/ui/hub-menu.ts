// The hub's main menu, docked on the left over the 3D forecourt: where to go next, the bank, and what
// Piotrek have on.

import { audio } from '../audio/audio';
import { BOTTLES } from '../content/items';
import { UI } from '../content/ui';
import type { Save } from '../core/save';
import { fillCount, num } from '../core/text';
import type { Gear } from '../game/gear';
import type { Input } from '../game/input';
import { SpatialMenu, enter, h, leave } from './dom';

export interface HubActions {
  play(): void;
  recyklomat(): void;
  inventory(): void;
}

export class HubMenu {
  readonly root = h('div', 'side side--left hubmenu');
  private readonly bank = h('p', 'hubmenu__bank');
  private readonly cash = h('span', 'hubmenu__cash');
  private readonly gear = h('dl', 'hubmenu__gear');
  private readonly play = h('button', 'btn', UI.hub.play);
  private readonly shop = h('button', 'btn btn--ghost', UI.hub.recyklomat);
  private readonly inv = h('button', 'btn btn--ghost', UI.hub.inventory);
  private readonly menu: SpatialMenu;
  private actions: HubActions | null = null;
  private opened = false;

  constructor(parent: HTMLElement) {
    this.play.addEventListener('click', () => {
      audio.play('start');
      this.actions?.play();
    });
    this.shop.addEventListener('click', () => {
      audio.play('click');
      this.actions?.recyklomat();
    });
    this.inv.addEventListener('click', () => {
      audio.play('click');
      this.actions?.inventory();
    });
    const buttons = h('div', 'hubmenu__buttons');
    buttons.append(this.play, this.shop, this.inv);
    this.root.append(h('h1', 'hubmenu__logo', UI.title), h('p', 'hubmenu__line', UI.line), this.bank, buttons, this.gear, h('p', 'side__hint', UI.hub.hint));
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new SpatialMenu(() => [this.play, this.shop, this.inv]);
    for (const b of [this.play, this.shop, this.inv]) this.menu.bind(b);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(actions: HubActions): void {
    this.actions = actions;
    this.opened = true;
    enter(this.root);
    this.menu.ensure();
  }

  close(): void {
    this.opened = false;
    leave(this.root);
  }

  /** `ready` is false until the skin data has loaded (the shop and the inventory need it). */
  update(save: Save, gear: Gear, ready: boolean): void {
    const b = Math.floor(save.bottles);
    this.bank.replaceChildren(fillCount(UI.hub.bank, String(b), b), this.cash);
    this.cash.textContent = ` · ${num(b * BOTTLES.deposit, 2)} zł`;
    this.shop.disabled = !ready;
    this.inv.disabled = !ready;
    this.shop.textContent = ready ? UI.hub.recyklomat : UI.hub.loading;
    const row = (k: string, v: string): HTMLElement[] => [h('dt', '', k), h('dd', '', v)];
    this.gear.replaceChildren(
      ...row(UI.hub.gun, gear.gun?.name ?? UI.hub.defaultGun),
      ...row(UI.hub.knife, gear.knife?.name ?? UI.hub.briefcase),
      ...row(UI.hub.gloves, gear.gloves?.name ?? UI.hub.noGloves),
    );
  }

  handleInput(input: Input): void {
    input.consume('back');
    this.menu.handle(input);
  }
}
