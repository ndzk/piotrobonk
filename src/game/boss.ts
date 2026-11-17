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
  /** The attack being announced or landing right now (what its hazards are blamed on). */
  attack: Attack | null;
  /** Phase change: new phase index (0-based) and its shout. */
  phase(index: number): void;
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
 * The extra phase of the harder kursy: the last phase's attacks and the strongest ones of every earlier phase,
 * faster, with less pause, and the boss's last word.
 */
function lastPhase(def: BossDef): Phase {
  const last = def.phases[def.phases.length - 1];
  const extra: Attack[] = [];
  for (const p of def.phases.slice(0, -1)) {
    const strongest = p.attacks.reduce((a, b) => (b.damage * (b.count ?? 1) > a.damage * (a.count ?? 1) ? b : a), p.attacks[0]);
    if (!last.attacks.includes(strongest)) extra.push(strongest);
  }
  return { at: TUNING.boss.extraAt, speed: last.speed * 1.15, pause: last.pause * 0.75, attacks: [...last.attacks, ...extra], shout: def.lastWord };
}

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
  spawn(typeIndex: number, x: number, z: number, hpMul: number, dmgMul: number): void {
    this.enemies.spawn(typeIndex, x, z, hpMul, dmgMul, this.rng);
    this.index = this.enemies.count - 1;
    this.uid = this.enemies.uid[this.index];
    this.enemies.size[this.index] = 1;
    this.phaseIndex = 0;
    this.attackIndex = 0;
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
    if (this.health > this.phases[next].at) return;
    this.phaseIndex = next;
    this.attackIndex = 0;
    this.timer = Math.max(this.timer, 1);
    // An attack already announced still lands: cancelling it would be a fake-out nobody can read.
    this.world.phase(next);
  }

  /** Picks the next attack and starts its telegraph. */
  private start(): void {
    const attacks = this.phase.attacks;
    if (!attacks.length) return;
    const attack = attacks[this.attackIndex % attacks.length];
    this.attackIndex++;
    this.timer = (attack.cooldown + this.phase.pause) * this.world.pace;
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
    if (attack.kind !== 'slam' && attack.kind !== 'zone') return Math.max(0.3, t);
    const out = ((attack.radius ?? 4) + 0.4) / (this.world.runSpeed * TUNING.boss.escapeSpeed);
    // Zones too: they are drawn round Piotrek and the first bite comes as the warning ends.
    return Math.max(0.3, t, out);
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
        const n = attack.count ?? 3;
        for (let k = 0; k < n; k++) {
          const a = this.rng.next() * Math.PI * 2;
          const dist = this.rng.next() * (this.world.arenaRadius * 0.55);
          this.world.zone(this.world.playerX + Math.sin(a) * dist, this.world.playerZ + Math.cos(a) * dist, attack.radius ?? 5, attack.damage, attack.duration ?? 4, tele, attack.effect);
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
