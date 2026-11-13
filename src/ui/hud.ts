import { BOTTLES } from '../content/items';
import { UI } from '../content/ui';
import { fmtTime, h, replay } from './dom';
import { icon } from './icons';

export interface HudState {
  bottles: number;
  /** Station name shown in the top bar. */
  station: string;
  /** Seconds left until the boss arrives (0 once it is here). */
  toBoss: number;
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  level: number;
  time: number;
  kills: number;
}

export interface Slot {
  id: string;
  level: number;
  kind: 'weapon' | 'passive';
  /** Evolved weapons show a star instead of their level, which restarts at 1. */
  evolved?: boolean;
}

/** In-run HUD. Writes to the DOM only when a value changes. */
export class Hud {
  readonly root = h('div', 'hud');
  private readonly xpFill = h('div', 'hud__xpfill');
  private readonly level = h('div', 'hud__level');
  private readonly time = h('div', 'hud__time');
  private readonly station = h('div', 'hud__station', UI.hud.station);
  private readonly kills = h('div', 'hud__kills');
  private readonly hpFill = h('div', 'hud__hpfill');
  private readonly hpLag = h('div', 'hud__hplag');
  private readonly hpText = h('div', 'hud__hptext');
  private readonly slots = h('div', 'hud__slots');
  private readonly hurtFlash = h('div', 'hud__hurt');
  private readonly vignette = h('div', 'hud__vignette');
  private readonly toastEl = h('div', 'hud__toast');
  private readonly bottles = h('div', 'hud__bottles');
  private readonly bottleCount = h('span', 'hud__bottlecount');
  private readonly bottleCash = h('span', 'hud__cash');
  private readonly prompt = h('div', 'hud__prompt');
  private last: Partial<Record<string, string | number | boolean>> = {};
  private readonly toasts: string[] = [];

  constructor(parent: HTMLElement) {
    const xp = h('div', 'hud__xp');
    xp.append(this.xpFill, this.level);
    const top = h('div', 'hud__top');
    top.append(this.station, this.time);
    const hp = h('div', 'hud__hp');
    const bar = h('div', 'hud__hpbar');
    bar.append(this.hpLag, this.hpFill);
    hp.append(bar, this.hpText);
    const bottleIcon = h('img', 'hud__bottleicon');
    bottleIcon.src = icon('butelka');
    bottleIcon.alt = UI.bottles.label;
    this.bottles.append(bottleIcon, this.bottleCount, this.bottleCash);
    this.root.append(this.vignette, this.hurtFlash, xp, top, this.kills, this.bottles, hp, this.slots, this.toastEl, this.prompt);
    this.root.hidden = true;
    parent.append(this.root);
  }

  private set(key: string, value: string | number, apply: () => void): void {
    if (this.last[key] === value) return;
    this.last[key] = value;
    apply();
  }

  update(s: HudState): void {
    const hpPct = Math.max(0, s.hp / s.maxHp);
    const xpPct = Math.min(1, s.xp / s.xpNext);
    this.set('hp', Math.round(hpPct * 1000), () => {
      this.hpFill.style.transform = `scaleX(${hpPct})`;
      this.hpLag.style.transform = `scaleX(${hpPct})`;
      this.root.classList.toggle('is-low', hpPct < 0.3);
    });
    this.set('hpText', `${Math.ceil(s.hp)} / ${s.maxHp}`, () => {
      this.hpText.textContent = `${Math.ceil(Math.max(0, s.hp))} / ${s.maxHp}`;
    });
    this.set('xp', Math.round(xpPct * 1000), () => {
      this.xpFill.style.transform = `scaleX(${xpPct})`;
    });
    this.set('level', s.level, () => {
      this.level.textContent = `${UI.hud.level} ${s.level}`;
      replay(this.level, 'is-pop');
    });
    this.set('station', s.station, () => {
      this.station.textContent = s.station;
    });
    // Before the boss the clock counts down to it; during the fight it goes back to the run time.
    this.set('time', Math.floor(s.toBoss > 0 ? -s.toBoss : s.time), () => {
      this.time.textContent = fmtTime(s.toBoss > 0 ? Math.ceil(s.toBoss) : s.time);
      this.time.classList.toggle('is-soon', s.toBoss > 0 && s.toBoss < 30);
    });
    this.set('bottles', s.bottles, () => {
      this.bottleCount.textContent = String(s.bottles);
      this.bottleCash.textContent = UI.bottles.deposit.replace('{v}', (s.bottles * BOTTLES.deposit).toFixed(2).replace('.', ','));
      replay(this.bottles, 'is-pop');
    });
    this.set('kills', s.kills, () => {
      this.kills.textContent = `☠ ${s.kills}`;
    });
  }

  /** Called only when the loadout changes. */
  setSlots(slots: Slot[]): void {
    this.slots.replaceChildren(
      ...slots.map((x) => {
        const el = h('div', `hud__slot hud__slot--${x.kind}`);
        const img = h('img');
        img.src = icon(x.id);
        img.alt = '';
        el.append(img, h('span', '', x.evolved === true ? '★' : String(x.level)));
        if (x.evolved === true) el.classList.add('is-evolved');
        return el;
      }),
    );
  }

  /** Context prompt at the bottom (chests, coffee); empty string hides it. */
  /** `affordable: false` paints the prompt red (not enough bottles for this chest). */
  setPrompt(text: string, affordable = true): void {
    if (this.last.prompt === text && this.last.affordable === affordable) return;
    this.last.prompt = text;
    this.last.affordable = affordable;
    this.prompt.textContent = text;
    this.prompt.classList.toggle('is-on', text !== '');
    this.prompt.classList.toggle('is-poor', !affordable);
  }

  /** Toasts queue up: two events in the same second must not overwrite each other. */
  toast(text: string): void {
    this.toasts.push(text);
    if (this.toasts.length === 1) this.showToast();
  }

  private showToast(): void {
    if (!this.toasts.length) return;
    const text = this.toasts[0];
    this.toastEl.textContent = text;
    replay(this.toastEl, 'is-on');
    window.setTimeout(() => {
      this.toasts.shift();
      this.showToast();
    }, 1400);
  }

  hurt(): void {
    replay(this.hurtFlash, 'is-on');
  }

  show(on: boolean): void {
    this.root.hidden = !on;
    if (on) {
      this.last = {};
      replay(this.root, 'is-in');
    }
  }
}
