import { Box3, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshToonMaterial, Quaternion, Vector2, Vector3, type Scene } from 'three';
import { ENEMIES, type EnemyDef } from '../content/enemies';
import { TUNING } from '../content/tuning';
import { outlineGeometry } from '../characters/geometry';
import { disposeTree } from '../render/dispose';
import { outlineMaterial, toonRamp } from '../render/toon';
import type { Rng } from '../core/rng';
import type { BlobShadows } from '../render/fx';
import { enemyModel } from './enemy-models';
import type { World } from './world';

const HASH_CELL = 2;

/** Elite affixes (Diablo-style), a bit mask per enemy. */
export const AFFIX = { fast: 1, armored: 2, vampire: 4, explosive: 8, blink: 16, summoner: 32 } as const;
export type AffixId = keyof typeof AFFIX;
export const AFFIX_IDS = Object.keys(AFFIX) as AffixId[];
/** Not an affix but a flag in the same bits: an elite that pays no chest and no XP burst (the ladder's kanar). */
export const UNPAID = 64;
/** The real affixes among the bits (everything but UNPAID). */
export const AFFIX_BITS = 63;
/** A hop over a low fence: a committed arc, so it never ends up standing on top of the fence. */
const HOP_TIME = 0.55;
const HOP_HEIGHT = 1.5;
/** Speed of a Szybki elite, damage taken by a Pancerny one, a Wampir's regeneration (share of health/s). */
const FAST_MUL = 1.5;
const ARMORED_TAKEN = 0.5;
const VAMPIRE_REGEN = 0.015;
/** Seconds between a Teleportujący elite's jumps (and the warning before it lands), a Przywoływacz's calls. */
export const BLINK_EVERY = 4.5;
export const BLINK_WARN = 0.6;
const SUMMON_EVERY = 6;
/** What standing near a Brygadzista gives (from the content; one buffer type). */
const BUFFER = ENEMIES.find((e) => e.buffs)?.buffs;
const BUFF_SPEED = BUFFER?.speed ?? 1.3;
const BUFF_ARMOR = BUFFER?.armor ?? 0.3;

/** Enemy moments the game turns into hazards, sounds and spawns (`x`, `z` and `extra` depend on the kind). */
export type EnemyAct =
  /** A thrower raised its flare: the warning. */
  | 'windup'
  /** A thrower throws at (x, z). */
  | 'shoot'
  /** A dasher paints its lane (`extra`: seconds before it goes). */
  | 'aim'
  /** A jumper leaves the ground for (x, z), landing in `extra` seconds. */
  | 'leap'
  /** A Teleportujący elite will appear at (x, z) in `extra` seconds. */
  | 'blink'
  /** A Przywoływacz elite calls help at (x, z). */
  | 'summon';
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
/** Stuns a boss recovers from per second (see Enemies.stunFor). */
const STUN_RECOVERY = 0.25;
/** The longest a single stun holds a boss, and the seconds after a stun in which it takes no new one. */
const BOSS_STUN_MAX = 1.5;
const BOSS_STUN_GAP = 2;
/** The Nocne Kanary speed up by this much a second, to past a bunny hop's top speed (TUNING.player.airMaxSpeed). */
const NIGHT_ACCEL = 0.25;
const NIGHT_TOP = 16;
/** Half extents of the bus body, used for contact instead of its spawn radius. */
const BUS_BOX: [number, number] = [1.35, 3.4];

interface TypeMeshes {
  def: EnemyDef;
  body: InstancedMesh;
  outline: InstancedMesh;
  wingL?: InstancedMesh;
  wingR?: InstancedMesh;
  wingOffset: [number, number, number];
  palette: Color[];
  n: number;
  /** The model's bounds (bosses: to tell when the camera is inside the body). */
  box: Box3;
}

/** All enemies in flat typed arrays (structure of arrays), drawn with one instanced mesh per type. */
export class Enemies {
  readonly max = TUNING.waves.maxEnemies;
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  private readonly kx: Float32Array;
  private readonly kz: Float32Array;
  readonly hp: Float32Array;
  readonly maxHp: Float32Array;
  readonly type: Uint8Array;
  readonly radius: Float32Array;
  readonly damage: Float32Array;
  readonly speed: Float32Array;
  private readonly flash: Float32Array;
  readonly squash: Float32Array;
  private readonly phase: Float32Array;
  readonly yaw: Float32Array;
  readonly dead: Uint8Array;
  readonly elite: Uint8Array;
  /** Stable id per spawned enemy (indices move when enemies are removed). */
  readonly uid: Int32Array;
  private nextUid = 1;
  readonly stun: Float32Array;
  /** How many recent stuns a boss is still shrugging off (decays; see `stunFor`). */
  private readonly stunDr: Float32Array;
  readonly slow: Float32Array;
  /** Takes extra damage while > 0 (Kontrola Biletów). */
  readonly vulnerable: Float32Array;
  /** Next time each weapon slot may hit this enemy again. */
  readonly hitCd: Float32Array;
  /** Bottles a collector has picked up (dropped on death). */
  readonly carry: Uint8Array;
  /** A courier that reached its target: it leaves the pool without dying (no drops, no kill). */
  private readonly delivered: Uint8Array;
  /** Where couriers run to (the finale's boss), and whether anyone is there to deliver to. */
  courierX = 0;
  courierZ = 0;
  courierOn = false;
  /** Charger state: 0 aiming/wind-up, 1 charging, 2 resting; timer and direction. */
  readonly chargeState: Uint8Array;
  /** Charges that ended against a wall almost immediately; after two the bus is moved somewhere clear. */
  private readonly chargeFails: Uint8Array;
  private readonly chargeStartX: Float32Array;
  private readonly chargeStartZ: Float32Array;
  /** Set by the game: puts a bus that keeps crashing into the same wall somewhere else. */
  onStuck: ((i: number) => void) | null = null;
  /** Set by the game: sound and particles for things the player should notice (bottle taken, charge, crash). */
  onEvent: ((kind: 'bottle' | 'charge' | 'crash' | 'delivery', x: number, y: number, z: number) => void) | null = null;
  /** Set by the game: the new archetypes' and the elites' moves (see `EnemyAct`). */
  onAct: ((kind: EnemyAct, i: number, x: number, z: number, extra: number) => void) | null = null;
  /** Elite affixes (AFFIX bits). */
  readonly affix: Uint8Array;
  /** Seconds to an affix's next move (blink, summon) and to a pending blink landing. */
  readonly affixT: Float32Array;
  /** A Przywoływacz's own clock (a Teleportujący Przywoływacz keeps both). */
  readonly summonT: Float32Array;
  /** Seconds left of a hop over a fence, and the height it took off from. */
  readonly hopT: Float32Array;
  readonly hopY: Float32Array;
  readonly blinkT: Float32Array;
  readonly blinkX: Float32Array;
  readonly blinkZ: Float32Array;
  /** Within reach of a buffer this step (moves faster, takes less). */
  readonly buffed: Uint8Array;
  /** Walking round a wall: the direction and the seconds left. */
  readonly detourX: Float32Array;
  readonly detourZ: Float32Array;
  readonly detourT: Float32Array;
  /** Where a jumper took off from. */
  readonly jumpX: Float32Array;
  readonly jumpY: Float32Array;
  readonly jumpZ: Float32Array;
  readonly jumpTY: Float32Array;
  /** A hit just taken on a shield from the front (the game sparks it blue). */
  blocked = false;
  /** The spawn stream, kept for the moves that need a dice (where a blink lands). */
  private rng: Rng | null = null;
  readonly chargeT: Float32Array;
  readonly chargeX: Float32Array;
  readonly chargeZ: Float32Array;
  bottles: BottleSource | null = null;
  readonly size: Float32Array;
  private readonly climbing: Uint8Array;
  /** Result buffer of query(): indices and squared distances of the enemies found. */
  readonly found: Int32Array;
  readonly foundD2: Float32Array;
  /** Not simulation state (replays and snapshots skip them, src/game/replay.ts): query buffers rewritten before
   * every read, and the drawing's own (the meshes per type, the camera's eye). */
  readonly notState = ['found', 'foundD2', 'types', 'eye'];
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
  /**
   * The spatial hash: per cell, the first enemy in it (-1: none), and per enemy the next one in its cell, in
   * ascending index order. Only the cells used by the last build are cleared (the grid is thousands of cells,
   * the crowd tens to hundreds of enemies).
   */
  private readonly cellHead: Int32Array;
  private readonly cellNext: Int32Array;
  private readonly cellsUsed: Int32Array;
  private cellsUsedN = 0;
  readonly types: TypeMeshes[] = [];
  kills = 0;
  /** Health of every ordinary enemy spawned since the pool was built (the simulation's enemy-health curve). */
  spawnedHp = 0;

  constructor(
    scene: Scene,
    private readonly world: World,
    /** Extra types built for this arena only (the station's boss). */
    extraTypes: EnemyDef[] = [],
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
    this.stunDr = new Float32Array(n);
    this.slow = new Float32Array(n);
    this.vulnerable = new Float32Array(n);
    this.hitCd = new Float32Array(n * WEAPON_SLOTS);
    this.carry = new Uint8Array(n);
    this.delivered = new Uint8Array(n);
    this.chargeState = new Uint8Array(n);
    this.chargeFails = new Uint8Array(n);
    this.chargeStartX = new Float32Array(n);
    this.chargeStartZ = new Float32Array(n);
    this.chargeT = new Float32Array(n);
    this.chargeX = new Float32Array(n);
    this.chargeZ = new Float32Array(n);
    this.size = new Float32Array(n);
    this.climbing = new Uint8Array(n);
    this.affix = new Uint8Array(n);
    this.affixT = new Float32Array(n);
    this.summonT = new Float32Array(n);
    this.hopT = new Float32Array(n);
    this.hopY = new Float32Array(n);
    this.blinkT = new Float32Array(n);
    this.blinkX = new Float32Array(n);
    this.blinkZ = new Float32Array(n);
    this.buffed = new Uint8Array(n);
    this.detourX = new Float32Array(n);
    this.detourZ = new Float32Array(n);
    this.detourT = new Float32Array(n);
    this.jumpX = new Float32Array(n);
    this.jumpY = new Float32Array(n);
    this.jumpZ = new Float32Array(n);
    this.jumpTY = new Float32Array(n);
    this.found = new Int32Array(n);
    this.foundD2 = new Float32Array(n);
    this.floats = [this.x, this.y, this.z, this.px, this.py, this.pz, this.kx, this.kz, this.hp, this.maxHp, this.radius, this.damage, this.speed, this.flash, this.squash, this.phase, this.yaw, this.size, this.stun, this.stunDr, this.slow, this.vulnerable, this.chargeT, this.chargeX, this.chargeZ, this.affixT, this.summonT, this.hopT, this.hopY, this.blinkT, this.blinkX, this.blinkZ, this.jumpX, this.jumpY, this.jumpZ, this.jumpTY, this.detourX, this.detourZ, this.detourT];
    this.gridOff = world.radius + 4;
    this.gridN = Math.ceil((this.gridOff * 2) / HASH_CELL);
    this.cellHead = new Int32Array(this.gridN * this.gridN).fill(-1);
    this.cellNext = new Int32Array(n);
    this.cellsUsed = new Int32Array(n);

    const ramp = toonRamp();
    for (const def of [...ENEMIES, ...extraTypes]) {
      const model = enemyModel(def.id);
      const cap = n + DYING_MAX;
      const mat = new MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
      model.body.computeBoundingBox();
      const box = model.body.boundingBox ?? new Box3();
      // Anything that comes right up to the camera dithers out instead of filling the screen (a worker or
      // the charging bus brushing past it): over a range that grows with the model, up to a four-metre boss.
      // A uniform, so every type shares one program.
      const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
      const fade: [number, number] = def.behavior === 'boss' ? [1.8, 4.6] : [Math.max(1.6, size * 0.9) * 0.45, Math.max(1.6, size * 0.9)];
      const fadeRange = new Vector2(fade[0], fade[1]);
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.fadeRange = { value: fadeRange };
        sh.fragmentShader = `uniform vec2 fadeRange;\n${sh.fragmentShader}`.replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
          float nearFade = smoothstep(fadeRange.x, fadeRange.y, length(vViewPosition));
          if (nearFade < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`,
        );
      };
      const body = new InstancedMesh(model.body, mat, cap);
      body.instanceMatrix.setUsage(DynamicDrawUsage);
      body.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3).setUsage(DynamicDrawUsage);
      body.frustumCulled = false;
      body.count = 0;
      const outline = new InstancedMesh(outlineGeometry(model.body), outlineMaterial(0.012, undefined, fade), cap);
      outline.instanceMatrix = body.instanceMatrix;
      outline.frustumCulled = false;
      outline.count = 0;
      scene.add(body, outline);
      const t: TypeMeshes = { def, body, outline, wingOffset: model.wingOffset ?? [0, 0, 0], palette: def.palette.map((c) => new Color(c)), n: 0, box };
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

  spawn(typeIndex: number, x: number, z: number, hpMul: number, dmgMul: number, rng: Rng, elite = false, affix = 0): void {
    if (this.count >= this.max || typeIndex >= this.types.length) return;
    this.rng = rng;
    const def = this.types[typeIndex].def;
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
    if (def.behavior !== 'boss' && def.behavior !== 'night') this.spawnedHp += this.hp[i];
    this.radius[i] = def.radius * k;
    this.damage[i] = def.damage * dmgMul * (elite ? 1.35 : 1);
    this.speed[i] = def.speed * (def.behavior === 'night' ? 1 : this.speedScale) * (0.9 + rng.next() * 0.2) * (elite ? 0.85 : 1);
    this.flash[i] = 0;
    this.squash[i] = 0.5;
    this.phase[i] = rng.next() * 10;
    this.yaw[i] = 0;
    this.size[i] = k;
    this.dead[i] = 0;
    this.elite[i] = e;
    this.climbing[i] = 0;
    this.uid[i] = this.nextUid++;
    this.stun[i] = this.stunDr[i] = this.slow[i] = this.vulnerable[i] = 0;
    this.hitCd.fill(0, i * WEAPON_SLOTS, (i + 1) * WEAPON_SLOTS);
    this.carry[i] = 0;
    this.delivered[i] = 0;
    this.chargeState[i] = 0;
    this.chargeT[i] = 1.2;
    this.chargeX[i] = 0;
    this.chargeZ[i] = 1;
    this.chargeFails[i] = 0;
    this.affix[i] = affix;
    this.affixT[i] = BLINK_EVERY * (0.5 + rng.next() * 0.5);
    this.summonT[i] = SUMMON_EVERY * (0.5 + rng.next() * 0.5);
    this.hopT[i] = 0;
    this.blinkT[i] = 0;
    this.detourT[i] = 0;
    this.buffed[i] = 0;
    // Archetypes start their cycle part-way, so a group does not move in lockstep.
    if (def.behavior === 'sprinter') this.chargeT[i] = 0.6 + rng.next() * 2;
    if (def.behavior === 'shooter' && def.shot) this.chargeT[i] = def.shot.cooldown * (0.3 + rng.next() * 0.7);
    if (def.behavior === 'dasher' || def.behavior === 'jumper') this.chargeT[i] = 0;
  }

  /** Effective speed multiplier from buffs and affixes (stun and slow are applied where speed is used). */
  /** The kurs's enemy speed (TUNING.difficulty[...].speed), set at the start of a run. */
  speedScale = 1;

  speedMul(i: number): number {
    let m = 1;
    if (this.buffed[i]) m *= BUFF_SPEED;
    if (this.affix[i] & AFFIX.fast) m *= FAST_MUL;
    return m;
  }

  /** Enemy i overlaps a circle at (px, pz): an oriented box for the bus, a circle for everyone else. */
  overlaps(i: number, px: number, pz: number, pr: number): boolean {
    const dx = px - this.x[i];
    const dz = pz - this.z[i];
    const def = this.types[this.type[i]].def;
    const box = def.box ?? (def.behavior === 'charger' ? BUS_BOX : null);
    if (!box) {
      const r = pr + this.radius[i];
      return dx * dx + dz * dz <= r * r;
    }
    const c = Math.cos(-this.yaw[i]);
    const sn = Math.sin(-this.yaw[i]);
    // Into the body's own frame: x across it, z along it.
    const lx = dx * c - dz * sn;
    const lz = dx * sn + dz * c;
    const ex = Math.max(0, Math.abs(lx) - box[0] * this.size[i]);
    const ez = Math.max(0, Math.abs(lz) - box[1] * this.size[i]);
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
    // An empty hash too: a query before the next step must not find the last run's enemies.
    this.clearHash();
  }

  /** Frees the meshes of this arena's enemy types (travelling to the next station). */
  dispose(scene: Scene): void {
    const seen = new Set<unknown>();
    for (const t of this.types) {
      for (const m of [t.body, t.outline, t.wingL, t.wingR]) {
        if (!m) continue;
        scene.remove(m);
        disposeTree(m, seen);
        m.dispose();
      }
    }
    this.types.length = 0;
  }

  // ---------- Spatial hash ----------

  private cellIndex(x: number, z: number): number {
    const cx = Math.min(this.gridN - 1, Math.max(0, Math.floor((x + this.gridOff) / HASH_CELL)));
    const cz = Math.min(this.gridN - 1, Math.max(0, Math.floor((z + this.gridOff) / HASH_CELL)));
    return cz * this.gridN + cx;
  }

  private clearHash(): void {
    for (let k = 0; k < this.cellsUsedN; k++) this.cellHead[this.cellsUsed[k]] = -1;
    this.cellsUsedN = 0;
  }

  rebuildHash(): void {
    this.clearHash();
    // From the last enemy down, each pushed on the front of its cell's list: every list ends up in index order.
    for (let i = this.count - 1; i >= 0; i--) {
      const c = this.cellIndex(this.x[i] ?? 0, this.z[i] ?? 0);
      if (this.cellHead[c] < 0) this.cellsUsed[this.cellsUsedN++] = c;
      this.cellNext[i] = this.cellHead[c];
      this.cellHead[c] = i;
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
        for (let i = this.cellHead[c]; i >= 0; i = this.cellNext[i]) {
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
    // Piotrek under cover (a deck, a canopy): fliers close to them come down under it instead of over it.
    const covered = this.world.groundAt(px, pz, 0.3, 100) > py + 2.5;
    // Buffers drive whoever is around them this step (the hash was built before this update).
    this.buffed.fill(0, 0, n);
    for (let i = 0; i < n; i++) {
      const b = this.types[this.type[i]].def.buffs;
      if (!b || this.dead[i]) continue;
      const m = this.query(this.x[i], this.z[i], b.radius);
      for (let k = 0; k < m; k++) if (this.found[k] !== i) this.buffed[this.found[k]] = 1;
    }
    for (let i = 0; i < n; i++) {
      if (this.dead[i]) continue;
      const def = this.types[this.type[i]].def;
      const x = this.x[i];
      const z = this.z[i];
      // The last train's inspectors cannot be stopped either: no stun, no slow, whatever wrote it.
      if (def.behavior === 'night') this.stun[i] = this.slow[i] = 0;
      this.stun[i] = Math.max(0, this.stun[i] - dt);
      this.stunDr[i] = Math.max(0, this.stunDr[i] - dt * STUN_RECOVERY);
      this.slow[i] = Math.max(0, this.slow[i] - dt);
      this.vulnerable[i] = Math.max(0, this.vulnerable[i] - dt);
      if (this.affix[i]) this.affixStep(i, dt, px, pz);
      if (def.behavior === 'charger') {
        this.charge(i, dt, px, pz);
        continue;
      }
      if (def.behavior === 'jumper' && this.chargeState[i] === 2) {
        this.flight(i, dt);
        continue;
      }
      if (def.behavior === 'dasher' && this.chargeState[i] === 2) {
        this.dash(i, dt, def);
        continue;
      }
      if (def.behavior === 'boss') {
        // The boss controller moves it; here only the timers and the hit flash tick.
        this.flash[i] = Math.max(0, this.flash[i] - dt);
        this.squash[i] = Math.max(0, this.squash[i] - dt * 4);
        continue;
      }
      let tx = px;
      let tz = pz;
      // Couriers ignore Piotrek and run their errand; arriving takes them off the board.
      if (def.behavior === 'courier' && this.courierOn) {
        tx = this.courierX;
        tz = this.courierZ;
        if ((tx - x) ** 2 + (tz - z) ** 2 < TUNING.finale.lemurReach ** 2) {
          this.dead[i] = 1;
          this.delivered[i] = 1;
          this.onEvent?.('delivery', x, this.y[i], z);
          continue;
        }
      }
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
      // The archetypes' own moves: how fast they come (0: standing still to aim or catch breath, -1: backing off).
      const pace = this.archetype(i, def, d, dt, px, py, pz);
      if (pace < 0) {
        dx = -dx;
        dz = -dz;
      }
      // Walking round a wall it ran into (see below): along the wall, a little towards the target.
      if (this.detourT[i] > 0) {
        this.detourT[i] -= dt;
        // Still a wall between it and the target: keep going round (long walls, rows of containers).
        const rr = this.radius[i] + 0.6;
        if (this.detourT[i] <= 0 && this.world.blocked(x + dx * rr, this.y[i], z + dz * rr, this.radius[i] * 0.5, 1.15)) this.detourT[i] = 0.8;
        const ddx = this.detourX[i] * 0.85 + dx * 0.15;
        const ddz = this.detourZ[i] * 0.85 + dz * 0.15;
        const dl = Math.hypot(ddx, ddz) || 1;
        dx = ddx / dl;
        dz = ddz / dl;
      }
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
          for (let j = this.cellHead[c]; j >= 0; j = this.cellNext[j]) {
            // Bodies on another level (a deck above, the ground below) do not shove each other.
            if (j === i || this.dead[j] || Math.abs(this.y[j] - this.y[i]) > 1.5) continue;
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
      const sp = this.stun[i] > 0 ? 0 : this.speed[i] * (this.slow[i] > 0 ? 0.5 : 1) * this.speedMul(i) * Math.abs(pace);
      const vx = dx * sp + sx * 3.2 + this.kx[i];
      const vz = dz * sp + sz * 3.2 + this.kz[i];
      this.kx[i] *= decay;
      this.kz[i] *= decay;
      pushPos.x = x + vx * dt;
      pushPos.z = z + vz * dt;
      if (def.flying) {
        // Fly at head height, but over rooftops rather than through them; near a Piotrek under cover, a deck over
        // their head is no rooftop (under Widzew's viaduct the pigeons used to circle on top of it, out of reach).
        const roof = this.world.groundAt(pushPos.x, pushPos.z, r, covered && d < 6 ? py + 2.5 : 100);
        const targetY = Math.max(py + 1.3, roof + 1.1) + Math.sin(time * 3 + this.phase[i]) * 0.25;
        this.y[i] += (targetY - this.y[i]) * Math.min(1, dt * 2.5);
        const lim = this.world.limit - r;
        const dd = Math.hypot(pushPos.x, pushPos.z);
        if (dd > lim) {
          pushPos.x *= lim / dd;
          pushPos.z *= lim / dd;
        }
      } else if (this.hopT[i] > 0) {
        // In the middle of a hop: an arc over the fence (only walls taller than the arc stop it).
        this.hopT[i] = Math.max(0, this.hopT[i] - dt);
        const arc = this.hopY[i] + Math.sin((1 - this.hopT[i] / HOP_TIME) * Math.PI) * HOP_HEIGHT;
        pushPos.y = arc;
        this.world.collide(pushPos, r, 1, 0.5);
        const g = this.world.groundAt(pushPos.x, pushPos.z, r * 0.6, arc + 0.5);
        this.y[i] = Math.max(g, this.hopT[i] > 0 ? arc : g);
        this.climbing[i] = 0;
      } else {
        const cy = this.y[i];
        pushPos.y = cy;
        const blocked = this.world.collide(pushPos, r, 1, 0.5);
        // A fence or a ledge lower than a hop is hopped over, whatever Piotrek stand on (a climb has no top to
        // stand on there, and pressed against a fence the crowd made it a safe wall).
        const low = blocked && sp > 0 && !this.world.blocked(x + dx * (r + 0.35), cy, z + dz * (r + 0.35), r * 0.5, 1.15);
        if (low) {
          this.hopT[i] = HOP_TIME;
          this.hopY[i] = cy;
        }
        // Climb up walls towards Piotrek standing on a roof or a platform.
        const climb = blocked && !low && py - cy > 0.7;
        if (blocked && !low && !climb && sp > 0) {
          // A real wall is walked round (to the side that leads on towards the target), for as long as it is
          // in the way; a corner turns the walk round the other way.
          const stuck = Math.hypot(pushPos.x - x, pushPos.z - z) < sp * dt * 0.4;
          if (stuck && this.detourT[i] > 0 && this.detourT[i] < 0.6) {
            // Going round ran into another wall (a corner): the other way round.
            this.detourX[i] = -this.detourX[i];
            this.detourZ[i] = -this.detourZ[i];
            this.detourT[i] = 1.2;
          } else if (stuck && this.detourT[i] <= 0) {
            const nl = Math.hypot(this.world.hitX, this.world.hitZ) || 1;
            const nx = this.world.hitX / nl;
            const nz = this.world.hitZ / nl;
            const side = (tx - x) * -nz + (tz - z) * nx > 0 || ((tx - x) * -nz + (tz - z) * nx === 0 && this.uid[i] % 2 === 0) ? 1 : -1;
            this.detourX[i] = -nz * side;
            this.detourZ[i] = nx * side;
            this.detourT[i] = 1;
          }
        }
        this.climbing[i] = climb ? 1 : 0;
        const g = this.world.groundAt(pushPos.x, pushPos.z, r * 0.6, cy + 0.5);
        if (climb) this.y[i] = cy + 3.2 * dt;
        else this.y[i] = g > cy ? g : Math.max(g, cy - 12 * dt);
      }
      this.x[i] = pushPos.x;
      this.z[i] = pushPos.z;
      // Throwers, dashers and crouching cats face Piotrek while they stand: the warning reads from the front.
      this.yaw[i] = pace === 0 || pace < 0 ? Math.atan2(px - x, pz - z) : Math.atan2(vx, vz);
      this.flash[i] = Math.max(0, this.flash[i] - dt);
      this.squash[i] = Math.max(0, this.squash[i] - dt * 4);
    }
    for (let k = 0; k < this.dyingCount; k++) this.dage[k] += dt;
  }

  /**
   * The archetypes' state machines (chargeState / chargeT reused). Returns the share of its speed the enemy
   * walks with this step: 1 chase, 0 stand, -1 back off (pace 0.3 is a sprinter catching its breath).
   */
  private archetype(i: number, def: EnemyDef, d: number, dt: number, px: number, py: number, pz: number): number {
    const b = def.behavior;
    // A stun breaks a wind-up: the flare, the dash or the leap it was about to make does not come.
    if (this.stun[i] > 0 && this.chargeState[i] === 1 && (b === 'shooter' || b === 'dasher' || b === 'jumper')) {
      this.chargeState[i] = 0;
      this.chargeT[i] = b === 'shooter' && def.shot ? def.shot.cooldown * 0.5 : 0;
    }
    if (b === 'night') {
      // The last train's inspectors only get faster, in the end faster than any bunny hop: they end the fight.
      this.speed[i] = Math.min(NIGHT_TOP, this.speed[i] + NIGHT_ACCEL * dt);
      return 1;
    }
    if (b === 'sprinter') {
      this.chargeT[i] -= dt;
      if (this.chargeT[i] <= 0) {
        this.chargeState[i] = this.chargeState[i] ? 0 : 1;
        this.chargeT[i] = this.chargeState[i] ? 1.3 : 2.4;
      }
      return this.chargeState[i] ? 0.3 : 1;
    }
    if (b === 'buffer') return d < 5 ? -1 : d < 7 ? 0 : 1;
    if (b === 'shooter' && def.shot) {
      const s = def.shot;
      this.chargeT[i] -= dt;
      if (this.chargeState[i] === 1) {
        // Arm up, flare lit: it throws when the warning runs out, wherever Piotrek are by then.
        if (this.chargeT[i] <= 0) {
          this.chargeState[i] = 0;
          this.chargeT[i] = s.cooldown;
          this.onAct?.('shoot', i, px, pz, 0);
        }
        return 0;
      }
      if (d <= s.range && this.chargeT[i] <= 0 && this.stun[i] <= 0) {
        this.chargeState[i] = 1;
        this.chargeT[i] = s.windup;
        this.onAct?.('windup', i, px, pz, s.windup);
        return 0;
      }
      return d < s.keep * 0.7 ? -1 : d < s.keep ? 0 : 1;
    }
    if (b === 'dasher' && def.dash) {
      const s = def.dash;
      if (this.chargeState[i] === 1) {
        this.chargeT[i] -= dt;
        // Aims until a third of a second before it goes, then the lane is locked: step out of it.
        if (this.chargeT[i] > 0.3) {
          const l = d || 1;
          this.chargeX[i] = (px - this.x[i]) / l;
          this.chargeZ[i] = (pz - this.z[i]) / l;
        }
        if (this.chargeT[i] <= 0) {
          this.chargeState[i] = 2;
          this.chargeT[i] = s.time;
        }
        return 0;
      }
      if (this.chargeState[i] === 3) {
        this.chargeT[i] -= dt;
        if (this.chargeT[i] <= 0) this.chargeState[i] = 0;
        return 0.4;
      }
      if (d < s.trigger && this.stun[i] <= 0) {
        this.chargeState[i] = 1;
        this.chargeT[i] = s.windup;
        this.onAct?.('aim', i, px, pz, s.windup);
        return 0;
      }
      return 1;
    }
    if (b === 'jumper' && def.jump) {
      const s = def.jump;
      if (this.chargeState[i] === 1) {
        this.chargeT[i] -= dt;
        if (this.chargeT[i] <= 0) {
          // Off it goes, to where Piotrek stand now (a roof too): the landing spot is marked the whole flight.
          this.chargeState[i] = 2;
          this.chargeT[i] = s.air;
          this.jumpX[i] = this.x[i];
          this.jumpY[i] = this.y[i];
          this.jumpZ[i] = this.z[i];
          this.chargeX[i] = px;
          this.chargeZ[i] = pz;
          this.jumpTY[i] = py;
          this.onAct?.('leap', i, px, pz, s.air);
        }
        this.squash[i] = 0.6;
        return 0;
      }
      if (this.chargeState[i] === 3) {
        this.chargeT[i] -= dt;
        if (this.chargeT[i] <= 0) this.chargeState[i] = 0;
        return 0.5;
      }
      if (d < s.trigger && this.stun[i] <= 0) {
        this.chargeState[i] = 1;
        this.chargeT[i] = s.crouch;
        return 0;
      }
      return 1;
    }
    return 1;
  }

  /** A jumper in the air: a high arc from where it took off to the marked spot, then a rest. */
  private flight(i: number, dt: number): void {
    const jump = this.types[this.type[i]].def.jump;
    const air = jump?.air ?? 0.8;
    this.chargeT[i] -= dt;
    const k = Math.min(1, 1 - this.chargeT[i] / air);
    this.x[i] = this.jumpX[i] + (this.chargeX[i] - this.jumpX[i]) * k;
    this.z[i] = this.jumpZ[i] + (this.chargeZ[i] - this.jumpZ[i]) * k;
    this.y[i] = this.jumpY[i] + (this.jumpTY[i] - this.jumpY[i]) * k + Math.sin(k * Math.PI) * 3.2;
    this.yaw[i] = Math.atan2(this.chargeX[i] - this.jumpX[i], this.chargeZ[i] - this.jumpZ[i]);
    this.flash[i] = Math.max(0, this.flash[i] - dt);
    this.squash[i] = Math.max(0, this.squash[i] - dt * 4);
    if (this.chargeT[i] <= 0) {
      this.chargeState[i] = 3;
      this.chargeT[i] = jump?.rest ?? 1;
      this.y[i] = this.world.groundAt(this.x[i], this.z[i], this.radius[i], this.jumpTY[i] + 0.5);
      this.squash[i] = 1;
    }
  }

  /** A dasher down its locked lane: straight and fast, stopped by walls, then a rest. */
  private dash(i: number, dt: number, def: EnemyDef): void {
    const s = def.dash;
    this.chargeT[i] -= dt;
    const sp = this.stun[i] > 0 ? 0 : (s?.speed ?? 14) * this.speedMul(i);
    pushPos.x = this.x[i] + this.chargeX[i] * sp * dt;
    pushPos.z = this.z[i] + this.chargeZ[i] * sp * dt;
    pushPos.y = this.y[i];
    const crashed = this.world.collide(pushPos, this.radius[i], 1, 0.5);
    this.x[i] = pushPos.x;
    this.z[i] = pushPos.z;
    this.y[i] = Math.max(this.world.groundAt(pushPos.x, pushPos.z, this.radius[i] * 0.6, this.y[i] + 0.5), this.y[i] - 12 * dt);
    this.yaw[i] = Math.atan2(this.chargeX[i], this.chargeZ[i]);
    if (crashed || this.chargeT[i] <= 0) {
      this.chargeState[i] = 3;
      this.chargeT[i] = s?.rest ?? 1.2;
      if (crashed) this.squash[i] = 1;
    }
    this.flash[i] = Math.max(0, this.flash[i] - dt);
  }

  /** Affix moves: a Wampir regenerates, a Teleportujący jumps next to Piotrek, a Przywoływacz calls help. */
  private affixStep(i: number, dt: number, px: number, pz: number): void {
    const a = this.affix[i];
    if (a & AFFIX.vampire) this.hp[i] = Math.min(this.maxHp[i], this.hp[i] + this.maxHp[i] * VAMPIRE_REGEN * dt);
    // Each timed affix keeps its own clock: a Teleportujący Przywoływacz jumps and calls.
    if (a & AFFIX.summoner) {
      this.summonT[i] -= dt;
      if (this.summonT[i] <= 0 && this.stun[i] <= 0) {
        this.summonT[i] = SUMMON_EVERY;
        this.onAct?.('summon', i, this.x[i], this.z[i], 0);
      }
    }
    if (!(a & AFFIX.blink)) return;
    if (this.blinkT[i] > 0) {
      this.blinkT[i] -= dt;
      if (this.blinkT[i] <= 0) this.move(i, this.blinkX[i], this.blinkZ[i]);
      return;
    }
    this.affixT[i] -= dt;
    if (this.affixT[i] > 0 || this.stun[i] > 0) return;
    this.affixT[i] = BLINK_EVERY;
    const r = this.rng;
    const ang = r ? r.next() * Math.PI * 2 : 0;
    let bx = px + Math.sin(ang) * 3.5;
    let bz = pz + Math.cos(ang) * 3.5;
    const lim = this.world.limit - 3;
    const dd = Math.hypot(bx, bz);
    if (dd > lim) {
      bx *= lim / dd;
      bz *= lim / dd;
    }
    this.blinkX[i] = bx;
    this.blinkZ[i] = bz;
    this.blinkT[i] = BLINK_WARN;
    this.onAct?.('blink', i, bx, bz, BLINK_WARN);
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
    return this.chargeState[i] === 0 && this.types[this.type[i]].def.behavior === 'charger';
  }

  /**
   * Stuns enemy i for `seconds`. A boss shrugs stuns off: never more than BOSS_STUN_MAX at once, nothing new
   * while it is stunned and for BOSS_STUN_GAP after, and then only a quarter stun until it has had 12 s without
   * any (STUN_RECOVERY). No stun-lock and no long freeze, whatever the build. Returns the stun it really got.
   */
  stunFor(i: number, seconds: number): number {
    if (this.isBoss(i)) {
      const k = this.stunDr[i];
      if (k >= 3) return 0;
      seconds = Math.min(seconds, BOSS_STUN_MAX) * 0.5 ** Math.floor(k);
      // Immune through the stun and BOSS_STUN_GAP after it; it comes back as a quarter stun, a full one only
      // after 12 s without any.
      this.stunDr[i] = 3 + (seconds + BOSS_STUN_GAP) * STUN_RECOVERY;
    }
    this.stun[i] = Math.max(this.stun[i], seconds);
    return seconds;
  }

  /** A boss (never teleported back by the leash, its own camera rules). */
  isBoss(i: number): boolean {
    return this.types[this.type[i]].def.behavior === 'boss';
  }

  isFlying(i: number): boolean {
    return this.types[this.type[i]].def.flying;
  }

  /** True when a dasher is aiming (the game paints its lane) and its locked direction. */
  aiming(i: number): boolean {
    return this.chargeState[i] === 1 && this.types[this.type[i]].def.behavior === 'dasher';
  }

  /** How tall enemy i stands (a jump over something lower than this clears it). */
  heightOf(i: number): number {
    return Math.max(0.35, this.types[this.type[i]].box.max.y * this.size[i] * 0.85);
  }

  /** A jumper in the air: no body to bump into until it lands (its landing spot is the danger). */
  airborne(i: number): boolean {
    return this.chargeState[i] === 2 && this.types[this.type[i]].def.behavior === 'jumper';
  }

  /** The bus going down its lane at full speed (it runs Piotrek over: one hit kills). */
  charging(i: number): boolean {
    return this.chargeState[i] === 1 && this.types[this.type[i]].def.behavior === 'charger';
  }

  /** A scooter down its lane (touching it then is being run over by its charge). */
  dashing(i: number): boolean {
    return this.chargeState[i] === 2 && this.types[this.type[i]].def.behavior === 'dasher';
  }

  /** The last train's inspectors: hits do not hurt them. */
  immortal(i: number): boolean {
    return this.types[this.type[i]].def.behavior === 'night';
  }

  /** Arrives harmless and still for `delay` seconds (a summoned helper, a minion, a parcel tumbling out). */
  arrive(i: number, delay: number): void {
    if (this.types[this.type[i]].def.behavior !== 'night') this.stun[i] = Math.max(this.stun[i], delay);
  }

  /** A thrower with its flare up (the warning before the throw). */
  throwing(i: number): boolean {
    return this.chargeState[i] === 1 && this.types[this.type[i]].def.behavior === 'shooter';
  }

  /** Applies damage and knockback. Returns true if this hit killed the enemy. */
  hit(i: number, amount: number, dirX: number, dirZ: number, knockback: number): boolean {
    if (this.dead[i]) return false;
    const def = this.types[this.type[i] ?? 0].def;
    this.blocked = false;
    // Nocne Kanary: hits land (a flash, a nudge) but nothing stops them.
    if (def.behavior === 'night') {
      this.flash[i] = TUNING.feel.flashTime;
      return false;
    }
    if (this.affix[i] & AFFIX.armored) {
      amount *= ARMORED_TAKEN;
      knockback = 0;
    }
    if (this.buffed[i]) amount *= 1 - BUFF_ARMOR;
    // A shield takes what comes at it from the front; from the side, from behind or from above it is no use.
    if (def.shield && (dirX !== 0 || dirZ !== 0) && dirX * Math.sin(this.yaw[i]) + dirZ * Math.cos(this.yaw[i]) < -0.35) {
      amount *= 1 - def.shield;
      knockback *= 0.3;
      this.blocked = true;
    }
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

  /**
   * A free slot for something that has to appear (a boss) when the pool is full: the ordinary enemy furthest from
   * (x, z) leaves without dying (no drops, no kill).
   */
  makeRoom(x: number, z: number): void {
    if (this.count < this.max) return;
    let far = -1;
    let best = -1;
    for (let i = 0; i < this.count; i++) {
      const b = this.types[this.type[i]].def.behavior;
      if (b === 'boss' || b === 'night') continue;
      const d2 = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d2 > best) {
        best = d2;
        far = i;
      }
    }
    if (far >= 0) this.copy(--this.count, far);
  }

  /** Removes dead enemies (swap with the last), starting their death animation. */
  sweep(onDeath: (x: number, y: number, z: number, type: number, elite: boolean, carried: number, affix: number) => void): void {
    let i = 0;
    while (i < this.count) {
      if (!this.dead[i]) {
        i++;
        continue;
      }
      if (this.delivered[i]) {
        this.copy(--this.count, i);
        continue;
      }
      const x = this.x[i] ?? 0;
      const y = this.y[i] ?? 0;
      const z = this.z[i] ?? 0;
      const t = this.type[i] ?? 0;
      onDeath(x, y, z, t, this.elite[i] === 1, this.carry[i], this.affix[i]);
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
    this.delivered[to] = this.delivered[from];
    this.chargeState[to] = this.chargeState[from];
    this.affix[to] = this.affix[from];
    this.buffed[to] = this.buffed[from];
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
    const def = this.types[this.type[i] ?? 0].def;
    const y = def.flying ? (this.y[i] ?? 2) : this.world.groundAt(x, z, this.radius[i] ?? 0.4, 50);
    this.x[i] = this.px[i] = x;
    this.z[i] = this.pz[i] = z;
    this.y[i] = this.py[i] = y;
  }

  palette(type: number): Color[] {
    return this.types[type].palette;
  }

  // ---------- Rendering ----------

  /** Where the camera is this frame (set before `render`). */
  readonly eye = new Vector3();

  render(alpha: number, time: number, shadows: BlobShadows): void {
    for (const t of this.types) {
      t.n = 0;
      t.outline.visible = true;
    }
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
      // A boss is a machine, not a waddling pigeon: no idle sway, only a slow breathing bob.
      if (t.def.behavior === 'boss') {
        roll = 0;
        pitch = 0;
        yawWiggle = 0;
        bob = Math.abs(Math.sin(ph * 0.5)) * 0.05;
      }
      const k = this.size[i];
      const s = (1 + sq * 0.25) * k;
      if (this.climbing[i]) pitch -= 0.9;
      // A cat in the air stretches out, nose down towards where it lands.
      if (this.airborne(i)) pitch += 0.5;
      if (this.stun[i] > 0) roll += Math.sin(time * 30) * 0.12;
      this.compose(x, y + bob, z, this.yaw[i] + yawWiggle, pitch, roll, s, (1 - sq * 0.25) * k, s);
      // The camera inside a boss (a long bus right behind Piotrek): its body dithers out near the camera, but
      // the outline hull's back faces would still paint the screen black from within. Drop the outline then.
      if (t.def.behavior === 'boss') {
        const yaw = this.yaw[i];
        const dx = this.eye.x - x;
        const dz = this.eye.z - z;
        const lx = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / k;
        const lz = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / k;
        const ly = (this.eye.y - y) / k;
        const b = t.box;
        if (lx > b.min.x - 0.4 && lx < b.max.x + 0.4 && lz > b.min.z - 0.4 && lz < b.max.z + 0.4 && ly > b.min.y - 0.4 && ly < b.max.y + 0.4) t.outline.visible = false;
      }
      const idx = t.n++;
      t.body.setMatrixAt(idx, m4);
      // Status reads from the body colour: white flash on hit, gold elite, purple vulnerable,
      // pale blue stunned, cyan slowed.
      // A warning reads from the body too: a raised flare glows orange, an aiming scooter pulses red.
      const warn = 0.5 + 0.5 * Math.sin(time * 18);
      if (this.flash[i] > 0) tmpColor.setRGB(3.2, 3.2, 3.2);
      else if (this.throwing(i)) tmpColor.setRGB(1.4 + warn * 0.9, 1 + warn * 0.3, 0.45);
      else if (this.aiming(i)) tmpColor.setRGB(1.5 + warn * 0.9, 0.5, 0.45);
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
