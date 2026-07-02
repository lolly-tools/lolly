// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marksToCsv, marksFromCsv, extFor, fmtLabel, isCmykFmt, isPrintFmt, DEFAULT_PRINT_MARKS } from './constants.ts';

test('marksFromCsv parses the canonical short tokens', () => {
  assert.deepEqual(marksFromCsv('crop,reg,bleed,bars,prov'), {
    crop: true, registration: true, bleed: true, colorBars: true, provenance: true,
  });
});

test('marksFromCsv accepts the long-form aliases', () => {
  assert.deepEqual(marksFromCsv('registration,colorbars,provenance'), {
    crop: false, registration: true, bleed: false, colorBars: true, provenance: true,
  });
});

test('marksFromCsv returns null for empty / nullish input', () => {
  assert.equal(marksFromCsv(''), null);
  assert.equal(marksFromCsv(null), null);
  assert.equal(marksFromCsv(undefined), null);
});

test('marksToCsv is a round-trip of marksFromCsv', () => {
  const parsed = marksFromCsv('crop,reg,bleed,bars,prov');
  assert.equal(marksToCsv(parsed), 'crop,reg,bleed,bars,prov');
});

test('marksToCsv drops unset flags and returns "" for nullish', () => {
  assert.equal(marksToCsv({ crop: true, provenance: true }), 'crop,prov');
  assert.equal(marksToCsv(null), '');
});

test('extFor maps known format ids to their download extension', () => {
  assert.equal(extFor('jpeg', null), 'jpg');
  assert.equal(extFor('pdf-cmyk', null), 'pdf');
  assert.equal(extFor('cmyk-tiff', null), 'tiff');
  assert.equal(extFor('eps-cmyk', null), 'eps');
});

test('extFor falls back to the format id when unmapped', () => {
  assert.equal(extFor('png', null), 'png');
  assert.equal(extFor('svg', null), 'svg');
});

test('extFor trusts the produced blob MIME over the requested video format', () => {
  assert.equal(extFor('webm', { type: 'video/mp4' }), 'mp4');
  assert.equal(extFor('mp4', { type: 'video/webm' }), 'webm');
  assert.equal(extFor('mp4', { type: 'video/mp4' }), 'mp4');
});

test('fmtLabel returns the human label or an uppercased fallback', () => {
  assert.equal(fmtLabel('pdf-cmyk'), 'Print PDF');
  assert.equal(fmtLabel('jpeg'), 'JPG');
  assert.equal(fmtLabel('png'), 'PNG');
});

test('isCmykFmt / isPrintFmt classify formats', () => {
  assert.equal(isCmykFmt('pdf-cmyk'), true);
  assert.equal(isCmykFmt('pdf'), false);
  assert.equal(isPrintFmt('pdf'), true);
  assert.equal(isPrintFmt('cmyk-tiff'), true);
  assert.equal(isPrintFmt('png'), false);
});

test('DEFAULT_PRINT_MARKS matches the shipped defaults', () => {
  assert.deepEqual(DEFAULT_PRINT_MARKS, {
    crop: true, registration: true, bleed: true, colorBars: false, provenance: true,
  });
});
