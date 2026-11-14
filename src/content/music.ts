// Procedural music loops. Patterns are 16 steps per bar; tokens are semitones above the root ('.' = rest).
// Layers switch on by intensity (0 = calm .. 3 = full), which rises during a run.

export interface Track {
  id: string;
  bpm: number;
  /** Root note in Hz. */
  root: number;
  swing: number;
  drive: number;
  kick: string[];
  clap: string[];
  hat: string[];
  open: string[];
  bass: string[];
  lead: string[];
  /** Chord per bar for the pad, semitones above the root. */
  pad: number[][];
  /** Minimum intensity at which each part plays. */
  from: { kick: number; clap: number; hat: number; open: number; bass: number; lead: number; pad: number };
}

export const TRACKS: Record<'menu' | 'fabryczna' | 'boss' | 'cleared' | 'bartek' | 'ending', Track> = {
  menu: {
    id: 'menu',
    bpm: 92,
    root: 55,
    swing: 0.12,
    drive: 0.15,
    kick: ['x.........x.....', 'x.........x..x..'],
    clap: ['....x.......x...'],
    hat: ['..x...x...x...x.'],
    open: ['................'],
    bass: ['0 . . . . . . . -2 . . . . . . .', '-4 . . . . . . . -5 . . . -2 . . .'],
    lead: ['24 . . 19 . . 22 . . . 19 . 17 . . .', '. . . . . . . . . . . . . . . .', '24 . . 19 . . 22 . . . 26 . 24 . . .', '. . . . . . . . . . . . . . . .'],
    pad: [
      [0, 3, 7, 12],
      [-2, 2, 5, 10],
      [-4, 0, 3, 8],
      [-5, -1, 2, 7],
    ],
    from: { kick: 0, clap: 1, hat: 0, open: 9, bass: 0, lead: 0, pad: 0 },
  },
  fabryczna: {
    id: 'fabryczna',
    bpm: 126,
    root: 55,
    swing: 0.04,
    drive: 0.55,
    kick: ['x...x...x...x...'],
    clap: ['....x.......x...'],
    hat: ['..x...x...x...x.', '..x...x...x.x.x.'],
    open: ['..............x.', '......x.......x.'],
    bass: [
      '0 . 0 . 0 . 3 . 0 . 0 . 5 . 3 .',
      '0 . 0 . 0 . 3 . 0 . 7 . 5 . 3 .',
      '-2 . -2 . -2 . 1 . -2 . -2 . 3 . 1 .',
      '-4 . -4 . -4 . 0 . -4 . 3 . 0 . -1 .',
    ],
    lead: [
      '12 . 15 . 19 . 15 . 12 . 15 . 19 . 22 .',
      '24 . 22 . 19 . 15 . 19 . 15 . 12 . 15 .',
      '10 . 13 . 17 . 13 . 10 . 13 . 17 . 22 .',
      '8 . 12 . 15 . 12 . 15 . 19 . 22 . 23 .',
    ],
    pad: [
      [0, 3, 7],
      [0, 3, 7],
      [-2, 1, 5],
      [-4, 0, 3],
    ],
    from: { kick: 0, clap: 1, hat: 0, open: 2, bass: 1, lead: 3, pad: 0 },
  },
  // Boss: faster, nastier, all four layers from the first bar.
  boss: {
    id: 'boss',
    bpm: 148,
    root: 49,
    swing: 0,
    drive: 0.75,
    kick: ['x...x...x...x..x', 'x...x...x..xx...'],
    clap: ['....x.......x...', '....x...x...x..x'],
    hat: ['x.x.x.x.x.x.x.x.'],
    open: ['......x.......x.', '..x...x...x...x.'],
    bass: [
      '0 0 . 0 -2 . 0 . 3 . 0 . -2 . 0 .',
      '0 0 . 0 -4 . 0 . 5 . 3 . 0 . -2 .',
      '-5 -5 . -5 -2 . -5 . 0 . -2 . -5 . -7 .',
      '-4 -4 . -4 0 . -4 . 3 . 0 . -4 . -5 .',
    ],
    lead: [
      '12 . 12 15 . 12 . 19 . 17 . 15 . 12 . .',
      '24 . . 22 . 19 . 22 . 24 . 27 . 24 . .',
      '7 . 7 10 . 7 . 15 . 12 . 10 . 7 . .',
      '8 . 12 . 15 . 20 . 19 . 15 . 12 . 8 .',
    ],
    pad: [
      [0, 3, 7, 10],
      [0, 3, 7, 10],
      [-5, -2, 2, 5],
      [-4, 0, 3, 7],
    ],
    from: { kick: 0, clap: 0, hat: 0, open: 0, bass: 0, lead: 0, pad: 0 },
  },
  // After the fight: the rails go back, the line works again.
  cleared: {
    id: 'cleared',
    bpm: 104,
    root: 58,
    swing: 0.1,
    drive: 0.1,
    kick: ['x.......x.......'],
    clap: ['....x.......x...'],
    hat: ['..x...x...x...x.'],
    open: ['................'],
    bass: ['0 . . . 7 . . . 5 . . . 3 . . .'],
    lead: ['12 . 16 . 19 . 24 . 19 . 16 . 12 . . .', '. . . . 14 . 17 . 21 . 17 . 14 . . .'],
    pad: [
      [0, 4, 7, 11],
      [2, 5, 9, 12],
      [-3, 0, 4, 7],
      [-5, -1, 2, 7],
    ],
    from: { kick: 0, clap: 0, hat: 0, open: 9, bass: 0, lead: 0, pad: 0 },
  },
  // Bartek D. under Dino: a smug, swung lounge groove gone sour, in his sitting tempo; it never lets up.
  bartek: {
    id: 'bartek',
    bpm: 118,
    root: 46,
    swing: 0.22,
    drive: 0.6,
    kick: ['x.....x...x.....', 'x.....x...x..x..'],
    clap: ['....x.......x...', '....x.......x.xx'],
    hat: ['x.xxx.xxx.xxx.xx'],
    open: ['..x.......x.....'],
    bass: [
      '0 . . 0 7 . 6 . 5 . . 3 . . 2 .',
      '0 . . 0 7 . 6 . 5 . 3 . 1 . -1 .',
      '-2 . . -2 5 . 4 . 3 . . 1 . . 0 .',
      '-4 . . -4 3 . 2 . 1 . -1 . -2 . -5 .',
    ],
    lead: [
      '19 . 18 . 15 . . 13 . 15 . . 18 . 19 .',
      '22 . . 19 . 18 . 15 . . 13 . 12 . . .',
      '17 . 16 . 13 . . 11 . 13 . . 16 . 17 .',
      '20 . . 19 . 17 . 15 . 13 . 12 . 11 . .',
    ],
    pad: [
      [0, 3, 6, 10],
      [0, 3, 6, 10],
      [-2, 1, 5, 8],
      [-4, -1, 3, 6],
    ],
    from: { kick: 0, clap: 0, hat: 0, open: 1, bass: 0, lead: 0, pad: 0 },
  },
  // The end: rails back, the train in, home. Major, wide and slow, for the boarding and the credits.
  ending: {
    id: 'ending',
    bpm: 96,
    root: 55,
    swing: 0.06,
    drive: 0.05,
    kick: ['x.......x.......', 'x.......x...x...'],
    clap: ['....x.......x...'],
    hat: ['..x...x...x...x.'],
    open: ['..............x.'],
    bass: ['0 . . . . . 7 . 5 . . . . . 4 .', '-3 . . . . . 4 . 2 . . . . . 0 .', '-7 . . . . . 0 . -2 . . . . . -3 .', '-5 . . . . . 2 . 0 . . . . . 2 .'],
    lead: [
      '16 . . 19 . . 24 . 23 . . 19 . 16 . .',
      '12 . . 16 . . 21 . 19 . . 16 . 14 . .',
      '9 . . 12 . . 17 . 16 . . 12 . 9 . .',
      '11 . . 14 . . 19 . 17 . 14 . 12 . 11 .',
    ],
    pad: [
      [0, 4, 7, 11],
      [-3, 0, 4, 9],
      [-7, -3, 0, 4],
      [-5, -1, 2, 7],
    ],
    from: { kick: 0, clap: 1, hat: 0, open: 2, bass: 0, lead: 0, pad: 0 },
  },
};

/**
 * Every boss gets its own fight loop: the shared boss skeleton in its own key and tempo, with its own
 * drums. Bartek D. has a theme of his own (`TRACKS.bartek`).
 */
const bossTrack = (id: string, over: Partial<Track>): Track => ({ ...TRACKS.boss, id: `boss-${id}`, ...over });

export const BOSS_TRACKS: Record<string, Track> = {
  biletomat: bossTrack('biletomat', { bpm: 140, root: 52, drive: 0.6, hat: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.xxx.x.'] }),
  pajeczyca: bossTrack('pajeczyca', { bpm: 152, root: 47, swing: 0.08, open: ['...x......x.....'], clap: ['....x.......x..x'] }),
  kanar: bossTrack('kanar', { bpm: 146, root: 55, drive: 0.8, kick: ['x...x...x...x...', 'x...x...x.x.x...'] }),
  'krol-zlomu': bossTrack('krol-zlomu', { bpm: 138, root: 44, drive: 0.9, kick: ['x..xx...x..x....'], hat: ['x...x...x...x...'] }),
  zka: bossTrack('zka', { bpm: 156, root: 50, drive: 0.7, open: ['..x...x...x...x.'] }),
  'golab-matka': bossTrack('golab-matka', { bpm: 150, root: 53, swing: 0.1, hat: ['x.xxx.x.x.xxx.x.'] }),
  kierownik: bossTrack('kierownik', { bpm: 142, root: 45, drive: 0.85, clap: ['....x...x...x...'] }),
  megafon: bossTrack('megafon', { bpm: 160, root: 51, drive: 0.8, kick: ['x...x...x...x..x', 'xx..x...x...x...'] }),
  bartek: TRACKS.bartek,
};

export const trackForBoss = (id: string): Track => BOSS_TRACKS[id] ?? TRACKS.boss;

/**
 * One loop per station. They share the Fabryczna skeleton (so everything still sounds like one game) and
 * differ in tempo, key, drive and in a couple of swapped patterns, which is enough to give each stop its
 * own mood: the mill clatters, Widzew is big and open, the scrapyard is heavy, Koluszki is late and tired.
 */
const stationTrack = (id: string, over: Partial<Track>): Track => ({ ...TRACKS.fabryczna, id, ...over });

export const STATION_TRACKS: Record<string, Track> = {
  fabryczna: TRACKS.fabryczna,
  niciarniana: stationTrack('niciarniana', {
    bpm: 132,
    root: 58,
    drive: 0.7,
    // Loom clatter: busy hats, a stuttering kick.
    kick: ['x...x..x.x..x...'],
    hat: ['x.xxx.x.x.xxx.x.'],
    open: ['....x.......x..x'],
    from: { kick: 0, clap: 0, hat: 0, open: 3, bass: 1, lead: 2, pad: 0 },
  }),
  widzew: stationTrack('widzew', {
    bpm: 128,
    root: 52,
    drive: 0.4,
    clap: ['....x.......x..x'],
    pad: [
      [0, 5, 7, 12],
      [-2, 3, 7, 10],
      [-4, 0, 5, 7],
      [-5, -1, 2, 7],
    ],
    from: { kick: 0, clap: 1, hat: 0, open: 2, bass: 0, lead: 2, pad: 0 },
  }),
  andrzejow: stationTrack('andrzejow', {
    bpm: 120,
    root: 45,
    drive: 0.85,
    // Scrapyard: heavy, metallic, half-time.
    kick: ['x.....x...x.....'],
    clap: ['........x.......'],
    hat: ['..x...x...x...x.'],
    bass: ['0 . . 0 . . 3 . 0 . . -2 . . 0 .', '0 . . 0 . . 5 . 3 . . 0 . . -4 .'],
    from: { kick: 0, clap: 0, hat: 1, open: 2, bass: 0, lead: 3, pad: 1 },
  }),
  bedon: stationTrack('bedon', {
    bpm: 124,
    root: 49,
    swing: 0.08,
    drive: 0.45,
    hat: ['..x...x...x.x.x.'],
    from: { kick: 0, clap: 1, hat: 0, open: 4, bass: 1, lead: 4, pad: 0 },
  }),
  justynow: stationTrack('justynow', {
    bpm: 112,
    root: 55,
    swing: 0.14,
    drive: 0.3,
    // Allotments at dusk: sparse, almost friendly.
    kick: ['x.......x.......'],
    hat: ['....x.......x...'],
    from: { kick: 0, clap: 2, hat: 1, open: 9, bass: 0, lead: 2, pad: 0 },
  }),
  galkowek: stationTrack('galkowek', {
    bpm: 136,
    root: 47,
    drive: 0.8,
    kick: ['x...x...x...x.x.'],
    open: ['..x...x...x...x.'],
    from: { kick: 0, clap: 1, hat: 0, open: 1, bass: 0, lead: 2, pad: 1 },
  }),
  zakowice: stationTrack('zakowice', {
    bpm: 118,
    root: 44,
    drive: 0.55,
    clap: ['....x..x....x...'],
    pad: [
      [0, 3, 7, 10],
      [-1, 2, 6, 9],
      [-3, 0, 4, 7],
      [-5, -2, 2, 5],
    ],
    from: { kick: 0, clap: 1, hat: 0, open: 3, bass: 1, lead: 3, pad: 0 },
  }),
  koluszki: stationTrack('koluszki', {
    bpm: 108,
    root: 41,
    swing: 0.1,
    drive: 0.35,
    // The end of the line, after midnight.
    kick: ['x.......x...x...'],
    hat: ['..x...x...x...x.'],
    open: ['..............x.'],
    from: { kick: 0, clap: 2, hat: 1, open: 6, bass: 0, lead: 4, pad: 0 },
  }),
};

export const trackForStation = (id: string): Track => STATION_TRACKS[id] ?? TRACKS.fabryczna;
