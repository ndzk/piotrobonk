// Dialogue portraits in the game's own style: Piotrek's and Bartek's heads rendered with the face of the
// moment (neutral, angry, smirk, butthurt), and the bosses who speak (the megaphone, the scrap king) from
// their models. Rendered once per face at twice the size and scaled down (smooth hair and beard edges, no
// MSAA needed), read back asynchronously, kept as data URLs.

import { Box3, DirectionalLight, HemisphereLight, Mesh, MeshToonMaterial, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderTarget, type Object3D, type WebGLRenderer } from 'three';
import { readPixelsAsync } from './readback';
import { Character } from '../characters/character';
import { BARTEK, PIOTREK, type Expression } from '../content/characters';
import type { Speaker } from '../content/dialogs';
import { enemyModel } from '../game/enemy-models';
import { toonRamp } from './toon';

/** Size of the stored portrait; it is rendered at twice this. The video call shows it at up to ~330 CSS px. */
const SIZE = 384;
const RENDER = SIZE * 2;

export class Portraits {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(24, 1, 0.05, 50);
  private readonly target = new WebGLRenderTarget(RENDER, RENDER);
  private readonly pixels = new Uint8Array(RENDER * RENDER * 4);
  private readonly big = document.createElement('canvas');
  private readonly canvas = document.createElement('canvas');
  private readonly cache = new Map<string, Promise<string>>();
  private readonly people = new Map<Speaker, Character>();
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly renderer: WebGLRenderer) {
    this.target.texture.colorSpace = SRGBColorSpace;
    this.scene.add(new HemisphereLight('#fff1e0', '#3a3550', 2.4));
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(1.5, 2, 3);
    this.scene.add(key);
    this.big.width = this.big.height = RENDER;
    this.canvas.width = this.canvas.height = SIZE;
  }

  /** The portrait of `speaker` with `face` (bosses have just the one). */
  get(speaker: Speaker, face: Expression = 'neutral'): Promise<string> {
    const key = `${speaker}:${speaker === 'piotrek' || speaker === 'bartek' ? face : ''}`;
    let job = this.cache.get(key);
    if (!job) {
      job = this.chain.then(() => this.draw(speaker, face));
      this.chain = job.catch(() => undefined);
      this.cache.set(key, job);
    }
    return job;
  }

  private subject(speaker: Speaker, face: Expression): { root: Object3D; focus: Vector3; distance: number } {
    if (speaker === 'piotrek' || speaker === 'bartek') {
      let c = this.people.get(speaker);
      if (!c) {
        c = new Character(speaker === 'piotrek' ? PIOTREK : BARTEK);
        this.people.set(speaker, c);
      }
      c.idle(0);
      c.setExpression(face);
      c.root.updateMatrixWorld(true);
      const focus = c.joints.head.getWorldPosition(new Vector3());
      // Head and hair in the frame with a little air above: the hair rises well over the skull.
      focus.y += 0.11;
      return { root: c.root, focus, distance: 1.12 };
    }
    // The bosses who talk: their own model, framed on the top part.
    const model = enemyModel(speaker === 'megafon' ? 'megafon' : 'krol-zlomu');
    const mesh = new Mesh(model.body, new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
    const box = new Box3().setFromObject(mesh);
    const size = box.getSize(new Vector3());
    const focus = new Vector3((box.min.x + box.max.x) / 2, box.max.y - size.y * 0.25, (box.min.z + box.max.z) / 2);
    return { root: mesh, focus, distance: Math.max(size.x, size.y * 0.5) * 2.4 };
  }

  private async draw(speaker: Speaker, face: Expression): Promise<string> {
    const { root, focus, distance } = this.subject(speaker, face);
    this.scene.add(root);
    // Three-quarter view from slightly above, the way a video call frames a face.
    this.camera.position.set(focus.x + distance * 0.28, focus.y + distance * 0.06, focus.z + distance);
    this.camera.lookAt(focus);
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const clear = r.getClearAlpha();
    r.setClearAlpha(0);
    r.setRenderTarget(this.target);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(prev);
    r.setClearAlpha(clear);
    this.scene.remove(root);
    await readPixelsAsync(r, this.target, this.pixels);
    const big = this.big.getContext('2d');
    const g = this.canvas.getContext('2d');
    if (!big || !g) return '';
    const img = big.createImageData(RENDER, RENDER);
    const row = RENDER * 4;
    for (let y = 0; y < RENDER; y++) img.data.set(this.pixels.subarray((RENDER - 1 - y) * row, (RENDER - y) * row), y * row);
    big.putImageData(img, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.big, 0, 0, SIZE, SIZE);
    return this.canvas.toDataURL('image/png');
  }
}
