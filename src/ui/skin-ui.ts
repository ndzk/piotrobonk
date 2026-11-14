// Pieces shared by the recyklomat and the inventory: skin tiles with their picture, the rarity stripe
// (colour plus a shape, for colour-blind players), and the reveal card shown after a case or a contract.

import { CS_RARITY, WEARS, skinName, wearIndex, wearOf, type SkinDb, type SkinDef } from '../content/skins/index';
import type { OwnedSkin } from '../core/save';
import { lookOf } from '../game/gear';
import type { Thumbs } from '../render/thumbs';
import { h } from './dom';

/** A picture key per skin and wear: patterns differ per seed, but a list does not need a picture per seed. */
export function thumbKey(def: SkinDef, float: number | null): string {
  return `${def.id}:${float === null ? 'c' : wearIndex(float)}`;
}

/** Loads a skin's picture into an <img> (shimmering until it is drawn). */
export function picture(thumbs: Thumbs, def: SkinDef, float: number | null): HTMLElement {
  const box = h('div', 'skin-pic');
  const img = h('img');
  img.alt = '';
  img.decoding = 'async';
  const key = thumbKey(def, float);
  const ready = thumbs.peek(key);
  // A list shows a typical copy of the wear: the middle of the wear's float range, clamped to the skin's own.
  let shown = def.float[0];
  if (float !== null) {
    const wi = wearIndex(float);
    const mid = ((wi === 0 ? 0 : WEARS[wi - 1].max) + WEARS[wi].max) / 2;
    shown = Math.min(def.float[1], Math.max(def.float[0], mid));
  }
  const look = { finish: def.finish, palette: def.palette, float: shown, seed: 7 };
  if (ready) img.src = ready;
  else {
    box.classList.add('is-loading');
    void thumbs.get(key, def.weapon, look).then((url) => {
      img.src = url;
      box.classList.remove('is-loading');
    });
  }
  box.append(img);
  return box;
}

export interface TileOptions {
  owned?: OwnedSkin;
  equipped?: boolean;
  price?: string;
  selected?: boolean;
}

/** A clickable skin tile: picture, name, wear and StatTrak™, rarity stripe with its icon. */
export function skinTile(db: SkinDb, thumbs: Thumbs, def: SkinDef, o: TileOptions = {}): HTMLButtonElement {
  const r = CS_RARITY[def.rarity];
  const b = h('button', 'skin-tile');
  b.style.setProperty('--rarity', r.color);
  if (o.selected) b.classList.add('is-selected');
  const name = skinName(db, def);
  const [weapon, pattern] = name.split(' | ');
  const text = h('div', 'skin-tile__text');
  text.append(h('span', 'skin-tile__weapon', `${o.owned?.stattrak ? 'StatTrak™ ' : ''}${weapon}`), h('span', 'skin-tile__pattern', name.includes(' | ') ? pattern : ''));
  const meta = h('div', 'skin-tile__meta');
  meta.append(h('span', 'skin-tile__icon', r.icon));
  if (o.owned) meta.append(h('span', 'skin-tile__wear', wearOf(o.owned.float).short));
  if (o.price) meta.append(h('span', 'skin-tile__price', o.price));
  b.append(picture(thumbs, def, o.owned ? o.owned.float : null), text, meta);
  if (o.equipped) b.append(h('span', 'skin-tile__badge', '✓'));
  b.setAttribute('aria-label', `${o.owned?.stattrak ? 'StatTrak™ ' : ''}${name}${o.owned ? `, ${wearOf(o.owned.float).name}` : ''}, ${r.name}`);
  return b;
}

/** The big card after a case or a contract: picture, name, rarity, wear with the exact float. */
export function revealCard(db: SkinDb, thumbs: Thumbs, def: SkinDef, owned: OwnedSkin): HTMLElement {
  const r = CS_RARITY[def.rarity];
  const card = h('div', 'reveal');
  card.style.setProperty('--rarity', r.color);
  if (def.rarity >= 5) card.classList.add('is-rare');
  if (def.rarity === 6) card.classList.add('is-gold');
  const look = lookOf(owned, def);
  const pic = h('div', 'skin-pic skin-pic--big is-loading');
  const img = h('img');
  img.alt = '';
  pic.append(img);
  void thumbs.get(`${def.id}:${owned.uid}`, def.weapon, look).then((url) => {
    img.src = url;
    pic.classList.remove('is-loading');
  });
  const wear = wearOf(owned.float);
  card.append(
    h('div', 'reveal__rarity', `${r.icon} ${r.name}`),
    pic,
    h('h3', 'reveal__name', `${owned.stattrak ? 'StatTrak™ ' : ''}${skinName(db, def)}`),
    h('p', 'reveal__wear', `${wear.name} · ${owned.float.toFixed(6).replace('.', ',')}`),
  );
  return card;
}
