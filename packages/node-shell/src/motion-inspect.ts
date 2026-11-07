// SPDX-License-Identifier: MPL-2.0
/** Optional ffprobe/ffmpeg inspection of delivered bytes, never the pre-encode mix. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { motionReport, type MotionCheck, type MotionFacts, type MotionTarget, type MotionReport } from '../../../engine/src/motion-report.ts';

const run = promisify(execFile);
const rate = (value: string): number | undefined => { const [n, d = '1'] = value.split('/'); const out = Number(n) / Number(d); return Number.isFinite(out) && out > 0 ? out : undefined; };
const measurement = (text: string, pattern: RegExp): number | null | undefined => {
  const raw = [...text.matchAll(pattern)].at(-1)?.[1];
  if (raw === undefined) return undefined;
  const n = Number(raw); return Number.isFinite(n) ? n : null;
};
/**
 * One `ashowinfo` frame line, found by its own fields and not by the `[Parsed_ashowinfo_0 @ …]`
 * prefix. ffmpeg runs the audio filters on their own thread, and the muxer thread writes
 * its "Output #0" summary in pieces while they run. A frame line logged between two of
 * those pieces is printed with no prefix, straight after whatever piece came before (even
 * `24 tbn`, hence no boundary before `n:`), so a pattern that needs the prefix misses that
 * frame and the whole duration reads as undetermined. Each frame's own fields are written
 * in one piece, so they stay together.
 *
 * Without the prefix, text the file carries could look like a frame line, so none is
 * read: the input summary (the file's title, chapters and stream tags) ends before
 * "Stream mapping:", and the decode copies no metadata or chapters into the output
 * summary (FRAME_LOG_ARGS). Frames must still arrive numbered 0, 1, 2…, or the duration
 * stays undetermined.
 */
const ASHOWINFO_FRAME = /n:\s*(\d+)\s+pts:\s*[-\d]+\s+pts_time:([-\d.e+]+).*?rate:(\d+)\s+nb_samples:(\d+)/g;
/** Output options that keep the file's own metadata and chapter titles out of the output summary. */
export const FRAME_LOG_ARGS = ['-map_metadata', '-1', '-map_chapters', '-1'] as const;
/** The part of an ffmpeg log after the input summary, where frame lines start. The whole log when there is no "Stream mapping:" line. */
export const afterInputSummary = (log: string): string => log.slice(Math.max(0, log.search(/^Stream mapping:/m)));

export async function inspectMotionBytes(bytes: Uint8Array, target: MotionTarget = {}, binaries = { probe: 'ffprobe', decode: 'ffmpeg' }, options: { signal?: AbortSignal; timeoutMs?: number; strict?: boolean } = {}): Promise<MotionReport> {
  options.signal?.throwIfAborted();
  if (!bytes.length || bytes.length > 256 * 1024 * 1024) throw new Error('Motion inspection accepts 1 byte to 256 MiB.');
  const directory = await mkdtemp(join(tmpdir(), 'lolly-motion-check-')), path = join(directory, 'delivery');
  const facts: MotionFacts = {}, checks: MotionCheck[] = [];
  try {
    await writeFile(path, bytes);
    let streams: { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; duration?: string }[];
    try {
      const { stdout } = await run(binaries.probe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', path], { signal: options.signal, timeout: Math.min(options.timeoutMs ?? 30_000, 30_000), maxBuffer: 2 * 1024 * 1024 });
      const parsed = JSON.parse(stdout); streams = parsed.streams ?? [];
      const video = streams.find(stream => stream.codec_type === 'video');
      facts.width = video?.width; facts.height = video?.height; facts.fps = rate(video?.avg_frame_rate ?? '0');
      const seconds = Number(parsed.format?.duration ?? video?.duration);
      if (Number.isFinite(seconds) && seconds > 0) facts.seconds = seconds;
      facts.audio = streams.some(stream => stream.codec_type === 'audio');
    } catch (error) {
      options.signal?.throwIfAborted();
      return motionReport(facts, target, [{ id: 'container', status: 'not-run', reason: `ffprobe unavailable or could not read this file: ${(error as Error).message}` }]);
    }
    if (!facts.seconds || facts.seconds > 3600) return motionReport(facts, target, [{ id: 'decoded-analysis', status: 'not-run', reason: 'Decoding requires a known duration of at most one hour.' }]);
    const args = ['-hide_banner', '-nostdin', '-nostats', ...(options.strict ? ['-xerror', '-err_detect', 'explode', '-abort_on', 'empty_output_stream'] : []), '-protocol_whitelist', 'file,pipe', '-i', path, ...FRAME_LOG_ARGS];
    if (facts.width) args.push('-vf', 'blackdetect=d=0.5:pix_th=0.03,freezedetect=n=-50dB:d=1');
    if (facts.audio) args.push('-af', `${options.strict ? 'ashowinfo,' : ''}ebur128=peak=true,silencedetect=n=-50dB:d=1`);
    args.push('-f', 'null', '-');
    try {
      const { stderr } = await run(binaries.decode, args, { signal: options.signal, timeout: options.timeoutMs ?? 300_000, maxBuffer: 16 * 1024 * 1024 });
      if (facts.audio) {
        facts.loudness = measurement(stderr, /Integrated loudness:\s+I:\s+([-\w.]+)/g);
        facts.truePeak = measurement(stderr, /True peak:\s+Peak:\s+([-\w.]+)/g);
      }
      if (options.strict && facts.audio) {
        const audioFrames = [...afterInputSummary(stderr).matchAll(ASHOWINFO_FRAME)];
        let seconds = 0, timestampError = 0;
        const consistent = audioFrames.length > 0 && audioFrames.every((frame, index) => {
          const time = Number(frame[2]), rate = Number(frame[3]), count = Number(frame[4]);
          if (Number(frame[1]) !== index || !Number.isFinite(time) || rate <= 0 || count <= 0) return false;
          timestampError = Math.max(timestampError, Math.abs(time - seconds));
          seconds += count / rate;
          return Number.isFinite(seconds);
        });
        if (consistent) checks.push(
          { id: 'audio-seconds', status: 'pass', measured: seconds, reason: 'Duration of all decoded audio samples in seconds.' },
          { id: 'audio-timestamp-error', status: 'pass', measured: timestampError, reason: 'Maximum decoded audio timestamp error against contiguous samples starting at zero.' },
        );
      }
      for (const [id, pattern] of [['black-spans', /black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g], ['frozen-spans', /freeze_start:\s*([\d.]+)/g], ['silent-spans', /silence_start:\s*([\d.]+)/g]] as const) {
        if ((id === 'silent-spans' && !facts.audio) || (id !== 'silent-spans' && !facts.width)) { checks.push({ id, status: 'not-run', reason: 'The corresponding media track is absent.' }); continue; }
        const spans = [...stderr.matchAll(pattern)].map(match => ({ from: Number(match[1]), ...(match[2] ? { to: Number(match[2]) } : {}) }));
        checks.push({ id, status: spans.length ? 'review' : 'pass', measured: spans, reason: 'Candidates for review; black, reading holds and silence may be intentional.' });
      }
    } catch (error) { options.signal?.throwIfAborted(); checks.push({ id: 'decoded-analysis', status: 'not-run', reason: `ffmpeg unavailable or decoding failed: ${(error as Error).message}` }); }
    return motionReport(facts, target, checks);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
