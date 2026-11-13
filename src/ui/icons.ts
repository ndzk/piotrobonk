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

export function icon(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d');
  if (!g) return '';
  g.fillStyle = BLUE;
  rr(g, 0, 0, 96, 96, 18);
  g.fill();
  g.fillStyle = YELLOW;
  g.strokeStyle = YELLOW;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  (DRAW[id] ?? DRAW.teczka)(g);
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}
