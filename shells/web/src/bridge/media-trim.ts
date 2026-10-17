// SPDX-License-Identifier: MPL-2.0
/**
 * Local uploaded-media trim, remux and still-frame implementation for host.media.trim.
 *
 * A clip goes through one mediabunny Conversion, which copies each track's packets
 * when it can and re-encodes when it must. This module decides what the Conversion
 * cannot: where the cut starts against the key frames, the size and bitrate of a
 * sharing copy, and that a track the user kept is never left out without a word.
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
  SHEET_FRAMES, bitrateForTarget, checkColor, checkOrientation, checkSync, clockLabel, copiedOffset,
  keyFrameCut, normaliseRotation, readClipFacts, retryBitrate, shareDimensions, sheetLayout, sheetTimes,
  type ClipFacts, type ClipRotation,
} from '../lib/clip-checks.ts';
import type { FrameProvider } from './sequence-providers.ts';

type Mediabunny = typeof import('mediabunny');
type OutputKind = 'mp4' | 'webm' | 'mov' | 'mkv' | 'wav' | 'mp3' | 'm4a' | 'opus' | 'ogg' | 'aac' | 'flac';
interface OutputSpec { format: OutputFormat; mime: string; container: string }
interface TrimRange { start: number; end: number; duration: number; rotate: ClipRotation }

/** Sound bitrate a size-limited copy re-encodes to when the source's is much higher. */
const SHARE_AUDIO_BPS = 128_000;
/** Encodes a size limit may take: the first at the computed bitrate, one corrected retry. */
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

interface ClipPlan {
  kind: OutputKind;
  spec: OutputSpec;
  start: number;
  end: number;
  rotate: ClipRotation;
  keepVideo: boolean;
  keepAudio: boolean;
  cutBetweenKeys: boolean;
  resize: { width: number; height: number } | null;
  shortEdge: 'width' | 'height';
  audioCodec: 'aac' | 'opus' | 'pcm-s16' | undefined;
  audioQuality: Quality | undefined;
  hint: string;
}

function videoOptions(MB: Mediabunny, plan: ClipPlan, videoBps: number): ConversionVideoOptions {
  if (!plan.keepVideo) return { discard: true };
  const options: ConversionVideoOptions = {};
  if (plan.rotate) options.rotate = plan.rotate;
  if (plan.cutBetweenKeys) options.forceTranscode = true;
  if (plan.resize) options[plan.shortEdge] = plan.resize[plan.shortEdge];
  if (videoBps > 0) options.quality = new MB.Quality({ bitrate: videoBps, bitrateMode: 'variable' });
  return options;
}

function audioOptions(plan: ClipPlan): ConversionAudioOptions {
  if (!plan.keepAudio) return { discard: true };
  const options: ConversionAudioOptions = {};
  if (plan.audioCodec) options.codec = plan.audioCodec;
  if (plan.audioQuality) options.quality = plan.audioQuality;
  return options;
}

async function convertOnce(MB: Mediabunny, input: Input, plan: ClipPlan, videoBps: number): Promise<Uint8Array> {
  const target = new MB.BufferTarget();
  // A fresh format per attempt: a size-limit retry writes a second Output.
  const output = new MB.Output({ format: outputSpec(MB, plan.kind).format, target });
  const conversion = await MB.Conversion.init({
    input, output, tracks: 'primary', trim: { start: plan.start, end: plan.end }, showWarnings: false,
    video: videoOptions(MB, plan, videoBps), audio: audioOptions(plan),
  });
  // A track the user kept must not vanish from a valid conversion without a word.
  const lost = conversion.discardedTracks.filter((d) => d.reason !== 'discarded_by_user');
  if (lost.length || !conversion.isValid) {
    const reasons = await Promise.all(lost.map(async (d) => `the ${await d.track.getCodec() || 'unknown'} ${d.track.type === 'video' ? 'picture' : 'sound'} would be left out because ${DISCARD_PHRASES[d.reason]}`));
    throw new Error(`media trim: cannot produce ${plan.spec.container}${reasons.length ? `: ${reasons.join('; ')}` : ''}. ${plan.hint}`.trim());
  }
  try {
    await conversion.execute();
  } catch (error) {
    throw new Error(`media trim: the ${plan.spec.container} could not be written (${String((error as Error)?.message || error)})`);
  }
  if (!target.buffer) throw new Error('media trim: the encoder finished without output bytes');
  return new Uint8Array(target.buffer);
}

function videoReasons(plan: ClipPlan, codec: string | null, videoBps: number): MediaTrimReason[] {
  const reasons: MediaTrimReason[] = [];
  if (plan.cutBetweenKeys) reasons.push('cut-between-key-frames');
  if (!codec || !plan.spec.format.getSupportedVideoCodecs().some((c) => c === codec)) reasons.push('codec-not-in-container');
  if (plan.rotate && !plan.spec.format.supportsVideoTransformationMetadata) reasons.push('rotation-needs-pixels');
  if (plan.resize) reasons.push('resize');
  if (videoBps > 0) reasons.push('target-size');
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
  videoBps: number, offsets: { video: number | null; audio: number | null },
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
    const reasons = copied ? [] : isVideo ? videoReasons(plan, codec, videoBps) : audioReasons(plan, codec);
    reports.push({ kind, codec, outputCodec, action: copied ? 'copy' : 're-encode', reasons });
  }
  return reports;
}

async function measure(
  MB: Mediabunny, input: Input, plan: ClipPlan, primaries: Primaries, facts: ClipFacts, bytes: Uint8Array, videoBps: number,
): Promise<MediaTrimReport> {
  const outInput = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BufferSource(bytes) });
  try {
    const outFacts = await readClipFacts(MB, outInput);
    const written: Primaries = { video: await outInput.getPrimaryVideoTrack(), audio: await outInput.getPrimaryAudioTrack() };
    const offsets = {
      video: primaries.video && written.video && plan.keepVideo ? await copiedOffset(MB, primaries.video, written.video, plan.start) : null,
      audio: primaries.audio && written.audio && plan.keepAudio ? await copiedOffset(MB, primaries.audio, written.audio, plan.start) : null,
    };
    const tracks = await trackReports(input, plan, primaries, written, videoBps, offsets);
    const kept = tracks.filter((t) => t.action !== 'drop');
    const copies = kept.filter((t) => t.action === 'copy').length;
    const report: MediaTrimReport = {
      method: copies === kept.length ? 'copy' : copies === 0 ? 're-encode' : 'mixed',
      requestedStart: 0, actualStart: plan.start, keyFrameGap: 0, tracks,
    };
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

  // A copy begins on a key frame. Inside the key frame's own display time the first
  // frame is the one asked for; further in, a fast cut starts early and an exact cut
  // re-encodes the picture.
  let start = range.start, keyFrameGap = 0, cutBetweenKeys = false;
  if (keepVideo && primaries.video) {
    const cut = await keyFrameCut(MB, primaries.video, range.start);
    keyFrameGap = cut.gap;
    if (cut.keyTime !== null && cut.gap > 0) {
      if (cut.aligned || opts.cut === 'keyframe') start = cut.keyTime;
      else cutBetweenKeys = true;
    }
  }

  const sideways = range.rotate % 180 !== 0;
  const shown = facts.video ? { w: sideways ? facts.video.displayHeight : facts.video.displayWidth, h: sideways ? facts.video.displayWidth : facts.video.displayHeight } : null;
  const resize = keepVideo && shown && opts.maxShortEdge ? shareDimensions(shown.w, shown.h, opts.maxShortEdge) : null;
  const targetBytes = keepVideo && Number(opts.targetBytes) > 0 ? Number(opts.targetBytes) : 0;
  let audioBps = 0, audioQuality: Quality | undefined;
  if (targetBytes && keepAudio && primaries.audio) {
    const measured = (await primaries.audio.getAverageBitrate()) ?? SHARE_AUDIO_BPS;
    if (measured > SHARE_AUDIO_BPS * 1.25) { audioBps = SHARE_AUDIO_BPS; audioQuality = new MB.Quality({ bitrate: SHARE_AUDIO_BPS }); }
    else audioBps = measured;
  }
  const plan: ClipPlan = {
    kind: requested, spec: outputSpec(MB, requested), start, end: range.end, rotate: keepVideo ? range.rotate : 0, keepVideo, keepAudio,
    cutBetweenKeys, resize, shortEdge: shown && shown.w < shown.h ? 'width' : 'height',
    audioCodec: audioOnly === 'm4a' ? 'aac' : audioOnly === 'opus' ? 'opus' : audioOnly === 'wav' ? 'pcm-s16' : undefined,
    audioQuality,
    hint: cutBetweenKeys ? 'Choose a fast cut to copy the picture instead, or turn on Remove audio if the sound is the problem.' : keepAudio && keepVideo ? 'Try another container, or turn on Remove audio.' : 'Try another container.',
  };

  const budget = targetBytes ? bitrateForTarget(targetBytes, range.end - start, audioBps) : null;
  let videoBps = budget?.videoBps ?? 0;
  let bytes = await convertOnce(MB, input, plan, videoBps), attempts = 1;
  while (budget && bytes.length > targetBytes && attempts < MAX_TARGET_ATTEMPTS && videoBps > retryBitrate(videoBps, bytes.length, targetBytes)) {
    videoBps = retryBitrate(videoBps, bytes.length, targetBytes);
    bytes = await convertOnce(MB, input, plan, videoBps);
    attempts++;
  }

  const report = await measure(MB, input, plan, primaries, facts, bytes, videoBps);
  report.requestedStart = range.start;
  report.keyFrameGap = keyFrameGap;
  if (targetBytes) report.target = { bytes: targetBytes, met: bytes.length <= targetBytes, attempts };
  return {
    bytes, mime: plan.spec.mime, container: plan.spec.container,
    durationBefore: range.duration, durationAfter: range.end - start, lossless: report.method === 'copy', report,
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
