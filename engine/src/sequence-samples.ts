// SPDX-License-Identifier: MPL-2.0
/** Bounded authored-time sampling shared by still preview surfaces. */
import { CUTS_FORMATS } from './preflight.ts';

export const MAX_SEQUENCE_SAMPLES = 64;

/** Authored timeline seconds, kept in the caller's chronological order. */
export function validateSampleTimes(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SEQUENCE_SAMPLES) {
    throw new RangeError('sampleTimes must contain 1 to 64 timeline times in seconds.');
  }
  const times: number[] = [];
  for (const time of value) {
    if (typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > 3600
      || (times.length > 0 && time <= times[times.length - 1]!)) {
      throw new RangeError('sampleTimes must be strictly increasing finite seconds from 0 to 3600.');
    }
    times.push(time);
  }
  return times;
}

export function parseSampleTimes(raw: string | null): number[] | undefined {
  if (raw === null) return undefined;
  if (raw.length > 2048 || raw.split(',').some(part => !part.trim())) {
    throw new RangeError('samples must be a comma-separated list of timeline seconds.');
  }
  return validateSampleTimes(raw.split(',').map(Number));
}

/** Validate before choosing a render tier, so no surface silently returns one still. */
export function assertSampleRequest(format: string, cuts = 1, sampleTimes?: readonly number[]): boolean {
  if (sampleTimes !== undefined) validateSampleTimes(sampleTimes);
  const requested = cuts > 1 || sampleTimes !== undefined;
  if (!requested) return false;
  if (cuts > 1 && sampleTimes !== undefined) throw new RangeError('Choose cuts or sampleTimes, not both.');
  if (!CUTS_FORMATS.has(format)) throw new RangeError(`Timeline samples are unavailable for ${format}; use png, jpg, webp, svg or pdf.`);
  return true;
}

export function sampleOutputFormat(format: string, cuts = 1, sampleTimes?: readonly number[]): string {
  return (sampleTimes?.length ?? cuts) > 1 && format !== 'pdf' ? 'zip' : format;
}

/** Midpoint sheets retain their existing rule; explicit samples never clamp or seek the end. */
export function sequenceSampleTimes(totalMs: number, cuts: number, sampleTimes?: readonly number[]): number[] {
  if (!Number.isFinite(totalMs) || totalMs <= 0) throw new RangeError('Timeline samples need a timed composition.');
  if (sampleTimes !== undefined) {
    const times = validateSampleTimes(sampleTimes).map(seconds => seconds * 1000);
    if (times.some(time => time >= totalMs)) throw new RangeError(`Every sample must be before the timeline end (${totalMs / 1000}s).`);
    return times;
  }
  if (!Number.isInteger(cuts) || cuts < 1 || cuts > MAX_SEQUENCE_SAMPLES) throw new RangeError('cuts must be an integer from 1 to 64.');
  return Array.from({ length: cuts }, (_, i) => totalMs * (i + 0.5) / cuts);
}

/** Include both sides of supplied boundaries, reading holds and the first/last output frames. */
export function motionReviewTimes(seconds: number, fps: number, boundaries: readonly number[], holds: readonly number[] = []): number[] {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600
    || !Number.isInteger(fps) || fps < 1 || fps > 120
    || [...boundaries, ...holds].some(time => !Number.isFinite(time) || time < 0 || time >= seconds)) {
    throw new RangeError('Review times need a positive duration, an integer fps from 1 to 120 and in-range cues.');
  }
  const times = [0, (Math.ceil(seconds * fps) - 1) / fps, ...holds];
  for (const time of boundaries) times.push(time - 1 / fps, time, time + 1 / fps);
  return validateSampleTimes([...new Set(times.filter(time => time >= 0 && time < seconds))].sort((a, b) => a - b));
}
