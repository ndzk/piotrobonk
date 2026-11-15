// CS weapon models: guns are their real side outline (traced from the game's own pictures by
// scripts/trace-guns.ts into silhouettes.json) given thickness, wearing the skin's own picture on their sides
// once it has loaded; the older box-and-cylinder recipes in src/content/skins/catalog.ts are the fallback.
// Knives from an extruded blade outline, gloves as shells over Piotrek's hands. Until a picture is in (and
// offline) everything is painted with skin materials (src/render/skin-material.ts), so any skin fits any model.

import { BoxGeometry, CanvasTexture, Color, CylinderGeometry, DataTexture, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshToonMaterial, Path, SRGBColorSpace, Shape, TorusGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import silhouettesRaw from '../content/skins/silhouettes.json?raw';
import { column, tube as loft } from '../characters/geometry';
import { CS_WEAPONS, DEFAULT_GUN, GLOVES, KNIVES, type GloveShape, type GunShape } from '../content/skins/catalog';
import { skinMaterial, type SkinLook } from './skin-material';
import { toonRamp } from './toon';

/** Shared geometry: the same few boxes and tubes are rebuilt for many guns, so cache them by size. */
const geoCache = new Map<string, BufferGeometry>();
function box(w: number, h: number, d: number): BufferGeometry {
  const key = `b${w.toFixed(4)},${h.toFixed(4)},${d.toFixed(4)}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}
function tube(r: number, len: number, sides = 10): BufferGeometry {
  const key = `t${r.toFixed(4)},${len.toFixed(4)},${sides}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new CylinderGeometry(r, r, len, sides);
    g.rotateX(Math.PI / 2);
    geoCache.set(key, g);
  }
  return g;
}

let lensMat: MeshToonMaterial | null = null;
const lens = (): MeshToonMaterial => (lensMat ??= new MeshToonMaterial({ color: '#2a4f8a', emissive: '#14305e', gradientMap: toonRamp() }));

/**
 * Receiver, grip and magazine, barrel: the three parts a finish can colour differently. `photo` is the skin's
 * picture on Steam, laid over a traced gun once it loads.
 */
export interface GunMaterials {
  body: Material;
  detail: Material;
  barrel: Material;
  photo: string | null;
}

export function gunMaterials(look: SkinLook | null): GunMaterials {
  return { body: skinMaterial(look, 0, 9), detail: skinMaterial(look, 1, 9), barrel: skinMaterial(look, 2, 9), photo: look?.image ?? null };
}

/**
 * Steam's pictures through wsrv.nl, an open image cache that adds the CORS header Steam's CDN does not send
 * (without it WebGL may not use a picture). Nothing is stored anywhere of ours.
 */
const PHOTO = (id: string): string => `https://wsrv.nl/?url=community.akamai.steamstatic.com/economy/image/${id}/512fx384f&output=png`;

/** The material a picture-skinned gun wears: the picture, lit a little less than paint (it has its own shading). */
function photoLook(map: CanvasTexture | DataTexture): MeshToonMaterial {
  return new MeshToonMaterial({ map, gradientMap: toonRamp(), emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.35 });
}

/** Loaded pictures, per picture id (a few dozen at most, each kept: a texture of a skin stays on show). */
const photos = new Map<string, Promise<MeshToonMaterial | null>>();

/**
 * A skin's picture as a material for a traced gun, fitted to that gun's icon: a skin rendered with other
 * framing than the icon the outline came from is moved and scaled by the box the gun fills in it. Null when
 * the picture does not come (offline, the service down) or shows no gun.
 */
function photoMaterial(image: string, icon: Icon): Promise<MeshToonMaterial | null> {
  let job = photos.get(image);
  if (job) return job;
  job = new Promise<MeshToonMaterial | null>((done) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      done(null);
    };
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = icon.w;
      c.height = icon.h;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) {
        done(null);
        return;
      }
      g.drawImage(img, 0, 0, icon.w, icon.h);
      const a = g.getImageData(0, 0, icon.w, icon.h).data;
      let [x0, y0, x1, y1] = [icon.w, icon.h, 0, 0];
      for (let y = 0; y < icon.h; y++)
        for (let x = 0; x < icon.w; x++)
          if ((a[(y * icon.w + x) * 4 + 3] ?? 0) > 110) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      const [rx0, ry0, rx1, ry1] = icon.box;
      if (x1 - x0 < 40 || y1 - y0 < 10) {
        done(null);
        return;
      }
      const tex = new CanvasTexture(c);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 4;
      const sx = (x1 - x0) / (rx1 - rx0);
      const sy = (y1 - y0) / (ry1 - ry0);
      tex.repeat.set(sx, sy);
      tex.offset.set((x0 - sx * rx0) / icon.w, 1 - sy + (sy * ry0 - y0) / icon.h);
      done(photoLook(tex));
    };
    img.src = PHOTO(image);
  });
  photos.set(image, job);
  return job;
}

function place(parent: Group, geo: BufferGeometry, mat: Material, x: number, y: number, z: number, rx = 0): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  parent.add(m);
  return m;
}

/** Builds the parts with the grip at z = 0 (where the hand holds it). */
function buildShape(s: GunShape, m: GunMaterials): Group {
  const outer = new Group();
  const g = new Group();
  outer.add(g);
  const h = s.height;
  const w = h * 0.42;
  const bodyZ = s.stock === 'bullpup' ? s.body * 0.2 : s.body * 0.35;
  place(g, box(w, h, s.body), m.body, 0, h * 0.5, bodyZ);
  const front = bodyZ + s.body / 2;
  const br = Math.max(0.008, h * 0.16);
  if (s.barrel > 0) place(g, tube(br, s.barrel), m.barrel, 0, h * 0.7, front + s.barrel / 2);
  const tip = front + s.barrel;
  if (s.silencer) place(g, tube(br * 1.7, 0.11), m.barrel, 0, h * 0.7, tip + 0.055);
  if (s.guard > 0) place(g, box(w * 1.08, h * 0.75, s.guard), m.detail, 0, h * 0.42, front + s.guard / 2 - 0.01);
  // Grip: raked back under the receiver.
  const gripZ = s.stock === 'bullpup' ? bodyZ + s.body * 0.15 : s.mag === 'pistol' ? bodyZ - s.body * 0.3 : bodyZ - s.body * 0.18;
  place(g, box(w * 0.9, h * 1.25, h * 0.55), m.detail, 0, -h * 0.45, gripZ, -0.28);
  g.position.z = -gripZ;
  const magZ = s.stock === 'bullpup' ? bodyZ - s.body * 0.3 : bodyZ + s.body * 0.12;
  switch (s.mag) {
    case 'straight':
      place(g, box(w * 0.75, h * 1.5, h * 0.42), m.detail, 0, -h * 0.65, magZ, 0.08);
      break;
    case 'curved':
      place(g, box(w * 0.75, h * 0.9, h * 0.45), m.detail, 0, -h * 0.4, magZ, 0.12);
      place(g, box(w * 0.75, h * 0.9, h * 0.45), m.detail, 0, -h * 1.15, magZ + h * 0.28, 0.45);
      break;
    case 'drum': {
      const d = place(g, tube(h * 0.42, w * 1.4, 12), m.detail, 0, h * 0.45, bodyZ + s.body * 0.15);
      d.rotation.set(0, Math.PI / 2, 0);
      break;
    }
    case 'box':
      place(g, box(w * 0.9, h * 0.8, h * 0.7), m.detail, 0, -h * 0.35, magZ);
      break;
    case 'tube':
      place(g, tube(br * 1.3, s.barrel * 0.85 + s.body * 0.3), m.detail, 0, h * 0.28, front + (s.barrel * 0.85 - s.body * 0.3) / 2);
      break;
    case 'top':
      place(g, box(w * 1.05, h * 0.35, s.body * 0.7), m.detail, 0, h * 1.12, bodyZ);
      break;
    default:
      break;
  }
  const back = bodyZ - s.body / 2;
  if (s.stock === 'solid') {
    place(g, box(w * 0.9, h * 1.05, s.body * 0.5), m.detail, 0, h * 0.3, back - s.body * 0.25, 0.08);
  } else if (s.stock === 'skeleton') {
    place(g, box(w * 0.4, h * 0.18, s.body * 0.5), m.detail, 0, h * 0.75, back - s.body * 0.25);
    place(g, box(w * 0.4, h * 0.18, s.body * 0.5), m.detail, 0, h * 0.05, back - s.body * 0.25, 0.25);
    place(g, box(w * 0.6, h * 1.0, h * 0.18), m.detail, 0, h * 0.35, back - s.body * 0.5);
  }
  if (s.scope) {
    place(g, tube(h * 0.22, s.body * 0.55, 12), m.barrel, 0, h * 1.3, bodyZ + s.body * 0.05);
    place(g, tube(h * 0.2, 0.004, 12), lens(), 0, h * 1.3, bodyZ + s.body * 0.05 + s.body * 0.28);
    place(g, box(w * 0.5, h * 0.25, h * 0.3), m.detail, 0, h * 1.08, bodyZ + s.body * 0.05);
  }
  return outer;
}

/** How a traced gun maps back onto its icon (see scripts/trace-guns.ts). */
interface Icon {
  w: number;
  h: number;
  /** Metres per pixel. */
  k: number;
  /** The turn that levelled the icon, and its centre. */
  tilt: number;
  cx: number;
  cy: number;
  /** The hand, in levelled pixels. */
  gx: number;
  gy: number;
  /** The box the gun fills in that icon. */
  box: [number, number, number, number];
}

/** Traced outlines in metres, x forward and y up from the hand: flat [x, y, x, y, …] lists. */
interface Silhouette {
  outlines: number[][];
  holes: number[][];
  icon: Icon | null;
}
let silhouettes: Record<string, Silhouette | undefined> | null = null;

/** How thick each kind of gun is made, metres. */
const THICKNESS: Record<string, number> = { pistol: 0.028, autoPistol: 0.03, dual: 0.028, heavyPistol: 0.034, smg: 0.038, rifle: 0.042, scopedRifle: 0.045, sniper: 0.045, autoSniper: 0.05, shotgun: 0.045, lmg: 0.06, taser: 0.03 };

const solidCache = new Map<string, BufferGeometry>();

/** The gun's real outline with its holes, extruded across and pointing along +z, the hand at the origin. */
function silhouetteGeometry(weapon: string, thickness: number): BufferGeometry | null {
  const hit = solidCache.get(weapon);
  if (hit) return hit;
  silhouettes ??= JSON.parse(silhouettesRaw) as Record<string, Silhouette | undefined>;
  const s = silhouettes[weapon];
  if (!s?.outlines.length) return null;
  const trace = <T extends Path>(p: T, flat: number[]): T => {
    p.moveTo(flat[0] ?? 0, flat[1] ?? 0);
    for (let i = 2; i < flat.length; i += 2) p.lineTo(flat[i] ?? 0, flat[i + 1] ?? 0);
    p.closePath();
    return p;
  };
  const shapes = s.outlines.map((o) => trace(new Shape(), o));
  // Each hole goes to the outline around it (there is one outline per gun in practice).
  for (const h of s.holes) shapes[0].holes.push(trace(new Path(), h));
  const bevel = Math.min(0.004, thickness * 0.15);
  const geo = new ExtrudeGeometry(shapes, { depth: thickness - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 1, curveSegments: 1 });
  geo.translate(0, 0, -(thickness - bevel * 2) / 2);
  // Texture co-ordinates: every point back through the tracing (levelled, turned back, mirrored) onto the
  // icon, so a skin's picture lies on both sides exactly where it is drawn, and the edges take its border.
  const ic = s.icon;
  if (ic) {
    const pos = geo.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    const [cos, sin] = [Math.cos(ic.tilt), Math.sin(ic.tilt)];
    for (let i = 0; i < pos.count; i++) {
      const dx = ic.gx + pos.getX(i) / ic.k - ic.cx;
      const dy = ic.gy - pos.getY(i) / ic.k - ic.cy;
      const x = ic.w - (ic.cx + dx * cos + dy * sin);
      const y = ic.cy - dx * sin + dy * cos;
      uv[i * 2] = x / ic.w;
      uv[i * 2 + 1] = 1 - y / ic.h;
    }
    geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  }
  // Shape x (forward) becomes z, the extrusion goes across (x).
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  solidCache.set(weapon, geo);
  return geo;
}

/** One gun of the pair or the single one: the traced outline where there is one, else the built recipe. */
function gunBody(weapon: string, def: (typeof CS_WEAPONS)[string], mats: GunMaterials): Group {
  const geo = silhouetteGeometry(weapon, THICKNESS[def.class] ?? 0.04);
  if (!geo) return buildShape(def.shape, mats);
  const g = new Group();
  const mesh = new Mesh(geo, mats.body);
  g.add(mesh);
  // The skin's own picture replaces the painted pattern once it is in.
  const icon = silhouettes?.[weapon]?.icon;
  if (mats.photo && icon)
    void photoMaterial(mats.photo, icon).then((m) => {
      if (m) mesh.material = m;
    });
  return g;
}

/** A CS gun, pointing along +z with the grip at the origin. Unknown keys fall back to the Glock. */
export function buildGun(weapon: string, mats: GunMaterials): Group {
  const key = weapon in CS_WEAPONS ? weapon : DEFAULT_GUN;
  const def = CS_WEAPONS[key];
  const g = gunBody(key, def, mats);
  if (def.shape.dual) {
    const second = gunBody(key, def, mats);
    second.position.set(0.07, 0.01, -0.02);
    second.rotation.z = 0.2;
    g.add(second);
  }
  g.name = weapon;
  return g;
}

const bladeCache = new Map<string, BufferGeometry>();
let ringGeo: TorusGeometry | null = null;

/**
 * A ★ knife: handle centred on the origin along y, blade pointing down -y out of the fist (the way it hangs
 * from Piotrek's hand). The blade is a thin slab with a wide bevel, so it reads as a ground edge and not as a
 * ribbon. `blade` paints the steel with the skin; `handle` is the grip. Shadow Daggers come as a pair unless
 * `single` (one per hand).
 */
export function buildKnife(weapon: string, blade: Material, handle: Material, single = false): Group {
  const k = KNIVES[weapon] ?? KNIVES.bayonet;
  const g = new Group();
  let geo = bladeCache.get(weapon);
  if (!geo) {
    const shape = new Shape();
    k.blade.forEach(([x, y], i) => {
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    geo = new ExtrudeGeometry(shape, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0035, bevelSegments: 2 });
    geo.translate(0, 0, -0.001);
    bladeCache.set(weapon, geo);
  }
  const hl = k.handle;
  const pieces = k.push && !single ? 2 : 1;
  for (let p = 0; p < pieces; p++) {
    const one = new Group();
    const b = new Mesh(geo, blade);
    b.rotation.z = Math.PI;
    if (k.push) {
      // T-handle across the palm, a stub through the fingers, the blade out of the front of the fist.
      place(one, box(0.075, 0.018, 0.024), handle, 0, 0.012, 0);
      place(one, box(0.016, 0.03, 0.016), handle, 0, -0.01, 0);
      b.position.y = -0.025;
    } else {
      b.position.y = -hl / 2;
      if (k.split) {
        place(one, box(0.009, hl, 0.016), handle, -0.008, 0, 0);
        place(one, box(0.009, hl, 0.016), handle, 0.008, 0, 0);
      } else place(one, box(0.022, hl, 0.02), handle, 0, 0, 0);
      if (k.guard) place(one, box(0.05, 0.008, 0.024), handle, 0, -hl / 2, 0);
      if (k.ring) {
        ringGeo ??= new TorusGeometry(0.018, 0.005, 6, 14);
        const ring = new Mesh(ringGeo, handle);
        ring.position.y = hl / 2 + 0.016;
        one.add(ring);
      }
    }
    one.add(b);
    if (p === 1) one.position.x = 0.1;
    g.add(one);
  }
  g.name = weapon;
  return g;
}

/** Glove recipe for a ★ glove key (falls back to sport gloves). */
export function gloveShape(weapon: string): GloveShape {
  return GLOVES[weapon] ?? GLOVES.sporty_gloves;
}

let knuckleMat: MeshToonMaterial | null = null;
const white = new Color(1, 1, 1);
/** Glove shells are the same for every skin of a glove type: built once per type and hand. */
const gloveCache = new Map<string, BufferGeometry[]>();

function gloveGeometry(shape: GloveShape, side: 1 | -1): BufferGeometry[] {
  const key = `${shape.fingerless}:${shape.cuff}:${shape.knuckles}:${side}`;
  const hit = gloveCache.get(key);
  if (hit) return hit;
  const end = shape.fingerless ? -0.06 : -0.098;
  const tip = shape.fingerless ? [0.018, 0.03, 0.027] : [0.011, 0.02, 0.018];
  const palm = column([[0.012, 0.018, 0.028, 0.028], [-0.03, 0.022, 0.035, 0.033], [-0.062, 0.02, 0.034, 0.031], [end, tip[0], tip[1], tip[2]]], new Vector3(), { sides: 12, shade: white, smooth: true, capStart: true, capEnd: !shape.fingerless });
  palm.scale(1.2, 1.18, 1.2);
  const thumb = loft(
    [
      { p: new Vector3(-side * 0.006, -0.018, 0.02), rx: 0.011, rf: 0.011, rb: 0.011 },
      { p: new Vector3(-side * 0.012, -0.042, 0.034), rx: 0.01, rf: 0.01, rb: 0.01 },
      { p: new Vector3(-side * 0.013, shape.fingerless ? -0.048 : -0.06, 0.038), rx: 0.008, rf: 0.008, rb: 0.008 },
    ],
    { sides: 10, shade: white, smooth: true, capEnd: true },
  );
  thumb.scale(1.2, 1.2, 1.2);
  const cuff = column([[0.03 + shape.cuff * 0.4, 0.033, 0.035, 0.035], [0.012 - shape.cuff * 0.6, 0.035, 0.037, 0.037]], new Vector3(), { sides: 14, shade: white, smooth: true });
  const out = [palm, thumb, cuff];
  if (shape.knuckles) out.push(column([[-0.058, 0.03, 0.012, 0.004], [-0.072, 0.028, 0.011, 0.004]], new Vector3(0, 0, 0.032), { sides: 8, shade: white, smooth: true, capStart: true, capEnd: true }));
  gloveCache.set(key, out);
  return out;
}

/**
 * One ★ glove, shaped to sit over Piotrek's hand (built down -y from the wrist): a shell a little bigger than
 * the hand, the thumb, a cuff, and knuckle plates on studded and moto gloves. Fingerless wraps stop short.
 */
const knuckle = (): MeshToonMaterial => (knuckleMat ??= new MeshToonMaterial({ color: '#3a3b40', gradientMap: toonRamp() }));

/**
 * Tiny meshes with every material a CS model can use (its skin, a scope lens, glove studs), for a scene's
 * warm-up compile: each scene (lights, render target) compiles programs of its own, and the first scoped gun
 * or studded glove there compiled them on the spot. The skin material is never disposed, which keeps the
 * skin program alive after the last real skin there is gone.
 */
export function csProbes(): Mesh[] {
  const geo = new BoxGeometry(0.01, 0.01, 0.01);
  const pixel = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  pixel.needsUpdate = true;
  return [skinMaterial(null, 0, 9), lens(), knuckle(), photoLook(pixel)].map((m) => new Mesh(geo, m));
}

export function buildGlove(material: Material, shape: GloveShape, side: 1 | -1): Group {
  const g = new Group();
  const parts = gloveGeometry(shape, side);
  g.add(new Mesh(parts[0], material), new Mesh(parts[1], material), new Mesh(parts[2], material));
  if (shape.knuckles) {
    g.add(new Mesh(parts[3], knuckle()));
  }
  return g;
}
