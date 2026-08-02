// SPDX-License-Identifier: MPL-2.0
/**
 * WAV C2PA embedding (the RIFF-family binding — a top-level 'C2PA' chunk,
 * plans/tts-stt-programme.md §2: the Article 50 mark travels IN the generated
 * clip, not just on its asset record). The generic embed → verify round-trip
 * rides the same machinery as the format matrix in c2pa-formats.test.ts; this
 * file pins the RIFF-specific behaviour: sniff + extraction read the chunk
 * back, the chunk itself is excluded from the hard binding while the audio
 * bytes stay bound (tamper breaks it), a re-stamp replaces rather than
 * duplicates, LIST/INFO tags coexist, and non-audio RIFF shells are refused.
 *
 * Run with: node --test tests/c2pa-wav.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedC2pa, attachC2paStore, GENERATED_SOURCE_TYPE } from '../engine/src/c2pa.ts';
import { verifyC2pa, sniffFormat, extractC2paStore } from '../engine/src/c2pa-verify.ts';
import { embedWavInfo } from '../engine/src/riff-meta.ts';
import { parseWav } from '../engine/src/wav.ts';

/** A real minimal WAV: 16-bit PCM mono, `frames` samples of a small ramp. */
function tinyWav(frames = 32, sampleRate = 24000): Uint8Array {
  const dataLen = frames * 2;
  const u8 = new Uint8Array(44 + dataLen);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i);
  };
  put(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < frames; i++) dv.setInt16(44 + i * 2, ((i % 16) - 8) * 1024, true);
  return u8;
}

const OPTS = {
  title: 'Narration',
  claimGenerator: 'Lolly lolly.tools',
  generatorInfo: { name: 'Lolly', version: '0.0.0-test' },
  actions: [{
    action: 'c2pa.created',
    digitalSourceType: GENERATED_SOURCE_TYPE,
    parameters: { script: 'Hello.', voice: 'af_heart', model: 'kokoro-82m-q8', lang: 'en' },
  }],
};

test('a wav gains a trailing C2PA chunk; sniff and extraction read it back', async () => {
  const wav = tinyWav();
  const out = await embedC2pa(wav, 'wav', OPTS);
  assert.equal(sniffFormat(out), 'wav');
  const ex = extractC2paStore(out);
  assert.ok(ex && ex.format === 'wav' && ex.store.length > 0);
  // The original bytes are a byte-identical prefix — nothing a decoder reads moved
  // (only the RIFF size field at offset 4 is patched).
  for (let i = 12; i < wav.length; i++) assert.equal(out[i], wav[i], `original byte ${i} unchanged`);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated?.kind, 'generated', 'the Article 50 mark reads back');
});

test('the audio bytes stay hard-bound: a data-chunk tamper breaks the binding', async () => {
  const wav = tinyWav();
  const out = await embedC2pa(wav, 'wav', OPTS);
  const tampered = out.slice();
  tampered[50] = tampered[50]! ^ 0x01; // inside the data chunk, well before the C2PA chunk
  const broken = await verifyC2pa(tampered);
  assert.equal(broken.state, 'invalid');
  assert.ok(broken.checks.some((c) => c.code === 'assertion.dataHash.mismatch' && !c.ok), JSON.stringify(broken.checks));
});

test('re-stamping replaces the prior credential — never a second C2PA chunk', async () => {
  const once = await embedC2pa(tinyWav(), 'wav', OPTS);
  const twice = await embedC2pa(once, 'wav', { ...OPTS, title: 'Narration v2' });
  const ex = extractC2paStore(twice);
  assert.ok(ex, 'exactly one credential reads back');
  const report = await verifyC2pa(twice);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.claim?.title, 'Narration v2', 'the replacement credential is the live one');
});

test('attachC2paStore re-inserts a preserved store without re-signing', async () => {
  const wav = tinyWav();
  const out = await embedC2pa(wav, 'wav', OPTS);
  const store = extractC2paStore(out)!.store;
  const reattached = attachC2paStore(wav, 'wav', store);
  const ex = extractC2paStore(reattached);
  assert.ok(ex && ex.store.length === store.length, 'the store rides back in verbatim');
});

test('LIST/INFO tags and the credential coexist; parseWav still decodes both', async () => {
  const tagged = embedWavInfo(tinyWav(), {
    title: 'Hello from Lolly',
    comment: 'The voice is AI-generated, not a real person',
  });
  const out = await embedC2pa(tagged, 'wav', OPTS);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  const bare = parseWav(tinyWav());
  const decoded = parseWav(out);
  assert.equal(decoded.sampleRate, bare.sampleRate);
  assert.deepEqual(Array.from(decoded.channels[0]!), Array.from(bare.channels[0]!), 'samples identical through tags + credential');
});

test('non-audio RIFF shells and junk are refused', async () => {
  // A RIFF/WAVE skin with no data chunk is not a playable clip.
  const hollow = Uint8Array.from('RIFF\x04\x00\x00\x00WAVE', (c) => c.charCodeAt(0) & 0xff);
  await assert.rejects(() => embedC2pa(hollow, 'wav', OPTS), /no data chunk/i);
  await assert.rejects(() => embedC2pa(Uint8Array.from('not audio at all', (c) => c.charCodeAt(0)), 'wav', OPTS), /not a WAV/i);
});
