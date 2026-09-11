// SPDX-License-Identifier: MPL-2.0
/**
 * ZzFXM render worker. Rendering a song to PCM is CPU-heavy (the per-sample synth
 * loop), so it runs off the main thread - the Neurospicy player and the video
 * music-bed exporter both post a song here and get back transferable channel
 * buffers to wrap in an AudioBuffer. Pure compute; the engine renderer is
 * DOM-free, so it runs unchanged in worker scope.
 */
import { renderZzfxm, type ZzfxSong } from '../../../../engine/src/zzfxm.ts';

interface RenderRequest {
  id: number;
  song: ZzfxSong;
}

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload
// (message, transfer), not Window's (message, targetOrigin, transfer). Narrow it
// so the transfer list is accepted under the shell's DOM lib typings.
const post = postMessage as (message: unknown, transfer: Transferable[]) => void;

addEventListener('message', (e: MessageEvent<RenderRequest>) => {
  const { id, song } = e.data;
  try {
    const { left, right, sampleRate } = renderZzfxm(song);
    post({ id, left, right, sampleRate }, [left.buffer, right.buffer]);
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) }, []);
  }
});
