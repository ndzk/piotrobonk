// Inventory and roulette pictures of skins: each model is rendered once into a small render target, read
// back asynchronously (no GPU stall, no console warning) and kept as a PNG data URL for <img> tags.

import { Box3, DirectionalLight, Group, HemisphereLight, OrthographicCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderTarget, type Material, type Object3D, type WebGLRenderer } from 'three';
import { precompile } from './precompile';
import { readPixelsAsync } from './readback';
import { isGloves, isKnife } from '../content/skins/catalog';
import { buildGlove, buildGun, buildKnife, csProbes, gloveShape, gunMaterials } from './cs-models';
import { skinMaterial, type SkinLook } from './skin-material';

const W = 384;
const H = 240;

/** The model a skin is shown on: its gun, its knife, or a pair of its gloves. Returns the materials to free. */
export function skinModel(weapon: string, look: SkinLook | null): { root: Object3D; materials: Material[] } {
  const root = new Group();
  if (isKnife(weapon)) {
    const blade = skinMaterial(look, 0, 14);
    const handle = skinMaterial(look, 1, 14);
    const knife = buildKnife(weapon, blade, handle);
    // Lying on its side, blade to the right, like the CS inventory shows it.
    knife.rotation.set(0, 0, Math.PI / 2);
    root.add(knife);
    return { root, materials: [blade, handle] };
  }
  if (isGloves(weapon)) {
    const mat = skinMaterial(look, 0, 26, true);
    const shape = gloveShape(weapon);
    for (const side of [1, -1] as const) {
      const g = buildGlove(mat, shape, side);
      g.rotation.set(-0.3, side * 0.5, side * 0.35 + Math.PI);
      g.position.set(side * 0.07, 0, 0);
      root.add(g);
    }
    return { root, materials: [mat] };
  }
  const mats = gunMaterials(look);
  const gun = buildGun(weapon, mats);
  // Side view, barrel to the right.
  gun.rotation.y = Math.PI / 2;
  root.add(gun);
  return { root, materials: [mats.body, mats.detail, mats.barrel] };
}

/** Centres a model on the origin and scales it to fit a w × h frame (orthographic units). */
export function frame(root: Object3D, w: number, h: number): void {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const k = Math.min(w / Math.max(size.x, 1e-3), h / Math.max(size.y, 1e-3)) * 0.86;
  root.scale.multiplyScalar(k);
  root.position.sub(centre.multiplyScalar(k));
}

/** A picture size: lists and the roulette at 1.5× their CSS size, the reveal card big. */
interface Size {
  w: number;
  h: number;
  target: WebGLRenderTarget;
  pixels: Uint8Array;
  canvas: HTMLCanvasElement;
}

function size(w: number, h: number): Size {
  const target = new WebGLRenderTarget(w, h);
  target.texture.colorSpace = SRGBColorSpace;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { w, h, target, pixels: new Uint8Array(w * h * 4), canvas };
}

/** Pictures kept at most; the oldest unused ones are dropped (each is tens of kilobytes of data URL). */
const KEEP = 320;

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });

export class Thumbs {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-W / H, W / H, 1, -1, -10, 10);
  private readonly small = size(W, H);
  private readonly big = size(W * 2, H * 2);
  private readonly done = new Map<string, string>();
  private readonly waiting = new Map<string, Promise<string>>();
  /** One render per frame: the render targets are shared, and a list of 60 cold tiles must not stall a frame. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly renderer: WebGLRenderer) {
    this.scene.add(new HemisphereLight('#ffffff', '#5a5f70', 2.2));
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(1, 2, 3);
    this.scene.add(key);
    // The programs for these lights and this target, compiled now in parallel on the GPU. The skin probe is
    // never disposed: every picture disposes its own materials, and without a material left on the program
    // three.js deleted it and the next picture compiled it again (the Recyklomat stalled for seconds).
    const probes = csProbes();
    this.scene.add(...probes);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.small.target);
    const compiled = precompile(renderer, this.scene, this.camera);
    renderer.setRenderTarget(prev);
    this.scene.remove(...probes);
    // Then one real picture each of a gun, a knife and gloves, thrown away: the driver finishes part of a
    // shader at its first draw with each vertex layout, and sets up its copy path at the first read-back
    // (together 0.3 s under the first picture in the Recyklomat). Here it happens while the title is up.
    this.chain = compiled
      .then(async () => {
        for (const weapon of ['awp', 'knife_karambit', 'motorcycle_gloves']) {
          await nextFrame();
          await this.draw(weapon, null, this.small);
        }
      })
      .catch(() => undefined);
  }

  /** Cached picture (or null if it is still being drawn). */
  peek(key: string): string | null {
    const hit = this.done.get(key);
    if (hit) {
      // Most recently used goes to the back of the eviction queue.
      this.done.delete(key);
      this.done.set(key, hit);
    }
    return hit ?? null;
  }

  /** A PNG data URL of `weapon` in `look`, drawn once per key. `large` for the reveal card. */
  get(key: string, weapon: string, look: SkinLook | null, large = false): Promise<string> {
    const hit = this.peek(key);
    if (hit) return Promise.resolve(hit);
    const pending = this.waiting.get(key);
    if (pending) return pending;
    const job = this.chain
      .then(nextFrame)
      .then(() => this.draw(weapon, look, large ? this.big : this.small))
      .then((url) => {
        this.done.set(key, url);
        this.waiting.delete(key);
        while (this.done.size > KEEP) {
          const oldest = this.done.keys().next().value;
          if (oldest === undefined) break;
          this.done.delete(oldest);
        }
        return url;
      });
    this.chain = job.catch(() => undefined);
    this.waiting.set(key, job);
    return job;
  }

  private async draw(weapon: string, look: SkinLook | null, s: Size): Promise<string> {
    const { root, materials } = skinModel(weapon, look);
    frame(root, (2 * W) / H, 2);
    this.scene.add(root);
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const clear = r.getClearAlpha();
    r.setClearAlpha(0);
    r.setRenderTarget(s.target);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(prev);
    r.setClearAlpha(clear);
    this.scene.remove(root);
    await readPixelsAsync(r, s.target, s.pixels);
    for (const m of materials) m.dispose();
    const g = s.canvas.getContext('2d');
    if (!g) return '';
    const img = g.createImageData(s.w, s.h);
    // WebGL rows start at the bottom.
    const row = s.w * 4;
    for (let y = 0; y < s.h; y++) img.data.set(s.pixels.subarray((s.h - 1 - y) * row, (s.h - y) * row), y * row);
    g.putImageData(img, 0, 0);
    return s.canvas.toDataURL('image/png');
  }
}
