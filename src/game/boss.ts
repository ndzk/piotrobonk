// The station boss: one enemy in the usual pool (so every weapon hits it normally) driven by this
// controller instead of the chase AI. Phases come from src/content/bosses.ts; every attack is telegraphed
// first, then it lands.

import type { Attack, AttackEffect, BossDef, Phase } from '../content/bosses';
import { TUNING } from '../content/tuning';
import type { EnemyDef } from '../content/enemies';
import type { Rng } from '../core/rng';
import type { Enemies } from './enemies';

/** The boss as an enemy type: its body, health and contact damage live in the normal enemy pool. */
export function bossEnemyDef(def: BossDef): EnemyDef {
  return {
    id: def.id as EnemyDef['id'],
    name: def.name,
    bestiary: def.bestiary,
    hp: def.hp,
    speed: def.speed,
    damage: 18,
    radius: def.radius,
    xp: def.xp,
    group: 1,
    from: 9999,
    weight: 0,
    flying: false,
    heavy: 1,
    palette: def.palette,
    box: def.box,
    behavior: 'boss',
  };
}

/** An attack's identity: its name (phases carry attacks over as new objects), else its kind. */
function attackKey(a: Attack): string {
  return a.name ?? a.kind;
}

/** What the "never a third time" rule counts an attack as (a combo as the attack it opens with). */
function repeatKey(a: Attack): string {
  return a.repeatAs ?? attackKey(a);
}

/** What the boss asks the game to do; the game owns the particles, sound and spawning. */
export interface BossWorld {
  /** Marks a circle on the ground for `telegraph` seconds, then hits everything inside it. */
  slam(x: number, z: number, radius: number, damage: number, telegraph: number, effect?: AttackEffect): void;
  /** Fires one projectile from the boss. */
  shot(x: number, y: number, z: number, dirX: number, dirZ: number, speed: number, damage: number, color: string, look?: 'rail' | 'spool'): void;
  /** A damaging ring expanding from (x, z). */
  wave(x: number, z: number, radius: number, damage: number, speed: number, effect?: AttackEffect): void;
  /** A circle that stays dangerous for `duration` seconds. */
  zone(x: number, z: number, radius: number, damage: number, duration: number, telegraph: number, effect?: AttackEffect): void;
  /** The scrap king's magnet: pulls Piotrek in and their bottles out, for `duration` seconds. */
  magnet(duration: number): void;
  /** A sweeping beam anchored at the boss. */
  beam(angle: number, length: number, damage: number, duration: number, speed: number, telegraph: number): void;
  /** Calls in ordinary enemies around the boss. */
  summon(id: string, count: number, x: number, z: number): void;
  /** Wind-up ring around the boss, for attacks that have no ground shape of their own. */
  windUp(x: number, z: number, radius: number, seconds: number, color: string): void;
  /** Hazard strip painted along a charge before the boss runs down it. */
  lane(x: number, z: number, angle: number, length: number, width: number, seconds: number): void;
  /** Banner text over the fight ('' clears it). */
  shout(text: string): void;
  /** Difficulty: multiplies the pause between attacks (below 1 = the boss presses harder). */
  pace: number;
  /** Difficulty: multiplies every warning (never below what a step out of it takes, see TUNING.boss). */
  telegraph: number;
  /** Multiplies its walking speed (an enraged boss). */
  speed: number;
  /** Running speed, for the escape rule: a slam aimed at Piotrek warns long enough to run out of. */
  runSpeed: number;
  /** Seconds of stun Piotrek still have (warnings wait it out). */
  stunLeft: number;
  /** The attack being announced or landing right now (what its hazards are blamed on). */
  attack: Attack | null;
  /** Phase change: new phase index (0-based) and its shout. */
  phase(index: number): void;
  /** The arena closes in to the barrier ring for the rest of the fight. */
  closeArena(): void;
  ground(x: number, z: number, y: number): number;
  /** Pushes a boss-sized cylinder out of the walls it overlaps; writes the result to collideX/collideZ. */
  collide(x: number, y: number, z: number, r: number): void;
  collideX: number;
  collideZ: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  arenaRadius: number;
}

/**
 * The extra phase of the harder kursy: the last phase's attacks, the strongest ones of every earlier phase and two
 * new combos, faster, with less pause, and the boss's last word.
 */
function lastPhase(def: BossDef): Phase {
  const last = def.phases[def.phases.length - 1];
  const extra: Attack[] = [];
  // Phases carry attacks over as new objects: an attack counts as already there by its name (attackKey).
  const have = new Set(last.attacks.map(attackKey));
  for (const p of def.phases.slice(0, -1)) {
    const fresh = p.attacks.filter((a) => !have.has(attackKey(a)));
    if (!fresh.length) continue;
    const strongest = fresh.reduce((a, b) => (b.damage * (b.count ?? 1) > a.damage * (a.count ?? 1) ? b : a));
    extra.push(strongest);
    have.add(attackKey(strongest));
  }
  // And two attacks of its own: an opening attack chained straight into one of the last phase's, under a new name.
  const first = def.phases[0].attacks;
  const ends = last.attacks.filter((a) => !a.then);
  const combos: Attack[] = [];
  for (let k = 0; k < 2 && ends.length && first.length; k++) {
    const a = first[k % first.length];
    // Never an attack chained into itself (the last phase carries the opening attacks over too).
    const others = ends.filter((x) => attackKey(x) !== attackKey(a));
    if (!others.length) continue;
    const b = others[(k * 2) % others.length];
    combos.push({ ...a, then: { ...b }, name: `${attackKey(a)} i ${attackKey(b)}`, repeatAs: attackKey(a) });
  }
  return { at: TUNING.boss.extraAt, speed: last.speed * 1.15, pause: last.pause * 0.75, attacks: [...last.attacks, ...extra, ...combos], shout: def.lastWord };
}

/** The most zones one attack lays, where they went (to keep barriers apart), and the gap between two barriers. */
const MAX_ZONES = 8;
const zoneX = new Float32Array(MAX_ZONES);
const zoneZ = new Float32Array(MAX_ZONES);
const BARRIER_GAP = 2.5;

/** How fast a boss runs down its charge lane, and how wide that lane is. */
const CHARGE_SPEED = 17;
const CHARGE_WIDTH = 5;
/** How fast a boss climbs after Piotrek, and how fast it drops back down. */
const CLIMB_SPEED = 3.4;
const FALL_SPEED = 12;

export class Boss {
  /**
   * Index in the enemy pool, or -1 when the boss is gone. The pool compacts itself when anything dies,
   * so this index is only valid for the uid below: always go through `find()`.
   */
  index = -1;
  /** Stable id of the boss in the pool; the index moves, this does not. */
  private uid = -1;
  readonly def: BossDef;
  private phaseIndex = 0;
  private timer = 0;
  private attackIndex = 0;
  /** The attack being wound up, with the time left before it lands. */
  private winding: Attack | null = null;
  private windLeft = 0;
  private windAngle = 0;
  /** Set while the boss is running down a charge lane. */
  private chargeLeft = 0;
  /** Seconds spent at a height Piotrek is not at (a viaduct, a roof). */
  private strandedFor = 0;
  /** Seconds of walking into something, and how long it may ignore walls after that. */
  private blockedFor = 0;
  private ignoreWalls = 0;
  private chargeX = 0;
  private chargeZ = 0;
  /** Seconds left of a phase change, untouchable; and a hit that reached the next phase's threshold. */
  private shieldLeft = 0;
  private gate = false;
  /** The last attack's name and how many times in a row it came, combo follow-ups and phase changes included (never a third time). */
  private last = '';
  private repeats = 0;
  /** The phase's attacks drawn since the bag was last emptied, one bit each (see `start`). */
  private bag = 0;
  /** Damage the boss takes at full weight right now (refills at `rate` a second; see `limit`). */
  private budget = 0;
  private rate = Infinity;
  private dead = false;

  /** The phases of this fight: the boss's own, plus the extra one on Opóźnienie 120 min and up. */
  private readonly phases: Phase[];

  constructor(
    def: BossDef,
    private readonly enemies: Enemies,
    private readonly world: BossWorld,
    private readonly rng: Rng,
    extraPhase = false,
  ) {
    this.def = def;
    this.phases = extraPhase ? [...def.phases, lastPhase(def)] : def.phases;
  }

  /** How many phases this fight has. */
  get phaseCount(): number {
    return this.phases.length;
  }

  get phase(): Phase {
    return this.phases[this.phaseIndex];
  }

  /** 0-based index of the current phase. */
  get phaseNumber(): number {
    return this.phaseIndex;
  }

  /** Seconds left of a charge down its lane (0 when not charging), and its direction (the bot reads these). */
  get chargeTime(): number {
    return this.chargeLeft;
  }

  get chargeDirX(): number {
    return this.chargeX;
  }

  get chargeDirZ(): number {
    return this.chargeZ;
  }

  get alive(): boolean {
    return this.find() >= 0;
  }

  /** In a phase change: no damage gets through. */
  get shielded(): boolean {
    return this.shieldLeft > 0;
  }

  /**
   * How much of a hit of `amount` lands. In a phase change nothing does; otherwise never more than takes the
   * boss down to the next phase's threshold (the rest is lost, and the phase change starts).
   */
  absorb(amount: number): number {
    const i = this.find();
    if (i < 0) return amount;
    if (this.shieldLeft > 0) return 0;
    const next = this.phaseIndex + 1;
    if (next >= this.phases.length) return amount;
    const floor = this.phases[next].at * this.enemies.maxHp[i];
    const hp = this.enemies.hp[i];
    if (hp - amount > floor) return amount;
    this.gate = true;
    return Math.max(0, hp - floor);
  }

  /**
   * The fight's damage limit: hits land at full weight while the budget lasts (it refills at `rate`, the boss's
   * health over its shortest fight, and holds at most `limitBurst` seconds of it); anything past it lands at
   * `limitOverflow`. No build kills a boss faster than its minimum (TUNING.boss.fight), however it stacks.
   */
  limit(amount: number): number {
    if (amount <= 0 || this.rate === Infinity) return amount;
    const full = Math.min(amount, Math.max(0, this.budget));
    this.budget -= full;
    return full + (amount - full) * TUNING.boss.limitOverflow;
  }

  /** Health the boss got back (Bartek's sips): that much more may land at full weight. */
  restore(amount: number): void {
    if (this.rate !== Infinity) this.budget += amount;
  }

  /** True while the budget is nearly spent and hits go past the damage limit (the health bar shows it). */
  get limited(): boolean {
    return this.rate !== Infinity && this.budget < this.rate * 0.5;
  }

  /** Health left, 0..1 (0 once the boss is gone). */
  get health(): number {
    const i = this.find();
    if (i < 0) return 0;
    return Math.max(0, this.enemies.hp[i] / this.enemies.maxHp[i]);
  }

  /**
   * Where the boss is in the pool right now, or -1 when it is dead and swept. The index almost always
   * still holds (it only moves when something after it dies), so the scan is rare.
   */
  private find(): number {
    if (this.dead || this.uid < 0) return -1;
    const e = this.enemies;
    if (this.index >= 0 && this.index < e.count && e.uid[this.index] === this.uid) return this.index;
    for (let i = 0; i < e.count; i++) {
      if (e.uid[i] !== this.uid) continue;
      this.index = i;
      return i;
    }
    this.index = -1;
    return -1;
  }

  /** Puts the boss into the arena at (x, z). `typeIndex` is its type in the enemy pool; `dmgMul` scales its touch. */
  spawn(typeIndex: number, x: number, z: number, hpMul: number, dmgMul: number, minTime = 0): void {
    // A full pool would refuse the boss, and the last enemy in it would be taken for the boss (one ordinary
    // kill used to clear the station): room is made first.
    this.enemies.makeRoom(x, z);
    this.enemies.spawn(typeIndex, x, z, hpMul, dmgMul, this.rng);
    this.index = this.enemies.count - 1;
    this.uid = this.enemies.uid[this.index];
    this.enemies.size[this.index] = 1;
    this.phaseIndex = 0;
    this.attackIndex = 0;
    this.shieldLeft = 0;
    this.gate = false;
    this.last = '';
    this.repeats = 0;
    this.bag = 0;
    this.budget = 0;
    this.rate = minTime > 0 ? this.enemies.maxHp[this.index] / (minTime * TUNING.boss.limitMargin) : Infinity;
    this.timer = this.phase.pause * this.world.pace + 1.2;
    this.winding = null;
    this.chargeLeft = 0;
    this.dead = false;
  }

  /** The boss died: its index is about to be recycled by the pool. */
  clear(): void {
    this.index = -1;
    this.uid = -1;
    this.dead = true;
    this.winding = null;
  }

  /** One simulation step. Returns false once the boss is gone. */
  update(dt: number): boolean {
    const i = this.find();
    if (i < 0) return false;
    const e = this.enemies;
    if (e.dead[i]) return false;
    this.shieldLeft = Math.max(0, this.shieldLeft - dt);
    if (this.rate !== Infinity) this.budget = Math.max(this.budget, Math.min(this.rate * TUNING.boss.limitBurst, this.budget + this.rate * dt));
    this.advancePhase();
    // Running down a charge lane: the boss moves itself, nothing else happens.
    if (this.chargeLeft > 0) {
      this.chargeLeft -= dt;
      const step = CHARGE_SPEED * dt;
      const nx = e.x[i] + this.chargeX * step;
      const nz = e.z[i] + this.chargeZ * step;
      const lim = this.world.arenaRadius - this.def.radius - 2;
      if (Math.hypot(nx, nz) < lim) {
        e.x[i] = nx;
        e.z[i] = nz;
      } else this.chargeLeft = 0;
      e.y[i] = this.world.ground(e.x[i], e.z[i], e.y[i] + 2);
      e.yaw[i] = Math.atan2(this.chargeX, this.chargeZ);
      return true;
    }
    const px = this.world.playerX;
    const pz = this.world.playerZ;
    const dx = px - e.x[i];
    const dz = pz - e.z[i];
    const d = Math.hypot(dx, dz) || 1;
    // Keeps its distance a little: a boss that stands inside Piotrek cannot be read.
    const stunned = e.stun[i] > 0;
    const windingUp = this.winding !== null;
    const speed = stunned || windingUp ? 0 : this.phase.speed * this.world.speed * (e.slow[i] > 0 ? 0.6 : 1);
    // It walks right up to Piotrek: a boss that stops out of melee range cannot be fought with a briefcase.
    if (speed > 0 && d > this.def.radius + 0.5) {
      const step = speed * dt;
      let nx = e.x[i] + (dx / d) * step;
      let nz = e.z[i] + (dz / d) * step;
      const lim = this.world.arenaRadius - this.def.radius - 2;
      const out = Math.hypot(nx, nz);
      if (out > lim) {
        nx = (nx * lim) / out;
        nz = (nz * lim) / out;
      }
      // Walls stop it like they stop everything else: it used to walk through the station hall.
      // But a wedged boss would end the fight for good, so after a second of getting nowhere it
      // shoulders through whatever it is stuck on.
      if (this.ignoreWalls > 0) this.ignoreWalls -= dt;
      else {
        this.world.collide(nx, e.y[i], nz, this.def.radius * 0.8);
        nx = this.world.collideX;
        nz = this.world.collideZ;
      }
      const moved = Math.hypot(nx - e.x[i], nz - e.z[i]);
      if (moved < step * 0.25) {
        this.blockedFor += dt;
        if (this.blockedFor > 1) {
          this.blockedFor = 0;
          this.ignoreWalls = 2.5;
        }
      } else this.blockedFor = 0;
      e.x[i] = nx;
      e.z[i] = nz;
    }
    // Follows Piotrek onto roofs and platforms: camping up there used to switch most of the fight off.
    const ground = this.world.ground(e.x[i], e.z[i], e.y[i] + 2.5);
    const wantY = this.world.playerY;
    // A boss that does not walk (Bartek on his chair) stays put whatever Piotrek climb.
    const anchored = this.phase.speed <= 0;
    if (!anchored && wantY - e.y[i] > 0.6 && d < 14) e.y[i] = Math.min(wantY, e.y[i] + CLIMB_SPEED * dt);
    else e.y[i] = ground > e.y[i] ? ground : Math.max(ground, e.y[i] - FALL_SPEED * dt);
    // Stranded on a viaduct or a roof while Piotrek is somewhere else: the fight would never end, so
    // after a few seconds the boss simply reappears next to them.
    if (!anchored && Math.abs(e.y[i] - wantY) > 2.5) {
      this.strandedFor += dt;
      if (this.strandedFor > 4) {
        this.strandedFor = 0;
        const a = this.rng.next() * Math.PI * 2;
        e.x[i] = px + Math.sin(a) * 7;
        e.z[i] = pz + Math.cos(a) * 7;
        e.y[i] = wantY;
      }
    } else this.strandedFor = 0;
    e.yaw[i] = Math.atan2(dx, dz);
    if (stunned) return true;

    if (this.winding) {
      this.windLeft -= dt;
      if (this.windLeft <= 0) {
        const attack = this.winding;
        this.winding = null;
        this.world.attack = attack;
        this.fire(attack);
        // A combo: the next one is wound up as this one lands.
        if (attack.then) {
          this.count(attack.then);
          this.windUp(attack.then);
        }
      }
      return true;
    }
    this.timer -= dt;
    if (this.timer <= 0) this.start();
    return true;
  }

  private advancePhase(): void {
    const next = this.phaseIndex + 1;
    if (next >= this.phases.length) return;
    if (!this.gate && this.health > this.phases[next].at) return;
    this.gate = false;
    this.phaseIndex = next;
    this.attackIndex = 0;
    this.bag = 0;
    // The phase change: untouchable for a moment, and the first attack of the new phase only after it.
    this.shieldLeft = TUNING.boss.transition;
    this.timer = Math.max(this.timer, TUNING.boss.transition + 0.6);
    const ph = this.phases[next];
    if (ph.arena) this.world.closeArena();
    const i = this.index;
    if (ph.wave && i >= 0) this.world.summon(ph.wave.spawn, ph.wave.count, this.enemies.x[i], this.enemies.z[i]);
    // An attack already announced still lands: cancelling it would be a fake-out nobody can read.
    this.world.phase(next);
  }

  /** Picks the next attack and starts its telegraph. */
  private start(): void {
    const attacks = this.phase.attacks;
    if (!attacks.length) return;
    // A bag: every attack of the phase comes once before any comes again (so its new attacks always show), in a
    // random order, and never the same one (by name: phases carry attacks over) three times in a row.
    const full = (1 << attacks.length) - 1;
    if ((this.bag & full) === full) this.bag = 0;
    let k = this.draw(attacks, true);
    if (k < 0) k = this.draw(attacks, false);
    if (k < 0) k = Math.floor(this.rng.next() * attacks.length);
    this.bag |= 1 << k;
    const attack = attacks[k];
    this.count(attack);
    this.attackIndex++;
    // A combo's follow-up comes on top of the attack's own time.
    this.timer = (attack.cooldown + (attack.then?.cooldown ?? 0) + this.phase.pause) * this.world.pace;
    this.windUp(attack);
  }

  /** A random index among the attacks allowed next (still in the bag if `bagged`, never a third repeat), or -1. */
  private draw(attacks: readonly Attack[], bagged: boolean): number {
    const skip = this.repeats >= 2;
    let n = 0;
    for (let k = 0; k < attacks.length; k++) if ((!bagged || !(this.bag & (1 << k))) && (!skip || repeatKey(attacks[k]) !== this.last)) n++;
    if (n === 0) return -1;
    let r = Math.floor(this.rng.next() * n);
    for (let k = 0; k < attacks.length; k++) {
      if ((bagged && this.bag & (1 << k)) || (skip && repeatKey(attacks[k]) === this.last)) continue;
      if (r-- === 0) return k;
    }
    return -1;
  }

  private count(attack: Attack): void {
    const key = repeatKey(attack);
    this.repeats = key === this.last ? this.repeats + 1 : 1;
    this.last = key;
  }

  /** Starts an attack's warning (its shout, its telegraph on the ground); it lands when the warning ends. */
  private windUp(attack: Attack): void {
    this.winding = attack;
    this.windLeft = this.warn(attack);
    const i = this.index;
    this.windAngle = Math.atan2(this.world.playerX - this.enemies.x[i], this.world.playerZ - this.enemies.z[i]);
    if (attack.shout) this.world.shout(attack.shout);
    this.world.attack = attack;
    this.telegraph(attack);
  }

  /**
   * Seconds of warning for this attack on this kurs: shorter on harder ones, but a slam or a zone dropped on
   * Piotrek always gives the time to run out of it (TUNING.boss.escapeSpeed of the running speed).
   */
  private warn(attack: Attack): number {
    const t = attack.telegraph * this.world.telegraph;
    // A stunned Piotrek gets the stun's rest on top: a warning they cannot act on is no warning.
    if (attack.kind !== 'slam' && attack.kind !== 'zone') return Math.max(0.3, t) + this.world.stunLeft;
    const out = ((attack.radius ?? 4) + 0.4) / (this.world.runSpeed * TUNING.boss.escapeSpeed);
    // Zones too: they are drawn round Piotrek and the first bite comes as the warning ends.
    return Math.max(0.3, t, out) + this.world.stunLeft;
  }

  /** Shows what is about to happen, for `warn(attack)` seconds. */
  private telegraph(attack: Attack): void {
    const i = this.index;
    const tele = this.warn(attack);
    switch (attack.kind) {
      case 'slam':
        this.world.slam(this.world.playerX, this.world.playerZ, attack.radius ?? 4, attack.damage, tele, attack.effect);
        break;
      case 'zone': {
        const n = Math.min(attack.count ?? 3, MAX_ZONES);
        const r = attack.radius ?? 5;
        // Barriers never touch each other: a gap of BARRIER_GAP between any two, so they can never close
        // Piotrek into a pocket (under the next slam) that has no way out.
        const apart = attack.effect === 'block' ? 2 * r + BARRIER_GAP : 0;
        let placed = 0;
        for (let k = 0; k < n; k++) {
          for (let tries = 0; tries < 8; tries++) {
            const a = this.rng.next() * Math.PI * 2;
            const dist = this.rng.next() * (this.world.arenaRadius * 0.55);
            const x = this.world.playerX + Math.sin(a) * dist;
            const z = this.world.playerZ + Math.cos(a) * dist;
            let free = true;
            for (let j = 0; j < placed && free; j++) free = Math.hypot(x - zoneX[j], z - zoneZ[j]) >= apart;
            if (!free) continue;
            zoneX[placed] = x;
            zoneZ[placed] = z;
            placed++;
            this.world.zone(x, z, r, attack.damage, attack.duration ?? 4, tele, attack.effect);
            break;
          }
          // No room for a barrier that keeps its distance after eight tries: one fewer this time.
        }
        break;
      }
      case 'beam':
        this.world.beam(this.windAngle, attack.radius ?? 20, attack.damage, attack.duration ?? 2.5, attack.speed ?? 1, tele);
        break;
      case 'charge':
        // The whole lane is painted first, then the boss runs down it.
        this.world.lane(this.enemies.x[i], this.enemies.z[i], this.windAngle, attack.radius ?? 16, CHARGE_WIDTH, tele);
        this.world.windUp(this.enemies.x[i], this.enemies.z[i], this.def.radius * 2.2, tele, this.def.palette[1] ?? '#ffd23a');
        break;
      default:
        // Rings, fans and summons: a ring closing in on the boss says "something is coming".
        this.world.windUp(this.enemies.x[i], this.enemies.z[i], (attack.kind === 'ring' ? 6 : 3.4) + this.def.radius, tele, this.def.palette[1] ?? '#ffd23a');
        this.enemies.squash[i] = 1;
        break;
    }
  }

  /** The moment the attack lands. */
  private fire(attack: Attack): void {
    const i = this.index;
    const e = this.enemies;
    const x = e.x[i];
    const z = e.z[i];
    const y = e.y[i] + this.def.radius;
    const color = this.def.palette[1] ?? '#ffd23a';
    switch (attack.kind) {
      case 'ring': {
        const n = attack.count ?? 12;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + this.rng.next() * 0.2;
          this.world.shot(x, y, z, Math.sin(a), Math.cos(a), attack.speed ?? 10, attack.damage, color, attack.look);
        }
        break;
      }
      case 'roll': {
        // Spools roll out along the ground, spread evenly from a random start: gaps to step through.
        const n = attack.count ?? 5;
        const start = this.rng.next() * Math.PI * 2;
        const floor = this.world.ground(x, z, e.y[i] + 1) + 0.6;
        for (let k = 0; k < n; k++) {
          const a = start + (k / n) * Math.PI * 2;
          this.world.shot(x + Math.sin(a) * this.def.radius, floor, z + Math.cos(a) * this.def.radius, Math.sin(a), Math.cos(a), attack.speed ?? 7, attack.damage, color, 'spool');
        }
        break;
      }
      case 'magnet':
        this.world.magnet(attack.duration ?? 3);
        break;
      case 'spread': {
        const n = attack.count ?? 5;
        for (let k = 0; k < n; k++) {
          const a = this.windAngle + (k - (n - 1) / 2) * 0.18;
          this.world.shot(x, y, z, Math.sin(a), Math.cos(a), attack.speed ?? 14, attack.damage, color, attack.look);
        }
        break;
      }
      case 'wave':
        this.world.wave(x, z, attack.radius ?? 12, attack.damage, attack.speed ?? 9, attack.effect);
        break;
      case 'summon':
        this.world.summon(attack.spawn ?? 'golab', attack.count ?? 5, x, z);
        break;
      case 'charge': {
        // The lane was painted during the wind-up; now the boss actually runs down it.
        const length = attack.radius ?? 16;
        const steps = Math.max(2, Math.round(length / 3));
        for (let k = 1; k <= steps; k++) {
          const dist = (k / steps) * length;
          // Each patch lands as the boss reaches it.
          this.world.slam(x + Math.sin(this.windAngle) * dist, z + Math.cos(this.windAngle) * dist, CHARGE_WIDTH / 2, attack.damage, (dist / CHARGE_SPEED) * 0.9);
        }
        this.chargeX = Math.sin(this.windAngle);
        this.chargeZ = Math.cos(this.windAngle);
        this.chargeLeft = length / CHARGE_SPEED;
        break;
      }
      default:
        break;
    }
  }
}
