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
  /** During the boss fight: seconds until the last train leaves (0: gone, the Nocne Kanary are coming; -1: none). */
  lastTrain: number;
  hp: number;
  maxHp: number;
  /** Regeneration stopped (Brak klimy): the health bar says so. */
  regenOff: boolean;
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

/** Seconds of game time a HUD toast stays up. */
const TOAST_TIME = 1.4;

/** In-run HUD. Writes to the DOM only when a value changes. */
export class Hud {
  readonly root = h('div', 'hud');
  private readonly xpFill = h('div', 'hud__xpfill');
  private readonly level = h('div', 'hud__level');
  private readonly time = h('div', 'hud__time');
  private readonly station = h('div', 'hud__station', UI.hud.station);
  private readonly clockLabel = h('div', 'hud__clocklabel', UI.hud.toBoss);
  private readonly kills = h('div', 'hud__kills');
  private readonly hpFill = h('div', 'hud__hpfill');
  private readonly hpLag = h('div', 'hud__hplag');
  private readonly hpText = h('div', 'hud__hptext');
  private readonly hpBox = h('div', 'hud__hp');
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
    const clock = h('div', 'hud__clock');
    clock.append(this.clockLabel, this.time);
    top.append(this.station, clock);
    const hp = this.hpBox;
    const bar = h('div', 'hud__hpbar');
    bar.append(this.hpLag, this.hpFill);
    hp.append(bar, this.hpText, h('div', 'hud__noregen', UI.hud.noRegen));
    const bottleIcon = h('img', 'hud__bottleicon');
    bottleIcon.src = icon('butelka');
    bottleIcon.alt = UI.bottles.label;
    this.bottles.append(bottleIcon, this.bottleCount, this.bottleCash);
    this.root.append(this.vignette, this.hurtFlash, xp, top, this.kills, this.bottles, hp, this.slots, this.toastEl, this.prompt);
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** What the HUD shows now: compared each frame, so the DOM is touched only when something changed. */
  private shown = { hp: -1, hpNow: -1, maxHp: -1, regenOff: false, xp: -1, level: -1, station: '', time: Number.NaN, label: -1, bottles: -1, kills: -1 };

  /** Called every frame: plain comparisons, no closures or strings built unless a value changed. */
  update(s: HudState): void {
    const v = this.shown;
    const hpPct = Math.max(0, s.hp / s.maxHp);
    const xpPct = Math.min(1, s.xp / s.xpNext);
    const hp = Math.round(hpPct * 1000);
    if (hp !== v.hp) {
      v.hp = hp;
      this.hpFill.style.transform = `scaleX(${hpPct})`;
      this.hpLag.style.transform = `scaleX(${hpPct})`;
      this.root.classList.toggle('is-low', hpPct < 0.3);
    }
    if (s.regenOff !== v.regenOff) {
      v.regenOff = s.regenOff;
      this.hpBox.classList.toggle('is-noregen', s.regenOff);
    }
    const hpNow = Math.ceil(Math.max(0, s.hp));
    if (hpNow !== v.hpNow || s.maxHp !== v.maxHp) {
      v.hpNow = hpNow;
      v.maxHp = s.maxHp;
      this.hpText.textContent = `${hpNow} / ${s.maxHp}`;
    }
    const xp = Math.round(xpPct * 1000);
    if (xp !== v.xp) {
      v.xp = xp;
      this.xpFill.style.transform = `scaleX(${xpPct})`;
    }
    if (s.level !== v.level) {
      v.level = s.level;
      this.level.textContent = `${UI.hud.level} ${s.level}`;
      replay(this.level, 'is-pop');
    }
    if (s.station !== v.station) {
      v.station = s.station;
      this.station.textContent = s.station;
    }
    // Before the boss the clock counts down to it; during the fight, to the last train; after it, the run
    // time under a warning. The caption says which, so the number never silently changes meaning.
    const train = s.lastTrain > 0;
    const counting = s.toBoss > 0 || train;
    const left = s.toBoss > 0 ? s.toBoss : s.lastTrain;
    const time = Math.floor(counting ? -left : s.time);
    if (time !== v.time) {
      v.time = time;
      this.time.textContent = fmtTime(counting ? Math.ceil(left) : s.time);
      this.time.classList.toggle('is-soon', counting && left < 30);
    }
    const label = s.toBoss > 0 ? 0 : train ? 2 : s.lastTrain === 0 ? 3 : 1;
    if (label !== v.label) {
      v.label = label;
      this.clockLabel.textContent = [UI.hud.toBoss, UI.hud.runTime, UI.hud.lastTrain, UI.hud.nightInspectors][label];
      this.root.classList.toggle('is-night', label === 3);
    }
    if (s.bottles !== v.bottles) {
      v.bottles = s.bottles;
      this.bottleCount.textContent = String(s.bottles);
      this.bottleCash.textContent = UI.bottles.deposit.replace('{v}', (s.bottles * BOTTLES.deposit).toFixed(2).replace('.', ','));
      replay(this.bottles, 'is-pop');
    }
    if (s.kills !== v.kills) {
      v.kills = s.kills;
      this.kills.textContent = `☠ ${s.kills}`;
    }
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
    this.toastLeft = TOAST_TIME;
  }

  /**
   * Game time, not the wall clock: a toast waits through a pause or a level-up card instead of running out
   * behind it. Called from the simulation step while the run plays.
   */
  tickToasts(dt: number): void {
    if (this.toastLeft <= 0) return;
    this.toastLeft -= dt;
    if (this.toastLeft > 0) return;
    this.toasts.shift();
    this.showToast();
  }

  /** A new run starts with no leftovers from the last one. */
  clearToasts(): void {
    this.toasts.length = 0;
    this.toastLeft = 0;
    this.toastEl.classList.remove('is-on');
  }

  private toastLeft = 0;

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
