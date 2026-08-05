// SPDX-License-Identifier: MPL-2.0
/**
 * ingest-epub — the pure EPUB → boilerplate-text-asset transform, proven against a
 * real EPUB built by the engine's own writeEpub and read back by readEpub.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { writeEpub, readEpub } from '../engine/src/index.ts';
import { buildBoilerplate, mergeBoilerplateIndex, slugForTitle } from '../scripts/ingest-epub.ts';

test('slugForTitle: ascii kebab, diacritics stripped, non-empty fallback', () => {
  assert.equal(slugForTitle('Lizenz'), 'lizenz');
  assert.equal(slugForTitle('Über die Färbe!'), 'uber-die-farbe');
  assert.equal(slugForTitle('  '), 'chapter');
});

test('buildBoilerplate: one text asset per non-empty chapter, stable ids, checksums', () => {
  const epub = writeEpub({
    title: 'Brand Voice',
    chapters: [
      { title: 'Mission', xhtml: '<h1>Mission</h1><p>We make on-brand assets.</p>' },
      { title: 'Legal', xhtml: '<h1>Legal</h1><p>All rights reserved.</p>' },
      { title: 'Empty', xhtml: '<p></p>' },
    ],
  });
  const doc = readEpub(epub);
  const out = buildBoilerplate(doc, 'acme');

  assert.ok(out.length >= 2, 'at least the two non-empty chapters');
  assert.ok(!out.some((o) => /empty/i.test(o.slug) && o.bytes.length <= 1), 'empty chapter skipped');
  const first = out[0]!;
  assert.equal(first.record.type, 'text');
  assert.equal(first.record.tier, 'catalog');
  assert.deepEqual(first.record.tags, ['boilerplate', 'text']);
  assert.match(first.record.id, /^acme\/boilerplate\//);
  assert.equal(first.record.formats[0]!.format, 'md');
  assert.match(first.record.formats[0]!.url, /^\/catalog\/assets\/acme\/boilerplate\//);
  assert.match(first.record.formats[0]!.checksum, /^sha256-/);
  assert.equal(first.record.formats[0]!.size, first.bytes.length);
});

test('buildBoilerplate: duplicate chapter titles get unique -N slugs', () => {
  const out = buildBoilerplate(
    { title: 'T', chapters: [{ title: 'Note', markdown: 'a' }, { title: 'Note', markdown: 'b' }] },
    'acme',
  );
  const slugs = out.map((o) => o.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique');
  assert.deepEqual(slugs, ['note', 'note-2']);
});

test('mergeBoilerplateIndex: replaces prior boilerplate, keeps other assets, is idempotent', () => {
  const records = buildBoilerplate(
    { title: 'T', chapters: [{ title: 'One', markdown: 'x' }] },
    'acme',
  ).map((o) => o.record);
  const index = {
    version: '1',
    generatedAt: '',
    assets: [
      { id: 'acme/tokens/brand' },
      { id: 'acme/boilerplate/stale' }, // a prior run's entry — must be dropped
    ],
  };
  const merged = mergeBoilerplateIndex(index, 'acme', records);
  const ids = merged.assets.map((a) => a.id);
  assert.ok(ids.includes('acme/tokens/brand'), 'non-boilerplate asset kept');
  assert.ok(!ids.includes('acme/boilerplate/stale'), 'stale boilerplate replaced');
  assert.ok(ids.includes('acme/boilerplate/one'), 'new boilerplate added');
  // Idempotent: merging the same records again yields the same id set.
  const again = mergeBoilerplateIndex(merged, 'acme', records);
  assert.deepEqual(again.assets.map((a) => a.id).sort(), ids.sort());
});
