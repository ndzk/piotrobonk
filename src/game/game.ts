import { Color, Scene, type Object3D, type WebGLRenderer } from 'three';
import { audio } from '../audio/audio';
import { bossOf, type BossDef } from '../content/bosses';
import { BOTTLES, COFFEE, FALLBACK_CARD, FOOD, PASSIVES, WEAPONS } from '../content/items';
import { TRACKS, trackForStation } from '../content/music';
import { STATIONS, station, type StationDef } from '../content/stations/index';
import { TUNING } from '../content/tuning';
import { UI } from '../content/ui';
import { Rng, hashSeed } from '../core/rng';
import { hexOf } from '../render/palette';
import { progressOf, recordClear, unlocked, type Difficulty, type Save } from '../core/save';
import { fillCount } from '../core/text';
import type { Settings } from '../core/settings';
import type { SfxId } from '../content/sfx';
import { BlobShadows, DamageNumbers, Particles, Swooshes } from '../render/fx';
import { ChestScreen } from '../ui/chest';
import { ClearedScreen } from '../ui/cleared';
import { DebugPanel } from '../ui/debug';
import { BossUi } from '../ui/boss-ui';
import { Hud } from '../ui/hud';
import { LevelUpScreen } from '../ui/levelup';
import { PauseScreen, SummaryScreen } from '../ui/screens';
import { Boss, bossEnemyDef, type BossWorld } from './boss';
import { CameraRig } from './camera';
import { Hazards } from './hazards';
import { pickSpawn, spawnOptions, type SpawnPick } from './spawn';
import { Enemies } from './enemies';
import { Interactables, type InteractEvents } from './interactables';
import { Kind, Pickups } from './pickups';
import { Train } from './train';
import type { Input } from './input';
import { Player, type PlayerEvents } from './player';
import { applyCard, chestPrice, computeStats, damageTaken, newLoadout, offerCards, openChest, xpForLevel, type Card, type ChestReward, type Loadout, type OwnedWeapon, type Stats } from './progress';
import { WeaponFx } from './weapon-fx';
import { Arsenal, type Combat } from './weapons';
import { World } from './world';

export type GameState = 'idle' | 'intro' | 'playing' | 'levelup' | 'chest' | 'paused' | 'dying' | 'dead' | 'cleared';

const DT = 1 / TUNING.simHz;
const sparkColor = new Color('#fff2b0');
const critColor = new Color('#ffcf3a');
const dustColor = new Color('#b8aa98');
const binColor = new Color('#2f6b3a');
const ELITE_TIMES = [180, 300, 420];
const BUS_TIMES = [240, 400];
const bottleColor = new Color('#7fdc8a');
const chestColor = new Color('#ffe68a');
const muzzleColor = new Color('#ffd98a');
const healColor = new Color('#7fe08a');
const boomColor = new Color('#ffb347');
const bossPos = { x: 0, y: 0, z: 0 };
const smokeColor = new Color('#6b6359');

export interface GameOptions {
  debug: boolean;
  bot: boolean;
  settings: Settings;
  save: Save;
  onSettings: (s: Settings) => void;
  /** Progress changed (a station cleared, time spent, bottles banked). */
  onSave: (s: Save) => void;
  onQuit: () => void;
  /** Back to the route map (after clearing a station, or from the summary). */
  onRoute: () => void;
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
  world: World;
  readonly player: Player;
  readonly cam: CameraRig;
  enemies: Enemies;
  readonly pickups: Pickups;
  private readonly fx: WeaponFx;
  private readonly hazards: Hazards;
  interact: Interactables;
  /** The station being played and its boss. */
  stationDef: StationDef;
  private boss: Boss | null = null;
  private readonly bossUi: BossUi;
  private readonly clearedScreen: ClearedScreen;
  private readonly train: Train;
  private bossSpawned = false;
  private introTimer = 0;
  private rebuildTimer = 0;
  /** How many rails have clanged into place so far (for the sound of the rebuild). */
  private railsDropped = 0;
  private newRecord = false;
  /** The state the pause interrupted, so resuming puts it back. */
  private pausedFrom: GameState = 'playing';
  /** 0..1 while the train crosses after a rebuild, −1 otherwise. */
  private trainShot = -1;
  // Boss wind-up visuals: a closing ring, and the lane of a charge.
  private windUpLeft = 0;
  private windUpTotal = 1;
  private windUpX = 0;
  private windUpZ = 0;
  private windUpR = 4;
  private readonly windUpColor = new Color('#ffd23a');
  private laneLeft = 0;
  private laneX = 0;
  private laneZ = 0;
  private laneAngle = 0;
  private laneLength = 20;
  private laneWidth = 5;
  private bossAt = 0;
  /** The kurs this run is on (the balance script sets it directly). */
  difficulty: Difficulty = 'normalnie';
  private readonly chestScreen: ChestScreen;
  private readonly particles: Particles;
  private readonly numbers: DamageNumbers;
  private readonly shadows: BlobShadows;
  private readonly swooshes: Swooshes;
  private readonly arsenal: Arsenal;
  bottles = 0;
  private chestsOpened = 0;
  private nextBus = 0;
  private openingChest = -1;
  private chestWait = 0;
  private pendingReward: ChestReward | null = null;
  private evolvedOnClose = false;
  /** Lifesteal heals every kill but only sparkles every few, so a crowd wipe is not a firework. */
  private lifestealTimer = 0;
  private promptPrice = -1;
  private promptKey = '';
  private promptAffordable = true;
  private promptText = '';
  private promptPct = -1;
  private brewSound = 0;
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
  /** Debug immortality (F1 menu, the balance script and the boss e2e all flip this). */
  god = false;
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
    this.stationDef = STATIONS[0];
    this.world = new World(this.stationDef, this.scene);
    this.player = new Player(this.world);
    this.scene.add(this.player.object);
    this.cam = new CameraRig(1);
    this.enemies = new Enemies(this.scene, this.world, this.bossTypes());
    this.enemies.onStuck = this.onBusStuck;
    this.enemies.onEvent = this.onEnemyEvent;
    this.pickups = new Pickups(this.scene, this.world);
    this.enemies.bottles = this.pickups;
    this.fx = new WeaponFx(this.scene);
    this.hazards = new Hazards(this.scene);
    this.arsenal = new Arsenal(this.scene, this.fx);
    this.interact = new Interactables(this.scene, this.stationDef);
    this.particles = new Particles(this.scene);
    this.numbers = new DamageNumbers(this.scene, TUNING.feel.damageNumberLife);
    this.shadows = new BlobShadows(this.scene, TUNING.waves.maxEnemies + 260);
    this.swooshes = new Swooshes(this.scene);
    this.hud = new Hud(uiRoot);
    this.bossUi = new BossUi(uiRoot);
    this.clearedScreen = new ClearedScreen(uiRoot);
    this.train = new Train(this.scene);
    this.levelUp = new LevelUpScreen(uiRoot);
    this.chestScreen = new ChestScreen(uiRoot);
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
            this.pickups.vacuum();
          },
          bottles: () => {
            this.bottles += 1000;
          },
          boss: () => {
            if (this.state === 'playing' && !this.bossSpawned) {
              this.time = Math.max(this.time, this.bossAt);
              this.startBoss();
            }
          },
          nextStation: () => {
            const order = STATIONS.map((st) => st.id);
            const next = order[(order.indexOf(this.stationDef.id) + 1) % order.length];
            this.start(this.seed, next, this.difficulty);
          },
        })
      : null;
    this.applySettings(opts.settings);

    this.combat = {
      enemies: this.enemies,
      player: this.player,
      pickups: this.pickups,
      stats: this.stats,
      rng: this.rng.combat,
      fx: this.fx,
      time: 0,
      hit: (i, amount, crit, dx, dz, kb, w) => this.hitEnemy(i, amount, crit, dx, dz, kb, w),
      swoosh: (x, y, z, angle, arc, radius, color) => {
        this.swooshes.spawn(x, y, z, angle, arc, radius, color);
      },
      attacked: (hits, crit, sound) => {
        this.attacked(hits, crit, sound);
      },
      ground: (x, z, y) => this.world.groundAt(x, z, 0.2, y),
      blast: (x, z, r) => {
        this.interact.blast(x, z, r, this.interactEvents);
      },
      boom: (x, y, z, r) => {
        this.fx.addFlash(x, y, z, r * 0.5, boomColor);
        this.particles.burst(x, y + 0.3, z, Math.min(14, 6 + Math.round(r * 3)), 4, 0.14, smokeColor, 6, 0.9, y);
        this.particles.burst(x, y + 0.2, z, 5, 6, 0.09, boomColor, 5, 0.4, y);
      },
      muzzle: (x, y, z, angle) => {
        this.fx.addBeam(x, y, z, x + Math.sin(angle) * 0.45, y, z + Math.cos(angle) * 0.45, muzzleColor, 0.18, 0.05);
        this.particles.burst(x, y, z, 2, 3, 0.05, muzzleColor, 1, 0.12);
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
      if (this.pausable && this.wantLock && !this.input.pointerLocked && !this.opts.bot) this.pause();
      if (this.input.pointerLocked) this.wantLock = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.pausable && !this.opts.bot) this.pause();
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
    // Every type of this arena, the boss included, so its shader is compiled before the fight.
    for (let t = 0; t < this.enemies.types.length; t++) this.enemies.spawn(t, 4 + t, 4, 1, 1, rng, t === 0);
    this.pickups.drop(2, 0, 2, 1, rng);
    this.pickups.drop(2, 0, 3, 1, rng, Kind.Bottle);
    this.pickups.drop(3, 0, 2, 25, rng, Kind.Food);
    for (let k = 0; k < 4; k++) this.fx.aura(k, '#ffffff');
    this.fx.addRing(0, 0, 0, 2, sparkColor);
    this.fx.addBolt(0, 3, 0, 1, 0, 1, sparkColor);
    this.particles.burst(0, 1, 0, 4, 2, 0.1, sparkColor);
    this.numbers.spawn(0, 1, 0, 12, 0);
    this.swooshes.spawn(0, 1, 0, 0, 2, 2, '#ffffff');
    this.render(1, 0);
    // compile() skips hidden objects (pooled chests, unused auras), so show everything for the pass.
    const hidden: Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) hidden.push(o);
      o.visible = true;
    });
    this.renderer.compile(this.scene, this.cam.camera);
    for (const o of hidden) o.visible = false;
    this.clearEntities();
  }

  /** The boss type built into this arena's enemy pool (empty when a station has no boss yet). */
  private bossTypes(): ReturnType<typeof bossEnemyDef>[] {
    const def = bossOf(this.stationDef.id);
    return def ? [bossEnemyDef(def)] : [];
  }

  /** Swaps the arena: a new world, new enemy types (the station's boss) and new map items. */
  private loadStation(def: StationDef): void {
    if (def.id === this.stationDef.id) return;
    this.stationDef = def;
    this.enemies.dispose(this.scene);
    this.interact.dispose(this.scene);
    this.world.dispose(this.scene);
    this.world = new World(def, this.scene);
    this.player.setWorld(this.world);
    this.pickups.setWorld(this.world);
    this.enemies = new Enemies(this.scene, this.world, this.bossTypes());
    this.enemies.onStuck = this.onBusStuck;
    this.enemies.onEvent = this.onEnemyEvent;
    this.enemies.bottles = this.pickups;
    this.interact = new Interactables(this.scene, def);
    this.combat.enemies = this.enemies;
    this.warmup();
  }

  /** Puts the boss on the tracks after its title card. */
  private startBoss(): void {
    const def = bossOf(this.stationDef.id);
    if (!def) return;
    this.state = 'intro';
    this.introTimer = TUNING.boss.intro;
    this.bossSpawned = true;
    this.bossUi.showIntro(def.name, def.subtitle);
    audio.play('elite');
    audio.playMusic(TRACKS.boss);
    audio.musicIntensity(3);
    this.input.flush();
  }

  private spawnBoss(def: BossDef): void {
    const typeIndex = this.typeIndex(def.id);
    if (typeIndex < 0) return;
    const p = this.player.pos;
    const a = this.rng.spawn.next() * Math.PI * 2;
    const dist = 14;
    // Boss health is its own number: the clock must not inflate it on top of the difficulty.
    const hpMul = TUNING.difficulty[this.difficulty].bossHp;
    this.bossWorld.pace = TUNING.difficulty[this.difficulty].bossPace;
    const boss = new Boss(def, this.enemies, this.bossWorld, this.rng.spawn);
    boss.spawn(typeIndex, p.x + Math.sin(a) * dist, p.z + Math.cos(a) * dist, hpMul);
    this.boss = boss;
    this.bossUi.hideIntro();
    this.bossUi.showBar(def.name);
    this.bossUi.setHealth(1);
    this.cam.shake(0.6);
  }

  /** Everything the boss asks the arena to do. */
  private readonly bossWorld: BossWorld = {
    slam: (x, z, radius, damage, telegraph) => {
      this.hazards.addMark(x, z, this.world.groundAt(x, z, 0.3, 50), radius, damage * TUNING.difficulty[this.difficulty].damage, telegraph);
      audio.play('denied', 0.4, 0.7);
    },
    zone: (x, z, radius, damage, duration, telegraph) => {
      this.hazards.addMark(x, z, this.world.groundAt(x, z, 0.3, 50), radius, damage * TUNING.difficulty[this.difficulty].damage, telegraph, duration);
      audio.play('splash', 0.45);
    },
    wave: (x, z, radius, damage, speed) => {
      this.hazards.addWave(x, z, radius, damage * TUNING.difficulty[this.difficulty].damage, speed);
      this.cam.shake(0.3);
      audio.play('boom', 0.7);
    },
    beam: (angle, length, damage, duration, speed, telegraph) => {
      const b = this.boss;
      if (!b || b.index < 0) return;
      audio.play('zap', 0.8);
      this.hazards.addBeam(this.enemies.x[b.index], this.enemies.z[b.index], angle, length, damage * TUNING.difficulty[this.difficulty].damage, duration, speed, telegraph);
    },
    shot: (x, y, z, dirX, dirZ, speed, damage, color) => {
      this.hazards.addShot(x, y, z, dirX * speed, 0, dirZ * speed, 6, damage * TUNING.difficulty[this.difficulty].damage, hexOf(color));
      audio.play('throw', 0.35);
    },
    windUp: (x, z, radius, seconds, color) => {
      // A ring closing in on the boss: "something lands when this reaches me".
      this.windUpX = x;
      this.windUpZ = z;
      this.windUpR = radius;
      this.windUpLeft = seconds;
      this.windUpTotal = seconds;
      this.windUpColor.set(color);
      audio.play('whistle', 0.35, 1.4);
    },
    lane: (x, z, angle, length, width, seconds) => {
      this.laneX = x;
      this.laneZ = z;
      this.laneAngle = angle;
      this.laneLength = length;
      this.laneWidth = width;
      this.laneLeft = seconds;
      audio.play('horn', 0.6);
    },
    summon: (id, count, x, z) => {
      const type = this.typeIndex(id);
      if (type < 0) return;
      const minutes = this.time / 60;
      const kurs = TUNING.difficulty[this.difficulty];
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        this.enemies.spawn(type, x + Math.sin(a) * 4, z + Math.cos(a) * 4, (1 + minutes * TUNING.waves.hpPerMinute) * kurs.hp, (1 + minutes * TUNING.combat.enemyDamagePerMinute) * kurs.damage, this.rng.spawn);
      }
      audio.play('whistle', 0.6);
    },
    shout: (text) => {
      this.bossUi.say(text, this.visualTime);
      audio.play('whistle', 0.7, 0.85);
    },
    phase: (index) => {
      this.bossUi.setPhase(index);
      const phase = this.boss?.def.phases[index];
      if (phase?.shout) this.bossUi.say(phase.shout, this.visualTime);
      this.cam.shake(0.5);
      audio.play('elite', 0.8);
    },
    ground: (x, z, y) => this.world.groundAt(x, z, 0.4, y),
    collide: (x, y, z, r) => {
      bossPos.x = x;
      bossPos.y = y;
      bossPos.z = z;
      const blocked = this.world.collide(bossPos, r, 2.5, 0.6);
      // Slide along the wall instead of standing against it: a boss stuck on a shed never ends a fight.
      if (blocked) {
        const nl = Math.hypot(this.world.hitX, this.world.hitZ);
        if (nl > 0.001) {
          const nx = this.world.hitX / nl;
          const nz = this.world.hitZ / nl;
          const dot = (x - bossPos.x) * nx + (z - bossPos.z) * nz;
          bossPos.x += (x - bossPos.x - nx * dot) * 0.8;
          bossPos.z += (z - bossPos.z - nz * dot) * 0.8;
        }
      }
      this.bossWorld.collideX = bossPos.x;
      this.bossWorld.collideZ = bossPos.z;
    },
    collideX: 0,
    collideZ: 0,
    playerX: 0,
    playerY: 0,
    playerZ: 0,
    pace: 1,
    arenaRadius: 60,
  };

  /** Hazards hurt Piotrek like contact damage does. */
  private readonly hazardHit = {
    hurt: (damage: number): void => {
      this.hurtPlayer(damage, this.player.pos.x, this.player.pos.z);
    },
  };

  /** Index of an enemy type in this arena's pool, or −1. */
  private typeIndex(id: string): number {
    const types = this.enemies.types;
    for (let i = 0; i < types.length; i++) if (types[i].def.id === id) return i;
    return -1;
  }

  /** Where this station's track runs (z of the first pair of rails). */
  private trackZ(): number {
    for (const p of this.stationDef.props) if (p.kind === 'tracks') return p.z[0] ?? 19;
    return 19;
  }

  /** The cleared screen, once the rails are back in place. */
  private showCleared(): void {
    const def = bossOf(this.stationDef.id);
    const order = STATIONS.map((st) => st.id);
    const index = order.indexOf(this.stationDef.id);
    const nextId = order[index + 1] as string | undefined;
    this.hud.show(false);
    const opened = nextId !== undefined && unlocked(this.opts.save, order, nextId) ? station(nextId).name : '';
    this.clearedScreen.show(
      {
        boss: def?.name ?? '',
        station: this.stationDef.name,
        time: Math.max(1, this.time - this.bossAt),
        kills: this.enemies.kills,
        bottles: this.bottles,
        record: this.newRecord,
        opened,
        hasNext: opened !== '',
      },
      () => {
        this.state = 'idle';
        this.clearEntities();
        audio.stopMusic();
        this.opts.onRoute();
      },
    );
  }

  /** The boss went down: pay it out, stop the waves, rebuild the track, bank the progress. */
  private clearStation(def: BossDef, x: number, y: number, z: number): void {
    // The pool is about to be wiped, so the boss's own payout happens here.
    this.enemies.kills++;
    const r = this.rng.drops;
    for (let k = 0; k < 10; k++) this.pickups.drop(x, y, z, Math.max(1, Math.round(def.xp / 10)), r);
    for (let k = 0; k < def.bottles; k++) this.pickups.drop(x, y, z, 1, r, Kind.Bottle);
    this.particles.burst(x, y + 1.2, z, 26, 7, 0.16, chestColor, 7, 1.2, y);
    this.fx.addFlash(x, y + 1.4, z, 3.2, chestColor);
    this.fx.addRing(x, y, z, 9, chestColor, 0.8);
    this.cam.shake(0.8);
    audio.play('boom');
    audio.play('enemyDie');
    this.state = 'cleared';
    this.rebuildTimer = 0;
    this.railsDropped = 0;
    this.train.start(this.trackZ());
    this.enemies.clear();
    // Nothing may hang frozen in the air through the celebration.
    this.numbers.clear();
    this.swooshes.clear();
    this.arsenal.reset();
    this.hud.show(false);
    this.boss = null;
    this.bossUi.hide();
    this.hazards.clear();
    this.timeScale = 1;
    this.input.unlockPointer();
    this.input.flush();
    audio.stopMusic();
    audio.play('levelUp');
    this.player.celebrate();
    const save = this.opts.save;
    // The record is the fight, not the six minutes of waiting that every difficulty pads differently.
    const fight = Math.max(1, this.time - this.bossAt);
    const before = progressOf(save, this.stationDef.id);
    this.newRecord = before.bestTime === 0 || fight < before.bestTime;
    recordClear(save, this.stationDef.id, this.difficulty, fight, this.enemies.kills);
    save.bottles += this.bottles;
    save.totalTime += this.time;
    this.opts.onSave(save);
  }

  resize(w: number, h: number): void {
    this.cam.camera.aspect = w / h;
    this.cam.camera.updateProjectionMatrix();
  }

  private clearEntities(): void {
    this.enemies.clear();
    this.pickups.clear();
    this.fx.clear();
    this.hazards.clear();
    this.arsenal.reset();
    this.particles.clear();
    this.numbers.clear();
    this.swooshes.clear();
  }

  start(seed: number, stationId = this.stationDef.id, difficulty = this.opts.save.difficulty): void {
    this.loadStation(station(stationId));
    this.difficulty = difficulty;
    this.bossAt = TUNING.difficulty[difficulty].bossAt;
    this.bossSpawned = false;
    this.boss = null;
    this.introTimer = 0;
    this.rebuildTimer = 0;
    this.bossUi.hide();
    this.hazards.clear();
    this.world.rebuildTracks(0);
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
    this.nextBus = 0;
    this.bottles = 0;
    this.chestsOpened = 0;
    this.openingChest = -1;
    this.pendingReward = null;
    this.hitstop = 0;
    this.lastCritStop = this.lastHurtStop = -10;
    this.timeScale = 1;
    this.acc = 0;
    this.coinCombo = 0;
    this.clearEntities();
    this.enemies.kills = 0;
    this.player.reset();
    this.interact.reset(this.rng.drops, chestPrice(0, BOTTLES.chestBase, BOTTLES.chestStep));
    this.cam.reset(0);
    this.levelUp.close();
    this.state = 'playing';
    this.hud.show(true);
    this.updateSlots();
    audio.playMusic(trackForStation(this.stationDef.id));
    audio.musicIntensity(0);
    this.opts.save.runs++;
    this.opts.onSave(this.opts.save);
    audio.duckMusic(false);
    if (!audio.unlocked && !this.opts.bot) this.hud.toast(UI.toast.sound);
    this.input.flush();
    this.lock();
  }

  /** States the game may be paused from (anything that is running, cinematics included). */
  private get pausable(): boolean {
    return this.state === 'playing' || this.state === 'intro' || (this.state === 'cleared' && !this.clearedScreen.open);
  }

  private lock(): void {
    if (this.opts.bot) return;
    this.wantLock = false;
    this.input.lockPointer();
  }

  private refreshStats(): void {
    this.stats = computeStats(this.load);
    this.combat.stats = this.stats;
    // Max HP buffs also heal by the amount gained.
    const gain = this.stats.maxHp - this.player.maxHp;
    this.player.maxHp = this.stats.maxHp;
    if (gain > 0) this.player.hp += gain;
  }

  private updateSlots(): void {
    this.player.showGun(this.load.weapons.some((w) => w.def.kind === 'gun'));
    this.hud.setSlots([
      ...this.load.weapons.map((w) => ({ id: w.def.id, level: w.level, kind: 'weapon' as const, evolved: w.def.evolved === true })),
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
      case 'chest':
        this.input.consume('pause');
        if (this.chestWait <= 0) this.chestScreen.handleInput(this.input);
        else this.input.flush();
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
      case 'intro':
        if (this.input.consume('pause')) {
          this.pause();
          break;
        }
        this.input.flush();
        this.introTimer -= dtReal;
        this.cam.look(this.input, dtReal);
        if (this.introTimer <= 0) {
          const def = bossOf(this.stationDef.id);
          this.state = 'playing';
          if (def) this.spawnBoss(def);
          this.lock();
        }
        break;
      case 'cleared': {
        if (!this.clearedScreen.open && this.input.consume('pause')) {
          this.pause();
          break;
        }
        this.rebuildTimer += dtReal;
        const rebuild = TUNING.boss.rebuild;
        const progress = Math.min(1, this.rebuildTimer / rebuild);
        this.world.rebuildTracks(progress);
        // One clang per batch of rails landing, so the rebuild is heard as well as seen.
        const landed = Math.floor(progress * 8);
        while (this.railsDropped < landed) {
          this.railsDropped++;
          audio.play('binBreak', 0.5, 0.7 + this.railsDropped * 0.05);
        }
        // Rails back, then the first train in years rolls through, then the screen.
        if (this.rebuildTimer >= rebuild) {
          const t = (this.rebuildTimer - rebuild) / TUNING.boss.train;
          if (t < 1) {
            if (this.trainShot < 0) {
              audio.play('horn');
              audio.playMusic(TRACKS.cleared);
            }
            this.train.update(t);
            this.trainShot = t;
          } else {
            this.train.stop();
            if (!this.clearedScreen.open) this.showCleared();
          }
        }
        this.clearedScreen.handleInput(this.input);
        break;
      }
      case 'idle':
        break;
    }
    this.bossUi.tick(this.visualTime);
    const running = this.state === 'playing' || this.state === 'dying' || this.state === 'intro';
    if (running) this.visualTime += dtReal;
    if (this.interact.render(dtReal, this.visualTime, this.coffeeProgress) && this.state === 'chest') this.chestWait = 0;
    if (this.state === 'chest' && this.chestWait <= 0 && this.pendingReward) {
      const reward = this.pendingReward;
      this.pendingReward = null;
      this.chestScreen.open(reward, this.closeChest);
    }
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
    this.combat.time = this.time;
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
      this.bossStep(dt);
      this.contact();
      // Death is decided right after damage: before regeneration, and before any level-up in this step.
      if (p.hp <= 0) {
        this.die();
        return;
      }
      p.hp = Math.min(p.maxHp, p.hp + this.stats.regen * dt);
      this.arsenal.update(dt, this.load, this.combat);
      this.interact.update(dt, p.pos.x, p.pos.y, p.pos.z, p.sliding, this.rng.drops, this.price(), this.interactEvents);
      this.chestInteraction();
    }
    this.enemies.sweep(this.onEnemyDeath);
    this.enemies.finishDeaths(this.onDeathBurst);
    this.coinTimer -= dt;
    if (this.coinTimer <= 0) this.coinCombo = 0;
    this.pickups.update(dt, p.pos.x, p.pos.y, p.pos.z, TUNING.player.pickupRadius * this.stats.magnet, this.onPickup);
    this.fx.update(dt);
    this.hazards.update(dt, p.pos.x, p.pos.y, p.pos.z, TUNING.player.radius, this.hazardHit);
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
    // A chest opened in this very step owns the screen; its reward may add the level-ups anyway.
    if (this.pendingLevels > 0 && this.state === 'playing') this.openLevelUp();
  }

  /** Sound and sparks for enemy moments the player should notice. */
  private readonly onEnemyEvent = (kind: 'bottle' | 'charge' | 'crash', x: number, y: number, z: number): void => {
    if (kind === 'bottle') {
      audio.play('bottle', 0.5);
      this.particles.burst(x, y + 0.6, z, 3, 2, 0.06, bottleColor, 4, 0.4, y);
      return;
    }
    if (kind === 'charge') {
      audio.play('horn', 0.9);
      return;
    }
    audio.play('slamLand', 0.8);
    this.cam.shake(0.25);
    this.particles.burst(x, y + 0.8, z, 10, 4, 0.12, dustColor, 4, 0.7, y);
  };

  /** A bus that keeps crashing into the same wall reappears somewhere with a clear run at Piotrek. */
  private readonly onBusStuck = (i: number): void => {
    this.spawnPoint(this.rng.spawn, false);
    this.enemies.move(i, this.spawnX, this.spawnZ);
    audio.play('horn', 0.5);
  };

  /** Brings the boss in when the timer runs out, then drives it and watches for its death. */
  private bossStep(dt: number): void {
    const boss = this.boss;
    if (boss) {
      if (boss.index >= 0) this.hazards.anchorBeams(this.enemies.x[boss.index], this.enemies.z[boss.index]);
      this.bossWorld.playerX = this.player.pos.x;
      this.bossWorld.playerY = this.player.pos.y;
      this.bossWorld.playerZ = this.player.pos.z;
      this.bossWorld.arenaRadius = this.world.radius;
      const i = boss.index;
      const x = i >= 0 ? this.enemies.x[i] : this.player.pos.x;
      const y = i >= 0 ? this.enemies.y[i] : this.player.pos.y;
      const z = i >= 0 ? this.enemies.z[i] : this.player.pos.z;
      const alive = boss.update(dt);
      this.bossUi.setHealth(boss.health);
      if (!alive) {
        const def = boss.def;
        boss.clear();
        this.clearStation(def, x, y, z);
      }
      return;
    }
    if (!this.bossSpawned && bossOf(this.stationDef.id) && this.time >= this.bossAt) this.startBoss();
  }

  // Per-step callbacks live in fields so the game loop does not allocate closures.
  private readonly onEnemyDeath = (x: number, y: number, z: number, type: number, elite: boolean, carried: number): void => {
    // The boss is a type of this arena only, so look it up in the pool's own list, not in ENEMIES.
    const def = this.enemies.types[type].def;
    const big = elite || def.behavior === 'charger';
    const r = this.rng.drops;
    if (def.behavior === 'charger') {
      // A fixed payout: the bus is a chest fight, not five free levels.
      for (let k = 0; k < 6; k++) this.pickups.drop(x, y, z, Math.round(def.xp / 6), r);
    } else if (elite) {
      for (let k = 0; k < 6; k++) this.pickups.drop(x, y, z, def.xp * 3, r);
    } else this.pickups.drop(x, y, z, def.xp, r);
    let bottles = carried + (big ? BOTTLES.eliteDrop : r.next() < BOTTLES.enemyChance ? 1 : 0);
    if (def.behavior === 'collector') bottles += 1;
    for (let k = 0; k < bottles; k++) this.pickups.drop(x, y, z, 1, r, Kind.Bottle);
    if (big) {
      // Elites and the bus leave a free chest.
      this.interact.spawnChest(x, this.world.groundAt(x, z, 0.5, y + 1), z, 0);
      this.hud.toast(UI.toast.chest);
    }
    audio.play(def.id === 'golab' ? 'pigeonDie' : 'enemyDie', big ? 1 : 0.7);
    if (def.behavior === 'charger') {
      audio.play('boom');
      this.fx.addRing(x, y, z, 6, critColor, 0.6);
      this.cam.shake(0.6);
    }
  };

  private readonly interactEvents: InteractEvents = {
    binBroken: (x, y, z) => {
      const r = this.rng.drops;
      const [lo, hi] = BOTTLES.bin;
      const n = lo + Math.floor(r.next() * (hi - lo + 1));
      for (let k = 0; k < n; k++) this.pickups.drop(x, y + 0.5, z, 1, r, Kind.Bottle);
      if (r.next() < FOOD.chance) this.pickups.drop(x, y + 0.5, z, FOOD.heal, r, Kind.Food);
      audio.play('binBreak');
      this.cam.shake(0.12);
      this.particles.burst(x, y + 0.5, z, 10, 3, 0.1, binColor, 4, 0.8, y);
    },
    brewed: () => {
      const taken = new Set(this.load.buffs.map((b) => b.stat));
      const options = COFFEE.filter((c) => !taken.has(c.stat));
      const pool = options.length ? options : COFFEE;
      const buff = pool[Math.floor(this.rng.drops.next() * pool.length)];
      this.load.buffs.push({ stat: buff.stat, value: buff.value });
      this.refreshStats();
      audio.play('brewDone');
      this.player.celebrate();
      const effect = buff.text.replace('{v}', buff.percent ? String(Math.round(buff.value * 100)) : String(buff.value).replace('.', ','));
      this.hud.toast(UI.toast.coffee.replace('{name}', buff.name).replace('{effect}', effect));
    },
  };

  private readonly coffeeProgress = (i: number): number => this.interact.coffees[i].charge / this.interact.brewTime;

  private price(): number {
    return chestPrice(this.chestsOpened, BOTTLES.chestBase, BOTTLES.chestStep);
  }

  /** Chest prompt text, rebuilt only when the price, the key or affordability changes. */
  private setChestPrompt(key: string, price: number): void {
    const affordable = this.bottles >= price;
    this.promptPct = -1;
    if (price !== this.promptPrice || key !== this.promptKey || affordable !== this.promptAffordable) {
      this.promptPrice = price;
      this.promptKey = key;
      this.promptAffordable = affordable;
      this.promptText = fillCount(UI.prompt.chest.replace('{key}', key), String(price), price);
    }
    this.hud.setPrompt(this.promptText, affordable);
  }

  /** Prompts for the nearest chest or coffee machine, and opening chests on the interact key. */
  private chestInteraction(): void {
    const p = this.player.pos;
    const key = this.input.usingPad ? UI.prompt.pad : UI.prompt.keyboard;
    const ci = this.interact.chestNear(p.x, p.y, p.z, 1.9);
    const coffee = this.interact.coffeeNear(p.x, p.y, p.z);
    if (ci >= 0) {
      const price = this.interact.chests[ci].price;
      if (price > 0) this.setChestPrompt(key, price);
      else this.hud.setPrompt(UI.prompt.chestFree.replace('{key}', key));
      if (this.input.consume('interact')) {
        if (this.bottles < price) {
          audio.play('denied');
          this.hud.toast(UI.toast.poor.replace('{v}', String(price)));
        } else {
          this.bottles -= price;
          if (price > 0) this.chestsOpened++;
          this.openChestAt(ci);
        }
      }
    } else if (coffee >= 0) {
      const pct = Math.round(this.coffeeProgress(coffee) * 100);
      if (pct !== this.promptPct) {
        this.promptPct = pct;
        this.promptText = UI.prompt.brewing.replace('{v}', String(pct));
      }
      this.hud.setPrompt(this.promptText);
      // The machine gurgles the whole time it brews, not once at the start.
      this.brewSound -= TUNING.simHz > 0 ? 1 / TUNING.simHz : 0;
      if (this.brewSound <= 0) {
        this.brewSound = 0.45;
        audio.play('brew', 0.55);
      }
      this.input.consume('interact');
    } else {
      this.brewSound = 0;
      this.hud.setPrompt('');
      this.input.consume('interact');
    }
  }

  private openChestAt(i: number): void {
    const c = this.interact.chests[i];
    this.interact.startOpening(i);
    this.state = 'chest';
    this.chestWait = 1;
    this.openingChest = i;
    this.hud.setPrompt('');
    this.input.unlockPointer();
    this.input.flush();
    this.wantLock = false;
    audio.duckMusic(true);
    audio.play('chestOpen');
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      this.particles.emit(c.x, c.y + 0.8, c.z, Math.cos(a) * 3, 5 + Math.random() * 3, Math.sin(a) * 3, 1, 0.08, chestColor, 9, c.y);
    }
    const reward = openChest(this.load, this.rng.cards, this.stats.luck);
    if (reward.kind === 'upgrades') this.bottles += reward.bottles;
    this.refreshStats();
    this.updateSlots();
    // The reward screen opens from the frame loop once the lid animation finishes (chestWait hits 0).
    this.pendingReward = reward;
    this.evolvedOnClose = reward.kind === 'evolution';
  }

  private readonly closeChest = (): void => {
    // An evolution lands in the world too: a gold ring and sparks around Piotrek.
    if (this.evolvedOnClose) {
      this.evolvedOnClose = false;
      const p = this.player.pos;
      this.fx.addRing(p.x, p.y, p.z, 4.5, chestColor, 0.7);
      this.fx.addFlash(p.x, p.y + 1, p.z, 1.2, chestColor);
      this.particles.burst(p.x, p.y + 1, p.z, 16, 5, 0.1, chestColor, 7, 0.9, p.y);
      this.cam.shake(0.3);
      this.player.celebrate();
      audio.play('evolve', 0.7);
    }
    this.openingChest = -1;
    this.state = 'playing';
    audio.duckMusic(false);
    this.input.flush();
    this.lock();
  };

  private readonly onDeathBurst = (x: number, y: number, z: number, type: number): void => {
    const pal = this.enemies.palette(type);
    // Fewer, smaller chunks when the screen is already busy.
    const busy = this.particles.active;
    const n = busy > 900 ? 3 : busy > 500 ? 5 : 8;
    const floor = this.enemies.types[type].def.flying ? this.world.groundAt(x, z, 0.1, y) : y;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.particles.emit(x, y + 0.4, z, Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s, 0.6 + Math.random() * 0.4, 0.06 + Math.random() * 0.07, pal[k % pal.length], 18, floor);
    }
  };

  private readonly onPickup = (kind: number, v: number): void => {
    const p = this.player.pos;
    if (kind === Kind.Bottle) {
      this.bottles += v;
      audio.play('bottle', 0.9, 0.95 + Math.random() * 0.1);
      this.particles.emit(p.x, p.y + 1, p.z, (Math.random() - 0.5) * 3, 2.5, (Math.random() - 0.5) * 3, 0.35, 0.07, bottleColor, 6, p.y);
      return;
    }
    if (kind === Kind.Food) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + v);
      audio.play('eat');
      this.hud.toast(UI.toast.food.replace('{name}', FOOD.name).replace('{v}', String(v)));
      return;
    }
    this.xp += v * this.stats.growth;
    this.coinCombo = Math.min(10, this.coinCombo + 1);
    this.coinTimer = 0.5;
    audio.play('coin', 0.8, 1 + this.coinCombo * 0.02);
    this.particles.emit(p.x, p.y + 1, p.z, (Math.random() - 0.5) * 3, 2.5, (Math.random() - 0.5) * 3, 0.35, 0.07, critColor, 6, p.y);
  };

  private readonly hudState = { bottles: 0, hp: 0, maxHp: 0, xp: 0, xpNext: 1, level: 1, time: 0, kills: 0, station: '', toBoss: 0 };

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
    rate *= TUNING.difficulty[this.difficulty].waves;
    if (this.bossSpawned) rate *= TUNING.boss.waveScale;
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
    const busAt = BUS_TIMES[this.nextBus] ?? (BUS_TIMES[BUS_TIMES.length - 1] ?? 400) + (this.nextBus - BUS_TIMES.length + 1) * 150;
    if (this.time >= busAt) {
      this.nextBus++;
      const bus = this.typeIndex('autobus');
      this.spawnPoint(this.rng.spawn, false);
      const minutes = this.time / 60;
      const kurs = TUNING.difficulty[this.difficulty];
      this.enemies.spawn(bus, this.spawnX, this.spawnZ, (1 + minutes * TUNING.waves.hpPerMinute) * kurs.hp, (1 + minutes * TUNING.combat.enemyDamagePerMinute) * kurs.damage, this.rng.spawn);
      audio.play('horn');
      this.hud.toast(UI.toast.bus);
    }
  }

  /** Picks a spawn point out of view when possible, on open ground, inside the fence. */
  /** Result of the last spawnPoint() call: a pair of fields instead of a fresh tuple per spawn. */
  private readonly spawnOpts: SpawnPick[] = [];
  private spawnX = 0;
  private spawnZ = 0;

  private spawnPoint(r: Rng, flying: boolean): void {
    const p = this.player.pos;
    const [r0, r1] = TUNING.waves.spawnRadius;
    const lim = this.world.radius - 3;
    const fx = -Math.sin(this.cam.yaw);
    const fz = -Math.cos(this.cam.yaw);
    this.spawnX = p.x;
    this.spawnZ = p.z + r0;
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
      this.spawnX = x;
      this.spawnZ = z;
      const inView = (Math.sin(a) * fx + Math.cos(a) * fz) > 0.45;
      const onRoof = !flying && this.world.groundAt(x, z, 0.5, 100) > 0.6;
      if ((!inView || attempt >= 4) && !onRoof) return;
    }
  }

  private spawnGroup(any: boolean, elite: boolean): void {
    const r = this.rng.spawn;
    const pick = pickSpawn(spawnOptions(this.time, any, this.spawnOpts), elite, r);
    this.spawnPoint(r, pick.def.flying);
    const cx = this.spawnX;
    const cz = this.spawnZ;
    const minutes = this.time / 60;
    const kurs = TUNING.difficulty[this.difficulty];
    const hpMul = (1 + minutes * TUNING.waves.hpPerMinute) * kurs.hp;
    const dmgMul = (1 + minutes * TUNING.combat.enemyDamagePerMinute) * kurs.damage;
    const n = elite ? 1 : pick.def.group;
    for (let k = 0; k < n; k++) {
      const x = cx + (r.next() - 0.5) * 2.4;
      const z = cz + (r.next() - 0.5) * 2.4;
      this.enemies.spawn(pick.index, x, z, hpMul, dmgMul, r, elite);
      this.particles.burst(x, this.world.groundAt(x, z, 0.3, 50) + 0.2, z, 3, 1.5, 0.12, dustColor, 2, 0.5);
    }
    if (elite) {
      audio.play('elite');
      this.hud.toast(UI.toast.elite.replace('{name}', pick.def.name));
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
      this.spawnPoint(this.rng.spawn, this.enemies.isFlying(i));
      this.enemies.move(i, this.spawnX, this.spawnZ);
    }
  }

  private contact(): void {
    const p = this.player;
    if (p.invulnerable > 0 || this.god) return;
    const e = this.enemies;
    let worst = 0;
    let fromX = 0;
    let fromZ = 0;
    // Wide enough to catch the bus, whose body is far longer than its spawn radius.
    const n = e.query(p.pos.x, p.pos.z, 5.2);
    for (let k = 0; k < n; k++) {
      const i = e.found[k];
      const dy = e.y[i] - p.pos.y;
      if (dy < -1.2 || dy > 2.4) continue;
      if (!e.overlaps(i, p.pos.x, p.pos.z, TUNING.player.radius)) continue;
      // A stunned enemy stands there harmlessly: that is what Gwizdek and Kontrola are for.
      if (TUNING.combat.stunnedHarmless && e.stun[i] > 0) continue;
      if (e.damage[i] > worst) {
        worst = e.damage[i];
        fromX = e.x[i];
        fromZ = e.z[i];
      }
    }
    if (worst <= 0) return;
    this.hurtPlayer(worst, fromX, fromZ);
  }

  /** Damage from anything: enemy contact, a boss slam, a zone, a projectile. */
  private hurtPlayer(amount: number, fromX: number, fromZ: number): void {
    const p = this.player;
    if (p.invulnerable > 0 || this.god || this.state !== 'playing') return;
    const taken = damageTaken(amount, this.stats.armor);
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

  private hitEnemy(i: number, raw: number, crit: boolean, dx: number, dz: number, kb: number, w: OwnedWeapon): boolean {
    const e = this.enemies;
    const x = e.x[i];
    const y = e.y[i];
    const z = e.z[i];
    if (e.dead[i]) return false;
    const amount = e.vulnerable[i] > 0 ? raw * TUNING.combat.vulnerable : raw;
    w.damage += Math.min(amount, Math.max(0, e.hp[i]));
    const killed = e.hit(i, amount, dx, dz, kb);
    if (killed && w.def.perks?.includes('lifesteal') && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + TUNING.combat.lifesteal);
      this.lifestealTimer -= 1;
      if (this.lifestealTimer <= 0) {
        this.lifestealTimer = 6;
        this.particles.burst(this.player.pos.x, this.player.pos.y + 1.1, this.player.pos.z, 4, 2, 0.07, healColor, 5, 0.5);
        audio.play('eat', 0.4);
      }
    }
    // Numbers sit above the body, not inside it: a boss is four metres tall.
    this.numbers.spawn(x, y + 1.1 + e.radius[i] * 0.9, z, amount, crit ? 1 : 0);
    this.particles.burst(x, y + 0.5, z, crit ? 5 : 2, 3, 0.06, crit ? critColor : sparkColor, 3, 0.3, y);
    return killed;
  }

  /** Feedback once per attack (not per enemy): one shake, one sound, rate-limited crit hitstop. */
  private attacked(hits: number, crit: boolean, sound: SfxId | null): void {
    if (sound) audio.play(sound, 0.8);
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

  /** Debug/test helper: drops a free chest at Piotrek's feet and opens it right away. */
  debugOpenChest(): void {
    if (this.state !== 'playing') return;
    const p = this.player.pos;
    this.interact.spawnChest(p.x, this.world.groundAt(p.x, p.z, 0.5, p.y + 1), p.z, 0);
    const i = this.interact.chestNear(p.x, p.y, p.z, 3);
    if (i >= 0) this.openChestAt(i);
  }

  /** Debug/test helper: weapon maxed, four passives maxed except the last (one level left) → a single card. */
  debugNearlyMaxed(): void {
    // Every weapon slot full and maxed, every passive slot full and maxed except one level of the last.
    this.load.weapons = WEAPONS.filter((d) => !d.evolved)
      .slice(0, TUNING.cards.weaponSlots)
      .map((def) => ({ def, level: def.levels.length + 1, mults: [], damage: 0 }));
    this.arsenal.reset();
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
    if (!this.pausable) return;
    // Remember what was interrupted: the intro and the celebration carry on afterwards.
    this.pausedFrom = this.state;
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
    this.state = this.pausedFrom;
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
    const save = this.opts.save;
    save.deaths++;
    save.totalTime += this.time;
    save.bottles += Math.floor(this.bottles / 2);
    const best = progressOf(save, this.stationDef.id);
    save.stations[this.stationDef.id] = { ...best, bestKills: Math.max(best.bestKills, this.enemies.kills) };
    this.opts.onSave(save);
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
    // The rebuild cinematic: after the normal follow, swing the camera onto the passing train.
    if (this.trainShot >= 0) {
      this.cam.lookAtTrain(this.trainShot, this.trackZ());
      this.trainShot = -1;
    }
    this.world.sky.position.copy(this.cam.camera.position);
    p.render(alpha, dt, this.visualTime);
    p.object.visible = !this.cam.close;
    const ground = this.world.groundAt(px, pz, 0.2, py + 0.1);
    this.shadows.begin();
    this.shadows.add(px, ground, pz, 0.5, py - ground);
    this.enemies.render(alpha, this.time, this.shadows);
    this.pickups.render(this.visualTime, this.shadows);
    this.shadows.end();
    this.arsenal.render(this.visualTime, alpha, px, py, pz);
    // Boss wind-up: a ring closing in on it, and the painted lane of a charge.
    if (this.windUpLeft > 0) {
      this.windUpLeft = Math.max(0, this.windUpLeft - dt);
      const t = 1 - this.windUpLeft / this.windUpTotal;
      this.fx.addRing(this.windUpX, this.world.groundAt(this.windUpX, this.windUpZ, 0.3, 50), this.windUpZ, this.windUpR * (1 - t * 0.75), this.windUpColor, 0.08);
    }
    // Bus wind-up: a hazard lane painted on the ground along its charge path.
    const e = this.enemies;
    const pulse = 0.5 + 0.5 * Math.sin(this.visualTime * 10);
    for (let i = 0; i < e.count; i++) {
      if (!e.windingUp(i)) continue;
      this.fx.addWarning(e.x[i], e.y[i], e.z[i], e.chargeX[i], e.chargeZ[i], TUNING.combat.busWarnLength, 3.4, pulse);
    }
    if (this.laneLeft > 0) {
      this.laneLeft = Math.max(0, this.laneLeft - dt);
      this.fx.addWarning(this.laneX, this.world.groundAt(this.laneX, this.laneZ, 0.3, 50), this.laneZ, Math.sin(this.laneAngle), Math.cos(this.laneAngle), this.laneLength, this.laneWidth, pulse);
    }
    this.fx.finishWarnings();
    this.fx.render();
    this.hazards.render(this.visualTime);
    this.particles.render(this.visualTime);
    this.numbers.render();
    this.swooshes.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
    if (this.state !== 'idle' && this.state !== 'dead') {
      const h = this.hudState;
      h.bottles = this.bottles;
      h.hp = p.hp;
      h.maxHp = p.maxHp;
      h.xp = this.xp;
      h.xpNext = xpForLevel(this.level);
      h.level = this.level;
      h.time = this.time;
      h.kills = this.enemies.kills;
      h.station = this.stationDef.name;
      h.toBoss = this.bossSpawned ? 0 : Math.max(0, this.bossAt - this.time);
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
      `przedmioty ${this.pickups.count}, butelki ${this.bottles}`,
      `cząsteczki ${this.particles.active}`,
      `draw calls ${info.render.calls}`,
      `trójkąty ${info.render.triangles}`,
      `geometrie ${info.memory.geometries}, tekstury ${info.memory.textures}`,
    ].join('\n');
  }
}
