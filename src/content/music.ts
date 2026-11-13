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

export const TRACKS: Record<'menu' | 'fabryczna', Track> = {
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
};
