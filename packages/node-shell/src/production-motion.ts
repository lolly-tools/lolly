// SPDX-License-Identifier: MPL-2.0
/** Independent encoded readback. Every decoded frame contributes to timing coverage. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProductionFacts, ProductionMotionContract } from '@lolly/engine';
import { inspectMotionBytes } from './motion-inspect.ts';

const run = promisify(execFile);
const rate = (value: string): number => { const [a, b = '1'] = value.split('/'); return Number(a) / Number(b); };
type Stream = { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; duration?: string; pix_fmt?: string; color_transfer?: string; sample_aspect_ratio?: string; side_data_list?: { rotation?: number }[] };
export async function collectProductionMotion(bytes: Uint8Array, contract: ProductionMotionContract, signal?: AbortSignal, binaries = { probe: 'ffprobe', decode: 'ffmpeg' }): Promise<ProductionFacts> {
  signal?.throwIfAborted();
  const facts: ProductionFacts = { limitations: ['motion-appearance-between-samples-unmeasured', 'decoded-rgb8-not-hdr-or-cross-device-conformance', 'encoded-pixels-do-not-prove-text-or-chart-semantics'] };
  if (!bytes.length || bytes.length > 32 * 1024 * 1024) { facts.limitations.push('motion-byte-budget'); return facts; }
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  if (head.slice(4, 8) === 'ftyp' && /^(?:iso[m0-9]|mp4[12]|avc1|dash|M4V )/.test(head.slice(8, 12))) facts.format = 'mp4';
  else if ([0x1a, 0x45, 0xdf, 0xa3].every((byte, index) => bytes[index] === byte) && head.includes('webm')) facts.format = 'webm';
  if (!facts.format) { facts.readable = false; facts.limitations.push('unsupported-motion-container'); return facts; }
  const directory = await mkdtemp(join(tmpdir(), 'lolly-production-motion-')), path = join(directory, 'delivery');
  try {
    await writeFile(path, bytes);
    const { stdout } = await run(binaries.probe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', path], { signal, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as { streams?: Stream[]; format?: { duration?: string; format_name?: string } };
    const streams = parsed.streams ?? [], video = streams.filter(s => s.codec_type === 'video'), audio = streams.filter(s => s.codec_type === 'audio');
    if (video.length !== 1 || audio.length > 1 || streams.length !== video.length + audio.length) { facts.limitations.push('motion-stream-layout-unsupported'); return facts; }
    const v = video[0]!, fps = rate(v.avg_frame_rate ?? ''), seconds = Number(v.duration ?? parsed.format?.duration);
    const width = v.width, height = v.height;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || !width || !height || width * height > 4_000_000
      || !Number.isFinite(fps) || fps < 1 || fps > 120 || !Number.isFinite(seconds) || seconds <= 0 || seconds > 120 || width * height * Math.ceil(seconds * fps) > 1_000_000_000) {
      facts.limitations.push('motion-duration-frame-or-pixel-budget'); return facts;
    }
    if (!['yuv420p', 'yuv422p', 'yuv444p', 'yuvj420p', 'yuvj422p', 'yuvj444p', 'rgb24', 'rgba', 'gbrp'].includes(v.pix_fmt ?? '')
      || ['smpte2084', 'arib-std-b67'].includes(v.color_transfer ?? '') || v.side_data_list?.some(s => s.rotation)
      || v.sample_aspect_ratio && !['1:1', 'N/A'].includes(v.sample_aspect_ratio)) {
      facts.limitations.push('motion-colour-depth-rotation-or-aspect-unsupported'); return facts;
    }
    const names = (parsed.format?.format_name ?? '').split(',');
    if (facts.format === 'mp4' ? !names.includes('mp4') : !names.includes('webm')) { facts.readable = false; facts.limitations.push('motion-container-readback-mismatch'); return facts; }
    facts.width = width; facts.height = height;
    const versions = await Promise.all([binaries.probe, binaries.decode].map(binary => run(binary, ['-version'], { signal, timeout: 5_000, maxBuffer: 64 * 1024 })));
    const decoder = { probe: versions[0]!.stdout.split('\n')[0]!.slice(0, 256), decode: versions[1]!.stdout.split('\n')[0]!.slice(0, 256) };
    const review = await inspectMotionBytes(bytes, {}, binaries, { signal, timeoutMs: 60_000, strict: true });
    facts.records = { motionDecoder: decoder, motionReview: JSON.parse(JSON.stringify(review)) };
    const measured = (id: string): unknown => review.checks.find(c => c.id === id)?.measured;
    const times = contract.motion.comparison?.times ?? [];
    const sampleBudget = times.length * width * height <= 16_000_000;
    const indices = sampleBudget ? [...new Set(times.map(t => Math.round(t * contract.motion.fps)))] : [];
    if (!sampleBudget) facts.limitations.push('motion-sample-pixel-budget');
    const selection = indices.length ? `,select='${indices.map(n => `eq(n,${n})`).join('+')}'` : '';
    const args = ['-hide_banner', '-nostdin', '-xerror', '-err_detect', 'explode', '-protocol_whitelist', 'file,pipe', '-threads', '1', '-noautorotate', '-i', path,
      '-map', '0:v:0', '-filter_threads', '1', '-vf', `showinfo${selection}`, '-fps_mode', 'passthrough'];
    if (indices.length) args.push('-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1');
    else args.push('-f', 'null', '-');
    const decoded = await run(binaries.decode, args, { signal, timeout: 60_000, maxBuffer: Math.max(8 * 1024 * 1024, indices.length * width * height * 4 + 1), encoding: 'buffer' });
    const log = decoded.stderr.toString();
    const frames = [...log.matchAll(/\[Parsed_showinfo_[^\]]+\]\s+n:\s*(\d+)\s+pts:\s*[-\d]+\s+pts_time:([-\d.e+]+).*?\bs:(\d+)x(\d+)/g)].map(m => ({ index: Number(m[1]), time: Number(m[2]), width: Number(m[3]), height: Number(m[4]) }));
    if (!frames.length || frames.length > 14_400 || frames.length * width * height > 1_000_000_000 || frames.some((f, i) => f.index !== i || !Number.isFinite(f.time) || f.width !== width || f.height !== height || i > 0 && f.time <= frames[i - 1]!.time)) {
      facts.limitations.push('decoded-frame-ledger-unavailable-or-inconsistent'); return facts;
    }
    const first = frames[0]!.time, last = frames.at(-1)!.time;
    const decodedFps = frames.length > 1 ? (frames.length - 1) / (last - first) : fps;
    const temporalError = Math.max(...frames.map((f, i) => Math.abs(f.time - i / contract.motion.fps)));
    const audioAnalysis = !audio.length || !review.checks.some(c => c.id === 'decoded-analysis' && c.status === 'not-run');
    facts.readable = audioAnalysis ? true : undefined;
    facts.motion = { seconds: last + 1 / decodedFps, fps: decodedFps, frameCount: frames.length, timestampError: temporalError, audio: audio.length === 1 };
    const audioSeconds = measured('audio-seconds');
    if (typeof audioSeconds === 'number' && Number.isFinite(audioSeconds)) facts.motion.audioSeconds = audioSeconds;
    const audioTimestampError = measured('audio-timestamp-error');
    if (typeof audioTimestampError === 'number' && Number.isFinite(audioTimestampError)) facts.motion.audioTimestampError = audioTimestampError;
    for (const key of ['loudness', 'truePeak'] as const) {
      const value = measured(key); if (typeof value === 'number' || value === null) facts.motion[key] = value;
    }
    const frameBytes = width * height * 4;
    if (indices.length && decoded.stdout.length === indices.length * frameBytes) {
      facts.motion.samples = times.flatMap(time => {
        const index = Math.round(time * contract.motion.fps), position = indices.indexOf(index), frame = frames[index];
        return frame ? [{ time, timestamp: frame.time, pixels: { width, height, rgba: new Uint8Array(decoded.stdout.subarray(position * frameBytes, (position + 1) * frameBytes)) } }] : [];
      });
    }
    facts.records.motionCoverage = { decodedFrames: frames.length, firstTimestamp: first, lastTimestamp: last,
      appearanceSamples: facts.motion.samples?.map(s => ({ requested: s.time, measured: s.timestamp })) ?? [],
      appearanceBetweenSamples: 'unmeasured', audio: !audio.length ? 'no-track' : audioAnalysis ? 'full-decoded-track-analysis' : 'unmeasured' };
    return facts;
  } catch (error) {
    signal?.throwIfAborted();
    const e = error as { code?: string; killed?: boolean };
    const unavailable = e.code === 'ENOENT' || e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || e.killed;
    if (!unavailable) facts.readable = false;
    facts.limitations.push(unavailable ? 'motion-decoder-unavailable-or-budget' : 'motion-readback-failed');
    return facts;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
