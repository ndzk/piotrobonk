import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENEMIES, type EnemyId } from '../content/enemies';

const ENEMY_IDS = new Set<string>(ENEMIES.map((e) => e.id));

// Low-poly enemy models built from primitives with baked vertex colours. Each faces +z, feet at y = 0.

function part(g: BufferGeometry, color: string, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  geo.applyMatrix4(new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...scale)));
  const c = new Color(color);
  const n = geo.getAttribute('position').count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

// Low segment counts: hundreds of these are drawn at once (plus their outlines).
const ball = (r: number, detail = 1): SphereGeometry => new SphereGeometry(r, detail > 1 ? 8 : 7, detail > 1 ? 6 : 5);
const dot = (r: number): SphereGeometry => new SphereGeometry(r, 4, 3);

export interface EnemyModel {
  body: BufferGeometry;
  /** Optional separately animated part (pigeon wings), mirrored for both sides. */
  wing?: BufferGeometry;
  wingOffset?: [number, number, number];
}

/** Model for an enemy id, or for a boss id (bosses are enemy types built per arena). */
export function enemyModel(id: string): EnemyModel {
  const boss = bossModel(id);
  if (boss) return boss;
  // A boss without a model would otherwise crash the arena it guards: draw a crate instead.
  if (!ENEMY_IDS.has(id)) return { body: part(new BoxGeometry(1.6, 2.4, 1.6), '#8a5a3b', [0, 1.2, 0]) };
  switch (id as EnemyId) {
    case 'golab': {
      const body = mergeGeometries([
        part(ball(0.2, 2), '#8f96a3', [0, 0.3, 0], [0.9, 0.8, 1.45]),
        part(ball(0.13), '#6fb39a', [0, 0.44, 0.16], [1, 1, 0.9]),
        part(ball(0.1), '#7a5f8e', [0, 0.47, 0.19], [1.05, 0.7, 0.8]),
        part(ball(0.11), '#5d6573', [0, 0.57, 0.23]),
        part(new ConeGeometry(0.028, 0.09, 6), '#2e2e33', [0, 0.555, 0.35], [1, 1, 1], [Math.PI / 2, 0, 0]),
        part(dot(0.022), '#f2f0ea', [0, 0.585, 0.32]),
        part(dot(0.024), '#e6893b', [0.072, 0.59, 0.28]),
        part(dot(0.024), '#e6893b', [-0.072, 0.59, 0.28]),
        part(dot(0.011), '#151515', [0.088, 0.592, 0.29]),
        part(dot(0.011), '#151515', [-0.088, 0.592, 0.29]),
        part(new BoxGeometry(0.18, 0.035, 0.22), '#4b5260', [0, 0.32, -0.32], [1, 1, 1], [-0.25, 0, 0]),
        part(new BoxGeometry(0.03, 0.14, 0.03), '#d07a7a', [0.06, 0.07, 0.02]),
        part(new BoxGeometry(0.03, 0.14, 0.03), '#d07a7a', [-0.06, 0.07, 0.02]),
        part(new BoxGeometry(0.06, 0.015, 0.08), '#d07a7a', [0.06, 0.008, 0.05]),
        part(new BoxGeometry(0.06, 0.015, 0.08), '#d07a7a', [-0.06, 0.008, 0.05]),
      ]);
      // Wing pivots at its root (x = 0) so it can flap; extends to +x.
      const wing = mergeGeometries([
        part(ball(0.2), '#7d8491', [0.16, 0, -0.02], [0.95, 0.18, 1.2]),
        part(new BoxGeometry(0.22, 0.02, 0.05), '#2f333b', [0.18, 0.02, -0.1]),
        part(new BoxGeometry(0.22, 0.02, 0.05), '#2f333b', [0.18, 0.02, -0.2]),
      ]);
      // Smaller than the other enemies: they come in flocks.
      body.scale(0.75, 0.75, 0.75);
      wing.scale(0.75, 0.75, 0.75);
      return { body, wing, wingOffset: [0.085, 0.285, 0] };
    }
    case 'szczur': {
      const tail: BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        tail.push(part(new CylinderGeometry(0.022 * (1 - t * 0.6), 0.022 * (1 - (t + 0.17) * 0.6), 0.1, 5), '#d99a9a', [Math.sin(t * 4) * 0.05, 0.16 - t * 0.12, -0.32 - t * 0.09], [1, 1, 1], [Math.PI / 2 - 0.3, 0, 0]));
      }
      const body = mergeGeometries([
        part(ball(0.2), '#4f525c', [0, 0.21, 0], [1, 0.8, 1.6]),
        part(ball(0.15), '#43464f', [0, 0.27, -0.08], [1, 0.8, 1.2]),
        part(new ConeGeometry(0.13, 0.28, 8), '#4f525c', [0, 0.23, 0.36], [1, 0.85, 1], [Math.PI / 2, 0, 0]),
        part(dot(0.035), '#e8a3a3', [0, 0.23, 0.5]),
        part(ball(0.065), '#e8a3a3', [0.08, 0.35, 0.25], [1, 1, 0.4]),
        part(ball(0.065), '#e8a3a3', [-0.08, 0.35, 0.25], [1, 1, 0.4]),
        part(dot(0.024), '#120d0b', [0.06, 0.29, 0.37]),
        part(dot(0.024), '#120d0b', [-0.06, 0.29, 0.37]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [0.1, 0.04, 0.16]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [-0.1, 0.04, 0.16]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [0.1, 0.04, -0.16]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [-0.1, 0.04, -0.16]),
        ...tail,
      ]);
      return { body };
    }
    case 'zlomiarz': {
      const cart: BufferGeometry[] = [];
      // Shopping cart in front: wire basket made of thin bars, four wheels.
      for (let k = 0; k <= 4; k++) cart.push(part(new BoxGeometry(0.02, 0.4, 0.02), '#c9cdd2', [-0.3 + k * 0.15, 0.62, 0.95]));
      for (let k = 0; k <= 4; k++) cart.push(part(new BoxGeometry(0.02, 0.4, 0.02), '#c9cdd2', [-0.3 + k * 0.15, 0.62, 0.45]));
      for (const z of [0.45, 0.95]) cart.push(part(new BoxGeometry(0.64, 0.02, 0.02), '#c9cdd2', [0, 0.82, z]), part(new BoxGeometry(0.64, 0.02, 0.02), '#c9cdd2', [0, 0.43, z]));
      for (const x of [-0.31, 0.31]) cart.push(part(new BoxGeometry(0.02, 0.02, 0.52), '#c9cdd2', [x, 0.82, 0.7]), part(new BoxGeometry(0.02, 0.02, 0.52), '#c9cdd2', [x, 0.43, 0.7]));
      cart.push(part(new BoxGeometry(0.6, 0.02, 0.48), '#9aa0a8', [0, 0.43, 0.7]));
      for (const [x, z] of [[-0.27, 0.48], [0.27, 0.48], [-0.27, 0.92], [0.27, 0.92]] as const) cart.push(part(new CylinderGeometry(0.06, 0.06, 0.04, 8), '#222', [x, 0.07, z], [1, 1, 1], [0, 0, Math.PI / 2]));
      for (const [x, z] of [[-0.25, 0.48], [0.25, 0.48], [-0.25, 0.92], [0.25, 0.92]] as const) cart.push(part(new BoxGeometry(0.02, 0.36, 0.02), '#9aa0a8', [x, 0.25, z]));
      // Bottles and scrap sticking out of the basket.
      cart.push(part(new CylinderGeometry(0.035, 0.04, 0.26, 6), '#3d8a4a', [-0.12, 0.84, 0.7]), part(new CylinderGeometry(0.035, 0.04, 0.26, 6), '#8a5a2b', [0.08, 0.86, 0.62]), part(new BoxGeometry(0.5, 0.04, 0.06), '#a9a39d', [0, 0.9, 0.82], [1, 1, 1], [0, 0.4, 0.3]));
      const body = mergeGeometries([
        part(new BoxGeometry(0.17, 0.55, 0.19), '#3b3f45', [0.12, 0.28, -0.05]),
        part(new BoxGeometry(0.17, 0.55, 0.19), '#3b3f45', [-0.12, 0.28, -0.05]),
        part(new BoxGeometry(0.2, 0.09, 0.28), '#2a2522', [0.12, 0.045, -0.01]),
        part(new BoxGeometry(0.2, 0.09, 0.28), '#2a2522', [-0.12, 0.045, -0.01]),
        part(new BoxGeometry(0.52, 0.58, 0.34), '#5f6e3f', [0, 0.84, -0.05], [1, 1, 1], [0.25, 0, 0]),
        part(new BoxGeometry(0.14, 0.48, 0.15), '#5f6e3f', [0.3, 0.86, 0.18], [1, 1, 1], [1.1, 0, 0]),
        part(new BoxGeometry(0.14, 0.48, 0.15), '#5f6e3f', [-0.3, 0.86, 0.18], [1, 1, 1], [1.1, 0, 0]),
        part(ball(0.17), '#d9a68e', [0, 1.28, 0.1]),
        part(ball(0.18), '#2f3a52', [0, 1.37, 0.08], [1, 0.45, 1.05]),
        part(new BoxGeometry(0.2, 0.03, 0.12), '#2f3a52', [0, 1.35, 0.24]),
        part(dot(0.022), '#1b1412', [0.06, 1.3, 0.26]),
        part(dot(0.022), '#1b1412', [-0.06, 1.3, 0.26]),
        part(ball(0.09), '#8a6a5a', [0, 1.2, 0.22], [1, 0.6, 0.6]),
        part(new BoxGeometry(0.66, 0.03, 0.03), '#c9cdd2', [0, 0.95, 0.42]),
        ...cart,
      ]);
      return { body };
    }
    case 'autobus': {
      const body = mergeGeometries([
        part(new BoxGeometry(2.5, 1.2, 7), '#ffd23a', [0, 0.95, 0]),
        part(new BoxGeometry(2.5, 1.1, 7), '#f2f2f2', [0, 2.1, 0]),
        part(new BoxGeometry(2.52, 0.7, 6.2), '#2a3448', [0, 2.15, -0.2]),
        part(new BoxGeometry(2.3, 0.75, 0.05), '#2a3448', [0, 2.1, 3.51]),
        part(new BoxGeometry(1.4, 0.28, 0.06), '#ff8a1e', [0, 2.62, 3.52]),
        part(new BoxGeometry(2.5, 0.08, 7), '#e2362c', [0, 1.6, 0]),
        part(new BoxGeometry(2.6, 0.1, 7.1), '#cfcfcf', [0, 2.7, 0]),
        part(new BoxGeometry(0.4, 0.2, 0.05), '#fff6c8', [0.85, 0.75, 3.51]),
        part(new BoxGeometry(0.4, 0.2, 0.05), '#fff6c8', [-0.85, 0.75, 3.51]),
        part(new BoxGeometry(2.4, 0.25, 0.1), '#3a3a3a', [0, 0.4, 3.5]),
        ...[-2.4, 2.4].flatMap((z) => [-1.25, 1.25].map((x) => part(new CylinderGeometry(0.5, 0.5, 0.3, 10), '#1c1c1c', [x, 0.5, z], [1, 1, 1], [0, 0, Math.PI / 2]))),
      ]);
      return { body };
    }
    case 'robotnik': {
      const body = mergeGeometries([
        part(new BoxGeometry(0.17, 0.55, 0.19), '#2f3a52', [0.12, 0.28, 0]),
        part(new BoxGeometry(0.17, 0.55, 0.19), '#2f3a52', [-0.12, 0.28, 0]),
        part(new BoxGeometry(0.2, 0.09, 0.28), '#2a2522', [0.12, 0.045, 0.04]),
        part(new BoxGeometry(0.2, 0.09, 0.28), '#2a2522', [-0.12, 0.045, 0.04]),
        part(new BoxGeometry(0.54, 0.58, 0.34), '#ff8a1e', [0, 0.84, 0]),
        part(new BoxGeometry(0.56, 0.06, 0.36), '#d9dde3', [0, 0.72, 0]),
        part(new BoxGeometry(0.56, 0.06, 0.36), '#d9dde3', [0, 0.92, 0]),
        part(new BoxGeometry(0.15, 0.5, 0.16), '#2f3a52', [0.36, 0.86, 0.04], [1, 1, 1], [0.3, 0, 0.12]),
        part(new BoxGeometry(0.15, 0.5, 0.16), '#2f3a52', [-0.36, 0.86, 0.04], [1, 1, 1], [0.3, 0, -0.12]),
        part(ball(0.18), '#e9b99e', [0, 1.3, 0.02]),
        part(ball(0.2), '#ffd23a', [0, 1.38, 0.02], [1, 0.55, 1.08]),
        part(new BoxGeometry(0.44, 0.03, 0.46), '#ffd23a', [0, 1.36, 0.05]),
        part(dot(0.025), '#1b1412', [0.065, 1.32, 0.18]),
        part(dot(0.025), '#1b1412', [-0.065, 1.32, 0.18]),
        part(new BoxGeometry(0.16, 0.04, 0.03), '#3a2620', [0, 1.21, 0.18]),
        part(new BoxGeometry(0.045, 1.0, 0.045), '#8a6a4a', [0.42, 0.95, 0.3], [1, 1, 1], [0.5, 0, 0.1]),
        part(new BoxGeometry(0.22, 0.27, 0.035), '#9aa1aa', [0.47, 0.48, 0.55], [1, 1, 1], [0.5, 0, 0.1]),
      ]);
      return { body };
    }
  }
}

/** Boss bodies. They are built the same way, only bigger and with more character. */
function bossModel(id: string): EnemyModel | null {
  // A tapered cylinder from a to b: Euler (0, yaw, roll) sends +y to (−sin roll·cos yaw, cos roll, sin roll·sin yaw),
  // so any limb, rail or horn can be given as two points instead of hand-solved rotations.
  const bone = (a: [number, number, number], b: [number, number, number], r: number, color: string): BufferGeometry => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 0.001;
    return part(new CylinderGeometry(r, r * 0.8, len, 5), color, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [1, 1, 1], [0, Math.atan2(dz, -dx), Math.acos(dy / len)]);
  };
  switch (id) {
    case 'biletomat': {
      // A ticket machine on stubby legs: blue cabinet, yellow bands, a screen that shows the refusal.
      const body = mergeGeometries([
        part(new BoxGeometry(0.5, 0.9, 0.45), '#2a2f3d', [0.6, 0.45, 0]),
        part(new BoxGeometry(0.5, 0.9, 0.45), '#2a2f3d', [-0.6, 0.45, 0]),
        part(new BoxGeometry(0.7, 0.2, 0.9), '#15181f', [0.6, 0.1, 0.12]),
        part(new BoxGeometry(0.7, 0.2, 0.9), '#15181f', [-0.6, 0.1, 0.12]),
        part(new BoxGeometry(2.2, 2.9, 1.5), '#1d4f9c', [0, 2.3, 0]),
        part(new BoxGeometry(2.26, 0.26, 1.56), '#ffd23a', [0, 1.1, 0]),
        part(new BoxGeometry(2.26, 0.26, 1.56), '#ffd23a', [0, 3.3, 0]),
        part(new BoxGeometry(2.3, 0.5, 1.6), '#16407f', [0, 3.85, 0]),
        // Screen with a dark face and two angry pixels.
        part(new BoxGeometry(1.5, 1.1, 0.08), '#0d1a2c', [0, 2.75, 0.78]),
        part(new BoxGeometry(0.3, 0.16, 0.05), '#ff4a3a', [-0.34, 2.9, 0.83], [1, 1, 1], [0, 0, 0.35]),
        part(new BoxGeometry(0.3, 0.16, 0.05), '#ff4a3a', [0.34, 2.9, 0.83], [1, 1, 1], [0, 0, -0.35]),
        part(new BoxGeometry(0.8, 0.1, 0.05), '#ff4a3a', [0, 2.45, 0.83]),
        // Coin slot, card reader and the tray that never returns change.
        part(new BoxGeometry(0.5, 0.1, 0.06), '#d8dde6', [0.55, 1.75, 0.78]),
        part(new BoxGeometry(0.22, 0.4, 0.1), '#d8dde6', [-0.6, 1.8, 0.78]),
        part(new BoxGeometry(1.1, 0.3, 0.3), '#15181f', [0, 1.35, 0.72]),
        part(new BoxGeometry(0.9, 0.5, 0.06), '#d8dde6', [0, 0.95, 0.74], [1, 1, 1], [-0.5, 0, 0]),
        // Buttons down the side.
        ...[0, 1, 2, 3].map((k) => part(new BoxGeometry(0.22, 0.22, 0.08), k % 2 ? '#ffd23a' : '#d8dde6', [0.78, 2.05 + k * 0.3, 0.78])),
      ]);
      return { body };
    }
    case 'pajeczyca': {
      // Mill spider: fat abdomen with two thread spools on its back, eight legs arched to the floor.
      const legs: BufferGeometry[] = [];
      for (const s of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const z0 = 0.9 - k * 0.7;
          const out = k < 2 ? 1 : -1;
          const hip: [number, number, number] = [s * 0.55, 1.8, z0];
          const knee: [number, number, number] = [s * 1.45, 2.8 - k * 0.12, z0 + out * 0.45];
          const foot: [number, number, number] = [s * 2.25, 0, z0 + out * 1.15];
          legs.push(bone(hip, knee, 0.18, '#4a3a58'), bone(knee, foot, 0.13, '#2d2136'));
          legs.push(part(ball(0.2), '#4a3a58', knee));
        }
      }
      const body = mergeGeometries([
        part(ball(1.1, 2), '#3c2c46', [0, 1.95, -1.35], [1, 0.95, 1.25]),
        part(new ConeGeometry(0.22, 0.5, 6), '#e8e2d2', [0, 1.6, -2.65], [1, 1, 1], [-Math.PI / 2, 0, 0]),
        part(ball(0.45), '#5d4a6b', [0, 2.5, -1.35], [1.4, 0.4, 1.8]),
        // Two spools of thread wedged into its back.
        ...[-0.5, 0.5].map((x) => part(new CylinderGeometry(0.32, 0.32, 0.5, 8), '#e8e2d2', [x, 2.85, -1.4], [1, 1, 1], [0, 0, Math.PI / 2])),
        ...[-0.78, -0.22, 0.22, 0.78].map((x) => part(new CylinderGeometry(0.36, 0.36, 0.06, 8), '#b7ad99', [x, 2.85, -1.4], [1, 1, 1], [0, 0, Math.PI / 2])),
        part(ball(0.85, 2), '#5d4a6b', [0, 1.8, 0.2], [1.15, 0.9, 1.1]),
        part(ball(0.55, 2), '#5d4a6b', [0, 1.62, 1], [1.05, 0.95, 1]),
        // Four yellow eyes with black pupils, two fangs under them.
        ...[-0.42, -0.15, 0.15, 0.42].map((x, k) => part(dot(k === 1 || k === 2 ? 0.16 : 0.12), '#d8c33f', [x, 1.78 - Math.abs(x) * 0.18, 1.38 - Math.abs(x) * 0.3])),
        ...[-0.42, -0.15, 0.15, 0.42].map((x, k) => part(dot(k === 1 || k === 2 ? 0.07 : 0.055), '#120d14', [x * 1.08, 1.78 - Math.abs(x) * 0.18, 1.48 - Math.abs(x) * 0.3])),
        ...[-0.24, 0.24].map((x) => part(new ConeGeometry(0.14, 0.6, 6), '#2d2136', [x, 1.15, 1.15], [1, 1, 1], [2.75, 0, 0])),
        ...[-0.45, 0.45].map((x) => bone([x, 1.55, 0.95], [x * 1.5, 1.1, 1.75], 0.11, '#4a3a58')),
        ...legs,
      ]);
      return { body };
    }
    case 'kanar': {
      // Ticket inspector: dark uniform, reflective band, cap, shades, one hand already out for the ticket.
      const body = mergeGeometries([
        ...[-0.3, 0.3].map((x) => part(new BoxGeometry(0.42, 1.6, 0.46), '#232b38', [x, 0.8, 0])),
        ...[-0.3, 0.3].map((x) => part(new BoxGeometry(0.5, 0.26, 0.74), '#15181f', [x, 0.13, 0.14])),
        part(new BoxGeometry(1.2, 0.5, 0.86), '#1a212c', [0, 1.75, 0]),
        part(new BoxGeometry(1.24, 0.24, 0.9), '#15181f', [0, 2, 0]),
        part(new BoxGeometry(0.26, 0.22, 0.06), '#c8ccd4', [0, 2, 0.47]),
        part(new BoxGeometry(1.26, 1.3, 0.84), '#232b38', [0, 2.75, 0]),
        part(new BoxGeometry(1.3, 0.2, 0.88), '#c8ccd4', [0, 2.72, 0]),
        part(new BoxGeometry(0.14, 1.3, 0.88), '#1a212c', [0, 2.75, 0]),
        part(new BoxGeometry(0.26, 0.26, 0.06), '#e03a2e', [0.38, 3.08, 0.44]),
        ...[-0.72, 0.72].map((x) => part(new BoxGeometry(0.44, 0.12, 0.54), '#c8ccd4', [x, 3.33, 0])),
        // Left arm down, right arm straight out: the hand that wants the ticket.
        part(new BoxGeometry(0.34, 1.35, 0.38), '#232b38', [-0.8, 2.65, 0.05], [1, 1, 1], [0.15, 0, -0.07]),
        part(ball(0.2), '#d9a68e', [-0.9, 1.95, 0.17]),
        part(new BoxGeometry(0.34, 1.5, 0.38), '#232b38', [0.78, 3.04, 0.62], [1, 1, 1], [-1.4, 0, 0]),
        part(new BoxGeometry(0.38, 0.22, 0.4), '#e03a2e', [0.78, 3.2, 0.12]),
        part(ball(0.21), '#d9a68e', [0.78, 2.9, 1.32]),
        part(new BoxGeometry(0.3, 0.44, 0.2), '#15181f', [0.78, 3.06, 1.42], [1, 1, 1], [-0.3, 0, 0]),
        part(new BoxGeometry(0.2, 0.18, 0.05), '#1b6b4a', [0.78, 3.14, 1.53]),
        // Head, shades, moustache, cap.
        part(new BoxGeometry(0.38, 0.22, 0.38), '#d9a68e', [0, 3.5, 0.02]),
        part(ball(0.37, 2), '#d9a68e', [0, 3.76, 0.04], [1, 1.08, 1]),
        part(new BoxGeometry(0.58, 0.14, 0.1), '#15181f', [0, 3.8, 0.33]),
        part(new BoxGeometry(0.34, 0.09, 0.1), '#3a2620', [0, 3.56, 0.34]),
        part(new CylinderGeometry(0.42, 0.4, 0.28, 10), '#232b38', [0, 4.1, 0.02]),
        part(new CylinderGeometry(0.46, 0.46, 0.06, 10), '#1a212c', [0, 4.23, 0.02]),
        part(new BoxGeometry(0.56, 0.08, 0.36), '#15181f', [0, 3.99, 0.36], [1, 1, 1], [-0.12, 0, 0]),
        part(new BoxGeometry(0.16, 0.16, 0.06), '#e03a2e', [0, 4.12, 0.4]),
      ]);
      return { body };
    }
    case 'krol-zlomu': {
      // Scrap king: a throne welded from rails, a crown of rail ends, a magnet for a sceptre.
      const throne: BufferGeometry[] = [];
      for (let k = 0; k < 5; k++) {
        const x = (k - 2) * 0.62;
        throne.push(bone([x, 1.4, -1.3], [x * 1.3, 4.75, -1.75], 0.15, '#8b8f96'));
        throne.push(part(new BoxGeometry(0.5, 0.16, 0.34), '#6f737a', [x * 1.3, 4.78, -1.78]));
      }
      throne.push(part(new BoxGeometry(3.1, 0.2, 0.22), '#6f737a', [0, 3.9, -1.64]));
      throne.push(part(new BoxGeometry(2.85, 0.2, 0.22), '#6f737a', [0, 2.7, -1.48]));
      const body = mergeGeometries([
        part(new BoxGeometry(3, 0.5, 2.4), '#3e3a36', [0, 0.25, -0.5]),
        ...[-1.1, 1.1].flatMap((x) => [-1.05, 0.75].map((z) => part(new BoxGeometry(0.26, 0.8, 0.26), '#6f737a', [x, 0.9, z]))),
        part(new BoxGeometry(2.5, 0.3, 1.9), '#8b8f96', [0, 1.4, -0.25]),
        ...[-1.15, 1.15].map((x) => part(new BoxGeometry(0.3, 0.3, 1.7), '#6f737a', [x, 1.95, -0.2])),
        ...throne,
        // Scrap heaped round the feet of the throne.
        part(new BoxGeometry(0.9, 0.3, 0.3), '#6f737a', [-1.5, 0.15, 0.9], [1, 1, 1], [0, 0.6, 0.2]),
        part(new CylinderGeometry(0.2, 0.2, 0.7, 6), '#5a5f66', [1.6, 0.2, 0.7], [1, 1, 1], [0, 0.3, Math.PI / 2]),
        part(new BoxGeometry(0.5, 0.25, 0.8), '#4a4f55', [1.3, 0.12, -1.4], [1, 1, 1], [0, 0.9, 0]),
        // The king himself, sitting.
        part(new BoxGeometry(1.25, 0.8, 1.1), '#5b4c31', [0, 1.9, -0.1]),
        part(new BoxGeometry(1.55, 1.35, 1.15), '#6b5a3a', [0, 2.75, -0.1]),
        part(new BoxGeometry(1.6, 0.18, 1.2), '#3e3a36', [0, 2.12, -0.1]),
        part(new BoxGeometry(0.5, 0.1, 0.12), '#d9a441', [0, 2.95, 0.5]),
        part(dot(0.14), '#d9a441', [0, 2.84, 0.52]),
        ...[-0.45, 0.45].map((x) => part(new BoxGeometry(0.52, 0.52, 1.3), '#5b4c31', [x, 1.95, 0.85])),
        ...[-0.45, 0.45].map((x) => part(new BoxGeometry(0.48, 1.3, 0.52), '#5b4c31', [x, 1.1, 1.35])),
        ...[-0.45, 0.45].map((x) => part(new BoxGeometry(0.56, 0.3, 0.85), '#3e3a36', [x, 0.15, 1.55])),
        part(new BoxGeometry(0.42, 1.1, 0.46), '#6b5a3a', [-1.03, 2.65, 0.15], [1, 1, 1], [0.3, 0, -0.1]),
        part(ball(0.22), '#d9a68e', [-1.12, 2.15, 0.45]),
        // Right arm up, holding the magnet that picked the rails up in the first place.
        bone([0.95, 3.1, -0.1], [1.75, 3.95, 0.35], 0.22, '#6b5a3a'),
        part(ball(0.24), '#d9a68e', [1.78, 4.05, 0.4]),
        part(new BoxGeometry(1.05, 0.34, 0.44), '#b43a2e', [1.78, 3.78, 0.4]),
        ...[-0.35, 0.35].map((d) => part(new BoxGeometry(0.34, 0.85, 0.44), '#b43a2e', [1.78 + d, 3.2, 0.4])),
        ...[-0.35, 0.35].map((d) => part(new BoxGeometry(0.38, 0.22, 0.48), '#c8ccd4', [1.78 + d, 2.68, 0.4])),
        // Head, beard, crown made of cut rail.
        part(ball(0.42, 2), '#d9a68e', [0, 3.75, 0]),
        part(ball(0.38), '#d8d2c4', [0, 3.6, 0.3], [1, 1.1, 0.7]),
        ...[-0.16, 0.16].map((x) => part(dot(0.055), '#1b1412', [x, 3.86, 0.36])),
        part(new CylinderGeometry(0.5, 0.5, 0.26, 10), '#d9a441', [0, 4.12, 0]),
        ...[0, 1, 2, 3, 4].map((k) => part(new ConeGeometry(0.11, 0.34, 5), '#d9a441', [Math.sin((k / 5) * Math.PI * 2) * 0.42, 4.38, Math.cos((k / 5) * Math.PI * 2) * 0.42])),
      ]);
      return { body };
    }
    case 'zka': {
      // The replacement bus: yellow box on six wheels, angry headlights, OBJAZD board over the windscreen.
      const body = mergeGeometries([
        part(new BoxGeometry(3.2, 1.6, 9.4), '#f2c400', [0, 1.3, 0]),
        part(new BoxGeometry(3.2, 1.45, 9.4), '#f2f2f2', [0, 2.82, 0]),
        part(new BoxGeometry(3.26, 0.95, 8.3), '#2a3448', [0, 2.9, -0.35]),
        part(new BoxGeometry(3.24, 0.14, 9.4), '#e2362c', [0, 2.06, 0]),
        part(new BoxGeometry(3.3, 0.16, 9.5), '#cfcfcf', [0, 3.6, 0]),
        part(new BoxGeometry(1.4, 0.2, 1.6), '#b9bcc2', [0, 3.72, -2.6]),
        // Front: windscreen, destination board, angry lights, bent bumper.
        part(new BoxGeometry(2.9, 1.05, 0.08), '#2a3448', [0, 2.82, 4.71]),
        part(new BoxGeometry(1.9, 0.4, 0.1), '#15181f', [0, 3.45, 4.73]),
        ...[-0.6, 0, 0.6].map((x) => part(new BoxGeometry(0.42, 0.22, 0.06), '#ff8a1e', [x, 3.45, 4.78])),
        ...[-1.05, 1.05].map((x) => part(new BoxGeometry(0.7, 0.3, 0.08), '#fff6c8', [x, 1.25, 4.72], [1, 1, 1], [0, 0, x > 0 ? -0.3 : 0.3])),
        ...[-1.05, 1.05].map((x) => part(new BoxGeometry(0.5, 0.22, 0.08), '#e2362c', [x, 1.35, -4.72])),
        part(new BoxGeometry(1.7, 0.45, 0.12), '#2a3448', [0, 0.95, 4.72]),
        ...[-0.6, -0.2, 0.2, 0.6].map((x) => part(new BoxGeometry(0.1, 0.45, 0.16), '#8b8f96', [x, 0.95, 4.74])),
        part(new BoxGeometry(3.1, 0.38, 0.22), '#3a3a3a', [0, 0.6, 4.76], [1, 1, 1], [0, 0, 0.05]),
        // Doors on the kerb side, mirrors, exhaust.
        ...[1.5, -1.9].map((z) => part(new BoxGeometry(0.1, 1.9, 1.5), '#2a3448', [1.62, 1.95, z])),
        part(new BoxGeometry(0.1, 1.9, 1.5), '#2a3448', [-1.62, 1.95, 1.5]),
        ...[-1, 1].map((s) => part(new BoxGeometry(0.5, 0.05, 0.08), '#3a3a3a', [s * 1.9, 3.25, 4.3])),
        ...[-1, 1].map((s) => part(new BoxGeometry(0.12, 0.45, 0.3), '#2a3448', [s * 2.1, 3.1, 4.3])),
        part(new CylinderGeometry(0.13, 0.13, 1.3, 6), '#3a3a3a', [1.3, 4.2, -4.2]),
        // Six wheels.
        ...[3.1, -0.3, -3.3].flatMap((z) => [-1.55, 1.55].map((x) => part(new CylinderGeometry(0.78, 0.78, 0.5, 10), '#1c1c1c', [x, 0.78, z], [1, 1, 1], [0, 0, Math.PI / 2]))),
        ...[3.1, -0.3, -3.3].flatMap((z) => [-1.72, 1.72].map((x) => part(new CylinderGeometry(0.34, 0.34, 0.1, 8), '#8b8f96', [x, 0.78, z], [1, 1, 1], [0, 0, Math.PI / 2]))),
      ]);
      return { body };
    }
    case 'golab-matka': {
      // The flock's mother: the station pigeon at five times the size, wings out, standing over her nest.
      const body = mergeGeometries([
        part(ball(1.2, 2), '#8f96a3', [0, 1.85, -0.1], [0.95, 0.9, 1.4]),
        part(ball(0.85, 2), '#6fb39a', [0, 2.1, 0.95], [1, 1, 0.9]),
        part(ball(0.6), '#7a5f8e', [0, 2.3, 1.15], [1.05, 0.7, 0.7]),
        part(ball(0.62, 2), '#5d6573', [0, 2.95, 1.2]),
        part(ball(0.6, 2), '#5d6573', [0, 3.3, 1.4], [1, 0.95, 1]),
        part(new ConeGeometry(0.23, 1, 7), '#2e2e33', [0, 3.18, 2.22], [1, 1, 1], [1.45, 0, 0]),
        part(ball(0.19), '#f2f0ea', [0, 3.4, 1.78], [1, 0.7, 0.8]),
        ...[-0.44, 0.44].map((x) => part(dot(0.17), '#e6893b', [x, 3.42, 1.5])),
        ...[-0.52, 0.52].map((x) => part(dot(0.075), '#151515', [x, 3.44, 1.6])),
        // Tail and spread wings.
        part(new BoxGeometry(1.2, 0.22, 1.5), '#4b5260', [0, 1.95, -2.1], [1, 1, 1], [-0.28, 0, 0]),
        ...[-1, 1].map((s) => part(ball(0.9, 2), '#7d8491', [s * 1.8, 2.4, -0.3], [1.7, 0.3, 1.3], [0.12, s * 0.2, s * 0.3])),
        ...[-1, 1].flatMap((s) => [-0.55, -0.95, -1.3].map((z, k) => part(new BoxGeometry(1.4 - k * 0.25, 0.14, 0.32), '#2f333b', [s * (1.95 - k * 0.1), 2.5 + Math.abs(s) * 0.12 * k, z], [1, 1, 1], [0, 0, s * 0.3]))),
        // Legs and a nest of twigs she will not leave.
        ...[-1, 1].map((s) => part(new BoxGeometry(0.2, 1, 0.2), '#d07a7a', [s * 0.42, 0.5, 0.2])),
        ...[-1, 1].map((s) => part(new BoxGeometry(0.42, 0.12, 0.62), '#d07a7a', [s * 0.42, 0.06, 0.45])),
        ...[0, 1, 2, 3, 4, 5].map((k) => part(new CylinderGeometry(0.07, 0.07, 1.5, 5), '#6b5636', [Math.sin((k / 6) * Math.PI * 2) * 0.95, 0.12, Math.cos((k / 6) * Math.PI * 2) * 0.95 + 0.1], [1, 1, 1], [0, (k / 6) * Math.PI * 2, Math.PI / 2])),
      ]);
      return { body };
    }
    case 'kierownik': {
      // Track-works manager: hi-vis vest, hard hat, rolled plans under one arm, a sign held up in the other.
      const body = mergeGeometries([
        ...[-0.32, 0.32].map((x) => part(new BoxGeometry(0.44, 1.35, 0.48), '#2f3a52', [x, 0.68, 0])),
        ...[-0.32, 0.32].map((x) => part(new BoxGeometry(0.52, 0.26, 0.76), '#20242c', [x, 0.13, 0.12])),
        part(new BoxGeometry(1.24, 1.5, 0.82), '#2f3a52', [0, 2, 0]),
        part(new BoxGeometry(1.32, 1.25, 0.9), '#ff8a1e', [0, 2.05, 0]),
        ...[1.72, 2.4].map((y) => part(new BoxGeometry(1.34, 0.14, 0.92), '#d9dde3', [0, y, 0])),
        ...[-0.4, 0.4].map((x) => part(new BoxGeometry(0.12, 1.25, 0.94), '#d9dde3', [x, 2.05, 0])),
        // Left arm with the rolled-up plans, right arm gripping the sign pole.
        part(new BoxGeometry(0.34, 1.2, 0.38), '#2f3a52', [-0.8, 2.05, 0.05], [1, 1, 1], [0.2, 0, -0.1]),
        part(ball(0.2), '#e9b99e', [-0.9, 1.45, 0.22]),
        part(new CylinderGeometry(0.11, 0.11, 1.3, 6), '#e8e2d2', [-0.95, 2.1, 0.2], [1, 1, 1], [Math.PI / 2, 0, 0]),
        bone([0.66, 3.05, 0], [1.34, 2.05, 0.5], 0.19, '#2f3a52'),
        part(ball(0.2), '#e9b99e', [1.36, 2, 0.52]),
        // Head, moustache, hard hat.
        part(new BoxGeometry(0.38, 0.2, 0.38), '#e9b99e', [0, 2.84, 0.02]),
        part(ball(0.36, 2), '#e9b99e', [0, 3.08, 0.04], [1, 1.06, 1]),
        ...[-0.14, 0.14].map((x) => part(dot(0.05), '#1b1412', [x, 3.12, 0.34])),
        part(new BoxGeometry(0.32, 0.08, 0.08), '#3a2620', [0, 2.92, 0.34]),
        part(ball(0.4, 2), '#ffd23a', [0, 3.28, 0.04], [1, 0.62, 1.04]),
        part(new BoxGeometry(0.9, 0.06, 0.92), '#ffd23a', [0, 3.24, 0.08]),
        part(new BoxGeometry(0.1, 0.16, 0.8), '#e8b321', [0, 3.5, 0.04]),
        // The sign: orange frame, two lines of something nobody reads.
        part(new CylinderGeometry(0.08, 0.08, 2.6, 6), '#b9bcc2', [1.4, 2.15, 0.6]),
        part(new BoxGeometry(1.5, 1.05, 0.08), '#ff8a1e', [1.4, 3.7, 0.58]),
        part(new BoxGeometry(1.26, 0.82, 0.1), '#d9dde3', [1.4, 3.7, 0.63]),
        ...[3.87, 3.6].map((y) => part(new BoxGeometry(0.9, 0.12, 0.05), '#2f3a52', [1.4, y, 0.69])),
      ]);
      return { body };
    }
    case 'megafon': {
      // Station loudspeaker: concrete plinth, lattice mast, four horns and a light that never stops blinking.
      const mast: BufferGeometry[] = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) mast.push(bone([sx * 0.42, 0.6, sz * 0.42], [sx * 0.24, 3.7, sz * 0.24], 0.09, '#9aa3ad'));
      }
      for (const [y, dir] of [[1.3, 1], [2.1, -1], [2.9, 1]] as const) {
        for (const s of [-1, 1]) {
          mast.push(bone([s * 0.38, y - 0.4 * dir, -0.38], [s * 0.34, y + 0.4 * dir, 0.38], 0.055, '#78818b'));
          mast.push(bone([-0.38, y - 0.4 * dir, s * 0.38], [0.38, y + 0.4 * dir, s * 0.34], 0.055, '#78818b'));
        }
      }
      // Horns point out along +z, ±x and −z; Euler (0, yaw, π/2) lays the cylinder flat facing (−cos yaw, 0, sin yaw).
      const horns: BufferGeometry[] = [];
      for (const [yaw, dx, dz, scale] of [[Math.PI / 2, 0, 1, 1], [Math.PI, 1, 0, 0.8], [0, -1, 0, 0.8], [-Math.PI / 2, 0, -1, 0.7]] as const) {
        const y = 3.95 + (1 - scale) * 0.35;
        horns.push(part(new CylinderGeometry(0.78 * scale, 0.2, 1.35 * scale, 10), '#9aa3ad', [dx * 0.75, y, dz * 0.75], [1, 1, 1], [0, yaw, Math.PI / 2]));
        const mouth = 0.75 + 0.69 * scale;
        horns.push(part(new CylinderGeometry(0.72 * scale, 0.72 * scale, 0.08, 10), '#20242c', [dx * mouth, y, dz * mouth], [1, 1, 1], [0, yaw, Math.PI / 2]));
      }
      const body = mergeGeometries([
        part(new BoxGeometry(1.7, 0.4, 1.7), '#20242c', [0, 0.2, 0]),
        part(new BoxGeometry(1.3, 0.35, 1.3), '#3a4350', [0, 0.52, 0]),
        ...[-1, 1].map((s) => part(new BoxGeometry(0.5, 0.5, 1.5), '#20242c', [s * 0.7, 0.25, 0])),
        ...mast,
        part(new BoxGeometry(1.1, 0.3, 1.1), '#3a4350', [0, 3.85, 0]),
        part(new CylinderGeometry(0.34, 0.34, 0.9, 8), '#3a4350', [0, 4.1, 0]),
        ...horns,
        part(new BoxGeometry(0.6, 0.42, 0.08), '#ffd23a', [0, 2.3, 0.33]),
        part(new BoxGeometry(0.42, 0.12, 0.05), '#20242c', [0, 2.36, 0.38]),
        part(new BoxGeometry(0.42, 0.12, 0.05), '#20242c', [0, 2.2, 0.38]),
        part(new CylinderGeometry(0.1, 0.1, 0.3, 6), '#3a4350', [0, 4.65, 0]),
        part(ball(0.17), '#e2362c', [0, 4.85, 0]),
        bone([0.2, 4.1, -0.2], [0.34, 2.4, -0.34], 0.045, '#20242c'),
      ]);
      return { body };
    }
    default:
      return null;
  }
}
