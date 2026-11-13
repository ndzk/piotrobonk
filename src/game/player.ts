import { BoxGeometry, Group, Mesh, MeshToonMaterial, Vector3, type Object3D } from 'three';
import { Character } from '../characters/character';
import { PIOTREK } from '../content/characters';
import { TUNING } from '../content/tuning';
import { toonRamp } from '../render/toon';
import type { Input } from './input';
import type { World } from './world';

const P = TUNING.player;

export interface PlayerEvents {
  jump(): void;
  land(impact: number, slam: boolean): void;
  slide(): void;
  slam(): void;
  step(speed: number): void;
}

/** Piotrek: momentum movement (Quake-style acceleration, coyote time, jump/slide buffers, slide, bunny hop). */
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
  dead = false;
  private coyote = 0;
  private jumpBuffer = 0;
  private slideBuffer = 0;
  private sinceLand = 1;
  private slideTime = 0;
  private slideCooldown = 0;
  private slideFatigue = 0;
  private jumpCut = false;
  private fastFalling = false;
  hurtTime = 0;
  swingTime = 1;
  swingDir = 0;
  landSquash = 0;
  private deadTime = 0;
  private runPhase = 0;
  private prevRunPhase = 0;
  private expressionTimer = 0;
  readonly avatar: Character;
  private readonly rig = new Group();

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
    this.dead = false;
    this.deadTime = 0;
    this.facing = Math.PI;
    this.hurtTime = 0;
    this.swingTime = 1;
    this.landSquash = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.slideBuffer = 0;
    this.slideTime = 0;
    this.slideCooldown = 0;
    this.slideFatigue = 0;
    this.fastFalling = false;
    this.sinceLand = 1;
    this.expressionTimer = 0;
    this.avatar.root.rotation.set(0, 0, 0);
    this.avatar.root.position.set(0, 0, 0);
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

  /** One simulation step. With `control` false (dying) input is ignored. */
  update(dt: number, input: Input, camYaw: number, speedMul: number, ev: PlayerEvents, control: boolean): void {
    this.prev.copy(this.pos);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    this.slideFatigue = Math.max(0, this.slideFatigue - dt * 0.8);
    this.sinceLand += dt;
    this.swingTime += dt;
    this.landSquash = Math.max(0, this.landSquash - dt * 5);
    if (this.dead) this.deadTime += dt;
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0 && !this.dead) this.avatar.setExpression('neutral');
    }
    const jumpPressed = control && input.consume('jump');
    const slidePressed = control && input.consume('slide');
    this.jumpBuffer = jumpPressed ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    this.slideBuffer = slidePressed ? P.jumpBuffer : Math.max(0, this.slideBuffer - dt);

    // Camera-relative wish direction.
    const mx = control ? input.moveX : 0;
    const my = control ? input.moveY : 0;
    const fx = -Math.sin(camYaw);
    const fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    const wx = rx * mx + fx * my;
    const wz = rz * mx + fz * my;
    const wl = Math.hypot(wx, wz);
    const wishLen = Math.min(1, wl);
    const dirX = wl > 0 ? wx / wl : 0;
    const dirZ = wl > 0 ? wz / wl : 0;
    const run = P.runSpeed * speedMul;
    const hspeed = Math.hypot(this.vel.x, this.vel.z);

    // Slide: a burst along the motion that never drops below running speed; in the air it slams you down.
    if (this.slideBuffer > 0 && this.slideCooldown <= 0 && !this.sliding) {
      if (this.onGround && hspeed > 1.5) {
        this.slideBuffer = 0;
        this.startSlide(dirX, dirZ, hspeed, run);
        ev.slide();
      } else if (!this.onGround && !this.fastFalling) {
        this.slideBuffer = 0;
        this.fastFalling = true;
        this.vel.y = Math.min(this.vel.y, -P.fastFallSpeed);
        ev.slam();
      }
    }
    if (this.sliding) {
      this.slideTime -= dt;
      if (this.slideTime <= 0 || !this.onGround) this.endSlide();
    }

    if (this.onGround) {
      this.coyote = P.coyoteTime;
      // A jump buffered before touching down skips friction: that is the bunny hop.
      const bhop = this.sinceLand < P.bhopWindow && this.jumpBuffer > 0;
      if (!bhop) {
        const friction = this.sliding ? P.slideFriction : P.friction;
        let target = Math.max(0, hspeed - Math.max(hspeed, P.stopSpeed) * friction * dt);
        if (this.sliding) target = Math.max(target, Math.min(hspeed, run));
        const k = hspeed > 0 ? target / hspeed : 0;
        this.vel.x *= k;
        this.vel.z *= k;
      }
      if (this.sliding) this.accelerate(dirX, dirZ, run * 0.3 * wishLen, P.groundAccel * 0.3, dt);
      else this.accelerate(dirX, dirZ, run * wishLen, P.groundAccel, dt);
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      // Air: keep momentum and steer gently.
      this.accelerate(dirX, dirZ, Math.max(P.airWishSpeed, run * 0.9) * wishLen, P.airAccel, dt);
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > P.airMaxSpeed) {
        this.vel.x *= P.airMaxSpeed / hs;
        this.vel.z *= P.airMaxSpeed / hs;
      }
    }

    if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
      this.jumpBuffer = 0;
      this.coyote = 0;
      if (this.sliding) {
        // Slide-jumps keep the slide's speed; chaining them quickly gives less and less.
        const boost = 1 + (P.slideJumpBoost - 1) / (1 + this.slideFatigue);
        this.vel.x *= boost;
        this.vel.z *= boost;
        this.endSlide();
      }
      if (this.sinceLand < P.bhopWindow) {
        const hs = Math.hypot(this.vel.x, this.vel.z);
        const boost = Math.min(P.bhopBoost, P.airMaxSpeed - hs);
        if (hs > 0.5 && boost > 0) {
          this.vel.x += (this.vel.x / hs) * boost;
          this.vel.z += (this.vel.z / hs) * boost;
        }
      }
      this.vel.y = P.jumpVelocity;
      this.onGround = false;
      this.jumpCut = false;
      ev.jump();
    }
    if (!this.onGround && !this.jumpCut && this.vel.y > 0 && !(control && input.isHeld('jump'))) {
      this.vel.y *= P.jumpCut;
      this.jumpCut = true;
    }
    if (!this.onGround) this.vel.y -= P.gravity * (this.vel.y < 0 ? P.fallGravityMul : 1) * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.world.collide(this.pos, P.radius, P.height, P.stepHeight)) {
      // Slide along walls: remove only the velocity component pointing into them.
      const nl = Math.hypot(this.world.hitX, this.world.hitZ);
      if (nl > 1e-6) {
        const nx = this.world.hitX / nl;
        const nz = this.world.hitZ / nl;
        const into = this.vel.x * nx + this.vel.z * nz;
        if (into < 0) {
          this.vel.x -= nx * into;
          this.vel.z -= nz * into;
        }
      }
    }

    const ground = this.world.groundAt(this.pos.x, this.pos.z, P.radius * 0.6, this.pos.y + P.stepHeight);
    if (this.pos.y <= ground && this.vel.y <= 0) {
      const impact = -this.vel.y;
      this.pos.y = ground;
      this.vel.y = 0;
      if (!this.onGround) {
        const slam = this.fastFalling;
        this.onGround = true;
        this.sinceLand = 0;
        this.fastFalling = false;
        this.landSquash = Math.min(1, impact / 16);
        ev.land(impact, slam);
        if (control && input.isHeld('slide') && Math.hypot(this.vel.x, this.vel.z) > 2 && this.slideCooldown <= 0) {
          this.startSlide(dirX, dirZ, Math.hypot(this.vel.x, this.vel.z), run);
          ev.slide();
        }
      }
    } else if (this.onGround && this.pos.y > ground + 0.05) {
      if (this.pos.y - ground < P.stepHeight + 0.05 && this.vel.y <= 0) this.pos.y = ground;
      else this.onGround = false;
    }

    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.6 && !this.sliding && !this.dead) {
      let d = Math.atan2(this.vel.x, this.vel.z) - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, dt * 14);
    }
    // Run cycle advances with simulation time (it freezes with the game), footsteps on each contact.
    const runAmount = this.onGround && !this.sliding ? Math.min(1, hs / P.runSpeed) : 0;
    this.prevRunPhase = this.runPhase;
    if (runAmount > 0.05) {
      const before = Math.floor(this.runPhase / Math.PI);
      this.runPhase += dt * (4 + hs * 1.35);
      if (runAmount > 0.3 && Math.floor(this.runPhase / Math.PI) !== before) ev.step(hs);
    }
  }

  private startSlide(dirX: number, dirZ: number, hspeed: number, run: number): void {
    let x = this.vel.x;
    let z = this.vel.z;
    if (dirX || dirZ) {
      x = dirX * hspeed;
      z = dirZ * hspeed;
    }
    const l = Math.hypot(x, z) || 1;
    const boost = P.slideBoost / (1 + this.slideFatigue);
    const speed = Math.max(run, Math.min(P.slideMaxSpeed, hspeed + boost));
    this.vel.x = (x / l) * speed;
    this.vel.z = (z / l) * speed;
    this.facing = Math.atan2(this.vel.x, this.vel.z);
    this.sliding = true;
    this.slideTime = P.slideDuration;
    this.slideFatigue += 1;
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

  die(): void {
    this.dead = true;
    this.deadTime = 0;
    this.sliding = false;
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

  private ease(o: Object3D, rx: number, ry: number, rz: number, k: number): void {
    o.rotation.x += (rx - o.rotation.x) * k;
    o.rotation.y += (ry - o.rotation.y) * k;
    o.rotation.z += (rz - o.rotation.z) * k;
  }

  /** Interpolated transform plus procedural animation of the rig (all phases come from the simulation). */
  render(alpha: number, dt: number, time: number): void {
    const x = this.prev.x + (this.pos.x - this.prev.x) * alpha;
    const y = this.prev.y + (this.pos.y - this.prev.y) * alpha;
    const z = this.prev.z + (this.pos.z - this.prev.z) * alpha;
    this.rig.position.set(x, y, z);
    // During a swing the body turns to the target; otherwise it faces the direction of travel.
    const swing = Math.min(1, this.swingTime / 0.24);
    let face = this.facing;
    if (swing < 1 && !this.dead) {
      let d = this.swingDir - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      face += d * (1 - swing * swing) * 0.9;
    }
    this.rig.rotation.y = face;
    // Blink while invulnerable after a hit.
    this.avatar.root.visible = this.invulnerable <= 0 || this.dead || Math.floor(time * 18) % 2 === 0;

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const run = this.onGround && !this.sliding ? Math.min(1, speed / P.runSpeed) : 0;
    const j = this.avatar.joints;
    const k = dt > 0 ? 1 - Math.exp(-dt * 18) : 0;
    const p = this.prevRunPhase + (this.runPhase - this.prevRunPhase) * alpha;
    const s = Math.sin(p);
    const breath = Math.sin(time * 1.6);
    let hipsY = 0.77;
    if (this.dead) {
      // Collapse backwards.
      const t = Math.min(1, this.deadTime / 0.6);
      const e = 1 - (1 - t) * (1 - t);
      this.avatar.root.rotation.x = -1.45 * e;
      this.avatar.root.position.y = 0.12 * e;
      this.ease(j.chest, -0.2, 0, 0, k);
      this.ease(j.head, -0.3, 0.3, 0, k);
      this.ease(j.shoulderL, -0.4, 0, 1.3, k);
      this.ease(j.shoulderR, -0.4, 0, -1.3, k);
      this.ease(j.thighL, -0.4, 0, 0.2, k);
      this.ease(j.thighR, -0.1, 0, -0.2, k);
      this.ease(j.kneeL, 0.6, 0, 0, k);
      this.ease(j.kneeR, 0.2, 0, 0, k);
    } else if (this.sliding) {
      hipsY = 0.42;
      this.ease(j.hips, 0, 0, 0, k);
      this.ease(j.chest, -0.5, 0, 0, k);
      this.ease(j.head, 0.35, 0, 0, k);
      this.ease(j.thighL, -1.35, 0, 0.1, k);
      this.ease(j.kneeL, 0.15, 0, 0, k);
      this.ease(j.thighR, -0.7, 0, -0.15, k);
      this.ease(j.kneeR, 1.4, 0, 0, k);
      this.ease(j.shoulderL, 0.7, 0, 0.6, k);
      this.ease(j.shoulderR, 0.7, 0, -0.6, k);
      this.ease(j.elbowL, -0.3, 0, 0, k);
      this.ease(j.elbowR, -0.3, 0, 0, k);
    } else if (!this.onGround) {
      const rise = Math.max(-1, Math.min(1, this.vel.y / 8));
      const tuck = this.fastFalling ? 1 : 0;
      this.ease(j.hips, 0, 0, 0, k);
      this.ease(j.chest, 0.12 - rise * 0.1 + tuck * 0.3, 0, 0, k);
      this.ease(j.head, -0.05, 0, 0, k);
      this.ease(j.thighL, -0.9 + rise * 0.2 - tuck * 0.5, 0, 0.08, k);
      this.ease(j.kneeL, 1.1 + tuck * 0.6, 0, 0, k);
      this.ease(j.thighR, -0.3 - rise * 0.2 - tuck * 0.8, 0, -0.08, k);
      this.ease(j.kneeR, 0.6 + tuck * 0.9, 0, 0, k);
      this.ease(j.shoulderL, -0.4 - rise * 0.4 - tuck * 1.2, 0, 0.7, k);
      this.ease(j.shoulderR, -0.4 - rise * 0.4 - tuck * 1.2, 0, -0.7, k);
      this.ease(j.elbowL, -0.5, 0, 0, k);
      this.ease(j.elbowR, -0.5, 0, 0, k);
    } else {
      const a = run * 0.95;
      hipsY = 0.77 + Math.abs(Math.cos(p)) * 0.05 * run - this.landSquash * 0.12;
      this.ease(j.hips, 0, s * 0.12 * run, 0, k);
      this.ease(j.chest, -0.02 + 0.22 * run + breath * 0.012 * (1 - run), -s * 0.18 * run, 0, k);
      this.ease(j.head, 0.03 - 0.12 * run, s * 0.08 * run, 0, k);
      this.ease(j.thighL, -s * a, 0, 0.03, k);
      this.ease(j.thighR, s * a, 0, -0.03, k);
      this.ease(j.kneeL, 0.05 + Math.max(0, Math.sin(p + 1.5)) * a * 1.4, 0, 0, k);
      this.ease(j.kneeR, 0.05 + Math.max(0, Math.sin(p + Math.PI + 1.5)) * a * 1.4, 0, 0, k);
      this.ease(j.shoulderL, 0.04 + s * a * 0.85, 0, 0.13 + 0.05 * run, k);
      this.ease(j.shoulderR, 0.04 - s * a * 0.85, 0, -0.13 - 0.05 * run, k);
      this.ease(j.elbowL, -0.16 - 0.9 * run, 0, 0, k);
      this.ease(j.elbowR, -0.16 - 0.9 * run, 0, 0, k);
    }
    if (!this.dead) {
      this.avatar.root.rotation.x = 0;
      this.avatar.root.position.y = 0;
    }
    // Briefcase swing with the right arm, layered on top of locomotion.
    if (swing < 1 && !this.dead) {
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
