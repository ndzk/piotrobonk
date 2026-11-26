// Bunny hop points, after the drift points of an MTA server (JBB_drift-points): a chain of bunny hops scores by
// the speed carried through the air, a multiplier grows with the score, the chain is banked once Piotrek stay on
// the ground, and a hit loses it. Only the HUD and the journal's record read it: it changes nothing in the run, so
// it is cosmetic (outside the simulation state, like the particles).

import { TUNING } from '../content/tuning';

/** What `step` reports, for the sound: nothing, the chain banked, the multiplier went up. */
export const BHOP_NONE = 0;
export const BHOP_BANK = 1;
export const BHOP_MULT = 2;

export class BhopCombo {
  readonly cosmetic = true;
  /** Points of the chain in progress (or of the one just banked or lost, while the panel still shows it). */
  score = 0;
  mult = 1;
  /** Bunny hops in the chain in progress (0: no chain). */
  hops = 0;
  /** The best chain ever (the save's record), the last banked one and this run's total. */
  best = 0;
  last = 0;
  total = 0;
  /** The last chain ended in a hit (the panel turns red). */
  lost = false;
  /** Seconds the panel stays up. */
  showFor = 0;
  private ground = 0;
  private sinceMult = 0;

  /** A new run: no chain, the record from the save. */
  reset(best: number): void {
    this.score = this.total = this.last = this.hops = this.showFor = this.ground = this.sinceMult = 0;
    this.mult = 1;
    this.lost = false;
    this.best = best;
  }

  /** Piotrek jumped; `bhop`: right on landing (TUNING.player.bhopWindow), the jump that keeps the speed. */
  jump(bhop: boolean): void {
    if (!bhop) return;
    if (this.hops === 0) {
      this.score = 0;
      this.mult = 1;
      this.sinceMult = 0;
      this.lost = false;
    }
    this.hops++;
  }

  /** Piotrek touched down. */
  land(): void {
    this.ground = 0;
  }

  /** A hit: the chain in progress is lost. */
  fail(): void {
    if (this.hops === 0) return;
    this.hops = 0;
    this.score = 0;
    this.mult = 1;
    this.lost = true;
    this.showFor = TUNING.bhop.show;
  }

  /** One simulation step: points in the air, the multiplier, the bank after `endAfter` on the ground. */
  step(dt: number, onGround: boolean, speed: number): number {
    const B = TUNING.bhop;
    this.showFor = Math.max(0, this.showFor - dt);
    if (this.hops === 0) return BHOP_NONE;
    if (onGround) {
      this.ground += dt;
      if (this.ground >= B.endAfter) return this.bank();
    } else {
      this.score += speed * dt * B.points * this.mult;
      this.showFor = B.show;
    }
    this.sinceMult += dt;
    if (this.mult > 1 && speed <= B.slow && this.sinceMult > B.multDrop) {
      this.mult--;
      this.sinceMult = 0;
    } else if (this.sinceMult > B.multEvery) {
      let m = 1;
      for (const at of B.mults) if (this.score >= at) m++;
      if (m > this.mult) {
        this.mult = m;
        this.sinceMult = 0;
        return BHOP_MULT;
      }
    }
    return BHOP_NONE;
  }

  private bank(): number {
    this.hops = 0;
    this.score = Math.floor(this.score);
    this.last = this.score;
    this.total += this.score;
    this.best = Math.max(this.best, this.score);
    this.showFor = TUNING.bhop.show;
    return BHOP_BANK;
  }
}
