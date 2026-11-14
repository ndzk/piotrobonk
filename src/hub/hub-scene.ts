// The hub as a small 3D scene: the forecourt of Łódź Fabryczna with Piotrek, the recyklomat, the display
// case and the station's big screen, on which the attract-mode bot plays a live run. Menus are DOM on top;
// this draws and animates the place behind them, and moves the camera to whatever the menu is about.

import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
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
import { KNIVES, isKnife } from '../content/skins/catalog';
import { UI } from '../content/ui';
import { num } from '../core/text';
import type { Gear } from '../game/gear';
import { World } from '../game/world';
import { Kit } from '../render/kit';
import { tinted } from '../render/tint';
import { toonRamp } from '../render/toon';
import { frame, skinModel } from '../render/thumbs';
import type { SkinLook } from '../render/skin-material';
import { enemyModel } from '../game/enemy-models';

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
  private readonly flights: Flight[] = [];
  private readonly bottleGeo = bottleGeometry();
  private readonly bottleMat = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
  private readonly caseStand = new Group();
  private standItem: Object3D | null = null;
  private standMats: Material[] = [];
  private readonly inspectRoot = new Group();
  private inspectMats: Material[] = [];
  private inspectKnife: string | null = null;
  /** Drag rotation of the inspected item. */
  inspectYaw = 0;
  inspectPitch = 0;
  private readonly pigeons: { mesh: Group; phase: number; x: number; z: number; dir: number }[] = [];
  private view: HubView = 'main';
  private readonly camPos = new Vector3();
  private readonly camTarget = new Vector3();
  private readonly wantPos = new Vector3();
  private readonly wantTarget = new Vector3();
  private time = 0;
  private bank = 0;
  private shownBank = -1;
  private screenNote = '';
  private noteTimer = 0;
  private depositLeft = 0;
  private depositStep = 0;
  private throwTime = 1;
  private inspectSpin = 99;
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const tray = new Mesh(new BoxGeometry(0.5, 0.08, 0.2), toon('#3a3f48'));
    tray.position.set(0, 0.45, 0.45);
    r.add(body, band, panel, screen, slot, ring, sign, tray);
    this.scene.add(r);
    r.updateMatrixWorld(true);
    ring.getWorldPosition(this.slotAt);
    // The display case: a cabinet, a glass box and a lit stand for the ★ knife.
    const c = new Group();
    const G = HUB_LAYOUT.gablota;
    c.position.set(...G.at);
    c.rotation.y = G.rot;
    const cabinet = new Mesh(new BoxGeometry(1.0, 0.9, 0.62), toon('#4a2f22'));
    cabinet.position.y = 0.45;
    const glass = new Mesh(new BoxGeometry(0.96, 1.05, 0.58), new MeshLambertMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.16, depthWrite: false }));
    glass.position.y = 1.43;
    const lid = new Mesh(new BoxGeometry(1.02, 0.06, 0.64), toon('#4a2f22'));
    lid.position.y = 1.98;
    const light = new Mesh(new BoxGeometry(0.8, 0.02, 0.05), new MeshBasicMaterial({ color: '#ffe8b0' }));
    light.position.set(0, 1.94, 0.2);
    const plinth = new Mesh(new CylinderGeometry(0.12, 0.15, 0.08, 14), toon('#1c1d22'));
    plinth.position.set(0, 0.94, 0);
    this.caseStand.position.set(0, 1.35, 0);
    const trophy = this.trophy();
    trophy.position.set(0.32, 0.9, -0.12);
    const lamp = new PointLight('#ffd9a0', 1.6, 2.4, 2);
    lamp.position.set(0, 1.8, 0.1);
    c.add(cabinet, glass, lid, light, plinth, this.caseStand, trophy, lamp);
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
    // Pigeons pecking around the plaza.
    const model = enemyModel('golab');
    const pigeonMat = new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
    for (const [x, z, dir] of [
      [-1.6, 2.2, 0.6],
      [1.4, 3.0, -2.4],
      [-4.4, 0.6, 2.1],
      [4.8, -0.5, -1.2],
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
      this.pigeons.push({ mesh: g, phase: x * 3 + z, x, z, dir });
    }
    this.scene.add(this.inspectRoot);
    const v = HUB_LAYOUT.views.main;
    this.camPos.set(v.pos[0], v.pos[1], v.pos[2]);
    this.camTarget.set(v.target[0], v.target[1], v.target[2]);
    this.setView('main');
    this.paintScreen();
  }

  /** Piotrek's runner-up cup from a CS tournament in Koluszki, the one thing always in the case. */
  private trophy(): Group {
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
    g.fillText(String(Math.round(this.shownBank)), 256, 196);
    g.font = '700 44px "Barlow Condensed", sans-serif';
    g.fillText(`${num(Math.round(this.shownBank) * BOTTLES.deposit, 2)} zł`, 256, 262);
    g.font = '600 34px "Barlow Condensed", sans-serif';
    g.fillStyle = '#b8ffd6';
    g.fillText(this.screenNote || UI.hub.screenIdle, 256, 340);
    this.screen.tex.needsUpdate = true;
  }

  setBank(bottles: number): void {
    this.bank = bottles;
    if (this.depositLeft === 0 && this.flights.length === 0) this.shownBank = bottles;
    this.paintScreen();
  }

  /** Piotrek feed `count` bottles into the machine: they fly in one by one and the counter ticks up. */
  deposit(count: number, bankAfter: number): void {
    this.bank = bankAfter;
    this.shownBank = bankAfter - count;
    const visible = Math.min(24, count);
    this.depositLeft = count;
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

  setGear(gear: Gear): void {
    this.kit.apply(gear);
    this.kit.showGun(gear.gun !== null);
    // The ★ knife also stands in the display case.
    this.caseStand.clear();
    for (const m of this.standMats) m.dispose();
    this.standMats = [];
    this.standItem = null;
    if (gear.knife) {
      const { root, materials } = skinModel(gear.knife.weapon, gear.knife.look);
      frame(root, 0.42, 0.42);
      this.caseStand.add(root);
      this.standItem = root;
      this.standMats = materials;
    }
    this.renderer.compile(this.scene, this.camera);
  }

  /** Shows one skin big, floating next to Piotrek, for the inventory's inspect (null hides it). */
  inspect(weapon: string | null, look: SkinLook | null): void {
    this.inspectRoot.clear();
    for (const m of this.inspectMats) m.dispose();
    this.inspectMats = [];
    this.inspectKnife = null;
    if (!weapon) return;
    const { root, materials } = skinModel(weapon, look);
    frame(root, 0.62, 0.62);
    this.inspectRoot.add(root);
    this.inspectMats = materials;
    this.inspectYaw = -0.5;
    this.inspectPitch = 0.15;
    if (isKnife(weapon)) {
      this.inspectKnife = weapon;
      this.inspectSpin = 0;
    }
  }

  /** Plays the knife's inspect move again (the inventory's "Inspekt" button). */
  replayInspect(): void {
    this.inspectSpin = 0;
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
    // Piotrek idle: breathing, a look around, a throw for every bottle, a knife flip now and then.
    this.piotrek.idle(t);
    const j = this.piotrek.joints;
    j.head.rotation.y = Math.sin(t * 0.4) * 0.25 + (this.view === 'recyklomat' ? -0.45 : this.view === 'inventory' ? 0.3 : 0);
    if (this.kit.gun.visible) {
      j.shoulderL.rotation.set(-0.35, 0, 0.25);
      j.elbowL.rotation.set(-0.9, 0, 0);
    }
    this.throwTime += dt;
    if (this.throwTime < 0.35) {
      const e = Math.sin((this.throwTime / 0.35) * Math.PI);
      j.shoulderR.rotation.set(-1.2 * e, 0, -0.6 * e - 0.13);
      j.elbowR.rotation.set(-0.6 * e, 0, 0);
    }
    const flip = (t % 7) / 7;
    const knifeIdle = this.kit.knifeHolder.children.length > 0 && !this.still && flip > 0.86;
    this.kit.knifeHolder.rotation.set(0, knifeIdle ? ((flip - 0.86) / 0.14) * Math.PI * 2 : 0, 0);
    // Bottles flying into the slot.
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
      if (f.t >= 1) {
        this.scene.remove(m);
        this.flights.splice(i, 1);
        audio.play('deposit', 0.8, 0.9 + Math.random() * 0.2);
        this.shownBank = Math.min(this.bank, this.shownBank + this.depositStep);
        this.depositLeft = Math.max(0, this.depositLeft - this.depositStep);
        if (this.flights.length === 0) {
          this.shownBank = this.bank;
          this.depositLeft = 0;
          audio.play('sell');
        }
        this.paintScreen();
      }
    }
    if (this.noteTimer > 0) {
      this.noteTimer -= dt;
      if (this.noteTimer <= 0) {
        this.screenNote = '';
        this.paintScreen();
      }
    }
    if (this.shownBank !== this.bank && this.flights.length === 0 && this.depositLeft === 0) {
      this.shownBank = this.bank;
      this.paintScreen();
    }
    this.slotRing.color.setHSL(0.4, 1, 0.45 + 0.15 * Math.sin(t * (this.flights.length ? 14 : 3)));
    // The knife in the case turns slowly on its stand.
    if (this.standItem) this.caseStand.rotation.y = t * 0.6;
    // Inspect: the item floats beside Piotrek; knives play their inspect move.
    if (this.inspectRoot.children.length) {
      const [ix, iy, iz] = HUB_LAYOUT.inspect;
      this.inspectRoot.position.set(ix, iy + Math.sin(t * 1.4) * 0.015, iz);
      this.inspectSpin += dt;
      let extra = 0;
      if (this.inspectKnife && this.inspectSpin < 1.4) {
        const p = this.inspectSpin / 1.4;
        const ease = p * p * (3 - 2 * p);
        extra = (this.knifeFlips() ? 1 : 2) * Math.PI * 2 * ease;
      }
      const flips = this.knifeFlips();
      this.inspectRoot.rotation.set(this.inspectPitch + (flips ? extra : 0), this.inspectYaw + (this.still ? 0 : t * 0.25) + (flips ? 0 : extra), 0);
    }
    for (const p of this.pigeons) {
      const peck = Math.max(0, Math.sin(t * 2.2 + p.phase)) ** 6;
      p.mesh.position.set(p.x + Math.sin(t * 0.15 + p.phase) * 0.6, 0, p.z + Math.cos(t * 0.12 + p.phase) * 0.4);
      p.mesh.rotation.set(peck * 0.5, p.dir + Math.sin(t * 0.3 + p.phase) * 0.8, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** True when the inspected knife's move is a flip (end over end) rather than a spin. */
  private knifeFlips(): boolean {
    return this.inspectKnife !== null && (KNIVES[this.inspectKnife] as (typeof KNIVES)[string] | undefined)?.inspect === 'flip';
  }

  /** Puts a short note on the recyklomat's display ("Sprzedano za 16 butelek"). */
  note(text: string): void {
    this.screenNote = text;
    this.noteTimer = 3.5;
    this.paintScreen();
  }

  /** Every shader and texture of the hub, compiled and uploaded before it is first shown. */
  warmup(): void {
    this.renderer.compile(this.scene, this.camera);
    for (const tex of this.piotrek.textures()) this.renderer.initTexture(tex);
  }

}
