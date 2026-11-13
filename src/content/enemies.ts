// Enemy types. Speeds in m/s, radius in metres; hp is the base value before the time multiplier.

export type EnemyId = 'golab' | 'szczur' | 'robotnik';

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
    palette: ['#6b5a50', '#4a3d36', '#e8a3a3', '#2b2321'],
  },
  {
    id: 'robotnik',
    name: 'Robotnik w kamizelce',
    bestiary: 'Ma łopatę, kamizelkę i przerwę od 2019 roku. Ciężki, ale powolny.',
    hp: 46,
    speed: 2.5,
    damage: 13,
    radius: 0.5,
    xp: 4,
    group: 1,
    from: 110,
    weight: 1.4,
    flying: false,
    heavy: 0.6,
    palette: ['#ff8a1e', '#2f3a52', '#e9b99e', '#d9dde3'],
  },
];
