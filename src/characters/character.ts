import { Color, Group, Mesh, MeshToonMaterial, Object3D, Vector3, type BufferGeometry, type Material, type Texture } from 'three';
import type { Appearance, Expression } from '../content/characters';
import { outlineMaterial, toonRamp } from '../render/toon';
import { paintBeard, paintFace, paintHairCap, toTexture } from './face';
import { column, merge, outlineGeometry, rgb, tube, type Shade } from './geometry';
import {
  HEAD_SIDES,
  beardThickness,
  beardTop,
  hairPieces,
  hairThickness,
  hairline,
  headExtras,
  headProfile,
  headSections,
  inflate,
} from './head';

export interface Joints {
  hips: Object3D;
  chest: Object3D;
  neck: Object3D;
  head: Object3D;
  shoulderL: Object3D;
  elbowL: Object3D;
  wristL: Object3D;
  shoulderR: Object3D;
  elbowR: Object3D;
  wristR: Object3D;
  thighL: Object3D;
  kneeL: Object3D;
  ankleL: Object3D;
  thighR: Object3D;
  kneeR: Object3D;
  ankleR: Object3D;
}

const outlines = new Map<number, Material>();
function outline(thickness: number): Material {
  let m = outlines.get(thickness);
  if (!m) {
    m = outlineMaterial(thickness);
    outlines.set(thickness, m);
  }
  return m;
}

function joint(parent: Object3D, name: string, x: number, y: number, z: number): Object3D {
  const j = new Object3D();
  j.name = name;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/** Vertical gradient baked into vertex colours: a cheap ambient-occlusion feel. */
function grad(hex: string, bottom = 0.86, top = 1): Shade {
  const c = rgb(hex);
  return (t) => c.clone().multiplyScalar(bottom + (top - bottom) * t);
}

/** Head scale relative to a realistic 180 cm body. */
export const HEAD_SCALE = 1.28;

export class Character {
  readonly root = new Group();
  readonly joints: Joints;
  readonly appearance: Appearance;
  private readonly faces: Record<Expression, Texture>;
  private readonly headMaterial: MeshToonMaterial;
  private expression: Expression = 'neutral';

  constructor(app: Appearance) {
    this.appearance = app;
    this.root.name = app.id;
    const r = this.root;
    const b = app.build;
    const hips = joint(r, 'hips', 0, 0.77, 0);
    const chest = joint(hips, 'chest', 0, 0.08, 0);
    const neck = joint(chest, 'neck', 0, 0.43, -0.005);
    const head = joint(neck, 'head', 0, 0.075, 0.005);
    // Stylised proportions: a bigger head keeps faces readable from the gameplay camera.
    head.scale.setScalar(HEAD_SCALE);
    const side = (s: 1 | -1, n: string): [Object3D, Object3D, Object3D, Object3D, Object3D, Object3D] => {
      const shoulder = joint(chest, `shoulder${n}`, s * 0.222 * b.shoulders, 0.345, -0.005);
      const elbow = joint(shoulder, `elbow${n}`, 0, -0.245, 0);
      const wrist = joint(elbow, `wrist${n}`, 0, -0.215, 0);
      const thigh = joint(hips, `thigh${n}`, s * 0.088 * b.waist, -0.05, 0);
      const knee = joint(thigh, `knee${n}`, 0, -0.33, 0);
      const ankle = joint(knee, `ankle${n}`, 0, -0.32, 0);
      return [shoulder, elbow, wrist, thigh, knee, ankle];
    };
    const [shoulderL, elbowL, wristL, thighL, kneeL, ankleL] = side(1, 'L');
    const [shoulderR, elbowR, wristR, thighR, kneeR, ankleR] = side(-1, 'R');
    this.joints = { hips, chest, neck, head, shoulderL, elbowL, wristL, shoulderR, elbowR, wristR, thighL, kneeL, ankleL, thighR, kneeR, ankleR };

    const ramp = toonRamp();
    const body = new MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
    const add = (j: Object3D, geo: BufferGeometry, mat: Material, line: number, at?: Vector3): Mesh => {
      const mesh = new Mesh(geo, mat);
      if (at) mesh.position.copy(at);
      j.add(mesh);
      if (line > 0) {
        const hull = new Mesh(outlineGeometry(geo), outline(line));
        if (at) hull.position.copy(at);
        j.add(hull);
      }
      return mesh;
    };

    // --- Head ---
    const prof = headProfile(app);
    const headAt = new Vector3(0, -0.045, -0.005);
    const face = (e: Expression): Texture => toTexture(paintFace(app, prof, e));
    this.faces = { neutral: face('neutral'), angry: face('angry'), smirk: face('smirk'), butthurt: face('butthurt') };
    this.headMaterial = new MeshToonMaterial({ map: this.faces.neutral, gradientMap: ramp });
    const white = new Color(1, 1, 1);
    const style = app.hair.style;
    add(head, tube(headSections(prof), { sides: HEAD_SIDES, shade: white, smooth: true, uv: true, capStart: true, capEnd: true }), this.headMaterial, 0.0042, headAt);
    add(head, merge(headExtras(app, prof)), body, 0, headAt);

    const cap = inflate(
      tube(headSections(prof), {
        sides: HEAD_SIDES,
        shade: white,
        smooth: true,
        uv: true,
        capEnd: true,
        keep: (h, a) => h > hairline(style, a) - 0.035,
      }),
      (h, a) => hairThickness(style, h, a),
    );
    const capMat = new MeshToonMaterial({ map: toTexture(paintHairCap(app)), gradientMap: ramp, alphaTest: 0.5 });
    add(head, cap, capMat, 0, headAt);
    add(head, merge(hairPieces(app, prof)), body, style === 'quiff' ? 0.0022 : 0.0012, headAt);

    if (app.beard.style === 'full') {
      const shell = inflate(
        tube(headSections(prof), {
          sides: HEAD_SIDES,
          shade: white,
          smooth: true,
          uv: true,
          capStart: true,
          keep: (h, a) => h < beardTop(a) + 0.03 && Math.abs(a) < 2.45,
        }),
        beardThickness,
      );
      const beardMat = new MeshToonMaterial({ map: toTexture(paintBeard(app, prof)), gradientMap: ramp, alphaTest: 0.5 });
      add(head, shell, beardMat, 0, headAt);
    }

    // --- Body ---
    const top = app.top;
    const skin = app.skin;
    add(neck, column([[-0.05, 0.052, 0.05, 0.05], [0.03, 0.05, 0.048, 0.048], [0.1, 0.052, 0.05, 0.05]], new Vector3(), { sides: 14, shade: grad(skin, 0.82, 0.95), smooth: true }), body, 0.005);

    const cw = b.chest;
    const ww = b.waist;
    const shirtShade: Shade = (t) => {
      const base = rgb(t > 0.94 ? top.trim : top.color);
      return base.multiplyScalar(t < 0.04 ? 0.8 : 0.84 + 0.16 * t);
    };
    add(
      chest,
      column(
        [
          [-0.125, 0.182 * ww, 0.11, 0.104],
          [-0.05, 0.168 * ww, 0.102, 0.097],
          [0.06, 0.165 * cw, 0.104, 0.095],
          [0.18, 0.179 * cw, 0.112, 0.099],
          [0.28, 0.192 * b.shoulders, 0.108, 0.099],
          [0.34, 0.196 * b.shoulders, 0.098, 0.095],
          [0.385, 0.162 * b.shoulders, 0.084, 0.084],
          [0.415, 0.102, 0.072, 0.072],
          [0.432, 0.07, 0.062, 0.064],
        ],
        new Vector3(),
        { sides: 20, shade: shirtShade, smooth: true },
      ).scale(1.12, 1, 1.1),
      body,
      0.006,
    );
    if (top.style === 'polo') {
      add(chest, column([[0.395, 0.075, 0.07, 0.07], [0.43, 0.079, 0.074, 0.07], [0.462, 0.088, 0.085, 0.075]], new Vector3(), { sides: 18, shade: grad(top.trim, 0.9, 1.05), smooth: true }), body, 0.004);
      add(chest, column([[0.27, 0.012, 0.004, 0.004], [0.4, 0.012, 0.004, 0.004]], new Vector3(0, 0, 0.101 * cw), { sides: 4, shade: rgb(top.color, 1.25), smooth: false }), body, 0);
      for (const y of [0.31, 0.36]) {
        add(chest, tube([{ p: new Vector3(0, y, 0.104 * cw), rx: 0.0045, rf: 0.0045, rb: 0.0045 }, { p: new Vector3(0, y, 0.108 * cw), rx: 0.0045, rf: 0.0045, rb: 0.0045 }], { sides: 8, shade: rgb('#d9d3c6'), smooth: true, capEnd: true }), body, 0);
      }
    }

    const legs = app.legs;
    add(
      hips,
      column(
        [
          [-0.165, 0.05 * ww, 0.04, 0.04],
          [-0.14, 0.11 * ww, 0.07, 0.068],
          [-0.09, 0.155 * ww, 0.094, 0.092],
          [-0.03, 0.158 * ww, 0.096, 0.094],
          [0.02, 0.14 * ww, 0.086, 0.084],
          [0.07, 0.13 * ww, 0.08, 0.078],
        ],
        new Vector3(),
        { sides: 18, shade: (t) => rgb(legs.color, 0.85 + 0.15 * t), smooth: true, capStart: true },
      ).scale(1.12, 1, 1.1),
      body,
      0.006,
    );

    for (const s of [1, -1] as const) {
      const [shoulder, elbow, wrist, thigh, knee, ankle] = s === 1 ? [shoulderL, elbowL, wristL, thighL, kneeL, ankleL] : [shoulderR, elbowR, wristR, thighR, kneeR, ankleR];
      const a = b.arms * 1.1;
      // Sleeve, upper arm, forearm, hand with thumb.
      add(
        shoulder,
        column([[0.048, 0.014 * a, 0.014 * a, 0.014 * a], [0.036, 0.043 * a, 0.043 * a, 0.043 * a], [0.0, 0.058 * a, 0.057 * a, 0.057 * a], [-0.12, 0.056 * a, 0.055 * a, 0.055 * a], [-0.14, 0.057 * a, 0.056 * a, 0.056 * a]], new Vector3(), {
          sides: 14,
          shade: (t) => rgb(t < 0.15 ? top.trim : top.color, 0.86 + 0.14 * t),
          smooth: true,
          capStart: true,
          capEnd: true,
        }),
        body,
        0.005,
      );
      add(shoulder, column([[-0.11, 0.048 * a, 0.048 * a, 0.048 * a], [-0.17, 0.046 * a, 0.046 * a, 0.046 * a], [-0.25, 0.041 * a, 0.041 * a, 0.041 * a]], new Vector3(), { sides: 12, shade: grad(skin, 0.9, 1), smooth: true }), body, 0.005);
      add(elbow, column([[0.015, 0.042 * a, 0.042 * a, 0.042 * a], [-0.07, 0.044 * a, 0.042 * a, 0.04 * a], [-0.21, 0.032 * a, 0.03 * a, 0.03 * a]], new Vector3(), { sides: 12, shade: grad(skin, 0.9, 1), smooth: true }), body, 0.005);
      const hand = merge([
        column([[0.01, 0.015, 0.025, 0.025], [-0.03, 0.019, 0.032, 0.03], [-0.068, 0.017, 0.031, 0.028], [-0.093, 0.009, 0.018, 0.016]], new Vector3(), { sides: 10, shade: rgb(skin), smooth: true, capEnd: true }),
        tube([{ p: new Vector3(-s * 0.006, -0.018, 0.02), rx: 0.0095, rf: 0.0095, rb: 0.0095 }, { p: new Vector3(-s * 0.012, -0.042, 0.034), rx: 0.0085, rf: 0.0085, rb: 0.0085 }, { p: new Vector3(-s * 0.013, -0.058, 0.038), rx: 0.0065, rf: 0.0065, rb: 0.0065 }], { sides: 8, shade: rgb(skin, 0.96), smooth: true, capEnd: true }),
      ]);
      hand.scale(1.2, 1.2, 1.2);
      add(wrist, hand, body, 0.004);

      // Leg: thigh, shin with hem, shoe with sole.
      const l = b.legs;
      add(thigh, column([[0.02, 0.08 * l, 0.084, 0.08], [-0.05, 0.094 * l, 0.098, 0.094], [-0.19, 0.083 * l, 0.086, 0.083], [-0.34, 0.07 * l, 0.073, 0.07]], new Vector3(), { sides: 14, shade: grad(legs.color, 0.85, 1), smooth: true }), body, 0.006);
      add(knee, column([[0.03, 0.07 * l, 0.073, 0.069], [-0.08, 0.068 * l, 0.071, 0.067], [-0.24, 0.059 * l, 0.062, 0.059], [-0.288, 0.062 * l, 0.065, 0.062], [-0.305, 0.062 * l, 0.065, 0.062]], new Vector3(), { sides: 14, shade: (t) => rgb(t < 0.1 ? legs.shade : legs.color, 0.88 + 0.12 * t), smooth: true, capStart: true }), body, 0.006);
      const loafer = app.shoes.color !== app.shoes.sole && top.style === 'polo';
      const shoeTop = loafer ? 0.7 : 1;
      add(
        ankle,
        merge([
          tube(
            [
              { p: new Vector3(0, -0.035, -0.058), rx: 0.04, rf: 0.044, rb: 0.038 * shoeTop },
              { p: new Vector3(0, -0.038, -0.005), rx: 0.046, rf: 0.042, rb: 0.044 * shoeTop },
              { p: new Vector3(0, -0.046, 0.065), rx: 0.047, rf: 0.034, rb: 0.03 * shoeTop },
              { p: new Vector3(0, -0.051, 0.118), rx: 0.042, rf: 0.029, rb: 0.022 * shoeTop },
              { p: new Vector3(0, -0.055, 0.15), rx: 0.03, rf: 0.024, rb: 0.012 },
            ],
            { sides: 14, shade: grad(app.shoes.color, 0.9, 1), smooth: true, capStart: true, capEnd: true },
          ),
          tube(
            [
              { p: new Vector3(0, -0.074, -0.062), rx: 0.044, rf: 0.009, rb: 0.009 },
              { p: new Vector3(0, -0.074, 0.06), rx: 0.05, rf: 0.009, rb: 0.009 },
              { p: new Vector3(0, -0.074, 0.158), rx: 0.034, rf: 0.009, rb: 0.009 },
            ],
            { sides: 12, shade: rgb(app.shoes.sole), smooth: true, capStart: true, capEnd: true },
          ),
        ]).scale(1.12, 1.1, 1.08),
        body,
        0.005,
      );
    }
    this.idle(0);
  }

  setExpression(e: Expression): void {
    if (e === this.expression) return;
    this.expression = e;
    this.headMaterial.map = this.faces[e];
  }

  /** Relaxed standing pose with breathing. */
  idle(t: number): void {
    const j = this.joints;
    const breath = Math.sin(t * 1.6);
    j.chest.rotation.x = -0.02 + breath * 0.012;
    j.chest.position.y = 0.08 + breath * 0.002;
    j.head.rotation.x = 0.03 - breath * 0.01;
    j.shoulderL.rotation.set(0.04, 0, 0.13 + breath * 0.01);
    j.shoulderR.rotation.set(0.04, 0, -0.13 - breath * 0.01);
    j.elbowL.rotation.set(-0.16, 0, 0);
    j.elbowR.rotation.set(-0.16, 0, 0);
    j.wristL.rotation.set(0, 0, -0.06);
    j.wristR.rotation.set(0, 0, 0.06);
    j.thighL.rotation.set(0, 0, 0.03);
    j.thighR.rotation.set(0, 0, -0.03);
    j.kneeL.rotation.set(0.02, 0, 0);
    j.kneeR.rotation.set(0.02, 0, 0);
    j.ankleL.rotation.set(-0.02, 0, -0.03);
    j.ankleR.rotation.set(-0.02, 0, 0.03);
  }
}
