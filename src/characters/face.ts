import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Appearance, Expression } from '../content/characters';
import { Rng, hashSeed } from '../core/rng';
import { beardTop, hairline, smoothstep, type HeadProfile } from './head';

// Textures share the head's UV layout: u = 0.5 + angle / 2π (front in the middle), v = height fraction.
const W = 1024;
const H = 512;

interface Look {
  /** Upper-lid opening 0..1, extra opening for the +x eye. */
  lid: number;
  lidAsym: number;
  /** Lid slant: > 0 lowers the inner part (anger). */
  slant: number;
  /** Brow ends in metres: inner, outer; extra lift of the +x brow. */
  browIn: number;
  browOut: number;
  browAsym: number;
  look: [number, number];
  blush: number;
  mouth: 'line' | 'shout' | 'smirk' | 'pout';
}

const LOOKS: Record<Expression, Look> = {
  neutral: { lid: 0.86, lidAsym: 0, slant: 0, browIn: 0, browOut: 0, browAsym: 0, look: [0, 0], blush: 0.16, mouth: 'line' },
  angry: { lid: 0.78, lidAsym: 0, slant: 1, browIn: -0.0075, browOut: 0.003, browAsym: 0, look: [0, 0.0006], blush: 0.3, mouth: 'shout' },
  smirk: { lid: 0.56, lidAsym: -0.08, slant: 0.15, browIn: 0.001, browOut: 0.001, browAsym: 0.0055, look: [-0.0022, 0], blush: 0.14, mouth: 'smirk' },
  butthurt: { lid: 0.74, lidAsym: 0, slant: -0.6, browIn: 0.006, browOut: -0.0025, browAsym: 0, look: [0.0012, -0.0012], blush: 0.42, mouth: 'pout' },
};

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
export function beardDensity(app: Appearance, h: number, a: number): number {
  const x = Math.abs(a);
  const f = app.face;
  if (app.beard.style === 'full') {
    const top = beardTop(app, a);
    const edge = 1 - smoothstep(top - 0.03, top + 0.01, h);
    return x > 2.4 ? 0 : edge;
  }
  // Jawline beard: along the jaw from the sideburns to the chin, faint moustache, clean cheeks.
  const m = f.mouth;
  const jawTop = m - 0.11 + Math.max(0, x - 0.75) * 0.5;
  const jaw = x < 1.55 ? 1 - smoothstep(jawTop - 0.025, jawTop + 0.015, h) : h < 0.12 ? 1 - smoothstep(1.6, 2.1, x) : 0;
  const chin = x < 0.75 ? 1 - smoothstep(m - 0.09, m - 0.065, h) : 0;
  const soul = x < 0.16 && h > m - 0.07 && h < m - 0.042 ? 0.55 : 0;
  const stache = x < 0.3 && h > m + 0.03 && h < f.nose - 0.02 ? 0.16 : 0;
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
    p.quad(s * (L.mouthHalf + 0.006), (L.nose - 0.02) * Hm, s * (L.mouthHalf + 0.004), (L.mouth + 0.01) * Hm);
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

  // Facial hair painted into the skin (the full beard also gets a 3D shell on top).
  const full = app.beard.style === 'full';
  strands(ctx, rng, full ? 26000 : 20000, (h, a) => beardDensity(app, h, a), [app.beard.color, app.beard.dark, shadeHex(app.beard.color, 1.15)], {
    len: full ? [4, 9] : [2.5, 5],
    width: full ? [1.2, 2] : [1, 1.5],
    alpha: full ? [0.6, 0.95] : [0.45, 0.85],
    dir: (h, a) => DOWN - Math.sign(a) * 0.25 * (1 - h),
  });

  // Nostrils.
  for (const s of [1, -1]) {
    ctx.beginPath();
    p.ellipse(s * (L.noseHalf * 0.45), (L.nose + 0.004) * Hm, 0.0045, 0.0019);
    p.fill(shadeHex(app.skin, expr === 'angry' ? 0.38 : 0.5), 0.75);
  }

  for (const s of [1, -1] as const) eye(p, app, look, s);
  for (const s of [1, -1] as const) brow(p, app, look, s, rng);
  mouth(p, app, look);

  // Expression extras.
  const bY = L.brows * Hm;
  const mY = L.mouth * Hm;
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
  const Hm = p.prof.height;
  const ex = s * app.face.eyeX;
  const ey = app.face.eyes * Hm;
  const k = app.eyes.size;
  const ew = 0.0188 * k;
  const eh = 0.0098 * k;
  const open = Math.max(0.2, (look.lid + (s === 1 ? look.lidAsym : 0)) * app.eyes.lid);
  const innerX = ex - s * ew;
  const outerX = ex + s * ew;
  const innerY = ey + 0.0008;
  const outerY = ey + 0.0022 - look.slant * 0.0012;

  const upper = (): void => {
    p.move(innerX, innerY);
    p.bez(ex - s * ew * 0.5, ey + eh * 1.55 * open - look.slant * 0.0045, ex + s * ew * 0.45, ey + eh * 1.6 * open, outerX, outerY);
  };
  const lower = (): void => {
    p.bez(ex + s * ew * 0.45, ey - eh * 1.05, ex - s * ew * 0.45, ey - eh * 1.1, innerX, innerY);
  };

  ctx.save();
  ctx.beginPath();
  upper();
  lower();
  ctx.closePath();
  p.fill('#f5f0ea');
  ctx.clip();
  const [lx, ly] = look.look;
  const ir = 0.0079 * k;
  const [ix, iy] = p.px(ex + lx, ey + ly - 0.0004);
  const [ix2] = p.px(ex + lx + ir, ey);
  const irx = Math.abs(ix2 - ix);
  const iry = (ir / Hm) * H;
  const g = ctx.createRadialGradient(ix, iy, irx * 0.2, ix, iy, irx);
  g.addColorStop(0, shadeHex(app.eyes.iris, 1.18));
  g.addColorStop(0.7, app.eyes.iris);
  g.addColorStop(1, shadeHex(app.eyes.iris, 0.55));
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx * 0.42, iry * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#16100e';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ix - irx * 0.35, iy - iry * 0.4, irx * 0.2, iry * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Shadow of the upper lid on the eyeball.
  ctx.beginPath();
  upper();
  p.line(outerX, outerY + 0.002);
  p.line(innerX, innerY + 0.002);
  ctx.closePath();
  p.fill('#5a3a32', 0.28);
  ctx.restore();

  // Lid fold above the lash line: heavier lids read as the real, relaxed eyes rather than cartoon ones.
  ctx.beginPath();
  upper();
  p.bez(ex + s * ew * 0.45, ey + eh * 2.15 + 0.0015, ex - s * ew * 0.4, ey + eh * 2.0 * open + 0.003, innerX, innerY);
  ctx.closePath();
  p.fill(shadeHex(app.skin, 0.82), 0.55);
  ctx.beginPath();
  upper();
  p.stroke('#2a1b17', 3.4);
  ctx.beginPath();
  p.move(outerX, outerY);
  p.line(outerX + s * 0.0035, outerY + 0.0016);
  p.stroke('#2a1b17', 2.4);
  ctx.beginPath();
  p.move(outerX, outerY);
  lower();
  p.stroke(shadeHex(app.skin, 0.6), 1.3, 0.55);
  ctx.beginPath();
  p.move(innerX + s * 0.002, innerY + 0.006);
  p.bez(ex - s * ew * 0.3, ey + eh * 2.1 * open + 0.004, ex + s * ew * 0.5, ey + eh * 2.1 + 0.002, outerX - s * 0.001, outerY + 0.0055);
  p.stroke(shadeHex(app.skin, 0.68), 1.6, 0.4);
}

function brow(p: FacePainter, app: Appearance, look: Look, s: 1 | -1, rng: Rng): void {
  const ctx = p.ctx;
  const Hm = p.prof.height;
  const ex = s * app.face.eyeX;
  const by = app.face.brows * Hm + (s === 1 ? look.browAsym : 0);
  const T = app.brows.thickness;
  const inner: [number, number] = [ex - s * 0.019, by + look.browIn - app.brows.tilt * 0.002];
  const peak: [number, number] = [ex + s * 0.006, by + 0.0035 + app.brows.arch * 0.003 + (look.browIn + look.browOut) * 0.4];
  const outer: [number, number] = [ex + s * 0.026, by - 0.0015 + look.browOut + app.brows.tilt * 0.002];
  const ti = 0.0068 * T;
  const tp = 0.006 * T;
  const to = 0.0026 * T;
  ctx.beginPath();
  p.move(inner[0], inner[1] - ti / 2);
  p.line(inner[0], inner[1] + ti / 2);
  p.quad(peak[0] - s * 0.008, peak[1] + tp / 2 + 0.001, peak[0], peak[1] + tp / 2);
  p.quad(outer[0] - s * 0.006, outer[1] + to, outer[0], outer[1]);
  p.quad(outer[0] - s * 0.006, outer[1] - to * 0.6, peak[0], peak[1] - tp / 2);
  p.quad(peak[0] - s * 0.008, peak[1] - tp / 2, inner[0], inner[1] - ti / 2);
  ctx.closePath();
  p.fill(app.brows.color);
  // Individual hairs on top for texture.
  for (let i = 0; i < 70; i++) {
    const t = rng.next();
    const x = inner[0] + (outer[0] - inner[0]) * t;
    const yMid = t < 0.4 ? inner[1] + (peak[1] - inner[1]) * (t / 0.4) : peak[1] + (outer[1] - peak[1]) * ((t - 0.4) / 0.6);
    const th = (t < 0.4 ? ti + (tp - ti) * (t / 0.4) : tp + (to - tp) * ((t - 0.4) / 0.6)) * 0.55;
    const y = yMid + rng.range(-th, th);
    ctx.beginPath();
    p.move(x, y);
    p.line(x + s * rng.range(0.002, 0.004), y + rng.range(0.0005, 0.002));
    p.stroke(rng.next() < 0.5 ? shadeHex(app.brows.color, 0.7) : shadeHex(app.brows.color, 1.25), 1.1, 0.7);
  }
}

function mouth(p: FacePainter, app: Appearance, look: Look): void {
  const ctx = p.ctx;
  const my = app.face.mouth * p.prof.height;
  const lips = app.lips;
  const upperLip = shadeHex(lips, 0.88);
  const line = shadeHex(lips, 0.5);
  const mw = app.face.mouthHalf;

  if (look.mouth === 'shout') {
    const shape = (): void => {
      p.move(-mw * 0.9, my - 0.002);
      p.bez(-mw * 0.65, my + 0.006, mw * 0.65, my + 0.006, mw * 0.9, my - 0.002);
      p.bez(mw * 0.7, my - 0.016, -mw * 0.7, my - 0.016, -mw * 0.9, my - 0.002);
    };
    ctx.beginPath();
    shape();
    p.fill('#3a1416');
    ctx.save();
    ctx.beginPath();
    shape();
    ctx.clip();
    ctx.beginPath();
    p.move(-mw * 0.8, my + 0.006);
    p.line(mw * 0.8, my + 0.006);
    p.line(mw * 0.7, my + 0.0005);
    p.line(-mw * 0.7, my + 0.0005);
    ctx.closePath();
    p.fill('#f3efe6');
    ctx.beginPath();
    p.ellipse(0, my - 0.0125, mw * 0.45, 0.0042);
    p.fill('#b5485a');
    ctx.restore();
    ctx.beginPath();
    shape();
    p.stroke(lips, 4.2);
    return;
  }

  let l: [number, number];
  let r: [number, number];
  let lowerDepth = 0.0084;
  let bow = 0.0048;
  let curve = -0.0004;
  if (look.mouth === 'smirk') {
    l = [-mw * 0.9, my - 0.0008];
    r = [mw * 1.06, my + 0.0058];
    lowerDepth = 0.0052;
    bow = 0.003;
    curve = 0.0006;
  } else if (look.mouth === 'pout') {
    l = [-mw * 0.8, my - 0.0048];
    r = [mw * 0.8, my - 0.0048];
    lowerDepth = 0.0105;
    bow = 0.005;
    curve = 0.0012;
  } else {
    l = [-mw, my];
    r = [mw, my];
  }
  const mid: [number, number] = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2 + curve];

  // Upper lip with a cupid's bow.
  ctx.beginPath();
  p.move(...l);
  p.bez(l[0] * 0.55, l[1] + bow * 0.75, -mw * 0.3, my + bow, -0.0022, my + bow * 0.85);
  p.quad(0, my + bow * 0.7, 0.0022, my + bow * 0.85);
  p.bez(mw * 0.3, my + bow, r[0] * 0.55, r[1] + bow * 0.75, ...r);
  p.quad(mid[0], mid[1], ...l);
  p.fill(upperLip);
  // Lower lip.
  ctx.beginPath();
  p.move(...l);
  p.quad(mid[0], mid[1], ...r);
  p.bez(r[0] * 0.6, r[1] - lowerDepth, l[0] * 0.6, l[1] - lowerDepth, ...l);
  p.fill(lips);
  ctx.beginPath();
  p.ellipse(mid[0], my - lowerDepth * 0.55, Math.abs(r[0] - l[0]) * 0.22, lowerDepth * 0.22);
  p.fill('#ffffff', 0.22);
  // Line between the lips.
  ctx.beginPath();
  p.move(...l);
  p.quad(mid[0], mid[1], ...r);
  p.stroke(line, 1.8);
  if (look.mouth === 'pout') {
    for (const s of [1, -1]) {
      ctx.beginPath();
      p.move(s * 0.004, my - 0.016);
      p.quad(s * 0.008, my - 0.019, s * 0.006, my - 0.022);
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
  const density = (h: number, a: number): number => beardDensity(app, h, a);
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
