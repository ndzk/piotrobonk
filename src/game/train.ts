// The train that finally runs again: it rolls through the station once the stolen rails are back, and at
// the end of the line it stops at Koluszki and opens a door for Piotrek.

import { Group, Mesh, MeshBasicMaterial, MeshToonMaterial, type Scene } from 'three';
import { BoxGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tinted } from '../render/tint';
import { toonRamp } from '../render/toon';

/** Where the front car's platform-side door is, along the train from its origin (metres). */
export const DOOR_OFFSET = 4;

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
    // Door frames on both sides, front and back of every car.
    ...[DOOR_OFFSET, -DOOR_OFFSET].flatMap((z) => [-1, 1].map((side) => tinted(new BoxGeometry(0.1, 2, 1.5), '#ffd23a', side * 1.53, 1.95, z))),
    ...[DOOR_OFFSET, -DOOR_OFFSET].flatMap((z) => [-1, 1].map((side) => tinted(new BoxGeometry(0.1, 1.8, 1.2), '#0b0e18', side * 1.545, 1.95, z))),
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

/** A three-car train along the track, heading +x. */
export class Train {
  private readonly group = new Group();
  /** The door that opens for Piotrek: platform side (+z in the world) of the front car. */
  private readonly door: Mesh;
  private z = 0;
  private running = false;

  constructor(scene: Scene) {
    for (let i = 0; i < 3; i++) {
      const c = car(i === 0);
      c.position.z = -i * 19.4;
      this.group.add(c);
    }
    this.door = new Mesh(new BoxGeometry(0.08, 1.8, 1.2), new MeshToonMaterial({ color: '#d8d2cb', gradientMap: toonRamp() }));
    this.door.position.set(-1.6, 1.95, DOOR_OFFSET);
    const pane = new Mesh(new BoxGeometry(0.1, 0.62, 0.8), new MeshBasicMaterial({ color: '#ffd98a', fog: true }));
    pane.position.y = 0.45;
    this.door.add(pane);
    this.group.add(this.door);
    this.group.visible = false;
    scene.add(this.group);
  }

  /**
   * Puts the train on the track at `z` (metres). It stays out of sight until it is first driven (`update`
   * or `place`): parked at the far end it showed over the horizon through the whole rebuild.
   */
  start(z: number): void {
    this.z = z;
    this.running = true;
    this.group.rotation.y = Math.PI / 2;
    this.setDoor(0);
    this.group.visible = false;
  }

  stop(): void {
    this.running = false;
    this.group.visible = false;
  }

  /** `t` from 0 to 1 drives it across; returns true while it is still on screen. */
  update(t: number): boolean {
    if (!this.running) return false;
    // Wheels on the rail head (rail top sits at about 0.37 m).
    this.place(-150 + t * 300);
    return t < 1;
  }

  /** The front of the train at `x` (the ending drives it by hand: arrive, stop, leave). */
  place(x: number): void {
    this.group.position.set(x, 0.05, this.z);
    this.group.visible = true;
  }

  /** The front door, 0 shut to 1 open (it slides back along the car). */
  setDoor(open: number): void {
    this.door.position.z = DOOR_OFFSET - open * 1.25;
  }
}
