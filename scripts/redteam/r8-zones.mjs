// Round 8: Boss.telegraph 'zone' placement as shipped in 5706673 (every barrier tries eight spots and keeps BARRIER_GAP
// to the barriers already placed in the same cast). Measures (a) barriers placed per cast, (b) how often Piotrek end up
// in a pocket: walled in by barriers (inflated by Piotrek's radius) and the fence so that no ground 12 m away is reachable,
// with only this cast standing, and with the previous cast still standing too (duration 5-6 s > cooldown 2.3-3.6 s, and
// nothing keeps the two casts apart). Flood fill on a 0,3 m grid. node scripts/redteam/r8-zones.mjs [trials]
const N = Number(process.argv[2] ?? 4000), GAP = 2.5, PR = 0.38, CELL = 0.3, FAR = 12;
let seed = 8881;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
function cast(px, pz, n, r, L) {
  const out = [];
  for (let k = 0; k < Math.min(n, 8); k++)
    for (let t = 0; t < 8; t++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 0.55 * L;
      const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
      if (out.every(([bx, bz]) => Math.hypot(x - bx, z - bz) >= 2 * r + GAP)) {
        out.push([x, z]);
        break;
      }
    }
  return out;
}
/** True when Piotrek at (px, pz) cannot reach any free ground FAR metres away. */
function trapped(px, pz, discs, L) {
  const S = Math.ceil((2 * L) / CELL), off = L;
  const free = (i, j) => {
    const x = i * CELL - off, z = j * CELL - off;
    if (Math.hypot(x, z) > L - PR) return false;
    for (const [bx, bz, r] of discs) if ((x - bx) ** 2 + (z - bz) ** 2 < (r + PR) ** 2) return false;
    return true;
  };
  const si = Math.round((px + off) / CELL), sj = Math.round((pz + off) / CELL);
  if (!free(si, sj)) return null; // standing inside a barrier: it pushes them out, not a pocket question
  const seen = new Uint8Array(S * S);
  const q = [si * S + sj];
  seen[si * S + sj] = 1;
  while (q.length) {
    const c = q.pop(), i = Math.floor(c / S), j = c % S;
    if (Math.hypot(i * CELL - off - px, j * CELL - off - pz) >= FAR) return false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= S || b >= S || seen[a * S + b] || !free(a, b)) continue;
      seen[a * S + b] = 1;
      q.push(a * S + b);
    }
  }
  return true;
}
/** Shortest walk (m, 8-neighbour grid) from (px, pz) out of every disc in `now` without crossing a standing one in `walls`. */
function escape(px, pz, now, walls, L) {
  const S = Math.ceil((2 * L) / CELL), off = L;
  const wall = (x, z) => Math.hypot(x, z) > L - PR || walls.some(([bx, bz, r]) => (x - bx) ** 2 + (z - bz) ** 2 < (r + PR) ** 2);
  const inNow = (x, z) => now.some(([bx, bz, r]) => (x - bx) ** 2 + (z - bz) ** 2 < (r + PR) ** 2);
  const si = Math.round((px + off) / CELL), sj = Math.round((pz + off) / CELL);
  const dist = new Float64Array(S * S).fill(Infinity);
  dist[si * S + sj] = 0;
  // Dijkstra with a bucket queue is overkill here: Piotrek's run is short, a plain sorted frontier is fine.
  const q = [[0, si, sj]];
  while (q.length) {
    q.sort((a, b) => b[0] - a[0]);
    const [d, i, j] = q.pop();
    if (d > dist[i * S + j]) continue;
    const x = i * CELL - off, z = j * CELL - off;
    if (!inNow(x, z)) return d;
    if (d > 30) return Infinity;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= S || b >= S) continue;
      if (wall(a * CELL - off, b * CELL - off)) continue;
      const nd = d + CELL * Math.hypot(di, dj);
      if (nd < dist[a * S + b]) { dist[a * S + b] = nd; q.push([nd, a, b]); }
    }
  }
  return Infinity;
}
// [name, count, radius, arena radius, telegraph]
const CASES = [['bedon P1 Objazd', 2, 5, 54, 1], ['bedon P2 Objazd', 3, 5.5, 54, 0.7], ['bedon P3 Objazd', 3, 6, 54 * 0.75, 0.6],
  ['galkowek P1 Teren budowy', 4, 6, 52, 0.8], ['galkowek P2 Teren budowy', 5, 6.5, 52, 0.6], ['galkowek P3 Teren budowy', 5, 7, 52 * 0.75, 0.5]];
const ESC = [];
console.log('| cast | count | placed (mean) | casts one or more short | pocket, this cast only | pocket, with the previous cast standing | standing in a barrier |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const [name, n, r, L, tele] of CASES) {
  let caught = 0, caughtOf = 0, worst = 0;
  const budget = Math.max(tele * 7.2, (r + 0.4) / 0.85);
  let placed = 0, short = 0, alone = 0, both = 0, inside = 0, valid = 0;
  for (let k = 0; k < N; k++) {
    // Piotrek anywhere in the arena; the previous cast was drawn round where they stood ~3 s earlier (up to 8 m away).
    let px, pz;
    do { px = (rnd() * 2 - 1) * L; pz = (rnd() * 2 - 1) * L; } while (Math.hypot(px, pz) > L * 0.9);
    const a = rnd() * Math.PI * 2, d = rnd() * 8;
    const prev = cast(px + Math.sin(a) * d, pz + Math.cos(a) * d, n, r, L).map(([x, z]) => [x, z, r]);
    const now = cast(px, pz, n, r, L).map(([x, z]) => [x, z, r]);
    placed += now.length;
    if (now.length < n) short++;
    // Piotrek under a new barrier and not under a standing one: can they walk out in the warning (at full run)?
    if (now.some(([x, z]) => Math.hypot(px - x, pz - z) < r + PR) && !prev.some(([x, z]) => Math.hypot(px - x, pz - z) < r + PR)) {
      caughtOf++;
      const e = escape(px, pz, now, prev, L);
      worst = Math.max(worst, Number.isFinite(e) ? e : 99);
      if (e > budget) caught++;
    }
    const t1 = trapped(px, pz, now, L);
    const t2 = trapped(px, pz, [...now, ...prev], L);
    if (t2 === null) { inside++; continue; }
    valid++;
    if (t1) alone++;
    if (t2) both++;
  }
  const pc = (x, of = N) => `${((100 * x) / of).toFixed(2)}%`;
  ESC.push(`| ${name} | ${budget.toFixed(1)} m | ${String(caughtOf)} | ${pc(caught, caughtOf)} | ${worst.toFixed(1)} m |`);
  console.log(`| ${name} | ${n} | ${(placed / N).toFixed(2)} | ${pc(short)} | ${pc(alone, valid)} | ${pc(both, valid)} | ${pc(inside)} |`);
}
console.log('');
console.log('| cast | run the warning allows | casts with Piotrek under a new barrier | no way out in time (standing barriers in the way) | longest way out |');
console.log('|---|---:|---:|---:|---:|');
for (const l of ESC) console.log(l);
