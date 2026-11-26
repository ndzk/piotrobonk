// Round 10: where can Piotrek stand so that the crowd cannot touch them, from out/r10-geo.json (r10-geo.ts)?
// Floors reachable from the arena's middle on a 0,5 m grid (walk: step 0,42 m; jump: +1,36 m apex, so tops up to 1,77 m
// above the feet; falls anywhere; ramps as floors). For each reachable floor f:
//  A  a walkable top T above Piotrek's head with T - f in (2,4; 4]: walkers there cannot touch (contact dy > 2,4) and are
//     not leashed (game.ts leash: dy > 4 only);
//  F  the highest top above them in (f + 1,75; f + 2,5]: no "covered" for fliers (enemies.ts: > py + 2,5), so fliers ride
//     over it at roof + 1,1 > f + 2,85, out of touch;
//  P  a perch: f >= 1,2 over open room (the box under Piotrek's feet starts >= 1,0 m up): walkers under it are not blocked,
//     so never climb (enemies.ts climb needs `blocked`).
// node scripts/redteam/r10-cover.mjs [station]
import { readFileSync } from 'node:fs';
const geo = JSON.parse(readFileSync(new URL('./out/r10-geo.json', import.meta.url), 'utf8'));
const spots = [];
const H = 0.5, PR = 0.23, HEAD = 1.75, STEP = 0.42, JUMP = 8.4 ** 2 / 52 + STEP;
for (const [st, g] of Object.entries(geo)) {
  if (process.argv[2] && !process.argv[2].startsWith('--') && st !== process.argv[2]) continue;
  const B = g.boxes, nb = B.length / 6, L = g.limit - 0.8;
  const N = Math.ceil(L / H);
  // Per cell: boxes overlapping the cell's point (grown by PR).
  const colBoxes = (x, z) => {
    const out = [];
    for (let b = 0; b < nb; b++) {
      const o = b * 6;
      if (x + PR > B[o] && x - PR < B[o + 3] && z + PR > B[o + 2] && z - PR < B[o + 5]) out.push([B[o + 1], B[o + 4]]);
    }
    return out;
  };
  const rampAt = (x, z) => {
    const hs = [];
    for (const rp of g.ramps) {
      const ax = rp.x1 - rp.x0, az = rp.z1 - rp.z0, len2 = ax * ax + az * az, t = ((x - rp.x0) * ax + (z - rp.z0) * az) / len2;
      if (t < 0 || t > 1) continue;
      if (Math.abs(((x - rp.x0) * az - (z - rp.z0) * ax) / Math.sqrt(len2)) > rp.half + PR * 0.5) continue;
      hs.push(rp.h0 + (rp.h1 - rp.h0) * t);
    }
    return hs;
  };
  const cols = new Map();
  for (let i = -N; i <= N; i++)
    for (let j = -N; j <= N; j++) {
      const x = i * H, z = j * H;
      if (x * x + z * z > L * L) continue;
      const bx = colBoxes(x, z);
      const cand = [0, ...bx.map((b) => b[1]), ...rampAt(x, z)];
      // Standable: nothing solid between the feet and the head; the box (or ground) under is the top.
      const floors = [...new Set(cand.map((f) => Math.round(f * 100) / 100))].filter((f) => !bx.some(([lo, hi]) => hi > f + 0.01 && lo < f + HEAD)).sort((a, b) => a - b);
      cols.set(`${i},${j}`, { x, z, bx, floors });
    }
  // Flood fill from the middle's floor.
  const start = cols.get('0,0');
  const seen = new Set();
  const par = new Map();
  const q = [[0, 0, start.floors[0] ?? 0]];
  seen.add(`0,0,${q[0][2]}`);
  for (let qi = 0; qi < q.length; qi++) {
    const [i, j, f] = q[qi];
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = cols.get(`${i + a},${j + b}`);
      if (!c) continue;
      for (const lim of [f + STEP, f + JUMP]) {
        const under = c.floors.filter((h) => h <= lim);
        if (!under.length) continue;
        const h = under[under.length - 1];
        const k = `${i + a},${j + b},${h}`;
        if (!seen.has(k)) { seen.add(k); par.set(k, `${i},${j},${f}`); q.push([i + a, j + b, h]); }
      }
    }
  }
  // --path=x,z,f: the BFS path from the middle to that floor cell, as turning points [x, z, floor].
  const want = process.argv.find((a) => a.startsWith('--path='))?.slice(7);
  if (want) {
    const [wx, wz, wf] = want.split(',').map(Number);
    let k = [...seen].find((s) => { const [i, j, f] = s.split(',').map(Number); return i === Math.round(wx / H) && j === Math.round(wz / H) && Math.abs(f - wf) < 0.05; });
    const pts = [];
    while (k) { const [i, j, f] = k.split(',').map(Number); pts.unshift([i * H, j * H, f]); k = par.get(k); }
    const turn = pts.filter((p, n) => n === 0 || n === pts.length - 1 || p[2] !== pts[n - 1][2] || p[2] !== pts[n + 1][2] || (pts[n + 1][0] - p[0]) !== (p[0] - pts[n - 1][0]) || (pts[n + 1][1] - p[1]) !== (p[1] - pts[n - 1][1]));
    console.log(st, JSON.stringify(process.argv.includes('--dense') ? pts : turn));
    continue;
  }
  const A = [], F = [], P = [];
  for (const k of seen) {
    const [i, j, fs] = k.split(',');
    const f = Number(fs), c = cols.get(`${i},${j}`);
    const tops = c.floors.filter((t) => t > f + HEAD);
    const band = tops.filter((t) => t - f > 2.4 && t - f <= 4.0);
    if (band.length) A.push([c.x, c.z, f, Math.min(...band) - f]);
    const highest = Math.max(f, ...c.bx.map((b) => b[1]));
    if (highest > f + HEAD && highest <= f + 2.5) F.push([c.x, c.z, f, highest - f]);
    if (f >= 1.2) {
      const feet = c.bx.filter(([lo, hi]) => Math.abs(hi - f) < 0.02);
      if (feet.length && feet.every(([lo]) => lo >= 1.0)) P.push([c.x, c.z, f, Math.min(...feet.map((b) => b[0]))]);
    }
  }
  // --spots: trasa specs to the biggest clusters of each kind (specs/r10-spots.json, appended per station).
  if (process.argv.includes('--spots')) {
    const pathTo = (x, z, f) => {
      let k = `${Math.round(x / H)},${Math.round(z / H)},${f}`;
      const pts = [];
      while (k) { const [i, j, ff] = k.split(',').map(Number); pts.unshift([i * H, j * H, ff]); k = par.get(k); }
      return pts.filter((p, n) => n === 0 || n === pts.length - 1 || p[2] !== pts[n - 1][2] || p[2] !== pts[n + 1][2] || (pts[n + 1][0] - p[0]) !== (p[0] - pts[n - 1][0]) || (pts[n + 1][1] - p[1]) !== (p[1] - pts[n - 1][1])).map(([a, b]) => [a, b]);
    };
    const T = ['sos', 'parasol', 'kawa', 'gwizdek', 'kurtka', 'kanapka', 'termos', 'nerka'];
    for (const [kind, l, n] of [['A', A, 5], ['F', F, 2], ['P', P, 4]])
      for (const c of clusters(l).slice(0, n).filter((c) => c.n >= 6)) {
        const path = pathTo(c.x, c.z, c.f);
        spots.push({ name: `${kind}-${st}-${c.x},${c.z}-f${c.f}`, stations: [st], seeds: 10, seedTag: 'rt10spot', cap: 400, trace: 20, exploit: { kind: 'trasa', path, climb: true, cards: T } });
      }
  }
  const sum = (l, n) => `${l.length} cells (${(l.length * H * H).toFixed(1)} m²)${l.length ? ': ' + clusters(l).slice(0, n).map((c) => `[${c.n} @ (${c.x.toFixed(1)},${c.z.toFixed(1)}) f=${c.f.toFixed(2)} v=${c.v.toFixed(2)}]`).join(' ') : ''}`;
  console.log(`== ${st} (limit ${g.limit}, ${nb} boxes, ${seen.size} reachable floor cells)\n  A under-deck band: ${sum(A, 6)}\n  F flier-ceiling:   ${sum(F, 6)}\n  P open perch:      ${sum(P, 6)}`);
}
/** Group neighbouring cells on the same floor; biggest first. */
function clusters(l) {
  const left = new Set(l.map((_, k) => k)), out = [];
  while (left.size) {
    const [s] = left;
    left.delete(s);
    const grp = [l[s]], q = [s];
    while (q.length) {
      const a = l[q.pop()];
      for (const k of [...left]) if (Math.abs(l[k][0] - a[0]) <= H + 1e-6 && Math.abs(l[k][1] - a[1]) <= H + 1e-6 && Math.abs(l[k][2] - a[2]) < 0.3) { left.delete(k); grp.push(l[k]); q.push(k); }
    }
    const m = grp[Math.floor(grp.length / 2)];
    out.push({ n: grp.length, x: m[0], z: m[1], f: m[2], v: m[3] });
  }
  return out.sort((a, b) => b.n - a.n);
}
if (spots.length) { (await import('node:fs')).writeFileSync(new URL('./specs/r10-spots.json', import.meta.url), JSON.stringify(spots)); console.log(spots.length, 'spot specs'); }
