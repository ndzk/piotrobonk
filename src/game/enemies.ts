import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshToonMaterial, Quaternion, Vector3, type Scene } from 'three';
import { ENEMIES, type EnemyDef } from '../content/enemies';
import { TUNING } from '../content/tuning';
import { outlineGeometry } from '../characters/geometry';
import { outlineMaterial, toonRamp } from '../render/toon';
import type { Rng } from '../core/rng';
import type { BlobShadows } from '../render/fx';
import { enemyModel } from './enemy-models';
import type { World } from './world';

const HASH_CELL = 2;
/** Weapon slots for per-weapon hit cooldowns (4 weapons; evolutions keep their slot). */
export const WEAPON_SLOTS = 4;

/** Where collectors (Złomiarz) find bottles: implemented by the pickups. */
export interface BottleSource {
  nearestBottle(x: number, z: number, r: number): number;
  bottleX(i: number): number;
  bottleZ(i: number): number;
  takeBottle(i: number): void;
}
const DYING_MAX = 160;
const DEATH_TIME = 0.14;

const m4 = new Matrix4();
const q = new Quaternion();
const qa = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();
const axisX = new Vector3(1, 0, 0);
const axisY = new Vector3(0, 1, 0);
const axisZ = new Vector3(0, 0, 1);
const tmpColor = new Color();
const pushPos = { x: 0, y: 0, z: 0 };
/** Half extents of the bus body, used for contact instead of its spawn radius. */
const BUS_HALF_X = 1.35;
const BUS_HALF_Z = 3.4;

interface TypeMeshes {
  def: EnemyDef;
  body: InstancedMesh;
  outline: InstancedMesh;
  wingL?: InstancedMesh;
  wingR?: InstancedMesh;
  wingOffset: [number, number, number];
  palette: Color[];
  n: number;
}

/** All enemies in flat typed arrays (structure of arrays), drawn with one instanced mesh per type. */
export class Enemies {
  readonly max = TUNING.waves.maxEnemies;
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly kx: Float32Array;
  private readonly kz: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly type: Uint8Array;
  readonly radius: Float32Array;
  readonly damage: Float32Array;
  private readonly speed: Float32Array;
  private readonly flash: Float32Array;
  private readonly squash: Float32Array;
  private readonly phase: Float32Array;
  private readonly yaw: Float32Array;
  readonly dead: Uint8Array;
  readonly elite: Uint8Array;
  /** Stable id per spawned enemy (indices move when enemies are removed). */
  readonly uid: Int32Array;
  private nextUid = 1;
  readonly stun: Float32Array;
  readonly slow: Float32Array;
  /** Takes extra damage while > 0 (Kontrola Biletów). */
  readonly vulnerable: Float32Array;
  /** Next time each weapon slot may hit this enemy again. */
  readonly hitCd: Float32Array;
  /** Bottles a collector has picked up (dropped on death). */
  readonly carry: Uint8Array;
  /** Charger state: 0 aiming/wind-up, 1 charging, 2 resting; timer and direction. */
  readonly chargeState: Uint8Array;
  /** Charges that ended against a wall almost immediately; after two the bus is moved somewhere clear. */
  private readonly chargeFails: Uint8Array;
  private readonly chargeStartX: Float32Array;
  private readonly chargeStartZ: Float32Array;
  /** Set by the game: puts a bus that keeps crashing into the same wall somewhere else. */
  onStuck: ((i: number) => void) | null = null;
  /** Set by the game: sound and particles for things the player should notice (bottle taken, charge, crash). */
  onEvent: ((kind: 'bottle' | 'charge' | 'crash', x: number, y: number, z: number) => void) | null = null;
  readonly chargeT: Float32Array;
  readonly chargeX: Float32Array;
  readonly chargeZ: Float32Array;
  bottles: BottleSource | null = null;
  private readonly size: Float32Array;
  private readonly climbing: Uint8Array;
  /** Result buffer of query(): indices and squared distances of the enemies found. */
  readonly found: Int32Array;
  readonly foundD2: Float32Array;
  private readonly floats: Float32Array[];
  // Death animations.
  private dyingCount = 0;
  private readonly dx = new Float32Array(DYING_MAX);
  private readonly dy = new Float32Array(DYING_MAX);
  private readonly dz = new Float32Array(DYING_MAX);
  private readonly dyaw = new Float32Array(DYING_MAX);
  private readonly dtype = new Uint8Array(DYING_MAX);
  private readonly dage = new Float32Array(DYING_MAX);
  private readonly dsize = new Float32Array(DYING_MAX);
  private readonly dyingFloats = [this.dx, this.dy, this.dz, this.dyaw, this.dage, this.dsize];
  // Spatial hash (counting sort, rebuilt every tick).
  private readonly gridN: number;
  private readonly gridOff: number;
  private readonly cellStart: Int32Array;
  private readonly cellCount: Int32Array;
  private readonly cellItems: Int32Array;
  private readonly cellOf: Int32Array;
  readonly types: TypeMeshes[] = [];
  kills = 0;

  constructor(
    scene: Scene,
    private readonly world: World,
  ) {
    const n = this.max;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.z = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.kx = new Float32Array(n);
    this.kz = new Float32Array(n);
    this.hp = new Float32Array(n);
    this.maxHp = new Float32Array(n);
    this.type = new Uint8Array(n);
    this.radius = new Float32Array(n);
    this.damage = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.flash = new Float32Array(n);
    this.squash = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.yaw = new Float32Array(n);
    this.dead = new Uint8Array(n);
    this.elite = new Uint8Array(n);
    this.uid = new Int32Array(n);
    this.stun = new Float32Array(n);
    this.slow = new Float32Array(n);
    this.vulnerable = new Float32Array(n);
    this.hitCd = new Float32Array(n * WEAPON_SLOTS);
    this.carry = new Uint8Array(n);
    this.chargeState = new Uint8Array(n);
    this.chargeFails = new Uint8Array(n);
    this.chargeStartX = new Float32Array(n);
    this.chargeStartZ = new Float32Array(n);
    this.chargeT = new Float32Array(n);
    this.chargeX = new Float32Array(n);
    this.chargeZ = new Float32Array(n);
    this.size = new Float32Array(n);
    this.climbing = new Uint8Array(n);
    this.found = new Int32Array(n);
    this.foundD2 = new Float32Array(n);
    this.floats = [this.x, this.y, this.z, this.px, this.py, this.pz, this.kx, this.kz, this.hp, this.maxHp, this.radius, this.damage, this.speed, this.flash, this.squash, this.phase, this.yaw, this.size, this.stun, this.slow, this.vulnerable, this.chargeT, this.chargeX, this.chargeZ];
    this.gridOff = world.radius + 4;
    this.gridN = Math.ceil((this.gridOff * 2) / HASH_CELL);
    this.cellStart = new Int32Array(this.gridN * this.gridN + 1);
    this.cellCount = new Int32Array(this.gridN * this.gridN);
    this.cellItems = new Int32Array(n);
    this.cellOf = new Int32Array(n);

    const ramp = toonRamp();
    for (const def of ENEMIES) {
      const model = enemyModel(def.id);
      const cap = n + DYING_MAX;
      const mat = new MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
      const body = new InstancedMesh(model.body, mat, cap);
      body.instanceMatrix.setUsage(DynamicDrawUsage);
      body.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3).setUsage(DynamicDrawUsage);
      body.frustumCulled = false;
      body.count = 0;
      const outline = new InstancedMesh(outlineGeometry(model.body), outlineMaterial(0.012), cap);
      outline.instanceMatrix = body.instanceMatrix;
      outline.frustumCulled = false;
      outline.count = 0;
      scene.add(body, outline);
      const t: TypeMeshes = { def, body, outline, wingOffset: model.wingOffset ?? [0, 0, 0], palette: def.palette.map((c) => new Color(c)), n: 0 };
      if (model.wing) {
        const wingGeo = model.wing;
        const mirrored = wingGeo.clone().scale(-1, 1, 1);
        // Mirroring flips the winding; swap two vertices of every triangle back.
        const p = mirrored.getAttribute('position');
        const nrm = mirrored.getAttribute('normal');
        for (let i = 0; i < p.count; i += 3) {
          for (const a of [p, nrm]) {
            const x = a.getX(i + 1);
            const y = a.getY(i + 1);
            const z = a.getZ(i + 1);
            a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2));
            a.setXYZ(i + 2, x, y, z);
          }
        }
        mirrored.computeVertexNormals();
        t.wingR = new InstancedMesh(wingGeo, mat, cap);
        t.wingL = new InstancedMesh(mirrored, mat, cap);
        for (const w of [t.wingR, t.wingL]) {
          w.instanceMatrix.setUsage(DynamicDrawUsage);
          w.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3).setUsage(DynamicDrawUsage);
          w.frustumCulled = false;
          w.count = 0;
          scene.add(w);
        }
      }
      this.types.push(t);
    }
  }

  spawn(typeIndex: number, x: number, z: number, hpMul: number, dmgMul: number, rng: Rng, elite = false): void {
    if (this.count >= this.max || typeIndex >= ENEMIES.length) return;
    const def = ENEMIES[typeIndex];
    const i = this.count++;
    const e = elite ? 1 : 0;
    const k = elite ? 1.6 : 1;
    const y = def.flying ? 1.6 + rng.next() * 0.8 : this.world.groundAt(x, z, def.radius, 50);
    this.x[i] = this.px[i] = x;
    this.z[i] = this.pz[i] = z;
    this.y[i] = this.py[i] = y;
    this.kx[i] = this.kz[i] = 0;
    this.type[i] = typeIndex;
    this.hp[i] = this.maxHp[i] = def.hp * hpMul * (elite ? 12 : 1);
    this.radius[i] = def.radius * k;
    this.damage[i] = def.damage * dmgMul * (elite ? 1.6 : 1);
    this.speed[i] = def.speed * (0.9 + rng.next() * 0.2) * (elite ? 0.85 : 1);
    this.flash[i] = 0;
    this.squash[i] = 0.5;
    this.phase[i] = rng.next() * 10;
    this.yaw[i] = 0;
    this.size[i] = k;
    this.dead[i] = 0;
    this.elite[i] = e;
    this.climbing[i] = 0;
    this.uid[i] = this.nextUid++;
    this.stun[i] = this.slow[i] = this.vulnerable[i] = 0;
    this.hitCd.fill(0, i * WEAPON_SLOTS, (i + 1) * WEAPON_SLOTS);
    this.carry[i] = 0;
    this.chargeState[i] = 0;
    this.chargeT[i] = 1.2;
    this.chargeX[i] = 0;
    this.chargeZ[i] = 1;
    this.chargeFails[i] = 0;
  }

  /** Enemy i overlaps a circle at (px, pz): an oriented box for the bus, a circle for everyone else. */
  overlaps(i: number, px: number, pz: number, pr: number): boolean {
    const dx = px - this.x[i];
    const dz = pz - this.z[i];
    if (ENEMIES[this.type[i]].behavior !== 'charger') {
      const r = pr + this.radius[i];
      return dx * dx + dz * dz <= r * r;
    }
    const c = Math.cos(-this.yaw[i]);
    const sn = Math.sin(-this.yaw[i]);
    // Into the bus's own frame: x across the body, z along it.
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    const ex = Math.max(0, Math.abs(lx) - BUS_HALF_X);
    const ez = Math.max(0, Math.abs(lz) - BUS_HALF_Z);
    return ex * ex + ez * ez <= pr * pr;
  }

  /** Per-weapon hit cooldown: true (and arms the cooldown) if this weapon slot may hit enemy i now. */
  tryHit(i: number, slot: number, time: number, cooldown: number): boolean {
    const k = i * WEAPON_SLOTS + slot;
    if (this.hitCd[k] > time) return false;
    this.hitCd[k] = time + cooldown;
    return true;
  }

  clear(): void {
    this.count = 0;
    this.dyingCount = 0;
  }

  // ---------- Spatial hash ----------

  private cellIndex(x: number, z: number): number {
    const cx = Math.min(this.gridN - 1, Math.max(0, Math.floor((x + this.gridOff) / HASH_CELL)));
    const cz = Math.min(this.gridN - 1, Math.max(0, Math.floor((z + this.gridOff) / HASH_CELL)));
    return cz * this.gridN + cx;
  }

  rebuildHash(): void {
    this.cellCount.fill(0);
    for (let i = 0; i < this.count; i++) {
      const c = this.cellIndex(this.x[i] ?? 0, this.z[i] ?? 0);
      this.cellOf[i] = c;
      this.cellCount[c] = (this.cellCount[c] ?? 0) + 1;
    }
    let acc = 0;
    for (let c = 0; c < this.cellCount.length; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c] ?? 0;
    }
    this.cellStart[this.cellCount.length] = acc;
    this.cellCount.fill(0);
    for (let i = 0; i < this.count; i++) {
      const c = this.cellOf[i] ?? 0;
      this.cellItems[(this.cellStart[c] ?? 0) + (this.cellCount[c] ?? 0)] = i;
      this.cellCount[c] = (this.cellCount[c] ?? 0) + 1;
    }
  }

  /**
   * Finds every live enemy whose centre is within r of (x, z), using the hash built this tick.
   * Results go to `found` / `foundD2` (no allocation); returns how many.
   */
  query(x: number, z: number, r: number): number {
    const n = this.gridN;
    const c0x = Math.max(0, Math.floor((x - r + this.gridOff) / HASH_CELL));
    const c1x = Math.min(n - 1, Math.floor((x + r + this.gridOff) / HASH_CELL));
    const c0z = Math.max(0, Math.floor((z - r + this.gridOff) / HASH_CELL));
    const c1z = Math.min(n - 1, Math.floor((z + r + this.gridOff) / HASH_CELL));
    const r2 = r * r;
    let count = 0;
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const c = cz * n + cx;
        const end = this.cellStart[c + 1];
        for (let k = this.cellStart[c]; k < end; k++) {
          const i = this.cellItems[k];
          if (this.dead[i]) continue;
          const dx = this.x[i] - x;
          const dz = this.z[i] - z;
          const d2 = dx * dx + dz * dz;
          if (d2 <= r2) {
            this.found[count] = i;
            this.foundD2[count] = d2;
            count++;
          }
        }
      }
    }
    return count;
  }

  /** Index of the closest live enemy within r, or -1. */
  nearest(x: number, z: number, r: number): number {
    const n = this.query(x, z, r);
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < n; k++) {
      if (this.foundD2[k] < bestD) {
        bestD = this.foundD2[k];
        best = this.found[k];
      }
    }
    return best;
  }

  // ---------- Simulation ----------

  update(dt: number, px: number, py: number, pz: number, time: number): void {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      this.px[i] = this.x[i];
      this.py[i] = this.y[i];
      this.pz[i] = this.z[i];
    }
    const grid = this.gridN;
    const decay = Math.exp(-7 * dt);
    for (let i = 0; i < n; i++) {
      if (this.dead[i]) continue;
      const def = ENEMIES[this.type[i]];
      const x = this.x[i];
      const z = this.z[i];
      this.stun[i] = Math.max(0, this.stun[i] - dt);
      this.slow[i] = Math.max(0, this.slow[i] - dt);
      this.vulnerable[i] = Math.max(0, this.vulnerable[i] - dt);
      if (def.behavior === 'charger') {
        this.charge(i, dt, px, pz);
        continue;
      }
      let tx = px;
      let tz = pz;
      // Collectors go for the nearest bottle on the ground before Piotrek does.
      if (def.behavior === 'collector' && this.bottles) {
        const b = this.bottles.nearestBottle(x, z, 16);
        if (b >= 0) {
          tx = this.bottles.bottleX(b);
          tz = this.bottles.bottleZ(b);
          if ((tx - x) ** 2 + (tz - z) ** 2 < 0.8) {
            this.bottles.takeBottle(b);
            this.carry[i] = Math.min(255, this.carry[i] + 1);
            this.onEvent?.('bottle', x, this.y[i], z);
          }
        }
      }
      let dx = tx - x;
      let dz = tz - z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
      // Separation from neighbours (inline hash walk: no closures in the hot loop).
      let sx = 0;
      let sz = 0;
      const r = this.radius[i];
      const reach = r * 2.2;
      const c0x = Math.max(0, Math.floor((x - reach + this.gridOff) / HASH_CELL));
      const c1x = Math.min(grid - 1, Math.floor((x + reach + this.gridOff) / HASH_CELL));
      const c0z = Math.max(0, Math.floor((z - reach + this.gridOff) / HASH_CELL));
      const c1z = Math.min(grid - 1, Math.floor((z + reach + this.gridOff) / HASH_CELL));
      for (let cz = c0z; cz <= c1z; cz++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const c = cz * grid + cx;
          const end = this.cellStart[c + 1];
          for (let k = this.cellStart[c]; k < end; k++) {
            const j = this.cellItems[k];
            if (j === i || this.dead[j]) continue;
            const ox = x - this.x[j];
            const oz = z - this.z[j];
            const d2 = ox * ox + oz * oz;
            if (d2 < 1e-6 || d2 > reach * reach) continue;
            const dd = Math.sqrt(d2);
            const push = (reach - dd) / reach;
            sx += (ox / dd) * push;
            sz += (oz / dd) * push;
          }
        }
      }
      const sp = this.stun[i] > 0 ? 0 : this.speed[i] * (this.slow[i] > 0 ? 0.5 : 1);
      const vx = dx * sp + sx * 3.2 + this.kx[i];
      const vz = dz * sp + sz * 3.2 + this.kz[i];
      this.kx[i] *= decay;
      this.kz[i] *= decay;
      pushPos.x = x + vx * dt;
      pushPos.z = z + vz * dt;
      if (def.flying) {
        // Fly at head height, but over rooftops rather than through them.
        const roof = this.world.groundAt(pushPos.x, pushPos.z, r, 100);
        const targetY = Math.max(py + 1.3, roof + 1.1) + Math.sin(time * 3 + this.phase[i]) * 0.25;
        this.y[i] += (targetY - this.y[i]) * Math.min(1, dt * 2.5);
        const lim = this.world.radius - r;
        const dd = Math.hypot(pushPos.x, pushPos.z);
        if (dd > lim) {
          pushPos.x *= lim / dd;
          pushPos.z *= lim / dd;
        }
      } else {
        const cy = this.y[i];
        pushPos.y = cy;
        const blocked = this.world.collide(pushPos, r, 1, 0.5);
        // Climb up walls towards Piotrek standing on a roof or a platform.
        const climb = blocked && py - cy > 0.7;
        this.climbing[i] = climb ? 1 : 0;
        const g = this.world.groundAt(pushPos.x, pushPos.z, r * 0.6, cy + 0.5);
        if (climb) this.y[i] = cy + 3.2 * dt;
        else this.y[i] = g > cy ? g : Math.max(g, cy - 12 * dt);
      }
      this.x[i] = pushPos.x;
      this.z[i] = pushPos.z;
      this.yaw[i] = Math.atan2(vx, vz);
      this.flash[i] = Math.max(0, this.flash[i] - dt);
      this.squash[i] = Math.max(0, this.squash[i] - dt * 4);
    }
    for (let k = 0; k < this.dyingCount; k++) this.dage[k] += dt;
  }

  /** Charger (Autobus ZKA): wind up facing Piotrek, charge in a straight line, rest, repeat. */
  private charge(i: number, dt: number, px: number, pz: number): void {
    this.chargeT[i] -= dt;
    const x = this.x[i];
    const z = this.z[i];
    if (this.chargeState[i] === 0) {
      // Aim while winding up; lock the direction shortly before the charge.
      if (this.chargeT[i] > 0.5) {
        const dx = px - x;
        const dz = pz - z;
        const d = Math.hypot(dx, dz) || 1;
        this.chargeX[i] = dx / d;
        this.chargeZ[i] = dz / d;
        this.yaw[i] = Math.atan2(dx, dz);
      }
      if (this.chargeT[i] <= 0) {
        this.chargeState[i] = 1;
        this.chargeT[i] = 3.2;
        this.chargeStartX[i] = x;
        this.chargeStartZ[i] = z;
        this.onEvent?.('charge', x, this.y[i], z);
      }
    } else if (this.chargeState[i] === 1) {
      const sp = this.stun[i] > 0 ? 0 : this.speed[i];
      pushPos.x = x + this.chargeX[i] * sp * dt;
      pushPos.z = z + this.chargeZ[i] * sp * dt;
      pushPos.y = this.y[i];
      const crashed = this.world.collide(pushPos, this.radius[i], 2.5, 0.5);
      this.x[i] = pushPos.x;
      this.z[i] = pushPos.z;
      if (crashed || this.chargeT[i] <= 0) {
        this.chargeState[i] = 2;
        this.chargeT[i] = 1.4;
        if (crashed) {
          this.squash[i] = 1;
          this.onEvent?.('crash', this.x[i], this.y[i], this.z[i]);
          const run = Math.hypot(this.x[i] - this.chargeStartX[i], this.z[i] - this.chargeStartZ[i]);
          // Charges that die against the same wall over and over: move the bus instead of letting it rev forever.
          this.chargeFails[i] = run < 5 ? this.chargeFails[i] + 1 : 0;
          if (this.chargeFails[i] >= 2) {
            this.chargeFails[i] = 0;
            this.onStuck?.(i);
          }
        } else this.chargeFails[i] = 0;
      }
    } else if (this.chargeT[i] <= 0) {
      this.chargeState[i] = 0;
      this.chargeT[i] = 1.6;
    }
    this.flash[i] = Math.max(0, this.flash[i] - dt);
    this.squash[i] = Math.max(0, this.squash[i] - dt * 4);
  }

  /** True while a charger is winding up (the game draws the warning line). */
  windingUp(i: number): boolean {
    return this.chargeState[i] === 0 && ENEMIES[this.type[i]].behavior === 'charger';
  }

  isFlying(i: number): boolean {
    return ENEMIES[this.type[i]].flying;
  }

  /** Applies damage and knockback. Returns true if this hit killed the enemy. */
  hit(i: number, amount: number, dirX: number, dirZ: number, knockback: number): boolean {
    if (this.dead[i]) return false;
    const def = ENEMIES[this.type[i] ?? 0];
    const k = knockback * (1 - def.heavy);
    this.kx[i] = (this.kx[i] ?? 0) + dirX * k;
    this.kz[i] = (this.kz[i] ?? 0) + dirZ * k;
    this.flash[i] = TUNING.feel.flashTime;
    this.squash[i] = 1;
    this.hp[i] = (this.hp[i] ?? 0) - amount;
    if ((this.hp[i] ?? 0) <= 0) {
      this.dead[i] = 1;
      return true;
    }
    return false;
  }

  /** Removes dead enemies (swap with the last), starting their death animation. */
  sweep(onDeath: (x: number, y: number, z: number, type: number, elite: boolean, carried: number) => void): void {
    let i = 0;
    while (i < this.count) {
      if (!this.dead[i]) {
        i++;
        continue;
      }
      const x = this.x[i] ?? 0;
      const y = this.y[i] ?? 0;
      const z = this.z[i] ?? 0;
      const t = this.type[i] ?? 0;
      onDeath(x, y, z, t, this.elite[i] === 1, this.carry[i]);
      if (this.dyingCount < DYING_MAX) {
        const d = this.dyingCount++;
        this.dx[d] = x;
        this.dy[d] = y;
        this.dz[d] = z;
        this.dyaw[d] = this.yaw[i];
        this.dsize[d] = this.size[i];
        this.dtype[d] = t;
        this.dage[d] = 0;
      }
      this.kills++;
      this.copy(--this.count, i);
    }
  }

  private copy(from: number, to: number): void {
    if (from === to) return;
    for (const a of this.floats) a[to] = a[from];
    this.type[to] = this.type[from];
    this.dead[to] = this.dead[from];
    this.elite[to] = this.elite[from];
    this.climbing[to] = this.climbing[from];
    this.uid[to] = this.uid[from];
    this.carry[to] = this.carry[from];
    this.chargeState[to] = this.chargeState[from];
    this.hitCd.copyWithin(to * WEAPON_SLOTS, from * WEAPON_SLOTS, (from + 1) * WEAPON_SLOTS);
  }

  /** Death animations that just finished: returns how many and lets the caller burst them into chunks. */
  finishDeaths(onDone: (x: number, y: number, z: number, type: number) => void): void {
    let k = 0;
    while (k < this.dyingCount) {
      if ((this.dage[k] ?? 0) < DEATH_TIME) {
        k++;
        continue;
      }
      onDone(this.dx[k] ?? 0, this.dy[k] ?? 0, this.dz[k] ?? 0, this.dtype[k] ?? 0);
      const last = --this.dyingCount;
      for (const a of this.dyingFloats) a[k] = a[last];
      this.dtype[k] = this.dtype[last] ?? 0;
    }
  }

  /** Teleports an enemy (used to bring stragglers back near the player). */
  move(i: number, x: number, z: number): void {
    const def = ENEMIES[this.type[i] ?? 0];
    const y = def.flying ? (this.y[i] ?? 2) : this.world.groundAt(x, z, this.radius[i] ?? 0.4, 50);
    this.x[i] = this.px[i] = x;
    this.z[i] = this.pz[i] = z;
    this.y[i] = this.py[i] = y;
  }

  palette(type: number): Color[] {
    return this.types[type].palette;
  }

  // ---------- Rendering ----------

  render(alpha: number, time: number, shadows: BlobShadows): void {
    for (const t of this.types) t.n = 0;
    for (let i = 0; i < this.count; i++) {
      const t = this.types[this.type[i] ?? 0];
      const x = (this.px[i] ?? 0) + ((this.x[i] ?? 0) - (this.px[i] ?? 0)) * alpha;
      const y = (this.py[i] ?? 0) + ((this.y[i] ?? 0) - (this.py[i] ?? 0)) * alpha;
      const z = (this.pz[i] ?? 0) + ((this.z[i] ?? 0) - (this.pz[i] ?? 0)) * alpha;
      const ph = (this.phase[i] ?? 0) + time * (this.speed[i] ?? 3) * 2.2;
      const sq = this.squash[i] ?? 0;
      let bob: number;
      let roll = 0;
      let pitch = 0;
      let yawWiggle = 0;
      switch (t.def.id) {
        case 'golab':
          bob = Math.abs(Math.sin(ph * 1.4)) * 0.08;
          pitch = Math.sin(ph * 1.4) * 0.12;
          break;
        case 'szczur':
          yawWiggle = Math.sin(ph * 2.2) * 0.18;
          bob = Math.abs(Math.sin(ph * 2.2)) * 0.03;
          break;
        default:
          roll = Math.sin(ph) * 0.12;
          bob = Math.abs(Math.sin(ph)) * 0.06;
      }
      const k = this.size[i];
      const s = (1 + sq * 0.25) * k;
      if (this.climbing[i]) pitch -= 0.9;
      if (this.stun[i] > 0) roll += Math.sin(time * 30) * 0.12;
      this.compose(x, y + bob, z, this.yaw[i] + yawWiggle, pitch, roll, s, (1 - sq * 0.25) * k, s);
      const idx = t.n++;
      t.body.setMatrixAt(idx, m4);
      // Status reads from the body colour: white flash on hit, gold elite, purple vulnerable,
      // pale blue stunned, cyan slowed.
      if (this.flash[i] > 0) tmpColor.setRGB(3.2, 3.2, 3.2);
      else if (this.vulnerable[i] > 0) tmpColor.setRGB(1.7, 0.75, 1.5);
      else if (this.stun[i] > 0) tmpColor.setRGB(0.95, 1.25, 1.9);
      else if (this.slow[i] > 0) tmpColor.setRGB(0.7, 1.15, 1.35);
      else if (this.elite[i]) tmpColor.setRGB(1.45, 1.2, 0.55);
      else if (this.carry[i] > 0) tmpColor.setRGB(0.95, 1.3 + Math.min(0.5, this.carry[i] * 0.08), 1.0);
      else tmpColor.setRGB(1, 1, 1);
      t.body.setColorAt(idx, tmpColor);
      if (t.wingL && t.wingR) {
        const flap = Math.sin(time * 26 + (this.phase[i] ?? 0)) * 0.9;
        this.wing(t, idx, x, y + bob, z, this.yaw[i] + yawWiggle, s, flap, tmpColor);
      }
      const ground = t.def.flying ? this.world.groundAt(x, z, 0.1, y) : y;
      shadows.add(x, ground, z, this.radius[i] ?? 0.4, y - ground);
    }
    for (let k = 0; k < this.dyingCount; k++) {
      const t = this.types[this.dtype[k] ?? 0];
      const a = Math.min(1, (this.dage[k] ?? 0) / DEATH_TIME);
      // Pop up, then flatten before bursting into chunks.
      const ks = this.dsize[k];
      const sx = (1 + a * 0.55) * ks;
      const sy = Math.max(0.05, 1.25 - a * 1.2) * ks;
      this.compose(this.dx[k] ?? 0, this.dy[k] ?? 0, this.dz[k] ?? 0, this.dyaw[k] ?? 0, 0, 0, sx, sy, sx);
      const idx = t.n++;
      t.body.setMatrixAt(idx, m4);
      tmpColor.setRGB(4, 4, 4);
      t.body.setColorAt(idx, tmpColor);
      if (t.wingL && t.wingR) this.wing(t, idx, this.dx[k] ?? 0, this.dy[k] ?? 0, this.dz[k] ?? 0, this.dyaw[k] ?? 0, sx, 1.2, tmpColor);
    }
    for (const t of this.types) {
      t.body.count = t.n;
      t.outline.count = t.n;
      t.body.instanceMatrix.needsUpdate = true;
      if (t.body.instanceColor) t.body.instanceColor.needsUpdate = true;
      for (const w of [t.wingL, t.wingR]) {
        if (!w) continue;
        w.count = t.n;
        w.instanceMatrix.needsUpdate = true;
        if (w.instanceColor) w.instanceColor.needsUpdate = true;
      }
    }
  }

  private compose(x: number, y: number, z: number, yaw: number, pitch: number, roll: number, sx: number, sy: number, sz: number): void {
    q.setFromAxisAngle(axisY, yaw);
    if (pitch) q.multiply(qa.setFromAxisAngle(axisX, pitch));
    if (roll) q.multiply(qa.setFromAxisAngle(axisZ, roll));
    m4.compose(pos.set(x, y, z), q, scl.set(sx, sy, sz));
  }

  private wing(t: TypeMeshes, idx: number, x: number, y: number, z: number, yaw: number, s: number, flap: number, color: Color): void {
    const ox = t.wingOffset[0];
    const oy = t.wingOffset[1];
    const oz = t.wingOffset[2];
    for (let side = 1; side >= -1; side -= 2) {
      const mesh = side === 1 ? t.wingR : t.wingL;
      if (!mesh) continue;
      const c = Math.cos(yaw);
      const sn = Math.sin(yaw);
      const lx = side * ox * s;
      const wx = x + lx * c + oz * s * sn;
      const wz = z - lx * sn + oz * s * c;
      q.setFromAxisAngle(axisY, yaw);
      q.multiply(qa.setFromAxisAngle(axisZ, side * flap));
      m4.compose(pos.set(wx, y + oy * s, wz), q, scl.set(s, s, s));
      mesh.setMatrixAt(idx, m4);
      mesh.setColorAt(idx, color);
    }
  }
}
