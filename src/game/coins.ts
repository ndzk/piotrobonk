import { Color, CylinderGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, MeshToonMaterial, type Scene } from 'three';
import { TUNING } from '../content/tuning';
import type { Rng } from '../core/rng';
import { placeInstance, type BlobShadows } from '../render/fx';
import { toonRamp } from '../render/toon';
import type { World } from './world';

const TIERS = [
  { min: 0, color: new Color('#d98c4e'), size: 1 },
  { min: 2, color: new Color('#dfe5ee'), size: 1.15 },
  { min: 5, color: new Color('#ffd23a'), size: 1.35 },
  { min: 20, color: new Color('#5ee0ff'), size: 1.7 },
];

/** XP coins: pop out of enemies, get pulled in by the magnet, merge when there are too many. */
export class Coins {
  private readonly max = TUNING.xp.maxCoins;
  count = 0;
  private readonly x = new Float32Array(this.max);
  private readonly y = new Float32Array(this.max);
  private readonly z = new Float32Array(this.max);
  private readonly vx = new Float32Array(this.max);
  private readonly vy = new Float32Array(this.max);
  private readonly vz = new Float32Array(this.max);
  private readonly value = new Float32Array(this.max);
  private readonly pulled = new Uint8Array(this.max);
  private readonly ground = new Float32Array(this.max);
  readonly mesh: InstancedMesh;
  private readonly floats = [this.x, this.y, this.z, this.vx, this.vy, this.vz, this.value, this.ground];

  constructor(
    scene: Scene,
    private readonly world: World,
  ) {
    const geo = new CylinderGeometry(0.16, 0.16, 0.05, 12);
    geo.rotateX(Math.PI / 2);
    this.mesh = new InstancedMesh(geo, new MeshToonMaterial({ gradientMap: toonRamp(), emissive: new Color('#3a2a00') }), this.max);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.max * 3), 3).setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  clear(): void {
    this.count = 0;
  }

  drop(x: number, y: number, z: number, value: number, rng: Rng): void {
    if (this.count >= this.max) {
      // Too many coins: fold the value into an existing one instead of spawning.
      const i = Math.floor(rng.next() * this.count);
      this.value[i] = (this.value[i] ?? 0) + value;
      return;
    }
    const i = this.count++;
    const a = rng.next() * Math.PI * 2;
    this.x[i] = x;
    this.y[i] = y + 0.4;
    this.z[i] = z;
    this.vx[i] = Math.cos(a) * 2;
    this.vz[i] = Math.sin(a) * 2;
    this.vy[i] = 4.5;
    this.value[i] = value;
    this.pulled[i] = 0;
    this.ground[i] = this.world.groundAt(x, z, 0.1, y + 0.5);
  }

  /** Pulls everything in (used by level-up chests later and the debug menu). */
  vacuum(): void {
    for (let i = 0; i < this.count; i++) this.pulled[i] = 1;
  }

  update(dt: number, px: number, py: number, pz: number, radius: number, collect: (value: number) => void): void {
    const r2 = radius * radius;
    let i = 0;
    while (i < this.count) {
      const dx = px - (this.x[i] ?? 0);
      const dy = py + 0.9 - (this.y[i] ?? 0);
      const dz = pz - (this.z[i] ?? 0);
      const d2 = dx * dx + dz * dz;
      if (!this.pulled[i] && d2 < r2) this.pulled[i] = 1;
      if (this.pulled[i]) {
        const d = Math.sqrt(d2 + dy * dy) || 1;
        if (d < 0.75) {
          collect(this.value[i] ?? 1);
          this.remove(i);
          continue;
        }
        const speed = TUNING.xp.magnetSpeed + Math.max(0, 6 - d) * 2;
        const k = Math.min(1, dt * 10);
        this.vx[i] = (this.vx[i] ?? 0) + ((dx / d) * speed - (this.vx[i] ?? 0)) * k;
        this.vy[i] = (this.vy[i] ?? 0) + ((dy / d) * speed - (this.vy[i] ?? 0)) * k;
        this.vz[i] = (this.vz[i] ?? 0) + ((dz / d) * speed - (this.vz[i] ?? 0)) * k;
      } else {
        this.vy[i] = (this.vy[i] ?? 0) - 20 * dt;
        const damp = Math.exp(-3 * dt);
        this.vx[i] = (this.vx[i] ?? 0) * damp;
        this.vz[i] = (this.vz[i] ?? 0) * damp;
      }
      this.x[i] = (this.x[i] ?? 0) + (this.vx[i] ?? 0) * dt;
      this.y[i] = (this.y[i] ?? 0) + (this.vy[i] ?? 0) * dt;
      this.z[i] = (this.z[i] ?? 0) + (this.vz[i] ?? 0) * dt;
      const g = (this.ground[i] ?? 0) + 0.25;
      if (!this.pulled[i] && (this.y[i] ?? 0) < g) {
        this.y[i] = g;
        this.vy[i] = Math.abs(this.vy[i] ?? 0) > 2 ? -(this.vy[i] ?? 0) * 0.3 : 0;
      }
      i++;
    }
  }

  private remove(i: number): void {
    const last = --this.count;
    for (const a of this.floats) a[i] = a[last];
    this.pulled[i] = this.pulled[last] ?? 0;
  }

  render(time: number, shadows: BlobShadows): void {
    for (let i = 0; i < this.count; i++) {
      const v = this.value[i] ?? 1;
      let tier = TIERS[0];
      for (const t of TIERS) if (v >= t.min) tier = t;
      const s = tier.size * (1 + Math.min(1.5, v / 60));
      const x = this.x[i] ?? 0;
      const z = this.z[i] ?? 0;
      const y = (this.y[i] ?? 0) + (this.pulled[i] ? 0 : Math.sin(time * 3 + i) * 0.06);
      placeInstance(this.mesh, i, x, y, z, time * 3 + i, s, s, s);
      this.mesh.setColorAt(i, tier.color);
      if (i < 200) shadows.add(x, this.ground[i] ?? 0, z, 0.12 * s, y - (this.ground[i] ?? 0));
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
