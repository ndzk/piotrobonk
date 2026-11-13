// The route map: every stop on line 17, which ones are rebuilt, which one is next, the difficulty of the
// run and the "czas do domu" counter. This is where a run starts from.

import { audio } from '../audio/audio';
import { bossOf } from '../content/bosses';
import { STATIONS } from '../content/stations/index';
import { UI } from '../content/ui';
import type { Difficulty, Save } from '../core/save';
import { progressOf, unlocked } from '../core/save';
import type { Input } from '../game/input';
import { Menu, enter, fmtTime, h, leave } from './dom';

const DIFFICULTIES: { id: Difficulty; label: string }[] = UI.route.difficulties.map(([id, label]) => ({ id, label }));

export class RouteScreen {
  readonly root = h('div', 'overlay route');
  private readonly list = h('div', 'route__stops');
  private readonly info = h('div', 'route__info');
  private readonly difficulty = h('button', 'option route__difficulty');
  private readonly difficultyValue = h('span', 'option__value');
  private readonly home = h('p', 'route__home');
  private readonly play = h('button', 'btn', UI.route.play);
  private readonly back = h('button', 'btn btn--ghost', UI.route.back);
  private readonly menu: Menu;
  private stops: { id: string; button: HTMLButtonElement; open: boolean }[] = [];
  private selected = 0;
  private save: Save;
  private onPlay: (station: string) => void = () => undefined;
  private onBack: () => void = () => undefined;
  private onDifficulty: (d: Difficulty) => void = () => undefined;

  constructor(parent: HTMLElement, save: Save) {
    this.save = save;
    const panel = h('div', 'panel route__panel');
    panel.append(h('h2', 'route__title', UI.route.title), h('p', 'route__subtitle', UI.route.subtitle), this.list, this.info);
    this.difficulty.append(h('span', 'option__name', UI.route.difficulty), this.difficultyValue);
    this.difficulty.addEventListener('click', () => {
      this.cycleDifficulty(1);
    });
    const buttons = h('div', 'route__buttons');
    this.play.addEventListener('click', () => {
      this.start();
    });
    this.back.addEventListener('click', () => {
      audio.play('back');
      this.onBack();
    });
    buttons.append(this.play, this.back);
    panel.append(this.difficulty, this.home, buttons);
    this.root.append(panel);
    this.root.hidden = true;
    parent.append(this.root);
    this.menu = new Menu(() => [...this.stops.map((s) => s.button), this.difficulty, this.play, this.back]);
  }

  open(save: Save, handlers: { play: (station: string) => void; back: () => void; difficulty: (d: Difficulty) => void }): void {
    this.save = save;
    this.onPlay = handlers.play;
    this.onBack = handlers.back;
    this.onDifficulty = handlers.difficulty;
    this.build();
    enter(this.root);
    this.menu.focus(this.selected, false);
  }

  close(): void {
    leave(this.root);
  }

  /** Rebuilds the stop list (after a station has been cleared). */
  private build(): void {
    this.stops = STATIONS.map((def, i) => {
      const open = unlocked(this.save, STATIONS.map((s) => s.id), def.id);
      const p = progressOf(this.save, def.id);
      const button = h('button', 'stop');
      if (!open) button.classList.add('is-locked');
      if (p.cleared) button.classList.add('is-cleared');
      button.append(h('span', 'stop__dot'), h('span', 'stop__name', def.name), h('span', 'stop__state', p.cleared ? UI.route.cleared : open ? UI.route.next : UI.route.locked));
      button.disabled = !open;
      button.addEventListener('click', () => {
        this.selected = i;
        this.menu.focus(i, false);
        this.showInfo();
        if (open) this.start();
      });
      button.addEventListener('mouseenter', () => {
        this.selected = i;
        this.showInfo();
      });
      return { id: def.id, button, open };
    });
    // Start on the furthest stop that is open.
    let last = 0;
    this.stops.forEach((s, i) => {
      if (s.open) last = i;
    });
    this.selected = last;
    this.list.replaceChildren(...this.stops.map((s) => s.button));
    this.menu.focus(this.stops.filter((s) => s.open).length - 1, false);
    this.difficultyValue.textContent = DIFFICULTIES.find((d) => d.id === this.save.difficulty)?.label ?? '';
    this.home.textContent = `${UI.route.home.replace('{v}', fmtTime(this.save.totalTime))} ${UI.route.homeHint}`;
    this.showInfo();
  }

  private showInfo(): void {
    const def = STATIONS[this.selected];
    const p = progressOf(this.save, def.id);
    const boss = bossOf(def.id);
    const lines = [boss ? UI.route.boss.replace('{name}', boss.name) : ''];
    if (p.bestTime > 0) lines.push(UI.route.best.replace('{v}', fmtTime(p.bestTime)));
    if (p.bestKills > 0) lines.push(UI.route.kills.replace('{v}', String(p.bestKills)));
    this.info.replaceChildren(h('h3', 'route__station', def.name), ...lines.filter(Boolean).map((l) => h('p', 'route__line', l)));
    for (const [i, s] of this.stops.entries()) s.button.classList.toggle('is-selected', i === this.selected);
    this.play.disabled = !this.stops[this.selected]?.open;
  }

  private cycleDifficulty(dir: 1 | -1): void {
    const i = DIFFICULTIES.findIndex((d) => d.id === this.save.difficulty);
    const next = DIFFICULTIES[(i + dir + DIFFICULTIES.length) % DIFFICULTIES.length];
    this.save.difficulty = next.id;
    this.difficultyValue.textContent = next.label;
    audio.play('hover');
    this.onDifficulty(next.id);
  }

  private start(): void {
    const stop = this.stops[this.selected] as { id: string; open: boolean } | undefined;
    if (!stop || !stop.open) {
      audio.play('denied');
      return;
    }
    audio.play('start');
    this.onPlay(stop.id);
  }

  handleInput(input: Input): void {
    if (input.consume('back')) {
      audio.play('back');
      this.onBack();
      return;
    }
    this.menu.handle(input);
    // After the menu, so that moving onto the row and nudging it in the same frame both land.
    if (this.difficulty.classList.contains('is-focused')) {
      if (input.consume('left')) this.cycleDifficulty(-1);
      else if (input.consume('right')) this.cycleDifficulty(1);
    }
    // The focused button is the truth: locked stops are disabled and the menu skips them.
    const focused = this.stops.findIndex((s) => s.button.classList.contains('is-focused'));
    if (focused >= 0 && focused !== this.selected) {
      this.selected = focused;
      this.showInfo();
    }
  }
}
