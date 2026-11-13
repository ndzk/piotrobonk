// The station boss: one enemy in the usual pool (so every weapon hits it normally) driven by this
// controller instead of the chase AI. Phases come from src/content/bosses.ts; every attack is telegraphed
// first, then it lands.

import type { Attack, BossDef, Phase } from '../content/bosses';
import type { EnemyDef } from '../content/enemies';
import { TUNING } from '../content/tuning';
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
    behavior: 'boss',
  };
}

/** What the boss asks the game to do; the game owns the particles, sound and spawning. */
export interface BossWorld {
  /** Marks a circle on the ground for `telegraph` seconds, then hits everything inside it. */
  slam(x: number, z: number, radius: number, damage: number, telegraph: number): void;
  /** Fires one projectile from the boss. */
  shot(x: number, y: number, z: number, dirX: number, dirZ: number, speed: number, damage: number, color: string): void;
  /** A damaging ring expanding from (x, z). */
  wave(x: number, z: number, radius: number, damage: number, speed: number): void;
  /** A circle that stays dangerous for `duration` seconds. */
  zone(x: number, z: number, radius: number, damage: number, duration: number, telegraph: number): void;
  /** A sweeping beam anchored at the boss. */
  beam(angle: number, length: number, damage: number, duration: number, speed: number, telegraph: number): void;
  /** Calls in ordinary enemies around the boss. */
  summon(id: string, count: number, x: number, z: number): void;
  /** Banner text over the fight ('' clears it). */
  shout(text: string): void;
  /** Phase change: new phase index (0-based) and its shout. */
  phase(index: number): void;
  ground(x: number, z: number, y: number): number;
  playerX: number;
  playerZ: number;
  arenaRadius: number;
}

const DT = 1 / TUNING.simHz;

export class Boss {
  /** Index in the enemy pool, or -1 when the boss is not in the arena. */
  index = -1;
  readonly def: BossDef;
  private phaseIndex = 0;
  private timer = 0;
  private attackIndex = 0;
  /** The attack being wound up, with the time left before it lands. */
  private winding: Attack | null = null;
  private windLeft = 0;
  private windAngle = 0;
  private beamAngle = 0;
  private dead = false;

  constructor(
    def: BossDef,
    private readonly enemies: Enemies,
    private readonly world: BossWorld,
    private readonly rng: Rng,
  ) {
    this.def = def;
  }

  get phase(): Phase {
    return this.def.phases[this.phaseIndex];
  }

  get alive(): boolean {
    return this.index >= 0 && !this.dead;
  }

  /** Health left, 0..1 (0 once the boss is gone). */
  get health(): number {
    if (this.index < 0) return 0;
    return Math.max(0, this.enemies.hp[this.index] / this.enemies.maxHp[this.index]);
  }

  /** Puts the boss into the arena at (x, z). `typeIndex` is its type in the enemy pool. */
  spawn(typeIndex: number, x: number, z: number, hpMul: number): void {
    this.enemies.spawn(typeIndex, x, z, hpMul, 1, this.rng);
    this.index = this.enemies.count - 1;
    this.enemies.size[this.index] = 1;
    this.phaseIndex = 0;
    this.attackIndex = 0;
    this.timer = this.phase.pause + 1.2;
    this.winding = null;
    this.dead = false;
  }

  /** The boss died: its index is about to be recycled by the pool. */
  clear(): void {
    this.index = -1;
    this.dead = true;
    this.winding = null;
  }

  /** One simulation step. Returns false once the boss is gone. */
  update(dt: number): boolean {
    const i = this.index;
    if (i < 0 || this.dead) return false;
    const e = this.enemies;
    if (e.dead[i]) return false;
    this.advancePhase();
    const px = this.world.playerX;
    const pz = this.world.playerZ;
    const dx = px - e.x[i];
    const dz = pz - e.z[i];
    const d = Math.hypot(dx, dz) || 1;
    // Keeps its distance a little: a boss that stands inside Piotrek cannot be read.
    const stunned = e.stun[i] > 0;
    const windingUp = this.winding !== null;
    const speed = stunned || windingUp ? 0 : this.phase.speed * (e.slow[i] > 0 ? 0.6 : 1);
    // It walks right up to Piotrek: a boss that stops out of melee range cannot be fought with a briefcase.
    if (speed > 0 && d > this.def.radius + 0.5) {
      const step = speed * dt;
      const nx = e.x[i] + (dx / d) * step;
      const nz = e.z[i] + (dz / d) * step;
      const lim = this.world.arenaRadius - this.def.radius - 2;
      const out = Math.hypot(nx, nz);
      e.x[i] = out > lim ? (nx * lim) / out : nx;
      e.z[i] = out > lim ? (nz * lim) / out : nz;
    }
    e.y[i] = this.world.ground(e.x[i], e.z[i], e.y[i] + 2);
    e.yaw[i] = Math.atan2(dx, dz);
    if (stunned) return true;

    if (this.winding) {
      this.windLeft -= dt;
      if (this.windLeft <= 0) {
        const attack = this.winding;
        this.winding = null;
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
    if (next >= this.def.phases.length) return;
    if (this.health > this.def.phases[next].at) return;
    this.phaseIndex = next;
    this.attackIndex = 0;
    this.timer = Math.max(this.timer, 1);
    this.winding = null;
    this.world.phase(next);
  }

  /** Picks the next attack and starts its telegraph. */
  private start(): void {
    const attacks = this.phase.attacks;
    if (!attacks.length) return;
    const attack = attacks[this.attackIndex % attacks.length];
    this.attackIndex++;
    this.timer = attack.cooldown + this.phase.pause;
    this.winding = attack;
    this.windLeft = attack.telegraph;
    const i = this.index;
    this.windAngle = Math.atan2(this.world.playerX - this.enemies.x[i], this.world.playerZ - this.enemies.z[i]);
    if (attack.shout) this.world.shout(attack.shout);
    this.telegraph(attack);
  }

  /** Shows what is about to happen, for `attack.telegraph` seconds. */
  private telegraph(attack: Attack): void {
    const i = this.index;
    switch (attack.kind) {
      case 'slam':
        this.world.slam(this.world.playerX, this.world.playerZ, attack.radius ?? 4, attack.damage, attack.telegraph);
        break;
      case 'zone': {
        const n = attack.count ?? 3;
        for (let k = 0; k < n; k++) {
          const a = this.rng.next() * Math.PI * 2;
          const dist = this.rng.next() * (this.world.arenaRadius * 0.55);
          this.world.zone(this.world.playerX + Math.sin(a) * dist, this.world.playerZ + Math.cos(a) * dist, attack.radius ?? 5, attack.damage, attack.duration ?? 4, attack.telegraph);
        }
        break;
      }
      case 'beam':
        this.beamAngle = this.windAngle;
        this.world.beam(this.beamAngle, attack.radius ?? 20, attack.damage, attack.duration ?? 2.5, attack.speed ?? 1, attack.telegraph);
        break;
      default:
        // Rings, fans, charges and summons announce themselves with the boss's wind-up pose.
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
          this.world.shot(x, y, z, Math.sin(a), Math.cos(a), attack.speed ?? 10, attack.damage, color);
        }
        break;
      }
      case 'spread': {
        const n = attack.count ?? 5;
        for (let k = 0; k < n; k++) {
          const a = this.windAngle + (k - (n - 1) / 2) * 0.18;
          this.world.shot(x, y, z, Math.sin(a), Math.cos(a), attack.speed ?? 14, attack.damage, color);
        }
        break;
      }
      case 'wave':
        this.world.wave(x, z, attack.radius ?? 12, attack.damage, attack.speed ?? 9);
        break;
      case 'summon':
        this.world.summon(attack.spawn ?? 'golab', attack.count ?? 5, x, z);
        break;
      case 'charge': {
        // A charge is a long slam along the line it was aimed at.
        const steps = Math.max(2, Math.round((attack.radius ?? 16) / 3));
        for (let k = 1; k <= steps; k++) {
          const dist = (k / steps) * (attack.radius ?? 16);
          this.world.slam(x + Math.sin(this.windAngle) * dist, z + Math.cos(this.windAngle) * dist, 3, attack.damage, k * DT * 2);
        }
        break;
      }
      default:
        break;
    }
  }
}
