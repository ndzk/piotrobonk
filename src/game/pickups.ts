import { Color, CylinderGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, MeshToonMaterial, TorusGeometry, type BufferGeometry, type Scene } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TUNING } from '../content/tuning';
import type { Rng } from '../core/rng';
import { placeInstance, type BlobShadows } from '../render/fx';
import { tinted } from '../render/tint';
import { toonRamp } from '../render/toon';
import type { BottleSource } from './enemies';
import type { World } from './world';

export const Kind = { Xp: 0, Bottle: 1, Food: 2 } as const;
export type Kind = (typeof Kind)[keyof typeof Kind];

const TIERS = [
  { min: 0, color: new Color('#d98c4e'), size: 1 },
  { min: 2, color: new Color('#dfe5ee'), size: 1.15 },
  { min: 5, color: new Color('#ffd23a'), size: 1.35 },
  { min: 20, color: new Color('#5ee0ff'), size: 1.7 },
];
const BOTTLE_COLORS = [new Color('#3d8a4a'), new Color('#8a5a2b'), new Color('#dfe5ee'), new Color('#e2362c')];
const WHITE = new Color(1, 1, 1);

/**
 * Everything that lies on the ground and gets collected: XP coins, deposit bottles and cans, food.
 * They pop out of what dropped them, get pulled in by the magnet, and XP coins merge when there are too many.
 */
export class Pickups implements BottleSource {
  private readonly max = TUNING.xp.maxCoins;
  count = 0;
  private readonly x = new Float32Array(this.max);
  private readonly y = new Float32Array(this.max);
  private readonly z = new Float32Array(this.max);
  private readonly vx = new Float32Array(this.max);
  private readonly vy = new Float32Array(this.max);
  private readonly vz = new Float32Array(this.max);
  private readonly value = new Float32Array(this.max);
  private readonly ground = new Float32Array(this.max);
  private readonly kind = new Uint8Array(this.max);
  private readonly variant = new Uint8Array(this.max);
  private readonly pulled = new Uint8Array(this.max);
  private readonly floats = [this.x, this.y, this.z, this.vx, this.vy, this.vz, this.value, this.ground];
  private readonly meshes: InstancedMesh[];
  private readonly n = [0, 0, 0];

  constructor(
    scene: Scene,
    private world: World,
  ) {
    const ramp = toonRamp();
    const coin = new CylinderGeometry(0.16, 0.16, 0.05, 12);
    coin.rotateX(Math.PI / 2);
    const bottle = mergeGeometries([tinted(new CylinderGeometry(0.1, 0.11, 0.42, 8), '#ffffff'), tinted(new CylinderGeometry(0.04, 0.08, 0.17, 8).translate(0, 0.29, 0), '#ffffff'), tinted(new CylinderGeometry(0.045, 0.045, 0.04, 8).translate(0, 0.39, 0), '#d8d8d8')]);
    const food = mergeGeometries([tinted(new TorusGeometry(0.14, 0.075, 6, 12).rotateX(Math.PI / 2), '#d9a05b'), tinted(new TorusGeometry(0.14, 0.05, 6, 12).rotateX(Math.PI / 2).translate(0, 0.035, 0), '#ff7fb0')]);
    const make = (geo: BufferGeometry, mat: MeshToonMaterial): InstancedMesh => {
      const m = new InstancedMesh(geo, mat, this.max);
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.instanceColor = new InstancedBufferAttribute(new Float32Array(this.max * 3).fill(1), 3).setUsage(DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.meshes = [
      make(coin, new MeshToonMaterial({ gradientMap: ramp, emissive: new Color('#3a2a00') })),
      make(bottle, new MeshToonMaterial({ gradientMap: ramp, vertexColors: true, emissive: new Color('#0e1a10') })),
      make(food, new MeshToonMaterial({ gradientMap: ramp, vertexColors: true })),
    ];
  }

  clear(): void {
    this.count = 0;
  }

  /** The arena changed (travelling to the next station). */
  setWorld(world: World): void {
    this.world = world;
  }

  drop(x: number, y: number, z: number, value: number, rng: Rng, kind: Kind = Kind.Xp): void {
    if (this.count >= this.max) {
      // Full: fold XP coins into each other. Bottles and food are worth real money, so they take an
      // XP coin's place instead of vanishing.
      for (let tries = 0; tries < 12; tries++) {
        const i = Math.floor(rng.next() * this.count);
        if (this.kind[i] !== Kind.Xp) continue;
        if (kind === Kind.Xp) {
          this.value[i] += value;
          return;
        }
        this.remove(i);
        break;
      }
      if (this.count >= this.max) return;
    }
    const i = this.count++;
    const a = rng.next() * Math.PI * 2;
    const spread = kind === Kind.Xp ? 2 : 3;
    this.x[i] = x;
    this.y[i] = y + 0.4;
    this.z[i] = z;
    this.vx[i] = Math.cos(a) * spread;
    this.vz[i] = Math.sin(a) * spread;
    this.vy[i] = 4.5;
    this.value[i] = value;
    this.kind[i] = kind;
    this.variant[i] = Math.floor(rng.next() * 4);
    this.pulled[i] = 0;
    this.ground[i] = this.world.groundAt(x, z, 0.1, y + 0.5);
  }

  /** Pulls every XP coin in (debug menu, Bilet Sieciowy). Within `radius` of (x, z) if given. */
  vacuum(x = 0, z = 0, radius = Infinity): void {
    const r2 = radius * radius;
    for (let i = 0; i < this.count; i++) if (this.kind[i] === Kind.Xp && (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2 < r2) this.pulled[i] = 1;
  }

  // BottleSource (for Złomiarz).
  nearestBottle(x: number, z: number, r: number): number {
    let best = -1;
    let bestD = r * r;
    for (let i = 0; i < this.count; i++) {
      if (this.kind[i] !== Kind.Bottle || this.pulled[i]) continue;
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  bottleX(i: number): number {
    return this.x[i];
  }

  bottleZ(i: number): number {
    return this.z[i];
  }

  takeBottle(i: number): void {
    this.remove(i);
  }

  update(dt: number, px: number, py: number, pz: number, radius: number, collect: (kind: number, value: number) => void): void {
    const r2 = radius * radius;
    let i = 0;
    while (i < this.count) {
      const dx = px - this.x[i];
      const dy = py + 0.9 - this.y[i];
      const dz = pz - this.z[i];
      const d2 = dx * dx + dz * dz;
      if (!this.pulled[i] && d2 < r2) this.pulled[i] = 1;
      if (this.pulled[i]) {
        const d = Math.sqrt(d2 + dy * dy) || 1;
        if (d < 0.75) {
          collect(this.kind[i], this.value[i]);
          this.remove(i);
          continue;
        }
        const speed = TUNING.xp.magnetSpeed + Math.max(0, 6 - d) * 2;
        const k = Math.min(1, dt * 10);
        this.vx[i] += ((dx / d) * speed - this.vx[i]) * k;
        this.vy[i] += ((dy / d) * speed - this.vy[i]) * k;
        this.vz[i] += ((dz / d) * speed - this.vz[i]) * k;
      } else {
        this.vy[i] -= 20 * dt;
        const damp = Math.exp(-3 * dt);
        this.vx[i] *= damp;
        this.vz[i] *= damp;
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      const g = this.ground[i] + (this.kind[i] === Kind.Xp ? 0.25 : 0.05);
      if (!this.pulled[i] && this.y[i] < g) {
        this.y[i] = g;
        this.vy[i] = Math.abs(this.vy[i]) > 2 ? -this.vy[i] * 0.3 : 0;
      }
      i++;
    }
  }

  private remove(i: number): void {
    const last = --this.count;
    for (const a of this.floats) a[i] = a[last];
    this.pulled[i] = this.pulled[last];
    this.kind[i] = this.kind[last];
    this.variant[i] = this.variant[last];
  }

  render(time: number, shadows: BlobShadows): void {
    this.n[0] = this.n[1] = this.n[2] = 0;
    for (let i = 0; i < this.count; i++) {
      const kind = this.kind[i];
      const mesh = this.meshes[kind];
      const idx = this.n[kind]++;
      const x = this.x[i];
      const z = this.z[i];
      const bob = this.pulled[i] ? 0 : Math.sin(time * 3 + i) * 0.06;
      const y = this.y[i] + bob;
      if (kind === Kind.Xp) {
        const v = this.value[i];
        let tier = TIERS[0];
        for (const t of TIERS) if (v >= t.min) tier = t;
        const s = tier.size * (1 + Math.min(1.5, v / 60));
        placeInstance(mesh, idx, x, y, z, time * 3 + i, s, s, s);
        mesh.setColorAt(idx, tier.color);
      } else if (kind === Kind.Bottle) {
        // Lying bottles and cans, rolling slowly.
        placeInstance(mesh, idx, x, y + 0.08, z, time * 0.8 + i, 1, 1, 1, Math.PI / 2);
        mesh.setColorAt(idx, BOTTLE_COLORS[this.variant[i]]);
      } else {
        placeInstance(mesh, idx, x, y + 0.1, z, time * 1.5 + i, 1.3, 1.3, 1.3);
        mesh.setColorAt(idx, WHITE);
      }
      if (i < 240) shadows.add(x, this.ground[i], z, kind === Kind.Xp ? 0.14 : 0.2, y - this.ground[i]);
    }
    for (let k = 0; k < 3; k++) {
      const m = this.meshes[k];
      m.count = this.n[k];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}
