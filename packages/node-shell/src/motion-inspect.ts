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
export async function inspectMotionBytes(bytes: Uint8Array, target: MotionTarget = {}, binaries = { probe: 'ffprobe', decode: 'ffmpeg' }): Promise<MotionReport> {
  if (!bytes.length || bytes.length > 256 * 1024 * 1024) throw new Error('Motion inspection accepts 1 byte to 256 MiB.');
  const directory = await mkdtemp(join(tmpdir(), 'lolly-motion-check-')), path = join(directory, 'delivery');
  const facts: MotionFacts = {}, checks: MotionCheck[] = [];
  try {
    await writeFile(path, bytes);
    let streams: { codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; duration?: string }[];
    try {
      const { stdout } = await run(binaries.probe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', path], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
      const parsed = JSON.parse(stdout); streams = parsed.streams ?? [];
      const video = streams.find(stream => stream.codec_type === 'video');
      facts.width = video?.width; facts.height = video?.height; facts.fps = rate(video?.avg_frame_rate ?? '0');
      const seconds = Number(parsed.format?.duration ?? video?.duration);
      if (Number.isFinite(seconds) && seconds > 0) facts.seconds = seconds;
      facts.audio = streams.some(stream => stream.codec_type === 'audio');
    } catch (error) {
      return motionReport(facts, target, [{ id: 'container', status: 'not-run', reason: `ffprobe unavailable or could not read this file: ${(error as Error).message}` }]);
    }
    if (!facts.seconds || facts.seconds > 3600) return motionReport(facts, target, [{ id: 'decoded-analysis', status: 'not-run', reason: 'Decoding requires a known duration of at most one hour.' }]);
    const args = ['-hide_banner', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', path];
    if (facts.width) args.push('-vf', 'blackdetect=d=0.5:pix_th=0.03,freezedetect=n=-50dB:d=1');
    if (facts.audio) args.push('-af', 'ebur128=peak=true,silencedetect=n=-50dB:d=1');
    args.push('-f', 'null', '-');
    try {
      const { stderr } = await run(binaries.decode, args, { timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
      if (facts.audio) {
        facts.loudness = measurement(stderr, /Integrated loudness:\s+I:\s+([-\w.]+)/g);
        facts.truePeak = measurement(stderr, /True peak:\s+Peak:\s+([-\w.]+)/g);
      }
      for (const [id, pattern] of [['black-spans', /black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g], ['frozen-spans', /freeze_start:\s*([\d.]+)/g], ['silent-spans', /silence_start:\s*([\d.]+)/g]] as const) {
        if ((id === 'silent-spans' && !facts.audio) || (id !== 'silent-spans' && !facts.width)) { checks.push({ id, status: 'not-run', reason: 'The corresponding media track is absent.' }); continue; }
        const spans = [...stderr.matchAll(pattern)].map(match => ({ from: Number(match[1]), ...(match[2] ? { to: Number(match[2]) } : {}) }));
        checks.push({ id, status: spans.length ? 'review' : 'pass', measured: spans, reason: 'Candidates for review; black, reading holds and silence may be intentional.' });
      }
    } catch (error) { checks.push({ id: 'decoded-analysis', status: 'not-run', reason: `ffmpeg unavailable or decoding failed: ${(error as Error).message}` }); }
    return motionReport(facts, target, checks);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
