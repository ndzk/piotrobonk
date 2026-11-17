// What happened in a run, for the death screen ("Co cię zajebało": the last hits, who and how) and for the
// balance simulation (scripts/sim.ts: damage taken and dealt over time, healing, low-health moments, the boss).
// Fixed-size buffers only: the game loop records into it every step and allocates nothing.

/** Who hurt Piotrek and with what, e.g. { who: 'Kanar', what: 'Szarża' }. Made once per kind of hit. */
export interface HitSource {
  who: string;
  what: string;
}

export interface HitRecord {
  source: HitSource;
  damage: number;
  /** Run time of the hit, seconds. */
  time: number;
  /** Health left after it. */
  hp: number;
}

/** Seconds per bucket of the curves (damage dealt, enemy health spawned, damage taken, healing). */
export const BUCKET = 30;
const BUCKETS = 48;
const HITS = 8;

export type HealKind = 'regen' | 'food' | 'lifesteal' | 'card' | 'other';

export class RunLog {
  /** The last HITS hits, oldest first once read through `lastHits`. */
  private readonly hits: HitRecord[] = Array.from({ length: HITS }, () => ({ source: { who: '', what: '' }, damage: 0, time: 0, hp: 0 }));
  private hitN = 0;
  readonly dealt = new Float32Array(BUCKETS);
  readonly spawnedHp = new Float32Array(BUCKETS);
  readonly taken = new Float32Array(BUCKETS);
  readonly healed = new Float32Array(BUCKETS);
  readonly heal: Record<HealKind, number> = { regen: 0, food: 0, lifesteal: 0, card: 0, other: 0 };
  damageTaken = 0;
  damageDealt = 0;
  /** Damage of every hit before it is capped at what the enemy had left (a weapon's raw power). */
  rawDealt = 0;
  hitCount = 0;
  /** Times health fell below 30 % (counted again only after it climbed back over 45 %). */
  lowEpisodes = 0;
  private low = false;
  minHp = 1;
  /** Health share when the boss came in, and when the fight started and ended (run seconds, −1 = not yet). */
  bossHp = -1;
  bossFrom = -1;
  bossTo = -1;
  firstEvolution = -1;
  evolutions = 0;
  elites = 0;
  /** Damage taken per source this run (an entry is made the first time a source lands a hit). */
  readonly bySource = new Map<HitSource, { hits: number; damage: number }>();

  reset(): void {
    this.hitN = 0;
    this.dealt.fill(0);
    this.spawnedHp.fill(0);
    this.taken.fill(0);
    this.healed.fill(0);
    for (const k of Object.keys(this.heal) as HealKind[]) this.heal[k] = 0;
    this.damageTaken = this.damageDealt = this.hitCount = this.rawDealt = 0;
    this.lowEpisodes = 0;
    this.low = false;
    this.minHp = 1;
    this.bossHp = this.bossFrom = this.bossTo = -1;
    this.firstEvolution = -1;
    this.evolutions = 0;
    this.elites = 0;
    this.bySource.clear();
  }

  private bucket(time: number): number {
    return Math.min(BUCKETS - 1, Math.max(0, Math.floor(time / BUCKET)));
  }

  hit(source: HitSource, damage: number, time: number, hp: number, maxHp: number): void {
    const r = this.hits[this.hitN % HITS];
    r.source = source;
    r.damage = damage;
    r.time = time;
    r.hp = hp;
    this.hitN++;
    this.hitCount++;
    this.damageTaken += damage;
    this.taken[this.bucket(time)] += damage;
    let by = this.bySource.get(source);
    if (!by) {
      by = { hits: 0, damage: 0 };
      this.bySource.set(source, by);
    }
    by.hits++;
    by.damage += damage;
    this.health(hp, maxHp);
  }

  /** Health changed (hits and heals both report here). */
  health(hp: number, maxHp: number): void {
    const share = Math.max(0, hp) / Math.max(1, maxHp);
    this.minHp = Math.min(this.minHp, share);
    if (!this.low && share < 0.3) {
      this.low = true;
      this.lowEpisodes++;
    } else if (this.low && share > 0.45) this.low = false;
  }

  healedBy(kind: HealKind, amount: number, time: number): void {
    if (amount <= 0) return;
    this.heal[kind] += amount;
    this.healed[this.bucket(time)] += amount;
  }

  dealtDamage(amount: number, time: number): void {
    this.damageDealt += amount;
    this.dealt[this.bucket(time)] += amount;
  }

  spawned(hp: number, time: number): void {
    this.spawnedHp[this.bucket(time)] += hp;
  }

  /** The last `n` hits, newest first. Allocates: only for the death screen and the simulation's report. */
  lastHits(n = 5): HitRecord[] {
    const out: HitRecord[] = [];
    for (let k = 1; k <= Math.min(n, this.hitN, HITS); k++) out.push({ ...this.hits[(this.hitN - k) % HITS] });
    return out;
  }
}
