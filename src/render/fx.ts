import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  Vector3,
  type Scene,
} from 'three';
import { toonRamp } from './toon';

const m4 = new Matrix4();
const q = new Quaternion();
const q2 = new Quaternion();
const xAxis = new Vector3(1, 0, 0);
const v = new Vector3();
const s3 = new Vector3();
const up = new Vector3(0, 1, 0);
const col = new Color();

/** Chunky cube particles: hit sparks, death debris, dust. Fixed pool, zero allocations per frame. */
export class Particles {
  private readonly n: number;
  private readonly p: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly spin: Float32Array;
  private readonly gravity: Float32Array;
  private readonly rgb: Float32Array;
  private count = 0;
  readonly mesh: InstancedMesh;

  constructor(scene: Scene, max = 1600) {
    this.n = max;
    this.p = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.rgb = new Float32Array(max * 3);
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshToonMaterial({ gradientMap: toonRamp() }), max);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: Color, gravity = 18): void {
    if (this.count >= this.n) return;
    const i = this.count++;
    this.p[i * 3] = x;
    this.p[i * 3 + 1] = y;
    this.p[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.spin[i] = (Math.random() - 0.5) * 14;
    this.gravity[i] = gravity;
    this.rgb[i * 3] = color.r;
    this.rgb[i * 3 + 1] = color.g;
    this.rgb[i * 3 + 2] = color.b;
  }

  /** A burst of debris in random directions. */
  burst(x: number, y: number, z: number, count: number, speed: number, size: number, color: Color, up = 4, life = 0.7): void {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.7), color);
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      this.life[i] = (this.life[i] ?? 0) - dt;
      if ((this.life[i] ?? 0) <= 0) {
        this.kill(i);
        continue;
      }
      const o = i * 3;
      this.vel[o + 1] = (this.vel[o + 1] ?? 0) - (this.gravity[i] ?? 0) * dt;
      this.p[o] = (this.p[o] ?? 0) + (this.vel[o] ?? 0) * dt;
      this.p[o + 1] = (this.p[o + 1] ?? 0) + (this.vel[o + 1] ?? 0) * dt;
      this.p[o + 2] = (this.p[o + 2] ?? 0) + (this.vel[o + 2] ?? 0) * dt;
      if ((this.p[o + 1] ?? 0) < 0.05 && (this.vel[o + 1] ?? 0) < 0) {
        this.p[o + 1] = 0.05;
        this.vel[o + 1] = -(this.vel[o + 1] ?? 0) * 0.35;
        this.vel[o] = (this.vel[o] ?? 0) * 0.6;
        this.vel[o + 2] = (this.vel[o + 2] ?? 0) * 0.6;
      }
      i++;
    }
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const arr of [this.p, this.vel, this.rgb]) {
      arr[i * 3] = arr[last * 3] ?? 0;
      arr[i * 3 + 1] = arr[last * 3 + 1] ?? 0;
      arr[i * 3 + 2] = arr[last * 3 + 2] ?? 0;
    }
    for (const arr of [this.life, this.maxLife, this.size, this.spin, this.gravity]) arr[i] = arr[last] ?? 0;
  }

  render(time: number): void {
    const colors = this.mesh.instanceColor;
    for (let i = 0; i < this.count; i++) {
      const t = (this.life[i] ?? 0) / (this.maxLife[i] ?? 1);
      const s = (this.size[i] ?? 0) * Math.min(1, t * 3);
      q.setFromAxisAngle(v.set(0.4, 1, 0.2).normalize(), (this.spin[i] ?? 0) * time);
      m4.compose(v.set(this.p[i * 3] ?? 0, this.p[i * 3 + 1] ?? 0, this.p[i * 3 + 2] ?? 0), q, s3.set(s, s, s));
      this.mesh.setMatrixAt(i, m4);
      colors?.setXYZ(i, this.rgb[i * 3] ?? 0, this.rgb[i * 3 + 1] ?? 0, this.rgb[i * 3 + 2] ?? 0);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colors) colors.needsUpdate = true;
  }

  get active(): number {
    return this.count;
  }
}

/** Floating damage numbers: instanced, camera-facing digit quads from a glyph atlas. */
export class DamageNumbers {
  private readonly max = 160;
  private readonly digits = 5;
  private readonly x = new Float32Array(this.max);
  private readonly y = new Float32Array(this.max);
  private readonly z = new Float32Array(this.max);
  private readonly value = new Int32Array(this.max);
  private readonly age = new Float32Array(this.max);
  private readonly kind = new Uint8Array(this.max);
  private readonly drift = new Float32Array(this.max);
  private count = 0;
  private readonly pos: InstancedBufferAttribute;
  private readonly data: InstancedBufferAttribute;
  private readonly tint: InstancedBufferAttribute;
  readonly mesh: Mesh;

  constructor(
    scene: Scene,
    private readonly life: number,
  ) {
    const n = this.max * this.digits;
    const geo = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1.3);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    this.pos = new InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(DynamicDrawUsage);
    this.data = new InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage);
    this.tint = new InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage);
    geo.setAttribute('iPos', this.pos);
    geo.setAttribute('iData', this.data);
    geo.setAttribute('iTint', this.tint);
    geo.instanceCount = 0;
    const mat = new ShaderMaterial({
      uniforms: { atlas: { value: glyphAtlas() } },
      vertexShader: /* glsl */ `
        attribute vec3 iPos;
        attribute vec4 iData; // glyph, x offset, scale, unused
        attribute vec4 iTint;
        varying vec2 vUv;
        varying vec4 vTint;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          mv.xy += (position.xy + vec2(iData.y, 0.0)) * iData.z;
          gl_Position = projectionMatrix * mv;
          vUv = vec2((iData.x + uv.x) / 11.0, uv.y);
          vTint = iTint;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D atlas;
        varying vec2 vUv;
        varying vec4 vTint;
        void main() {
          vec4 g = texture2D(atlas, vUv);
          // Red channel: glyph fill, green: dark outline.
          vec3 c = mix(vec3(0.07, 0.05, 0.08), vTint.rgb, g.r);
          float a = max(g.r, g.g) * vTint.a;
          if (a < 0.02) discard;
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  /** kind: 0 normal, 1 crit, 2 damage to the player. */
  spawn(x: number, y: number, z: number, value: number, kind: number): void {
    let i = this.count;
    if (i >= this.max) {
      // Recycle the oldest.
      let oldest = 0;
      for (let k = 1; k < this.max; k++) if ((this.age[k] ?? 0) > (this.age[oldest] ?? 0)) oldest = k;
      i = oldest;
    } else this.count++;
    // Spread numbers out so a row of hits stays readable.
    this.x[i] = x + (Math.random() - 0.5) * 0.9;
    this.y[i] = y + Math.random() * 0.7;
    this.z[i] = z + (Math.random() - 0.5) * 0.9;
    this.value[i] = Math.max(1, Math.round(value));
    this.age[i] = 0;
    this.kind[i] = kind;
    this.drift[i] = (Math.random() - 0.5) * 0.8;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      this.age[i] = (this.age[i] ?? 0) + dt;
      if ((this.age[i] ?? 0) >= this.life) {
        const last = --this.count;
        for (const arr of [this.x, this.y, this.z, this.age, this.drift]) arr[i] = arr[last] ?? 0;
        this.value[i] = this.value[last] ?? 0;
        this.kind[i] = this.kind[last] ?? 0;
        continue;
      }
      i++;
    }
  }

  render(): void {
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const t = (this.age[i] ?? 0) / this.life;
      const kind = this.kind[i] ?? 0;
      const pop = t < 0.15 ? 1 + (1 - t / 0.15) * 0.6 : 1;
      const scale = (kind === 1 ? 0.6 : kind === 2 ? 0.5 : 0.34) * pop;
      const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const rise = 1.1 * Math.sqrt(t);
      const str = String(this.value[i]);
      const len = Math.min(this.digits, str.length);
      if (kind === 1) col.set('#ffd23a');
      else if (kind === 2) col.set('#ff5a4a');
      else col.set('#ffffff');
      for (let d = 0; d < len; d++) {
        const glyph = str.charCodeAt(d) - 48;
        this.pos.setXYZ(n, (this.x[i] ?? 0) + (this.drift[i] ?? 0) * t, (this.y[i] ?? 0) + rise, this.z[i] ?? 0);
        this.data.setXYZW(n, glyph, d * 0.62 - (len - 1) * 0.31, scale, 0);
        this.tint.setXYZW(n, col.r, col.g, col.b, alpha);
        n++;
      }
    }
    (this.mesh.geometry as InstancedBufferGeometry).instanceCount = n;
    this.pos.needsUpdate = true;
    this.data.needsUpdate = true;
    this.tint.needsUpdate = true;
  }
}

function glyphAtlas(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 11 * 64;
  c.height = 84;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  g.font = '800 72px "Barlow Condensed", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  for (let i = 0; i < 11; i++) {
    const ch = i < 10 ? String(i) : '!';
    // Outline in green, fill in red: the shader tints them separately.
    g.strokeStyle = '#00ff00';
    g.lineWidth = 12;
    g.strokeText(ch, i * 64 + 32, 44);
    g.fillStyle = '#ff0000';
    g.fillText(ch, i * 64 + 32, 44);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Soft round shadows under characters (cheaper and more readable than shadow maps for a crowd). */
export class BlobShadows {
  readonly mesh: InstancedMesh;
  private n = 0;

  constructor(scene: Scene, max: number) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 4, 32, 32, 31);
      grad.addColorStop(0, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    const tex = new CanvasTexture(c);
    const geo = new PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new InstancedMesh(geo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), max);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  begin(): void {
    this.n = 0;
  }

  add(x: number, groundY: number, z: number, radius: number, height: number): void {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    const fade = Math.max(0.35, 1 - height * 0.18);
    const s = radius * 2.4 * fade;
    m4.makeScale(s, 1, s).setPosition(x, groundY + 0.03, z);
    this.mesh.setMatrixAt(this.n++, m4);
  }

  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** The arc left by a melee swing: a ring sector that flashes and fades. */
export class Swooshes {
  private readonly pool: { mesh: Mesh; age: number; life: number; radius: number }[] = [];
  /** Ring sectors cached per arc (arcs only change on level-up), so a swing allocates nothing. */
  private readonly sectors = new Map<number, RingGeometry>();

  constructor(private readonly scene: Scene) {}

  spawn(x: number, y: number, z: number, angle: number, arc: number, radius: number, color: string): void {
    let slot = this.pool.find((p) => p.age >= p.life);
    if (!slot) {
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
      slot = { mesh: new Mesh(new RingGeometry(0.4, 1, 4, 1, 0, 1), mat), age: 0, life: 0.17, radius: 1 };
      this.scene.add(slot.mesh);
      this.pool.push(slot);
    }
    const mesh = slot.mesh;
    const key = Math.round(arc * 100);
    let sector = this.sectors.get(key);
    if (!sector) {
      sector = new RingGeometry(0.35, 1, 24, 1, -arc / 2, arc);
      sector.rotateX(-Math.PI / 2);
      this.sectors.set(key, sector);
    }
    mesh.geometry = sector;
    mesh.position.set(x, y, z);
    mesh.rotation.set(0, -angle, 0);
    slot.radius = radius;
    (mesh.material as MeshBasicMaterial).color.set(color);
    mesh.visible = true;
    slot.age = 0;
  }

  update(dt: number): void {
    for (const s of this.pool) {
      if (s.age >= s.life) continue;
      s.age += dt;
      const t = Math.min(1, s.age / s.life);
      (s.mesh.material as MeshBasicMaterial).opacity = 0.42 * (1 - t) * (1 - t);
      const k = s.radius * (0.85 + 0.25 * t);
      s.mesh.scale.set(k, 1, k);
      s.mesh.position.y += dt * 0.6;
      if (t >= 1) s.mesh.visible = false;
    }
  }
}

/** Reusable helper: set one instance's transform from position, yaw and non-uniform scale. */
export function placeInstance(mesh: InstancedMesh, i: number, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number, tilt = 0): void {
  q.setFromAxisAngle(up, yaw);
  if (tilt) q.multiply(q2.setFromAxisAngle(xAxis, tilt));
  m4.compose(v.set(x, y, z), q, s3.set(sx, sy, sz));
  mesh.setMatrixAt(i, m4);
}

