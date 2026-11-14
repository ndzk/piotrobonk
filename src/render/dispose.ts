// Freeing an arena: Three.js disposes a material's program but never the textures it holds, so leaving a
// station used to leak every canvas texture it built. Everything that leaves the scene goes through here.

import type { Material, Object3D, Texture } from 'three';

interface MaybeMesh {
  geometry?: { dispose(): void };
  material?: Material | Material[];
}

/** Disposes a material and every texture it references. */
export function disposeMaterial(mat: Material, seen: Set<unknown>): void {
  if (seen.has(mat)) return;
  seen.add(mat);
  for (const value of Object.values(mat as unknown as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null || !('isTexture' in value)) continue;
    const tex = value as Texture;
    if (seen.has(tex)) continue;
    seen.add(tex);
    tex.dispose();
  }
  mat.dispose();
}

/** Removes a subtree from the scene and frees its geometries, materials and textures. */
export function disposeTree(root: Object3D, seen: Set<unknown> = new Set()): void {
  root.traverse((o) => {
    const mesh = o as MaybeMesh;
    if (mesh.geometry && !seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) disposeMaterial(m, seen);
  });
  root.removeFromParent();
}
