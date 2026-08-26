// SPDX-License-Identifier: MPL-2.0
/**
 * The catalog index's MOTION resolution (plans/155 WP-5.3).
 * Run with: node --test tests/catalog-index-anim.test.ts
 *
 * `preview` must stay the STILL file and `anim` must be the motion one, because every
 * surface paints `preview` unconditionally and fetches `anim` only on a hover, a focus or
 * the centered tile. The trap this file exists for is `tools/<id>/card.png`: a still PNG
 * and an APNG share the name, the extension and the MIME type, so a resolver that trusts
 * the filename hands the gallery an animated card as its always-loaded thumbnail - which
 * is precisely the "no surface is forced to load motion" rule, broken silently.
 *
 * isAnimatedPng is tested against real byte layouts rather than a fixture file, because
 * chunk ORDER is the whole question: an `acTL` after the first `IDAT` is ignored by
 * decoders, so a file carrying one is a still image no matter what the chunk says.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isAnimatedPng } from '../scripts/build-catalog-index.ts';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A PNG-shaped buffer with the given chunk names in the given order. Only the names
 *  matter here - the sniff reads chunk identity and order, never chunk payloads. */
function png(...chunks: string[]): Buffer {
  return Buffer.concat([PNG_SIG, ...chunks.map((c) => Buffer.from(`\0\0\0\0${c}payload`, 'latin1'))]);
}

let dir: string;
function file(name: string, bytes: Buffer): string {
  dir ??= mkdtempSync(join(tmpdir(), 'lolly-apng-'));
  const p = join(dir, name);
  writeFileSync(p, bytes);
  return p;
}

test('an APNG is recognised by an acTL chunk ahead of the first IDAT', () => {
  assert.equal(isAnimatedPng(file('anim.png', png('IHDR', 'acTL', 'IDAT', 'fdAT', 'IEND'))), true);
});

test('a plain still PNG is not animated', () => {
  assert.equal(isAnimatedPng(file('still.png', png('IHDR', 'IDAT', 'IEND'))), false);
});

test('an acTL AFTER the first IDAT is ignored, exactly as a decoder ignores it', () => {
  assert.equal(isAnimatedPng(file('late.png', png('IHDR', 'IDAT', 'acTL', 'IEND'))), false,
    'a still image whose bytes happen to spell acTL late must not become a tool motion file');
});

test('a missing or unreadable file is simply not animated', () => {
  assert.equal(isAnimatedPng(join(tmpdir(), 'lolly-no-such-card.png')), false);
});

test.after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });
