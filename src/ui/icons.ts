// Procedural item pictograms in the PKP style: yellow symbol on a blue tile. Cached as data URLs.

const cache = new Map<string, string>();
const BLUE = '#0d3b8c';
const YELLOW = '#ffd400';

type Draw = (g: CanvasRenderingContext2D) => void;

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

const DRAW: Record<string, Draw> = {
  teczka: (g) => {
    rr(g, 18, 34, 60, 40, 6);
    g.fill();
    g.lineWidth = 6;
    rr(g, 36, 22, 24, 16, 5);
    g.stroke();
    g.fillStyle = BLUE;
    g.fillRect(18, 50, 60, 4);
    g.fillRect(44, 46, 8, 12);
  },
  nerka: (g) => {
    g.beginPath();
    g.ellipse(48, 56, 30, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(10, 40);
    g.quadraticCurveTo(48, 30, 86, 40);
    g.stroke();
    g.fillStyle = BLUE;
    g.fillRect(28, 52, 40, 4);
  },
  energetyk: (g) => {
    rr(g, 30, 14, 36, 68, 8);
    g.fill();
    g.fillStyle = BLUE;
    g.beginPath();
    g.moveTo(52, 24);
    g.lineTo(38, 52);
    g.lineTo(49, 52);
    g.lineTo(43, 74);
    g.lineTo(60, 44);
    g.lineTo(49, 44);
    g.closePath();
    g.fill();
  },
  klapki: (g) => {
    for (const x of [32, 64]) {
      g.beginPath();
      g.ellipse(x, 52, 13, 30, x < 48 ? -0.12 : 0.12, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = BLUE;
    g.lineWidth = 5;
    for (const x of [32, 64]) {
      g.beginPath();
      g.moveTo(x - 10, 50);
      g.lineTo(x, 36);
      g.lineTo(x + 10, 50);
      g.stroke();
    }
  },
  kurtka: (g) => {
    g.beginPath();
    g.moveTo(34, 16);
    g.lineTo(48, 26);
    g.lineTo(62, 16);
    g.lineTo(84, 30);
    g.lineTo(80, 58);
    g.lineTo(70, 54);
    g.lineTo(70, 82);
    g.lineTo(26, 82);
    g.lineTo(26, 54);
    g.lineTo(16, 58);
    g.lineTo(12, 30);
    g.closePath();
    g.fill();
    g.strokeStyle = BLUE;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(48, 28);
    g.lineTo(48, 82);
    g.stroke();
  },
  zdrapka: (g) => {
    rr(g, 16, 22, 64, 52, 6);
    g.fill();
    g.fillStyle = BLUE;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 9 : 19;
      g.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  },
  termos: (g) => {
    rr(g, 32, 24, 32, 60, 8);
    g.fill();
    rr(g, 28, 12, 40, 14, 4);
    g.fill();
    g.fillStyle = BLUE;
    g.fillRect(32, 44, 32, 5);
  },
  okulary: (g) => {
    g.lineWidth = 7;
    for (const x of [30, 66]) {
      g.beginPath();
      g.arc(x, 52, 15, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(45, 50);
    g.quadraticCurveTo(48, 44, 51, 50);
    g.stroke();
    g.beginPath();
    g.moveTo(15, 48);
    g.lineTo(8, 38);
    g.moveTo(81, 48);
    g.lineTo(88, 38);
    g.stroke();
  },
  kanapka: (g) => {
    g.beginPath();
    g.moveTo(14, 66);
    g.lineTo(48, 22);
    g.lineTo(82, 66);
    g.closePath();
    g.fill();
    g.fillStyle = BLUE;
    g.fillRect(24, 54, 48, 5);
    rr(g, 14, 66, 68, 10, 3);
    g.fillStyle = YELLOW;
    g.fill();
  },
  bilet: (g) => {
    rr(g, 14, 28, 68, 40, 6);
    g.fill();
    g.fillStyle = BLUE;
    g.fillRect(22, 38, 30, 5);
    g.fillRect(22, 48, 22, 5);
    g.beginPath();
    g.arc(66, 48, 8, 0, Math.PI * 2);
    g.fill();
  },
  kawa: (g) => {
    g.beginPath();
    g.moveTo(26, 30);
    g.lineTo(70, 30);
    g.lineTo(64, 80);
    g.lineTo(32, 80);
    g.closePath();
    g.fill();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(38, 24);
    g.quadraticCurveTo(44, 16, 40, 8);
    g.moveTo(54, 24);
    g.quadraticCurveTo(60, 16, 56, 8);
    g.stroke();
    g.fillStyle = BLUE;
    g.fillRect(30, 44, 36, 6);
  },
  sos: (g) => {
    g.beginPath();
    g.moveTo(48, 12);
    g.quadraticCurveTo(80, 50, 70, 70);
    g.quadraticCurveTo(48, 92, 26, 70);
    g.quadraticCurveTo(16, 50, 48, 12);
    g.fill();
    g.fillStyle = BLUE;
    g.beginPath();
    g.arc(40, 62, 6, 0, Math.PI * 2);
    g.fill();
  },
  // A phone whose screen shows an almost empty battery (no lightning: Iskra and Energetyk have that).
  telefon: (g) => {
    rr(g, 30, 12, 36, 72, 8);
    g.fill();
    g.fillStyle = BLUE;
    rr(g, 35, 20, 26, 48, 3);
    g.fill();
    g.strokeStyle = YELLOW;
    g.lineWidth = 3;
    rr(g, 40, 34, 16, 26, 2);
    g.stroke();
    g.fillStyle = YELLOW;
    g.fillRect(44, 30, 8, 4);
    g.fillStyle = '#e2362c';
    g.fillRect(43, 54, 10, 4);
  },
  parasol: (g) => {
    g.beginPath();
    g.moveTo(12, 48);
    g.quadraticCurveTo(48, 0, 84, 48);
    g.closePath();
    g.fill();
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(48, 46);
    g.lineTo(48, 78);
    g.quadraticCurveTo(48, 86, 40, 84);
    g.stroke();
  },
  gwizdek: (g) => {
    g.beginPath();
    g.arc(56, 56, 22, 0, Math.PI * 2);
    g.fill();
    g.fillRect(12, 34, 44, 16);
    g.fillStyle = BLUE;
    g.beginPath();
    g.arc(56, 56, 8, 0, Math.PI * 2);
    g.fill();
  },
  // A can in flight, tipped over with speed lines behind it: thrown, not drunk (Energetyk) nor returned (butelka).
  puszka: (g) => {
    g.save();
    g.translate(56, 46);
    g.rotate(0.6);
    rr(g, -15, -26, 30, 52, 7);
    g.fill();
    g.fillStyle = BLUE;
    g.fillRect(-15, -10, 30, 5);
    g.fillRect(-15, 8, 30, 5);
    g.restore();
    g.fillStyle = YELLOW;
    for (const [y, w] of [
      [30, 18],
      [44, 24],
      [58, 16],
    ]) {
      rr(g, 10, y, w, 5, 2);
      g.fill();
    }
  },
  // ★ knife in place of the briefcase: a blade with a guard and a grip.
  noz: (g) => {
    g.beginPath();
    g.moveTo(22, 74);
    g.lineTo(70, 18);
    g.lineTo(76, 24);
    g.lineTo(34, 78);
    g.closePath();
    g.fill();
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(26, 62);
    g.lineTo(42, 78);
    g.stroke();
    rr(g, 12, 76, 18, 12, 4);
    g.fill();
  },
  // Gnat z CS by the class of the equipped gun.
  'gnat-smg': (g) => {
    g.fillRect(20, 32, 50, 16);
    g.fillRect(66, 36, 18, 6);
    g.fillRect(30, 46, 10, 30);
    g.fillRect(50, 46, 9, 20);
    g.fillRect(10, 36, 12, 8);
  },
  'gnat-rifle': (g) => {
    g.fillRect(24, 34, 46, 12);
    g.fillRect(68, 37, 22, 5);
    g.beginPath();
    g.moveTo(24, 34);
    g.lineTo(6, 40);
    g.lineTo(6, 54);
    g.lineTo(24, 46);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(48, 46);
    g.lineTo(58, 46);
    g.lineTo(64, 70);
    g.lineTo(54, 72);
    g.closePath();
    g.fill();
    g.fillRect(32, 46, 9, 18);
  },
  'gnat-sniper': (g) => {
    g.fillRect(20, 40, 50, 10);
    g.fillRect(68, 42, 24, 5);
    g.fillRect(4, 40, 18, 16);
    g.fillRect(30, 26, 30, 9);
    g.fillRect(40, 34, 6, 6);
    g.fillRect(34, 50, 9, 16);
  },
  'gnat-shotgun': (g) => {
    g.fillRect(24, 34, 62, 9);
    g.fillRect(40, 45, 40, 7);
    g.beginPath();
    g.moveTo(26, 34);
    g.lineTo(6, 44);
    g.lineTo(8, 58);
    g.lineTo(28, 46);
    g.closePath();
    g.fill();
    g.fillRect(30, 46, 9, 16);
  },
  'gnat-lmg': (g) => {
    g.fillRect(22, 32, 50, 14);
    g.fillRect(70, 36, 20, 5);
    g.fillRect(4, 34, 20, 12);
    rr(g, 38, 46, 22, 20, 3);
    g.fill();
    g.fillRect(28, 46, 8, 18);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(76, 41);
    g.lineTo(70, 60);
    g.moveTo(80, 41);
    g.lineTo(86, 60);
    g.stroke();
  },
  gnat: (g) => {
    g.beginPath();
    g.moveTo(12, 30);
    g.lineTo(84, 30);
    g.lineTo(84, 46);
    g.lineTo(48, 46);
    g.lineTo(44, 74);
    g.lineTo(28, 74);
    g.lineTo(32, 46);
    g.lineTo(12, 46);
    g.closePath();
    g.fill();
    g.fillStyle = BLUE;
    g.fillRect(36, 50, 6, 10);
  },
  iskra: (g) => {
    g.fillRect(10, 18, 76, 6);
    g.beginPath();
    g.moveTo(54, 24);
    g.lineTo(34, 56);
    g.lineTo(48, 56);
    g.lineTo(38, 86);
    g.lineTo(66, 48);
    g.lineTo(52, 48);
    g.lineTo(62, 24);
    g.closePath();
    g.fill();
  },
  // An open timetable booklet: two pages and a fold.
  rozklad: (g) => {
    g.beginPath();
    g.moveTo(48, 26);
    g.lineTo(12, 16);
    g.lineTo(12, 74);
    g.lineTo(48, 84);
    g.lineTo(84, 74);
    g.lineTo(84, 16);
    g.closePath();
    g.fill();
    g.fillStyle = BLUE;
    g.fillRect(46, 26, 4, 58);
    for (let k = 0; k < 4; k++) {
      g.fillRect(18, 30 + k * 11, 22, 3);
      g.fillRect(56, 30 + k * 11, 22, 3);
    }
  },
  'bilet-ulgowy': (g) => {
    rr(g, 14, 28, 68, 40, 6);
    g.fill();
    g.fillStyle = BLUE;
    g.font = '800 30px sans-serif';
    g.textAlign = 'center';
    g.fillText('50%', 48, 58);
  },
  // A departures board on its post, with the station clock on top.
  tabela: (g) => {
    g.fillRect(44, 56, 8, 30);
    rr(g, 12, 26, 72, 34, 4);
    g.fill();
    g.beginPath();
    g.arc(48, 18, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = BLUE;
    g.fillRect(47, 10, 2, 9);
    g.fillRect(47, 17, 7, 2);
    g.fillRect(18, 33, 14, 5);
    g.fillRect(36, 33, 42, 5);
    g.fillRect(18, 46, 14, 5);
    g.fillRect(36, 46, 42, 5);
  },
  butelka: (g) => {
    rr(g, 34, 34, 28, 50, 8);
    g.fill();
    g.fillRect(42, 14, 12, 24);
    g.fillStyle = BLUE;
    g.fillRect(34, 50, 28, 10);
  },
  zapiekanka: (g) => {
    rr(g, 10, 38, 76, 24, 12);
    g.fill();
    g.strokeStyle = '#d7263d';
    g.lineWidth = 5;
    g.beginPath();
    for (let x = 18; x <= 78; x += 8) g.lineTo(x, x % 16 ? 44 : 54);
    g.stroke();
  },
};

/** Evolutions reuse their base weapon's pictogram on a gold tile. */
const EVOLVED: Record<string, string> = {
  'teczka-prezesa': 'teczka',
  'bilet-sieciowy': 'bilet',
  espresso: 'kawa',
  kebab: 'sos',
  powerbank: 'telefon',
  'parasol-burzowy': 'parasol',
  kontrola: 'gwizdek',
  zgrzewka: 'puszka',
  'siec-trakcyjna': 'iskra',
  'rozklad-2027': 'rozklad',
};

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = k % 2 === 0 ? r : r * 0.45;
    g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
}

/** Weapons whose picture the gear changes: the briefcase becomes the knife, Gnat takes its gun's shape. */
const aliases = new Map<string, string>();

export function setIconAlias(id: string, draw: string | null): void {
  if (draw) aliases.set(id, draw);
  else aliases.delete(id);
}

export function icon(id: string): string {
  const alias = aliases.get(id);
  const key = alias ? `${id}:${alias}` : id;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return '';
  const base = EVOLVED[id] as string | undefined;
  g.fillStyle = base ? '#b8860b' : BLUE;
  rr(g, 0, 0, 96, 96, 18);
  g.fill();
  if (base) {
    g.strokeStyle = '#ffe9a0';
    g.lineWidth = 4;
    rr(g, 3, 3, 90, 90, 16);
    g.stroke();
  }
  g.fillStyle = YELLOW;
  g.strokeStyle = YELLOW;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  (DRAW[alias ?? base ?? id] ?? DRAW.teczka)(g);
  // Evolutions carry a star, so a gold tile is not the only thing telling them apart.
  if (base) {
    g.fillStyle = '#fff6cf';
    star(g, 76, 76, 15);
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
