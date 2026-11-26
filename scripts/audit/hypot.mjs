// Audit: is this Node's Math.hypot correctly rounded? (src/core/libm.ts pins sin/cos/atan/atan2/exp/asin/acos, not
// hypot or pow; a function that is not correctly rounded can change between V8 versions.) Usage: node scripts/audit/hypot.mjs
const N = 200000;
const exact = (x, y) => {
  // x² + y² exactly: doubles are m·2^e, scale both to a common exponent.
  const parts = (v) => {
    const b = new DataView(new ArrayBuffer(8));
    b.setFloat64(0, Math.abs(v));
    const hi = b.getUint32(0);
    const lo = b.getUint32(4);
    const e = (hi >>> 20) & 0x7ff;
    const m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    return e === 0 ? [m, -1074] : [m | (1n << 52n), e - 1075];
  };
  const [mx, ex] = parts(x);
  const [my, ey] = parts(y);
  const e = Math.min(ex, ey);
  const s = (mx << BigInt(ex - e)) ** 2n + (my << BigInt(ey - e)) ** 2n; // value = s · 2^(2e)
  // sqrt(s) with 64 extra bits, then to the nearest double.
  const shift = 128n;
  let r = BigInt(Math.floor(Math.sqrt(Number(s)))) << 64n;
  const t = s << shift;
  for (let k = 0; k < 8; k++) r = (r + t / r) >> 1n; // Newton on t = s·2^128, r ≈ sqrt(s)·2^64
  return Number(r) * 2 ** (e - 64); // Number(r) rounds to 53 bits: close enough to flag 1-ulp misses
};
let miss = 0;
let x = 1;
const rnd = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296);
for (let k = 0; k < N; k++) {
  const a = (rnd() - 0.5) * 100;
  const b = (rnd() - 0.5) * 100;
  if (Math.hypot(a, b) !== exact(a, b)) miss++;
}
let sq = 0;
x = 1;
for (let k = 0; k < N; k++) {
  const a = (rnd() - 0.5) * 100;
  const b = (rnd() - 0.5) * 100;
  if (Math.hypot(a, b) !== Math.sqrt(a * a + b * b)) sq++;
}
console.log(`${process.version}: Math.hypot differs from the correctly rounded value in ${miss} of ${N}; from sqrt(a*a+b*b) in ${sq} of ${N}`);
