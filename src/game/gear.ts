// What Piotrek carry, resolved from the save: the Gnat z CS skin (model and fire profile), a ★ knife in
// place of the briefcase, ★ gloves, and skin patterns wrapped onto other weapons. Pure data, no Three.js.

import { WEAPONS } from '../content/items';
import { CS_WEAPONS, DEFAULT_GUN, isGloves, isKnife } from '../content/skins/catalog';
import { skinName, type CsRarity, type SkinDb, type SkinDef } from '../content/skins/index';
import type { OwnedSkin, Save } from '../core/save';
import type { SkinLook } from '../render/skin-material';

export interface GearItem {
  uid: number;
  weapon: string;
  name: string;
  look: SkinLook;
  stattrak: boolean;
  rarity: CsRarity;
}

export interface Gear {
  gun: GearItem | null;
  knife: GearItem | null;
  gloves: GearItem | null;
  /** Base game weapon id → the pattern it wears. Evolved weapons wear their base weapon's wrap. */
  wraps: Map<string, GearItem>;
}

/** Game weapons whose model shows a pattern: the briefcase, tickets, cups, umbrellas, cans, timetables. */
export const WRAPPABLE = ['teczka', 'bilet', 'kawa', 'parasol', 'puszka', 'rozklad'];

export const noGear = (): Gear => ({ gun: null, knife: null, gloves: null, wraps: new Map() });

export function lookOf(owned: OwnedSkin, def: SkinDef): SkinLook {
  return { finish: def.finish, palette: def.palette, float: owned.float, seed: owned.seed, ...(def.image ? { image: def.image } : {}) };
}

export function itemOf(db: SkinDb, owned: OwnedSkin): GearItem | null {
  const def = db.skins.get(owned.skin);
  if (!def) return null;
  return { uid: owned.uid, weapon: def.weapon, name: fullName(db, def, owned.stattrak), look: lookOf(owned, def), stattrak: owned.stattrak, rarity: def.rarity };
}

export function resolveGear(save: Save, db: SkinDb | null): Gear {
  const gear = noGear();
  if (!db) return gear;
  const find = (uid: number | null): GearItem | null => {
    if (uid === null) return null;
    const owned = save.inventory.find((s) => s.uid === uid);
    return owned ? itemOf(db, owned) : null;
  };
  const gun = find(save.equip.gun);
  if (gun && !isKnife(gun.weapon) && !isGloves(gun.weapon)) gear.gun = gun;
  const knife = find(save.equip.knife);
  if (knife && isKnife(knife.weapon)) gear.knife = knife;
  const gloves = find(save.equip.gloves);
  if (gloves && isGloves(gloves.weapon)) gear.gloves = gloves;
  for (const [weapon, uid] of Object.entries(save.equip.wraps)) {
    const item = find(uid);
    if (item && WRAPPABLE.includes(weapon) && !isGloves(item.weapon)) gear.wraps.set(weapon, item);
  }
  return gear;
}

/** The base weapon of an evolution (teczka-prezesa → teczka), or the weapon itself. */
export function baseWeapon(id: string): string {
  return WEAPONS.find((w) => w.evolution?.into === id)?.id ?? id;
}

/** The weapon key Gnat z CS fires as. */
export const gunKey = (gear: Gear): string => gear.gun?.weapon ?? DEFAULT_GUN;

/** What a game weapon is called with the gear on: "Parasol (AWP | Asiimov)", "★ Karambit | Fade". */
export function gearName(gear: Gear, id: string, name: string): string {
  const base = baseWeapon(id);
  // The knife replaces the briefcase; its evolution keeps its own name next to the knife's.
  if (base === 'teczka' && gear.knife) return id === 'teczka' ? gear.knife.name : `${name} (${gear.knife.name})`;
  if (id === 'gnat' && gear.gun) return `${name} (${gear.gun.name})`;
  const wrap = gear.wraps.get(base);
  return wrap ? `${name} (${wrap.name})` : name;
}

/** Where a skin is worn: 'gun', 'knife', 'gloves', a wrapped weapon id, or null. */
export function wornAs(save: Save, uid: number): string | null {
  if (save.equip.gun === uid) return 'gun';
  if (save.equip.knife === uid) return 'knife';
  if (save.equip.gloves === uid) return 'gloves';
  for (const [weapon, u] of Object.entries(save.equip.wraps)) if (u === uid) return weapon;
  return null;
}

export const isWorn = (save: Save, uid: number): boolean => wornAs(save, uid) !== null;

/** The full CS name of an owned skin: "★ StatTrak™ Karambit | Fade", "StatTrak™ AK-47 | Redline". */
export function fullName(db: SkinDb, def: SkinDef, stattrak: boolean): string {
  const name = skinName(db, def);
  if (!stattrak) return name;
  return name.startsWith('★ ') ? `★ StatTrak™ ${name.slice(2)}` : `StatTrak™ ${name}`;
}

/** Pictogram of Gnat z CS for the gun's class (null: the plain pistol). */
export function gunIcon(gear: Gear): string | null {
  switch ((CS_WEAPONS[gunKey(gear)] as (typeof CS_WEAPONS)[string] | undefined)?.class) {
    case 'smg':
      return 'gnat-smg';
    case 'rifle':
    case 'scopedRifle':
      return 'gnat-rifle';
    case 'sniper':
    case 'autoSniper':
      return 'gnat-sniper';
    case 'shotgun':
      return 'gnat-shotgun';
    case 'lmg':
      return 'gnat-lmg';
    default:
      return null;
  }
}

/** The equipped item that counts StatTrak™ kills for a game weapon, if any. */
export function stattrakFor(gear: Gear, id: string): GearItem | null {
  const base = baseWeapon(id);
  const item = id === 'gnat' ? gear.gun : base === 'teczka' && gear.knife ? gear.knife : (gear.wraps.get(base) ?? null);
  return item?.stattrak ? item : null;
}
