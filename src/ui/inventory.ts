// The inventory: every skin with filters by weapon, rarity and wear; the selected one floats beside
// Piotrek in 3D (drag or right stick to turn it). Here skins go on: the gun on Gnat z CS, a ★ knife in
// place of the briefcase, ★ gloves, and any pattern onto other weapons.

import { audio } from '../audio/audio';
import { CS_WEAPONS, gunProfile, isGloves, isKnife } from '../content/skins/catalog';
import { CS_RARITIES, CS_RARITY, WEARS, wearIndex, wearOf, type CsRarity, type SkinDb, type SkinDef } from '../content/skins/index';
import { UI } from '../content/ui';
import type { OwnedSkin, Save } from '../core/save';
import { fillCount } from '../core/text';
import { WRAPPABLE, fullName, wornAs } from '../game/gear';
import type { Input } from '../game/input';
import type { Thumbs } from '../render/thumbs';
import { cycleButton, enter, h, leave, rarityColor, SpatialMenu } from './dom';
import { skinTile } from './skin-ui';

const I = UI.inventory;

export interface InventoryContext {
  db: SkinDb;
  thumbs: Thumbs;
  save: Save;
  persist(): void;
  /** Equipment changed: rebuild the gear in the hub and in the game. */
  gearChanged(): void;
  /** Shows the selected skin next to Piotrek (null hides it). */
  inspect(def: SkinDef | null, owned: OwnedSkin | null): void;
  replayInspect(): void;
  /** Turns the inspected item (drag or right stick). */
  turn(dx: number, dy: number): void;
  /** The empty inventory's way out: the recyklomat. */
  toShop(): void;
}

type Group = keyof typeof I.groups;
const GROUPS = Object.keys(I.groups) as Group[];

function groupOf(weapon: string): Group {
  if (isKnife(weapon)) return 'knives';
  if (isGloves(weapon)) return 'gloves';
  switch ((CS_WEAPONS[weapon] as (typeof CS_WEAPONS)[string] | undefined)?.class) {
    case 'smg':
      return 'smg';
    case 'rifle':
    case 'scopedRifle':
      return 'rifles';
    case 'sniper':
    case 'autoSniper':
      return 'snipers';
    case 'shotgun':
    case 'lmg':
      return 'heavy';
    default:
      return 'pistols';
  }
}

/** Steps through `values` (null = no filter) by `dir`, wrapping around. */
function step<T>(values: (T | null)[], current: T | null, dir: 1 | -1): T | null {
  return values[(values.indexOf(current) + dir + values.length) % values.length];
}

export class InventoryScreen {
  readonly root = h('div', 'side side--right inv');
  private readonly filters = h('div', 'inv__filters');
  private readonly grid = h('div', 'skin-grid inv__grid');
  private readonly detail = h('div', 'inv__detail');
  private readonly count = h('p', 'side__bank');
  private readonly back = h('button', 'btn btn--ghost btn--small', UI.hub.back);
  private readonly menu: SpatialMenu;
  private ctx: InventoryContext | null = null;
  private onClose: () => void = () => undefined;
  private group: Group | null = null;
  private rarity: CsRarity | null = null;
  private wear: number | null = null;
  private selected: number | null = null;
  /** The item floating next to Piotrek: rebuilt only when the selection changes. */
  private inspected: number | null = null;
  private opened = false;

  constructor(parent: HTMLElement) {
    const head = h('div', 'side__head');
    head.append(h('h2', 'side__title', I.title), this.count);
    this.back.addEventListener('click', () => {
      audio.play('back');
      this.onClose();
    });
    this.root.append(head, this.filters, this.grid, this.detail, this.back);
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new SpatialMenu(() => [...this.root.querySelectorAll('button')]);
    // Dragging on the scene (not on the panel) turns the inspected item.
    let dragging = false;
    window.addEventListener('pointerdown', (e) => {
      dragging = this.opened && !(e.target instanceof Element && e.target.closest('.side'));
    });
    window.addEventListener('pointerup', () => {
      dragging = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (dragging && this.ctx) this.ctx.turn(e.movementX * 0.012, e.movementY * 0.008);
    });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(ctx: InventoryContext, onClose: () => void): void {
    this.ctx = ctx;
    this.onClose = onClose;
    this.opened = true;
    this.inspected = null;
    this.render();
    enter(this.root);
    this.menu.ensure();
  }

  close(): void {
    this.opened = false;
    leave(this.root);
    this.inspected = null;
    this.ctx?.inspect(null, null);
  }

  handleInput(input: Input): void {
    if (input.consume('back')) {
      audio.play('back');
      this.onClose();
      return;
    }
    if (this.ctx && (input.padLookX || input.padLookY)) this.ctx.turn(input.padLookX * 0.05, input.padLookY * 0.03);
    this.menu.handle(input);
  }

  private visible(ctx: InventoryContext): { owned: OwnedSkin; def: SkinDef }[] {
    const out: { owned: OwnedSkin; def: SkinDef }[] = [];
    for (const owned of [...ctx.save.inventory].reverse()) {
      const def = ctx.db.skins.get(owned.skin);
      if (!def) continue;
      if (this.group && groupOf(def.weapon) !== this.group) continue;
      if (this.rarity && def.rarity !== this.rarity) continue;
      if (this.wear !== null && wearIndex(owned.float) !== this.wear) continue;
      out.push({ owned, def });
    }
    return out;
  }

  /** Re-renders and puts the focus back on the n-th element matching `selector`. */
  private rerender(selector: string, at: Element): void {
    const i = [...this.root.querySelectorAll(selector)].indexOf(at);
    this.render();
    this.menu.focus(this.root.querySelectorAll<HTMLButtonElement>(selector)[i] ?? null, false);
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const n = ctx.save.inventory.length;
    this.count.textContent = fillCount(I.count, String(n), n);
    const groupBtn = cycleButton(I.weapon, this.group ? I.groups[this.group] : I.any, (dir) => {
      audio.play('click');
      this.group = step([null, ...GROUPS], this.group, dir);
      this.rerender('.option', groupBtn);
    });
    const rarityBtn = cycleButton(I.rarity, this.rarity ? `${CS_RARITY[this.rarity].icon} ${CS_RARITY[this.rarity].short}` : I.any, (dir) => {
      audio.play('click');
      this.rarity = step([null, ...CS_RARITIES], this.rarity, dir);
      this.rerender('.option', rarityBtn);
    });
    const wearBtn = cycleButton(I.wear, this.wear !== null ? WEARS[this.wear].short : I.anyWear, (dir) => {
      audio.play('click');
      this.wear = step([null, 0, 1, 2, 3, 4], this.wear, dir);
      this.rerender('.option', wearBtn);
    });
    const clear = h('button', 'btn btn--ghost btn--small', I.clearFilters);
    clear.disabled = !this.group && !this.rarity && this.wear === null;
    clear.addEventListener('click', () => {
      audio.play('back');
      this.group = this.rarity = null;
      this.wear = null;
      this.render();
    });
    this.filters.replaceChildren(groupBtn, rarityBtn, wearBtn, clear);
    const list = this.visible(ctx);
    // The selection follows the filters: a skin the filters hide is not the one being looked at.
    if (!list.some((x) => x.owned.uid === this.selected)) this.select(ctx, list[0]?.owned.uid ?? null);
    this.grid.replaceChildren(
      ...list.map(({ owned, def }) => {
        const t = skinTile(ctx.db, ctx.thumbs, def, { owned, worn: wornAs(ctx.save, owned.uid), selected: owned.uid === this.selected, unseen: ctx.save.unseen.includes(owned.uid) });
        t.addEventListener('click', () => {
          if (this.selected === owned.uid) return;
          audio.play('click');
          this.select(ctx, owned.uid);
          this.rerender('.skin-grid .skin-tile', t);
        });
        return t;
      }),
    );
    if (!list.length) {
      const empty = h('div', 'inv__empty');
      empty.append(h('p', 'side__hint', n ? I.none : I.empty));
      if (!n) {
        const go = h('button', 'btn', I.toShop);
        go.addEventListener('click', () => {
          audio.play('click');
          ctx.toShop();
        });
        empty.append(go);
      }
      this.grid.append(empty);
    }
    this.renderDetail(ctx);
    for (const b of this.root.querySelectorAll('button')) this.menu.bind(b);
  }

  /** Selects a skin: it stops being new, and it is the one floating next to Piotrek. */
  private select(ctx: InventoryContext, uid: number | null): void {
    this.selected = uid;
    if (uid !== null && ctx.save.unseen.includes(uid)) {
      ctx.save.unseen = ctx.save.unseen.filter((u) => u !== uid);
      ctx.persist();
    }
  }

  private renderDetail(ctx: InventoryContext): void {
    const owned = ctx.save.inventory.find((s) => s.uid === this.selected);
    const def = owned ? ctx.db.skins.get(owned.skin) : undefined;
    if (!owned || !def) {
      this.detail.replaceChildren();
      if (this.inspected !== null) ctx.inspect(null, null);
      this.inspected = null;
      return;
    }
    if (this.inspected !== owned.uid) {
      this.inspected = owned.uid;
      ctx.inspect(def, owned);
    }
    const save = ctx.save;
    const r = CS_RARITY[def.rarity];
    const lines: string[] = [`${r.icon} ${r.name}`, `${wearOf(owned.float).name} · ${I.float} ${owned.float.toFixed(6).replace('.', ',')} · ${I.seed} ${owned.seed}`];
    if (owned.stattrak) lines.push(fillCount(I.kills, String(owned.kills), owned.kills));
    if (def.collection) lines.push(`${I.collection}: ${ctx.db.collections.get(def.collection) ?? ''}`);
    if (isKnife(def.weapon)) lines.push(I.knifeLine);
    else if (isGloves(def.weapon)) lines.push(I.glovesLine);
    else lines.push(I.gunLine.replace('{v}', ctx.db.weaponNames[def.weapon] ?? def.weapon).replace('{text}', gunProfile(def.weapon).text));
    const actions = h('div', 'inv__actions');
    const slot: 'gun' | 'knife' | 'gloves' = isKnife(def.weapon) ? 'knife' : isGloves(def.weapon) ? 'gloves' : 'gun';
    const on = save.equip[slot] === owned.uid;
    const equip = h('button', 'btn btn--small', on ? I.unequip : slot === 'gun' ? I.equipGun : slot === 'knife' ? I.equipKnife : I.equipGloves);
    equip.addEventListener('click', () => {
      save.equip[slot] = on ? null : owned.uid;
      audio.play(on ? 'back' : 'equip');
      this.changed(ctx, equip);
    });
    const inspect = h('button', 'btn btn--ghost btn--small', I.inspect);
    inspect.addEventListener('click', () => {
      audio.play('click');
      ctx.replayInspect();
    });
    actions.append(equip, inspect);
    const parts: HTMLElement[] = [h('h3', 'inv__name', fullName(ctx.db, def, owned.stattrak)), ...lines.map((l) => h('p', 'inv__line', l)), actions];
    // The pattern can go on other weapons too: one chip per weapon, toggled on and off.
    if (!isGloves(def.weapon)) {
      const chips = h('div', 'inv__wraps');
      chips.append(h('span', 'inv__wraplabel', I.wrapLabel));
      // With a knife on, the briefcase is not on show, so it cannot show a pattern either.
      for (const weapon of WRAPPABLE.filter((w) => w !== 'teczka' || save.equip.knife === null)) {
        const active = save.equip.wraps[weapon] === owned.uid;
        const chip = h('button', 'chip', I.wrapTargets[weapon as keyof typeof I.wrapTargets]);
        chip.classList.toggle('is-on', active);
        chip.setAttribute('aria-pressed', String(active));
        chip.addEventListener('click', () => {
          if (active) save.equip.wraps = Object.fromEntries(Object.entries(save.equip.wraps).filter(([w]) => w !== weapon));
          else save.equip.wraps[weapon] = owned.uid;
          audio.play(active ? 'back' : 'equip');
          this.changed(ctx, chip);
        });
        chips.append(chip);
      }
      parts.push(chips);
    }
    this.detail.replaceChildren(...parts);
    this.detail.style.setProperty('--rarity', rarityColor(r.color));
  }

  private changed(ctx: InventoryContext, keep: HTMLButtonElement): void {
    ctx.persist();
    ctx.gearChanged();
    this.rerender('button', keep);
  }
}
