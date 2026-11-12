import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import './style.css';
import { UI } from './content/ui';
import { hasWebGL2, installCrashOverlay, showNoWebGL } from './core/fatal';
import { startTitleScene } from './title-scene';

installCrashOverlay();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function buildTitle(): HTMLElement {
  const root = el('main', 'title');
  const logo = el('h1', 'title__logo', UI.title);
  const route = el('p', 'title__route', UI.route);

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

  const teaser = el('p', 'title__teaser', UI.teaser);
  root.append(logo, route, board, teaser);
  return root;
}

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const ui = document.querySelector<HTMLElement>('#ui');
if (!canvas || !ui) throw new Error('index.html is missing #scene or #ui');

ui.append(buildTitle(), el('footer', 'version', `v${__APP_VERSION__} · ${__GIT_SHA__}`));

if (hasWebGL2()) {
  startTitleScene(canvas, () => {
    document.body.dataset.ready = '1';
  });
} else {
  canvas.remove();
  showNoWebGL();
}
