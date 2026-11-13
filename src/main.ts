import './fonts.css';
import './style.css';
import { ACESFilmicToneMapping, WebGLRenderer } from 'three';
import { audio } from './audio/audio';
import { TRACKS } from './content/music';
import { UI } from './content/ui';
import { installCrashOverlay, showNoWebGL } from './core/fatal';
import { furthest, loadSave, saveSave, type Save } from './core/save';
import { loadSettings, saveSettings } from './core/settings';
import { attachBot } from './game/bot';
import { Game } from './game/game';
import { Input } from './game/input';
import { STATIONS } from './content/stations/index';
import { TitleScene } from './title-scene';
import { enter, h, leave, replay } from './ui/dom';
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
// ?stacja=widzew (or ?station=) drops straight into one arena: used by the bot, the tests and debugging.
const STATION = params.get('stacja') ?? params.get('station');

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
  let mode: 'title' | 'route' | 'game' = 'title';
  let game: Game | null = null;
  const save: Save = loadSave();
  const route = new RouteScreen(ui, save);

  const showTitle = (): void => {
    mode = 'title';
    input.flush();
    route.close();
    enter(titleLayer);
    replay(titleLayer, 'is-in');
    prompt.show(true);
    version.hidden = false;
    audio.playMusic(TRACKS.menu);
  };

  /** The route map: pick a stop on line 17 and the difficulty, then go. */
  const showRoute = (): void => {
    mode = 'route';
    input.flush();
    leave(titleLayer);
    prompt.show(false);
    version.hidden = false;
    audio.playMusic(TRACKS.menu);
    route.open(save, {
      play: (stationId) => {
        mode = 'game';
        route.close();
        version.hidden = true;
        game?.start(newSeed(), stationId, save.difficulty);
      },
      back: showTitle,
      difficulty: () => {
        saveSave(save);
      },
    });
  };

  const start = (): void => {
    if (mode !== 'title' || !game) return;
    audio.unlock();
    audio.play('start');
    showRoute();
  };

  // Resolution follows the canvas size and the device pixel ratio (zoom, moving between screens).
  const resize = (): void => {
    const w = Math.max(1, canvas.clientWidth);
    const hgt = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, hgt, false);
    title.resize(w, hgt);
    game?.resize(w, hgt);
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
  renderer.setAnimationLoop((now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (mode === 'title') {
      title.frame(dt);
      input.poll();
      if (game && (input.consume('confirm') || input.consume('jump'))) start();
      input.flush();
    } else if (mode === 'route') {
      title.frame(dt);
      input.poll();
      route.handleInput(input);
      input.flush();
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
      onSave: saveSave,
      onQuit: showTitle,
      onRoute: showRoute,
    });
    game.resize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight));
    game.warmup();
    prompt.ready();
    if (BOT || STATION) {
      // No route map: straight into the arena that was asked for, or the furthest one reached.
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
      Object.assign(window, { __game: g });
      window.setInterval(() => {
        Object.assign(document.body.dataset, { state: g.state, level: String(g.level), kills: String(g.enemies.kills), enemies: String(g.enemies.count), time: g.time.toFixed(1), fps: g.fps.toFixed(0), sim: g.simMs.toFixed(2), render: g.renderMs.toFixed(2), calls: String(renderer.info.render.calls) });
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
