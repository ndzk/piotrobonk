// Reading a render target back to the CPU without stalling the GPU, and without three.js's own async read:
// that one asks the fence `clientWaitSync(…, SYNC_FLUSH_COMMANDS_BIT)` every 4 ms, and in Chromium each of
// those is a flush through the GPU process. With software GL that starved the frame loop to a crawl (CI
// never got 30 frames out of the title). Here the fence is flushed once and looked at every 30 ms.

import type { WebGLRenderTarget, WebGLRenderer } from 'three';

const POLL_MS = 30;

/** Copies `target` (RGBA8) into `out`, resolving once the GPU has finished drawing it. */
export async function readPixelsAsync(renderer: WebGLRenderer, target: WebGLRenderTarget, out: Uint8Array): Promise<void> {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
  gl.bufferData(gl.PIXEL_PACK_BUFFER, out.byteLength, gl.STREAM_READ);
  gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.UNSIGNED_BYTE, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  renderer.setRenderTarget(prev);
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  try {
    await new Promise<void>((resolve, reject) => {
      const check = (): void => {
        if (gl.isContextLost() || !sync) {
          reject(new Error('WebGL context lost during a read-back'));
          return;
        }
        if (gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED) resolve();
        else window.setTimeout(check, POLL_MS);
      };
      window.setTimeout(check, POLL_MS);
    });
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  } finally {
    gl.deleteSync(sync);
    gl.deleteBuffer(buffer);
  }
}
