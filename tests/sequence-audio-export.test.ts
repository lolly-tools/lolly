// SPDX-License-Identifier: MPL-2.0
/**
 * Sequence Studio — the audio-only export (wav / mp3 / m4a / opus).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * An audio export of a sequence is the SOUNDTRACK OF THE VIDEO EXPORT in a file with
 * no picture: the music bed plus every unmuted clip track, ducked the same way. So
 * the thing worth proving is not "wav bytes came out" (that is lib/audio-encode.ts's
 * suite) but that this path is the SAME mix the mp4/webm path muxes — same mixer,
 * same layers, same length, same answer when there is nothing to mix. Two mixers
 * would drift and the exported audio would stop matching the exported video.
 *
 * `mixSequenceAudio` is browser-only in the sense that it needs an
 * OfflineAudioContext, not in the sense that it needs pixels — so the graph is
 * driven here against a recording stand-in for that one Web Audio API. What that
 * stand-in cannot judge is the SOUND (the real ramps, the real resampling); that
 * stays with the Playwright tier in tests/sequence-render.browser.test.ts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { frameTimestamps } from '../shells/web/src/bridge/sequence-plan.ts';
import { sequenceAudioPcm, MIX_RATE, MIX_CHANNELS } from '../shells/web/src/bridge/sequence-render.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── the stage under test ────────────────────────────────────────────────────
//
// Hand-authored rather than run through the engine: parseSequenceStage reads the
// DOM and nothing else, and an audio box needs a resolved asset the runtime would
// have to be given anyway. tests/sequence-export-duration.test.ts drives the real
// hook; this file drives the mix.

const box = (attrs: string, inner = ''): string =>
  `<div class="lolly-box" data-t-lane="seq" ${attrs} style="left:0;top:0;width:1920px;height:1080px">${inner}</div>`;

const textBox = (startMs: number, durMs: number): string =>
  box(`data-t-start="${startMs}" data-t-dur="${durMs}"`, 'hello');

const audioBox = (startMs: number, durMs: number, opts: { mute?: boolean } = {}): string =>
  box(
    `data-t-start="${startMs}" data-t-dur="${durMs}"${opts.mute ? ' data-t-mute="1"' : ''}`,
    '<div class="lolly-box-audio" data-audio-src="blob:clip-track" aria-hidden="true"></div>',
  );

const stageOf = (totalMs: number, boxes: string[]): HTMLElement => {
  const dom = new JSDOM(
    `<!doctype html><body><div id="stage"><div data-sequence data-seq-ms="${totalMs}"` +
    ` style="width:1920px;height:1080px">${boxes.join('')}</div></div></body>`,
  );
  return dom.window.document.getElementById('stage') as unknown as HTMLElement;
};

// ── the OfflineAudioContext stand-in ────────────────────────────────────────

interface FakeBuffer {
  numberOfChannels: number; length: number; sampleRate: number; duration: number;
  getChannelData(i: number): Float32Array;
  copyToChannel(src: Float32Array, i: number): void;
}

const fakeBuffer = (channels: number, frames: number, rate: number): FakeBuffer => {
  const planes = Array.from({ length: channels }, () => new Float32Array(frames));
  return {
    numberOfChannels: channels, length: frames, sampleRate: rate, duration: frames / rate,
    getChannelData: (i) => planes[i]!,
    copyToChannel: (src, i) => { planes[i]!.set(src.subarray(0, frames)); },
  };
};

class FakeNode { connect(dest: FakeNode): FakeNode { return dest; } }
class FakeParam {
  events: Array<{ v: number; t: number; ramp: boolean }> = [];
  setValueAtTime(v: number, t: number): void { this.events.push({ v, t, ramp: false }); }
  linearRampToValueAtTime(v: number, t: number): void { this.events.push({ v, t, ramp: true }); }
}
class FakeGain extends FakeNode { gain = new FakeParam(); }
class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false; loopStart = 0; loopEnd = 0;
  starts: number[][] = [];
  start(...a: number[]): void { this.starts.push(a); }
}

/** How long the stubbed music bed is. Deliberately SHORTER than every stage below,
 *  so the loop flag the video path relies on is observable. */
const BED_SEC = 2;

class FakeOfflineAudioContext {
  static last: FakeOfflineAudioContext | null = null;
  destination = new FakeNode();
  currentTime = 0;
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  renders = 0;
  decodes = 0;
  channels: number;
  length: number;
  sampleRate: number;
  constructor(channels: number, length: number, sampleRate: number) {
    this.channels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    FakeOfflineAudioContext.last = this;
  }
  createBuffer(ch: number, frames: number, rate: number): FakeBuffer { return fakeBuffer(ch, frames, rate); }
  createBufferSource(): FakeSource { const s = new FakeSource(); this.sources.push(s); return s; }
  createGain(): FakeGain { const g = new FakeGain(); this.gains.push(g); return g; }
  async decodeAudioData(_bytes: ArrayBuffer): Promise<FakeBuffer> {
    this.decodes++;
    return fakeBuffer(2, Math.round(BED_SEC * this.sampleRate), this.sampleRate);
  }
  async startRendering(): Promise<FakeBuffer> {
    this.renders++;
    return fakeBuffer(this.channels, this.length, this.sampleRate);
  }
}

const warns: string[] = [];
const host = { log: (level: string, msg: string) => { if (level === 'warn') warns.push(msg); } };

const g = globalThis as Record<string, unknown>;
g.OfflineAudioContext = FakeOfflineAudioContext;
g.fetch = async (): Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }> => ({
  arrayBuffer: async () => new ArrayBuffer(2048),
});

const reset = (): void => { warns.length = 0; FakeOfflineAudioContext.last = null; };

const BED = { url: 'blob:bed', fadeIn: 1, fadeOut: 1.5, volume: 1 };

// ── 1. nothing to export is a refusal, never a file of silence ──────────────

test('a sequence with no audio at all mixes to nothing', async () => {
  // The video path exports this composition as SILENT video (mix.buffer === null and
  // the muxer gets no audio track), which is correct: the picture is still the
  // deliverable. Audio-only has no such fallback, so `null` is the answer the caller
  // turns into a refusal — a wav of pure silence reads as a broken export.
  reset();
  const pcm = await sequenceAudioPcm(stageOf(4000, [textBox(0, 4000)]), {}, host);
  assert.equal(pcm, null, 'no bed and no clip track means no audio');
  assert.equal(FakeOfflineAudioContext.last?.renders, 0,
    'and the graph is never rendered, so an empty mix costs nothing');
});

test('a sequence whose only audio is a MUTED clip mixes to nothing', async () => {
  // Same rule one step in: the clip exists, carries sound, and the user silenced it.
  // Muting is not "export it quietly".
  reset();
  const pcm = await sequenceAudioPcm(stageOf(4000, [audioBox(0, 4000, { mute: true })]), {}, host);
  assert.equal(pcm, null, 'a muted track contributes nothing to mix');
  assert.equal(FakeOfflineAudioContext.last?.decodes, 0, 'and is never even decoded');
  assert.deepEqual(warns, [], 'muting is a deliberate choice, not a problem to report');
});

// ── 2. the bed, exactly as the video path takes it ──────────────────────────

test('a music bed alone is a real mix, at the sequence length and the mix rate', async () => {
  reset();
  const totalMs = 6000;
  const pcm = await sequenceAudioPcm(stageOf(totalMs, [textBox(0, totalMs)]), { audio: BED }, host);
  assert.ok(pcm, 'a bed is audio');
  assert.equal(pcm!.sampleRate, MIX_RATE, 'everything mixes at the rate both AAC and Opus want');
  assert.equal(pcm!.channels.length, MIX_CHANNELS, 'stereo out');

  // The length is the one the mp4 path would use: the frame grid at the export fps,
  // not a second reading of data-seq-ms.
  const fps = 30;
  const expected = Math.ceil((frameTimestamps(totalMs, fps).length / fps) * MIX_RATE);
  assert.equal(pcm!.channels[0]!.length, expected, 'as many frames as the video would have sound for');
  assert.equal(FakeOfflineAudioContext.last?.renders, 1, 'one graph, rendered once');
});

test('a bed shorter than the timeline loops, exactly as the video export loops it', async () => {
  // connectBed sets src.loop for every bed, so a 2s track under a 6s sequence plays
  // through three times rather than leaving 4s of silence. This is the ONE property
  // that makes an audio-only export sound like the video it came from.
  reset();
  const pcm = await sequenceAudioPcm(stageOf(6000, [textBox(0, 6000)]), { audio: BED }, host);
  assert.ok(pcm);
  const bed = FakeOfflineAudioContext.last!.sources.at(-1)!;
  assert.equal(bed.loop, true, 'the bed loops');
  assert.ok(bed.buffer!.duration < 6, 'test is meaningful: the stubbed bed really is shorter');
  // And it is enveloped rather than played flat — the fades the export bar asked for.
  assert.ok(FakeOfflineAudioContext.last!.gains.at(-1)!.gain.events.length > 1,
    'the bed rides the shared gain envelope');
});

test('an unreachable bed warns and mixes to nothing, rather than failing the export', async () => {
  // A missing bed is "export without it", not a thrown export. The mixer reports
  // whether a bed actually CONNECTED rather than whether one was asked for, so with
  // no clip audio either there is nothing left and the audio-only caller refuses —
  // with the reason in the log. Before that distinction existed the graph was still
  // rendered and handed back a buffer of pure silence, which is precisely the file
  // this format must never produce. The video path is better off too: it now muxes
  // no audio track at all instead of a silent one.
  reset();
  const boom = g.fetch;
  g.fetch = async () => { throw new Error('offline'); };
  try {
    const pcm = await sequenceAudioPcm(stageOf(4000, [textBox(0, 4000)]), { audio: BED }, host);
    assert.equal(pcm, null);
    assert.equal(warns.length, 1, 'the loss is named once');
    assert.match(warns[0]!, /Music bed unavailable/);
  } finally {
    g.fetch = boom;
  }
});

// ── 3. length + duration override agree with the video path ─────────────────

test('a user-set export duration moves the audio the same way it moves the video', async () => {
  reset();
  const node = stageOf(10_000, [textBox(0, 10_000)]);
  const pcm = await sequenceAudioPcm(node, { audio: BED, duration: 3, durationUserSet: true }, host);
  assert.ok(pcm);
  const fps = 30;
  assert.equal(pcm!.channels[0]!.length, Math.ceil((frameTimestamps(3000, fps).length / fps) * MIX_RATE),
    'the override is applied through the same applyDurationOverride the compositor uses');
});

test('a non-default fps still yields the same audio length as that fps video', async () => {
  reset();
  const totalMs = 5000;
  const pcm = await sequenceAudioPcm(stageOf(totalMs, [textBox(0, totalMs)]), { audio: BED, fps: 24 }, host);
  assert.ok(pcm);
  assert.equal(pcm!.channels[0]!.length, Math.ceil((frameTimestamps(totalMs, 24).length / 24) * MIX_RATE));
});

test('a stage that is not a sequence, or is past the ceiling, is refused by code', async () => {
  reset();
  const plain = new JSDOM('<!doctype html><body><div id="stage"><p>not a timeline</p></div></body>')
    .window.document.getElementById('stage') as unknown as HTMLElement;
  await assert.rejects(() => sequenceAudioPcm(plain, {}, host), /not a timed sequence stage/);
  await assert.rejects(
    () => sequenceAudioPcm(stageOf(20 * 60_000, [textBox(0, 1000)]), {}, host),
    /export ceiling/,
    'the same SEQ_TOO_HEAVY ceiling the compositor enforces',
  );
});

// ── 4. one mixer, structurally ──────────────────────────────────────────────

test('the audio-only path and the video path share ONE mixer', async () => {
  // The assertion that actually protects the feature. Everything above proves the
  // audio path behaves; this proves it cannot quietly grow a second implementation
  // that behaves differently from the soundtrack of the mp4.
  const src = (await readFile(join(ROOT, 'shells', 'web', 'src', 'bridge', 'sequence-render.ts'), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.equal((src.match(/async function mixSequenceAudio\(/g) ?? []).length, 1,
    'exactly one mixer is declared');
  const calls = src.match(/mixSequenceAudio\(stage\.layers,/g) ?? [];
  assert.equal(calls.length, 2, 'both the compositor and the audio-only export call it, with the same layers');
  assert.match(src, /export async function sequenceAudioPcm\(/, 'and the audio-only entry point is exported');
  // Both derive their length from the frame grid rather than from totalMs directly.
  assert.equal((src.match(/frameTimestamps\(stage\.totalMs, fps\)/g) ?? []).length, 2,
    'one length derivation, used by both');
});

test('Design offers the four audio formats, after the motion group', async () => {
  // Migrated from Sequence Studio (retired into Design, plans/104): the audio-export
  // formats now live on Design's manifest. Design is design-first (formats[0] is a
  // still, not mp4), so the old motion-first ordering no longer applies — only that
  // the audio set sits after the motion group.
  const manifest = JSON.parse(
    await readFile(join(ROOT, 'brands', 'lolly-start', 'tools', 'design', 'tool.json'), 'utf8'),
  ) as { render: { formats: string[] } };
  const f = manifest.render.formats;
  for (const m of ['mp4', 'webm', 'gif', 'apng']) assert.ok(f.includes(m), `${m} (motion) is offered`);
  for (const a of ['wav', 'mp3', 'm4a', 'opus']) {
    assert.ok(f.includes(a), `${a} is offered`);
    assert.ok(f.indexOf(a) > f.indexOf('apng'), `${a} sits after the motion group`);
  }
});
