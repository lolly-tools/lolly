// SPDX-License-Identifier: MPL-2.0
/**
 * Facts and checks behind the report host.media.trim returns (bridge/media-trim.ts).
 *
 * Three jobs, all decode-free and DOM-free so they run under plain node with
 * mediabunny alone:
 *   - read what a container declares about its primary picture and sound tracks,
 *   - work out where a cut can start without re-encoding (a copy must begin on a key
 *     frame), and
 *   - check a written clip against its source: whether a track's packets are the
 *     source's own bytes, whether sound and picture are still in step, whether the
 *     picture is the right way up, and whether the declared colour information
 *     survived.
 * The arithmetic for the sharing copy (size cap and bitrate budget) and the contact
 * sheet (frame times and grid) lives here too, so it is tested without a canvas or an
 * encoder.
 */
import type { EncodedPacket, EncodedPacketSink, Input, InputTrack, InputVideoTrack } from 'mediabunny';
import type { MediaColorCheck, MediaOrientationCheck, MediaSyncCheck } from '@lolly-tools/core/host-v1';

type Mediabunny = typeof import('mediabunny');

export type ClipRotation = 0 | 90 | 180 | 270;

/** What a container declares about one primary track, in seconds on its own timeline. */
export interface ClipTrackFacts {
  codec: string | null;
  /** First presentation time. Lead-in a player skips reads as negative. */
  start: number;
  /** End of the last packet. */
  end: number;
  /** One packet's duration: a frame for video, an audio packet for sound. */
  step: number;
}

export interface ClipVideoFacts extends ClipTrackFacts {
  /** The container's orientation value, clockwise degrees. */
  rotation: number;
  /** Size as displayed, after the orientation value is applied. */
  displayWidth: number;
  displayHeight: number;
  color: VideoColorSpaceInit | null;
}

export interface ClipFacts {
  video: ClipVideoFacts | null;
  audio: ClipTrackFacts | null;
}

/** Container timescale rounding and float noise, in seconds. Well under a frame. */
const TIME_EPSILON = 5e-4;

async function trackFacts(MB: Mediabunny, track: InputTrack): Promise<ClipTrackFacts> {
  const sink = new MB.EncodedPacketSink(track);
  const [codec, start, end, first] = await Promise.all([
    track.getCodec(), track.getFirstTimestamp(), track.computeDuration(), sink.getFirstPacket({ metadataOnly: true }),
  ]);
  let step = first?.duration ?? 0;
  if (!(step > 0)) {
    const stats = await track.computePacketStats(32);
    step = stats.averagePacketRate > 0 ? 1 / stats.averagePacketRate : 0;
  }
  return { codec: codec ?? null, start, end, step };
}

function declaredColor(color: VideoColorSpaceInit): VideoColorSpaceInit | null {
  const { primaries, transfer, matrix, fullRange } = color;
  if (!primaries && !transfer && !matrix && fullRange == null) return null;
  return { primaries: primaries ?? null, transfer: transfer ?? null, matrix: matrix ?? null, fullRange: fullRange ?? null };
}

async function videoFacts(MB: Mediabunny, track: InputVideoTrack): Promise<ClipVideoFacts> {
  const [base, rotation, displayWidth, displayHeight, color] = await Promise.all([
    trackFacts(MB, track), track.getRotation(), track.getDisplayWidth(), track.getDisplayHeight(), track.getColorSpace(),
  ]);
  return { ...base, rotation, displayWidth, displayHeight, color: declaredColor(color) };
}

/** The primary picture and sound tracks of an opened file. */
export async function readClipFacts(MB: Mediabunny, input: Input): Promise<ClipFacts> {
  const [video, audio] = await Promise.all([input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
  return {
    video: video ? await videoFacts(MB, video) : null,
    audio: audio ? await trackFacts(MB, audio) : null,
  };
}

/** Where a copied cut can begin, relative to the requested start. */
export interface KeyFrameCut {
  /** The key frame at or before the start, or null when the track has none. */
  keyTime: number | null;
  /** Seconds from that key frame to the start; 0 when the start is not after the key frame. */
  gap: number;
  /** The start falls inside the key frame's own display time, so a copy from the key
   *  frame shows the same first frame the user picked. */
  aligned: boolean;
}

/** Find the key frame a copy of `track` from `start` would have to begin on. */
export async function keyFrameCut(MB: Mediabunny, track: InputVideoTrack, start: number): Promise<KeyFrameCut> {
  const sink = new MB.EncodedPacketSink(track);
  const key = await sink.getKeyPacket(start, { verifyKeyPackets: true })
    ?? await sink.getFirstKeyPacket({ verifyKeyPackets: true });
  if (!key) return { keyTime: null, gap: 0, aligned: true };
  if (key.timestamp >= start) return { keyTime: key.timestamp, gap: 0, aligned: true };
  const gap = start - key.timestamp;
  return { keyTime: key.timestamp, gap, aligned: key.duration > 0 && gap < key.duration - 1e-6 };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function findCopy(sink: EncodedPacketSink, from: EncodedPacket | null, packet: EncodedPacket, limit: number): Promise<EncodedPacket | null> {
  let candidate = from;
  for (let i = 0; candidate && i < limit; i++) {
    if (sameBytes(candidate.data, packet.data)) return candidate;
    candidate = await sink.getNextPacket(candidate);
  }
  return null;
}

/**
 * When the written track opens with a byte-for-byte copy of the source's packets, the
 * source-minus-written time offset of the copy; null when the written packets are
 * new (a re-encode). `cutStart` is where the conversion began in source time. The
 * first two written packets must both match, so one coincidentally identical packet
 * cannot pass for a copy.
 */
export async function copiedOffset(MB: Mediabunny, source: InputTrack, written: InputTrack, cutStart: number): Promise<number | null> {
  const outSink = new MB.EncodedPacketSink(written);
  const first = await outSink.getFirstPacket();
  if (!first) return null;
  const srcSink = new MB.EncodedPacketSink(source);
  // Where the cut's shift puts the packet, then the key frame the cut began on, then
  // the packets just before the cut (an audio copy keeps one for decoder warm-up).
  const match = await findCopy(srcSink, await srcSink.getPacket(first.timestamp + cutStart + TIME_EPSILON), first, 1)
    ?? await findCopy(srcSink, await srcSink.getKeyPacket(cutStart + TIME_EPSILON), first, 8)
    ?? await findCopy(srcSink, await srcSink.getPacket(cutStart - 0.1) ?? await srcSink.getFirstPacket(), first, 16);
  if (!match) return null;
  const [nextOut, nextSrc] = await Promise.all([outSink.getNextPacket(first), srcSink.getNextPacket(match)]);
  if (nextOut && (!nextSrc || !sameBytes(nextOut.data, nextSrc.data))) return null;
  return match.timestamp - first.timestamp;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Compare sound against picture in the written clip with the same tracks in the
 * source, over the cut range [cutStart, cutEnd). Undefined unless both have both
 * tracks. When both tracks were copied, `offsets` holds each copy's shift from
 * copiedOffset and the start check is exact: equal shifts mean the source's own sync.
 */
export function checkSync(
  source: ClipFacts, written: ClipFacts, cutStart: number, cutEnd: number,
  offsets?: { video: number | null; audio: number | null },
): MediaSyncCheck | undefined {
  const sv = source.video, sa = source.audio, wv = written.video, wa = written.audio;
  if (!sv || !sa || !wv || !wa) return undefined;
  const tolerance = Math.max(sv.step, sa.step, wv.step, wa.step) + 0.001;
  const span = cutEnd - cutStart;
  const expectedStartSkew = clamp(sa.start - cutStart, 0, span) - clamp(sv.start - cutStart, 0, span);
  const expectedEndSkew = clamp(sa.end - cutStart, 0, span) - clamp(sv.end - cutStart, 0, span);
  // Lead-in a player skips (negative times) counts as starting at zero.
  const startSkew = Math.max(0, wa.start) - Math.max(0, wv.start);
  const endSkew = wa.end - wv.end;
  const endOk = Math.abs(endSkew - expectedEndSkew) <= tolerance;
  if (offsets && offsets.video !== null && offsets.audio !== null) {
    const ok = Math.abs(offsets.audio - offsets.video) <= 0.002 && endOk;
    return { startSkew, expectedStartSkew, endSkew, expectedEndSkew, tolerance, method: 'packets', ok };
  }
  const ok = Math.abs(startSkew - expectedStartSkew) <= tolerance && endOk;
  return { startSkew, expectedStartSkew, endSkew, expectedEndSkew, tolerance, method: 'ranges', ok };
}

function turn(degrees: number): ClipRotation {
  const r = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
  return r as ClipRotation;
}

/** Read a requested turn as one of the four right angles; anything else is 0. */
export function normaliseRotation(value: unknown): ClipRotation {
  const n = Number(value);
  return n === 90 || n === 180 || n === 270 ? n : 0;
}

/**
 * Check which way up the written picture is. The expected size is the source's
 * displayed size turned by `requested`, or `resized` when a sharing size applied.
 * Encoders round odd sizes, so two pixels either way still pass.
 */
export function checkOrientation(
  source: ClipVideoFacts, written: ClipVideoFacts, requested: ClipRotation,
  resized: { width: number; height: number } | null,
): MediaOrientationCheck {
  const turned = requested % 180 !== 0;
  const expectedWidth = resized?.width ?? (turned ? source.displayHeight : source.displayWidth);
  const expectedHeight = resized?.height ?? (turned ? source.displayWidth : source.displayHeight);
  const method = requested === 0 ? 'none'
    : turn(written.rotation) === turn(source.rotation + requested) ? 'flag' : 'pixels';
  const ok = Math.abs(written.displayWidth - expectedWidth) <= 2 && Math.abs(written.displayHeight - expectedHeight) <= 2;
  return {
    requested, sourceRotation: source.rotation, outputRotation: written.rotation, method,
    width: written.displayWidth, height: written.displayHeight, expectedWidth, expectedHeight, ok,
  };
}

/** A short label for declared colour information, such as `bt709` or `bt2020 pq`. */
export function colorLabel(color: VideoColorSpaceInit | null): string | null {
  if (!color) return null;
  const parts: string[] = [];
  for (const part of [color.primaries, color.transfer, color.matrix]) {
    if (part && !parts.includes(part)) parts.push(part);
  }
  if (color.fullRange) parts.push('full range');
  return parts.length ? parts.join(' ') : null;
}

/** Compare the declared colour information before and after. */
export function checkColor(source: VideoColorSpaceInit | null, written: VideoColorSpaceInit | null): MediaColorCheck {
  const before = colorLabel(source), after = colorLabel(written);
  return { source: before, output: after, kept: before === after };
}

function even(n: number): number {
  return Math.ceil(n / 2) * 2;
}

/**
 * The displayed size of a sharing copy whose shorter edge is at most `maxShortEdge`,
 * or null when the source is already that small (a copy never enlarges). Rounds the
 * same way mediabunny does when only the shorter edge is given: that edge up to an even
 * number, then the other edge from the aspect ratio, also even.
 */
export function shareDimensions(width: number, height: number, maxShortEdge: number): { width: number; height: number } | null {
  if (!(maxShortEdge > 0) || !(width > 0) || !(height > 0) || Math.min(width, height) <= maxShortEdge) return null;
  const short = even(maxShortEdge);
  return height <= width
    ? { width: even(Math.round(short * width / height)), height: short }
    : { width: short, height: even(Math.round(short * height / width)) };
}

/** Container overhead and rate-control drift held back from a size budget. */
const TARGET_HEADROOM = 0.92;
/** Below this the picture is not worth sending; a budget that needs less is reported as
 *  unmet rather than pursued. */
export const MIN_VIDEO_BPS = 100_000;

/** The video bitrate that fits `targetBytes` over `seconds`, after the sound's share. */
export function bitrateForTarget(targetBytes: number, seconds: number, audioBps: number): { videoBps: number; feasible: boolean } {
  const total = seconds > 0 ? (targetBytes * 8 * TARGET_HEADROOM) / seconds : 0;
  const videoBps = Math.floor(total - audioBps);
  return videoBps >= MIN_VIDEO_BPS ? { videoBps, feasible: true } : { videoBps: MIN_VIDEO_BPS, feasible: false };
}

/** The bitrate for one more attempt after a file came out at `writtenBytes`. */
export function retryBitrate(previousBps: number, writtenBytes: number, targetBytes: number): number {
  return Math.max(MIN_VIDEO_BPS, Math.floor(previousBps * (targetBytes / writtenBytes) * 0.95));
}

/** Contact sheet frame count bounds and default. */
export const SHEET_FRAMES = { min: 4, max: 36, fallback: 12 } as const;

/** `n` frame times spread evenly over [start, end), each in the middle of its slice. */
export function sheetTimes(start: number, end: number, n: number): number[] {
  const count = Math.round(clamp(Number.isFinite(n) ? n : SHEET_FRAMES.fallback, SHEET_FRAMES.min, SHEET_FRAMES.max));
  const slice = (end - start) / count;
  return Array.from({ length: count }, (_, i) => Math.min(end - 1e-6, start + (i + 0.5) * slice));
}

export interface SheetLayout {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  padding: number;
  width: number;
  height: number;
}

/**
 * A grid for `count` frames of `frameWidth` by `frameHeight`. Tiles keep the frame's
 * aspect with the longer edge at `tileEdge`; the column count leans the sheet towards a
 * landscape page, so wide frames get fewer columns and tall frames more.
 */
export function sheetLayout(count: number, frameWidth: number, frameHeight: number, tileEdge = 480): SheetLayout {
  const scale = tileEdge / Math.max(frameWidth, frameHeight, 1);
  const tileWidth = Math.max(1, Math.round(frameWidth * scale));
  const tileHeight = Math.max(1, Math.round(frameHeight * scale));
  const cols = Math.round(clamp(Math.sqrt(count * 1.5 * tileHeight / tileWidth), 1, count));
  const rows = Math.ceil(count / cols);
  const gap = 8, padding = 16;
  return {
    cols, rows, tileWidth, tileHeight, gap, padding,
    width: padding * 2 + cols * tileWidth + (cols - 1) * gap,
    height: padding * 2 + rows * tileHeight + (rows - 1) * gap,
  };
}

/** A frame time as minutes, seconds and tenths (`1:02.5`), with hours past an hour. */
export function clockLabel(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10));
  const h = Math.floor(tenths / 36000), m = Math.floor((tenths % 36000) / 600), s = (tenths % 600) / 10;
  const sec = s.toFixed(1).padStart(4, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
