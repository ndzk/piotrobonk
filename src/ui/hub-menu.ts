// The hub's main menu, docked on the left over the 3D forecourt: where to go next, the bank, and what
// Piotrek have on.

import { audio } from '../audio/audio';
import { BOTTLES } from '../content/items';
import { UI } from '../content/ui';
import type { Save } from '../core/save';
import { fillCount, zl } from '../core/text';
import type { Gear } from '../game/gear';
import type { Input } from '../game/input';
import { SpatialMenu, enter, h, leave } from './dom';

export interface HubActions {
  play(): void;
  recyklomat(): void;
  inventory(): void;
  settings(): void;
  journal(): void;
  daily(): void;
}

export class HubMenu {
  readonly root = h('div', 'side side--left hubmenu');
  private readonly bank = h('p', 'hubmenu__bank');
  private readonly cash = h('span', 'hubmenu__cash');
  private readonly plus = h('span', 'hubmenu__plus');
  private readonly gear = h('dl', 'hubmenu__gear');
  private readonly play = h('button', 'btn', UI.hub.play);
  private readonly shop = h('button', 'btn btn--ghost', UI.hub.recyklomat);
  private readonly inv = h('button', 'btn btn--ghost', UI.hub.inventory);
  private readonly settings = h('button', 'btn btn--ghost btn--small', UI.settings.open);
  private readonly journal = h('button', 'btn btn--ghost btn--small', UI.journal.button);
  private readonly daily = h('button', 'btn btn--ghost hubmenu__daily');
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
    this.settings.addEventListener('click', () => {
      audio.play('click');
      this.actions?.settings();
    });
    this.journal.addEventListener('click', () => {
      audio.play('click');
      this.actions?.journal();
    });
    this.daily.addEventListener('click', () => {
      audio.play('start');
      this.actions?.daily();
    });
    const buttons = h('div', 'hubmenu__buttons');
    const more = h('div', 'hubmenu__more');
    more.append(this.journal, this.settings);
    buttons.append(this.play, this.daily, this.shop, this.inv, more);
    this.root.append(h('h1', 'hubmenu__logo', UI.title), h('p', 'hubmenu__line', UI.line), this.bank, buttons, this.gear, h('p', 'side__hint', UI.hub.hint));
    this.root.hidden = true;
    parent.append(this.root);
    const all = [this.play, this.daily, this.shop, this.inv, this.journal, this.settings];
    this.menu = new SpatialMenu(() => all);
    for (const b of all) this.menu.bind(b);
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
    this.showBank(save.bottles);
    this.shop.disabled = !ready;
    this.inv.disabled = !ready;
    this.shop.textContent = ready ? UI.hub.recyklomat : UI.hub.loading;
    this.inv.textContent = ready ? UI.hub.inventory : UI.hub.loading;
    const row = (k: string, v: string): HTMLElement[] => [h('dt', '', k), h('dd', '', v)];
    this.gear.replaceChildren(
      ...row(UI.hub.gun, gear.gun?.name ?? UI.hub.defaultGun),
      ...row(UI.hub.knife, gear.knife?.name ?? UI.hub.briefcase),
      ...row(UI.hub.gloves, gear.gloves?.name ?? UI.hub.noGloves),
    );
  }

  /** Today's codzienny kurs on its button: the station, and the best score of the day once played. */
  setDaily(stationName: string, best: number | null): void {
    this.daily.replaceChildren(
      h('span', 'hubmenu__daily-name', UI.daily.button),
      h('span', 'hubmenu__daily-line', best === null ? UI.daily.hubLine.replace('{v}', stationName) : `${UI.daily.hubLine.replace('{v}', stationName)} · ${UI.daily.score.replace('{v}', best.toLocaleString('pl-PL'))}`),
    );
  }

  /** The bank as the recyklomat counts it in. */
  showBank(bottles: number): void {
    const b = Math.floor(bottles);
    this.bank.replaceChildren(fillCount(UI.hub.bank, String(b), b), this.cash, this.plus);
    this.cash.textContent = ` · ${zl(b * BOTTLES.deposit)}`;
  }

  /** "+37" next to the bank while the bottles from the last run go in. */
  showDeposit(count: number): void {
    this.plus.textContent = ` +${count}`;
    this.plus.classList.remove('is-on');
    this.plus.getBoundingClientRect();
    this.plus.classList.add('is-on');
  }

  handleInput(input: Input): void {
    input.consume('back');
    this.menu.handle(input);
  }
}
