// Procedural CS skin finishes on the game's toon material. One shader program serves every finish (a
// uniform picks the pattern), so a new skin never compiles anything mid-game. Patterns are 3D noise in
// object space: no UVs needed, no seams on the box-built models. Wear grows with the float: paint chips
// off at edges and in noise patches, showing the steel underneath, plus fine scratches.

import { Color, MeshToonMaterial, type IUniform } from 'three';
import { toonRamp } from './toon';

export interface SkinLook {
  finish: string;
  palette: string[];
  float: number;
  seed: number;
}

const FINISH: Record<string, number> = {
  vanilla: 0,
  solid: 1,
  anodized: 2,
  multi: 3,
  airbrush: 4,
  hydro: 5,
  spray: 6,
  custom: 7,
  patina: 8,
  gunsmith: 9,
  fade: 10,
  marble: 11,
  doppler: 12,
  case: 13,
  tiger: 14,
  web: 15,
  damascus: 16,
  slaughter: 17,
  leather: 18,
};

/** Finishes with a metallic sheen at grazing angles. */
const SHINY = new Set(['vanilla', 'anodized', 'multi', 'fade', 'marble', 'doppler', 'case', 'tiger', 'damascus', 'slaughter']);

const NOISE = /* glsl */ `
  varying vec3 vSkinPos;
  uniform vec3 uPal[5];
  uniform int uPalN;
  uniform int uFinish;
  uniform float uWear;
  uniform float uSeed;
  uniform float uPart;
  uniform float uSheen;
  float skHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float skNoise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(skHash(i), skHash(i + vec3(1,0,0)), f.x), mix(skHash(i + vec3(0,1,0)), skHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(skHash(i + vec3(0,0,1)), skHash(i + vec3(1,0,1)), f.x), mix(skHash(i + vec3(0,1,1)), skHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float skFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * skNoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
  vec3 skPal(float i) { int k = int(mod(floor(i), float(uPalN))); vec3 c = uPal[0]; for (int j = 1; j < 5; j++) if (j == k) c = uPal[j]; return c; }
  /** Bands through the palette (t in 0..1 spans all of it). */
  vec3 skRamp(float t) { float n = float(uPalN - 1); float x = clamp(t, 0.0, 0.999) * n; return mix(skPal(x), skPal(x + 1.0), smoothstep(0.0, 1.0, fract(x))); }
  vec3 skinColor() {
    vec3 p = vSkinPos + vec3(uSeed * 0.137, uSeed * 0.071, uSeed * 0.029);
    vec3 steel = vec3(0.32, 0.34, 0.37) * (0.85 + 0.3 * skNoise(vSkinPos * vec3(2.0, 2.0, 60.0)));
    vec3 c;
    float n = skFbm(p * 1.6);
    if (uFinish == 0) c = steel * 1.25;
    else if (uFinish == 1) c = mix(uPal[0], skPal(1.0 + uPart), step(0.5, uPart));
    else if (uFinish == 2) c = mix(uPal[0], skPal(1.0), smoothstep(-0.6, 0.8, vSkinPos.y + vSkinPos.z * 0.3));
    else if (uFinish == 3) c = skPal(uPart * 1.0 + floor(skNoise(p * 0.7) * 1.5));
    else if (uFinish == 4) c = skRamp(smoothstep(0.25, 0.75, n));
    else if (uFinish == 5) c = skPal(floor(smoothstep(0.3, 0.72, n) * float(uPalN) * 0.999));
    else if (uFinish == 6) { float b = skFbm(p * 2.6); c = b > 0.52 ? skPal(1.0 + floor(skNoise(p * 3.1) * 2.0)) : uPal[0]; }
    else if (uFinish == 7) { float band = sin(p.z * 5.5 + n * 6.0 + p.y * 2.0); c = band > 0.35 ? skPal(1.0) : band < -0.55 ? skPal(2.0 + step(0.6, n)) : uPal[0]; if (skNoise(p * 4.0) > 0.82) c = skPal(3.0); }
    else if (uFinish == 8) c = mix(skRamp(n), skRamp(skFbm(p * 5.0)), 0.35);
    else if (uFinish == 9) { float panel = step(0.92, fract(p.z * 3.0 + n * 0.2)); c = mix(uPal[0], skPal(1.0), panel + 0.25 * step(0.6, n)); }
    else if (uFinish == 10) c = skRamp(clamp(0.5 + vSkinPos.z * 1.6 + vSkinPos.y * 0.6 + (n - 0.5) * 0.25, 0.0, 1.0));
    else if (uFinish == 11) c = skRamp(0.5 + 0.5 * sin(p.z * 7.0 + n * 9.0));
    else if (uFinish == 12) { float t = abs(sin(p.x * 3.0 + skFbm(p * 2.2) * 10.0)); c = mix(uPal[0] * 0.7, skRamp(t), smoothstep(0.1, 0.9, t)); }
    else if (uFinish == 13) { vec3 blue = vec3(0.09, 0.22, 0.55); vec3 gold = vec3(0.62, 0.45, 0.12); float t = skFbm(p * 2.4); c = t > 0.56 ? blue : t < 0.42 ? gold : steel * 1.3; c = mix(c, blue * 1.4, step(0.75, skNoise(p * 6.0)) * 0.6); }
    else if (uFinish == 14) { float s = sin(p.z * 26.0 + n * 7.0); c = s > 0.25 ? vec3(0.78, 0.47, 0.09) : vec3(0.07, 0.05, 0.03); }
    else if (uFinish == 15) { vec3 q = p * 4.0; float web = min(abs(fract(length(q.yz) * 1.2) - 0.5), abs(fract(atan(q.y, q.z) * 1.91) - 0.5)); c = web < 0.06 ? vec3(0.06) : uPal[0]; }
    else if (uFinish == 16) { float l = sin(p.z * 30.0 + n * 14.0); c = mix(steel * 0.9, steel * 1.6, 0.5 + 0.5 * l); }
    else if (uFinish == 17) { float t = skFbm(p * 3.0); c = t > 0.5 ? mix(vec3(0.75, 0.12, 0.12), vec3(0.85, 0.75, 0.7), smoothstep(0.62, 0.7, t)) : vec3(0.45, 0.07, 0.08); }
    else { c = uPal[0] * (0.88 + 0.24 * skNoise(vSkinPos * 40.0)); c = mix(c, skPal(1.0), step(0.5, uPart)); }
    // Wear: chipped paint at the ends and in patches, scratches across the length.
    if (uFinish != 0 && uFinish != 18) {
      float edge = smoothstep(0.75, 1.0, abs(fract(vSkinPos.z * 3.0) - 0.5) * 2.0);
      float chip = skFbm(vSkinPos * 7.0 + uSeed);
      float wornAway = step(chip + 0.18, uWear * 1.15 + edge * uWear * 0.6);
      float scratch = step(0.985 - uWear * 0.06, skNoise(vSkinPos * vec3(80.0, 80.0, 3.0) + uSeed)) * step(0.1, uWear);
      c = mix(c, steel * 1.2, clamp(wornAway + scratch * 0.7, 0.0, 1.0));
      c *= 1.0 - uWear * 0.18 * skNoise(vSkinPos * 12.0);
    }
    return c;
  }
`;

const tmp = new Color();

/** Palette colours a little richer than the photo they were measured from (studio light flattens them). */
function vivid(hex: string): Color {
  const c = new Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, Math.min(1, hsl.s * 1.3), Math.min(0.85, hsl.l * 1.08 + 0.02));
}

export interface SkinUniforms {
  [name: string]: IUniform;
  uPal: IUniform<Color[]>;
  uPalN: IUniform<number>;
  uFinish: IUniform<number>;
  uWear: IUniform<number>;
  uSeed: IUniform<number>;
  uPart: IUniform<number>;
  uSheen: IUniform<number>;
  uSkinScale: IUniform<number>;
}

/**
 * A toon material painted with a CS finish. `part` picks the secondary colours on multi-part finishes
 * (0 receiver, 1 grip and magazine, 2 barrel); `scale` sets how big the pattern is on this model.
 * `look = null` is the plain gunmetal of a weapon with no skin.
 */
export function skinMaterial(look: SkinLook | null, part = 0, scale = 6): MeshToonMaterial {
  const mat = new MeshToonMaterial({ gradientMap: toonRamp() });
  const u: SkinUniforms = {
    uPal: { value: [new Color(), new Color(), new Color(), new Color(), new Color()] },
    uPalN: { value: 1 },
    uFinish: { value: 0 },
    uWear: { value: 0 },
    uSeed: { value: 0 },
    uPart: { value: part },
    uSheen: { value: 0.25 },
    uSkinScale: { value: scale },
  };
  mat.userData.skin = u;
  setSkinLook(mat, look);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinPos;\nuniform float uSkinScale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinPos = position * uSkinScale;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( skinColor(), opacity );')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nfloat skRim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);\ntotalEmissiveRadiance += diffuseColor.rgb * skRim * uSheen;',
      );
  };
  // Every skin shares one program: the finish is a uniform, not a define.
  mat.customProgramCacheKey = () => 'cs-skin';
  return mat;
}

/** Repaints an existing skin material (equipping another skin needs no new shader). */
export function setSkinLook(mat: MeshToonMaterial, look: SkinLook | null): void {
  const u = mat.userData.skin as SkinUniforms;
  const pal = look?.palette.length ? look.palette : ['#5a5f68'];
  for (let i = 0; i < 5; i++) u.uPal.value[i].copy(vivid(pal[Math.min(i, pal.length - 1)]));
  u.uPalN.value = Math.min(5, pal.length);
  u.uFinish.value = look ? (FINISH[look.finish] ?? FINISH.custom) : FINISH.vanilla;
  u.uWear.value = look ? Math.min(1, Math.max(0, look.float)) : 0;
  u.uSeed.value = look ? look.seed : 0;
  u.uSheen.value = !look || SHINY.has(look.finish) ? 0.35 : 0.12;
  mat.color.copy(tmp.set('#ffffff'));
}
