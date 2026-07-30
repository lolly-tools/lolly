// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the pure halves of scripts/ingest-audio.ts — header title
 * extraction, slugging, the checksum convention, tagging, and (most importantly)
 * the licence refusal. Run with: node --test tests/ingest-audio.test.ts
 *
 * The I/O half (copying bytes, appending to a brand's assets/index.json) is only
 * reachable behind an explicit --write and is not exercised here: these tests must
 * never be able to mutate a catalog.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ASSET_ID_RE, MODULE_FORMATS, buildDescription, decideTags, displayName,
  embeddedTitle, normaliseLicence, prettify, slugify, sri,
} from '../scripts/ingest-audio.ts';

/** Build a synthetic module header: `text` laid into a zero-filled buffer. */
function buf(size: number, ...parts: [number, string][]): Uint8Array {
  const b = new Uint8Array(size);
  for (const [offset, text] of parts) {
    for (let i = 0; i < text.length; i++) b[offset + i] = text.charCodeAt(i);
  }
  return b;
}

// ── embedded titles ─────────────────────────────────────────────────────────

test('MOD title is the first 20 bytes, NUL-terminated', () => {
  assert.equal(embeddedTitle(buf(1084, [0, 'absalon junction']), 'mod'), 'absalon junction');
  assert.equal(embeddedTitle(buf(1084, [0, 'sweet_vibez']), 'mod'), 'sweet_vibez');
});

test('MOD title stops at the NUL and never bleeds into the sample names', () => {
  // Real layout: title at 0..20, then 30-byte sample records. A greedy read would
  // return the credit line stored in sample 1's name.
  const b = buf(1084, [0, 'aftertouch'], [20, '#audio vibes by']);
  assert.equal(embeddedTitle(b, 'mod'), 'aftertouch');
});

test('XM title lives at offset 17 behind the "Extended Module: " magic', () => {
  const b = buf(336, [0, 'Extended Module: '], [17, '|- sunlight -|']);
  // Scene decoration is stripped from the edges, inner text preserved.
  assert.equal(embeddedTitle(b, 'xm'), 'sunlight');
});

test('XM without the magic yields no title rather than 20 bytes of noise', () => {
  assert.equal(embeddedTitle(buf(336, [0, 'not a tracker file!!']), 'xm'), '');
});

test('IT title lives at offset 4 behind "IMPM"', () => {
  assert.equal(embeddedTitle(buf(256, [0, 'IMPM'], [4, 'Lumifluidity']), 'it'), 'Lumifluidity');
  assert.equal(embeddedTitle(buf(256, [0, 'XXXX'], [4, 'Lumifluidity']), 'it'), '');
});

test('S3M checks the SCRM tag at 0x2c; MTM the MTM tag at 0', () => {
  assert.equal(embeddedTitle(buf(0x60, [0, 'some s3m song'], [0x2c, 'SCRM']), 's3m'), 'some s3m song');
  assert.equal(embeddedTitle(buf(0x60, [0, 'some s3m song']), 's3m'), '');
  assert.equal(embeddedTitle(buf(0x60, [0, 'MTM\x10'], [4, 'multitracker']), 'mtm'), 'multitracker');
});

test('an unknown extension has no title layout', () => {
  assert.equal(embeddedTitle(buf(64, [0, 'whatever']), 'opus'), '');
});

test('every MODULE_FORMATS entry has a title reader (no silent fallthrough)', () => {
  // A format libopenmpt decodes but whose header we cannot read would silently fall
  // back to the filename for every file — worth failing on if the list ever grows.
  const probes: Record<string, Uint8Array> = {
    mod: buf(1084, [0, 'title']),
    xm: buf(336, [0, 'Extended Module: '], [17, 'title']),
    s3m: buf(0x60, [0, 'title'], [0x2c, 'SCRM']),
    it: buf(256, [0, 'IMPM'], [4, 'title']),
    stm: buf(64, [0, 'title']),
    mtm: buf(64, [0, 'MTM\x10'], [4, 'title']),
  };
  for (const f of MODULE_FORMATS) {
    assert.equal(embeddedTitle(probes[f]!, f), 'title', `no title reader for .${f}`);
  }
});

// ── naming ──────────────────────────────────────────────────────────────────

test('prettify title-cases separators but leaves internal caps alone', () => {
  assert.equal(prettify('sweet_vibez'), 'Sweet Vibez');
  assert.equal(prettify('adkd_-_absalon_junction'), 'Adkd Absalon Junction');
  assert.equal(prettify('1st fracture'), '1st Fracture');
  assert.equal(prettify('Lumifluidity'), 'Lumifluidity');
  assert.equal(prettify('McSomething'), 'McSomething');
});

test('displayName prefers the header title over the filename', () => {
  const b = buf(1084, [0, 'absalon junction']);
  assert.deepEqual(displayName(b, 'adkd_-_absalon_junction.mod'), { name: 'Absalon Junction', from: 'header' });
});

test('displayName falls back to the prettified filename when the header is empty', () => {
  assert.deepEqual(displayName(buf(1084), '02fd_-_lumifluidity.it'), { name: '02fd Lumifluidity', from: 'filename' });
});

test('slugify produces ids that satisfy the schema pattern under a prefix', () => {
  assert.equal(slugify('Absalon Junction'), 'absalon-junction');
  assert.equal(slugify('|- sunlight -|'), 'sunlight');
  assert.equal(slugify("I'm All About It"), 'i-m-all-about-it'); // matches the existing suse/music id
  assert.ok(ASSET_ID_RE.test(`lolly/modules/${slugify('1st fracture')}`));
});

test('the schema id pattern forbids a hyphen in the FIRST segment', () => {
  // This is why the prefix for the lolly-start brand has to be 'lolly/…'.
  assert.equal(ASSET_ID_RE.test('lolly-start/modules/x'), false);
  assert.equal(ASSET_ID_RE.test('lolly/modules/x'), true);
});

// ── checksum ────────────────────────────────────────────────────────────────

test('sri matches scripts/checksum-assets.ts byte for byte', () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const expected = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
  assert.deepEqual(sri(bytes), { checksum: expected, size: 5 });
  assert.match(sri(bytes).checksum, /^sha256-/); // the schema's own constraint
});

// ── licence refusal ─────────────────────────────────────────────────────────

test('normaliseLicence accepts real licence identifiers', () => {
  assert.equal(normaliseLicence('CC-BY-4.0'), 'CC-BY-4.0');
  assert.equal(normaliseLicence('  CC0-1.0 '), 'CC0-1.0');
  assert.equal(normaliseLicence('LicenseRef-ModArchive-Author-Permission'), 'LicenseRef-ModArchive-Author-Permission');
});

test('normaliseLicence REFUSES absent and placeholder licences', () => {
  // The whole point of the script. A refusal is null; the caller must never emit.
  for (const v of [undefined, '', '   ', 'unknown', 'UNKNOWN', 'none', 'n/a', '?', 'TBD', 'todo', 'unlicensed']) {
    assert.equal(normaliseLicence(v), null, `"${String(v)}" must not be accepted as a licence`);
  }
});

// ── tagging ─────────────────────────────────────────────────────────────────

test('module tags are not neurospicy by default', () => {
  const tags = decideTags('mod', [], false);
  assert.deepEqual(tags, ['audio', 'music', 'module', 'tracker', 'mod']);
  assert.equal(tags.includes('neurospicy'), false);
});

test('--neurospicy opts a batch into the focus-music grouping', () => {
  assert.ok(decideTags('xm', [], true).includes('neurospicy'));
});

test('extra tags are appended without duplicating the defaults', () => {
  assert.deepEqual(decideTags('it', ['music', 'demoscene'], false),
    ['audio', 'music', 'module', 'tracker', 'it', 'demoscene']);
});

// ── description ─────────────────────────────────────────────────────────────

test('the description carries the author credit and the licence', () => {
  const d = buildDescription({ ext: 'mod', author: 'adkd', licence: 'CC-BY-4.0', durationMs: 155520 });
  assert.ok(d.includes('by adkd'), d);
  assert.ok(d.includes('CC-BY-4.0'), d);
  assert.ok(d.includes('156 s'), d);
  assert.ok(d.includes('MOD'), d);
});

test('an anonymous work reads cleanly and still states the licence', () => {
  const d = buildDescription({ ext: 'it', licence: 'CC0-1.0' });
  assert.equal(/\(IT\) by /.test(d), false, d); // no dangling credit clause
  assert.ok(d.startsWith('Tracker module (IT) —'), d);
  assert.ok(d.includes('CC0-1.0'), d);
});

test('a sidecar description overrides the generated one verbatim', () => {
  assert.equal(
    buildDescription({ ext: 'mod', licence: 'CC0-1.0', override: 'Hand-written blurb.' }),
    'Hand-written blurb.',
  );
});
