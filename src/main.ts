import './fonts.css';
import './style.css';
import './hub.css';
import './story.css';
import './platform.css';
import { ACESFilmicToneMapping, WebGLRenderer } from 'three';
import { audio } from './audio/audio';
import { bossOf } from './content/bosses';
import { TRACKS } from './content/music';
import { loadSkinDb, type SkinDb } from './content/skins/index';
import { STATIONS, station } from './content/stations/index';
import { UI } from './content/ui';
import { installCrashOverlay, showNoWebGL } from './core/fatal';
import { furthest, isSaveKey, loadSave, newSave, saveSave, unlocked, type Save } from './core/save';
import { loadSettings, saveSettings } from './core/settings';
import { fillCount } from './core/text';
import { attachBot } from './game/bot';
import { Game } from './game/game';
import type { Ending } from './ui/story';
import { fullName, lookOf, noGear, resolveGear, type Gear } from './game/gear';
import { Input } from './game/input';
import { HubScene } from './hub/hub-scene';
import { Thumbs } from './render/thumbs';
import { TitleScene } from './title-scene';
import { enter, h, homeTime, leave, setColorblind } from './ui/dom';
import { HubMenu } from './ui/hub-menu';
import { InventoryScreen } from './ui/inventory';
import { RecyklomatScreen, addDrop, type ShopContext } from './ui/recyklomat';
import { Intro } from './game/intro';
import { Rng } from './core/rng';
import { rollFloat } from './game/skins';
import { RouteScreen } from './ui/route';
import { StartPrompt } from './ui/screens';
import { SettingsScreen, keyName, padName } from './ui/settings';
import { TouchControls } from './ui/touch';
import { WakeLock, copyLater, download, fullscreenAvailable, isFullscreen, pickFile, setFullscreen, share } from './core/platform';
import { codeToSave, fileToSave, saveToCode, saveToFile, type Imported } from './core/transfer';
import { FrameCap, QUALITY, QUALITY_ORDER, ResolutionGovernor, type QualityId } from './render/quality';
import { registerSW } from 'virtual:pwa-register';
import { ACHIEVEMENTS } from './content/achievements';
import { WEAPONS } from './content/items';
import { dailyPlan, dailyScore, dayOf, decodeResult, encodeResult, type DailyResult } from './core/daily';
import { bump } from './core/save';
import { DailyCard, dayName } from './ui/daily';
import { AchievementToasts, Journal } from './ui/journal';

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
  const settings = loadSettings();
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

  // ---- Graphics quality: a preset (or the automatic one), and the resolution governor holding the frame rate.
  const AUTO_KEY = 'piotrobonk:quality-auto';
  const touchDevice = matchMedia('(pointer: coarse)').matches;
  let autoQuality: QualityId = touchDevice ? 'srednie' : 'wysokie';
  try {
    const stored = localStorage.getItem(AUTO_KEY);
    if (stored && stored in QUALITY) autoQuality = stored as QualityId;
  } catch {
    // Storage blocked: start from the default guess every time.
  }
  /** The automatic quality never climbs back above a preset it had to leave. */
  let autoCeiling = QUALITY_ORDER.length - 1;
  const preset = (): QualityId => (settings.quality === 'auto' ? autoQuality : settings.quality);
  const targetMs = (): number => (settings.fpsLimit ? 1000 / settings.fpsLimit : 0);
  const governor = new ResolutionGovernor(QUALITY[preset()], targetMs());
  const stepAuto = (v: -1 | 1): void => {
    const i = QUALITY_ORDER.indexOf(autoQuality);
    if (v < 0) autoCeiling = Math.max(0, i - 1);
    const next = Math.max(0, Math.min(autoCeiling, i + v));
    if (next === i) return;
    autoQuality = QUALITY_ORDER[next];
    try {
      localStorage.setItem(AUTO_KEY, autoQuality);
    } catch {
      // Not remembered across visits; it measures again next time.
    }
    applyQuality();
  };
  const applyQuality = (): void => {
    const q = QUALITY[preset()];
    governor.setPreset(q, targetMs());
    game?.setParticleDensity(q.particles);
    resize();
  };

  /** Every setting takes effect at once, wherever it was changed (hub or pause). */
  const applySettings = (): void => {
    audio.setVolumes({ music: settings.music, sfx: settings.sfx, ui: settings.ui });
    game?.applySettings(settings);
    input.setBindings(settings.keys, settings.pad);
    // Bigger text zooms the whole UI layer; its CSS divides viewport units by --zoom so panels still fit.
    ui.style.zoom = settings.textScale === 1 ? '' : String(settings.textScale);
    ui.style.setProperty('--zoom', String(settings.textScale));
    setColorblind(settings.colorblind);
    document.body.classList.toggle('no-flashes', !settings.flashes);
    document.body.style.setProperty('--touch-scale', String(settings.touchScale));
    // The title's control list follows the bindings (and on a phone, shows the touch layout instead).
    const C = UI.start.controls;
    const k = settings.keys;
    const row = ([a, b]: readonly [string, string], key: string, pad = ''): [string, string] => [a.replace('{k}', key).replace('{p}', pad), b];
    prompt.setControls(
      touchDevice
        ? UI.start.touch
        : [row(C.move, [k.up, k.left, k.down, k.right].map(keyName).join('')), row(C.look, ''), row(C.jump, keyName(k.jump), padName(settings.pad.jump)), row(C.slide, keyName(k.slide), padName(settings.pad.slide)), row(C.pause, '', padName(settings.pad.pause))],
      touchDevice ? UI.start.promptTouch : UI.start.prompt,
    );
    applyQuality();
    saveSettings(settings);
  };

  /** An imported save replaces this one in place (everything holds the same object). */
  const adopt = (r: Imported): string => {
    if (r === 'invalid') return UI.settings.invalid;
    if (r === 'damaged') return UI.settings.damaged;
    if (r === 'newer') return UI.settings.newer;
    Object.assign(save, r);
    persist();
    applyGear();
    hub?.setTrophies(save.trophies);
    return UI.settings.loaded;
  };
  const settingsScreen = new SettingsScreen(ui, {
    settings,
    changed: applySettings,
    autoQuality: () => autoQuality,
    fullscreen: {
      available: fullscreenAvailable(),
      on: isFullscreen,
      set: (on) => {
        void setFullscreen(on);
      },
    },
    canLoad: () => mode !== 'game',
    saveFile: () => {
      // Named by the Polish calendar day (an export just after midnight is today's, not yesterday's).
      download(`piotrobonk-zapis-${dayOf(new Date())}.json`, saveToFile(save));
      return UI.settings.saved;
    },
    loadFile: async () => {
      if (mode === 'game') return UI.settings.busy;
      const text = await pickFile('.json,application/json');
      return text === null ? '' : adopt(fileToSave(text));
    },
    copyCode: async () => {
      // The clipboard write starts inside the click (Safari refuses it after an await).
      const code = saveToCode(save);
      const copied = await copyLater(code);
      return { code: await code, message: copied ? UI.settings.copied : UI.settings.copyFailed };
    },
    loadCode: async (code) => (mode === 'game' ? UI.settings.busy : adopt(await codeToSave(code))),
    wipe: () => {
      if (mode === 'game') return Promise.resolve(UI.settings.busy);
      Object.assign(save, newSave());
      persist();
      // A clean start everywhere (the hub, the attract mode, the journal): load the page again.
      window.setTimeout(() => {
        location.reload();
      }, 900);
      return Promise.resolve(UI.settings.wiped);
    },
  });

  // ---- The journal, achievements, and the codzienny kurs.
  const journal = new Journal(ui);
  const dailyCard = new DailyCard(ui);
  const toasts = new AchievementToasts(ui);
  const LINE = STATIONS.map((st) => st.id);
  const WEAPON_IDS = WEAPONS.map((w) => w.id);
  const today = (): string => dayOf(new Date());

  /**
   * Anything newly earned: stamped, saved, and toasted (in a run with the run's counters so far). The first
   * check after loading only finds what an older save had already done: one quiet "earlier" toast for those.
   */
  let firstCheck = true;
  const checkAchievements = (): void => {
    const stats = mode === 'game' && game ? game.liveStats() : save.stats;
    let earned = 0;
    for (const a of ACHIEVEMENTS) {
      if (a.id in save.achievements || a.progress(stats, save) < 1) continue;
      save.achievements[a.id] = Date.now();
      if (!firstCheck) toasts.show(a.name);
      earned++;
    }
    if (firstCheck && earned > 0) toasts.showEarlier(earned);
    firstCheck = false;
    if (earned > 0) persist();
  };

  let dailyShown = '';
  const refreshDaily = (): void => {
    const plan = dailyPlan(today(), LINE);
    dailyShown = plan.day;
    hubMenu.setDaily(station(plan.station).name, plan.day in save.daily ? save.daily[plan.day].score : null);
  };

  /** Today's run: the day's seed and station, kurs Normalnie, the same for everyone. */
  const startDaily = (): void => {
    if (!game) return;
    const plan = dailyPlan(today(), LINE);
    mode = 'game';
    hubMenu.close();
    route.close();
    version.hidden = true;
    game.stopDemo();
    game.start(plan.seed, plan.station, 'normalnie', plan.day);
  };

  const shareResult = async (r: DailyResult, code: string): Promise<string> => {
    const url = `${location.origin}${location.pathname}?wynik=${code}`;
    const text = UI.daily.shareText.replace('{day}', dayName(r.day)).replace('{station}', station(r.station).name).replace('{score}', dailyScore(r).toLocaleString('pl-PL'));
    const how = await share('PIOTROBONK', text, url);
    return how === 'shared' ? UI.daily.shared : how === 'copied' ? UI.daily.copied : how === 'cancelled' ? '' : UI.daily.failed;
  };

  /** A codzienny kurs ended: keep the day's best, then the card over the hub. */
  const onDaily = (r: DailyResult): void => {
    const score = dailyScore(r);
    const code = encodeResult(r);
    const prev = save.daily[r.day] as { score: number; code: string } | undefined;
    if (!prev) bump(save, 'dailyDays');
    if (!prev || score > prev.score) save.daily[r.day] = { score, code };
    bump(save, 'dailyRuns');
    if (r.cleared) bump(save, 'dailyClears');
    persist();
    showHub();
    hubMenu.close();
    dailyCard.open(
      r,
      today(),
      {
        share: () => shareResult(r, code),
        close: () => {
          hubMenu.open(hubActions);
        },
      },
      { best: prev && prev.score > score ? prev.score : null },
    );
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
    refreshDaily();
    checkAchievements();
    hubMenu.open(hubActions);
    revealPending();
  };

  const hubActions = {
    play: (): void => {
      playIntroOrRoute();
    },
    recyklomat: (): void => {
      openShop();
    },
    inventory: (): void => {
      openInventory();
    },
    settings: (): void => {
      hubMenu.close();
      settingsScreen.open(() => {
        hubMenu.open(hubActions);
      });
    },
    journal: (): void => {
      hubMenu.close();
      journal.open({ save, stats: () => save.stats, db: () => db, figure: (id) => game?.portraits.figure(id) ?? null }, () => {
        hubMenu.open(hubActions);
      });
    },
    daily: (): void => {
      startDaily();
    },
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
    if (save.introSeen || !game) {
      showRoute();
      return;
    }
    // Built on first use: only a new player ever sees it, and nobody should wait for it at start-up.
    if (!intro) {
      intro = new Intro(renderer, ui, game.portraits);
      intro.resize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
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
    // Phones play full screen and in landscape; the tap that starts is the gesture the browser asks for.
    if (touchDevice && fullscreenAvailable()) void setFullscreen(true);
    showHub();
  };

  // Resolution follows the canvas size and the device pixel ratio (zoom, moving between screens).
  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const hgt = Math.max(1, canvas.clientHeight);
    // The drawing buffer is sized here in whole device pixels: with a fractional ratio (0.7 × 1280 is
    // 895.99…) three.js floors the canvas but rounds the viewport, one pixel larger than the buffer, and
    // Firefox warns about every draw.
    const q = QUALITY[preset()];
    const ratio = Math.min(Math.max(window.devicePixelRatio, q.minDpr), q.maxDpr) * governor.scale;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(1, Math.round(w * ratio)), Math.max(1, Math.round(hgt * ratio)), false);
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

  // ---- A new version: a toast with a button, shown only outside a run, and never a reload by itself.
  const updateToast = h('div', 'update');
  const updateText = h('span', 'update__text', UI.update.available);
  const updateButton = h('button', 'btn btn--small', UI.update.reload);
  updateToast.append(updateText, updateButton);
  updateToast.hidden = true;
  ui.append(updateToast);
  let updateReady = false;
  /** A short note in the same toast (offline ready, a broken result link), for a few seconds. */
  let note = '';
  let noteAt = 0;
  const notify = (text: string): void => {
    note = text;
    noteAt = performance.now();
  };
  /** This tab's button asked for the new version: only then does this tab reload. */
  let asked = false;
  /** The new version already took over from another tab: this one reloads straight away when asked. */
  let tookOver = false;
  const updateSW = !BOT && !DEBUG
    ? registerSW({
        onNeedRefresh: () => {
          updateReady = true;
        },
        // After any note already up (a broken result link), not over it.
        onOfflineReady: () => {
          const wait = note ? Math.max(0, noteAt + 5600 - performance.now()) : 0;
          window.setTimeout(() => {
            notify(UI.update.offline);
          }, wait);
        },
        // The plugin's default reloads every open tab once the new version takes over, a run in another
        // tab included. Only the tab whose button was pressed reloads; the rest keep playing.
        onNeedReload: () => {
          if (asked) location.reload();
          else tookOver = true;
        },
        // An open (or installed) game looks for a new version every half hour, not only when it loads.
        onRegisteredSW: (_url, registration) => {
          if (registration) window.setInterval(() => void registration.update().catch(() => undefined), 30 * 60 * 1000);
        },
      })
    : null;
  updateButton.addEventListener('click', () => {
    asked = true;
    if (tookOver) location.reload();
    else void updateSW?.(true);
  });
  hubMenu.adopt(updateButton);
  /** Called every frame: what the toast says, and whether it is up. */
  const syncToast = (now: number): void => {
    // Never over a result card either (on a phone it sits right on the card's top).
    const outside = mode !== 'game' && mode !== 'intro' && !dailyCard.isOpen;
    const noted = note !== '' && now - noteAt < 5000;
    const show = outside && (updateReady || noted);
    const text = updateReady ? UI.update.available : note;
    if (show && updateText.textContent !== text) {
      updateText.textContent = text;
      updateButton.hidden = !updateReady;
    }
    if (show === !updateToast.hidden) return;
    if (show) enter(updateToast);
    else leave(updateToast);
  };

  const touch = new TouchControls(document.body, input);
  let touchRun = -1;
  const rotate = h('div', 'rotate');
  rotate.append(h('div', 'rotate__phone'), h('p', '', UI.touch.rotate));
  document.body.append(rotate);
  // The "turn it" board covers the screen; a run behind it pauses instead of playing on unseen. (Same query
  // as the board's CSS.)
  matchMedia('(orientation: portrait) and (pointer: coarse) and (max-width: 900px)').addEventListener('change', (e) => {
    if (e.matches && mode === 'game') game?.interrupt();
  });
  const wake = new WakeLock();
  let wakeOn = false;

  let last = performance.now();
  const cap = new FrameCap();
  let lastCheck = 0;
  let frames = 0;
  /** Phone-sized screens: the side panels cover the whole scene. */
  const narrow = matchMedia('(max-width: 900px), (max-height: 560px)');
  renderer.setAnimationLoop((now: number) => {
    // The FPS limit skips frames here, before anything is simulated or drawn.
    if (!cap.ready(now, settings.fpsLimit)) return;
    const interval = now - last;
    const dt = Math.min(0.1, Math.max(0, interval / 1000));
    last = now;
    // The resolution governor watches the frames that matter: a run being played, and the hub.
    if (mode === 'hub' || (mode === 'game' && game?.state === 'playing')) {
      if (governor.sample(interval)) resize();
      if (settings.quality === 'auto') {
        const v = governor.takeVerdict();
        if (v !== 0) stepAuto(v);
      }
    }
    const st = mode === 'game' ? game?.state : undefined;
    // The boss's title card is a moment to read, not to be covered by the zone hints: held, like a card.
    touch.show(st === 'playing' ? 'on' : st === 'levelup' || st === 'chest' || st === 'call' || st === 'intro' ? 'held' : 'off');
    if (game && game.runId !== touchRun) {
      touchRun = game.runId;
      touch.newRun();
    }
    syncToast(now);
    // Achievement toasts wait for the hub or open play: never over the title, a card, a choice or a cinematic.
    if (input.usingPad) document.body.classList.add('kbd');
    document.body.classList.toggle('is-touch', input.usingTouch);
    toasts.allowed = (mode === 'hub' && hubMenu.isOpen) || (mode === 'game' && game?.state === 'playing');
    toasts.frame();
    // A result card opened from a chat link reads fine upright: no "turn it" board over it.
    document.body.classList.toggle('portrait-ok', dailyCard.isOpen);
    // The screen stays on through a run being played (a paused one may dim, and everything else too).
    const awake = mode === 'game' && game?.state !== 'paused';
    if (awake !== wakeOn) {
      wakeOn = awake;
      wake.set(wakeOn);
    }
    if (mode === 'title') {
      title.frame(dt);
      input.poll();
      if (dailyCard.isOpen) dailyCard.handleInput(input);
      else if (game && (input.consume('confirm') || input.consume('jump'))) start();
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
      if (dailyCard.isOpen) dailyCard.handleInput(input);
      else if (journal.isOpen) journal.handleInput(input);
      else if (settingsScreen.isOpen) settingsScreen.handleInput(input);
      else if (mode === 'route') route.handleInput(input);
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
    // Achievements are checked once a second (in a run too, so the toast comes when it is earned). The hub's
    // codzienny kurs button turns over at midnight while the hub is open.
    if (now - lastCheck > 1000) {
      lastCheck = now;
      checkAchievements();
      if (mode === 'hub' && today() !== dailyShown) refreshDaily();
    }
  });

  // Build the game in the background once the title is on screen, so starting is instant. Wait for the
  // font first: signs and the damage-digit atlas are drawn into canvases once and would keep a fallback font.
  applySettings();
  const build = (): void => {
    game = new Game(renderer, ui, input, {
      debug: DEBUG,
      bot: BOT,
      settings,
      settingsScreen,
      save,
      onSave: persist,
      onQuit: showHub,
      onRoute: showRoute,
      onFinish: finishLine,
      onDaily,
    });
    game.resize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
    game.setParticleDensity(QUALITY[preset()].particles);
    hub = new HubScene(renderer);
    hub.resize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
    hub.setTrophies(save.trophies);
    game.warmup(hub.demoTarget);
    game.portraits.warmup();
    hub.warmup();
    thumbs = new Thumbs(renderer);
    audio.prepare();
    prompt.ready();
    // A shared result (?wynik=…) opens as its card over the title, with a way into today's run.
    const code = params.get('wynik');
    if (code) {
      const foreign = decodeResult(code, LINE, WEAPON_IDS);
      const clean = new URLSearchParams(location.search);
      clean.delete('wynik');
      const q = clean.toString();
      history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}`);
      if (!foreign) notify(UI.daily.broken);
      else if (mode === 'title') {
        dailyCard.open(
          foreign,
          today(),
          {
            play: () => {
              start();
              startDaily();
            },
            close: () => undefined,
          },
          { mine: foreign.day in save.daily ? save.daily[foreign.day].score : null },
        );
      }
    }
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
      // A ★ in the collection was drawn at some point, whatever an older save's counter says.
      let stars = 0;
      for (const id of save.collected) if (d.skins.get(id)?.rarity === 6) stars++;
      if (stars > (save.stats.starsDropped ?? 0)) {
        save.stats.starsDropped = stars;
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
      Object.assign(window, { __game: g, __save: save, __weapons: WEAPONS, __audio: audio, __info: () => ({ ...renderer.info.memory }) });
      window.setInterval(() => {
        Object.assign(document.body.dataset, { mode, demo: String(g.demo), state: g.state, level: String(g.level), kills: String(g.enemies.kills), enemies: String(g.enemies.count), time: g.time.toFixed(1), fps: g.fps.toFixed(0), sim: g.simMs.toFixed(2), render: g.renderMs.toFixed(2), calls: String(renderer.info.render.calls) });
      }, 250);
    }
  };
  // With Polish letters in the sample, or only the Latin files load and the Latin Extended ones (ą, ę, ł…)
  // arrive later, at the first Polish word in each weight, after the canvases were drawn with a fallback.
  const fontsReady = Promise.all(['500 16px', '700 16px', '800 16px'].map((f) => document.fonts.load(`${f} "Barlow Condensed"`, 'Aąćęłńóśźż')));
  void fontsReady.catch(() => undefined).then(() => window.setTimeout(build, 30));

  const gesture = (): void => {
    // Any real gesture unlocks audio (a gamepad press does not count as one in browsers).
    audio.unlock();
    if (mode === 'title' && !dailyCard.isOpen) start();
  };
  window.addEventListener('pointerdown', gesture);
  // Hover highlights only while the mouse is what is being used (body.kbd in style.css).
  window.addEventListener(
    'keydown',
    () => {
      document.body.classList.add('kbd');
    },
    { capture: true },
  );
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') document.body.classList.remove('kbd');
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F1' && e.code !== 'Escape') gesture();
  });
}
