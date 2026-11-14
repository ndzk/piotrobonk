// The finale's two small machines, pure so they can be tested: Bartek's cup of kopi luwak (his shield,
// his healing and his rage) and the slap's timing bar.

import { TUNING } from '../content/tuning';
import type { Rng } from '../core/rng';

type Finale = typeof TUNING.finale;

/** Bartek's cup: 0 empty, 1 full. Full, he is almost untouchable; every sip heals him and speeds him up. */
export class Coffee {
  level: number;
  private sipTimer: number;
  private buffTimer = 0;
  private lemurTimer: number;

  constructor(private readonly t: Finale = TUNING.finale) {
    this.level = t.coffeeStart;
    this.sipTimer = t.sipEvery[0];
    this.lemurTimer = t.lemurEvery[0];
  }

  /** Share of a hit that gets through right now. */
  get taken(): number {
    return 1 - this.t.shield * this.level;
  }

  /** A sip is still kicking in (his attacks come faster). */
  get buffed(): boolean {
    return this.buffTimer > 0;
  }

  /**
   * One step. Returns 'sip' when he drinks (heal him and play it), 'lemurs' when it is time to send for a
   * refill (spawn `lemurCount` of them), or null.
   */
  update(dt: number, phase: number): 'sip' | 'lemurs' | null {
    const p = Math.min(phase, this.t.sipEvery.length - 1);
    this.buffTimer = Math.max(0, this.buffTimer - dt);
    this.lemurTimer -= dt;
    if (this.lemurTimer <= 0) {
      this.lemurTimer = this.t.lemurEvery[p];
      return 'lemurs';
    }
    this.sipTimer -= dt;
    if (this.sipTimer > 0) return null;
    this.sipTimer = this.t.sipEvery[p];
    // An empty cup: nothing to sip, so no heal and no rage.
    if (this.level <= 0.02) return null;
    this.level = Math.max(0, this.level - this.t.sip);
    this.buffTimer = this.t.buffTime;
    return 'sip';
  }

  lemurs(phase: number): number {
    return this.t.lemurCount[Math.min(phase, this.t.lemurCount.length - 1)];
  }

  /** A lemur got through with a refill. */
  refill(): void {
    this.level = Math.min(1, this.level + this.t.refill);
  }
}

/**
 * The slap's timing bar: a cursor sweeps back and forth, and a press inside the yellow window lands it.
 * Every miss moves the window and makes it wider, so nobody is stuck here forever.
 */
export class SlapBar {
  /** Cursor position, 0..1. */
  pos = 0;
  private dir = 1;
  /** Window centre and width, as shares of the bar. */
  centre = 0.5;
  width: number;
  misses = 0;

  constructor(
    private readonly rng: Rng,
    private readonly t: Finale = TUNING.finale,
  ) {
    this.width = t.qteWindow;
    this.place();
  }

  private place(): void {
    // Keep it off the very ends, where the cursor turns round.
    this.centre = this.width / 2 + 0.08 + this.rng.next() * (1 - this.width - 0.16);
  }

  update(dt: number): void {
    this.pos += this.dir * dt * this.t.qteSpeed * 2;
    if (this.pos >= 1) {
      this.pos = 2 - this.pos;
      this.dir = -1;
    } else if (this.pos <= 0) {
      this.pos = -this.pos;
      this.dir = 1;
    }
  }

  /** The player pressed: true if it landed. A miss widens and moves the window. */
  press(): boolean {
    if (Math.abs(this.pos - this.centre) <= this.width / 2) return true;
    this.misses++;
    this.width = Math.min(this.t.qteMax, this.width + this.t.qteGrow);
    this.place();
    return false;
  }
}
