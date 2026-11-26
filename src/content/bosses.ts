// Station bosses: one per stop on line 17. Each has two or three phases, and every attack is telegraphed
// before it lands. Numbers here are the whole fight: the code in src/game/boss.ts only plays them.

export type AttackKind =
  /** Marks a circle on the ground, then slams it. */
  | 'slam'
  /** Fires a ring of projectiles outwards. */
  | 'ring'
  /** Fires a fan of projectiles at Piotrek. */
  | 'spread'
  /** Winds up facing Piotrek, then charges in a straight line. */
  | 'charge'
  /** Calls in a group of ordinary enemies. */
  | 'summon'
  /** Marks circles that stay dangerous for a while (zones you must leave). */
  | 'zone'
  /** A damaging ring that expands from the boss. */
  | 'wave'
  /** A sweeping beam that rotates around the boss. */
  | 'beam'
  /** Big things rolling along the ground away from the boss (the spinning mill's spools). */
  | 'roll'
  /** A magnet: pulls Piotrek towards the boss and the bottles out of their pockets, for `duration`. */
  | 'magnet';

/**
 * What a hit does besides the damage: `stun` stops Piotrek for a moment, `slow` holds them back while they
 * stand in it, `invert` turns the controls round for a few seconds, `block` makes a zone a barrier they
 * cannot walk into.
 */
export type AttackEffect = 'stun' | 'slow' | 'invert' | 'block';

export interface Attack {
  kind: AttackKind;
  /** Seconds of warning before it hurts anything. */
  telegraph: number;
  /** Seconds from the start of this attack to the next one. */
  cooldown: number;
  damage: number;
  /** Metres: slam/zone/wave radius, beam length, charge length (its width is fixed). */
  radius?: number;
  /** Projectiles, zones, summoned enemies. */
  count?: number;
  /** Projectile or sweep speed. */
  speed?: number;
  /** How long a zone or beam stays. */
  duration?: number;
  /** Enemy id for 'summon'. */
  spawn?: string;
  /** Shouted over the attack (Polish, shown as a banner). */
  shout?: string;
  effect?: AttackEffect;
  /** How its projectiles look: thrown rails, rolling spools (default: glowing balls). */
  look?: 'rail' | 'spool';
  /** What the death screen calls it (default: the kind's name in ATTACK_NAMES). */
  name?: string;
  /** A combo: this attack is wound up the moment the first one lands (its own warning). */
  then?: Attack;
  /** For the "never a third time" rule: the attack this one counts as (an extra-phase combo as its opening attack). */
  repeatAs?: string;
}

/** The death screen's names for boss attacks ("Co cię zajebało"). */
export const ATTACK_NAMES: Record<AttackKind, string> = {
  slam: 'Uderzenie w ziemię',
  ring: 'Pierścień pocisków',
  spread: 'Wachlarz pocisków',
  charge: 'Szarża',
  summon: 'Wezwanie',
  zone: 'Strefa',
  wave: 'Fala uderzeniowa',
  beam: 'Promień',
  roll: 'Toczące się szpule',
  magnet: 'Magnes',
};

export interface Phase {
  /** Starts when the boss drops to this fraction of its health (1 = from the start). */
  at: number;
  /** Movement speed in this phase. */
  speed: number;
  /** Seconds between attacks, before each attack's own cooldown. */
  pause: number;
  attacks: Attack[];
  /** Banner when the phase starts. */
  shout?: string;
  /** From this phase on the arena closes in to the barrier ring (TUNING.ladder.shortTrain of its radius). */
  arena?: boolean;
  /** Called in as the phase starts, during its transition. */
  wave?: { spawn: string; count: number };
}

export interface BossDef {
  id: string;
  /** Station this boss guards. */
  station: string;
  name: string;
  subtitle: string;
  /** The intro card's line above the name, when "Na torach stoi:" does not fit. */
  incoming?: string;
  /** Bestiary entry. */
  bestiary: string;
  hp: number;
  radius: number;
  /** Metres per second while walking towards Piotrek. */
  speed: number;
  xp: number;
  /** Bottles dropped on death. */
  bottles: number;
  /** Body colours, also used for the death chunks. */
  palette: string[];
  /** Half extents across and along the body, for a boss that is nothing like a circle (the bus). */
  box?: [number, number];
  phases: Phase[];
  /** Shouted when its extra phase starts (Opóźnienie 120 min and up). */
  lastWord: string;
}

export const BOSSES: BossDef[] = [
  {
    id: 'biletomat',
    station: 'fabryczna',
    name: 'Biletomat Który Nie Wydaje Reszty',
    lastWord: 'WYMAGANA WIZYTA W OKIENKU',
    subtitle: 'Płatność tylko kartą. Karty nie przyjmuje.',
    bestiary: 'Stoi na Fabrycznej od remontu. Monety bierze, biletu nie daje, reszty tym bardziej.',
    hp: 11650,
    radius: 1.5,
    speed: 2.2,
    xp: 300,
    bottles: 25,
    palette: ['#1d4f9c', '#ffd23a', '#2a2f3d', '#d8dde6'],
    phases: [
      {
        at: 1,
        speed: 2.2,
        pause: 1.5,
        attacks: [
          { kind: 'ring', telegraph: 0.7, cooldown: 2.6, damage: 14, count: 12, speed: 11, shout: 'WYDAJE RESZTĘ', name: 'Reszta w drobnych' },
          { kind: 'slam', telegraph: 0.9, cooldown: 2.4, damage: 22, radius: 4.5, name: 'Ciężki automat' },
        ],
      },
      {
        at: 0.64,
        speed: 2.8,
        pause: 1.1,
        shout: 'TRANSAKCJA ODRZUCONA',
        wave: { spawn: 'golab', count: 5 },
        attacks: [
          { kind: 'ring', telegraph: 0.6, cooldown: 2.2, damage: 16, count: 18, speed: 13, name: 'Reszta w drobnych' },
          { kind: 'slam', telegraph: 0.75, cooldown: 2.2, damage: 24, radius: 5.5, effect: 'stun', shout: 'TRANSAKCJA ODRZUCONA', name: 'Odmowa transakcji' },
          { kind: 'zone', telegraph: 0.8, cooldown: 3, damage: 12, radius: 4, count: 3, duration: 4.5, shout: 'KOLEJKA DO KASY', name: 'Kolejka do kasy' },
          { kind: 'summon', telegraph: 0.8, cooldown: 3.4, damage: 0, count: 6, spawn: 'golab', shout: 'GOŁĘBIE NA DOKARMIANIU' },
        ],
      },
      {
        at: 0.3,
        speed: 3.4,
        pause: 0.85,
        shout: 'BRAK POŁĄCZENIA Z SERWEREM',
        arena: true,
        attacks: [
          { kind: 'wave', telegraph: 0.8, cooldown: 3, damage: 26, radius: 13, speed: 9, shout: 'RESTART SYSTEMU', name: 'Restart systemu' },
          { kind: 'beam', telegraph: 0.8, cooldown: 3.2, damage: 14, radius: 20, duration: 2.4, speed: 1.2, shout: 'SKANUJĘ KOD', name: 'Skaner kodów' },
          { kind: 'slam', telegraph: 0.6, cooldown: 1.9, damage: 26, radius: 6, effect: 'stun', name: 'Odmowa transakcji' },
          {
            kind: 'ring', telegraph: 0.5, cooldown: 1.8, damage: 18, count: 24, speed: 15, shout: 'PARAGON GRATIS', name: 'Reszta w drobnych',
            then: { kind: 'slam', telegraph: 0.7, cooldown: 1, damage: 24, radius: 5, effect: 'stun', name: 'Odmowa transakcji' },
          },
        ],
      },
    ],
  },
  {
    id: 'pajeczyca',
    station: 'niciarniana',
    name: 'Przędzalniana Pajęczyca',
    lastWord: 'CAŁA PRZĘDZALNIA NA JEDNĄ ZMIANĘ',
    subtitle: 'Snuje od 1897 roku. Przerwy nie miała.',
    bestiary: 'Została w hali po zamknięciu przędzalni i przejęła park maszynowy. Z szyn linii 17 zrobiła sobie osnowę.',
    hp: 11150,
    radius: 2,
    speed: 2.6,
    xp: 420,
    bottles: 30,
    palette: ['#3c2c46', '#e8e2d2', '#5d4a6b', '#d8c33f'],
    phases: [
      {
        at: 1,
        speed: 2.6,
        pause: 1.4,
        attacks: [
          { kind: 'zone', telegraph: 0.8, cooldown: 3.2, damage: 10, radius: 4.5, count: 3, duration: 5, shout: 'PRZĘDZA SIĘ TRZYMA', effect: 'slow', name: 'Pajęczyna' },
          { kind: 'spread', telegraph: 0.6, cooldown: 2.4, damage: 15, count: 5, speed: 15, name: 'Czółenka' },
        ],
      },
      {
        at: 0.62,
        speed: 3,
        pause: 1,
        shout: 'ZMIANA NOCNA',
        wave: { spawn: 'szczur', count: 6 },
        attacks: [
          { kind: 'zone', telegraph: 0.6, cooldown: 2.8, damage: 12, radius: 5, count: 4, duration: 5.5, effect: 'slow', name: 'Pajęczyna' },
          { kind: 'roll', telegraph: 0.8, cooldown: 3.4, damage: 18, count: 4, speed: 7, look: 'spool', shout: 'SZPULE W RUCH', name: 'Szpule' },
          { kind: 'spread', telegraph: 0.5, cooldown: 2, damage: 16, count: 7, speed: 17, name: 'Czółenka' },
          { kind: 'summon', telegraph: 0.7, cooldown: 3.4, damage: 0, count: 5, spawn: 'szczur', shout: 'DZIECI, DO ROBOTY' },
        ],
      },
      {
        at: 0.28,
        speed: 3.4,
        pause: 0.8,
        shout: 'CAŁA HALA MOJA',
        arena: true,
        attacks: [
          { kind: 'beam', telegraph: 0.8, cooldown: 3, damage: 15, radius: 22, duration: 2.6, speed: 1.3, shout: 'NIĆ OSNOWY', name: 'Nić osnowy' },
          { kind: 'ring', telegraph: 0.5, cooldown: 2, damage: 16, count: 20, speed: 13, shout: 'KŁĘBY WATY', name: 'Kłęby waty' },
          { kind: 'spread', telegraph: 0.4, cooldown: 1.7, damage: 18, count: 9, speed: 19, name: 'Czółenka' },
          {
            kind: 'zone', telegraph: 0.5, cooldown: 2.4, damage: 14, radius: 5.5, count: 5, duration: 6, effect: 'slow', name: 'Pajęczyna',
            then: { kind: 'roll', telegraph: 0.6, cooldown: 1, damage: 20, count: 7, speed: 8.5, look: 'spool', shout: 'SZPULE W RUCH', name: 'Szpule' },
          },
        ],
      },
    ],
  },
  {
    id: 'kanar',
    station: 'widzew',
    name: 'Kanar Prime',
    lastWord: 'TERAZ PROSZĘ DOKUMENT',
    subtitle: 'Pociągu nie ma. Kontrola jest.',
    bestiary: 'Kontroluje perony, choć ostatni pociąg odjechał stąd przed remontem. Legitymuje gołębie, szczurom wystawia mandaty.',
    hp: 9800,
    radius: 1.7,
    speed: 3,
    xp: 520,
    bottles: 32,
    palette: ['#232b38', '#e03a2e', '#c8ccd4', '#1b6b4a'],
    phases: [
      {
        at: 1,
        speed: 3,
        pause: 1.3,
        attacks: [
          { kind: 'zone', telegraph: 0.8, cooldown: 3, damage: 18, radius: 5, count: 3, duration: 4.5, shout: 'BILET DO KONTROLI', name: 'Strefa kontroli' },
          { kind: 'charge', telegraph: 0.9, cooldown: 3, damage: 22, radius: 16, shout: 'PROSZĘ SIĘ NIE ODDALAĆ', name: 'Pościg za gapowiczem' },
        ],
      },
      {
        at: 0.65,
        speed: 3.6,
        pause: 1,
        shout: 'WZYWAM WSPARCIE',
        wave: { spawn: 'kontroler', count: 3 },
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.4, damage: 0, count: 4, spawn: 'kontroler', shout: 'PANOWIE, KONTROLA' },
          { kind: 'spread', telegraph: 0.5, cooldown: 2.2, damage: 18, count: 5, speed: 17, shout: 'MANDAT', name: 'Mandaty' },
          { kind: 'zone', telegraph: 0.6, cooldown: 2.6, damage: 20, radius: 5.5, count: 4, duration: 5, name: 'Strefa kontroli' },
          { kind: 'charge', telegraph: 0.8, cooldown: 2.6, damage: 24, radius: 18, name: 'Pościg za gapowiczem' },
        ],
      },
      {
        at: 0.3,
        speed: 4,
        pause: 0.8,
        shout: 'DOKUMENCIK',
        wave: { spawn: 'kontroler', count: 4 },
        attacks: [
          { kind: 'wave', telegraph: 0.6, cooldown: 2.6, damage: 20, radius: 15, speed: 12, effect: 'stun', shout: 'LEGITYMOWANIE', name: 'Legitymowanie' },
          { kind: 'beam', telegraph: 0.8, cooldown: 3, damage: 16, radius: 22, duration: 2.6, speed: 1.4, shout: 'KONTROLA CAŁEGO SKŁADU', name: 'Kontrola całego składu' },
          { kind: 'spread', telegraph: 0.5, cooldown: 2, damage: 20, count: 7, speed: 18, shout: 'MANDAT I OPŁATA MANIPULACYJNA', name: 'Mandaty' },
          {
            kind: 'charge', telegraph: 0.7, cooldown: 2.2, damage: 26, radius: 20, name: 'Pościg za gapowiczem',
            then: { kind: 'zone', telegraph: 0.6, cooldown: 1, damage: 22, radius: 6, count: 4, duration: 5, shout: 'NIKT NIE WYSIADA', name: 'Strefa kontroli' },
          },
        ],
      },
    ],
  },
  {
    id: 'krol-zlomu',
    station: 'andrzejow',
    name: 'Król Skupu Złomu',
    lastWord: 'SKUP ZAMKNIĘTY, BIORĘ WSZYSTKO',
    subtitle: 'Skup czynny 7–15. Szyny przyjęte o 7:05.',
    bestiary: 'Kupił całą linię 17 na wagę, zapłacił gotówką i kwitu nie wystawił. Siedzi na tronie z tego, co przyjechało.',
    hp: 13600,
    radius: 2.2,
    speed: 2,
    xp: 620,
    bottles: 36,
    palette: ['#6b5a3a', '#d9a441', '#8b8f96', '#3e3a36'],
    phases: [
      {
        at: 1,
        speed: 2,
        pause: 1.4,
        attacks: [
          { kind: 'spread', telegraph: 0.6, cooldown: 2.6, damage: 20, count: 5, speed: 22, shout: 'SZYNY NA WAGĘ', look: 'rail', name: 'Rzut szyną' },
          { kind: 'slam', telegraph: 0.9, cooldown: 2.6, damage: 26, radius: 5.5, name: 'Tron z blachy' },
        ],
      },
      {
        at: 0.6,
        speed: 2.4,
        pause: 1.05,
        shout: 'MAGNES NA DWIE TONY',
        attacks: [
          { kind: 'magnet', telegraph: 0.9, cooldown: 4.4, damage: 0, duration: 3.2, shout: 'DAWAJ BUTELKI' },
          { kind: 'wave', telegraph: 0.8, cooldown: 3.2, damage: 24, radius: 15, speed: 11, shout: 'BLACHA FALISTA', name: 'Blacha falista' },
          { kind: 'spread', telegraph: 0.5, cooldown: 2.2, damage: 22, count: 7, speed: 24, look: 'rail', name: 'Rzut szyną' },
          { kind: 'slam', telegraph: 0.7, cooldown: 2.3, damage: 28, radius: 6, name: 'Tron z blachy' },
        ],
      },
      {
        at: 0.25,
        speed: 2.8,
        pause: 0.85,
        shout: 'CENA SPADŁA',
        arena: true,
        wave: { spawn: 'zlomiarz', count: 3 },
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 4, spawn: 'zlomiarz', shout: 'EKIPA, ZBIERAĆ' },
          { kind: 'ring', telegraph: 0.5, cooldown: 2.2, damage: 22, count: 16, speed: 18, look: 'rail', shout: 'ZŁOM DOOKOŁA', name: 'Złom dookoła' },
          { kind: 'wave', telegraph: 0.6, cooldown: 2.6, damage: 26, radius: 17, speed: 13, name: 'Blacha falista' },
          { kind: 'spread', telegraph: 0.45, cooldown: 1.8, damage: 24, count: 9, speed: 26, look: 'rail', name: 'Rzut szyną' },
          {
            kind: 'magnet', telegraph: 0.7, cooldown: 3.2, damage: 0, duration: 2.4, shout: 'NA WAGĘ',
            then: { kind: 'slam', telegraph: 0.8, cooldown: 1, damage: 30, radius: 6.5, name: 'Tron z blachy' },
          },
        ],
      },
    ],
  },
  {
    id: 'zka',
    station: 'bedon',
    name: 'ZKA Ostatni Kurs',
    lastWord: 'KURS WYDŁUŻONY DO ODWOŁANIA',
    subtitle: 'Komunikacja zastępcza. Zastępuje wszystko.',
    bestiary: 'Dziewiąty rok jeździ za pociąg i zdążył uwierzyć, że jest pociągiem. Hamuje na czerwonym, i to z grzeczności.',
    hp: 12000,
    radius: 2.6,
    speed: 3.4,
    xp: 720,
    bottles: 38,
    palette: ['#f2c400', '#e2362c', '#f2f2f2', '#2a3448'],
    box: [1.5, 4.7],
    phases: [
      {
        at: 1,
        speed: 3.4,
        pause: 1.5,
        attacks: [
          { kind: 'charge', telegraph: 1.1, cooldown: 3.4, damage: 20, radius: 20, shout: 'NIE ZATRZYMUJE SIĘ NA ŻĄDANIE', name: 'Przejazd bez zatrzymania' },
          { kind: 'zone', telegraph: 1, cooldown: 3.6, damage: 12, radius: 5, count: 2, duration: 5, shout: 'OBJAZD', effect: 'block', name: 'Objazd' },
        ],
      },
      {
        at: 0.62,
        speed: 4,
        pause: 1.1,
        shout: 'WYSIADKA',
        wave: { spawn: 'robotnik', count: 4 },
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 5, spawn: 'robotnik', shout: 'PRZESIADKA DO AUTOBUSU' },
          { kind: 'roll', telegraph: 0.8, cooldown: 3.2, damage: 18, count: 5, speed: 8, shout: 'ZAPASOWE OPONY', name: 'Zapasowe opony' },
          { kind: 'charge', telegraph: 0.95, cooldown: 3, damage: 22, radius: 22, name: 'Przejazd bez zatrzymania' },
          { kind: 'zone', telegraph: 0.7, cooldown: 3, damage: 14, radius: 5.5, count: 3, duration: 5, effect: 'block', name: 'Objazd' },
        ],
      },
      {
        at: 0.28,
        speed: 4.6,
        pause: 0.85,
        shout: 'KURS SKRÓCONY',
        arena: true,
        attacks: [
          { kind: 'slam', telegraph: 0.6, cooldown: 2.1, damage: 26, radius: 6, shout: 'PRÓG ZWALNIAJĄCY', name: 'Próg zwalniający' },
          { kind: 'wave', telegraph: 0.6, cooldown: 2.6, damage: 24, radius: 16, speed: 13, shout: 'KLAKSON', name: 'Klakson' },
          { kind: 'zone', telegraph: 0.6, cooldown: 2.6, damage: 16, radius: 6, count: 3, duration: 5, effect: 'block', name: 'Objazd' },
          {
            kind: 'charge', telegraph: 0.8, cooldown: 2.6, damage: 24, radius: 24, name: 'Przejazd bez zatrzymania',
            then: { kind: 'charge', telegraph: 0.9, cooldown: 1.2, damage: 24, radius: 24, shout: 'KURS POWROTNY', name: 'Kurs powrotny' },
          },
        ],
      },
    ],
  },
  {
    id: 'golab-matka',
    station: 'justynow',
    name: 'Gołąb Matka',
    lastWord: 'CAŁE STADO NA ŚWIEŻO UMYTE',
    subtitle: 'Całe stado z Fabrycznej to jej dzieci.',
    bestiary: 'Gnieździ się pod wiatą w Justynowie i karmi stado tym, co spadnie z peronu. Wygląda jak gołąb, tylko ma trzy metry i swoje zdanie.',
    hp: 15100,
    radius: 2.2,
    speed: 3.2,
    xp: 820,
    bottles: 40,
    palette: ['#8f96a3', '#6fb39a', '#5d6573', '#e6893b'],
    phases: [
      {
        at: 1,
        speed: 3.2,
        pause: 1.3,
        attacks: [
          { kind: 'slam', telegraph: 0.8, cooldown: 2.2, damage: 26, radius: 5, shout: 'NA ŚWIEŻO UMYTE', name: 'Lądowanie' },
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 8, spawn: 'golab', shout: 'STADO DO MNIE' },
        ],
      },
      {
        at: 0.65,
        speed: 3.8,
        pause: 1,
        shout: 'LOT KOSZĄCY',
        wave: { spawn: 'golab', count: 8 },
        attacks: [
          { kind: 'beam', telegraph: 0.9, cooldown: 3.4, damage: 14, radius: 24, duration: 2.6, speed: 1.1, name: 'Lot koszący' },
          { kind: 'spread', telegraph: 0.5, cooldown: 2.2, damage: 18, count: 7, speed: 16, shout: 'PIÓRA W RUCH', name: 'Pióra' },
          { kind: 'slam', telegraph: 0.6, cooldown: 2, damage: 28, radius: 5.5, name: 'Lądowanie' },
          { kind: 'summon', telegraph: 0.6, cooldown: 3, damage: 0, count: 10, spawn: 'golab' },
        ],
      },
      {
        at: 0.3,
        speed: 4.2,
        pause: 0.8,
        shout: 'MOJE DZIECI SĄ GŁODNE',
        wave: { spawn: 'golab', count: 10 },
        attacks: [
          { kind: 'zone', telegraph: 0.6, cooldown: 2.6, damage: 16, radius: 4.5, count: 5, duration: 6, effect: 'slow', shout: 'Z GÓRY NA PERON', name: 'Prosto z góry' },
          { kind: 'slam', telegraph: 0.5, cooldown: 1.7, damage: 30, radius: 6, name: 'Lądowanie' },
          { kind: 'spread', telegraph: 0.45, cooldown: 1.9, damage: 20, count: 9, speed: 18, name: 'Pióra' },
          {
            kind: 'beam', telegraph: 0.7, cooldown: 3, damage: 16, radius: 26, duration: 3, speed: 1.5, name: 'Lot koszący',
            then: { kind: 'ring', telegraph: 0.6, cooldown: 1, damage: 26, count: 22, speed: 15, shout: 'PIERZE LECI', name: 'Pierze leci' },
          },
        ],
      },
    ],
  },
  {
    id: 'kierownik',
    station: 'galkowek',
    name: 'Kierownik Robót PLK',
    lastWord: 'TERMIN PRZESUNIĘTY NA 2035',
    subtitle: 'Prace torowe 2026–2031. Etap wstępny.',
    bestiary: 'Ma harmonogram, kamizelkę i koparkę. Szyn nie ma, bo szyny były nieujęte w projekcie.',
    hp: 17500,
    radius: 1.9,
    speed: 2.4,
    xp: 950,
    bottles: 44,
    palette: ['#ff8a1e', '#ffd23a', '#2f3a52', '#d9dde3'],
    phases: [
      {
        at: 1,
        speed: 2.4,
        pause: 1.3,
        attacks: [
          { kind: 'zone', telegraph: 0.8, cooldown: 3, damage: 18, radius: 6, count: 4, duration: 6, shout: 'PRACE TOROWE 2026–2031', effect: 'block', name: 'Teren budowy' },
          { kind: 'slam', telegraph: 0.8, cooldown: 2.4, damage: 28, radius: 5.5, shout: 'ETAP WSTĘPNY', name: 'Wbijanie pala' },
        ],
      },
      {
        at: 0.65,
        speed: 2.8,
        pause: 1,
        shout: 'KOPARKA W RUCHU',
        attacks: [
          { kind: 'beam', telegraph: 0.9, cooldown: 3.2, damage: 16, radius: 26, duration: 2.8, speed: 1.2, name: 'Ramię koparki' },
          { kind: 'roll', telegraph: 0.8, cooldown: 3.2, damage: 20, count: 5, speed: 7.5, shout: 'KRĘGI BETONOWE', name: 'Kręgi betonowe' },
          { kind: 'zone', telegraph: 0.6, cooldown: 2.6, damage: 20, radius: 6.5, count: 5, duration: 6, effect: 'block', name: 'Teren budowy' },
          { kind: 'slam', telegraph: 0.6, cooldown: 2.1, damage: 30, radius: 6, name: 'Wbijanie pala' },
        ],
      },
      {
        at: 0.3,
        speed: 3.2,
        pause: 0.82,
        shout: 'ZMIANA W PROJEKCIE',
        arena: true,
        wave: { spawn: 'robotnik', count: 5 },
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 5, spawn: 'robotnik', shout: 'BRYGADA NA TOR' },
          { kind: 'wave', telegraph: 0.6, cooldown: 2.6, damage: 26, radius: 17, speed: 12, shout: 'ZAGĘSZCZARKA', name: 'Zagęszczarka' },
          { kind: 'beam', telegraph: 0.7, cooldown: 2.8, damage: 18, radius: 28, duration: 3, speed: 1.6, name: 'Ramię koparki' },
          {
            kind: 'zone', telegraph: 0.5, cooldown: 2.3, damage: 22, radius: 7, count: 5, duration: 6, effect: 'block', name: 'Teren budowy',
            then: { kind: 'slam', telegraph: 0.7, cooldown: 1, damage: 32, radius: 6.5, name: 'Wbijanie pala' },
          },
        ],
      },
    ],
  },
  {
    id: 'megafon',
    station: 'zakowice',
    name: 'Megafon Komunikatów',
    lastWord: 'UWAGA, UWAGA, OSTATNI KOMUNIKAT',
    subtitle: 'Przepraszamy za utrudnienia. I tak będzie dalej.',
    bestiary: 'Wisi na maszcie w Żakowicach i ogłasza opóźnienia pociągów, których nie ma. Słychać go w Koluszkach.',
    hp: 12000,
    radius: 2,
    speed: 2.2,
    xp: 1200,
    bottles: 50,
    palette: ['#9aa3ad', '#ffd23a', '#3a4350', '#20242c'],
    phases: [
      {
        at: 1,
        speed: 2.2,
        pause: 1.3,
        attacks: [
          { kind: 'wave', telegraph: 0.8, cooldown: 2.8, damage: 21, radius: 16, speed: 12, shout: 'OPÓŹNIENIE OKOŁO 40 MINUT', name: 'Komunikat' },
          { kind: 'ring', telegraph: 0.6, cooldown: 2.4, damage: 20, count: 16, speed: 13, shout: 'POWTARZAM KOMUNIKAT', name: 'Powtórzenie komunikatu' },
        ],
      },
      {
        at: 0.62,
        speed: 2.6,
        pause: 1,
        shout: 'ZMIANA PERONU',
        attacks: [
          { kind: 'zone', telegraph: 0.6, cooldown: 2.8, damage: 23, radius: 6, count: 4, duration: 5.5, shout: 'PERON TRZECI ODWOŁANY', name: 'Peron odwołany' },
          { kind: 'slam', telegraph: 0.8, cooldown: 2.4, damage: 24, radius: 4.5, shout: 'UWAGA, SPADAJĄCY GŁOŚNIK', name: 'Spadający głośnik' },
          { kind: 'wave', telegraph: 0.6, cooldown: 2.4, damage: 25, radius: 18, speed: 14, effect: 'invert', shout: 'KOMUNIKAT ODWROTNY', name: 'Komunikat odwrotny' },
          { kind: 'ring', telegraph: 0.5, cooldown: 2, damage: 21, count: 22, speed: 15, name: 'Powtórzenie komunikatu' },
        ],
      },
      {
        at: 0.28,
        speed: 3,
        pause: 0.78,
        shout: 'PRZEPRASZAMY ZA UTRUDNIENIA',
        arena: true,
        attacks: [
          { kind: 'beam', telegraph: 0.8, cooldown: 3, damage: 15, radius: 28, duration: 3, speed: 1.7, shout: 'SPRZĘŻENIE ZWROTNE', name: 'Sprzężenie zwrotne' },
          { kind: 'spread', telegraph: 0.5, cooldown: 2, damage: 22, count: 9, speed: 18, shout: 'ZAPOWIEDŹ SŁOWNA', name: 'Zapowiedź słowna' },
          { kind: 'zone', telegraph: 0.5, cooldown: 2.2, damage: 25, radius: 6.5, count: 5, duration: 5, name: 'Peron odwołany' },
          {
            kind: 'wave', telegraph: 0.5, cooldown: 2.2, damage: 28, radius: 20, speed: 16, effect: 'invert', name: 'Komunikat odwrotny',
            then: { kind: 'ring', telegraph: 0.6, cooldown: 1, damage: 23, count: 28, speed: 17, name: 'Powtórzenie komunikatu' },
          },
        ],
      },
    ],
  },
  {
    // The finale. Phase one he sits, so it is all throwing; his coffee is a shield (see src/game/bartek.ts).
    id: 'bartek',
    station: 'koluszki',
    name: 'Bartek D.',
    lastWord: 'KIJ W RUCH',
    incoming: 'Pod Dino siedzi:',
    subtitle: 'Kopi luwak, plastikowe krzesło i kij. Wiadomo gdzie.',
    bestiary: 'Ukradł tory, bo go bolała dupa, że Piotrek mają tylko 20 minut do domu. Szyny sprzedał, za kasę kupił kawę z lemura.',
    hp: 15200,
    radius: 0.9,
    speed: 0,
    xp: 1500,
    bottles: 80,
    palette: ['#3b2920', '#6b4423', '#e4ad97', '#f2f2ee'],
    phases: [
      {
        at: 1,
        speed: 0,
        pause: 1.2,
        attacks: [
          { kind: 'spread', telegraph: 0.6, cooldown: 2.2, damage: 11, count: 7, speed: 13, shout: '@insult', name: 'Wyzwiska' },
          { kind: 'ring', telegraph: 0.7, cooldown: 2.6, damage: 10, count: 16, speed: 10, name: 'Fusy' },
        ],
      },
      {
        at: 0.74,
        speed: 2.4,
        pause: 1,
        shout: 'BÓL DUPY',
        attacks: [
          { kind: 'wave', telegraph: 0.8, cooldown: 2.6, damage: 18, radius: 15, speed: 9, shout: 'BÓL DUPY', name: 'Ból dupy' },
          { kind: 'slam', telegraph: 0.8, cooldown: 2.4, damage: 20, radius: 4.5, shout: 'KIJ W RUCH', name: 'Zamach kijem' },
          { kind: 'spread', telegraph: 0.5, cooldown: 2, damage: 13, count: 7, speed: 15, shout: '@insult', name: 'Wyzwiska' },
        ],
      },
      {
        at: 0.48,
        speed: 2.8,
        pause: 0.9,
        shout: 'BARTEK ZAMAWIA DOLEWKĘ',
        wave: { spawn: 'lemur', count: 5 },
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3, damage: 0, count: 3, spawn: 'lemur', shout: '@refill' },
          { kind: 'zone', telegraph: 0.7, cooldown: 2.8, damage: 14, radius: 4.5, count: 4, duration: 6, effect: 'slow', shout: 'ROZLANA KAWA', name: 'Rozlana kawa' },
          { kind: 'wave', telegraph: 0.7, cooldown: 2.6, damage: 19, radius: 16, speed: 10, name: 'Ból dupy' },
          { kind: 'ring', telegraph: 0.6, cooldown: 2.2, damage: 12, count: 20, speed: 12, name: 'Fusy' },
        ],
      },
      {
        at: 0.2,
        speed: 3.2,
        pause: 0.7,
        shout: 'DUSZKIEM!',
        arena: true,
        wave: { spawn: 'lemur', count: 4 },
        attacks: [
          { kind: 'charge', telegraph: 0.8, cooldown: 2.6, damage: 22, radius: 16, shout: 'Z KRZESŁA NA CIEBIE', name: 'Szarża z krzesłem' },
          { kind: 'beam', telegraph: 0.8, cooldown: 3, damage: 14, radius: 20, duration: 2.6, speed: 1.4, shout: 'STRUMIEŃ KAWY', name: 'Strumień kawy' },
          { kind: 'summon', telegraph: 0.6, cooldown: 2.6, damage: 0, count: 4, spawn: 'lemur', shout: '@refill' },
          {
            kind: 'spread', telegraph: 0.45, cooldown: 1.6, damage: 14, count: 9, speed: 17, shout: '@insult', name: 'Wyzwiska',
            then: { kind: 'ring', telegraph: 0.5, cooldown: 1, damage: 13, count: 24, speed: 14, name: 'Fusy' },
          },
        ],
      },
    ],
  },
];

export function bossOf(station: string): BossDef | null {
  return BOSSES.find((b) => b.station === station) ?? null;
}
