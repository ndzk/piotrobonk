// Moving progress between devices: the save as a file to download, or as a code to copy and paste. Both go
// through `readSave`, so an import is repaired and migrated exactly like a save read from storage.

import { readSave, SAVE_VERSION, type Save } from './save';

const APP = 'piotrobonk';
/** Codes start with this, so a paste of something else is recognised at once. */
const PREFIX = 'PB1-';

/** `damaged`: it is one of our codes, but cut short or mangled on the way. */
export type Imported = Save | 'newer' | 'invalid' | 'damaged';

/** The file: readable JSON, tagged so a random JSON file is not taken for a save. */
export function saveToFile(save: Save): string {
  return JSON.stringify({ app: APP, version: SAVE_VERSION, exported: new Date().toISOString(), save }, null, 1);
}

export function fileToSave(text: string): Imported {
  try {
    return fromData(JSON.parse(text) as unknown);
  } catch {
    return 'invalid';
  }
}

/** The code: the same JSON, deflated and base64url-encoded, with a prefix. */
export async function saveToCode(save: Save): Promise<string> {
  const json = JSON.stringify({ app: APP, version: SAVE_VERSION, save });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return PREFIX + toBase64Url(packed);
}

export async function codeToSave(code: string): Promise<Imported> {
  // Chat apps and e-mail wrap long lines and add spaces: none of that is part of the code.
  const clean = code.replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) return 'invalid';
  try {
    const bytes = await pipe(fromBase64Url(clean.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
    return fromData(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  } catch {
    return 'damaged';
  }
}

function fromData(data: unknown): Imported {
  if (typeof data !== 'object' || data === null) return 'invalid';
  const d = data as { app?: unknown; version?: unknown; save?: unknown };
  if (d.app !== APP || typeof d.version !== 'number' || typeof d.save !== 'object' || d.save === null) return 'invalid';
  if (d.version > SAVE_VERSION) return 'newer';
  return readSave({ version: d.version, save: d.save });
}

/** Even a huge save is well under this unpacked; a code that inflates past it is not a save (a zip bomb). */
const MAX_UNPACKED = 8 * 1024 * 1024;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_UNPACKED) {
      await reader.cancel();
      throw new Error('too big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
