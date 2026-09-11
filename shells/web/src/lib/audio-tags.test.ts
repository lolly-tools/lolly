// SPDX-License-Identifier: MPL-2.0
/**
 * buildAudioTags - ExportMeta → mediabunny MetadataTags for the muxed audio
 * exports (plans/153, plan 144 WP-D). Pure structural mapping; the injected date
 * keeps it deterministic.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/audio-tags.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAudioTags } from './audio-tags.ts';
import type { ExportMeta } from '@lolly-tools/core/host-v1';

const full: ExportMeta = {
  software: 'Lolly',
  source: 'https://lolly.tools',
  tool: 'Audiogram',
  author: 'Jane Doe',
  contact: 'jane@example.com · +1 555 0100',
  description: 'Made with Lolly',
  copyright: '© 2026 Jane Doe. All rights reserved.',
  license: 'CC BY 4.0',
};

test('maps the core fields to normalized tags', () => {
  const date = new Date('2026-08-26T00:00:00Z');
  const tags = buildAudioTags(full, date);
  assert.equal(tags.title, 'Audiogram');
  assert.equal(tags.artist, 'Jane Doe');
  assert.equal(tags.album, 'Lolly');
  // comment carries description · contact · copyright · license (rights have no
  // normalized mediabunny slot, so they fold into the comment, as the WAV path joins them).
  assert.equal(tags.comment, 'Made with Lolly · jane@example.com · +1 555 0100 · © 2026 Jane Doe. All rights reserved. · CC BY 4.0');
  assert.equal(tags.date, date);
});

test('date is omitted when not injected (no clock read in the mapping)', () => {
  const tags = buildAudioTags(full);
  assert.equal('date' in tags, false);
});

test('empty ExportMeta fields are omitted, not written blank', () => {
  const bare: ExportMeta = {
    software: 'Lolly', source: 'https://lolly.tools', tool: 'Audiogram',
    author: '', contact: '', description: '',
  };
  const tags = buildAudioTags(bare);
  assert.equal(tags.title, 'Audiogram');
  assert.equal(tags.album, 'Lolly');
  assert.equal('artist' in tags, false);
  assert.equal('comment' in tags, false);
});

test('comment falls back to description alone when contact is empty', () => {
  // Isolate the contact-empty fallback: no rights either, so the comment is the
  // description alone (rights-folding has its own test).
  const tags = buildAudioTags({ ...full, contact: '', copyright: '', license: '' });
  assert.equal(tags.comment, 'Made with Lolly');
});

test('rights fields have no normalized slot yet (followup)', () => {
  const tags = buildAudioTags(full) as Record<string, unknown>;
  assert.equal('copyright' in tags, false);
  assert.equal('license' in tags, false);
});
