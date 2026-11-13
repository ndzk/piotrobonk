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
  private distance: number = C.distance;
  private trauma = 0;
  private shakeTime = 0;
  sensitivity = 1;
  invertY = false;
  shakeScale = 1;
  private readonly target = new Vector3();
  private readonly dir = new Vector3();

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(C.fov, aspect, 0.1, 400);
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount * this.shakeScale);
  }

  look(input: Input, dt: number): void {
    const [mx, my] = input.takeLook();
    const s = C.mouseSensitivity * this.sensitivity;
    this.yaw -= mx * s;
    this.pitch -= my * s * (this.invertY ? -1 : 1);
    this.yaw -= input.padLookX * C.stickSensitivity * this.sensitivity * dt;
    this.pitch -= input.padLookY * C.stickSensitivity * 0.7 * this.sensitivity * dt * (this.invertY ? -1 : 1);
    this.pitch = Math.max(C.pitchMin, Math.min(C.pitchMax, this.pitch));
  }

  /** Places the camera behind the (interpolated) player position. */
  update(px: number, py: number, pz: number, speed: number, world: World, dt: number): void {
    this.target.set(px, py + C.height, pz);
    const cp = Math.cos(this.pitch);
    // Direction from the target back to the camera, plus the over-the-shoulder offset.
    this.dir.set(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    this.target.x += rightX * C.shoulder;
    this.target.z += rightZ * C.shoulder;
    const hit = world.raycast(this.target.x, this.target.y, this.target.z, this.dir.x, this.dir.y, this.dir.z, C.distance + C.collisionPadding);
    const want = Math.max(C.minDistance, Math.min(C.distance, hit - C.collisionPadding));
    // Snap in when blocked, ease back out when free.
    this.distance = want < this.distance ? want : this.distance + (want - this.distance) * Math.min(1, dt * 4);
    const cam = this.camera;
    cam.position.copy(this.target).addScaledVector(this.dir, this.distance);
    if (cam.position.y < 0.3) cam.position.y = 0.3;
    cam.lookAt(this.target);

    this.trauma = Math.max(0, this.trauma - F.shakeDecay * dt);
    this.shakeTime += dt;
    if (this.trauma > 0) {
      const t = this.trauma * this.trauma;
      const n = (o: number): number => Math.sin(this.shakeTime * 43 + o) * 0.6 + Math.sin(this.shakeTime * 71 + o * 2) * 0.4;
      cam.position.x += n(1) * F.shakeMaxOffset * t;
      cam.position.y += n(2) * F.shakeMaxOffset * t;
      cam.rotation.z += n(3) * F.shakeMaxAngle * t;
    }
    const fov = C.fov + Math.min(1, Math.max(0, speed - TUNING.player.runSpeed) / 6) * C.fovSpeedBoost;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 5);
      cam.updateProjectionMatrix();
    }
  }
}
