// SPDX-License-Identifier: MPL-2.0
/**
 * host.audio.loudness and host.audio.align for the web shell. Decoding stays on the main
 * thread (decodeAudioData needs a BaseAudioContext); the metering and the correlation run
 * in the audio DSP worker. Loaded on demand by bridge/audio.ts.
 */
import type { AudioSource, AudioLoudness, AudioLoudnessOpts, AudioAlignOpts, AudioAlignment } from '@lolly-tools/core/host-v1';
import { resamplePcm } from '../../../../engine/src/audio-clean.ts';
import { measureLoudness, alignAudio } from './audio-dsp.ts';

type Decoder = (src: AudioSource) => Promise<{ channels: Float32Array[]; sampleRate: number }>;

/** Each clip is read up to this long. The aligner's own limit is a few minutes at 48 kHz. */
const ALIGN_SECONDS = 240;

export async function runLoudness(src: AudioSource, opts: AudioLoudnessOpts, toPcm: Decoder): Promise<AudioLoudness> {
  const { channels, sampleRate } = await toPcm(src);
  const stereo = channels.slice(0, 2);
  const m = await measureLoudness(stereo, sampleRate, Boolean(opts.series));
  return { ...m.report, sampleRate, seconds: (stereo[0]?.length ?? 0) / sampleRate, ...(m.series ? { series: m.series } : {}) };
}

export async function runAlign(a: AudioSource, b: AudioSource, opts: AudioAlignOpts, toPcm: Decoder): Promise<AudioAlignment | null> {
  const da = await toPcm(a);
  const db = await toPcm(b);
  const rate = da.sampleRate;
  const take = (pcm: { channels: Float32Array[]; sampleRate: number }): { channels: Float32Array[]; cut: boolean } => {
    const channels = pcm.sampleRate === rate ? pcm.channels : resamplePcm(pcm.channels, pcm.sampleRate, rate);
    const limit = Math.round(ALIGN_SECONDS * rate);
    const cut = (channels[0]?.length ?? 0) > limit;
    return { channels: channels.map(c => c.subarray(0, limit)), cut };
  };
  const ta = take(da), tb = take(db);
  const r = await alignAudio(ta.channels, tb.channels, rate, opts.maxLagSeconds);
  if (!r) return null;
  return {
    offsetSeconds: r.offsetSeconds, offsetSamples: r.lag, sampleRate: rate, confidence: r.confidence, distinct: r.distinct,
    inverted: r.inverted, reliable: r.reliable, truncated: r.truncated || ta.cut || tb.cut,
  };
}
