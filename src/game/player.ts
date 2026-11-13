import { BoxGeometry, Group, Mesh, MeshToonMaterial, Vector3 } from 'three';
import { Character } from '../characters/character';
import { PIOTREK } from '../content/characters';
import { TUNING } from '../content/tuning';
import { toonRamp } from '../render/toon';
import type { Input } from './input';
import type { World } from './world';

const P = TUNING.player;

export interface PlayerEvents {
  jump(): void;
  land(impact: number): void;
  slide(): void;
}

/** Piotrek: momentum movement (Quake-style acceleration, coyote time, jump buffer, slide, bunny hop). */
export class Player {
  readonly pos = new Vector3();
  readonly prev = new Vector3();
  readonly vel = new Vector3();
  onGround = true;
  sliding = false;
  facing = 0;
  hp: number = P.maxHp;
  maxHp: number = P.maxHp;
  invulnerable = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private sinceLand = 1;
  private slideTime = 0;
  private slideCooldown = 0;
  private jumpCut = false;
  private fastFalling = false;
  hurtTime = 0;
  swingTime = 1;
  swingDir = 0;
  landSquash = 0;
  readonly avatar: Character;
  private readonly rig = new Group();
  private runPhase = 0;
  private expressionTimer = 0;

  constructor(private readonly world: World) {
    this.avatar = new Character(PIOTREK);
    this.rig.add(this.avatar.root);
    const briefcase = new Group();
    const mat = new MeshToonMaterial({ color: '#6b4426', gradientMap: toonRamp() });
    briefcase.add(new Mesh(new BoxGeometry(0.34, 0.26, 0.08), mat));
    const handle = new Mesh(new BoxGeometry(0.12, 0.05, 0.03), new MeshToonMaterial({ color: '#2b1c12', gradientMap: toonRamp() }));
    handle.position.y = 0.15;
    briefcase.add(handle);
    briefcase.position.set(0, -0.2, 0.02);
    this.avatar.joints.wristR.add(briefcase);
  }

  get object(): Group {
    return this.rig;
  }

  reset(): void {
    this.pos.set(0, 0, 0);
    this.prev.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp = P.maxHp;
    this.invulnerable = 0;
    this.onGround = true;
    this.sliding = false;
    this.facing = Math.PI;
    this.hurtTime = 0;
    this.swingTime = 1;
    this.avatar.setExpression('neutral');
  }

  private accelerate(wx: number, wz: number, wishSpeed: number, accel: number, dt: number): void {
    const current = this.vel.x * wx + this.vel.z * wz;
    const add = wishSpeed - current;
    if (add <= 0) return;
    const a = Math.min(accel * wishSpeed * dt, add);
    this.vel.x += a * wx;
    this.vel.z += a * wz;
  }

  update(dt: number, input: Input, camYaw: number, speedMul: number, ev: PlayerEvents): void {
    this.prev.copy(this.pos);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    this.sinceLand += dt;
    this.landSquash = Math.max(0, this.landSquash - dt * 5);
    if (input.consume('jump')) this.jumpBuffer = P.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    const slidePressed = input.consume('slide');

    // Camera-relative wish direction.
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    let wx = rx * input.moveX + fx * input.moveY;
    let wz = rz * input.moveX + fz * input.moveY;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    const wishLen = Math.min(1, wl);
    const dirX = wl > 0 ? wx / wl : 0;
    const dirZ = wl > 0 ? wz / wl : 0;
    const run = P.runSpeed * speedMul;
    const hspeed = Math.hypot(this.vel.x, this.vel.z);

    // Slide: a burst along the current motion with little friction; in the air it slams you down.
    if (slidePressed && this.slideCooldown <= 0) {
      if (this.onGround && hspeed > 1.5) {
        this.startSlide(dirX, dirZ, hspeed);
        ev.slide();
      } else if (!this.onGround && !this.fastFalling) {
        this.fastFalling = true;
        this.vel.y = Math.min(this.vel.y, -P.fastFallSpeed);
      }
    }
    if (this.sliding) {
      this.slideTime -= dt;
      if (this.slideTime <= 0 || hspeed < 2.2 || !this.onGround) this.endSlide();
    }

    if (this.onGround) {
      this.coyote = P.coyoteTime;
      const bhop = this.sinceLand < P.bhopWindow && this.jumpBuffer > 0;
      if (!bhop) {
        const friction = this.sliding ? P.slideFriction : P.friction;
        const drop = Math.max(hspeed, P.stopSpeed) * friction * dt;
        const k = hspeed > 0 ? Math.max(0, hspeed - drop) / hspeed : 0;
        this.vel.x *= k;
        this.vel.z *= k;
      }
      if (this.sliding) this.accelerate(dirX, dirZ, run * 0.3 * wishLen, P.groundAccel * 0.3, dt);
      else this.accelerate(dirX, dirZ, run * wishLen, P.groundAccel, dt);
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      // Air: keep momentum, steer gently; strafing still adds a little speed (bunny hops).
      this.accelerate(dirX, dirZ, Math.max(P.airWishSpeed, run * 0.9) * wishLen, P.airAccel, dt);
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > P.airMaxSpeed) {
        this.vel.x *= P.airMaxSpeed / hs;
        this.vel.z *= P.airMaxSpeed / hs;
      }
    }

    // Jump (buffered, with coyote time). Jumping right after landing keeps speed and adds a little.
    if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
      this.jumpBuffer = 0;
      this.coyote = 0;
      if (this.sliding) {
        this.vel.x *= P.slideJumpBoost;
        this.vel.z *= P.slideJumpBoost;
        this.endSlide();
      }
      if (this.sinceLand < P.bhopWindow) {
        const hs = Math.hypot(this.vel.x, this.vel.z);
        if (hs > 0.5) {
          const boost = Math.min(P.bhopBoost, P.airMaxSpeed - hs);
          if (boost > 0) {
            this.vel.x += (this.vel.x / hs) * boost;
            this.vel.z += (this.vel.z / hs) * boost;
          }
        }
      }
      this.vel.y = P.jumpVelocity;
      this.onGround = false;
      this.jumpCut = false;
      ev.jump();
    }
    if (!this.onGround && !this.jumpCut && this.vel.y > 0 && !input.isHeld('jump')) {
      this.vel.y *= P.jumpCut;
      this.jumpCut = true;
    }

    if (!this.onGround) this.vel.y -= P.gravity * (this.vel.y < 0 ? P.fallGravityMul : 1) * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.world.collide(this.pos, P.radius, P.height, P.stepHeight)) {
      // Lose the velocity that went into the wall (approximate: damp, keep the tangential part).
      const ax = this.pos.x - this.prev.x;
      const az = this.pos.z - this.prev.z;
      const moved = Math.hypot(ax, az) / dt;
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > moved + 0.5 && hs > 0) {
        const k = Math.max(moved, 0) / hs;
        this.vel.x *= k;
        this.vel.z *= k;
      }
    }

    const ground = this.world.groundAt(this.pos.x, this.pos.z, P.radius * 0.6, this.pos.y + P.stepHeight);
    if (this.pos.y <= ground && this.vel.y <= 0) {
      const impact = -this.vel.y;
      this.pos.y = ground;
      this.vel.y = 0;
      if (!this.onGround) {
        this.onGround = true;
        this.sinceLand = 0;
        this.fastFalling = false;
        this.landSquash = Math.min(1, impact / 16);
        ev.land(impact);
        if (input.isHeld('slide') && Math.hypot(this.vel.x, this.vel.z) > 2 && this.slideCooldown <= 0) {
          this.startSlide(dirX, dirZ, Math.hypot(this.vel.x, this.vel.z));
          ev.slide();
        }
      }
    } else if (this.onGround && this.pos.y > ground + 0.05) {
      if (this.pos.y - ground < P.stepHeight + 0.05 && this.vel.y <= 0) this.pos.y = ground;
      else this.onGround = false;
    }

    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.6 && !this.sliding) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 14);
    }
    this.swingTime += dt;
  }

  private startSlide(dirX: number, dirZ: number, hspeed: number): void {
    let x = this.vel.x;
    let z = this.vel.z;
    if (dirX || dirZ) {
      x = dirX * hspeed;
      z = dirZ * hspeed;
    }
    const l = Math.hypot(x, z) || 1;
    const speed = Math.min(P.slideMaxSpeed, hspeed + P.slideBoost);
    this.vel.x = (x / l) * speed;
    this.vel.z = (z / l) * speed;
    this.facing = Math.atan2(this.vel.x, this.vel.z);
    this.sliding = true;
    this.slideTime = P.slideDuration;
  }

  private endSlide(): void {
    if (!this.sliding) return;
    this.sliding = false;
    this.slideCooldown = P.slideCooldown;
  }

  hurt(): void {
    this.hurtTime = 0.35;
    this.expressionTimer = 0.8;
    this.avatar.setExpression('butthurt');
  }

  swing(dir: number): void {
    this.swingTime = 0;
    this.swingDir = dir;
  }

  celebrate(): void {
    this.expressionTimer = 1.4;
    this.avatar.setExpression('smirk');
  }

  /** Interpolated transform plus procedural animation of the rig. */
  render(alpha: number, dt: number, time: number): void {
    const x = this.prev.x + (this.pos.x - this.prev.x) * alpha;
    const y = this.prev.y + (this.pos.y - this.prev.y) * alpha;
    const z = this.prev.z + (this.pos.z - this.prev.z) * alpha;
    this.rig.position.set(x, y, z);
    this.rig.rotation.y = this.facing;
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) this.avatar.setExpression('neutral');
    }
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const run = this.onGround && !this.sliding ? Math.min(1, speed / P.runSpeed) : 0;
    this.runPhase += dt * (4 + speed * 1.35) * (run > 0.05 ? 1 : 0);
    const j = this.avatar.joints;
    const k = 1 - Math.exp(-dt * 18);
    const set = (o: { rotation: { x: number; y: number; z: number } }, rx: number, ry: number, rz: number): void => {
      o.rotation.x += (rx - o.rotation.x) * k;
      o.rotation.y += (ry - o.rotation.y) * k;
      o.rotation.z += (rz - o.rotation.z) * k;
    };
    const p = this.runPhase;
    const s = Math.sin(p);
    const breath = Math.sin(time * 1.6);
    let hipsY = 0.77;
    if (this.sliding) {
      hipsY = 0.42;
      set(j.hips, 0, 0, 0);
      set(j.chest, -0.5, 0, 0);
      set(j.head, 0.35, 0, 0);
      set(j.thighL, -1.35, 0, 0.1);
      set(j.kneeL, 0.15, 0, 0);
      set(j.thighR, -0.7, 0, -0.15);
      set(j.kneeR, 1.4, 0, 0);
      set(j.shoulderL, 0.7, 0, 0.6);
      set(j.shoulderR, 0.7, 0, -0.6);
      set(j.elbowL, -0.3, 0, 0);
      set(j.elbowR, -0.3, 0, 0);
    } else if (!this.onGround) {
      const rise = Math.max(-1, Math.min(1, this.vel.y / 8));
      set(j.hips, 0, 0, 0);
      set(j.chest, 0.12 - rise * 0.1, 0, 0);
      set(j.head, -0.05, 0, 0);
      set(j.thighL, -0.9 + rise * 0.2, 0, 0.08);
      set(j.kneeL, 1.1, 0, 0);
      set(j.thighR, -0.3 - rise * 0.2, 0, -0.08);
      set(j.kneeR, 0.6, 0, 0);
      set(j.shoulderL, -0.4 - rise * 0.4, 0, 0.7);
      set(j.shoulderR, -0.4 - rise * 0.4, 0, -0.7);
      set(j.elbowL, -0.5, 0, 0);
      set(j.elbowR, -0.5, 0, 0);
    } else {
      const a = run * 0.95;
      hipsY = 0.77 + Math.abs(Math.cos(p)) * 0.05 * run - this.landSquash * 0.12;
      set(j.hips, 0, s * 0.12 * run, 0);
      set(j.chest, -0.02 + 0.22 * run + breath * 0.012 * (1 - run), -s * 0.18 * run, 0);
      set(j.head, 0.03 - 0.12 * run, s * 0.08 * run, 0);
      set(j.thighL, -s * a, 0, 0.03);
      set(j.thighR, s * a, 0, -0.03);
      set(j.kneeL, 0.05 + Math.max(0, Math.sin(p + 1.5)) * a * 1.4, 0, 0);
      set(j.kneeR, 0.05 + Math.max(0, Math.sin(p + Math.PI + 1.5)) * a * 1.4, 0, 0);
      set(j.shoulderL, 0.04 + s * a * 0.85, 0, 0.13 + 0.05 * run);
      set(j.shoulderR, 0.04 - s * a * 0.85, 0, -0.13 - 0.05 * run);
      set(j.elbowL, -0.16 - 0.9 * run, 0, 0);
      set(j.elbowR, -0.16 - 0.9 * run, 0, 0);
    }
    // Briefcase swing with the right arm, layered on top of locomotion.
    const swing = Math.min(1, this.swingTime / 0.24);
    if (swing < 1) {
      const e = 1 - Math.pow(1 - swing, 3);
      j.shoulderR.rotation.order = 'YXZ';
      j.shoulderR.rotation.set(-1.45, -1.4 + e * 2.6, 0);
      j.elbowR.rotation.set(-0.2, 0, 0);
      j.chest.rotation.y = (-0.5 + e * 1.1) * 0.6;
    } else {
      j.shoulderR.rotation.order = 'XYZ';
    }
    j.ankleL.rotation.x = -j.thighL.rotation.x * 0.3;
    j.ankleR.rotation.x = -j.thighR.rotation.x * 0.3;
    if (this.hurtTime > 0) j.head.rotation.x -= this.hurtTime * 0.8;
    j.hips.position.y += (hipsY - j.hips.position.y) * k;
    const sq = this.landSquash;
    this.avatar.root.scale.set(1 + sq * 0.12, 1 - sq * 0.16, 1 + sq * 0.12);
  }
}
