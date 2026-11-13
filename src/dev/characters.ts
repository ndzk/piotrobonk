// Dev-only sheet (not part of the build): reference photo next to the model from several sides and every
// facial expression. scripts/render-characters.ts screenshots it to ref/porownanie.png.
import '../fonts.css';
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  MeshToonMaterial,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Character } from '../characters/character';
import { paintFace } from '../characters/face';
import { headProfile } from '../characters/head';
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

/**
 * Variant B (experiment): project the eye-aligned photo onto the head's UV layout and posterise it, keeping the
 * procedural texture where the photo has no coverage (sides, back, under the hair).
 */
function photoFace(character: Character, img: HTMLImageElement, photoEyes: [number, number, number, number], base: HTMLCanvasElement): HTMLCanvasElement {
  const w = 600;
  const h = 680;
  const { eyes } = faceShot(character, w, h);
  // screen -> photo similarity (inverse of photo -> screen).
  const [px1, py1, px2, py2] = photoEyes;
  const [mx1, my1, mx2, my2] = eyes;
  const s = Math.hypot(px2 - px1, py2 - py1) / Math.hypot(mx2 - mx1, my2 - my1);
  const rot = Math.atan2(py2 - py1, px2 - px1) - Math.atan2(my2 - my1, mx2 - mx1);
  const cos = Math.cos(rot) * s;
  const sin = Math.sin(rot) * s;
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sg = src.getContext('2d', { willReadFrequently: true });
  const out = document.createElement('canvas');
  out.width = base.width;
  out.height = base.height;
  const og = out.getContext('2d', { willReadFrequently: true });
  if (!sg || !og) return base;
  sg.drawImage(img, 0, 0);
  const photo = sg.getImageData(0, 0, src.width, src.height);
  og.drawImage(base, 0, 0);
  const data = og.getImageData(0, 0, out.width, out.height);
  const prof = character.profile;
  const f = character.appearance.face;
  const v = new Vector3();
  const sample = (x: number, y: number, c: number): number => {
    const xi = Math.min(src.width - 1, Math.max(0, Math.round(x)));
    const yi = Math.min(src.height - 1, Math.max(0, Math.round(y)));
    return photo.data[(yi * src.width + xi) * 4 + c] ?? 0;
  };
  for (let ty = 0; ty < out.height; ty++) {
    const hh = 1 - ty / out.height;
    if (hh > f.hairline + 0.03) continue;
    for (let tx = 0; tx < out.width; tx++) {
      const a = (tx / out.width - 0.5) * 2 * Math.PI;
      if (Math.abs(a) > 1.35) continue;
      v.copy(prof.surface(a, hh));
      character.headMesh.localToWorld(v);
      v.project(camera);
      const sx = ((v.x + 1) / 2) * w - mx1;
      const sy = ((1 - v.y) / 2) * h - my1;
      const x = px1 + cos * sx - sin * sy;
      const y = py1 + sin * sx + cos * sy;
      let r = sample(x, y, 0);
      let g = sample(x, y, 1);
      let b = sample(x, y, 2);
      // Soft posterise of the luminance into 6 bands, keeping the hue: reads as painted, not photographic.
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const k = 6;
      const q = lum * k;
      const band = (Math.floor(q) + Math.min(1, Math.max(0, (q - Math.floor(q) - 0.35) / 0.3))) / k;
      const m = lum > 0.01 ? (band / lum) * 1.04 : 1;
      r = Math.min(255, r * m);
      g = Math.min(255, g * m);
      b = Math.min(255, b * m);
      const fade = Math.min(1, Math.max(0, (1.3 - Math.abs(a)) / 0.35)) * Math.min(1, Math.max(0, (f.hairline + 0.03 - hh) / 0.04)) * Math.min(1, hh / 0.04);
      const i = (ty * out.width + tx) * 4;
      data.data[i] = (data.data[i] ?? 0) * (1 - fade) + r * fade;
      data.data[i + 1] = (data.data[i + 1] ?? 0) * (1 - fade) + g * fade;
      data.data[i + 2] = (data.data[i + 2] ?? 0) * (1 - fade) + b * fade;
    }
  }
  og.putImageData(data, 0, 0);
  return out;
}

const sheet = document.getElementById('sheet');
if (!sheet) throw new Error('missing #sheet');

const params = new URLSearchParams(location.search);

// ?face=0|1 renders the head straight on and reports the eye centres in pixels, so a script can align the
// reference photo on top of the model by the eyes and compare proportions objectively.
const texMode = params.get('tex');
if (texMode !== null) {
  const app = texMode === '1' ? BARTEK : PIOTREK;
  sheet.append(paintFace(app, headProfile(app), 'neutral'));
  document.body.dataset.ready = '1';
  throw new Error('stop');
}
const faceMode = params.get('face');
if (faceMode !== null) {
  const character = new Character(faceMode === '1' ? BARTEK : PIOTREK);
  scene.add(character.root);
  if (params.has('grid')) {
    // Debug: horizontal lines every 0.1 of the head height to check the UV mapping.
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#ddd';
      g.fillRect(0, 0, 1024, 512);
      for (let i = 1; i < 10; i++) {
        g.fillStyle = i % 2 ? '#e00' : '#00c';
        g.fillRect(0, 512 * (1 - i / 10) - 2, 1024, 4);
      }
    }
    (character.headMesh.material as MeshToonMaterial).map = new CanvasTexture(c);
  }
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
  for (let i = 1; i < 10; i++) marks[`h${i}`] = px(character.faceWorld(0, i / 10))[1];
  // Actual mesh vertices on the front column, to compare with the analytic surface.
  const geo = character.headMesh.geometry;
  const pos = geo.getAttribute('position');
  const uvs = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(uvs.getX(i) - 0.5) > 0.001) continue;
    const v = character.headMesh.localToWorld(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    marks[`v${uvs.getY(i).toFixed(3)}`] = px(v)[1];
  }
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
  if (params.has('photo')) {
    const tex = new CanvasTexture(photoFace(character, img, PHOTOS[app.id].eyes, paintFace(app, character.profile, 'neutral')));
    tex.colorSpace = SRGBColorSpace;
    (character.headMesh.material as MeshToonMaterial).map = tex;
  }
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
  for (const e of params.has('photo') ? [] : EXPRESSIONS) {
    character.setExpression(e);
    faces.append(cell(EXPRESSION_NAMES[e], shot(165, 165, 14, [0, 1.5, 0.03], 1.55, 18)));
  }
  character.setExpression('neutral');
  row.append(faces);
  sheet.append(title, row);
  scene.remove(character.root);
}

document.body.dataset.ready = '1';
