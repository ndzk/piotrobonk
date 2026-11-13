import { Color, Float32BufferAttribute, type BufferGeometry } from 'three';

/**
 * Bakes one flat colour into a geometry's vertex colours, so many differently coloured parts can be
 * merged into a single mesh. Used by every procedurally built prop.
 */
export function tinted(g: BufferGeometry, color: string, x = 0, y = 0, z = 0): BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute('uv');
  if (x || y || z) geo.translate(x, y, z);
  const c = new Color(color);
  const n = geo.getAttribute('position').count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}
