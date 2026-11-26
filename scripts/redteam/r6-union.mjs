// Round 6: exact full-speed escape from a union of zone disks (straight line to the nearest point outside all of
// them: radial projections and pairwise circle intersections), zones placed as Boss.telegraph does round Piotrek.
// node scripts/redteam/r6-union.mjs [casts]
const PR = 0.38, RUN = 7.2, ESC = 0.85, N = Number(process.argv[2] ?? 20000);
let seed = 777;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const warn = (tele, r) => Math.max(0.3, tele, (r + 0.4) / (RUN * ESC));
function exitDist(p, ds, L) {
  const ins = (x, z) => ds.some((d) => (x - d.x) ** 2 + (z - d.z) ** 2 < d.r * d.r - 1e-9);
  const ok = (x, z) => !ins(x, z) && x * x + z * z < (L - PR - 0.4) ** 2;
  let best = Infinity;
  const tryPt = (x, z) => { if (ok(x, z)) best = Math.min(best, Math.hypot(x - p.x, z - p.z)); };
  for (const d of ds) {
    const dd = Math.hypot(p.x - d.x, p.z - d.z) || 1e-9;
    tryPt(d.x + ((p.x - d.x) / dd) * (d.r + 1e-6), d.z + ((p.z - d.z) / dd) * (d.r + 1e-6));
  }
  for (let i = 0; i < ds.length; i++)
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i], b = ds[j], D = Math.hypot(b.x - a.x, b.z - a.z);
      if (D >= a.r + b.r || D <= Math.abs(a.r - b.r)) continue;
      const l = (a.r * a.r - b.r * b.r + D * D) / (2 * D), h = Math.sqrt(a.r * a.r - l * l);
      const mx = a.x + ((b.x - a.x) * l) / D, mz = a.z + ((b.z - a.z) * l) / D;
      for (const s of [1, -1]) {
        const x = mx + (s * h * -(b.z - a.z)) / D, z = mz + (s * h * (b.x - a.x)) / D;
        // Nudged out of both discs (along the sum of their outward normals), not along p→x.
        const ux = (x - a.x) / a.r + (x - b.x) / b.r, uz = (z - a.z) / a.r + (z - b.z) / b.r, m = Math.hypot(ux, uz) || 1;
        tryPt(x + (ux / m) * 1e-4, z + (uz / m) * 1e-4);
      }
    }
  // Where a zone's edge meets the arena wall (an exit along the wall).
  const Lw = L - PR - 0.4 - 1e-4;
  for (const a of ds) {
    const D = Math.hypot(a.x, a.z);
    if (D >= a.r + Lw || D <= Math.abs(a.r - Lw) || D === 0) continue;
    const l = (Lw * Lw - a.r * a.r + D * D) / (2 * D), h = Math.sqrt(Math.max(0, Lw * Lw - l * l));
    const mx = (a.x * l) / D, mz = (a.z * l) / D;
    for (const sg of [1, -1]) tryPt(mx + (sg * h * -a.z) / D - (a.x / D) * 1e-3, mz + (sg * h * a.x) / D - (a.z / D) * 1e-3);
  }
  return best;
}
for (const [name, tele, r, n, L] of [['niciarniana P3 Pajęczyna', 0.5, 5.5, 5, 56 * 0.75], ['niciarniana P2 Pajęczyna', 0.6, 5, 4, 56], ['justynow P3 Prosto z góry', 0.6, 4.5, 5, 50], ['zakowice P3 Peron odwołany', 0.5, 6.5, 5, 54 * 0.75], ['widzew P3 Nikt nie wysiada', 0.6, 6, 4, 62], ['koluszki Rozlana kawa', 0.7, 4.5, 4, 40]]) {
  const w = warn(tele, r);
  let caught = 0, bad = 0, worst = 0;
  for (let s = 0; s < N; s++) {
    const a0 = rnd() * Math.PI * 2, d0 = Math.sqrt(rnd()) * 0.8 * L, p = { x: Math.sin(a0) * d0, z: Math.cos(a0) * d0 };
    const ds = Array.from({ length: n }, () => { const a = rnd() * Math.PI * 2, d = rnd() * 0.55 * L; return { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d, r: r + PR }; });
    if (!ds.some((d) => (p.x - d.x) ** 2 + (p.z - d.z) ** 2 < d.r * d.r)) continue;
    caught++;
    const t = exitDist(p, ds, L) / RUN;
    if (t > w) { bad++; worst = Math.max(worst, t); }
  }
  console.log(`${name}: warn ${w.toFixed(3)} s, caught ${caught}/${N}, unescapable at full speed ${bad} (${((100 * bad) / caught).toFixed(2)}% of catches), worst exit ${worst.toFixed(3)} s`);
}
