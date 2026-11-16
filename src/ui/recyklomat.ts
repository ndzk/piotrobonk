// The recyklomat: buys real CS cases with bottles (case + key), spins the roulette, signs trade-up contracts
// and buys skins back. Every result is decided and saved before the animation starts, so reloading the
// page mid-spin changes nothing (and the next visit shows what came out).

import { audio } from '../audio/audio';
import { CASE_ODDS, CS_RARITIES, CS_RARITY, SHOP, contractSize, steamImage, type CaseDef, type CsRarity, type SkinDb, type SkinDef } from '../content/skins/index';
import { UI } from '../content/ui';
import { Rng } from '../core/rng';
import { bump, see, type OwnedSkin, type Save } from '../core/save';
import { fillCount } from '../core/text';
import { fullName, isWorn, wornAs } from '../game/gear';
import type { Input } from '../game/input';
import { casePrice, openCase, sellPrice, tradeUp, tradeUpOutcomes, tradeUpProblem, type Drop, type TradeUpInput } from '../game/skins';

/** What the next case costs this save: the case and its key, or only the case with a key on the house. */
const priceFor = (save: { freeKeys: number }): number => casePrice() - (save.freeKeys > 0 ? SHOP.keyPrice : 0);
import type { Thumbs } from '../render/thumbs';
import { cycleButton, enter, h, leave, rarityColor, SpatialMenu } from './dom';
import { picture, pictureReady, revealCard, skinTile } from './skin-ui';

export interface ShopContext {
  db: SkinDb;
  thumbs: Thumbs;
  save: Save;
  /** Saves and refreshes everything that shows the bank or the inventory. */
  persist(): void;
  /** Puts a line on the recyklomat's display. */
  note(text: string): void;
  /** The 3D machine hands out a case. */
  dropCase(): void;
}

type Tab = 'cases' | 'contract' | 'sell';

const R = UI.recyklomat;
const bottles = (template: string, n: number): string => fillCount(template, String(n), n);

/** Adds a drop to the inventory (marked new) and returns the owned copy. */
export function addDrop(save: Save, d: Drop): OwnedSkin {
  const owned: OwnedSkin = { uid: save.nextUid++, skin: d.def.id, float: d.float, seed: d.seed, stattrak: d.stattrak, kills: 0 };
  save.inventory.push(owned);
  save.unseen.push(owned.uid);
  see(save.collected, d.def.id);
  if (d.def.rarity === 6) bump(save, 'starsDropped');
  return owned;
}

/** The horizontal case roulette: shows its strip at once, then slows down, ticks on every tile, lands. */
class Roulette {
  readonly root = h('div', 'roulette');
  private readonly backdrop = h('div', 'roulette-backdrop');
  private readonly track = h('div', 'roulette__track');
  private readonly hint = h('p', 'roulette__hint');
  private raf = 0;
  private skipRequested = false;
  /** From showing the strip until it has landed. */
  busy = false;

  constructor(parent: HTMLElement) {
    const view = h('div', 'roulette__window');
    view.append(this.track, h('div', 'roulette__line'));
    this.root.append(view, this.hint);
    this.root.hidden = true;
    this.backdrop.hidden = true;
    // A click anywhere skips, as the hint says.
    for (const el of [this.root, this.backdrop]) {
      el.addEventListener('pointerdown', () => {
        this.skip();
      });
    }
    parent.append(this.backdrop, this.root);
  }

  skip(): void {
    if (this.raf) this.skipRequested = true;
  }

  /** The strip appears right away (pictures shimmer in as they are drawn). */
  show(tiles: HTMLElement[]): void {
    this.busy = true;
    this.track.style.transform = 'translateX(0)';
    this.track.replaceChildren(...tiles);
    this.hint.textContent = R.loading;
    enter(this.backdrop);
    enter(this.root);
  }

  spin(winner: number, done: () => void): void {
    this.hint.textContent = R.skip;
    this.skipRequested = false;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = still ? 1.2 : 6.2;
    const tiles = this.track.children as HTMLCollectionOf<HTMLElement>;
    // Measure after layout, in the layer's own CSS pixels (offset sizes): the text size setting zooms the UI,
    // and on-screen rectangles would be scaled while translateX is not.
    const first = tiles[0];
    const step = tiles[1].offsetLeft - first.offsetLeft;
    const centre = this.track.parentElement?.clientWidth ?? 800;
    // Land somewhere inside the winning tile, not always on its middle, like CS.
    const jitter = (Math.random() - 0.5) * step * 0.7;
    const end = winner * step + first.offsetWidth / 2 - centre / 2 + jitter;
    let t0 = performance.now();
    let lastTile = -1;
    const tick = (now: number): void => {
      if (this.skipRequested) {
        t0 = Math.min(t0, now - duration * 1000 * 0.97);
        this.skipRequested = false;
      }
      const t = Math.min(1, (now - t0) / (duration * 1000));
      const x = end * (1 - Math.pow(1 - t, 4));
      this.track.style.transform = `translateX(${-x}px)`;
      const under = Math.floor((x + centre / 2) / step);
      if (under !== lastTile) {
        lastTile = under;
        // Louder as it slows: the last few tiles are the tense ones.
        audio.play('tick', 0.5 + 0.5 * t);
      }
      if (t < 1) this.raf = requestAnimationFrame(tick);
      else {
        this.raf = 0;
        window.setTimeout(done, still ? 100 : 450);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  hide(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.busy = false;
    leave(this.root);
    leave(this.backdrop);
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
  private showRare = false;
  private contract: number[] = [];
  private contractTier: CsRarity = 2;
  private contractStattrak = false;
  private selling = new Set<number>();
  private sellTier: CsRarity | null = null;
  /** Open as far as input goes: a panel playing its exit animation is already closed. */
  private opened = false;
  private revealOpen = false;
  /** After a stand-alone reveal (a result left over from a closed page), go back to the hub, not the shop. */
  private revealOnly = false;

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
    // The case's contents are pictures to look at, not stops for the arrows.
    this.menu = new SpatialMenu(() => [...this.root.querySelectorAll<HTMLButtonElement>('button:not(.is-static)')]);
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
    this.revealOnly = false;
    this.render();
    enter(this.root);
    this.menu.ensure();
  }

  /** Shows a result the player never saw (the page closed mid-roulette), then hands back to the hub. */
  openReveal(ctx: ShopContext, uid: number, onClose: () => void): void {
    const owned = ctx.save.inventory.find((s) => s.uid === uid);
    const def = owned ? ctx.db.skins.get(owned.skin) : undefined;
    ctx.save.pendingReveal = null;
    ctx.persist();
    if (!owned || !def) {
      onClose();
      return;
    }
    this.ctx = ctx;
    this.onClose = onClose;
    this.opened = true;
    this.revealOnly = true;
    this.showReveal(ctx, def, owned, null);
  }

  close(): void {
    this.opened = false;
    this.revealOpen = false;
    leave(this.root);
    leave(this.revealLayer);
    this.roulette.hide();
  }

  handleInput(input: Input): void {
    // The contract folding up (a short animation that ends in the reveal): nothing may close the shop under it.
    if (this.root.classList.contains('is-signing')) {
      input.flush();
      return;
    }
    if (this.roulette.busy) {
      if (input.consume('confirm') || input.consume('jump') || input.consume('back')) this.roulette.skip();
      input.flush();
      return;
    }
    if (this.revealOpen) {
      if (input.consume('back')) {
        audio.play('back');
        this.closeReveal();
        return;
      }
      this.revealMenu.handle(input);
      return;
    }
    if (input.consume('back')) {
      audio.play('back');
      this.onClose();
      return;
    }
    // LB / RB (Page Up / Page Down) switch the tabs, as in the settings and the journal.
    const step = input.consume('tabPrev') ? -1 : input.consume('tabNext') ? 1 : 0;
    if (step !== 0) {
      const tabs = [...this.tabButtons.keys()];
      const next = tabs[(tabs.indexOf(this.tab) + step + tabs.length) % tabs.length];
      this.tabButtons.get(next)?.click();
      this.menu.focus(this.tabButtons.get(next) ?? null, false);
    }
    // From the case list, right goes to "Otwórz" (not up to whichever tab is nearest), and left comes back.
    const f = this.menu.focused;
    if (f?.classList.contains('case-row') && input.consume('right')) this.menu.focus(this.body.querySelector<HTMLButtonElement>('.case-detail .btn'));
    else if (f?.closest('.case-detail') && f.classList.contains('btn') && input.consume('left')) this.menu.focus(this.body.querySelector<HTMLButtonElement>('.case-row.is-selected'));
    this.menu.handle(input);
  }

  private setBank(): void {
    const s = this.ctx?.save;
    if (!s) return;
    const n = Math.floor(s.bottles);
    const extras = [s.freeCases > 0 ? bottles(UI.hub.freeCases, s.freeCases) : '', s.freeKeys > 0 ? bottles(UI.hub.freeKeys, s.freeKeys) : ''].filter(Boolean);
    this.bank.textContent = [bottles(UI.hub.bank, n), ...extras].join(' · ');
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

  /** Re-renders and puts the focus back on the same spot (the n-th element matching `selector`). */
  private rerender(selector: string, at: Element): void {
    const i = [...this.body.querySelectorAll(selector)].indexOf(at);
    this.render();
    this.menu.focus(this.body.querySelectorAll<HTMLButtonElement>(selector)[i] ?? null, false);
  }

  // ---------- Cases ----------

  /** A case's own picture from Steam; without one (or offline) the row and the header just go without. */
  private casePicture(c: CaseDef, cls: string, w: number, hgt: number): HTMLImageElement[] {
    if (!c.image) return [];
    const img = h('img', cls);
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      img.hidden = true;
    });
    img.src = steamImage(c.image, w, hgt);
    return [img];
  }

  private renderCases(ctx: ShopContext): void {
    const list = h('div', 'case-list');
    // Newest cases first, as the shop would put them.
    const cases = [...ctx.db.cases].reverse();
    cases.forEach((c, i) => {
      const b = h('button', 'case-row');
      if (i === this.selectedCase) b.classList.add('is-selected');
      b.append(...this.casePicture(c, 'case-row__pic', 96, 72), h('span', 'case-row__name', c.name), h('span', 'case-row__date', c.date.slice(0, 4)));
      b.addEventListener('click', () => {
        if (this.selectedCase === i) return;
        audio.play('click');
        this.selectedCase = i;
        this.showRare = false;
        this.rerender('.case-row', b);
      });
      list.append(b);
    });
    const c = cases[this.selectedCase] ?? cases[0];
    const free = ctx.save.freeCases > 0;
    const price = priceFor(ctx.save);
    const open = h('button', 'btn', free ? R.openFree.replace('{v}', String(ctx.save.freeCases)) : bottles(R.open, price));
    const short = price - ctx.save.bottles;
    open.disabled = !free && short > 0;
    open.addEventListener('click', () => {
      this.openCase(ctx, c);
    });
    const head = h('div', 'pane-head');
    head.append(...this.casePicture(c, 'case-detail__pic', 256, 192), h('h3', 'case-detail__name', c.name), h('p', 'case-detail__price', R.price.replace('{case}', String(SHOP.casePrice)).replace('{key}', String(SHOP.keyPrice))), open);
    if (!free && short > 0) head.append(h('p', 'case-detail__poor', bottles(R.poor, Math.ceil(short))));
    const grid = h('div', 'skin-grid');
    for (const s of [...c.items].sort((a, b) => b.rarity - a.rarity)) {
      const t = skinTile(ctx.db, ctx.thumbs, s);
      t.tabIndex = -1;
      t.classList.add('is-static');
      grid.append(t);
    }
    grid.append(this.rareTile(c, true));
    if (this.showRare) {
      for (const s of c.rare) {
        const t = skinTile(ctx.db, ctx.thumbs, s);
        t.tabIndex = -1;
        t.classList.add('is-static');
        grid.append(t);
      }
    }
    const scroll = h('div', 'pane-scroll');
    scroll.append(h('p', 'case-detail__odds', R.odds), h('h4', 'case-detail__sub', R.contains), grid);
    const detail = h('div', 'case-detail');
    detail.append(head, scroll);
    const wrap = h('div', 'recyk__cases');
    wrap.append(list, detail);
    this.body.replaceChildren(wrap);
  }

  /** The gold tile CS shows for the knives and gloves a case can hold; in the shop it opens the list. */
  private rareTile(c: CaseDef, toggle: boolean): HTMLElement {
    const t = h(toggle ? 'button' : 'div', 'skin-tile skin-tile--rare');
    t.style.setProperty('--rarity', rarityColor(CS_RARITY[6].color));
    t.append(h('div', 'skin-tile__star', '★'), h('span', 'skin-tile__weapon', R.rare), h('span', 'skin-tile__pattern', bottles(R.rareCount, c.rare.length)));
    if (toggle) {
      t.append(h('span', 'skin-tile__toggle', this.showRare ? R.rareHide : R.rareShow));
      t.addEventListener('click', () => {
        audio.play('click');
        this.showRare = !this.showRare;
        this.rerender('.skin-tile--rare', t);
      });
    }
    return t;
  }

  private openCase(ctx: ShopContext, c: CaseDef): void {
    const price = priceFor(ctx.save);
    const free = ctx.save.freeCases > 0;
    if (this.roulette.busy || (!free && ctx.save.bottles < price)) {
      audio.play('denied');
      return;
    }
    if (free) ctx.save.freeCases--;
    else {
      // A key on the house (a reward for a harder run) pays the key's half of the price.
      if (ctx.save.freeKeys > 0) ctx.save.freeKeys--;
      ctx.save.bottles -= price;
    }
    const rng = new Rng(ctx.save.caseRng);
    const drop = openCase(c, rng);
    ctx.save.caseRng = rng.state;
    ctx.save.casesOpened++;
    const owned = addDrop(ctx.save, drop);
    // Saved before the show: a closed page shows it on the next visit instead of losing the moment.
    ctx.save.pendingReveal = owned.uid;
    ctx.persist();
    this.setBank();
    audio.play('caseOpen');
    ctx.dropCase();
    leave(this.root);
    // The strip is decoration; the drop was decided above. Rarer tiers show up a little more often than
    // the real odds, so the strip teases like the real thing.
    const tiers = CS_RARITIES.filter((r) => (r === 6 ? c.rare.length > 0 : c.items.some((s) => s.rarity === r)));
    const weight = (r: CsRarity): number => CASE_ODDS[r] * 2 ** (r - 2);
    const total = tiers.reduce((sum, r) => sum + weight(r), 0);
    const pickTier = (): CsRarity => {
      let x = Math.random() * total;
      for (const r of tiers) {
        x -= weight(r);
        if (x < 0) return r;
      }
      return tiers[0];
    };
    const WIN = 46;
    const strip: SkinDef[] = [];
    for (let i = 0; i < 54; i++) {
      if (i === WIN) {
        strip.push(drop.def);
        continue;
      }
      const tier = pickTier();
      const pool = tier === 6 ? c.rare : c.items.filter((s) => s.rarity === tier);
      strip.push(pool[Math.floor(Math.random() * pool.length)] ?? c.items[0]);
    }
    const tiles = strip.map((s) => {
      if (s.rarity === 6) return this.rareTile(c, false);
      const t = skinTile(ctx.db, ctx.thumbs, s);
      t.tabIndex = -1;
      return t;
    });
    this.roulette.show(tiles);
    // The spin starts once the pictures are in (Steam's, or the game's drawings without a connection): a
    // roulette of blank frames would spoil it.
    const pics = tiles.flatMap((t) => [...t.querySelectorAll('img')]).map((img) => pictureReady(img));
    void Promise.all(pics).then(() => {
      if (!this.opened) {
        this.roulette.hide();
        return;
      }
      this.roulette.spin(WIN, () => {
        this.roulette.hide();
        this.showReveal(ctx, drop.def, owned, () => {
          this.openCase(ctx, c);
        });
      });
    });
  }

  private showReveal(ctx: ShopContext, def: SkinDef, owned: OwnedSkin, again: (() => void) | null): void {
    if (ctx.save.pendingReveal !== null) {
      ctx.save.pendingReveal = null;
      ctx.persist();
    }
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
      const free = ctx.save.freeCases > 0;
      const price = priceFor(ctx.save);
      const more = h('button', 'btn btn--ghost', free ? R.againFree : bottles(R.again, price));
      more.disabled = !free && ctx.save.bottles < price;
      more.addEventListener('click', () => {
        this.revealOpen = false;
        leave(this.revealLayer);
        again();
      });
      row.append(more);
    }
    const value = sellPrice(def, owned.float, owned.stattrak);
    const sell = h('button', 'btn btn--ghost', bottles(R.sell, value));
    // Selling something rare takes a second click: a ★ is not something to lose to a stray Enter.
    let armed = def.rarity < 4;
    sell.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        sell.textContent = bottles(R.sellSure, value);
        audio.play('hover');
        return;
      }
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
    if (this.revealOnly) {
      this.revealOnly = false;
      this.opened = false;
      this.onClose();
      return;
    }
    enter(this.root);
    this.render();
  }

  // ---------- Trade-up contract ----------

  private inputs(ctx: ShopContext): TradeUpInput[] {
    return this.contract.flatMap((uid) => {
      const s = ctx.save.inventory.find((x) => x.uid === uid);
      const def = s ? ctx.db.skins.get(s.skin) : undefined;
      return s && def ? [{ def, float: s.float, stattrak: s.stattrak }] : [];
    });
  }

  private renderContract(ctx: ShopContext): void {
    const need = contractSize(this.contractTier);
    const tier = cycleButton(R.tier, `${CS_RARITY[this.contractTier].icon} ${CS_RARITY[this.contractTier].name}`, (dir) => {
      audio.play('click');
      this.contractTier = (((this.contractTier - 2 + dir + 4) % 4) + 2) as CsRarity;
      this.contract = [];
      this.rerender('.option', tier);
    });
    const st = cycleButton(R.stattrak, this.contractStattrak ? R.yes : R.no, () => {
      audio.play('click');
      this.contractStattrak = !this.contractStattrak;
      this.contract = [];
      this.rerender('.option', st);
    });
    const options = h('div', 'contract__top');
    options.append(tier, st);
    const inputs = this.inputs(ctx);
    const slots = h('div', 'contract__slots');
    slots.style.setProperty('--slots', String(need));
    for (let i = 0; i < need; i++) {
      const slot = h('div', 'contract__slot');
      const d = inputs[i] as TradeUpInput | undefined;
      if (d) {
        slot.style.setProperty('--rarity', rarityColor(CS_RARITY[d.def.rarity].color));
        slot.append(picture(ctx.thumbs, d.def, d.float));
      }
      slots.append(slot);
    }
    const problem = tradeUpProblem(ctx.db, inputs);
    const sign = h('button', 'btn', R.sign);
    sign.disabled = problem !== null;
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
    const status = h('p', 'contract__status', problem && problem !== 'count' ? R.problems[problem] : R.slots.replace('{v}', String(inputs.length)).replace('{n}', String(need)));
    const actions = h('div', 'panel__row');
    actions.append(sign, clear);
    // What the contract can give, from the skins actually in it.
    const outcomes = h('div', 'contract__outcomes');
    const list = inputs.length ? tradeUpOutcomes(ctx.db, inputs).sort((a, b) => b.chance - a.chance) : [];
    if (list.length) outcomes.append(h('h4', 'case-detail__sub', R.outcomes));
    for (const o of list) {
      const row = h('div', 'contract__outcome');
      row.style.setProperty('--rarity', rarityColor(CS_RARITY[o.def.rarity].color));
      row.append(h('span', '', `${CS_RARITY[o.def.rarity].icon} ${fullName(ctx.db, o.def, this.contractStattrak)}`), h('span', 'contract__chance', `${(o.chance * 100).toFixed(1).replace('.', ',')}%`));
      outcomes.append(row);
    }
    const head = h('div', 'pane-head');
    head.append(options, slots, status, actions, outcomes);
    const grid = h('div', 'skin-grid');
    const eligible = ctx.save.inventory.filter((s) => {
      const def = ctx.db.skins.get(s.skin);
      return def && def.rarity === this.contractTier && s.stattrak === this.contractStattrak && def.collection && !isWorn(ctx.save, s.uid);
    });
    for (const s of [...eligible].reverse()) {
      const def = ctx.db.skins.get(s.skin);
      if (!def) continue;
      const t = skinTile(ctx.db, ctx.thumbs, def, { owned: s, selected: this.contract.includes(s.uid) });
      t.addEventListener('click', () => {
        const i = this.contract.indexOf(s.uid);
        if (i >= 0) this.contract.splice(i, 1);
        else if (this.contract.length < need) this.contract.push(s.uid);
        else {
          audio.play('denied');
          return;
        }
        audio.play('pick');
        this.rerender('.skin-grid .skin-tile', t);
      });
      grid.append(t);
    }
    const scroll = h('div', 'pane-scroll');
    scroll.append(h('p', 'side__hint', eligible.length ? R.contractHint : R.empty), grid);
    this.body.replaceChildren(head, scroll);
  }

  private signContract(ctx: ShopContext): void {
    const inputs = this.inputs(ctx);
    if (tradeUpProblem(ctx.db, inputs)) {
      audio.play('denied');
      return;
    }
    const rng = new Rng(ctx.save.caseRng);
    const drop = tradeUp(ctx.db, inputs, rng);
    if (!drop) return;
    ctx.save.caseRng = rng.state;
    ctx.save.inventory = ctx.save.inventory.filter((s) => !this.contract.includes(s.uid));
    ctx.save.unseen = ctx.save.unseen.filter((u) => !this.contract.includes(u));
    ctx.save.contracts++;
    const owned = addDrop(ctx.save, drop);
    ctx.save.pendingReveal = owned.uid;
    this.contract = [];
    ctx.persist();
    audio.play('contract');
    ctx.note(R.signed);
    // The skins fold into the contract before the result shows.
    this.root.classList.add('is-signing');
    window.setTimeout(() => {
      this.root.classList.remove('is-signing');
      leave(this.root);
      this.showReveal(ctx, drop.def, owned, null);
    }, 650);
  }

  // ---------- Buy-back ----------

  private renderSell(ctx: ShopContext): void {
    const tierBtn = cycleButton(R.tier, this.sellTier ? `${CS_RARITY[this.sellTier].icon} ${CS_RARITY[this.sellTier].name}` : UI.inventory.any, (dir) => {
      audio.play('click');
      const values: (CsRarity | null)[] = [null, ...CS_RARITIES];
      this.sellTier = values[(values.indexOf(this.sellTier) + dir + values.length) % values.length];
      this.rerender('.option', tierBtn);
    });
    const grid = h('div', 'skin-grid');
    let risky = false;
    let total = 0;
    const shown: number[] = [];
    // Cheapest first: that is what gets sold.
    const items = ctx.save.inventory
      .flatMap((s) => {
        const def = ctx.db.skins.get(s.skin);
        return def && (!this.sellTier || def.rarity === this.sellTier) ? [{ s, def, price: sellPrice(def, s.float, s.stattrak) }] : [];
      })
      .sort((a, b) => a.price - b.price);
    for (const { s, def, price } of items) {
      const worn = wornAs(ctx.save, s.uid);
      const t = skinTile(ctx.db, ctx.thumbs, def, { owned: s, worn, price, selected: this.selling.has(s.uid), disabled: worn !== null });
      if (this.selling.has(s.uid)) {
        total += price;
        if (def.rarity >= 4) risky = true;
      }
      if (!worn) shown.push(s.uid);
      t.addEventListener('click', () => {
        if (worn) {
          audio.play('denied');
          ctx.note(R.equipped);
          return;
        }
        if (this.selling.has(s.uid)) this.selling.delete(s.uid);
        else this.selling.add(s.uid);
        audio.play('pick');
        this.rerender('.skin-grid .skin-tile', t);
      });
      grid.append(t);
    }
    const all = h('button', 'btn btn--ghost btn--small', R.selectAll);
    all.disabled = shown.length === 0;
    all.addEventListener('click', () => {
      audio.play('pick');
      for (const uid of shown) this.selling.add(uid);
      this.rerender('.btn', all);
    });
    const sell = h('button', 'btn', bottles(R.sellSelected, total));
    sell.disabled = this.selling.size === 0;
    // A bulk sale with anything Classified or rarer in it, or more than a handful, takes a second click:
    // "select all" then a stray Enter must not sell a ★ knife. Changing the selection disarms it.
    let armed = !risky && this.selling.size <= 5;
    sell.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        sell.textContent = bottles(R.sellSure, total);
        sell.classList.add('is-armed');
        audio.play('hover');
        return;
      }
      this.sell(ctx, [...this.selling]);
      this.selling.clear();
      this.render();
    });
    const row = h('div', 'panel__row');
    row.append(tierBtn, all, sell);
    const head = h('div', 'pane-head');
    head.append(h('p', 'side__hint', ctx.save.inventory.length ? R.sellHint : R.nothing), row);
    const scroll = h('div', 'pane-scroll');
    scroll.append(grid);
    this.body.replaceChildren(head, scroll);
  }

  private sell(ctx: ShopContext, uids: number[]): void {
    let total = 0;
    for (const uid of uids) {
      const s = ctx.save.inventory.find((x) => x.uid === uid);
      const def = s ? ctx.db.skins.get(s.skin) : undefined;
      if (!s || !def || isWorn(ctx.save, uid)) continue;
      total += sellPrice(def, s.float, s.stattrak);
      ctx.save.inventory = ctx.save.inventory.filter((x) => x.uid !== uid);
      ctx.save.unseen = ctx.save.unseen.filter((u) => u !== uid);
    }
    if (!total) return;
    ctx.save.bottles += total;
    ctx.persist();
    audio.play('sell');
    ctx.note(bottles(R.sold, total));
    this.setBank();
  }
}
