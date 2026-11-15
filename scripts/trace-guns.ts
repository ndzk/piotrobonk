// Traces every CS gun's side outline from its picture on Steam's CDN (the inventory icon: side view, barrel
// to the left, tilted a little, transparent background) into src/content/skins/silhouettes.json: mirrored to
// point forward and turned level along the barrel, the outline and its holes
// (trigger guard, stock cut-outs) as polygons in metres, scaled to the real gun's length, with the point the
// hand holds. Only those numbers are kept; the pictures are never written to disk.
// Usage: node scripts/trace-guns.ts [--only=ak47,awp] [--debug=folder]   (PW_SHELL=1 on this PC)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'src/content/skins/silhouettes.json';
const STEAM = 'https://community.akamai.steamstatic.com/economy/image/';
const arg = (name: string): string | null => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
const only = arg('only')?.split(',') ?? null;
const debug = arg('debug');

/** Real overall length of each gun in metres (stock extended, with its suppressor where it has one). */
const LENGTH: Record<string, number> = {
  glock: 0.186, usp_silencer: 0.31, hkp2000: 0.183, p250: 0.19, fiveseven: 0.208, tec9: 0.31, cz75a: 0.206, elite: 0.26,
  deagle: 0.27, revolver: 0.3, mac10: 0.3, mp9: 0.3, mp7: 0.42, mp5sd: 0.66, ump45: 0.69, bizon: 0.66, p90: 0.5,
  ak47: 0.88, m4a1: 0.84, m4a1_silencer: 0.95, galilar: 0.97, famas: 0.76, aug: 0.73, sg556: 0.98, awp: 1.25, ssg08: 1.1,
  scar20: 1.0, g3sg1: 1.03, nova: 1.04, xm1014: 1.01, mag7: 0.67, sawedoff: 0.75, negev: 1.0, m249: 1.04, taser: 0.2,
};

/**
 * Where the hand goes, as a share of the levelled outline's box from the back and from the top, for guns whose
 * trigger guard the tracer cannot tell apart (MAC-10 and SCAR-20 have other holes lower down, the P90 holds
 * by its thumbhole, the Zeus has no guard at all).
 */
const GRIP: Record<string, [number, number]> = { mac10: [0.28, 0.25], taser: [0.3, 0.42], scar20: [0.2, 0.55], p90: [0.46, 0.5] };

/** Guns whose own picture does not show one gun from the side: the Dual Berettas are two, crossed. */
const SOURCE: Record<string, string> = { elite: 'cz75a' };

interface Snapshot {
  skins: Record<string, { w: string; r: number; i?: string }>;
}
type Pt = [number, number];
type Loop = Pt[];

/** Marching squares over a boolean mask: every boundary as a closed loop of edge midpoints. */
function contours(mask: Uint8Array, w: number, h: number): Loop[] {
  const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  const segs: [string, string][] = [];
  const pts = new Map<string, Pt>();
  const key = (x: number, y: number): string => {
    const k = `${String(x)},${String(y)}`;
    if (!pts.has(k)) pts.set(k, [x, y]);
    return k;
  };
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const c = (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
      if (c === 0 || c === 15) continue;
      const T = key(x + 0.5, y);
      const R = key(x + 1, y + 0.5);
      const B = key(x + 0.5, y + 1);
      const L = key(x, y + 0.5);
      const table: Record<number, [string, string][]> = {
        1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 5: [[L, T], [B, R]], 6: [[T, B]], 7: [[L, T]],
        8: [[L, T]], 9: [[T, B]], 10: [[T, R], [L, B]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]],
      };
      for (const s of table[c] ?? []) segs.push(s);
    }
  }
  const links = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    for (const k of [a, b]) {
      const l = links.get(k) ?? [];
      l.push(i);
      links.set(k, l);
    }
  });
  const used = new Uint8Array(segs.length);
  const loops: Loop[] = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const start = segs[s][0];
    let cur = segs[s][1];
    const loop: Loop = [pts.get(start) as Pt];
    while (cur !== start) {
      loop.push(pts.get(cur) as Pt);
      const next = (links.get(cur) ?? []).find((i) => !used[i]);
      if (next === undefined) break;
      used[next] = 1;
      cur = segs[next][0] === cur ? segs[next][1] : segs[next][0];
    }
    loops.push(loop);
  }
  return loops;
}

const area = (l: Loop): number => {
  let a = 0;
  for (let i = 0; i < l.length; i++) {
    const [x0, y0] = l[i];
    const [x1, y1] = l[(i + 1) % l.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
};
const inside = ([px, py]: Pt, l: Loop): boolean => {
  let c = false;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i];
    const [xj, yj] = l[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Ramer–Douglas–Peucker on an open polyline. */
function rdp(p: Pt[], eps: number): Pt[] {
  if (p.length < 3) return p;
  const [ax, ay] = p[0];
  const [bx, by] = p[p.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let at = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - p[i][1]) - (ax - p[i][0]) * (by - ay)) / len;
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= eps) return [p[0], p[p.length - 1]];
  return [...rdp(p.slice(0, at + 1), eps).slice(0, -1), ...rdp(p.slice(at), eps)];
}
/** Closed loop: split at the point farthest from the first, simplify both halves. */
function simplify(l: Loop, eps: number): Loop {
  let far = 0;
  let at = 0;
  for (let i = 1; i < l.length; i++) {
    const d = Math.hypot(l[i][0] - l[0][0], l[i][1] - l[0][1]);
    if (d > far) {
      far = d;
      at = i;
    }
  }
  const a = rdp(l.slice(0, at + 1), eps);
  const b = rdp([...l.slice(at), l[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

const snap = JSON.parse(readFileSync('src/content/skins/snapshot.json', 'utf8')) as Snapshot;
const previous = JSON.parse(readFileSync(OUT, 'utf8').trim() || '{}') as Record<string, unknown>;
const browser = await chromium.launch();
const out: Record<string, unknown> = { ...previous };
if (debug) mkdirSync(debug, { recursive: true });
try {
  const page = await browser.newPage();
  await page.setContent('<canvas></canvas>');
  for (const weapon of Object.keys(LENGTH)) {
    if (only && !only.includes(weapon)) continue;
    // The plainest skin of the gun: its picture shows the outline without anything sticking out of it.
    const skin = Object.values(snap.skins).filter((s) => s.w === (SOURCE[weapon] ?? weapon) && s.i).sort((a, b) => a.r - b.r).at(0);
    if (!skin?.i) {
      console.warn(`${weapon}: no picture, keeps the built model`);
      continue;
    }
    const res = await fetch(`${STEAM}${skin.i}/512fx384f`);
    if (!res.ok) throw new Error(`${weapon}: HTTP ${String(res.status)}`);
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    const { w, h, alpha } = await page.evaluate(async (src: string) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      if (!g) throw new Error('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const a: number[] = [];
      for (let i = 3; i < d.length; i += 4) a.push(d[i]);
      return { w: c.width, h: c.height, alpha: a };
    }, `data:image/png;base64,${b64}`);
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = alpha[i] > 110 ? 1 : 0;
    // Mirrored, so the barrel points forward (+x).
    const raw = contours(mask, w, h)
      .filter((l) => Math.abs(area(l)) > 12)
      .map((l) => l.map(([x, y]): Pt => [w - x, y]));
    // Level: the gun is turned so that as much of its top edge as possible lies at one height. At the right
    // angle the long straight lines of a gun (slide, receiver, rail, barrel) are flat, and short things that
    // stick out (sights, scopes) do not count for much.
    const all = raw.flat();
    const x0 = Math.min(...all.map((p) => p[0]));
    const x1 = Math.max(...all.map((p) => p[0]));
    const cx = (x0 + x1) / 2;
    const cy = h / 2;
    const flatness = (a: number): number => {
      const [c, s] = [Math.cos(a), Math.sin(a)];
      const top = new Map<number, number>();
      for (const [x, y] of all) {
        const rx = Math.round(cx + (x - cx) * c - (y - cy) * s);
        const ry = cy + (x - cx) * s + (y - cy) * c;
        top.set(rx, Math.min(top.get(rx) ?? Infinity, ry));
      }
      const bins = new Map<number, number>();
      for (const y of top.values()) {
        const b = Math.round(y / 1.5);
        bins.set(b, (bins.get(b) ?? 0) + 1);
      }
      return Math.max(...bins.values());
    };
    let tilt = 0;
    let best = -1;
    for (let deg = -45; deg <= 45; deg += 0.25) {
      const a = (deg * Math.PI) / 180;
      // Neighbours count too: a lucky single angle is not a straight edge.
      const score = flatness(a) * 2 + flatness(a - 0.004) + flatness(a + 0.004);
      if (score > best) {
        best = score;
        tilt = a;
      }
    }
    const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
    const loops = raw.map((l) => l.map(([x, y]): Pt => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]));
    // Outer loops are the ones no other loop contains; holes sit inside one.
    const outers = loops.filter((l) => !loops.some((o) => o !== l && Math.abs(area(o)) > Math.abs(area(l)) && inside(l[0], o)));
    const holes = loops.filter((l) => !outers.includes(l) && Math.abs(area(l)) > 40);
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let minY = Infinity;
    for (const l of outers)
      for (const [x, y] of l) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    const k = LENGTH[weapon] / (maxX - minX);
    // The hand holds the gun just behind its trigger guard (the hole lowest in the receiver, under the middle
    // half of the gun), at the top of that hole. Without one, at 40 % of the length under the receiver.
    const guard = holes
      .map((l) => ({ l, cx: l.reduce((s, p) => s + p[0], 0) / l.length, top: Math.min(...l.map((p) => p[1])), bottom: Math.max(...l.map((p) => p[1])), left: Math.min(...l.map((p) => p[0])) }))
      .filter((g) => g.cx > minX + (maxX - minX) * 0.15 && g.cx < minX + (maxX - minX) * 0.85 && g.bottom > minY + (maxY - minY) * 0.35)
      .sort((a, b) => b.bottom - a.bottom)
      .at(0);
    const set = GRIP[weapon] as [number, number] | undefined;
    const grip: Pt = set ? [minX + (maxX - minX) * set[0], minY + (maxY - minY) * set[1]] : guard ? [guard.left - 0.035 / k, guard.top] : [minX + (maxX - minX) * 0.4, minY + (maxY - minY) * 0.45];
    // Metres, x forward from the grip, y up from it.
    const toM = (l: Loop): number[] => simplify(l, 0.9).flatMap(([x, y]) => [Math.round((x - grip[0]) * k * 10000) / 10000, Math.round((grip[1] - y) * k * 10000) / 10000]);
    // How the model maps back onto the icon, so the game can lay a skin's own picture over the gun's sides:
    // the icon size, metres per pixel, the levelling turn and its centre, the hand in levelled pixels, and the
    // box the gun fills in this icon (a skin rendered with other framing is fitted to it by that box).
    // None for a gun drawn from another gun's picture.
    let box: [number, number, number, number] = [w, h, 0, 0];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (mask[y * w + x]) box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)];
    const r4 = (v: number): number => Math.round(v * 10000) / 10000;
    const icon = SOURCE[weapon] ? null : { w, h, k: Math.round(k * 1e9) / 1e9, tilt: Math.round(tilt * 1e6) / 1e6, cx: r4(cx), cy: r4(cy), gx: r4(grip[0]), gy: r4(grip[1]), box };
    out[weapon] = { outlines: outers.map(toM), holes: holes.map(toM), icon };
    const points = outers.reduce((s, l) => s + simplify(l, 0.9).length, 0);
    console.log(`${weapon.padEnd(15)} ${String(outers.length)} outline(s), ${String(holes.length)} hole(s), ${String(points)} points, tilt ${((tilt * 180) / Math.PI).toFixed(1)}°, guard ${guard ? 'found' : 'MISSING'}`);
    if (debug) {
      // The traced outline, levelled, with the grip marked, for a look.
      const pad = 10;
      const vb = `${String(minX - pad)} ${String(minY - pad)} ${String(maxX - minX + pad * 2)} ${String(maxY - minY + pad * 2)}`;
      const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${String(w)}" height="${String(h)}" style="background:#ddd"><line x1="${String(minX)}" x2="${String(maxX)}" y1="${String(grip[1])}" y2="${String(grip[1])}" stroke="#3a3" stroke-width="0.6"/>`];
      for (const l of [...outers, ...holes]) svg.push(`<polygon points="${simplify(l, 0.9).map((p) => p.join(',')).join(' ')}" fill="${outers.includes(l) ? '#456' : '#ddd'}" stroke="#e33" stroke-width="1"/>`);
      svg.push(`<circle cx="${String(grip[0])}" cy="${String(grip[1])}" r="5" fill="#fc0"/></svg>`);
      writeFileSync(`${debug}/${weapon}.svg`, svg.join(''));
    }
  }
} finally {
  await browser.close();
}
writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(`${OUT}: ${String(Object.keys(out).length)} guns`);
