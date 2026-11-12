import './fonts.css';
import './style.css';
import { UI } from './content/ui';
import { installCrashOverlay, showNoWebGL } from './core/fatal';
import { startTitleScene } from './title-scene';

// The bundle is running: cancel the boot watchdog from index.html.
document.documentElement.dataset.boot = '1';
document.getElementById('boot-fail')?.remove();
installCrashOverlay();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function buildTitle(): HTMLElement {
  const root = el('main', 'title');
  const board = el('section', 'board');
  board.setAttribute('aria-label', UI.board.header);
  const row = el('div', 'board__row');
  row.append(
    el('span', 'board__time', UI.board.time),
    el('span', 'board__train', UI.board.train),
    el('span', 'board__dest', UI.board.destination),
    el('span', 'board__status', UI.board.status),
  );
  board.append(el('div', 'board__header', UI.board.header), row);
  root.append(el('h1', 'title__logo', UI.title), el('p', 'title__route', UI.route), board, el('p', 'title__teaser', UI.teaser));
  return root;
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLElement>('#ui');
if (!canvas || !ui) throw new Error('index.html is missing #scene or #ui');

// Create the context ourselves: no probe context to leak or lose, and a failure lands on the no-WebGL panel
// instead of a Three.js exception.
const gl = 'WebGL2RenderingContext' in window ? canvas.getContext('webgl2', { antialias: true, alpha: false, stencil: false }) : null;

if (gl) {
  ui.append(buildTitle(), el('footer', 'version', `v${__APP_VERSION__} · ${__GIT_SHA__}`));
  startTitleScene(canvas, gl, () => {
    document.body.dataset.ready = '1';
  });
} else {
  canvas.remove();
  showNoWebGL();
}
