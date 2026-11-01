// SPDX-License-Identifier: MPL-2.0
/**
 * Shared pieces of the EDL, OpenTimelineIO and FCPXML readers: bounded frame rates,
 * drop-frame timecode, and the loss report. Written from the public formats
 * (CMX 3600, SMPTE 12M, the OpenTimelineIO and FCPXML references).
 */
import type { InterchangeClip, InterchangeRate, InterchangeSequence } from './premiere-xml.ts';

export const TIMELINE_MAX_CLIPS = 10000;
export const TIMELINE_MAX_TRACKS = 128;
export const TIMELINE_MAX_BYTES = 8 * 1024 * 1024;
export const TIMELINE_MAX_PATH = 8192;
export const TIMELINE_MAX_NAME = 512;

export function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a; }

/** Build a reduced rate from a ratio, refusing anything outside 1 to 240 frames per second. */
export function rateFromRatio(numerator: number, denominator: number): InterchangeRate {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator <= 0 || denominator <= 0) throw new Error('Invalid frame rate.');
  const g = gcd(numerator, denominator), rate = { numerator: numerator / g, denominator: denominator / g }, fps = rate.numerator / rate.denominator;
  if (fps < 1 || fps > 240) throw new Error(`Unsupported frame rate ${fps.toFixed(3)} fps.`);
  return rate;
}
const NTSC_NOMINAL = [24, 30, 48, 60, 120];
/** Snap a frames-per-second number to an exact rate: whole rates stay whole and the NTSC family becomes n*1000/1001. */
export function rateFromFps(fps: number): InterchangeRate {
  if (!Number.isFinite(fps) || fps < 1 || fps > 240) throw new Error('Invalid frame rate.');
  const whole = Math.round(fps);
  if (Math.abs(fps - whole) < 1e-6) return { numerator: whole, denominator: 1 };
  for (const nominal of NTSC_NOMINAL) if (Math.abs(fps - nominal * 1000 / 1001) < 0.005) return { numerator: nominal * 1000, denominator: 1001 };
  throw new Error(`Unsupported frame rate ${fps} fps.`);
}
export const sameRate = (a: InterchangeRate, b: InterchangeRate): boolean => a.numerator * b.denominator === b.numerator * a.denominator;
export const rateLabel = (rate: InterchangeRate): string => `${+(rate.numerator / rate.denominator).toFixed(3)} fps`;
export const rateFps = (rate: InterchangeRate): number => rate.numerator / rate.denominator;

function dropCount(rate: InterchangeRate): number {
  const nominal = Math.round(rateFps(rate));
  if (rate.denominator !== 1001 || ![30, 60, 120].includes(nominal)) throw new Error('Drop-frame timecode needs 29.97, 59.94 or 119.88 fps.');
  return nominal / 30 * 2;
}
/** Frames counted by timecode, honouring drop-frame numbering. The field count is the nominal rate. */
export function timecodeToFrames(timecode: string, rate: InterchangeRate, drop: boolean): number {
  const m = /^(\d{1,3}):(\d{2}):(\d{2})[:;.,](\d{2,3})$/.exec(timecode.trim());
  if (!m) throw new Error(`Invalid timecode ${timecode.slice(0, 32)}.`);
  const nominal = Math.round(rateFps(rate)), h = +m[1]!, min = +m[2]!, sec = +m[3]!, f = +m[4]!;
  if (min > 59 || sec > 59 || f >= nominal) throw new Error(`Timecode ${timecode} does not fit ${rateLabel(rate)}.`);
  const dropped = drop ? dropCount(rate) : 0;
  if (dropped && sec === 0 && min % 10 !== 0 && f < dropped) throw new Error(`Timecode ${timecode} is a dropped frame number.`);
  const totalMinutes = h * 60 + min;
  return (totalMinutes * 60 + sec) * nominal + f - dropped * (totalMinutes - Math.floor(totalMinutes / 10));
}
export function framesToTimecode(frames: number, rate: InterchangeRate, drop: boolean): string {
  if (!Number.isSafeInteger(frames) || frames < 0) throw new Error('Invalid frame count.');
  const nominal = Math.round(rateFps(rate)), dropped = drop ? dropCount(rate) : 0;
  let n = frames;
  if (dropped) {
    const perMinute = nominal * 60 - dropped, per10 = nominal * 600 - dropped * 9, tens = Math.floor(n / per10), rest = n % per10;
    n += dropped * 9 * tens + (rest > dropped ? dropped * Math.floor((rest - dropped) / perMinute) : 0);
  }
  const pad = (v: number) => String(v).padStart(2, '0');
  const f = n % nominal, s = Math.floor(n / nominal) % 60, m = Math.floor(n / (nominal * 60)) % 60, h = Math.floor(n / (nominal * 3600));
  return `${pad(h)}:${pad(m)}:${pad(s)}${drop ? ';' : ':'}${pad(f)}`;
}
/** Frames in one timecode hour, the unit used to guess where a sequence or reel starts. */
export function framesPerHour(rate: InterchangeRate, drop: boolean): number { return timecodeToFrames('01:00:00:00', rate, drop); }

export function checkText(source: string, what: string, maxBytes = TIMELINE_MAX_BYTES): void {
  if (typeof source !== 'string') throw new Error(`${what} must be text.`);
  if (source.length > maxBytes || new TextEncoder().encode(source).length > maxBytes) throw new Error(`${what} exceeds ${maxBytes / 1024 / 1024} MB.`);
}
/** A media reference stays plain text: bounded, with no control characters. */
export function cleanPath(path: string): string {
  if (path.length > TIMELINE_MAX_PATH || [...path].some(c => c.charCodeAt(0) < 32)) throw new Error('Invalid interchange media path.');
  return path;
}
export function cleanName(name: string, fallback: string): string {
  const text = [...name].filter(c => c.charCodeAt(0) >= 32).join('').trim().slice(0, TIMELINE_MAX_NAME);
  return text || fallback;
}

/** Collects the import report. Repeats of one kind collapse to the first message and a count, so nothing is dropped silently. */
export class LossReport {
  private readonly items = new Map<string, { message: string; count: number }>();
  add(category: string, message: string): void {
    const item = this.items.get(category);
    if (item) item.count++; else this.items.set(category, { message, count: 1 });
  }
  get notes(): string[] { return [...this.items.values()].map(i => i.count > 1 ? `${i.message} (${i.count} occurrences in total)` : i.message); }
}

export interface SequenceParts {
  name: string; rate: InterchangeRate; width?: number; height?: number; clips: InterchangeClip[]; report: LossReport;
  timecodeStart?: number; dropFrame?: boolean; extraNotes?: string[];
}
/** Final shape and bounds shared by every reader. */
export function buildSequence(parts: SequenceParts): InterchangeSequence {
  if (!parts.clips.length) throw new Error('The timeline has no clips Lolly can place.');
  if (parts.clips.length > TIMELINE_MAX_CLIPS) throw new Error(`The timeline exceeds ${TIMELINE_MAX_CLIPS} clips.`);
  const width = parts.width ?? 1920, height = parts.height ?? 1080;
  if (width < 1 || height < 1 || width * height > 32_000_000) throw new Error('Interchange dimensions exceed the preview limit.');
  const duration = Math.max(...parts.clips.map(c => c.end));
  return {
    name: cleanName(parts.name, 'Imported timeline'), rate: parts.rate, width, height, duration, clips: parts.clips,
    notes: [...new Set([...(parts.extraNotes ?? []), ...parts.report.notes])],
    ...(parts.timecodeStart ? { timecodeStart: parts.timecodeStart } : {}), ...(parts.dropFrame ? { dropFrame: true } : {}),
  };
}
