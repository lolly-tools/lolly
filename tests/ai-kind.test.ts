// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the DigitalSourceType -> AI-kind lookup that both C2PA manifest reading
 * (c2pa-extract.ts) and XMP/EXIF sidecar reading (file-metadata.ts) share, so
 * an AI-provenance badge means the same thing whether it came from a signed
 * manifest or a plain metadata tag. The precedence rule (generated outranks
 * composite) is asserted by both callers' own comments, so it is pinned here
 * once rather than drifting between the two call sites.
 * Run: node --test tests/ai-kind.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aiKind } from '../engine/src/ai-kind.ts';

test('recognises the two known IPTC DigitalSourceType slugs', () => {
  assert.equal(aiKind('trainedAlgorithmicMedia'), 'generated');
  assert.equal(aiKind('compositeWithTrainedAlgorithmicMedia'), 'composite');
});

test('accepts a full IRI and reads the trailing slug', () => {
  assert.equal(aiKind('http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia'), 'generated');
  assert.equal(aiKind('https://example.org/x/y/compositeWithTrainedAlgorithmicMedia'), 'composite');
});

test('unknown or unrelated source types map to undefined', () => {
  assert.equal(aiKind('digitalCapture'), undefined);
  assert.equal(aiKind('http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture'), undefined);
  assert.equal(aiKind(''), undefined);
});

test('non-string and nullish input is undefined, not a throw', () => {
  assert.equal(aiKind(undefined), undefined);
  assert.equal(aiKind(null), undefined);
  assert.equal(aiKind(42), undefined);
  assert.equal(aiKind({}), undefined);
});

test('a trailing slash yields an empty final segment, not the previous one', () => {
  assert.equal(aiKind('http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia/'), undefined);
});
