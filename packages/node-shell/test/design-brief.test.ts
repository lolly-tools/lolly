// SPDX-License-Identifier: MPL-2.0
/**
 * The Node reader behind the design brief (plan 291 W3): the content profile's head
 * token document and its catalog facts, read on the public lolly-start profile, and
 * null rather than an exception where no profile resolves.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readProfileBriefCatalog, readProfileTokenDocument } from '../src/design-brief.ts';
import { contentRoots } from '../src/content-roots.ts';

test('the lolly-start profile answers with its head tokens asset and label', () => {
  const tokens = readProfileTokenDocument({ profile: 'lolly-start' });
  assert.ok(tokens, 'lolly-start resolves in a public checkout');
  assert.equal(tokens.profile, 'lolly-start');
  assert.equal(tokens.tokensAsset, 'lolly/tokens/brand');
  assert.equal(tokens.label, contentRoots({ profile: 'lolly-start' }).label);
  assert.ok(tokens.label, 'profiles.json states a label');
  assert.ok(tokens.doc && typeof tokens.doc === 'object');
});

test('the catalog facts carry the listing, the master, its logos and the palettes the pack ships', () => {
  const catalog = readProfileBriefCatalog({ profile: 'lolly-start' });
  assert.ok(catalog);
  assert.equal(catalog.profile, 'lolly-start');
  assert.equal(catalog.tokensAsset, 'lolly/tokens/brand');
  assert.ok(catalog.assets!.some((a) => a.id === 'lolly/tokens/brand' && a.type === 'tokens'));
  assert.ok(catalog.assets!.every((a) => Array.isArray(a.tags)), 'tags are always a list');
  assert.equal(catalog.master?.id, 'lolly/slides/neutral');
  assert.equal(catalog.masterAsset, 'lolly/slides/masters');
  assert.equal(catalog.logos?.onLight, 'lolly/logo/primary');
  assert.ok(catalog.photoTreatments, 'lolly-start ships a photo-treatments palette');
  assert.equal(catalog.iconThemes, undefined, 'lolly-start ships no icon themes');
});

test('no profile here: both readers return null, never throw', () => {
  const empty = mkdtempSync(join(tmpdir(), 'lolly-brief-root-'));
  try {
    assert.equal(readProfileTokenDocument({ root: empty }), null);
    assert.equal(readProfileBriefCatalog({ root: empty }), null);
    assert.equal(readProfileTokenDocument({ profile: 'no-such-profile' }), null);
  } finally { rmSync(empty, { recursive: true, force: true }); }
});
