// The train that finally runs again: it rolls through the station once the stolen rails are back.

import { Group, Mesh, MeshBasicMaterial, MeshToonMaterial, type Scene } from 'three';
import { BoxGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tinted } from '../render/tint';
import { toonRamp } from '../render/toon';

/** One EN57-ish unit: three cars in PKP blue and yellow, lit windows, a white cab stripe. */
function car(front: boolean): Mesh {
  const parts = [
    tinted(new BoxGeometry(3, 2.1, 19), '#1d4f9c', 0, 2, 0),
    tinted(new BoxGeometry(3.04, 0.5, 19.04), '#ffd23a', 0, 1.1, 0),
    tinted(new BoxGeometry(3.06, 0.16, 19.06), '#d8d2cb', 0, 3.1, 0),
    // Window band inside the body, not a slab on the roof.
    tinted(new BoxGeometry(3.08, 0.62, 17), '#141a2e', 0, 2.55, 0),
    tinted(new BoxGeometry(2.6, 0.55, 2.4), '#2a2f3d', 0, 0.3, 7.2),
    tinted(new BoxGeometry(2.6, 0.55, 2.4), '#2a2f3d', 0, 0.3, -7.2),
    ...[7.2, -7.2].flatMap((z) => [-1.1, 1.1].map((x) => tinted(new BoxGeometry(0.3, 0.86, 0.86), '#1c1c1c', x, 0.06, z))),
  ];
  if (front) {
    parts.push(tinted(new BoxGeometry(2.9, 1.1, 0.3), '#f2efe8', 0, 2.5, 9.5));
    parts.push(tinted(new BoxGeometry(2.4, 0.9, 0.12), '#0d1a2c', 0, 2.6, 9.62));
  }
  const body = new Mesh(mergeGeometries(parts), new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
  const windows = new Mesh(new BoxGeometry(3.1, 0.44, 16.6), new MeshBasicMaterial({ color: '#ffd98a', fog: true }));
  windows.position.y = 2.55;
  body.add(windows);
  return body;
}

/** A three-car train that crosses the arena along the track, left to right. */
export class Train {
  private readonly group = new Group();
  private z = 0;
  private running = false;

  constructor(scene: Scene) {
    for (let i = 0; i < 3; i++) {
      const c = car(i === 0);
      c.position.z = -i * 19.4;
      this.group.add(c);
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Puts the train on the track at `z` (metres) and starts it off-screen. */
  start(z: number): void {
    this.z = z;
    this.running = true;
    this.group.rotation.y = Math.PI / 2;
    // Park it off-screen before showing it: otherwise it stands on Piotrek for the whole rebuild.
    this.update(0);
    this.group.visible = true;
  }

  stop(): void {
    this.running = false;
    this.group.visible = false;
  }

  /** `t` from 0 to 1 drives it across; returns true while it is still on screen. */
  update(t: number): boolean {
    if (!this.running) return false;
    // Wheels on the rail head (rail top sits at about 0.37 m).
    this.group.position.set(-150 + t * 300, 0.05, this.z);
    return t < 1;
  }
}
