// Procedural CS weapon models from the recipes in src/content/skins/catalog.ts: guns from boxes and
// cylinders, knives from an extruded blade outline, gloves as shells over Piotrek's hands. Everything is
// painted with skin materials (src/render/skin-material.ts), so any skin fits any model.

import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshToonMaterial, Shape, TorusGeometry, type BufferGeometry, type Material } from 'three';
import { Color, Vector3 } from 'three';
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

/** Receiver, grip and magazine, barrel: the three parts a finish can colour differently. */
export interface GunMaterials {
  body: Material;
  detail: Material;
  barrel: Material;
}

export function gunMaterials(look: SkinLook | null): GunMaterials {
  return { body: skinMaterial(look, 0, 9), detail: skinMaterial(look, 1, 9), barrel: skinMaterial(look, 2, 9) };
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

/** A CS gun, pointing along +z with the grip at the origin. Unknown keys fall back to the Glock. */
export function buildGun(weapon: string, mats: GunMaterials): Group {
  const def = CS_WEAPONS[weapon] ?? CS_WEAPONS[DEFAULT_GUN];
  const g = buildShape(def.shape, mats);
  if (def.shape.dual) {
    const second = buildShape(def.shape, mats);
    second.position.set(0.07, 0.01, -0.02);
    second.rotation.z = 0.2;
    g.add(second);
  }
  g.name = weapon;
  return g;
}

/** Overall length of a gun model, for framing thumbnails and the inspect view. */
export function gunLength(weapon: string): number {
  const s = (CS_WEAPONS[weapon] ?? CS_WEAPONS[DEFAULT_GUN]).shape;
  const stock = s.stock === 'solid' || s.stock === 'skeleton' ? s.body * 0.5 : 0;
  return s.body + s.barrel + (s.silencer ? 0.11 : 0) + stock;
}

const bladeCache = new Map<string, BufferGeometry>();
let ringGeo: TorusGeometry | null = null;

/**
 * A ★ knife: handle centred on the origin along y, blade pointing down -y out of the fist (the way it hangs
 * from Piotrek's hand). `blade` paints the steel with the skin; `handle` is the grip.
 */
export function buildKnife(weapon: string, blade: Material, handle: Material): Group {
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
    geo = new ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    geo.translate(0, 0, -0.002);
    bladeCache.set(weapon, geo);
  }
  const hl = k.handle;
  const pieces = k.push ? 2 : 1;
  for (let p = 0; p < pieces; p++) {
    const one = new Group();
    const b = new Mesh(geo, blade);
    // Push daggers stick out of the fist sideways; everything else continues the handle.
    if (k.push) {
      b.rotation.z = Math.PI / 2;
      b.position.set(0.02, -0.01, 0);
      one.add(place(new Group(), box(0.08, 0.018, 0.022), handle, 0, 0, 0));
    } else {
      b.rotation.z = Math.PI;
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
    if (p === 1) one.position.x = 0.09;
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

/**
 * One ★ glove, shaped to sit over Piotrek's hand (built down -y from the wrist): a shell a little bigger than
 * the hand, the thumb, a cuff, and knuckle plates on studded and moto gloves. Fingerless wraps stop short.
 */
export function buildGlove(material: Material, shape: GloveShape, side: 1 | -1): Group {
  const g = new Group();
  const end = shape.fingerless ? -0.06 : -0.098;
  const tip = shape.fingerless ? [0.018, 0.03, 0.027] : [0.011, 0.02, 0.018];
  const palm = column([[0.012, 0.018, 0.028, 0.028], [-0.03, 0.022, 0.035, 0.033], [-0.062, 0.02, 0.034, 0.031], [end, tip[0], tip[1], tip[2]]], new Vector3(), { sides: 10, shade: white, smooth: true, capEnd: !shape.fingerless });
  palm.scale(1.24, 1.22, 1.24);
  g.add(new Mesh(palm, material));
  const thumb = loft(
    [
      { p: new Vector3(-side * 0.006, -0.018, 0.02), rx: 0.0115, rf: 0.0115, rb: 0.0115 },
      { p: new Vector3(-side * 0.012, -0.042, 0.034), rx: 0.0105, rf: 0.0105, rb: 0.0105 },
      { p: new Vector3(-side * 0.013, shape.fingerless ? -0.048 : -0.06, 0.038), rx: 0.0085, rf: 0.0085, rb: 0.0085 },
    ],
    { sides: 8, shade: white, smooth: true, capEnd: true },
  );
  thumb.scale(1.22, 1.22, 1.22);
  g.add(new Mesh(thumb, material));
  g.add(new Mesh(column([[0.03 + shape.cuff * 0.4, 0.034, 0.036, 0.036], [0.012 - shape.cuff * 0.6, 0.036, 0.038, 0.038]], new Vector3(), { sides: 12, shade: white, smooth: true }), material));
  if (shape.knuckles) {
    knuckleMat ??= new MeshToonMaterial({ color: '#3a3b40', gradientMap: toonRamp() });
    g.add(new Mesh(column([[-0.058, 0.03, 0.012, 0.004], [-0.072, 0.028, 0.011, 0.004]], new Vector3(0, 0, 0.032), { sides: 8, shade: white, smooth: true, capStart: true, capEnd: true }), knuckleMat));
  }
  return g;
}
