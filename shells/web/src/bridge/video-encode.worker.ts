// SPDX-License-Identifier: MPL-2.0
/**
 * Video-encode Worker. Runs the DOM-free WebCodecs encode + mux (video-encode-core.ts)
 * off the main thread so a long export doesn't monopolise it. The main thread transfers
 * the pre-rendered frames (ImageBitmaps) + a copy of the audio bed's planar PCM here; the
 * worker encodes and transfers the muxed bytes back. Frame GENERATION stays main-thread
 * (dom-to-image needs the DOM) - this only offloads the encode/mux.
 */
import { encodeMuxWebCodecs, type EncodePick, type EncodeAudio } from './video-encode-core.ts';

interface EncodeRequest {
  id: number;
  frames: ImageBitmap[];
  pick: EncodePick;
  o: { width: number; height: number; fps: number; bitrate: number; audio?: EncodeAudio | null; subtitlesVtt?: string };
}

// Worker-scope postMessage overload (message, transfer) - narrow it past the DOM lib's
// Window overload, as zzfxm-worker.ts does.
const post = postMessage as (message: unknown, transfer: Transferable[]) => void;

addEventListener('message', async (e: MessageEvent<EncodeRequest>) => {
  const { id, frames, pick, o } = e.data;
  try {
    const { buffer, type } = await encodeMuxWebCodecs(frames, pick, o);
    post({ id, buffer, type }, [buffer]);
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) }, []);
  } finally {
    // The transferred bitmaps are the worker's to release (the main thread neutered them).
    for (const f of frames) { try { f.close(); } catch { /* already closed */ } }
  }
});
