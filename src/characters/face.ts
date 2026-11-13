import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Appearance, Expression } from '../content/characters';
import { Rng, hashSeed } from '../core/rng';
import { beardTop, hairline, smoothstep, type HeadProfile } from './head';

// Textures share the head's UV layout: u = 0.5 + angle / 2π (front in the middle), v = height fraction.
const W = 1024;
const H = 512;

interface Look {
  /** Upper-lid opening relative to the traced (photo) eye: 1 = as in the photo. Extra for the +x eye. */
  lid: number;
  lidAsym: number;
  /** Lid slant: > 0 lowers the inner part of the upper lid (anger), < 0 raises it (worry). */
  slant: number;
  /** Brow shifts in metres: inner end, outer end, extra lift of the whole +x brow. */
  browIn: number;
  browOut: number;
  browAsym: number;
  look: [number, number];
  blush: number;
  mouth: 'line' | 'shout' | 'smirk' | 'pout';
}

const LOOKS: Record<Expression, Look> = {
  neutral: { lid: 1, lidAsym: 0, slant: 0, browIn: 0, browOut: 0, browAsym: 0, look: [0, 0], blush: 0.14, mouth: 'line' },
  angry: { lid: 0.86, lidAsym: 0, slant: 1, browIn: -0.007, browOut: 0.0025, browAsym: 0, look: [0, 0.0005], blush: 0.3, mouth: 'shout' },
  smirk: { lid: 0.7, lidAsym: -0.12, slant: 0.2, browIn: 0.001, browOut: 0.001, browAsym: 0.005, look: [-0.002, 0], blush: 0.12, mouth: 'smirk' },
  butthurt: { lid: 0.9, lidAsym: 0, slant: -0.7, browIn: 0.0055, browOut: -0.002, browAsym: 0, look: [0.001, -0.001], blush: 0.42, mouth: 'pout' },
};

type P2 = [number, number];
const mm = (v: readonly [number, number]): P2 => [v[0] / 1000, v[1] / 1000];
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

export function toTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number): number => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function shadeHex(hex: string, k: number): string {
  return mix(hex, k < 1 ? '#000000' : '#ffffff', Math.abs(1 - k));
}

/** Drawing in face space: x in metres from the centre line (+x = character's left), y in metres from the chin. */
class FacePainter {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly prof: HeadProfile,
  ) {}

  px(fx: number, fy: number): [number, number] {
    const h = fy / this.prof.height;
    const r = this.prof.at(Math.min(1, Math.max(0, h))).rx;
    const a = Math.asin(Math.min(1, Math.max(-1, fx / r)));
    return [W * (0.5 + a / (2 * Math.PI)), H * (1 - h)];
  }

  move(x: number, y: number): void {
    this.ctx.moveTo(...this.px(x, y));
  }
  line(x: number, y: number): void {
    this.ctx.lineTo(...this.px(x, y));
  }
  bez(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    this.ctx.bezierCurveTo(...this.px(c1x, c1y), ...this.px(c2x, c2y), ...this.px(x, y));
  }
  quad(cx: number, cy: number, x: number, y: number): void {
    this.ctx.quadraticCurveTo(...this.px(cx, cy), ...this.px(x, y));
  }
  ellipse(fx: number, fy: number, rx: number, ry: number): void {
    const [x, y] = this.px(fx, fy);
    const [x2] = this.px(fx + rx, fy);
    this.ctx.ellipse(x, y, Math.max(0.5, Math.abs(x2 - x)), Math.max(0.5, (ry / this.prof.height) * H), 0, 0, Math.PI * 2);
  }
  /** Smooth curve through the points (Catmull-Rom as Béziers); starts with a lineTo/moveTo of the first point. */
  curve(pts: P2[], move = true): void {
    const first = pts[0];
    if (move) this.move(...first);
    else this.line(...first);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)] ?? first;
      const p1 = pts[i] ?? first;
      const p2 = pts[i + 1] ?? first;
      const p3 = pts[Math.min(pts.length - 1, i + 2)] ?? p2;
      this.bez(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  }

  fill(style: string, alpha = 1): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = style;
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
  }
  stroke(style: string, width: number, alpha = 1): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.strokeStyle = style;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }
  glow(fx: number, fy: number, r: number, color: string, alpha: number): void {
    const [x, y] = this.px(fx, fy);
    const rp = (r / this.prof.height) * H;
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, rp);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x - rp, y - rp, rp * 2, rp * 2);
    this.ctx.globalAlpha = 1;
  }
}

/** Short hair strokes scattered in UV space where density(h, a) says so. */
function strands(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  count: number,
  density: (h: number, a: number) => number,
  colors: string[],
  opts: { len: [number, number]; width: [number, number]; alpha: [number, number]; dir: (h: number, a: number) => number },
): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const u = rng.next();
    const v = rng.next();
    const a = (u - 0.5) * 2 * Math.PI;
    if (rng.next() > density(v, a)) continue;
    const x = u * W;
    const y = (1 - v) * H;
    const ang = opts.dir(v, a) + rng.range(-0.35, 0.35);
    const len = rng.range(...opts.len);
    ctx.strokeStyle = colors[Math.floor(rng.next() * colors.length)] ?? '#000';
    ctx.globalAlpha = rng.range(...opts.alpha);
    ctx.lineWidth = rng.range(...opts.width);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const DOWN = Math.PI / 2;

/** Where facial hair grows, 0..1. */
export function beardDensity(app: Appearance, prof: HeadProfile, h: number, a: number): number {
  const x = Math.abs(a);
  const f = app.face;
  if (app.beard.style === 'full') {
    const top = beardTop(app, prof, a);
    const edge = 1 - smoothstep(top - 0.03, top + 0.01, h);
    return x > 2.4 ? 0 : edge;
  }
  // Jawline beard: along the jaw from the sideburns to the chin, faint moustache, clean cheeks.
  const m = f.mouth;
  const jawTop = m - 0.11 + Math.max(0, x - 0.75) * 0.5;
  const jaw = x < 1.55 ? 1 - smoothstep(jawTop - 0.025, jawTop + 0.015, h) : h < 0.12 ? 1 - smoothstep(1.6, 2.1, x) : 0;
  const chin = x < 0.75 ? 1 - smoothstep(m - 0.09, m - 0.065, h) : 0;
  const soul = x < 0.16 && h > m - 0.07 && h < m - 0.042 ? 0.55 : 0;
  const stache = x < 0.3 && h > m + 0.03 && h < f.nose - 0.02 ? 0.1 : 0;
  const side = x > 1.25 && x < 1.5 && h < f.earTop - 0.02 && h > f.earBottom ? 0.8 : 0;
  return Math.max(jaw * 0.85, chin * 0.9, soul, stache, side);
}

export function paintFace(app: Appearance, prof: HeadProfile, expr: Expression): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const p = new FacePainter(ctx, prof);
  const L = app.face;
  const Hm = prof.height;
  const look = LOOKS[expr];
  const rng = new Rng(hashSeed(`${app.id}:face`));
  const skinDark = shadeHex(app.skin, 0.78);

  ctx.fillStyle = app.skin;
  ctx.fillRect(0, 0, W, H);

  // Soft modelling painted into the skin: cheeks, eye sockets, upper lip, under the lower lip.
  for (const s of [1, -1]) {
    p.glow(s * (L.eyeX + 0.012), (L.eyes - 0.12) * Hm, 0.034, app.lips, look.blush);
    p.glow(s * L.eyeX, (L.eyes + 0.025) * Hm, 0.03, skinDark, 0.2);
    p.glow(s * (L.eyeX + 0.03), (L.eyes - 0.02) * Hm, 0.03, skinDark, 0.1);
    // Nasolabial folds: from the nostril wing towards the mouth corner.
    ctx.beginPath();
    p.move(s * (L.noseHalf + 0.002), (L.nose + 0.015) * Hm);
    p.quad(s * (L.mouthHalf + 0.006), (L.nose - 0.02) * Hm, s * (L.mouthHalf + 0.004), app.traced.mouth.line / 1000 + 0.003);
    p.stroke(skinDark, 2.2, 0.22);
  }
  p.glow(0, (L.mouth - 0.075) * Hm, 0.02, skinDark, 0.18);
  p.glow(0, 0.012 * Hm, 0.05, skinDark, 0.22);
  if (expr === 'angry') {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ff3a26';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Freckles and moles.
  for (let i = 0; i < app.marks.freckles; i++) {
    ctx.beginPath();
    p.ellipse(rng.range(-0.065, 0.065), rng.range(L.nose - 0.02, L.eyes - 0.06) * Hm, 0.0012, 0.0012);
    p.fill(shadeHex(app.skin, 0.72), rng.range(0.25, 0.5));
  }
  for (const m of app.marks.moles) {
    ctx.beginPath();
    p.ellipse(m.x, m.y, m.r, m.r * 0.9);
    p.fill(shadeHex(app.skin, 0.55), 0.85);
  }

  // Facial hair painted into the skin (the full beard also gets a 3D shell on top): a soft shadow of the
  // beard area first, so it reads as a beard and not as scattered dots, then the individual hairs.
  const full = app.beard.style === 'full';
  const shadowImg = ctx.getImageData(0, 0, W, H);
  const base = parseInt(app.beard.color.slice(1), 16);
  const br = (base >> 16) & 255;
  const bg = (base >> 8) & 255;
  const bb = base & 255;
  for (let y = 0; y < H; y++) {
    const h = 1 - y / H;
    for (let x = 0; x < W; x++) {
      const d = beardDensity(app, prof, h, (x / W - 0.5) * 2 * Math.PI);
      if (d <= 0) continue;
      const k = d * (full ? 0.6 : 0.28);
      const i = (y * W + x) * 4;
      shadowImg.data[i] = (shadowImg.data[i] ?? 0) * (1 - k) + br * k;
      shadowImg.data[i + 1] = (shadowImg.data[i + 1] ?? 0) * (1 - k) + bg * k;
      shadowImg.data[i + 2] = (shadowImg.data[i + 2] ?? 0) * (1 - k) + bb * k;
    }
  }
  ctx.putImageData(shadowImg, 0, 0);
  strands(ctx, rng, full ? 26000 : 20000, (h, a) => beardDensity(app, prof, h, a), [app.beard.color, app.beard.dark, shadeHex(app.beard.color, 1.15)], {
    len: full ? [4, 9] : [2.5, 5],
    width: full ? [1.2, 2] : [1, 1.5],
    alpha: full ? [0.6, 0.95] : [0.45, 0.85],
    dir: (h, a) => DOWN - Math.sign(a) * 0.25 * (1 - h),
  });

  // Nostrils.
  for (const s of [1, -1]) {
    ctx.beginPath();
    p.ellipse(s * (app.traced.nose.nostrilX / 1000), app.traced.nose.nostrils / 1000 + 0.001, 0.0045, 0.0019);
    p.fill(shadeHex(app.skin, expr === 'angry' ? 0.38 : 0.5), 0.75);
  }

  for (const s of [1, -1] as const) eye(p, app, look, s);
  for (const s of [1, -1] as const) brow(p, app, look, s, rng);
  mouth(p, app, look);

  // Expression extras.
  const bY = L.brows * Hm;
  const mY = app.traced.mouth.line / 1000;
  if (expr === 'angry') {
    for (const s of [1, -1]) {
      ctx.beginPath();
      p.move(s * 0.0035, bY - 0.002);
      p.quad(s * 0.006, bY + 0.006, s * 0.0045, bY + 0.013);
      p.stroke(skinDark, 2, 0.75);
    }
  }
  if (expr === 'butthurt') {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      p.move(-0.026, bY + 0.026 + k * 0.007);
      p.bez(-0.01, bY + 0.031 + k * 0.007, 0.01, bY + 0.022 + k * 0.007, 0.026, bY + 0.027 + k * 0.007);
      p.stroke(skinDark, 1.5, 0.35);
    }
  }
  if (expr === 'smirk') {
    ctx.beginPath();
    p.move(L.mouthHalf * 1.2, mY + 0.015);
    p.quad(L.mouthHalf * 1.35, mY + 0.004, L.mouthHalf * 1.2, mY - 0.004);
    p.stroke(skinDark, 1.6, 0.55);
  }
  return c;
}

function eye(p: FacePainter, app: Appearance, look: Look, s: 1 | -1): void {
  const ctx = p.ctx;
  const e = app.traced.eyes[s === 1 ? 1 : 0];
  const inner = mm(e.inner);
  const outer = mm(e.outer);
  const top = mm(e.top);
  const bottom = mm(e.bottom);
  const open = look.lid + (s === 1 ? look.lidAsym : 0);
  const baseAt = (x: number): number => inner[1] + ((outer[1] - inner[1]) * (x - inner[0])) / (outer[0] - inner[0]);
  const apex: P2 = [top[0], baseAt(top[0]) + (top[1] - baseAt(top[0])) * open];
  const low: P2 = [bottom[0], baseAt(bottom[0]) + (bottom[1] - baseAt(bottom[0])) * (0.85 + 0.15 * open)];
  const innerMid = lerp2(inner, apex, 0.45);
  innerMid[1] -= look.slant * 0.0022;
  const upperPts: P2[] = [inner, innerMid, apex, lerp2(apex, outer, 0.55), outer];
  upperPts[3] = [upperPts[3]?.[0] ?? apex[0], (upperPts[3]?.[1] ?? apex[1]) + (apex[1] - baseAt(apex[0])) * 0.12];
  const lowerPts: P2[] = [outer, lerp2(outer, low, 0.55), low, lerp2(low, inner, 0.5), inner];

  ctx.save();
  ctx.beginPath();
  p.curve(upperPts);
  p.curve(lowerPts, false);
  ctx.closePath();
  p.fill('#f3eee7');
  ctx.clip();
  const iris = mm(e.iris);
  const ir = e.irisR / 1000;
  const [cx, cy] = p.px(iris[0] + look.look[0], iris[1] + look.look[1]);
  const [cx2] = p.px(iris[0] + look.look[0] + ir, iris[1]);
  const rx = Math.abs(cx2 - cx);
  const ry = (ir / p.prof.height) * H;
  const g = ctx.createRadialGradient(cx, cy, rx * 0.15, cx, cy, rx);
  g.addColorStop(0, shadeHex(app.eyes.iris, 1.2));
  g.addColorStop(0.68, app.eyes.iris);
  g.addColorStop(1, shadeHex(app.eyes.iris, 0.5));
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.4, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#15100d';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.32, cy - ry * 0.38, rx * 0.18, ry * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Shadow cast by the upper lid.
  ctx.beginPath();
  p.curve(upperPts);
  p.curve([outer, [apex[0], apex[1] - 0.0028], inner], false);
  ctx.closePath();
  p.fill('#5a3a32', 0.32);
  ctx.restore();

  // Lid fold between the lash line and the crease: heavy, relaxed lids like in the photos.
  const crease: P2[] = [
    [inner[0] + s * 0.001, inner[1] + 0.0022],
    [apex[0], apex[1] + 0.003 + 0.0012 * open],
    [outer[0] - s * 0.002, outer[1] + 0.0018],
  ];
  ctx.beginPath();
  p.curve(upperPts);
  p.curve([...crease].reverse(), false);
  ctx.closePath();
  p.fill(shadeHex(app.skin, 0.84), 0.5);
  ctx.beginPath();
  p.curve(crease);
  p.stroke(shadeHex(app.skin, 0.62), 1.4, 0.45);
  ctx.beginPath();
  p.curve(upperPts);
  p.stroke('#2a1b17', 3.2);
  ctx.beginPath();
  p.move(...outer);
  p.line(outer[0] + s * 0.003, outer[1] + 0.0012);
  p.stroke('#2a1b17', 2.2);
  ctx.beginPath();
  p.curve(lowerPts);
  p.stroke(shadeHex(app.skin, 0.58), 1.3, 0.6);
  // Soft shadow under the eye.
  ctx.beginPath();
  p.curve([
    [outer[0] - s * 0.004, outer[1] - 0.004],
    [low[0], low[1] - 0.0035],
    [inner[0] + s * 0.002, inner[1] - 0.003],
  ]);
  p.stroke(shadeHex(app.skin, 0.75), 2.2, 0.22);
}

function brow(p: FacePainter, app: Appearance, look: Look, s: 1 | -1, rng: Rng): void {
  const b = app.traced.brows[s === 1 ? 1 : 0];
  const lift = s === 1 ? look.browAsym : 0;
  const inner = mm(b.inner);
  const peak = mm(b.peak);
  const outer = mm(b.outer);
  inner[1] += look.browIn + lift;
  outer[1] += look.browOut + lift;
  peak[1] += (look.browIn + look.browOut) * 0.4 + lift;
  const [ti, tp, to] = b.thick.map((t) => t / 1000) as [number, number, number];
  const topPts: P2[] = [
    [inner[0], inner[1] + ti * 0.45],
    [peak[0], peak[1] + tp / 2],
    [outer[0], outer[1] + to / 2],
  ];
  const botPts: P2[] = [
    [outer[0] - s * 0.002, outer[1] - to / 2],
    [peak[0], peak[1] - tp / 2],
    [inner[0], inner[1] - ti * 0.55],
  ];
  p.ctx.beginPath();
  p.curve(topPts);
  p.curve(botPts, false);
  p.ctx.closePath();
  p.fill(app.brows.color);
  // Individual hairs over the edges so the brow is not a flat sticker.
  for (let i = 0; i < 140; i++) {
    const t = rng.next();
    const along = t < 0.45 ? lerp2(inner, peak, t / 0.45) : lerp2(peak, outer, (t - 0.45) / 0.55);
    const th = t < 0.45 ? ti + (tp - ti) * (t / 0.45) : tp + (to - tp) * ((t - 0.45) / 0.55);
    const x = along[0];
    const y = along[1] + rng.range(-th * 0.62, th * 0.62);
    p.ctx.beginPath();
    p.move(x, y);
    p.line(x + s * rng.range(0.0018, 0.0042), y + rng.range(0.0003, 0.0018) * (t < 0.3 ? 1.6 : 1));
    p.stroke(rng.next() < 0.55 ? shadeHex(app.brows.color, 0.7) : shadeHex(app.brows.color, 1.3), 1.1, 0.75);
  }
}

function mouth(p: FacePainter, app: Appearance, look: Look): void {
  const ctx = p.ctx;
  const m = app.traced.mouth;
  const lips = app.lips;
  const upperLip = shadeHex(lips, 0.86);
  const lineColor = shadeHex(lips, 0.48);
  let L = mm(m.left);
  let R = mm(m.right);
  const cx = (L[0] + R[0]) / 2;
  const hw = (R[0] - L[0]) / 2;
  let lineY = m.line / 1000;
  let upperTop = m.upperTop / 1000;
  const bowDip = m.bowDip / 1000;
  let lowerBottom = m.lowerBottom / 1000;

  if (look.mouth === 'shout') {
    const top: P2[] = [
      [L[0] + hw * 0.1, L[1] - 0.002],
      [cx - hw * 0.55, upperTop + 0.0015],
      [cx, upperTop + 0.002],
      [cx + hw * 0.55, upperTop + 0.0015],
      [R[0] - hw * 0.1, R[1] - 0.002],
    ];
    const bottom: P2[] = [
      [R[0] - hw * 0.1, R[1] - 0.002],
      [cx + hw * 0.5, lowerBottom - 0.008],
      [cx, lowerBottom - 0.01],
      [cx - hw * 0.5, lowerBottom - 0.008],
      [L[0] + hw * 0.1, L[1] - 0.002],
    ];
    const shape = (): void => {
      p.curve(top);
      p.curve(bottom, false);
      ctx.closePath();
    };
    ctx.beginPath();
    shape();
    p.fill('#3a1416');
    ctx.save();
    ctx.beginPath();
    shape();
    ctx.clip();
    ctx.beginPath();
    p.move(cx - hw, upperTop + 0.003);
    p.line(cx + hw, upperTop + 0.003);
    p.line(cx + hw, upperTop - 0.0045);
    p.line(cx - hw, upperTop - 0.0045);
    ctx.closePath();
    p.fill('#f3efe6');
    ctx.beginPath();
    p.ellipse(cx, lowerBottom - 0.0075, hw * 0.5, 0.004);
    p.fill('#b5485a');
    ctx.restore();
    ctx.beginPath();
    shape();
    p.stroke(lips, 4.4);
    return;
  }

  if (look.mouth === 'smirk') {
    R = [R[0] + 0.0025, R[1] + 0.0055];
    L = [L[0] + 0.001, L[1] - 0.0008];
    upperTop -= 0.001;
    lowerBottom += 0.0022;
    lineY += 0.0012;
  } else if (look.mouth === 'pout') {
    L = [L[0] + hw * 0.22, L[1] - 0.0045];
    R = [R[0] - hw * 0.22, R[1] - 0.0045];
    upperTop += 0.0008;
    lowerBottom -= 0.0028;
    lineY -= 0.0006;
  }
  const mid: P2 = [cx, lineY];
  const lineLR: P2[] = [L, lerp2(L, mid, 0.5), mid, lerp2(mid, R, 0.5), R];
  lineLR[1] = [lineLR[1]?.[0] ?? cx, (lineLR[1]?.[1] ?? lineY) + (look.mouth === 'pout' ? -0.0012 : 0.0004)];
  lineLR[3] = [lineLR[3]?.[0] ?? cx, (lineLR[3]?.[1] ?? lineY) + (look.mouth === 'pout' ? -0.0012 : look.mouth === 'smirk' ? 0.0022 : 0.0004)];
  const back = [...lineLR].reverse();

  // Upper lip with a cupid's bow.
  ctx.beginPath();
  p.curve([L, [cx - hw * 0.55, lineY + (upperTop - lineY) * 0.72], [cx - hw * 0.2, upperTop], [cx, bowDip], [cx + hw * 0.2, upperTop], [cx + hw * 0.55, lineY + (upperTop - lineY) * 0.72], R]);
  p.curve(back, false);
  ctx.closePath();
  p.fill(upperLip);
  // Lower lip.
  ctx.beginPath();
  p.curve(lineLR);
  p.curve([R, [cx + hw * 0.5, lowerBottom + 0.0024], [cx, lowerBottom], [cx - hw * 0.5, lowerBottom + 0.0024], L], false);
  ctx.closePath();
  p.fill(lips);
  ctx.beginPath();
  p.ellipse(cx, (lineY + lowerBottom) / 2 - 0.0005, hw * 0.32, (lineY - lowerBottom) * 0.2);
  p.fill('#ffffff', 0.2);
  // Shadow under the lower lip.
  ctx.beginPath();
  p.curve([[cx - hw * 0.4, lowerBottom - 0.0015], [cx, lowerBottom - 0.0028], [cx + hw * 0.4, lowerBottom - 0.0015]]);
  p.stroke(shadeHex(app.skin, 0.72), 2.4, 0.3);
  ctx.beginPath();
  p.curve(lineLR);
  p.stroke(lineColor, 1.8);
  if (look.mouth === 'pout') {
    for (const s of [1, -1]) {
      ctx.beginPath();
      p.move(cx + s * 0.004, lowerBottom - 0.006);
      p.quad(cx + s * 0.008, lowerBottom - 0.009, cx + s * 0.006, lowerBottom - 0.012);
      p.stroke(shadeHex(app.skin, 0.7), 1.4, 0.4);
    }
  }
}

/** Hair cap: hair colour with strands above the hairline, transparent elsewhere (used with alphaTest). */
export function paintHairCap(app: Appearance): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const rng = new Rng(hashSeed(`${app.id}:cap`));
  const style = app.hair.style;
  const line = (a: number): number => hairline(app, a);
  ctx.fillStyle = app.hair.color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= W; x += 4) {
    const a = (x / W - 0.5) * 2 * Math.PI;
    ctx.lineTo(x, (1 - line(a) - rng.range(0, 0.008)) * H);
  }
  ctx.lineTo(W, 0);
  ctx.closePath();
  ctx.fill();
  const inside = (h: number, a: number): number => (h > line(a) ? 1 : 0);
  strands(ctx, rng, 30000, inside, [app.hair.light, app.hair.dark, app.hair.color], {
    len: style === 'quiff' ? [4, 9] : [10, 22],
    width: [1, 2],
    alpha: [0.25, 0.6],
    dir: (h, a) => (style === 'swept' && h > 0.75 ? Math.PI * 0.85 + a * 0.1 : DOWN + Math.sign(a) * 0.15),
  });
  // Ragged edge: strands crossing the hairline downwards.
  const edge = (h: number, a: number): number => {
    const d = h - line(a);
    return d > -0.004 && d < 0.02 ? 1 : 0;
  };
  strands(ctx, rng, 26000, edge, [app.hair.color, app.hair.dark], {
    len: [4, 8],
    width: [1.2, 2.2],
    alpha: [0.85, 1],
    dir: (_h, a) => DOWN + Math.sign(a) * 0.2,
  });
  if (style === 'quiff') {
    // Short sides let some scalp show through.
    const sides = (h: number, a: number): number => (h > line(a) && h < 0.74 && Math.abs(a) > 0.95 ? 0.9 : 0);
    strands(ctx, rng, 30000, sides, [app.skin], { len: [2, 4], width: [1, 1.6], alpha: [0.12, 0.25], dir: () => DOWN });
  }
  return c;
}

/** Beard shell: full beard with a hole for the mouth. */
export function paintBeard(app: Appearance, prof: HeadProfile): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const rng = new Rng(hashSeed(`${app.id}:beard`));
  const density = (h: number, a: number): number => beardDensity(app, prof, h, a);
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const d = density(1 - y / H, (x / W - 0.5) * 2 * Math.PI);
      if (d > 0.55) {
        ctx.fillStyle = app.beard.color;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
  strands(ctx, rng, 40000, (h, a) => (density(h, a) > 0.3 ? 1 : 0), [app.beard.color, app.beard.dark, shadeHex(app.beard.color, 1.2)], {
    len: [5, 11],
    width: [1.2, 2.2],
    alpha: [0.6, 1],
    dir: (h, a) => DOWN - Math.sign(a) * 0.3 * (1 - h),
  });
  // Mouth opening with a soft, hairy rim.
  const p = new FacePainter(ctx, prof);
  const my = app.face.mouth * prof.height;
  const hw = app.face.mouthHalf + 0.002;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  p.move(-hw, my + 0.0005);
  p.bez(-hw * 0.5, my + 0.0072, hw * 0.5, my + 0.0072, hw, my + 0.0005);
  p.bez(hw * 0.75, my - 0.0155, -hw * 0.75, my - 0.0155, -hw, my + 0.0005);
  p.fill('#000');
  ctx.globalCompositeOperation = 'source-over';
  return c;
}
