import type { Camera, Object3D, WebGLRenderer } from 'three';

/**
 * Starts compiling every program `scene` needs for `camera` and the current render target. With
 * KHR_parallel_shader_compile the GPU compiles in parallel, nothing waits, and the first frame finds the
 * programs ready (the promise says when). Without it (software GL, some phones) compileAsync only logs a
 * warning, so this is the plain compile() the game always had there.
 */
export function precompile(renderer: WebGLRenderer, scene: Object3D, camera: Camera): Promise<unknown> {
  if (renderer.extensions.has('KHR_parallel_shader_compile')) return renderer.compileAsync(scene, camera);
  renderer.compile(scene, camera);
  return Promise.resolve();
}
