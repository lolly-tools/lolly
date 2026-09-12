// SPDX-License-Identifier: MPL-2.0
/**
 * provenance-defaults.ts pins the ONE policy for whether an export gets
 * Content Credentials (C2PA) and the Lolly Imprint watermark when the caller
 * (URL mode, CLI flags) said nothing. Before this module the web shell and
 * CLI could answer differently for the same tool; these tests pin the two
 * gates (`render.c2pa: false`, `privacy: 'on-device'`) and the format lists
 * so that guarantee cannot silently regress in either direction.
 *
 * Run with: node --test tests/provenance-defaults.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  c2paDefaultOn,
  imprintDefaultOn,
  IMPRINT_FORMATS,
  isImprintFormat,
  IMPRINT_CONTAINER_FORMATS,
  isImprintContainerFormat,
  type ProvenanceManifest,
} from '../engine/src/provenance-defaults.ts';

function manifest(overrides: Partial<ProvenanceManifest> = {}): ProvenanceManifest {
  return { render: { formats: ['png'] }, ...overrides };
}

test('c2paDefaultOn is true when the manifest says nothing', () => {
  assert.equal(c2paDefaultOn(manifest()), true);
});

test('c2paDefaultOn is off for an on-device tool regardless of render.c2pa', () => {
  assert.equal(c2paDefaultOn(manifest({ privacy: 'on-device' })), false);
  assert.equal(c2paDefaultOn(manifest({ privacy: 'on-device', render: { c2pa: true } })), false);
});

test('c2paDefaultOn honors an explicit per-tool opt-out', () => {
  assert.equal(c2paDefaultOn(manifest({ render: { c2pa: false } })), false);
});

test('c2paDefaultOn stays on when render.c2pa is explicitly true', () => {
  assert.equal(c2paDefaultOn(manifest({ render: { c2pa: true } })), true);
});

test('imprintDefaultOn is the same gate as c2paDefaultOn (the two marks are complements)', () => {
  for (const m of [
    manifest(),
    manifest({ privacy: 'on-device' }),
    manifest({ render: { c2pa: false } }),
    manifest({ render: { c2pa: true } }),
  ]) {
    assert.equal(imprintDefaultOn(m), c2paDefaultOn(m));
  }
});

test('IMPRINT_FORMATS lists exactly the raster formats plus the three container formats', () => {
  assert.deepEqual(
    [...IMPRINT_FORMATS].sort(),
    ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'bmp', 'pdf', 'pdf-cmyk', 'pptx'].sort(),
  );
});

test('isImprintFormat is case-insensitive and rejects unknown/missing formats', () => {
  assert.equal(isImprintFormat('PNG'), true);
  assert.equal(isImprintFormat('png'), true);
  assert.equal(isImprintFormat('svg'), false);
  assert.equal(isImprintFormat(undefined), false);
  assert.equal(isImprintFormat(null), false);
  assert.equal(isImprintFormat(''), false);
});

test('IMPRINT_CONTAINER_FORMATS is a subset of IMPRINT_FORMATS limited to pdf/pdf-cmyk/pptx', () => {
  assert.deepEqual([...IMPRINT_CONTAINER_FORMATS].sort(), ['pdf', 'pdf-cmyk', 'pptx']);
  for (const f of IMPRINT_CONTAINER_FORMATS) assert.ok(IMPRINT_FORMATS.includes(f));
});

test('isImprintContainerFormat separates containers (image-only mark) from true raster formats', () => {
  assert.equal(isImprintContainerFormat('pdf'), true);
  assert.equal(isImprintContainerFormat('PPTX'), true);
  assert.equal(isImprintContainerFormat('png'), false);
  assert.equal(isImprintContainerFormat(undefined), false);
});
