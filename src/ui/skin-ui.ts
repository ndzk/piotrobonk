// Pieces shared by the recyklomat and the inventory: skin tiles with their picture, the rarity stripe
// (colour plus a shape, for colour-blind players), badges, and the reveal card after a case or a contract.

import { CS_RARITY, WEARS, steamImage, wearIndex, wearOf, type SkinDb, type SkinDef } from '../content/skins/index';
import { UI } from '../content/ui';
import type { OwnedSkin } from '../core/save';
import { fullName, lookOf } from '../game/gear';
import type { Thumbs } from '../render/thumbs';
import { h, rarityColor } from './dom';

/** A picture key per skin and wear: patterns differ per seed, but a list does not need a picture per seed. */
export function thumbKey(def: SkinDef, float: number | null): string {
  return `${def.id}:${float === null ? 'c' : wearIndex(float)}`;
}

/** The look a list shows for a skin: the middle of the wear's float range, clamped to the skin's own. */
export function listLook(def: SkinDef, float: number | null): { finish: string; palette: string[]; float: number; seed: number } {
  let shown = def.float[0];
  if (float !== null) {
    const wi = wearIndex(float);
    const mid = ((wi === 0 ? 0 : WEARS[wi - 1].max) + WEARS[wi].max) / 2;
    shown = Math.min(def.float[1], Math.max(def.float[0], mid));
  }
  return { finish: def.finish, palette: def.palette, float: shown, seed: 7 };
}

/**
 * An <img> showing the skin's own picture from Steam, the one CS shows. If it does not come (offline, the
 * installed game, Steam down) the game's drawing of the skin, `drawn`, takes its place. The box shimmers until
 * one of them is in. No referrer goes to Steam.
 */
function steamOr(box: HTMLElement, image: string | undefined, size: [number, number], drawn: (img: HTMLImageElement) => void): HTMLImageElement {
  const img = h('img');
  img.alt = '';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  box.classList.add('is-loading');
  img.addEventListener('load', () => {
    box.classList.remove('is-loading');
  });
  if (image) {
    img.addEventListener('error', () => {
      drawn(img);
    }, { once: true });
    img.src = steamImage(image, size[0], size[1]);
  } else drawn(img);
  box.append(img);
  return img;
}

/** Loads a skin's picture into a list tile: Steam's, or the game's drawing of it. */
export function picture(thumbs: Thumbs, def: SkinDef, float: number | null): HTMLElement {
  const box = h('div', 'skin-pic');
  steamOr(box, def.image, [256, 192], (img) => {
    const key = thumbKey(def, float);
    const ready = thumbs.peek(key);
    if (ready) img.src = ready;
    else
      void thumbs.get(key, def.weapon, listLook(def, float)).then((url) => {
        img.src = url;
      });
  });
  return box;
}

/** Resolves once `img` shows a picture (Steam's or the fallback), or after `ms` at the latest. */
export function pictureReady(img: HTMLImageElement, ms = 8000): Promise<void> {
  return new Promise((done) => {
    if (img.complete && img.naturalWidth > 0) {
      done();
      return;
    }
    const timer = window.setTimeout(done, ms);
    img.addEventListener('load', () => {
      window.clearTimeout(timer);
      done();
    });
  });
}

export interface TileOptions {
  owned?: OwnedSkin;
  /** Where it is worn: 'gun', 'knife', 'gloves' or a wrapped weapon id. */
  worn?: string | null;
  price?: number;
  selected?: boolean;
  unseen?: boolean;
  disabled?: boolean;
}

/** "Gnat", "Nóż", "Rękawice" or the wrapped weapon's short name. */
export function wornLabel(worn: string): string {
  const I = UI.inventory;
  return (I.worn as Record<string, string | undefined>)[worn] ?? (I.wrapTargets as Record<string, string | undefined>)[worn] ?? worn;
}

/** A clickable skin tile: picture, name, wear and StatTrak™, rarity stripe with its icon, badges. */
export function skinTile(db: SkinDb, thumbs: Thumbs, def: SkinDef, o: TileOptions = {}): HTMLButtonElement {
  const r = CS_RARITY[def.rarity];
  const b = h('button', 'skin-tile');
  b.style.setProperty('--rarity', rarityColor(r.color));
  if (o.selected) b.classList.add('is-selected');
  if (o.disabled) b.classList.add('is-disabled');
  const name = fullName(db, def, o.owned?.stattrak === true);
  const cut = name.indexOf(' | ');
  const text = h('div', 'skin-tile__text');
  text.append(h('span', 'skin-tile__weapon', cut >= 0 ? name.slice(0, cut) : name), h('span', 'skin-tile__pattern', cut >= 0 ? name.slice(cut + 3) : ''));
  const meta = h('div', 'skin-tile__meta');
  meta.append(h('span', 'skin-tile__icon', r.icon));
  if (o.owned) meta.append(h('span', 'skin-tile__wear', wearOf(o.owned.float).short));
  if (o.price !== undefined) meta.append(h('span', 'skin-tile__price', String(o.price)));
  b.append(picture(thumbs, def, o.owned ? o.owned.float : null), text, meta);
  if (o.worn) b.append(h('span', 'skin-tile__badge', `✓ ${wornLabel(o.worn)}`));
  else if (o.unseen) b.append(h('span', 'skin-tile__badge skin-tile__badge--new', UI.inventory.unseen));
  b.setAttribute('aria-label', `${name}${o.owned ? `, ${wearOf(o.owned.float).name}` : ''}, ${r.name}`);
  return b;
}

/** The big card after a case or a contract: picture, name, rarity, wear with the exact float. */
export function revealCard(db: SkinDb, thumbs: Thumbs, def: SkinDef, owned: OwnedSkin): HTMLElement {
  const r = CS_RARITY[def.rarity];
  const card = h('div', 'reveal');
  card.style.setProperty('--rarity', rarityColor(r.color));
  if (def.rarity >= 5) card.classList.add('is-rare');
  if (def.rarity === 6) card.classList.add('is-gold');
  const pic = h('div', 'skin-pic skin-pic--big');
  steamOr(pic, def.image, [512, 384], (img) => {
    // Drawn at the card's size (not a list thumbnail stretched), once: the key is this one copy of the skin.
    void thumbs.get(`${def.id}:big:${owned.uid}`, def.weapon, lookOf(owned, def), true).then((url) => {
      img.src = url;
    });
  });
  const wear = wearOf(owned.float);
  card.append(h('div', 'reveal__rarity', `${r.icon} ${r.name}`), pic, h('h3', 'reveal__name', fullName(db, def, owned.stattrak)), h('p', 'reveal__wear', `${wear.name} · ${owned.float.toFixed(6).replace('.', ',')}`));
  return card;
}
