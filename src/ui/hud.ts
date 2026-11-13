import { UI } from '../content/ui';
import { fmtTime, h, replay } from './dom';
import { icon } from './icons';

export interface HudState {
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  level: number;
  time: number;
  kills: number;
  slots: { id: string; level: number; kind: 'weapon' | 'passive' }[];
}

/** In-run HUD. Writes to the DOM only when a value changes. */
export class Hud {
  readonly root = h('div', 'hud');
  private readonly xpFill = h('div', 'hud__xpfill');
  private readonly level = h('div', 'hud__level');
  private readonly time = h('div', 'hud__time');
  private readonly kills = h('div', 'hud__kills');
  private readonly hpFill = h('div', 'hud__hpfill');
  private readonly hpLag = h('div', 'hud__hplag');
  private readonly hpText = h('div', 'hud__hptext');
  private readonly slots = h('div', 'hud__slots');
  private readonly hurtFlash = h('div', 'hud__hurt');
  private readonly vignette = h('div', 'hud__vignette');
  private last: Partial<Record<string, string | number>> = {};

  constructor(parent: HTMLElement) {
    const xp = h('div', 'hud__xp');
    xp.append(this.xpFill, this.level);
    const top = h('div', 'hud__top');
    const station = h('div', 'hud__station', UI.hud.station);
    top.append(station, this.time);
    const hp = h('div', 'hud__hp');
    const bar = h('div', 'hud__hpbar');
    bar.append(this.hpLag, this.hpFill);
    hp.append(bar, this.hpText);
    this.root.append(this.vignette, this.hurtFlash, xp, top, this.kills, hp, this.slots);
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
    this.set('time', Math.floor(s.time), () => {
      this.time.textContent = fmtTime(s.time);
    });
    this.set('kills', s.kills, () => {
      this.kills.textContent = `${UI.hud.kills}: ${s.kills}`;
    });
    const slotKey = s.slots.map((x) => `${x.id}${x.level}`).join(',');
    this.set('slots', slotKey, () => {
      this.slots.replaceChildren(
        ...s.slots.map((x) => {
          const el = h('div', `hud__slot hud__slot--${x.kind}`);
          const img = h('img');
          img.src = icon(x.id);
          img.alt = '';
          el.append(img, h('span', '', String(x.level)));
          return el;
        }),
      );
    });
  }

  hurt(): void {
    replay(this.hurtFlash, 'is-on');
  }

  show(on: boolean): void {
    this.root.hidden = !on;
    if (on) this.last = {};
  }
}
