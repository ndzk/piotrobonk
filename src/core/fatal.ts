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

export function showNoWebGL(): void {
  panel(UI.noWebGL.title, UI.noWebGL.body);
}

let crashed = false;

function showCrash(error: unknown, where = ''): void {
  if (crashed) return;
  crashed = true;
  // Chrome's stack starts with "Name: message"; Firefox and Safari leave the message out of it.
  const head = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  const detail = stack.startsWith(head) ? stack : `${head}\n${stack}`;
  const report = [
    `PIOTROBONK v${__APP_VERSION__} (${__GIT_SHA__})`,
    navigator.userAgent,
    location.href,
    new Date().toISOString(),
    '',
    detail,
    where,
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
    // Promise.resolve: navigator.clipboard is undefined on plain http, and then the call throws synchronously.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(report))
      .then(
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
    // Opaque "Script error." and errors from other origins (extensions, injected scripts) are not ours.
    if (!e.error && e.message === 'Script error.') return;
    if (e.filename && new URL(e.filename, location.href).origin !== location.origin) return;
    showCrash(e.error ?? e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    showCrash(e.reason);
  });
}
