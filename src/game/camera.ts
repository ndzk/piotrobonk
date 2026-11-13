import { PerspectiveCamera, Vector3 } from 'three';
import { TUNING } from '../content/tuning';
import type { Input } from './input';
import type { World } from './world';

const C = TUNING.camera;
const F = TUNING.feel;

/** Third-person camera: free look, shoulder offset, wall collision, trauma-based screen shake. */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  yaw = Math.PI;
  pitch = -0.28;
  sensitivity = 1;
  invertY = false;
  shakeScale = 1;
  /** True when the camera is pressed so close that the player model should be hidden. */
  close = false;
  private distance: number = C.distance;
  private trauma = 0;
  private shakeTime = 0;
  private smoothY = 0;
  private readonly target = new Vector3();
  private readonly dir = new Vector3();

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(C.fov, aspect, 0.1, 400);
  }

  reset(y: number): void {
    this.trauma = 0;
    this.smoothY = y;
    this.distance = C.distance;
    this.yaw = Math.PI;
    this.pitch = -0.28;
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.shakeScale);
  }

  look(input: Input, dt: number): void {
    const [mx, my] = input.takeLook();
    const s = C.mouseSensitivity * this.sensitivity;
    const inv = this.invertY ? -1 : 1;
    this.yaw -= mx * s;
    this.pitch -= my * s * inv;
    this.yaw -= input.padLookX * C.stickSensitivity * this.sensitivity * dt;
    this.pitch -= input.padLookY * C.stickSensitivity * 0.7 * this.sensitivity * dt * inv;
    this.pitch = Math.max(C.pitchMin, Math.min(C.pitchMax, this.pitch));
  }

  private noise(o: number): number {
    return Math.sin(this.shakeTime * 43 + o) * 0.6 + Math.sin(this.shakeTime * 71 + o * 2) * 0.4;
  }

  /** Places the camera behind the (interpolated) player position. */
  /** Pans to watch the train go by after a station is rebuilt (`t` from 0 to 1). */
  lookAtTrain(t: number): void {
    const cam = this.camera;
    const x = -150 + t * 300;
    cam.position.set(this.target.x - 14, this.target.y + 7, this.target.z - 16);
    cam.lookAt(x * 0.35, 2.5, this.target.z + 10);
  }

  update(px: number, py: number, pz: number, speed: number, world: World, dt: number): void {
    // Vertical follow is damped so step-ups and landings do not jerk the view.
    this.smoothY += (py - this.smoothY) * (dt > 0 ? 1 - Math.exp(-C.follow * dt) : 0);
    if (Math.abs(py - this.smoothY) > 3) this.smoothY = py;
    const cp = Math.cos(this.pitch);
    this.dir.set(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    this.target.set(px + rightX * C.shoulder, this.smoothY + C.height, pz + rightZ * C.shoulder);
    // Four rays (the corners of a small square around the view axis) so grazing a wall does not clip.
    const max = C.distance + C.collisionPadding;
    let hit = max;
    for (let k = 0; k < 4; k++) {
      const ox = (k & 1 ? 0.22 : -0.22) * rightX;
      const oz = (k & 1 ? 0.22 : -0.22) * rightZ;
      const oy = k & 2 ? 0.18 : -0.18;
      hit = Math.min(hit, world.raycast(this.target.x + ox, this.target.y + oy, this.target.z + oz, this.dir.x, this.dir.y, this.dir.z, max));
    }
    let want = Math.max(C.minDistance, Math.min(C.distance, hit - C.collisionPadding));
    // Thin props (a coffee machine, a post) can slip between the four rays: if the camera would still
    // sit inside something, walk it in until it is out.
    for (let k = 0; k < 6 && want > C.minDistance; k++) {
      if (!world.inside(this.target.x + this.dir.x * want, this.target.y + this.dir.y * want, this.target.z + this.dir.z * want, 0.25)) break;
      want = Math.max(C.minDistance, want - 0.6);
    }
    // Snap in when blocked, ease back out when free.
    this.distance = want < this.distance ? want : this.distance + (want - this.distance) * Math.min(1, dt * 4);
    this.close = this.distance < C.hideDistance;
    const cam = this.camera;
    cam.position.copy(this.target).addScaledVector(this.dir, this.distance);
    if (cam.position.y < 0.3) cam.position.y = 0.3;
    cam.lookAt(this.target);

    this.trauma = Math.max(0, this.trauma - F.shakeDecay * dt);
    this.shakeTime += dt;
    if (this.trauma > 0) {
      const t = this.trauma * this.trauma;
      cam.position.x += this.noise(1) * F.shakeMaxOffset * t;
      cam.position.y += this.noise(2) * F.shakeMaxOffset * t;
      cam.rotation.z += this.noise(3) * F.shakeMaxAngle * t;
    }
    const fov = C.fov + Math.min(1, Math.max(0, speed - TUNING.player.runSpeed) / 6) * C.fovSpeedBoost;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 5);
      cam.updateProjectionMatrix();
    }
  }
}
