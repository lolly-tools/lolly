// SPDX-License-Identifier: MPL-2.0
/**
 * The asset picker's format and embeddability rules (views/picker-formats.ts).
 *
 * views/picker.ts is 3,155 lines with only picker-initial-tab.test.ts against it
 * (maintainability-2026-07-29.md item 2). These rules decide what an upload is
 * STORED as and which tools can be embedded, so the cases that matter are the
 * aliases and the fallbacks - the branches that are invisible on inspection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extFromMime, audioFormatOf, formatsForType, isEmbeddable, imageFormatSeed, relTime,
  VIDEO_FMTS, RASTER_MOTION_FMTS, IMG_FORMATS,
} from './picker-formats.ts';

// A translator that renders the key with its vars, so assertions read literally.
const t = (key: string, vars?: Record<string, string | number>): string =>
  key.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? ''));

// ── extFromMime ──────────────────────────────────────────────────────────────

test('extFromMime maps the common image and video mimes', () => {
  const cases: [string, string][] = [
    ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif'],
    ['image/avif', 'avif'], ['image/tiff', 'tiff'], ['image/svg+xml', 'svg'],
    ['application/json', 'json'], ['video/webm', 'webm'], ['video/mp4', 'mp4'],
  ];
  for (const [mime, ext] of cases) assert.equal(extFromMime(mime), ext, mime);
});

test('extFromMime folds the alias pairs onto one extension', () => {
  // jpeg/jpg and heic/heif are the same file to a user; storing them under two
  // extensions splits the catalogue for no reason.
  assert.equal(extFromMime('image/jpeg'), 'jpg');
  assert.equal(extFromMime('image/jpg'), 'jpg');
  assert.equal(extFromMime('image/heic'), 'heic');
  assert.equal(extFromMime('image/heif'), 'heic');
  assert.equal(extFromMime('video/quicktime'), 'mov');
  assert.equal(extFromMime('video/x-m4v'), 'mp4');
});

test('extFromMime matches on a SUBSTRING, so mime parameters do not defeat it', () => {
  // Real uploads arrive as `image/jpeg; charset=binary` and vendor-prefixed types.
  assert.equal(extFromMime('image/jpeg; charset=binary'), 'jpg');
  assert.equal(extFromMime('image/vnd.mozilla.apng'), 'png');
});

test('extFromMime returns bin for an unknown or empty mime', () => {
  assert.equal(extFromMime(''), 'bin');
  assert.equal(extFromMime('application/octet-stream'), 'bin');
  assert.equal(extFromMime('application/x-thing'), 'bin');
});

test('svg is matched before png, so image/svg+xml is not mis-read', () => {
  // Ordering guard: an svg mime containing neither "png" nor "jpeg" is fine, but
  // the ladder's order matters for any future mime that contains both.
  assert.equal(extFromMime('image/svg+xml'), 'svg');
});

// ── audioFormatOf ────────────────────────────────────────────────────────────

test('the filename extension wins over the mime type', () => {
  // Browsers disagree on audio mimes; the extension is what the user chose.
  assert.equal(audioFormatOf({ name: 'take.opus', type: 'audio/ogg' }), 'opus');
  assert.equal(audioFormatOf({ name: 'take.flac', type: 'application/octet-stream' }), 'flac');
});

test('.oga normalises to ogg', () => {
  assert.equal(audioFormatOf({ name: 'a.oga', type: '' }), 'ogg');
});

test('the extension match is case-insensitive', () => {
  assert.equal(audioFormatOf({ name: 'LOUD.WAV', type: '' }), 'wav');
});

test('with no usable extension the mime ladder decides', () => {
  assert.equal(audioFormatOf({ name: 'blob', type: 'audio/mpeg' }), 'mp3');
  assert.equal(audioFormatOf({ name: 'blob', type: 'audio/wav' }), 'wav');
  assert.equal(audioFormatOf({ name: 'blob', type: 'audio/opus' }), 'opus');
  assert.equal(audioFormatOf({ name: 'blob', type: 'audio/ogg' }), 'ogg');
  assert.equal(audioFormatOf({ name: 'blob', type: 'audio/aac' }), 'aac');
  assert.equal(audioFormatOf({ name: 'blob', type: 'audio/flac' }), 'flac');
  assert.equal(audioFormatOf({ name: 'blob', type: 'audio/mp4' }), 'm4a');
});

test('opus is tested before ogg, so an audio/opus file is not stored as ogg', () => {
  // Both strings can appear together; the more specific must win.
  assert.equal(audioFormatOf({ name: 'x', type: 'audio/opus; codecs=opus' }), 'opus');
});

test('an unrecognisable audio file falls back to mp3, never to bin', () => {
  // A wrong-but-playable extension beats an opaque .bin the user cannot open.
  assert.equal(audioFormatOf({ name: 'recording', type: '' }), 'mp3');
  assert.equal(audioFormatOf({ name: 'recording', type: 'application/octet-stream' }), 'mp3');
});

test('a non-audio mime that extFromMime DOES know is used verbatim', () => {
  assert.equal(audioFormatOf({ name: 'weird', type: 'video/webm' }), 'webm');
});

// ── formatsForType ───────────────────────────────────────────────────────────

test('a vector slot narrows to svg', () => {
  assert.deepEqual(formatsForType(['png', 'svg', 'pdf'], 'vector'), ['svg']);
});

test('a motion slot keeps video AND raster-motion formats', () => {
  assert.deepEqual(formatsForType(['png', 'webm', 'gif', 'mp4', 'apng'], 'video'),
    ['webm', 'gif', 'mp4', 'apng']);
  assert.deepEqual(formatsForType(['png', 'gif'], 'lottie'), ['gif']);
});

test('an ordinary slot drops true video but keeps animated rasters', () => {
  // gif/apng are stills-with-motion and remain valid in an image slot.
  assert.deepEqual(formatsForType(['png', 'webm', 'mp4', 'gif'], 'raster'), ['png', 'gif']);
});

test('every branch falls back to the full list rather than to nothing', () => {
  // An empty format list is a dead end in the UI; degrading to "show everything"
  // is the deliberate choice in all three branches.
  assert.deepEqual(formatsForType(['png', 'pdf'], 'vector'), ['png', 'pdf']);
  assert.deepEqual(formatsForType(['png', 'pdf'], 'video'), ['png', 'pdf']);
  assert.deepEqual(formatsForType(['webm', 'mp4'], 'raster'), ['webm', 'mp4']);
});

test('an unknown or missing type takes the ordinary branch', () => {
  assert.deepEqual(formatsForType(['png', 'mp4'], undefined), ['png']);
  assert.deepEqual(formatsForType(['png', 'mp4'], 'palette'), ['png']);
});

// ── isEmbeddable ─────────────────────────────────────────────────────────────

test('a tool must be exportable AND emit an image format', () => {
  assert.equal(isEmbeddable({ exportable: true, formats: ['png'] }, false), true);
  assert.equal(isEmbeddable({ exportable: false, formats: ['png'] }, false), false);
  assert.equal(isEmbeddable({ exportable: true, formats: ['pdf', 'ics'] }, false), false);
});

test('a vector slot demands svg specifically', () => {
  assert.equal(isEmbeddable({ exportable: true, formats: ['png', 'webp'] }, true), false);
  assert.equal(isEmbeddable({ exportable: true, formats: ['png', 'svg'] }, true), true);
});

test('a manifest that merely omits `exportable` is NOT embeddable', () => {
  // `!== true`, not a falsy test: absent means unknown, and unknown must not be
  // treated as permission.
  assert.equal(isEmbeddable({ formats: ['png'] }, false), false);
});

test('a missing tool, or a non-array formats field, is handled without throwing', () => {
  assert.equal(isEmbeddable(undefined, false), false);
  assert.equal(isEmbeddable({ exportable: true }, false), false);
  assert.equal(isEmbeddable({ exportable: true, formats: 'png' as unknown as string[] }, false), false);
});

test('format matching is case-insensitive', () => {
  assert.equal(isEmbeddable({ exportable: true, formats: ['PNG'] }, false), true);
  assert.equal(isEmbeddable({ exportable: true, formats: ['SVG'] }, true), true);
});

// ── imageFormatSeed ──────────────────────────────────────────────────────────

test('an image format seeds the render card; anything else does not', () => {
  assert.equal(imageFormatSeed('png'), 'png');
  assert.equal(imageFormatSeed('svg'), 'svg');
  assert.equal(imageFormatSeed('pdf'), undefined);
  assert.equal(imageFormatSeed(undefined), undefined);
  assert.equal(imageFormatSeed(null), undefined);
  assert.equal(imageFormatSeed(42), undefined);
});

test('jpeg normalises to jpg so the seed matches the ids the picker offers', () => {
  assert.equal(imageFormatSeed('jpeg'), 'jpg');
  assert.equal(imageFormatSeed('JPEG'), 'jpg');
});

// ── relTime ──────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-07-30T12:00:00Z');
const ago = (ms: number): string => relTime(new Date(NOW - ms).toISOString(), NOW, t);
const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

test('relTime picks the right unit at each band', () => {
  assert.equal(ago(5 * SEC), 'just now');
  assert.equal(ago(5 * MIN), '5m ago');
  assert.equal(ago(5 * HOUR), '5h ago');
  assert.equal(ago(3 * DAY), '3d ago');
  assert.equal(ago(14 * DAY), '2w ago');
  assert.equal(ago(60 * DAY), '2mo ago');
  assert.equal(ago(400 * DAY), '1y ago');
});

test('relTime boundaries land on the larger unit, not the smaller', () => {
  assert.equal(ago(60 * SEC), '1m ago');
  assert.equal(ago(60 * MIN), '1h ago');
  assert.equal(ago(24 * HOUR), '1d ago');
  assert.equal(ago(7 * DAY), '1w ago');
});

test('an absent or unparseable timestamp yields an empty string, not "NaN ago"', () => {
  assert.equal(relTime(undefined, NOW, t), '');
  assert.equal(relTime('', NOW, t), '');
  assert.equal(relTime('not a date', NOW, t), '');
});

test('a FUTURE timestamp clamps to "just now" rather than counting backwards', () => {
  // Clock skew, or a session file copied from another machine.
  assert.equal(relTime(new Date(NOW + 10 * DAY).toISOString(), NOW, t), 'just now');
});

// ── the format sets ──────────────────────────────────────────────────────────

test('the video and raster-motion sets are disjoint', () => {
  for (const f of VIDEO_FMTS) assert.equal(RASTER_MOTION_FMTS.has(f), false, f);
});

test('no true video format is treated as an embeddable image', () => {
  for (const f of VIDEO_FMTS) assert.equal(IMG_FORMATS.has(f), false, f);
});
