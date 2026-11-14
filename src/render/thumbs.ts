// Inventory and roulette pictures of skins: each model is rendered once into a small render target, read
// back asynchronously (no GPU stall, no console warning) and kept as a PNG data URL for <img> tags.

import { Box3, DirectionalLight, Group, HemisphereLight, OrthographicCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderTarget, type Material, type Object3D, type WebGLRenderer } from 'three';
import { isGloves, isKnife } from '../content/skins/catalog';
import { buildGlove, buildGun, buildKnife, gloveShape, gunMaterials } from './cs-models';
import { skinMaterial, type SkinLook } from './skin-material';

const W = 256;
const H = 160;

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
    const mat = skinMaterial(look, 0, 26);
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

export class Thumbs {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-W / H, W / H, 1, -1, -10, 10);
  private readonly target = new WebGLRenderTarget(W, H);
  private readonly done = new Map<string, string>();
  private readonly waiting = new Map<string, Promise<string>>();
  /** One render at a time: the render target is shared. */
  private chain: Promise<unknown> = Promise.resolve();
  private readonly canvas = document.createElement('canvas');
  private readonly pixels = new Uint8Array(W * H * 4);

  constructor(private readonly renderer: WebGLRenderer) {
    this.target.texture.colorSpace = SRGBColorSpace;
    this.scene.add(new HemisphereLight('#ffffff', '#5a5f70', 2.2));
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(1, 2, 3);
    this.scene.add(key);
    this.canvas.width = W;
    this.canvas.height = H;
  }

  /** Cached picture (or null if it is still being drawn). */
  peek(key: string): string | null {
    return this.done.get(key) ?? null;
  }

  /** A PNG data URL of `weapon` in `look`, drawn once per key. */
  get(key: string, weapon: string, look: SkinLook | null): Promise<string> {
    const hit = this.done.get(key);
    if (hit) return Promise.resolve(hit);
    const pending = this.waiting.get(key);
    if (pending) return pending;
    const job = this.chain.then(() => this.draw(weapon, look)).then((url) => {
      this.done.set(key, url);
      this.waiting.delete(key);
      return url;
    });
    this.chain = job.catch(() => undefined);
    this.waiting.set(key, job);
    return job;
  }

  private async draw(weapon: string, look: SkinLook | null): Promise<string> {
    const { root, materials } = skinModel(weapon, look);
    frame(root, (2 * W) / H, 2);
    this.scene.add(root);
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
    await r.readRenderTargetPixelsAsync(this.target, 0, 0, W, H, this.pixels);
    for (const m of materials) m.dispose();
    const g = this.canvas.getContext('2d');
    if (!g) return '';
    const img = g.createImageData(W, H);
    // WebGL rows start at the bottom.
    for (let y = 0; y < H; y++) img.data.set(this.pixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    g.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}
