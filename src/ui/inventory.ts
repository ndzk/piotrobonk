// The inventory: every skin with filters by weapon, rarity and wear; the selected one floats beside
// Piotrek in 3D (drag or right stick to turn it). Here skins go on: the gun on Gnat z CS, a ★ knife in
// place of the briefcase, ★ gloves, and any pattern onto another weapon.

import { audio } from '../audio/audio';
import { WEAPONS } from '../content/items';
import { CS_WEAPONS, gunProfile, isGloves, isKnife } from '../content/skins/catalog';
import { CS_RARITIES, CS_RARITY, WEARS, skinName, wearIndex, wearOf, type CsRarity, type SkinDb, type SkinDef } from '../content/skins/index';
import { UI } from '../content/ui';
import type { OwnedSkin, Save } from '../core/save';
import { fillCount } from '../core/text';
import { WRAPPABLE } from '../game/gear';
import type { Input } from '../game/input';
import type { Thumbs } from '../render/thumbs';
import { SpatialMenu, enter, h, leave } from './dom';
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

const weaponName = (id: string): string => WEAPONS.find((w) => w.id === id)?.name ?? id;

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
    // Drag on the empty scene turns the inspected item.
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
    const owned = ctx.save.inventory;
    if (this.selected === null || !owned.some((s) => s.uid === this.selected)) this.selected = owned.at(-1)?.uid ?? null;
    this.opened = true;
    this.render();
    enter(this.root);
    this.menu.ensure();
  }

  close(): void {
    this.opened = false;
    leave(this.root);
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

  private equippedAs(save: Save, uid: number): boolean {
    return save.equip.gun === uid || save.equip.knife === uid || save.equip.gloves === uid;
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const n = ctx.save.inventory.length;
    this.count.textContent = fillCount(I.count, String(n), n);
    // Filters cycle on click (or confirm); everything else stays put.
    const cycle = <T>(label: string, value: string, values: (T | null)[], current: T | null, set: (v: T | null) => void): HTMLButtonElement => {
      const b = h('button', 'option option--compact');
      b.append(h('span', 'option__name', label), h('span', 'option__value', value));
      b.addEventListener('click', () => {
        audio.play('click');
        set(values[(values.indexOf(current) + 1) % values.length]);
        this.render();
        this.menu.focus(b.isConnected ? b : null, false);
      });
      return b;
    };
    const groupBtn = cycle(I.weapon, this.group ? I.groups[this.group] : I.all, [null, ...GROUPS], this.group, (v) => (this.group = v));
    const rarityBtn = cycle(I.rarity, this.rarity ? `${CS_RARITY[this.rarity].icon} ${CS_RARITY[this.rarity].short}` : I.all, [null, ...CS_RARITIES], this.rarity, (v) => (this.rarity = v));
    const wearBtn = cycle(I.wear, this.wear !== null ? WEARS[this.wear].short : I.all, [null, 0, 1, 2, 3, 4], this.wear, (v) => (this.wear = v));
    this.filters.replaceChildren(groupBtn, rarityBtn, wearBtn);
    const list = this.visible(ctx);
    this.grid.replaceChildren(
      ...list.map(({ owned, def }) => {
        const t = skinTile(ctx.db, ctx.thumbs, def, { owned, equipped: this.equippedAs(ctx.save, owned.uid) || Object.values(ctx.save.equip.wraps).includes(owned.uid), selected: owned.uid === this.selected });
        t.addEventListener('click', () => {
          if (this.selected === owned.uid) return;
          audio.play('click');
          this.selected = owned.uid;
          const i = [...this.grid.children].indexOf(t);
          this.render();
          this.menu.focus((this.grid.children[i] as HTMLButtonElement | undefined) ?? null, false);
        });
        return t;
      }),
    );
    if (!list.length) this.grid.append(h('p', 'side__hint', n ? I.none : I.empty));
    this.renderDetail(ctx);
    for (const b of this.root.querySelectorAll('button')) this.menu.bind(b);
  }

  private renderDetail(ctx: InventoryContext): void {
    const owned = ctx.save.inventory.find((s) => s.uid === this.selected);
    const def = owned ? ctx.db.skins.get(owned.skin) : undefined;
    if (!owned || !def) {
      this.detail.replaceChildren();
      ctx.inspect(null, null);
      return;
    }
    ctx.inspect(def, owned);
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
    actions.append(equip);
    if (!isGloves(def.weapon)) {
      const current = Object.entries(save.equip.wraps).find(([, uid]) => uid === owned.uid)?.[0] ?? null;
      const wrap = h('button', 'btn btn--ghost btn--small', current ? I.wrap.replace('{v}', weaponName(current)) : I.wrapNone);
      wrap.addEventListener('click', () => {
        const targets = [null, ...WRAPPABLE];
        const next = targets[(targets.indexOf(current) + 1) % targets.length];
        save.equip.wraps = Object.fromEntries(Object.entries(save.equip.wraps).filter(([, uid]) => uid !== owned.uid));
        if (next) save.equip.wraps[next] = owned.uid;
        audio.play(next ? 'equip' : 'back');
        this.changed(ctx, wrap);
      });
      actions.append(wrap);
    }
    const inspect = h('button', 'btn btn--ghost btn--small', I.inspect);
    inspect.addEventListener('click', () => {
      audio.play('click');
      ctx.replayInspect();
    });
    actions.append(inspect);
    this.detail.replaceChildren(h('h3', 'inv__name', `${owned.stattrak ? 'StatTrak™ ' : ''}${skinName(ctx.db, def)}`), ...lines.map((l) => h('p', 'inv__line', l)), actions);
    this.detail.style.setProperty('--rarity', r.color);
  }

  private changed(ctx: InventoryContext, keep: HTMLButtonElement): void {
    const at = [...this.root.querySelectorAll('button')].indexOf(keep);
    ctx.persist();
    ctx.gearChanged();
    this.render();
    this.menu.focus(this.root.querySelectorAll<HTMLButtonElement>('button')[at] ?? null, false);
  }
}
