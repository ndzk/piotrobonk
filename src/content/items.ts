// Weapons and passives offered on level-up cards. Numbers per level are increments over the previous level;
// card rarity multiplies the numeric increments (not counts).

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { name: string; color: string; icon: string }> = {
  common: { name: 'Zwykła', color: '#b8c0cc', icon: '●' },
  rare: { name: 'Rzadka', color: '#4b9bff', icon: '▲' },
  epic: { name: 'Epicka', color: '#b56cff', icon: '◆' },
  legendary: { name: 'Legendarna', color: '#ffb020', icon: '★' },
};

/** Every weapon uses a subset of these; the rest stay 0. Areas, durations and counts get the player's bonuses. */
export interface WeaponStats {
  damage: number;
  /** Seconds between attacks (for auras and orbitals: between hits on the same enemy), before haste. */
  cooldown: number;
  /**
   * Attack speed from the weapon's own levels (+0,2 = 20 % more attacks). Added to the passives' and the gun's,
   * and the sum is capped once (TUNING.limits.minCooldown): levels used to multiply under the cap.
   */
  haste: number;
  /** Reach: swing radius, throw distance, aura or orbit radius, targeting radius. */
  range: number;
  /** Radius of an explosion, puddle, strike or projectile hitbox. */
  area: number;
  /** Swing or cone width in radians. */
  arc: number;
  knockback: number;
  /** Swings, projectiles, orbitals, strikes or bolts per attack. */
  count: number;
  /** Projectile speed (m/s) or orbit speed (rad/s). */
  speed: number;
  /** Seconds a puddle or stun lasts. */
  duration: number;
  /** Enemies a projectile passes through; -1 = all. */
  pierce: number;
  /** Extra jumps of a chain. */
  chains: number;
}

export type WeaponKind = 'swing' | 'boomerang' | 'puddle' | 'aura' | 'chain' | 'orbit' | 'cone' | 'lob' | 'gun' | 'strike' | 'line';

/** Special behaviour of evolved weapons. */
export type WeaponPerk = 'shockwave' | 'magnet' | 'slow' | 'lifesteal' | 'stun' | 'vulnerable' | 'cluster' | 'arc' | 'fan';

export interface WeaponLevel {
  add: Partial<WeaponStats>;
  /** Multipliers applied after adds (cooldown 0.88 = 12% faster). */
  mul?: Partial<WeaponStats>;
  /** Card line for count changes and special upgrades. */
  text: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  description: string;
  kind: WeaponKind;
  base: Partial<WeaponStats>;
  levels: WeaponLevel[];
  /** Weapons whose effects last over time; Termos is only offered when one of these is owned. */
  usesDuration?: boolean;
  perks?: WeaponPerk[];
  /** Evolution: max level of this weapon + the passive + a chest. */
  evolution?: { into: string; passive: string };
  /** Evolved weapons never appear on level-up cards. */
  evolved?: boolean;
  /** Colour of its effects. */
  color: string;
  /** Hard limits of its own, where the common ones (TUNING.limits.weapon) do not fit. */
  limits?: Partial<WeaponLimits>;
}

/**
 * What no build may take a weapon past (BALANCE.md): attacks per volley (projectiles, orbitals, strikes, bolts),
 * the radius of an aura or orbit, the radius of a blast or puddle, and the shortest time between attacks.
 */
export interface WeaponLimits {
  count: number;
  reach: number;
  area: number;
  seconds: number;
}

/** Card lines for weapon upgrades; {v} is the value already scaled by rarity. */
export const WEAPON_LINES = {
  damage: 'Obrażenia {a} → {b}',
  range: '+{v} m zasięgu',
  area: '+{v} m promienia',
  arc: '+{v}° szerokości',
  knockback: '+{v} odrzutu',
  speed: '+{v} prędkości',
  duration: '+{v} s działania',
  pierce: '+{v} {przebicie|przebicia|przebić}',
  chains: '+{v} {przeskok|przeskoki|przeskoków}',
  cooldown: 'Ataki o {v}% częściej',
  newWeapon: 'Nowa broń',
};

export const WEAPONS: WeaponDef[] = [
  {
    id: 'teczka',
    name: 'Teczka z Pracy',
    description: 'Zamach teczką w łuku przed siebie. Raport kwartalny jeszcze nikogo nie oszczędził.',
    kind: 'swing',
    color: '#fff1b8',
    base: { damage: 22, cooldown: 1.04, range: 3.6, arc: 2.6, knockback: 6.5, count: 1 },
    levels: [
      { add: { damage: 7 }, text: '' },
      { add: { range: 0.5 }, text: '' },
      { add: { count: 1 }, text: 'Drugi zamach do tyłu' },
      { add: { damage: 8, knockback: 2 }, text: '' },
      { add: {}, mul: { cooldown: 0.84 }, text: '' },
      { add: { range: 0.6, arc: 0.4 }, text: '' },
      { add: { damage: 14 }, text: '' },
    ],
    evolution: { into: 'teczka-prezesa', passive: 'okulary' },
  },
  {
    id: 'bilet',
    name: 'Bilet Miesięczny',
    description: 'Leci, tnie i wraca jak bumerang. Ważny do końca miesiąca, czyli dłużej niż tory.',
    kind: 'boomerang',
    color: '#9fd8ff',
    base: { damage: 8, cooldown: 1.69, range: 11, area: 0.7, speed: 14, count: 1, pierce: -1, knockback: 3 },
    levels: [
      { add: { damage: 3 }, text: '' },
      { add: { count: 1 }, text: '+1 bilet' },
      { add: { range: 2, speed: 3 }, text: '' },
      { add: { damage: 3 }, text: '' },
      { add: { damage: 4 }, text: '' },
      { add: {}, mul: { cooldown: 0.86 }, text: '' },
      { add: { damage: 4 }, text: '' },
    ],
    evolution: { into: 'bilet-sieciowy', passive: 'nerka' },
  },
  {
    id: 'kawa',
    name: 'Kawa z Automatu',
    description: 'Rzucona pod nogi wrogów parzy wszystko wokół, gołębie też, i zostawia parzącą kałużę. Smakuje tak samo.',
    kind: 'puddle',
    color: '#8a5a32',
    usesDuration: true,
    base: { damage: 4, cooldown: 2.99, range: 10, area: 1.8, duration: 2.8, count: 1 },
    levels: [
      { add: { count: 1 }, text: '+1 kubek' },
      { add: { area: 0.35 }, text: '' },
      { add: { damage: 3 }, text: '' },
      { add: { duration: 0.8 }, text: '' },
      { add: { duration: 0.6 }, text: '' },
      { add: { area: 0.35 }, text: '' },
      { add: { damage: 3 }, text: '' },
    ],
    evolution: { into: 'espresso', passive: 'termos' },
  },
  {
    id: 'sos',
    name: 'Sos Czosnkowy',
    description: 'Aura, od której więdną gołębie. Czuć ją aż na Widzewie.',
    kind: 'aura',
    color: '#f4f0d8',
    base: { damage: 13, cooldown: 0.45, range: 4.8, knockback: 2 },
    levels: [
      { add: { range: 0.5 }, text: '' },
      { add: { damage: 3 }, text: '' },
      { add: {}, mul: { cooldown: 0.86 }, text: '' },
      { add: { range: 0.5 }, text: '' },
      { add: { damage: 3 }, text: '' },
      { add: { knockback: 2, range: 0.4 }, text: '' },
      { add: { damage: 4 }, text: '' },
    ],
    evolution: { into: 'kebab', passive: 'kurtka' },
  },
  {
    id: 'telefon',
    name: 'Telefon na 2%',
    description: 'Ostatnie procenty baterii idą w łańcuch piorunów. Potem i tak padnie.',
    kind: 'chain',
    color: '#8fe8ff',
    base: { damage: 17, cooldown: 1.49, range: 9, area: 4.5, chains: 3, count: 1 },
    levels: [
      { add: { chains: 1 }, text: '' },
      { add: { damage: 8 }, text: '' },
      { add: {}, mul: { cooldown: 0.78 }, text: '' },
      { add: { chains: 1 }, text: '' },
      { add: { damage: 12 }, text: '' },
      { add: { count: 1 }, text: '+1 piorun' },
      { add: { chains: 1, damage: 8 }, text: '' },
    ],
    evolution: { into: 'powerbank', passive: 'energetyk' },
  },
  {
    id: 'parasol',
    name: 'Parasol',
    description: 'Kręci się wokół i wali wszystko, co podejdzie. Od deszczu nie chroni.',
    kind: 'orbit',
    color: '#d94a4a',
    base: { damage: 18, cooldown: 0.59, range: 4.6, area: 0.75, speed: 3.4, count: 2, knockback: 4 },
    levels: [
      { add: { count: 1 }, text: '+1 parasol' },
      { add: { damage: 4 }, text: '' },
      { add: { speed: 1, area: 0.2 }, text: '' },
      { add: { count: 1 }, text: '+1 parasol' },
      { add: { range: 0.6 }, text: '' },
      { add: { damage: 6 }, text: '' },
      { add: { damage: 5 }, text: '' },
    ],
    evolution: { into: 'parasol-burzowy', passive: 'klapki' },
  },
  {
    id: 'gwizdek',
    name: 'Gwizdek Konduktora',
    description: 'Jeden gwizd i cały stożek wrogów stoi jak pociąg pod semaforem.',
    kind: 'cone',
    color: '#ffe066',
    usesDuration: true,
    base: { damage: 37, cooldown: 2.47, range: 5.5, arc: 1.4, duration: 1, knockback: 5, count: 1 },
    levels: [
      { add: { range: 1, damage: 5 }, text: '' },
      { add: { duration: 0.4 }, text: '' },
      { add: { arc: 0.4, damage: 7 }, text: '' },
      { add: { damage: 12 }, text: '' },
      { add: {}, mul: { cooldown: 0.8 }, text: '' },
      { add: { range: 1.5, damage: 8 }, text: '' },
      { add: { count: 1 }, text: 'Gwizd też do tyłu' },
    ],
    evolution: { into: 'kontrola', passive: 'zdrapka' },
  },
  {
    id: 'puszka',
    name: 'Puszka',
    description: 'Rzut łukiem, potem wybuch. Kaucja przepada.',
    kind: 'lob',
    color: '#c9d2dc',
    base: { damage: 14, cooldown: 2.86, range: 11, area: 2.2, count: 1, knockback: 7, speed: 1 },
    levels: [
      { add: { damage: 6 }, text: '' },
      { add: { count: 1 }, text: '+1 puszka' },
      { add: { area: 0.6 }, text: '' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { damage: 7 }, text: '' },
      { add: { damage: 5 }, text: '' },
      { add: { area: 0.8 }, text: '' },
    ],
    evolution: { into: 'zgrzewka', passive: 'kanapka' },
  },
  {
    id: 'gnat',
    name: 'Gnat z CS',
    description: 'Strzela sam w najbliższego, zero celowania. Jak strzela, zależy od skina z recyklomatu.',
    kind: 'gun',
    color: '#ffd27a',
    base: { damage: 16, cooldown: 0.6, range: 13, area: 0.35, speed: 42, count: 1, pierce: 1, knockback: 1.5 },
    levels: [
      { add: { damage: 4 }, text: '' },
      { add: {}, mul: { cooldown: 0.88 }, text: '' },
      { add: { pierce: 1, damage: 5 }, text: '' },
      { add: { damage: 4 }, text: '' },
      { add: { count: 1 }, text: 'Strzał podwójny' },
      { add: {}, mul: { cooldown: 0.88 }, text: '' },
      { add: { damage: 7, pierce: 1 }, text: '' },
    ],
  },
  {
    id: 'iskra',
    name: 'Iskra z Trakcji',
    description: 'Sieć trakcyjna bez pociągów nudzi się i wali w losowych wrogów.',
    kind: 'strike',
    color: '#b8e4ff',
    base: { damage: 16, cooldown: 2.6, range: 11, area: 1.7, count: 2 },
    levels: [
      { add: { count: 1 }, text: '+1 iskra' },
      { add: { damage: 5 }, text: '' },
      { add: { area: 0.4 }, text: '' },
      { add: { damage: 4 }, text: '' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { damage: 5 }, text: '' },
      { add: { area: 0.3 }, text: '' },
    ],
    evolution: { into: 'siec-trakcyjna', passive: 'bilet-ulgowy' },
  },
  {
    id: 'rozklad',
    name: 'Rozkład Jazdy',
    description: 'Kartki z rozkładem lecą w najbliższego wroga i przecinają wszystko po drodze. Rozkład i tak nieaktualny.',
    kind: 'line',
    color: '#ffffff',
    base: { damage: 19, cooldown: 1.17, range: 13, area: 0.5, speed: 18, count: 1, pierce: 2 },
    levels: [
      { add: { count: 1 }, text: '+1 kartka' },
      { add: { pierce: 2 }, text: '' },
      { add: { damage: 10 }, text: '' },
      { add: { count: 1 }, text: '+1 kartka' },
      { add: { speed: 6, damage: 7 }, text: '' },
      { add: { pierce: 3, damage: 12 }, text: '' },
      { add: { count: 1 }, text: '+1 kartka' },
    ],
    evolution: { into: 'rozklad-2027', passive: 'tabela' },
  },
  // ---------- Evolutions ----------
  {
    id: 'teczka-prezesa',
    name: 'Teczka Prezesa',
    description: 'Skóra, złote okucia i premia kwartalna. Zamach dookoła i fala uderzeniowa.',
    kind: 'swing',
    color: '#ffd23a',
    evolved: true,
    perks: ['shockwave'],
    base: { damage: 94, cooldown: 0.91, range: 4.4, arc: Math.PI, knockback: 11, count: 2 },
    levels: [],
  },
  {
    id: 'bilet-sieciowy',
    name: 'Bilet Sieciowy',
    description: 'Ważny na całą sieć. Trzy bilety i każdy po drodze zgarnia monety.',
    kind: 'boomerang',
    color: '#5ad1ff',
    evolved: true,
    perks: ['magnet'],
    base: { damage: 51, cooldown: 1.37, range: 13, area: 1.05, speed: 17, count: 3, pierce: -1, knockback: 4 },
    levels: [],
  },
  {
    id: 'espresso',
    name: 'Espresso z Fabrycznej',
    description: 'Gęste jak smoła. Kałuże parzą mocniej, trzymają dłużej i spowalniają.',
    kind: 'puddle',
    color: '#9c5a1f',
    evolved: true,
    usesDuration: true,
    perks: ['slow'],
    base: { damage: 12, cooldown: 2.08, range: 11, area: 2.5, duration: 4.5, count: 4 },
    levels: [],
  },
  {
    id: 'kebab',
    name: 'Kebab XXL na grubym',
    description: 'Ostry, łagodny i czosnkowy naraz. Ogromna aura, a każde zabójstwo trochę leczy.',
    kind: 'aura',
    color: '#ffe9b0',
    evolved: true,
    perks: ['lifesteal'],
    base: { damage: 53, cooldown: 0.39, range: 6.5, knockback: 4 },
    levels: [],
  },
  {
    id: 'powerbank',
    name: 'Powerbank 20 000 mAh',
    description: 'Telefon już nigdy nie padnie. Wrogowie tak: pioruny skaczą wszędzie i ogłuszają.',
    kind: 'chain',
    color: '#5af0ff',
    evolved: true,
    perks: ['stun'],
    base: { damage: 78, cooldown: 0.78, range: 12, area: 5.5, chains: 5, count: 2, duration: 0.6 },
    levels: [],
  },
  {
    id: 'parasol-burzowy',
    name: 'Parasol Burzowy',
    description: 'Cztery parasole w wichurze. Odrzuca i spowalnia wszystko dookoła.',
    kind: 'orbit',
    color: '#ff5a5a',
    evolved: true,
    perks: ['slow'],
    base: { damage: 85, cooldown: 0.47, range: 5, area: 1.05, speed: 5, count: 4, knockback: 8 },
    levels: [],
  },
  {
    id: 'kontrola',
    name: 'Kontrola Biletów',
    description: 'Szeroki gwizd i długi postój. Ogłuszeni wrogowie dostają półtora raza mocniej.',
    kind: 'cone',
    color: '#ffd000',
    evolved: true,
    usesDuration: true,
    perks: ['vulnerable'],
    base: { damage: 119, cooldown: 1.95, range: 10, arc: 2.4, duration: 2.4, knockback: 6, count: 2 },
    levels: [],
  },
  {
    id: 'zgrzewka',
    name: 'Zgrzewka z Biedronki',
    description: 'Cztery puszki naraz, w promocji. Dywan wybuchów.',
    kind: 'lob',
    color: '#e8eef4',
    evolved: true,
    perks: ['cluster'],
    base: { damage: 56, cooldown: 2.34, range: 12, area: 2.8, count: 4, knockback: 9, speed: 1 },
    levels: [],
  },
  {
    id: 'siec-trakcyjna',
    name: 'Sieć Trakcyjna 3 kV',
    description: 'Cała linia pod napięciem. Pięć iskier, a każda przeskakuje dalej.',
    kind: 'strike',
    color: '#7fd4ff',
    evolved: true,
    perks: ['arc'],
    base: { damage: 41, cooldown: 2.08, range: 12, area: 2.2, count: 5, chains: 2 },
    levels: [],
  },
  {
    id: 'rozklad-2027',
    name: 'Rozkład Jazdy 2026/27',
    description: 'Wszystkie kursy odwołane naraz. Kartki lecą na wszystkie strony i przebijają wszystko.',
    kind: 'line',
    color: '#ff6b6b',
    evolved: true,
    perks: ['fan'],
    base: { damage: 53, cooldown: 0.98, range: 14, area: 0.6, speed: 22, count: 4, pierce: -1 },
    levels: [],
  },
];

export type PassiveStat = 'magnet' | 'haste' | 'speed' | 'armor' | 'luck' | 'duration' | 'area' | 'regen' | 'amount' | 'growth' | 'might' | 'maxHp';

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
  { id: 'kanapka', name: 'Kanapka od Mamy', description: 'Z masłem i miłością. Powolna regeneracja zdrowia.', stat: 'regen', perLevel: 0.1, maxLevel: 5, text: '+{v} HP/s', percent: false },
  { id: 'bilet-ulgowy', name: 'Bilet Ulgowy', description: 'Pięćdziesiąt procent zniżki, sto procent więcej pocisków.', stat: 'amount', perLevel: 1, maxLevel: 2, text: '+{v} {pocisk|pociski|pocisków} do każdej broni', percent: false },
  { id: 'tabela', name: 'Tabela Kursów', description: 'Kto zna rozkład, ten szybciej się uczy. Więcej doświadczenia.', stat: 'growth', perLevel: 0.08, maxLevel: 5, text: '+{v}% doświadczenia', percent: true },
];

/** Coffee machines on the map: stand next to one until it brews, get a random buff for the rest of the run. */
export interface CoffeeBuff {
  id: string;
  name: string;
  stat: PassiveStat;
  value: number;
  text: string;
  percent: boolean;
}

export const COFFEE: CoffeeBuff[] = [
  { id: 'latte', name: 'Latte z pianką', stat: 'might', value: 0.15, text: '+{v}% obrażeń', percent: true },
  { id: 'czarna', name: 'Czarna bez cukru', stat: 'haste', value: 0.12, text: '+{v}% szybkości ataku', percent: true },
  { id: 'cappuccino', name: 'Cappuccino', stat: 'maxHp', value: 25, text: '+{v} maks. HP', percent: false },
  { id: 'doppio', name: 'Espresso doppio', stat: 'speed', value: 0.1, text: '+{v}% prędkości', percent: true },
  { id: 'mokka', name: 'Mokka', stat: 'luck', value: 0.15, text: '+{v}% szczęścia', percent: true },
  { id: 'inka', name: 'Kawa zbożowa Inka', stat: 'regen', value: 0.25, text: '+{v} HP/s', percent: false },
  { id: 'flat', name: 'Flat white', stat: 'area', value: 0.1, text: '+{v}% obszaru', percent: true },
  { id: 'zimna', name: 'Zimna kawa z automatu', stat: 'growth', value: 0.2, text: '+{v}% doświadczenia', percent: true },
];

/** Deposit bottles and cans: the run currency (and the hub currency later). One bottle is 0,50 zł. */
export const BOTTLES = {
  deposit: 0.5,
  enemyChance: 0.035,
  eliteDrop: 6,
  bin: [3, 6] as const,
  chestBase: 8,
  chestStep: 5,
};

/** Food from bins. */
export const FOOD = { id: 'paczek', name: 'Pączek z Biedronki', heal: 25, chance: 0.15, elite: 12 };

/** Offered when nothing else can be upgraded. */
export const FALLBACK_CARD = { id: 'zapiekanka', name: 'Zapiekanka z Dworca', description: 'Ciepła, z keczupem. Leczy.', heal: 6, text: '+{v} HP' };

/** What an evolution's perk actually does, shown on the evolution card. */
export const PERK_TEXT: Record<WeaponPerk, string> = {
  shockwave: 'Każdy zamach wysyła falę uderzeniową.',
  magnet: 'Zgarnia monety i butelki po drodze.',
  slow: 'Spowalnia trafionych wrogów.',
  lifesteal: 'Każde zabójstwo leczy.',
  stun: 'Ogłusza trafionych wrogów.',
  vulnerable: 'Oznaczeni wrogowie dostają półtora raza więcej.',
  cluster: 'Wybuch rozrzuca mniejsze ładunki.',
  arc: 'Uderzenia przeskakują łukiem dalej.',
  fan: 'Kartki lecą na wszystkie strony.',
};
