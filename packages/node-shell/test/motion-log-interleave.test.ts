// SPDX-License-Identifier: MPL-2.0
/**
 * ffmpeg logs its "Output #0" summary from the muxer thread, in pieces, while the filter
 * threads are already logging frames. A frame line written between two of those pieces
 * has no `[Parsed_… @ …]` prefix and sits in the middle of a summary line. The audio
 * duration and the list of decoded video frames are read from those lines, so one such
 * frame must not make either undetermined. ffmpeg and ffprobe are stand-ins here that
 * print a log with that splice, so the case runs without ffmpeg and on every run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProductionMotionContract } from '@lolly/engine';
import { inspectMotionBytes } from '../src/motion-inspect.ts';
import { collectProductionMotion } from '../src/production-motion.ts';

const RATE = 48_000;
const FIRST = 648;
const REST = 960;
const AUDIO_FRAMES = 101;
const AUDIO_SECONDS = (FIRST + (AUDIO_FRAMES - 1) * REST) / RATE;
const VIDEO_FRAMES = 48;

/**
 * The "Output #0" summary with `frame` logged into one of its cuts: straight after
 * `Stream #0:1`, or straight after `24 tbn`, where ffmpeg ends one piece and the newline
 * that follows is the next.
 */
function summaryWith(frame: string, cut: 'stream' | 'tbn'): string {
  return 'Output #0, null, to \'pipe:\':\n  Metadata:\n    encoder         : Lavf63.1.102\n'
    + `  Stream #0:0: Video: wrapped_avframe, yuv420p(tv, progressive), 160x120 [SAR 1:1 DAR 4:3], q=2-31, 200 kb/s, 24 fps, 24 tbn${cut === 'tbn' ? frame : ''}\n`
    + `  Stream #0:1${cut === 'stream' ? frame : ''}: Audio: pcm_s16le, 48000 Hz, stereo, s16, 1536 kb/s\n`;
}

/** The input summary, with the file's own title and audio language printed as the file gives them. */
const inputSummary = (title: string, language = 'eng'): string =>
  `Input #0, matroska,webm, from 'delivery':\n  Metadata:\n    title           : ${title}\n  Duration: 00:00:02.01, start: 0.000000, bitrate: 10 kb/s\n`
  + `  Stream #0:0: Video: vp9 (Profile 0), yuv420p(tv, progressive), 160x120, SAR 1:1 DAR 4:3, 24 fps, 24 tbr, 1k tbn\n`
  + `  Stream #0:1(${language}): Audio: opus, 48000 Hz, stereo, fltp\n`;

function audioLog(splicedAt: number, opts: { cut?: 'stream' | 'tbn'; title?: string; language?: string } = {}): string {
  let pts = 0;
  let out = `${inputSummary(opts.title ?? 'Two shots', opts.language)}Stream mapping:\n  Stream #0:0 -> #0:0 (vp9 (native) -> wrapped_avframe (native))\n  Stream #0:1 -> #0:1 (opus (native) -> pcm_s16le (native))\n`;
  for (let n = 0; n < AUDIO_FRAMES; n += 1) {
    const samples = n === 0 ? FIRST : REST;
    const fields = `n:${n} pts:${pts} pts_time:${Number((pts / RATE).toFixed(6))} fmt:fltp channels:2 chlayout:stereo rate:${RATE} nb_samples:${samples} checksum:00000000 `;
    out += n === splicedAt
      ? `${summaryWith(fields, opts.cut ?? 'stream')}[Parsed_ashowinfo_0 @ 0x7b89009680] plane_checksums: [ 00000000 00000000 ]\n`
      : `[Parsed_ashowinfo_0 @ 0x7b89009680] ${fields}plane_checksums: [ 00000000 00000000 ]\n`;
    pts += samples;
  }
  return `${out}[Parsed_ebur128_1 @ 0x7b890092c0] Summary:\n\n  Integrated loudness:\n    I:         -70.0 LUFS\n    Threshold:   0.0 LUFS\n\n  True peak:\n    Peak:       -inf dBFS\n`;
}

function videoLog(splicedAt: number): string {
  let out = '';
  for (let n = 0; n < VIDEO_FRAMES; n += 1) {
    const pts = Math.round((n * 1000) / 24);
    const fields = `n:${String(n).padStart(4)} pts:${String(pts).padStart(7)} pts_time:${String(pts / 1000).padEnd(7)} duration:     42 duration_time:0.042   fmt:yuv420p cl:left sar:1/1 s:160x120 i:P iskey:${n === 0 ? 1 : 0} type:${n === 0 ? 'I' : 'P'} `;
    out += n === splicedAt
      ? `${summaryWith(fields, 'tbn')}[Parsed_showinfo_0 @ 0x7b8900a000] checksum:00000000 plane_checksum:[00000000 00000000 00000000]\n`
      : `[Parsed_showinfo_0 @ 0x7b8900a000] ${fields}checksum:00000000 plane_checksum:[00000000 00000000 00000000]\n`;
  }
  return out;
}

const PROBE = {
  streams: [
    { codec_type: 'video', width: 160, height: 120, avg_frame_rate: '24/1', duration: '2.000000', pix_fmt: 'yuv420p', sample_aspect_ratio: '1:1' },
    { codec_type: 'audio', duration: String(AUDIO_SECONDS) },
  ],
  format: { duration: '2.013500', format_name: 'matroska,webm' },
};

/** Stand-in ffprobe and ffmpeg: the probe prints PROBE; the decoder prints the log its arguments ask for. */
async function standIns(t: { after(fn: () => Promise<void>): void }, splicedAt: number, audio: { cut?: 'stream' | 'tbn'; title?: string; language?: string } = {}): Promise<{ probe: string; decode: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-motion-log-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'probe.json'), JSON.stringify(PROBE));
  await writeFile(join(directory, 'audio.log'), audioLog(splicedAt, audio));
  await writeFile(join(directory, 'video.log'), videoLog(splicedAt));
  const head = '#!/usr/bin/env node\nconst { readFileSync } = require(\'node:fs\');\nconst { join } = require(\'node:path\');\nconst args = process.argv.slice(2);\n';
  const probe = join(directory, 'ffprobe');
  await writeFile(probe, `${head}if (args.includes('-version')) process.stdout.write('ffprobe version stand-in\\n');\nelse process.stdout.write(readFileSync(join(__dirname, 'probe.json'), 'utf8'));\n`);
  const decode = join(directory, 'ffmpeg');
  await writeFile(decode, `${head}if (args.includes('-version')) process.stdout.write('ffmpeg version stand-in\\n');\nelse process.stderr.write(readFileSync(join(__dirname, String(args[args.indexOf('-vf') + 1]).startsWith('showinfo') ? 'video.log' : 'audio.log'), 'utf8'));\n`);
  await Promise.all([chmod(probe, 0o755), chmod(decode, 0o755)]);
  return { probe, decode };
}

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...new TextEncoder().encode('webm stand-in')]);

test('a frame logged into the middle of the output summary still counts towards the audio duration', async (t) => {
  for (const cut of ['stream', 'tbn'] as const) {
    const binaries = await standIns(t, 6, { cut });
    const report = await inspectMotionBytes(WEBM, {}, binaries, { strict: true });
    const seconds = report.checks.find((check) => check.id === 'audio-seconds');
    assert.equal(seconds?.status, 'pass', `${cut}: ${JSON.stringify(report.checks)}`);
    assert.ok(Math.abs(Number(seconds?.measured) - AUDIO_SECONDS) < 1e-9, String(seconds?.measured));
    const error = report.checks.find((check) => check.id === 'audio-timestamp-error');
    assert.ok(Number(error?.measured) < 1e-5, String(error?.measured));
  }
});

test('text the file carries is never read as a frame line or a span', async (t) => {
  const forged = `n:0 pts:0 pts_time:0 fmt:fltp channels:2 chlayout:stereo rate:${RATE} nb_samples:${RATE * 60} checksum:00000000`;
  const spans = 'black_start:0 black_end:1 black_duration:1 freeze_start: 0 silence_start: 0';
  // A title, and a stream language that carries its own "Stream mapping:" line.
  for (const audio of [{ title: `${forged} ${spans}` }, { language: `eng\nStream mapping:\n${forged}\n${spans}` }]) {
    const binaries = await standIns(t, 6, audio);
    const report = await inspectMotionBytes(WEBM, {}, binaries, { strict: true });
    const seconds = report.checks.find((check) => check.id === 'audio-seconds');
    assert.equal(seconds?.status, 'pass', JSON.stringify(report.checks));
    assert.ok(Math.abs(Number(seconds?.measured) - AUDIO_SECONDS) < 1e-9, String(seconds?.measured));
    for (const id of ['black-spans', 'frozen-spans', 'silent-spans']) {
      assert.deepEqual(report.checks.find((check) => check.id === id)?.measured, [], `${id}: ${JSON.stringify(audio)}`);
    }
  }
});

test('a frame missing from the log still leaves the audio duration undetermined', async (t) => {
  const binaries = await standIns(t, 6);
  const dropped = audioLog(-1).split('\n').filter((line) => !/\bn:7 pts:/.test(line)).join('\n');
  await writeFile(join(binaries.decode, '..', 'audio.log'), dropped);
  const report = await inspectMotionBytes(WEBM, {}, binaries, { strict: true });
  assert.equal(report.checks.find((check) => check.id === 'audio-seconds'), undefined, 'a gap in the frame numbers is never measured as a duration');
});

test('a video frame logged into the output summary still counts in the decoded frame list', async (t) => {
  const binaries = await standIns(t, 3);
  const contract: ProductionMotionContract = {
    profile: 'lolly/production-motion-v1', id: 'interleaved', revision: '1', format: 'webm', width: 160, height: 120, requirements: [],
    motion: { seconds: 2, secondsTolerance: 0.05, fps: 24, fpsTolerance: 0.02, frameCount: VIDEO_FRAMES, timestampTolerance: 0.01, audio: true, audioSecondsTolerance: 0.05 },
  };
  const facts = await collectProductionMotion(WEBM, contract, undefined, binaries);
  assert.ok(!facts.limitations.includes('decoded-frame-ledger-unavailable-or-inconsistent'), facts.limitations.join(', '));
  assert.equal(facts.motion?.frameCount, VIDEO_FRAMES);
  assert.ok(Math.abs(Number(facts.motion?.audioSeconds) - AUDIO_SECONDS) < 1e-9, String(facts.motion?.audioSeconds));
});
