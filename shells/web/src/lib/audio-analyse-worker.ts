// SPDX-License-Identifier: MPL-2.0
/**
 * Audio analysis worker. One short-time Fourier transform per output frame is real
 * work - a 3-minute track at 30fps is 5,400 windows of 2,048 samples - and it would
 * otherwise land on the main thread while a tool is being typed into. The engine's
 * `analysePcm` is DOM-free, so it runs here unchanged.
 *
 * DECODING stays on the main thread: `decodeAudioData` needs a BaseAudioContext,
 * which worker scope does not expose. That split is the right one anyway - decoding
 * is native and fast, the transform is the expensive part - and the channel buffers
 * transfer in rather than being copied.
 */
import { analysePcm } from '../../../../engine/src/audio-analyse.ts';
import type { AudioAnalyseOpts, AudioAnalysis } from '../../../../engine/src/audio-analyse.ts';

interface AnalyseRequest {
  id: number;
  channels: Float32Array[];
  sampleRate: number;
  opts: AudioAnalyseOpts;
}

// Worker scope: `postMessage` here is the DedicatedWorkerGlobalScope overload
// (message, transfer), not Window's (message, targetOrigin, transfer).
const post = postMessage as (message: unknown, transfer: Transferable[]) => void;

/** Every typed array in the result, so the reply transfers rather than structured-clones
 *  what can be tens of megabytes of sample windows. */
function buffers(a: AudioAnalysis): Transferable[] {
  const f = a.frames;
  return [
    a.peaks.buffer, a.beats.buffer,
    f.t.buffer, f.rms.buffer, f.peak.buffer, f.bass.buffer, f.mid.buffer, f.treb.buffer,
    f.centroid.buffer, f.flux.buffer, f.magnitude.buffer,
    // These three are always distinct allocations - a mono source gets three arrays
    // holding the same VALUES, not three views on one buffer - so listing all three
    // can never present the same buffer twice (which `postMessage` rejects).
    f.wave.buffer, f.waveL.buffer, f.waveR.buffer,
  ] as Transferable[];
}

addEventListener('message', (e: MessageEvent<AnalyseRequest>) => {
  const { id, channels, sampleRate, opts } = e.data;
  try {
    const result = analysePcm(channels, sampleRate, opts);
    post({ id, result }, buffers(result));
  } catch (err) {
    post({ id, error: err instanceof Error ? err.message : String(err) }, []);
  }
});
