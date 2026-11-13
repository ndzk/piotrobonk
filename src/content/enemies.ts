// Enemy types. Speeds in m/s, radius in metres; hp is the base value before the time multiplier.

export type EnemyId = 'golab' | 'szczur' | 'robotnik' | 'zlomiarz' | 'autobus';

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
  /** collector: goes for bottles on the ground first; charger: winds up, then charges in a straight line. */
  behavior?: 'collector' | 'charger';
}

export const ENEMIES: EnemyDef[] = [
  {
    id: 'golab',
    name: 'Gołąb dworcowy',
    bestiary: 'Szybki, bezczelny, zawsze w stadzie. Na Fabrycznej mają abonament.',
    hp: 7,
    speed: 4.4,
    damage: 5,
    radius: 0.34,
    xp: 1,
    group: 5,
    from: 0,
    weight: 5,
    flying: true,
    heavy: 0,
    palette: ['#8f96a3', '#5d6573', '#6fb39a', '#e6893b'],
  },
  {
    id: 'szczur',
    name: 'Szczur z torowiska',
    bestiary: 'Mieszka pod podkładami. Odkąd nie ma szyn, ma więcej miejsca i więcej czasu.',
    hp: 13,
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
    hp: 46,
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
    hp: 34,
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
    bestiary: 'Zastępcza Komunikacja Autobusowa. Jedzie prosto, nie zatrzymuje się i nikt nie wie dokąd.',
    hp: 520,
    speed: 17,
    damage: 28,
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
];
