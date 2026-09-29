// SPDX-License-Identifier: MPL-2.0
/** Deterministic shutter timing and linear-light accumulation, independent of a shell. */
export interface MotionBlur { samples: 1 | 4 | 8 | 16; shutterAngle: number }
export interface MotionRange { from: number; to: number }

export function validateMotionBlur(value: unknown): MotionBlur {
  const v = value as Partial<MotionBlur> | null;
  if (!v || ![1, 4, 8, 16].includes(Number(v.samples)) || typeof v.samples !== 'number'
    || typeof v.shutterAngle !== 'number' || !Number.isFinite(v.shutterAngle) || v.shutterAngle < 0 || v.shutterAngle > 360) {
    throw new RangeError('motionBlur requires samples 1, 4, 8 or 16 and shutterAngle from 0 to 360.');
  }
  return { samples: v.samples, shutterAngle: v.shutterAngle } as MotionBlur;
}
export function validateMotionRange(value: unknown): MotionRange {
  const v = value as Partial<MotionRange> | null;
  if (!v || typeof v.from !== 'number' || typeof v.to !== 'number' || !Number.isFinite(v.from)
    || !Number.isFinite(v.to) || v.from < 0 || v.to <= v.from || v.to > 3600) {
    throw new RangeError('sequenceRange requires finite seconds with 0 <= from < to <= 3600.');
  }
  return { from: v.from, to: v.to };
}
export function parseMotionParams(params: URLSearchParams): { motionBlur?: MotionBlur; sequenceRange?: MotionRange } {
  const result: { motionBlur?: MotionBlur; sequenceRange?: MotionRange } = {};
  for (const key of ['motionblur', 'seqrange']) {
    if (!params.has(key)) continue;
    const parts = params.get(key)!.split(',');
    if (parts.length !== 2 || parts.some(part => !part.trim())) throw new RangeError(`${key} requires two comma-separated numbers.`);
    const [a, b] = parts.map(Number);
    if (key === 'motionblur') result.motionBlur = validateMotionBlur({ samples: a, shutterAngle: b });
    else result.sequenceRange = validateMotionRange({ from: a, to: b });
  }
  return result;
}
export function serializeMotionParams(params: URLSearchParams, opts: { motionBlur?: MotionBlur; sequenceRange?: MotionRange }): void {
  if (opts.motionBlur !== undefined) { const v = validateMotionBlur(opts.motionBlur); params.set('motionblur', `${v.samples},${v.shutterAngle}`); }
  if (opts.sequenceRange !== undefined) { const v = validateMotionRange(opts.sequenceRange); params.set('seqrange', `${v.from},${v.to}`); }
}
export function blurEnabled(blur?: MotionBlur): boolean { return !!blur && blur.samples > 1 && blur.shutterAngle > 0; }
export function assertMotionRequest(format: string, opts: { motionBlur?: MotionBlur; sequenceRange?: MotionRange; sampleTimes?: readonly number[] }): void {
  if (opts.motionBlur) validateMotionBlur(opts.motionBlur);
  if (opts.sequenceRange) validateMotionRange(opts.sequenceRange);
  const movie = ['mp4', 'webm', 'gif', 'apng', 'webp-anim'].includes(format);
  if (opts.sequenceRange && (!movie || opts.sampleTimes)) throw new Error('sequenceRange requires a movie export without explicit still samples.');
  if (blurEnabled(opts.motionBlur) && !movie && (!opts.sampleTimes || !['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(format))) throw new Error('Temporal motion blur requires a Sequence movie or explicit raster samples.');
}

/** Clip the centred exposure to the range and the shot containing the output timestamp. */
export function shutterTimes(t: number, fps: number, from: number, to: number, cuts: readonly number[], blur?: MotionBlur): number[] {
  if (!blurEnabled(blur)) return [t];
  validateMotionBlur(blur);
  if (![t, fps, from, to].every(Number.isFinite) || fps <= 0 || to <= from || t < from || t >= to) throw new RangeError('Invalid shutter interval.');
  const exposure = 1000 / fps * blur!.shutterAngle / 360;
  let a = Math.max(from, t - exposure / 2), b = Math.min(to, t + exposure / 2);
  for (const cut of cuts) { if (cut <= t) a = Math.max(a, cut); else b = Math.min(b, cut); }
  if (b <= a) return [t];
  return Array.from({ length: blur!.samples }, (_, i) => a + (i + 0.5) * (b - a) / blur!.samples);
}

const LINEAR = Float64Array.from({ length: 256 }, (_, n) => { const s = n / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
const encoded = (n: number): number => Math.round(255 * (n <= 0.0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - 0.055));
/** One reusable RGBA accumulator, bounded independently of frame count and sample count. */
export class ShutterAccumulator {
  private sum: Float32Array;
  private count = 0;
  constructor(length: number) {
    if (!Number.isInteger(length) || length <= 0 || length % 4 || length > 64 * 1024 * 1024) throw new RangeError('Motion blur scratch exceeds 256 MiB. Reduce export dimensions.');
    this.sum = new Float32Array(length);
  }
  add(rgba: Uint8ClampedArray): void {
    if (rgba.length !== this.sum.length) throw new RangeError('Motion blur samples must have matching dimensions.');
    for (let i = 0; i < rgba.length; i += 4) {
      const a = rgba[i + 3]! / 255;
      for (let c = 0; c < 3; c++) this.sum[i + c]! += LINEAR[rgba[i + c]!]! * a;
      this.sum[i + 3]! += a;
    }
    this.count++;
  }
  finish(target: Uint8ClampedArray): void {
    if (!this.count || target.length !== this.sum.length) throw new RangeError('Motion blur has no matching samples.');
    for (let i = 0; i < target.length; i += 4) {
      const alpha = this.sum[i + 3]!;
      for (let c = 0; c < 3; c++) target[i + c] = alpha ? encoded(Math.max(0, Math.min(1, this.sum[i + c]! / alpha))) : 0;
      target[i + 3] = Math.round(alpha / this.count * 255);
    }
    this.sum.fill(0); this.count = 0;
  }
}
