// SPDX-License-Identifier: MPL-2.0
/**
 * /valid must not accuse our OWN HDR export of hiding data.
 *
 * plans/61-deeprichpixels.md left this as a follow-up: an `hdr=1` gain-map JPEG is
 * one image plus a second rendition past EOI, declared by a CIPA DC-007 MPF
 * index. The view used to decide "is this trailer legitimate?" by string-
 * comparing the sniffed `kind` against the literal 'video (motion photo)', so a
 * gain map drew a "Hidden data appended" warning pip, an amber callout, and a
 * `.bin` download. The engine owns that judgement now (`appendedIsExpected` in
 * engine/src/file-metadata.ts); these tests pin that the view routes through it.
 *
 * The negative control is the point of the file: this must stay a rule about
 * DECLARED payloads, never a blanket suppression of the steganalysis pip.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/valid-appended.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFileMetadata } from '@lolly/engine';
import type { FileMetadata } from '@lolly/engine';
import { assembleGainMapJpeg } from '../../../../engine/src/gainmap-jpeg.ts';
// valid.ts reads `window.__toolIndex`, whose `declare global` lives in catalog/sync.ts.
// tsconfig.tests.json only includes test files, so this is the first test to pull valid.ts
// into that program and it needs the augmentation with it. Type-only, so nothing is emitted
// and sync.ts never executes at runtime.
import type {} from '../catalog/sync.ts';
import { payloadExt, appendedPayloadHtml, stegoPips } from './valid.ts';

// ── Fixtures: real bytes through the real reader, so the `kind` strings this
// file asserts on are the ones the engine actually emits, not guesses. ────────

/** A structurally-valid JPEG: SOI, an SOS whose length field is honest, entropy, EOI. */
function minimalJpeg(entropy: number[]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, ...entropy, 0xff, 0xd9]);
}

const GAINMAP_JPEG = assembleGainMapJpeg(minimalJpeg([1, 2, 3]), minimalJpeg([4, 5, 6]), {
  channels: 1,
  gainMapMin: 0,
  gainMapMax: 2,
  gamma: 1,
  offsetSdr: 0,
  offsetHdr: 0,
  hdrCapacityMin: 0,
  hdrCapacityMax: 2,
  baseRendition: 'sdr',
  useBaseColorSpace: true,
});

/** An ordinary JPEG with a zip glued on after EOI - nothing declares it. */
function jpegWithZipTrailer(): Uint8Array {
  const jpeg = minimalJpeg([1, 2, 3]);
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
  const out = new Uint8Array(jpeg.length + zip.length);
  out.set(jpeg, 0);
  out.set(zip, jpeg.length);
  return out;
}

const gainMapMeta = extractFileMetadata(GAINMAP_JPEG);
const zipMeta = extractFileMetadata(jpegWithZipTrailer());

test('valid: an HDR gain map is disclosed, not accused', () => {
  const appended = gainMapMeta.appended;
  assert.ok(appended, 'the second image must still be disclosed as a trailing payload');
  assert.equal(appended!.declared, true, 'the MPF index declares it');

  // 1. No warning pip on the scorecard.
  assert.deepEqual(stegoPips(gainMapMeta), [], 'our own HDR export must draw no "Hidden data appended" pip');

  // 2. The callout is neutral, not amber, and its wording covers an IMAGE.
  const html = appendedPayloadHtml(gainMapMeta, 0);
  assert.ok(!html.includes('valid-wm--warn'), 'the callout must not be styled as a warning');
  assert.ok(html.includes('Appended image or video data'), 'expected-payload copy must not say "video" alone');
  assert.ok(!html.includes('Appended data found'), 'that is the unexpected-payload heading');
  // Still offered for inspection - reveal, never suppress.
  assert.ok(html.includes('data-payload-view="0"') && html.includes('data-payload-download="0"'));

  // 3. A downloaded gain map lands as a JPEG, because it is one.
  assert.equal(payloadExt(appended!.kind), 'jpg');
});

test('valid: a foreign MPF second image and a motion photo are expected too', () => {
  const motion: FileMetadata['appended'] = { bytes: 64, kind: 'video (motion photo)', offset: 10, declared: false };
  assert.deepEqual(stegoPips({ ...gainMapMeta, appended: motion }), [], 'the motion-photo precedent still passes');
  assert.equal(payloadExt('video (motion photo)'), 'mp4');

  // A plain multi-picture JPEG (no gain-map metadata) is declared, so expected.
  const mpo: FileMetadata['appended'] = { bytes: 64, kind: 'second image (MPF multi-picture)', offset: 10, declared: true };
  assert.deepEqual(stegoPips({ ...gainMapMeta, appended: mpo }), []);
  assert.equal(payloadExt('second image (MPF multi-picture)'), 'jpg', 'a declared second image downloads as a JPEG');
});

test('valid: NEGATIVE CONTROL: an undeclared trailer still warns', () => {
  const appended = zipMeta.appended;
  assert.ok(appended);
  assert.equal(appended!.kind, 'zip archive');
  assert.equal(appended!.declared, false);

  const pips = stegoPips(zipMeta);
  assert.equal(pips.length, 1, 'a hidden payload must still raise exactly one pip');
  assert.equal(pips[0]!.label, 'Hidden data appended');
  assert.equal(pips[0]!.status, 'warn');

  const html = appendedPayloadHtml(zipMeta, 0);
  assert.ok(html.includes('valid-wm--warn'), 'the callout stays amber');
  assert.ok(html.includes('Appended data found'));
  assert.equal(payloadExt(appended!.kind), 'zip');
});

test('valid: a forged record cannot buy an exemption with a kind string', () => {
  // The exemption is evidence-based: `declared` comes from a parsed MPF index
  // the engine re-verified against the real buffer. Claiming the gain-map kind
  // on an UNdeclared trailer must not silence the pip - otherwise the guard
  // would be a blanket suppression keyed on an attacker-chosen string.
  const forged: FileMetadata['appended'] = {
    bytes: 999, kind: 'HDR gain map (ISO 21496-1 / Ultra HDR)', offset: 20, declared: false,
  };
  const pips = stegoPips({ ...zipMeta, appended: forged });
  assert.equal(pips.length, 1, 'an undeclared payload warns whatever it calls itself');
  assert.equal(pips[0]!.label, 'Hidden data appended');
  assert.ok(appendedPayloadHtml({ ...zipMeta, appended: forged }, 0).includes('valid-wm--warn'));
});

test('valid: no appended payload at all means no pip and no callout', () => {
  const clean: FileMetadata = { ...gainMapMeta, appended: undefined, lsb: undefined };
  assert.deepEqual(stegoPips(clean), []);
  assert.equal(appendedPayloadHtml(clean, 0), '');
  assert.equal(stegoPips(undefined).length, 0);
});
