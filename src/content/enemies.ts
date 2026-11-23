// Enemy types. Speeds in m/s, radius in metres; hp is the base value before the time multiplier.

export type EnemyId =
  | 'golab'
  | 'szczur'
  | 'robotnik'
  | 'zlomiarz'
  | 'autobus'
  | 'kontroler'
  | 'lemur'
  | 'pasazer'
  | 'kibic'
  | 'hulajnoga'
  | 'paczkomat'
  | 'paczka'
  | 'ochroniarz'
  | 'brygadzista'
  | 'janusz'
  | 'dachowiec'
  | 'kanar-nocny';

/** A thrower: stops at `keep` metres, raises the thing for `windup` seconds (the warning), then throws it. */
export interface ShotDef {
  range: number;
  keep: number;
  windup: number;
  cooldown: number;
  speed: number;
  damage: number;
}

/** A dash: closes to `trigger` metres, paints its lane for `windup` seconds, then goes straight for `time` s. */
export interface DashDef {
  trigger: number;
  windup: number;
  speed: number;
  time: number;
  rest: number;
}

/** A leap: closes to `trigger` metres, crouches, then lands on the spot Piotrek stood on (marked as it flies). */
export interface JumpDef {
  trigger: number;
  crouch: number;
  air: number;
  radius: number;
  damage: number;
  rest: number;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  bestiary: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  /** Spawned in groups of this size. */
  group: number;
  /** Seconds into the run before this type appears, and its share of spawns afterwards. */
  from: number;
  weight: number;
  flying: boolean;
  /** Knockback resistance 0..1. */
  heavy: number;
  /** Colours used by the model and its death chunks. */
  palette: string[];
  /** Half extents across and along the body, for things that are nothing like a circle (the bus). */
  box?: [number, number];
  /** collector: goes for bottles on the ground first; charger: winds up, then charges in a straight line;
   * boss: driven by the boss controller, not by the chase AI; courier: runs to the boss with a delivery
   * (the finale's lemurs bring Bartek his coffee); sprinter: runs faster than Piotrek in bursts, then has to
   * catch its breath; shooter, dasher, jumper: see `shot`, `dash`, `jump`; buffer: drives the crowd around it
   * (`buffs`) from behind; night: the last train's inspectors, who cannot be stopped. */
  behavior?: 'collector' | 'charger' | 'boss' | 'courier' | 'sprinter' | 'shooter' | 'dasher' | 'jumper' | 'buffer' | 'night';
  shot?: ShotDef;
  dash?: DashDef;
  jump?: JumpDef;
  /** Enemies within `radius` move `speed` times faster and take `armor` less damage. */
  buffs?: { radius: number; speed: number; armor: number };
  /** Share of a hit from in front that the shield takes. */
  shield?: number;
  /** Breaks into smaller enemies when it dies. */
  splits?: { into: EnemyId; count: number };
  /** Leaves a lit charge where it dies: a marked circle that goes off after `telegraph` seconds. */
  explodes?: { radius: number; damage: number; telegraph: number };
  /** What its own attack is called on the death screen (the shot, the dash, the leap, the blast). */
  attack?: string;
}

export const ENEMIES: EnemyDef[] = [
  {
    id: 'golab',
    name: 'Gołąb dworcowy',
    bestiary: 'Szybki, bezczelny, zawsze w stadzie. Na Fabrycznej mają abonament.',
    hp: 10,
    speed: 4.8,
    damage: 5,
    radius: 0.34,
    xp: 1,
    group: 4,
    from: 0,
    weight: 4,
    flying: true,
    heavy: 0,
    palette: ['#8f96a3', '#5d6573', '#6fb39a', '#e6893b'],
  },
  {
    id: 'szczur',
    name: 'Szczur z torowiska',
    bestiary: 'Mieszka pod podkładami. Odkąd nie ma szyn, ma więcej miejsca i więcej czasu.',
    hp: 20,
    speed: 3.6,
    damage: 7,
    radius: 0.4,
    xp: 1,
    group: 3,
    from: 20,
    weight: 4,
    flying: false,
    heavy: 0.1,
    palette: ['#4f525c', '#43464f', '#e8a3a3', '#2b2321'],
  },
  {
    id: 'robotnik',
    name: 'Robotnik w kamizelce',
    bestiary: 'Ma łopatę, kamizelkę i przerwę od 2019 roku. Ciężki, ale powolny.',
    hp: 69,
    speed: 2.5,
    damage: 11,
    radius: 0.5,
    xp: 4,
    group: 1,
    from: 110,
    weight: 1.4,
    flying: false,
    heavy: 0.6,
    palette: ['#ff8a1e', '#2f3a52', '#e9b99e', '#d9dde3'],
  },
  {
    id: 'zlomiarz',
    name: 'Złomiarz z wózkiem',
    bestiary: 'Zbiera butelki szybciej niż ty. Za twoje szyny ma już nowy wózek.',
    hp: 51,
    speed: 2.7,
    damage: 8,
    radius: 0.55,
    xp: 3,
    group: 1,
    from: 60,
    weight: 0.9,
    flying: false,
    heavy: 0.5,
    palette: ['#5f6e3f', '#3b3f45', '#c9cdd2', '#8a5a3b'],
    behavior: 'collector',
  },
  {
    id: 'autobus',
    name: 'Autobus ZKA',
    bestiary: 'Zastępcza Komunikacja Autobusowa. Jedzie prosto, nie zatrzymuje się i nikt nie wie dokąd. Na rozpędzie przejeżdża na śmierć.',
    hp: 360,
    speed: 17,
    // It passes through more than once: three full hits took a whole health bar at four minutes.
    damage: 18,
    radius: 1.5,
    xp: 40,
    group: 1,
    from: 9999,
    weight: 0,
    flying: false,
    heavy: 1,
    palette: ['#ffd23a', '#f2f2f2', '#2a3448', '#e2362c'],
    behavior: 'charger',
  },
  {
    id: 'kontroler',
    name: 'Kanar',
    bestiary: 'Bilet do kontroli. Tak, ten za 20 minut też. Chodzi parami i nie odpuszcza.',
    hp: 57,
    speed: 3.1,
    damage: 10,
    radius: 0.48,
    xp: 4,
    group: 2,
    from: 150,
    weight: 1,
    flying: false,
    heavy: 0.4,
    palette: ['#2b3a5c', '#1d2333', '#e9b99e', '#ffd23a'],
  },
  {
    id: 'pasazer',
    name: 'Spóźniony pasażer',
    bestiary: 'Biegnie na pociąg, którego nie ma. Szybszy od ciebie, ale co kilka sekund musi złapać oddech.',
    hp: 24,
    speed: 7.8,
    damage: 8,
    radius: 0.42,
    xp: 2,
    group: 2,
    from: 75,
    weight: 0.5,
    flying: false,
    heavy: 0.1,
    palette: ['#3c4250', '#2b2f3a', '#e9b99e', '#c8323a'],
    behavior: 'sprinter',
  },
  {
    id: 'kibic',
    name: 'Kibic z racą',
    bestiary: 'Na mecz nie zdążył, racę ma. Zatrzymuje się z daleka, podnosi ją nad głowę i rzuca.',
    hp: 39,
    speed: 3.1,
    damage: 6,
    radius: 0.45,
    xp: 3,
    group: 2,
    // Early on purpose: the flare goes where Piotrek stood, so it punishes standing still and nothing else.
    from: 50,
    weight: 0.6,
    flying: false,
    heavy: 0.3,
    palette: ['#1e1e22', '#d8263a', '#f2f2ee', '#ffcf5a'],
    behavior: 'shooter',
    shot: { range: 13, keep: 9, windup: 1, cooldown: 4.2, speed: 10, damage: 7 },
    attack: 'Raca',
  },
  {
    id: 'janusz',
    name: 'Janusz z petardą',
    bestiary: 'Sylwester trwa u niego cały rok. Kiedy padnie, petarda zostaje na ziemi i za chwilę wybucha.',
    hp: 30,
    speed: 3.8,
    damage: 7,
    radius: 0.45,
    xp: 2,
    group: 2,
    from: 120,
    weight: 0.8,
    flying: false,
    heavy: 0.2,
    palette: ['#2b3b8f', '#f2f2ee', '#e9b99e', '#d8263a'],
    explodes: { radius: 2.6, damage: 12, telegraph: 0.9 },
    attack: 'Petarda',
  },
  {
    id: 'hulajnoga',
    name: 'Kurier na hulajnodze',
    bestiary: 'Dowozi w 15 minut albo przejeżdża. Staje, celuje, maluje się przed nim czerwony pas i rusza.',
    hp: 45,
    speed: 3.6,
    damage: 12,
    radius: 0.5,
    xp: 3,
    group: 1,
    from: 140,
    weight: 0.7,
    flying: false,
    heavy: 0.4,
    palette: ['#c9f21e', '#14a37f', '#20242c', '#e9b99e'],
    behavior: 'dasher',
    dash: { trigger: 11, windup: 0.9, speed: 15, time: 1.1, rest: 1.3 },
    attack: 'Szarża',
  },
  {
    id: 'dachowiec',
    name: 'Dachowiec',
    bestiary: 'Kot z dachu dworca. Przykuca, a potem spada dokładnie tam, gdzie przed chwilą stali Piotrek. Dach go nie zatrzyma.',
    hp: 24,
    speed: 5,
    damage: 8,
    radius: 0.36,
    xp: 2,
    group: 2,
    from: 150,
    weight: 0.8,
    flying: false,
    heavy: 0.1,
    palette: ['#c4783a', '#7a4a22', '#f2e6d0', '#b8ff4a'],
    behavior: 'jumper',
    jump: { trigger: 9, crouch: 0.45, air: 0.8, radius: 1.5, damage: 11, rest: 1.2 },
    attack: 'Skok z dachu',
  },
  {
    id: 'paczkomat',
    name: 'Paczkomat na nóżkach',
    bestiary: 'Odebrał wszystkie paczki naraz. Rozbity rozsypuje się na trzy paczki, a te gonią szybciej niż on.',
    hp: 105,
    speed: 2.2,
    damage: 12,
    radius: 0.65,
    xp: 5,
    group: 1,
    from: 170,
    weight: 0.55,
    flying: false,
    heavy: 0.7,
    palette: ['#ffcc19', '#c9ccd2', '#2a2a2e', '#3cff8c'],
    splits: { into: 'paczka', count: 3 },
  },
  {
    id: 'paczka',
    name: 'Paczka z paczkomatu',
    bestiary: 'Nadana priorytetem. Mała, szybka i bardzo zdeterminowana, żeby dotrzeć do adresata.',
    hp: 18,
    speed: 5.4,
    damage: 6,
    radius: 0.32,
    xp: 1,
    group: 1,
    from: 9999,
    weight: 0,
    flying: false,
    heavy: 0.1,
    palette: ['#c49a62', '#e8d9a8', '#ffcc19', '#2a2a2e'],
  },
  {
    id: 'ochroniarz',
    name: 'Ochroniarz z tarczą',
    bestiary: 'Pilnuje Biedronki i ciebie. Z przodu tarcza bierze prawie wszystko: zajdź go z boku albo z góry.',
    hp: 90,
    speed: 2.9,
    damage: 13,
    radius: 0.55,
    xp: 5,
    group: 1,
    from: 200,
    weight: 0.6,
    flying: false,
    heavy: 0.75,
    palette: ['#18191d', '#9fc7e8', '#2a3a52', '#f2f2ee'],
    shield: 0.8,
  },
  {
    id: 'brygadzista',
    name: 'Brygadzista z megafonem',
    bestiary: 'Sam nie pracuje, ale wokół niego wszyscy biegają szybciej i dostają mniej. Trzyma się za tłumem.',
    hp: 82,
    speed: 2.6,
    damage: 9,
    radius: 0.5,
    xp: 6,
    group: 1,
    from: 230,
    weight: 0.35,
    flying: false,
    heavy: 0.5,
    palette: ['#e2362c', '#ffe36a', '#f6f6f2', '#3a4256'],
    behavior: 'buffer',
    buffs: { radius: 7, speed: 1.3, armor: 0.3 },
  },
  {
    id: 'kanar-nocny',
    name: 'Nocny Kanar',
    bestiary: 'Kontroluje ostatni pociąg. Nie da się go zatrzymać, przekonać ani zgubić. Trzeba zdążyć przed nim.',
    hp: 999999,
    speed: 6.2,
    damage: 26,
    radius: 0.5,
    xp: 0,
    group: 1,
    from: 9999,
    weight: 0,
    flying: false,
    heavy: 1,
    palette: ['#121625', '#0d0f16', '#c9a63a', '#ff3a2a'],
    behavior: 'night',
  },
  {
    id: 'lemur',
    name: 'Lemur z dolewką',
    bestiary: 'Technicznie kopi luwak robi łaskun, ale Bartek się uparł, że lemur.',
    hp: 34,
    // Slow enough that running out to meet them works: about five seconds from the edge of the fight.
    speed: 3.6,
    damage: 6,
    radius: 0.42,
    xp: 3,
    group: 1,
    from: 9999,
    weight: 0,
    flying: false,
    heavy: 0.2,
    palette: ['#8c8f98', '#efefea', '#1b1b1b', '#ff9a2a'],
    behavior: 'courier',
  },
];
