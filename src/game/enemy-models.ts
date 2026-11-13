import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnemyId } from '../content/enemies';

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

const ball = (r: number): SphereGeometry => new SphereGeometry(r, 9, 7);

export interface EnemyModel {
  body: BufferGeometry;
  /** Optional separately animated part (pigeon wings), mirrored for both sides. */
  wing?: BufferGeometry;
  wingOffset?: [number, number, number];
}

export function enemyModel(id: EnemyId): EnemyModel {
  switch (id) {
    case 'golab': {
      const body = mergeGeometries([
        part(ball(0.22), '#8f96a3', [0, 0.3, 0], [1, 0.85, 1.35]),
        part(ball(0.13), '#6fb39a', [0, 0.44, 0.16], [1, 1, 0.9]),
        part(ball(0.1), '#7a5f8e', [0, 0.47, 0.19], [1.05, 0.7, 0.8]),
        part(ball(0.11), '#5d6573', [0, 0.57, 0.23]),
        part(new ConeGeometry(0.028, 0.09, 6), '#2e2e33', [0, 0.555, 0.35], [1, 1, 1], [Math.PI / 2, 0, 0]),
        part(ball(0.022), '#f2f0ea', [0, 0.585, 0.32]),
        part(ball(0.024), '#e6893b', [0.072, 0.59, 0.28]),
        part(ball(0.024), '#e6893b', [-0.072, 0.59, 0.28]),
        part(ball(0.011), '#151515', [0.088, 0.592, 0.29]),
        part(ball(0.011), '#151515', [-0.088, 0.592, 0.29]),
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
      // A touch smaller than the other enemies: they come in flocks.
      body.scale(0.85, 0.85, 0.85);
      wing.scale(0.85, 0.85, 0.85);
      return { body, wing, wingOffset: [0.1, 0.32, 0] };
    }
    case 'szczur': {
      const tail: BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        tail.push(part(new CylinderGeometry(0.022 * (1 - t * 0.6), 0.022 * (1 - (t + 0.17) * 0.6), 0.1, 5), '#d99a9a', [Math.sin(t * 4) * 0.05, 0.16 - t * 0.12, -0.32 - t * 0.09], [1, 1, 1], [Math.PI / 2 - 0.3, 0, 0]));
      }
      const body = mergeGeometries([
        part(ball(0.2), '#6b5a50', [0, 0.21, 0], [1, 0.8, 1.6]),
        part(ball(0.15), '#5d4d44', [0, 0.27, -0.08], [1, 0.8, 1.2]),
        part(new ConeGeometry(0.13, 0.28, 8), '#6b5a50', [0, 0.23, 0.36], [1, 0.85, 1], [Math.PI / 2, 0, 0]),
        part(ball(0.035), '#e8a3a3', [0, 0.23, 0.5]),
        part(ball(0.065), '#e8a3a3', [0.08, 0.35, 0.25], [1, 1, 0.4]),
        part(ball(0.065), '#e8a3a3', [-0.08, 0.35, 0.25], [1, 1, 0.4]),
        part(ball(0.024), '#120d0b', [0.06, 0.29, 0.37]),
        part(ball(0.024), '#120d0b', [-0.06, 0.29, 0.37]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [0.1, 0.04, 0.16]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [-0.1, 0.04, 0.16]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [0.1, 0.04, -0.16]),
        part(new BoxGeometry(0.05, 0.08, 0.07), '#d99a9a', [-0.1, 0.04, -0.16]),
        ...tail,
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
        part(ball(0.025), '#1b1412', [0.065, 1.32, 0.18]),
        part(ball(0.025), '#1b1412', [-0.065, 1.32, 0.18]),
        part(new BoxGeometry(0.16, 0.04, 0.03), '#3a2620', [0, 1.21, 0.18]),
        part(new BoxGeometry(0.045, 1.0, 0.045), '#8a6a4a', [0.42, 0.95, 0.3], [1, 1, 1], [0.5, 0, 0.1]),
        part(new BoxGeometry(0.22, 0.27, 0.035), '#9aa1aa', [0.47, 0.48, 0.55], [1, 1, 1], [0.5, 0, 0.1]),
      ]);
      return { body };
    }
  }
}
