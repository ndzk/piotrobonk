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

export interface Appearance {
  id: 'piotrek' | 'bartek';
  name: string;
  /** Multipliers around a slim-average 180 cm build. */
  build: { shoulders: number; chest: number; waist: number; arms: number; legs: number };
  /** Head shape multipliers: width, length (height), depth, jaw width, chin projection, nose size. */
  head: { width: number; length: number; depth: number; jaw: number; chin: number; nose: number };
  skin: string;
  lips: string;
  /** lid: how open the eyes are at rest (Bartek D. has heavy lids). */
  eyes: { iris: string; size: number; lid: number };
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
  head: { width: 0.95, length: 1.04, depth: 1, jaw: 0.88, chin: 1.08, nose: 0.95 },
  skin: '#ecbfae',
  lips: '#cf8589',
  eyes: { iris: '#8fb6cf', size: 1, lid: 1 },
  brows: { color: '#5a3b2e', thickness: 1.7, arch: 0.35, tilt: 0.05 },
  hair: { style: 'quiff', color: '#3b291f', light: '#6f5444', dark: '#1a120d' },
  beard: { style: 'jawline', color: '#77503b', dark: '#5a3b2b' },
  marks: { freckles: 16, moles: [{ x: 0.024, y: 0.232, r: 0.0042 }] },
  top: { style: 'tee', color: '#4a536c', trim: '#3c4458' },
  legs: { color: '#2e3c59', shade: '#24304a' },
  shoes: { color: '#ece9e2', sole: '#cbc5ba' },
};

export const BARTEK: Appearance = {
  id: 'bartek',
  name: 'Bartek D.',
  build: { shoulders: 1, chest: 1, waist: 0.98, arms: 1, legs: 1 },
  head: { width: 1, length: 1.05, depth: 1.02, jaw: 0.96, chin: 1, nose: 1.08 },
  skin: '#e4ad97',
  lips: '#b97470',
  eyes: { iris: '#8d9c7e', size: 0.95, lid: 0.82 },
  brows: { color: '#3b2920', thickness: 1.45, arch: 0.2, tilt: -0.15 },
  hair: { style: 'swept', color: '#33241c', light: '#57402f', dark: '#180f0b' },
  beard: { style: 'full', color: '#4d3022', dark: '#2f1d14' },
  marks: { freckles: 0, moles: [] },
  top: { style: 'polo', color: '#2b3656', trim: '#3a4870' },
  legs: { color: '#bba57f', shade: '#a08b66' },
  shoes: { color: '#5c3c28', sole: '#38251a' },
};

export const CHARACTERS: readonly Appearance[] = [PIOTREK, BARTEK];
