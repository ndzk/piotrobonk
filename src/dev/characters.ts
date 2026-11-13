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
  WebGLRenderer,
} from 'three';
import { Character } from '../characters/character';
import { BARTEK, EXPRESSIONS, EXPRESSION_NAMES, PIOTREK, type Appearance } from '../content/characters';

const PHOTOS: Record<Appearance['id'], { src: string; position: string }> = {
  piotrek: { src: '/ref/piotrek-przod.webp', position: '55% 40%' },
  bartek: { src: '/ref/bartek-przod.png', position: '45% 50%' },
};

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

// ?view=azimuth,targetY,distance,character renders one large close-up instead of the sheet (for inspection).
const view = new URLSearchParams(location.search).get('view')?.split(',').map(Number);
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
  const img = document.createElement('img');
  img.className = 'photo';
  img.src = PHOTOS[app.id].src;
  img.style.objectPosition = PHOTOS[app.id].position;
  row.append(cell('Zdjęcie', img), cell('Twarz', shot(300, 340, 0, [0, 1.53, 0], 1.75, 18)));
  const body: [string, number][] = [
    ['Przód', 0],
    ['Trzy czwarte', -40],
    ['Profil', 90],
    ['Tył', 180],
  ];
  for (const [label, az] of body) row.append(cell(label, shot(220, 340, az, [0, 0.86, 0], 6.4, 17)));
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

await Promise.all([...document.images].map((i) => i.decode()));
document.body.dataset.ready = '1';
