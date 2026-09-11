// SPDX-License-Identifier: MPL-2.0
/** Local uploaded-media trim/remux implementation for host.media.trim. */
import type { MediaTrimOpts, MediaTrimResult } from '@lolly-tools/core/host-v1';

type OutputKind = 'mp4' | 'webm' | 'mov' | 'mkv' | 'wav' | 'mp3' | 'm4a' | 'opus' | 'ogg' | 'aac' | 'flac';

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

function outputSpec(MB: any, kind: OutputKind): { format: any; mime: string; container: string } {
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

async function gifTrim(bytes: Uint8Array, start: number, end: number, duration: number): Promise<MediaTrimResult> {
  const span = end - start;
  if (span > 15) throw new Error('media trim: GIF export is limited to 15 seconds; shorten the selected clip');
  const [{ createVideoProvider }, { packGifAlpha }] = await Promise.all([
    import('./sequence-providers.ts'), import('../lib/gif-alpha.ts'),
  ]);
  const provider = await createVideoProvider(new Blob([bytes as BlobPart]));
  try {
    const scale = Math.min(1, 960 / Math.max(provider.w, provider.h));
    const width = Math.max(1, Math.round(provider.w * scale));
    const height = Math.max(1, Math.round(provider.h * scale));
    const fps = 12;
    const count = Math.max(1, Math.ceil(span * fps));
    const timestamps = Array.from({ length: count }, (_, i) => Math.min(end - 1e-6, start + i / fps));
    provider.prime?.(timestamps);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('media trim: this browser could not create a GIF canvas');
    const frames: Uint8ClampedArray[] = [];
    for (const time of timestamps) {
      ctx.clearRect(0, 0, width, height);
      if (await provider.drawAt(ctx, time, { dx: 0, dy: 0, dw: width, dh: height })) {
        frames.push(ctx.getImageData(0, 0, width, height).data);
      }
    }
    if (!frames.length) throw new Error('media trim: the video codec produced no frames for the selected GIF span');
    return {
      bytes: packGifAlpha(frames, { width, height, delayMs: 1000 / fps, loops: 0 }),
      mime: 'image/gif', container: 'gif', durationBefore: duration,
      durationAfter: frames.length / fps, lossless: false, frameCount: frames.length,
    };
  } finally {
    await provider.dispose();
  }
}

export async function trimMedia(bytes: Uint8Array, opts: MediaTrimOpts): Promise<MediaTrimResult> {
  const MB = await import('mediabunny');
  const blob = new Blob([bytes as BlobPart], { type: opts.sourceMime || 'application/octet-stream' });
  const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(blob) });
  if (!await input.canRead()) throw new Error('media trim: this container is not readable in the browser');
  const duration = await input.computeDuration();
  if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('media trim: the source has no finite duration');
  const start = Math.max(0, Number(opts.start) || 0);
  const end = opts.end == null || Number(opts.end) <= 0 ? duration : Math.min(duration, Number(opts.end));
  if (!(start < end)) throw new Error(`media trim: start (${start}s) must be before end (${end}s)`);

  if (opts.container === 'gif') {
    try { return await gifTrim(bytes, start, end, duration); }
    finally { input.dispose(); }
  }

  const audioOnly = opts.audioOnly || false;
  const requested: OutputKind | null = audioOnly || (opts.container && opts.container !== 'keep'
    ? opts.container as OutputKind : sourceKind(opts));
  if (!requested) {
    input.dispose();
    throw new Error('media trim: choose MP4 or WebM because the source container could not be identified');
  }
  const spec = outputSpec(MB, requested);
  const target = new MB.BufferTarget();
  const output = new MB.Output({ format: spec.format, target });
  const videoTracks = await input.getVideoTracks();
  const audioTracks = await input.getAudioTracks();
  if (audioOnly && !audioTracks.length) {
    input.dispose();
    throw new Error('media trim: the source has no audio track to extract');
  }
  if (!audioOnly && !videoTracks.length && opts.mute) {
    input.dispose();
    throw new Error('media trim: muting this audio-only source would leave no media tracks');
  }

  const audioCodec = audioOnly === 'm4a' ? 'aac' : audioOnly === 'opus' ? 'opus' : audioOnly === 'wav' ? 'pcm-s16' : undefined;
  const conversion = await MB.Conversion.init({
    input, output, tracks: 'primary', trim: { start, end }, showWarnings: false,
    video: audioOnly ? { discard: true } : {},
    audio: opts.mute && !audioOnly ? { discard: true } : audioCodec ? { codec: audioCodec } : {},
  });
  if (!conversion.isValid) {
    const reasons: string[] = [];
    for (const discarded of conversion.discardedTracks) {
      const codec = await discarded.track.getCodec();
      if (discarded.reason === 'discarded_by_user') continue;
      reasons.push(`${discarded.track.type} ${codec || 'unknown codec'} (${discarded.reason.replaceAll('_', ' ')})`);
    }
    input.dispose();
    throw new Error(`media trim: cannot produce ${requested}${reasons.length ? ` from ${reasons.join(', ')}` : ''}`);
  }

  const supportedVideo = new Set(spec.format.getSupportedVideoCodecs());
  const supportedAudio = new Set(spec.format.getSupportedAudioCodecs());
  let lossless = start <= await input.getFirstTimestamp(conversion.utilizedTracks);
  for (const track of conversion.utilizedTracks) {
    const codec = await track.getCodec();
    if (track.type === 'video' && (!codec || !supportedVideo.has(codec as any))) lossless = false;
    if (track.type === 'audio' && (!codec || !supportedAudio.has(codec as any))) lossless = false;
  }
  if (audioCodec) {
    const sourceCodec = await audioTracks[0]?.getCodec();
    if (sourceCodec !== audioCodec) lossless = false;
  }
  try {
    await conversion.execute();
    if (!target.buffer) throw new Error('encoder completed without output bytes');
    return {
      bytes: new Uint8Array(target.buffer), mime: spec.mime, container: spec.container,
      durationBefore: duration, durationAfter: end - start, lossless,
    };
  } catch (error) {
    const codecs = await Promise.all([...videoTracks, ...audioTracks].map(track => track.getCodec()));
    throw new Error(`media trim: ${sourceKind(opts) || 'source'} with ${codecs.filter(Boolean).join(' + ') || 'unknown codec'} could not be converted (${String((error as Error)?.message || error)})`);
  } finally {
    input.dispose();
  }
}
