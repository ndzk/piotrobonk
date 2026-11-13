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
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tinted } from '../render/tint';
import { toonRamp } from '../render/toon';

const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s3 = new Vector3();
const dir = new Vector3();
const up = new Vector3(0, 1, 0);
const tiltAxis = new Vector3(1, 0, 0);
const qTilt = new Quaternion();
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

/** Diagonal hazard stripes with soft long edges, for the bus danger lane. */
function hazardStripes(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#000000';
    g.lineWidth = 12;
    for (let k = -64; k < 128; k += 24) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + 64, 64);
      g.stroke();
    }
    // Fade the far end so the lane does not look like a painted road marking.
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.25, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1, 6);
  return t;
}

/** Puddle: dark body, hot rim, so it reads as a damage zone and not as a shadow. */
function puddleTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.86, 'rgba(255,240,190,1)');
    grad.addColorStop(0.95, 'rgba(255,200,120,0.9)');
    grad.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(c);
}

/** Aura disc: a faint fill with a bright, clearly visible rim. */
function auraTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.3)');
    grad.addColorStop(0.88, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.985, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    // Teeth around the rim, so the aura reads as something that bites.
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      g.beginPath();
      g.arc(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124, 7, 0, Math.PI * 2);
      g.fill();
    }
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
  private readonly beamColors = new Uint32Array(this.beamMax);
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
  // Flashes: short-lived additive spheres at the heart of an explosion.
  private readonly flashMax = 24;
  private flashN = 0;
  private readonly flash = new Float32Array(this.flashMax * 6);
  private readonly flashColors = new Uint32Array(this.flashMax);
  private readonly flashes: InstancedMesh;
  // Scorch marks: ground decals that outlive the explosion.
  private readonly scorchMax = 24;
  private scorchN = 0;
  private scorchNext = 0;
  private readonly scorch = new Float32Array(this.scorchMax * 6);
  private readonly scorches: InstancedMesh;
  /** Danger strips under charging buses: one persistent instanced mesh, not pooled beams. */
  private readonly warn: InstancedMesh;
  private warnN = 0;

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
      new MeshBasicMaterial({ map: puddleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }),
      64,
    );
    this.puddles.renderOrder = 1;
    const canopy = new ConeGeometry(0.42, 0.24, 8, 1, true);
    canopy.translate(0, 0.32, 0);
    const parts = [tinted(canopy, '#d94a4a'), tinted(new CylinderGeometry(0.018, 0.018, 0.66, 5).translate(0, 0.06, 0), '#2b2b30'), tinted(new BoxGeometry(0.05, 0.1, 0.05).translate(0, -0.26, 0.03), '#2b2b30')];
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
    this.flashes = instanced(scene, new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }), this.flashMax);
    const scorchGeo = new CircleGeometry(1, 20);
    scorchGeo.rotateX(-Math.PI / 2);
    this.scorches = instanced(
      scene,
      scorchGeo,
      new MeshBasicMaterial({ map: radial('rgba(20,14,10,0.85)', 'rgba(20,14,10,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
      this.scorchMax,
    );
    this.scorches.renderOrder = 1;
    const warnGeo = new PlaneGeometry(1, 1);
    warnGeo.rotateX(-Math.PI / 2);
    warnGeo.translate(0, 0, 0.5);
    this.warn = instanced(
      scene,
      warnGeo,
      new MeshBasicMaterial({ map: hazardStripes(), color: '#ff3a2a', transparent: true, depthWrite: false, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -6 }),
      4,
    );
    this.warn.renderOrder = 2;
    this.warn.count = 0;
  }

  /** Marks the lane a bus is about to charge down. Call once per frame per bus, then `finishWarnings`. */
  addWarning(x: number, y: number, z: number, dirX: number, dirZ: number, length: number, width: number, pulse: number): void {
    if (this.warnN >= 4) return;
    q.setFromAxisAngle(up, Math.atan2(dirX, dirZ));
    m4.compose(v.set(x, y + 0.03, z), q, s3.set(width, 1, length));
    this.warn.setMatrixAt(this.warnN, m4);
    col.setRGB(1, 0.25 + pulse * 0.35, 0.18);
    this.warn.setColorAt(this.warnN, col);
    this.warnN++;
  }

  finishWarnings(): void {
    this.warn.count = this.warnN;
    this.warn.instanceMatrix.needsUpdate = true;
    if (this.warn.instanceColor) this.warn.instanceColor.needsUpdate = true;
    this.warnN = 0;
  }

  clear(): void {
    this.beamN = 0;
    this.ringN = 0;
    this.flashN = 0;
    this.scorchN = 0;
    this.scorchNext = 0;
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

  /** A bright core at the moment of an explosion, plus a scorch mark that lingers. */
  addFlash(x: number, y: number, z: number, radius: number, color: Color): void {
    if (this.flashN < this.flashMax) {
      const o = this.flashN++ * 6;
      const f = this.flash;
      f[o] = x;
      f[o + 1] = y + radius * 0.3;
      f[o + 2] = z;
      f[o + 3] = radius;
      f[o + 4] = f[o + 5] = 0.18;
      this.flashColors[this.flashN - 1] = color.getHex();
    }
    // Scorch marks are a ring buffer: the oldest fades out when a new one takes its slot.
    const i = this.scorchN < this.scorchMax ? this.scorchN++ : this.scorchNext;
    this.scorchNext = (this.scorchNext + 1) % this.scorchMax;
    const o = i * 6;
    const sc = this.scorch;
    sc[o] = x;
    sc[o + 1] = y;
    sc[o + 2] = z;
    sc[o + 3] = radius * 0.8;
    sc[o + 4] = sc[o + 5] = 6;
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
    while (i < this.flashN) {
      const o = i * 6;
      this.flash[o + 4] -= dt;
      if (this.flash[o + 4] <= 0) {
        const last = --this.flashN;
        this.flash.copyWithin(o, last * 6, last * 6 + 6);
        this.flashColors[i] = this.flashColors[last];
        continue;
      }
      i++;
    }
    for (let k = 0; k < this.scorchN; k++) this.scorch[k * 6 + 4] = Math.max(0, this.scorch[k * 6 + 4] - dt);
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
      // Keep the tint: an additive beam multiplied past 1 goes white and blows out the screen.
      col.setHex(this.beamColors[i]).multiplyScalar(Math.min(1, fade * 1.2));
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
    for (let i = 0; i < this.flashN; i++) {
      const o = i * 6;
      const f = this.flash[o + 4] / this.flash[o + 5];
      const k = this.flash[o + 3] * (0.35 + 0.65 * (1 - f));
      m4.makeScale(k, k * 0.85, k).setPosition(this.flash[o], this.flash[o + 1], this.flash[o + 2]);
      this.flashes.setMatrixAt(i, m4);
      col.setHex(this.flashColors[i]).multiplyScalar(f * 1.8);
      this.flashes.setColorAt(i, col);
    }
    this.flashes.count = this.flashN;
    this.flashes.instanceMatrix.needsUpdate = true;
    if (this.flashes.instanceColor) this.flashes.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.scorchN; i++) {
      const o = i * 6;
      const life = this.scorch[o + 4] / this.scorch[o + 5];
      const k = this.scorch[o + 3];
      m4.makeScale(k, 1, k).setPosition(this.scorch[o], this.scorch[o + 1] + 0.02, this.scorch[o + 2]);
      this.scorches.setMatrixAt(i, m4);
      col.setScalar(Math.min(1, life * 1.6));
      this.scorches.setColorAt(i, col);
    }
    this.scorches.count = this.scorchN;
    this.scorches.instanceMatrix.needsUpdate = true;
    if (this.scorches.instanceColor) this.scorches.instanceColor.needsUpdate = true;
  }

  /** The aura disc for weapon slot `slot` (created on first use), recoloured when the weapon changes. */
  aura(slot: number, color: string): Mesh {
    let m = this.auras[slot] as Mesh | undefined;
    if (!m) {
      const geo = new CircleGeometry(1, 48);
      geo.rotateX(-Math.PI / 2);
      // Normal blending, not additive: an additive disc washes out to a pale smear on the light plaza.
      m = new Mesh(geo, new MeshBasicMaterial({ map: auraTexture(), color, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }));
      m.renderOrder = 1;
      this.scene.add(m);
      this.auras[slot] = m;
    }
    (m.material as MeshBasicMaterial).color.set(color);
    m.visible = true;
    return m;
  }

  hideAurasExcept(slots: Set<number>): void {
    for (let i = 0; i < this.auras.length; i++) {
      if (!slots.has(i)) this.auras[i].visible = false;
    }
  }

  placeUmbrella(i: number, x: number, y: number, z: number, spin: number, scale: number, storm = false): void {
    q.setFromAxisAngle(up, spin);
    // The storm umbrella tips as it spins, as if the wind had caught it.
    if (storm) q.multiply(qTilt.setFromAxisAngle(tiltAxis, Math.sin(spin * 0.7) * 0.35));
    m4.compose(v.set(x, y, z), q, s3.set(scale, scale, scale));
    this.umbrellas.setMatrixAt(i, m4);
    col.setRGB(1, 1, 1);
    if (storm) col.setRGB(0.55, 0.62, 1.25);
    this.umbrellas.setColorAt(i, col);
  }

  finishUmbrellas(n: number): void {
    this.umbrellas.count = n;
    this.umbrellas.instanceMatrix.needsUpdate = true;
    if (this.umbrellas.instanceColor) this.umbrellas.instanceColor.needsUpdate = true;
  }
}
