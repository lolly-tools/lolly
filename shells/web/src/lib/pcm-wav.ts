// SPDX-License-Identifier: MPL-2.0
/**
 * Encode rendered stereo PCM to a 16-bit WAV Blob. The video exporter is URL-driven
 * (every muxer path does `fetch(url)` + `decodeAudioData`), so a synthesized/decoded
 * track - a ZzFXM song (zzfxm-render.ts) or a tracker module (mod-render.ts) - is
 * rendered to WAV and handed in as a blob URL: no export-bridge change, and CD-quality
 * PCM is transparent under the lossy AAC/Opus mux. Shared by both render paths.
 */
import type { RenderedPcm } from '../../../../engine/src/zzfxm.ts';

export function pcmToWavBlob({ left, right, sampleRate }: RenderedPcm): Blob {
  const frames = left.length;
  const blockAlign = 4; // 2 channels × 16-bit
  const dataLen = frames * blockAlign;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  dv.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true); // fmt chunk size
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 2, true); // channels
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * blockAlign, true); // byte rate
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  dv.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    dv.setInt16(o, toInt16(left[i] ?? 0), true);
    dv.setInt16(o + 2, toInt16(right[i] ?? 0), true);
    o += 4;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * One float sample to 16-bit: scale by 2^15, round to nearest, clamp.
 *
 * Both halves matter. The power-of-two scale makes the conversion exactly
 * reversible (a decoder reads back over 32768), which is what lets
 * lib/tts-splice.ts rewrite a speech clip sentence by sentence and leave every
 * untouched sample bit-identical no matter how many times it is edited. And
 * rounding rather than truncating keeps the quantizer unbiased: truncation
 * pulls every sample toward zero, so a re-encode of already-decoded audio
 * quietly shrank it a little each pass.
 */
function toInt16(x: number): number {
  return Math.max(-0x8000, Math.min(0x7fff, Math.round(x * 0x8000)));
}
