// The game's own sin, cos, atan, atan2, exp, asin and acos: ports of musl's (fdlibm) double routines that use
// only IEEE arithmetic, so they give the same bits in every browser and in Node. The engines' own versions do
// not: V8 in Node 24 and in Chromium 158 disagree on 3-18 % of inputs (measured), so the headless simulation
// could never replay a browser run exactly. Installed over `Math` before anything else runs (`installLibm`),
// which covers three.js and every module alike. (pow, hypot and sqrt agree everywhere they were measured and
// stay native.) ponytail: |x| over 2^20·π/2 (≈1.6e6) in sin/cos falls back to the engine's own; nothing in the
// simulation comes near it.

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
// Little-endian everywhere the game runs: word 1 is the high one.
const high = (x: number): number => {
  f64[0] = x;
  return u32[1];
};
const low = (): number => u32[0];

const nativeSin = Math.sin;
const nativeCos = Math.cos;

// ---------- sin, cos ----------

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

function kSin(x: number, y: number, iy: number): number {
  const z = x * x;
  const w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

function kCos(x: number, y: number): number {
  const z = x * x;
  let w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  w = 1.0 - hz;
  return w + (1.0 - w - hz + (z * r - x * y));
}

const TOINT = 1.5 / 2.220446049250313e-16;
const PIO4 = 7.85398163397448278999e-1;
const INVPIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.02226624871116645580e-21;
const PIO2_3T = 8.47842766036889956997e-32;

/** x reduced by multiples of π/2 (musl's medium case, valid to 2^20·π/2): the remainder in `ry0 + ry1`. */
let ry0 = 0;
let ry1 = 0;
function remPio2(x: number, ix: number): number {
  let fn = x * INVPIO2 + TOINT - TOINT;
  let n = fn | 0;
  let r = x - fn * PIO2_1;
  let w = fn * PIO2_1T;
  if (r - w < -PIO4) {
    n--;
    fn--;
    r = x - fn * PIO2_1;
    w = fn * PIO2_1T;
  } else if (r - w > PIO4) {
    n++;
    fn++;
    r = x - fn * PIO2_1;
    w = fn * PIO2_1T;
  }
  ry0 = r - w;
  const ex = ix >>> 20;
  let ey = (high(ry0) >>> 20) & 0x7ff;
  if (ex - ey > 16) {
    let t = r;
    w = fn * PIO2_2;
    r = t - w;
    w = fn * PIO2_2T - (t - r - w);
    ry0 = r - w;
    ey = (high(ry0) >>> 20) & 0x7ff;
    if (ex - ey > 49) {
      t = r;
      w = fn * PIO2_3;
      r = t - w;
      w = fn * PIO2_3T - (t - r - w);
      ry0 = r - w;
    }
  }
  ry1 = r - ry0 - w;
  return n;
}

export function sin(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e500000) return x;
    return kSin(x, 0, 0);
  }
  if (ix >= 0x7ff00000) return x - x;
  if (ix >= 0x413921fb) return nativeSin(x);
  const n = remPio2(x, ix);
  switch (n & 3) {
    case 0:
      return kSin(ry0, ry1, 1);
    case 1:
      return kCos(ry0, ry1);
    case 2:
      return -kSin(ry0, ry1, 1);
    default:
      return -kCos(ry0, ry1);
  }
}

export function cos(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e46a09e) return 1.0;
    return kCos(x, 0);
  }
  if (ix >= 0x7ff00000) return x - x;
  if (ix >= 0x413921fb) return nativeCos(x);
  const n = remPio2(x, ix);
  switch (n & 3) {
    case 0:
      return kCos(ry0, ry1);
    case 1:
      return -kSin(ry0, ry1, 1);
    case 2:
      return -kCos(ry0, ry1);
    default:
      return kSin(ry0, ry1, 1);
  }
}

// ---------- atan, atan2 ----------

const ATANHI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT0 = 3.33333333333329318027e-1;
const AT1 = -1.99999999998764832476e-1;
const AT2 = 1.42857142725034663711e-1;
const AT3 = -1.11111104054623557880e-1;
const AT4 = 9.09088713343650656196e-2;
const AT5 = -7.69187620504482999495e-2;
const AT6 = 6.66107313738753120669e-2;
const AT7 = -5.83357013379057348645e-2;
const AT8 = 4.97687799461593236017e-2;
const AT9 = -3.65315727442169155270e-2;
const AT10 = 1.62858201153657823623e-2;

export function atan(x: number): number {
  const hx = high(x);
  const sign = hx >>> 31;
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    if (x !== x) return x;
    return sign ? -ATANHI[3] : ATANHI[3];
  }
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e400000) return x;
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2.0 * x - 1.0) / (2.0 + x);
      } else {
        id = 1;
        x = (x - 1.0) / (x + 1.0);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1.0 + 1.5 * x);
    } else {
      id = 3;
      x = -1.0 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT0 + w * (AT2 + w * (AT4 + w * (AT6 + w * (AT8 + w * AT10)))));
  const s2 = w * (AT1 + w * (AT3 + w * (AT5 + w * (AT7 + w * AT9))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id] - (x * (s1 + s2) - ATANLO[id] - x);
  return sign ? -r : r;
}

const PI = 3.1415926535897931160;
const PI_LO = 1.2246467991473532e-16;

export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return x + y;
  let ix = high(x);
  const lx = low();
  let iy = high(y);
  const ly = low();
  if (((ix - 0x3ff00000) | lx) === 0) return atan(y);
  const m = ((iy >>> 31) & 1) | ((ix >>> 30) & 2);
  ix &= 0x7fffffff;
  iy &= 0x7fffffff;
  if ((iy | ly) === 0) {
    switch (m) {
      case 0:
      case 1:
        return y;
      case 2:
        return PI;
      default:
        return -PI;
    }
  }
  if ((ix | lx) === 0) return m & 1 ? -PI / 2 : PI / 2;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) {
      switch (m) {
        case 0:
          return PI / 4;
        case 1:
          return -PI / 4;
        case 2:
          return (3 * PI) / 4;
        default:
          return (-3 * PI) / 4;
      }
    }
    switch (m) {
      case 0:
        return 0.0;
      case 1:
        return -0.0;
      case 2:
        return PI;
      default:
        return -PI;
    }
  }
  if (ix + (64 << 20) < iy || iy === 0x7ff00000) return m & 1 ? -PI / 2 : PI / 2;
  const z = m & 2 && iy + (64 << 20) < ix ? 0 : atan(Math.abs(y / x));
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

// ---------- exp ----------

const LN2HI = 6.93147180369123816490e-1;
const LN2LO = 1.90821492927058770002e-10;
const INVLN2 = 1.44269504088896338700;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.65339022054652515390e-6;
const P5 = 4.13813679705723846039e-8;

/** 2^n as a double, built from its bits (-1022 <= n <= 1023). */
function pow2(n: number): number {
  u32[1] = (0x3ff + n) << 20;
  u32[0] = 0;
  return f64[0];
}

function scalbn(y: number, n: number): number {
  if (n > 1023) {
    y *= pow2(1023);
    n -= 1023;
    if (n > 1023) {
      y *= pow2(1023);
      n -= 1023;
      if (n > 1023) n = 1023;
    }
  } else if (n < -1022) {
    y *= pow2(-1022) * pow2(53);
    n += 1022 - 53;
    if (n < -1022) {
      y *= pow2(-1022) * pow2(53);
      n += 1022 - 53;
      if (n < -1022) n = -1022;
    }
  }
  return y * pow2(n);
}

export function exp(x: number): number {
  let hx = high(x);
  const sign = hx >>> 31;
  hx &= 0x7fffffff;
  if (hx >= 0x4086232b) {
    if (x !== x) return x;
    if (x > 709.782712893383973096) return x * pow2(1023);
    if (x < -745.13321910194110842) return 0;
  }
  let k: number;
  let hi: number;
  let lo: number;
  if (hx > 0x3fd62e42) {
    k = hx >= 0x3ff0a2b2 ? (INVLN2 * x + (sign ? -0.5 : 0.5)) | 0 : 1 - sign - sign;
    hi = x - k * LN2HI;
    lo = k * LN2LO;
    x = hi - lo;
  } else if (hx > 0x3e300000) {
    k = 0;
    hi = x;
    lo = 0;
  } else {
    return 1 + x;
  }
  const xx = x * x;
  const c = x - xx * (P1 + xx * (P2 + xx * (P3 + xx * (P4 + xx * P5))));
  const y = 1 + ((x * c) / (2 - c) - lo + hi);
  return k === 0 ? y : scalbn(y, k);
}

// ---------- asin, acos ----------

const PIO2_HI = 1.57079632679489655800;
/** 2^-120: makes asin(±1) and acos round like musl's (inexact). */
const TINY = 7.52316384526264e-37;
const PIO2_LO = 6.12323399573676603587e-17;
const PS0 = 1.66666666666666657415e-1;
const PS1 = -3.25565818622400915405e-1;
const PS2 = 2.01212532134862925881e-1;
const PS3 = -4.00555345006794114027e-2;
const PS4 = 7.91534994289814532176e-4;
const PS5 = 3.47933107596021167570e-5;
const QS1 = -2.40339491173441421878;
const QS2 = 2.02094576023350569471;
const QS3 = -6.88283971605453293030e-1;
const QS4 = 7.70381505559019352791e-2;

function rat(z: number): number {
  const p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5)))));
  const q = 1.0 + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4)));
  return p / q;
}

/** x with its low 32 bits cleared. */
function hiPart(x: number): number {
  f64[0] = x;
  u32[0] = 0;
  return f64[0];
}

export function asin(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    const lx = low();
    if (((ix - 0x3ff00000) | lx) === 0) return x * PIO2_HI + TINY;
    return 0 / (x - x);
  }
  if (ix < 0x3fe00000) {
    if (ix < 0x3e500000 && ix >= 0x00100000) return x;
    return x + x * rat(x * x);
  }
  const z = (1 - Math.abs(x)) * 0.5;
  const s = Math.sqrt(z);
  const r = rat(z);
  let out: number;
  if (ix >= 0x3fef3333) {
    out = PIO2_HI - (2 * (s + s * r) - PIO2_LO);
  } else {
    const f = hiPart(s);
    const c = (z - f * f) / (s + f);
    out = 0.5 * PIO2_HI - (2 * s * r - (PIO2_LO - 2 * c) - (0.5 * PIO2_HI - 2 * f));
  }
  return hx >>> 31 ? -out : out;
}

export function acos(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    const lx = low();
    if (((ix - 0x3ff00000) | lx) === 0) return hx >>> 31 ? 2 * PIO2_HI + TINY : 0;
    return 0 / (x - x);
  }
  if (ix < 0x3fe00000) {
    if (ix <= 0x3c600000) return PIO2_HI + TINY;
    return PIO2_HI - (x - (PIO2_LO - x * rat(x * x)));
  }
  if (hx >>> 31) {
    const z = (1.0 + x) * 0.5;
    const s = Math.sqrt(z);
    const w = rat(z) * s - PIO2_LO;
    return 2 * (PIO2_HI - (s + w));
  }
  const z = (1.0 - x) * 0.5;
  const s = Math.sqrt(z);
  const df = hiPart(s);
  const c = (z - df * df) / (s + df);
  const w = rat(z) * s + c;
  return 2 * (df + w);
}

/** Puts these over the engine's own, once, before anything else runs. */
export function installLibm(): void {
  const m = Math as unknown as Record<string, unknown>;
  if (m.sin === sin) return;
  Object.assign(m, { sin, cos, atan, atan2, exp, asin, acos });
}

installLibm();
