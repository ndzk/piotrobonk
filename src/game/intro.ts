// The intro, played in the engine before the first trip: the departures board at Fabryczna flipping to
// "ODWOŁANY" as the megaphone announces it, a flashback of Bartek D. pulling up the rails at night, the
// scrapyard, Bartek with his kopi luwak under Dino, and Piotrek deciding to walk. Each shot builds its own
// arena, frames its actors above the dialogue box with a slow camera move, and lights them with a key light
// of its own. "Pomiń" (or Esc / B) ends the whole thing.

import { BoxGeometry, CanvasTexture, Mesh, MeshBasicMaterial, MeshToonMaterial, PerspectiveCamera, PlaneGeometry, PointLight, SRGBColorSpace, Scene, Vector3, type WebGLRenderer } from 'three';
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
  /** Daylight as it is, or a sepia flashback (`dusk`: a darker one, for the evening of the theft). */
  look: 'now' | 'sepia' | 'dusk';
  /** Camera position and target at the start and at the end of the shot. */
  from: [Vector3, Vector3];
  to: [Vector3, Vector3];
  seconds: number;
  /** A warm key light on the actors (they would sink into the arena's own light otherwise). */
  light: Vector3 | null;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
const [SX, , SZ] = TUNING.finale.seat;

// Targets sit below the actors' heads on purpose: the dialogue box covers the bottom third of the screen,
// so the people are framed in the upper two thirds.
const SHOTS: Record<ShotId, Shot> = {
  board: { arena: 'fabryczna', look: 'now', from: [v(6.6, 2.3, 31.6), v(4.6, 2.2, 25.6)], to: [v(6.1, 2.05, 29.9), v(4.5, 2.35, 25.6)], seconds: 14, light: v(6, 3.2, 28.6) },
  theft: { arena: 'fabryczna', look: 'dusk', from: [v(-2.2, 1.0, 15.2), v(-6, 0.9, 19.6)], to: [v(-3.3, 1.35, 16.4), v(-6, 1.1, 19.6)], seconds: 9, light: v(-4.5, 2.6, 17.8) },
  // From the open yard south of them, wide enough for the Scrap King (four metres of him) and Bartek.
  scrap: { arena: 'andrzejow', look: 'sepia', from: [v(-6.2, 2.4, -2.4), v(-6.6, 1.8, 5.6)], to: [v(-6.5, 2.2, -0.9), v(-6.6, 1.9, 5.6)], seconds: 9, light: v(-7.4, 3.2, 2.6) },
  // Wide first, with the DINO sign over the top of the frame ("Pod Dino, Koluszki"), then in on Bartek.
  coffee: { arena: 'koluszki', look: 'sepia', from: [v(SX + 6, 3.2, SZ + 14), v(SX - 0.5, 3.6, SZ - 3)], to: [v(SX + 2.4, 1.6, SZ + 5.2), v(SX, 1.2, SZ)], seconds: 12, light: v(SX + 1.2, 2.4, SZ + 1.6) },
  resolve: { arena: 'fabryczna', look: 'now', from: [v(7.2, 2.35, 30), v(5.3, 2.15, 26.2)], to: [v(6.7, 2.25, 29.2), v(5.3, 2.2, 26.2)], seconds: 10, light: v(6.4, 3, 28.4) },
};

const BOARD_TIMES = ['17:42', '18:12', '18:42', '19:12', '20:12', '21:42', '23:58'];
/** The line of the board shot on which the megaphone cancels everything (the rows flip then, not before). */
const CANCEL_LINE = 1;

/**
 * The departures board in the scene: a lit panel on a post, drawn on a canvas. Rows flip to ODWOŁANY one
 * after another, each through a second of split-flap noise.
 */
class DepartureBoard {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly g: CanvasRenderingContext2D | null;
  private readonly texture: CanvasTexture;
  /** Per row: seconds since it started flipping, or -1 while it still shows its time as planned. */
  private readonly flips = BOARD_TIMES.map(() => -1);
  private flipping = false;
  private t = 0;

  constructor() {
    this.canvas.width = 640;
    this.canvas.height = 400;
    this.g = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    const panel = new Mesh(new PlaneGeometry(2.4, 1.5), new MeshBasicMaterial({ map: this.texture }));
    panel.position.z = 0.07;
    const frame = new Mesh(new BoxGeometry(2.55, 1.65, 0.12), new MeshToonMaterial({ color: '#1c1f29', gradientMap: toonRamp() }));
    const post = new Mesh(new BoxGeometry(0.14, 2.6, 0.14), new MeshToonMaterial({ color: '#3a3f4a', gradientMap: toonRamp() }));
    post.position.y = -2.0;
    frame.add(panel, post);
    this.mesh = frame;
    this.draw();
  }

  reset(): void {
    this.flips.fill(-1);
    this.flipping = false;
    this.draw();
  }

  /** The announcement: every row flips, top to bottom. */
  cancelAll(): void {
    this.flipping = true;
    this.t = 0;
  }

  update(dt: number): void {
    if (!this.flipping) return;
    this.t += dt;
    let busy = false;
    for (let i = 0; i < this.flips.length; i++) {
      const start = i * 0.32;
      if (this.t < start) {
        busy = true;
        continue;
      }
      const f = this.t - start;
      // A clack per row as it lands.
      if (f >= 0.6 && this.flips[i] < 0.6) audio.play('click', 0.35, 0.8 + i * 0.03);
      this.flips[i] = f;
      if (f < 0.6) busy = true;
    }
    this.draw();
    if (!busy) this.flipping = false;
  }

  private draw(): void {
    const g = this.g;
    if (!g) return;
    const W = this.canvas.width;
    g.fillStyle = '#0b0f24';
    g.fillRect(0, 0, W, 400);
    g.fillStyle = '#0d3b8c';
    g.fillRect(0, 0, W, 62);
    g.fillStyle = '#ffffff';
    g.font = '800 38px "Barlow Condensed", sans-serif';
    g.textBaseline = 'middle';
    g.fillText(UI.board.header.toUpperCase(), 22, 33);
    g.font = '700 34px "Barlow Condensed", sans-serif';
    const flap = 'ABCDEFGHIJKLMNOPRSTUWYZŁŚŻ0123456789';
    BOARD_TIMES.forEach((time, i) => {
      const y = 92 + i * 44;
      g.fillStyle = i % 2 ? '#10153a' : '#0b0f24';
      g.fillRect(0, y - 22, W, 44);
      g.fillStyle = '#ffc83a';
      g.fillText(time, 22, y);
      g.fillText(UI.board.train, 132, y);
      g.fillText(UI.board.destination, 240, y);
      const f = this.flips[i];
      if (f < 0) return;
      if (f < 0.6) {
        // Split-flap noise: random letters while it turns over.
        let noise = '';
        for (let k = 0; k < 8; k++) noise += flap[Math.floor(Math.random() * flap.length)];
        g.fillStyle = '#c9c2b2';
        g.fillText(noise, 430, y);
      } else {
        g.fillStyle = '#ff5a3c';
        g.fillText(UI.board.status, 430, y);
      }
    });
    this.texture.needsUpdate = true;
  }
}

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
  private readonly board = new DepartureBoard();
  private readonly key = new PointLight('#ffd9a8', 0, 10, 1.6);
  private readonly dialogue: Dialogue;
  private readonly caption = h('div', 'intro__caption');
  private readonly fade = h('div', 'intro__fade');
  private readonly root = h('div', 'intro');
  private readonly wristL = new Vector3();
  private readonly wristR = new Vector3();
  private index = 0;
  private t = 0;
  private lastSip = -10;
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
    this.rail = new Mesh(new BoxGeometry(5, 0.15, 0.12), new MeshToonMaterial({ color: '#cfc9c2', gradientMap: toonRamp() }));
    this.scene.add(this.rail);
    this.king = new Mesh(enemyModel('krol-zlomu').body, new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
    this.scene.add(this.king);
    this.board.mesh.position.set(3.7, 3.2, 24.9);
    this.board.mesh.rotation.y = 0.28;
    this.scene.add(this.board.mesh, this.key);
    this.root.append(this.caption, this.fade);
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
    this.board.reset();
    enter(this.root);
    this.prepareArenas();
    this.startShot();
  }

  /**
   * The intro cuts between three arenas, and back to the first. Each is built and its shaders compiled once,
   * when the intro starts; a cut only swaps which one is in the scene (building and compiling at every cut
   * stuttered).
   */
  private useArena(id: string): void {
    if (this.world) this.scene.remove(this.world.group, this.world.sky);
    let w = this.worlds.get(id);
    if (!w) {
      w = new World(station(id), this.scene);
      this.worlds.set(id, w);
      this.renderer.compile(this.scene, this.camera);
    } else {
      this.scene.add(w.group, w.sky);
    }
    // A world sets the sky colour and the fog of the scene it is in: put them back for this one.
    this.scene.background = w.background;
    this.scene.fog = w.fog;
    this.world = w;
    this.arena = id;
  }

  /** Builds every arena of the intro up front (each compiled with its own lights), then shows none of them. */
  private prepareArenas(): void {
    for (const s of INTRO) this.useArena(SHOTS[s.id].arena);
    if (this.world) this.scene.remove(this.world.group, this.world.sky);
    this.world = null;
    this.arena = '';
  }

  private readonly worlds = new Map<string, World>();

  private startShot(): void {
    const id = INTRO[this.index].id;
    const shot = SHOTS[id];
    if (shot.arena !== this.arena) this.useArena(shot.arena);
    this.t = 0;
    this.lastSip = -10;
    const flashback = shot.look !== 'now';
    this.renderer.domElement.classList.toggle('is-flashback', shot.look === 'sepia');
    this.renderer.domElement.classList.toggle('is-dusk', shot.look === 'dusk');
    this.root.classList.toggle('is-flashback', flashback);
    replay(this.fade, 'is-in');
    const caption = INTRO[this.index].caption ?? '';
    this.caption.textContent = caption;
    this.caption.hidden = !caption;
    if (caption) replay(this.caption, 'is-in');
    this.board.mesh.visible = id === 'board' || id === 'resolve';
    if (shot.light) {
      this.key.position.copy(shot.light);
      this.key.intensity = shot.look === 'now' ? 6 : 14;
    } else this.key.intensity = 0;
    audio.playMusic(flashback ? trackForStation('koluszki') : TRACKS.menu);
    this.pose(id);
    this.dialogue.play(
      INTRO[this.index].lines,
      (skipped) => {
        if (skipped) this.finish();
        else this.nextShot();
      },
      (line) => {
        if (id === 'board' && line === CANCEL_LINE) this.board.cancelAll();
      },
    );
  }

  /** Who stands where, holding what, for each shot. */
  private pose(id: ShotId): void {
    this.piotrek.root.visible = id === 'board' || id === 'resolve';
    this.piotrek.root.position.set(5.3, 1, 26.2);
    this.piotrek.root.rotation.y = id === 'board' ? -Math.PI * 0.82 : Math.PI * 0.12;
    this.piotrek.setExpression(id === 'resolve' ? 'angry' : 'neutral');
    const b = this.bartek;
    b.root.visible = id === 'theft' || id === 'scrap' || id === 'coffee';
    b.chair.visible = false;
    b.props(false, false);
    this.rail.visible = id === 'theft' || id === 'scrap';
    this.king.visible = id === 'scrap';
    if (id === 'theft') {
      b.standUp(true);
      b.place(-6, 0.2, 19.6, Math.PI * 0.2);
      b.setFace('angry');
    } else if (id === 'scrap') {
      b.standUp(true);
      // Face to face over the deal, Bartek out in front of the scrap piles.
      b.place(-8.4, 0, 4.4, 1.0);
      b.setFace('smirk');
      this.king.position.set(-4.5, 0, 7.2);
      this.king.rotation.y = -2.1;
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
    this.renderer.domElement.classList.remove('is-flashback', 'is-dusk');
    leave(this.root);
    for (const w of this.worlds.values()) w.dispose(this.scene);
    this.worlds.clear();
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
    this.board.update(dt);
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
    // Reading the board: the head turns up to it.
    if (id === 'board') this.piotrek.joints.head.rotation.set(-0.25, -0.35, 0);
    this.bartek.update(dt, this.t, false);
    const j = this.bartek.character.joints;
    if (id === 'theft') {
      // Pulling a rail up off the sleepers, again and again: both hands on it, the rail in them.
      const lift = (Math.sin(this.t * 2.2) + 1) / 2;
      j.chest.rotation.x = 0.5 - lift * 0.45;
      j.shoulderL.rotation.set(-0.9 - lift * 1.3, 0, 0.25);
      j.shoulderR.rotation.set(-0.9 - lift * 1.3, 0, -0.25);
      j.elbowL.rotation.set(-0.35, 0, 0);
      j.elbowR.rotation.set(-0.35, 0, 0);
      this.holdRail(0);
    } else if (id === 'scrap') {
      // The rail on his shoulder, held by both hands.
      j.shoulderL.rotation.set(-2.3, 0, 0.35);
      j.shoulderR.rotation.set(-2.3, 0, -0.35);
      j.elbowL.rotation.set(-1.2, 0, 0);
      j.elbowR.rotation.set(-1.2, 0, 0);
      this.holdRail(0.12);
    } else if (id === 'coffee' && this.t - this.lastSip > 5) {
      this.lastSip = this.t;
      this.bartek.sip();
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** The rail sits in both hands (between the wrists), lying across his body. */
  private holdRail(lift: number): void {
    const j = this.bartek.character.joints;
    this.bartek.root.updateMatrixWorld(true);
    j.wristL.getWorldPosition(this.wristL);
    j.wristR.getWorldPosition(this.wristR);
    this.rail.position.addVectors(this.wristL, this.wristR).multiplyScalar(0.5);
    this.rail.position.y += lift;
    this.rail.rotation.set(0, Math.atan2(this.wristL.z - this.wristR.z, this.wristR.x - this.wristL.x), 0);
  }
}
