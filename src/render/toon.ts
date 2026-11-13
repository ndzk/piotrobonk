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
export function outlineMaterial(thickness: number, color: ColorRepresentation = '#1b1418'): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([ShaderLib.basic.uniforms, { outlineColor: { value: new Color(color) }, thickness: { value: thickness } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float thickness;
      void main() {
        vec4 local = vec4(position + normal * thickness, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
        #endif
        vec4 mvPosition = modelViewMatrix * local;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    side: BackSide,
    fog: true,
  });
}
