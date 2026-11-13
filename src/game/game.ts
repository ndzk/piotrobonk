import { Color, Scene, type WebGLRenderer } from 'three';
import { audio } from '../audio/audio';
import { ENEMIES } from '../content/enemies';
import { TRACKS } from '../content/music';
import { FABRYCZNA } from '../content/stations';
import { TUNING } from '../content/tuning';
import { UI } from '../content/ui';
import { Rng } from '../core/rng';
import { BlobShadows, DamageNumbers, Particles, Swooshes } from '../render/fx';
import { DebugPanel } from '../ui/debug';
import { Hud } from '../ui/hud';
import { LevelUpScreen } from '../ui/levelup';
import { PauseScreen, SummaryScreen } from '../ui/screens';
import { CameraRig } from './camera';
import { Coins } from './coins';
import { Enemies } from './enemies';
import type { Input } from './input';
import { Player } from './player';
import { applyCard, computeStats, damageTaken, newLoadout, offerCards, xpForLevel, type Card, type Loadout, type OwnedWeapon, type Stats } from './progress';
import { Arsenal, type Combat } from './weapons';
import { World } from './world';

export type GameState = 'idle' | 'playing' | 'levelup' | 'paused' | 'dying' | 'dead';

const DT = 1 / TUNING.simHz;
const sparkColor = new Color('#fff2b0');
const critColor = new Color('#ffcf3a');
const featherColor = new Color('#d9dde3');

export interface GameOptions {
  debug: boolean;
  bot: boolean;
  onQuit: () => void;
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
  private rng = new Rng(1);
  load: Loadout = newLoadout();
  private stats: Stats = computeStats(this.load);
  private pendingLevels = 0;
  private cards: Card[] = [];
  private counters = { rerolls: 0, skips: 0, banishes: 0 };
  private spawnAcc = 0;
  private leashTimer = 0;
  private hitstop = 0;
  private timeScale = 1;
  private deathTimer = 0;
  private acc = 0;
  private visualTime = 0;
  private god = false;
  private coinCombo = 0;
  private coinTimer = 0;
  private wantLock = false;
  private readonly combat: Combat;
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
            for (let i = 0; i < 100; i++) this.spawnGroup(true);
          },
          clear: () => {
            for (let i = 0; i < this.enemies.count; i++) this.enemies.dead[i] = 1;
          },
          vacuum: () => {
            this.coins.vacuum();
          },
        })
      : null;

    this.combat = {
      enemies: this.enemies,
      player: this.player,
      stats: this.stats,
      rng: this.rng,
      hit: (i, amount, crit, dx, dz, kb, w) => {
        this.hitEnemy(i, amount, crit, dx, dz, kb, w);
      },
      swoosh: (x, y, z, angle, arc, radius) => {
        this.swooshes.spawn(x, y, z, angle, arc, radius, '#ffd36b');
      },
      swung: () => {
        audio.play('swing', 0.8);
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

  /** Compiles every shader and uploads every texture now, so nothing stutters the first time it appears. */
  warmup(): void {
    for (const t of this.player.avatar.textures()) this.renderer.initTexture(t);
    for (let t = 0; t < ENEMIES.length; t++) this.enemies.spawn(t, 4 + t, 4, 1);
    this.coins.drop(2, 0, 2, 1);
    this.particles.burst(0, 1, 0, 4, 2, 0.1, sparkColor);
    this.numbers.spawn(0, 1, 0, 12, 0);
    this.swooshes.spawn(0, 1, 0, 0, 2, 2, '#ffffff');
    this.render(1, 0);
    this.renderer.compile(this.scene, this.cam.camera);
    this.enemies.count = 0;
    this.coins.clear();
  }

  resize(w: number, h: number): void {
    this.cam.camera.aspect = w / h;
    this.cam.camera.updateProjectionMatrix();
  }

  start(seed: number): void {
    this.rng = new Rng(seed);
    this.combat.rng = this.rng;
    this.time = 0;
    this.level = 1;
    this.xp = 0;
    this.pendingLevels = 0;
    this.load = newLoadout();
    this.refreshStats();
    this.counters = { rerolls: TUNING.cards.rerolls, skips: TUNING.cards.skips, banishes: TUNING.cards.banishes };
    this.spawnAcc = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.acc = 0;
    this.enemies.count = 0;
    this.enemies.kills = 0;
    this.coins.clear();
    this.arsenal.reset();
    this.player.reset();
    this.cam.yaw = Math.PI;
    this.cam.pitch = -0.28;
    this.state = 'playing';
    this.hud.show(true);
    audio.playMusic(TRACKS.fabryczna);
    audio.musicIntensity(0);
    audio.duckMusic(false);
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
    this.visualTime += dtReal;
    const t0 = performance.now();
    this.render(this.acc / DT, dtReal);
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
    p.update(dt, this.input, this.cam.yaw, this.stats.speed, {
      jump: () => {
        audio.play('jump');
      },
      land: (impact) => {
        if (impact > 6) {
          audio.play('land', Math.min(1, impact / 16));
          this.cam.shake(TUNING.feel.shakeLand * Math.min(1, impact / 18));
          this.particles.burst(p.pos.x, p.pos.y + 0.05, p.pos.z, 6, 2.5, 0.09, featherColor, 1.5, 0.4);
        }
      },
      slide: () => {
        audio.play('slide');
      },
    });
    if (this.state === 'playing') p.hp = Math.min(p.maxHp, p.hp + this.stats.regen * dt);

    this.enemies.rebuildHash();
    this.spawn(dt);
    this.enemies.update(dt, p.pos.x, p.pos.y, p.pos.z, this.time);
    this.enemies.rebuildHash();
    if (this.state === 'playing') this.contact();
    if (this.state === 'playing') this.arsenal.update(dt, this.load, this.combat);
    this.enemies.sweep((x, y, z, type) => {
      const def = ENEMIES[type];
      this.coins.drop(x, y, z, def.xp);
      audio.play(def.id === 'golab' ? 'pigeonDie' : 'enemyDie', 0.7);
    });
    this.enemies.finishDeaths((x, y, z, type) => {
      const pal = this.enemies.palette(type);
      for (let k = 0; k < 9; k++) {
        const c = pal[k % pal.length] ?? sparkColor;
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 3;
        this.particles.emit(x, y + 0.4, z, Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s, 0.9 + Math.random() * 0.5, 0.08 + Math.random() * 0.1, c);
      }
    });
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) this.coinCombo = 0;
    this.coins.update(dt, p.pos.x, p.pos.y, p.pos.z, TUNING.player.pickupRadius * this.stats.magnet, (v) => {
      this.xp += v;
      this.coinCombo = Math.min(14, this.coinCombo + 1);
      this.coinTimer = 0.5;
      audio.play('coin', 0.8, 1 + this.coinCombo * 0.035);
    });
    this.particles.update(dt);
    this.numbers.update(dt);
    this.leash(dt);

    if (this.state === 'playing') {
      audio.musicIntensity(this.time < 25 ? 0 : this.time < 80 ? 1 : this.time < 200 ? 2 : 3);
      while (this.xp >= xpForLevel(this.level)) {
        this.xp -= xpForLevel(this.level);
        this.level++;
        this.pendingLevels++;
      }
      if (this.pendingLevels > 0) this.openLevelUp();
      if (p.hp <= 0) this.die();
    }
  }

  private spawn(dt: number): void {
    const keys = TUNING.waves.rate;
    let rate: number = keys[keys.length - 1]?.[1] ?? 1;
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
      this.spawnGroup(false);
    }
  }

  private spawnGroup(any: boolean): void {
    const p = this.player.pos;
    const options = ENEMIES.map((d, i) => ({ d, i })).filter(({ d }) => any || this.time >= d.from);
    const total = options.reduce((s, o) => s + o.d.weight, 0);
    let r = this.rng.next() * total;
    let pick = options[0];
    for (const o of options) {
      r -= o.d.weight;
      if (r < 0) {
        pick = o;
        break;
      }
    }
    const [r0, r1] = TUNING.waves.spawnRadius;
    let a = this.rng.next() * Math.PI * 2;
    let dist = r0 + this.rng.next() * (r1 - r0);
    let cx = p.x + Math.sin(a) * dist;
    let cz = p.z + Math.cos(a) * dist;
    const lim = this.world.radius - 3;
    if (Math.hypot(cx, cz) > lim) {
      // Outside the fence: spawn on the side facing the arena centre instead.
      a = Math.atan2(-p.x, -p.z) + (this.rng.next() - 0.5) * 1.6;
      dist = Math.min(dist, Math.max(r0 * 0.7, Math.hypot(p.x, p.z) + lim * 0.5));
      cx = p.x + Math.sin(a) * dist;
      cz = p.z + Math.cos(a) * dist;
      const d = Math.hypot(cx, cz);
      if (d > lim) {
        cx *= lim / d;
        cz *= lim / d;
      }
    }
    const hpMul = 1 + (this.time / 60) * TUNING.waves.hpPerMinute;
    for (let k = 0; k < pick.d.group; k++) {
      const ox = (this.rng.next() - 0.5) * 2.4;
      const oz = (this.rng.next() - 0.5) * 2.4;
      this.enemies.spawn(pick.i, cx + ox, cz + oz, hpMul);
    }
  }

  private leash(dt: number): void {
    this.leashTimer -= dt;
    if (this.leashTimer > 0) return;
    this.leashTimer = 0.5;
    const p = this.player.pos;
    const L = TUNING.waves.leashRadius;
    for (let i = 0; i < this.enemies.count; i++) {
      const dx = (this.enemies.x[i] ?? 0) - p.x;
      const dz = (this.enemies.z[i] ?? 0) - p.z;
      if (dx * dx + dz * dz < L * L) continue;
      const a = Math.atan2(-dx, -dz) + (this.rng.next() - 0.5) * 2;
      const r = TUNING.waves.spawnRadius[1];
      let x = p.x - Math.sin(a) * r;
      let z = p.z - Math.cos(a) * r;
      const d = Math.hypot(x, z);
      const lim = this.world.radius - 3;
      if (d > lim) {
        x *= lim / d;
        z *= lim / d;
      }
      this.enemies.move(i, x, z);
    }
  }

  private contact(): void {
    const p = this.player;
    if (p.invulnerable > 0 || this.god) return;
    let worst = 0;
    let fromX = 0;
    let fromZ = 0;
    this.enemies.near(p.pos.x, p.pos.z, 1.4, (i, d2) => {
      const r = TUNING.player.radius + (this.enemies.radius[i] ?? 0.4);
      const dy = (this.enemies.y[i] ?? 0) - p.pos.y;
      if (d2 > r * r || dy < -1.2 || dy > 2.4) return;
      const dmg = this.enemies.damage[i] ?? 0;
      if (dmg > worst) {
        worst = dmg;
        fromX = this.enemies.x[i] ?? 0;
        fromZ = this.enemies.z[i] ?? 0;
      }
    });
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
    this.hitstop = Math.max(this.hitstop, TUNING.feel.hitstopHurt);
    audio.play('hurt');
    // Safari has no vibration API; Chrome refuses (with a console error) before the first user gesture.
    if ('vibrate' in navigator && navigator.userActivation.hasBeenActive) navigator.vibrate(40);
  }

  private hitEnemy(i: number, amount: number, crit: boolean, dx: number, dz: number, kb: number, w: OwnedWeapon): void {
    const e = this.enemies;
    const x = e.x[i] ?? 0;
    const y = e.y[i] ?? 0;
    const z = e.z[i] ?? 0;
    w.damage += Math.min(amount, Math.max(0, e.hp[i] ?? 0));
    e.hit(i, amount, dx, dz, kb);
    this.numbers.spawn(x, y + 1.1, z, amount, crit ? 1 : 0);
    this.particles.burst(x, y + 0.5, z, crit ? 6 : 3, 3, 0.07, crit ? critColor : sparkColor, 3, 0.35);
    if (crit) {
      audio.play('crit');
      this.hitstop = Math.max(this.hitstop, TUNING.feel.hitstopCrit);
      this.cam.shake(TUNING.feel.shakeCrit);
    } else {
      audio.play('hit', 0.7);
      this.cam.shake(TUNING.feel.shakeHit);
    }
  }

  // ---------- Level-up ----------

  private openLevelUp(): void {
    this.state = 'levelup';
    audio.play('levelUp');
    audio.duckMusic(true);
    this.player.celebrate();
    this.input.unlockPointer();
    this.wantLock = false;
    this.cards = offerCards(this.load, this.rng, this.stats.luck);
    this.levelUp.open(this.cards, this.counters, this.levelActions, true);
  }

  private readonly levelActions = {
    pick: (i: number): void => {
      const card = this.cards[i];
      if (card.kind === 'fallback') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
      applyCard(this.load, card);
      this.refreshStats();
      this.nextLevel();
    },
    reroll: (): void => {
      this.counters.rerolls--;
      this.cards = offerCards(this.load, this.rng, this.stats.luck);
      this.levelUp.open(this.cards, this.counters, this.levelActions, false);
    },
    skip: (): void => {
      this.counters.skips--;
      this.nextLevel();
    },
    banish: (i: number): void => {
      const card = this.cards[i];
      if (card.kind === 'fallback') return;
      this.counters.banishes--;
      this.load.banished.add(card.id);
      this.cards = offerCards(this.load, this.rng, this.stats.luck);
      this.levelUp.open(this.cards, this.counters, this.levelActions, false);
    },
  };

  private nextLevel(): void {
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.cards = offerCards(this.load, this.rng, this.stats.luck);
      this.levelUp.open(this.cards, this.counters, this.levelActions, false);
      return;
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
    this.timeScale = TUNING.feel.deathSlowMo;
    this.deathTimer = TUNING.feel.deathSlowMoTime;
    this.player.hp = 0;
    this.player.hurt();
    this.cam.shake(1);
    audio.play('die');
    audio.stopMusic();
    this.wantLock = false;
    this.input.unlockPointer();
  }

  private showSummary(): void {
    this.state = 'dead';
    this.timeScale = 1;
    this.hud.show(false);
    const lines = UI.summary.lines;
    this.summary.open({
      time: this.time,
      level: this.level,
      kills: this.enemies.kills,
      weapons: this.load.weapons.map((w) => ({ name: w.def.name, damage: w.damage })),
      line: lines[Math.floor(this.rng.next() * lines.length)] ?? '',
    });
  }

  private quit(): void {
    this.state = 'idle';
    this.hud.show(false);
    this.pauseScreen.close();
    this.input.unlockPointer();
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
    this.shadows.begin();
    this.shadows.add(px, this.world.groundAt(px, pz, 0.2, py + 0.1), pz, 0.5, py - this.world.groundAt(px, pz, 0.2, py + 0.1));
    this.enemies.render(alpha, this.time, this.shadows);
    this.coins.render(this.visualTime, this.shadows);
    this.shadows.end();
    this.particles.render(this.visualTime);
    this.numbers.render();
    this.swooshes.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
    if (this.state !== 'idle' && this.state !== 'dead') {
      this.hud.update({
        hp: p.hp,
        maxHp: p.maxHp,
        xp: this.xp,
        xpNext: xpForLevel(this.level),
        level: this.level,
        time: this.time,
        kills: this.enemies.kills,
        slots: [...this.load.weapons.map((w) => ({ id: w.def.id, level: w.level, kind: 'weapon' as const })), ...this.load.passives.map((x) => ({ id: x.def.id, level: x.level, kind: 'passive' as const }))],
      });
    }
  }

  private debugStats(): string {
    const info = this.renderer.info;
    return [
      `FPS ${this.fps.toFixed(0)}`,
      `symulacja ${this.simMs.toFixed(2)} ms, render ${this.renderMs.toFixed(2)} ms`,
      `stan ${this.state}`,
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
