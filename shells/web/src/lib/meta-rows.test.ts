// SPDX-License-Identifier: MPL-2.0
/**
 * lib/meta-rows.ts - the glyph before each details label, and the order rows take
 * in the asset inspector's merged Details list.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/meta-rows.test.ts
 *
 * Pinned here: the glyph follows the row's key and never its translated label, an
 * unknown key draws the neutral dot rather than leaving a gap, the glyph is hidden
 * from assistive technology while the label stays text, and facts that arrive after
 * the list is drawn join it at their rank without repeating a row already shown.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { icon } from './icons.ts';
import { META_KEYS, metaGlyph, metaRank, metaRow, metaTwin, mergeMetaRows } from './meta-rows.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const doc = dom.window.document;

const list = (html: string): HTMLElement => {
  const dl = doc.createElement('dl');
  dl.innerHTML = html;
  return dl as unknown as HTMLElement;
};
const keys = (dl: HTMLElement): Array<string | null> => [...dl.children].map(row => row.getAttribute('data-meta'));

test('the glyph comes from the key, so a translated label draws the same one', () => {
  const english = metaRow('fileSize', 'File size', '12 KB');
  const german = metaRow('fileSize', 'Dateigröße', '12 KB');
  const glyph = (html: string): string => html.slice(html.indexOf('<svg'), html.indexOf('</svg>') + 6);
  assert.equal(glyph(english), glyph(german));
  assert.equal(glyph(english), icon('hardDrive', { className: 'cat-meta-icon' }));
});

test('the glyph is decoration and the label stays readable text', () => {
  const row = list(metaRow('licence', 'Licence', 'CC BY 4.0')).firstElementChild!;
  const dt = row.querySelector('dt')!;
  assert.equal(dt.querySelector('svg')?.getAttribute('aria-hidden'), 'true');
  assert.equal(dt.textContent, 'Licence');
  assert.equal(row.getAttribute('data-meta'), 'licence');
});

test('an unknown key draws the neutral dot, and a continuation row draws nothing', () => {
  assert.equal(metaGlyph('not-a-key'), icon('dot', { className: 'cat-meta-icon' }));
  assert.equal(metaGlyph(null), icon('dot', { className: 'cat-meta-icon' }));
  assert.doesNotMatch(metaRow(null, '', 'and 3 more'), /<svg/);
});

test('labels are escaped and values are passed through as the caller built them', () => {
  const html = metaRow('credit', 'A <b>label</b>', '<code>id</code>', 'class="x"');
  assert.match(html, /A &lt;b&gt;label&lt;\/b&gt;/);
  assert.match(html, /<dd class="x"><code>id<\/code><\/dd>/);
});

test('the Details order leads with what it is, its size, its dates and its rights, and ends with the id', () => {
  const order = ['category', 'format', 'dimensions', 'fileSize', 'added', 'licence', 'tags', 'camera', 'codec', 'id'] as const;
  const ranks = order.map(metaRank);
  assert.deepEqual([...ranks].sort((a, b) => a - b), ranks);
  assert.ok(metaRank('nonsense') > metaRank('id'), 'an unknown row goes last');
});

test('late facts join at their rank, refresh a row already shown and never repeat one', () => {
  const dl = list(metaRow('category', 'Category', 'Logos') + metaRow('format', 'Format', 'SVG')
    + metaRow('added', 'Added', 'Oct 1, 2026') + metaRow('licence', 'Licence', 'CC0') + metaRow('id', 'ID', '<code>x</code>'));
  const added = mergeMetaRows(dl, [
    { key: 'fileSize', label: 'File size', value: '19 KB' },
    { key: 'dimensions', label: 'Dimensions', value: '512 × 512' },
    { key: 'viewBox', label: 'viewBox', value: '0 0 512 512' },
    { key: 'format', label: 'Format', value: 'SVG' },
    { key: 'dimensions', label: 'Dimensions', value: '1 × 1' },
  ]);
  assert.deepEqual(keys(dl), ['category', 'format', 'dimensions', 'fileSize', 'added', 'licence', 'viewBox', 'id']);
  assert.equal(added.length, 3, 'Format was already shown and the second Dimensions repeats the first');
  assert.equal(dl.querySelector('[data-meta="dimensions"] dd')?.textContent, '512 × 512');
  assert.equal(dl.querySelectorAll('[data-meta="format"]').length, 1);

  // A measured value replaces a recorded one in place, so the row does not move.
  const before = dl.querySelector('[data-meta="fileSize"]');
  mergeMetaRows(dl, [{ key: 'fileSize', label: 'File size', value: '20 KB' }]);
  assert.equal(dl.querySelector('[data-meta="fileSize"]'), before);
  assert.equal(before?.querySelector('dd')?.textContent, '20 KB');
});

test('a late fact that only repeats its twin row is left out, and kept when it says something new', () => {
  assert.equal(metaTwin('imported'), 'added');
  assert.equal(metaTwin('author'), 'artist');
  assert.equal(metaTwin('format'), null);
  const dl = list(metaRow('format', 'Format', 'JPG') + metaRow('added', 'Added', 'Oct 31, 2026') + metaRow('id', 'ID', 'x'));
  mergeMetaRows(dl, [{ key: 'imported', label: 'Imported', value: 'Oct 31, 2026' }]);
  assert.equal(dl.querySelector('[data-meta="imported"]'), null, 'an upload imported the day it was added shows one date');
  mergeMetaRows(dl, [{ key: 'imported', label: 'Imported', value: 'Sep 2, 2026' }]);
  assert.ok(dl.querySelector('[data-meta="imported"]'), 'a different import date is a different fact');
  mergeMetaRows(dl, [{ key: 'artist', label: 'Artist', value: 'The Band' }, { key: 'author', label: 'Artist / author', value: 'The Band' }]);
  assert.equal(dl.querySelector('[data-meta="author"]'), null);
});

test('rows of the Details list keep distinct glyphs, except pairs that never meet on one asset', () => {
  // A shared glyph is only allowed where the two rows describe different kinds of
  // asset: an emoji set's release, a skill's revision and a song's year; an emoji
  // set's glyph count and a photo's resolution; coverage and an audio bitrate; a
  // clip's duration and a photo's exposure; a skill's steward and an import's author.
  const allowed = new Set(['release,revision,year', 'glyphs,resolution', 'bitrate,coverage', 'duration,exposure', 'author,steward']);
  const byGlyph = new Map<string, string[]>();
  for (const key of META_KEYS) {
    if (metaRank(key) >= 1000) continue;
    const glyph = metaGlyph(key);
    byGlyph.set(glyph, [...(byGlyph.get(glyph) ?? []), key]);
  }
  const shared = [...byGlyph.values()].filter(keys => keys.length > 1).map(keys => [...keys].sort().join(','));
  assert.deepEqual(shared.filter(group => !allowed.has(group)), []);
});
