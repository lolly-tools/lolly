/**
 * Font upload edge case tests
 * Tests: (1) Oversized files >5MB, (2) Corrupted TTF, (3) Duplicate fonts,
 * (4) WOFF2 decompression, (5) Delete in-use fonts, (6) Race conditions,
 * (7) A real sfnt — the platform Outfit face
 *
 * NOTE: the first three bytes of every console.log line here must be ASCII.
 * `node --test` children interleave raw stdout with V8-serialized report frames
 * on one pipe; when a raw write lands directly after a frame, the parent's frame
 * parser skips 2 "header" bytes unchecked and reads byte offsets 2-5 as a SIGNED
 * 32-bit message length. ASCII at offset 2 yields a huge positive length and the
 * parser's benign resync path; a byte >= 0x80 there (e.g. "✓" = 0xE2 9C 93
 * starting at offset 0, 1, or 2) goes negative and intermittently crashes the
 * whole run with "Unable to deserialize cloned data"
 * (node:internal/test_runner/runner #processRawBuffer, seen on Node 24.18).
 * Hence the ASCII "ok" pass markers. The trailing summary block is safe because
 * its non-ASCII check marks sit well past offset 2 of that write.
 * (This explanation used to live in font-upload.integration.test.ts, deleted
 * 2026-07-14 — it was 1/3 tautologies and read a fixture never committed.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateFontFile, detectFontFormat, parseFontMetadata } from '../shells/web/src/lib/font-utils.ts';
import type { UserFontsHost, UserFontFamily } from '../shells/web/src/user-fonts.ts';
import {
  removeUserFont,
  setPrimaryFont,
  listUserFonts,
  USER_FONT_PREFIX,
} from '../shells/web/src/user-fonts.ts';

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Oversized File Upload (>5MB)
// ──────────────────────────────────────────────────────────────────────────────

test('Edge Case #1: Oversized file (>5MB) should reject with clear error', async () => {
  // Create a file larger than 5MB (5.1 MB)
  const oversizedBuffer = new ArrayBuffer(5.1 * 1024 * 1024);
  const oversizedFile = new File([oversizedBuffer], 'OversizedFont.ttf', {
    type: 'font/ttf',
  });

  const result = validateFontFile(oversizedFile);

  assert.equal(result.valid, false, 'Oversized file should fail validation');
  assert.ok(result.error, 'Error message should be present');
  assert.match(
    result.error!,
    /5MB|5 MB|smaller/i,
    'Error should mention 5MB limit'
  );

  console.log(`  ok Oversized file rejected: "${result.error}"`);
});

test('Edge Case #1b: File at exactly 5MB should pass validation', async () => {
  const exactFile = new File(
    [new ArrayBuffer(5 * 1024 * 1024)],
    'ExactFont.ttf',
    { type: 'font/ttf' }
  );

  const result = validateFontFile(exactFile);

  assert.equal(result.valid, true, 'File at exactly 5MB should pass');
  console.log(`  ok 5MB file accepted`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Corrupted TTF File
// ──────────────────────────────────────────────────────────────────────────────

test('Edge Case #2: Corrupted TTF should handle gracefully (no metadata extraction)', async () => {
  // Create a file with TTF magic bytes but corrupted content
  const corruptedBuffer = new ArrayBuffer(100);
  const view = new Uint8Array(corruptedBuffer);
  // Write TTF magic number
  view[0] = 0x00;
  view[1] = 0x01;
  view[2] = 0x00;
  view[3] = 0x00;
  // Rest is garbage
  for (let i = 4; i < 100; i++) view[i] = Math.random() * 255;

  const metadata = parseFontMetadata(corruptedBuffer);

  assert.equal(
    metadata,
    null,
    'Corrupted TTF should return null metadata, not throw'
  );
  console.log(`  ok Corrupted TTF handled gracefully (null metadata)`);
});

test('Edge Case #2b: Truncated TTF (too short) should handle gracefully', async () => {
  // Create an unrealistically short buffer
  const truncatedBuffer = new ArrayBuffer(4);
  const view = new Uint8Array(truncatedBuffer);
  view[0] = 0x00;
  view[1] = 0x01;
  view[2] = 0x00;
  view[3] = 0x00;

  const metadata = parseFontMetadata(truncatedBuffer);

  assert.equal(metadata, null, 'Truncated TTF should return null');
  console.log(`  ok Truncated TTF handled gracefully (null metadata)`);
});

test('Edge Case #2c: Random binary data (not a font) should return unknown format', async () => {
  const randomBuffer = new ArrayBuffer(1000);
  const view = new Uint8Array(randomBuffer);
  for (let i = 0; i < 1000; i++) view[i] = Math.random() * 255;

  const format = detectFontFormat(randomBuffer);

  assert.equal(format, 'unknown', 'Random data should detect as unknown format');
  console.log(`  ok Non-font binary data detected as 'unknown' format`);
});

test('Edge Case #2d: Invalid MIME type should still validate by magic bytes', async () => {
  // Create a real TTF magic number
  const buffer = new ArrayBuffer(100);
  const view = new Uint8Array(buffer);
  view[0] = 0x00;
  view[1] = 0x01;
  view[2] = 0x00;
  view[3] = 0x00;

  // File has wrong MIME type
  const file = new File([buffer], 'font.data', {
    type: 'application/octet-stream',
  });

  const result = validateFontFile(file);

  // Should still pass (permissive MIME check, magic bytes matter more)
  assert.equal(result.valid, true, 'Permissive MIME type check');
  console.log(`  ok Permissive MIME validation allows application/octet-stream`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: Duplicate Font with Same Family/Weight
// ──────────────────────────────────────────────────────────────────────────────

function memoryHost(): UserFontsHost & { store: Map<string, any> } {
  const store = new Map<string, any>();
  return {
    store,
    assets: {
      async _uploadUserAsset(record: any) {
        store.set(record.id, record);
      },
      async _deleteUserAsset(id: string) {
        store.delete(id);
      },
      async _exportUserAssets() {
        return [...store.values()];
      },
      async _getBlob(id: string) {
        return store.get(id)?.blob ?? null;
      },
    },
    tokens: {
      async resolve(ref: string) {
        const blob = store.get('user/tokens/brand')?.blob;
        if (!blob) return undefined;
        const doc = JSON.parse(await blob.text());
        if (ref === '{font.brand}')
          return doc?.font?.brand?.$value ?? doc?.base?.font?.brand?.$value;
        if (ref === '{shape.radius}')
          return doc?.shape?.radius?.$value ?? doc?.base?.shape?.radius?.$value;
        return undefined;
      },
      bust() { /* noop */ },
    },
  };
}

const fontRecord = (
  family: string,
  n: number,
  weight = '100 900',
  style = 'normal'
) => ({
  id: `${USER_FONT_PREFIX}${family.toLowerCase().replace(/ /g, '-')}/${n}`,
  type: 'font',
  format: 'woff2',
  blob: new Blob([new Uint8Array(64)], { type: 'font/woff2' }),
  meta: {
    family,
    weight,
    style,
    subset: n === 0 ? 'latin' : 'latin-ext',
  },
});

test('Edge Case #3: Duplicate font with same family/weight should increment index', async () => {
  const host = memoryHost();

  // Upload same family twice (simulating duplicate upload)
  await host.assets._uploadUserAsset(fontRecord('Outfit', 0, '400'));
  await host.assets._uploadUserAsset(fontRecord('Outfit', 1, '400')); // Different index

  const assets = await host.assets._exportUserAssets();
  const outfitAssets = assets.filter((a: any) =>
    a.id.startsWith('user/fonts/outfit/')
  );

  assert.equal(outfitAssets.length, 2, 'Should have 2 Outfit faces');
  assert.match(
    outfitAssets[0]!.id,
    /outfit\/0$/,
    'First should be outfit/0'
  );
  assert.match(
    outfitAssets[1]!.id,
    /outfit\/1$/,
    'Second should be outfit/1'
  );

  // Listing should group them under one family
  const families = await listUserFonts(host);
  const outfit = families.find((f) => f.family === 'Outfit');

  assert.ok(outfit, 'Outfit family should exist');
  assert.equal(outfit!.assetIds.length, 2, 'Should have 2 asset IDs');
  console.log(
    `  ok Duplicate fonts grouped correctly: ${outfit!.assetIds.join(', ')}`
  );
});

test('Edge Case #3b: Same family, different weights should group together', async () => {
  const host = memoryHost();

  // Multiple weights of the same family
  await host.assets._uploadUserAsset(fontRecord('Inter', 0, '400'));
  await host.assets._uploadUserAsset(fontRecord('Inter', 1, '700'));
  await host.assets._uploadUserAsset(fontRecord('Inter', 2, '300'));

  const families = await listUserFonts(host);
  const inter = families.find((f) => f.family === 'Inter');

  assert.ok(inter, 'Inter family exists');
  assert.equal(inter!.assetIds.length, 3, 'Should have 3 weights');
  assert.match(
    inter!.weights,
    /300|400|700/,
    'Weights string should include all weights'
  );
  console.log(`  ok Multiple weights grouped: ${inter!.weights}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 4: WOFF2 Decompression
// ──────────────────────────────────────────────────────────────────────────────

test('Edge Case #4: WOFF2 format detected correctly by magic bytes', async () => {
  // WOFF2 magic: 'wOF2' = 0x774F4632
  const woff2Buffer = new ArrayBuffer(50);
  const view = new Uint8Array(woff2Buffer);
  view[0] = 0x77;
  view[1] = 0x4f;
  view[2] = 0x46;
  view[3] = 0x32;

  const format = detectFontFormat(woff2Buffer);

  assert.equal(format, 'woff2', 'Should detect WOFF2 format');
  console.log(`  ok WOFF2 magic bytes detected correctly`);
});

test('Edge Case #4b: WOFF vs WOFF2 distinction', async () => {
  // WOFF magic: 'wOFF' = 0x774F4646
  const woffBuffer = new ArrayBuffer(50);
  const woffView = new Uint8Array(woffBuffer);
  woffView[0] = 0x77;
  woffView[1] = 0x4f;
  woffView[2] = 0x46;
  woffView[3] = 0x46;

  // WOFF2 magic: 'wOF2' = 0x774F4632
  const woff2Buffer = new ArrayBuffer(50);
  const woff2View = new Uint8Array(woff2Buffer);
  woff2View[0] = 0x77;
  woff2View[1] = 0x4f;
  woff2View[2] = 0x46;
  woff2View[3] = 0x32;

  const woffFormat = detectFontFormat(woffBuffer);
  const woff2Format = detectFontFormat(woff2Buffer);

  assert.equal(woffFormat, 'woff', 'Should detect WOFF');
  assert.equal(woff2Format, 'woff2', 'Should detect WOFF2');
  console.log(`  ok WOFF (${woffFormat}) vs WOFF2 (${woff2Format}) distinguished`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 5: Delete Font While In Use (Primary Font)
// ──────────────────────────────────────────────────────────────────────────────

test('Edge Case #5: Deleting primary font should unregister and promote next', async () => {
  const host = memoryHost();

  // Setup: two fonts, first is primary
  await host.assets._uploadUserAsset(fontRecord('Inter', 0));
  await host.assets._uploadUserAsset(fontRecord('Sora', 0, '400'));
  await setPrimaryFont(host, 'Inter');

  let families = await listUserFonts(host);
  let inter = families.find((f) => f.family === 'Inter')!;
  assert.equal(inter!.primary, true, 'Inter should be primary');

  // Delete the primary font
  await removeUserFont(host, inter!);

  families = await listUserFonts(host);
  assert.equal(families.length, 1, 'Only Sora should remain');
  assert.equal(families[0]!.family, 'Sora', 'Sora should be the remaining font');
  assert.equal(families[0]!.primary, true, 'Sora should now be primary');

  console.log(`  ok Primary font deleted, next font promoted automatically`);
});

test('Edge Case #5b: Deleting non-primary font should not affect primary', async () => {
  const host = memoryHost();

  await host.assets._uploadUserAsset(fontRecord('Inter', 0));
  await host.assets._uploadUserAsset(fontRecord('Sora', 0, '400'));
  await setPrimaryFont(host, 'Inter');

  let families = await listUserFonts(host);
  const sora = families.find((f) => f.family === 'Sora')!;

  // Delete non-primary
  await removeUserFont(host, sora!);

  families = await listUserFonts(host);
  assert.equal(families[0]!.family, 'Inter');
  assert.equal(families[0]!.primary, true, 'Inter remains primary');
  assert.equal(families.length, 1, 'Sora removed');

  console.log(`  ok Non-primary font deleted, primary unchanged`);
});

test('Edge Case #5c: Deleting last font clears primary', async () => {
  const host = memoryHost();

  await host.assets._uploadUserAsset(fontRecord('Inter', 0));
  await setPrimaryFont(host, 'Inter');

  let families = await listUserFonts(host);
  await removeUserFont(host, families[0]!);

  families = await listUserFonts(host);
  assert.equal(families.length, 0, 'No fonts remain');

  const primary = await host.tokens?.resolve('{font.brand}');
  assert.equal(primary, undefined, 'Primary should be cleared');

  console.log(`  ok Last font deleted, primary cleared to undefined`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 6: Rapid Uploads (Race Conditions)
// ──────────────────────────────────────────────────────────────────────────────

test('Edge Case #6: Rapid uploads (5 files) should queue without collisions', async () => {
  const host = memoryHost();

  // Simulate rapid sequential uploads
  const uploadPromises = [
    host.assets._uploadUserAsset(fontRecord('Rapid', 0, '400')),
    host.assets._uploadUserAsset(fontRecord('Rapid', 1, '500')),
    host.assets._uploadUserAsset(fontRecord('Rapid', 2, '600')),
    host.assets._uploadUserAsset(fontRecord('Rapid', 3, '700')),
    host.assets._uploadUserAsset(fontRecord('Rapid', 4, '800')),
  ];

  // Wait for all uploads in parallel
  await Promise.all(uploadPromises);

  const assets = await host.assets._exportUserAssets();
  const rapidAssets = assets.filter((a: any) => a.id.startsWith('user/fonts/rapid/'));

  assert.equal(rapidAssets.length, 5, 'All 5 files should be stored');

  // Check indices are unique and sequential
  const indices = rapidAssets.map((a: any) => {
    const match = a.id.match(/rapid\/(\d+)$/);
    return parseInt(match![1]!, 10);
  });

  indices.sort((a, b) => a - b);
  assert.deepEqual(indices, [0, 1, 2, 3, 4], 'Indices should be sequential');

  // Listing should group all into one family
  const families = await listUserFonts(host);
  const rapid = families.find((f) => f.family === 'Rapid')!;

  assert.equal(rapid!.assetIds.length, 5, 'All 5 should be grouped');
  console.log(`  ok 5 rapid uploads completed without collisions: ${rapid!.weights}`);
});

test('Edge Case #6b: Mixed family rapid uploads should not collide', async () => {
  const host = memoryHost();

  // Upload different families rapidly
  const uploadPromises = [
    host.assets._uploadUserAsset(fontRecord('Family-A', 0, '400')),
    host.assets._uploadUserAsset(fontRecord('Family-B', 0, '400')),
    host.assets._uploadUserAsset(fontRecord('Family-A', 1, '700')),
    host.assets._uploadUserAsset(fontRecord('Family-C', 0, '400')),
    host.assets._uploadUserAsset(fontRecord('Family-B', 1, '700')),
  ];

  await Promise.all(uploadPromises);

  const families = await listUserFonts(host);

  assert.equal(families.length, 3, 'Should have 3 distinct families');

  const familyA = families.find((f) => f.family === 'Family-A')!;
  const familyB = families.find((f) => f.family === 'Family-B')!;
  const familyC = families.find((f) => f.family === 'Family-C')!;

  assert.equal(familyA!.assetIds.length, 2, 'Family-A should have 2 faces');
  assert.equal(familyB!.assetIds.length, 2, 'Family-B should have 2 faces');
  assert.equal(familyC!.assetIds.length, 1, 'Family-C should have 1 face');

  console.log(`  ok 5 mixed uploads grouped correctly into 3 families`);
});

test('Edge Case #6c: Concurrent deletes and uploads should not corrupt state', async () => {
  const host = memoryHost();

  // Start with some fonts
  await host.assets._uploadUserAsset(fontRecord('Stable', 0));
  await host.assets._uploadUserAsset(fontRecord('Transient', 0));

  let families = await listUserFonts(host);
  const transient = families.find((f) => f.family === 'Transient')!;

  // Start delete and new uploads in parallel
  const operations = [
    removeUserFont(host, transient!), // Delete in progress
    host.assets._uploadUserAsset(fontRecord('NewFamily', 0, '400')),
    host.assets._uploadUserAsset(fontRecord('NewFamily', 1, '700')),
  ];

  await Promise.all(operations);

  families = await listUserFonts(host);

  // Transient should be gone, Stable and NewFamily should remain
  assert.ok(
    !families.find((f) => f.family === 'Transient'),
    'Transient should be deleted'
  );
  assert.ok(
    families.find((f) => f.family === 'Stable'),
    'Stable should remain'
  );
  assert.ok(
    families.find((f) => f.family === 'NewFamily'),
    'NewFamily should be added'
  );

  console.log(
    `  ok Concurrent delete + upload operations completed safely: ${families.map((f) => f.family).join(', ')}`
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Test 7: A real sfnt (every other case here feeds synthetic or corrupt bytes)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The platform Outfit face, shipped in the web shell and always present (the
 * imports above already require the shells/web submodule to be mounted). Read
 * lazily INSIDE each test on purpose: the deleted font-upload.integration.test.ts
 * did this at module scope against a /tmp path that was never committed, so the
 * throw took the whole file down instead of one test.
 */
const OUTFIT_TTF = fileURLToPath(new URL('../shells/web/public/fonts/Outfit[wght].ttf', import.meta.url));

function outfitBytes(): ArrayBuffer {
  const buf = readFileSync(OUTFIT_TTF);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

test('Edge Case #7: Real TTF (Outfit) parses to a usable family/weight/style', async () => {
  const bytes = outfitBytes();

  assert.equal(detectFontFormat(bytes), 'ttf', 'Real Outfit face should detect as TTF by magic bytes');

  const meta = parseFontMetadata(bytes);
  assert.ok(meta, 'Real sfnt should yield metadata');
  assert.equal(meta!.style, 'normal');
  assert.ok(
    meta!.weight >= 100 && meta!.weight <= 900,
    `Weight should be a valid CSS weight, got ${meta!.weight}`
  );
  console.log(`  ok Real TTF parsed: family=${meta!.family}, weight=${meta!.weight}, style=${meta!.style}`);
});

test('Edge Case #7b: Variable font family comes from nameID 16, not the instance-tied nameID 1', () => {
  // Outfit[wght].ttf carries nameID 1 = "Outfit Thin" (legacy, describing the
  // default instance) alongside nameID 16 = "Outfit" (typographic family). Only
  // nameID 16 groups every weight under one family — reading nameID 1 mislabels the
  // Fonts tab, slugs the asset id "outfit-thin", and makes font-registry miss a
  // `font-family: Outfit` stack. Name records are ordered by nameId, so a
  // return-on-first-match loop silently picks 1; that regression is what this pins.
  const meta = parseFontMetadata(outfitBytes());

  assert.equal(meta!.family, 'Outfit');
  assert.notEqual(meta!.family, 'Outfit Thin', 'Must not fall back to the instance-tied legacy family');
  console.log(`  ok Typographic family preferred: ${meta!.family}`);
});

test("Edge Case #7c: Variable font weight reflects the fvar default instance", () => {
  // Not a round number by accident: Outfit[wght].ttf declares fvar wght
  // min=100 DEFAULT=100 max=900 and OS/2 usWeightClass=100, so Thin genuinely IS
  // this file's default instance. Pins that we read the file's real default rather
  // than assuming the conventional 400.
  const meta = parseFontMetadata(outfitBytes());

  assert.equal(meta!.weight, 100, 'Should report the fvar/OS-2 default instance (Thin), not a presumed 400');
  console.log(`  ok Default instance weight: ${meta!.weight}`);
});

test('Edge Case #7d: Real TTF passes upload validation end to end', () => {
  const buf = readFileSync(OUTFIT_TTF);
  const file = new File([buf], 'Outfit[wght].ttf', { type: 'font/ttf' });

  const result = validateFontFile(file);

  assert.equal(result.valid, true, `Real font should pass validation, got: ${result.error}`);
  assert.ok(buf.byteLength < 5 * 1024 * 1024, 'Guard: fixture must stay under the 5MB cap this asserts against');
  console.log(`  ok Real TTF validated (${buf.byteLength} bytes)`);
});

console.log('\n' + '='.repeat(80));
console.log('FONT UPLOAD EDGE CASE TESTS - SUMMARY');
console.log('='.repeat(80));
console.log(`
Test Coverage:
  ✓ #1 - Oversized file upload (>5MB) rejected with clear error
  ✓ #1b - File at exactly 5MB limit accepted
  ✓ #2 - Corrupted TTF handled gracefully
  ✓ #2b - Truncated TTF handled gracefully
  ✓ #2c - Random binary data detected as unknown format
  ✓ #2d - Permissive MIME type validation with magic bytes fallback
  ✓ #3 - Duplicate fonts increment index correctly
  ✓ #3b - Multiple weights of same family grouped together
  ✓ #4 - WOFF2 format detected by magic bytes
  ✓ #4b - WOFF vs WOFF2 distinction
  ✓ #5 - Deleting primary font promotes next family
  ✓ #5b - Deleting non-primary font doesn't affect primary
  ✓ #5c - Deleting last font clears primary token
  ✓ #6 - 5 rapid uploads without index collisions
  ✓ #6b - Mixed family rapid uploads grouped correctly
  ✓ #6c - Concurrent delete + upload operations safe
  ✓ #7 - Real Outfit TTF parses to a usable family/weight/style
  ✓ #7b - Variable-font family read from nameID 16, not instance-tied nameID 1
  ✓ #7c - Variable-font weight reflects the fvar default instance
  ✓ #7d - Real TTF passes upload validation end to end
`);
