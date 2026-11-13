import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonRamp } from '../render/toon';

const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s3 = new Vector3();
const dir = new Vector3();
const up = new Vector3(0, 1, 0);
const col = new Color();

function radial(inner: string, outer: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.75, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(c);
}

function instanced(scene: Scene, geo: BufferGeometry, mat: MeshBasicMaterial | MeshToonMaterial, max: number): InstancedMesh {
  const m = new InstancedMesh(geo, mat, max);
  m.instanceMatrix.setUsage(DynamicDrawUsage);
  m.instanceColor = new InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3).setUsage(DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  scene.add(m);
  return m;
}

/**
 * Short-lived weapon visuals in pools: beams (lightning segments), rings (explosions, shockwaves),
 * puddles, the garlic aura and the orbiting umbrellas. Simulation lives in the arsenal; this only draws.
 */
export class WeaponFx {
  // Beams: glowing boxes stretched between two points (lightning, strikes).
  private readonly beamMax = 256;
  private beamN = 0;
  private readonly beam = new Float32Array(this.beamMax * 9);
  private readonly beams: InstancedMesh;
  // Rings: expanding flat rings (explosions, shockwaves, whistle).
  private readonly ringMax = 64;
  private ringN = 0;
  private readonly ring = new Float32Array(this.ringMax * 9);
  private readonly rings: InstancedMesh;
  // Puddles: drawn from the arsenal's puddle state each frame.
  readonly puddles: InstancedMesh;
  // Aura discs, one per aura weapon.
  private readonly auras: Mesh[] = [];
  readonly umbrellas: InstancedMesh;

  constructor(private readonly scene: Scene) {
    const beamGeo = new BoxGeometry(1, 1, 1);
    beamGeo.translate(0, 0, 0.5);
    this.beams = instanced(scene, beamGeo, new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }), this.beamMax);
    const ringGeo = new RingGeometry(0.78, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.rings = instanced(scene, ringGeo, new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide }), this.ringMax);
    const puddleGeo = new CircleGeometry(1, 28);
    puddleGeo.rotateX(-Math.PI / 2);
    this.puddles = instanced(
      scene,
      puddleGeo,
      new MeshBasicMaterial({ map: radial('rgba(255,255,255,0.85)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }),
      64,
    );
    this.puddles.renderOrder = 1;
    const canopy = new ConeGeometry(0.62, 0.32, 8, 1, true);
    canopy.translate(0, 0.45, 0);
    const parts = [this.tint(canopy, '#d94a4a'), this.tint(new CylinderGeometry(0.02, 0.02, 0.9, 5).translate(0, 0.1, 0), '#2b2b30'), this.tint(new BoxGeometry(0.06, 0.12, 0.06).translate(0, -0.32, 0.03), '#2b2b30')];
    const umbrellaMat = new MeshToonMaterial({ gradientMap: toonRamp(), vertexColors: true, side: DoubleSide });
    // Umbrellas orbit through the camera when it is close behind Piotrek: dither them out instead of
    // letting one fill the screen.
    umbrellaMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float camFade = smoothstep(1.4, 3.4, length(vViewPosition));
        if (camFade < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`,
      );
    };
    this.umbrellas = instanced(scene, mergeGeometries(parts), umbrellaMat, 16);
  }

  private tint(g: BufferGeometry, color: string): BufferGeometry {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute('uv');
    const c = new Color(color);
    const n = geo.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    return geo;
  }

  clear(): void {
    this.beamN = 0;
    this.ringN = 0;
    for (const a of this.auras) a.visible = false;
  }

  /** A glowing segment from a to b that fades out over `life`. */
  addBeam(ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: Color, width: number, life: number): void {
    if (this.beamN >= this.beamMax) return;
    const o = this.beamN++ * 9;
    const b = this.beam;
    b[o] = ax;
    b[o + 1] = ay;
    b[o + 2] = az;
    b[o + 3] = bx;
    b[o + 4] = by;
    b[o + 5] = bz;
    b[o + 6] = life;
    b[o + 7] = life;
    b[o + 8] = width;
    // Colour packed per instance at render time from the slot's own colour array.
    this.beamColors[this.beamN - 1] = color.getHex();
  }
  private readonly beamColors = new Uint32Array(256);

  /** Jagged lightning between two points: several beams with random kinks. */
  addBolt(ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: Color, width = 0.08, life = 0.16): void {
    const seg = 5;
    let px = ax;
    let py = ay;
    let pz = az;
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    for (let k = 1; k <= seg; k++) {
      const t = k / seg;
      const j = k === seg ? 0 : len * 0.08;
      const nx = ax + (bx - ax) * t + (Math.random() - 0.5) * j;
      const ny = ay + (by - ay) * t + (Math.random() - 0.5) * j;
      const nz = az + (bz - az) * t + (Math.random() - 0.5) * j;
      this.addBeam(px, py, pz, nx, ny, nz, color, width, life);
      px = nx;
      py = ny;
      pz = nz;
    }
  }

  /** Expanding ring on the ground (explosion, shockwave). */
  addRing(x: number, y: number, z: number, radius: number, color: Color, life = 0.35): void {
    if (this.ringN >= this.ringMax) return;
    const o = this.ringN++ * 9;
    const r = this.ring;
    r[o] = x;
    r[o + 1] = y;
    r[o + 2] = z;
    r[o + 3] = radius;
    r[o + 4] = life;
    r[o + 5] = life;
    r[o + 6] = color.r;
    r[o + 7] = color.g;
    r[o + 8] = color.b;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.beamN) {
      const o = i * 9;
      this.beam[o + 6] -= dt;
      if (this.beam[o + 6] <= 0) {
        const last = --this.beamN;
        this.beam.copyWithin(o, last * 9, last * 9 + 9);
        this.beamColors[i] = this.beamColors[last];
        continue;
      }
      i++;
    }
    i = 0;
    while (i < this.ringN) {
      const o = i * 9;
      this.ring[o + 4] -= dt;
      if (this.ring[o + 4] <= 0) {
        const last = --this.ringN;
        this.ring.copyWithin(o, last * 9, last * 9 + 9);
        continue;
      }
      i++;
    }
  }

  render(): void {
    for (let i = 0; i < this.beamN; i++) {
      const o = i * 9;
      const b = this.beam;
      const fade = b[o + 6] / b[o + 7];
      dir.set(b[o + 3] - b[o], b[o + 4] - b[o + 1], b[o + 5] - b[o + 2]);
      const len = dir.length() || 0.001;
      q.setFromUnitVectors(v.set(0, 0, 1), dir.divideScalar(len));
      const w = b[o + 8] * (0.4 + 0.6 * fade);
      m4.compose(v.set(b[o], b[o + 1], b[o + 2]), q, s3.set(w, w, len));
      this.beams.setMatrixAt(i, m4);
      col.setHex(this.beamColors[i]).multiplyScalar(fade * 1.6);
      this.beams.setColorAt(i, col);
    }
    this.beams.count = this.beamN;
    this.beams.instanceMatrix.needsUpdate = true;
    if (this.beams.instanceColor) this.beams.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.ringN; i++) {
      const o = i * 9;
      const r = this.ring;
      const t = 1 - r[o + 4] / r[o + 5];
      const k = r[o + 3] * (0.25 + 0.75 * (1 - (1 - t) * (1 - t)));
      m4.makeScale(k, 1, k).setPosition(r[o], r[o + 1] + 0.08, r[o + 2]);
      this.rings.setMatrixAt(i, m4);
      const f = (1 - t) * 1.4;
      col.setRGB(r[o + 6] * f, r[o + 7] * f, r[o + 8] * f);
      this.rings.setColorAt(i, col);
    }
    this.rings.count = this.ringN;
    this.rings.instanceMatrix.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }

  /** The aura disc for weapon slot `slot` (created on first use). */
  aura(slot: number, color: string): Mesh {
    let m = this.auras[slot] as Mesh | undefined;
    if (!m) {
      const geo = new CircleGeometry(1, 40);
      geo.rotateX(-Math.PI / 2);
      m = new Mesh(geo, new MeshBasicMaterial({ map: radial('rgba(255,255,255,0.18)', 'rgba(255,255,255,0.0)'), color, transparent: true, depthWrite: false, blending: AdditiveBlending }));
      m.renderOrder = 1;
      this.scene.add(m);
      this.auras[slot] = m;
    }
    m.visible = true;
    return m;
  }

  hideAurasExcept(slots: Set<number>): void {
    this.auras.forEach((a, i) => {
      if (!slots.has(i)) a.visible = false;
    });
  }

  placeUmbrella(i: number, x: number, y: number, z: number, spin: number, scale: number): void {
    q.setFromAxisAngle(up, spin);
    m4.compose(v.set(x, y, z), q, s3.set(scale, scale, scale));
    this.umbrellas.setMatrixAt(i, m4);
  }

  finishUmbrellas(n: number): void {
    this.umbrellas.count = n;
    this.umbrellas.instanceMatrix.needsUpdate = true;
  }
}
