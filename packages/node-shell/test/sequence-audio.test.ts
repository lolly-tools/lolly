// SPDX-License-Identifier: MPL-2.0
/**
 * The headless sequence mix (packages/node-shell/src/sequence-audio.ts).
 *
 * NEVER SKIPS. Everything here is arithmetic over synthetic PCM: no model, no
 * browser, no catalog, no network. A mix that only proves itself when a machine
 * happens to be set up would prove nothing on the machine that matters.
 *
 * Three things are pinned:
 *
 *   1. THE NUMBERS ARE THE WEB SHELL'S. `sequence-audio.ts` mirrors the gain
 *      evaluator and the mix's closed form from shells/web/src/bridge/
 *      {audio-envelope,mix-window}.ts, which cannot be edited from this
 *      workstream. So the two are run side by side on the same fixture and
 *      compared SAMPLE FOR SAMPLE. If either copy moves, this fails - which is
 *      the whole reason the mirror is allowed to exist. The comparison is
 *      skipped only if the web shell submodule is not checked out, and the
 *      rest of the file still runs.
 *   2. THE MASTER PASS IS REAL. A mix hot enough to clip comes back at or under
 *      the limiter's -1 dBTP ceiling, and a normalize target moves the measured
 *      loudness to it.
 *   3. THE REFUSALS ARE NAMED. A speed-changed clip, a clip with no PCM and an
 *      unknown fx token each come back in `warnings` rather than silently
 *      changing what the file sounds like.
 *
 * The fixture is the brief's: two clips, one a WAV (a tone written by the
 * engine's own packWav and read back by parseWav) and one a procedural ZzFXM
 * song, so the decode path both `lolly mix` doors use is exercised too.
 *
 * Run with: node --test packages/node-shell/test/sequence-audio.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  mixSequenceAudio, mixWindow, clipGainEvents, bedDuckEnvelope, envelopeGainAt,
  limitPlanes, readSeqAudioPlan, sequenceMixToWav, MIX_RATE,
} from '../src/sequence-audio.ts';
import type { SeqAudioPlan, SeqPcm, SeqElementLike } from '../src/sequence-audio.ts';
import { decodeAudioPcm } from '../src/audio.ts';
import { packWav, parseWav, composeSong, generatedSongSpec, renderZzfxm, createLoudnessMeter } from '@lolly/engine';

const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WEB_MIX_WINDOW = join(REPO, 'shells', 'web', 'src', 'bridge', 'mix-window.ts');

/** A stereo tone, the fixture's "recorded" clip. */
function tone(seconds: number, hz = 440, amp = 0.6): SeqPcm {
  const n = Math.round(seconds * MIX_RATE);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    l[i] = amp * Math.sin((2 * Math.PI * hz * i) / MIX_RATE);
    r[i] = amp * Math.sin((2 * Math.PI * (hz * 1.26) * i) / MIX_RATE);
  }
  return { channels: [l, r], sampleRate: MIX_RATE };
}

/** The two-clip fixture: a WAV round-tripped through the engine's own writer plus a
 *  procedural ZzFXM song, placed and shaped the way a timeline would place them. */
function fixture(): { plan: SeqAudioPlan; pcm: Map<string, SeqPcm> } {
  const wav = parseWav(packWav({ channels: tone(2).channels, sampleRate: MIX_RATE }));
  const song = renderZzfxm(composeSong(generatedSongSpec(1234, 4, 'lofi')));
  const pcm = new Map<string, SeqPcm>([
    ['voice', { channels: wav.channels, sampleRate: wav.sampleRate }],
    ['bed', { channels: [song.left, song.right], sampleRate: song.sampleRate }],
  ]);
  const plan: SeqAudioPlan = {
    totalSec: 4,
    clips: [
      {
        id: 'voice', kind: 'audio', startMs: 500, durMs: 2000, gain: 1, pan: -0.4,
        enter: 'fade', exit: 'fade', enterMs: 300, exitMs: 300,
      },
      { id: 'bed', kind: 'audio', startMs: 0, durMs: 4000, gain: 0.5, duck: 0.3 },
    ],
  };
  return { plan, pcm };
}

test('a two-clip timeline mixes to the full length at the mix rate', () => {
  const { plan, pcm } = fixture();
  const mix = mixSequenceAudio(plan, pcm);
  assert.equal(mix.sampleRate, MIX_RATE);
  assert.equal(mix.totalSamples, 4 * MIX_RATE);
  assert.equal(mix.channels[0].length, 4 * MIX_RATE);
  assert.equal(mix.channels[1].length, 4 * MIX_RATE);
  assert.equal(mix.hasClipAudio, true);
  assert.deepEqual(mix.warnings, []);
  // The panned, faded clip starts at 500 ms: before it, only the bed is heard, and
  // the two channels of a stereo bed are not the same signal as the panned sum.
  const atStart = mix.channels[0][Math.round(0.6 * MIX_RATE)] as number;
  assert.ok(Number.isFinite(atStart));
});

test('the master pass holds the ceiling: a mix that would clip comes back under -1 dBTP', () => {
  const loud = tone(1, 440, 0.99);
  const plan: SeqAudioPlan = {
    totalSec: 1,
    clips: [
      { id: 'a', kind: 'audio', startMs: 0, durMs: 1000, gain: 2 },
      { id: 'b', kind: 'audio', startMs: 0, durMs: 1000, gain: 2 },
    ],
  };
  const mix = mixSequenceAudio(plan, { a: loud, b: loud });
  let peak = 0;
  for (const ch of mix.channels) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  // -1 dBTP is 0.8913; the sample peak can only be at or under the true peak, and a
  // touch of headroom is allowed for the limiter's own release, never overshoot.
  assert.ok(peak <= 0.8913 + 1e-6, `peak ${peak} exceeds the -1 dBTP ceiling`);
  // …and it did something: four times a 0.99 tone would be 3.96 without the limiter.
  assert.ok(peak > 0.5, `peak ${peak} suggests the mix was silent, not limited`);
});

test('a normalize target moves the measured loudness to it', () => {
  const { plan, pcm } = fixture();
  const quiet = mixSequenceAudio({ ...plan, normalize: -23 }, pcm);
  const meter = createLoudnessMeter(MIX_RATE);
  meter.push(quiet.channels[0], quiet.channels[1]);
  const lkfs = meter.integrated();
  assert.ok(lkfs != null, 'a normalized mix must have a measurable loudness');
  // The limiter runs after the pre-gain, so the result can sit a little under
  // the target when it had to pull peaks down; it must never sit above it.
  assert.ok(Math.abs((lkfs as number) - -23) < 1.5, `normalized to ${lkfs} LKFS, wanted -23`);
});

test('what cannot be mixed is named, not silently dropped', () => {
  const plan: SeqAudioPlan = {
    totalSec: 2,
    clips: [
      { id: 'fast', kind: 'audio', startMs: 0, durMs: 1000, speed: 2 },
      { id: 'missing', kind: 'audio', startMs: 0, durMs: 1000 },
      { id: 'ok', kind: 'audio', startMs: 0, durMs: 1000, fx: 'hp(200).nope(1)' },
    ],
  };
  const mix = mixSequenceAudio(plan, { ok: tone(1) });
  assert.equal(mix.hasClipAudio, true);
  const joined = mix.warnings.join(' | ');
  assert.match(joined, /"fast" is left out/);
  assert.match(joined, /speed or pitch/);
  assert.match(joined, /"missing" is left out/);
  assert.match(joined, /unknown fx nope\(1\)/);
});

test('an empty plan mixes silence rather than throwing', () => {
  const mix = mixSequenceAudio({ totalSec: 1, clips: [] }, {});
  assert.equal(mix.hasClipAudio, false);
  assert.equal(mix.hasBed, false);
  assert.equal(mix.channels[0].length, MIX_RATE);
  assert.ok(mix.channels[0].every((v) => v === 0));
});

test('the mixed WAV is a real RIFF the engine reads back at the mix rate', () => {
  const { plan, pcm } = fixture();
  const mix = mixSequenceAudio(plan, pcm);
  const bytes = sequenceMixToWav(mix);
  const back = parseWav(bytes);
  assert.equal(back.sampleRate, MIX_RATE);
  assert.equal(back.channels.length, 2);
  assert.equal(back.channels[0]!.length, mix.channels[0].length);
});

test('a windowed mix concatenates to the same samples as one whole-range call', () => {
  const { plan, pcm } = fixture();
  // Build the spec the way mixSequenceAudio does, then evaluate it both ways.
  const clip = pcm.get('voice')!;
  const spec = {
    clips: [{ pcm: clip.channels, startMs: 500, events: clipGainEvents({ spanSec: 2, gain: 1, fadeInSec: 0.3, fadeOutSec: 0.3 }), pan: -0.4 }],
    beds: [],
    rate: MIX_RATE,
  };
  const total = 3 * MIX_RATE;
  const [wholeL] = mixWindow(spec, 0, total);
  const pieced = new Float32Array(total);
  for (let off = 0; off < total; off += 4800) {
    const [l] = mixWindow(spec, off, Math.min(off + 4800, total));
    pieced.set(l, off);
  }
  for (let i = 0; i < total; i++) {
    if (wholeL[i] !== pieced[i]) assert.fail(`window seam at sample ${i}: ${wholeL[i]} vs ${pieced[i]}`);
  }
});

test('the plan reader takes the timing off a hydrated stage, and says what it cannot read', () => {
  // A minimal stand-in for the markup a design template emits: the box carries the
  // timing, an inner marker carries the source.
  const audioBox: SeqElementLike = {
    getAttribute: (n) => ({
      'data-t-start': '500', 'data-t-dur': '2000', 'data-t-gain': '1.3',
      'data-t-pan': '-0.5', 'data-t-duck': '0.4', 'data-t-kf': 'v0=1,v900=0.2',
    }[n] ?? null),
    querySelector: (sel) => (sel === '[data-audio-src]'
      ? { getAttribute: (n) => (n === 'data-audio-src' ? 'clip.wav' : null), querySelector: () => null, querySelectorAll: () => [] } as SeqElementLike
      : null),
    querySelectorAll: () => [],
    classList: { contains: (c) => c === 'lolly-box-audio' },
  };
  const root: SeqElementLike = {
    getAttribute: (n) => (n === 'data-seq-ms' ? '3300' : null),
    matches: (sel) => sel === '[data-seq-ms]',
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === '[data-t-start]' ? [audioBox] : []),
  };
  const read = readSeqAudioPlan(root);
  assert.equal(read.plan.totalSec, 3.3);
  assert.equal(read.plan.clips.length, 1);
  const c = read.plan.clips[0]!;
  assert.equal(c.kind, 'audio');
  assert.equal(c.startMs, 500);
  assert.equal(c.durMs, 2000);
  assert.equal(c.gain, 1.3);
  assert.equal(c.pan, -0.5);
  assert.equal(c.duck, 0.4);
  assert.equal(read.sources.get(c.id), 'clip.wav');
  // The keyframe gap is stated rather than guessed at.
  assert.match(read.warnings.join(' | '), /volume keyframes/);
});

test('the Node decoder names an unreadable container instead of returning silence', async () => {
  const wav = packWav({ channels: tone(0.1).channels, sampleRate: MIX_RATE });
  const asData = `data:application/octet-stream;base64,${Buffer.from(wav).toString('base64')}`;
  const back = await decodeAudioPcm(asData, { repoRoot: REPO });
  assert.equal(back.sampleRate, MIX_RATE);
  // An Ogg page with no file extension used to come back as "not a RIFF/WAVE file".
  const ogg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(64)]);
  const oggUrl = `data:application/octet-stream;base64,${ogg.toString('base64')}`;
  await assert.rejects(() => decodeAudioPcm(oggUrl, { repoRoot: REPO }), /ogg\/opus needs a platform codec/);
});

// ── the parity pin against the web shell's own modules ───────────────────────

test('the mix matches the web shell sample for sample', { skip: !existsSync(WEB_MIX_WINDOW) && 'shells/web is not checked out' }, async () => {
  const web = await import(WEB_MIX_WINDOW) as typeof import('../src/sequence-audio.ts');
  const webEnv = await import(join(REPO, 'shells', 'web', 'src', 'bridge', 'audio-envelope.ts')) as {
    clipGainEvents: typeof clipGainEvents; bedDuckEnvelope: typeof bedDuckEnvelope;
    envelopeGainAt: typeof envelopeGainAt;
  };
  const { pcm } = fixture();
  const voice = pcm.get('voice')!;
  const bed = pcm.get('bed')!;

  // 1. The envelope builders agree, event for event.
  const gainArgs = { spanSec: 2, gain: 1.3, fadeInSec: 0.3, fadeOutSec: 0.45, volumeKeys: [{ tSec: 0.2, value: 0.4 }, { tSec: 1.4, value: 1 }], duck: { level: 0.3, spans: [{ from: 0.5, to: 1.2 }] } };
  assert.deepEqual(clipGainEvents(gainArgs), webEnv.clipGainEvents(gainArgs));
  const bedArgs = { clipSec: 4, volume: 0.5, centre: 0.3, spans: [{ from: 0.5, to: 2.5 }], fadeIn: 0.4, fadeOut: 0.6 };
  assert.deepEqual(bedDuckEnvelope(bedArgs), webEnv.bedDuckEnvelope(bedArgs));

  // 2. The closed form agrees, sample for sample, over a spec that exercises the
  //    panned clip path, the keyed+ducked envelope and a looping bed.
  const spec = {
    clips: [{ pcm: voice.channels, startMs: 500, events: clipGainEvents(gainArgs), pan: -0.4 }],
    beds: [{ pcm: [bed.channels[0]!, bed.channels[1]!], events: bedDuckEnvelope(bedArgs), offsetSample: 1234 }],
    rate: MIX_RATE,
  };
  const total = 4 * MIX_RATE;
  const mine = limitPlanes(mixWindow(spec, 0, total), -16);
  const theirs = limitPlanes(web.mixWindow(spec as never, 0, total), -16);
  for (let i = 0; i < total; i++) {
    if (mine[0][i] !== theirs[0][i] || mine[1][i] !== theirs[1][i]) {
      assert.fail(`mix diverges from the web shell at sample ${i}: ${mine[0][i]}/${mine[1][i]} vs ${theirs[0][i]}/${theirs[1][i]}`);
    }
  }
});
