// SPDX-License-Identifier: MPL-2.0
/**
 * Capture-clip Content Credentials - the recorder/screencap self-assert path
 * (bridge/export.ts `stampCaptureClip` + `captureContainer`), run for real and
 * verified with the ENGINE's own reader as the oracle.
 *
 * Why this file exists: `stampCaptureClip` was typed `'mp4' | 'webm' | 'png'`,
 * so a voice take fell out of the only branch that signs anything and every
 * audio recording shipped uncredentialed. That was never a capability gap - the
 * engine embeds into m4a, mp3, wav and Ogg Opus as happily as into mp4/webm - 
 * it was a type signature nobody re-read after the containers landed. The guard
 * against a repeat is the first test: every format the capture path may name is
 * one the engine can actually place a manifest in.
 *
 * The engine half (placer grammar, hard binding, tamper detection) is pinned in
 * tests/c2pa-containers.test.ts and tests/c2pa-formats.test.ts. What is pinned
 * HERE is the shell's claim: that an audio take asserts the same house capture
 * shape a video take does - one c2pa.created step, IPTC digitalCapture, an
 * honest description of which sensors ran - and that its store comes back
 * extractable so the clip chains as an ingredient once composited.
 *
 * Run directly:  node --test shells/web/src/bridge/capture-clip-c2pa.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stampCaptureClip, captureContainer, CAPTURE_FORMATS, type CaptureFormat } from './export.ts';
import { audioMimeCandidates, AUDIO_WEBM_CODECS, AUDIO_MP4_CODECS } from './video-mime.ts';
import { webCodecsContainerMime } from './recorder-webcodecs.ts';
import { C2PA_FORMATS, CAPTURE_SOURCE_TYPE, SCREEN_SOURCE_TYPE } from '../../../../engine/src/c2pa.ts';
import { verifyC2pa, extractC2paStore, prepareC2paIngredientFromStore } from '../../../../engine/src/c2pa-verify.ts';

// ── fixtures: the smallest structurally valid container per format ────────────
// Same shapes tests/c2pa-formats.test.ts uses - enough grammar for the placer and
// the verifier; neither decodes samples.

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u16le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
const u32be = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

// M4A - ISO BMFF audio, what `audio/mp4` MediaRecorder output is.
const mp4box = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const p = concat(parts);
  return concat([u32be(8 + p.length), bytesOf(type), p]);
};
const tinyM4a = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('M4A '), u32be(0), bytesOf('M4A mp42isom')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(100))),
  mp4box('mdat', bytesOf('fake-aac-payload')),
]);

// WebM - a finalised MediaRecorder blob (known-size Segment, SeekHead + Void).
const ebVint = (n: number): Uint8Array => {
  let w = 1;
  while (w < 8 && n > 2 ** (7 * w) - 2) w++;
  const out = new Uint8Array(w);
  let v = n;
  for (let i = w - 1; i >= 0; i--) { out[i] = v & 0xff; v = Math.floor(v / 256); }
  out[0] = out[0]! | (0x80 >> (w - 1));
  return out;
};
const eb = (id: number[], payload: Uint8Array): Uint8Array => concat([Uint8Array.from(id), ebVint(payload.length), payload]);
function tinyWebm(): Uint8Array {
  const EBML_HEAD = concat([Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x84), eb([0x42, 0x86], Uint8Array.of(1))]);
  const SEG_ID = Uint8Array.of(0x18, 0x53, 0x80, 0x67);
  const seek = (id: number[], pos: number): Uint8Array =>
    eb([0x4d, 0xbb], concat([eb([0x53, 0xab], Uint8Array.from(id)), eb([0x53, 0xac], Uint8Array.of(pos))]));
  const payload = concat([
    eb([0x11, 0x4d, 0x9b, 0x74], concat([seek([0x15, 0x49, 0xa9, 0x66], 60), seek([0x1c, 0x53, 0xbb, 0x6b], 100)])),
    concat([Uint8Array.of(0xec, 0x80 | 40), new Uint8Array(40)]),          // reserved Void
    eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(10)),                      // Info
    eb([0x1f, 0x43, 0xb6, 0x75], bytesOf('fake-opus-cluster')),            // Cluster
    eb([0x1c, 0x53, 0xbb, 0x6b], new Uint8Array(8)),                       // Cues
  ]);
  return concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x40 | (payload.length >> 8), payload.length & 0xff), payload]);
}

// Ogg Opus - OpusHead (BOS) + OpusTags (where the credential lands) + audio.
// Pages carry a real libogg CRC so the fixture is a decodable stream.
const OGG_CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let r = i << 24; for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1); t[i] = r >>> 0; }
  return t;
})();
const oggCrc = (b: Uint8Array): number => { let c = 0; for (const x of b) c = ((c << 8) ^ OGG_CRC_T[((c >>> 24) ^ x) & 0xff]!) >>> 0; return c >>> 0; };
function oggPage(htype: number, seq: number, packet: Uint8Array): Uint8Array {
  const nseg = Math.floor(packet.length / 255) + 1;
  const seg = new Uint8Array(nseg);
  for (let i = 0; i < nseg - 1; i++) seg[i] = 255;
  seg[nseg - 1] = packet.length % 255;
  const head = new Uint8Array(27);
  head.set(bytesOf('OggS'), 0); head[5] = htype; head[26] = nseg;
  const dvh = new DataView(head.buffer);
  dvh.setUint32(14, 0xcafe, true);  // serial
  dvh.setUint32(18, seq, true);     // page sequence
  const page = concat([head, seg, packet]);
  new DataView(page.buffer, page.byteOffset).setUint32(22, oggCrc(page), true);
  return page;
}
const OPUS_HEAD = concat([bytesOf('OpusHead'), Uint8Array.of(1, 1), u16le(0), u32le(48000), u16le(0), Uint8Array.of(0)]);
const OPUS_TAGS = concat([bytesOf('OpusTags'), u32le(0), u32le(0)]);   // empty vendor, 0 comments
const tinyOgg = (): Uint8Array => concat([
  oggPage(0x02, 0, OPUS_HEAD),
  oggPage(0x00, 1, OPUS_TAGS),
  oggPage(0x04, 2, bytesOf('fake-opus-audio')),
]);

// MP3 - a bare frame sync; the placer wraps a fresh ID3v2.4 GEOB around it.
const tinyMp3 = (): Uint8Array => concat([Uint8Array.of(0xff, 0xfb, 0x90, 0x00), bytesOf('fake-mp3-audio-frames')]);

// WAV - a real 16-bit PCM mono clip (the RIFF placer adds a top-level 'C2PA'
// chunk, and the reader refuses a hollow RIFF/WAVE with no data chunk).
function tinyWav(frames = 32, sampleRate = 24000): Uint8Array {
  const dataLen = frames * 2;
  const u8 = new Uint8Array(44 + dataLen);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => { for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < frames; i++) dv.setInt16(44 + i * 2, ((i % 16) - 8) * 1024, true);
  return u8;
}

// MP4 - the video take, for the "audio matches video" comparison.
const tinyMp4 = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('isom'), u32be(0x200), bytesOf('isommp42')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(100))),
  mp4box('mdat', bytesOf('fake-video-payload')),
]);

/** The slice of the host bridge stampCaptureClip touches: a log sink and a
 *  profile (buildExportMeta reads it for the opt-in authorship). */
function fakeHost(): { host: any; warnings: string[] } {
  const warnings: string[] = [];
  const host: any = {
    log: (level: string, msg: string) => { if (level === 'warn') warnings.push(msg); },
    profile: { get: async () => ({}) },
  };
  return { host, warnings };
}

const created = (report: Awaited<ReturnType<typeof verifyC2pa>>) =>
  report.claim?.actions?.find((a) => a.action === 'c2pa.created');

// ── the guard that would have caught this bug ────────────────────────────────

test('every CaptureFormat is a container the engine can actually embed into', () => {
  for (const fmt of CAPTURE_FORMATS) {
    assert.ok(C2PA_FORMATS.includes(fmt), `${fmt} must be in the engine's C2PA_FORMATS`);
  }
  // …and the audio containers a recorder can produce are all named, so a take can
  // never fall out of the signing branch again for want of a union member.
  for (const fmt of ['m4a', 'webm', 'ogg', 'mp3', 'wav'] as CaptureFormat[]) {
    assert.ok((CAPTURE_FORMATS as readonly string[]).includes(fmt), `${fmt} is a capture container`);
  }
});

test('every mime the recorder bridge ASKS for is one a take can be signed in', () => {
  // The list in video-mime.ts is the one bridge/recorder.ts probes with, so this is
  // the drift guard rather than a restatement: a candidate added there with no
  // engine placer behind it fails HERE, not on a user's machine with a take that
  // quietly saved unsigned. Both preference orders, since Safari flips them.
  const asked = new Set([...audioMimeCandidates('webm'), ...audioMimeCandidates('mp4')]);
  assert.deepEqual([...asked].sort(), [...AUDIO_WEBM_CODECS, ...AUDIO_MP4_CODECS].sort(),
    'both orders cover the same candidate set');
  for (const mime of asked) {
    const container = captureContainer(mime);
    assert.ok(container, `${mime} is a container the recorder may produce, so it needs a placer`);
    assert.ok((CAPTURE_FORMATS as readonly string[]).includes(container!), `${mime} → ${container} must be a CaptureFormat`);
  }
});

test('every container the WebCodecs recorder path can hand back is one a take can be signed in', () => {
  // The controlled path (bridge/recorder-webcodecs.ts) decides the container UP FRONT - that
  // is the whole point of it for provenance: no MediaRecorder mime to guess. The same guard
  // still applies, so it fails HERE if a container the new path can produce has no engine
  // placer behind it. AV1-in-mp4 is the new default video landing (video/mp4); the mic-only
  // audio landings (audio/mp4 → m4a, audio/webm) are the red-team #1 case.
  for (const kind of ['video', 'audio'] as const) {
    for (const container of ['mp4', 'webm'] as const) {
      const mime = webCodecsContainerMime(kind, container);
      const fmt = captureContainer(mime);
      assert.ok(fmt, `${mime} is a container the WebCodecs recorder may produce, so it needs a placer`);
      assert.ok((CAPTURE_FORMATS as readonly string[]).includes(fmt!), `${mime} → ${fmt} must be a CaptureFormat`);
    }
  }
  assert.equal(captureContainer(webCodecsContainerMime('video', 'mp4')), 'mp4');
  assert.equal(captureContainer(webCodecsContainerMime('video', 'webm')), 'webm');
  assert.equal(captureContainer(webCodecsContainerMime('audio', 'mp4')), 'm4a', 'a mic-only mp4 take is an M4A');
  assert.equal(captureContainer(webCodecsContainerMime('audio', 'webm')), 'webm');
});

test('captureContainer maps every MIME the recorder bridge can hand back', () => {
  // audio-only takes (bridge/recorder.ts audioMimeType candidates + Firefox's Ogg)
  assert.equal(captureContainer('audio/webm;codecs=opus'), 'webm', 'Opus in Matroska is webm, not ogg');
  assert.equal(captureContainer('audio/webm'), 'webm');
  assert.equal(captureContainer('audio/mp4;codecs=mp4a.40.2'), 'm4a', 'audio/mp4 is an M4A, not a video mp4');
  assert.equal(captureContainer('audio/mp4'), 'm4a');
  assert.equal(captureContainer('audio/ogg;codecs=opus'), 'ogg');
  assert.equal(captureContainer('audio/mpeg'), 'mp3');
  assert.equal(captureContainer('audio/wav'), 'wav');
  // video takes keep the container they always had
  assert.equal(captureContainer('video/mp4;codecs=avc1.640028,mp4a.40.2'), 'mp4');
  assert.equal(captureContainer('video/webm;codecs=vp9,opus'), 'webm');
  assert.equal(captureContainer('image/png'), 'png');
  // …and an encoder we have no placer for says so instead of guessing
  assert.equal(captureContainer('video/ogg'), null, 'there is no Ogg video placer');
  assert.equal(captureContainer('audio/flac'), null);
  assert.equal(captureContainer(''), null);
  assert.equal(captureContainer(undefined as unknown as string), null);
});

// ── an audio take is credentialed exactly like a video one ───────────────────

// [format handed to the stamp, fixture bytes, what the READER's magic-byte sniff
// calls the result]. The two differ for M4A: ISO BMFF audio and video share a
// container, so the sniff reports 'mp4' - the manifest still records the true
// export format in its tools.lolly.export assertion (report.environment.format),
// which is the field asserted below.
const AUDIO_TAKES: Array<[CaptureFormat, Uint8Array, string]> = [
  ['ogg', tinyOgg(), 'ogg'],
  ['m4a', tinyM4a(), 'mp4'],
  ['webm', tinyWebm(), 'webm'],
  ['mp3', tinyMp3(), 'mp3'],
  ['wav', tinyWav(), 'wav'],
];

for (const [fmt, fixture, sniffed] of AUDIO_TAKES) {
  test(`${fmt} voice take: stampCaptureClip signs it, the engine verifies it, and it chains`, async () => {
    const { host, warnings } = fakeHost();
    const { blob, credential } = await stampCaptureClip(host, new Blob([fixture as BlobPart]), fmt, { microphone: true });
    assert.deepEqual(warnings, [], 'stamping an audio take logs no warning');
    assert.ok(blob.size > fixture.length, 'the credential was actually placed into the bytes');

    const out = new Uint8Array(await blob.arrayBuffer());
    const report = await verifyC2pa(out);
    assert.equal(report.state, 'valid', JSON.stringify(report.checks));
    assert.equal(report.madeWithLolly, true);
    assert.equal(report.format, sniffed, 'the signed file still sniffs as the container it went in as');
    assert.equal(report.environment?.format, fmt, 'the manifest records the container it was stamped for');

    // The house capture shape: ONE created step, IPTC digitalCapture, mic-only wording.
    const steps = report.claim?.actions ?? [];
    assert.equal(steps.length, 1, `a fresh take asserts creation and nothing else: ${JSON.stringify(steps)}`);
    assert.equal(steps[0]!.action, 'c2pa.created');
    assert.equal(steps[0]!.digitalSourceType, CAPTURE_SOURCE_TYPE);
    assert.equal(steps[0]!.description, 'Recorded live from the microphone');
    assert.notEqual(steps[0]!.digitalSourceType, SCREEN_SOURCE_TYPE, 'a mic take is not a screen capture');
    assert.equal(report.environment?.tool, 'Recording');
    assert.equal(report.environment?.surface, 'web');

    // The returned store is what a user/ asset record persists (credential lookup
    // reads the STORED store, not the bytes), and it prepares as an ingredient so a
    // composited take carries its capture provenance forward.
    assert.ok(credential, 'a store came back for the caller to persist');
    const ex = extractC2paStore(out);
    assert.ok(ex, 'the store extracts straight back out of the signed file');
    const ingredient = prepareC2paIngredientFromStore(credential!.store, credential!.format);
    assert.ok(ingredient, 'the take prepares as a chainable ingredient');
    assert.ok(ingredient!.manifestBoxes.length >= 1, 'the manifest boxes ride verbatim');
  });
}

test('the audio take asserts the same shape a camera take does, minus the camera', async () => {
  const { host } = fakeHost();
  const video = await stampCaptureClip(host, new Blob([tinyMp4() as BlobPart]), 'mp4', { camera: true, microphone: true });
  const audio = await stampCaptureClip(host, new Blob([tinyOgg() as BlobPart]), 'ogg', { microphone: true });
  const [vr, ar] = await Promise.all([
    verifyC2pa(new Uint8Array(await video.blob.arrayBuffer())),
    verifyC2pa(new Uint8Array(await audio.blob.arrayBuffer())),
  ]);
  assert.equal(vr.state, 'valid');
  assert.equal(ar.state, 'valid');
  // Same action, same source type, same recording tool - only the sensor wording differs.
  assert.equal(created(ar)!.action, created(vr)!.action);
  assert.equal(created(ar)!.digitalSourceType, created(vr)!.digitalSourceType);
  assert.equal(vr.environment?.tool, ar.environment?.tool);
  assert.equal(created(vr)!.description, 'Recorded live from the camera and microphone');
  assert.equal(created(ar)!.description, 'Recorded live from the microphone');
});

// ── the "Save MP3" leg: a re-encode says so ──────────────────────────────────

test('a transcoded take adds an honest c2pa.converted step after the capture', async () => {
  const { host } = fakeHost();
  const { blob } = await stampCaptureClip(host, new Blob([tinyMp3() as BlobPart]), 'mp3', { microphone: true, transcoded: true });
  const report = await verifyC2pa(new Uint8Array(await blob.arrayBuffer()));
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  const steps = report.claim?.actions ?? [];
  assert.equal(steps.length, 2, JSON.stringify(steps));
  // The essence is still the mic take - the re-encode is an edit on top, never a
  // replacement of the origin claim.
  assert.equal(steps[0]!.action, 'c2pa.created');
  assert.equal(steps[0]!.digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.equal(steps[0]!.description, 'Recorded live from the microphone');
  assert.equal(steps[1]!.action, 'c2pa.converted');
  assert.equal(steps[1]!.description, 'Encoded to MP3');
});

// ── a provenance hiccup never costs the user their take ──────────────────────

test('bytes the placer refuses come back unsigned, not lost, with a logged reason', async () => {
  const { host, warnings } = fakeHost();
  const junk = bytesOf('this is not an Ogg Opus stream at all');
  const { blob, credential } = await stampCaptureClip(host, new Blob([junk as BlobPart]), 'ogg', { microphone: true });
  assert.equal(credential, null, 'no credential is claimed for bytes that took none');
  assert.equal(new Uint8Array(await blob.arrayBuffer()).length, junk.length, 'the original take is returned untouched');
  assert.equal(warnings.length, 1, 'and the failure is logged rather than swallowed');
  assert.match(warnings[0]!, /Content Credentials not attached/);
});
