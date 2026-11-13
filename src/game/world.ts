import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Prop, StationDef } from '../content/stations';
import { Rng, hashSeed } from '../core/rng';
import { toonRamp } from '../render/toon';

interface Ramp {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  half: number;
  h0: number;
  h1: number;
}

const CELL = 4;

/** Static arena: merged render geometry plus collision (solid AABBs, walkable ramps, a round fence). */
export class World {
  readonly group = new Group();
  readonly radius: number;
  /** Solid boxes as minX, minY, minZ, maxX, maxY, maxZ. */
  private readonly boxes: number[] = [];
  private readonly ramps: Ramp[] = [];
  /** Boxes only the camera collides with (tree crowns), so it never ends up inside foliage. */
  private readonly cameraBoxes: number[] = [];
  private grid: Int32Array[] = [];
  private gridSize = 0;
  private readonly parts: BufferGeometry[] = [];
  private readonly glow: BufferGeometry[] = [];
  private readonly glass: BufferGeometry[] = [];
  private readonly rng: Rng;
  /** Gradient sky sphere; follow the camera with it. */
  readonly sky: Mesh;

  constructor(
    readonly def: StationDef,
    scene: Scene,
  ) {
    this.radius = def.radius;
    this.rng = new Rng(hashSeed(def.id));
    scene.background = new Color(def.sky[2]);
    this.sky = skyDome(def.sky);
    scene.add(this.sky);
    scene.fog = new Fog(def.fog.color, def.fog.near, def.fog.far);
    const hemi = new HemisphereLight(def.hemi.sky, def.hemi.ground, def.hemi.intensity);
    const sun = new DirectionalLight(def.sun.color, def.sun.intensity);
    sun.position.set(...def.sun.dir).multiplyScalar(50);
    this.group.add(hemi, sun);

    this.group.add(this.ground());
    for (const p of def.props) this.prop(p);
    this.fenceRing();

    const ramp = toonRamp();
    const solid = new Mesh(mergeGeometries(this.parts), new MeshToonMaterial({ vertexColors: true, gradientMap: ramp }));
    this.group.add(solid);
    if (this.glow.length) this.group.add(new Mesh(mergeGeometries(this.glow), new MeshBasicMaterial({ vertexColors: true })));
    if (this.glass.length) {
      this.group.add(new Mesh(mergeGeometries(this.glass), new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.78, emissive: new Color('#3a2a1c') })));
    }
    this.buildGrid();
    scene.add(this.group);
  }

  // ---------- Collision ----------

  private solid(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
    this.boxes.push(minX, minY, minZ, maxX, maxY, maxZ);
  }

  private buildGrid(): void {
    const n = Math.ceil((this.radius * 2 + 20) / CELL);
    this.gridSize = n;
    const lists: number[][] = Array.from({ length: n * n }, () => []);
    const off = this.radius + 10;
    for (let b = 0; b < this.boxes.length / 6; b++) {
      const x0 = Math.max(0, Math.floor(((this.boxes[b * 6] ?? 0) + off) / CELL));
      const z0 = Math.max(0, Math.floor(((this.boxes[b * 6 + 2] ?? 0) + off) / CELL));
      const x1 = Math.min(n - 1, Math.floor(((this.boxes[b * 6 + 3] ?? 0) + off) / CELL));
      const z1 = Math.min(n - 1, Math.floor(((this.boxes[b * 6 + 5] ?? 0) + off) / CELL));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) lists[z * n + x]?.push(b);
    }
    this.grid = lists.map((l) => Int32Array.from(l));
  }

  private cellOf(x: number, z: number): Int32Array | undefined {
    const off = this.radius + 10;
    const cx = Math.floor((x + off) / CELL);
    const cz = Math.floor((z + off) / CELL);
    if (cx < 0 || cz < 0 || cx >= this.gridSize || cz >= this.gridSize) return undefined;
    return this.grid[cz * this.gridSize + cx];
  }

  /** Highest walkable surface under a circle that is not above maxY (feet + step height). */
  groundAt(x: number, z: number, r: number, maxY: number): number {
    let best = 0;
    const b = this.boxes;
    // Check the cells the circle can touch (r < CELL, so the 2x2 neighbourhood is enough).
    for (let dz = -1; dz <= 1; dz += 2) {
      for (let dx = -1; dx <= 1; dx += 2) {
        const cell = this.cellOf(x + dx * r, z + dz * r);
        if (!cell) continue;
        for (const i of cell) {
          const o = i * 6;
          const top = b[o + 4] ?? 0;
          if (top <= best || top > maxY) continue;
          if (x + r > (b[o] ?? 0) && x - r < (b[o + 3] ?? 0) && z + r > (b[o + 2] ?? 0) && z - r < (b[o + 5] ?? 0)) best = top;
        }
      }
    }
    for (const rp of this.ramps) {
      const ax = rp.x1 - rp.x0;
      const az = rp.z1 - rp.z0;
      const len2 = ax * ax + az * az;
      const t = ((x - rp.x0) * ax + (z - rp.z0) * az) / len2;
      if (t < 0 || t > 1) continue;
      const len = Math.sqrt(len2);
      const lateral = Math.abs(((x - rp.x0) * az - (z - rp.z0) * ax) / len);
      if (lateral > rp.half + r * 0.5) continue;
      const h = rp.h0 + (rp.h1 - rp.h0) * t;
      if (h > best && h <= maxY) best = h;
    }
    return best;
  }

  /**
   * Pushes a vertical cylinder (feet at y, given height) out of solid boxes it overlaps sideways.
   * Boxes whose top is within `step` of the feet are ignored (they are stepped onto instead).
   * Returns true when something was hit.
   */
  collide(pos: { x: number; y: number; z: number }, r: number, height: number, step: number): boolean {
    let hit = false;
    const b = this.boxes;
    for (let pass = 0; pass < 2; pass++) {
      const cell = this.cellOf(pos.x, pos.z);
      if (!cell) break;
      for (const i of cell) {
        const o = i * 6;
        const minX = b[o] ?? 0;
        const minY = b[o + 1] ?? 0;
        const minZ = b[o + 2] ?? 0;
        const maxX = b[o + 3] ?? 0;
        const maxY = b[o + 4] ?? 0;
        const maxZ = b[o + 5] ?? 0;
        if (maxY <= pos.y + step || minY >= pos.y + height) continue;
        const cx = Math.max(minX, Math.min(pos.x, maxX));
        const cz = Math.max(minZ, Math.min(pos.z, maxZ));
        let dx = pos.x - cx;
        let dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: leave by the shallowest side.
          const left = pos.x - minX;
          const right = maxX - pos.x;
          const back = pos.z - minZ;
          const front = maxZ - pos.z;
          const m = Math.min(left, right, back, front);
          dx = m === left ? -1 : m === right ? 1 : 0;
          dz = m === back ? -1 : m === front ? 1 : 0;
          if (dx) pos.x = dx < 0 ? minX - r : maxX + r;
          else pos.z = dz < 0 ? minZ - r : maxZ + r;
        }
      }
    }
    // Arena fence.
    const d = Math.hypot(pos.x, pos.z);
    const lim = this.radius - r;
    if (d > lim) {
      pos.x *= lim / d;
      pos.z *= lim / d;
      hit = true;
    }
    return hit;
  }

  /** Distance along a ray to the first solid box, or maxDist. Used to keep the camera out of walls. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number {
    return Math.min(this.cast(this.boxes, ox, oy, oz, dx, dy, dz, maxDist), this.cast(this.cameraBoxes, ox, oy, oz, dx, dy, dz, maxDist));
  }

  private cast(b: number[], ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): number {
    let best = maxDist;
    const n = b.length / 6;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      let t0 = 0;
      let t1 = best;
      const slab = (orig: number, dir: number, lo: number, hi: number): boolean => {
        if (Math.abs(dir) < 1e-9) return orig >= lo && orig <= hi;
        let a = (lo - orig) / dir;
        let c = (hi - orig) / dir;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
        return t0 <= t1;
      };
      if (slab(ox, dx, b[o] ?? 0, b[o + 3] ?? 0) && slab(oy, dy, b[o + 1] ?? 0, b[o + 4] ?? 0) && slab(oz, dz, b[o + 2] ?? 0, b[o + 5] ?? 0)) best = Math.min(best, t0);
    }
    return best;
  }

  // ---------- Geometry ----------

  private box(cx: number, y0: number, cz: number, w: number, h: number, d: number, color: string, top?: string, rot = 0, into = this.parts): void {
    const g = new BoxGeometry(w, h, d).toNonIndexed();
    g.deleteAttribute('uv');
    const c = new Color(color);
    const t = new Color(top ?? color);
    const side = c.clone().multiplyScalar(0.92);
    const cols: number[] = [];
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z (6 vertices each when non-indexed).
    const faces = [side, side, t, c.clone().multiplyScalar(0.7), c, c.clone().multiplyScalar(0.85)];
    for (const f of faces) for (let v = 0; v < 6; v++) cols.push(f.r, f.g, f.b);
    g.setAttribute('color', new Float32BufferAttribute(cols, 3));
    g.applyMatrix4(new Matrix4().makeRotationY(rot).setPosition(cx, y0 + h / 2, cz));
    into.push(g);
  }

  private solidBox(cx: number, y0: number, cz: number, w: number, h: number, d: number, color: string, top?: string, rot = 0): void {
    this.box(cx, y0, cz, w, h, d, color, top, rot);
    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    const hw = (w * c + d * s) / 2;
    const hd = (w * s + d * c) / 2;
    this.solid(cx - hw, y0, cz - hd, cx + hw, y0 + h, cz + hd);
  }

  private tinted(g: BufferGeometry, color: string, jitter = 0): BufferGeometry {
    const geo = g.index ? g.toNonIndexed() : g;
    const base = new Color(color);
    const cols: number[] = [];
    const n = geo.getAttribute('position').count;
    for (let i = 0; i < n; i += 3) {
      const k = 1 + (this.rng.next() - 0.5) * jitter;
      for (let v = 0; v < 3; v++) cols.push(base.r * k, base.g * k, base.b * k);
    }
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
    geo.deleteAttribute('uv');
    geo.computeVertexNormals();
    return geo;
  }

  private prop(p: Prop): void {
    const rng = this.rng;
    switch (p.kind) {
      case 'box':
        this.solidBox(p.at[0], p.at[1], p.at[2], p.size[0], p.size[1], p.size[2], p.color, p.top);
        break;
      case 'ramp': {
        const [x0, z0] = p.from;
        const [x1, z1] = p.to;
        this.ramps.push({ x0, z0, x1, z1, half: p.width / 2, h0: p.h0, h1: p.h1 });
        const len = Math.hypot(x1 - x0, z1 - z0);
        const g = new BoxGeometry(len, 0.12, p.width);
        const slope = Math.atan2(p.h1 - p.h0, len);
        const yaw = Math.atan2(-(z1 - z0), x1 - x0);
        const m = new Matrix4().makeRotationY(yaw).multiply(new Matrix4().makeRotationZ(slope));
        m.setPosition((x0 + x1) / 2, (p.h0 + p.h1) / 2 - 0.05, (z0 + z1) / 2);
        const geo = this.tinted(g, p.color, 0.05);
        geo.applyMatrix4(m);
        this.parts.push(geo);
        break;
      }
      case 'platform': {
        const [cx, y, cz] = p.at;
        const [w, h, d] = p.size;
        this.solidBox(cx, y, cz, w, h, d, p.edge === '#f2d23a' ? '#7f7b80' : p.edge, p.top);
        // Yellow safety lines along both long edges.
        for (const s of [-1, 1]) this.box(cx, y + h, cz + s * (d / 2 - 0.35), w, 0.02, 0.22, p.edge);
        break;
      }
      case 'canopy': {
        const [cx, y, cz] = p.at;
        const [w, h, d] = p.size;
        for (let i = 0; i < p.posts; i++) {
          const x = cx - w / 2 + 1 + (i * (w - 2)) / (p.posts - 1);
          this.solidBox(x, y, cz, 0.28, h, 0.28, p.color);
        }
        this.solidBox(cx, y + h, cz, w, 0.32, d, p.color, p.roof);
        break;
      }
      case 'tracks': {
        for (const z of p.z) {
          this.box((p.from + p.to) / 2, 0, z, p.to - p.from, 0.16, 3.2, '#6d6259', '#7c7068');
          const segs = Math.floor((p.to - p.from) / 12);
          for (let s = 0; s < segs; s++) {
            const x0 = p.from + s * 12;
            const stolen = [rng.next() < p.missing, rng.next() < p.missing];
            const bare = stolen[0] && stolen[1];
            for (let k = 0; k < 17; k++) {
              const x = x0 + 0.35 + k * 0.7;
              if (bare && rng.next() < 0.3) continue;
              const yaw = bare ? (rng.next() - 0.5) * 0.9 : (rng.next() - 0.5) * 0.04;
              this.box(x, 0.16, z + (bare ? (rng.next() - 0.5) * 0.8 : 0), 0.26, 0.13, 2.5, '#5b3e2c', '#694733', yaw);
            }
            for (let side = 0; side < 2; side++) {
              if (stolen[side]) continue;
              this.box(x0 + 6, 0.29, z + (side ? 0.72 : -0.72), 11.96, 0.15, 0.1, '#a9a39d', '#d8d2cb');
            }
          }
        }
        break;
      }
      case 'hall': {
        const [cx, y, cz] = p.at;
        const [w, h, d] = p.size;
        this.solidBox(cx, y, cz, w, h, d, '#d8d4cc', '#bdb8b0');
        // Glass front with warm light behind it, a dark entrance and a white roof edge.
        const front = cz + d / 2;
        this.box(cx, y + 0.6, front + 0.06, w - 4, h - 2.4, 0.1, '#ffd29a', undefined, 0, this.glass);
        for (let i = 0; i <= 10; i++) this.box(cx - (w - 4) / 2 + (i * (w - 4)) / 10, y + 0.6, front + 0.14, 0.18, h - 2.4, 0.1, '#5d6474');
        this.box(cx, y + 0.6 + (h - 2.4) / 2, front + 0.14, w - 4, 0.14, 0.1, '#5d6474');
        this.box(cx, y, front + 0.2, 8, 3, 0.1, '#2a2f3c');
        this.box(cx, y + h, cz, w + 0.6, 0.35, d + 0.6, '#f2efe8');
        this.sign(p.sign, cx, y + h - 1, front + 0.3, 20, 2.2);
        break;
      }
      case 'garages': {
        const [x0, y, cz] = p.at;
        const [w, h, d] = p.size;
        for (let i = 0; i < p.count; i++) {
          const x = x0 - ((p.count - 1) * w) / 2 + i * w;
          this.solidBox(x, y, cz, w - 0.05, h, d, '#97705f', '#6b6b70');
          this.box(x, y, cz - d / 2 - 0.04, w - 0.8, h - 0.4, 0.08, p.doors[i % p.doors.length] ?? '#888');
        }
        break;
      }
      case 'crate': {
        const [x, y, z] = p.at;
        this.solidBox(x, y, z, p.size, p.size, p.size, '#9a6b3c', '#b5824e', (rng.next() - 0.5) * 0.2);
        break;
      }
      case 'kiosk': {
        const [x, y, z] = p.at;
        this.solidBox(x, y, z, 2.4, 2.5, 2.4, '#e9e4d8', '#c9332b', p.rot);
        this.box(x, y + 2.5, z, 2.7, 0.35, 2.7, '#c9332b', '#d84a3f', p.rot);
        this.sign('RUCH', x + Math.sin(p.rot) * 1.36, y + 2.2, z + Math.cos(p.rot) * 1.36, 2, 0.6, p.rot, '#c9332b', '#ffffff');
        break;
      }
      case 'bench': {
        const [x, y, z] = p.at;
        this.solidBox(x, y, z, 2, 0.45, 0.6, '#7a5a3a', '#9a7448', p.rot);
        this.box(x, y + 0.45, z - 0.28, 2, 0.5, 0.08, '#7a5a3a', undefined, p.rot);
        break;
      }
      case 'lamp': {
        const [x, y, z] = p.at;
        this.solidBox(x, y, z, 0.18, 5, 0.18, '#3a3f4c');
        this.box(x, y + 5, z, 0.7, 0.18, 0.35, '#3a3f4c');
        this.box(x, y + 4.93, z, 0.5, 0.06, 0.25, '#ffe2a8', undefined, 0, this.glow);
        break;
      }
      case 'bush': {
        const [x, y, z] = p.at;
        for (let i = 0; i < 3; i++) {
          const g = new IcosahedronGeometry(p.r * (0.7 + rng.next() * 0.4), 0);
          const geo = this.tinted(g, rng.next() < 0.5 ? '#4f7038' : '#5d7d3c', 0.18);
          geo.applyMatrix4(new Matrix4().makeScale(1, 0.75, 1).setPosition(x + (rng.next() - 0.5) * p.r, y + p.r * 0.55, z + (rng.next() - 0.5) * p.r));
          this.parts.push(geo);
        }
        break;
      }
      case 'tree': {
        const [x, y, z] = p.at;
        this.solidBox(x, y, z, 0.4, p.h * 0.45, 0.4, '#5b4232');
        const r = p.h * 0.26;
        this.cameraBoxes.push(x - r, y + p.h * 0.3, z - r, x + r, y + p.h * 1.05, z + r);
        for (let i = 0; i < 3; i++) {
          const r = p.h * (0.32 - i * 0.07);
          const geo = this.tinted(new ConeGeometry(r, p.h * 0.38, 7), i === 1 ? '#46663a' : '#3d5a33', 0.15);
          geo.applyMatrix4(new Matrix4().makeRotationY(rng.next() * 3).setPosition(x, y + p.h * (0.42 + i * 0.18), z));
          this.parts.push(geo);
        }
        break;
      }
      case 'shed': {
        const [x, y, z] = p.at;
        const [w, h, d] = p.size;
        this.solidBox(x, y, z, w, h, d, p.color);
        const roof = this.tinted(new ConeGeometry(Math.max(w, d) * 0.78, 1.1, 4), p.roof, 0.08);
        roof.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 4).setPosition(x, y + h + 0.55, z));
        this.parts.push(roof);
        this.box(x, y, z + d / 2 + 0.03, 0.9, 1.8, 0.06, '#4a3a2c');
        break;
      }
      case 'fence': {
        const [x0, z0] = p.from;
        const [x1, z1] = p.to;
        const len = Math.hypot(x1 - x0, z1 - z0);
        const yaw = Math.atan2(-(z1 - z0), x1 - x0);
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        for (const hy of [0.35, 0.8]) this.box(cx, hy, cz, len, 0.08, 0.06, p.color, undefined, yaw);
        const posts = Math.max(2, Math.round(len / 2));
        for (let i = 0; i <= posts; i++) {
          const t = i / posts;
          this.box(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.12, p.h, 0.12, p.color);
        }
        const hw = Math.abs(x1 - x0) / 2 + 0.1;
        const hd = Math.abs(z1 - z0) / 2 + 0.1;
        this.solid(cx - hw, 0, cz - hd, cx + hw, p.h, cz + hd);
        break;
      }
    }
  }

  private fenceRing(): void {
    const r = this.radius;
    const n = Math.round((2 * Math.PI * r) / 2.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      this.box(x, 0, z, 0.14, 2, 0.14, '#4c5566', '#5d6677');
      const a2 = ((i + 0.5) / n) * Math.PI * 2;
      const len = (2 * Math.PI * r) / n;
      for (const hy of [0.15, 1.85]) this.box(Math.cos(a2) * r, hy, Math.sin(a2) * r, 0.05, 0.05, len, '#4c5566', undefined, -a2);
      // Mesh panel suggested by darker vertical bars.
      for (let k = 1; k < 4; k++) {
        const t = (i + k / 4) / n;
        const ak = t * Math.PI * 2;
        this.box(Math.cos(ak) * r, 0.15, Math.sin(ak) * r, 0.03, 1.7, 0.03, '#3b4352');
      }
    }
  }

  /** Ground: tiled procedural textures (crisp at any distance) on a few flat layers. */
  private ground(): Group {
    const gr = this.def.ground;
    const size = this.radius * 2 + 30;
    const rng = new Rng(hashSeed(`${this.def.id}:ground`));
    const group = new Group();
    const layer = (tex: CanvasTexture, tileM: number, x0: number, z0: number, x1: number, z1: number, y: number): void => {
      const t = tex.clone();
      t.repeat.set((x1 - x0) / tileM, (z1 - z0) / tileM);
      t.needsUpdate = true;
      const m = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0), new MeshToonMaterial({ map: t, gradientMap: toonRamp(), polygonOffset: true, polygonOffsetFactor: -y * 100 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      group.add(m);
    };
    const grass = tile(256, (g) => {
      g.fillStyle = gr.grass;
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = rng.next() < 0.5 ? gr.grassDark : '#6a8044';
        g.globalAlpha = 0.25 + rng.next() * 0.3;
        g.beginPath();
        g.arc(rng.next() * 256, rng.next() * 256, 6 + rng.next() * 22, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 0.5;
      for (let i = 0; i < 500; i++) {
        g.fillStyle = rng.next() < 0.5 ? '#74904a' : gr.grassDark;
        g.fillRect(rng.next() * 256, rng.next() * 256, 1.5, 4 + rng.next() * 4);
      }
      g.globalAlpha = 1;
    });
    const plaza = tile(256, (g) => {
      g.fillStyle = gr.plazaLine;
      g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
          const k = 0.92 + rng.next() * 0.14;
          const c = new Color(gr.plaza).multiplyScalar(k);
          g.fillStyle = `#${c.getHexString()}`;
          g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
        }
      }
      g.globalAlpha = 0.18;
      for (let i = 0; i < 160; i++) {
        g.fillStyle = rng.next() < 0.5 ? '#ffffff' : '#000000';
        g.fillRect(rng.next() * 256, rng.next() * 256, 2, 2);
      }
      g.globalAlpha = 1;
    });
    const gravel = tile(256, (g) => {
      g.fillStyle = gr.gravel;
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        const k = rng.next();
        g.fillStyle = k < 0.33 ? '#5f544c' : k < 0.66 ? '#9a8d82' : '#6f625a';
        g.fillRect(rng.next() * 256, rng.next() * 256, 2 + rng.next() * 3, 2 + rng.next() * 3);
      }
    });
    const dirt = tile(256, (g) => {
      g.fillStyle = '#7a6550';
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#6a5542';
      for (let r = 0; r < 256; r += 32) g.fillRect(0, r + 10, 256, 10);
      g.globalAlpha = 0.4;
      for (let i = 0; i < 300; i++) {
        g.fillStyle = rng.next() < 0.5 ? '#5d4a3a' : '#8a7560';
        g.fillRect(rng.next() * 256, rng.next() * 256, 3, 3);
      }
      g.globalAlpha = 1;
    });
    layer(grass, 9, -size / 2, -size / 2, size / 2, size / 2, 0);
    layer(gravel, 4, -size / 2, 14, size / 2, 25, 0.01);
    layer(plaza, 2, -30, -24, 30, 13, 0.012);
    layer(plaza, 2, 30, -9, 47, -3, 0.012);
    layer(dirt, 6, -52, -12, -30, 12, 0.01);
    return group;
  }

  private sign(text: string, x: number, y: number, z: number, w: number, h: number, rot = 0, bg = '#0d3b8c', fg = '#ffffff'): void {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = Math.round((1024 * h) / w);
    const g = c.getContext('2d');
    if (!g) return;
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = fg;
    g.font = `800 ${Math.round(c.height * 0.62)}px "Barlow Condensed", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 + c.height * 0.04, c.width * 0.94);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: tex, fog: true }));
    m.position.set(x, y, z);
    m.rotation.y = rot;
    this.group.add(m);
  }
}

function tile(px: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  draw(g);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function skyDome(stops: [string, string, string, string]): Mesh {
  const geo = new SphereGeometry(300, 24, 16);
  const top = new Color(stops[0]);
  const mid = new Color(stops[1]);
  const hor = new Color(stops[2]);
  const low = new Color(stops[3]);
  const pos = geo.getAttribute('position');
  const cols = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 300;
    if (y > 0.35) c.copy(mid).lerp(top, Math.min(1, (y - 0.35) / 0.65));
    else if (y > 0.02) c.copy(hor).lerp(mid, (y - 0.02) / 0.33);
    else if (y > -0.08) c.copy(hor);
    else c.copy(hor).lerp(low, Math.min(1, (-0.08 - y) / 0.3));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  const mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}
