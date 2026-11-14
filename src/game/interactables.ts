import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StationDef } from '../content/stations/index';
import type { Rng } from '../core/rng';
import { disposeTree } from '../render/dispose';
import { tinted } from '../render/tint';
import { toonRamp } from '../render/toon';

const m4 = new Matrix4();
const DOTS = 24;
const CHEST_POOL = 10;

interface Bin {
  x: number;
  y: number;
  z: number;
  alive: boolean;
}

interface Chest {
  x: number;
  y: number;
  z: number;
  price: number;
  /** -1 closed; 0..1 opening animation progress. */
  open: number;
  active: boolean;
  group: Group;
  lid: Mesh;
  beam: Mesh;
}

interface Coffee {
  x: number;
  y: number;
  z: number;
  charge: number;
  used: boolean;
  screen: Mesh;
  body: Mesh;
}

export interface InteractEvents {
  binBroken(x: number, y: number, z: number): void;
  brewed(index: number): void;
}

/** Breakable bins, paid chests and coffee machines placed on the arena. */
export class Interactables {
  readonly bins: Bin[];
  readonly chests: Chest[] = [];
  readonly coffees: Coffee[] = [];
  private readonly binMesh: InstancedMesh;
  private readonly dots: InstancedMesh;
  private readonly dotX: Float32Array;
  private readonly dotZ: Float32Array;
  private readonly lit = new Color('#ffd23a');
  private readonly unlit = new Color('#3a3f55');
  private respawn = 0;
  brewTime = 3;

  constructor(
    private readonly scene: Scene,
    private readonly def: StationDef,
  ) {
    const ramp = toonRamp();
    // One material per mesh kind: sharing a material between an InstancedMesh and plain Meshes makes
    // Three.js rebuild the program on every draw.
    const mat = new MeshToonMaterial({ gradientMap: ramp, vertexColors: true });
    const instMat = new MeshToonMaterial({ gradientMap: ramp, vertexColors: true });
    this.bins = def.bins.map(([x, y, z]) => ({ x, y, z, alive: true }));
    const binGeo = mergeGeometries([
      tinted(new CylinderGeometry(0.34, 0.3, 0.9, 10), '#2f6b3a', 0, 0.45, 0),
      tinted(new CylinderGeometry(0.37, 0.37, 0.08, 10), '#244f2c', 0, 0.92, 0),
      tinted(new CylinderGeometry(0.345, 0.345, 0.1, 10), '#ffd23a', 0, 0.62, 0),
      tinted(new BoxGeometry(0.08, 0.1, 0.4), '#1f3d24', 0, 0.98, 0),
    ]);
    this.binMesh = new InstancedMesh(binGeo, instMat, this.bins.length);
    this.binMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.binMesh.frustumCulled = false;
    scene.add(this.binMesh);

    // Chests: PKP-blue metal box with yellow bands; the lid hinges at the back.
    const bodyGeo = mergeGeometries([
      tinted(new BoxGeometry(1.1, 0.62, 0.74), '#1d4f9c', 0, 0.31, 0),
      tinted(new BoxGeometry(1.14, 0.1, 0.78), '#ffd23a', 0, 0.1, 0),
      tinted(new BoxGeometry(0.12, 0.64, 0.78), '#ffd23a', -0.35, 0.31, 0),
      tinted(new BoxGeometry(0.12, 0.64, 0.78), '#ffd23a', 0.35, 0.31, 0),
    ]);
    const lidGeo = mergeGeometries([
      tinted(new BoxGeometry(1.12, 0.22, 0.76), '#2563b8', 0, 0.11, 0.38),
      tinted(new BoxGeometry(0.14, 0.24, 0.8), '#ffd23a', -0.35, 0.11, 0.38),
      tinted(new BoxGeometry(0.14, 0.24, 0.8), '#ffd23a', 0.35, 0.11, 0.38),
      tinted(new BoxGeometry(0.18, 0.16, 0.06), '#ffe066', 0, 0.02, 0.78),
    ]);
    const beamGeo = new CylinderGeometry(0.42, 0.55, 6, 16, 1, true);
    beamGeo.translate(0, 3, 0);
    for (let k = 0; k < CHEST_POOL; k++) {
      const group = new Group();
      const body = new Mesh(bodyGeo, mat);
      const lid = new Mesh(lidGeo, mat);
      lid.position.set(0, 0.62, -0.38);
      const beam = new Mesh(beamGeo, new MeshBasicMaterial({ color: '#ffe68a', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      group.add(body, lid, beam);
      group.visible = false;
      scene.add(group);
      this.chests.push({ x: 0, y: 0, z: 0, price: 0, open: -1, active: false, group, lid, beam });
    }

    // Coffee machines with a glowing screen; the ring of dots around one shows brewing progress.
    const machineGeo = mergeGeometries([
      tinted(new BoxGeometry(1.0, 1.95, 0.8), '#7a1f2a', 0, 0.975, 0),
      tinted(new BoxGeometry(0.86, 0.5, 0.06), '#2a1416', 0, 0.55, 0.42),
      tinted(new BoxGeometry(0.3, 0.3, 0.1), '#1a0d0e', 0, 0.42, 0.44),
      tinted(new BoxGeometry(0.12, 0.6, 0.05), '#c9cdd2', 0.32, 1.25, 0.42),
      tinted(new BoxGeometry(1.06, 0.12, 0.86), '#5a141c', 0, 1.98, 0),
    ]);
    for (const [x, y, z] of def.coffee) {
      const m = new Mesh(machineGeo, mat);
      m.position.set(x, y, z);
      const screen = new Mesh(new PlaneGeometry(0.62, 0.4), new MeshBasicMaterial({ map: coffeeSign(), color: '#ffffff' }));
      screen.position.set(x, y + 1.45, z + 0.41);
      scene.add(m, screen);
      this.coffees.push({ x, y, z, charge: 0, used: false, screen, body: m });
    }
    const dotGeo = new CylinderGeometry(0.11, 0.11, 0.04, 6);
    this.dots = new InstancedMesh(dotGeo, new MeshBasicMaterial({ fog: true }), DOTS * def.coffee.length);
    this.dots.instanceColor = new InstancedBufferAttribute(new Float32Array(DOTS * def.coffee.length * 3), 3).setUsage(DynamicDrawUsage);
    this.dots.frustumCulled = false;
    scene.add(this.dots);
    this.dotX = new Float32Array(DOTS * def.coffee.length);
    this.dotZ = new Float32Array(DOTS * def.coffee.length);
    this.coffees.forEach((c, ci) => {
      for (let k = 0; k < DOTS; k++) {
        const a = (k / DOTS) * Math.PI * 2;
        this.dotX[ci * DOTS + k] = c.x + Math.sin(a) * 2.2;
        this.dotZ[ci * DOTS + k] = c.z + Math.cos(a) * 2.2;
      }
    });
  }

  reset(rng: Rng, price: number): void {
    for (const b of this.bins) b.alive = true;
    for (const c of this.coffees) {
      c.charge = 0;
      c.used = false;
      (c.screen.material as MeshBasicMaterial).color.set('#ffffff');
    }
    for (const c of this.chests) {
      c.active = false;
      c.group.visible = false;
    }
    for (let k = 0; k < 3; k++) this.spawnAtFreeSpot(rng, price, true);
    this.respawn = 0;
  }

  /** Frees everything this arena put in the scene (travelling to the next station). */
  dispose(scene: Scene): void {
    scene.remove(this.binMesh, this.dots);
    const seen = new Set<unknown>();
    disposeTree(this.binMesh, seen);
    disposeTree(this.dots, seen);
    for (const c of this.chests) {
      scene.remove(c.group);
      disposeTree(c.group, seen);
    }
    for (const c of this.coffees) {
      scene.remove(c.body, c.screen);
      disposeTree(c.body, seen);
      disposeTree(c.screen, seen);
    }
  }

  /** Puts a chest on a random unused spot. `clearOfStart` keeps the first chests off Piotrek's feet. */
  spawnAtFreeSpot(rng: Rng, price: number, clearOfStart = false): void {
    const spots = this.def.chests.filter(([x, , z]) => !this.chests.some((c) => c.active && Math.hypot(c.x - x, c.z - z) < 1) && (!clearOfStart || Math.hypot(x, z) > 6));
    if (!spots.length) return;
    const [x, y, z] = spots[Math.floor(rng.next() * spots.length)] ?? [0, 0, 0];
    this.spawnChest(x, y, z, price);
  }

  /** Puts a chest at (x, y, z). Falls back to the oldest paid chest when the pool is full. */
  spawnChest(x: number, y: number, z: number, price: number): void {
    let c = this.chests.find((k) => !k.active);
    // Every slot taken: recycle the paid chest furthest from this spot, so a free reward is never lost.
    if (!c) {
      let worst = -1;
      for (const k of this.chests) {
        if (k.open >= 0 || k.price <= 0) continue;
        const d = (k.x - x) ** 2 + (k.z - z) ** 2;
        if (d > worst) {
          worst = d;
          c = k;
        }
      }
    }
    if (!c) return;
    c.x = x;
    c.y = y;
    c.z = z;
    c.price = price;
    c.open = -1;
    c.active = true;
    c.group.position.set(x, y, z);
    c.group.rotation.y = Math.atan2(-x, -z);
    c.lid.rotation.x = 0;
    (c.beam.material as MeshBasicMaterial).opacity = 0;
    c.group.visible = true;
  }

  /** Closest closed chest within reach, or -1. */
  chestNear(x: number, y: number, z: number, reach: number): number {
    let best = -1;
    let bestD = reach * reach;
    for (let i = 0; i < this.chests.length; i++) {
      const c = this.chests[i];
      if (!c.active || c.open >= 0 || Math.abs(c.y - y) > 1.6) continue;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  startOpening(i: number): void {
    const c = this.chests[i];
    c.open = 0;
  }

  /** Coffee machine Piotrek stands at (unused), or -1. */
  coffeeNear(x: number, y: number, z: number): number {
    for (let i = 0; i < this.coffees.length; i++) {
      const c = this.coffees[i];
      if (!c.used && (c.x - x) ** 2 + (c.z - z) ** 2 < 2.2 * 2.2 && Math.abs(c.y - y) < 1.5) return i;
    }
    return -1;
  }

  /** Simulation: brewing, bins kicked by Piotrek, chest respawns. */
  update(dt: number, px: number, py: number, pz: number, sliding: boolean, rng: Rng, nextPrice: number, ev: InteractEvents): void {
    const at = this.coffeeNear(px, py, pz);
    for (let i = 0; i < this.coffees.length; i++) {
      const c = this.coffees[i];
      if (c.used) continue;
      c.charge = i === at ? c.charge + dt : Math.max(0, c.charge - dt * 0.5);
      if (c.charge >= this.brewTime) {
        c.used = true;
        c.charge = this.brewTime;
        (c.screen.material as MeshBasicMaterial).color.set('#555555');
        ev.brewed(i);
      }
    }
    const reach = sliding ? 1.3 : 1.0;
    for (const b of this.bins) {
      if (!b.alive || Math.abs(b.y - py) > 1.2) continue;
      if ((b.x - px) ** 2 + (b.z - pz) ** 2 < reach * reach) {
        b.alive = false;
        ev.binBroken(b.x, b.y, b.z);
      }
    }
    // Keep three paid chests on the map, all at the current price.
    let paid = 0;
    for (const c of this.chests) {
      if (!c.active || c.price <= 0 || c.open >= 0) continue;
      c.price = nextPrice;
      paid++;
    }
    if (paid < 3) {
      this.respawn += dt;
      if (this.respawn > 20) {
        this.respawn = 0;
        this.spawnAtFreeSpot(rng, nextPrice);
      }
    }
  }

  /** Explosions break bins too. */
  blast(x: number, z: number, r: number, ev: InteractEvents): void {
    for (const b of this.bins) {
      if (b.alive && (b.x - x) ** 2 + (b.z - z) ** 2 < r * r) {
        b.alive = false;
        ev.binBroken(b.x, b.y, b.z);
      }
    }
  }

  /** Visual time only (also runs while the game waits on a chest). Returns true when opening chests finished. */
  render(dt: number, time: number, coffeeProgress: (i: number) => number): boolean {
    let n = 0;
    for (const b of this.bins) {
      if (!b.alive) continue;
      m4.makeRotationY(b.x).setPosition(b.x, b.y, b.z);
      this.binMesh.setMatrixAt(n++, m4);
    }
    this.binMesh.count = n;
    this.binMesh.instanceMatrix.needsUpdate = true;
    let done = false;
    for (const c of this.chests) {
      if (!c.active) continue;
      if (c.open < 0) {
        // Closed: a gentle bob of the lid and a soft pillar of light, so chests are visible across the arena.
        c.lid.rotation.x = -Math.abs(Math.sin(time * 2.4)) * 0.06;
        (c.beam.material as MeshBasicMaterial).opacity = 0.12 + 0.05 * Math.sin(time * 2);
        c.beam.scale.set(1, 1, 1);
        c.group.scale.setScalar(1);
        continue;
      }
      c.open = Math.min(1.6, c.open + dt * 1.25);
      const e = 1 - (1 - Math.min(1, c.open)) * (1 - Math.min(1, c.open));
      c.lid.rotation.x = -1.9 * e;
      (c.beam.material as MeshBasicMaterial).opacity = Math.sin(Math.min(1, c.open) * Math.PI) * 0.6;
      c.beam.scale.set(1, 0.2 + e, 1);
      if (c.open >= 1 && !done && c.open - dt * 1.25 < 1) done = true;
      // Shrink away over the next few tenths instead of vanishing mid-frame.
      if (c.open > 1) {
        const t = (c.open - 1) / 0.6;
        c.group.scale.setScalar(Math.max(0.001, 1 - t));
        (c.beam.material as MeshBasicMaterial).opacity = 0;
        if (c.open >= 1.6) {
          c.active = false;
          c.group.visible = false;
        }
      }
    }
    let dotN = 0;
    for (let ci = 0; ci < this.coffees.length; ci++) {
      const c = this.coffees[ci];
      // A used machine keeps no ring at all, so it never looks like it still has coffee.
      if (c.used) continue;
      const litN = Math.round(coffeeProgress(ci) * DOTS);
      for (let k = 0; k < DOTS; k++) {
        m4.makeTranslation(this.dotX[ci * DOTS + k], c.y + 0.03, this.dotZ[ci * DOTS + k]);
        this.dots.setMatrixAt(dotN, m4);
        this.dots.setColorAt(dotN, k < litN ? this.lit : this.unlit);
        dotN++;
      }
    }
    this.dots.count = dotN;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    return done;
  }
}

function coffeeSign(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#ffd27a';
    g.fillRect(0, 0, 128, 80);
    g.fillStyle = '#3a1416';
    g.font = '800 44px "Barlow Condensed", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('KAWA', 64, 42);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
