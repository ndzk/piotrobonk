// The hub as a small 3D scene: the forecourt of Łódź Fabryczna with Piotrek, the recyklomat, the display
// case and the station's big screen, on which the attract-mode bot plays a live run. Menus are DOM on top;
// this draws and animates the place behind them, and moves the camera to whatever the menu is about.

import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Frustum,
  Group,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderTarget,
  type Material,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { audio } from '../audio/audio';
import { Character } from '../characters/character';
import { PIOTREK } from '../content/characters';
import { HUB, HUB_LAYOUT, type HubView } from '../content/hub';
import { BOTTLES } from '../content/items';
import { KNIVES, isGloves, isKnife } from '../content/skins/catalog';
import { UI } from '../content/ui';
import { zl } from '../core/text';
import { enemyModel } from '../game/enemy-models';
import type { Gear } from '../game/gear';
import { World } from '../game/world';
import { cup as bartekCup } from '../game/bartek';
import { Kit } from '../render/kit';
import type { SkinLook } from '../render/skin-material';
import { frame, skinModel } from '../render/thumbs';
import { tinted } from '../render/tint';
import { toonRamp } from '../render/toon';

const DEMO_W = 960;
const DEMO_H = 540;

function canvasTexture(w: number, h: number): { tex: CanvasTexture; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return { tex, g };
}

const toon = (color: string): MeshToonMaterial => new MeshToonMaterial({ color, gradientMap: toonRamp() });

/** A deposit bottle: green glass body and a neck, merged with baked colours. */
function bottleGeometry(): ReturnType<typeof mergeGeometries> {
  return mergeGeometries([tinted(new CylinderGeometry(0.045, 0.045, 0.2, 8), '#5fbf73', 0, 0.1, 0), tinted(new CylinderGeometry(0.018, 0.04, 0.08, 8), '#5fbf73', 0, 0.24, 0), tinted(new CylinderGeometry(0.02, 0.02, 0.025, 8), '#d9d2c2', 0, 0.29, 0)]);
}

interface Flight {
  mesh: Mesh;
  t: number;
  delay: number;
  from: Vector3;
}

interface Pigeon {
  mesh: Group;
  /** Centre and radii of the patch of plaza this pigeon pecks around in. */
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  phase: number;
  x: number;
  z: number;
  yaw: number;
}

/** How long an inspect move takes, and how the item turns during it. */
type Move = 'spin' | 'flip' | 'twirl' | 'gun' | 'gloves';
const MOVE_TIME = 1.4;

export class HubScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(46, 1, 0.1, 140);
  readonly demoTarget = new WebGLRenderTarget(DEMO_W, DEMO_H);
  private readonly world: World;
  readonly piotrek = new Character(PIOTREK);
  readonly kit: Kit;
  private readonly screen: { tex: CanvasTexture; g: CanvasRenderingContext2D };
  private readonly slotRing: MeshBasicMaterial;
  private readonly slotAt = new Vector3();
  private readonly trayAt = new Vector3();
  private readonly flights: Flight[] = [];
  private readonly bottleGeo = bottleGeometry();
  private readonly bottleMat = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  private readonly caseStand = new Group();
  private readonly plinth: Mesh;
  private readonly trophy: Group;
  /** Bartek's porcelain cup, in the case once the line is finished. */
  private readonly filizanka = new Group();
  private standMats: Material[] = [];
  private readonly inspectRoot = new Group();
  private inspectMats: Material[] = [];
  private inspectMove: Move = 'gun';
  /** Drag rotation of the inspected item. */
  inspectYaw = 0;
  inspectPitch = 0;
  /** Seconds since the player last turned the item: the slow auto-turn waits while they hold it. */
  private sinceTurn = 99;
  private autoTurn = 0;
  private inspectSpin = 99;
  private readonly pigeons: Pigeon[] = [];
  private view: HubView = 'main';
  private readonly camPos = new Vector3();
  private readonly camTarget = new Vector3();
  private readonly wantPos = new Vector3();
  private readonly wantTarget = new Vector3();
  private readonly tvBox = new Box3();
  private readonly frustum = new Frustum();
  private readonly projScreen = new Matrix4();
  private time = 0;
  private bank = 0;
  private shown = 0;
  private screenNote = '';
  private noteTimer = 0;
  private depositStep = 0;
  private throwTime = 1;
  /** A case drops into the machine's tray when one is bought. */
  private readonly droppedCase: Mesh;
  private caseTime = 99;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private readonly renderer: WebGLRenderer) {
    this.world = new World(HUB, this.scene);
    this.demoTarget.texture.colorSpace = SRGBColorSpace;
    // Piotrek, facing the camera.
    this.scene.add(this.piotrek.root);
    this.kit = new Kit(this.piotrek);
    // The recyklomat.
    const r = new Group();
    const L = HUB_LAYOUT.recyklomat;
    r.position.set(...L.at);
    r.rotation.y = L.rot;
    const body = new Mesh(new BoxGeometry(1.1, 1.75, 0.75), toon('#e9ecef'));
    body.position.y = 0.875;
    const band = new Mesh(new BoxGeometry(1.12, 0.32, 0.77), toon('#1f8a4c'));
    band.position.y = 1.9;
    const panel = new Mesh(new BoxGeometry(0.9, 1.15, 0.04), toon('#2b2f36'));
    panel.position.set(0, 1.12, 0.38);
    this.screen = canvasTexture(512, 384);
    const screen = new Mesh(new BoxGeometry(0.66, 0.5, 0.01), new MeshBasicMaterial({ map: this.screen.tex }));
    screen.position.set(0, 1.4, 0.405);
    const slot = new Mesh(new CylinderGeometry(0.1, 0.1, 0.06, 16), toon('#0d0f12'));
    slot.rotation.x = Math.PI / 2;
    slot.position.set(0, 0.88, 0.41);
    this.slotRing = new MeshBasicMaterial({ color: '#3cff8c' });
    const ring = new Mesh(new TorusGeometry(0.11, 0.014, 6, 24), this.slotRing);
    ring.position.set(0, 0.88, 0.43);
    const logo = canvasTexture(512, 128);
    this.paintLogo(logo.g);
    logo.tex.needsUpdate = true;
    const sign = new Mesh(new BoxGeometry(1.0, 0.25, 0.01), new MeshBasicMaterial({ map: logo.tex }));
    sign.position.set(0, 1.9, 0.39);
    const tray = new Mesh(new BoxGeometry(0.56, 0.08, 0.26), toon('#3a3f48'));
    tray.position.set(0, 0.45, 0.47);
    // The CS case the machine hands out: orange shell with a dark band, lands in the tray.
    this.droppedCase = new Mesh(mergeGeometries([tinted(new BoxGeometry(0.36, 0.22, 0.14), '#d9822b'), tinted(new BoxGeometry(0.37, 0.05, 0.15), '#2b2f36', 0, 0.02, 0)]), new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
    this.droppedCase.visible = false;
    r.add(body, band, panel, screen, slot, ring, sign, tray, this.droppedCase);
    this.scene.add(r);
    r.updateMatrixWorld(true);
    ring.getWorldPosition(this.slotAt);
    tray.getWorldPosition(this.trayAt);
    // The display case: cabinet, framed glass with a lamp, the ★ knife on a turning stand, Piotrek's cup.
    const c = new Group();
    const G = HUB_LAYOUT.gablota;
    c.position.set(...G.at);
    c.rotation.y = G.rot;
    const wood = toon('#4a2f22');
    const cabinet = new Mesh(new BoxGeometry(1.0, 0.9, 0.62), wood);
    cabinet.position.y = 0.45;
    const glassMat = new MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.1, depthWrite: false });
    const glass = new Mesh(new BoxGeometry(0.94, 1.02, 0.56), glassMat);
    glass.position.y = 1.42;
    // A reflection streak across the front pane: it reads as glass, an empty frame would not.
    const streak = new Mesh(new PlaneGeometry(0.12, 1.1), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false }));
    streak.position.set(-0.18, 1.42, 0.285);
    streak.rotation.z = -0.5;
    const frameParts: Mesh[] = [];
    for (const [x, z] of [
      [-0.48, -0.29],
      [0.48, -0.29],
      [-0.48, 0.29],
      [0.48, 0.29],
    ] as const) {
      const post = new Mesh(new BoxGeometry(0.04, 1.06, 0.04), wood);
      post.position.set(x, 1.42, z);
      frameParts.push(post);
    }
    const lid = new Mesh(new BoxGeometry(1.02, 0.06, 0.64), wood);
    lid.position.y = 1.96;
    const light = new Mesh(new BoxGeometry(0.8, 0.02, 0.05), new MeshBasicMaterial({ color: '#ffe8b0' }));
    light.position.set(0, 1.92, 0.2);
    this.plinth = new Mesh(new CylinderGeometry(0.12, 0.15, 0.08, 14), toon('#1c1d22'));
    this.plinth.position.set(-0.12, 0.94, 0);
    this.caseStand.position.set(-0.12, 1.35, 0);
    this.trophy = this.makeTrophy();
    this.trophy.position.set(0, 0.9, -0.02);
    const lamp = new PointLight('#ffd9a0', 1.6, 2.4, 2);
    lamp.position.set(0, 1.8, 0.1);
    const china = bartekCup();
    china.saucer.position.y = 0.005;
    china.cup.position.y = 0.04;
    this.filizanka.add(china.saucer, china.cup);
    this.filizanka.scale.setScalar(1.5);
    this.filizanka.position.set(-0.32, 0.92, 0.08);
    this.filizanka.visible = false;
    c.add(cabinet, glass, streak, ...frameParts, lid, light, this.plinth, this.caseStand, this.trophy, this.filizanka, lamp);
    this.scene.add(c);
    // The station's big screen: the attract-mode run plays on it, live.
    const S = HUB_LAYOUT.screen;
    const sw = S.width;
    const sh = (sw * DEMO_H) / DEMO_W;
    const tv = new Group();
    tv.position.set(...S.at);
    const frameMesh = new Mesh(new BoxGeometry(sw + 0.35, sh + 0.35, 0.3), toon('#1c1f29'));
    frameMesh.position.y = sh / 2 + 0.3;
    const picture = new Mesh(new BoxGeometry(sw, sh, 0.02), new MeshBasicMaterial({ map: this.demoTarget.texture, toneMapped: false }));
    picture.position.set(0, sh / 2 + 0.3, 0.16);
    const label = canvasTexture(1024, 96);
    this.paintLabel(label.g);
    label.tex.needsUpdate = true;
    const labelMesh = new Mesh(new BoxGeometry(sw * 0.5, (sw * 0.5 * 96) / 1024, 0.02), new MeshBasicMaterial({ map: label.tex }));
    labelMesh.position.set(-sw * 0.25 + 0.1, sh + 0.62, 0.05);
    for (const x of [-sw * 0.3, sw * 0.3]) {
      const post = new Mesh(new BoxGeometry(0.3, S.at[1] + 0.3, 0.3), toon('#2c2633'));
      post.position.set(x, -(S.at[1] + 0.3) / 2 + 0.3, -0.1);
      tv.add(post);
    }
    tv.add(frameMesh, picture, labelMesh);
    this.scene.add(tv);
    tv.updateMatrixWorld(true);
    this.tvBox.setFromObject(picture);
    // Pigeons pecking their way round patches of the plaza, away from the camera.
    const model = enemyModel('golab');
    const pigeonMat = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
    for (const [cx, cz, rx, rz] of [
      [-2.6, 0.9, 0.8, 0.5],
      [3.4, 0.7, 0.7, 0.6],
      [-4.6, -1.4, 0.9, 0.7],
      [5.2, -2.2, 0.8, 0.6],
    ] as const) {
      const g = new Group();
      g.add(new Mesh(model.body, pigeonMat));
      if (model.wing) {
        const [wx, wy, wz] = model.wingOffset ?? [0.08, 0.42, -0.02];
        for (const s of [1, -1]) {
          const w = new Mesh(model.wing, pigeonMat);
          w.position.set(s * wx, wy, wz);
          w.scale.x = s;
          w.rotation.z = s * -0.15;
          g.add(w);
        }
      }
      g.scale.setScalar(0.85);
      this.scene.add(g);
      this.pigeons.push({ mesh: g, cx, cz, rx, rz, phase: cx * 3 + cz, x: cx, z: cz, yaw: 0 });
    }
    this.scene.add(this.inspectRoot);
    const v = HUB_LAYOUT.views.main;
    this.camPos.set(v.pos[0], v.pos[1], v.pos[2]);
    this.camTarget.set(v.target[0], v.target[1], v.target[2]);
    this.setView('main');
    this.paintScreen();
  }

  private get still(): boolean {
    return this.motion.matches;
  }

  /** Piotrek's runner-up cup from a CS tournament in Koluszki, the one thing always in the case. */
  private makeTrophy(): Group {
    const g = new Group();
    const gold = toon('#d9a93a');
    const cup = new Mesh(new CylinderGeometry(0.075, 0.04, 0.12, 12), gold);
    cup.position.y = 0.2;
    const stem = new Mesh(new CylinderGeometry(0.015, 0.02, 0.08, 8), gold);
    stem.position.y = 0.11;
    const base = new Mesh(new BoxGeometry(0.12, 0.06, 0.12), toon('#2a1e18'));
    base.position.y = 0.03;
    g.add(cup, stem, base);
    return g;
  }

  private paintLogo(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#1f8a4c';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#ffffff';
    g.font = '800 74px "Barlow Condensed", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(UI.hub.machine, 256, 68);
  }

  private paintLabel(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#0b0f24';
    g.fillRect(0, 0, 1024, 96);
    g.fillStyle = '#ff3b30';
    g.beginPath();
    g.arc(52, 48, 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffc83a';
    g.font = '800 60px "Barlow Condensed", sans-serif';
    g.textBaseline = 'middle';
    g.fillText(UI.hub.screen, 92, 52);
  }

  /** The recyklomat's display: the bank, its value, and a note after a deposit. */
  private paintScreen(): void {
    const g = this.screen.g;
    g.fillStyle = '#0c2a1a';
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#3cff8c';
    g.textAlign = 'center';
    g.font = '700 40px "Barlow Condensed", sans-serif';
    g.fillText(UI.hub.screenTitle, 256, 62);
    g.font = '800 120px "Barlow Condensed", sans-serif';
    g.fillText(String(Math.round(this.shown)), 256, 196);
    g.font = '700 44px "Barlow Condensed", sans-serif';
    g.fillText(zl(Math.round(this.shown) * BOTTLES.deposit), 256, 262);
    g.font = '600 34px "Barlow Condensed", sans-serif';
    g.fillStyle = '#b8ffd6';
    g.fillText(this.screenNote || UI.hub.screenIdle, 256, 340);
    this.screen.tex.needsUpdate = true;
  }

  /** The bank as the machine shows it right now (it counts up while bottles fly in). */
  get shownBank(): number {
    return Math.round(this.shown);
  }

  get depositing(): boolean {
    return this.flights.length > 0;
  }

  setBank(bottles: number): void {
    this.bank = bottles;
    if (!this.flights.length) this.shown = bottles;
    this.paintScreen();
  }

  /** Piotrek feed `count` bottles into the machine: they fly in one by one and the counter ticks up. */
  deposit(count: number, bankAfter: number): void {
    this.bank = bankAfter;
    this.shown = bankAfter - count;
    const visible = Math.min(24, count);
    this.depositStep = count / visible;
    const hand = new Vector3();
    for (let i = 0; i < visible; i++) {
      const mesh = new Mesh(this.bottleGeo, this.bottleMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.piotrek.joints.wristR.getWorldPosition(hand);
      this.flights.push({ mesh, t: 0, delay: 0.25 + i * (this.still ? 0.02 : 0.11), from: hand.clone() });
    }
    this.paintScreen();
  }

  /** A bought case slides out of the machine into its tray. */
  dropCase(): void {
    this.caseTime = 0;
    this.droppedCase.visible = true;
  }

  setGear(gear: Gear): void {
    this.kit.apply(gear);
    this.kit.showGun(gear.gun !== null);
    // The ★ knife also stands in the display case; without one the cup takes the middle.
    this.caseStand.clear();
    for (const m of this.standMats) m.dispose();
    this.standMats = [];
    const knife = gear.knife;
    if (knife) {
      const { root, materials } = skinModel(knife.weapon, knife.look);
      frame(root, 0.42, 0.42);
      this.caseStand.add(root);
      this.standMats = materials;
    }
    this.plinth.visible = knife !== null;
    this.trophy.position.x = knife ? 0.3 : 0;
  }

  /** What stands in the display case besides the knife: Bartek's cup once the line is finished. */
  setTrophies(trophies: readonly string[]): void {
    this.filizanka.visible = trophies.includes('filizanka');
  }

  /** Shows one skin big, floating beside Piotrek, for the inventory's inspect (null hides it). */
  inspect(weapon: string | null, look: SkinLook | null): void {
    this.inspectRoot.clear();
    for (const m of this.inspectMats) m.dispose();
    this.inspectMats = [];
    if (!weapon) return;
    const { root, materials } = skinModel(weapon, look);
    const sizeOf = isGloves(weapon) ? 0.34 : isKnife(weapon) ? 0.44 : 0.62;
    frame(root, sizeOf, sizeOf);
    this.inspectRoot.add(root);
    this.inspectMats = materials;
    this.inspectYaw = -0.5;
    this.inspectPitch = 0.15;
    this.autoTurn = 0;
    this.inspectMove = isKnife(weapon) ? (KNIVES[weapon] as (typeof KNIVES)[string] | undefined)?.inspect ?? 'spin' : isGloves(weapon) ? 'gloves' : 'gun';
    this.inspectSpin = 0;
  }

  /** Plays the item's inspect move again (the inventory's "Inspekt" button). */
  replayInspect(): void {
    this.inspectSpin = 0;
  }

  /** The player turned the item (drag or right stick). */
  turnInspect(dx: number, dy: number): void {
    this.inspectYaw += dx;
    this.inspectPitch = Math.max(-1.2, Math.min(1.2, this.inspectPitch + dy));
    this.sinceTurn = 0;
  }

  setView(view: HubView): void {
    this.view = view;
    const v = HUB_LAYOUT.views[view];
    this.wantPos.set(v.pos[0], v.pos[1], v.pos[2]);
    this.wantTarget.set(v.target[0], v.target[1], v.target[2]);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    // Narrow screens: pull back so the recyklomat and the case still fit.
    this.camera.fov = w / h < 1.2 ? 62 : 46;
    this.camera.updateProjectionMatrix();
  }

  /** True when the big screen is in the camera's view (the demo is not worth drawing otherwise). */
  get screenInView(): boolean {
    this.camera.updateMatrixWorld();
    this.projScreen.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    return this.frustum.intersectsBox(this.tvBox);
  }

  frame(dt: number): void {
    this.time += dt;
    const t = this.time;
    // Camera glides to the menu's framing, with a slow breathing drift.
    const k = 1 - Math.exp(-dt * 3.2);
    this.camPos.lerp(this.wantPos, k);
    this.camTarget.lerp(this.wantTarget, k);
    const drift = this.still ? 0 : 1;
    this.camera.position.set(this.camPos.x + Math.sin(t * 0.21) * 0.06 * drift, this.camPos.y + Math.sin(t * 0.33) * 0.03 * drift, this.camPos.z);
    this.camera.lookAt(this.camTarget);
    this.world.sky.position.copy(this.camera.position);
    this.animatePiotrek(dt, t);
    this.animateBottles(dt);
    this.animateCase(dt);
    if (this.noteTimer > 0) {
      this.noteTimer -= dt;
      if (this.noteTimer <= 0) {
        this.screenNote = '';
        this.paintScreen();
      }
    }
    this.slotRing.color.setHSL(0.4, 1, 0.45 + 0.15 * Math.sin(t * (this.flights.length ? 14 : 3)));
    // The knife in the case turns slowly on its stand.
    this.caseStand.rotation.y = t * 0.6;
    this.animateInspect(dt, t);
    this.animatePigeons(t);
    this.renderer.render(this.scene, this.camera);
  }

  /** Breathing, a look at whatever the menu is about, a throw for every bottle, a knife flourish. */
  private animatePiotrek(dt: number, t: number): void {
    this.piotrek.idle(t);
    const j = this.piotrek.joints;
    j.head.rotation.y = Math.sin(t * 0.4) * 0.25 + (this.view === 'recyklomat' ? -0.45 : this.view === 'inventory' ? 0.3 : 0);
    if (this.kit.gun.visible) {
      // Low ready: the gun held across the body, pointing at the ground ahead, so the skin is on show.
      j.shoulderL.rotation.set(-0.45, 0.3, 0.3);
      j.elbowL.rotation.set(-0.95, 0, 0);
      j.wristL.rotation.set(0.7, 0, -0.3);
    }
    this.throwTime += dt;
    if (this.throwTime < 0.35) {
      const e = Math.sin((this.throwTime / 0.35) * Math.PI);
      j.shoulderR.rotation.set(-1.2 * e, 0, -0.6 * e - 0.13);
      j.elbowR.rotation.set(-0.6 * e, 0, 0);
    }
    const flip = (t % 7) / 7;
    const flourish = this.kit.knifeHolder.children.length > 0 && !this.still && flip > 0.86;
    this.kit.knifeHolder.rotation.set(0, flourish ? ((flip - 0.86) / 0.14) * Math.PI * 2 : 0, 0);
  }

  private animateBottles(dt: number): void {
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.delay -= dt;
      if (f.delay > 0) continue;
      if (f.t === 0) this.throwTime = 0;
      f.t = Math.min(1, f.t + dt / 0.5);
      const m = f.mesh;
      m.visible = true;
      m.position.lerpVectors(f.from, this.slotAt, f.t);
      m.position.y += Math.sin(f.t * Math.PI) * 0.7;
      m.rotation.set(f.t * 9, 0, f.t * 4);
      if (f.t < 1) continue;
      this.scene.remove(m);
      this.flights.splice(i, 1);
      audio.play('deposit', 0.8, 0.9 + Math.random() * 0.2);
      this.shown = Math.min(this.bank, this.shown + this.depositStep);
      if (!this.flights.length) {
        this.shown = this.bank;
        audio.play('sell');
      }
      this.paintScreen();
    }
  }

  private animateCase(dt: number): void {
    if (this.caseTime > 3) {
      this.droppedCase.visible = false;
      return;
    }
    this.caseTime += dt;
    // Slides out of the machine, drops, bounces once, then the shop takes it away.
    const p = Math.min(1, this.caseTime / 0.45);
    const bounce = p < 1 ? (1 - p) * (1 - p) * 0.25 : Math.max(0, Math.sin((this.caseTime - 0.45) * 12)) * 0.03 * Math.max(0, 1 - (this.caseTime - 0.45) * 2);
    this.droppedCase.position.set(0, 0.6 + bounce, 0.3 + p * 0.17);
    this.droppedCase.rotation.set(-0.15 * (1 - p), 0, 0);
    this.droppedCase.visible = this.caseTime < 2.6 || Math.floor(this.caseTime * 12) % 2 === 0;
  }

  private animateInspect(dt: number, t: number): void {
    if (!this.inspectRoot.children.length) return;
    const [ix, iy, iz] = HUB_LAYOUT.inspect;
    this.inspectRoot.position.set(ix, iy + Math.sin(t * 1.4) * 0.015, iz);
    this.sinceTurn += dt;
    if (this.sinceTurn > 2 && !this.still) this.autoTurn += dt * 0.25;
    this.inspectSpin += dt;
    // The inspect move: knives flip, spin or twirl; guns turn to show the other side; gloves turn round.
    let yaw = 0;
    let pitch = 0;
    let roll = 0;
    if (this.inspectSpin < MOVE_TIME) {
      const p = this.inspectSpin / MOVE_TIME;
      const e = p * p * (3 - 2 * p);
      if (this.inspectMove === 'flip') pitch = Math.PI * 2 * e;
      else if (this.inspectMove === 'twirl') roll = Math.PI * 2 * e;
      else if (this.inspectMove === 'spin') yaw = Math.PI * 4 * e;
      else if (this.inspectMove === 'gun') {
        yaw = Math.PI * 2 * e;
        pitch = Math.sin(p * Math.PI) * 0.6;
      } else yaw = Math.PI * 2 * e;
    }
    this.inspectRoot.rotation.set(this.inspectPitch + pitch, this.inspectYaw + this.autoTurn + yaw, roll);
  }

  /** Pigeons walk a loop round their patch, facing where they go, and stop now and then to peck. */
  private animatePigeons(t: number): void {
    for (const p of this.pigeons) {
      const pause = Math.sin(t * 0.7 + p.phase) > 0.35;
      if (!pause) {
        const a = t * 0.35 + p.phase;
        const nx = p.cx + Math.sin(a) * p.rx;
        const nz = p.cz + Math.cos(a * 0.8) * p.rz;
        const dx = nx - p.x;
        const dz = nz - p.z;
        if (dx * dx + dz * dz > 1e-8) p.yaw = Math.atan2(dx, dz);
        p.x = nx;
        p.z = nz;
      }
      const peck = pause ? Math.max(0, Math.sin(t * 6 + p.phase)) ** 4 : 0;
      const hop = pause ? 0 : Math.abs(Math.sin(t * 11 + p.phase)) * 0.025;
      p.mesh.position.set(p.x, hop, p.z);
      p.mesh.rotation.set(peck * 0.5, p.yaw, 0);
    }
  }

  /** Puts a short note on the recyklomat's display ("Sprzedano za 16 butelek"). */
  note(text: string): void {
    this.screenNote = text;
    this.noteTimer = 3.5;
    this.paintScreen();
  }

  /**
   * Every shader and texture of the hub, compiled and uploaded before it is first shown: hidden things
   * (the gun, the case in the tray) are shown for the pass, because compile() skips what is invisible.
   */
  warmup(): void {
    const hidden: Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) hidden.push(o);
      o.visible = true;
    });
    this.renderer.compile(this.scene, this.camera);
    for (const o of hidden) o.visible = false;
    for (const tex of this.piotrek.textures()) this.renderer.initTexture(tex);
  }
}
