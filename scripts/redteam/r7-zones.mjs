// Round 7: Boss.fire 'zone' placement as shipped (src/game/boss.ts, ef7359e) against what its comment promises.
// A barrier that finds no room is stored as NaN in zoneX/zoneZ; every later barrier of the same cast then compares
// its distance against NaN (false) and is dropped too. node scripts/redteam/r7-zones.mjs [casts]
const N = Number(process.argv[2] ?? 20000), GAP = 2.5;
let seed = 777;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
function cast(n, r, L, shipped) {
  const xs = [], zs = [];
  let placed = 0;
  for (let k = 0; k < Math.min(n, 8); k++) {
    let x = 0, z = 0;
    for (let t = 0; t < 8; t++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 0.55 * L;
      x = Math.sin(a) * d; z = Math.cos(a) * d;
      let free = true;
      for (let j = 0; j < k && free; j++) {
        if (!shipped && Number.isNaN(xs[j])) continue; // intended: a missing barrier is no obstacle
        free = Math.hypot(x - xs[j], z - zs[j]) >= 2 * r + GAP;
      }
      if (free) break;
      x = NaN;
    }
    xs[k] = x; zs[k] = Number.isNaN(x) ? NaN : z;
    if (!Number.isNaN(x)) placed++;
  }
  return placed;
}
const CASES = [['bedon P1 Objazd', 2, 5, 54], ['bedon P2 Objazd', 3, 5.5, 54], ['bedon P3 Objazd', 3, 6, 54 * 0.75],
  ['galkowek P1 Teren budowy', 4, 6, 52], ['galkowek P2 Teren budowy', 5, 6.5, 52], ['galkowek P3 Teren budowy', 5, 7, 52 * 0.75]];
console.log('| cast | count | barriers placed, shipped | intended (skip only the missing one) | casts losing a barrier to the NaN |');
console.log('|---|---:|---:|---:|---:|');
for (const [name, n, r, L] of CASES) {
  let a = 0, b = 0, lost = 0;
  for (let i = 0; i < N; i++) {
    const s0 = seed;
    const p = cast(n, r, L, true);
    seed = s0;
    const q = cast(n, r, L, false);
    a += p; b += q; if (q > p) lost++;
  }
  console.log(`| ${name} | ${n} | ${(a / N).toFixed(2)} | ${(b / N).toFixed(2)} | ${(100 * lost / N).toFixed(1)}% |`);
}
