// Synthesised sound effects (jsfxr style). Each sound is one or more layers rendered once at load.
// Frequencies in Hz, times in seconds; `to` slides the pitch exponentially, `steps` jumps it (arpeggio).

export type Wave = 'square' | 'saw' | 'sine' | 'triangle' | 'noise';

export interface SfxLayer {
  wave: Wave;
  from: number;
  to?: number;
  attack?: number;
  sustain: number;
  decay: number;
  /** Extra loudness at the start of the sustain, 0..1. */
  punch?: number;
  duty?: number;
  vibrato?: [depth: number, speed: number];
  lowpass?: number;
  lowpassTo?: number;
  highpass?: number;
  volume: number;
  delay?: number;
  /** Arpeggio: multiply the pitch at these times. */
  steps?: [time: number, mul: number][];
}

export interface SfxDef {
  layers: SfxLayer[];
  /** Random pitch variation per play (0.08 = ±8%). */
  vary: number;
  /** At most this many copies at once, and not more often than every `gap` seconds. */
  voices: number;
  gap: number;
  bus: 'sfx' | 'ui';
}

export type SfxId =
  | 'jump'
  | 'step'
  | 'land'
  | 'slide'
  | 'swing'
  | 'hit'
  | 'crit'
  | 'enemyDie'
  | 'pigeonDie'
  | 'coin'
  | 'levelUp'
  | 'hover'
  | 'pick'
  | 'reroll'
  | 'banish'
  | 'skip'
  | 'hurt'
  | 'die'
  | 'click'
  | 'back'
  | 'pause'
  | 'start'
  | 'slam'
  | 'slamLand'
  | 'elite'
  | 'summary'
  | 'toast'
  | 'shot'
  | 'throw'
  | 'zap'
  | 'whistle'
  | 'boom'
  | 'splash'
  | 'bottle'
  | 'chestOpen'
  | 'evolve'
  | 'brew'
  | 'brewDone'
  | 'binBreak'
  | 'eat'
  | 'horn'
  | 'denied'
  | 'shotHeavy'
  | 'shotAuto'
  | 'tick'
  | 'reveal'
  | 'revealRare'
  | 'revealGold'
  | 'sell'
  | 'equip'
  | 'deposit'
  | 'caseOpen'
  | 'contract'
  | 'blip'
  | 'ring'
  | 'slap'
  | 'shatter'
  | 'sip'
  | 'lemur'
  | 'clink'
  | 'door';

export const SFX: Record<SfxId, SfxDef> = {
  jump: { layers: [{ wave: 'square', from: 240, to: 520, attack: 0.004, sustain: 0.04, decay: 0.11, duty: 0.3, lowpass: 3200, volume: 0.22 }], vary: 0.06, voices: 2, gap: 0.05, bus: 'sfx' },
  step: { layers: [{ wave: 'noise', from: 700, to: 220, sustain: 0.01, decay: 0.06, lowpass: 900, volume: 0.22 }], vary: 0.2, voices: 2, gap: 0.1, bus: 'sfx' },
  land: { layers: [{ wave: 'noise', from: 900, to: 160, sustain: 0.02, decay: 0.12, lowpass: 1600, volume: 0.45 }], vary: 0.1, voices: 2, gap: 0.08, bus: 'sfx' },
  slide: { layers: [{ wave: 'noise', from: 2200, to: 600, attack: 0.02, sustain: 0.18, decay: 0.25, lowpass: 3000, lowpassTo: 700, volume: 0.32 }], vary: 0.05, voices: 1, gap: 0.2, bus: 'sfx' },
  swing: { layers: [{ wave: 'noise', from: 3200, to: 700, attack: 0.03, sustain: 0.05, decay: 0.12, highpass: 500, lowpass: 5000, lowpassTo: 1500, volume: 0.3 }], vary: 0.12, voices: 3, gap: 0.04, bus: 'sfx' },
  hit: {
    layers: [
      { wave: 'noise', from: 1400, to: 260, sustain: 0.015, decay: 0.07, lowpass: 2500, volume: 0.4 },
      { wave: 'square', from: 190, to: 80, sustain: 0.02, decay: 0.06, duty: 0.4, lowpass: 1400, volume: 0.22 },
    ],
    vary: 0.18,
    voices: 5,
    gap: 0.025,
    bus: 'sfx',
  },
  crit: {
    layers: [
      { wave: 'square', from: 700, to: 160, sustain: 0.03, decay: 0.13, duty: 0.5, lowpass: 3500, volume: 0.28, punch: 0.4 },
      { wave: 'noise', from: 2000, to: 300, sustain: 0.03, decay: 0.12, lowpass: 3000, volume: 0.4 },
    ],
    vary: 0.08,
    voices: 2,
    gap: 0.05,
    bus: 'sfx',
  },
  enemyDie: {
    layers: [
      { wave: 'noise', from: 800, to: 90, sustain: 0.03, decay: 0.2, lowpass: 2000, lowpassTo: 400, volume: 0.42 },
      { wave: 'square', from: 260, to: 70, sustain: 0.02, decay: 0.14, duty: 0.25, lowpass: 1200, volume: 0.18 },
    ],
    vary: 0.15,
    voices: 4,
    gap: 0.03,
    bus: 'sfx',
  },
  pigeonDie: {
    layers: [
      { wave: 'square', from: 820, to: 1350, sustain: 0.03, decay: 0.07, duty: 0.2, lowpass: 4000, volume: 0.16 },
      { wave: 'noise', from: 3000, to: 900, sustain: 0.02, decay: 0.12, highpass: 900, lowpass: 6000, volume: 0.3, delay: 0.02 },
    ],
    vary: 0.15,
    voices: 4,
    gap: 0.03,
    bus: 'sfx',
  },
  coin: {
    layers: [
      { wave: 'square', from: 1320, sustain: 0.035, decay: 0.16, duty: 0.25, lowpass: 7000, volume: 0.14, steps: [[0.045, 1.335]] },
      { wave: 'sine', from: 2640, sustain: 0.02, decay: 0.12, volume: 0.06, steps: [[0.045, 1.335]] },
    ],
    vary: 0.04,
    voices: 4,
    gap: 0.025,
    bus: 'sfx',
  },
  levelUp: {
    layers: [
      { wave: 'square', from: 523, sustain: 0.36, decay: 0.3, duty: 0.35, lowpass: 5000, volume: 0.2, steps: [[0.08, 1.26], [0.16, 1.5], [0.24, 2]] },
      { wave: 'triangle', from: 262, sustain: 0.36, decay: 0.35, volume: 0.25, steps: [[0.08, 1.26], [0.16, 1.5], [0.24, 2]] },
    ],
    vary: 0,
    voices: 1,
    gap: 0.3,
    bus: 'sfx',
  },
  hover: { layers: [{ wave: 'square', from: 880, sustain: 0.012, decay: 0.03, duty: 0.5, lowpass: 3000, volume: 0.08 }], vary: 0.03, voices: 2, gap: 0.03, bus: 'ui' },
  pick: {
    layers: [{ wave: 'square', from: 660, sustain: 0.06, decay: 0.16, duty: 0.4, lowpass: 4500, volume: 0.2, steps: [[0.05, 1.5]] }],
    vary: 0,
    voices: 1,
    gap: 0.1,
    bus: 'ui',
  },
  reroll: {
    layers: [
      { wave: 'noise', from: 600, to: 3000, attack: 0.02, sustain: 0.08, decay: 0.1, lowpass: 5000, volume: 0.22 },
      { wave: 'square', from: 300, to: 900, sustain: 0.08, decay: 0.08, duty: 0.3, lowpass: 3000, volume: 0.12 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.1,
    bus: 'ui',
  },
  banish: { layers: [{ wave: 'saw', from: 520, to: 90, sustain: 0.12, decay: 0.22, lowpass: 2400, volume: 0.22 }], vary: 0, voices: 1, gap: 0.1, bus: 'ui' },
  skip: { layers: [{ wave: 'square', from: 500, to: 350, sustain: 0.04, decay: 0.08, duty: 0.4, lowpass: 3000, volume: 0.14 }], vary: 0, voices: 1, gap: 0.1, bus: 'ui' },
  hurt: {
    layers: [
      { wave: 'saw', from: 330, to: 90, sustain: 0.05, decay: 0.2, lowpass: 1800, volume: 0.32, punch: 0.3 },
      { wave: 'noise', from: 1200, to: 200, sustain: 0.04, decay: 0.15, lowpass: 2000, volume: 0.3 },
    ],
    vary: 0.06,
    voices: 1,
    gap: 0.12,
    bus: 'sfx',
  },
  die: {
    layers: [
      { wave: 'saw', from: 420, to: 38, sustain: 0.5, decay: 0.7, lowpass: 2000, lowpassTo: 300, volume: 0.32, vibrato: [0.08, 7] },
      { wave: 'noise', from: 600, to: 60, sustain: 0.2, decay: 0.6, lowpass: 900, volume: 0.25 },
    ],
    vary: 0,
    voices: 1,
    gap: 1,
    bus: 'sfx',
  },
  click: { layers: [{ wave: 'square', from: 620, sustain: 0.02, decay: 0.05, duty: 0.5, lowpass: 3500, volume: 0.14 }], vary: 0.02, voices: 2, gap: 0.03, bus: 'ui' },
  back: { layers: [{ wave: 'square', from: 420, to: 300, sustain: 0.03, decay: 0.07, duty: 0.5, lowpass: 3000, volume: 0.14 }], vary: 0, voices: 1, gap: 0.05, bus: 'ui' },
  pause: { layers: [{ wave: 'triangle', from: 440, to: 330, sustain: 0.06, decay: 0.15, volume: 0.25 }], vary: 0, voices: 1, gap: 0.1, bus: 'ui' },
  slam: { layers: [{ wave: 'noise', from: 600, to: 2600, attack: 0.05, sustain: 0.08, decay: 0.1, lowpass: 4000, volume: 0.25 }], vary: 0.05, voices: 1, gap: 0.2, bus: 'sfx' },
  slamLand: {
    layers: [
      { wave: 'sine', from: 140, to: 40, sustain: 0.06, decay: 0.3, volume: 0.6, punch: 0.5 },
      { wave: 'noise', from: 900, to: 120, sustain: 0.05, decay: 0.3, lowpass: 1400, volume: 0.45 },
    ],
    vary: 0.05,
    voices: 1,
    gap: 0.2,
    bus: 'sfx',
  },
  elite: {
    layers: [
      { wave: 'saw', from: 220, sustain: 0.18, decay: 0.12, lowpass: 1600, volume: 0.25, steps: [[0.2, 1.06]] },
      { wave: 'saw', from: 330, sustain: 0.18, decay: 0.12, lowpass: 1600, volume: 0.18, steps: [[0.2, 1.06]] },
    ],
    vary: 0,
    voices: 1,
    gap: 1,
    bus: 'sfx',
  },
  summary: {
    layers: [
      { wave: 'square', from: 392, sustain: 0.9, decay: 0.6, duty: 0.4, lowpass: 2200, volume: 0.16, vibrato: [0.015, 5], steps: [[0.22, 0.944], [0.44, 0.891], [0.66, 0.749]] },
      { wave: 'triangle', from: 196, sustain: 0.9, decay: 0.7, volume: 0.22, steps: [[0.22, 0.944], [0.44, 0.891], [0.66, 0.749]] },
    ],
    vary: 0,
    voices: 1,
    gap: 1,
    bus: 'sfx',
  },
  toast: { layers: [{ wave: 'triangle', from: 880, sustain: 0.05, decay: 0.12, volume: 0.2, steps: [[0.06, 1.25]] }], vary: 0, voices: 1, gap: 0.3, bus: 'ui' },
  shot: {
    layers: [
      { wave: 'noise', from: 3000, to: 400, sustain: 0.01, decay: 0.09, lowpass: 5000, volume: 0.32, punch: 0.6 },
      { wave: 'square', from: 220, to: 60, sustain: 0.01, decay: 0.05, duty: 0.5, lowpass: 1200, volume: 0.18 },
    ],
    vary: 0.06,
    voices: 3,
    gap: 0.04,
    bus: 'sfx',
  },
  throw: { layers: [{ wave: 'noise', from: 1200, to: 2600, attack: 0.02, sustain: 0.03, decay: 0.08, highpass: 400, lowpass: 4000, volume: 0.2 }], vary: 0.12, voices: 2, gap: 0.06, bus: 'sfx' },
  zap: {
    layers: [
      { wave: 'saw', from: 1400, to: 300, sustain: 0.04, decay: 0.12, lowpass: 6000, volume: 0.16, vibrato: [0.3, 60] },
      { wave: 'noise', from: 6000, to: 2000, sustain: 0.03, decay: 0.1, highpass: 1500, volume: 0.22 },
    ],
    vary: 0.1,
    voices: 2,
    gap: 0.05,
    bus: 'sfx',
  },
  whistle: { layers: [{ wave: 'sine', from: 2300, sustain: 0.28, decay: 0.12, volume: 0.22, vibrato: [0.04, 32] }], vary: 0.03, voices: 1, gap: 0.3, bus: 'sfx' },
  boom: {
    layers: [
      { wave: 'noise', from: 900, to: 60, sustain: 0.05, decay: 0.35, lowpass: 1800, lowpassTo: 300, volume: 0.5, punch: 0.6 },
      { wave: 'sine', from: 110, to: 35, sustain: 0.05, decay: 0.3, volume: 0.45 },
    ],
    vary: 0.1,
    voices: 3,
    gap: 0.05,
    bus: 'sfx',
  },
  splash: { layers: [{ wave: 'noise', from: 2500, to: 500, sustain: 0.02, decay: 0.2, lowpass: 3500, volume: 0.25 }], vary: 0.15, voices: 2, gap: 0.08, bus: 'sfx' },
  bottle: {
    layers: [
      { wave: 'triangle', from: 1760, sustain: 0.02, decay: 0.25, volume: 0.22, steps: [[0.03, 1.5]] },
      { wave: 'sine', from: 3520, sustain: 0.01, decay: 0.18, volume: 0.1 },
    ],
    vary: 0.06,
    voices: 3,
    gap: 0.03,
    bus: 'sfx',
  },
  chestOpen: {
    layers: [
      { wave: 'square', from: 392, sustain: 0.45, decay: 0.5, duty: 0.3, lowpass: 4000, volume: 0.18, steps: [[0.1, 1.26], [0.2, 1.5], [0.3, 2]] },
      { wave: 'noise', from: 4000, to: 9000, attack: 0.3, sustain: 0.1, decay: 0.4, highpass: 2000, volume: 0.15 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.5,
    bus: 'sfx',
  },
  evolve: {
    layers: [
      { wave: 'saw', from: 196, sustain: 0.9, decay: 0.8, lowpass: 3000, volume: 0.18, steps: [[0.15, 1.26], [0.3, 1.5], [0.45, 2], [0.6, 2.52]] },
      { wave: 'square', from: 392, sustain: 0.9, decay: 0.8, duty: 0.25, lowpass: 5000, volume: 0.12, steps: [[0.15, 1.26], [0.3, 1.5], [0.45, 2], [0.6, 2.52]] },
      { wave: 'noise', from: 8000, to: 2000, attack: 0.5, sustain: 0.3, decay: 0.6, highpass: 3000, volume: 0.12 },
    ],
    vary: 0,
    voices: 1,
    gap: 1,
    bus: 'sfx',
  },
  brew: { layers: [{ wave: 'noise', from: 400, to: 900, attack: 0.1, sustain: 0.3, decay: 0.2, lowpass: 1500, volume: 0.18 }], vary: 0.05, voices: 1, gap: 0.6, bus: 'sfx' },
  brewDone: { layers: [{ wave: 'triangle', from: 880, sustain: 0.06, decay: 0.3, volume: 0.25, steps: [[0.08, 1.335], [0.16, 1.5]] }], vary: 0, voices: 1, gap: 0.5, bus: 'sfx' },
  binBreak: {
    layers: [
      { wave: 'noise', from: 1600, to: 200, sustain: 0.03, decay: 0.25, lowpass: 3000, volume: 0.45, punch: 0.4 },
      { wave: 'square', from: 180, to: 90, sustain: 0.03, decay: 0.15, duty: 0.3, lowpass: 900, volume: 0.2 },
    ],
    vary: 0.1,
    voices: 2,
    gap: 0.05,
    bus: 'sfx',
  },
  eat: { layers: [{ wave: 'noise', from: 900, to: 400, sustain: 0.04, decay: 0.08, lowpass: 2000, volume: 0.3, steps: [[0.12, 1.1], [0.24, 0.9]] }], vary: 0.1, voices: 1, gap: 0.3, bus: 'sfx' },
  horn: {
    layers: [
      { wave: 'saw', from: 233, sustain: 0.55, decay: 0.15, lowpass: 1400, volume: 0.25 },
      { wave: 'saw', from: 294, sustain: 0.55, decay: 0.15, lowpass: 1400, volume: 0.2 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.8,
    bus: 'sfx',
  },
  denied: { layers: [{ wave: 'square', from: 220, to: 180, sustain: 0.08, decay: 0.08, duty: 0.5, lowpass: 1500, volume: 0.18, steps: [[0.1, 0.8]] }], vary: 0, voices: 1, gap: 0.2, bus: 'ui' },
  start: {
    layers: [
      { wave: 'square', from: 392, sustain: 0.3, decay: 0.4, duty: 0.25, lowpass: 3000, volume: 0.16, steps: [[0.1, 1.335], [0.2, 1.5]] },
      { wave: 'noise', from: 5000, to: 800, attack: 0.15, sustain: 0.1, decay: 0.3, lowpass: 4000, volume: 0.12 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.5,
    bus: 'ui',
  },
  // Gnat z CS by weapon class: a deep boom for snipers, Deagles and shotguns, a short crack for automatics.
  shotHeavy: {
    layers: [
      { wave: 'noise', from: 2200, to: 180, sustain: 0.02, decay: 0.28, lowpass: 3800, volume: 0.42, punch: 0.8 },
      { wave: 'sine', from: 130, to: 38, sustain: 0.03, decay: 0.22, volume: 0.45, punch: 0.6 },
    ],
    vary: 0.05,
    voices: 2,
    gap: 0.08,
    bus: 'sfx',
  },
  shotAuto: {
    layers: [
      { wave: 'noise', from: 4200, to: 900, sustain: 0.006, decay: 0.05, lowpass: 6000, highpass: 300, volume: 0.24, punch: 0.5 },
      { wave: 'square', from: 260, to: 90, sustain: 0.005, decay: 0.03, duty: 0.5, lowpass: 1500, volume: 0.12 },
    ],
    vary: 0.08,
    voices: 4,
    gap: 0.03,
    bus: 'sfx',
  },
  // Recyklomat and cases (UI bus: they play in the hub, over the menu music).
  tick: { layers: [{ wave: 'square', from: 1900, sustain: 0.004, decay: 0.02, duty: 0.3, lowpass: 6000, volume: 0.12 }], vary: 0.02, voices: 3, gap: 0.012, bus: 'ui' },
  reveal: {
    layers: [{ wave: 'square', from: 523, sustain: 0.12, decay: 0.3, duty: 0.35, lowpass: 4000, volume: 0.16, steps: [[0.07, 1.5]] }],
    vary: 0,
    voices: 1,
    gap: 0.2,
    bus: 'ui',
  },
  revealRare: {
    layers: [
      { wave: 'square', from: 392, sustain: 0.5, decay: 0.6, duty: 0.25, lowpass: 5000, volume: 0.17, steps: [[0.1, 1.26], [0.2, 1.5], [0.3, 2], [0.4, 2.52]] },
      { wave: 'noise', from: 6000, to: 9000, attack: 0.2, sustain: 0.2, decay: 0.5, highpass: 3000, volume: 0.12 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.5,
    bus: 'ui',
  },
  revealGold: {
    layers: [
      { wave: 'saw', from: 262, sustain: 1.1, decay: 1, lowpass: 3600, volume: 0.288, steps: [[0.12, 1.26], [0.24, 1.5], [0.36, 2], [0.5, 2.52], [0.66, 3]] },
      { wave: 'square', from: 523, sustain: 1.1, decay: 1, duty: 0.2, lowpass: 6000, volume: 0.18, vibrato: [0.01, 7], steps: [[0.12, 1.26], [0.24, 1.5], [0.36, 2], [0.5, 2.52], [0.66, 3]] },
      { wave: 'noise', from: 9000, to: 3000, attack: 0.4, sustain: 0.4, decay: 0.8, highpass: 3500, volume: 0.234 },
    ],
    vary: 0,
    voices: 1,
    gap: 1,
    bus: 'ui',
  },
  sell: {
    layers: [
      { wave: 'square', from: 1046, sustain: 0.03, decay: 0.12, duty: 0.25, lowpass: 7000, volume: 0.13, steps: [[0.05, 1.335], [0.1, 1.5]] },
      { wave: 'triangle', from: 1760, sustain: 0.02, decay: 0.2, volume: 0.12, delay: 0.12 },
    ],
    vary: 0.02,
    voices: 2,
    gap: 0.08,
    bus: 'ui',
  },
  equip: {
    layers: [
      { wave: 'noise', from: 2500, to: 600, sustain: 0.01, decay: 0.07, lowpass: 5000, volume: 0.22, punch: 0.5 },
      { wave: 'square', from: 330, to: 660, sustain: 0.04, decay: 0.08, duty: 0.4, lowpass: 3000, volume: 0.12, delay: 0.05 },
    ],
    vary: 0.03,
    voices: 1,
    gap: 0.1,
    bus: 'ui',
  },
  deposit: {
    layers: [
      { wave: 'noise', from: 900, to: 300, sustain: 0.05, decay: 0.12, lowpass: 2200, volume: 0.25, punch: 0.4 },
      { wave: 'triangle', from: 1568, sustain: 0.02, decay: 0.2, volume: 0.14, steps: [[0.03, 1.5]], delay: 0.06 },
    ],
    vary: 0.1,
    voices: 3,
    gap: 0.05,
    bus: 'ui',
  },
  caseOpen: {
    layers: [
      { wave: 'noise', from: 800, to: 2400, attack: 0.05, sustain: 0.12, decay: 0.2, lowpass: 3000, volume: 0.22 },
      { wave: 'square', from: 196, sustain: 0.05, decay: 0.15, duty: 0.5, lowpass: 1200, volume: 0.16, delay: 0.18, punch: 0.6 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.3,
    bus: 'ui',
  },
  contract: {
    layers: [
      { wave: 'noise', from: 3000, to: 6000, attack: 0.01, sustain: 0.18, decay: 0.12, highpass: 1500, lowpass: 7000, volume: 0.14 },
      { wave: 'square', from: 262, sustain: 0.2, decay: 0.3, duty: 0.3, lowpass: 3000, volume: 0.14, steps: [[0.1, 1.5]], delay: 0.2 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.4,
    bus: 'ui',
  },
  // The story: speech blips, the video call ringing, the finale's sip, the lemur, the slap and the cup.
  blip: { layers: [{ wave: 'square', from: 520, sustain: 0.018, decay: 0.03, duty: 0.4, lowpass: 2600, volume: 0.07 }], vary: 0.08, voices: 2, gap: 0.035, bus: 'ui' },
  ring: {
    layers: [
      { wave: 'sine', from: 880, sustain: 0.32, decay: 0.05, volume: 0.14, vibrato: [0.06, 22] },
      { wave: 'sine', from: 1320, sustain: 0.32, decay: 0.05, volume: 0.08, vibrato: [0.06, 22] },
      { wave: 'sine', from: 880, sustain: 0.32, decay: 0.1, volume: 0.14, vibrato: [0.06, 22], delay: 0.5 },
      { wave: 'sine', from: 1320, sustain: 0.32, decay: 0.1, volume: 0.08, vibrato: [0.06, 22], delay: 0.5 },
    ],
    vary: 0,
    voices: 1,
    gap: 1,
    bus: 'ui',
  },
  sip: {
    layers: [
      { wave: 'noise', from: 1400, to: 600, attack: 0.04, sustain: 0.18, decay: 0.12, lowpass: 2200, highpass: 300, volume: 0.22 },
      { wave: 'sine', from: 380, to: 300, attack: 0.05, sustain: 0.12, decay: 0.1, volume: 0.12, delay: 0.1 },
    ],
    vary: 0.06,
    voices: 1,
    gap: 0.4,
    bus: 'sfx',
  },
  lemur: {
    layers: [{ wave: 'square', from: 1500, to: 2400, sustain: 0.05, decay: 0.08, duty: 0.3, lowpass: 5000, volume: 0.224, steps: [[0.06, 0.8], [0.1, 1.3]] }],
    vary: 0.12,
    voices: 2,
    gap: 0.12,
    bus: 'sfx',
  },
  slap: {
    layers: [
      { wave: 'noise', from: 5000, to: 900, sustain: 0.015, decay: 0.16, highpass: 600, volume: 0.9, punch: 1 },
      { wave: 'sine', from: 180, to: 60, sustain: 0.02, decay: 0.2, volume: 0.675, punch: 0.8 },
    ],
    vary: 0,
    voices: 1,
    gap: 0.3,
    bus: 'sfx',
  },
  shatter: {
    layers: [
      { wave: 'noise', from: 9000, to: 3000, sustain: 0.04, decay: 0.45, highpass: 2500, volume: 0.56, punch: 0.6 },
      { wave: 'triangle', from: 3520, sustain: 0.02, decay: 0.3, volume: 0.192, steps: [[0.04, 1.26], [0.09, 0.84], [0.15, 1.5]] },
      { wave: 'triangle', from: 2637, sustain: 0.02, decay: 0.35, volume: 0.16, delay: 0.07, steps: [[0.05, 1.33], [0.12, 0.9]] },
    ],
    vary: 0.03,
    voices: 1,
    gap: 0.5,
    bus: 'sfx',
  },
  // A hit his coffee shield soaked: porcelain ringing instead of a thud.
  clink: {
    layers: [
      { wave: 'triangle', from: 2900, to: 2750, sustain: 0.01, decay: 0.18, volume: 0.13 },
      { wave: 'sine', from: 4350, sustain: 0.005, decay: 0.1, volume: 0.06 },
    ],
    vary: 0.08,
    voices: 2,
    gap: 0.12,
    bus: 'sfx',
  },
  // The train door: a pneumatic hiss and the thunk of it sliding home.
  door: {
    layers: [
      { wave: 'noise', from: 6000, to: 3000, attack: 0.05, sustain: 0.35, decay: 0.3, highpass: 1800, volume: 0.22 },
      { wave: 'sine', from: 140, to: 90, sustain: 0.03, decay: 0.12, volume: 0.25, delay: 0.55 },
    ],
    vary: 0.02,
    voices: 1,
    gap: 0.4,
    bus: 'sfx',
  },
};
