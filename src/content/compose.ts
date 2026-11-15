// A small composer for the station and boss loops: every stop and every boss gets its own bass line,
// melody and chords, written from a seed (its id) by a few musical rules, so the line never repeats one
// tune and nothing has to be hand-entered note by note. Output is the same 16-step text the tracks use.

import { hashSeed, Rng } from '../core/rng';

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;

export type ScaleName = keyof typeof SCALES;
/** How the bass moves: driving eighths, octave jumps, walking steps, or a sparse half-time figure. */
export type BassStyle = 'pulse' | 'octave' | 'walk' | 'half';

export interface Song {
  bass: string[];
  lead: string[];
  pad: number[][];
}

export interface SongSpec {
  scale: ScaleName;
  /** Chord roots of the four bars, as scale degrees (0 = the key's root). */
  degrees: [number, number, number, number];
  bass: BassStyle;
  /** Share of the sixteen steps a melody bar fills, 0.25 .. 0.7. */
  density: number;
  /** Lowest melody note, semitones above the root (12 = an octave up). */
  register: number;
}

/** Semitones of scale degree `d` (any integer: wraps into octaves). */
function degree(scale: readonly number[], d: number): number {
  const n = scale.length;
  const oct = Math.floor(d / n);
  return scale[((d % n) + n) % n] + oct * 12;
}

const bar = (steps: (number | null)[]): string => steps.map((s) => (s === null ? '.' : String(s))).join(' ');

export function compose(id: string, spec: SongSpec): Song {
  const rng = new Rng(hashSeed(`song:${id}`));
  const scale = SCALES[spec.scale];
  const roots = spec.degrees.map((d) => degree(scale, d) - (degree(scale, d) > 6 ? 12 : 0));
  // Chords: root, third and fifth of the scale degree (and the seventh), voiced close above the root.
  const pad = spec.degrees.map((d, i) => [roots[i], ...[2, 4, 6].map((k) => degree(scale, d + k) - degree(scale, d) + roots[i])]);

  const bass = roots.map((r, i) => {
    const next = roots[(i + 1) % roots.length];
    const steps: (number | null)[] = new Array<number | null>(16).fill(null);
    switch (spec.bass) {
      case 'pulse':
        for (let s = 0; s < 16; s += 2) steps[s] = r;
        steps[12] = r + 7;
        steps[14] = next + (next > r ? -1 : 1);
        break;
      case 'octave':
        for (let s = 0; s < 16; s += 2) steps[s] = s % 4 === 0 ? r : r + 12;
        if (rng.next() < 0.5) steps[15] = next;
        break;
      case 'walk': {
        const d0 = spec.degrees[i];
        for (let s = 0; s < 16; s += 4) steps[s] = degree(scale, d0 + s / 4) - degree(scale, d0) + r;
        steps[14] = next - 1;
        break;
      }
      case 'half':
        steps[0] = r;
        steps[3] = r;
        steps[8] = r + (rng.next() < 0.5 ? 7 : 12);
        steps[11] = r;
        steps[14] = next;
        break;
    }
    return bar(steps);
  });

  // The melody: a one-bar motif on the chord of each bar, heard as A, A' (new ending), B, A (resolving).
  const rhythm = (): boolean[] => {
    const r: boolean[] = [];
    for (let s = 0; s < 16; s++) r.push(s === 0 || rng.next() < spec.density * (s % 2 === 0 ? 1.4 : 0.6));
    return r;
  };
  const shape = (): number[] => Array.from({ length: 16 }, () => Math.floor(rng.next() * 5) - 1);
  const motifA = { rhythm: rhythm(), shape: shape() };
  const motifB = { rhythm: rhythm(), shape: shape() };
  const line = (m: { rhythm: boolean[]; shape: number[] }, chord: number, vary: boolean, resolve: boolean): string => {
    const steps: (number | null)[] = [];
    let walk = 0;
    for (let s = 0; s < 16; s++) {
      if (!m.rhythm[s]) {
        steps.push(null);
        continue;
      }
      walk += m.shape[s] + (vary && s >= 12 ? 1 : 0);
      walk = Math.max(-1, Math.min(7, walk));
      steps.push(degree(scale, spec.degrees[chord] + walk) - degree(scale, spec.degrees[chord]) + roots[chord] + spec.register);
    }
    if (resolve) {
      for (let s = 15; s >= 12; s--) steps[s] = null;
      steps[12] = spec.register + 12 + roots[0] - (roots[0] > 0 ? 12 : 0);
    }
    return bar(steps);
  };
  const lead = [line(motifA, 0, false, false), line(motifA, 1, true, false), line(motifB, 2, false, false), line(motifA, 3, false, true)];
  return { bass, lead, pad };
}
