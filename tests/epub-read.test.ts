// SPDX-License-Identifier: MPL-2.0
/**
 * epub-read.test.ts - round-trips writeEpub → readEpub.
 *
 * We build a REAL .epub with the existing writer (its OCF zip, container.xml,
 * OPF spine and nav are the genuine article), then assert readEpub recovers the
 * chapter count, titles and body text as markdown, in reading order.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { writeEpub } from '../engine/src/epub.ts';
import { readEpub } from '../engine/src/epub-read.ts';

test('readEpub round-trips a two-chapter book from writeEpub', () => {
  const doc = {
    title: 'Brand Voice Handbook',
    author: 'Acme',
    chapters: [
      {
        title: 'Our Promise',
        xhtml:
          '<h1>Our Promise</h1>\n' +
          '<p>We ship <strong>on-brand</strong> assets, <em>fast</em>.</p>\n' +
          '<p>Simple in, polished out.</p>',
      },
      {
        title: 'Voice &amp; Tone',
        xhtml:
          '<h1>Voice &amp; Tone</h1>\n' +
          '<p>Say it plainly.</p>\n' +
          '<ul><li>Be warm</li><li>Be exact</li></ul>',
      },
    ],
  };

  const bytes = writeEpub(doc);
  assert.ok(bytes instanceof Uint8Array && bytes.length > 0, 'writeEpub produced bytes');

  const read = readEpub(bytes);

  // Book title.
  assert.equal(read.title, 'Brand Voice Handbook');

  // Chapter count + reading order preserved.
  assert.equal(read.chapters.length, 2);

  // Titles: first chapter from its <h1>; second decodes the entity in title/nav.
  assert.equal(read.chapters[0]!.title, 'Our Promise');
  assert.equal(read.chapters[1]!.title, 'Voice & Tone');

  // Body text, markdown-normalized.
  assert.equal(
    read.chapters[0]!.markdown,
    '# Our Promise\n\nWe ship **on-brand** assets, _fast_.\n\nSimple in, polished out.',
  );
  assert.equal(
    read.chapters[1]!.markdown,
    '# Voice & Tone\n\nSay it plainly.\n\n- Be warm\n- Be exact',
  );
});

test('readEpub falls back to the nav/TOC label when a chapter has no heading', () => {
  const doc = {
    title: 'Snippets',
    chapters: [
      { title: 'Legal Footer', xhtml: '<p>Copyright Acme. All rights reserved.</p>' },
    ],
  };

  const read = readEpub(writeEpub(doc));
  assert.equal(read.chapters.length, 1);
  // No <h1> in the body → title comes from the nav TOC label writeEpub emitted.
  assert.equal(read.chapters[0]!.title, 'Legal Footer');
  assert.equal(read.chapters[0]!.markdown, 'Copyright Acme. All rights reserved.');
});

test('readEpub rejects a non-EPUB byte blob', () => {
  assert.throws(() => readEpub(new Uint8Array([1, 2, 3, 4])), /zip|EPUB/i);
});
