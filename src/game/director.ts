// The wave director, after Left 4 Dead's: the run breathes in cycles of build-up, a peak, a fade and a
// breather, instead of one rising line. Pure logic (no Three.js, no DOM), unit tested.
//
// Fairness rule (BALANCE.md): on Normalnie and harder the cycle depends on the seed and the clock only, never on
// how the player is doing, so a seed is the same run for everyone (the codzienny kurs included). Only on
// Spokojny does it read the player's health and the crowd around them, and only to bring a breather forward.

import type { Rng } from '../core/rng';

export type DirectorPhase = 'build' | 'peak' | 'fade' | 'relax';

/** A shape of spawning a peak asks for once, on top of the steady stream. */
export type SpawnPattern = 'ring' | 'wall' | 'ahead' | 'flock';

export interface DirectorTuning {
  /** Seconds each phase lasts: [min, max], drawn from the seed. */
  build: readonly [number, number];
  peak: readonly [number, number];
  fade: readonly [number, number];
  relax: readonly [number, number];
  /** Spawn rate multiplier at the start and end of each phase (linear in between). */
  buildMul: readonly [number, number];
  peakMul: number;
  fadeMul: readonly [number, number];
  relaxMul: number;
  /** Seconds of the run before the first cycle (the opening is its own steady build). */
  start: number;
  /** Reads the player's state (Spokojny only): a peak may end early once intensity passes this. */
  adaptive: boolean;
  intensityPeak: number;
}

const NEXT: Record<DirectorPhase, DirectorPhase> = { build: 'peak', peak: 'fade', fade: 'relax', relax: 'build' };

export class Director {
  phase: DirectorPhase = 'build';
  /** Seconds into the current phase, and how long it lasts. */
  t = 0;
  length = 1;
  /** 0..1+: recent damage taken and the crowd close by, decaying (logged; steers only when adaptive). */
  intensity = 0;
  /** A pattern to spawn now (the game takes it and sets this back to null). */
  pattern: SpawnPattern | null = null;
  cycles = 0;
  private rng: Rng | null = null;
  private tuning: DirectorTuning | null = null;
  private clock = 0;

  reset(rng: Rng, tuning: DirectorTuning): void {
    this.rng = rng;
    this.tuning = tuning;
    this.clock = 0;
    this.cycles = 0;
    this.intensity = 0;
    this.pattern = null;
    this.enter('build');
  }

  private draw(range: readonly [number, number]): number {
    const r = this.rng ? this.rng.next() : 0.5;
    return range[0] + (range[1] - range[0]) * r;
  }

  private enter(phase: DirectorPhase): void {
    const tu = this.tuning;
    if (!tu) return;
    this.phase = phase;
    this.t = 0;
    this.length = this.draw(tu[phase]);
    if (phase === 'peak') {
      const r = this.rng ? this.rng.next() : 0;
      // Every peak opens with a shape the steady stream never makes: a ring closing in, a wall across the way,
      // a group straight ahead, or a flock of one kind. The first one is always the ring: from the first minute,
      // standing still means being surrounded; walking out of it is easy.
      this.pattern = this.cycles <= 1 || r < 0.3 ? 'ring' : r < 0.55 ? 'wall' : r < 0.8 ? 'ahead' : 'flock';
    }
    if (phase === 'build') this.cycles++;
  }

  /**
   * One simulation step. `hurt` is the share of maximum health lost this step, `crowd` the enemies within
   * ten metres. Returns the spawn rate multiplier for this step.
   */
  update(dt: number, hurt: number, crowd: number): number {
    const tu = this.tuning;
    if (!tu) return 1;
    this.clock += dt;
    this.intensity = Math.max(0, this.intensity * Math.exp(-dt / 6) + hurt * 2.5 + Math.max(0, crowd - 8) * 0.004 * dt);
    if (this.clock < tu.start) return tu.buildMul[0] + (tu.buildMul[1] - tu.buildMul[0]) * (this.clock / tu.start);
    this.t += dt;
    const k = Math.min(1, this.t / Math.max(0.01, this.length));
    if (this.phase === 'peak' && tu.adaptive && this.t > tu.peak[0] * 0.5 && this.intensity > tu.intensityPeak) this.enter('fade');
    else if (this.t >= this.length) {
      this.enter(NEXT[this.phase]);
      // A breather on Spokojny lasts until the player has caught their breath (up to twice as long).
      if (this.phase === 'relax' && tu.adaptive && this.intensity > tu.intensityPeak * 0.5) this.length *= 1 + Math.min(1, this.intensity / tu.intensityPeak);
    }
    switch (this.phase) {
      case 'build':
        return tu.buildMul[0] + (tu.buildMul[1] - tu.buildMul[0]) * k;
      case 'peak':
        return tu.peakMul;
      case 'fade':
        return tu.fadeMul[0] + (tu.fadeMul[1] - tu.fadeMul[0]) * k;
      case 'relax':
        return tu.relaxMul;
    }
  }
}
