import './fonts.css';
import './style.css';
import './hub.css';
import './story.css';
import { ACESFilmicToneMapping, WebGLRenderer } from 'three';
import { audio } from './audio/audio';
import { bossOf } from './content/bosses';
import { TRACKS } from './content/music';
import { loadSkinDb, type SkinDb } from './content/skins/index';
import { STATIONS } from './content/stations/index';
import { UI } from './content/ui';
import { installCrashOverlay, showNoWebGL } from './core/fatal';
import { furthest, isSaveKey, loadSave, saveSave, unlocked, type Save } from './core/save';
import { loadSettings, saveSettings } from './core/settings';
import { fillCount } from './core/text';
import { attachBot } from './game/bot';
import { Game, homeTime } from './game/game';
import type { Ending } from './ui/story';
import { fullName, lookOf, noGear, resolveGear, type Gear } from './game/gear';
import { Input } from './game/input';
import { HubScene } from './hub/hub-scene';
import { Thumbs } from './render/thumbs';
import { TitleScene } from './title-scene';
import { h, leave } from './ui/dom';
import { HubMenu } from './ui/hub-menu';
import { InventoryScreen } from './ui/inventory';
import { RecyklomatScreen, addDrop, type ShopContext } from './ui/recyklomat';
import { Intro } from './game/intro';
import { Rng } from './core/rng';
import { rollFloat } from './game/skins';
import { RouteScreen } from './ui/route';
import { StartPrompt } from './ui/screens';

// The bundle is running: cancel the boot watchdog from index.html.
document.documentElement.dataset.boot = '1';
document.getElementById('boot-fail')?.remove();
installCrashOverlay();

const params = new URLSearchParams(location.search);
const BOT = params.has('bot');
const DEBUG = params.has('debug');
// A fixed ?seed= replays the same run every time; otherwise every run gets a fresh one.
const FIXED_SEED = params.has('seed') ? Number(params.get('seed')) || 1 : null;
const newSeed = (): number => FIXED_SEED ?? (Date.now() % 2147483647);
// ?stacja=widzew (or ?station=) drops straight into one arena. A dev flag: without ?debug= or ?bot= it
// would let anyone skip the whole line, so it only works together with one of those.
const STATION = DEBUG || BOT ? (params.get('stacja') ?? params.get('station')) : null;

function buildTitle(): HTMLElement {
  const root = h('main', 'title');
  const board = h('section', 'board');
  board.setAttribute('aria-label', UI.board.header);
  const row = h('div', 'board__row');
  row.append(h('span', 'board__time', UI.board.time), h('span', 'board__train', UI.board.train), h('span', 'board__dest', UI.board.destination), h('span', 'board__status', UI.board.status));
  board.append(h('div', 'board__header', UI.board.header), row);
  root.append(h('h1', 'title__logo', UI.title), h('p', 'title__route', UI.line), board, h('p', 'title__teaser', UI.teaser));
  return root;
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLElement>('#ui');
if (!canvas || !ui) throw new Error('index.html is missing #scene or #ui');

// Create the context ourselves: no probe context to leak or lose, and a failure lands on the no-WebGL panel.
const gl = 'WebGL2RenderingContext' in window ? canvas.getContext('webgl2', { antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' }) : null;

if (!gl) {
  canvas.remove();
  showNoWebGL();
} else {
  const renderer = new WebGLRenderer({ canvas, context: gl });
  renderer.toneMapping = ACESFilmicToneMapping;
  const title = new TitleScene(renderer);
  const input = new Input(canvas);
  const titleUi = buildTitle();
  const version = h('footer', 'version', `v${__APP_VERSION__} · ${__GIT_SHA__}`);
  const titleLayer = h('div', 'layer');
  titleLayer.append(titleUi);
  ui.append(titleLayer, version);
  const prompt = new StartPrompt(titleUi);
  let mode: 'title' | 'hub' | 'route' | 'intro' | 'game' = 'title';
  let game: Game | null = null;
  let hub: HubScene | null = null;
  let thumbs: Thumbs | null = null;
  let intro: Intro | null = null;
  let db: SkinDb | null = null;
  let gear: Gear = noGear();
  const save: Save = loadSave();
  const route = new RouteScreen(ui, save);
  const hubMenu = new HubMenu(ui);
  const shop = new RecyklomatScreen(ui);
  const inventory = new InventoryScreen(ui);

  /**
   * Another tab (or a newer build) has saved since this tab loaded: this one stops writing, so it cannot
   * overwrite newer progress, and asks to be reloaded.
   */
  let conflicted = false;
  const showConflict = (why: 'stale' | 'newer'): void => {
    if (conflicted) return;
    conflicted = true;
    const layer = h('div', 'overlay conflict');
    const box = h('div', 'panel');
    const reload = h('button', 'btn', UI.conflict.reload);
    reload.addEventListener('click', () => {
      location.reload();
    });
    box.append(h('h2', 'panel__title', UI.conflict[why]), h('p', 'panel__hint', UI.conflict.body), reload);
    layer.append(box);
    ui.append(layer);
    reload.focus();
  };
  window.addEventListener('storage', (e) => {
    if (isSaveKey(e.key)) showConflict('stale');
  });

  /** Saves, and refreshes everything that shows the bank. */
  const persist = (): void => {
    if (!conflicted) {
      const result = saveSave(save);
      if (result === 'stale' || result === 'newer') showConflict(result);
    }
    hub?.setBank(save.bottles);
    hubMenu.update(save, gear, db !== null);
  };

  /** Equipment changed (or the skins just loaded): rebuild what Piotrek hold, in the hub and in the game. */
  const applyGear = (): void => {
    gear = resolveGear(save, db);
    game?.setGear(gear);
    hub?.setGear(gear);
    hubMenu.update(save, gear, db !== null);
  };

  /** Stations the attract mode may show: the ones already reachable, so it never spoils the line. */
  // The finale is never attract-mode material: a spoiler, and a cutscene the bot has no business in.
  const demoStations = (): string[] => STATIONS.filter((s) => bossOf(s.id) && s.id !== 'koluszki' && unlocked(save, STATIONS.map((x) => x.id), s.id)).map((s) => s.id);

  const startDemo = (): void => {
    if (!game || !hub || game.demo) return;
    game.startDemo(hub.demoTarget, demoStations(), Math.floor(Math.random() * 1e6));
  };

  /** The hub: the forecourt with the recyklomat, and the menu. Bottles from the last run go in first. */
  const showHub = (): void => {
    mode = 'hub';
    input.flush();
    leave(titleLayer);
    prompt.show(false);
    route.close();
    shop.close();
    inventory.close();
    version.hidden = false;
    audio.playMusic(TRACKS.menu);
    startDemo();
    if (hub) {
      hub.setView('main');
      hubMenu.update(save, gear, db !== null);
      if (save.deposit > 0) {
        const n = Math.round(save.deposit);
        hub.deposit(n, save.bottles);
        hub.note(fillCount(UI.hub.deposited, String(n), n));
        hubMenu.showBank(hub.shownBank);
        hubMenu.showDeposit(n);
        save.deposit = 0;
        persist();
      } else hub.setBank(save.bottles);
    } else hubMenu.update(save, gear, db !== null);
    hubMenu.open({ play: playIntroOrRoute, recyklomat: openShop, inventory: openInventory });
    revealPending();
  };

  const shopContext = (d: SkinDb, t: Thumbs): ShopContext => ({ db: d, thumbs: t, save, persist, note: (text) => hub?.note(text), dropCase: () => hub?.dropCase() });

  const openShop = (): void => {
    if (!db || !thumbs) return;
    hubMenu.close();
    inventory.close();
    hub?.setView('recyklomat');
    shop.open(shopContext(db, thumbs), showHub);
  };

  /** A case or contract result the player never saw (the page closed mid-roulette) is shown now. */
  const revealPending = (): void => {
    const uid = save.pendingReveal;
    if (mode !== 'hub' || uid === null || !db || !thumbs || !hubMenu.isOpen) return;
    hubMenu.close();
    hub?.setView('recyklomat');
    shop.openReveal(shopContext(db, thumbs), uid, showHub);
  };

  const openInventory = (): void => {
    if (!db || !thumbs) return;
    hubMenu.close();
    hub?.setView('inventory');
    inventory.open(
      {
        db,
        thumbs,
        save,
        persist,
        gearChanged: applyGear,
        inspect: (def, owned) => {
          hub?.inspect(def?.weapon ?? null, def && owned ? lookOf(owned, def) : null);
        },
        replayInspect: () => hub?.replayInspect(),
        turn: (dx, dy) => hub?.turnInspect(dx, dy),
        toShop: openShop,
      },
      showHub,
    );
  };

  /** The first trip starts with the intro (why the walk); after that, straight to the line. */
  const playIntroOrRoute = (): void => {
    if (save.introSeen || !intro || !game) {
      showRoute();
      return;
    }
    mode = 'intro';
    input.flush();
    hubMenu.close();
    version.hidden = true;
    game.stopDemo();
    intro.play(() => {
      save.introSeen = true;
      persist();
      showRoute();
    });
  };

  /**
   * The line is finished: count it, put Bartek's cup in the display case, and leave a ★ on his chair (a knife
   * or gloves from any case). Returns the lines for the end card.
   */
  const finishLine = (): Ending => {
    const extras: string[] = [];
    save.finished++;
    // The end card's time is the trip to the first finish: replays do not stretch it.
    if (!save.homeTime) save.homeTime = save.totalTime;
    if (!save.trophies.includes('filizanka')) {
      save.trophies.push('filizanka');
      extras.push(UI.finale.trophy);
    }
    if (save.finished === 1 && db) {
      // The first finish only: a ★ knife or gloves from any case, unveiled in the hub like a case drop.
      const rare = db.cases.flatMap((c) => c.rare);
      const rng = new Rng(save.caseRng);
      const def = rare[Math.floor(rng.next() * rare.length)];
      const owned = addDrop(save, { def, float: rollFloat(def, rng), seed: rng.int(0, 1000), stattrak: false });
      save.caseRng = rng.state;
      save.pendingReveal = owned.uid;
      extras.push(UI.finale.reward.replace('{v}', fullName(db, def, owned.stattrak)));
    } else if (save.finished > 1) {
      // Beating him again is worth a case on the house, not another ★ (that would be a ★ farm).
      save.freeCases++;
      extras.push(UI.finale.replay);
    }
    persist();
    hub?.setTrophies(save.trophies);
    return { home: homeTime(save.homeTime), extras };
  };

  /** The route map: pick a stop on line 17 and the difficulty, then go. */
  const showRoute = (): void => {
    mode = 'route';
    input.flush();
    leave(titleLayer);
    prompt.show(false);
    hubMenu.close();
    version.hidden = false;
    audio.playMusic(TRACKS.menu);
    startDemo();
    hub?.setView('main');
    route.open(save, {
      play: (stationId) => {
        mode = 'game';
        route.close();
        version.hidden = true;
        game?.stopDemo();
        game?.start(newSeed(), stationId, save.difficulty);
      },
      back: showHub,
      difficulty: () => {
        persist();
      },
    });
  };

  const start = (): void => {
    if (mode !== 'title' || !game) return;
    audio.unlock();
    audio.play('start');
    showHub();
  };

  // Resolution follows the canvas size and the device pixel ratio (zoom, moving between screens).
  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const hgt = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, hgt, false);
    title.resize(w, hgt);
    game?.resize(w, hgt);
    hub?.resize(w, hgt);
    intro?.resize(w, hgt);
  };
  new ResizeObserver(resize).observe(canvas);
  const watchPixelRatio = (): void => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        resize();
        watchPixelRatio();
      },
      { once: true },
    );
  };
  watchPixelRatio();
  resize();

  let last = performance.now();
  let frames = 0;
  /** Phone-sized screens: the side panels cover the whole scene. */
  const narrow = matchMedia('(max-width: 900px), (max-height: 560px)');
  renderer.setAnimationLoop((now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (mode === 'title') {
      title.frame(dt);
      input.poll();
      if (game && (input.consume('confirm') || input.consume('jump'))) start();
      input.flush();
    } else if (mode === 'hub' || mode === 'route') {
      // The demo run plays into the big screen, then the forecourt is drawn around it. The demo is drawn
      // every other frame, and not at all when its screen is covered by a panel or out of the shot.
      if (game && hub) {
        const covered = mode === 'route' || ((shop.isOpen || inventory.isOpen) && narrow.matches);
        game.renderEnabled = !covered && frames % 2 === 0 && hub.screenInView;
        game.frame(dt);
        hub.frame(dt);
        if (hub.depositing) hubMenu.showBank(hub.shownBank);
      }
      input.poll();
      if (mode === 'route') route.handleInput(input);
      else if (shop.isOpen) shop.handleInput(input);
      else if (inventory.isOpen) inventory.handleInput(input);
      else hubMenu.handleInput(input);
      input.flush();
    } else if (mode === 'intro') {
      input.poll();
      intro?.handleInput(input);
      input.flush();
      intro?.frame(dt);
    } else game?.frame(dt);
    if (++frames === 30) document.body.dataset.ready = '1';
  });

  // Build the game in the background once the title is on screen, so starting is instant. Wait for the
  // font first: signs and the damage-digit atlas are drawn into canvases once and would keep a fallback font.
  const settings = loadSettings();
  const build = (): void => {
    game = new Game(renderer, ui, input, {
      debug: DEBUG,
      bot: BOT,
      settings,
      save,
      onSettings: saveSettings,
      onSave: persist,
      onQuit: showHub,
      onRoute: showRoute,
      onFinish: finishLine,
    });
    game.resize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
    game.warmup();
    hub = new HubScene(renderer);
    hub.resize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
    hub.setTrophies(save.trophies);
    hub.warmup();
    intro = new Intro(renderer, ui, game.portraits);
    intro.resize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
    // The two leads' faces render in the background, so no dialogue waits for its portrait.
    game.portraits.preload();
    thumbs = new Thumbs(renderer);
    prompt.ready();
    // Skins load as their own chunk; the hub's shop and inventory wait for them, nothing else does.
    void loadSkinDb().then((d) => {
      db = d;
      // Skins that left the snapshot (a newer data update) leave the inventory, and with it the equipment.
      const known = save.inventory.filter((s) => d.skins.has(s.skin));
      if (known.length !== save.inventory.length) {
        save.inventory = known;
        const has = (uid: number | null): number | null => (uid !== null && known.some((s) => s.uid === uid) ? uid : null);
        save.equip.gun = has(save.equip.gun);
        save.equip.knife = has(save.equip.knife);
        save.equip.gloves = has(save.equip.gloves);
        save.equip.wraps = Object.fromEntries(Object.entries(save.equip.wraps).filter(([, uid]) => has(uid) !== null));
        persist();
      }
      applyGear();
      revealPending();
    });
    if (BOT || STATION) {
      // No hub: straight into the arena that was asked for, or the furthest one reached.
      const order = STATIONS.map((s) => s.id);
      const id = STATION && order.includes(STATION) ? STATION : furthest(save, order);
      if (BOT) attachBot(input, game, FIXED_SEED ?? 1);
      audio.unlock();
      mode = 'game';
      // Straight into the arena: no exit animation to wait for.
      titleLayer.hidden = true;
      prompt.show(false);
      version.hidden = true;
      game.start(newSeed(), id, save.difficulty);
    }
    if (BOT || DEBUG) {
      const g = game;
      Object.assign(window, { __game: g, __save: save, __info: () => ({ ...renderer.info.memory }) });
      window.setInterval(() => {
        Object.assign(document.body.dataset, { mode, demo: String(g.demo), state: g.state, level: String(g.level), kills: String(g.enemies.kills), enemies: String(g.enemies.count), time: g.time.toFixed(1), fps: g.fps.toFixed(0), sim: g.simMs.toFixed(2), render: g.renderMs.toFixed(2), calls: String(renderer.info.render.calls) });
      }, 250);
    }
  };
  const fontsReady = Promise.all(['500 16px', '700 16px', '800 16px'].map((f) => document.fonts.load(`${f} "Barlow Condensed"`)));
  void fontsReady.catch(() => undefined).then(() => window.setTimeout(build, 30));

  const gesture = (): void => {
    // Any real gesture unlocks audio (a gamepad press does not count as one in browsers).
    audio.unlock();
    if (mode === 'title') start();
  };
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F1' && e.code !== 'Escape') gesture();
  });
}
