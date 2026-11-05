// SPDX-License-Identifier: MPL-2.0
/**
 * Records ffmpeg's `ebur128` readings for the audio DSP test programmes into
 * tests/fixtures/audio-dsp/ebur128-reference.json. ffmpeg is an external oracle used
 * here only: ordinary test runs read the stored numbers and need no ffmpeg.
 *
 * Run with: node scripts/audio-dsp-oracle.ts   (needs ffmpeg on PATH)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { programmes } from '../tests/fixtures/audio-dsp/signals.ts';

function wavFloat32(channels: Float32Array[], rate: number): Buffer {
  const frames = channels[0]!.length, n = channels.length;
  const data = Buffer.alloc(frames * n * 4);
  for (let i = 0; i < frames; i++) for (let c = 0; c < n; c++) data.writeFloatLE(channels[c]![i]!, (i * n + c) * 4);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(3, 20); head.writeUInt16LE(n, 22); head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * n * 4, 28); head.writeUInt16LE(n * 4, 32); head.writeUInt16LE(32, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

interface Frame { m: number; s: number; i: number; lra: number; tp: number }
function ebur128(path: string): Frame[] {
  const out = execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-i', path, '-af', 'ebur128=peak=true:metadata=1,ametadata=mode=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const frames: Frame[] = [];
  let cur: Frame | undefined;
  for (const line of out.split('\n')) {
    if (line.startsWith('frame:')) { if (cur) frames.push(cur); cur = { m: NaN, s: NaN, i: NaN, lra: NaN, tp: NaN }; continue; }
    const m = /^lavfi\.r128\.(\w+)=(.+)$/.exec(line);
    if (!cur || !m) continue;
    const v = Number(m[2]);
    if (m[1] === 'M') cur.m = v; else if (m[1] === 'S') cur.s = v; else if (m[1] === 'I') cur.i = v; else if (m[1] === 'LRA') cur.lra = v; else if (m[1] === 'true_peak') cur.tp = v;
  }
  if (cur) frames.push(cur);
  return frames;
}

const dir = mkdtempSync(join(tmpdir(), 'audio-dsp-oracle-'));
const version = execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0];
const result: Record<string, unknown> = {};
try {
  for (const p of programmes()) {
    const file = join(dir, `${p.name}.wav`);
    writeFileSync(file, wavFloat32(p.channels, p.rate));
    const frames = ebur128(file);
    const last = frames[frames.length - 1]!;
    // Momentary and short-term every 5 s once the windows are full; ffmpeg frame k covers (k+1) * 100 ms.
    const samples: { at: number; m: number | null; s: number | null }[] = [];
    for (let at = 5; at * 10 <= frames.length; at += 5) {
      const f = frames[at * 10 - 1]!;
      samples.push({ at, m: f.m > -70 ? f.m : null, s: f.s > -70 ? f.s : null });
    }
    result[p.name] = { rate: p.rate, channels: p.channels.length, integrated: last.i, loudnessRange: last.lra, truePeakDb: 20 * Math.log10(last.tp), samples };
    console.log(p.name, last.i, last.lra, 20 * Math.log10(last.tp));
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
const target = new URL('../tests/fixtures/audio-dsp/ebur128-reference.json', import.meta.url);
writeFileSync(target, JSON.stringify({ oracle: version, filter: 'ebur128=peak=true', programmes: result }, null, 2) + '\n');
