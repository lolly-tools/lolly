// SPDX-License-Identifier: MPL-2.0
/**
 * MP3 C2PA embedding (ID3v2 GEOB — the C2PA spec's MPEG-1/2 audio binding,
 * plans/41-tts-stt-programme.md §2: the route for raw synthetic audio leaving
 * Lolly with its Article 50 mark attached). The generic embed → verify
 * round-trip and tamper case ride the format matrix in c2pa-formats.test.ts;
 * this file pins the ID3-specific behaviour: an existing tag's frames survive,
 * a re-stamp replaces rather than duplicates, v2.3 and v2.4 frame sizes both
 * read, and the tag walk refuses shapes it cannot safely rewrite.
 *
 * Run with: node --test tests/c2pa-mp3.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { embedC2pa, attachC2paStore, GENERATED_SOURCE_TYPE } from '../engine/src/c2pa.ts';
import { verifyC2pa, sniffFormat, extractC2paStore } from '../engine/src/c2pa-verify.ts';

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const syncsafe = (n: number): Uint8Array =>
  Uint8Array.of((n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f);
const u32be = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

const AUDIO = concat([Uint8Array.of(0xff, 0xfb, 0x90, 0x00), bytesOf('fake-mp3-audio-frames')]);

// A TIT2 (title) frame — the existing metadata that must survive a stamp.
const tit2 = (v4: boolean): Uint8Array => {
  const body = concat([Uint8Array.of(0x00), bytesOf('My Song')]);
  return concat([bytesOf('TIT2'), v4 ? syncsafe(body.length) : u32be(body.length), Uint8Array.of(0, 0), body]);
};
// An mp3 with a leading ID3v2 tag (ver 3 or 4) holding the given frames + padding.
function taggedMp3(ver: 3 | 4, frames: Uint8Array[], padding = 16): Uint8Array {
  const content = concat([...frames, new Uint8Array(padding)]);
  return concat([bytesOf('ID3'), Uint8Array.of(ver, 0, 0), syncsafe(content.length), content, AUDIO]);
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

test('a tagless mp3 gains a fresh ID3v2.4 tag; sniff and extraction read it back', async () => {
  const out = await embedC2pa(AUDIO, 'mp3', OPTS);
  assert.equal(String.fromCharCode(...out.subarray(0, 3)), 'ID3');
  assert.equal(out[3], 4, 'fresh tag is v2.4');
  assert.equal(sniffFormat(out), 'mp3');
  const ex = extractC2paStore(out);
  assert.ok(ex && ex.format === 'mp3' && ex.store.length > 0);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.aiGenerated?.kind, 'generated', 'the Article 50 mark reads back');
});

for (const ver of [3, 4] as const) {
  test(`an existing ID3v2.${ver} tag keeps its frames through a stamp and still verifies`, async () => {
    const out = await embedC2pa(taggedMp3(ver, [tit2(ver === 4)]), 'mp3', OPTS);
    assert.equal(out[3], ver, 'tag version preserved');
    const asText = String.fromCharCode(...out.subarray(0, Math.min(out.length, 4096)));
    assert.ok(asText.includes('TIT2') && asText.includes('My Song'), 'the title frame survives');
    const report = await verifyC2pa(out);
    assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  });
}

test('re-stamping replaces the prior credential — never a second GEOB', async () => {
  const once = await embedC2pa(AUDIO, 'mp3', OPTS);
  const twice = await embedC2pa(once, 'mp3', { ...OPTS, title: 'Narration v2' });
  // A duplicated credential would make extraction throw ('more than one').
  const ex = extractC2paStore(twice);
  assert.ok(ex, 'exactly one credential reads back');
  const report = await verifyC2pa(twice);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks));
  assert.equal(report.claim?.title, 'Narration v2', 'the replacement credential is the live one');
});

test('attachC2paStore re-inserts a preserved store without re-signing', async () => {
  const out = await embedC2pa(AUDIO, 'mp3', OPTS);
  const store = extractC2paStore(out)!.store;
  const reattached = attachC2paStore(AUDIO, 'mp3', store);
  const ex = extractC2paStore(reattached);
  assert.ok(ex && ex.store.length === store.length, 'the store rides back in verbatim');
});

test('unwalkable tags are refused, not mis-walked; junk is not an mp3', async () => {
  // Unsynchronisation flag (0x80) set — frame offsets cannot be trusted.
  const unsync = concat([bytesOf('ID3'), Uint8Array.of(4, 0, 0x80), syncsafe(4), new Uint8Array(4), AUDIO]);
  await assert.rejects(() => embedC2pa(unsync, 'mp3', OPTS), /unsynchronised/i);
  await assert.rejects(() => embedC2pa(bytesOf('not audio at all'), 'mp3', OPTS), /not an MP3/i);
});
