// Thin wrappers over the browser features the game leans on, each one optional: a browser that lacks it
// just goes without (no errors, no console noise).

/** Keeps the screen on during a run (Screen Wake Lock). The browser drops it when the tab hides. */
export class WakeLock {
  private lock: WakeLockSentinel | null = null;
  private wanted = false;

  constructor() {
    // Coming back to the tab: the lock was released by the browser, take it again if a run still wants it.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wanted) void this.take();
    });
  }

  set(on: boolean): void {
    this.wanted = on;
    if (on) void this.take();
    else {
      void this.lock?.release().catch(() => undefined);
      this.lock = null;
    }
  }

  private pending = false;

  private async take(): Promise<void> {
    if ((this.lock && !this.lock.released) || this.pending) return;
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    this.pending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      // Let go while the request was on its way: release it now instead of holding it forever.
      if (this.wanted) this.lock = lock;
      else void lock.release().catch(() => undefined);
    } catch {
      // Low battery mode, a policy, or no user gesture yet: the screen just may dim.
      this.lock = null;
    } finally {
      this.pending = false;
    }
  }
}

/** One rumble on the connected gamepad: `strong` is the heavy motor, `weak` the light one, both 0..1. */
export function rumble(strong: number, weak: number, ms: number): void {
  if (typeof navigator.getGamepads !== 'function') return;
  for (const pad of navigator.getGamepads()) {
    const actuator = pad?.vibrationActuator as (GamepadHapticActuator & { playEffect?: (type: string, params: object) => Promise<unknown> }) | null | undefined;
    if (!actuator?.playEffect) continue;
    void actuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => undefined);
  }
}

export const fullscreenAvailable = (): boolean => document.fullscreenEnabled;
export const isFullscreen = (): boolean => document.fullscreenElement !== null;

/** Into or out of full screen. Landscape is locked where the browser allows it (phones, in full screen). */
export async function setFullscreen(on: boolean): Promise<void> {
  try {
    if (on && !isFullscreen()) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      // Safari has no lock(): the TypeError lands in the catch below, after full screen already worked.
      await (screen.orientation as ScreenOrientation & { lock(o: string): Promise<void> }).lock('landscape').catch(() => undefined);
    } else if (!on && isFullscreen()) await document.exitFullscreen();
  } catch {
    // Refused (no gesture, iframe without permission): stay as we are.
  }
}

/**
 * Shares a result: the system share sheet where there is one (phones), else the link goes to the clipboard.
 * Returns what happened, for the toast.
 */
export async function share(title: string, text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const data = { title, text, url };
  if (typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      // The user closing the sheet is their choice, not a failure (and no reason to copy instead).
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copy(`${text}\n${url}`)) ? 'copied' : 'failed';
}

/** Text to the clipboard. */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Text that is still being made (compressed), to the clipboard. Safari allows the write only inside the
 * click itself, so the promise goes to the clipboard as it is (ClipboardItem); writeText is the fallback.
 * Call it synchronously from the click handler.
 */
export async function copyLater(text: Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'function' && typeof navigator.clipboard.write === 'function') {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })) })]);
      return true;
    }
  } catch {
    // Not supported this way: try the plain write below.
  }
  return copy(await text);
}

/** Offers `text` as a file download. */
export function download(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
}

/** Lets the player pick a file and returns its text (null when they cancel). */
export function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) resolve(null);
      else void file.text().then(resolve, () => { resolve(null); });
    });
    input.addEventListener('cancel', () => { resolve(null); });
    input.click();
  });
}
