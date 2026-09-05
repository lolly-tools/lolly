// SPDX-License-Identifier: MPL-2.0
/** Deterministic PCM finishing shared by host.audio implementations. */
import { createTruePeakLimiter } from './audio-dynamics.ts';
import { integratedLoudness, normalizeGain, LOUDNESS_RATE } from './audio-loudness.ts';
import { packWav } from './wav.ts';

export interface CleanPcmOptions {
  trimSilence?: boolean;
  normalize?: 'off' | -16 | -14 | -23;
  denoise?: 'off' | 'light' | 'strong';
  /** Enhanced PCM from the shell's local model. Required when denoise is on. */
  enhanced?: readonly Float32Array[];
  /** Absolute sample threshold for exact edge trimming. Default -60 dBFS. */
  silenceThreshold?: number;
}

export interface CleanPcmResult {
  channels: Float32Array[];
  sampleRate: number;
  durationBefore: number;
  durationAfter: number;
  secondsTrimmed: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  loudnessBefore: number | null;
  loudnessAfter: number | null;
  truePeakDb: number;
  operations: string[];
}

/** Bounded, full-quality PCM audition for large outputs and video containers. */
export function cleanAudioPreview(result: CleanPcmResult) {
  const length = Math.min(result.channels[0]?.length ?? 0, result.sampleRate * 30);
  return {
    bytes: packWav({ channels: result.channels.map(c => c.subarray(0, length)), sampleRate: result.sampleRate }, { format: 'int16' }),
    mime: 'audio/wav', duration: length / result.sampleRate, excerpt: result.durationAfter > 30,
  };
}

/** Linear resampling with deterministic endpoints. Cleanup standardises on 48 kHz. */
export function resamplePcm(
  channels: readonly Float32Array[], fromRate: number, toRate = LOUDNESS_RATE,
): Float32Array[] {
  if (fromRate === toRate) return channels.map(channel => Float32Array.from(channel));
  if (!(fromRate > 0) || !(toRate > 0)) throw new Error('audio clean: invalid sample rate');
  const inputLength = channels[0]?.length ?? 0;
  const outputLength = Math.max(0, Math.round(inputLength * toRate / fromRate));
  return channels.map(channel => {
    const out = new Float32Array(outputLength);
    if (!channel.length || !outputLength) return out;
    for (let i = 0; i < outputLength; i++) {
      const at = i * fromRate / toRate;
      const left = Math.min(channel.length - 1, Math.floor(at));
      const right = Math.min(channel.length - 1, left + 1);
      const mix = at - left;
      out[i] = channel[left]! * (1 - mix) + channel[right]! * mix;
    }
    return out;
  });
}

function trimBounds(channels: readonly Float32Array[], threshold: number): [number, number] {
  const length = channels[0]?.length ?? 0;
  let from = 0;
  while (from < length && channels.every(channel => Math.abs(channel[from] ?? 0) <= threshold)) from++;
  let to = length;
  while (to > from && channels.every(channel => Math.abs(channel[to - 1] ?? 0) <= threshold)) to--;
  return [from, to];
}

function peakDb(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

export function cleanAudioPcm(
  input: readonly Float32Array[], sampleRate: number, opts: CleanPcmOptions = {},
): CleanPcmResult {
  if (sampleRate !== LOUDNESS_RATE) {
    throw new Error(`audio clean: expected ${LOUDNESS_RATE} Hz PCM; got ${sampleRate}`);
  }
  if (!input.length || !input[0]?.length) throw new Error('audio clean: decoded audio is empty');
  const length = Math.min(...input.map(channel => channel.length));
  const original: Float32Array[] = input.slice(0, 2).map(channel => Float32Array.from(channel.subarray(0, length)));
  const durationBefore = length / sampleRate;
  const loudnessBefore = integratedLoudness(original, sampleRate);
  const operations: string[] = [];

  let channels: Float32Array[] = original;
  const denoise = opts.denoise ?? 'off';
  if (denoise !== 'off') {
    if (!opts.enhanced?.length) throw new Error('audio clean: the requested speech denoiser is unavailable in this shell');
    const amount = denoise === 'strong' ? 1 : 0.55;
    channels = channels.map((channel, c) => {
      const enhanced = opts.enhanced![c] ?? opts.enhanced![0]!;
      const out = new Float32Array(channel.length);
      for (let i = 0; i < out.length; i++) out[i] = channel[i]! * (1 - amount) + (enhanced[i] ?? 0) * amount;
      return out;
    });
    operations.push(`${denoise === 'strong' ? 'Strong' : 'Light'} voice cleanup`);
  }

  let trimmedSamples = 0;
  let trimStartSamples = 0;
  let trimEndSamples = 0;
  if (opts.trimSilence) {
    const threshold = Number.isFinite(opts.silenceThreshold) ? Math.max(0, opts.silenceThreshold!) : 0.001;
    const [from, to] = trimBounds(channels, threshold);
    if (to <= from) throw new Error('audio clean: silence trimming found no audible signal');
    trimmedSamples = channels[0]!.length - (to - from);
    trimStartSamples = from;
    trimEndSamples = channels[0]!.length - to;
    channels = channels.map(channel => Float32Array.from(channel.subarray(from, to)));
    operations.push(`Trimmed ${(trimmedSamples / sampleRate).toFixed(2)} seconds of edge silence`);
  }

  const target = opts.normalize === 'off' || opts.normalize == null ? null : Number(opts.normalize);
  if (target != null) {
    const measured = integratedLoudness(channels, sampleRate);
    if (measured != null) {
      const gain = normalizeGain(measured, target);
      channels = channels.map(channel => {
        const out = new Float32Array(channel.length);
        for (let i = 0; i < out.length; i++) out[i] = channel[i]! * gain;
        return out;
      });
      operations.push(`Normalised to ${target} LUFS`);
    }
  }

  const limiter = createTruePeakLimiter({ rate: sampleRate, ceilingDb: -1 });
  const left = channels[0]!;
  const right = channels[1] ?? left;
  const [headL, headR] = limiter.process(left, right);
  const [tailL, tailR] = limiter.flush();
  const join = (a: Float32Array, b: Float32Array): Float32Array => {
    const out = new Float32Array(a.length + b.length); out.set(a); out.set(b, a.length); return out;
  };
  const limited: Float32Array[] = [join(headL, tailL), join(headR, tailR)];
  channels = channels.length === 1 ? [limited[0]!] : limited;
  if (limiter.engaged()) operations.push('Limited true peak to -1 dBTP');

  return {
    channels, sampleRate,
    durationBefore, durationAfter: channels[0]!.length / sampleRate,
    secondsTrimmed: trimmedSamples / sampleRate,
    trimStartSeconds: trimStartSamples / sampleRate,
    trimEndSeconds: trimEndSamples / sampleRate,
    loudnessBefore, loudnessAfter: integratedLoudness(channels, sampleRate),
    truePeakDb: peakDb(channels), operations,
  };
}
