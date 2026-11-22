// SPDX-License-Identifier: MPL-2.0
/**
 * Picture references for saved work (plan 373, engine/src/session-preview.ts) and
 * the session record's format 5 (engine/src/session-record.ts).
 *
 * The reference is what a record carries in place of a data URL, so it is read
 * from untrusted storage (a backup, a `.lolly`, another device's sync record):
 * the reader must be total, and the key must be the content's own hash so two
 * equal pictures are one entry and a picture can never be swapped under a key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readPreviewRef, previewContentKey, decodePictureDataUrl, pictureDataUrl, pictureSize, pictureMatchesType,
  previewRefFor, previewFileExt, PREVIEW_MAX_BYTES, PREVIEW_TYPES,
  sessionWork, sessionWorkKey, previewLinkName, readPreviewLink, readPreviewLinks, withPreviewLink, mayHaveLostPicture, PREVIEW_LINK_ENTRIES,
} from '../engine/src/session-preview.ts';
import {
  sessionPreviewRef, migrateSessionRecord, SESSION_FORMAT_VERSION, SESSION_READER_VERSION, sessionVersionStamp,
} from '../engine/src/session-record.ts';

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const pngBytes = (): Uint8Array => Uint8Array.from(atob(PNG_1x1), c => c.charCodeAt(0));
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="#0c322c"/><text x="10" y="40">Grüße &amp; ☃</text></svg>';

test('the content key is the SHA-256 of the bytes, first 16 bytes, and equal bytes give one key', async () => {
  const a = await previewContentKey(pngBytes());
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(await previewContentKey(pngBytes()), a, 'stable for the same bytes');
  const other = pngBytes(); other[other.length - 5] = other[other.length - 5]! ^ 1;
  assert.notEqual(await previewContentKey(other), a, 'one changed byte is another key');
  // Independent of how the bytes arrived: the same picture as two data URL forms.
  const fromBase64 = decodePictureDataUrl(`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(SVG)))}`)!;
  const fromPercent = decodePictureDataUrl(`data:image/svg+xml,${encodeURIComponent(SVG)}`)!;
  assert.equal(await previewContentKey(fromBase64.bytes), await previewContentKey(fromPercent.bytes));
});

test('a data URL round-trips to the exact text a pre-373 thumbnail writer produced', () => {
  const png = `data:image/png;base64,${PNG_1x1}`;
  const decoded = decodePictureDataUrl(png)!;
  assert.equal(decoded.type, 'image/png');
  assert.equal(pictureDataUrl(decoded.bytes, decoded.type), png, 'base64 raster unchanged');
  const svg = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
  const back = decodePictureDataUrl(svg)!;
  assert.equal(back.form, 'percent');
  assert.equal(pictureDataUrl(back.bytes, back.type), svg, 'percent-encoded SVG unchanged, non-ASCII included');
  const b64svg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(SVG)))}`;
  const b = decodePictureDataUrl(b64svg)!;
  assert.equal(pictureDataUrl(b.bytes, b.type, b.form), b64svg, 'a base64 SVG kept in its own form');
});

test('junk data URLs read as absent, never throw', () => {
  for (const junk of [null, 42, '', 'https://example.com/a.png', 'data:text/html,<script>', 'data:image/png;base64,%%%', 'data:image/svg+xml,%E0%A4%A', 'data:image/bmp;base64,AAAA', 'data:image/png;base64,']) {
    assert.equal(decodePictureDataUrl(junk), null, String(junk));
  }
  assert.equal(decodePictureDataUrl('data:image/jpg;base64,/9j/')?.type, 'image/jpeg', 'jpg is jpeg');
});

test('readPreviewRef is total over untrusted rows', () => {
  const good = { key: 'a'.repeat(32), type: 'image/webp', width: 720, height: 560, route: 'export-raster', bytes: 1234 };
  assert.deepEqual(readPreviewRef(good), good);
  assert.equal(readPreviewRef({ ...good, key: 'A'.repeat(32) }), null, 'upper-case hex is not a key');
  assert.equal(readPreviewRef({ ...good, key: 'a'.repeat(31) }), null);
  assert.equal(readPreviewRef({ ...good, type: 'image/bmp' }), null);
  assert.equal(readPreviewRef({ ...good, type: 'text/html' }), null);
  assert.equal(readPreviewRef({ ...good, width: -1 }), null);
  assert.equal(readPreviewRef({ ...good, width: 1.5 }), null);
  assert.equal(readPreviewRef({ ...good, height: 1e9 }), null);
  assert.equal(readPreviewRef([good]), null);
  assert.equal(readPreviewRef('x'), null);
  const loose = readPreviewRef({ ...good, route: 'resvg', recipe: 'not-hex', bytes: -3 })!;
  assert.equal(loose.route, undefined, 'an unknown route is dropped, the reference kept');
  assert.equal(loose.recipe, undefined);
  assert.equal(loose.bytes, undefined);
});

test('pictureSize reads headers without a decoder', async () => {
  assert.deepEqual(pictureSize(pngBytes(), 'image/png'), { width: 1, height: 1 });
  assert.deepEqual(pictureSize(new TextEncoder().encode(SVG), 'image/svg+xml'), { width: 640, height: 480 });
  assert.deepEqual(pictureSize(new TextEncoder().encode('<svg viewBox="0 0 300 150"></svg>'), 'image/svg+xml'), { width: 300, height: 150 });
  assert.deepEqual(pictureSize(new TextEncoder().encode('<svg width="100%"></svg>'), 'image/svg+xml'), { width: 0, height: 0 });
  // A VP8X WebP header: canvas 720 x 560 (stored minus one, 24-bit little endian).
  const webp = new Uint8Array(30);
  webp.set([...'RIFF'].map(c => c.charCodeAt(0)), 0); webp.set([...'WEBP'].map(c => c.charCodeAt(0)), 8); webp.set([...'VP8X'].map(c => c.charCodeAt(0)), 12);
  webp.set([719 & 255, 719 >> 8, 0], 24); webp.set([559 & 255, 559 >> 8, 0], 27);
  assert.deepEqual(pictureSize(webp, 'image/webp'), { width: 720, height: 560 });
  assert.equal(pictureMatchesType(webp, 'image/webp'), true);
  assert.equal(pictureMatchesType(pngBytes(), 'image/webp'), false, 'a renamed file is not the type it claims');
  assert.equal(pictureMatchesType(new TextEncoder().encode('<html><svg>'), 'image/png'), false);
});

test('previewRefFor refuses bytes that are not the type they claim, and records the route', async () => {
  assert.equal(await previewRefFor(new TextEncoder().encode(SVG), 'image/png', { route: 'received' }), null);
  const ref = (await previewRefFor(pngBytes(), 'image/png', { route: 'legacy' }))!;
  assert.equal(ref.route, 'legacy');
  assert.equal(ref.bytes, pngBytes().length);
  assert.equal(ref.key, await previewContentKey(pngBytes()));
  assert.equal(previewFileExt('image/svg+xml'), 'svg');
  assert.equal(previewFileExt('image/jpeg'), 'jpg');
  assert.equal(PREVIEW_MAX_BYTES, 256 * 1024);
  assert.ok(PREVIEW_TYPES.includes('image/webp'));
});

test('session format 5: the record carries an optional preview reference, read totally', () => {
  assert.equal(SESSION_FORMAT_VERSION, 5);
  assert.equal(SESSION_READER_VERSION, 5);
  assert.equal(sessionVersionStamp().formatVersion, 5);
  const preview = { key: 'b'.repeat(32), type: 'image/svg+xml', width: 10, height: 10 };
  assert.deepEqual(sessionPreviewRef({ preview }), preview);
  assert.equal(sessionPreviewRef({ preview: { key: 'nope' } }), null);
  assert.equal(sessionPreviewRef({}), null);
  assert.equal(sessionPreviewRef(null), null);
});

test('format 5 is additive: data reads the same, and a format 4 reader would see a newer record as-is', () => {
  const data = { title: 'hi', __toolId: 'poster' };
  const v5 = { slot: 'a', data, thumb: null, preview: { key: 'c'.repeat(32), type: 'image/webp', width: 1, height: 1 }, formatVersion: 5 };
  assert.equal(migrateSessionRecord(v5), data, 'the picture is not part of the data');
  const v4 = { slot: 'a', data, thumb: `data:image/png;base64,${PNG_1x1}`, formatVersion: 4 };
  assert.equal(migrateSessionRecord(v4), data, 'a format 4 record with a thumb loads unchanged');
  const warnings: string[] = [];
  const v6 = { ...v5, formatVersion: 6 };
  assert.equal(migrateSessionRecord(v6, (_l, m) => warnings.push(m)), data, 'a record from a newer app is read as-is');
  assert.equal(warnings.length, 1);
});

test('a picture link is keyed by the work, which a rename leaves alone, and read totally', async () => {
  const work = { __toolId: 'poster', title: 'a', __label: 'One', __export_filename: 'one' };
  assert.equal(sessionWork(work), JSON.stringify({ __toolId: 'poster', title: 'a' }));
  const key = await sessionWorkKey(work);
  assert.match(key, /^[0-9a-f]{32}$/);
  assert.equal(await sessionWorkKey({ ...work, __label: 'Renamed', __export_filename: 'renamed' }), key, 'a rename keeps the key');
  assert.notEqual(await sessionWorkKey({ ...work, title: 'b' }), key, 'changed work is another key');
  assert.equal(previewLinkName(key), `w-${key}.ref`);
  const ref = { key: 'd'.repeat(32), type: 'image/webp' as const, width: 720, height: 560 };
  const other = { ...ref, key: 'e'.repeat(32) };
  // One entry per session: a session gets its own back; a copy (a new slot) the newest.
  let text = withPreviewLink(null, 'poster:1', ref);
  text = withPreviewLink(text, 'poster:imported', other);
  assert.deepEqual(readPreviewLink(text, 'poster:1'), ref, 'a rename of poster:1 gets its own picture, not the newer import');
  assert.deepEqual(readPreviewLink(text, 'poster:copy'), other, 'a copy gets the newest picture of the same document');
  assert.equal(withPreviewLink(text, 'poster:1', ref).length, withPreviewLink(withPreviewLink(text, 'poster:1', ref), 'poster:1', ref).length, 'setting an entry again does not grow the link');
  for (let i = 0; i < 40; i++) text = withPreviewLink(text, `poster:${i + 10}`, other);
  assert.equal(readPreviewLinks(text)!.length, PREVIEW_LINK_ENTRIES, 'bounded');
  for (const junk of [null, 1, '', '{', '[]', JSON.stringify(ref), JSON.stringify({ v: 1, slots: [['poster:1', { ...ref, key: 'x' }]] }), 'x'.repeat(70000)]) assert.equal(readPreviewLink(junk, 'poster:1'), null);
  assert.equal(mayHaveLostPicture({ formatVersion: 4, thumb: null }), true, 'a format 4 record with no picture');
  assert.equal(mayHaveLostPicture({ thumb: null }), true, 'a record from before version stamps');
  assert.equal(mayHaveLostPicture({ formatVersion: 5, thumb: null }), false, 'a format 5 record with no picture has none');
  assert.equal(mayHaveLostPicture({ formatVersion: 4, thumb: 'data:image/png;base64,AA==' }), false);
  assert.equal(mayHaveLostPicture({ formatVersion: 4, preview: ref }), false);
});
