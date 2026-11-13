// Everything a boss throws at Piotrek: telegraphed slams, lingering zones, expanding waves, sweeping
// beams and enemy projectiles. All pooled and instanced; the arrays are flat so a step allocates nothing.

import { AdditiveBlending, CanvasTexture, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, RingGeometry, SphereGeometry, Vector3, type BufferGeometry, type Scene } from 'three';

const MAX_MARKS = 32;
const MAX_WAVES = 8;
const MAX_BEAMS = 4;
const MAX_SHOTS = 160;
/** mark: x, z, radius, age, telegraph, damage, duration (0 = a single slam), y */
const MARK = 8;
/** wave: x, z, radius, grown, damage, speed, hit */
const WAVE = 7;
/** beam: angle, length, left, telegraph left, damage, sweep speed, x, z */
const BEAM = 8;
/** shot: x, y, z, vx, vy, vz, life, damage, colour */
const SHOT = 9;

const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s3 = new Vector3();
const up = new Vector3(0, 1, 0);
const col = new Color();

function instanced(scene: Scene, geo: BufferGeometry, mat: MeshBasicMaterial, max: number): InstancedMesh {
  // Warnings must keep their colour: tone mapping would wash the red out against a bright plaza.
  mat.toneMapped = false;
  const m = new InstancedMesh(geo, mat, max);
  m.instanceMatrix.setUsage(DynamicDrawUsage);
  m.instanceColor = new InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3).setUsage(DynamicDrawUsage);
  m.frustumCulled = false;
  m.count = 0;
  scene.add(m);
  return m;
}

/** Soft disc, bright at the rim: used for both the warning and the live zone. */
function discTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.45)');
    grad.addColorStop(0.75, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.92, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  return c;
}

export interface HazardHit {
  /** Piotrek is standing in something that hurts. */
  hurt(damage: number): void;
}

export class Hazards {
  private markN = 0;
  private readonly mark = new Float32Array(MAX_MARKS * MARK);
  private waveN = 0;
  private readonly wave = new Float32Array(MAX_WAVES * WAVE);
  private beamN = 0;
  private readonly beam = new Float32Array(MAX_BEAMS * BEAM);
  private shotN = 0;
  private readonly shot = new Float32Array(MAX_SHOTS * SHOT);
  private readonly marks: InstancedMesh;
  private readonly waves: InstancedMesh;
  private readonly beams: InstancedMesh;
  private readonly shots: InstancedMesh;

  constructor(scene: Scene) {
    const disc = new CircleGeometry(1, 36);
    disc.rotateX(-Math.PI / 2);
    const tex = new CanvasTexture(discTexture());
    this.marks = instanced(scene, disc, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8 }), MAX_MARKS);
    this.marks.renderOrder = 2;
    const ring = new RingGeometry(0.86, 1, 48);
    ring.rotateX(-Math.PI / 2);
    this.waves = instanced(scene, ring, new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide }), MAX_WAVES);
    this.waves.renderOrder = 2;
    const beamGeo = new PlaneGeometry(1, 1);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, 0.5);
    this.beams = instanced(scene, beamGeo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8 }), MAX_BEAMS);
    this.beams.renderOrder = 2;
    this.shots = instanced(scene, new SphereGeometry(0.22, 8, 6), new MeshBasicMaterial({ fog: false }), MAX_SHOTS);
  }

  clear(): void {
    this.markN = this.waveN = this.beamN = this.shotN = 0;
  }

  /** A circle that flashes a warning for `telegraph` seconds, then hurts once (duration 0) or for a while. */
  addMark(x: number, z: number, y: number, radius: number, damage: number, telegraph: number, duration = 0): void {
    if (this.markN >= MAX_MARKS) return;
    const o = this.markN++ * MARK;
    const m = this.mark;
    m[o] = x;
    m[o + 1] = z;
    m[o + 2] = radius;
    m[o + 3] = 0;
    m[o + 4] = telegraph;
    m[o + 5] = damage;
    m[o + 6] = duration;
    m[o + 7] = y;
  }

  addWave(x: number, z: number, radius: number, damage: number, speed: number): void {
    if (this.waveN >= MAX_WAVES) return;
    const o = this.waveN++ * WAVE;
    const w = this.wave;
    w[o] = x;
    w[o + 1] = z;
    w[o + 2] = radius;
    w[o + 3] = 0.5;
    w[o + 4] = damage;
    w[o + 5] = speed;
    w[o + 6] = 0;
  }

  addBeam(x: number, z: number, angle: number, length: number, damage: number, duration: number, speed: number, telegraph: number): void {
    if (this.beamN >= MAX_BEAMS) return;
    const o = this.beamN++ * BEAM;
    const b = this.beam;
    b[o] = angle;
    b[o + 1] = length;
    b[o + 2] = telegraph + duration;
    b[o + 3] = telegraph;
    b[o + 4] = damage;
    b[o + 5] = speed;
    b[o + 6] = x;
    b[o + 7] = z;
  }

  addShot(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, damage: number, color: number): void {
    if (this.shotN >= MAX_SHOTS) return;
    const o = this.shotN++ * SHOT;
    const s = this.shot;
    s[o] = x;
    s[o + 1] = y;
    s[o + 2] = z;
    s[o + 3] = vx;
    s[o + 4] = vy;
    s[o + 5] = vz;
    s[o + 6] = life;
    s[o + 7] = damage;
    s[o + 8] = color;
  }

  /** Moves everything and hurts Piotrek where it overlaps him. */
  update(dt: number, px: number, py: number, pz: number, pr: number, ev: HazardHit): void {
    let i = 0;
    while (i < this.markN) {
      const o = i * MARK;
      const m = this.mark;
      m[o + 3] += dt;
      // Dangerous once the warning has run out: a slam hits for its quarter second, a zone the whole time.
      if (m[o + 3] >= m[o + 4]) {
        const r = m[o + 2] + pr;
        if ((px - m[o]) ** 2 + (pz - m[o + 1]) ** 2 < r * r && Math.abs(py - m[o + 7]) < 3) ev.hurt(m[o + 5]);
      }
      if (m[o + 3] >= m[o + 4] + Math.max(m[o + 6], 0.25)) {
        const last = --this.markN;
        m.copyWithin(o, last * MARK, last * MARK + MARK);
        continue;
      }
      i++;
    }
    i = 0;
    while (i < this.waveN) {
      const o = i * WAVE;
      const w = this.wave;
      w[o + 3] += w[o + 5] * dt;
      const d = Math.hypot(px - w[o], pz - w[o + 1]);
      if (!w[o + 6] && Math.abs(d - w[o + 3]) < pr + 0.8) {
        w[o + 6] = 1;
        ev.hurt(w[o + 4]);
      }
      if (w[o + 3] >= w[o + 2]) {
        const last = --this.waveN;
        w.copyWithin(o, last * WAVE, last * WAVE + WAVE);
        continue;
      }
      i++;
    }
    i = 0;
    while (i < this.beamN) {
      const o = i * BEAM;
      const b = this.beam;
      b[o + 2] -= dt;
      const live = b[o + 3] <= 0;
      if (!live) b[o + 3] -= dt;
      else b[o] += b[o + 5] * dt;
      if (live) {
        const dx = px - b[o + 6];
        const dz = pz - b[o + 7];
        const along = dx * Math.sin(b[o]) + dz * Math.cos(b[o]);
        const across = dx * Math.cos(b[o]) - dz * Math.sin(b[o]);
        if (along > 0 && along < b[o + 1] && Math.abs(across) < 1.4 + pr) ev.hurt(b[o + 4] * dt * 3);
      }
      if (b[o + 2] <= 0) {
        const last = --this.beamN;
        b.copyWithin(o, last * BEAM, last * BEAM + BEAM);
        continue;
      }
      i++;
    }
    i = 0;
    while (i < this.shotN) {
      const o = i * SHOT;
      const s = this.shot;
      s[o] += s[o + 3] * dt;
      s[o + 1] += s[o + 4] * dt;
      s[o + 2] += s[o + 5] * dt;
      s[o + 6] -= dt;
      const r = pr + 0.3;
      const hit = (px - s[o]) ** 2 + (pz - s[o + 2]) ** 2 < r * r && Math.abs(py + 0.9 - s[o + 1]) < 1.3;
      if (hit) ev.hurt(s[o + 7]);
      if (hit || s[o + 6] <= 0) {
        const last = --this.shotN;
        s.copyWithin(o, last * SHOT, last * SHOT + SHOT);
        continue;
      }
      i++;
    }
  }

  /** True while anything dangerous is on the ground (the HUD dims the prompt then). */
  get busy(): boolean {
    return this.markN + this.waveN + this.beamN + this.shotN > 0;
  }

  render(time: number): void {
    for (let i = 0; i < this.markN; i++) {
      const o = i * MARK;
      const m = this.mark;
      const warning = m[o + 3] < m[o + 4];
      const t = warning ? m[o + 3] / Math.max(0.01, m[o + 4]) : 1;
      const r = m[o + 2] * (warning ? 0.25 + 0.75 * t : 1);
      m4.makeScale(r, 1, r).setPosition(m[o], m[o + 7] + 0.05, m[o + 1]);
      this.marks.setMatrixAt(i, m4);
      // Warning pulses red, the live zone burns orange.
      if (warning) col.setRGB(1, 0.12 + 0.25 * Math.abs(Math.sin(time * 14)), 0.1);
      else col.setRGB(1, 0.5, 0.12);
      this.marks.setColorAt(i, col);
    }
    this.marks.count = this.markN;
    this.marks.instanceMatrix.needsUpdate = true;
    if (this.marks.instanceColor) this.marks.instanceColor.needsUpdate = true;

    for (let i = 0; i < this.waveN; i++) {
      const o = i * WAVE;
      const w = this.wave;
      const r = w[o + 3];
      m4.makeScale(r, 1, r).setPosition(w[o], 0.12, w[o + 1]);
      this.waves.setMatrixAt(i, m4);
      const fade = 1 - w[o + 3] / w[o + 2];
      col.setRGB(Math.min(1, 1.2 * fade + 0.2), 0.45 * fade, 0.25 * fade);
      this.waves.setColorAt(i, col);
    }
    this.waves.count = this.waveN;
    this.waves.instanceMatrix.needsUpdate = true;
    if (this.waves.instanceColor) this.waves.instanceColor.needsUpdate = true;

    for (let i = 0; i < this.beamN; i++) {
      const o = i * BEAM;
      const b = this.beam;
      q.setFromAxisAngle(up, b[o]);
      m4.compose(v.set(b[o + 6], 0.08, b[o + 7]), q, s3.set(2.8, 1, b[o + 1]));
      this.beams.setMatrixAt(i, m4);
      if (b[o + 3] > 0) col.setRGB(1, 0.2, 0.16);
      else col.setRGB(1, 0.7, 0.2);
      this.beams.setColorAt(i, col);
    }
    this.beams.count = this.beamN;
    this.beams.instanceMatrix.needsUpdate = true;
    if (this.beams.instanceColor) this.beams.instanceColor.needsUpdate = true;

    for (let i = 0; i < this.shotN; i++) {
      const o = i * SHOT;
      const s = this.shot;
      const k = 1 + 0.15 * Math.sin(time * 20 + i);
      m4.makeScale(k, k, k).setPosition(s[o], s[o + 1], s[o + 2]);
      this.shots.setMatrixAt(i, m4);
      col.setHex(s[o + 8]);
      this.shots.setColorAt(i, col);
    }
    this.shots.count = this.shotN;
    this.shots.instanceMatrix.needsUpdate = true;
    if (this.shots.instanceColor) this.shots.instanceColor.needsUpdate = true;
  }
}
