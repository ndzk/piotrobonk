// Dev-only sheet (not part of the build): reference photo next to the model from several sides and every
// facial expression. scripts/render-characters.ts screenshots it to ref/porownanie.png.
import '../fonts.css';
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Character } from '../characters/character';
import { BARTEK, EXPRESSIONS, EXPRESSION_NAMES, PIOTREK, type Appearance } from '../content/characters';

// Reference photos (local only, gitignored) with the pupil centres measured on them, for eye alignment.
const PHOTOS: Record<Appearance['id'], { src: string; eyes: [number, number, number, number] }> = {
  piotrek: { src: '/ref/piotrek-przod.webp', eyes: [720, 749, 952, 745] },
  bartek: { src: '/ref/bartek-przod.png', eyes: [77.5, 149.25, 139.5, 148.75] },
};

/** Renders the head straight on, framed on the eyes; returns the image and the eye centres in pixels. */
function faceShot(character: Character, w: number, h: number): { canvas: HTMLCanvasElement; eyes: [number, number, number, number] } {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = 11;
  camera.updateProjectionMatrix();
  const l = character.eyeWorld(-1);
  const r = character.eyeWorld(1);
  const mid = l.clone().add(r).multiplyScalar(0.5);
  camera.position.set(mid.x, mid.y, mid.z + 2.4);
  camera.lookAt(mid.x, mid.y - 0.02, mid.z);
  camera.updateMatrixWorld();
  const canvas = shot2dSized(w, h);
  const px = (v: Vector3): [number, number] => {
    const p = v.clone().project(camera);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h];
  };
  return { canvas, eyes: [...px(l), ...px(r)] };
}

/** Draws the photo so its eyes land on the model's eyes (similarity transform), optionally with the model on top. */
function aligned(img: HTMLImageElement, photoEyes: [number, number, number, number], modelEyes: [number, number, number, number], w: number, h: number, model?: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = w * 2;
  out.height = h * 2;
  out.style.width = `${w}px`;
  out.style.height = `${h}px`;
  const g = out.getContext('2d');
  if (!g) return out;
  const [px1, py1, px2, py2] = photoEyes;
  const [mx1, my1, mx2, my2] = modelEyes.map((v) => v * 2);
  const pdx = px2 - px1;
  const pdy = py2 - py1;
  const mdx = mx2 - mx1;
  const mdy = my2 - my1;
  const scale = Math.hypot(mdx, mdy) / Math.hypot(pdx, pdy);
  const rot = Math.atan2(mdy, mdx) - Math.atan2(pdy, pdx);
  g.translate(mx1, my1);
  g.rotate(rot);
  g.scale(scale, scale);
  g.translate(-px1, -py1);
  g.drawImage(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (model) {
    g.globalAlpha = 0.5;
    g.drawImage(model, 0, 0);
  }
  return out;
}

const renderer = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(2);
renderer.toneMapping = ACESFilmicToneMapping;
const scene = new Scene();
scene.background = new Color('#3a4160');
scene.add(new HemisphereLight('#e8eeff', '#5a4a44', 1.5));
const key = new DirectionalLight('#fff1e0', 2.4);
key.position.set(1.5, 3, 4);
scene.add(key);
const rim = new DirectionalLight('#9fb4ff', 1.2);
rim.position.set(-2, 2.5, -3);
scene.add(rim);
const camera = new PerspectiveCamera(18, 1, 0.1, 50);

function shot(width: number, height: number, azimuth: number, target: [number, number, number], distance: number, fov: number): HTMLCanvasElement {
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = fov;
  camera.updateProjectionMatrix();
  const a = (azimuth * Math.PI) / 180;
  camera.position.set(target[0] + Math.sin(a) * distance, target[1] + 0.05, target[2] + Math.cos(a) * distance);
  camera.lookAt(...target);
  renderer.render(scene, camera);
  const out = document.createElement('canvas');
  out.width = width * 2;
  out.height = height * 2;
  out.style.width = `${width}px`;
  out.style.height = `${height}px`;
  out.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
  return out;
}

function shot2dSized(w: number, h: number): HTMLCanvasElement {
  renderer.render(scene, camera);
  const out = document.createElement('canvas');
  out.width = w * 2;
  out.height = h * 2;
  out.style.width = `${w}px`;
  out.style.height = `${h}px`;
  out.getContext('2d')?.drawImage(renderer.domElement, 0, 0);
  return out;
}

function shot2d(size: number): HTMLCanvasElement {
  return shot2dSized(size, size);
}

function cell(label: string, content: HTMLElement): HTMLElement {
  const div = document.createElement('div');
  div.className = 'cell';
  const span = document.createElement('span');
  span.textContent = label;
  div.append(span, content);
  return div;
}

const sheet = document.getElementById('sheet');
if (!sheet) throw new Error('missing #sheet');

const params = new URLSearchParams(location.search);

// ?face=0|1 renders the head straight on and reports the eye centres in pixels, so a script can align the
// reference photo on top of the model by the eyes and compare proportions objectively.
// ?trace=0|1: the reference photo aligned to the model's eyes with a millimetre grid in face space
// (x from the centre line, y from the chin), used to trace features into src/content/characters.ts.
const traceMode = params.get('trace');
if (traceMode !== null) {
  const app = traceMode === '1' ? BARTEK : PIOTREK;
  const character = new Character(app);
  scene.add(character.root);
  const img = new Image();
  img.src = PHOTOS[app.id].src;
  await img.decode();
  const W = 1000;
  const H = 1100;
  const { eyes } = faceShot(character, W, H);
  const out = aligned(img, PHOTOS[app.id].eyes, eyes, W, H);
  const g = out.getContext('2d');
  if (g) {
    g.scale(2, 2);
    const f = app.face;
    const pxPerM = (eyes[2] - eyes[0]) / (2 * f.eyeX);
    const cx = (eyes[0] + eyes[2]) / 2;
    const ey = (eyes[1] + eyes[3]) / 2;
    const eyeY = f.eyes * character.profile.height;
    g.font = '11px sans-serif';
    for (let mm = -120; mm <= 120; mm += 5) {
      const x = cx + (mm / 1000) * pxPerM;
      g.strokeStyle = mm % 10 === 0 ? 'rgba(0,255,255,0.55)' : 'rgba(0,255,255,0.22)';
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
      if (mm % 10 === 0) {
        g.fillStyle = '#0ff';
        g.fillText(String(mm), x + 2, 12);
      }
    }
    for (let mm = -40; mm <= 400; mm += 5) {
      const y = ey - (mm / 1000 - eyeY) * pxPerM;
      if (y < 0 || y > H) continue;
      g.strokeStyle = mm % 10 === 0 ? 'rgba(255,255,0,0.55)' : 'rgba(255,255,0,0.22)';
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
      if (mm % 10 === 0) {
        g.fillStyle = '#ff0';
        g.fillText(String(mm), 2, y - 2);
      }
    }
  }
  sheet.append(out);
  document.body.dataset.ready = '1';
  throw new Error('stop');
}

const faceMode = params.get('face');
if (faceMode !== null) {
  const character = new Character(faceMode === '1' ? BARTEK : PIOTREK);
  scene.add(character.root);
  const size = 800;
  renderer.setSize(size, size, false);
  camera.aspect = 1;
  camera.fov = 11;
  camera.updateProjectionMatrix();
  const l = character.eyeWorld(-1);
  const r = character.eyeWorld(1);
  const mid = l.clone().add(r).multiplyScalar(0.5);
  camera.position.set(mid.x, mid.y, mid.z + 2.4);
  camera.lookAt(mid.x, mid.y - 0.02, mid.z);
  camera.updateMatrixWorld();
  sheet.append(shot2d(size));
  const px = (v: typeof l): number[] => {
    const p = v.clone().project(camera);
    return [((p.x + 1) / 2) * size, ((1 - p.y) / 2) * size];
  };
  document.body.dataset.eyes = JSON.stringify([...px(l), ...px(r)]);
  const f = character.appearance.face;
  const marks: Record<string, number | undefined> = { chin: px(character.faceWorld(0, 0.001))[1] };
  for (const k of ['eyes', 'brows', 'nose', 'mouth', 'hairline'] as const) marks[k] = px(character.faceWorld(0, f[k]))[1];
  document.body.dataset.marks = JSON.stringify(marks);
  document.body.dataset.ready = '1';
  throw new Error('stop');
}

// ?view=azimuth,targetY,distance,character renders one large close-up instead of the sheet (for inspection).
const view = params.get('view')?.split(',').map(Number);
if (view && view.length >= 3) {
  const app = view[3] === 1 ? BARTEK : PIOTREK;
  scene.add(new Character(app).root);
  sheet.append(shot(800, 800, view[0] ?? 0, [0, view[1] ?? 1, 0], view[2] ?? 3, 18));
  document.body.dataset.ready = '1';
  throw new Error('stop');
}

for (const app of [PIOTREK, BARTEK]) {
  const character = new Character(app);
  scene.add(character.root);
  const title = document.createElement('h2');
  title.textContent = app.name;
  const row = document.createElement('div');
  row.className = 'row';
  const img = new Image();
  img.src = PHOTOS[app.id].src;
  await img.decode();
  const face = faceShot(character, 300, 340);
  row.append(
    cell('Zdjęcie', aligned(img, PHOTOS[app.id].eyes, face.eyes, 300, 340)),
    cell('Model', face.canvas),
    cell('Nakładka 50%', aligned(img, PHOTOS[app.id].eyes, face.eyes, 300, 340, face.canvas)),
  );
  const body: [string, number][] = [
    ['Przód', 0],
    ['Trzy czwarte', -40],
    ['Profil', 90],
    ['Tył', 180],
  ];
  for (const [label, az] of body) row.append(cell(label, shot(200, 340, az, [0, 0.86, 0], 6.4, 17)));
  const faces = document.createElement('div');
  faces.className = 'faces';
  for (const e of EXPRESSIONS) {
    character.setExpression(e);
    faces.append(cell(EXPRESSION_NAMES[e], shot(165, 165, 14, [0, 1.5, 0.03], 1.55, 18)));
  }
  character.setExpression('neutral');
  row.append(faces);
  sheet.append(title, row);
  scene.remove(character.root);
}

document.body.dataset.ready = '1';
