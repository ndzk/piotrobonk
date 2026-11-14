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
  | 'beam';

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
}

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
}

export interface BossDef {
  id: string;
  /** Station this boss guards. */
  station: string;
  name: string;
  subtitle: string;
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
}

export const BOSSES: BossDef[] = [
  {
    id: 'biletomat',
    station: 'fabryczna',
    name: 'Biletomat Który Nie Wydaje Reszty',
    subtitle: 'Płatność tylko kartą. Karty nie przyjmuje.',
    bestiary: 'Stoi na Fabrycznej od remontu. Monety bierze, biletu nie daje, reszty tym bardziej.',
    hp: 3100,
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
          { kind: 'ring', telegraph: 0.7, cooldown: 2.6, damage: 14, count: 12, speed: 11, shout: 'WYDAJE RESZTĘ' },
          { kind: 'slam', telegraph: 0.9, cooldown: 2.4, damage: 22, radius: 4.5 },
        ],
      },
      {
        at: 0.6,
        speed: 2.8,
        pause: 1.1,
        shout: 'TRANSAKCJA ODRZUCONA',
        attacks: [
          { kind: 'ring', telegraph: 0.6, cooldown: 2.2, damage: 16, count: 18, speed: 13 },
          { kind: 'slam', telegraph: 0.75, cooldown: 2.2, damage: 24, radius: 5.5 },
          { kind: 'summon', telegraph: 0.8, cooldown: 3.4, damage: 0, count: 6, spawn: 'golab' },
        ],
      },
      {
        at: 0.25,
        speed: 3.4,
        pause: 0.85,
        shout: 'BRAK POŁĄCZENIA Z SERWEREM',
        attacks: [
          { kind: 'ring', telegraph: 0.5, cooldown: 1.8, damage: 18, count: 24, speed: 15 },
          { kind: 'wave', telegraph: 0.8, cooldown: 3, damage: 26, radius: 13, speed: 9 },
          { kind: 'slam', telegraph: 0.6, cooldown: 1.9, damage: 26, radius: 6 },
        ],
      },
    ],
  },
  {
    id: 'pajeczyca',
    station: 'niciarniana',
    name: 'Przędzalniana Pajęczyca',
    subtitle: 'Snuje od 1897 roku. Przerwy nie miała.',
    bestiary: 'Została w hali po zamknięciu przędzalni i przejęła park maszynowy. Z szyn linii 17 zrobiła sobie osnowę.',
    hp: 3700,
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
          { kind: 'zone', telegraph: 0.8, cooldown: 3.2, damage: 16, radius: 4.5, count: 3, duration: 5, shout: 'PRZĘDZA SIĘ TRZYMA' },
          { kind: 'spread', telegraph: 0.6, cooldown: 2.4, damage: 15, count: 5, speed: 15 },
        ],
      },
      {
        at: 0.62,
        speed: 3,
        pause: 1,
        shout: 'ZMIANA NOCNA',
        attacks: [
          { kind: 'zone', telegraph: 0.6, cooldown: 2.8, damage: 18, radius: 5, count: 4, duration: 5.5 },
          { kind: 'spread', telegraph: 0.5, cooldown: 2, damage: 16, count: 7, speed: 17 },
          { kind: 'summon', telegraph: 0.7, cooldown: 3.4, damage: 0, count: 5, spawn: 'szczur', shout: 'DZIECI, DO ROBOTY' },
        ],
      },
      {
        at: 0.28,
        speed: 3.4,
        pause: 0.8,
        shout: 'CAŁA HALA MOJA',
        attacks: [
          { kind: 'ring', telegraph: 0.5, cooldown: 2, damage: 18, count: 20, speed: 14, shout: 'SZPULE W RUCH' },
          { kind: 'zone', telegraph: 0.5, cooldown: 2.4, damage: 20, radius: 5.5, count: 5, duration: 6 },
          { kind: 'spread', telegraph: 0.4, cooldown: 1.7, damage: 18, count: 9, speed: 19 },
        ],
      },
    ],
  },
  {
    id: 'kanar',
    station: 'widzew',
    name: 'Kanar Prime',
    subtitle: 'Pociągu nie ma. Kontrola jest.',
    bestiary: 'Kontroluje perony, choć ostatni pociąg odjechał stąd przed remontem. Legitymuje gołębie, szczurom wystawia mandaty.',
    hp: 4400,
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
          { kind: 'zone', telegraph: 0.8, cooldown: 3, damage: 18, radius: 5, count: 3, duration: 4.5, shout: 'BILET DO KONTROLI' },
          { kind: 'charge', telegraph: 0.9, cooldown: 3, damage: 22, radius: 16, shout: 'PROSZĘ SIĘ NIE ODDALAĆ' },
        ],
      },
      {
        at: 0.65,
        speed: 3.6,
        pause: 1,
        shout: 'WZYWAM WSPARCIE',
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.4, damage: 0, count: 4, spawn: 'robotnik', shout: 'PANOWIE, KONTROLA' },
          { kind: 'zone', telegraph: 0.6, cooldown: 2.6, damage: 20, radius: 5.5, count: 4, duration: 5 },
          { kind: 'charge', telegraph: 0.8, cooldown: 2.6, damage: 24, radius: 18 },
        ],
      },
      {
        at: 0.3,
        speed: 4,
        pause: 0.8,
        shout: 'DOKUMENCIK',
        attacks: [
          { kind: 'spread', telegraph: 0.5, cooldown: 2, damage: 20, count: 7, speed: 18, shout: 'MANDAT I OPŁATA MANIPULACYJNA' },
          { kind: 'charge', telegraph: 0.7, cooldown: 2.2, damage: 26, radius: 20 },
          { kind: 'zone', telegraph: 0.5, cooldown: 2.2, damage: 22, radius: 6, count: 5, duration: 5 },
        ],
      },
    ],
  },
  {
    id: 'krol-zlomu',
    station: 'andrzejow',
    name: 'Król Skupu Złomu',
    subtitle: 'Skup czynny 7–15. Szyny przyjęte o 7:05.',
    bestiary: 'Kupił całą linię 17 na wagę, zapłacił gotówką i kwitu nie wystawił. Siedzi na tronie z tego, co przyjechało.',
    hp: 4400,
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
          { kind: 'spread', telegraph: 0.6, cooldown: 2.6, damage: 20, count: 5, speed: 22, shout: 'SZYNY NA WAGĘ' },
          { kind: 'slam', telegraph: 0.9, cooldown: 2.6, damage: 26, radius: 5.5 },
        ],
      },
      {
        at: 0.6,
        speed: 2.4,
        pause: 1.05,
        shout: 'MAGNES NA DWIE TONY',
        attacks: [
          { kind: 'wave', telegraph: 0.8, cooldown: 3.2, damage: 24, radius: 15, speed: 11 },
          { kind: 'spread', telegraph: 0.5, cooldown: 2.2, damage: 22, count: 7, speed: 24 },
          { kind: 'slam', telegraph: 0.7, cooldown: 2.3, damage: 28, radius: 6 },
        ],
      },
      {
        at: 0.25,
        speed: 2.8,
        pause: 0.85,
        shout: 'CENA SPADŁA',
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 4, spawn: 'zlomiarz', shout: 'EKIPA, ZBIERAĆ' },
          { kind: 'wave', telegraph: 0.6, cooldown: 2.6, damage: 26, radius: 17, speed: 13 },
          { kind: 'slam', telegraph: 0.6, cooldown: 2, damage: 30, radius: 6.5 },
          { kind: 'spread', telegraph: 0.45, cooldown: 1.8, damage: 24, count: 9, speed: 26 },
        ],
      },
    ],
  },
  {
    id: 'zka',
    station: 'bedon',
    name: 'ZKA Ostatni Kurs',
    subtitle: 'Komunikacja zastępcza. Zastępuje wszystko.',
    bestiary: 'Dziewiąty rok jeździ za pociąg i zdążył uwierzyć, że jest pociągiem. Hamuje na czerwonym, i to z grzeczności.',
    hp: 5000,
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
          { kind: 'charge', telegraph: 1.1, cooldown: 3.4, damage: 20, radius: 20, shout: 'NIE ZATRZYMUJE SIĘ NA ŻĄDANIE' },
          { kind: 'zone', telegraph: 1, cooldown: 3.6, damage: 15, radius: 5, count: 2, duration: 4, shout: 'OBJAZD' },
        ],
      },
      {
        at: 0.62,
        speed: 4,
        pause: 1.1,
        shout: 'WYSIADKA',
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 5, spawn: 'robotnik', shout: 'PRZESIADKA DO AUTOBUSU' },
          { kind: 'charge', telegraph: 0.95, cooldown: 3, damage: 22, radius: 22 },
          { kind: 'zone', telegraph: 0.7, cooldown: 3, damage: 17, radius: 5.5, count: 3, duration: 4.5 },
        ],
      },
      {
        at: 0.28,
        speed: 4.6,
        pause: 0.85,
        shout: 'KURS SKRÓCONY',
        attacks: [
          { kind: 'slam', telegraph: 0.6, cooldown: 2.1, damage: 26, radius: 6, shout: 'PRÓG ZWALNIAJĄCY' },
          { kind: 'charge', telegraph: 0.8, cooldown: 2.6, damage: 24, radius: 24 },
          { kind: 'zone', telegraph: 0.6, cooldown: 2.6, damage: 19, radius: 6, count: 3, duration: 4.5 },
        ],
      },
    ],
  },
  {
    id: 'golab-matka',
    station: 'justynow',
    name: 'Gołąb Matka',
    subtitle: 'Całe stado z Fabrycznej to jej dzieci.',
    bestiary: 'Gnieździ się pod wiatą w Justynowie i karmi stado tym, co spadnie z peronu. Wygląda jak gołąb, tylko ma trzy metry i swoje zdanie.',
    hp: 6600,
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
          { kind: 'slam', telegraph: 0.8, cooldown: 2.2, damage: 26, radius: 5, shout: 'NA ŚWIEŻO UMYTE' },
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 8, spawn: 'golab', shout: 'STADO DO MNIE' },
        ],
      },
      {
        at: 0.65,
        speed: 3.8,
        pause: 1,
        shout: 'LOT KOSZĄCY',
        attacks: [
          { kind: 'beam', telegraph: 0.9, cooldown: 3.4, damage: 14, radius: 24, duration: 2.6, speed: 1.1 },
          { kind: 'slam', telegraph: 0.6, cooldown: 2, damage: 28, radius: 5.5 },
          { kind: 'summon', telegraph: 0.6, cooldown: 3, damage: 0, count: 10, spawn: 'golab' },
        ],
      },
      {
        at: 0.3,
        speed: 4.2,
        pause: 0.8,
        shout: 'MOJE DZIECI SĄ GŁODNE',
        attacks: [
          { kind: 'ring', telegraph: 0.5, cooldown: 2, damage: 26, count: 22, speed: 15, shout: 'PIERZE LECI' },
          { kind: 'slam', telegraph: 0.5, cooldown: 1.7, damage: 30, radius: 6 },
          { kind: 'beam', telegraph: 0.7, cooldown: 3, damage: 16, radius: 26, duration: 3, speed: 1.5 },
        ],
      },
    ],
  },
  {
    id: 'kierownik',
    station: 'galkowek',
    name: 'Kierownik Robót PLK',
    subtitle: 'Prace torowe 2026–2031. Etap wstępny.',
    bestiary: 'Ma harmonogram, kamizelkę i koparkę. Szyn nie ma, bo szyny były nieujęte w projekcie.',
    hp: 6200,
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
          { kind: 'zone', telegraph: 0.8, cooldown: 3, damage: 24, radius: 6, count: 4, duration: 6, shout: 'PRACE TOROWE 2026–2031' },
          { kind: 'slam', telegraph: 0.8, cooldown: 2.4, damage: 28, radius: 5.5, shout: 'ETAP WSTĘPNY' },
        ],
      },
      {
        at: 0.65,
        speed: 2.8,
        pause: 1,
        shout: 'KOPARKA W RUCHU',
        attacks: [
          { kind: 'beam', telegraph: 0.9, cooldown: 3.2, damage: 16, radius: 26, duration: 2.8, speed: 1.2 },
          { kind: 'zone', telegraph: 0.6, cooldown: 2.6, damage: 26, radius: 6.5, count: 5, duration: 6 },
          { kind: 'slam', telegraph: 0.6, cooldown: 2.1, damage: 30, radius: 6 },
        ],
      },
      {
        at: 0.3,
        speed: 3.2,
        pause: 0.82,
        shout: 'ZMIANA W PROJEKCIE',
        attacks: [
          { kind: 'summon', telegraph: 0.7, cooldown: 3.2, damage: 0, count: 5, spawn: 'robotnik', shout: 'BRYGADA NA TOR' },
          { kind: 'beam', telegraph: 0.7, cooldown: 2.8, damage: 18, radius: 28, duration: 3, speed: 1.6 },
          { kind: 'slam', telegraph: 0.5, cooldown: 1.9, damage: 32, radius: 6.5 },
          { kind: 'zone', telegraph: 0.5, cooldown: 2.3, damage: 28, radius: 7, count: 5, duration: 6 },
        ],
      },
    ],
  },
  {
    id: 'megafon',
    station: 'zakowice',
    name: 'Megafon Komunikatów',
    subtitle: 'Przepraszamy za utrudnienia. I tak będzie dalej.',
    bestiary: 'Wisi na maszcie w Żakowicach i ogłasza opóźnienia pociągów, których nie ma. Słychać go w Koluszkach.',
    hp: 7000,
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
          { kind: 'wave', telegraph: 0.8, cooldown: 2.8, damage: 21, radius: 16, speed: 12, shout: 'OPÓŹNIENIE OKOŁO 40 MINUT' },
          { kind: 'ring', telegraph: 0.6, cooldown: 2.4, damage: 20, count: 16, speed: 13, shout: 'POWTARZAM KOMUNIKAT' },
        ],
      },
      {
        at: 0.62,
        speed: 2.6,
        pause: 1,
        shout: 'ZMIANA PERONU',
        attacks: [
          { kind: 'zone', telegraph: 0.6, cooldown: 2.8, damage: 23, radius: 6, count: 4, duration: 5.5, shout: 'PERON TRZECI ODWOŁANY' },
          { kind: 'wave', telegraph: 0.6, cooldown: 2.4, damage: 25, radius: 18, speed: 14 },
          { kind: 'ring', telegraph: 0.5, cooldown: 2, damage: 21, count: 22, speed: 15 },
        ],
      },
      {
        at: 0.28,
        speed: 3,
        pause: 0.78,
        shout: 'PRZEPRASZAMY ZA UTRUDNIENIA',
        attacks: [
          { kind: 'beam', telegraph: 0.8, cooldown: 3, damage: 15, radius: 28, duration: 3, speed: 1.7, shout: 'SPRZĘŻENIE ZWROTNE' },
          { kind: 'wave', telegraph: 0.5, cooldown: 2.2, damage: 28, radius: 20, speed: 16 },
          { kind: 'ring', telegraph: 0.45, cooldown: 1.8, damage: 23, count: 28, speed: 17 },
          { kind: 'zone', telegraph: 0.5, cooldown: 2.2, damage: 25, radius: 6.5, count: 5, duration: 5 },
        ],
      },
    ],
  },
];

export function bossOf(station: string): BossDef | null {
  return BOSSES.find((b) => b.station === station) ?? null;
}
