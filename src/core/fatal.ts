import { UI } from '../content/ui';

function panel(title: string, body: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'fatal';
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-labelledby', 'fatal-title');
  const box = document.createElement('div');
  box.className = 'fatal__box';
  const h = document.createElement('h1');
  h.id = 'fatal-title';
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = body;
  box.append(h, p);
  root.append(box);
  document.body.append(root);
  return box;
}

export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

export function showNoWebGL(): void {
  panel(UI.noWebGL.title, UI.noWebGL.body);
}

let crashed = false;

function showCrash(error: unknown): void {
  if (crashed) return;
  crashed = true;
  const detail = error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error);
  const report = [
    `PIOTROBONK v${__APP_VERSION__} (${__GIT_SHA__})`,
    navigator.userAgent,
    location.href,
    new Date().toISOString(),
    '',
    detail,
  ].join('\n');

  const box = panel(UI.crash.title, UI.crash.body);
  const text = document.createElement('textarea');
  text.readOnly = true;
  text.value = report;
  text.rows = 8;
  const actions = document.createElement('div');
  actions.className = 'fatal__actions';
  const copy = document.createElement('button');
  copy.textContent = UI.crash.copy;
  copy.addEventListener('click', () => {
    navigator.clipboard.writeText(report).then(
      () => (copy.textContent = UI.crash.copied),
      () => {
        text.focus();
        text.select();
        copy.textContent = UI.crash.copyFailed;
      },
    );
  });
  const reload = document.createElement('button');
  reload.textContent = UI.crash.reload;
  reload.addEventListener('click', () => {
    location.reload();
  });
  actions.append(copy, reload);
  box.append(text, actions);
  copy.focus();
}

export function installCrashOverlay(): void {
  window.addEventListener('error', (e) => {
    showCrash(e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    showCrash(e.reason);
  });
}
