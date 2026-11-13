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
  /** Seconds between attacks (for auras and orbitals: between hits on the same enemy). */
  cooldown: number;
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
}

/** Card lines for weapon upgrades; {v} is the value already scaled by rarity. */
export const WEAPON_LINES = {
  damage: '+{v} obrażeń',
  range: '+{v} m zasięgu',
  area: '+{v} m promienia',
  arc: '+{v}° szerokości',
  knockback: '+{v} odrzutu',
  speed: '+{v} prędkości',
  duration: '+{v} s działania',
  pierce: '+{v} przebicia',
  chains: '+{v} przeskoku',
  cooldown: 'Ataki o {v}% częściej',
  newWeapon: 'Nowa broń',
  evolved: 'Ewolucja',
};

export const WEAPONS: WeaponDef[] = [
  {
    id: 'teczka',
    name: 'Teczka z Pracy',
    description: 'Zamach teczką w łuku przed siebie. Raport kwartalny jeszcze nikogo nie oszczędził.',
    kind: 'swing',
    color: '#fff1b8',
    base: { damage: 15, cooldown: 0.9, range: 3.0, arc: 2.6, knockback: 6.5, count: 1 },
    levels: [
      { add: { damage: 5 }, text: '' },
      { add: { range: 0.45 }, text: '' },
      { add: { count: 1 }, text: 'Drugi zamach do tyłu' },
      { add: { damage: 6, knockback: 2 }, text: '' },
      { add: {}, mul: { cooldown: 0.86 }, text: '' },
      { add: { range: 0.55, arc: 0.4 }, text: '' },
      { add: { damage: 12 }, text: '' },
    ],
    evolution: { into: 'teczka-prezesa', passive: 'okulary' },
  },
  {
    id: 'bilet',
    name: 'Bilet Miesięczny',
    description: 'Leci, tnie i wraca jak bumerang. Ważny do końca miesiąca, czyli dłużej niż tory.',
    kind: 'boomerang',
    color: '#9fd8ff',
    base: { damage: 11, cooldown: 1.6, range: 9, area: 0.6, speed: 14, count: 1, pierce: -1, knockback: 3 },
    levels: [
      { add: { damage: 4 }, text: '' },
      { add: { count: 1 }, text: '+1 bilet' },
      { add: { range: 2, speed: 3 }, text: '' },
      { add: { damage: 5 }, text: '' },
      { add: { count: 1 }, text: '+1 bilet' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { damage: 8 }, text: '' },
    ],
    evolution: { into: 'bilet-sieciowy', passive: 'nerka' },
  },
  {
    id: 'kawa',
    name: 'Kawa z Automatu',
    description: 'Rzucona pod nogi wrogów zostawia parzącą kałużę. Smakuje tak samo.',
    kind: 'puddle',
    color: '#8a5a32',
    usesDuration: true,
    base: { damage: 6, cooldown: 2.4, range: 7, area: 1.6, duration: 3, count: 1 },
    levels: [
      { add: { count: 1 }, text: '+1 kubek' },
      { add: { area: 0.4 }, text: '' },
      { add: { damage: 3 }, text: '' },
      { add: { duration: 1 }, text: '' },
      { add: { count: 1 }, text: '+1 kubek' },
      { add: { area: 0.4 }, text: '' },
      { add: { damage: 4 }, text: '' },
    ],
    evolution: { into: 'espresso', passive: 'termos' },
  },
  {
    id: 'sos',
    name: 'Sos Czosnkowy',
    description: 'Aura, od której więdną gołębie. Czuć ją aż na Widzewie.',
    kind: 'aura',
    color: '#f4f0d8',
    base: { damage: 5, cooldown: 0.45, range: 2.2, knockback: 2 },
    levels: [
      { add: { range: 0.4 }, text: '' },
      { add: { damage: 2 }, text: '' },
      { add: {}, mul: { cooldown: 0.88 }, text: '' },
      { add: { range: 0.4 }, text: '' },
      { add: { damage: 3 }, text: '' },
      { add: { knockback: 2, range: 0.3 }, text: '' },
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
    base: { damage: 16, cooldown: 1.5, range: 9, area: 4, chains: 2, count: 1 },
    levels: [
      { add: { chains: 1 }, text: '' },
      { add: { damage: 6 }, text: '' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { chains: 1 }, text: '' },
      { add: { damage: 8 }, text: '' },
      { add: { count: 1 }, text: '+1 piorun' },
      { add: { chains: 2 }, text: '' },
    ],
    evolution: { into: 'powerbank', passive: 'energetyk' },
  },
  {
    id: 'parasol',
    name: 'Parasol',
    description: 'Kręci się wokół i wali wszystko, co podejdzie. Od deszczu nie chroni.',
    kind: 'orbit',
    color: '#d94a4a',
    base: { damage: 9, cooldown: 0.5, range: 2.1, area: 0.55, speed: 3.2, count: 1, knockback: 4 },
    levels: [
      { add: { count: 1 }, text: '+1 parasol' },
      { add: { damage: 4 }, text: '' },
      { add: { speed: 1, area: 0.15 }, text: '' },
      { add: { count: 1 }, text: '+1 parasol' },
      { add: { range: 0.4 }, text: '' },
      { add: { damage: 6 }, text: '' },
      { add: { count: 1 }, text: '+1 parasol' },
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
    base: { damage: 6, cooldown: 3.2, range: 5, arc: 1.1, duration: 1, knockback: 5, count: 1 },
    levels: [
      { add: { range: 1 }, text: '' },
      { add: { duration: 0.4 }, text: '' },
      { add: { arc: 0.4 }, text: '' },
      { add: { damage: 6 }, text: '' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { range: 1.5 }, text: '' },
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
    base: { damage: 22, cooldown: 2.2, range: 9, area: 2.2, count: 1, knockback: 7, speed: 1 },
    levels: [
      { add: { damage: 8 }, text: '' },
      { add: { count: 1 }, text: '+1 puszka' },
      { add: { area: 0.6 }, text: '' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { damage: 10 }, text: '' },
      { add: { count: 1 }, text: '+1 puszka' },
      { add: { area: 0.8 }, text: '' },
    ],
    evolution: { into: 'zgrzewka', passive: 'kanapka' },
  },
  {
    id: 'gnat',
    name: 'Gnat z CS',
    description: 'Strzela sam. Model i zachowanie zależą od założonego skina; bez skina to zwykły Glock.',
    kind: 'gun',
    color: '#ffd27a',
    base: { damage: 9, cooldown: 0.38, range: 16, area: 0.3, speed: 42, count: 1, pierce: 0, knockback: 1.5 },
    levels: [
      { add: { damage: 3 }, text: '' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { pierce: 1 }, text: '' },
      { add: { damage: 4 }, text: '' },
      { add: { count: 1 }, text: 'Strzał podwójny' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { damage: 6, pierce: 1 }, text: '' },
    ],
  },
  {
    id: 'iskra',
    name: 'Iskra z Trakcji',
    description: 'Sieć trakcyjna bez pociągów nudzi się i wali w losowych wrogów.',
    kind: 'strike',
    color: '#b8e4ff',
    base: { damage: 20, cooldown: 2, range: 12, area: 1.6, count: 2 },
    levels: [
      { add: { count: 1 }, text: '+1 iskra' },
      { add: { damage: 8 }, text: '' },
      { add: { area: 0.4 }, text: '' },
      { add: { count: 1 }, text: '+1 iskra' },
      { add: {}, mul: { cooldown: 0.85 }, text: '' },
      { add: { damage: 10 }, text: '' },
      { add: { count: 2 }, text: '+2 iskry' },
    ],
    evolution: { into: 'siec-trakcyjna', passive: 'bilet-ulgowy' },
  },
  {
    id: 'rozklad',
    name: 'Rozkład Jazdy',
    description: 'Kartki z rozkładem lecą w kierunku biegu i przecinają wszystko. Rozkład i tak nieaktualny.',
    kind: 'line',
    color: '#ffffff',
    base: { damage: 10, cooldown: 1.1, range: 14, area: 0.4, speed: 18, count: 1, pierce: 2 },
    levels: [
      { add: { count: 1 }, text: '+1 kartka' },
      { add: { pierce: 2 }, text: '' },
      { add: { damage: 5 }, text: '' },
      { add: { count: 1 }, text: '+1 kartka' },
      { add: { speed: 6 }, text: '' },
      { add: { pierce: 3, damage: 5 }, text: '' },
      { add: { count: 2 }, text: '+2 kartki' },
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
    base: { damage: 48, cooldown: 0.75, range: 4.4, arc: Math.PI, knockback: 11, count: 2 },
    levels: [],
  },
  {
    id: 'bilet-sieciowy',
    name: 'Bilet Sieciowy',
    description: 'Ważny na całą sieć. Cztery bilety i każdy po drodze zgarnia monety.',
    kind: 'boomerang',
    color: '#5ad1ff',
    evolved: true,
    perks: ['magnet'],
    base: { damage: 30, cooldown: 1.2, range: 12, area: 0.95, speed: 17, count: 4, pierce: -1, knockback: 4 },
    levels: [],
  },
  {
    id: 'espresso',
    name: 'Espresso z Fabrycznej',
    description: 'Gęste jak smoła. Kałuże parzą mocniej, trzymają dłużej i spowalniają.',
    kind: 'puddle',
    color: '#4a2c16',
    evolved: true,
    usesDuration: true,
    perks: ['slow'],
    base: { damage: 14, cooldown: 1.8, range: 8, area: 2.6, duration: 5, count: 4 },
    levels: [],
  },
  {
    id: 'kebab',
    name: 'Kebab XXL Na Grubym',
    description: 'Ostry, łagodny i czosnkowy naraz. Ogromna aura, a każde zabójstwo trochę leczy.',
    kind: 'aura',
    color: '#ffe9b0',
    evolved: true,
    perks: ['lifesteal'],
    base: { damage: 14, cooldown: 0.35, range: 4, knockback: 4 },
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
    base: { damage: 38, cooldown: 0.7, range: 11, area: 5, chains: 8, count: 2, duration: 0.4 },
    levels: [],
  },
  {
    id: 'parasol-burzowy',
    name: 'Parasol Burzowy',
    description: 'Pięć parasoli w wichurze. Odrzuca wszystko na drugi koniec peronu.',
    kind: 'orbit',
    color: '#ff5a5a',
    evolved: true,
    base: { damage: 24, cooldown: 0.4, range: 2.8, area: 0.8, speed: 5, count: 5, knockback: 8 },
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
    base: { damage: 20, cooldown: 2.6, range: 8, arc: 2.2, duration: 2, knockback: 6, count: 2 },
    levels: [],
  },
  {
    id: 'zgrzewka',
    name: 'Zgrzewka z Biedronki',
    description: 'Sześć puszek naraz, w promocji. Dywan wybuchów.',
    kind: 'lob',
    color: '#e8eef4',
    evolved: true,
    perks: ['cluster'],
    base: { damage: 40, cooldown: 1.6, range: 10, area: 3, count: 6, knockback: 9, speed: 1 },
    levels: [],
  },
  {
    id: 'siec-trakcyjna',
    name: 'Sieć Trakcyjna 3 kV',
    description: 'Cała linia pod napięciem. Osiem iskier, a każda przeskakuje dalej.',
    kind: 'strike',
    color: '#7fd4ff',
    evolved: true,
    perks: ['arc'],
    base: { damage: 40, cooldown: 1.6, range: 14, area: 2.2, count: 8, chains: 2 },
    levels: [],
  },
  {
    id: 'rozklad-2027',
    name: 'Rozkład Jazdy 2026/27',
    description: 'Wszystkie kursy odwołane naraz. Wachlarz kartek, które przebijają wszystko.',
    kind: 'line',
    color: '#ff6b6b',
    evolved: true,
    perks: ['fan'],
    base: { damage: 28, cooldown: 0.8, range: 16, area: 0.5, speed: 22, count: 6, pierce: -1 },
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
  { id: 'kanapka', name: 'Kanapka od Mamy', description: 'Z masłem i miłością. Powolna regeneracja zdrowia.', stat: 'regen', perLevel: 0.35, maxLevel: 5, text: '+{v} HP/s', percent: false },
  { id: 'bilet-ulgowy', name: 'Bilet Ulgowy', description: 'Pięćdziesiąt procent zniżki, sto procent więcej pocisków.', stat: 'amount', perLevel: 1, maxLevel: 2, text: '+{v} do liczby pocisków', percent: false },
  { id: 'tabela', name: 'Tabela Kursów', description: 'Kto zna rozkład, ten szybciej się uczy. Więcej doświadczenia.', stat: 'growth', perLevel: 0.08, maxLevel: 5, text: '+{v}% doświadczenia', percent: true },
];

/** Armour (a fraction of damage blocked) never goes above this. */
export const ARMOR_CAP = 0.6;

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
  { id: 'inka', name: 'Kawa zbożowa Inka', stat: 'regen', value: 0.5, text: '+{v} HP/s', percent: false },
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
export const FOOD = { id: 'paczek', name: 'Pączek z Biedronki', heal: 25, chance: 0.3 };

/** Offered when nothing else can be upgraded. */
export const FALLBACK_CARD = { id: 'zapiekanka', name: 'Zapiekanka z Dworca', description: 'Ciepła, z keczupem. Leczy.', heal: 30, text: '+{v} HP' };
