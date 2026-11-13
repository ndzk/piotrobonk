// Dev-only arena preview (not part of the build): renders one station from a few camera angles so an
// arena can be checked without playing. scripts/render-station.ts screenshots it.
// Query: ?id=fabryczna&view=bird|eye|corner|ground&yaw=0.8&dist=70&height=40
import '../fonts.css';
import { ACESFilmicToneMapping, Mesh, MeshToonMaterial, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { BOSSES } from '../content/bosses';
import { STATIONS } from '../content/stations/index';
import { enemyModel } from '../game/enemy-models';
import { World } from '../game/world';
import { outlineGeometry } from '../characters/geometry';
import { outlineMaterial, toonRamp } from '../render/toon';

const params = new URLSearchParams(location.search);
const id = params.get('id') ?? 'fabryczna';
const def = STATIONS.find((s) => s.id === id) ?? STATIONS[0];
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('no canvas');
const view3d = canvas;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = ACESFilmicToneMapping;
const scene = new Scene();
const world = new World(def, scene);
const camera = new PerspectiveCamera(55, 1, 0.1, 600);

// ?boss=biletomat drops the boss model into the arena at the origin, for looking it over.
const bossId = params.get('boss');
if (bossId) {
  const def = BOSSES.find((b) => b.id === bossId);
  const model = enemyModel(bossId);
  const mesh = new Mesh(model.body, new MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() }));
  const outline = new Mesh(outlineGeometry(model.body), outlineMaterial(0.012));
  mesh.add(outline);
  scene.add(mesh);
  document.title = def ? `${def.name} · podgląd` : bossId;
}

const VIEWS: Record<string, { dist: number; height: number; look: number }> = bossId
  ? { bird: { dist: 7, height: 9, look: 2 }, corner: { dist: 10, height: 4, look: 2 }, eye: { dist: 7, height: 2.4, look: 2 }, ground: { dist: 5, height: 1.2, look: 1.8 } }
  : {
      bird: { dist: 0.1, height: def.radius * 1.5, look: 0 },
      corner: { dist: def.radius * 1.1, height: def.radius * 0.55, look: 2 },
      eye: { dist: def.radius * 0.55, height: 6, look: 2 },
      ground: { dist: 14, height: 2.2, look: 1.6 },
    };

function frame(): void {
  const w = view3d.clientWidth;
  const h = view3d.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const view = VIEWS[params.get('view') ?? 'corner'] ?? VIEWS.corner;
  const yaw = Number(params.get('yaw') ?? 0.8);
  const dist = Number(params.get('dist') ?? view.dist);
  const height = Number(params.get('height') ?? view.height);
  camera.position.set(Math.sin(yaw) * dist, height, Math.cos(yaw) * dist);
  camera.lookAt(new Vector3(0, view.look, 0));
  world.sky.position.copy(camera.position);
  renderer.render(scene, camera);
  document.body.dataset.ready = '1';
}
renderer.setAnimationLoop(frame);
