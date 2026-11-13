import { BufferGeometry, Color, Vector3 } from 'three';
import type { Appearance } from '../content/characters';
import { Rng, hashSeed } from '../core/rng';
import { rgb, tube, type Section } from './geometry';

/** Nominal head height in metres (stylised: 1/6 of a 180 cm body). */
export const HEAD_HEIGHT = 0.3;
export const HEAD_RINGS = 30;
export const HEAD_SIDES = 36;

/** Facial landmarks as fractions of head height, from the chin up; eyeX in metres. */
export const LANDMARKS = { mouth: 0.155, nose: 0.27, eyes: 0.45, brows: 0.535, hairline: 0.8, eyeX: 0.037 };

export interface RingShape {
  rx: number;
  rf: number;
  rb: number;
  oz: number;
}

export interface HeadProfile {
  height: number;
  at(h: number): RingShape;
  /** Point on the head surface (plus an outward offset) for angle a (0 = front) and height fraction h. */
  surface(a: number, h: number, out?: number): Vector3;
}

const KEYS = [0, 0.05, 0.12, 0.2, 0.3, 0.42, 0.52, 0.65, 0.78, 0.88, 0.95, 1];
const RX = [0.018, 0.044, 0.063, 0.077, 0.088, 0.096, 0.1, 0.102, 0.098, 0.085, 0.06, 0.012];
const RF = [0.012, 0.03, 0.042, 0.055, 0.07, 0.08, 0.085, 0.085, 0.08, 0.068, 0.048, 0.012];
const RB = [0.012, 0.055, 0.068, 0.088, 0.105, 0.118, 0.126, 0.13, 0.125, 0.105, 0.075, 0.016];
const OZ = [0.062, 0.052, 0.043, 0.032, 0.02, 0.012, 0.008, 0.006, 0.004, 0.002, 0, 0];

function catmull(keys: number[], vals: number[], x: number): number {
  let k = 0;
  while (k < keys.length - 2 && x > (keys[k + 1] ?? 1)) k++;
  const x0 = keys[k] ?? 0;
  const x1 = keys[k + 1] ?? 1;
  const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
  const p0 = vals[Math.max(0, k - 1)] ?? 0;
  const p1 = vals[k] ?? 0;
  const p2 = vals[k + 1] ?? 0;
  const p3 = vals[Math.min(vals.length - 1, k + 2)] ?? 0;
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Piecewise-linear lookup over |angle| (used for hairlines and beard edges). */
export function byAngle(keys: number[], vals: number[], a: number): number {
  const x = Math.abs(a);
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i] ?? 0;
    const k1 = keys[i + 1] ?? Math.PI;
    if (x <= k1) {
      const t = (x - k0) / (k1 - k0);
      return (vals[i] ?? 0) * (1 - t) + (vals[i + 1] ?? 0) * t;
    }
  }
  return vals[vals.length - 1] ?? 0;
}

export function headProfile(app: Appearance): HeadProfile {
  const s = app.head;
  const height = HEAD_HEIGHT * s.length;
  const at = (h: number): RingShape => {
    const jaw = s.jaw + (1 - s.jaw) * smoothstep(0.22, 0.48, h);
    const chin = 1 + (s.chin - 1) * (1 - smoothstep(0.05, 0.3, h));
    return {
      rx: catmull(KEYS, RX, h) * s.width * jaw,
      rf: catmull(KEYS, RF, h) * s.depth,
      rb: catmull(KEYS, RB, h) * s.depth,
      oz: catmull(KEYS, OZ, h) * chin,
    };
  };
  return {
    height,
    at,
    surface(a, h, out = 0) {
      const r = at(h);
      const c = Math.cos(a);
      const d = c >= 0 ? r.rf : r.rb;
      return new Vector3((r.rx + out) * Math.sin(a), h * height + out * 0.3 * (h - 0.5), r.oz + c * (d + out));
    },
  };
}

export function headSections(prof: HeadProfile, inflate = 0): Section[] {
  return Array.from({ length: HEAD_RINGS }, (_, i) => {
    const h = i / (HEAD_RINGS - 1);
    const r = prof.at(h);
    return { p: new Vector3(0, h * prof.height, r.oz), rx: r.rx + inflate, rf: r.rf + inflate, rb: r.rb + inflate, v: h };
  });
}

/** Pushes every vertex out along its normal by f(h, a); h and a come from the shell's UVs. */
export function inflate(geo: BufferGeometry, f: (h: number, a: number) => number): BufferGeometry {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const d = f(uv.getY(i), (uv.getX(i) - 0.5) * 2 * Math.PI);
    pos.setXYZ(i, pos.getX(i) + nrm.getX(i) * d, pos.getY(i) + nrm.getY(i) * d, pos.getZ(i) + nrm.getZ(i) * d);
  }
  geo.computeVertexNormals();
  return geo;
}

// Hairlines: height fraction of the hair edge by |angle| (0 = forehead, π/2 = above the ear, π = nape).
const HAIR_KEYS = [0, 0.35, 0.7, 1.05, 1.2, 1.32, 1.45, 1.6, 1.8, 2.1, 2.5, Math.PI];
export const HAIRLINE = {
  quiff: [0.8, 0.79, 0.73, 0.69, 0.56, 0.43, 0.5, 0.585, 0.5, 0.3, 0.17, 0.15],
  swept: [0.81, 0.8, 0.74, 0.67, 0.52, 0.37, 0.45, 0.5, 0.44, 0.27, 0.13, 0.11],
};
export function hairline(style: Appearance['hair']['style'], a: number): number {
  return byAngle(HAIR_KEYS, HAIRLINE[style], a);
}

/** Upper edge of the full beard by |angle|; behind the ears only the jaw underside has beard. */
const BEARD_KEYS = [0, 0.25, 0.5, 0.8, 1.1, 1.3, 1.45, 1.6, 2.0, 2.4];
const BEARD_TOP = [0.245, 0.245, 0.265, 0.285, 0.32, 0.36, 0.38, 0.2, 0.1, 0];
export function beardTop(a: number): number {
  return byAngle(BEARD_KEYS, BEARD_TOP, a);
}

export function hairThickness(style: Appearance['hair']['style'], h: number, a: number): number {
  if (style === 'quiff') return 0.003 + 0.016 * smoothstep(0.68, 0.93, h) * (0.6 + 0.4 * Math.max(0, Math.cos(a)));
  const back = smoothstep(1.4, 2.6, Math.abs(a));
  return 0.006 + 0.014 * smoothstep(0.5, 0.92, h) + 0.006 * back * smoothstep(0.2, 0.6, h);
}

export function beardThickness(h: number, a: number): number {
  return 0.003 + 0.007 * (1 - smoothstep(0.02, 0.32, h)) * (1 - 0.45 * smoothstep(0.6, 1.4, Math.abs(a)));
}

/** Short strands sticking up (Piotrek) or flat locks swept over the forehead (Bartek D.). */
export function hairPieces(app: Appearance, prof: HeadProfile): BufferGeometry[] {
  const rng = new Rng(hashSeed(app.id + ':hair'));
  const base = rgb(app.hair.color);
  const light = rgb(app.hair.light);
  const dark = rgb(app.hair.dark);
  const pieces: BufferGeometry[] = [];
  const shade = (t: number): Color => dark.clone().lerp(base, Math.min(1, t * 2.2)).lerp(light, smoothstep(0.55, 1, t));

  if (app.hair.style === 'quiff') {
    // Messy quiff: chunky tufts pushed up from the crown, tips leaning to -x (viewer's left) and a bit forward.
    for (let i = 0; i < 56; i++) {
      const a = rng.range(-0.95, 0.9);
      const h = rng.range(0.76, 0.985);
      const out = hairThickness('quiff', h, a) - 0.006;
      const p0 = prof.surface(a, h, out);
      const front = Math.max(0, Math.cos(a)) * smoothstep(0.99, 0.8, h);
      const len = (0.03 + 0.065 * front) * rng.range(0.7, 1.3);
      // Mostly straight up; the front lifts off the forehead; tips bend towards -x.
      const up = new Vector3(Math.sin(a) * 0.15, 1, 0.1 + 0.35 * front).normalize();
      const left = rng.next() < 0.8;
      const lean = new Vector3(left ? -0.35 - rng.next() * 0.4 : 0.15 + rng.next() * 0.2, -0.05, 0.05 + rng.next() * 0.1);
      const pts = [0, 0.35, 0.7, 1].map((t) => p0.clone().addScaledVector(up, len * t).addScaledVector(lean, len * t * t * 0.85));
      const w = (0.024 + 0.01 * front) * rng.range(0.8, 1.15);
      const radii = [1, 0.62, 0.28, 0.02];
      pieces.push(
        tube(
          pts.map((p, k) => ({ p, rx: w * (radii[k] ?? 0), rf: w * 0.55 * (radii[k] ?? 0), rb: w * 0.55 * (radii[k] ?? 0) })),
          { sides: 6, shade: (t) => shade(0.35 + t * 0.7), smooth: true, side: new Vector3(Math.cos(a), 0, -Math.sin(a)), capEnd: true },
        ),
      );
    }
    return pieces;
  }

  // Swept: wide flat locks from the crown over the forehead to -x, with a little wave.
  for (let i = 0; i < 28; i++) {
    const a0 = rng.range(-0.4, 1.05);
    const h0 = rng.range(0.93, 0.99);
    const a1 = rng.range(-1.05, -0.15) + (i % 3) * 0.12;
    const h1 = rng.range(0.6, 0.74);
    const lift = rng.range(0.008, 0.016);
    const pts: Section[] = [];
    const steps = 8;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const a = a0 + (a1 - a0) * smoothstep(0, 1, t);
      const h = h0 + (h1 - h0) * t * t;
      const out = hairThickness('swept', h, a) + lift * Math.sin(Math.PI * t) + 0.004 * Math.sin(t * 9 + i);
      const w = 0.024 * (1 - 0.8 * t * t) * rng.range(0.85, 1.15);
      pts.push({ p: prof.surface(a, h, out), rx: w, rf: 0.0055, rb: 0.0055 });
    }
    const dir = pts[1].p.clone().sub(pts[0].p).normalize();
    const n = pts[0].p.clone().setY(0).normalize();
    pieces.push(tube(pts, { sides: 8, shade: (t) => shade(0.45 + t * 0.6), smooth: true, side: dir.clone().cross(n).normalize(), capEnd: true }));
  }
  return pieces;
}

/** Nose and ears: skin-coloured parts on the head mesh. */
export function headExtras(app: Appearance, prof: HeadProfile): BufferGeometry[] {
  const skin = rgb(app.skin);
  const n = app.head.nose;
  const front = (h: number): number => {
    const r = prof.at(h);
    return r.oz + r.rf;
  };
  const H = prof.height;
  const L = LANDMARKS;
  const nose = tube(
    [
      { p: new Vector3(0, (L.eyes - 0.01) * H, front(L.eyes - 0.01) - 0.006), rx: 0.006, rf: 0.004, rb: 0.003 },
      { p: new Vector3(0, (L.eyes - 0.07) * H, front(L.eyes - 0.07) + 0.002 * n), rx: 0.0075 * n, rf: 0.006, rb: 0.005 },
      { p: new Vector3(0, (L.nose + 0.035) * H, front(L.nose + 0.035) + 0.01 * n), rx: 0.011 * n, rf: 0.009, rb: 0.008 },
      { p: new Vector3(0, (L.nose + 0.01) * H, front(L.nose + 0.01) + 0.011 * n), rx: 0.0135 * n, rf: 0.011, rb: 0.007 },
      { p: new Vector3(0, (L.nose - 0.004) * H, front(L.nose - 0.004) + 0.003), rx: 0.01 * n, rf: 0.007, rb: 0.003 },
    ],
    { sides: 10, shade: skin, smooth: true, side: new Vector3(1, 0, 0), capEnd: true },
  );
  const parts = [nose];
  for (const side of [1, -1]) {
    const ear = (h: number, w: number): Section => {
      const r = prof.at(h);
      return { p: new Vector3(side * (r.rx + 0.004), h * H, r.oz - 0.012), rx: 0.009, rf: w, rb: w * 0.8 };
    };
    parts.push(
      tube([ear(0.35, 0.006), ear(0.38, 0.016), ear(0.47, 0.02), ear(0.55, 0.018), ear(0.585, 0.006)], {
        sides: 8,
        shade: rgb(app.skin, 0.94),
        smooth: true,
        capStart: true,
        capEnd: true,
      }),
    );
  }
  return parts;
}
