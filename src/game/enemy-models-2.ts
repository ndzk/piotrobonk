// Models of the enemies added with the difficulty rework: the late passenger, the flare fan, the e-scooter, the
// walking parcel locker and its parcels, the shop guard with a riot shield, the foreman with a megaphone,
// Janusz with a firecracker, the roof cat and the night inspector. Built like the others in enemy-models.ts:
// primitives with baked vertex colours, facing +z, feet at y = 0, low segment counts (hundreds are drawn).
import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

const ball = (r: number, detail = 1): SphereGeometry => new SphereGeometry(r, detail > 1 ? 8 : 7, detail > 1 ? 6 : 5);
const dot = (r: number): SphereGeometry => new SphereGeometry(r, 4, 3);

interface Person {
  legs: string;
  shoes: string;
  torso: string;
  arms: string;
  skin?: string;
  hair: string;
  /** Torso lean forward (radians): runners lean into it. */
  lean?: number;
  /** Arm pitches (radians, positive raises the arm forward), right then left. */
  armR?: number;
  armL?: number;
}

/** The shared human body: legs, shoes, torso, arms, head with eyes, mouth and hair. */
function person(p: Person): BufferGeometry[] {
  const skin = p.skin ?? '#e9b99e';
  const lean = p.lean ?? 0;
  const zl = Math.sin(lean) * 0.5;
  return [
    part(new BoxGeometry(0.17, 0.55, 0.19), p.legs, [0.12, 0.28, 0]),
    part(new BoxGeometry(0.17, 0.55, 0.19), p.legs, [-0.12, 0.28, 0]),
    part(new BoxGeometry(0.2, 0.09, 0.28), p.shoes, [0.12, 0.045, 0.04]),
    part(new BoxGeometry(0.2, 0.09, 0.28), p.shoes, [-0.12, 0.045, 0.04]),
    part(new BoxGeometry(0.54, 0.58, 0.34), p.torso, [0, 0.84, zl * 0.6], [1, 1, 1], [lean, 0, 0]),
    part(new BoxGeometry(0.15, 0.5, 0.16), p.arms, [0.36, 0.86, 0.04 + zl * 0.6], [1, 1, 1], [p.armR ?? 0.15, 0, 0.12]),
    part(new BoxGeometry(0.15, 0.5, 0.16), p.arms, [-0.36, 0.86, 0.04 + zl * 0.6], [1, 1, 1], [p.armL ?? 0.15, 0, -0.12]),
    part(ball(0.18), skin, [0, 1.31, 0.02 + zl]),
    part(ball(0.185), p.hair, [0, 1.39, -0.02 + zl], [1, 0.5, 1]),
    part(dot(0.025), '#1b1412', [0.065, 1.33, 0.18 + zl]),
    part(dot(0.025), '#1b1412', [-0.065, 1.33, 0.18 + zl]),
    part(new BoxGeometry(0.14, 0.035, 0.03), '#3a2620', [0, 1.22, 0.18 + zl]),
  ];
}

export type NewEnemyId = 'pasazer' | 'kibic' | 'hulajnoga' | 'paczkomat' | 'paczka' | 'ochroniarz' | 'brygadzista' | 'janusz' | 'dachowiec' | 'kanar-nocny';

/** The body of one of the new enemies. */
export function newEnemyModel(id: NewEnemyId): BufferGeometry {
  switch (id) {
    case 'pasazer':
      // Late for the train: suit, loosened tie, a takeaway coffee held out in front, leaning into the run.
      return mergeGeometries([
        ...person({ legs: '#2b2f3a', shoes: '#14110f', torso: '#3c4250', arms: '#3c4250', hair: '#5a3a24', lean: 0.32, armR: 1.1, armL: -0.6 }),
        part(new BoxGeometry(0.06, 0.3, 0.02), '#c8323a', [0, 0.98, 0.3], [1, 1, 1], [0.32, 0, 0.15]),
        part(new BoxGeometry(0.18, 0.1, 0.02), '#f2f2ee', [0, 1.08, 0.27], [1, 1, 1], [0.32, 0, 0]),
        part(new CylinderGeometry(0.055, 0.045, 0.14, 7), '#f4f0e6', [0.36, 1.08, 0.55]),
        part(new CylinderGeometry(0.058, 0.058, 0.025, 7), '#3b2618', [0.36, 1.16, 0.55]),
        part(new BoxGeometry(0.3, 0.22, 0.08), '#5a3a24', [-0.42, 0.7, -0.22], [1, 1, 1], [-0.4, 0, 0]),
      ]);
    case 'kibic':
      // A fan in the club scarf with a lit flare held up: the flare's glow is the warning before the throw.
      return mergeGeometries([
        ...person({ legs: '#2f3340', shoes: '#f2f2ee', torso: '#1e1e22', arms: '#1e1e22', hair: '#151515', armR: 2.6, armL: 0.3 }),
        part(new BoxGeometry(0.58, 0.1, 0.36), '#d8263a', [0, 1.12, 0.02]),
        part(new BoxGeometry(0.58, 0.05, 0.37), '#f2f2ee', [0, 1.12, 0.02]),
        part(new BoxGeometry(0.1, 0.36, 0.05), '#d8263a', [0.16, 0.92, 0.18], [1, 1, 1], [0.1, 0, 0]),
        part(ball(0.19), '#1e1e22', [0, 1.4, 0.0], [1, 0.62, 1]),
        part(new CylinderGeometry(0.035, 0.035, 0.36, 6), '#b8402a', [0.42, 1.55, 0.22]),
        part(ball(0.09), '#ffcf5a', [0.42, 1.76, 0.22]),
        part(dot(0.06), '#fff3c0', [0.42, 1.8, 0.22]),
      ]);
    case 'hulajnoga': {
      // Hi-vis delivery rider on an e-scooter, the food bag on their back; low and long, it runs you down.
      const deck = [
        part(new BoxGeometry(0.22, 0.06, 1.05), '#20242c', [0, 0.14, 0.1]),
        part(new CylinderGeometry(0.11, 0.11, 0.06, 10), '#151515', [0, 0.11, 0.6], [1, 1, 1], [0, 0, Math.PI / 2]),
        part(new CylinderGeometry(0.11, 0.11, 0.06, 10), '#151515', [0, 0.11, -0.38], [1, 1, 1], [0, 0, Math.PI / 2]),
        part(new BoxGeometry(0.05, 1.05, 0.05), '#3a3f4a', [0, 0.66, 0.6], [1, 1, 1], [-0.12, 0, 0]),
        part(new BoxGeometry(0.5, 0.05, 0.05), '#20242c', [0, 1.18, 0.66]),
        part(new BoxGeometry(0.08, 0.05, 0.03), '#fff6c8', [0, 0.95, 0.68]),
      ];
      return mergeGeometries([
        ...person({ legs: '#2a2d36', shoes: '#14110f', torso: '#c9f21e', arms: '#2a2d36', hair: '#222', lean: 0.25, armR: 1.25, armL: 1.25 }).map((g) => g.translate(0, 0.17, 0)),
        part(new BoxGeometry(0.46, 0.44, 0.3), '#14a37f', [0, 1.06, -0.32]),
        part(new BoxGeometry(0.47, 0.06, 0.31), '#f2f2ee', [0, 1.2, -0.32]),
        ...deck,
      ]);
    }
    case 'paczkomat':
      // A parcel locker that has had enough: yellow cabinet on legs, grey lockers, a screen, a keypad.
      return mergeGeometries([
        part(new BoxGeometry(0.16, 0.42, 0.18), '#2a2a2e', [0.3, 0.21, 0]),
        part(new BoxGeometry(0.16, 0.42, 0.18), '#2a2a2e', [-0.3, 0.21, 0]),
        part(new BoxGeometry(1.1, 1.4, 0.6), '#ffcc19', [0, 1.12, 0]),
        ...[0, 1, 2].flatMap((r) => [0, 1].map((c) => part(new BoxGeometry(0.42, 0.36, 0.02), '#c9ccd2', [-0.24 + c * 0.48, 0.66 + r * 0.42, 0.31]))),
        part(new BoxGeometry(0.3, 0.2, 0.03), '#1f2a3a', [0, 1.74, 0.31]),
        part(new BoxGeometry(0.2, 0.08, 0.035), '#3cff8c', [0, 1.76, 0.32]),
        part(new BoxGeometry(1.14, 0.08, 0.64), '#2a2a2e', [0, 1.86, 0]),
        part(dot(0.05), '#1b1412', [0.16, 1.62, 0.32]),
        part(dot(0.05), '#1b1412', [-0.16, 1.62, 0.32]),
      ]);
    case 'paczka':
      // One escaped parcel: a cardboard box with tape and stubby legs, in a hurry.
      return mergeGeometries([
        part(new BoxGeometry(0.06, 0.16, 0.06), '#2a2a2e', [0.12, 0.08, 0]),
        part(new BoxGeometry(0.06, 0.16, 0.06), '#2a2a2e', [-0.12, 0.08, 0]),
        part(new BoxGeometry(0.46, 0.36, 0.46), '#c49a62', [0, 0.34, 0]),
        part(new BoxGeometry(0.47, 0.05, 0.08), '#e8d9a8', [0, 0.53, 0]),
        part(new BoxGeometry(0.2, 0.12, 0.02), '#ffcc19', [0, 0.36, 0.24]),
        part(dot(0.03), '#1b1412', [0.08, 0.44, 0.24]),
        part(dot(0.03), '#1b1412', [-0.08, 0.44, 0.24]),
      ]);
    case 'ochroniarz':
      // A shop guard in black with a riot shield held in front: hit from the front, the shield takes it.
      return mergeGeometries([
        ...person({ legs: '#18191d', shoes: '#0c0c0e', torso: '#18191d', arms: '#18191d', hair: '#0e0e10', armR: 0.9, armL: 1.2 }),
        part(new BoxGeometry(0.4, 0.12, 0.02), '#f2f2ee', [0, 1.02, 0.175]),
        part(new BoxGeometry(0.86, 1.25, 0.06), '#9fc7e8', [0, 0.82, 0.48]),
        part(new BoxGeometry(0.9, 0.06, 0.08), '#2a3a52', [0, 1.45, 0.48]),
        part(new BoxGeometry(0.9, 0.06, 0.08), '#2a3a52', [0, 0.2, 0.48]),
        part(new BoxGeometry(0.06, 1.3, 0.08), '#2a3a52', [0.43, 0.82, 0.48]),
        part(new BoxGeometry(0.06, 1.3, 0.08), '#2a3a52', [-0.43, 0.82, 0.48]),
        part(new BoxGeometry(0.6, 0.12, 0.02), '#f2f2ee', [0, 1.1, 0.52]),
      ]);
    case 'brygadzista':
      // The foreman: white helmet, red vest, a megaphone at the mouth. The crowd near him works harder.
      return mergeGeometries([
        ...person({ legs: '#3a4256', shoes: '#2a2522', torso: '#e2362c', arms: '#3a4256', hair: '#6b5a4a', armR: 1.6, armL: 0.2 }),
        part(new BoxGeometry(0.56, 0.06, 0.36), '#ffe36a', [0, 0.95, 0]),
        part(ball(0.2), '#f6f6f2', [0, 1.4, 0.02], [1, 0.55, 1.08]),
        part(new BoxGeometry(0.44, 0.03, 0.46), '#f6f6f2', [0, 1.38, 0.05]),
        part(new CylinderGeometry(0.07, 0.15, 0.3, 8), '#f2f2ee', [0.18, 1.28, 0.42], [1, 1, 1], [Math.PI / 2, 0, 0]),
        part(new CylinderGeometry(0.155, 0.155, 0.02, 8), '#e2362c', [0.18, 1.28, 0.58], [1, 1, 1], [Math.PI / 2, 0, 0]),
      ]);
    case 'janusz':
      // Janusz in a tracksuit with a firecracker lit in one hand: when he goes down, it goes off.
      return mergeGeometries([
        ...person({ legs: '#2b3b8f', shoes: '#f2f2ee', torso: '#2b3b8f', arms: '#2b3b8f', hair: '#7a6a5a', armR: 1.3, armL: 0.2 }),
        part(new BoxGeometry(0.04, 0.58, 0.02), '#f2f2ee', [0.2, 0.84, 0.175]),
        part(new BoxGeometry(0.04, 0.58, 0.02), '#f2f2ee', [-0.2, 0.84, 0.175]),
        part(ball(0.2), '#e9b99e', [0, 0.92, 0.1], [1.1, 0.8, 0.9]),
        part(new BoxGeometry(0.16, 0.05, 0.03), '#5a4434', [0, 1.26, 0.185]),
        part(new CylinderGeometry(0.06, 0.06, 0.24, 7), '#d8263a', [0.38, 1.12, 0.5]),
        part(new CylinderGeometry(0.008, 0.008, 0.12, 4), '#2a2522', [0.38, 1.28, 0.5]),
        part(dot(0.04), '#ffd23a', [0.38, 1.35, 0.5]),
      ]);
    case 'dachowiec': {
      // The roof cat: tabby, tail up, crouched to spring. It comes down on you from wherever you stand.
      const tail: BufferGeometry[] = [];
      for (let i = 0; i < 7; i++) {
        const t = i / 7;
        tail.push(part(ball(0.045), i % 2 ? '#7a4a22' : '#c4783a', [0, 0.3 + t * 0.42, -0.26 - Math.sin(t * 1.4) * 0.12]));
      }
      return mergeGeometries([
        part(ball(0.2, 2), '#c4783a', [0, 0.26, 0], [0.85, 0.8, 1.45]),
        part(new BoxGeometry(0.3, 0.04, 0.4), '#7a4a22', [0, 0.38, 0], [1, 1, 1], [0.1, 0, 0]),
        part(ball(0.14, 2), '#c4783a', [0, 0.42, 0.3]),
        part(new ConeGeometry(0.05, 0.1, 4), '#c4783a', [0.08, 0.55, 0.28]),
        part(new ConeGeometry(0.05, 0.1, 4), '#c4783a', [-0.08, 0.55, 0.28]),
        part(ball(0.06), '#f2e6d0', [0, 0.38, 0.41], [1.2, 0.8, 0.8]),
        part(dot(0.03), '#b8ff4a', [0.055, 0.45, 0.42]),
        part(dot(0.03), '#b8ff4a', [-0.055, 0.45, 0.42]),
        part(dot(0.014), '#101010', [0.058, 0.452, 0.448]),
        part(dot(0.014), '#101010', [-0.058, 0.452, 0.448]),
        part(dot(0.02), '#e88a9a', [0, 0.41, 0.45]),
        ...[-0.1, 0.1].flatMap((x) => [0.18, -0.16].map((z) => part(new BoxGeometry(0.06, 0.16, 0.06), '#b06a32', [x, 0.08, z]))),
        ...tail,
      ]);
    }
    case 'kanar-nocny':
      // The night inspector of the last train: long coat, peaked cap, a torch that finds you. Cannot be stopped.
      return mergeGeometries([
        ...person({ legs: '#0d0f16', shoes: '#050506', torso: '#121625', arms: '#121625', hair: '#0d0f16', armR: 1.25, armL: 0.25 }),
        part(new BoxGeometry(0.6, 0.6, 0.38), '#121625', [0, 0.45, -0.02]),
        part(new CylinderGeometry(0.21, 0.21, 0.1, 10), '#121625', [0, 1.48, 0.02]),
        part(new BoxGeometry(0.3, 0.03, 0.18), '#050506', [0, 1.44, 0.18]),
        part(new TorusGeometry(0.21, 0.02, 4, 12), '#c9a63a', [0, 1.46, 0.02], [1, 1, 1], [Math.PI / 2, 0, 0]),
        part(new BoxGeometry(0.08, 0.08, 0.22), '#30343c', [0.38, 1.08, 0.48]),
        part(dot(0.06), '#fff3a0', [0.38, 1.08, 0.6]),
        part(dot(0.03), '#ff3a2a', [0.065, 1.33, 0.2]),
        part(dot(0.03), '#ff3a2a', [-0.065, 1.33, 0.2]),
      ]);
  }
}
