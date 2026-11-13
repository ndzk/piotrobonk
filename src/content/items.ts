// Weapons and passives offered on level-up cards. Numbers per level are increments over the previous level;
// card rarity multiplies the numeric increments (not counts).

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { name: string; color: string; icon: string }> = {
  common: { name: 'Zwykła', color: '#b8c0cc', icon: '●' },
  rare: { name: 'Rzadka', color: '#4b9bff', icon: '▲' },
  epic: { name: 'Epicka', color: '#b56cff', icon: '◆' },
  legendary: { name: 'Legendarna', color: '#ffb020', icon: '★' },
};

export interface WeaponStats {
  damage: number;
  cooldown: number;
  /** Reach in metres. */
  range: number;
  /** Swing arc in radians. */
  arc: number;
  knockback: number;
  /** Swings per attack (2 = front and back). */
  count: number;
}

export interface WeaponLevel {
  add: Partial<WeaponStats>;
  /** Multipliers applied after adds (cooldown 0.88 = 12% faster). */
  mul?: Partial<WeaponStats>;
  text: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  base: WeaponStats;
  levels: WeaponLevel[];
  /** Weapons whose effects last over time; Termos is only offered when one of these is owned. */
  usesDuration?: boolean;
}

/** Card lines for weapon upgrades; {v} is the value already scaled by rarity. */
export const WEAPON_LINES = {
  damage: '+{v} obrażeń',
  range: '+{v} m zasięgu',
  arc: '+{v}° łuku',
  knockback: '+{v} odrzutu',
  cooldown: 'Ataki o {v}% częściej',
  newWeapon: 'Nowa broń',
};

export const WEAPONS: WeaponDef[] = [
  {
    id: 'teczka',
    name: 'Teczka z Pracy',
    description: 'Zamach teczką w łuku przed siebie. Raport kwartalny jeszcze nikogo nie oszczędził.',
    base: { damage: 15, cooldown: 0.9, range: 3.0, arc: 2.6, knockback: 6.5, count: 1 },
    levels: [
      { add: { damage: 5 }, text: '+5 obrażeń' },
      { add: { range: 0.45 }, text: '+0,45 m zasięgu' },
      { add: { count: 1 }, text: 'Drugi zamach do tyłu' },
      { add: { damage: 6, knockback: 2 }, text: '+6 obrażeń, mocniej odrzuca' },
      { add: {}, mul: { cooldown: 0.86 }, text: 'Zamach o 14% częściej' },
      { add: { range: 0.55, arc: 0.4 }, text: '+0,55 m zasięgu, szerszy łuk' },
      { add: { damage: 12 }, text: '+12 obrażeń' },
    ],
  },
];

export type PassiveStat = 'magnet' | 'haste' | 'speed' | 'armor' | 'luck' | 'duration' | 'area' | 'regen';

export interface PassiveDef {
  id: string;
  name: string;
  description: string;
  stat: PassiveStat;
  perLevel: number;
  maxLevel: number;
  /** Card line; {v} is the per-level bonus scaled by rarity, shown as a percentage when `percent`. */
  text: string;
  percent: boolean;
}

export const PASSIVES: PassiveDef[] = [
  { id: 'nerka', name: 'Nerka', description: 'Wszystko wpada do nerki. Większy zasięg zbierania.', stat: 'magnet', perLevel: 0.3, maxLevel: 5, text: '+{v}% zasięgu zbierania', percent: true },
  { id: 'energetyk', name: 'Energetyk', description: 'Puszka o 6:40 i świat zwalnia. Bronie atakują szybciej.', stat: 'haste', perLevel: 0.08, maxLevel: 5, text: '+{v}% szybkości ataku', percent: true },
  { id: 'klapki', name: 'Klapki', description: 'Kubota daje skrzydła. Szybsze bieganie.', stat: 'speed', perLevel: 0.07, maxLevel: 5, text: '+{v}% prędkości', percent: true },
  { id: 'kurtka', name: 'Kurtka z Lumpeksu', description: 'Na wagę, ale gruba. Każde trafienie boli mniej.', stat: 'armor', perLevel: 0.07, maxLevel: 5, text: '−{v}% otrzymywanych obrażeń', percent: true },
  { id: 'zdrapka', name: 'Zdrapka', description: 'Tym razem na pewno. Lepsze karty i więcej krytyków.', stat: 'luck', perLevel: 0.12, maxLevel: 5, text: '+{v}% szczęścia', percent: true },
  { id: 'termos', name: 'Termos', description: 'Herbata z cytryną trzyma ciepło do Koluszek. Efekty trwają dłużej.', stat: 'duration', perLevel: 0.1, maxLevel: 5, text: '+{v}% czasu trwania', percent: true },
  { id: 'okulary', name: 'Okulary', description: 'Teraz widać więcej gołębi. Większy obszar ataków.', stat: 'area', perLevel: 0.08, maxLevel: 5, text: '+{v}% obszaru', percent: true },
  { id: 'kanapka', name: 'Kanapka od Mamy', description: 'Z masłem i miłością. Powolna regeneracja zdrowia.', stat: 'regen', perLevel: 0.35, maxLevel: 5, text: '+{v} HP/s', percent: false },
];

/** Armour (a fraction of damage blocked) never goes above this. */
export const ARMOR_CAP = 0.6;

/** Offered when nothing else can be upgraded. */
export const FALLBACK_CARD = { id: 'zapiekanka', name: 'Zapiekanka z Dworca', description: 'Ciepła, z keczupem. Leczy.', heal: 30, text: '+{v} HP' };
