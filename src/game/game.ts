import { CircleGeometry, Color, IcosahedronGeometry, MathUtils, Mesh, MeshBasicMaterial, Scene, TetrahedronGeometry, Vector3, type Group, type Material, type Object3D, type WebGLRenderTarget, type WebGLRenderer } from 'three';
import { gameAudio as audio } from '../audio/audio';
import { bossOf, type BossDef } from '../content/bosses';
import { BOTTLES, COFFEE, FALLBACK_CARD, FOOD, PASSIVES, WEAPONS } from '../content/items';
import { TRACKS, trackForBoss, trackForStation } from '../content/music';
import { STATIONS, station, type StationDef } from '../content/stations/index';
import { TUNING } from '../content/tuning';
import { UI } from '../content/ui';
import { Rng, hashSeed } from '../core/rng';
import { hexOf } from '../render/palette';
import { bump, newSave, progressOf, recordClear, see, unlocked, type Difficulty, type Save } from '../core/save';
import type { StatKey } from '../content/achievements';
import type { DailyResult } from '../core/daily';
import { gunProfile } from '../content/skins/catalog';
import { gearName, gunIcon, gunKey, noGear, stattrakFor, type Gear } from './gear';
import { setIconAlias } from '../ui/icons';
import { Shot } from './projectiles';
import { csProbes } from '../render/cs-models';
import { precompile } from '../render/precompile';
import { skinMaterial } from '../render/skin-material';
import { attachBot } from './bot';
import { fmtTime, h, homeTime } from '../ui/dom';
import { CALLS, FINALE } from '../content/dialogs';
import { Portraits } from '../render/portraits';
import { Credits, Dialogue, FinaleUi, type Ending, type Marker } from '../ui/story';
import { BartekRig } from './bartek';
import { Coffee, SlapBar } from './coffee';
import { fillCount } from '../core/text';
import type { Settings } from '../core/settings';
import { rumble } from '../core/platform';
import { keyName, padName, type SettingsScreen } from '../ui/settings';
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
import { Hazards, type HazardHit } from './hazards';
import { pickSpawn, spawnOptions, type SpawnPick } from './spawn';
import { Enemies } from './enemies';
import { Interactables, type InteractEvents } from './interactables';
import { Kind, Pickups } from './pickups';
import { DOOR_OFFSET, Train } from './train';
import { Input } from './input';
import { Player, SLAP_HIT, type PlayerEvents } from './player';
import { applyCard, chestPrice, computeStats, damageTaken, newLoadout, offerCards, openChest, xpForLevel, type Card, type ChestReward, type Loadout, type OwnedWeapon, type Stats } from './progress';
import { WeaponFx } from './weapon-fx';
import { Arsenal, type Combat } from './weapons';
import { World } from './world';

export type GameState = 'idle' | 'intro' | 'playing' | 'levelup' | 'chest' | 'paused' | 'dying' | 'dead' | 'cleared' | 'call' | 'finale' | 'credits';

const DT = 1 / TUNING.simHz;
/** Boss attack side effects: a stun's length, the megaphone's turned controls, the threads' hold. */
const STUN_TIME = 0.9;
const INVERT_TIME = 3;
const SLOW_FACTOR = 0.55;
/** Metres per second the scrap king's magnet drags Piotrek. */
const MAGNET_PULL = 2.6;
const stunColor = new Color('#fff3a0');
const magnetColor = new Color('#7fb8ff');
/** Real seconds the game takes to come back to full speed after an evolution. */
const EVO_SLOW = 1.4;
/** Seconds between the boss of a codzienny kurs falling and its result card. */
const DAILY_CHEER = 2.6;
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
const coffeeColor = new Color('#5a3a22');
const chinaColor = new Color('#f4f2ec');
// Coffee in the air catches the lamps: lighter than in the cup, or the trail reads as soot at night.
const spillColor = new Color('#c48c52');


export interface GameOptions {
  debug: boolean;
  bot: boolean;
  settings: Settings;
  /** The full settings screen (shared with the hub); the pause menu opens it. */
  settingsScreen: SettingsScreen;
  save: Save;
  /** Progress changed (a station cleared, time spent, bottles banked). */
  onSave: (s: Save) => void;
  onQuit: () => void;
  /** Back to the route map (after clearing a station, or from the summary). */
  onRoute: () => void;
  /** The line is finished (Bartek slapped): record it, hand out the rewards, return the end card. */
  onFinish: () => Ending;
  /** A codzienny kurs ended (death, or the boss beaten): its result, for the card and the share link. */
  onDaily: (result: DailyResult) => void;
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
  /** Bottles the last finished run put in the bank (the summary shows them). */
  private banked = 0;
  /** This run's bottles, time and kills are already in the save. */
  private runBanked = false;
  /** The station was rebuilt for the first time: the cleared screen announces a free case. */
  private freeCase = false;
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
  /** What Piotrek carry: skins on Gnat z CS, a ★ knife, gloves, wraps. */
  gear: Gear = noGear();
  /** Attract mode: the hub's bot plays behind the menu, silent, saving nothing, drawn into `target`. */
  demo = false;
  private target: WebGLRenderTarget | null = null;
  private readonly demoSave = newSave();
  private demoStations: string[] = [];
  private demoIndex = 0;
  private demoInput: Input | null = null;
  /** The demo is simulated every frame but drawn only when the hub's screen is on show. */
  renderEnabled = true;
  /** Skin materials of the current wraps (freed when the gear changes). */
  private gearMats: Material[] = [];
  // ---- The finale: Bartek under Dino, his coffee, the slap, the ending.
  readonly portraits: Portraits;
  private readonly finaleUi: FinaleUi;
  private readonly dialogue: Dialogue;
  private readonly call: Dialogue;
  private readonly credits: Credits;
  private bartek: BartekRig | null = null;
  private bartekRig: BartekRig | null = null;
  private coffee: Coffee | null = null;
  private slapBar: SlapBar | null = null;
  private finaleStage: 'knockout' | 'qte' | 'slap' | 'after' | 'ending' | null = null;
  private finaleT = 0;
  /** Seconds left of the knockout's slow motion (-1 when there is none). */
  private koLeft = -1;
  /** The finish has been recorded (it happens the moment the hand lands). */
  private finaleSettled = false;
  private ending: Ending | null = null;
  /** Full-screen flashes allowed (a setting); off, the cuts go through black instead. */
  flashes = true;
  /** Gamepad rumble and phone vibration allowed (a setting). */
  vibration = true;
  private slapFlash = 0;
  /** finaleT when the cup hit the ground (-1 while it flies). */
  private cupLanded = -1;
  private lastClink = 0;
  /** The ending's beats, in finaleT: Piotrek's line, the boarding, the departure. */
  private lineAt = -1;
  private boardAt = -1;
  private departAt = -1;
  private readonly drops: Particles;
  private readonly shards: Particles;
  private readonly puddle: Mesh;
  private readonly markers: Marker[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0, angle: 0, onScreen: false }));
  private readonly markerV = new Vector3();
  private readonly camHead = new Vector3();
  private slapped = false;
  private flyingCup: Group | null = null;
  private readonly cupVel = new Vector3();
  private readonly slapAt = new Vector3();
  private readonly camFocus = new Vector3();
  /** Where the cup came down, for the shatter shot. */
  private readonly cupAt = new Vector3();
  private readonly camLook = new Vector3();
  /** This run's counters, added to the lifetime ones (statistics, achievements) when the run is banked. */
  private readonly runCount = new Map<StatKey, number>();
  /** The day of a codzienny kurs being played (null in a normal run): it does not move the line on. */
  private daily: string | null = null;
  /** Kills per weapon id this run, for StatTrak™ counters. */
  private readonly runKills = new Map<string, number>();
  /** The run's UI: hidden as a whole while the demo plays. */
  private readonly ui = h('div', 'game-ui');
  private readonly playerInput: Input;

  constructor(
    private readonly renderer: WebGLRenderer,
    uiRoot: HTMLElement,
    private input: Input,
    private readonly opts: GameOptions,
  ) {
    this.playerInput = input;
    uiRoot.append(this.ui);
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
    this.hud = new Hud(this.ui);
    this.bossUi = new BossUi(this.ui);
    this.clearedScreen = new ClearedScreen(this.ui);
    this.train = new Train(this.scene);
    this.levelUp = new LevelUpScreen(this.ui);
    this.chestScreen = new ChestScreen(this.ui);
    this.pauseScreen = new PauseScreen(
      this.ui,
      () => {
        this.resume();
      },
      () => {
        this.quit();
      },
      () => {
        opts.settingsScreen.open(() => {
          this.pauseScreen.open();
        });
      },
    );
    this.summary = new SummaryScreen(
      this.ui,
      () => {
        this.summary.close();
        this.start(Date.now());
      },
      () => {
        this.summary.close();
        this.quit();
      },
    );
    this.portraits = new Portraits(renderer);
    this.finaleUi = new FinaleUi(this.ui);
    this.dialogue = new Dialogue(this.ui, this.portraits, 'box');
    this.call = new Dialogue(this.ui, this.portraits, 'call');
    this.credits = new Credits(this.ui);
    // A tap during the slap bar counts as a press (keys and pads come through the input).
    renderer.domElement.addEventListener('pointerdown', this.onSlapTap);
    // The finale's own debris: coffee drops (round) and porcelain shards, and the puddle the cup leaves.
    this.drops = new Particles(this.scene, 260, new IcosahedronGeometry(0.6, 0));
    this.shards = new Particles(this.scene, 80, new TetrahedronGeometry(0.75));
    this.puddle = new Mesh(new CircleGeometry(1, 24), new MeshBasicMaterial({ color: '#3b2112', transparent: true, opacity: 0.88, depthWrite: false }));
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.visible = false;
    this.scene.add(this.puddle);
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
        this.fx.addFlash(x, y, z, r * 0.5, boomColor, true);
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
      // Losing the pointer lock only pauses actual play: the cinematics release it themselves.
      if (this.state === 'playing' && this.wantLock && !this.input.pointerLocked && !this.input.usingTouch && !this.opts.bot && !this.demo) this.pause();
      if (this.input.pointerLocked) this.wantLock = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.interrupt();
        audio.suspend();
      } else audio.resume();
    });
    // Closing or reloading the tab mid-run still brings the bottles home.
    window.addEventListener('pagehide', () => {
      if (!this.demo && this.state !== 'idle' && this.state !== 'dead') this.bank();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'playing' && !this.opts.bot && !this.demo) this.pause();
    });
    renderer.domElement.addEventListener('pointerdown', () => {
      if (this.state === 'playing' && !this.input.pointerLocked && !this.demo) this.lock();
    });
  }

  /** The save this run writes to: the real one, or a throwaway one in the demo. */
  private get save(): Save {
    return this.demo ? this.demoSave : this.opts.save;
  }

  private persist(): void {
    if (!this.demo) this.opts.onSave(this.save);
  }

  applySettings(s: Settings): void {
    this.cam.sensitivity = s.sensitivity;
    this.cam.invertY = s.invertY;
    this.cam.shakeScale = s.shake ? 1 : 0;
    this.cam.baseFov = s.fov;
    this.flashes = s.flashes;
    this.vibration = s.vibration;
    this.fx.colorblind = s.colorblind;
    this.finaleUi.zoom = s.textScale;
    this.bossUi.zoom = s.textScale;
    audio.setVolumes({ music: s.music, sfx: s.sfx, ui: s.ui });
  }

  /** Cosmetic particles thinned out on low quality (gameplay effects stay). */
  setParticleDensity(share: number): void {
    this.particles.density = share;
  }

  /**
   * Compiles every shader and uploads every texture now, so nothing stutters the first time it appears.
   * `demo` is the hub's screen: the attract run draws into it, and a render target needs its own programs.
   */
  warmup(demo: WebGLRenderTarget | null = null): void {
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
    // The CS model parts (the held gun's skin, a scope lens, glove studs). The skin probe is never disposed:
    // three.js deletes a program with the last material that uses it, and the next skin drawn here then
    // compiled it again, for seconds.
    const probes = csProbes();
    this.scene.add(...probes);
    // The plain umbrellas and tickets. Skin wraps on them are compiled by applyWraps, and only for players
    // who wear some: every variant of the skin program is 0.4 s of compiling in Firefox.
    this.fx.setUmbrellaSkin(null);
    this.arsenal.shots.setSkin(Shot.Ticket, null);
    this.compileAll(demo);
    this.scene.remove(...probes);
    this.clearEntities();
    // A warmup mid-session (a new arena) must not undo the wraps that are on.
    this.applyWraps();
  }

  /**
   * Starts compiling every program of the scene for the screen, and for the hub's demo screen (a render
   * target needs programs of its own): in parallel on the GPU where the browser can, and nothing waits for
   * it. A blocking compile and a warm-up frame froze the title for over a second.
   */
  private compileAll(demo: WebGLRenderTarget | null = null): void {
    // compile() skips hidden objects (pooled chests, unused auras), so everything is shown for the pass.
    const hidden: Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) hidden.push(o);
      o.visible = true;
    });
    const r = this.renderer;
    void precompile(r, this.scene, this.cam.camera);
    const screen = demo ?? this.target;
    if (screen) {
      const prev = r.getRenderTarget();
      r.setRenderTarget(screen);
      void precompile(r, this.scene, this.cam.camera);
      r.setRenderTarget(prev);
    }
    for (const o of hidden) o.visible = false;
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
    // Bartek lives at Koluszki only; his rig is built once and kept.
    if (def.id === 'koluszki') this.bartekRig ??= new BartekRig(this.scene);
    this.bartekRig?.setActive(def.id === 'koluszki');
    this.bartek = def.id === 'koluszki' ? this.bartekRig : null;
    this.warmup();
  }

  /** Puts the boss on the tracks after its title card. */
  private startBoss(): void {
    const def = bossOf(this.stationDef.id);
    if (!def) return;
    this.state = 'intro';
    this.introTimer = TUNING.boss.intro;
    this.bossSpawned = true;
    this.bossUi.showIntro(def.name, def.subtitle, def.incoming);
    audio.play('elite');
    audio.playMusic(trackForBoss(def.id));
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
    see(this.save.seen.bosses, def.id);
    this.buzz(0.6, 0.4, 350);
    // Bartek is already there, on his chair under Dino: the fight starts where he sits.
    const seat = def.id === 'bartek' ? TUNING.finale.seat : null;
    // Its touch follows the difficulty like each of its attacks (a Spokojny boss used to bump at full strength).
    boss.spawn(typeIndex, seat ? seat[0] : p.x + Math.sin(a) * dist, seat ? seat[2] + 0.4 : p.z + Math.cos(a) * dist, hpMul, TUNING.difficulty[this.difficulty].damage);
    if (seat) {
      this.coffee = new Coffee();
      this.finaleUi.showMeter(true);
      this.finaleUi.setCoffee(this.coffee.level);
      this.finaleUi.flash(FINALE.hint, true);
      this.bartek?.setShield(this.coffee.level);
      this.enemies.courierOn = true;
    }
    this.boss = boss;
    this.bossUi.hideIntro();
    this.bossUi.showBar(def.name);
    this.bossUi.setHealth(1);
    this.cam.shake(0.6);
  }

  /** Everything the boss asks the arena to do. */
  private readonly bossWorld: BossWorld = {
    slam: (x, z, radius, damage, telegraph, effect) => {
      this.hazards.addMark(x, z, this.world.groundAt(x, z, 0.3, 50), radius, damage * TUNING.difficulty[this.difficulty].damage, telegraph, 0, effect);
      audio.play('denied', 0.4, 0.7);
    },
    zone: (x, z, radius, damage, duration, telegraph, effect) => {
      this.hazards.addMark(x, z, this.world.groundAt(x, z, 0.3, 50), radius, damage * TUNING.difficulty[this.difficulty].damage, telegraph, duration, effect);
      audio.play('splash', 0.45);
    },
    magnet: (duration) => {
      this.magnetLeft = duration;
      this.magnetTick = 0;
      this.hud.toast(UI.status.magnet);
      audio.play('zap', 0.9, 0.6);
    },
    wave: (x, z, radius, damage, speed, effect) => {
      this.hazards.addWave(x, z, radius, damage * TUNING.difficulty[this.difficulty].damage, speed, effect);
      this.cam.shake(0.3);
      audio.play('boom', 0.7);
    },
    beam: (angle, length, damage, duration, speed, telegraph) => {
      const b = this.boss;
      if (!b || b.index < 0) return;
      audio.play('zap', 0.8);
      this.hazards.addBeam(this.enemies.x[b.index], this.enemies.z[b.index], angle, length, damage * TUNING.difficulty[this.difficulty].damage, duration, speed, telegraph);
    },
    shot: (x, y, z, dirX, dirZ, speed, damage, color, look) => {
      this.hazards.addShot(x, y, z, dirX * speed, 0, dirZ * speed, 6, damage * TUNING.difficulty[this.difficulty].damage, hexOf(color), look ?? null);
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
      // Lemurs come from the edge of the car park, with a long way to run: that is the window to stop them.
      if (id === 'lemur') {
        this.sendLemurs(count);
        return;
      }
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
      const pick = (list: readonly string[]): string => list[Math.floor(Math.random() * list.length)] ?? '';
      this.bossUi.say(text === '@insult' ? pick(FINALE.insults) : text === '@refill' ? FINALE.refill : text, this.visualTime);
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

  /** Hazards hurt Piotrek like contact damage does, and some do more (see `AttackEffect`). */
  private readonly hazardHit: HazardHit = {
    hurt: (damage: number): void => {
      this.hurtPlayer(damage, this.player.pos.x, this.player.pos.z);
    },
    effect: (kind) => {
      if (this.god || this.player.dead) return;
      if (kind === 'slow') {
        this.slowed = true;
        return;
      }
      if (kind === 'stun') {
        if (this.stunLeft <= 0) this.hud.toast(UI.status.stun);
        this.stunLeft = STUN_TIME;
        this.particles.burst(this.player.pos.x, this.player.pos.y + 2, this.player.pos.z, 8, 2, 0.08, stunColor, 6, 0.6);
        return;
      }
      if (this.invertLeft <= 0) this.hud.toast(UI.status.invert);
      this.invertLeft = INVERT_TIME;
      this.cam.shake(0.35);
    },
    push: (x, z, r) => {
      // Back out to the edge of the barrier, along the line from its centre.
      const p = this.player.pos;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz) || 1;
      p.x = x + (dx / d) * r;
      p.z = z + (dz / d) * r;
    },
  };
  /** Status effects from boss attacks, seconds left. */
  private stunLeft = 0;
  private invertLeft = 0;
  private slowed = false;
  private magnetLeft = 0;
  private magnetTick = 0;

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
    const nextName = nextId !== undefined && unlocked(this.save, order, nextId) ? station(nextId).name : '';
    // "Otwarta stacja" is news only the first time; a replay just goes on to it.
    const opened = this.freeCase ? nextName : '';
    this.clearedScreen.show(
      {
        boss: def?.name ?? '',
        station: this.stationDef.name,
        time: Math.max(1, this.time - this.bossAt),
        kills: this.enemies.kills,
        bottles: this.banked,
        record: this.newRecord,
        freeCase: this.freeCase,
        opened,
        hasNext: nextName !== '',
      },
      () => {
        const done = (): void => {
          this.state = 'idle';
          this.clearEntities();
          audio.stopMusic();
          this.opts.onRoute();
        };
        // Bartek D. calls after every station, once, sipping his coffee.
        const id = this.stationDef.id;
        const lines = CALLS[id] as (typeof CALLS)[string] | undefined;
        if (!lines || this.save.callsSeen.includes(id)) {
          done();
          return;
        }
        this.state = 'call';
        audio.duckMusic(true);
        this.call.play(lines, () => {
          this.save.callsSeen.push(id);
          this.persist();
          audio.duckMusic(false);
          done();
        });
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
    // The hit blink only runs while playing: left on, it would freeze Piotrek half-visible for the rebuild.
    this.player.invulnerable = 0;
    const save = this.save;
    // The record is the fight, not the six minutes of waiting that every difficulty pads differently.
    const fight = Math.max(1, this.time - this.bossAt);
    const before = progressOf(save, this.stationDef.id);
    // A record beats an earlier time: the very first clear has nothing to beat.
    this.newRecord = before.bestTime > 0 && fight < before.bestTime;
    this.count('bossKills');
    this.buzz(0.5, 0.5, 400);
    // The first rebuild of every station earns a case on the house. A codzienny kurs counts for its own
    // result only: it does not open the line.
    this.freeCase = !this.daily && before.cleared === null;
    if (this.freeCase) save.freeCases++;
    if (!this.daily) recordClear(save, this.stationDef.id, this.difficulty, fight, this.enemies.kills);
    // The boss's bottles spill out for the show, but the run ends here: they go straight to the bank.
    this.bottles += def.bottles;
    this.banked = this.bottles;
    this.bank();
  }

  /**
   * End of a run (cleared, dead or quit): every bottle collected goes to the bank, the time to "Czas do domu",
   * the kills to the StatTrak™ counters of what was equipped.
   */
  private bank(): void {
    // Once per run: quitting from the pause during the rebuild must not count the run twice.
    if (this.runBanked) return;
    this.runBanked = true;
    const save = this.save;
    save.bottles += this.bottles;
    save.deposit += this.bottles;
    save.totalTime += this.time;
    for (const [k, n] of this.runCount) bump(save, k, n);
    bump(save, 'kills', this.enemies.kills);
    bump(save, 'bottlesEarned', this.bottles);
    save.stats.bestLevel = Math.max(save.stats.bestLevel ?? 0, this.level);
    this.runCount.clear();
    for (const [id, n] of this.runKills) {
      const item = stattrakFor(this.gear, id);
      const owned = item ? save.inventory.find((x) => x.uid === item.uid) : undefined;
      if (owned) owned.kills += n;
    }
    this.runKills.clear();
    this.bottles = 0;
    this.persist();
  }

  resize(w: number, h: number): void {
    // The demo keeps the aspect of the screen it is drawn on.
    if (this.target) return;
    this.cam.camera.aspect = w / h;
    this.cam.camera.updateProjectionMatrix();
  }

  /** Puts the gear on: models in Piotrek's hands, how Gnat z CS fires, patterns on projectiles and umbrellas. */
  /**
   * How Gnat z CS fires: its skin's profile (pierce, bursts, rate), except in a codzienny kurs, which is the
   * same run for everyone. Everything else a skin changes is only its look.
   */
  private applyGunProfile(): void {
    this.arsenal.gun = gunProfile(gunKey(this.daily ? noGear() : this.gear));
  }

  /** Real seconds of slow motion left after an evolution. */
  private evoSlow = 0;

  /** Counts runs started (the touch controls show their hints once per run). */
  runId = 0;

  /** Piotrek have stepped onto the train in the ending: not drawn any more. */
  private aboard = false;

  /** The HUD's station line, set once per run (a codzienny kurs says so). */
  private stationLabel = '';

  setGear(gear: Gear): void {
    this.gear = gear;
    this.player.setGear(gear);
    this.applyGunProfile();
    const pal = gear.gun?.look.palette;
    this.arsenal.gunColor = pal ? hexOf(pal[Math.min(1, pal.length - 1)]) : null;
    this.arsenal.swingColor = this.player.kit.swingColor;
    this.arsenal.wrapped.clear();
    for (const id of gear.wraps.keys()) this.arsenal.wrapped.add(id);
    this.applyWraps();
    // HUD and card pictograms follow the gear: a knife for the briefcase, the gun's silhouette for Gnat.
    setIconAlias('teczka', gear.knife ? 'noz' : null);
    setIconAlias('teczka-prezesa', gear.knife ? 'noz' : null);
    setIconAlias('gnat', gunIcon(gear));
    // Every skin shares one shader program per mesh kind, compiled in warmup(): nothing compiles here.
    this.updateSlots();
  }

  /** Paints the wrapped weapons' projectiles and umbrellas with their patterns. */
  private applyWraps(): void {
    const gear = this.gear;
    const old = this.gearMats;
    this.gearMats = [];
    const kinds: [string, Shot][] = [
      ['bilet', Shot.Ticket],
      ['kawa', Shot.Cup],
      ['puszka', Shot.Can],
      ['rozklad', Shot.Paper],
    ];
    for (const [id, kind] of kinds) {
      const wrap = gear.wraps.get(id);
      const mat = wrap ? skinMaterial(wrap.look, 0, 8) : null;
      if (mat) this.gearMats.push(mat);
      this.arsenal.shots.setSkin(kind, mat);
    }
    const parasol = gear.wraps.get('parasol');
    const umbrella = parasol ? skinMaterial(parasol.look, 0, 4) : null;
    if (umbrella) this.gearMats.push(umbrella);
    this.fx.setUmbrellaSkin(umbrella);
    // Wraps are the skin on instanced meshes, programs of their own: compiled now, and before the old wraps
    // are disposed, so the program they share is never deleted in between and compiled again.
    if (this.gearMats.length > 0) this.compileAll();
    for (const m of old) m.dispose();
  }

  /**
   * Attract mode: the bot plays a real run behind the hub, drawn into `target` (the hub's big screen), with
   * the run's UI hidden, its sounds muted and a throwaway save. It hops between the stations it is given.
   */
  startDemo(target: WebGLRenderTarget, stations: string[], seed: number): void {
    if (!this.demoInput) {
      this.demoInput = new Input(this.renderer.domElement, false);
      attachBot(this.demoInput, this, seed);
    }
    this.demo = true;
    this.target = target;
    this.ui.hidden = true;
    audio.muted = true;
    this.input = this.demoInput;
    this.demoStations = stations.length ? stations : [STATIONS[0].id];
    // Stay in the arena that is already built when it is one of them: rebuilding a station hitches the hub.
    const here = this.demoStations.indexOf(this.stationDef.id);
    this.demoIndex = here >= 0 ? here : seed % this.demoStations.length;
    this.cam.camera.aspect = target.width / target.height;
    this.cam.camera.updateProjectionMatrix();
    this.start(seed, this.demoStations[this.demoIndex], 'normalnie');
  }

  /** Back from the demo to a real game (or to nothing): the player's input, sound and UI again. */
  stopDemo(): void {
    if (!this.demo) return;
    this.demo = false;
    this.target = null;
    audio.muted = false;
    this.input = this.playerInput;
    this.state = 'idle';
    this.clearEntities();
    this.train.stop();
    this.bossUi.hide();
    this.hud.show(false);
    this.levelUp.close();
    this.resetFinale();
    this.call.stop();
    this.ui.hidden = false;
    const c = this.renderer.domElement;
    this.resize(Math.max(1, c.clientWidth), Math.max(1, c.clientHeight));
  }

  /** The demo run ended (death or a cleared station): a fresh run in the same arena (no rebuild, no hitch). */
  private demoNext(): void {
    this.start(Math.floor(Math.random() * 1e9), this.demoStations[this.demoIndex], 'normalnie');
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

  start(seed: number, stationId = this.stationDef.id, difficulty = this.save.difficulty, daily: string | null = null): void {
    this.runId++;
    this.hud.clearToasts();
    this.evoSlow = 0;
    this.daily = daily;
    this.applyGunProfile();
    this.runCount.clear();
    this.loadStation(station(stationId));
    this.stationLabel = daily ? `${this.stationDef.name} · ${UI.daily.hudTag}` : this.stationDef.name;
    this.difficulty = difficulty;
    this.bossAt = TUNING.difficulty[difficulty].bossAt;
    this.bossSpawned = false;
    this.boss = null;
    this.introTimer = 0;
    this.rebuildTimer = 0;
    this.bossUi.hide();
    this.hazards.clear();
    this.world.rebuildTracks(0);
    this.resetFinale();
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
    this.runKills.clear();
    this.runBanked = false;
    this.player.reset();
    this.interact.reset(this.rng.drops, chestPrice(0, BOTTLES.chestBase, BOTTLES.chestStep));
    this.cam.reset(0);
    this.levelUp.close();
    this.state = 'playing';
    this.hud.show(true);
    this.updateSlots();
    audio.playMusic(trackForStation(this.stationDef.id));
    audio.musicIntensity(0);
    this.save.runs++;
    this.persist();
    audio.duckMusic(false);
    if (!audio.unlocked && !this.opts.bot && !this.demo) this.hud.toast(UI.toast.sound);
    this.input.flush();
    this.lock();
  }

  /** States the game may be paused from (anything that is running, cinematics included). */
  /** Something took the player away (the tab hid, the phone turned to portrait): pause whatever can be. */
  interrupt(): void {
    if (this.pausable && !this.opts.bot && !this.demo) this.pause();
  }

  private get pausable(): boolean {
    return this.state === 'playing' || this.state === 'intro' || (this.state === 'cleared' && !this.clearedScreen.open) || (this.state === 'finale' && !this.dialogue.playing);
  }

  private lock(): void {
    if (this.opts.bot || this.demo) return;
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
    // A weapon is "held" from the moment it first shows in the slots.
    for (const w of this.load.weapons) w.since ??= this.time;
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
        // An evolution comes back into the fight in slow motion, easing up to full speed.
        if (this.evoSlow > 0) {
          this.evoSlow = Math.max(0, this.evoSlow - dtReal);
          this.timeScale = 1 - 0.7 * (this.evoSlow / EVO_SLOW);
        }
        this.advance(dtReal);
        if (this.koLeft >= 0) this.koFrame(dtReal);
        break;
      case 'dying':
        this.advance(dtReal);
        this.deathTimer -= dtReal;
        if (this.deathTimer <= 0) {
          if (this.demo) this.demoNext();
          else if (this.daily) this.finishDaily(false);
          else this.showSummary();
        }
        break;
      case 'chest':
        this.input.consume('pause');
        if (this.chestWait <= 0) this.chestScreen.handleInput(this.input);
        else this.input.flush();
        break;
      case 'levelup':
        this.levelUp.setPad(this.input.usingPad, this.input.usingTouch);
        this.levelUp.handleInput(this.input);
        // The pause key does nothing while choosing a card (the game is already stopped).
        this.input.consume('pause');
        break;
      case 'paused':
        if (this.opts.settingsScreen.isOpen) this.opts.settingsScreen.handleInput(this.input);
        else
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
        // Esc during a dialogue skips it; only without one does it pause.
        if (!this.clearedScreen.open && !this.dialogue.playing && this.input.consume('pause')) {
          this.pause();
          break;
        }
        this.rebuildTimer += dtReal;
        // A codzienny kurs rebuilds nothing (the line stays as the player left it): a moment of the boss
        // falling and Piotrek cheering, then the result card.
        if (this.daily) {
          if (this.rebuildTimer >= DAILY_CHEER) this.finishDaily(true);
          break;
        }
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
            if (this.demo) this.demoNext();
            else if (!this.clearedScreen.open) this.showCleared();
          }
        }
        if (this.dialogue.playing) {
          this.dialogue.tick(dtReal);
          this.dialogue.handleInput(this.input);
        } else this.clearedScreen.handleInput(this.input);
        break;
      }
      case 'call':
        this.call.tick(dtReal);
        this.call.handleInput(this.input);
        break;
      case 'finale':
        this.finaleFrame(dtReal);
        break;
      case 'credits':
        this.credits.tick(dtReal);
        this.credits.handleInput(this.input);
        break;
      case 'idle':
        break;
    }
    this.bossUi.tick(this.visualTime);
    const running = this.state === 'playing' || this.state === 'dying' || this.state === 'intro';
    if (running) this.visualTime += dtReal;
    // After the boss falls the simulation stops, but its flash, the sparks and the damage numbers still have
    // to play out and fade (left alone they hung in the air through the whole rebuild).
    if (this.state === 'cleared' || this.state === 'call') {
      this.visualTime += dtReal;
      this.fx.update(dtReal);
      this.particles.update(dtReal);
      this.numbers.update(dtReal);
    }
    if (this.interact.render(dtReal, this.visualTime, this.coffeeProgress) && this.state === 'chest') this.chestWait = 0;
    if (this.state === 'chest' && this.chestWait <= 0 && this.pendingReward) {
      const reward = this.pendingReward;
      this.pendingReward = null;
      if (this.demo) this.closeChest();
      else this.chestScreen.open(reward, this.closeChest);
    }
    if (this.renderEnabled || !this.demo) {
      const t0 = performance.now();
      // Cutscenes animate the characters by hand: full interpolation, real time.
      const cutscene = this.state === 'finale';
      this.render(cutscene ? 1 : this.acc / DT, running || cutscene ? dtReal : 0);
      this.renderMs += (performance.now() - t0 - this.renderMs) * 0.1;
    }
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
    // Boss effects on the controls: a stun stops Piotrek where they stand, the megaphone turns the controls
    // round, the spinning mill's threads hold them back.
    if (this.stunLeft > 0 || this.invertLeft > 0) {
      this.stunLeft = Math.max(0, this.stunLeft - dt);
      this.invertLeft = Math.max(0, this.invertLeft - dt);
      const inp = this.input;
      if (this.stunLeft > 0) {
        inp.moveX = inp.moveY = 0;
        inp.consumeAny('jump', 'slide');
      } else if (this.invertLeft > 0) {
        inp.moveX = -inp.moveX;
        inp.moveY = -inp.moveY;
      }
    }
    p.update(dt, this.input, this.cam.yaw, this.stats.speed * (this.slowed ? SLOW_FACTOR : 1), this.events, playing);
    this.slowed = false;
    if (this.magnetLeft > 0) this.magnetStep(dt);
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
    if (playing) this.hud.tickToasts(dt);
    if (playing) this.leash(dt);
    if (!playing) return;

    audio.musicIntensity(this.time < 25 ? 0 : this.time < 80 ? 1 : this.time < 200 ? 2 : 3);
    while (this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      this.pendingLevels++;
    }
    // A chest opened in this very step owns the screen; its reward may add the level-ups anyway.
    if (this.pendingLevels > 0 && this.state === 'playing' && this.koLeft < 0) this.openLevelUp();
  }

  /** Sound and sparks for enemy moments the player should notice. */
  private readonly onEnemyEvent = (kind: 'bottle' | 'charge' | 'crash' | 'delivery', x: number, y: number, z: number): void => {
    if (kind === 'delivery') {
      this.coffee?.refill();
      audio.play('lemur');
      audio.play('sip', 0.5, 1.2);
      this.particles.burst(x, y + 0.6, z, 6, 2.5, 0.07, coffeeColor, 4, 0.5, y);
      this.finaleUi.flash(UI.finale.refill);
      return;
    }
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
      if (this.coffee && boss.index >= 0) this.finaleStep(dt, boss);
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
    see(this.save.seen.enemies, def.id);
    if (def.id === 'golab') this.count('pigeons');
    else if (def.id === 'lemur') this.count('lemurs');
    else if (def.id === 'kontroler') this.count('inspectors');
    if (elite) this.count('elites');
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
      this.count('bins');
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
      this.count('coffees');
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
    if (this.koLeft >= 0) return;
    const p = this.player.pos;
    // The player's own binding for the action (rebinding changes what the prompt says).
    const key = this.input.usingTouch ? UI.prompt.touch : this.input.usingPad ? padName(this.opts.settings.pad.interact) : keyName(this.opts.settings.keys.interact);
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
    this.count('chests');
    if (reward.kind === 'evolution') {
      this.count('evolutions');
      see(this.save.seen.evolutions, reward.weapon.def.id);
    }
    if (reward.kind === 'upgrades') {
      this.bottles += reward.bottles;
      for (const card of reward.cards) this.nameCard(card);
    }
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
      this.evoSlow = EVO_SLOW;
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

  /**
   * The scrap king's magnet: Piotrek are dragged towards him, and every few tenths of a second a bottle flies
   * out of their pockets into his (lost from the run).
   */
  private magnetStep(dt: number): void {
    this.magnetLeft -= dt;
    const b = this.boss;
    if (!b?.alive || this.state !== 'playing') {
      this.magnetLeft = 0;
      return;
    }
    const e = this.enemies;
    const p = this.player.pos;
    const dx = e.x[b.index] - p.x;
    const dz = e.z[b.index] - p.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d > e.radius[b.index] + 1.2) {
      p.x += (dx / d) * MAGNET_PULL * dt;
      p.z += (dz / d) * MAGNET_PULL * dt;
    }
    this.magnetTick -= dt;
    if (this.magnetTick <= 0) {
      this.magnetTick = 0.35;
      this.fx.addRing(e.x[b.index], e.y[b.index] + 0.2, e.z[b.index], e.radius[b.index] + 2 + Math.random(), magnetColor, 0.35);
      if (this.bottles > 0 && !this.god) {
        this.bottles--;
        this.particles.emit(p.x, p.y + 1.2, p.z, (dx / d) * 9, 3, (dz / d) * 9, 0.6, 0.18, bottleColor, 4, p.y);
        audio.play('bottle', 0.5, 0.7);
      }
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
      // Stragglers come back round to Piotrek; a boss never jumps (Bartek is tied to his chair).
      if (dx * dx + dz * dz < L * L || this.enemies.isBoss(i)) continue;
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
    if (p.invulnerable > 0 || this.god || this.state !== 'playing' || this.koLeft >= 0) return;
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
    this.buzz(0.55, 0.35, 120);
  }

  private hitEnemy(i: number, raw: number, crit: boolean, dx: number, dz: number, kb: number, w: OwnedWeapon): boolean {
    const e = this.enemies;
    const x = e.x[i];
    const y = e.y[i];
    const z = e.z[i];
    if (e.dead[i]) return false;
    let amount = e.vulnerable[i] > 0 ? raw * TUNING.combat.vulnerable : raw;
    const boss = this.boss;
    if (this.coffee && boss && boss.index === i) {
      const soaked = 1 - this.coffee.taken;
      amount *= this.coffee.taken;
      this.bartek?.hit(soaked);
      // A full cup rings like porcelain: the hits are not getting through.
      if (soaked > 0.4 && this.visualTime - this.lastClink > 0.18) {
        this.lastClink = this.visualTime;
        audio.play('clink', soaked);
      }
      // The last blow does not kill him: it knocks him out for the slap.
      if (amount >= e.hp[i]) {
        amount = Math.max(0, e.hp[i] - 1);
        this.startKo();
      }
    }
    w.damage += Math.min(amount, Math.max(0, e.hp[i]));
    const killed = e.hit(i, amount, dx, dz, kb);
    if (killed) this.runKills.set(w.def.id, (this.runKills.get(w.def.id) ?? 0) + 1);
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
    if (this.demo) {
      this.demoLevelUp();
      return;
    }
    this.cards = this.offer();
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
    this.levelUp.setPad(this.input.usingPad, this.input.usingTouch);
    this.levelUp.open(this.cards, this.counters, this.levelActions, true);
  }

  // ---------- The finale ----------

  private resetFinale(): void {
    this.finaleStage = null;
    this.finaleSettled = false;
    this.koLeft = -1;
    this.coffee = null;
    this.slapBar = null;
    this.ending = null;
    this.cupLanded = -1;
    this.lastClink = 0;
    this.finaleUi.hideAll();
    this.dialogue.stop();
    this.enemies.courierOn = false;
    this.player.kit.bareRightHand(false);
    this.player.slapT = -1;
    this.aboard = false;
    if (this.flyingCup) {
      this.scene.remove(this.flyingCup);
      this.flyingCup = null;
    }
    this.puddle.visible = false;
    this.drops.clear();
    this.shards.clear();
    this.bartek?.reset(TUNING.finale.seat);
  }

  /** Coffee, sips and Bartek's buff, every step of the fight. */
  private finaleStep(dt: number, boss: Boss): void {
    const coffee = this.coffee;
    if (!coffee) return;
    const e = this.enemies;
    const i = boss.index;
    const phase = boss.phaseNumber;
    if (phase > 0) this.bartek?.standUp();
    e.courierX = e.x[i];
    e.courierZ = e.z[i];
    if (coffee.update(dt, phase)) {
      e.hp[i] = Math.min(e.maxHp[i], e.hp[i] + e.maxHp[i] * TUNING.finale.sipHeal);
      this.bartek?.sip();
      audio.play('sip');
      this.finaleUi.flash(phase >= 2 ? FINALE.gulp : FINALE.sip);
    }
    // A sip makes him quicker for a while.
    this.bossWorld.pace = TUNING.difficulty[this.difficulty].bossPace * (coffee.buffed ? TUNING.finale.buffPace : 1);
    this.finaleUi.setCoffee(coffee.level);
    this.bartek?.setShield(coffee.level);
    this.bartek?.setFace(phase >= 2 ? 'angry' : 'smirk');
  }

  /**
   * Lemurs with refills, from the car park round the far side of Bartek from Piotrek (never out of the shop
   * behind him): stopping them means leaving him alone for a moment.
   */
  private sendLemurs(n: number): void {
    const type = this.typeIndex('lemur');
    const boss = this.boss;
    if (type < 0 || !boss || boss.index < 0) return;
    const e = this.enemies;
    const bx = e.x[boss.index];
    const bz = e.z[boss.index];
    const p = this.player.pos;
    // The open half is south of him (+z). Within it, as far round from Piotrek as it goes.
    const pa = Math.atan2(p.x - bx, p.z - bz);
    const half = Math.PI / 2;
    const base = Math.abs(pa) > half ? 0 : pa >= 0 ? -half * 0.85 : half * 0.85;
    const [r0, r1] = TUNING.finale.lemurRing;
    const lim = this.world.radius - 3;
    const minutes = this.time / 60;
    const kurs = TUNING.difficulty[this.difficulty];
    const r = this.rng.spawn;
    for (let k = 0; k < n; k++) {
      const a = Math.max(-half, Math.min(half, base + (k - (n - 1) / 2) * 0.32 + (r.next() - 0.5) * 0.2));
      const d = r0 + r.next() * (r1 - r0);
      let x = bx + Math.sin(a) * d;
      let z = bz + Math.cos(a) * d;
      const m = Math.hypot(x, z);
      if (m > lim) {
        x *= lim / m;
        z *= lim / m;
      }
      e.spawn(type, x, z, (1 + minutes * TUNING.waves.hpPerMinute) * kurs.hp * TUNING.finale.lemurHp, kurs.damage, r);
    }
    audio.play('lemur', 0.8);
  }

  /** The blow that would have killed him: a beat of slow motion, a flash, and the cut to the slap. */
  private startKo(): void {
    if (this.koLeft >= 0) return;
    this.koLeft = TUNING.finale.koTime;
    this.timeScale = TUNING.finale.koSpeed;
    this.bossUi.say('', this.visualTime);
    this.bartek?.daze(true);
    this.bartek?.setFace('butthurt');
    this.finaleUi.showMeter(false);
    this.buzz(0.9, 0.6, 500);
    audio.play('elite');
    audio.stopMusic();
    this.cam.shake(0.5);
  }

  /** Runs in the frame while the knockout's slow motion plays; the cut happens behind the full flash. */
  private koFrame(dt: number): void {
    this.koLeft -= dt;
    const t = TUNING.finale.koTime - this.koLeft;
    const rise = Math.max(0, Math.min(1, (t - (TUNING.finale.koTime - 0.4)) / 0.4));
    this.finaleUi.cover(this.flashes ? '#ffffff' : '#000000', rise);
    if (this.koLeft <= 0) this.knockout();
  }

  /** Everything stops and goes; a cut to his chair under the Dino sign, face to face. */
  private knockout(): void {
    this.koLeft = -1;
    this.timeScale = 1;
    const boss = this.boss;
    if (!boss) return;
    // Whatever corner of the car park the fight ended in, the slap plays on the same clear stretch of
    // tarmac in front of his chair, and the cup flies east along the shop front.
    const [sx, sy, sz] = TUNING.finale.seat;
    this.slapAt.set(sx, this.world.groundAt(sx, sz + 1.2, 0.3, sy + 1), sz + 1.2);
    boss.clear();
    this.boss = null;
    this.bossUi.hide();
    this.coffee = null;
    this.enemies.courierOn = false;
    this.enemies.clear();
    this.hazards.clear();
    this.numbers.clear();
    this.swooshes.clear();
    this.arsenal.stow();
    this.interact.hideChests();
    this.pickups.clear();
    this.particles.clear();
    this.fx.clear();
    this.hud.show(false);
    this.finaleUi.setMarkers(this.markers, 0);
    this.finaleStage = 'knockout';
    this.finaleT = 0;
    this.slapped = false;
    this.state = 'finale';
    this.input.unlockPointer();
    this.input.flush();
    const p = this.player;
    p.invulnerable = 0;
    p.slapT = 0;
    p.pos.set(this.slapAt.x - 1.05, this.world.groundAt(this.slapAt.x - 1.05, this.slapAt.z, 0.3, this.slapAt.y + 1), this.slapAt.z);
    p.prev.copy(p.pos);
    p.vel.set(0, 0, 0);
    p.facing = Math.PI / 2;
    p.kit.bareRightHand(true);
    this.bartek?.place(this.slapAt.x, this.slapAt.y, this.slapAt.z, -Math.PI / 2);
    this.bartek?.daze(true);
  }

  /** The knockout's beat, the slap bar, the slap, the cup's flight, his last words, the ending. */
  private finaleFrame(dt: number): void {
    // Esc pauses the cutscene (inside a dialogue it skips the dialogue instead).
    if (!this.dialogue.playing && this.input.consume('pause')) {
      this.pause();
      return;
    }
    this.finaleT += dt;
    // Slow motion from the hand landing to the cup hitting the ground; the shatter plays at full speed.
    const flying = this.finaleStage === 'slap' && this.finaleT > SLAP_HIT && this.cupLanded < 0;
    const vdt = dt * (flying ? TUNING.finale.slowMo : 1);
    this.visualTime += vdt;
    switch (this.finaleStage) {
      case 'knockout':
        this.finaleUi.cover(this.flashes ? '#ffffff' : '#000000', Math.max(0, 1 - this.finaleT / 0.6));
        if (this.finaleT > 1.4) {
          this.finaleStage = 'qte';
          this.finaleT = 0;
          this.slapBar = new SlapBar(this.rng.combat);
          const k = UI.finale.keys;
          this.finaleUi.showQte(this.input.usingTouch ? k.touch : this.input.usingPad ? k.pad : k.keyboard);
          this.finaleUi.setQte(this.slapBar.pos, this.slapBar.centre, this.slapBar.width);
          this.input.flush();
        }
        break;
      case 'qte': {
        const bar = this.slapBar;
        if (!bar) break;
        // Judged against the cursor the player can see (the one drawn last frame), then it moves on.
        const pressed = this.input.consume('confirm') || this.input.consume('jump') || this.input.consume('interact');
        this.input.flush();
        if (pressed && this.pressSlap()) break;
        bar.update(dt);
        this.finaleUi.setQte(bar.pos, bar.centre, bar.width);
        break;
      }
      case 'slap':
        this.slapFrame(dt, vdt);
        this.input.flush();
        break;
      case 'ending':
        this.endingFrame(dt);
        break;
      default:
        break;
    }
    if (this.dialogue.playing) {
      this.dialogue.tick(dt);
      this.dialogue.handleInput(this.input);
    }
    this.bartek?.update(vdt, this.visualTime, false);
    // The simulation step is not running here, so the flash, the sparks, the drops and the shards move on
    // their own.
    this.fx.update(vdt);
    this.particles.update(vdt);
    this.drops.update(vdt);
    this.shards.update(vdt);
  }

  /** A press on the slap bar; true when it landed. */
  private pressSlap(): boolean {
    const bar = this.slapBar;
    if (!bar || this.finaleStage !== 'qte') return false;
    if (!bar.press()) {
      this.finaleUi.missQte();
      audio.play('denied');
      this.bossUi.say(FINALE.miss[Math.min(bar.misses - 1, FINALE.miss.length - 1)] ?? '', this.visualTime);
      return false;
    }
    this.finaleUi.hideQte();
    this.bossUi.say('', this.visualTime);
    this.finaleStage = 'slap';
    this.finaleT = 0;
    audio.play('jump', 0.6, 0.7);
    return true;
  }

  /** The bar is under the mouse or a finger too: a tap anywhere counts as the press. */
  private readonly onSlapTap = (): void => {
    if (this.finaleStage === 'qte') this.pressSlap();
  };

  /**
   * The swing; the hand lands at `SLAP_HIT` (the line is finished right there, whatever happens after);
   * then the cup flies across the car park in slow motion, shatters, and the shot holds on the mess.
   */
  private slapFrame(dt: number, vdt: number): void {
    const t = this.finaleT;
    const p = this.player;
    p.slapT = this.slapped ? SLAP_HIT + (t - SLAP_HIT) * TUNING.finale.slowMo * 2.2 : t;
    if (!this.slapped && t >= SLAP_HIT) {
      this.slapped = true;
      this.settleFinale();
      this.buzz(1, 1, 350);
      audio.play('slap');
      this.cam.shake(1);
      this.finaleUi.showSlap();
      if (this.flashes) this.slapFlash = 1;
      const b = this.bartek;
      if (b) {
        b.slapped();
        b.head(this.camLook);
        this.particles.burst(this.camLook.x, this.camLook.y, this.camLook.z, 14, 3.5, 0.06, sparkColor, 3, 0.5, this.slapAt.y);
        const from = b.loseCup();
        const cup = b.cupCopy();
        cup.position.copy(from);
        cup.scale.setScalar(1.8);
        this.scene.add(cup);
        this.flyingCup = cup;
        // Off his hand, away from Piotrek: east along the shop front, high and far.
        this.cupVel.set(6.5, 6.2, 0.4);
      }
    }
    if (this.slapFlash > 0) {
      this.slapFlash = Math.max(0, this.slapFlash - dt * 4);
      this.finaleUi.cover('#ffffff', this.slapFlash * 0.55);
    }
    if (this.slapped && t > SLAP_HIT + 1.7) this.finaleUi.hideSlap();
    const cup = this.flyingCup;
    if (cup) {
      const k = vdt * 1.6;
      this.cupVel.y -= 9.8 * k;
      cup.position.addScaledVector(this.cupVel, k);
      cup.rotation.x += k * 9;
      cup.rotation.z += k * 6;
      const floor = this.world.groundAt(cup.position.x, cup.position.z, 0.1, cup.position.y + 0.5);
      // Kopi luwak spilling behind it all the way: the trail is what the eye follows.
      this.drops.emit(cup.position.x, cup.position.y, cup.position.z, (Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6, 1.2, 0.05, spillColor, 9, floor);
      if (cup.position.y <= floor + 0.05 && this.cupVel.y < 0) {
        const c = cup.position;
        this.shards.burst(c.x, floor + 0.08, c.z, 26, 3.6, 0.09, chinaColor, 5, 1.6, floor);
        this.drops.burst(c.x, floor + 0.05, c.z, 18, 2.2, 0.06, spillColor, 3, 1.2, floor);
        this.fx.addRing(c.x, floor, c.z, 1.4, chinaColor, 0.4);
        this.puddle.position.set(c.x, floor + 0.02, c.z);
        this.puddle.scale.setScalar(0.01);
        this.puddle.visible = true;
        audio.play('shatter');
        this.cam.shake(0.3);
        this.scene.remove(cup);
        this.flyingCup = null;
        this.cupAt.set(c.x, floor, c.z);
        this.cupLanded = t;
      }
    }
    if (this.cupLanded >= 0) {
      // The kopi luwak spreading on the tarmac.
      const s = Math.min(1, (t - this.cupLanded) / 1.2);
      this.puddle.scale.setScalar(0.12 + (1 - (1 - s) * (1 - s)) * 0.6);
      if (t - this.cupLanded > 1.5 && !this.dialogue.playing) {
        this.finaleStage = 'after';
        this.finaleT = 0;
        this.finaleUi.hideSlap();
        this.dialogue.play(FINALE.after, () => {
          this.startEnding();
        });
      }
    }
  }

  /**
   * The line is done: bank it, record it, hand out what the finish brings. Runs the moment the hand lands,
   * once, so quitting or closing the tab during the cutscene that follows loses nothing.
   */
  private settleFinale(): void {
    if (this.finaleSettled || this.demo) return;
    this.finaleSettled = true;
    const def = bossOf(this.stationDef.id);
    const save = this.save;
    const fight = Math.max(1, this.time - this.bossAt);
    recordClear(save, this.stationDef.id, this.difficulty, fight, this.enemies.kills);
    this.count('bossKills');
    this.count('slaps');
    this.bottles += def?.bottles ?? 0;
    this.banked = this.bottles;
    this.bank();
    this.ending = this.opts.onFinish();
  }

  /** Where the ending plays: Piotrek at the platform edge, the train's track, the stop for the door. */
  private endingSpot(): { x: number; edgeZ: number; trackZ: number } {
    let platformZ = 27.4;
    let half = 2.9;
    for (const pr of this.stationDef.props) {
      if (pr.kind === 'platform') {
        platformZ = pr.at[2];
        half = pr.size[2] / 2;
      }
    }
    let trackZ = this.trackZ();
    for (const pr of this.stationDef.props) if (pr.kind === 'tracks') for (const z of pr.z) if (z < platformZ && z > trackZ) trackZ = z;
    // West of the canopy, before the ramp: no posts, benches or crates between the camera and Piotrek.
    return { x: -16, edgeZ: platformZ - half + 0.7, trackZ };
  }

  /** Black, then the platform: the rails go back, the train comes in and stops, a door opens for Piotrek. */
  private startEnding(): void {
    this.finaleStage = 'ending';
    this.finaleT = 0;
    this.boardAt = -1;
    this.departAt = -1;
    this.lineAt = -1;
    this.railsDropped = 0;
    this.drops.clear();
    this.shards.clear();
    this.puddle.visible = false;
    const spot = this.endingSpot();
    const p = this.player;
    p.slapT = -1;
    p.kit.bareRightHand(false);
    this.aboard = false;
    p.pos.set(spot.x, this.world.groundAt(spot.x, spot.edgeZ, 0.3, 3), spot.edgeZ);
    p.prev.copy(p.pos);
    p.vel.set(0, 0, 0);
    p.facing = Math.PI;
    this.train.start(spot.trackZ);
    this.finaleUi.cover('#000000', 1);
    audio.playMusic(TRACKS.ending);
    audio.musicIntensity(0);
  }

  private endingFrame(dt: number): void {
    const t = this.finaleT;
    const spot = this.endingSpot();
    const stopX = spot.x - DOOR_OFFSET;
    this.finaleUi.cover('#000000', Math.max(0, 1 - t / 0.9));
    // The rails drop back in, with a clang per batch.
    const progress = Math.max(0, Math.min(1, (t - 0.7) / 3));
    this.world.rebuildTracks(progress);
    const landed = Math.floor(progress * 8);
    while (this.railsDropped < landed) {
      this.railsDropped++;
      audio.play('binBreak', 0.5, 0.7 + this.railsDropped * 0.05);
    }
    // In from the west, braking to a stop with its door at Piotrek.
    const arrive = Math.max(0, Math.min(1, (t - 3.9) / 5.2));
    if (t >= 3.9 && this.departAt < 0) {
      if (t - dt < 3.9) audio.play('horn');
      this.train.place(stopX - (1 - arrive) * (1 - arrive) * 160);
    }
    // The door opens, Piotrek say their line, step aboard; the door shuts and the train pulls out.
    if (t >= 9.3 && this.lineAt < 0) {
      this.lineAt = t;
      audio.play('door');
      audio.musicIntensity(2);
      this.dialogue.play(FINALE.train, () => {
        this.boardAt = this.finaleT;
      });
    }
    if (this.lineAt >= 0) this.train.setDoor(Math.min(1, (t - this.lineAt) / 0.6));
    const p = this.player;
    if (this.boardAt >= 0 && this.departAt < 0) {
      if (p.walkTo(spot.x, spot.trackZ + 1.3, 1.7, dt)) {
        this.aboard = true;
        this.departAt = t;
        audio.play('door');
      } else if (p.pos.z < spot.trackZ + 1.75) this.aboard = true;
    } else {
      p.prev.copy(p.pos);
      p.vel.set(0, 0, 0);
    }
    if (this.departAt >= 0) {
      const d = t - this.departAt;
      this.train.setDoor(Math.max(0, 1 - d / 0.6));
      if (d > 1) {
        if (d - dt <= 1) {
          audio.play('horn');
          audio.musicIntensity(3);
        }
        this.train.place(stopX + (d - 1) * (d - 1) * 4.5);
      }
      if (d > 5.5) this.finaleUi.cover('#000000', Math.min(1, (d - 5.5) / 1.2));
      if (d > 6.9) this.showCredits();
    }
  }

  /** The end card ("Normalnie 20 minut…") and the credits, then the hub. */
  private showCredits(): void {
    this.state = 'credits';
    this.finaleStage = null;
    this.train.stop();
    this.finaleUi.hideAll();
    this.credits.show(this.ending ?? { home: homeTime(this.save.homeTime || this.save.totalTime), extras: [] }, () => {
      this.state = 'idle';
      this.clearEntities();
      this.resetFinale();
      audio.stopMusic();
      this.opts.onQuit();
    });
  }

  /** Bartek's body follows his boss (or sits on his chair before the fight, or stands knocked out). */
  private renderBartek(alpha: number, dt: number): void {
    const b = this.bartek;
    if (!b) return;
    const boss = this.boss;
    if (boss && boss.index >= 0 && this.state !== 'finale') {
      const e = this.enemies;
      const i = boss.index;
      const x = e.px[i] + (e.x[i] - e.px[i]) * alpha;
      const y = e.py[i] + (e.y[i] - e.py[i]) * alpha;
      const z = e.pz[i] + (e.z[i] - e.pz[i]) * alpha;
      const moving = Math.hypot(e.x[i] - e.px[i], e.z[i] - e.pz[i]) > 1e-4;
      b.place(x, y, z, e.yaw[i]);
      b.update(dt, this.visualTime, moving);
    } else if (this.state !== 'finale') b.update(dt, this.visualTime, false);
  }

  /** Cups over the lemurs carrying refills, or arrows on the screen edge when they are out of the shot. */
  private updateMarkers(): void {
    this.bossMarker();
    if (!this.coffee || this.demo) return;
    const e = this.enemies;
    const type = this.typeIndex('lemur');
    const cam = this.cam.camera;
    const w = this.renderer.domElement.clientWidth;
    const hgt = this.renderer.domElement.clientHeight;
    let n = 0;
    for (let i = 0; i < e.count && n < this.markers.length; i++) {
      if (e.type[i] !== type || e.dead[i]) continue;
      const v = this.markerV.set(e.x[i], e.y[i] + 1.15, e.z[i]).project(cam);
      const m = this.markers[n++];
      // Behind the camera the projection flips: mirror it so the arrow points the right way.
      const behind = v.z > 1;
      const sx = behind ? -v.x : v.x;
      const sy = behind ? -v.y : v.y;
      m.onScreen = !behind && Math.abs(sx) < 0.94 && Math.abs(sy) < 0.9;
      if (m.onScreen) {
        m.x = (sx * 0.5 + 0.5) * w;
        m.y = (0.5 - sy * 0.5) * hgt;
      } else {
        const k = 0.9 / Math.max(Math.abs(sx), Math.abs(sy), 1e-3);
        m.x = (sx * k * 0.5 + 0.5) * w;
        m.y = (0.5 - sy * k * 0.5) * hgt;
        m.angle = Math.atan2(-sy, sx);
      }
    }
    this.finaleUi.setMarkers(this.markers, n);
  }

  /**
   * A boss walks in from a random side and can be anywhere in a big arena: while it is off screen, an arrow
   * at the edge points to it (so a fight never starts with "where is it?").
   */
  private bossMarker(): void {
    const b = this.boss;
    if (!b?.alive || this.state !== 'playing' || this.demo || this.finaleStage) {
      this.bossUi.setMark(false);
      return;
    }
    const e = this.enemies;
    const v = this.markerV.set(e.x[b.index], e.y[b.index] + e.radius[b.index], e.z[b.index]).project(this.cam.camera);
    const behind = v.z > 1;
    const sx = behind ? -v.x : v.x;
    const sy = behind ? -v.y : v.y;
    if (!behind && Math.abs(sx) < 0.95 && Math.abs(sy) < 0.92) {
      this.bossUi.setMark(false);
      return;
    }
    const w = this.renderer.domElement.clientWidth;
    const hgt = this.renderer.domElement.clientHeight;
    const k = 0.86 / Math.max(Math.abs(sx), Math.abs(sy), 1e-3);
    this.bossUi.setMark(true, (sx * k * 0.5 + 0.5) * w, (0.5 - sy * k * 0.5) * hgt, Math.atan2(-sy, sx));
  }

  /** During the knockout, the slap and the ending, the camera works the scene like a cutscene. */
  private finaleCamera(): void {
    const stage = this.finaleStage;
    const cam = this.cam.camera;
    if (stage === 'ending') {
      const spot = this.endingSpot();
      // On the platform, close behind Piotrek's shoulder: the rails and then the train across the frame.
      cam.position.set(spot.x - 3.1, 2.05, spot.edgeZ + 2.3);
      cam.lookAt(this.camLook.set(spot.x + 0.9, 1.6, spot.trackZ + 0.2));
      return;
    }
    const b = this.bartek;
    if (!stage || !b) return;
    const head = b.head(this.camHead);
    const px = this.player.pos.x;
    const pz = this.player.pos.z;
    // Side-on to the two of them, from the car park (Dino is behind them, to the north).
    const ax = head.x - px;
    const az = head.z - pz;
    const al = Math.hypot(ax, az) || 1;
    const flip = ax < 0 ? -1 : 1;
    const sx = (-az / al) * flip;
    const sz = (ax / al) * flip;
    const mid = this.camFocus.set((head.x + px) / 2, head.y - 0.15, (head.z + pz) / 2);
    if (stage === 'knockout' || stage === 'qte') {
      const push = stage === 'knockout' ? 1 - Math.min(1, this.finaleT / 1.4) : 0;
      const ease = push * push * (3 - 2 * push);
      cam.position.set(mid.x + sx * (2.5 + ease * 3), mid.y + 0.35 + ease, mid.z + sz * (2.5 + ease * 3));
      cam.lookAt(this.camLook.set(mid.x, mid.y + 0.25, mid.z));
    } else if (stage === 'slap') {
      // The hand landing in the close two-shot (the big word over them), then a tracking shot running
      // alongside the cup's arc and down onto the shards.
      const t = this.finaleT;
      const c = this.flyingCup?.position ?? (this.cupLanded >= 0 ? this.cupAt : mid);
      const w = this.cupLanded >= 0 ? 1 : MathUtils.smoothstep(t, SLAP_HIT + 0.45, SLAP_HIT + 1.1);
      const x0 = mid.x + sx * 2.5;
      const y0 = mid.y + 0.2;
      const z0 = mid.z + sz * 2.5;
      const x1 = c.x + sx * 1.15 - 0.7;
      const y1 = Math.max(this.slapAt.y + 0.45, c.y + 0.25);
      const z1 = c.z + sz * 1.15;
      cam.position.set(x0 + (x1 - x0) * w, y0 + (y1 - y0) * w, z0 + (z1 - z0) * w);
      // Looking above their heads at first, so the two of them sit under "LIŚĆ!".
      const lx = mid.x + (c.x - mid.x) * w;
      const ly = mid.y + 0.75 * (1 - w) + (c.y - mid.y) * w;
      const lz = mid.z + (c.z - mid.z) * w;
      cam.lookAt(this.camLook.set(lx, ly, lz));
    } else {
      cam.position.set(mid.x + sx * 3.6, mid.y + 0.7, mid.z + sz * 3.6);
      cam.lookAt(this.camLook.set(mid.x, mid.y + 0.35, mid.z));
    }
  }

  /** Level-up cards, named after the gear ("Parasol (AWP | Asiimov)") and saying how the gun fires. */
  private offer(): Card[] {
    const cards = offerCards(this.load, this.rng.cards, this.stats.luck);
    for (const c of cards) this.nameCard(c);
    return cards;
  }

  private nameCard(c: Card): void {
    c.name = gearName(this.gear, c.id, c.name);
    if (c.id === 'gnat' && c.level === 1) c.lines.push(gunProfile(gunKey(this.gear)).text);
  }

  /**
   * A rumble for the moments that should be felt (hits, a boss arriving, the slap): the pad's motors, or a
   * phone's vibration, when the setting allows it. Never in the attract mode.
   */
  private buzz(strong: number, weak: number, ms: number): void {
    if (!this.vibration || this.demo) return;
    if (this.input.usingPad) rumble(strong, weak, ms);
    // Safari has no vibration API; Chrome refuses (with a console error) before the first user gesture.
    else if (this.input.usingTouch && 'vibrate' in navigator && 'userActivation' in navigator && navigator.userActivation.hasBeenActive) navigator.vibrate(Math.round(ms * strong));
  }

  private count(key: StatKey, by = 1): void {
    this.runCount.set(key, (this.runCount.get(key) ?? 0) + by);
  }

  /** Lifetime counters as they stand right now, this run included (achievements earned mid-run). */
  liveStats(): Partial<Record<StatKey, number>> {
    const s = { ...this.save.stats };
    if (this.runBanked || this.state === 'idle' || this.demo) return s;
    for (const [k, n] of this.runCount) s[k] = (s[k] ?? 0) + n;
    s.kills = (s.kills ?? 0) + this.enemies.kills;
    s.bottlesEarned = (s.bottlesEarned ?? 0) + this.bottles;
    s.bestLevel = Math.max(s.bestLevel ?? 0, this.level);
    return s;
  }

  /** The end of a codzienny kurs: bank it like any run, then hand its result over for the card. */
  private finishDaily(cleared: boolean): void {
    const day = this.daily;
    if (!day) return;
    if (!cleared) this.save.deaths++;
    this.banked = this.bottles;
    this.bank();
    const result: DailyResult = {
      day,
      station: this.stationDef.id,
      kills: this.enemies.kills,
      level: this.level,
      time: Math.round(this.time),
      cleared,
      weapons: this.load.weapons.map((w) => w.def.id),
    };
    this.daily = null;
    this.applyGunProfile();
    this.state = 'idle';
    this.timeScale = 1;
    this.train.stop();
    this.bossUi.hide();
    this.hud.show(false);
    this.clearEntities();
    this.input.unlockPointer();
    this.input.flush();
    audio.stopMusic();
    this.opts.onDaily(result);
  }

  /** The boss's slot in the enemy pool (-1 without one): the bot closes in on it. */
  get bossIndex(): number {
    return this.boss?.index ?? -1;
  }

  /** The slap bar as the bot sees it: where the cursor is and where it should be (null outside the QTE). */
  get slapWindow(): { pos: number; centre: number; width: number } | null {
    return this.finaleStage === 'qte' ? this.slapBar : null;
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

  /** The demo takes its cards on the spot: new weapons, then weapon levels, then passives. */
  private demoLevelUp(): void {
    while (this.pendingLevels > 0) {
      this.pendingLevels--;
      const cards = offerCards(this.load, this.rng.cards, this.stats.luck);
      let best = cards[0];
      const rank = (c: Card): number => (c.kind === 'weapon' ? (c.level === 1 ? 0 : 1) : 2);
      for (const c of cards) if (rank(c) < rank(best)) best = c;
      if (best.kind === 'fallback') this.player.hp = Math.min(this.player.maxHp, this.player.hp + FALLBACK_CARD.heal);
      applyCard(this.load, best);
    }
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
      this.cards = this.offer();
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
      this.cards = this.offer();
      this.levelUp.open(this.cards, this.counters, this.levelActions, false);
    },
  };

  private nextLevel(): void {
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.cards = this.offer();
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
    const kurs = UI.route.difficulties.find(([id]) => id === this.difficulty)?.[1] ?? '';
    this.pauseScreen.open(`${this.stationDef.name} · ${fmtTime(this.time)} · ${kurs} · v${__APP_VERSION__}`);
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
    const save = this.save;
    save.deaths++;
    const best = progressOf(save, this.stationDef.id);
    save.stations[this.stationDef.id] = { ...best, bestKills: Math.max(best.bestKills, this.enemies.kills) };
    this.banked = this.bottles;
    this.bank();
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
      weapons: this.load.weapons.map((w) => ({ name: gearName(this.gear, w.def.id, w.def.name), damage: w.damage, seconds: this.time - (w.since ?? 0) })),
      bottles: this.banked,
      line: lines[Math.floor(this.rng.cards.next() * lines.length)] ?? '',
    });
  }

  private quit(): void {
    if (this.state !== 'idle' && this.state !== 'dead') this.bank();
    this.state = 'idle';
    this.resetFinale();
    this.call.stop();
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
    // The rebuild cinematic: the camera leaves the player for the line, then turns to the passing train.
    if ((this.state === 'cleared' || this.state === 'call') && !this.daily) this.cam.lookAtRebuild(this.rebuildTimer, px, py, pz, this.trackZ(), this.world);
    if (this.trainShot >= 0) {
      this.cam.lookAtTrain(this.trainShot, this.trackZ());
      this.trainShot = -1;
    }
    this.renderBartek(alpha, dt);
    this.finaleCamera();
    this.updateMarkers();
    this.world.sky.position.copy(this.cam.camera.position);
    p.render(alpha, dt, this.visualTime);
    // Hidden when the camera is pressed into them, and once they are on the train at the end.
    p.object.visible = !this.cam.close && !this.aboard;
    const ground = this.world.groundAt(px, pz, 0.2, py + 0.1);
    this.shadows.begin();
    this.shadows.add(px, ground, pz, 0.5, py - ground);
    this.enemies.eye.copy(this.cam.camera.position);
    this.enemies.render(alpha, this.time, this.shadows);
    this.pickups.render(this.visualTime, this.shadows);
    this.shadows.end();
    // The cinematic after the knockout has no weapons out: no orbiting umbrellas, no garlic ring.
    if (!this.finaleStage) this.arsenal.render(this.visualTime, alpha, px, py, pz);
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
    this.drops.render(this.visualTime);
    this.shards.render(this.visualTime);
    this.numbers.render();
    this.swooshes.update(dt);
    if (this.target) {
      this.renderer.setRenderTarget(this.target);
      this.renderer.render(this.scene, this.cam.camera);
      this.renderer.setRenderTarget(null);
    } else this.renderer.render(this.scene, this.cam.camera);
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
      h.station = this.stationLabel;
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
