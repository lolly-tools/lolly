// SPDX-License-Identifier: MPL-2.0
/**
 * Tracker-module decode worker. libopenmpt (vendored WASM, BSD-3 + permissive internal
 * codecs - see src/vendor/libopenmpt/) decodes .mod/.xm/.s3m/.it/.stm/.mtm bytes to
 * stereo PCM off the main thread. The Neurospicy player and the video music-bed
 * exporter both post module bytes here and get back transferable channel buffers to
 * wrap in an AudioBuffer - the identical shape zzfxm-worker.ts uses. Headless: no
 * AudioContext and no live-player wrapper, just bytes → PCM, so the module flows
 * through the existing player graph (meter, seek, loop) exactly like an encoded loop.
 */
import createLibopenmpt, { type LibopenmptModule } from '../vendor/libopenmpt/libopenmpt.mjs';

interface DecodeRequest { id: number; bytes?: Uint8Array; sampleRate?: number; probe?: boolean }

// Defensive runaway guard: repeat_count is set to 0 (play once), so a well-formed
// module signals end-of-song via a 0-frame read. Still cap total rendered length so a
// pathological file that never returns 0 can't grow the buffer without bound.
const MAX_SECONDS = 480;
const CHUNK_FRAMES = 4096;

// Worker scope: postMessage here is the DedicatedWorkerGlobalScope overload
// (message, transfer), not Window's - narrow it so the transfer list type-checks.
const post = postMessage as (message: unknown, transfer: Transferable[]) => void;

// One WASM instance per worker, created lazily on the first decode.
let modulePromise: Promise<LibopenmptModule> | null = null;
function lib(): Promise<LibopenmptModule> {
  if (!modulePromise) modulePromise = createLibopenmpt();
  return modulePromise;
}

async function decode(bytes: Uint8Array, sampleRate: number): Promise<{ left: Float32Array; right: Float32Array; sampleRate: number }> {
  const M = await lib();
  const create  = M.cwrap('openmpt_module_create_from_memory2', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);
  const readSt  = M.cwrap('openmpt_module_read_float_stereo', 'number', ['number', 'number', 'number', 'number', 'number']);
  const setRep  = M.cwrap('openmpt_module_set_repeat_count', 'number', ['number', 'number']);
  const destroy = M.cwrap('openmpt_module_destroy', null, ['number']);

  const filePtr = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, filePtr);
  // logfunc, loguser, errfunc, erruser, error, error_message, ctls - all null/none.
  // libopenmpt sniffs the format from the bytes, so the file extension is irrelevant;
  // an unrecognized file yields a null handle.
  const mod = create(filePtr, bytes.length, 0, 0, 0, 0, 0, 0, 0);
  M._free(filePtr);
  if (!mod) throw new Error('not a recognized tracker module');
  setRep(mod, 0); // play once - the player owns looping (AudioBufferSourceNode.loop)

  const lPtr = M._malloc(CHUNK_FRAMES * 4);
  const rPtr = M._malloc(CHUNK_FRAMES * 4);
  const chunks: Array<[Float32Array, Float32Array]> = [];
  let total = 0;
  try {
    for (;;) {
      const n = readSt(mod, sampleRate, CHUNK_FRAMES, lPtr, rPtr);
      if (n === 0) break; // end of song
      // Re-read the heap view each iteration. The module is built with a FIXED heap
      // (no memory growth - see the build script; a growable/resizable heap breaks
      // crypto.getRandomValues in Chrome), so it won't actually detach - but re-reading
      // is free insurance and keeps this correct if the build ever changes.
      const H = M.HEAPF32;
      chunks.push([H.slice(lPtr >> 2, (lPtr >> 2) + n), H.slice(rPtr >> 2, (rPtr >> 2) + n)]);
      total += n;
      if (total >= MAX_SECONDS * sampleRate) break;
    }
  } finally {
    M._free(lPtr); M._free(rPtr); destroy(mod);
  }
  if (!total) throw new Error('tracker module rendered empty');

  const left = new Float32Array(total);
  const right = new Float32Array(total);
  let off = 0;
  for (const [l, r] of chunks) { left.set(l, off); right.set(r, off); off += l.length; }
  return { left, right, sampleRate };
}

addEventListener('message', (e: MessageEvent<DecodeRequest>) => {
  const { id, bytes, sampleRate, probe } = e.data;
  // A probe asks one thing: does the decoder instantiate here at all? The catalog
  // hides tracker modules when it does not, rather than showing cards that cannot
  // play (the 2026-08 glyph sweep corrupted the embedded wasm and nothing noticed).
  if (probe || !bytes || !sampleRate) {
    lib().then(() => post({ id, ok: true }, []), (err: unknown) => post({ id, error: err instanceof Error ? err.message : String(err) }, []));
    return;
  }
  decode(bytes, sampleRate).then(
    (pcm) => post({ id, left: pcm.left, right: pcm.right, sampleRate: pcm.sampleRate }, [pcm.left.buffer, pcm.right.buffer]),
    (err: unknown) => post({ id, error: err instanceof Error ? err.message : String(err) }, []),
  );
});
