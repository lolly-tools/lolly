// SPDX-License-Identifier: MPL-2.0
/**
 * Local uploaded-media trim, remux and still-frame implementation for host.media.trim.
 *
 * A clip goes through one mediabunny Conversion, which copies each track's packets
 * when it can and re-encodes when it must. This module decides what the Conversion
 * cannot: where the cut starts against the key frames, the size and bitrate of a
 * sharing copy (or that a plain copy already fits), and that a track the user kept is
 * never left out without a word.
 * After writing it re-opens the output and reports what happened, measured on the
 * written bytes (lib/clip-checks.ts): which tracks are byte-identical copies, whether
 * sound and picture are still in step, which way up the picture is and whether the
 * declared colour information survived. A poster, contact sheet or GIF is drawn from
 * decoded frames on a canvas.
 */
import type {
  MediaTrimOpts, MediaTrimReason, MediaTrimReport, MediaTrimResult, MediaTrimTrackReport,
} from '@lolly-tools/core/host-v1';
import type {
  ConversionAudioOptions, ConversionVideoOptions, DiscardedTrack, Input, InputAudioTrack, InputTrack,
  InputVideoTrack, OutputFormat, Quality,
} from 'mediabunny';
import {
  SHEET_FRAMES, bitrateForTarget, checkColor, checkOrientation, checkSync, clockLabel, copiedOffset, copyFitsTarget,
  keyFrameCut, leadIn, normaliseRotation, rangeBitrate, readClipFacts, retryBitrate, shareDimensions, sheetLayout,
  sheetTimes, type ClipFacts, type ClipRotation, type ClipVideoFacts, type KeyFrameCut,
} from '../lib/clip-checks.ts';
import type { FrameProvider } from './sequence-providers.ts';

type Mediabunny = typeof import('mediabunny');
type OutputKind = 'mp4' | 'webm' | 'mov' | 'mkv' | 'wav' | 'mp3' | 'm4a' | 'opus' | 'ogg' | 'aac' | 'flac';
interface OutputSpec { format: OutputFormat; mime: string; container: string }
interface TrimRange { start: number; end: number; duration: number; rotate: ClipRotation }

/** Sound bitrate a size-limited copy re-encodes to when the source's is much higher. */
const SHARE_AUDIO_BPS = 128_000;
/** Files a size limit may write: the first (a copy when one fits, else an encode at the
 *  computed bitrate) and one corrected retry. */
const MAX_TARGET_ATTEMPTS = 2;
/** Longest poster edge; a larger frame is scaled down to keep the canvas affordable. */
const POSTER_MAX_EDGE = 4096;

function extension(name = ''): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1]!.toLowerCase() : '';
}

function sourceKind(opts: MediaTrimOpts): OutputKind | null {
  const ext = extension(opts.sourceName);
  if (['mp4', 'm4v'].includes(ext)) return 'mp4';
  if (ext === 'mov') return 'mov';
  if (ext === 'webm') return 'webm';
  if (ext === 'mkv') return 'mkv';
  if (['wav', 'wave'].includes(ext)) return 'wav';
  if (ext === 'mp3') return 'mp3';
  if (['ogg', 'oga'].includes(ext)) return 'ogg';
  if (ext === 'opus') return 'opus';
  if (ext === 'm4a') return 'm4a';
  if (ext === 'aac') return 'aac';
  if (ext === 'flac') return 'flac';
  const mime = String(opts.sourceMime ?? '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('mp4')) return mime.startsWith('audio/') ? 'm4a' : 'mp4';
  if (mime.includes('wave') || mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('flac')) return 'flac';
  return null;
}

function outputSpec(MB: Mediabunny, kind: OutputKind): OutputSpec {
  switch (kind) {
    case 'mp4': return { format: new MB.Mp4OutputFormat(), mime: 'video/mp4', container: 'mp4' };
    case 'm4a': return { format: new MB.Mp4OutputFormat(), mime: 'audio/mp4', container: 'm4a' };
    case 'mov': return { format: new MB.MovOutputFormat(), mime: 'video/quicktime', container: 'mov' };
    case 'webm': return { format: new MB.WebMOutputFormat(), mime: 'video/webm', container: 'webm' };
    case 'mkv': return { format: new MB.MkvOutputFormat(), mime: 'video/x-matroska', container: 'mkv' };
    case 'wav': return { format: new MB.WavOutputFormat(), mime: 'audio/wav', container: 'wav' };
    case 'mp3': return { format: new MB.Mp3OutputFormat(), mime: 'audio/mpeg', container: 'mp3' };
    case 'ogg': return { format: new MB.OggOutputFormat(), mime: 'audio/ogg', container: 'ogg' };
    case 'opus': return { format: new MB.OggOutputFormat(), mime: 'audio/ogg; codecs=opus', container: 'opus' };
    case 'aac': return { format: new MB.AdtsOutputFormat(), mime: 'audio/aac', container: 'aac' };
    case 'flac': return { format: new MB.FlacOutputFormat(), mime: 'audio/flac', container: 'flac' };
  }
}

// ── Frames on a canvas: GIF, poster and contact sheet ────────────────────────

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('media trim: this browser could not create a drawing canvas');
  return { canvas, ctx };
}

/** Draw the frame at `time` into a box, turned clockwise by `rotate`. */
async function drawTurned(
  provider: FrameProvider, ctx: CanvasRenderingContext2D, time: number, rotate: ClipRotation,
  box: { x: number; y: number; w: number; h: number }, scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
): Promise<boolean> {
  if (!rotate) return provider.drawAt(ctx, time, { dx: box.x, dy: box.y, dw: box.w, dh: box.h });
  const sideways = rotate % 180 !== 0;
  const fw = sideways ? box.h : box.w, fh = sideways ? box.w : box.h;
  if (scratch.canvas.width !== fw || scratch.canvas.height !== fh) { scratch.canvas.width = fw; scratch.canvas.height = fh; }
  scratch.ctx.clearRect(0, 0, fw, fh);
  if (!await provider.drawAt(scratch.ctx, time, { dx: 0, dy: 0, dw: fw, dh: fh })) return false;
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(scratch.canvas, -fw / 2, -fh / 2);
  ctx.restore();
  return true;
}

/** The displayed size after a turn, scaled so the longer edge is at most `maxEdge`. */
function turnedSize(provider: FrameProvider, rotate: ClipRotation, maxEdge: number): { width: number; height: number } {
  const sideways = rotate % 180 !== 0;
  const w = sideways ? provider.h : provider.w, h = sideways ? provider.w : provider.h;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

async function canvasBytes(canvas: HTMLCanvasElement, mime: string): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.9));
  if (!blob) throw new Error(`media trim: this browser could not write ${mime}`);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Frames drawn on a canvas have no tracks to copy; the report carries the drawn size. */
function framesReport(range: TrimRange, size: { width: number; height: number }): MediaTrimReport {
  return { method: 'frames', requestedStart: range.start, actualStart: range.start, keyFrameGap: 0, tracks: [], size };
}

async function withProvider<T>(bytes: Uint8Array, use: (provider: FrameProvider) => Promise<T>): Promise<T> {
  const { createVideoProvider } = await import('./sequence-providers.ts');
  const provider = await createVideoProvider(new Blob([bytes as BlobPart]));
  try { return await use(provider); } finally { await provider.dispose(); }
}

async function gifTrim(bytes: Uint8Array, range: TrimRange): Promise<MediaTrimResult> {
  const { start, end, duration, rotate } = range;
  if (end - start > 15) throw new Error('media trim: GIF export is limited to 15 seconds; shorten the selected clip');
  const { packGifAlpha } = await import('../lib/gif-alpha.ts');
  return withProvider(bytes, async (provider) => {
    const { width, height } = turnedSize(provider, rotate, 960);
    const fps = 12;
    const count = Math.max(1, Math.ceil((end - start) * fps));
    const timestamps = Array.from({ length: count }, (_, i) => Math.min(end - 1e-6, start + i / fps));
    provider.prime?.(timestamps);
    const { ctx } = canvas2d(width, height), scratch = canvas2d(1, 1);
    const frames: Uint8ClampedArray[] = [];
    for (const time of timestamps) {
      ctx.clearRect(0, 0, width, height);
      if (await drawTurned(provider, ctx, time, rotate, { x: 0, y: 0, w: width, h: height }, scratch)) {
        frames.push(ctx.getImageData(0, 0, width, height).data);
      }
    }
    if (!frames.length) throw new Error('media trim: the video codec produced no frames for the selected GIF span');
    return {
      bytes: packGifAlpha(frames, { width, height, delayMs: 1000 / fps, loops: 0 }),
      mime: 'image/gif', container: 'gif', durationBefore: duration,
      durationAfter: frames.length / fps, lossless: false, frameCount: frames.length,
      report: framesReport(range, { width, height }),
    };
  });
}

async function posterTrim(bytes: Uint8Array, range: TrimRange, mime: string, ext: string): Promise<MediaTrimResult> {
  return withProvider(bytes, async (provider) => {
    const size = turnedSize(provider, range.rotate, POSTER_MAX_EDGE);
    const { canvas, ctx } = canvas2d(size.width, size.height);
    const time = Math.min(range.start, range.duration - 1e-3);
    if (!await drawTurned(provider, ctx, time, range.rotate, { x: 0, y: 0, w: size.width, h: size.height }, canvas2d(1, 1))) {
      throw new Error(`media trim: the video has no frame at ${clockLabel(time)}`);
    }
    return {
      bytes: await canvasBytes(canvas, mime), mime, container: ext, durationBefore: range.duration,
      durationAfter: 0, lossless: false, frameCount: 1, report: framesReport(range, size),
    };
  });
}

async function contactSheetTrim(bytes: Uint8Array, range: TrimRange, frames: number, mime: string, ext: string): Promise<MediaTrimResult> {
  return withProvider(bytes, async (provider) => {
    const times = sheetTimes(range.start, range.end, frames);
    const frame = turnedSize(provider, range.rotate, Number.MAX_SAFE_INTEGER);
    const layout = sheetLayout(times.length, frame.width, frame.height);
    const { canvas, ctx } = canvas2d(layout.width, layout.height), scratch = canvas2d(1, 1);
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, layout.width, layout.height);
    provider.prime?.(times);
    const fontPx = Math.max(12, Math.round(layout.tileHeight * 0.075));
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    let drawn = 0;
    for (const [i, time] of times.entries()) {
      const x = layout.padding + (i % layout.cols) * (layout.tileWidth + layout.gap);
      const y = layout.padding + Math.floor(i / layout.cols) * (layout.tileHeight + layout.gap);
      if (!await drawTurned(provider, ctx, time, range.rotate, { x, y, w: layout.tileWidth, h: layout.tileHeight }, scratch)) continue;
      drawn++;
      const label = clockLabel(time), pad = Math.round(fontPx * 0.45);
      const labelWidth = ctx.measureText(label).width + pad * 2, labelHeight = fontPx + pad;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
      ctx.fillRect(x + pad, y + layout.tileHeight - labelHeight - pad, labelWidth, labelHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + pad * 2, y + layout.tileHeight - pad - labelHeight / 2);
    }
    if (!drawn) throw new Error('media trim: the video codec produced no frames for the contact sheet');
    return {
      bytes: await canvasBytes(canvas, mime), mime, container: ext, durationBefore: range.duration,
      durationAfter: 0, lossless: false, frameCount: drawn,
      report: framesReport(range, { width: layout.width, height: layout.height }),
    };
  });
}

// ── Clips: one Conversion, then a report measured on the written bytes ───────

const DISCARD_PHRASES: Record<DiscardedTrack['reason'], string> = {
  discarded_by_user: 'it was removed as asked',
  max_track_count_reached: 'the container has no room for another track',
  max_track_count_of_type_reached: 'the container has no room for it',
  unknown_source_codec: 'its codec is not recognised',
  undecodable_source_codec: 'this browser cannot decode it',
  no_encodable_target_codec: 'this browser cannot encode a codec the container carries',
  cannot_copy: 'it cannot be copied',
};

type CutMode = NonNullable<MediaTrimOpts['cut']>;
interface PictureSize { width: number; height: number }

/** What a clip keeps and changes, before any choice about the cut or a size limit. */
interface ClipSetup {
  kind: OutputKind;
  spec: OutputSpec;
  range: TrimRange;
  cutMode: CutMode;
  cut: KeyFrameCut | null;
  rotate: ClipRotation;
  keepVideo: boolean;
  keepAudio: boolean;
  resize: PictureSize | null;
  shortEdge: 'width' | 'height';
  audioCodec: 'aac' | 'opus' | 'pcm-s16' | undefined;
  /** Why the picture is re-encoded whatever the cut or size limit. */
  pictureReasons: MediaTrimReason[];
}

/** How a size limit shapes one attempt. */
interface SizeChoice {
  /** A copy would not fit, so the limit alone needs the picture re-encoded. */
  forces: boolean;
  /** Picture bitrate for a re-encode, never above the source's own. */
  videoBps: number;
  /** The limit, not the source, set `videoBps`. */
  limitSets: boolean;
  audioQuality: Quality | undefined;
}

interface ClipPlan extends ClipSetup {
  start: number;
  end: number;
  cutBetweenKeys: boolean;
  /** Re-encode bitrate for the picture; 0 copies or leaves the encoder's default. */
  videoBps: number;
  limitForces: boolean;
  limitSets: boolean;
  audioQuality: Quality | undefined;
}

/** The size-limit facts measured on the source range, read once per clip. */
interface SizeFacts {
  targetBytes: number;
  /** The source's own rates over the range a copy would carry; 0 when unknown. */
  videoBps: number;
  audioBps: number;
  /** Whether a copy of the range should fit as it is. */
  copyFits: boolean;
  /** Output pixels over source pixels for a sharing size, else 1. */
  areaScale: number;
}

/** Output formats that keep packets before the start in full and tell players to skip them. */
function hidesLeadIn(spec: OutputSpec): boolean {
  return spec.format.negativeTimestampSupport === 'full';
}

/** Why the picture must be re-encoded, mirroring the checks mediabunny makes before a copy. */
function pictureReasons(spec: OutputSpec, video: ClipVideoFacts, rotate: ClipRotation, resize: PictureSize | null): MediaTrimReason[] {
  const reasons: MediaTrimReason[] = [];
  if (!video.codec || !spec.format.getSupportedVideoCodecs().some((c) => c === video.codec)) reasons.push('codec-not-in-container');
  if ((video.rotation + rotate) % 360 !== 0 && !spec.format.supportsVideoTransformationMetadata) reasons.push('rotation-needs-pixels');
  if (resize) reasons.push('resize');
  return reasons;
}

/**
 * Where the clip starts and what is re-encoded. A copy begins on a key frame. Inside the
 * key frame's own display time the first frame is the one asked for, so the copy starts
 * on the key frame. Further in, a fast cut starts early; an exact cut copies with the
 * lead-in hidden where the container can (MP4, MOV) and re-encodes the picture
 * elsewhere; a `reencode` cut always re-encodes. A picture re-encoded for any other
 * reason can start on any frame, so it starts where asked.
 */
function planClip(s: ClipSetup, size: SizeChoice | null): ClipPlan {
  const reencode = s.keepVideo && (s.pictureReasons.length > 0 || Boolean(size?.forces));
  let start = s.range.start, cutBetweenKeys = false;
  const cut = s.cut;
  if (s.keepVideo && !reencode && cut && cut.keyTime !== null && cut.gap > 0) {
    if (cut.aligned || s.cutMode === 'keyframe') start = cut.keyTime;
    else if (s.cutMode === 'reencode' || !hidesLeadIn(s.spec)) cutBetweenKeys = true;
  }
  const picture = reencode || cutBetweenKeys;
  return {
    ...s, start, end: s.range.end, cutBetweenKeys,
    videoBps: picture && size ? size.videoBps : 0,
    limitForces: Boolean(size?.forces), limitSets: picture && Boolean(size?.limitSets),
    audioQuality: size?.audioQuality,
  };
}

/** The size choice for one attempt. `forces` is true when a copy will not fit. */
function sizeChoice(MB: Mediabunny, s: ClipSetup, facts: SizeFacts, forces: boolean): SizeChoice {
  const squeeze = forces && s.keepAudio && facts.audioBps > SHARE_AUDIO_BPS * 1.25;
  const audioBps = squeeze ? SHARE_AUDIO_BPS : facts.audioBps;
  const budget = bitrateForTarget(facts.targetBytes, s.range.end - s.range.start, audioBps, facts.videoBps, facts.areaScale);
  return {
    forces, videoBps: budget.videoBps, limitSets: !budget.capped,
    audioQuality: squeeze ? new MB.Quality({ bitrate: SHARE_AUDIO_BPS }) : undefined,
  };
}

async function sizeFacts(
  MB: Mediabunny, s: ClipSetup, primaries: Primaries, targetBytes: number, shown: { w: number; h: number } | null,
): Promise<SizeFacts> {
  const from = Math.min(s.range.start, s.cut?.keyTime ?? s.range.start);
  const videoBps = primaries.video ? (await rangeBitrate(MB, primaries.video, from, s.range.end)) ?? 0 : 0;
  const audioBps = s.keepAudio && primaries.audio ? (await rangeBitrate(MB, primaries.audio, from, s.range.end)) ?? SHARE_AUDIO_BPS : 0;
  const copyBytes = ((videoBps + audioBps) * (s.range.end - from)) / 8;
  const areaScale = s.resize && shown ? (s.resize.width * s.resize.height) / (shown.w * shown.h) : 1;
  return { targetBytes, videoBps, audioBps, copyFits: videoBps > 0 && copyFitsTarget(copyBytes, targetBytes), areaScale };
}

function videoOptions(MB: Mediabunny, plan: ClipPlan): ConversionVideoOptions {
  if (!plan.keepVideo) return { discard: true };
  const options: ConversionVideoOptions = {};
  if (plan.rotate) options.rotate = plan.rotate;
  if (plan.cutBetweenKeys) options.forceTranscode = true;
  if (plan.resize) options[plan.shortEdge] = plan.resize[plan.shortEdge];
  if (plan.videoBps > 0) options.quality = new MB.Quality({ bitrate: plan.videoBps, bitrateMode: 'variable' });
  return options;
}

function audioOptions(plan: ClipPlan): ConversionAudioOptions {
  if (!plan.keepAudio) return { discard: true };
  const options: ConversionAudioOptions = {};
  if (plan.audioCodec) options.codec = plan.audioCodec;
  if (plan.audioQuality) options.quality = plan.audioQuality;
  return options;
}

function listText(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * Every setting to change so the picture is copied, or none when no setting can do it
 * (a codec or a turn the container cannot carry). The cut is named only when it would
 * still re-encode the picture once the other settings are undone.
 */
function copySteps(plan: ClipPlan): string[] {
  if (!plan.keepVideo || plan.pictureReasons.some((r) => r !== 'resize')) return [];
  const steps: string[] = [];
  if (plan.resize) steps.push('choose Original size');
  if (plan.limitForces) steps.push('clear the size limit');
  const bare: ClipSetup = { ...plan, pictureReasons: [] };
  if (planClip(bare, null).cutBetweenKeys) {
    const exactCopies = plan.cutMode === 'reencode' && !planClip({ ...bare, cutMode: 'exact' }, null).cutBetweenKeys;
    steps.push(exactCopies ? 'choose an exact or fast cut' : 'choose a fast cut');
  }
  return steps;
}

/** What the user can change when the picture or the sound cannot be carried over. */
function refusalHint(plan: ClipPlan, lostPicture: boolean, lostSound: boolean): string {
  const ways = new Set<string>();
  if (lostPicture || !lostSound) {
    const steps = copySteps(plan);
    ways.add(steps.length ? `${listText(steps)} to copy the picture` : 'try another container');
  }
  if (lostSound) {
    ways.add(plan.audioCodec ? 'choose another audio format' : 'try another container');
    if (plan.keepVideo) ways.add('turn on Remove audio');
  }
  const text = [...ways].join(', or ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

async function convertOnce(MB: Mediabunny, input: Input, plan: ClipPlan): Promise<Uint8Array> {
  const target = new MB.BufferTarget();
  // A fresh format per attempt: a size-limit retry writes a second Output.
  const output = new MB.Output({ format: outputSpec(MB, plan.kind).format, target });
  const conversion = await MB.Conversion.init({
    input, output, tracks: 'primary', trim: { start: plan.start, end: plan.end }, showWarnings: false,
    video: videoOptions(MB, plan), audio: audioOptions(plan),
  });
  // A track the user kept must not vanish from a valid conversion without a word.
  const lost = conversion.discardedTracks.filter((d) => d.reason !== 'discarded_by_user');
  if (lost.length || !conversion.isValid) {
    const reasons = await Promise.all(lost.map(async (d) => `the ${await d.track.getCodec() || 'unknown'} ${d.track.type === 'video' ? 'picture' : 'sound'} would be left out because ${DISCARD_PHRASES[d.reason]}`));
    const hint = refusalHint(plan, lost.some((d) => d.track.type === 'video'), lost.some((d) => d.track.type === 'audio'));
    throw new Error(`media trim: cannot produce ${plan.spec.container}${reasons.length ? `: ${reasons.join('; ')}` : ''}. ${hint}`);
  }
  try {
    await conversion.execute();
  } catch (error) {
    throw new Error(`media trim: the ${plan.spec.container} could not be written (${String((error as Error)?.message || error)})`);
  }
  if (!target.buffer) throw new Error('media trim: the encoder finished without output bytes');
  return new Uint8Array(target.buffer);
}

function videoReasons(plan: ClipPlan): MediaTrimReason[] {
  const reasons: MediaTrimReason[] = plan.cutBetweenKeys ? ['cut-between-key-frames'] : [];
  reasons.push(...plan.pictureReasons);
  if (plan.limitSets || (plan.limitForces && !plan.pictureReasons.length)) reasons.push('target-size');
  return reasons.length ? reasons : ['container-timing'];
}

function audioReasons(plan: ClipPlan, codec: string | null): MediaTrimReason[] {
  const reasons: MediaTrimReason[] = [];
  if (plan.audioCodec && plan.audioCodec !== codec) reasons.push('format-requested');
  if (!codec || !plan.spec.format.getSupportedAudioCodecs().some((c) => c === codec)) reasons.push('codec-not-in-container');
  if (plan.audioQuality) reasons.push('target-size');
  return reasons.length ? reasons : ['container-timing'];
}

interface Primaries { video: InputVideoTrack | null; audio: InputAudioTrack | null }

async function trackReports(
  input: Input, plan: ClipPlan, primaries: Primaries, written: Primaries,
  offsets: { video: number | null; audio: number | null },
): Promise<MediaTrimTrackReport[]> {
  const reports: MediaTrimTrackReport[] = [];
  for (const track of await input.getTracks()) {
    const codec = (await track.getCodec()) ?? null;
    const kind = track.type === 'video' || track.type === 'audio' ? track.type : 'other';
    const isVideo = track === primaries.video, isAudio = track === primaries.audio;
    if (!isVideo && !isAudio) {
      reports.push({ kind, codec, outputCodec: null, action: 'drop', reasons: ['not-primary'] });
      continue;
    }
    const kept = isVideo ? plan.keepVideo : plan.keepAudio;
    const out: InputTrack | null = isVideo ? written.video : written.audio;
    if (!kept || !out) {
      reports.push({ kind, codec, outputCodec: null, action: 'drop', reasons: ['removed-by-request'] });
      continue;
    }
    const outputCodec = (await out.getCodec()) ?? null;
    const copied = (isVideo ? offsets.video : offsets.audio) !== null;
    const reasons = copied ? [] : isVideo ? videoReasons(plan) : audioReasons(plan, codec);
    reports.push({ kind, codec, outputCodec, action: copied ? 'copy' : 're-encode', reasons });
  }
  return reports;
}

async function measure(
  MB: Mediabunny, input: Input, plan: ClipPlan, primaries: Primaries, facts: ClipFacts, bytes: Uint8Array,
): Promise<MediaTrimReport> {
  const outInput = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BufferSource(bytes) });
  try {
    const outFacts = await readClipFacts(MB, outInput);
    const written: Primaries = { video: await outInput.getPrimaryVideoTrack(), audio: await outInput.getPrimaryAudioTrack() };
    const offsets = {
      video: primaries.video && written.video && plan.keepVideo ? await copiedOffset(MB, primaries.video, written.video, plan.start) : null,
      audio: primaries.audio && written.audio && plan.keepAudio ? await copiedOffset(MB, primaries.audio, written.audio, plan.start) : null,
    };
    const tracks = await trackReports(input, plan, primaries, written, offsets);
    const kept = tracks.filter((t) => t.action !== 'drop');
    const copies = kept.filter((t) => t.action === 'copy').length;
    const report: MediaTrimReport = {
      method: copies === kept.length ? 'copy' : copies === 0 ? 're-encode' : 'mixed',
      requestedStart: 0, actualStart: plan.start, keyFrameGap: 0, tracks,
    };
    const hidden = plan.keepVideo ? leadIn(outFacts.video) : 0;
    if (hidden > 0) report.hiddenLeadIn = hidden;
    if (plan.keepVideo && plan.keepAudio) report.sync = checkSync(facts, outFacts, plan.start, plan.end, offsets);
    if (plan.keepVideo && facts.video && outFacts.video) {
      report.orientation = checkOrientation(facts.video, outFacts.video, plan.rotate, plan.resize);
      report.color = checkColor(facts.video.color, outFacts.video.color);
      report.size = { width: outFacts.video.displayWidth, height: outFacts.video.displayHeight };
    }
    return report;
  } finally {
    outInput.dispose();
  }
}

async function clipTrim(MB: Mediabunny, input: Input, opts: MediaTrimOpts, range: TrimRange): Promise<MediaTrimResult> {
  const audioOnly = opts.audioOnly || false;
  const requested: OutputKind | null = audioOnly || (opts.container && opts.container !== 'keep'
    ? opts.container as OutputKind : sourceKind(opts));
  if (!requested) throw new Error('media trim: choose MP4 or WebM because the source container could not be identified');
  const primaries: Primaries = { video: await input.getPrimaryVideoTrack(), audio: await input.getPrimaryAudioTrack() };
  if (audioOnly && !primaries.audio) throw new Error('media trim: the source has no audio track to extract');
  if (!audioOnly && !primaries.video && opts.mute) throw new Error('media trim: muting this audio-only source would leave no media tracks');
  const facts = await readClipFacts(MB, input);
  const keepVideo = !audioOnly && primaries.video !== null;
  const keepAudio = primaries.audio !== null && !(opts.mute && !audioOnly);
  const spec = outputSpec(MB, requested);
  const rotate = keepVideo ? range.rotate : 0;
  const sideways = rotate % 180 !== 0;
  const shown = facts.video ? { w: sideways ? facts.video.displayHeight : facts.video.displayWidth, h: sideways ? facts.video.displayWidth : facts.video.displayHeight } : null;
  const resize = keepVideo && shown && opts.maxShortEdge ? shareDimensions(shown.w, shown.h, opts.maxShortEdge) : null;
  const setup: ClipSetup = {
    kind: requested, spec, range, rotate, keepVideo, keepAudio, resize,
    cutMode: opts.cut === 'keyframe' || opts.cut === 'reencode' ? opts.cut : 'exact',
    cut: keepVideo && primaries.video ? await keyFrameCut(MB, primaries.video, range.start) : null,
    shortEdge: shown && shown.w < shown.h ? 'width' : 'height',
    audioCodec: audioOnly === 'm4a' ? 'aac' : audioOnly === 'opus' ? 'opus' : audioOnly === 'wav' ? 'pcm-s16' : undefined,
    pictureReasons: keepVideo && facts.video ? pictureReasons(spec, facts.video, rotate, resize) : [],
  };

  // A size limit keeps a copy that already fits. Otherwise the picture is re-encoded at a
  // bitrate meant to fit, and once more lower down if the first file is still too large.
  // The smallest file written is the one returned.
  const targetBytes = keepVideo && Number(opts.targetBytes) > 0 ? Number(opts.targetBytes) : 0;
  const sizing = targetBytes ? await sizeFacts(MB, setup, primaries, targetBytes, shown) : null;
  let plan = planClip(setup, sizing ? sizeChoice(MB, setup, sizing, !sizing.copyFits) : null);
  let last = { plan, bytes: await convertOnce(MB, input, plan) };
  let best = last, attempts = 1;
  while (sizing && last.bytes.length > targetBytes && attempts < MAX_TARGET_ATTEMPTS) {
    // A copy runs at the source's own rate.
    const from = last.plan.videoBps || sizing.videoBps;
    const videoBps = from > 0 ? retryBitrate(from, last.bytes.length, targetBytes) : 0;
    if (!(videoBps > 0) || (last.plan.videoBps && videoBps >= last.plan.videoBps)) break;
    const choice = sizeChoice(MB, setup, sizing, true);
    plan = planClip(setup, { ...choice, videoBps: Math.min(choice.videoBps, videoBps), limitSets: true });
    try {
      last = { plan, bytes: await convertOnce(MB, input, plan) };
    } catch {
      break; // The file already written stands, reported as over the limit.
    }
    attempts++;
    if (last.bytes.length < best.bytes.length) best = last;
  }

  const report = await measure(MB, input, best.plan, primaries, facts, best.bytes);
  report.requestedStart = range.start;
  report.keyFrameGap = setup.cut?.gap ?? 0;
  if (targetBytes) report.target = { bytes: targetBytes, met: best.bytes.length <= targetBytes, attempts };
  return {
    bytes: best.bytes, mime: spec.mime, container: spec.container,
    durationBefore: range.duration, durationAfter: range.end - best.plan.start, lossless: report.method === 'copy', report,
  };
}

export async function trimMedia(bytes: Uint8Array, opts: MediaTrimOpts): Promise<MediaTrimResult> {
  const MB = await import('mediabunny');
  const blob = new Blob([bytes as BlobPart], { type: opts.sourceMime || 'application/octet-stream' });
  const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(blob) });
  try {
    if (!await input.canRead()) throw new Error('media trim: this container is not readable in the browser');
    const duration = await input.computeDuration();
    if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('media trim: the source has no finite duration');
    const start = Math.max(0, Number(opts.start) || 0);
    const end = opts.end == null || Number(opts.end) <= 0 ? duration : Math.min(duration, Number(opts.end));
    if (!(start < end)) throw new Error(`media trim: start (${start}s) must be before end (${end}s)`);
    const range: TrimRange = { start, end, duration, rotate: normaliseRotation(opts.rotate) };

    if (opts.output === 'poster' || opts.output === 'contact-sheet') {
      if (!await input.getPrimaryVideoTrack()) throw new Error('media trim: this file has no picture to take frames from');
      const png = opts.image === 'png';
      const mime = png ? 'image/png' : 'image/jpeg', ext = png ? 'png' : 'jpg';
      return opts.output === 'poster'
        ? await posterTrim(bytes, range, mime, ext)
        : await contactSheetTrim(bytes, range, Number(opts.sheetFrames) || SHEET_FRAMES.fallback, mime, ext);
    }
    if (opts.container === 'gif') return await gifTrim(bytes, range);
    return await clipTrim(MB, input, opts, range);
  } finally {
    input.dispose();
  }
}
