// SPDX-License-Identifier: MPL-2.0
/**
 * Shared WASM transport for audio loudness, repair and clip alignment, used by the
 * browser worker and the Node shell. The module is FilmCraft's audio DSP crate behind
 * a bounded byte adapter (packages/node-shell/wasm/audio-dsp). It imports nothing, so
 * the same input gives the same numbers in every runtime.
 *
 * Long recordings are fed through the module in chunks. The module keeps the meter or
 * effect state between chunks, so memory stays bounded and the result does not depend
 * on where the chunks were cut.
 */
import type { R128Report } from '../../../engine/src/audio-loudness.ts';
import type { RepairStage } from '../../../engine/src/audio-repair.ts';

const OP_METER_OPEN = 1;
const OP_METER_PUSH = 2;
const OP_METER_READ = 3;
const OP_FX_OPEN = 4;
const OP_FX_PROCESS = 5;
const OP_FX_FLUSH = 6;
const OP_SYNC = 7;
const OP_CLOSE = 8;

const MAX_REQUEST = 160 * 1024 * 1024;
const MAX_RESULT = 160 * 1024 * 1024;
/** Longest clip the aligner takes per side (the module's own cap is 12M samples). */
export const ALIGN_MAX_SAMPLES = 12 * 1024 * 1024;
/** Frames per call when streaming a long recording: about 5 s at 48 kHz. */
const CHUNK_FRAMES = 240_000;

interface DspExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  audio_dsp_alloc(length: number): number;
  audio_dsp_free(pointer: number): void;
  audio_dsp_run(pointer: number, length: number, operation: number): number;
  audio_dsp_result_ptr(): number;
  audio_dsp_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is DspExports {
  return e.memory instanceof WebAssembly.Memory
    && ['audio_dsp_alloc', 'audio_dsp_free', 'audio_dsp_run', 'audio_dsp_result_ptr', 'audio_dsp_result_len'].every(k => typeof e[k] === 'function');
}

export interface LoudnessMeasurement {
  report: R128Report;
  /** Momentary and short-term loudness every 100 ms, when asked for. `null` entries are below the meter's floor. */
  series?: { stepSeconds: number; momentary: (number | null)[]; shortTerm: (number | null)[] };
}

export interface RepairResult {
  channels: Float32Array[];
  /** Clicks the declick stage repaired. */
  clicksRepaired: number;
}

export interface ClipAlignment {
  /** Samples: `b[n]` lines up with `a[n + lag]` (b started `lag` samples after a). */
  lag: number;
  /** The same with sub-sample precision. */
  lagFine: number;
  /** Seconds equivalent to `lagFine`. */
  offsetSeconds: number;
  /** Peak height over the correlation floor. */
  confidence: number;
  /** Peak height over the next-highest distinct peak. */
  distinct: number;
  /** True when one recording has inverted polarity. */
  inverted: boolean;
  /** Whether the match is clear enough to trust. */
  reliable: boolean;
  /** True when a clip was cut to the aligner's length limit. */
  truncated: boolean;
}

export interface AudioDspKernel {
  /**
   * Full EBU R128 reading of planar PCM at any sample rate from 8 to 192 kHz. A single channel is
   * measured as one channel, as the standard says, unless `monoAsStereo` asks for it to be heard
   * on both speakers (3 dB louder), which is how Normalize and the clean tool treat a mono file.
   */
  measureLoudness(channels: readonly Float32Array[], sampleRate: number, opts?: { series?: boolean; monoAsStereo?: boolean }): LoudnessMeasurement;
  /** Run the planned repair stages over the whole recording. Output has the input's length. */
  repair(channels: readonly Float32Array[], sampleRate: number, stages: readonly RepairStage[], opts?: { onProgress?: (fraction: number) => void }): RepairResult;
  /** Offset between two recordings of one event (GCC-PHAT), or null when they share too little. */
  alignClips(a: readonly Float32Array[], b: readonly Float32Array[], sampleRate: number, opts?: { maxLagSeconds?: number }): ClipAlignment | null;
}

interface Reply { head: Record<string, unknown>; samples: Float32Array }

function littleEndian(): boolean {
  return new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
}

export async function createAudioDspKernel(wasm: Uint8Array): Promise<AudioDspKernel> {
  if (!littleEndian()) throw new Error('The audio module needs a little-endian host.');
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The audio module ABI is incompatible.');
  const api = instance.exports;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function run(op: number, head: object, planar: readonly Float32Array[] = []): Reply {
    const json = enc.encode(JSON.stringify(head));
    const sampleBytes = planar.reduce((n, c) => n + c.byteLength, 0);
    const total = 4 + json.length + sampleBytes;
    if (total > MAX_REQUEST) throw new Error('The audio request is too large.');
    const pointer = api.audio_dsp_alloc(total);
    if (!pointer) throw new Error('The audio module refused the request allocation.');
    let status: number;
    try {
      const bytes = new Uint8Array(api.memory.buffer, pointer, total);
      new DataView(api.memory.buffer, pointer, 4).setUint32(0, json.length, true);
      bytes.set(json, 4);
      let at = 4 + json.length;
      for (const c of planar) { bytes.set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength), at); at += c.byteLength; }
      status = api.audio_dsp_run(pointer, total, op);
    } finally { api.audio_dsp_free(pointer); }
    const length = api.audio_dsp_result_len(), from = api.audio_dsp_result_ptr();
    if (length > MAX_RESULT || from + length > api.memory.buffer.byteLength) throw new Error('The audio module returned an oversized response.');
    const out = new Uint8Array(api.memory.buffer, from, length).slice();
    if (status !== 0) throw new Error(dec.decode(out));
    if (out.length < 4) throw new Error('The audio module returned a malformed response.');
    const headLen = new DataView(out.buffer).getUint32(0, true);
    if (4 + headLen > out.length || (out.length - 4 - headLen) % 4 !== 0) throw new Error('The audio module returned a malformed response.');
    const samples = new Float32Array(out.buffer.slice(4 + headLen));
    return { head: JSON.parse(dec.decode(out.subarray(4, 4 + headLen))) as Record<string, unknown>, samples };
  }

  function close(handle: number): void {
    try { run(OP_CLOSE, { handle }); } catch { /* A session that is already gone needs no cleanup. */ }
  }

  function checked(channels: readonly Float32Array[], what: string): number {
    if (!channels.length) throw new Error(`${what}: no audio channels`);
    const frames = channels[0]!.length;
    if (channels.some(c => c.length !== frames)) throw new Error(`${what}: channels differ in length`);
    return frames;
  }

  function slice(channels: readonly Float32Array[], from: number, to: number): Float32Array[] {
    return channels.map(c => c.subarray(from, to));
  }

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  return {
    measureLoudness(input, sampleRate, opts = {}) {
      const channels = opts.monoAsStereo && input.length === 1 ? [input[0]!, input[0]!] : input;
      const frames = checked(channels, 'loudness');
      const handle = Number(run(OP_METER_OPEN, { sampleRate, channels: channels.length, series: Boolean(opts.series) }).head.handle);
      try {
        const momentary: (number | null)[] = [], shortTerm: (number | null)[] = [];
        for (let from = 0; from < frames; from += CHUNK_FRAMES) {
          const r = run(OP_METER_PUSH, { handle }, slice(channels, from, Math.min(frames, from + CHUNK_FRAMES)));
          if (opts.series) {
            for (let i = 0; i + 1 < r.samples.length; i += 2) {
              momentary.push(Number.isFinite(r.samples[i]!) ? r.samples[i]! : null);
              shortTerm.push(Number.isFinite(r.samples[i + 1]!) ? r.samples[i + 1]! : null);
            }
          }
        }
        const h = run(OP_METER_READ, { handle }).head;
        const report: R128Report = {
          integrated: num(h.integrated), momentary: num(h.momentary), shortTerm: num(h.shortTerm),
          maxMomentary: num(h.maxMomentary), maxShortTerm: num(h.maxShortTerm), loudnessRange: num(h.loudnessRange),
          samplePeakDb: num(h.samplePeakDb), truePeakDb: num(h.truePeakDb),
        };
        return opts.series ? { report, series: { stepSeconds: 0.1, momentary, shortTerm } } : { report };
      } finally { close(handle); }
    },

    repair(channels, sampleRate, stages, opts = {}) {
      const frames = checked(channels, 'repair');
      if (!stages.length) return { channels: channels.map(c => Float32Array.from(c)), clicksRepaired: 0 };
      const open = run(OP_FX_OPEN, { sampleRate, channels: channels.length, chain: stages.map(s => ({ id: s.id, params: s.params })) });
      const handle = Number(open.head.handle);
      try {
        const out = channels.map(() => new Float32Array(frames));
        let written = 0, clicks = 0;
        const take = (r: Reply): void => {
          const n = Number(r.head.frames);
          clicks = Number(r.head.clicksRepaired) || clicks;
          for (let c = 0; c < out.length; c++) out[c]!.set(r.samples.subarray(c * n, (c + 1) * n), written);
          written += n;
        };
        for (let from = 0; from < frames; from += CHUNK_FRAMES) {
          take(run(OP_FX_PROCESS, { handle }, slice(channels, from, Math.min(frames, from + CHUNK_FRAMES))));
          opts.onProgress?.(Math.min(1, (from + CHUNK_FRAMES) / frames));
        }
        take(run(OP_FX_FLUSH, { handle }));
        if (written !== frames) throw new Error('The audio module returned the wrong number of samples.');
        return { channels: out, clicksRepaired: clicks };
      } finally { close(handle); }
    },

    alignClips(a, b, sampleRate, opts = {}) {
      const mono = (channels: readonly Float32Array[]): Float32Array => {
        const frames = checked(channels, 'align');
        const out = new Float32Array(Math.min(frames, ALIGN_MAX_SAMPLES));
        for (let i = 0; i < out.length; i++) {
          let sum = 0;
          for (const c of channels) sum += c[i]!;
          out[i] = sum / channels.length;
        }
        return out;
      };
      const truncated = (a[0]?.length ?? 0) > ALIGN_MAX_SAMPLES || (b[0]?.length ?? 0) > ALIGN_MAX_SAMPLES;
      const ma = mono(a), mb = mono(b);
      const head: { sampleRate: number; framesA: number; maxLag?: number } = { sampleRate, framesA: ma.length };
      if (opts.maxLagSeconds !== undefined && Number.isFinite(opts.maxLagSeconds)) head.maxLag = Math.round(Math.abs(opts.maxLagSeconds) * sampleRate);
      const r = run(OP_SYNC, head, [ma, mb]).head as unknown;
      if (r === null || typeof r !== 'object') return null;
      const h = r as Record<string, unknown>;
      return {
        lag: Number(h.lag), lagFine: Number(h.lagFine), offsetSeconds: Number(h.lagFine) / sampleRate,
        confidence: Number(h.confidence), distinct: Number(h.distinct),
        inverted: Boolean(h.inverted), reliable: Boolean(h.reliable), truncated,
      };
    },
  };
}
