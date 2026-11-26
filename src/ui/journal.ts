// The journal ("Dziennik"), from the hub: achievements with progress, the compendium (weapons, evolutions,
// enemies, bosses, the skin collection), lifetime statistics, and what changed in the game (the changelog
// built from the git history). Things not met yet stay "???": the compendium never spoils the line.

import { audio } from '../audio/audio';
import { ACHIEVEMENTS, type StatKey } from '../content/achievements';
import { BOSSES } from '../content/bosses';
import { ENEMIES } from '../content/enemies';
import { NEWS } from '../content/changelog';
import { PASSIVES, WEAPONS } from '../content/items';
import { CS_RARITY, skinName, type SkinDb } from '../content/skins/index';
import { dayOf } from '../core/daily';
import { dayName } from './daily';
import { STATIONS } from '../content/stations/index';
import { delayName, rankOf } from '../content/difficulty';
import { UI } from '../content/ui';
import { progressOf, type Save } from '../core/save';
import { fillCount } from '../core/text';
import type { Input } from '../game/input';
import { enter, fmtTime, h, homeTime, leave, rarityColor, SpatialMenu } from './dom';
import { icon } from './icons';

type Tab = keyof typeof UI.journal.tabs;
const TABS: Tab[] = ['achievements', 'compendium', 'stats', 'news'];
/** Scroll step of the list for the arrows / stick, px. */
const SCROLL = 90;

export interface JournalContext {
  save: Save;
  /** Lifetime counters as they stand now. */
  stats: () => Partial<Record<StatKey, number>>;
  /** The skin data (null while it loads). */
  db: () => SkinDb | null;
  /** A rendered picture of an enemy or a boss (null until the game is built). */
  figure: (id: string) => Promise<string> | null;
}

export class Journal {
  readonly root = h('div', 'overlay journal');
  private readonly panel = h('div', 'panel panel--wide journal__panel');
  private readonly tabsRow = h('div', 'settings__tabs');
  private readonly body = h('div', 'journal__body');
  private readonly back = h('button', 'btn btn--ghost', UI.settings.back);
  private readonly menu = new SpatialMenu(() => [...this.tabsRow.querySelectorAll<HTMLButtonElement>('button'), this.back]);
  private ctx: JournalContext | null = null;
  private onClose: () => void = () => undefined;
  private tab: Tab = 'achievements';
  private opened = false;

  constructor(parent: HTMLElement) {
    const J = UI.journal;
    for (const t of TABS) {
      const b = h('button', 'settings__tab', J.tabs[t]);
      b.dataset.tab = t;
      b.addEventListener('click', () => {
        // The open tab again (a click, or Enter on it) keeps its place in the list.
        if (t === this.tab) return;
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
    this.panel.append(h('h2', 'panel__title', J.title), this.tabsRow, this.body, this.back);
    this.root.append(this.panel);
    this.root.hidden = true;
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(ctx: JournalContext, onClose: () => void): void {
    this.ctx = ctx;
    this.onClose = onClose;
    this.opened = true;
    enter(this.root);
    this.show(this.tab);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    audio.play('back');
    leave(this.root);
    this.onClose();
  }

  handleInput(input: Input): void {
    if (!this.opened) return;
    if (input.consumeAny('back', 'pause')) {
      this.close();
      input.flush();
      return;
    }
    // Left and right change the tab; up and down scroll the page (it is a list to read, not to click).
    const i = TABS.indexOf(this.tab);
    if (input.consumeAny('left', 'tabPrev')) this.show(TABS[(i + TABS.length - 1) % TABS.length], true);
    if (input.consumeAny('right', 'tabNext')) this.show(TABS[(i + 1) % TABS.length], true);
    if (input.consume('down')) this.body.scrollBy({ top: SCROLL });
    if (input.consume('up')) this.body.scrollBy({ top: -SCROLL });
    this.menu.handle(input);
    input.flush();
  }

  private show(tab: Tab, sound = false): void {
    if (sound) audio.play('hover');
    this.tab = tab;
    for (const b of this.tabsRow.children) b.classList.toggle('is-active', (b as HTMLElement).dataset.tab === tab);
    const ctx = this.ctx;
    if (!ctx) return;
    const page = tab === 'achievements' ? this.achievements(ctx) : tab === 'compendium' ? this.compendium(ctx) : tab === 'stats' ? this.statistics(ctx) : this.news();
    this.body.replaceChildren(...page);
    this.body.scrollTop = 0;
    this.menu.focus(this.tabsRow.querySelector<HTMLButtonElement>('.is-active'), false);
  }

  private achievements(ctx: JournalContext): HTMLElement[] {
    const J = UI.journal;
    const stats = ctx.stats();
    const earned = ACHIEVEMENTS.filter((a) => ctx.save.achievements[a.id]).length;
    const rows = ACHIEVEMENTS.map((a) => {
      const done = a.id in ctx.save.achievements;
      const hidden = a.secret === true && !done;
      const p = done ? 1 : Math.max(0, Math.min(1, a.progress(stats, ctx.save)));
      const row = h('div', `achv${done ? ' is-done' : ''}`);
      const bar = h('div', 'achv__bar');
      const fill = h('div', 'achv__fill');
      fill.style.width = `${Math.round(p * 100)}%`;
      bar.append(fill);
      row.append(h('div', 'achv__mark', done ? '★' : hidden ? '?' : '☆'), h('div', 'achv__name', hidden ? J.secret : a.name), h('div', 'achv__desc', hidden ? J.secretDesc : a.description));
      if (!done && !hidden) row.append(bar);
      const when = ctx.save.achievements[a.id] as number | undefined;
      if (done && when) row.append(h('div', 'achv__date', J.earnedOn.replace('{v}', dayName(dayOf(new Date(when))))));
      return row;
    });
    return [h('p', 'journal__lead', J.earned.replace('{v}', String(earned)).replace('{n}', String(ACHIEVEMENTS.length))), ...rows];
  }

  private compendium(ctx: JournalContext): HTMLElement[] {
    const J = UI.journal;
    const seen = ctx.save.seen;
    const out: HTMLElement[] = [];
    const entry = (pic: string | Promise<string> | null, name: string, text: string, locked = false): HTMLElement => {
      const e = h('div', `entry${locked ? ' is-locked' : ''}`);
      if (pic) {
        const img = h('img', `entry__icon${typeof pic === 'string' ? '' : ' entry__icon--figure'}`);
        img.alt = '';
        // Enemies and bosses are rendered from their models on first sight of the page; they fade in.
        if (typeof pic === 'string') img.src = pic;
        else
          void pic.then((src) => {
            img.src = src;
          });
        e.append(img);
      } else e.append(h('div', 'entry__icon entry__icon--blank', locked ? '?' : ''));
      e.append(h('div', 'entry__name', name), h('div', 'entry__text', text));
      return e;
    };
    out.push(h('h3', 'settings__group', J.weapons));
    for (const w of WEAPONS.filter((x) => !x.evolved)) out.push(entry(icon(w.id), w.name, w.description));
    out.push(h('h3', 'settings__group', J.evolutions));
    for (const base of WEAPONS) {
      if (!base.evolution) continue;
      const into = WEAPONS.find((x) => x.id === base.evolution?.into);
      if (!into) continue;
      const passive = PASSIVES.find((x) => x.id === base.evolution?.passive)?.name ?? '';
      const known = seen.evolutions.includes(into.id);
      // The recipe is the hint even before it is found; the result stays hidden.
      const recipe = J.recipe.replace('{weapon}', base.name).replace('{passive}', passive);
      out.push(known ? entry(icon(into.id), into.name, `${into.description} ${recipe}.`) : entry(null, J.lockedEvolution, `${recipe}.`, true));
    }
    out.push(h('h3', 'settings__group', J.enemies));
    for (const e of ENEMIES) out.push(seen.enemies.includes(e.id) ? entry(ctx.figure(e.id), e.name, e.bestiary) : entry(null, J.locked, J.lockedEnemy, true));
    out.push(h('h3', 'settings__group', J.bosses));
    for (const b of BOSSES) {
      if (!seen.bosses.includes(b.id)) {
        out.push(entry(null, J.locked, J.lockedBoss, true));
        continue;
      }
      const best = progressOf(ctx.save, b.station).bestTime;
      out.push(entry(ctx.figure(b.id), b.name, `${b.bestiary}${best ? ` ${J.bestTime.replace('{v}', fmtTime(best))}.` : ''}`));
    }
    out.push(h('h3', 'settings__group', J.skins));
    const db = ctx.db();
    if (!db) out.push(h('p', 'journal__lead', J.loading));
    else {
      const have = new Set(ctx.save.collected);
      const all = new Set<string>();
      for (const c of db.cases) for (const s of [...c.items, ...c.rare]) all.add(s.id);
      let mine = 0;
      for (const id of all) if (have.has(id)) mine++;
      out.push(this.progressRow(J.skins, mine, all.size));
      // Every case: its progress, then its skins by name, the ones ever drawn in their rarity colour and the
      // missing ones dim. The ★ pool is one line (a case can hold a hundred knife finishes).
      for (const c of db.cases) {
        const ids = new Set([...c.items, ...c.rare].map((s) => s.id));
        let n = 0;
        for (const id of ids) if (have.has(id)) n++;
        out.push(this.progressRow(c.name, n, ids.size));
        const list = h('div', 'collect__skins');
        for (const s of c.items) {
          const got = have.has(s.id);
          const chip = h('span', `collect__skin${got ? ' is-got' : ''}`, skinName(db, s));
          if (got) chip.style.setProperty('--rarity', rarityColor(CS_RARITY[s.rarity].color));
          list.append(chip);
        }
        let stars = 0;
        for (const s of c.rare) if (have.has(s.id)) stars++;
        const star = h('span', `collect__skin collect__skin--star${stars ? ' is-got' : ''}`, J.stars.replace('{v}', String(stars)).replace('{n}', String(c.rare.length)));
        list.append(star);
        out.push(list);
      }
    }
    return out;
  }

  private progressRow(name: string, have: number, total: number): HTMLElement {
    const row = h('div', 'collect');
    const bar = h('div', 'achv__bar');
    const fill = h('div', 'achv__fill');
    fill.style.width = `${total ? Math.round((have / total) * 100) : 0}%`;
    bar.append(fill);
    row.append(h('span', 'collect__name', name), h('span', 'collect__count', UI.journal.collection.replace('{v}', String(have)).replace('{n}', String(total))), bar);
    return row;
  }

  private statistics(ctx: JournalContext): HTMLElement[] {
    const J = UI.journal;
    const L = J.statLabels;
    const s = ctx.stats();
    const save = ctx.save;
    const list = h('dl', 'journal__stats');
    const row = (k: string, v: string): void => {
      list.append(h('dt', '', k), h('dd', '', v));
    };
    const n = (key: StatKey): string => Math.floor(s[key] ?? 0).toLocaleString('pl-PL');
    // The profile: the title and frame from the delay ladder, and how far up it the player has got.
    const rank = rankOf(save.ladder.best, Object.values(save.stations).some((p) => p.cleared === 'opoznienie'));
    const card = h('div', 'journal__rank');
    card.style.setProperty('--frame', rank.frame.color);
    card.append(h('span', 'journal__ranktitle', rank.title || J.noTitle), h('span', 'journal__rankframe', J.frame.replace('{v}', rank.frame.name)), h('span', 'journal__rankdelay', save.ladder.best > 0 ? J.bestDelay.replace('{v}', delayName(save.ladder.best)) : save.ladder.open > 0 ? J.ladderOpen : J.ladderClosed));
    row(L.totalTime, homeTime(save.totalTime));
    if (save.homeTime) row(L.homeTime, homeTime(save.homeTime));
    row(L.runs, String(save.runs));
    row(L.deaths, String(save.deaths));
    row(L.kills, n('kills'));
    row(L.bossKills, n('bossKills'));
    row(L.elites, n('elites'));
    row(L.pigeons, n('pigeons'));
    row(L.inspectors, n('inspectors'));
    row(L.lemurs, n('lemurs'));
    row(L.evolutions, n('evolutions'));
    row(L.chests, n('chests'));
    row(L.coffees, n('coffees'));
    row(L.bins, n('bins'));
    row(L.bottlesEarned, n('bottlesEarned'));
    // Not known for runs from before the journal counted it.
    row(L.bestLevel, s.bestLevel ? n('bestLevel') : '—');
    row(L.bestBhop, n('bestBhop'));
    row(L.casesOpened, String(save.casesOpened));
    row(L.contracts, String(save.contracts));
    row(L.starsDropped, n('starsDropped'));
    row(L.slaps, n('slaps'));
    row(L.dailyRuns, n('dailyRuns'));
    row(L.dailyDays, n('dailyDays'));
    const times = h('dl', 'journal__stats');
    for (const st of STATIONS) {
      const best = progressOf(save, st.id).bestTime;
      times.append(h('dt', '', st.name), h('dd', '', best ? fmtTime(best) : J.never));
    }
    return [card, list, h('h3', 'settings__group', J.stations), times];
  }

  private news(): HTMLElement[] {
    const J = UI.journal;
    const out: HTMLElement[] = [h('p', 'journal__lead', J.version.replace('{v}', `${__APP_VERSION__} · ${__GIT_SHA__}`))];
    // One block per day, newest first: the commits of the game's history, each told in Polish
    // (src/content/changelog.ts); changes to the tooling alone are left out.
    let day = '';
    let list: HTMLElement | null = null;
    for (const [date, subject] of __CHANGELOG__) {
      const text = NEWS[subject];
      if (!text) continue;
      if (date !== day || !list) {
        day = date;
        out.push(h('h3', 'settings__group', dayName(date)));
        list = h('ul', 'news');
        out.push(list);
      }
      list.append(h('li', '', text));
    }
    if (!list) out.push(h('p', '', J.noNews));
    return out;
  }
}

/** "Osiągnięcie: Rozgrzewka" sliding in at the right edge, one after another when several land at once. */
/**
 * "Osiągnięcie" toasts. They wait while `allowed` is false (the title, cinematics, cards and other choices)
 * and come one at a time; three or more waiting at once come as one toast instead of a minute of them.
 */
export class AchievementToasts {
  private readonly root = h('div', 'achv-toast');
  private readonly kicker = h('div', 'achv-toast__kicker');
  private readonly name = h('div', 'achv-toast__name');
  private readonly queue: string[] = [];
  /** Earned before this version counted them (an older save): one toast for all of them. */
  private earlier = 0;
  private busy = false;
  allowed = false;

  constructor(parent: HTMLElement) {
    this.root.append(this.kicker, this.name);
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(name: string): void {
    this.queue.push(name);
  }

  /** Achievements an older save had already earned, granted quietly on load. */
  showEarlier(count: number): void {
    this.earlier += count;
  }

  /** Called every frame. */
  frame(): void {
    // A card or a cinematic came up while one was showing: it goes at once instead of covering them.
    if (!this.allowed && this.busy && !this.root.hidden && !this.root.classList.contains('is-out')) leave(this.root);
    if (this.busy || !this.allowed) return;
    if (this.earlier > 0) {
      this.play(UI.achievement.earlier, fillCount(UI.achievement.inJournal, String(this.earlier), this.earlier), 4200);
      this.earlier = 0;
    } else if (this.queue.length >= 3) {
      const [a, b] = this.queue;
      const rest = this.queue.length - 2;
      this.play(fillCount(UI.achievement.many, String(this.queue.length), this.queue.length), UI.achievement.list.replace('{a}', a).replace('{b}', b).replace('{n}', String(rest)), 4200);
      this.queue.length = 0;
    } else {
      const name = this.queue.shift();
      if (name !== undefined) this.play(UI.achievement.toast, name, 3200);
    }
  }

  private play(kicker: string, name: string, ms: number): void {
    this.busy = true;
    this.kicker.textContent = kicker;
    this.name.textContent = name;
    enter(this.root);
    audio.play('toast');
    window.setTimeout(() => {
      leave(this.root);
      window.setTimeout(() => {
        this.busy = false;
      }, 450);
    }, ms);
  }
}
