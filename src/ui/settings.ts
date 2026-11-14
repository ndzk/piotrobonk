// The full settings screen, the same from the pause menu and from the hub: sound, controls (with key and
// gamepad rebinding), graphics, accessibility, and moving the save between devices.

import { audio } from '../audio/audio';
import { UI } from '../content/ui';
import { bindKey, bindPad, DEFAULT_KEYS, DEFAULT_PAD, FPS_LIMITS, KEY_ACTIONS, PAD_ACTIONS, TEXT_SCALES, type KeyAction, type PadAction, type Settings } from '../core/settings';
import { isReservedKey, type Input } from '../game/input';
import { QUALITY_ORDER, type QualityId } from '../render/quality';
import { cycleButton, enter, h, leave, SpatialMenu } from './dom';

type Tab = keyof typeof UI.settings.tabs;
const TABS: Tab[] = ['audio', 'controls', 'graphics', 'access', 'save'];

/** What the screen needs from the rest of the game. */
export interface SettingsContext {
  settings: Settings;
  /** Persist and apply right away (volumes, camera, quality…). */
  changed: () => void;
  /** The quality the automatic choice settled on, for the "Auto (Wysokie)" label. */
  autoQuality: () => QualityId;
  fullscreen: { available: boolean; on: () => boolean; set: (on: boolean) => void };
  /** Save transfer; each returns the message to show. `load*` are refused mid-run by the caller. */
  saveFile: () => string;
  loadFile: () => Promise<string>;
  copyCode: () => Promise<{ code: string; message: string }>;
  loadCode: (code: string) => Promise<string>;
}

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];
const KEY_NAMES: Record<string, string> = {
  Space: 'Spacja',
  ShiftLeft: 'Lewy Shift',
  ShiftRight: 'Prawy Shift',
  ControlLeft: 'Lewy Ctrl',
  ControlRight: 'Prawy Ctrl',
  AltLeft: 'Lewy Alt',
  AltRight: 'Prawy Alt',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Enter: 'Enter',
  Tab: 'Tab',
  CapsLock: 'Caps Lock',
  Backspace: 'Backspace',
};

/** "KeyW" → "W", "Digit3" → "3", "Numpad5" → "Num 5", the rest from a short table. */
export function keyName(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export const padName = (button: number): string => PAD_NAMES[button] ?? `#${button}`;

export class SettingsScreen {
  readonly root = h('div', 'overlay settings');
  private readonly panel = h('div', 'panel panel--wide settings__panel');
  private readonly tabsRow = h('div', 'settings__tabs');
  private readonly body = h('div', 'settings__body');
  private readonly status = h('p', 'settings__status');
  private readonly back = h('button', 'btn btn--ghost', UI.settings.back);
  private readonly menu = new SpatialMenu(() => [...this.root.querySelectorAll<HTMLButtonElement>('button')]);
  private tab: Tab = 'audio';
  private onClose: () => void = () => undefined;
  private opened = false;
  /** Waiting for a key or a pad button to bind. */
  private capture: { kind: 'key'; action: KeyAction } | { kind: 'pad'; action: PadAction; seen: boolean[] } | null = null;
  private armed: HTMLButtonElement | null = null;
  private code: HTMLTextAreaElement | null = null;

  constructor(
    parent: HTMLElement,
    private readonly ctx: SettingsContext,
  ) {
    const S = UI.settings;
    for (const t of TABS) {
      const b = h('button', 'settings__tab', S.tabs[t]);
      b.dataset.tab = t;
      b.addEventListener('click', () => {
        audio.play('click');
        this.show(t);
      });
      this.menu.bind(b);
      this.tabsRow.append(b);
    }
    this.back.addEventListener('click', () => {
      this.close();
    });
    this.menu.bind(this.back);
    this.panel.append(h('h2', 'panel__title', S.title), this.tabsRow, this.body, this.status, this.back);
    this.root.append(this.panel);
    this.root.hidden = true;
    parent.append(this.root);
    // Rebinding listens before the game does, and swallows the key it takes.
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.capture?.kind !== 'key') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const action = this.capture.action;
        if (isReservedKey(e.code)) {
          if (e.code !== 'Escape') {
            this.status.textContent = UI.settings.reserved;
            audio.play('denied');
            return;
          }
        }
        this.capture = null;
        if (e.code !== 'Escape') {
          bindKey(this.ctx.settings.keys, action, e.code);
          this.ctx.changed();
          audio.play('click');
        }
        this.render();
      },
      { capture: true },
    );
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(onClose: () => void, tab: Tab = 'audio'): void {
    this.onClose = onClose;
    this.opened = true;
    this.status.textContent = '';
    enter(this.root);
    this.show(tab);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.capture = null;
    audio.play('back');
    leave(this.root);
    this.onClose();
  }

  handleInput(input: Input): void {
    if (!this.opened) return;
    const cap = this.capture;
    if (cap?.kind === 'pad') {
      // The first button that goes down after the prompt is the new one (held ones from before do not count).
      const pad = typeof navigator.getGamepads === 'function' ? navigator.getGamepads().find((p) => p?.connected) : null;
      pad?.buttons.forEach((b, i) => {
        if (b.pressed && !cap.seen[i] && this.capture === cap) {
          this.capture = null;
          bindPad(this.ctx.settings.pad, cap.action, i);
          this.ctx.changed();
          audio.play('click');
          this.render();
        }
        cap.seen[i] = b.pressed;
      });
      if (input.consumeAny('back', 'pause')) {
        this.capture = null;
        this.render();
      }
      input.flush();
      return;
    }
    if (this.capture) {
      input.flush();
      return;
    }
    // Typing a code: the text box keeps its keys.
    if (document.activeElement === this.code) {
      if (input.consumeAny('back', 'pause')) this.code?.blur();
      input.flush();
      return;
    }
    if (input.consumeAny('back', 'pause')) {
      this.close();
      input.flush();
      return;
    }
    this.menu.handle(input);
    input.flush();
  }

  private show(tab: Tab): void {
    this.tab = tab;
    this.capture = null;
    this.armed = null;
    for (const b of this.tabsRow.children) b.classList.toggle('is-active', (b as HTMLElement).dataset.tab === tab);
    this.render();
  }

  /** Redraws the current tab, keeping the focus on the same row. */
  private render(): void {
    const focusedIndex = this.focusIndex();
    this.body.replaceChildren(...this.rows());
    for (const b of this.body.querySelectorAll('button')) this.menu.bind(b);
    const rows = [...this.body.querySelectorAll<HTMLButtonElement>('button')];
    this.menu.focus(focusedIndex >= 0 ? (rows[Math.min(focusedIndex, rows.length - 1)] ?? null) : (this.tabsRow.querySelector<HTMLButtonElement>('.is-active') ?? null), false);
  }

  private focusIndex(): number {
    const f = this.menu.focused;
    return f ? [...this.body.querySelectorAll('button')].indexOf(f) : -1;
  }

  private rows(): HTMLElement[] {
    const S = UI.settings;
    const s = this.ctx.settings;
    const pct = (v: number): string => `${Math.round(v * 100)}%`;
    const yesNo = (b: boolean): string => (b ? S.on : S.off);
    const changed = (): void => {
      this.ctx.changed();
      audio.play('click');
      this.render();
    };
    const volume = (label: string, key: 'music' | 'sfx' | 'ui'): HTMLButtonElement =>
      cycleButton(label, pct(s[key]), (d) => {
        s[key] = Math.round(Math.min(1, Math.max(0, s[key] + d * 0.1)) * 10) / 10;
        changed();
      });
    const toggle = (label: string, key: 'invertY' | 'vibration' | 'shake' | 'flashes' | 'colorblind'): HTMLButtonElement =>
      cycleButton(label, yesNo(s[key]), () => {
        s[key] = !s[key];
        changed();
      });
    const pick = <T>(label: string, list: readonly T[], value: T, name: (v: T) => string, set: (v: T) => void): HTMLButtonElement =>
      cycleButton(label, name(value), (d) => {
        const i = Math.max(0, list.indexOf(value));
        set(list[(i + d + list.length) % list.length]);
        changed();
      });
    switch (this.tab) {
      case 'audio':
        return [volume(S.music, 'music'), volume(S.sfx, 'sfx'), volume(S.ui, 'ui')];
      case 'controls': {
        const keyRow = (a: KeyAction): HTMLButtonElement => this.bindRow(S.keys[a], this.capture?.kind === 'key' && this.capture.action === a ? S.press : keyName(s.keys[a]), () => {
          this.capture = { kind: 'key', action: a };
          this.render();
        });
        const padRow = (a: PadAction): HTMLButtonElement => this.bindRow(S.pad[a], this.capture?.kind === 'pad' && this.capture.action === a ? S.pressPad : padName(s.pad[a]), () => {
          const pad = typeof navigator.getGamepads === 'function' ? navigator.getGamepads().find((p) => p?.connected) : null;
          this.capture = { kind: 'pad', action: a, seen: pad ? pad.buttons.map((b) => b.pressed) : [] };
          this.render();
        });
        const reset = h('button', 'btn btn--ghost btn--small', S.resetKeys);
        reset.addEventListener('click', () => {
          s.keys = { ...DEFAULT_KEYS };
          s.pad = { ...DEFAULT_PAD };
          changed();
        });
        return [
          cycleButton(S.sensitivity, `${s.sensitivity.toFixed(1).replace('.', ',')}×`, (d) => {
            s.sensitivity = Math.round(Math.min(3, Math.max(0.2, s.sensitivity + d * 0.1)) * 10) / 10;
            changed();
          }),
          toggle(S.invertY, 'invertY'),
          toggle(S.vibration, 'vibration'),
          h('h3', 'settings__group', S.keyboard),
          ...KEY_ACTIONS.map(keyRow),
          h('h3', 'settings__group', S.gamepad),
          ...PAD_ACTIONS.map(padRow),
          reset,
        ];
      }
      case 'graphics': {
        const qualities: (QualityId | 'auto')[] = ['auto', ...QUALITY_ORDER];
        const rows = [
          pick(S.quality, qualities, s.quality, (q) => (q === 'auto' ? S.autoNow.replace('{v}', S.qualities[this.ctx.autoQuality()]) : S.qualities[q]), (q) => (s.quality = q)),
          pick(S.fpsLimit, FPS_LIMITS, s.fpsLimit as (typeof FPS_LIMITS)[number], (v) => (v === 0 ? S.noLimit : String(v)), (v) => (s.fpsLimit = v)),
          cycleButton(S.fov, `${s.fov}°`, (d) => {
            s.fov = Math.min(100, Math.max(55, s.fov + d * 5));
            changed();
          }),
        ];
        const fs = this.ctx.fullscreen;
        if (fs.available)
          rows.push(
            cycleButton(S.fullscreen, yesNo(fs.on()), () => {
              fs.set(!fs.on());
              audio.play('click');
              // The browser answers asynchronously.
              window.setTimeout(() => { this.render(); }, 300);
            }),
          );
        return rows;
      }
      case 'access':
        return [
          toggle(S.shake, 'shake'),
          toggle(S.flashes, 'flashes'),
          pick(S.textScale, TEXT_SCALES, s.textScale as (typeof TEXT_SCALES)[number], pct, (v) => (s.textScale = v)),
          toggle(S.colorblind, 'colorblind'),
        ];
      case 'save':
        return this.saveRows();
    }
  }

  private bindRow(label: string, value: string, start: () => void): HTMLButtonElement {
    const b = h('button', 'option option--compact');
    b.append(h('span', 'option__name', label), h('span', 'option__value option__value--key', value));
    b.addEventListener('click', () => {
      audio.play('click');
      start();
    });
    return b;
  }

  private saveRows(): HTMLElement[] {
    const S = UI.settings;
    const say = (text: string): void => {
      this.status.textContent = text;
    };
    const action = (label: string, run: () => void): HTMLButtonElement => {
      const b = h('button', 'btn btn--small settings__action', label);
      b.addEventListener('click', () => {
        audio.play('click');
        run();
      });
      return b;
    };
    // Loading replaces everything: the first click arms it, the second does it.
    const guarded = (label: string, run: () => Promise<string>): HTMLButtonElement => {
      const b = action(label, () => {
        if (this.armed !== b) {
          this.armed = b;
          say(S.confirm);
          return;
        }
        this.armed = null;
        void run().then(say);
      });
      return b;
    };
    const code = h('textarea', 'settings__code');
    code.placeholder = S.codePlaceholder;
    code.spellcheck = false;
    code.rows = 3;
    this.code = code;
    return [
      h('p', 'settings__hint', S.saveHint),
      action(S.saveFile, () => {
        say(this.ctx.saveFile());
      }),
      guarded(S.loadFile, () => this.ctx.loadFile()),
      action(S.copyCode, () => {
        void this.ctx.copyCode().then(({ code: text, message }) => {
          code.value = text;
          say(message);
        });
      }),
      code,
      guarded(S.loadCode, () => this.ctx.loadCode(code.value)),
    ];
  }
}
