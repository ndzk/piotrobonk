import * as THREE from 'three';
import { Rng } from './core/rng';

// Title backdrop: dusk over line 17 with the rails stolen in places.
// The track repeats every PERIOD metres so the endless camera dolly wraps seamlessly.
const PERIOD = 84;
const SLEEPER_STEP = 0.7;
const RAIL_LEN = 12;
const POLE_STEP = 28;
const VIEW_AHEAD = 170;
const SPEED = 1.4;

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#141a45');
  grad.addColorStop(0.35, '#4b3a78');
  grad.addColorStop(0.55, '#c86a63');
  grad.addColorStop(0.62, '#f19a5c');
  grad.addColorStop(1, '#3a2c3c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function flat(color: THREE.ColorRepresentation): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export class TitleScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, VIEW_AHEAD + 20);
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private t = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    const scene = this.scene;
    scene.background = skyTexture();
    scene.fog = new THREE.Fog('#d9805f', 25, VIEW_AHEAD - 10);
    scene.add(new THREE.HemisphereLight('#ffd2b0', '#2b2342', 1.6));
    const sun = new THREE.DirectionalLight('#ffb27a', 2.6);
    sun.position.set(-30, 18, 25);
    scene.add(sun);
    const length = PERIOD + VIEW_AHEAD + 20;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, length + 40), flat('#4a3d4a'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -length / 2;
    scene.add(ground);
    const ballast = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, length + 20), flat('#6f6570'));
    ballast.position.set(0, 0.17, -length / 2);
    scene.add(ballast);

    // One random pattern per period, reused for every repetition.
    const rng = new Rng(17);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const railsPerPeriod = PERIOD / RAIL_LEN;
    const stolen = Array.from({ length: railsPerPeriod * 2 }, (_, i) => i > 1 && rng.next() < 0.45);
    const sleepersPerPeriod = Math.round(PERIOD / SLEEPER_STEP);
    const jitter = Array.from({ length: sleepersPerPeriod }, () => ({ yaw: rng.range(-1, 1), shift: rng.range(-1, 1), keep: rng.next() }));

    const sleepers: THREE.Matrix4[] = [];
    for (let i = 0; i * SLEEPER_STEP < length; i++) {
      const z = 8 - i * SLEEPER_STEP;
      const j = jitter[i % sleepersPerPeriod];
      const railIndex = Math.floor((8 - z) / RAIL_LEN) % railsPerPeriod;
      const bare = stolen[railIndex * 2] && stolen[railIndex * 2 + 1];
      if (bare && j.keep < 0.25) continue;
      e.set(0, j.yaw * (bare ? 0.5 : 0.02), bare ? j.shift * 0.12 : 0);
      p.set(bare ? j.shift * 0.4 : 0, 0.42, z);
      sleepers.push(m.compose(p, q.setFromEuler(e), s).clone());
    }
    scene.add(instanced(new THREE.BoxGeometry(2.6, 0.14, 0.26), flat('#5b3e2c'), sleepers));
    const rails: THREE.Matrix4[] = [];
    for (let i = 0; i * RAIL_LEN < length; i++) {
      for (const side of [0, 1]) {
        if (stolen[(i % railsPerPeriod) * 2 + side]) continue;
        p.set(side === 0 ? -0.72 : 0.72, 0.57, 8 - (i + 0.5) * RAIL_LEN);
        rails.push(m.compose(p, q.identity(), s).clone());
      }
    }
    const railMat = new THREE.MeshLambertMaterial({ color: '#c9c2bb', emissive: '#3a2a22', flatShading: true });
    scene.add(instanced(new THREE.BoxGeometry(0.12, 0.16, RAIL_LEN - 0.04), railMat, rails));
    const poles: THREE.Matrix4[] = [];
    const arms: THREE.Matrix4[] = [];
    for (let i = 0; i * POLE_STEP < length; i++) {
      const z = 4 - i * POLE_STEP;
      poles.push(m.compose(p.set(3.2, 3.6, z), q.identity(), s).clone());
      arms.push(m.compose(p.set(1.6, 6.9, z), q.identity(), s).clone());
    }
    const poleMat = flat('#2c2633');
    scene.add(instanced(new THREE.BoxGeometry(0.28, 7.2, 0.28), poleMat, poles));
    scene.add(instanced(new THREE.BoxGeometry(3.4, 0.16, 0.16), poleMat, arms));
    const wire = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, length), poleMat);
    wire.position.set(0, 6.6, -length / 2);
    scene.add(wire);
    const blocks: THREE.Matrix4[] = [];
    const shapes = Array.from({ length: 18 }, () => ({ x: (rng.next() < 0.5 ? -1 : 1) * rng.range(16, 70), z: rng.range(0, PERIOD), w: rng.range(3, 14), h: rng.range(2.5, 16), d: rng.range(3, 10) }));
    for (let rep = 0; rep * PERIOD < length; rep++) {
      for (const b of shapes) blocks.push(m.compose(p.set(b.x, b.h / 2, 8 - rep * PERIOD - b.z), q.identity(), new THREE.Vector3(b.w, b.h, b.d)).clone());
    }
    scene.add(instanced(new THREE.BoxGeometry(1, 1, 1), flat('#4a3a5c'), blocks));
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame(dt: number): void {
    this.t += dt;
    const t = this.still ? 6 : this.t;
    const z = -((t * SPEED) % PERIOD);
    this.camera.position.set(0.25 * Math.sin(t * 0.21), 1.75 + 0.04 * Math.sin(t * 1.9), z);
    this.camera.lookAt(0.6 * Math.sin(t * 0.13), 1.25, z - 20);
    this.renderer.render(this.scene, this.camera);
  }
}
