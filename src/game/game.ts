import { Color, Scene, type WebGLRenderer } from 'three';
import { audio } from '../audio/audio';
import { ENEMIES } from '../content/enemies';
import { FALLBACK_CARD, PASSIVES } from '../content/items';
import { TRACKS } from '../content/music';
import { FABRYCZNA } from '../content/stations';
import { TUNING } from '../content/tuning';
import { UI } from '../content/ui';
import { Rng, hashSeed } from '../core/rng';
import type { Settings } from '../core/settings';
import { BlobShadows, DamageNumbers, Particles, Swooshes } from '../render/fx';
import { DebugPanel } from '../ui/debug';
import { Hud } from '../ui/hud';
import { LevelUpScreen } from '../ui/levelup';
import { PauseScreen, SummaryScreen } from '../ui/screens';
import { CameraRig } from './camera';
import { Coins } from './coins';
import { Enemies } from './enemies';
import type { Input } from './input';
import { Player, type PlayerEvents } from './player';
import { applyCard, computeStats, damageTaken, newLoadout, offerCards, xpForLevel, type Card, type Loadout, type OwnedWeapon, type Stats } from './progress';
import { Arsenal, type Combat } from './weapons';
import { World } from './world';

export type GameState = 'idle' | 'playing' | 'levelup' | 'paused' | 'dying' | 'dead';

const DT = 1 / TUNING.simHz;
const sparkColor = new Color('#fff2b0');
const critColor = new Color('#ffcf3a');
const dustColor = new Color('#b8aa98');
const ELITE_TIMES = [180, 300, 420];

export interface GameOptions {
  debug: boolean;
  bot: boolean;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onQuit: () => void;
}

/** Independent random streams, so e.g. a reroll does not change where enemies spawn. */
interface Streams {
  spawn: Rng;
  cards: Rng;
  combat: Rng;
  drops: Rng;
}

/** One run at a station: simulation at a fixed 60 Hz with interpolated rendering, plus its UI. */
export class Game {
  readonly scene = new Scene();
  readonly world: World;
  readonly player: Player;
  readonly cam: CameraRig;
  readonly enemies: Enemies;
  readonly coins: Coins;
  private readonly particles: Particles;
  private readonly numbers: DamageNumbers;
  private readonly shadows: BlobShadows;
  private readonly swooshes: Swooshes;
  private readonly arsenal = new Arsenal();
  private readonly hud: Hud;
  private readonly levelUp: LevelUpScreen;
  private readonly pauseScreen: PauseScreen;
  private readonly summary: SummaryScreen;
  private readonly debug: DebugPanel | null;
  state: GameState = 'idle';
  time = 0;
  level = 1;
  xp = 0;
  seed = 1;
  private rng: Streams = { spawn: new Rng(1), cards: new Rng(2), combat: new Rng(3), drops: new Rng(4) };
  load: Loadout = newLoadout();
  private stats: Stats = computeStats(this.load);
  private pendingLevels = 0;
  private cards: Card[] = [];
  private counters = { rerolls: 0, skips: 0, banishes: 0 };
  private spawnAcc = 0;
  private leashTimer = 0;
  private nextElite = 0;
  private hitstop = 0;
  private lastCritStop = -10;
  private lastHurtStop = -10;
  private timeScale = 1;
  private deathTimer = 0;
  private acc = 0;
  private visualTime = 0;
  private god = false;
  private coinCombo = 0;
  private coinTimer = 0;
  private wantLock = false;
  private readonly combat: Combat;
  private readonly events: PlayerEvents;
  fps = 60;
  simMs = 0;
  renderMs = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    uiRoot: HTMLElement,
    private readonly input: Input,
    private readonly opts: GameOptions,
  ) {
    this.world = new World(FABRYCZNA, this.scene);
    this.player = new Player(this.world);
    this.scene.add(this.player.object);
    this.cam = new CameraRig(1);
    this.enemies = new Enemies(this.scene, this.world);
    this.coins = new Coins(this.scene, this.world);
    this.particles = new Particles(this.scene);
    this.numbers = new DamageNumbers(this.scene, TUNING.feel.damageNumberLife);
    this.shadows = new BlobShadows(this.scene, TUNING.waves.maxEnemies + 260);
    this.swooshes = new Swooshes(this.scene);
    this.hud = new Hud(uiRoot);
    this.levelUp = new LevelUpScreen(uiRoot);
    this.pauseScreen = new PauseScreen(
      uiRoot,
      () => {
        this.resume();
      },
      () => {
        this.quit();
      },
      opts.settings,
      (s) => {
        this.applySettings(s);
        opts.onSettings(s);
      },
    );
    this.summary = new SummaryScreen(
      uiRoot,
      () => {
        this.summary.close();
        this.start(Date.now());
      },
      () => {
        this.summary.close();
        this.quit();
      },
    );
    this.debug = opts.debug
      ? new DebugPanel(uiRoot, {
          stats: () => this.debugStats(),
          god: (on) => {
            this.god = on;
          },
          level: () => {
            this.xp = xpForLevel(this.level);
          },
          spawn: () => {
            for (let i = 0; i < 100; i++) this.spawnGroup(true, false);
          },
          clear: () => {
            for (let i = 0; i < this.enemies.count; i++) this.enemies.dead[i] = 1;
          },
          vacuum: () => {
            this.coins.vacuum();
          },
        })
      : null;
    this.applySettings(opts.settings);

    this.combat = {
      enemies: this.enemies,
      player: this.player,
      stats: this.stats,
      rng: this.rng.combat,
      hit: (i, amount, crit, dx, dz, kb, w) => {
        this.hitEnemy(i, amount, crit, dx, dz, kb, w);
      },
      swoosh: (x, y, z, angle, arc, radius) => {
        this.swooshes.spawn(x, y, z, angle, arc, radius, '#fff1b8');
      },
      attacked: (hits, crit) => {
        this.attacked(hits, crit);
      },
    };
    this.events = {
      jump: () => {
        audio.play('jump');
      },
      land: (impact, slam) => {
        this.landed(impact, slam);
      },
      slide: () => {
        audio.play('slide');
      },
      slam: () => {
        audio.play('slam');
      },
      step: (speed) => {
        if (this.state === 'playing') audio.play('step', Math.min(1, speed / 9));
      },
    };

    document.addEventListener('pointerlockchange', () => {
      if (this.state === 'playing' && this.wantLock && !this.input.pointerLocked && !this.opts.bot) this.pause();
      if (this.input.pointerLocked) this.wantLock = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing' && !this.opts.bot) this.pause();
        audio.suspend();
      } else audio.resume();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing' && !this.opts.bot) this.pause();
    });
    renderer.domElement.addEventListener('pointerdown', () => {
      if (this.state === 'playing' && !this.input.pointerLocked) this.lock();
    });
  }

  applySettings(s: Settings): void {
    this.cam.sensitivity = s.sensitivity;
    this.cam.invertY = s.invertY;
    this.cam.shakeScale = s.shake ? 1 : 0;
    audio.setVolumes({ music: s.music, sfx: s.sfx, ui: s.sfx });
  }

  /** Compiles every shader and uploads every texture now, so nothing stutters the first time it appears. */
  warmup(): void {
    for (const t of this.player.avatar.textures()) this.renderer.initTexture(t);
    const rng = new Rng(1);
    for (let t = 0; t < ENEMIES.length; t++) this.enemies.spawn(t, 4 + t, 4, 1, 1, rng, t === 0);
    this.coins.drop(2, 0, 2, 1, rng);
    this.particles.burst(0, 1, 0, 4, 2, 0.1, sparkColor);
    this.numbers.spawn(0, 1, 0, 12, 0);
    this.swooshes.spawn(0, 1, 0, 0, 2, 2, '#ffffff');
    this.render(1, 0);
    this.renderer.compile(this.scene, this.cam.camera);
    this.clearEntities();
  }

  resize(w: number, h: number): void {
    this.cam.camera.aspect = w / h;
    this.cam.camera.updateProjectionMatrix();
  }

  private clearEntities(): void {
    this.enemies.clear();
    this.coins.clear();
    this.particles.clear();
    this.numbers.clear();
    this.swooshes.clear();
  }

  start(seed: number): void {
    this.seed = seed;
    const stream = (name: string): Rng => new Rng(hashSeed(`${seed}:${name}`));
    this.rng = { spawn: stream('spawn'), cards: stream('cards'), combat: stream('combat'), drops: stream('drops') };
    this.combat.rng = this.rng.combat;
    this.time = 0;
    this.level = 1;
    this.xp = 0;
    this.pendingLevels = 0;
    this.load = newLoadout();
    this.refreshStats();
    this.counters = { rerolls: TUNING.cards.rerolls, skips: TUNING.cards.skips, banishes: TUNING.cards.banishes };
    this.spawnAcc = 0;
    this.nextElite = 0;
    this.hitstop = 0;
    this.lastCritStop = this.lastHurtStop = -10;
    this.timeScale = 1;
    this.acc = 0;
    this.coinCombo = 0;
    this.clearEntities();
    this.enemies.kills = 0;
    this.arsenal.reset();
    this.player.reset();
    this.cam.reset(0);
    this.levelUp.close();
    this.state = 'playing';
    this.hud.show(true);
    this.updateSlots();
    audio.playMusic(TRACKS.fabryczna);
    audio.musicIntensity(0);
    audio.duckMusic(false);
    if (!audio.unlocked && !this.opts.bot) this.hud.toast(UI.toast.sound);
    this.input.flush();
    this.lock();
  }

  private lock(): void {
    if (this.opts.bot) return;
    this.wantLock = false;
    this.input.lockPointer();
  }

  private refreshStats(): void {
    this.stats = computeStats(this.load);
    this.combat.stats = this.stats;
  }

  private updateSlots(): void {
    this.hud.setSlots([
      ...this.load.weapons.map((w) => ({ id: w.def.id, level: w.level, kind: 'weapon' as const })),
      ...this.load.passives.map((x) => ({ id: x.def.id, level: x.level, kind: 'passive' as const })),
    ]);
  }

  // ---------- Frame & simulation ----------

  frame(dtReal: number): void {
    this.fps += (1 / Math.max(dtReal, 1e-4) - this.fps) * 0.05;
    this.input.poll();
    if (this.debug && this.input.consume('debug')) this.debug.toggle();
    switch (this.state) {
      case 'playing':
        if (this.input.consume('pause')) {
          this.pause();
          break;
        }
        this.cam.look(this.input, dtReal);
        this.advance(dtReal);
        break;
      case 'dying':
        this.advance(dtReal);
        this.deathTimer -= dtReal;
        if (this.deathTimer <= 0) this.showSummary();
        break;
      case 'levelup':
        this.levelUp.setPad(this.input.usingPad);
        this.levelUp.handleInput(this.input);
        // The pause key does nothing while choosing a card (the game is already stopped).
        this.input.consume('pause');
        break;
      case 'paused':
        this.pauseScreen.handleInput(this.input, () => {
          this.resume();
        });
        break;
      case 'dead':
        this.summary.handleInput(this.input);
        break;
      case 'idle':
        break;
    }
    const running = this.state === 'playing' || this.state === 'dying';
    if (running) this.visualTime += dtReal;
    const t0 = performance.now();
    this.render(this.acc / DT, running ? dtReal : 0);
    this.renderMs += (performance.now() - t0 - this.renderMs) * 0.1;
    this.debug?.update(performance.now());
  }

  private advance(dtReal: number): void {
    if (this.hitstop > 0) {
      this.hitstop -= dtReal;
      return;
    }
    this.acc += Math.min(dtReal, 0.1) * this.timeScale;
    let steps = 0;
    while (this.acc >= DT && steps < 6) {
      const t0 = performance.now();
      this.step(DT);
      this.simMs += (performance.now() - t0 - this.simMs) * 0.1;
      this.acc -= DT;
      steps++;
      if (this.state !== 'playing' && this.state !== 'dying') {
        this.acc = 0;
        break;
      }
    }
  }

  private step(dt: number): void {
    this.time += dt;
    const p = this.player;
    const playing = this.state === 'playing';
    p.update(dt, this.input, this.cam.yaw, this.stats.speed, this.events, playing);
    if (p.sliding && p.onGround && Math.floor(this.time * 60) % 2 === 0) {
      this.particles.emit(p.pos.x + (Math.random() - 0.5) * 0.4, p.pos.y + 0.08, p.pos.z + (Math.random() - 0.5) * 0.4, -p.vel.x * 0.15, 1 + Math.random(), -p.vel.z * 0.15, 0.45, 0.12, dustColor, 4, p.pos.y);
    }

    this.enemies.rebuildHash();
    if (playing) this.spawn(dt);
    this.enemies.update(dt, p.pos.x, p.pos.y, p.pos.z, this.time);
    this.enemies.rebuildHash();
    if (playing) {
      this.contact();
      // Death is decided right after damage: before regeneration, and before any level-up in this step.
      if (p.hp <= 0) {
        this.die();
        return;
      }
      p.hp = Math.min(p.maxHp, p.hp + this.stats.regen * dt);
      this.arsenal.update(dt, this.load, this.combat);
    }
    this.enemies.sweep(this.onEnemyDeath);
    this.enemies.finishDeaths(this.onDeathBurst);
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) this.coinCombo = 0;
    this.coins.update(dt, p.pos.x, p.pos.y, p.pos.z, TUNING.player.pickupRadius * this.stats.magnet, this.onCoin);
    this.particles.update(dt);
    this.numbers.update(dt);
    if (playing) this.leash(dt);
    if (!playing) return;

    audio.musicIntensity(this.time < 25 ? 0 : this.time < 80 ? 1 : this.time < 200 ? 2 : 3);
    while (this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      this.pendingLevels++;
    }
    if (this.pendingLevels > 0) this.openLevelUp();
  }

  // Per-step callbacks live in fields so the game loop does not allocate closures.
  private readonly onEnemyDeath = (x: number, y: number, z: number, type: number, elite: boolean): void => {
    const def = ENEMIES[type];
    const drops = elite ? 6 : 1;
    for (let k = 0; k < drops; k++) this.coins.drop(x, y, z, elite ? def.xp * 3 : def.xp, this.rng.drops);
    audio.play(def.id === 'golab' ? 'pigeonDie' : 'enemyDie', elite ? 1 : 0.7);
  };

  private readonly onDeathBurst = (x: number, y: number, z: number, type: number): void => {
    const pal = this.enemies.palette(type);
    // Fewer, smaller chunks when the screen is already busy.
    const busy = this.particles.active;
    const n = busy > 900 ? 3 : busy > 500 ? 5 : 8;
    const floor = ENEMIES[type].flying ? this.world.groundAt(x, z, 0.1, y) : y;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.particles.emit(x, y + 0.4, z, Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s, 0.6 + Math.random() * 0.4, 0.06 + Math.random() * 0.07, pal[k % pal.length], 18, floor);
    }
  };

  private readonly onCoin = (v: number): void => {
    const p = this.player.pos;
    this.xp += v;
    this.coinCombo = Math.min(10, this.coinCombo + 1);
    this.coinTimer = 0.5;
    audio.play('coin', 0.8, 1 + this.coinCombo * 0.02);
    this.particles.emit(p.x, p.y + 1, p.z, (Math.random() - 0.5) * 3, 2.5, (Math.random() - 0.5) * 3, 0.35, 0.07, critColor, 6, p.y);
  };

  private readonly hudState = { hp: 0, maxHp: 0, xp: 0, xpNext: 1, level: 1, time: 0, kills: 0 };

  private spawn(dt: number): void {
    const keys = TUNING.waves.rate;
    let rate: number = keys[keys.length - 1][1];
    for (let k = 0; k < keys.length - 1; k++) {
      const a = keys[k];
      const b = keys[k + 1];
      if (this.time >= a[0] && this.time < b[0]) {
        rate = a[1] + ((b[1] - a[1]) * (this.time - a[0])) / (b[0] - a[0]);
        break;
      }
    }
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      this.spawnGroup(false, false);
    }
    // Elites: at fixed times, then every two minutes.
    const eliteAt = ELITE_TIMES[this.nextElite] ?? (ELITE_TIMES[ELITE_TIMES.length - 1] ?? 420) + (this.nextElite - ELITE_TIMES.length + 1) * 120;
    if (this.time >= eliteAt) {
      this.nextElite++;
      this.spawnGroup(false, true);
    }
  }

  /** Picks a spawn point out of view when possible, on open ground, inside the fence. */
  private spawnPoint(r: Rng, flying: boolean): [number, number] {
    const p = this.player.pos;
    const [r0, r1] = TUNING.waves.spawnRadius;
    const lim = this.world.radius - 3;
    const fx = -Math.sin(this.cam.yaw);
    const fz = -Math.cos(this.cam.yaw);
    let best: [number, number] = [p.x, p.z + r0];
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = r.next() * Math.PI * 2;
      const dist = r0 + r.next() * (r1 - r0);
      let x = p.x + Math.sin(a) * dist;
      let z = p.z + Math.cos(a) * dist;
      const d = Math.hypot(x, z);
      if (d > lim) {
        x *= lim / d;
        z *= lim / d;
      }
      best = [x, z];
      const inView = (Math.sin(a) * fx + Math.cos(a) * fz) > 0.45;
      const onRoof = !flying && this.world.groundAt(x, z, 0.5, 100) > 0.6;
      if ((!inView || attempt >= 4) && !onRoof) return best;
    }
    return best;
  }

  private spawnGroup(any: boolean, elite: boolean): void {
    const r = this.rng.spawn;
    const options = ENEMIES.map((d, i) => ({ d, i })).filter(({ d }) => any || this.time >= d.from);
    let pick = options[0];
    if (elite) pick = options[options.length - 1];
    else {
      const total = options.reduce((s, o) => s + o.d.weight, 0);
      let roll = r.next() * total;
      for (const o of options) {
        roll -= o.d.weight;
        if (roll < 0) {
          pick = o;
          break;
        }
      }
    }
    const [cx, cz] = this.spawnPoint(r, pick.d.flying);
    const minutes = this.time / 60;
    const hpMul = 1 + minutes * TUNING.waves.hpPerMinute;
    const dmgMul = 1 + minutes * TUNING.combat.enemyDamagePerMinute;
    const n = elite ? 1 : pick.d.group;
    for (let k = 0; k < n; k++) {
      const x = cx + (r.next() - 0.5) * 2.4;
      const z = cz + (r.next() - 0.5) * 2.4;
      this.enemies.spawn(pick.i, x, z, hpMul, dmgMul, r, elite);
      this.particles.burst(x, this.world.groundAt(x, z, 0.3, 50) + 0.2, z, 3, 1.5, 0.12, dustColor, 2, 0.5);
    }
    if (elite) {
      audio.play('elite');
      this.hud.toast(UI.toast.elite.replace('{name}', pick.d.name));
    }
  }

  private leash(dt: number): void {
    this.leashTimer -= dt;
    if (this.leashTimer > 0) return;
    this.leashTimer = 0.5;
    const p = this.player.pos;
    const L = TUNING.waves.leashRadius;
    for (let i = 0; i < this.enemies.count; i++) {
      const dx = this.enemies.x[i] - p.x;
      const dz = this.enemies.z[i] - p.z;
      if (dx * dx + dz * dz < L * L) continue;
      const [x, z] = this.spawnPoint(this.rng.spawn, this.enemies.isFlying(i));
      this.enemies.move(i, x, z);
    }
  }

  private contact(): void {
    const p = this.player;
    if (p.invulnerable > 0 || this.god) return;
    const e = this.enemies;
    let worst = 0;
    let fromX = 0;
    let fromZ = 0;
    const n = e.query(p.pos.x, p.pos.z, 1.6);
    for (let k = 0; k < n; k++) {
      const i = e.found[k];
      const r = TUNING.player.radius + e.radius[i];
      const dy = e.y[i] - p.pos.y;
      if (e.foundD2[k] > r * r || dy < -1.2 || dy > 2.4) continue;
      if (e.damage[i] > worst) {
        worst = e.damage[i];
        fromX = e.x[i];
        fromZ = e.z[i];
      }
    }
    if (worst <= 0) return;
    const taken = damageTaken(worst, this.stats.armor);
    p.hp -= taken;
    p.invulnerable = TUNING.player.invulnerability;
    p.hurt();
    const dx = p.pos.x - fromX;
    const dz = p.pos.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    p.vel.x += (dx / d) * 4;
    p.vel.z += (dz / d) * 4;
    this.numbers.spawn(p.pos.x, p.pos.y + 2, p.pos.z, taken, 2);
    this.hud.hurt();
    this.cam.shake(TUNING.feel.shakeHurt);
    // Hitstop on hurt at most once a second, or a swarm would freeze the game.
    if (this.time - this.lastHurtStop > 1) {
      this.hitstop = Math.max(this.hitstop, TUNING.feel.hitstopHurt);
      this.lastHurtStop = this.time;
    }
    audio.play('hurt');
    // Safari has no vibration API; Chrome refuses (with a console error) before the first user gesture.
    if ('vibrate' in navigator && 'userActivation' in navigator && navigator.userActivation.hasBeenActive) navigator.vibrate(40);
  }

  private hitEnemy(i: number, amount: number, crit: boolean, dx: number, dz: number, kb: number, w: OwnedWeapon): void {
    const e = this.enemies;
    const x = e.x[i];
    const y = e.y[i];
    const z = e.z[i];
    w.damage += Math.min(amount, Math.max(0, e.hp[i]));
    e.hit(i, amount, dx, dz, kb);
    this.numbers.spawn(x, y + 1.1, z, amount, crit ? 1 : 0);
    this.particles.burst(x, y + 0.5, z, crit ? 5 : 2, 3, 0.06, crit ? critColor : sparkColor, 3, 0.3, y);
  }

  /** Feedback once per attack (not per enemy): one shake, one sound, rate-limited crit hitstop. */
  private attacked(hits: number, crit: boolean): void {
    audio.play('swing', 0.8);
    if (hits === 0) return;
    if (crit) {
      audio.play('crit');
      this.cam.shake(TUNING.feel.shakeCrit);
      if (this.time - this.lastCritStop > 0.35) {
        this.hitstop = Math.max(this.hitstop, TUNING.feel.hitstopCrit);
        this.lastCritStop = this.time;
      }
    } else {
      audio.play('hit', 0.75);
      this.cam.shake(TUNING.feel.shakeHit * Math.min(2, 1 + hits * 0.1));
    }
  }

  private landed(impact: number, slam: boolean): void {
    const p = this.player;
    if (slam) {
      // Ground slam: shockwave pushes nearby enemies away.
      audio.play('slamLand');
      this.cam.shake(0.35);
      const e = this.enemies;
      const n = e.query(p.pos.x, p.pos.z, 3.5);
      for (let k = 0; k < n; k++) {
        const i = e.found[k];
        const d = Math.sqrt(e.foundD2[k]) || 1;
        e.hit(i, 0, (e.x[i] - p.pos.x) / d, (e.z[i] - p.pos.z) / d, 9 * (1 - d / 3.5));
      }
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        this.particles.emit(p.pos.x, p.pos.y + 0.1, p.pos.z, Math.cos(a) * 7, 1.5, Math.sin(a) * 7, 0.45, 0.13, dustColor, 6, p.pos.y);
      }
      return;
    }
    if (impact > 6) {
      audio.play('land', Math.min(1, impact / 16));
      this.cam.shake(TUNING.feel.shakeLand * Math.min(1, impact / 18));
      this.particles.burst(p.pos.x, p.pos.y + 0.05, p.pos.z, 6, 2.5, 0.09, dustColor, 1.5, 0.4, p.pos.y);
    }
  }

  // ---------- Level-up ----------

  private openLevelUp(): void {
    this.cards = offerCards(this.load, this.rng.cards, this.stats.luck);
    // Nothing left to upgrade: heal on the spot instead of a modal with a single card.
    if (this.cards.length === 1 && this.cards[0].kind === 'fallback') {
      this.pendingLevels = 0;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + FALLBACK_CARD.heal);
      audio.play('pick');
      this.hud.toast(UI.toast.heal.replace('{v}', String(FALLBACK_CARD.heal)));
      return;
    }
    this.state = 'levelup';
    audio.play('levelUp');
    audio.duckMusic(true);
    this.player.celebrate();
    this.input.unlockPointer();
    this.input.flush();
    this.wantLock = false;
    this.levelUp.setPad(this.input.usingPad);
    this.levelUp.open(this.cards, this.counters, this.levelActions, true);
  }

  /** Debug/test helper: weapon maxed, four passives maxed except the last (one level left) → a single card. */
  debugNearlyMaxed(): void {
    const w = this.load.weapons[0];
    w.level = w.def.levels.length + 1;
    this.load.passives = [];
    const picks = PASSIVES.filter((d) => d.stat !== 'duration').slice(0, TUNING.cards.passiveSlots);
    picks.forEach((def, i) => this.load.passives.push({ def, level: i === picks.length - 1 ? def.maxLevel - 1 : def.maxLevel, total: def.perLevel * def.maxLevel }));
    this.refreshStats();
    this.updateSlots();
  }

  /** Cards currently on offer (read by the bot). */
  get offered(): readonly Card[] {
    return this.state === 'levelup' ? this.cards : [];
  }

  private readonly levelActions = {
    pick: (i: number): void => {
      const card = this.cards[i] as Card | undefined;
      if (!card || this.state !== 'levelup') return;
      if (card.kind === 'fallback') this.player.hp = Math.min(this.player.maxHp, this.player.hp + FALLBACK_CARD.heal);
      applyCard(this.load, card);
      this.refreshStats();
      this.updateSlots();
      this.nextLevel();
    },
    reroll: (): void => {
      if (this.state !== 'levelup') return;
      this.counters.rerolls--;
      this.cards = offerCards(this.load, this.rng.cards, this.stats.luck);
      this.levelUp.open(this.cards, this.counters, this.levelActions, false);
    },
    skip: (): void => {
      if (this.state !== 'levelup') return;
      this.counters.skips--;
      this.nextLevel();
    },
    banish: (i: number): void => {
      const card = this.cards[i] as Card | undefined;
      if (!card || card.kind === 'fallback' || this.state !== 'levelup') return;
      this.counters.banishes--;
      this.load.banished.add(card.id);
      this.cards = offerCards(this.load, this.rng.cards, this.stats.luck);
      this.levelUp.open(this.cards, this.counters, this.levelActions, false);
    },
  };

  private nextLevel(): void {
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.cards = offerCards(this.load, this.rng.cards, this.stats.luck);
      if (!(this.cards.length === 1 && this.cards[0].kind === 'fallback')) {
        this.levelUp.open(this.cards, this.counters, this.levelActions, false);
        return;
      }
      this.pendingLevels = 0;
    }
    this.levelUp.close();
    this.state = 'playing';
    audio.duckMusic(false);
    this.input.flush();
    this.lock();
  }

  // ---------- Pause, death, quit ----------

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.wantLock = false;
    this.input.unlockPointer();
    this.input.flush();
    this.pauseScreen.open();
    audio.play('pause');
    audio.duckMusic(true);
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.pauseScreen.close();
    this.state = 'playing';
    audio.duckMusic(false);
    this.input.flush();
    this.lock();
  }

  private die(): void {
    this.state = 'dying';
    this.levelUp.close();
    this.pendingLevels = 0;
    this.timeScale = TUNING.feel.deathSlowMo;
    this.deathTimer = TUNING.feel.deathSlowMoTime;
    this.player.hp = 0;
    this.player.die();
    this.cam.shake(1);
    audio.play('die');
    audio.stopMusic();
    this.wantLock = false;
    this.input.unlockPointer();
    this.input.flush();
  }

  private showSummary(): void {
    this.state = 'dead';
    this.timeScale = 1;
    this.hud.show(false);
    this.numbers.clear();
    this.input.flush();
    audio.play('summary');
    audio.playMusic(TRACKS.menu);
    const lines = UI.summary.lines;
    this.summary.open({
      time: this.time,
      level: this.level,
      kills: this.enemies.kills,
      weapons: this.load.weapons.map((w) => ({ name: w.def.name, damage: w.damage })),
      line: lines[Math.floor(this.rng.cards.next() * lines.length)] ?? '',
    });
  }

  private quit(): void {
    this.state = 'idle';
    this.hud.show(false);
    this.pauseScreen.close();
    this.levelUp.close();
    this.input.unlockPointer();
    this.input.flush();
    audio.stopMusic();
    this.opts.onQuit();
  }

  // ---------- Rendering ----------

  private render(alpha: number, dt: number): void {
    const p = this.player;
    const px = p.prev.x + (p.pos.x - p.prev.x) * alpha;
    const py = p.prev.y + (p.pos.y - p.prev.y) * alpha;
    const pz = p.prev.z + (p.pos.z - p.prev.z) * alpha;
    this.cam.update(px, py, pz, Math.hypot(p.vel.x, p.vel.z), this.world, dt);
    this.world.sky.position.copy(this.cam.camera.position);
    p.render(alpha, dt, this.visualTime);
    p.object.visible = !this.cam.close;
    const ground = this.world.groundAt(px, pz, 0.2, py + 0.1);
    this.shadows.begin();
    this.shadows.add(px, ground, pz, 0.5, py - ground);
    this.enemies.render(alpha, this.time, this.shadows);
    this.coins.render(this.visualTime, this.shadows);
    this.shadows.end();
    this.particles.render(this.visualTime);
    this.numbers.render();
    this.swooshes.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
    if (this.state !== 'idle' && this.state !== 'dead') {
      const h = this.hudState;
      h.hp = p.hp;
      h.maxHp = p.maxHp;
      h.xp = this.xp;
      h.xpNext = xpForLevel(this.level);
      h.level = this.level;
      h.time = this.time;
      h.kills = this.enemies.kills;
      this.hud.update(h);
    }
  }

  private debugStats(): string {
    const info = this.renderer.info;
    return [
      `FPS ${this.fps.toFixed(0)}`,
      `symulacja ${this.simMs.toFixed(2)} ms, render ${this.renderMs.toFixed(2)} ms`,
      `stan ${this.state}, seed ${this.seed}`,
      `czas ${this.time.toFixed(1)} s`,
      `wrogowie ${this.enemies.count}`,
      `monety ${this.coins.count}`,
      `cząsteczki ${this.particles.active}`,
      `draw calls ${info.render.calls}`,
      `trójkąty ${info.render.triangles}`,
      `geometrie ${info.memory.geometries}, tekstury ${info.memory.textures}`,
    ].join('\n');
  }
}
