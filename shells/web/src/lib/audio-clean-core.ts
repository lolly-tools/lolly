// SPDX-License-Identifier: MPL-2.0
/**
 * The headless voice-cleanup primitive (plans/101's flagged P6, plans/165's
 * deferred tier): PCM in, PCM out, through the vendored GTCRN speech-enhancement
 * WASM. ONE driver serves the export mix, the preview bounce AND node:test -
 * the same single-driver law as the stretcher (lib/audio-stretch-core.ts), so
 * there is no second denoiser to drift.
 *
 * Contract:
 *   - 48 kHz only - the mix rate, and the engine's own native 48 kHz path
 *     (`_gtcrn_process_48k`, 768-sample frames), so nothing resamples.
 *   - The output length equals the input length exactly: the tail frame is
 *     zero-padded in and trimmed off.
 *   - Deterministic: a fresh model instance per call; the same bytes yield the
 *     same bytes.
 *   - Executed by the SHELL for the fx grammar's `clean()` entry - the engine's
 *     processFxPcm deliberately skips that token (the model cannot live in the
 *     zero-dep engine), and the two callers splice this around it.
 */
import { gtcrnFactory, gtcrnWasmBinary, GtcrnProcessor } from '../vendor/gtcrn/gtcrn-core.mjs';

/** Enhance speech in place-shaped copies: one enhanced Float32Array per channel. */
export async function cleanPcm(channels: readonly Float32Array[], rate = 48_000): Promise<Float32Array[]> {
  if (rate !== 48_000) throw new Error(`GTCRN cleanup runs at 48000 Hz; got ${rate}`);
  const n = channels[0]?.length ?? 0;
  if (!n) return channels.map((c) => Float32Array.from(c));
  const mod = await gtcrnFactory({ wasmBinary: gtcrnWasmBinary() });
  const out: Float32Array[] = [];
  for (const ch of channels) {
    const proc = new GtcrnProcessor(mod, { sampleRate: 48_000 });
    try {
      const frame = new Float32Array(proc.frameSize);
      const dst = new Float32Array(n);
      for (let off = 0; off < n; off += proc.frameSize) {
        const len = Math.min(proc.frameSize, n - off);
        frame.fill(0);
        frame.set(ch.subarray(off, off + len));
        dst.set(proc.process(frame).subarray(0, len), off);
      }
      out.push(dst);
    } finally {
      proc.destroy();
    }
  }
  return out;
}
