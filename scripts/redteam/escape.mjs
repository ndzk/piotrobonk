// Red team round 5: can an aimed slam/zone be unescapable once barrier zones (block) stand round Piotrek or they
// are slowed (slow zones)? Pure geometry, no game: zones placed as Boss.telegraph does (angle U, dist U(0, 0.55 L)
// from Piotrek), warnings as Boss.warn (Normalnie, no Klapki), hit test radius + player radius (hazards.ts), push
// out of a barrier to its edge (game.ts hazardHit.push), slow ×0.55 (game.ts SLOW_FACTOR), arena wall at
// limit − 0.78 (world.ts). Walking at an instant 7,2 m/s (no acceleration, no enemies, no buildings: generous).
// Escape time by Dijkstra on a 0,1 m grid (16 neighbours). node scripts/redteam/escape.mjs [samples]
const PR = 0.38, RUN = 7.2, SLOW = 0.55, ESC = 0.85, H = Number(process.env.GRID ?? 0.1), N = Number(process.argv[2] ?? 400);
const warn = (tele, r) => Math.max(0.3, tele, (r + 0.4) / (RUN * ESC));
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const place = (p, n, r, L) => Array.from({ length: n }, () => { const a = rnd() * Math.PI * 2, d = rnd() * 0.55 * L; return { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d, r: r + PR }; });
const inside = (q, ds) => ds.some((d) => (q.x - d.x) ** 2 + (q.z - d.z) ** 2 < d.r * d.r);
const STEPS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [1, 2], [-2, 1], [-1, 2], [2, -1], [1, -2], [-2, -1], [-1, -2]].map(([a, b]) => [a, b, Math.hypot(a, b) * H]);
/** Least time from p to any point that `goal` accepts, avoiding barriers and the wall; Infinity past `cap` s. */
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
    if (goal({ x, z })) { if (!pts.length) pts.time = v; pts.push({ x, z, v }); if (pts.length >= 1 && !goal.all) return { time: v, pts }; continue; }
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
const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;

// 1) Multi-zone attacks: Piotrek at full speed, not slowed, must leave the union of the new zones in their warning.
//    Also slowed: standing in an active zone of the same kind (centre U(0, r) from them) when the new ones drop.
const ZONES = [
  ['fabryczna P2 Kolejka do kasy', 0.8, 4, 3, 60, false], ['niciarniana P1 Pajęczyna', 0.8, 4.5, 3, 56, true], ['niciarniana P2 Pajęczyna', 0.6, 5, 4, 56, true],
  ['niciarniana P3 Pajęczyna', 0.5, 5.5, 5, 56 * 0.75, true], ['widzew P1 Strefa kontroli', 0.8, 5, 3, 62, false], ['widzew P2 Strefa kontroli', 0.6, 5.5, 4, 62, false],
  ['widzew P3 Nikt nie wysiada (after charge)', 0.6, 6, 4, 62, false], ['justynow P3 Prosto z góry', 0.6, 4.5, 5, 50, true], ['zakowice P2 Peron odwołany', 0.6, 6, 4, 54, false],
  ['zakowice P3 Peron odwołany', 0.5, 6.5, 5, 54 * 0.75, false],
];
console.log(`\n## Zones aimed at Piotrek: share of casts they cannot walk out of before the first bite (${String(N)} casts each)`);
console.log('| attack | warn s | single zone escape s | caught by ≥1 zone | unescapable, full speed | unescapable, slowed (in an old zone) |\n|---|---:|---:|---:|---:|---:|');
for (const [name, tele, r, n, L, slows] of process.env.ONLY3 ? [] : ZONES) {
  const w = warn(tele, r);
  let caught = 0, bad = 0, badSlow = 0, slowN = 0;
  for (let s = 0; s < N; s++) {
    const p = startPos(L), zs = place(p, n, r, L);
    if (!inside(p, zs)) continue;
    caught++;
    if (reach(p, (q) => !inside(q, zs), { L, cap: w + 0.05 }).time > w) bad++;
    if (slows) {
      slowN++;
      const a = rnd() * Math.PI * 2, d = rnd() * (r + PR);
      const old = [{ x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d, r: r + PR }];
      if (reach(p, (q) => !inside(q, zs), { L, cap: w + 0.05, slow: old }).time > w) badSlow++;
    }
  }
  console.log(`| ${name} | ${w.toFixed(2)} | ${((r + PR) / RUN).toFixed(2)} | ${pct(caught, N)} | ${pct(bad, N)} of casts (${pct(bad, caught)} of catches) | ${slows ? `${pct(badSlow, slowN)} of catches` : '–'} |`);
}

// 2) Slams aimed at Piotrek while slowed: they stand d m inside an active slow zone when the slam is wound up.
console.log('\n## Slam centred on Piotrek while they stand in an active slow zone (walk straight out, best case)');
console.log('| slam | warn s | depth in slow zone at which walking out fails | ... with an ideal slide (≈0,21 s saved) |\n|---|---:|---:|---:|');
for (const [name, tele, r, zr] of [['justynow P1-P3 Lądowanie in Prosto z góry', 0.5, 6, 4.5], ['justynow P2 Lądowanie (0,6 s) in Prosto z góry', 0.6, 5.5, 4.5]]) {
  const w = warn(tele, r), R = r + PR, Z = zr + PR;
  const tWalk = (depth) => depth / (RUN * SLOW) + Math.max(0, R - depth) / RUN;
  let d1 = 0, d2 = 0;
  for (let d = 0; d <= Z; d += 0.01) { if (!d1 && tWalk(d) > w) d1 = d; if (!d2 && tWalk(d) - 0.21 > w) d2 = d; }
  console.log(`| ${name} | ${w.toFixed(3)} | > ${d1 ? d1.toFixed(2) : '–'} m of ${Z.toFixed(2)} | > ${d2 ? d2.toFixed(2) : '–'} m |`);
}

// 3) Barriers + slam: the barrier zones land, the slam is centred where Piotrek stand at that moment.
//    Strategy "stand": Piotrek stayed where the zones were aimed (pushed out if inside). "best": during the zone
//    warning they run to the reachable spot outside every zone whose slam escape is quickest (an oracle).
const COMBOS = [
  // name, zone tele, zone r, count, slam tele, slam r, arena limit, gap s between zones landing and the slam (0 = combo)
  ['galkowek P3 Teren budowy → Wbijanie pala (combo)', 0.5, 7, 5, 0.7, 6.5, 52 * 0.75, 0],
  ['galkowek P2 Teren budowy, next Wbijanie pala', 0.6, 6.5, 5, 0.6, 6, 52, 3.6],
  ['galkowek P1 Teren budowy, next Wbijanie pala', 0.8, 6, 4, 0.8, 5.5, 52, 4.3],
  ['bedon P3 Objazd, next Próg zwalniający', 0.6, 6, 3, 0.6, 6, 54 * 0.75, 3.45],
];
console.log('\n## Barrier zones then a slam centred on Piotrek (no other movement between, see "gap")');
console.log('| combo | slam warn s | gap s | stand: >0,6 s late / late | push left inside | nearest exit: >0,6 s late / late | best of ~25 spots: >0,6 s late / late |\n|---|---:|---:|---:|---:|---:|---:|');
for (const [name, zt, zr, n, st, sr, L, gap] of COMBOS.slice(0, process.env.DUMP || process.env.ONLY3 ? 1 : 9)) {
  const zw = warn(zt, zr), sw = warn(st, sr), M = Math.max(100, Math.floor(N / 2));
  let encS = 0, slowS = 0, encB = 0, slowB = 0, encN = 0, slowN = 0, inPush = 0, outside = 0;
  for (let s = 0; s < M; s++) {
    const p0 = startPos(L), zs = place(p0, n, zr, L);
    const slamFrom = (c) => { const pp = pushOut(c, zs); if (inside(pp, zs)) return 0; const goal = (q) => (q.x - c.x) ** 2 + (q.z - c.z) ** 2 >= (sr + PR) ** 2; return reach(pp, goal, { block: zs, L, cap: sw + 0.6 }).time; };
    const t1 = slamFrom(p0);
    if (t1 === Infinity) encS++; else if (t1 > sw) slowS++;
    if (inside(pushOut(p0, zs), zs)) inPush++;
    // Reachable spots outside the zones within the zone warning (they are not walls yet), a handful tried.
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
    if (process.env.DUMP && best > sw) console.log(JSON.stringify({ name, p0, zs, best, tn, t1 }));
    if (process.env.ONLY3 && t1 > sw && !inside(p0, zs)) outside++;
  }
  console.log(`| ${name} | ${sw.toFixed(3)} | ${String(gap)} | ${pct(encS, M)} / ${pct(slowS, M)} | ${pct(inPush, M)} | ${pct(encN, M)} / ${pct(slowN, M)} | ${pct(encB, M)} / ${pct(slowB, M)} | n=${String(M)}${process.env.ONLY3 ? `, stand-trapped while outside every zone: ${String(outside)}` : ''} |`);
}
