// The game's own libm: as accurate as the engine's (within an ulp of it) on the ranges the game uses, right on
// the special values, and installed over Math.
import { describe, expect, it } from 'vitest';

const native = { sin: Math.sin, cos: Math.cos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, asin: Math.asin, acos: Math.acos };
const { acos, asin, atan, atan2, cos, exp, sin } = await import('./libm');

const f64 = new Float64Array(1);
const i64 = new BigInt64Array(f64.buffer);
/** Distance in units in the last place (0 for equal, both NaN, or ±0). */
function ulps(a: number, b: number): number {
  if (Number.isNaN(a) && Number.isNaN(b)) return 0;
  if (a === b) return 0;
  f64[0] = a;
  const x = i64[0];
  f64[0] = b;
  const y = i64[0];
  const d = x > y ? x - y : y - x;
  return d > 1000n ? Infinity : Number(d);
}

let seed = 7;
const rnd = (): number => {
  seed = (Math.imul(seed, 1103515245) + 12345) | 0;
  return (seed >>> 0) / 4294967296;
};

const cases: [string, (a: number, b: number) => number, (a: number, b: number) => number, () => [number, number]][] = [
  ['sin', (a) => sin(a), (a) => native.sin(a), () => [(rnd() - 0.5) * 2e4, 0]],
  ['sin small', (a) => sin(a), (a) => native.sin(a), () => [(rnd() - 0.5) * 8, 0]],
  ['cos', (a) => cos(a), (a) => native.cos(a), () => [(rnd() - 0.5) * 2e4, 0]],
  ['cos small', (a) => cos(a), (a) => native.cos(a), () => [(rnd() - 0.5) * 8, 0]],
  ['atan', (a) => atan(a), (a) => native.atan(a), () => [(rnd() - 0.5) * 50, 0]],
  ['atan2', (a, b) => atan2(a, b), (a, b) => native.atan2(a, b), () => [(rnd() - 0.5) * 200, (rnd() - 0.5) * 200]],
  ['exp', (a) => exp(a), (a) => native.exp(a), () => [(rnd() - 0.5) * 60, 0]],
  ['asin', (a) => asin(a), (a) => native.asin(a), () => [rnd() * 2 - 1, 0]],
  ['acos', (a) => acos(a), (a) => native.acos(a), () => [rnd() * 2 - 1, 0]],
];

describe('libm', () => {
  for (const [name, mine, theirs, gen] of cases) {
    it(`${name}: within an ulp of the engine's`, () => {
      let worst = 0;
      for (let k = 0; k < 100_000; k++) {
        const [a, b] = gen();
        worst = Math.max(worst, ulps(mine(a, b), theirs(a, b)));
      }
      expect(worst).toBeLessThanOrEqual(1);
    });
  }

  it('special values', () => {
    for (const f of [sin, cos, atan, exp, asin, acos]) expect(f(NaN)).toBeNaN();
    expect(sin(Infinity)).toBeNaN();
    expect(cos(-Infinity)).toBeNaN();
    expect(Object.is(sin(-0), -0)).toBe(true);
    expect(cos(0)).toBe(1);
    expect(atan(Infinity)).toBe(Math.PI / 2);
    expect(atan2(0, -1)).toBe(Math.PI);
    expect(atan2(-0, -1)).toBe(-Math.PI);
    expect(atan2(1, 0)).toBe(Math.PI / 2);
    expect(atan2(Infinity, Infinity)).toBe(Math.PI / 4);
    expect(atan2(-1, -Infinity)).toBe(-Math.PI);
    expect(exp(0)).toBe(1);
    expect(ulps(exp(1), Math.E)).toBeLessThanOrEqual(1);
    expect(exp(-Infinity)).toBe(0);
    expect(exp(Infinity)).toBe(Infinity);
    expect(exp(800)).toBe(Infinity);
    expect(exp(-800)).toBe(0);
    expect(asin(1)).toBe(Math.PI / 2);
    expect(acos(-1)).toBe(Math.PI);
    expect(acos(1)).toBe(0);
    expect(asin(1.5)).toBeNaN();
    // Large arguments still reduce correctly (to 2^20·π/2, then the engine's own).
    expect(ulps(sin(1e6), native.sin(1e6))).toBeLessThanOrEqual(1);
    expect(ulps(cos(1.5e6), native.cos(1.5e6))).toBeLessThanOrEqual(1);
  });

  it('is what Math uses', () => {
    expect(Math.sin).toBe(sin);
    expect(Math.atan2).toBe(atan2);
    expect(Math.exp).toBe(exp);
  });
});
