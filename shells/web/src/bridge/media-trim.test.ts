// SPDX-License-Identifier: MPL-2.0
/**
 * host.media.trim: audio trims, the video clip path and the report it measures on the
 * written bytes.
 *
 * Run directly:  node --test shells/web/src/bridge/media-trim.test.ts
 *
 * Pure node, no jsdom and no WebCodecs: the sources are synthetic containers built from
 * known packet bytes, so every copy path runs and every re-encode path is refused
 * (node has no decoder). That is enough to pin:
 *   - an exact cut on a key frame copies both tracks byte for byte and reports it,
 *     with sound and picture matched packet for packet,
 *   - a fast cut between key frames starts at the earlier key frame and says by how
 *     much, while an exact cut there asks for a re-encode and, where none is
 *     possible, refuses with a hint instead of dropping the picture,
 *   - a start inside the key frame's own display time still copies,
 *   - a turn into MP4 sets the orientation value without touching the packets,
 *   - a sound track that cannot be carried over is refused, never silently left out,
 *   - removed and secondary tracks are listed with their reason.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as mb from 'mediabunny';
import { packWav, parseWav } from '@lolly/engine';
import { trimMedia } from './media-trim.ts';

test('trims synthetic audio to the exact requested sample range', async () => {
  const sampleRate = 48_000;
  const samples = new Float32Array(sampleRate * 2);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.2;
  const source = packWav({ channels: [samples], sampleRate });

  const result = await trimMedia(source, {
    start: 0.25,
    end: 1.25,
    container: 'keep',
    sourceName: 'tone.wav',
    sourceMime: 'audio/wav',
  });
  const decoded = parseWav(result.bytes);

  assert.equal(result.container, 'wav');
  assert.equal(result.durationBefore, 2);
  assert.equal(result.durationAfter, 1);
  assert.equal(decoded.sampleRate, sampleRate);
  assert.equal(decoded.channels[0]!.length, sampleRate);
});

test('rejects an empty trim range by name', async () => {
  const source = packWav({ channels: [new Float32Array(48_000)], sampleRate: 48_000 });
  await assert.rejects(
    trimMedia(source, { start: 1, end: 1, container: 'keep', sourceName: 'silence.wav' }),
    /start \(1s\) must be before end \(1s\)/,
  );
});

// ── Video clips and the report ───────────────────────────────────────────────

const FPS = 30;
const AUDIO_STEP = 1024 / 48000;
const AAC_ASC = new Uint8Array([0x11, 0x90]);
const BT709 = { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } as const;

function opusHead(): Uint8Array {
  const b = new Uint8Array(19);
  b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0);
  b[8] = 1; b[9] = 2; b[12] = 0x80; b[13] = 0xbb;
  return b;
}

interface Spec {
  format: 'mp4' | 'webm';
  frames?: number;
  gop?: number;
  rotation?: 0 | 90 | 180 | 270;
  audio?: 'aac' | 'opus' | null;
  secondAudio?: boolean;
}

function videoPacket(i: number): Uint8Array {
  const b = new Uint8Array(12 + (i % 7));
  for (let j = 0; j < b.length; j++) b[j] = (i * 31 + j + 1) & 0xff;
  return b;
}

function audioPacket(i: number, seed = 17): Uint8Array {
  const b = new Uint8Array(6 + (i % 5));
  b[0] = 0xf8;
  for (let j = 1; j < b.length; j++) b[j] = (i * seed + j) & 0xff;
  return b;
}

/** A synthetic container: VP9 picture with a key frame every `gop` frames, plus sound
 *  packets laid end to end. Returns the bytes and the picture packets by frame. */
async function makeSource(spec: Spec): Promise<{ bytes: Uint8Array; video: Uint8Array[] }> {
  const { frames = 30, gop = 5, rotation = 0, audio = 'aac' } = spec;
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: spec.format === 'mp4' ? new mb.Mp4OutputFormat() : new mb.WebMOutputFormat(), target });
  const v = new mb.EncodedVideoPacketSource('vp9');
  output.addVideoTrack(v, rotation ? { rotation } : {});
  const sound = audio ? new mb.EncodedAudioPacketSource(audio) : null;
  if (sound) output.addAudioTrack(sound);
  const extra = spec.secondAudio && audio ? new mb.EncodedAudioPacketSource(audio) : null;
  if (extra) output.addAudioTrack(extra, { languageCode: 'fra' });
  await output.start();
  const audioConfig: AudioDecoderConfig = audio === 'aac'
    ? { codec: 'mp4a.40.2', numberOfChannels: 2, sampleRate: 48000, description: AAC_ASC }
    : { codec: 'opus', numberOfChannels: 2, sampleRate: 48000, description: opusHead() };
  const video: Uint8Array[] = [];
  let ats = 0, ai = 0;
  for (let i = 0; i < frames; i++) {
    const ts = i / FPS;
    const vb = videoPacket(i);
    video.push(vb);
    await v.add(new mb.EncodedPacket(vb, i % gop === 0 ? 'key' : 'delta', ts, 1 / FPS),
      i === 0 ? { decoderConfig: { codec: 'vp09.00.10.08', codedWidth: 32, codedHeight: 16, colorSpace: BT709 } } : undefined);
    while (sound && ats < ts + 1 / FPS - 1e-9) {
      const meta = ai === 0 ? { decoderConfig: audioConfig } : undefined;
      await sound.add(new mb.EncodedPacket(audioPacket(ai), 'key', ats, AUDIO_STEP), meta);
      if (extra) await extra.add(new mb.EncodedPacket(audioPacket(ai, 29), 'key', ats, AUDIO_STEP), meta);
      ats += AUDIO_STEP; ai++;
    }
  }
  await output.finalize();
  return { bytes: new Uint8Array(target.buffer!), video };
}

async function firstVideoPacket(bytes: Uint8Array): Promise<{ data: Uint8Array; rotation: number; width: number; height: number }> {
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BufferSource(bytes) });
  try {
    const track = await input.getPrimaryVideoTrack();
    assert.ok(track, 'the output has a picture');
    const packet = await new mb.EncodedPacketSink(track).getFirstPacket();
    assert.ok(packet);
    return { data: packet.data, rotation: await track.getRotation(), width: await track.getDisplayWidth(), height: await track.getDisplayHeight() };
  } finally {
    input.dispose();
  }
}

test('an exact cut on a key frame copies both tracks and matches sound to picture packet for packet', async () => {
  const src = await makeSource({ format: 'mp4' });
  const r = await trimMedia(src.bytes, { start: 10 / FPS, end: 0.8, sourceName: 'clip.mp4' });
  assert.equal(r.container, 'mp4');
  assert.equal(r.lossless, true);
  const report = r.report!;
  assert.equal(report.method, 'copy');
  assert.equal(report.keyFrameGap, 0);
  assert.ok(Math.abs(report.actualStart - 10 / FPS) < 1e-6);
  assert.deepEqual(report.tracks.map((t) => [t.kind, t.action]), [['video', 'copy'], ['audio', 'copy']]);
  assert.equal(report.sync?.method, 'packets');
  assert.equal(report.sync?.ok, true);
  assert.equal(report.orientation?.method, 'none');
  assert.equal(report.orientation?.ok, true);
  assert.deepEqual(report.color, { source: 'bt709', output: 'bt709', kept: true });
  assert.deepEqual(report.size, { width: 32, height: 16 });
  assert.deepEqual((await firstVideoPacket(r.bytes)).data, src.video[10], 'the written key frame is the source key frame');
});

test('a fast cut between key frames starts at the earlier key frame and reports the gap', async () => {
  const src = await makeSource({ format: 'mp4' });
  const r = await trimMedia(src.bytes, { start: 0.6, end: 0.9, cut: 'keyframe', sourceName: 'clip.mp4' });
  const report = r.report!;
  assert.equal(report.method, 'copy');
  assert.ok(Math.abs(report.actualStart - 0.5) < 1e-6, 'frame 15 is the key frame before 0.6 s');
  assert.ok(Math.abs(report.keyFrameGap - 0.1) < 1e-6);
  assert.equal(report.requestedStart, 0.6);
  assert.ok(Math.abs(r.durationAfter - 0.4) < 1e-6, 'the clip is longer by the gap');
  assert.deepEqual((await firstVideoPacket(r.bytes)).data, src.video[15]);
  assert.equal(report.sync?.ok, true);
});

test('an exact cut between key frames needs a re-encode and refuses rather than drop the picture', async () => {
  const src = await makeSource({ format: 'mp4' });
  await assert.rejects(
    () => trimMedia(src.bytes, { start: 0.6, end: 0.9, sourceName: 'clip.mp4' }),
    (e: Error) => /picture would be left out/.test(e.message) && /fast cut/i.test(e.message),
  );
});

test('a start inside the key frame display time still copies from that key frame', async () => {
  const src = await makeSource({ format: 'webm', audio: null });
  // 0.34 s is inside frame 10 (0.333 to 0.367), which is a key frame. WebM keeps
  // millisecond times, so even an exact 10/30 s start falls just after the stored key.
  const r = await trimMedia(src.bytes, { start: 0.34, end: 0.8, sourceName: 'clip.webm' });
  const report = r.report!;
  assert.equal(report.method, 'copy');
  assert.ok(report.keyFrameGap > 0 && report.keyFrameGap < 1 / FPS);
  assert.ok(report.actualStart < 0.34);
  assert.deepEqual((await firstVideoPacket(r.bytes)).data, src.video[10]);
});

test('a turn into MP4 sets the orientation value and leaves the packets alone', async () => {
  const src = await makeSource({ format: 'mp4', rotation: 90 });
  const r = await trimMedia(src.bytes, { start: 0, end: 0.5, rotate: 90, sourceName: 'phone.mp4' });
  const report = r.report!;
  assert.equal(report.method, 'copy');
  assert.equal(report.orientation?.method, 'flag');
  assert.equal(report.orientation?.sourceRotation, 90);
  assert.equal(report.orientation?.outputRotation, 180);
  assert.equal(report.orientation?.ok, true);
  const out = await firstVideoPacket(r.bytes);
  assert.equal(out.rotation, 180);
  assert.deepEqual([out.width, out.height], [32, 16], 'two quarter turns show the frame landscape again');
  assert.deepEqual(out.data, src.video[0]);
});

test('sound that cannot be carried over is refused, never silently left out', async () => {
  // Opus packets do not start at 0.5 s and WebM cannot hide a lead-in, so the sound
  // needs a re-encode, and node cannot decode Opus.
  const src = await makeSource({ format: 'webm', audio: 'opus' });
  await assert.rejects(
    () => trimMedia(src.bytes, { start: 0.5, end: 0.8, sourceName: 'clip.webm' }),
    (e: Error) => /opus sound would be left out/.test(e.message) && /Remove audio/.test(e.message),
  );
  // Removing the sound on purpose is fine, and says so.
  const muted = await trimMedia(src.bytes, { start: 0.5, end: 0.8, mute: true, sourceName: 'clip.webm' });
  assert.deepEqual(muted.report!.tracks.map((t) => [t.kind, t.action, t.reasons.join()]), [['video', 'copy', ''], ['audio', 'drop', 'removed-by-request']]);
  assert.equal(muted.report!.sync, undefined, 'no sync check without sound');
});

test('extracting audio copies the sound and lists the picture as removed', async () => {
  const src = await makeSource({ format: 'mp4' });
  const r = await trimMedia(src.bytes, { start: 0, end: 0.5, audioOnly: 'm4a', sourceName: 'clip.mp4' });
  assert.equal(r.container, 'm4a');
  assert.equal(r.mime, 'audio/mp4');
  assert.deepEqual(r.report!.tracks.map((t) => [t.kind, t.action]), [['video', 'drop'], ['audio', 'copy']]);
  assert.equal(r.report!.orientation, undefined);
});

test('a secondary sound track is listed as left out with its reason', async () => {
  const src = await makeSource({ format: 'mp4', secondAudio: true });
  const r = await trimMedia(src.bytes, { start: 0, end: 0.5, sourceName: 'clip.mp4' });
  const tracks = r.report!.tracks;
  assert.equal(tracks.length, 3);
  assert.deepEqual(tracks.filter((t) => t.action === 'drop').map((t) => t.reasons), [['not-primary']]);
  assert.equal(r.report!.method, 'copy');
});

test('a size limit applies only to clips with a picture and reports its outcome', async () => {
  const src = await makeSource({ format: 'mp4' });
  // Sound only: the limit is ignored, so the copy path still runs and no target is reported.
  const audio = await trimMedia(src.bytes, { start: 0, end: 0.5, audioOnly: 'm4a', targetBytes: 10, sourceName: 'clip.mp4' });
  assert.equal(audio.report!.target, undefined);
  // With a picture the limit forces a re-encode, which node cannot do.
  await assert.rejects(() => trimMedia(src.bytes, { start: 0, end: 0.5, targetBytes: 1_000_000, sourceName: 'clip.mp4' }), /picture would be left out/);
});
