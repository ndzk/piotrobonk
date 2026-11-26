// Red team round 6: escape.mjs against the round-6 rules. Barrier ('block') zones keep 2·r + 2,5 m between
// centres (8 tries each, else one fewer: Boss.telegraph), warnings use Piotrek's speed at the wind-up (×0,55 when
// slowed in the last 0,5 s: game.ts bossStep, Boss.warn). Same geometry as escape.mjs otherwise.
// node scripts/redteam/r6-escape.mjs [samples]
const PR = 0.38, RUN = 7.2, SLOW = 0.55, ESC = 0.85, H = Number(process.env.GRID ?? 0.1), N = Number(process.argv[2] ?? 400), GAP = 2.5;
const warn = (tele, r, slowed = false) => Math.max(0.3, tele, (r + 0.4) / (RUN * (slowed ? SLOW : 1) * ESC));
let seed = 4242;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
/** Boss.telegraph's zone placement; `block` keeps the gap. Returned radii include Piotrek's. */
const place = (p, n, r, L, block = false) => {
  const out = [];
  for (let k = 0; k < Math.min(n, 8); k++) {
    let q = null;
    for (let t = 0; t < 8; t++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 0.55 * L;
      const c = { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d, r: r + PR };
      if (!block || out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= 2 * r + GAP)) { q = c; break; }
    }
    if (q) out.push(q);
  }
  return out;
};
const inside = (q, ds) => ds.some((d) => (q.x - d.x) ** 2 + (q.z - d.z) ** 2 < d.r * d.r);
const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [1, 2], [-2, 1], [-1, 2], [2, -1], [1, -2], [-2, -1], [-1, -2]].map(([a, b]) => [a, b, Math.hypot(a, b) * H]);
function reach(p, goal, { block = [], slow = [], L, cap }) {
  const W = Math.ceil((RUN * cap + 1) / H), S = 2 * W + 1, t = new Float64Array(S * S).fill(Infinity);
  const ok = (x, z) => x * x + z * z < (L - PR - 0.4) ** 2 && !inside({ x, z }, block);
  const heap = [];
  const push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  const c0 = W * S + W; t[c0] = 0; push(c0, 0);
  const pts = [];
  while (heap.length) {
    const [v, k] = pop();
    if (v > t[k]) continue;
    if (v > cap) return { time: Infinity, pts };
    const ix = (k % S) - W, iz = Math.floor(k / S) - W, x = p.x + ix * H, z = p.z + iz * H;
    if (goal({ x, z })) { if (!pts.length) pts.time = v; pts.push({ x, z, v }); if (!goal.all) return { time: v, pts }; continue; }
    const sp = inside({ x, z }, slow) ? RUN * SLOW : RUN;
    for (const [a, b, d] of STEPS) {
      const nx = ix + a, nz = iz + b;
      if (nx < -W || nx > W || nz < -W || nz > W) continue;
      const qx = p.x + nx * H, qz = p.z + nz * H;
      if (!ok(qx, qz)) continue;
      const nk = (nz + W) * S + nx + W, nv = v + d / sp;
      if (nv < t[nk]) { t[nk] = nv; push(nk, nv); }
    }
  }
  return { time: pts.length ? pts.time : Infinity, pts };
}
const pushOut = (p, block) => { for (let it = 0; it < 2000; it++) { const d = block.find((b) => (p.x - b.x) ** 2 + (p.z - b.z) ** 2 < b.r * b.r); if (!d) break; const dd = Math.hypot(p.x - d.x, p.z - d.z) || 1; p = { x: d.x + ((p.x - d.x) / dd) * (d.r + 1e-6), z: d.z + ((p.z - d.z) / dd) * (d.r + 1e-6) }; } return p; };
const startPos = (L) => { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.8 * L; return { x: Math.sin(a) * d, z: Math.cos(a) * d }; };
const pct = (a, b) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;

// 1) Zones aimed at Piotrek. Slowed: centre of an old slow zone within r of them (warning at the slowed speed).
//    Beside: they stand just outside an old slow zone (0..1 m past its edge, not slowed: full-speed warning).
const ZONES = [
  ['fabryczna P2 Kolejka do kasy', 0.8, 4, 3, 60, false], ['niciarniana P1 Pajęczyna', 0.8, 4.5, 3, 56, true], ['niciarniana P2 Pajęczyna', 0.6, 5, 4, 56, true],
  ['niciarniana P3 Pajęczyna', 0.5, 5.5, 5, 56 * 0.75, true], ['widzew P1 Strefa kontroli', 0.8, 5, 3, 62, false], ['widzew P2 Strefa kontroli', 0.6, 5.5, 4, 62, false],
  ['widzew P3 Nikt nie wysiada (after charge)', 0.6, 6, 4, 62, false], ['justynow P3 Prosto z góry', 0.6, 4.5, 5, 50, true], ['zakowice P2 Peron odwołany', 0.6, 6, 4, 54, false],
  ['zakowice P3 Peron odwołany', 0.5, 6.5, 5, 54 * 0.75, false], ['koluszki Rozlana kawa', 0.7, 4.5, 4, 40, true],
];
console.log(`\n## Zones aimed at Piotrek: casts they cannot walk out of before the first bite (${String(N)} casts each)`);
console.log('| attack | warn s (slowed) | caught | unescapable, full speed | unescapable, in an old slow zone | unescapable, beside an old slow zone |\n|---|---:|---:|---:|---:|---:|');
for (const [name, tele, r, n, L, slows] of ZONES) {
  const w = warn(tele, r), ws = warn(tele, r, true);
  let caught = 0, bad = 0, badSlow = 0, badBeside = 0, worstB = 0, worstS = 0;
  for (let s = 0; s < N; s++) {
    const p = startPos(L), zs = place(p, n, r, L);
    if (!inside(p, zs)) continue;
    caught++;
    const tf = reach(p, (q) => !inside(q, zs), { L, cap: w + 0.3 }).time;
    if (tf > w) { bad++; worstS = Math.max(worstS, tf / w); }
    if (slows) {
      const a = rnd() * Math.PI * 2, d = rnd() * (r + PR);
      const old = [{ x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d, r: r + PR }];
      if (reach(p, (q) => !inside(q, zs), { L, cap: ws + 0.05, slow: old }).time > ws) badSlow++;
      const a2 = rnd() * Math.PI * 2, d2 = r + PR + 0.05 + rnd();
      const old2 = [{ x: p.x + Math.sin(a2) * d2, z: p.z + Math.cos(a2) * d2, r: r + PR }];
      const tb = reach(p, (q) => !inside(q, zs), { L, cap: w + 0.3, slow: old2 }).time;
      if (tb > w) { badBeside++; worstB = Math.max(worstB, tb / w); }
    }
  }
  console.log(`| ${name} | ${w.toFixed(2)} (${ws.toFixed(2)}) | ${pct(caught, N)} | ${pct(bad, caught)} | ${slows ? pct(badSlow, caught) : '–'} | ${slows ? pct(badBeside, caught) : '–'} | worst t/warn full ${worstS.toFixed(3)}, beside ${worstB.toFixed(3)} |`);
  if (process.env.SEC1) continue;
}

if (process.env.SEC1) process.exit(0);
// 2) Barrier zones (new gap rule) then a slam centred on Piotrek.
const COMBOS = [
  ['galkowek P3 Teren budowy → Wbijanie pala (combo)', 0.5, 7, 5, 0.7, 6.5, 52 * 0.75, 0],
  ['galkowek P2 Teren budowy, next Wbijanie pala', 0.6, 6.5, 5, 0.6, 6, 52, 3.6],
  ['galkowek P1 Teren budowy, next Wbijanie pala', 0.8, 6, 4, 0.8, 5.5, 52, 4.3],
  ['bedon P3 Objazd, next Próg zwalniający', 0.6, 6, 3, 0.6, 6, 54 * 0.75, 3.45],
];
console.log('\n## Barrier zones (2,5 m gap) then a slam centred on Piotrek');
console.log('| combo | zones placed (mean of n) | slam warn s | stand: never / late | push left inside | nearest exit: never / late | best spot: never / late |\n|---|---:|---:|---:|---:|---:|---:|');
for (const [name, zt, zr, n, st, sr, L] of COMBOS) {
  const zw = warn(zt, zr), sw = warn(st, sr), M = Math.max(100, Math.floor(N / 2));
  let encS = 0, slowS = 0, encB = 0, slowB = 0, encN = 0, slowN = 0, inPush = 0, placed = 0;
  for (let s = 0; s < M; s++) {
    const p0 = startPos(L), zs = place(p0, n, zr, L, true);
    placed += zs.length;
    const slamFrom = (c) => { const pp = pushOut(c, zs); if (inside(pp, zs)) return Infinity; const goal = (q) => (q.x - c.x) ** 2 + (q.z - c.z) ** 2 >= (sr + PR) ** 2; return reach(pp, goal, { block: zs, L, cap: sw + 0.6 }).time; };
    const t1 = slamFrom(p0);
    if (t1 === Infinity) encS++; else if (t1 > sw) slowS++;
    if (inside(pushOut(p0, zs), zs)) inPush++;
    const g = (q) => !inside(q, zs);
    g.all = true;
    const r = reach(p0, g, { L, cap: zw });
    const cand = r.pts.filter((_, k) => k % Math.max(1, Math.floor(r.pts.length / 25)) === 0);
    if (!cand.length) cand.push(p0);
    const tn = slamFrom(r.pts[0] ?? p0);
    if (tn === Infinity) encN++; else if (tn > sw) slowN++;
    let best = Infinity;
    for (const c of cand) { best = Math.min(best, slamFrom(c)); if (best <= sw) break; }
    if (best === Infinity) encB++; else if (best > sw) slowB++;
  }
  console.log(`| ${name} | ${(placed / M).toFixed(2)} of ${String(n)} | ${sw.toFixed(3)} | ${pct(encS, M)} / ${pct(slowS, M)} | ${pct(inPush, M)} | ${pct(encN, M)} / ${pct(slowN, M)} | ${pct(encB, M)} / ${pct(slowB, M)} |`);
}

// 3) Two barrier casts that overlap in time (the gap rule only holds inside one cast): zone1 (n1 × r1) was laid
//    round p1 (a few metres from Piotrek) and still stands for `tau` s into the slam's warning; zone2 (n2 × r2)
//    is laid round Piotrek with its own gap rule, then the slam is centred where they went (best of ~25
//    reachable spots outside both, within zone2's warning). Waiting at a barrier until it goes is allowed.
function reachT(p, goal, { block = [], gone = [], tau = 0, L, cap }) {
  const W = Math.ceil((RUN * cap + 1) / H), S = 2 * W + 1, t = new Float64Array(S * S).fill(Infinity);
  const heap = [];
  const push = (k, v) => { heap.push([v, k]); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  const c0 = W * S + W; t[c0] = 0; push(c0, 0);
  while (heap.length) {
    const [v, k] = pop();
    if (v > t[k]) continue;
    if (v > cap) return Infinity;
    const ix = (k % S) - W, iz = Math.floor(k / S) - W, x = p.x + ix * H, z = p.z + iz * H;
    if (goal({ x, z })) return v;
    for (const [a, b, d] of STEPS) {
      const nx = ix + a, nz = iz + b;
      if (nx < -W || nx > W || nz < -W || nz > W) continue;
      const qx = p.x + nx * H, qz = p.z + nz * H;
      if (qx * qx + qz * qz >= (L - PR - 0.4) ** 2 || inside({ x: qx, z: qz }, block)) continue;
      let nv = v + d / RUN;
      if (inside({ x: qx, z: qz }, gone)) nv = Math.max(nv, tau + d / RUN);
      const nk = (nz + W) * S + nx + W;
      if (nv < t[nk]) { t[nk] = nv; push(nk, nv); }
    }
  }
  return Infinity;
}
const OVER = [
  // name, zone1 n, r1, zone2 tele, n2, r2, slam tele, slam r, arena L, tau (zone1 left into the slam warning), p1 drift m
  ['galkowek P3 enraged: Teren budowy+pal, bag edge, Teren budowy+pal', 5, 7, 0.5, 5, 7, 0.7, 6.5, 52 * 0.75, 0.79, 6],
  ['galkowek P2 Teren budowy → phase 3 → Teren budowy+pal', 5, 6.5, 0.5, 5, 7, 0.7, 6.5, 52 * 0.75, 1.69, 6],
];
console.log('\n## Two barrier casts overlapping, then a slam on Piotrek (zone1 not kept apart from zone2)');
console.log('| case | slam warn s | zone1 left s | stand: never / late | best spot: never / late | best, zone1 ignored: never / late |\n|---|---:|---:|---:|---:|---:|');
for (const [name, n1, r1, t2, n2, r2, st, sr, L, tau, drift] of OVER) {
  const zw = warn(t2, r2), sw = warn(st, sr), M = Math.max(100, Math.floor(N / 2));
  let encS = 0, lateS = 0, encB = 0, lateB = 0, encI = 0, lateI = 0;
  for (let s = 0; s < M; s++) {
    let p = startPos(L * 0.8);
    const a = rnd() * Math.PI * 2, dd = rnd() * drift;
    const z1 = place({ x: p.x + Math.sin(a) * dd, z: p.z + Math.cos(a) * dd }, n1, r1, L, true);
    p = pushOut(p, z1);
    const z2 = place(p, n2, r2, L, true);
    const slam = (c, walls, gone) => { const pp = pushOut(pushOut(c, z2), z1); const g = (q) => (q.x - c.x) ** 2 + (q.z - c.z) ** 2 >= (sr + PR) ** 2; return reachT(pp, g, { block: walls, gone, tau, L, cap: sw + 0.6 }); };
    const tS = slam(p, z2, z1);
    if (tS === Infinity) encS++; else if (tS > sw) lateS++;
    // Reachable spots outside both casts within zone2's warning (zone1 is a wall then).
    const g = (q) => !inside(q, z2) && !inside(q, z1);
    g.all = true;
    const r = reach(p, g, { block: z1, L, cap: zw });
    const cand = r.pts.filter((_, k) => k % Math.max(1, Math.floor(r.pts.length / 25)) === 0);
    if (!cand.length) cand.push(p);
    let best = Infinity, bestI = Infinity;
    for (const c of cand) { best = Math.min(best, slam(c, z2, z1)); if (best <= sw) break; }
    for (const c of cand) { bestI = Math.min(bestI, slam(c, z2, [])); if (bestI <= sw) break; }
    if (best === Infinity) encB++; else if (best > sw) lateB++;
    if (bestI === Infinity) encI++; else if (bestI > sw) lateI++;
  }
  console.log(`| ${name} | ${sw.toFixed(3)} | ${String(tau)} | ${pct(encS, M)} / ${pct(lateS, M)} | ${pct(encB, M)} / ${pct(lateB, M)} | ${pct(encI, M)} / ${pct(lateI, M)} |`);
}
