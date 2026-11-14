// The intro, played in the engine before the first trip: the departures board full of "ODWOŁANY", a
// flashback of Bartek D. pulling up the rails, the scrapyard, Bartek with his kopi luwak, and Piotrek
// deciding to walk. Each shot builds its own arena, frames its actors with a slow camera move and plays
// its lines with portraits; the flashbacks are sepia. "Pomiń" (or Esc / B) ends the whole thing.

import { BoxGeometry, Mesh, MeshToonMaterial, PerspectiveCamera, Scene, Vector3, type WebGLRenderer } from 'three';
import { audio } from '../audio/audio';
import { Character } from '../characters/character';
import { PIOTREK } from '../content/characters';
import { INTRO } from '../content/dialogs';
import { TRACKS, trackForStation } from '../content/music';
import { station } from '../content/stations/index';
import { TUNING } from '../content/tuning';
import { UI } from '../content/ui';
import { Kit } from '../render/kit';
import type { Portraits } from '../render/portraits';
import { toonRamp } from '../render/toon';
import { enter, h, leave, replay } from '../ui/dom';
import { Dialogue } from '../ui/story';
import { BartekRig } from './bartek';
import { enemyModel } from './enemy-models';
import type { Input } from './input';
import { World } from './world';

type ShotId = (typeof INTRO)[number]['id'];

interface Shot {
  arena: string;
  sepia: boolean;
  /** Camera position and target at the start and at the end of the shot. */
  from: [Vector3, Vector3];
  to: [Vector3, Vector3];
  seconds: number;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

const SHOTS: Record<ShotId, Shot> = {
  board: { arena: 'fabryczna', sepia: false, from: [v(10, 3.4, 34), v(3, 1.9, 26.6)], to: [v(5, 2.3, 30.2), v(3, 2.1, 26.6)], seconds: 14 },
  theft: { arena: 'fabryczna', sepia: true, from: [v(-1, 0.7, 14.5), v(-6, 1.1, 19.6)], to: [v(-2.5, 1.2, 16), v(-6, 1.4, 19.6)], seconds: 9 },
  scrap: { arena: 'andrzejow', sepia: true, from: [v(-6, 2, 14), v(-6.5, 1.6, 6.5)], to: [v(-5.5, 1.7, 11.5), v(-6.5, 1.8, 6.5)], seconds: 9 },
  coffee: { arena: 'koluszki', sepia: true, from: [v(17.6, 1.6, -16.4), v(16, 1.2, -20.2)], to: [v(16.7, 1.35, -18.4), v(16, 1.3, -20.2)], seconds: 12 },
  resolve: { arena: 'fabryczna', sepia: false, from: [v(5.2, 2.2, 23.2), v(3, 2.15, 26.6)], to: [v(4, 2.1, 24.6), v(3, 2.2, 26.6)], seconds: 10 },
};

const BOARD_TIMES = ['17:42', '18:12', '18:42', '19:12', '20:12', '21:42', '23:58'];

export class Intro {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(42, 1, 0.1, 200);
  private readonly look = new Vector3();
  private world: World | null = null;
  private arena = '';
  private readonly piotrek = new Character(PIOTREK);
  private readonly bartek: BartekRig;
  private readonly rail: Mesh;
  private readonly king: Mesh;
  private readonly dialogue: Dialogue;
  private readonly caption = h('div', 'intro__caption');
  private readonly board = h('section', 'board intro__board');
  private readonly fade = h('div', 'intro__fade');
  private readonly root = h('div', 'intro');
  private index = 0;
  private t = 0;
  private playing = false;
  private onDone: () => void = () => undefined;

  constructor(
    private readonly renderer: WebGLRenderer,
    parent: HTMLElement,
    portraits: Portraits,
  ) {
    new Kit(this.piotrek).apply(null);
    this.scene.add(this.piotrek.root);
    this.bartek = new BartekRig(this.scene);
    this.rail = new Mesh(new BoxGeometry(0.12, 0.15, 5), new MeshToonMaterial({ color: '#cfc9c2', gradientMap: toonRamp() }));
    this.scene.add(this.rail);
    this.king = new Mesh(enemyModel('krol-zlomu').body, new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
    this.scene.add(this.king);
    // The departures board: every train cancelled, flipping in one after another.
    this.board.append(h('div', 'board__header', UI.board.header));
    BOARD_TIMES.forEach((time, i) => {
      const row = h('div', 'board__row');
      row.style.setProperty('--i', String(i));
      row.append(h('span', 'board__time', time), h('span', 'board__train', UI.board.train), h('span', 'board__dest', UI.board.destination), h('span', 'board__status', UI.board.status));
      this.board.append(row);
    });
    this.root.append(this.caption, this.board, this.fade);
    this.root.hidden = true;
    parent.append(this.root);
    this.dialogue = new Dialogue(parent, portraits, 'box');
  }

  get active(): boolean {
    return this.playing;
  }

  resize(w: number, hgt: number): void {
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
  }

  play(onDone: () => void): void {
    this.onDone = onDone;
    this.playing = true;
    this.index = 0;
    enter(this.root);
    this.startShot();
  }

  private startShot(): void {
    const id = INTRO[this.index].id;
    const shot = SHOTS[id];
    if (shot.arena !== this.arena) {
      this.world?.dispose(this.scene);
      this.world = new World(station(shot.arena), this.scene);
      this.arena = shot.arena;
      this.renderer.compile(this.scene, this.camera);
    }
    this.t = 0;
    this.renderer.domElement.classList.toggle('is-flashback', shot.sepia);
    this.root.classList.toggle('is-flashback', shot.sepia);
    replay(this.fade, 'is-in');
    const caption = INTRO[this.index].caption ?? '';
    this.caption.textContent = caption;
    this.caption.hidden = !caption;
    if (caption) replay(this.caption, 'is-in');
    this.board.hidden = id !== 'board';
    if (id === 'board') replay(this.board, 'is-in');
    audio.playMusic(shot.sepia ? trackForStation('koluszki') : TRACKS.menu);
    this.pose(id);
    this.dialogue.play(INTRO[this.index].lines, (skipped) => {
      if (skipped) this.finish();
      else this.nextShot();
    });
  }

  /** Who stands where, holding what, for each shot. */
  private pose(id: ShotId): void {
    this.piotrek.root.visible = id === 'board' || id === 'resolve';
    this.piotrek.root.position.set(3, 1, 26.6);
    this.piotrek.root.rotation.y = Math.PI * 0.85;
    this.piotrek.setExpression(id === 'resolve' ? 'angry' : 'neutral');
    const b = this.bartek;
    b.root.visible = id === 'theft' || id === 'scrap' || id === 'coffee';
    b.chair.visible = false;
    b.props(false, false);
    this.rail.visible = id === 'theft' || id === 'scrap';
    this.king.visible = id === 'scrap';
    if (id === 'theft') {
      b.standUp(true);
      b.place(-6, 0.2, 19.6, Math.PI * 0.15);
      b.setFace('angry');
    } else if (id === 'scrap') {
      b.standUp(true);
      b.place(-8, 0, 7, Math.PI * 0.35);
      b.setFace('smirk');
      this.king.position.set(-4.8, 0, 6);
      this.king.rotation.y = -Math.PI * 0.4;
    } else if (id === 'coffee') {
      b.reset(TUNING.finale.seat);
      b.props(true, true);
      b.setFace('smirk');
    }
  }

  private nextShot(): void {
    this.index++;
    if (this.index >= INTRO.length) this.finish();
    else this.startShot();
  }

  private finish(): void {
    if (!this.playing) return;
    this.playing = false;
    this.renderer.domElement.classList.remove('is-flashback');
    leave(this.root);
    this.world?.dispose(this.scene);
    this.world = null;
    this.arena = '';
    this.onDone();
  }

  handleInput(input: Input): void {
    this.dialogue.handleInput(input);
  }

  frame(dt: number): void {
    if (!this.playing) return;
    this.t += dt;
    this.dialogue.tick(dt);
    const id = INTRO[this.index].id;
    const shot = SHOTS[id];
    const k = Math.min(1, this.t / shot.seconds);
    const e = k * k * (3 - 2 * k);
    this.camera.position.lerpVectors(shot.from[0], shot.to[0], e);
    this.look.lerpVectors(shot.from[1], shot.to[1], e);
    this.camera.lookAt(this.look);
    if (this.world) this.world.sky.position.copy(this.camera.position);
    this.piotrek.idle(this.t);
    if (id === 'resolve' && this.t > 3) this.piotrek.setExpression('smirk');
    if (id === 'board') this.piotrek.joints.head.rotation.y = -0.4 + Math.min(0.4, this.t * 0.2);
    this.bartek.update(dt, this.t, false);
    // Stealing a rail: it comes up off the sleepers, onto his shoulder, again and again.
    const j = this.bartek.character.joints;
    if (id === 'theft') {
      const lift = (Math.sin(this.t * 2.2) + 1) / 2;
      j.shoulderL.rotation.set(-2.2 * lift - 0.4, 0, 0.3);
      j.shoulderR.rotation.set(-2.2 * lift - 0.4, 0, -0.3);
      j.elbowL.rotation.set(-0.3, 0, 0);
      j.elbowR.rotation.set(-0.3, 0, 0);
      this.rail.position.set(-6, 0.6 + lift * 1.3, 20.2);
      this.rail.rotation.set(lift * 0.25, 0.15, 0);
    } else if (id === 'scrap') {
      j.shoulderR.rotation.set(-2.6, 0, -0.2);
      j.elbowR.rotation.set(-0.6, 0, 0);
      this.rail.position.set(-7.9, 2.0, 7.1);
      this.rail.rotation.set(0.1, Math.PI * 0.35, 0.05);
    } else if (id === 'coffee' && Math.floor(this.t) % 5 === 2) this.bartek.sip();
    this.renderer.render(this.scene, this.camera);
  }
}
