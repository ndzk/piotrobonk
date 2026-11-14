// The recyklomat: buys real CS cases with bottles (case + key), spins the roulette, signs trade-up contracts
// and buys skins back. Every result is decided and saved before the animation starts, so reloading the
// page mid-spin changes nothing.

import { audio } from '../audio/audio';
import { CASE_ODDS, CS_RARITY, SHOP, type CaseDef, type CsRarity, type SkinDb, type SkinDef } from '../content/skins/index';
import { UI } from '../content/ui';
import { Rng } from '../core/rng';
import type { OwnedSkin, Save } from '../core/save';
import { fillCount } from '../core/text';
import { casePrice, openCase, sellPrice, tradeUp, tradeUpOutcomes, tradeUpProblem, type Drop, type TradeUpInput } from '../game/skins';
import type { Input } from '../game/input';
import type { Thumbs } from '../render/thumbs';
import { SpatialMenu, enter, h, leave } from './dom';
import { picture, revealCard, skinTile } from './skin-ui';

export interface ShopContext {
  db: SkinDb;
  thumbs: Thumbs;
  save: Save;
  /** Saves and refreshes everything that shows the bank or the inventory. */
  persist(): void;
  /** Puts a line on the recyklomat's display. */
  note(text: string): void;
}

type Tab = 'cases' | 'contract' | 'sell';

const R = UI.recyklomat;
const isEquipped = (save: Save, uid: number): boolean => save.equip.gun === uid || save.equip.knife === uid || save.equip.gloves === uid || Object.values(save.equip.wraps).includes(uid);

/** Adds a drop to the inventory and returns the owned copy. */
export function addDrop(save: Save, d: Drop): OwnedSkin {
  const owned: OwnedSkin = { uid: save.nextUid++, skin: d.def.id, float: d.float, seed: d.seed, stattrak: d.stattrak, kills: 0 };
  save.inventory.push(owned);
  return owned;
}

/** The horizontal case roulette: slows down, ticks on every tile, lands on the drop. */
class Roulette {
  readonly root = h('div', 'roulette');
  private readonly track = h('div', 'roulette__track');
  private readonly hint = h('p', 'roulette__hint', R.skip);
  private raf = 0;
  private skipRequested = false;

  constructor(parent: HTMLElement) {
    const window = h('div', 'roulette__window');
    window.append(this.track, h('div', 'roulette__line'));
    this.root.append(window, this.hint);
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', () => {
      this.skip();
    });
    parent.append(this.root);
  }

  get spinning(): boolean {
    return this.raf !== 0;
  }

  skip(): void {
    this.skipRequested = true;
  }

  spin(tiles: HTMLElement[], winner: number, done: () => void): void {
    this.track.replaceChildren(...tiles);
    enter(this.root);
    this.skipRequested = false;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = still ? 1.2 : 6.2;
    // Measure after layout: one tile plus the gap, and where the window's middle is.
    requestAnimationFrame(() => {
      const first = tiles[0].getBoundingClientRect();
      const second = tiles[1].getBoundingClientRect();
      const step = second.left - first.left;
      const centre = this.root.querySelector('.roulette__window')?.getBoundingClientRect().width ?? 800;
      // Land somewhere inside the winning tile, not always on its middle, like CS.
      const jitter = (Math.random() - 0.5) * step * 0.7;
      const end = winner * step + first.width / 2 - centre / 2 + jitter;
      let t0 = performance.now();
      let lastTile = -1;
      const tick = (now: number): void => {
        if (this.skipRequested) {
          t0 = Math.min(t0, now - duration * 1000 * 0.97);
          this.skipRequested = false;
        }
        const t = Math.min(1, (now - t0) / (duration * 1000));
        const ease = 1 - Math.pow(1 - t, 4);
        const x = end * ease;
        this.track.style.transform = `translateX(${-x}px)`;
        const under = Math.floor((x + centre / 2) / step);
        if (under !== lastTile) {
          lastTile = under;
          audio.play('tick', 0.6 + 0.4 * (1 - t));
        }
        if (t < 1) this.raf = requestAnimationFrame(tick);
        else {
          this.raf = 0;
          window.setTimeout(done, still ? 100 : 450);
        }
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  hide(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    leave(this.root);
  }
}

export class RecyklomatScreen {
  readonly root = h('div', 'side side--right recyk');
  private readonly tabsRow = h('div', 'tabs');
  private readonly body = h('div', 'recyk__body');
  private readonly bank = h('p', 'side__bank');
  private readonly back = h('button', 'btn btn--ghost btn--small', UI.hub.back);
  private readonly tabButtons = new Map<Tab, HTMLButtonElement>();
  private readonly revealLayer = h('div', 'overlay reveal-layer');
  private readonly roulette: Roulette;
  private readonly menu: SpatialMenu;
  private readonly revealMenu: SpatialMenu;
  private tab: Tab = 'cases';
  private ctx: ShopContext | null = null;
  private onClose: () => void = () => undefined;
  private selectedCase = 0;
  private contract: number[] = [];
  private contractTier: CsRarity = 2;
  private contractStattrak = false;
  private selling = new Set<number>();
  private busy = false;
  /** Open as far as input goes: a panel playing its exit animation is already closed. */
  private opened = false;
  private revealOpen = false;

  constructor(parent: HTMLElement) {
    const head = h('div', 'side__head');
    head.append(h('h2', 'side__title', R.title), this.bank);
    for (const [id, label] of Object.entries(R.tabs) as [Tab, string][]) {
      const b = h('button', 'tab', label);
      b.addEventListener('click', () => {
        if (this.tab === id) return;
        audio.play('click');
        this.tab = id;
        this.render();
      });
      this.tabButtons.set(id, b);
      this.tabsRow.append(b);
    }
    this.back.addEventListener('click', () => {
      audio.play('back');
      this.onClose();
    });
    this.root.append(head, this.tabsRow, this.body, this.back);
    this.root.hidden = true;
    this.revealLayer.hidden = true;
    parent.append(this.root, this.revealLayer);
    this.roulette = new Roulette(parent);
    this.menu = new SpatialMenu(() => [...this.root.querySelectorAll('button')]);
    this.revealMenu = new SpatialMenu(() => [...this.revealLayer.querySelectorAll('button')]);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(ctx: ShopContext, onClose: () => void): void {
    this.ctx = ctx;
    this.onClose = onClose;
    this.contract = [];
    this.selling.clear();
    this.opened = true;
    this.revealOpen = false;
    this.render();
    enter(this.root);
    this.menu.ensure();
  }

  close(): void {
    this.opened = false;
    this.revealOpen = false;
    leave(this.root);
    leave(this.revealLayer);
    this.roulette.hide();
    this.busy = false;
  }

  handleInput(input: Input): void {
    if (this.roulette.spinning) {
      if (input.consume('confirm') || input.consume('jump') || input.consume('back')) this.roulette.skip();
      input.flush();
      return;
    }
    if (this.revealOpen) {
      if (input.consume('back')) {
        this.closeReveal();
        return;
      }
      this.revealMenu.handle(input);
      return;
    }
    if (this.busy) {
      input.flush();
      return;
    }
    if (input.consume('back')) {
      audio.play('back');
      this.onClose();
      return;
    }
    this.menu.handle(input);
  }

  private setBank(): void {
    const s = this.ctx?.save;
    if (s) this.bank.textContent = fillCount(UI.hub.bank, String(Math.floor(s.bottles)), s.bottles);
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.setBank();
    for (const [id, b] of this.tabButtons) b.classList.toggle('is-active', id === this.tab);
    if (this.tab === 'cases') this.renderCases(ctx);
    else if (this.tab === 'contract') this.renderContract(ctx);
    else this.renderSell(ctx);
    for (const b of this.root.querySelectorAll('button')) this.menu.bind(b);
    this.menu.ensure();
  }

  // ---------- Cases ----------

  private renderCases(ctx: ShopContext): void {
    const list = h('div', 'case-list');
    // Newest cases first, as the shop would put them.
    const cases = [...ctx.db.cases].reverse();
    cases.forEach((c, i) => {
      const b = h('button', 'case-row');
      if (i === this.selectedCase) b.classList.add('is-selected');
      b.append(h('span', 'case-row__name', c.name), h('span', 'case-row__date', R.released.replace('{v}', c.date.slice(0, 4))));
      b.addEventListener('click', () => {
        if (this.selectedCase === i) return;
        audio.play('click');
        this.selectedCase = i;
        const focused = this.menu.focused === b;
        this.render();
        if (focused) this.menu.focus(this.body.querySelectorAll<HTMLButtonElement>('.case-row')[i] ?? null, false);
      });
      list.append(b);
    });
    const c = cases[this.selectedCase] ?? cases[0];
    const detail = h('div', 'case-detail');
    const price = casePrice();
    const open = h('button', 'btn', fillCount(R.open, String(price), price));
    const short = price - ctx.save.bottles;
    open.disabled = short > 0 || this.busy;
    open.addEventListener('click', () => {
      this.openCase(ctx, c);
    });
    const priceLine = h('p', 'case-detail__price', R.price.replace('{case}', String(SHOP.casePrice)).replace('{key}', String(SHOP.keyPrice)));
    const lack = short > 0 ? h('p', 'case-detail__poor', fillCount(R.poor, String(Math.ceil(short)), Math.ceil(short))) : null;
    const grid = h('div', 'skin-grid');
    const items = [...c.items].sort((a, b) => b.rarity - a.rarity);
    for (const s of items) {
      const t = skinTile(ctx.db, ctx.thumbs, s);
      t.tabIndex = -1;
      t.classList.add('is-static');
      grid.append(t);
    }
    grid.append(this.rareTile(c));
    detail.append(h('h3', 'case-detail__name', c.name), priceLine, open, ...(lack ? [lack] : []), h('p', 'case-detail__odds', R.odds), h('h4', 'case-detail__sub', R.contains), grid);
    const wrap = h('div', 'recyk__cases');
    wrap.append(list, detail);
    this.body.replaceChildren(wrap);
  }

  /** The gold tile CS shows for the knives and gloves a case can hold. */
  private rareTile(c: CaseDef): HTMLElement {
    const t = h('div', 'skin-tile skin-tile--rare');
    t.style.setProperty('--rarity', CS_RARITY[6].color);
    t.append(h('div', 'skin-tile__star', '★'), h('span', 'skin-tile__weapon', R.rare), h('span', 'skin-tile__pattern', R.rareCount.replace('{v}', String(c.rare.length))));
    return t;
  }

  private openCase(ctx: ShopContext, c: CaseDef): void {
    const price = casePrice();
    if (this.busy || ctx.save.bottles < price) {
      audio.play('denied');
      return;
    }
    this.busy = true;
    ctx.save.bottles -= price;
    const rng = new Rng(ctx.save.caseRng);
    const drop = openCase(c, rng);
    ctx.save.caseRng = rng.state;
    ctx.save.casesOpened++;
    const owned = addDrop(ctx.save, drop);
    ctx.persist();
    this.setBank();
    audio.play('caseOpen');
    // The strip is decoration; the drop was decided above. Fill it the way the odds would.
    const strip: SkinDef[] = [];
    const rnd = (): number => Math.random();
    // Rarer tiers a little more often than the real odds, so the strip teases like the real thing.
    const tiers = ([2, 3, 4, 5, 6] as const).filter((r) => (r === 6 ? c.rare.length > 0 : c.items.some((s) => s.rarity === r)));
    const weight = (r: CsRarity): number => CASE_ODDS[r] * 2 ** (r - 2);
    const total = tiers.reduce((sum, r) => sum + weight(r), 0);
    const pickTier = (): CsRarity => {
      let x = rnd() * total;
      for (const r of tiers) {
        x -= weight(r);
        if (x < 0) return r;
      }
      return tiers[0];
    };
    const WIN = 46;
    for (let i = 0; i < 54; i++) {
      if (i === WIN) {
        strip.push(drop.def);
        continue;
      }
      const tier = pickTier();
      const pool = tier === 6 ? c.rare : c.items.filter((s) => s.rarity === tier);
      strip.push(pool[Math.floor(rnd() * pool.length)] ?? c.items[0]);
    }
    const tiles = strip.map((s) => {
      if (s.rarity === 6) return this.rareTile(c);
      const t = skinTile(ctx.db, ctx.thumbs, s);
      t.tabIndex = -1;
      return t;
    });
    // Pictures first, then the spin: a roulette of empty frames would spoil it.
    const pics = strip.filter((s) => s.rarity !== 6).map((s) => ctx.thumbs.get(`${s.id}:c`, s.weapon, { finish: s.finish, palette: s.palette, float: s.float[0], seed: 7 }));
    void Promise.all(pics).then(() => {
      leave(this.root);
      this.roulette.spin(tiles, WIN, () => {
        this.roulette.hide();
        this.showReveal(ctx, drop.def, owned, () => {
          this.openCase(ctx, c);
        });
      });
    });
  }

  private showReveal(ctx: ShopContext, def: SkinDef, owned: OwnedSkin, again: (() => void) | null): void {
    audio.play(def.rarity === 6 ? 'revealGold' : def.rarity >= 4 ? 'revealRare' : 'reveal');
    const card = revealCard(ctx.db, ctx.thumbs, def, owned);
    const row = h('div', 'panel__row');
    const next = h('button', 'btn', R.next);
    next.addEventListener('click', () => {
      audio.play('click');
      this.closeReveal();
    });
    row.append(next);
    if (again) {
      const price = casePrice();
      const more = h('button', 'btn btn--ghost', R.again.replace('{v}', String(price)));
      more.disabled = ctx.save.bottles < price;
      more.addEventListener('click', () => {
        this.revealOpen = false;
        leave(this.revealLayer);
        this.busy = false;
        again();
      });
      row.append(more);
    }
    const value = sellPrice(def, owned.float, owned.stattrak);
    const sell = h('button', 'btn btn--ghost', R.sell.replace('{v}', String(value)));
    sell.addEventListener('click', () => {
      this.sell(ctx, [owned.uid]);
      this.closeReveal();
    });
    row.append(sell);
    const box = h('div', 'panel reveal-panel');
    box.append(card, row);
    this.revealLayer.replaceChildren(box);
    this.revealOpen = true;
    enter(this.revealLayer);
    for (const b of this.revealLayer.querySelectorAll('button')) this.revealMenu.bind(b);
    this.revealMenu.focus(next, false);
  }

  private closeReveal(): void {
    this.revealOpen = false;
    leave(this.revealLayer);
    this.busy = false;
    enter(this.root);
    this.render();
  }

  // ---------- Trade-up contract ----------

  private inputs(ctx: ShopContext): TradeUpInput[] {
    return this.contract
      .map((uid) => ctx.save.inventory.find((s) => s.uid === uid))
      .filter((s): s is OwnedSkin => s !== undefined)
      .flatMap((s) => {
        const def = ctx.db.skins.get(s.skin);
        return def ? [{ def, float: s.float, stattrak: s.stattrak }] : [];
      });
  }

  private renderContract(ctx: ShopContext): void {
    const top = h('div', 'contract__top');
    const tier = h('button', 'option');
    tier.append(h('span', 'option__name', R.tier), h('span', 'option__value', `${CS_RARITY[this.contractTier].icon} ${CS_RARITY[this.contractTier].name}`));
    tier.addEventListener('click', () => {
      audio.play('click');
      this.contractTier = (this.contractTier >= 5 ? 2 : this.contractTier + 1) as CsRarity;
      this.contract = [];
      this.render();
    });
    const st = h('button', 'option');
    st.append(h('span', 'option__name', R.stattrak), h('span', 'option__value', this.contractStattrak ? R.yes : R.no));
    st.addEventListener('click', () => {
      audio.play('click');
      this.contractStattrak = !this.contractStattrak;
      this.contract = [];
      this.render();
    });
    top.append(tier, st);
    const inputs = this.inputs(ctx);
    const slots = h('div', 'contract__slots');
    for (let i = 0; i < SHOP.tradeUp; i++) {
      const slot = h('div', 'contract__slot');
      const d = inputs[i] as TradeUpInput | undefined;
      if (d) {
        slot.style.setProperty('--rarity', CS_RARITY[d.def.rarity].color);
        slot.append(picture(ctx.thumbs, d.def, d.float));
      }
      slots.append(slot);
    }
    const problem = tradeUpProblem(ctx.db, inputs);
    const sign = h('button', 'btn', R.sign);
    sign.disabled = problem !== null || this.busy;
    sign.addEventListener('click', () => {
      this.signContract(ctx);
    });
    const clear = h('button', 'btn btn--ghost btn--small', R.clear);
    clear.disabled = this.contract.length === 0;
    clear.addEventListener('click', () => {
      audio.play('back');
      this.contract = [];
      this.render();
    });
    const status = h('p', 'contract__status', problem && problem !== 'count' ? R.problems[problem] : R.slots.replace('{v}', String(inputs.length)));
    const outcomes = h('div', 'contract__outcomes');
    if (inputs.length) {
      const list = tradeUpOutcomes(ctx.db, inputs.length === SHOP.tradeUp ? inputs : inputs.concat(Array.from({ length: SHOP.tradeUp - inputs.length }, () => inputs[0])))
        .sort((a, b) => b.chance - a.chance)
        .slice(0, 8);
      if (list.length) outcomes.append(h('h4', 'case-detail__sub', R.outcomes));
      for (const o of list) {
        const row = h('div', 'contract__outcome');
        row.style.setProperty('--rarity', CS_RARITY[o.def.rarity].color);
        row.append(h('span', '', `${CS_RARITY[o.def.rarity].icon} ${ctx.db.weaponNames[o.def.weapon] ?? o.def.weapon} | ${o.def.pattern || '★'}`), h('span', 'contract__chance', `${(o.chance * 100).toFixed(1).replace('.', ',')}%`));
        outcomes.append(row);
      }
    }
    const actions = h('div', 'panel__row');
    actions.append(sign, clear);
    const grid = h('div', 'skin-grid');
    const eligible = ctx.save.inventory.filter((s) => {
      const def = ctx.db.skins.get(s.skin);
      return def && def.rarity === this.contractTier && s.stattrak === this.contractStattrak && def.collection && !isEquipped(ctx.save, s.uid);
    });
    for (const s of eligible) {
      const def = ctx.db.skins.get(s.skin);
      if (!def) continue;
      const t = skinTile(ctx.db, ctx.thumbs, def, { owned: s, selected: this.contract.includes(s.uid) });
      t.addEventListener('click', () => {
        const i = this.contract.indexOf(s.uid);
        if (i >= 0) this.contract.splice(i, 1);
        else if (this.contract.length < SHOP.tradeUp) this.contract.push(s.uid);
        else {
          audio.play('denied');
          return;
        }
        audio.play('pick');
        const focusIndex = [...grid.children].indexOf(t);
        this.render();
        this.menu.focus(this.body.querySelectorAll<HTMLButtonElement>('.skin-grid .skin-tile')[focusIndex] ?? null, false);
      });
      grid.append(t);
    }
    const hint = h('p', 'side__hint', eligible.length ? R.contractHint : R.empty);
    this.body.replaceChildren(top, hint, slots, status, actions, outcomes, grid);
  }

  private signContract(ctx: ShopContext): void {
    const inputs = this.inputs(ctx);
    if (this.busy || tradeUpProblem(ctx.db, inputs)) {
      audio.play('denied');
      return;
    }
    const rng = new Rng(ctx.save.caseRng);
    const drop = tradeUp(ctx.db, inputs, rng);
    if (!drop) return;
    this.busy = true;
    ctx.save.caseRng = rng.state;
    ctx.save.inventory = ctx.save.inventory.filter((s) => !this.contract.includes(s.uid));
    ctx.save.contracts++;
    const owned = addDrop(ctx.save, drop);
    this.contract = [];
    ctx.persist();
    audio.play('contract');
    ctx.note(R.signed);
    // The ten skins fold into the contract before the result shows.
    this.root.classList.add('is-signing');
    window.setTimeout(() => {
      this.root.classList.remove('is-signing');
      leave(this.root);
      this.showReveal(ctx, drop.def, owned, null);
    }, 650);
  }

  // ---------- Buy-back ----------

  private renderSell(ctx: ShopContext): void {
    const grid = h('div', 'skin-grid');
    let total = 0;
    for (const s of [...ctx.save.inventory].reverse()) {
      const def = ctx.db.skins.get(s.skin);
      if (!def) continue;
      const price = sellPrice(def, s.float, s.stattrak);
      const equipped = isEquipped(ctx.save, s.uid);
      const t = skinTile(ctx.db, ctx.thumbs, def, { owned: s, equipped, price: String(price), selected: this.selling.has(s.uid) });
      if (this.selling.has(s.uid)) total += price;
      t.addEventListener('click', () => {
        if (equipped) {
          audio.play('denied');
          ctx.note(R.equipped);
          return;
        }
        if (this.selling.has(s.uid)) this.selling.delete(s.uid);
        else this.selling.add(s.uid);
        audio.play('pick');
        const focusIndex = [...grid.children].indexOf(t);
        this.render();
        this.menu.focus(this.body.querySelectorAll<HTMLButtonElement>('.skin-grid .skin-tile')[focusIndex] ?? null, false);
      });
      grid.append(t);
    }
    const sell = h('button', 'btn', fillCount(R.sellSelected, String(total), total));
    sell.disabled = this.selling.size === 0;
    sell.addEventListener('click', () => {
      this.sell(ctx, [...this.selling]);
      this.selling.clear();
      this.render();
    });
    const hint = h('p', 'side__hint', ctx.save.inventory.length ? R.sellHint : R.nothing);
    this.body.replaceChildren(hint, sell, grid);
  }

  private sell(ctx: ShopContext, uids: number[]): void {
    let total = 0;
    for (const uid of uids) {
      const s = ctx.save.inventory.find((x) => x.uid === uid);
      const def = s ? ctx.db.skins.get(s.skin) : undefined;
      if (!s || !def || isEquipped(ctx.save, uid)) continue;
      total += sellPrice(def, s.float, s.stattrak);
      ctx.save.inventory = ctx.save.inventory.filter((x) => x.uid !== uid);
    }
    if (!total) return;
    ctx.save.bottles += total;
    ctx.persist();
    audio.play('sell');
    ctx.note(fillCount(R.sold, String(total), total));
    this.setBank();
  }
}
