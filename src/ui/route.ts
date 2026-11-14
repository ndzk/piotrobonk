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
  private readonly difficultyHint = h('p', 'route__hint');
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
    panel.append(this.difficulty, this.difficultyHint, this.home, buttons);
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
      // The finale has no boss yet, so it cannot be cleared: it shows as "wkrótce" instead of playable.
      const playable = bossOf(def.id) !== null;
      const open = playable && unlocked(this.save, STATIONS.map((s) => s.id), def.id);
      const p = progressOf(this.save, def.id);
      const button = h('button', 'stop');
      if (!open) button.classList.add('is-locked');
      if (p.cleared) button.classList.add('is-cleared');
      if (open && !p.cleared) button.classList.add('is-next');
      const state = p.cleared ? UI.route.cleared : open ? UI.route.next : playable ? UI.route.locked : UI.route.soon;
      button.append(h('span', 'stop__dot'), h('span', 'stop__name', def.name), h('span', 'stop__state', state));
      // Locked stops stay focusable: the player should see what is waiting down the line.
      button.addEventListener('click', () => {
        this.selected = i;
        this.showInfo();
        if (open) this.start();
        else audio.play('denied');
      });
      button.addEventListener('mouseenter', () => {
        this.selected = i;
        this.showInfo();
      });
      return { id: def.id, button, open };
    });
    // Start on the stop the player is meant to play next: the first open one that is not cleared.
    let next = 0;
    this.stops.forEach((s, i) => {
      if (s.open && !progressOf(this.save, s.id).cleared && next === 0) next = i;
    });
    this.selected = next;
    this.list.replaceChildren(...this.stops.map((s) => s.button));
    this.menu.focus(next, false);
    this.setDifficultyText();
    this.home.textContent = [
      `${UI.route.home.replace('{v}', fmtTime(this.save.totalTime))} ${UI.route.homeHint}`,
      UI.route.bank.replace('{v}', String(this.save.bottles)),
      UI.route.runs.replace('{v}', String(this.save.runs)).replace('{v2}', String(this.save.deaths)),
    ].join(' · ');
    this.showInfo();
  }

  private showInfo(): void {
    const def = STATIONS[this.selected];
    const p = progressOf(this.save, def.id);
    const boss = bossOf(def.id);
    const lines = [boss ? UI.route.boss.replace('{name}', boss.name) : ''];
    if (p.cleared) lines.push(UI.route.clearedOn.replace('{v}', DIFFICULTIES.find((d) => d.id === p.cleared)?.label ?? ''));
    if (p.bestTime > 0) lines.push(UI.route.best.replace('{v}', fmtTime(p.bestTime)));
    if (p.bestKills > 0) lines.push(UI.route.kills.replace('{v}', String(p.bestKills)));
    this.info.replaceChildren(h('h3', 'route__station', def.name), ...lines.filter(Boolean).map((l) => h('p', 'route__line', l)));
    for (const [i, s] of this.stops.entries()) s.button.classList.toggle('is-selected', i === this.selected);
    const stop = this.stops[this.selected] as { open: boolean } | undefined;
    this.play.disabled = !stop || !stop.open;
  }

  /** The kurs row says what it actually changes, not just its name. */
  private setDifficultyText(): void {
    const d = DIFFICULTIES.find((x) => x.id === this.save.difficulty);
    this.difficultyValue.textContent = d?.label ?? '';
    this.difficultyHint.textContent = UI.route.hint[this.save.difficulty];
  }

  private cycleDifficulty(dir: 1 | -1): void {
    const i = DIFFICULTIES.findIndex((d) => d.id === this.save.difficulty);
    const next = DIFFICULTIES[(i + dir + DIFFICULTIES.length) % DIFFICULTIES.length];
    this.save.difficulty = next.id;
    this.setDifficultyText();
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
    // The list is vertical, so left and right always mean the kurs, wherever the focus sits.
    if (input.consume('left')) this.cycleDifficulty(-1);
    else if (input.consume('right')) this.cycleDifficulty(1);
    // The focused button is the truth: the menu owns the order, this only follows it.
    const focused = this.stops.findIndex((s) => s.button.classList.contains('is-focused'));
    if (focused >= 0 && focused !== this.selected) {
      this.selected = focused;
      this.showInfo();
    }
  }
}
