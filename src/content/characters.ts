// Appearance of the two characters modelled on real people. Colours are sampled from their reference photos;
// what the photos did not show (profile, back of the head, full body, height) is a documented assumption.
// Directions: +x is the character's own left, which is the viewer's right when they face the camera.

export type Expression = 'neutral' | 'angry' | 'smirk' | 'butthurt';

export const EXPRESSIONS: readonly Expression[] = ['neutral', 'angry', 'smirk', 'butthurt'];

export const EXPRESSION_NAMES: Record<Expression, string> = {
  neutral: 'Neutralny',
  angry: 'Wkurwiony',
  smirk: 'Cwaniacki uśmiech',
  butthurt: 'Ból dupy',
};

/** A point in face space, in millimetres: x from the centre line (+x = character's left), y up from the chin. */
export type Mm = [number, number];

/**
 * Facial features traced on the reference photo (aligned to the model by the pupils, millimetre grid).
 * Index 0 of the pairs is the -x side (viewer's left), index 1 the +x side. The painter draws these shapes
 * and derives every expression from them.
 */
export interface Traced {
  brows: [Brow, Brow];
  eyes: [Eye, Eye];
  mouth: { left: Mm; right: Mm; upperTop: number; bowDip: number; line: number; lowerBottom: number };
  nose: { tip: number; nostrils: number; nostrilX: number };
  /** Upper edge of facial hair on the cheek, from the moustache corner out to the sideburn (|x|, y). */
  beardEdge?: Mm[];
  /** Lower edge of a fringe over the forehead, from -x to +x. */
  fringe?: Mm[];
}
export interface Brow {
  inner: Mm;
  peak: Mm;
  outer: Mm;
  /** Thickness in mm at the inner end, the peak and the outer end. */
  thick: [number, number, number];
}
export interface Eye {
  inner: Mm;
  outer: Mm;
  /** Apex of the upper lid and lowest point of the lower lid. */
  top: Mm;
  bottom: Mm;
  iris: Mm;
  irisR: number;
}

export interface Appearance {
  id: 'piotrek' | 'bartek';
  name: string;
  /** Multipliers around a slim-average 180 cm build. */
  build: { shoulders: number; chest: number; waist: number; arms: number; legs: number };
  /** Head shape multipliers: width, length (height), depth, jaw width, chin projection, nose projection. */
  head: { width: number; length: number; depth: number; jaw: number; chin: number; nose: number };
  /**
   * Face layout measured on the reference photo (in units of the eye distance, converted here).
   * Heights are fractions of the head height (chin = 0, crown = 1); half-widths are in metres.
   */
  face: {
    eyes: number;
    brows: number;
    nose: number;
    mouth: number;
    hairline: number;
    earTop: number;
    earBottom: number;
    eyeX: number;
    noseHalf: number;
    mouthHalf: number;
  };
  traced: Traced;
  skin: string;
  lips: string;
  eyes: { iris: string };
  brows: { color: string; thickness: number; arch: number; tilt: number };
  hair: { style: 'quiff' | 'swept'; color: string; light: string; dark: string };
  beard: { style: 'jawline' | 'full'; color: string; dark: string };
  /** Face marks in face space: metres from the face centre line (x) and from the chin (y). */
  marks: { freckles: number; moles: { x: number; y: number; r: number }[] };
  top: { style: 'tee' | 'polo'; color: string; trim: string };
  legs: { color: string; shade: string };
  shoes: { color: string; sole: string };
}

export const PIOTREK: Appearance = {
  id: 'piotrek',
  name: 'Piotrek',
  build: { shoulders: 0.93, chest: 0.9, waist: 0.88, arms: 0.9, legs: 0.94 },
  head: { width: 0.962, length: 1.12, depth: 1, jaw: 1.1, chin: 1.05, nose: 1.0 },
  face: { eyes: 0.5, brows: 0.575, nose: 0.31, mouth: 0.188, hairline: 0.8, earTop: 0.476, earBottom: 0.327, eyeX: 0.044, noseHalf: 0.031, mouthHalf: 0.032 },
  traced: {
    brows: [
      { inner: [-14, 193], peak: [-50, 197], outer: [-80, 184], thick: [9, 8, 4] },
      { inner: [14, 193], peak: [46, 198], outer: [82, 182], thick: [9, 8, 4] },
    ],
    eyes: [
      { inner: [-24, 166], outer: [-64, 164.5], top: [-44, 172.5], bottom: [-45, 160.5], iris: [-45, 166], irisR: 6.2 },
      { inner: [23, 166], outer: [63, 165], top: [43, 172.5], bottom: [43, 160.5], iris: [43, 166], irisR: 6.2 },
    ],
    mouth: { left: [-37, 64], right: [28, 64.5], upperTop: 70.5, bowDip: 68.5, line: 63.5, lowerBottom: 52 },
    nose: { tip: 112, nostrils: 103, nostrilX: 11 },
  },
  skin: '#ecbfae',
  lips: '#cf8589',
  eyes: { iris: '#8fb6cf' },
  brows: { color: '#5a3b2e', thickness: 1.75, arch: 0.25, tilt: 0.05 },
  hair: { style: 'quiff', color: '#2f2119', light: '#5e4536', dark: '#140d09' },
  beard: { style: 'jawline', color: '#77503b', dark: '#5a3b2b' },
  marks: { freckles: 16, moles: [{ x: 0.034, y: 0.264, r: 0.0038 }, { x: -0.03, y: 0.227, r: 0.0016 }] },
  top: { style: 'tee', color: '#4a536c', trim: '#3c4458' },
  legs: { color: '#2e3c59', shade: '#24304a' },
  shoes: { color: '#ece9e2', sole: '#cbc5ba' },
};

export const BARTEK: Appearance = {
  id: 'bartek',
  name: 'Bartek D.',
  build: { shoulders: 1, chest: 1, waist: 0.98, arms: 1, legs: 1 },
  head: { width: 0.9, length: 0.93, depth: 1.02, jaw: 1.1, chin: 1, nose: 1.15 },
  face: { eyes: 0.542, brows: 0.589, nose: 0.365, mouth: 0.264, hairline: 0.78, earTop: 0.52, earBottom: 0.365, eyeX: 0.044, noseHalf: 0.027, mouthHalf: 0.034 },
  // Webcam photo taken from above: the lower face is stretched back by 1.19 below the eyes.
  traced: {
    brows: [
      { inner: [-15, 164.5], peak: [-50, 166.5], outer: [-83, 161.5], thick: [10, 9, 5] },
      { inner: [14, 163.5], peak: [47, 166.5], outer: [80, 164.5], thick: [9.5, 9, 5] },
    ],
    eyes: [
      { inner: [-26, 150.5], outer: [-67, 151.5], top: [-47, 155.5], bottom: [-47, 145], iris: [-47, 150.4], irisR: 5.8 },
      { inner: [24, 149.5], outer: [63, 152.5], top: [43, 155.5], bottom: [43, 145], iris: [41, 150.4], irisR: 5.8 },
    ],
    mouth: { left: [-34, 75.5], right: [34, 75.5], upperTop: 80.5, bowDip: 79, line: 73.5, lowerBottom: 65 },
    nose: { tip: 110, nostrils: 102, nostrilX: 9 },
    beardEdge: [[0, 95], [30, 93], [48, 88.5], [65, 100], [80, 115.6], [95, 139.7]],
    fringe: [[-95, 181], [-78, 188.5], [-52, 206.5], [0, 217.5], [45, 221.5], [80, 204.5], [95, 191.5]],
  },
  skin: '#e4ad97',
  lips: '#b97470',
  eyes: { iris: '#8d9c7e' },
  brows: { color: '#3b2920', thickness: 1.45, arch: 0.2, tilt: -0.15 },
  hair: { style: 'swept', color: '#2a1d16', light: '#4a3528', dark: '#120b08' },
  beard: { style: 'full', color: '#3f281c', dark: '#24160f' },
  marks: { freckles: 0, moles: [] },
  top: { style: 'polo', color: '#2b3656', trim: '#3a4870' },
  legs: { color: '#bba57f', shade: '#a08b66' },
  shoes: { color: '#5c3c28', sole: '#38251a' },
};

export const CHARACTERS: readonly Appearance[] = [PIOTREK, BARTEK];
