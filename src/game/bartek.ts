// Bartek D. in the flesh for the finale: the character from the photos on a white plastic garden chair,
// a porcelain cup of kopi luwak in his hand and its saucer in the other, and the stick ("kij w dupie",
// literally, as in the saying) poking out behind him. The boss controller moves an invisible enemy; this
// follows it and acts out sitting, standing up, walking, sipping, getting hit and losing the cup.

import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshToonMaterial, TorusGeometry, Vector3, type Material, type Scene } from 'three';
import { Character } from '../characters/character';
import { BARTEK, type Expression } from '../content/characters';
import { toonRamp } from '../render/toon';

const toon = (color: string): MeshToonMaterial => new MeshToonMaterial({ color, gradientMap: toonRamp() });

/** A white monobloc garden chair: seat, slatted back, four splayed legs. */
function chair(): Group {
  const g = new Group();
  const white = toon('#eceee8');
  const seat = new Mesh(new BoxGeometry(0.5, 0.05, 0.46), white);
  seat.position.y = 0.44;
  const back = new Mesh(new BoxGeometry(0.5, 0.42, 0.04), white);
  back.position.set(0, 0.68, -0.22);
  back.rotation.x = -0.18;
  for (let k = 0; k < 3; k++) {
    const slot = new Mesh(new BoxGeometry(0.06, 0.24, 0.045), toon('#c9cbc4'));
    slot.position.set(-0.14 + k * 0.14, 0.7, -0.22);
    slot.rotation.x = -0.18;
    g.add(slot);
  }
  for (const [x, z] of [
    [-0.21, -0.19],
    [0.21, -0.19],
    [-0.21, 0.19],
    [0.21, 0.19],
  ] as const) {
    const leg = new Mesh(new BoxGeometry(0.045, 0.46, 0.045), white);
    leg.position.set(x * 1.06, 0.22, z * 1.06);
    leg.rotation.set(z * 0.3, 0, -x * 0.3);
    g.add(leg);
  }
  for (const x of [-0.25, 0.25]) {
    const arm = new Mesh(new BoxGeometry(0.05, 0.04, 0.4), white);
    arm.position.set(x, 0.6, -0.02);
    g.add(arm);
  }
  g.add(seat, back);
  return g;
}

/** The porcelain cup with its coffee, and the saucer (also the trophy in the hub's display case). */
export function cup(): { cup: Group; saucer: Mesh } {
  const china = toon('#f4f2ec');
  const g = new Group();
  const body = new Mesh(new CylinderGeometry(0.038, 0.03, 0.06, 14), china);
  const coffee = new Mesh(new CylinderGeometry(0.034, 0.034, 0.004, 14), toon('#3a2214'));
  coffee.position.y = 0.026;
  const rim = new Mesh(new TorusGeometry(0.037, 0.004, 6, 16), toon('#d9b44a'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.03;
  const handle = new Mesh(new TorusGeometry(0.016, 0.005, 6, 12), china);
  handle.position.set(0.042, 0, 0);
  g.add(body, coffee, rim, handle);
  const saucer = new Mesh(new CylinderGeometry(0.07, 0.05, 0.01, 16), china);
  return { cup: g, saucer };
}

export class BartekRig {
  readonly character = new Character(BARTEK);
  readonly root = new Group();
  readonly chair = chair();
  private readonly cup: Group;
  private readonly saucer: Mesh;
  /** The cup that flies after the slap: one, reused by every finale. */
  private readonly loose = cup().cup;
  /** Every material of the body, for the hit flash. */
  private readonly materials: MeshToonMaterial[] = [];
  private readonly flashColor = new Color('#ff7a5c');
  private seated = true;
  private standT = 0;
  private sipT = 1;
  private flashT = 0;
  private walk = 0;
  private holdsCup = true;

  constructor(private readonly scene: Scene) {
    this.root.add(this.character.root);
    const parts = cup();
    this.cup = parts.cup;
    this.saucer = parts.saucer;
    this.cup.position.set(0.0, -0.1, 0.05);
    this.character.joints.wristR.add(this.cup);
    this.saucer.position.set(0, -0.1, 0.04);
    this.character.joints.wristL.add(this.saucer);
    // The stick, poking out behind him like in the saying (and nothing like anything else).
    const stick = new Mesh(new CylinderGeometry(0.03, 0.036, 0.9, 8), toon('#8a5a32'));
    stick.rotation.x = -Math.PI / 2 + 0.35;
    stick.position.set(0, -0.06 + Math.sin(0.35) * 0.4, -0.16 - Math.cos(0.35) * 0.4);
    const knot = new Mesh(new CylinderGeometry(0.04, 0.04, 0.05, 8), toon('#6e4526'));
    knot.position.y = 0.12;
    stick.add(knot);
    this.character.joints.hips.add(stick);
    this.character.root.traverse((o) => {
      const m = (o as Mesh).material as Material | Material[] | undefined;
      for (const x of Array.isArray(m) ? m : m ? [m] : []) if (x instanceof MeshToonMaterial && !this.materials.includes(x)) this.materials.push(x);
    });
    scene.add(this.root, this.chair);
  }

  /** Back on his chair at the seat, cup in hand, for a new run. */
  reset(seat: readonly [number, number, number]): void {
    this.seated = true;
    this.standT = 0;
    this.sipT = 1;
    this.flashT = 0;
    this.holdsCup = true;
    this.cup.visible = true;
    this.saucer.visible = true;
    this.chair.visible = true;
    this.chair.position.set(seat[0], seat[1], seat[2]);
    this.chair.rotation.y = 0;
    this.root.position.set(seat[0], seat[1], seat[2] + 0.06);
    this.root.rotation.set(0, 0, 0);
    this.root.visible = true;
    this.character.setExpression('smirk');
  }

  /** The intro poses him without his chair or cup (stealing rails is a two-handed job). */
  props(chair: boolean, cup: boolean): void {
    this.chair.visible = chair;
    this.cup.visible = cup;
    this.saucer.visible = cup;
    this.holdsCup = cup;
  }

  /** Where the boss is now (he faces Piotrek). */
  place(x: number, y: number, z: number, yaw: number): void {
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    this.walk += Math.hypot(dx, dz) * 9;
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  /** He gets up from the chair (at once with `instant`, for a shot that starts with him on his feet). */
  standUp(instant = false): void {
    this.seated = false;
    if (instant) this.standT = 1;
  }

  sip(): void {
    if (this.holdsCup) this.sipT = 0;
  }

  hit(): void {
    this.flashT = 0.1;
  }

  setFace(e: Expression): void {
    this.character.setExpression(e);
  }

  /** The cup leaves his hand (the slap): its world position, for the flying copy. */
  loseCup(): Vector3 {
    const p = this.cup.getWorldPosition(new Vector3());
    this.cup.visible = false;
    this.holdsCup = false;
    return p;
  }

  /** A loose copy of the cup, for the slow-motion flight across the car park. */
  cupCopy(): Group {
    this.loose.rotation.set(0, 0, 0);
    return this.loose;
  }

  /** The head's world position (the camera looks here for the slap). */
  head(): Vector3 {
    this.root.updateMatrixWorld(true);
    return this.character.joints.head.getWorldPosition(new Vector3());
  }

  update(dt: number, t: number, moving: boolean): void {
    const j = this.character.joints;
    this.character.idle(t);
    this.standT = this.seated ? 0 : Math.min(1, this.standT + dt * 1.6);
    const sit = 1 - this.standT * this.standT * (3 - 2 * this.standT);
    // Sitting: thighs forward, knees bent, hips down on the seat. Standing up blends it away.
    j.hips.position.y = 0.77 - 0.3 * sit;
    j.thighL.rotation.x = -1.45 * sit;
    j.thighR.rotation.x = -1.45 * sit;
    j.kneeL.rotation.x = 1.45 * sit;
    j.kneeR.rotation.x = 1.45 * sit;
    if (!this.seated && moving && this.standT >= 1) {
      const s = Math.sin(this.walk);
      j.thighL.rotation.x = -s * 0.6;
      j.thighR.rotation.x = s * 0.6;
      j.kneeL.rotation.x = 0.1 + Math.max(0, Math.sin(this.walk + 1.5)) * 0.8;
      j.kneeR.rotation.x = 0.1 + Math.max(0, Math.sin(this.walk + Math.PI + 1.5)) * 0.8;
    }
    // Saucer in the left hand at his belly, cup in the right in front of his chest; a sip lifts it to his mouth.
    j.shoulderL.rotation.set(-0.45, 0, 0.2);
    j.elbowL.rotation.set(-1.1, 0, 0);
    this.sipT = Math.min(1, this.sipT + dt / 1.1);
    const lift = this.sipT < 1 ? Math.sin(this.sipT * Math.PI) : 0;
    j.shoulderR.rotation.set(-0.55 - lift * 0.55, 0, -0.25 + lift * 0.1);
    j.elbowR.rotation.set(-1.25 - lift * 0.75, 0, 0);
    j.head.rotation.x = -lift * 0.25;
    this.flashT = Math.max(0, this.flashT - dt);
    const f = this.flashT > 0 ? 0.6 : 0;
    for (const m of this.materials) m.emissive.copy(this.flashColor).multiplyScalar(f);
  }

  /**
   * In the scene or out of it. The game keeps one rig for its whole life and only takes it out away from
   * Koluszki: building a new one per visit leaked its geometries.
   */
  setActive(on: boolean): void {
    if (on) this.scene.add(this.root, this.chair);
    else this.scene.remove(this.root, this.chair);
  }
}
