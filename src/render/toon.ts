import { BackSide, Color, DataTexture, NearestFilter, RedFormat, ShaderLib, ShaderMaterial, UniformsUtils, type ColorRepresentation } from 'three';

let ramp: DataTexture | null = null;

/** Three-band light ramp shared by every toon material: shadow, mid, lit. */
export function toonRamp(): DataTexture {
  if (!ramp) {
    ramp = new DataTexture(new Uint8Array([105, 180, 255]), 3, 1, RedFormat);
    ramp.minFilter = NearestFilter;
    ramp.magFilter = NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
  }
  return ramp;
}

/**
 * Inverted-hull outline: the mesh is drawn again with back faces only, pushed out along smooth normals.
 * Use with geometry from `outlineGeometry` so hard edges do not crack the hull.
 */
/**
 * The ink outline (an inflated back-face hull). `fade` dithers it out between those two distances from the
 * camera, matching a body that does the same (a boss up close): with the camera inside the hull its black
 * back faces would otherwise fill the whole screen.
 */
export function outlineMaterial(thickness: number, color: ColorRepresentation = '#1b1418', fade: [number, number] | null = null): ShaderMaterial {
  const dither = fade
    ? `if (smoothstep(${fade[0].toFixed(2)}, ${fade[1].toFixed(2)}, vDist) < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;`
    : '';
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([ShaderLib.basic.uniforms, { outlineColor: { value: new Color(color) }, thickness: { value: thickness } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float thickness;
      varying float vDist;
      void main() {
        vec4 local = vec4(position + normal * thickness, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
        #endif
        vec4 mvPosition = modelViewMatrix * local;
        vDist = length(mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 outlineColor;
      varying float vDist;
      void main() {
        ${dither}
        gl_FragColor = vec4(outlineColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    side: BackSide,
    fog: true,
  });
}
