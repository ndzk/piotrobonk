import { BoxGeometry, Color, CylinderGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshToonMaterial, Quaternion, Vector3, type BufferGeometry, type Scene } from 'three';
import { TUNING } from '../content/tuning';
import { toonRamp } from '../render/toon';
import type { Enemies } from './enemies';

export const Shot = { Ticket: 0, Bullet: 1, Paper: 2, Can: 3, Cup: 4 } as const;
export type Shot = (typeof Shot)[keyof typeof Shot];

const MAX = 480;
/** A projectile that survives its hits cannot hit the same enemy again for this long. */
const REPEAT_CD = 0.4;
const m4 = new Matrix4();
const q = new Quaternion();
const qa = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const fwd = new Vector3(0, 0, 1);
const vel = new Vector3();
const axisX = new Vector3(1, 0, 0);
const axisY = new Vector3(0, 1, 0);
const col = new Color();

export interface ShotEvents {
  /** A projectile touched enemy i. Returns nothing; damage is the arsenal's business. */
  hit(i: number, slot: number, damage: number, dirX: number, dirZ: number, knockback: number): void;
  /** A lobbed can or cup landed. */
  landed(kind: number, x: number, y: number, z: number, slot: number): void;
  /** Called for tickets every step with their position (Bilet Sieciowy pulls coins). */
  flying(kind: number, x: number, z: number, slot: number): void;
}

/** Every projectile in one pool: boomerang tickets, bullets, timetable sheets, lobbed cans and coffee cups. */
export class Projectiles {
  count = 0;
  private readonly kind = new Uint8Array(MAX);
  private readonly slot = new Uint8Array(MAX);
  private readonly x = new Float32Array(MAX);
  private readonly y = new Float32Array(MAX);
  private readonly z = new Float32Array(MAX);
  private readonly vx = new Float32Array(MAX);
  private readonly vy = new Float32Array(MAX);
  private readonly vz = new Float32Array(MAX);
  private readonly age = new Float32Array(MAX);
  private readonly life = new Float32Array(MAX);
  private readonly damage = new Float32Array(MAX);
  private readonly radius = new Float32Array(MAX);
  private readonly knock = new Float32Array(MAX);
  private readonly pierce = new Int16Array(MAX);
  private readonly returning = new Uint8Array(MAX);
  private readonly floor = new Float32Array(MAX);
  private readonly tint = new Uint32Array(MAX);
  // Previous step's position, so projectiles are interpolated like everything else.
  private readonly ox = new Float32Array(MAX);
  private readonly oy = new Float32Array(MAX);
  private readonly oz = new Float32Array(MAX);
  private readonly floats = [this.ox, this.oy, this.oz, this.x, this.y, this.z, this.vx, this.vy, this.vz, this.age, this.life, this.damage, this.radius, this.knock, this.floor];
  private readonly meshes: InstancedMesh[];
  private readonly drawn = [0, 0, 0, 0, 0];

  constructor(scene: Scene) {
    const ramp = toonRamp();
    const make = (geo: BufferGeometry, glow: boolean): InstancedMesh => {
      const mat = glow ? new MeshBasicMaterial({ fog: false }) : new MeshToonMaterial({ gradientMap: ramp });
      const m = new InstancedMesh(geo, mat, MAX);
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3).setUsage(DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.meshes = [
      make(new BoxGeometry(0.66, 0.05, 0.42), false),
      make(new BoxGeometry(0.1, 0.1, 1.5), true),
      make(new BoxGeometry(0.54, 0.03, 0.7), false),
      make(new CylinderGeometry(0.12, 0.12, 0.3, 10), false),
      make(new CylinderGeometry(0.13, 0.1, 0.26, 10), false),
    ];
  }

  clear(): void {
    this.count = 0;
  }

  /**
   * Spawns a projectile. Straight shots fly along (vx, vz) for `life` seconds; tickets come back;
   * cans and cups are lobbed to land at `life` seconds on `floor`.
   */
  spawn(kind: Shot, slot: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, damage: number, radius: number, knock: number, pierce: number, floor: number, color: number): void {
    if (this.count >= MAX) return;
    const i = this.count++;
    this.kind[i] = kind;
    this.slot[i] = slot;
    this.x[i] = this.ox[i] = x;
    this.y[i] = this.oy[i] = y;
    this.z[i] = this.oz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.damage[i] = damage;
    this.radius[i] = radius;
    this.knock[i] = knock;
    this.pierce[i] = pierce;
    this.returning[i] = 0;
    this.floor[i] = floor;
    this.tint[i] = color;
  }

  update(dt: number, time: number, enemies: Enemies, px: number, py: number, pz: number, ev: ShotEvents): void {
    let i = 0;
    while (i < this.count) {
      const kind = this.kind[i];
      this.ox[i] = this.x[i];
      this.oy[i] = this.y[i];
      this.oz[i] = this.z[i];
      this.age[i] += dt;
      if (kind === Shot.Ticket) {
        // Out and back: slows down to the turning point, then homes in on Piotrek.
        const t = this.age[i] / this.life[i];
        if (!this.returning[i] && t >= 0.5) this.returning[i] = 1;
        if (this.returning[i]) {
          const dx = px - this.x[i];
          const dz = pz - this.z[i];
          const d = Math.hypot(dx, dz) || 1;
          // Capped, or a ticket caught in a crowd accelerates forever and circles Piotrek.
          const sp = Math.min(TUNING.combat.returnMaxSpeed, Math.hypot(this.vx[i], this.vz[i]) + dt * TUNING.combat.returnAccel);
          this.vx[i] += ((dx / d) * sp - this.vx[i]) * Math.min(1, dt * 8);
          this.vz[i] += ((dz / d) * sp - this.vz[i]) * Math.min(1, dt * 8);
          this.y[i] += (py + 1 - this.y[i]) * Math.min(1, dt * 6);
          if (d < 0.8 || this.age[i] > this.life[i] * 1.6) {
            this.remove(i);
            continue;
          }
        } else {
          const damp = Math.exp(-dt * 2.4);
          this.vx[i] *= damp;
          this.vz[i] *= damp;
        }
        ev.flying(kind, this.x[i], this.z[i], this.slot[i]);
      } else if (kind === Shot.Can || kind === Shot.Cup) {
        this.vy[i] -= 22 * dt;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      if (kind === Shot.Can || kind === Shot.Cup) {
        if (this.age[i] >= this.life[i] || this.y[i] <= this.floor[i]) {
          ev.landed(kind, this.x[i], this.floor[i], this.z[i], this.slot[i]);
          this.remove(i);
          continue;
        }
        i++;
        continue;
      }
      if (kind !== Shot.Ticket && this.age[i] >= this.life[i]) {
        this.remove(i);
        continue;
      }
      // Hits.
      let gone = false;
      const r = this.radius[i];
      const n = enemies.query(this.x[i], this.z[i], r + 1.6);
      for (let k = 0; k < n && !gone; k++) {
        const e = enemies.found[k];
        const rr = r + enemies.radius[e];
        if (enemies.foundD2[k] > rr * rr) continue;
        const dy = enemies.y[e] + 0.5 - this.y[i];
        if (dy < -1.6 || dy > 1.6) continue;
        // A projectile that survives hits (boomerang, pierce) must not grind one enemy every step.
        if ((this.pierce[i] !== 0 || kind === Shot.Ticket) && !enemies.tryHit(e, this.slot[i], time, REPEAT_CD)) continue;
        const sp = Math.hypot(this.vx[i], this.vz[i]) || 1;
        ev.hit(e, this.slot[i], this.damage[i], this.vx[i] / sp, this.vz[i] / sp, this.knock[i]);
        if (this.pierce[i] >= 0) {
          this.pierce[i]--;
          if (this.pierce[i] < 0) gone = true;
        }
      }
      if (gone) {
        this.remove(i);
        continue;
      }
      i++;
    }
  }

  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const a of this.floats) a[i] = a[last];
    this.kind[i] = this.kind[last];
    this.slot[i] = this.slot[last];
    this.pierce[i] = this.pierce[last];
    this.returning[i] = this.returning[last];
    this.tint[i] = this.tint[last];
  }

  render(time: number, alpha: number): void {
    this.drawn.fill(0);
    for (let i = 0; i < this.count; i++) {
      const kind = this.kind[i];
      const mesh = this.meshes[kind];
      const idx = this.drawn[kind]++;
      const x = this.ox[i] + (this.x[i] - this.ox[i]) * alpha;
      const y = this.oy[i] + (this.y[i] - this.oy[i]) * alpha;
      const z = this.oz[i] + (this.z[i] - this.oz[i]) * alpha;
      vel.set(this.vx[i], this.vy[i], this.vz[i]);
      const spin = time * 18 + i;
      switch (kind) {
        case Shot.Ticket:
        case Shot.Paper:
          q.setFromAxisAngle(axisY, spin);
          break;
        case Shot.Bullet:
          q.setFromUnitVectors(fwd, vel.normalize());
          break;
        default:
          q.setFromAxisAngle(axisY, Math.atan2(this.vx[i], this.vz[i]));
          q.multiply(qa.setFromAxisAngle(axisX, spin * 0.6));
      }
      m4.compose(pos.set(x, y, z), q, scl.set(1, 1, 1));
      mesh.setMatrixAt(idx, m4);
      col.setHex(this.tint[i]);
      if (kind === Shot.Bullet) col.multiplyScalar(1.6);
      mesh.setColorAt(idx, col);
    }
    for (let k = 0; k < this.meshes.length; k++) {
      const m = this.meshes[k];
      m.count = this.drawn[k];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
