import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** One cross-section of a tube: centre, half-width along the side axis, extent to the front and to the back. */
export interface Section {
  p: Vector3;
  rx: number;
  rf: number;
  rb: number;
  /** Texture v for this ring (defaults to the ring index fraction). */
  v?: number;
}

/** Colour of a vertex from its position along the tube (t, 0..1) and its angle (a, 0 = front, ±π = back). */
export type Shade = (t: number, a: number) => Color;

export interface TubeOptions {
  sides: number;
  shade: Shade | Color;
  smooth?: boolean;
  uv?: boolean;
  /** Keep only the cells for which this returns true (masks for hairlines, beards). */
  keep?: (t: number, a: number) => boolean;
  /** Side axis of the first section (default +x). Front = side × tangent. */
  side?: Vector3;
  capStart?: boolean;
  capEnd?: boolean;
  /** Keep every section in the horizontal plane (side = +x, front = +z) instead of following the path. */
  level?: boolean;
}

const tmpS = new Vector3();
const tmpF = new Vector3();
const tmpT = new Vector3();

/**
 * Generalised loft: elliptical sections swept along a path with parallel-transported frames.
 * With a path going up +y and the default side axis, angle 0 points to +z (the character's front).
 */
export function tube(sections: Section[], o: TubeOptions): BufferGeometry {
  const n = sections.length;
  const cols = o.sides + 1;
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const shade = o.shade instanceof Color ? () => o.shade as Color : o.shade;
  const vOf = (i: number): number => sections[i]?.v ?? i / (n - 1);

  const side = (o.side ?? new Vector3(1, 0, 0)).clone();
  for (let i = 0; i < n; i++) {
    const s = sections[i];
    const prev = sections[Math.max(0, i - 1)];
    const next = sections[Math.min(n - 1, i + 1)];
    if (o.level) {
      tmpS.set(1, 0, 0);
      tmpF.set(0, 0, 1);
    } else {
      tmpT.subVectors(next.p, prev.p).normalize();
      side.addScaledVector(tmpT, -side.dot(tmpT)).normalize();
      tmpS.copy(side);
      tmpF.crossVectors(tmpS, tmpT);
    }
    const t = vOf(i);
    for (let j = 0; j < cols; j++) {
      const a = -Math.PI + (2 * Math.PI * j) / o.sides;
      const c = Math.cos(a);
      const depth = c * (c >= 0 ? s.rf : s.rb);
      pos.push(
        s.p.x + tmpS.x * s.rx * Math.sin(a) + tmpF.x * depth,
        s.p.y + tmpS.y * s.rx * Math.sin(a) + tmpF.y * depth,
        s.p.z + tmpS.z * s.rx * Math.sin(a) + tmpF.z * depth,
      );
      const k = shade(t, a);
      col.push(k.r, k.g, k.b);
      uv.push(j / o.sides, t);
    }
  }

  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < o.sides; j++) {
      if (o.keep) {
        const tm = (vOf(i) + vOf(i + 1)) / 2;
        const am = -Math.PI + (2 * Math.PI * (j + 0.5)) / o.sides;
        if (!o.keep(tm, am)) continue;
      }
      const v00 = i * cols + j;
      const v01 = v00 + 1;
      const v10 = v00 + cols;
      const v11 = v10 + 1;
      index.push(v00, v01, v11, v00, v11, v10);
    }
  }

  const addCap = (ring: number, center: Vector3, outward: boolean): void => {
    const c = pos.length / 3;
    pos.push(center.x, center.y, center.z);
    const k = shade(vOf(ring), 0);
    col.push(k.r, k.g, k.b);
    uv.push(0.5, vOf(ring));
    for (let j = 0; j < o.sides; j++) {
      const a = ring * cols + j;
      if (outward) index.push(c, a, a + 1);
      else index.push(c, a + 1, a);
    }
  };
  if (o.capStart) addCap(0, sections[0].p, false);
  if (o.capEnd) addCap(n - 1, sections[n - 1].p, true);

  let geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  if (o.uv) geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(index);

  if (o.smooth) {
    geo.computeVertexNormals();
    // The seam column is duplicated (for UVs): average its normals so the shading has no crease.
    const nrm = geo.getAttribute('normal');
    for (let i = 0; i < n; i++) {
      const a = i * cols;
      const b = a + o.sides;
      const x = nrm.getX(a) + nrm.getX(b);
      const y = nrm.getY(a) + nrm.getY(b);
      const z = nrm.getZ(a) + nrm.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      nrm.setXYZ(a, x / l, y / l, z / l);
      nrm.setXYZ(b, x / l, y / l, z / l);
    }
  } else {
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();
  }
  return geo;
}

/** Vertical tube helper: sections given as [y, rx, rf, rb] at x = z = 0, shifted by `at`. */
export function column(rings: [number, number, number, number][], at: Vector3, o: TubeOptions): BufferGeometry {
  return tube(
    rings.map(([y, rx, rf, rb]) => ({ p: new Vector3(at.x, at.y + y, at.z), rx, rf, rb })),
    o,
  );
}

/** Merge parts into one geometry (mixing indexed and flat parts). Drops UVs. */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  const flat = parts.map((g) => {
    const f = g.index ? g.toNonIndexed() : g;
    f.deleteAttribute('uv');
    return f;
  });
  return mergeGeometries(flat);
}

/** Position-only copy with welded vertices and smooth normals, for the inverted-hull outline. */
export function outlineGeometry(geo: BufferGeometry): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', geo.getAttribute('position').clone());
  if (geo.index) g.setIndex(geo.index.clone());
  const welded = mergeVertices(g, 1e-4);
  welded.computeVertexNormals();
  return welded;
}

/** Linear colour from a CSS hex string, optionally scaled (shading baked into vertex colours). */
export function rgb(hex: string, scale = 1): Color {
  return new Color(hex).multiplyScalar(scale);
}
