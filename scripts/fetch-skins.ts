// Builds src/content/skins/snapshot.json from ByMykel/CSGO-API: every weapon case with its real contents,
// the collections behind them (for trade-ups) and, per skin, the fields the game uses plus a palette of
// 3–5 dominant colours. Skin images are downloaded only to measure those colours and never written to disk.
// Usage: node scripts/fetch-skins.ts [--refresh-palettes]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'src/content/skins/snapshot.json';
// bymykel.github.io moved its API to a custom domain that no longer serves it; the same files live in the repo.
const SOURCES = ['https://bymykel.github.io/CSGO-API/api/en/', 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/'];
const REFRESH = process.argv.includes('--refresh-palettes');
/** Colour clusters per image before ranking. */
const K = 8;

interface Rarity {
  name: string;
}
interface ApiSkin {
  skin_id: string;
  name: string;
  weapon: { id: string; name: string };
  category: { name: string };
  pattern?: { name: string } | null;
  min_float: number | null;
  max_float: number | null;
  stattrak: boolean;
  souvenir: boolean;
  rarity: Rarity;
  phase?: string;
  style?: { name: string } | null;
  image?: string;
}
interface ApiRef {
  id: string;
  name: string;
}
interface ApiCrate {
  id: string;
  name: string;
  type: string | null;
  first_sale_date: string | null;
  contains: ApiRef[];
  contains_rare?: ApiRef[];
}
interface ApiCollection {
  id: string;
  name: string;
  crates?: ApiRef[];
  contains: ApiRef[];
}

async function get<T>(file: string): Promise<T> {
  for (const base of SOURCES) {
    const res = await fetch(base + file, { redirect: 'follow' }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
  }
  throw new Error(`cannot download ${file}`);
}

const RARITY: Record<string, number> = {
  'Consumer Grade': 0,
  'Industrial Grade': 1,
  'Mil-Spec Grade': 2,
  Restricted: 3,
  Classified: 4,
  Covert: 5,
};

/** How the procedural shader paints a finish. Pattern names override the workshop style where CS does. */
function finish(s: ApiSkin): string {
  const p = s.pattern?.name ?? '';
  if (!p) return s.category.name === 'Gloves' ? 'leather' : 'vanilla';
  if (p.includes('Marble Fade')) return 'marble';
  if (p.includes('Doppler')) return 'doppler';
  if (p.includes('Fade')) return 'fade';
  if (p.includes('Case Hardened')) return 'case';
  if (p.includes('Tiger Tooth')) return 'tiger';
  if (p.includes(' Web')) return 'web';
  if (p.includes('Damascus')) return 'damascus';
  if (p.includes('Slaughter')) return 'slaughter';
  switch (s.style?.name) {
    case 'Solid Color':
      return 'solid';
    case 'Anodized':
      return 'anodized';
    case 'Anodized Multicolored':
      return 'multi';
    case 'Anodized Airbrushed':
      return 'airbrush';
    case 'Hydrographic':
      return 'hydro';
    case 'Spray-Paint':
      return 'spray';
    case 'Custom Paint Job':
      return 'custom';
    case 'Patina':
      return 'patina';
    case 'Gunsmith':
      return 'gunsmith';
    case 'Case Hardening':
      return 'case';
    default:
      return s.category.name === 'Gloves' ? 'leather' : 'custom';
  }
}

/** weapon_ak47 → ak47; the vanilla knives come as sfui_wpnhud_* ids, mapped through their display name. */
function weaponKey(s: ApiSkin, byName: Map<string, string>): string {
  const id = s.weapon.id.startsWith('sfui_wpnhud') ? (byName.get(s.weapon.name) ?? s.weapon.id) : s.weapon.id;
  return id.replace(/^weapon_/, '');
}

export interface SnapshotSkin {
  /** Weapon key (ak47, knife_karambit, sporty_gloves). */
  w: string;
  /** Pattern name ("" for a vanilla knife). */
  p: string;
  /** Doppler phase. */
  ph?: string;
  /** 2 Mil-Spec … 5 Covert, 6 rare special item (★). */
  r: number;
  /** Shader finish. */
  s: string;
  f: [number, number];
  st: 0 | 1;
  sv: 0 | 1;
  /** Collection id (weapon skins only). */
  c?: string;
  pal: string[];
}

export interface Snapshot {
  source: string;
  fetched: string;
  weapons: Record<string, string>;
  cases: { id: string; name: string; date: string; items: string[]; rare: string[] }[];
  collections: { id: string; name: string }[];
  skins: Record<string, SnapshotSkin>;
}

const [all, crates, collections] = await Promise.all([get<ApiSkin[]>('skins_not_grouped.json'), get<ApiCrate[]>('crates.json'), get<ApiCollection[]>('collections.json')]);
const cases = crates.filter((c) => c.type === 'Case').sort((a, b) => (a.first_sale_date ?? '').localeCompare(b.first_sale_date ?? ''));
const wanted = new Set<string>();
const rare = new Set<string>();
for (const c of cases) {
  for (const i of c.contains) wanted.add(i.id);
  for (const i of c.contains_rare ?? []) rare.add(i.id);
}
const byName = new Map<string, string>();
for (const s of all) if (!s.weapon.id.startsWith('sfui_wpnhud')) byName.set(s.weapon.name, s.weapon.id);
const collectionOf = new Map<string, string>();
for (const col of collections) for (const i of col.contains) collectionOf.set(i.id, col.id);

// skins_not_grouped has one entry per wear, StatTrak and Souvenir variant; fold them into one per skin.
const grouped = new Map<string, ApiSkin[]>();
for (const s of all) {
  if (!wanted.has(s.skin_id) && !rare.has(s.skin_id)) continue;
  const list = grouped.get(s.skin_id) ?? [];
  list.push(s);
  grouped.set(s.skin_id, list);
}

const previous: Snapshot | null = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Snapshot) : null;
const skins: Record<string, SnapshotSkin> = {};
const weapons: Record<string, string> = {};
const images = new Map<string, string>();
for (const [id, list] of grouped) {
  const s = list.find((x) => !x.stattrak && !x.souvenir) ?? list[0];
  const w = weaponKey(s, byName);
  weapons[w] = s.weapon.name;
  const r = rare.has(id) ? 6 : (RARITY[s.rarity.name] as number | undefined);
  if (r === undefined) throw new Error(`unknown rarity ${s.rarity.name} for ${s.name}`);
  skins[id] = {
    w,
    p: s.pattern?.name ?? '',
    ...(s.phase ? { ph: s.phase } : {}),
    r,
    s: finish(s),
    f: [s.min_float ?? 0, s.max_float ?? 1],
    st: list.some((x) => x.stattrak) ? 1 : 0,
    sv: list.some((x) => x.souvenir) ? 1 : 0,
    ...(collectionOf.has(id) && !rare.has(id) ? { c: collectionOf.get(id) } : {}),
    pal: (!REFRESH && previous?.skins[id]?.pal) || [],
  };
  if (!skins[id].pal.length && s.image) images.set(id, s.image);
}

// Palettes: decode each image in Chromium (no image library needed) and cluster its opaque pixels.
if (images.size) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas></canvas>');
  let done = 0;
  const queue = [...images];
  const worker = async (): Promise<void> => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [id, url] = item;
      const res = await fetch(`${url}/128fx96f`).catch(() => null);
      if (!res?.ok) {
        console.warn(`no image for ${id}`);
        continue;
      }
      const type = res.headers.get('content-type') ?? 'image/png';
      const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
      const pixels = await page.evaluate(async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true });
        if (!g) return [];
        g.drawImage(img, 0, 0);
        return Array.from(g.getImageData(0, 0, c.width, c.height).data);
      }, `data:${type};base64,${b64}`);
      skins[id].pal = palette(pixels);
      if (++done % 100 === 0) console.log(`palettes ${done}/${images.size}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  await browser.close();
}

/**
 * k-means (k = 8, deterministic farthest-point start) over opaque pixels. The most common colour comes first
 * (the base the finish is painted on); the rest are ranked by share weighted by chroma, so a thin red
 * pinstripe (Redline) beats a third shade of grey receiver. Near-duplicates and specks under 1% are dropped.
 */
function palette(px: number[]): string[] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) pts.push([px[i], px[i + 1], px[i + 2]]);
  if (!pts.length) return ['#8a8f99'];
  const d2 = (a: number[], b: number[]): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const centers: number[][] = [pts[Math.floor(pts.length / 2)].slice()];
  while (centers.length < K) {
    let best = pts[0];
    let bestD = -1;
    for (const p of pts) {
      const d = Math.min(...centers.map((c) => d2(p, c)));
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centers.push(best.slice());
  }
  const counts = new Array<number>(K).fill(0);
  for (let iter = 0; iter < 14; iter++) {
    const sums = centers.map(() => [0, 0, 0]);
    counts.fill(0);
    for (const p of pts) {
      let k = 0;
      for (let j = 1; j < K; j++) if (d2(p, centers[j]) < d2(p, centers[k])) k = j;
      counts[k]++;
      for (let c = 0; c < 3; c++) sums[k][c] += p[c];
    }
    for (let k = 0; k < K; k++) if (counts[k]) centers[k] = sums[k].map((v) => v / counts[k]);
  }
  const hex = (c: number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const chroma = (c: number[]): number => (Math.max(...c) - Math.min(...c)) / 255;
  const clusters = centers.map((c, k) => ({ c, share: counts[k] / pts.length })).filter((x) => x.share >= 0.01);
  clusters.sort((a, b) => b.share - a.share);
  const [first, ...rest] = clusters;
  rest.sort((a, b) => b.share * (0.25 + 3 * chroma(b.c)) - a.share * (0.25 + 3 * chroma(a.c)));
  const chosen = [first];
  for (const x of rest) {
    if (chosen.length >= 5) break;
    if (chosen.every((y) => d2(x.c, y.c) > 30 * 30)) chosen.push(x);
  }
  return chosen.map((x) => hex(x.c));
}

const snapshot: Snapshot = {
  source: 'ByMykel/CSGO-API (skins_not_grouped.json, crates.json, collections.json)',
  fetched: new Date().toISOString().slice(0, 10),
  weapons,
  cases: cases.map((c) => ({ id: c.id, name: c.name, date: c.first_sale_date ?? '', items: c.contains.map((i) => i.id), rare: (c.contains_rare ?? []).map((i) => i.id) })),
  collections: collections.filter((col) => col.contains.some((i) => wanted.has(i.id))).map((col) => ({ id: col.id, name: col.name })),
  skins,
};
writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(`${OUT}: ${snapshot.cases.length} cases, ${snapshot.collections.length} collections, ${Object.keys(skins).length} skins`);
