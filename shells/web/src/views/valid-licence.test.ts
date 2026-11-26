// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FileMetadata } from '@lolly/engine';
import { licenceBand, licenceBandHtml } from './valid-licence.ts';

const none = { found: false, state: 'none' as const, trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, checks: [] };
const meta = (fields: Array<{ label: string; value: string; source?: string }>): FileMetadata =>
  ({ format: 'jpeg', fields: fields.map((f) => ({ group: 'authorship', ...f })) }) as unknown as FileMetadata;

test('a known licence leads with its marks, plain conditions, where it was found and a credit line', () => {
  const file = meta([
    { label: 'Licence', value: 'https://creativecommons.org/licenses/by-sa/4.0/', source: 'XMP/RDF cc:license' },
    { label: 'Artist', value: 'Jo Example' },
  ]);
  const band = licenceBand(none, file, 'photo.jpg');
  assert.equal(band.state, 'stated');
  assert.equal(band.statements[0]!.name, 'CC BY-SA 4.0');
  assert.deepEqual(band.statements[0]!.marks, ['BY', 'SA']);
  assert.deepEqual(band.statements[0]!.conditions, ['Attribution', 'ShareAlike']);
  assert.equal(band.statements[0]!.reviewed, true);
  assert.deepEqual(band.statements[0]!.where, [{ source: 'XMP/RDF cc:license', strength: 'stated' }]);
  assert.equal(band.creator, 'Jo Example');
  assert.equal(band.creditLine, 'photo.jpg by Jo Example. CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)');
  const html = licenceBandHtml(none, file, 'photo.jpg');
  assert.match(html, /data-finding-section="licence"/);
  assert.match(html, /Credit the creator\./);
  assert.match(html, /Share adaptations under the same licence\./);
  assert.match(html, /Stated in the file/);
  assert.match(html, /Declared terms\. Permission to reuse is not verified\./);
});

test('two different licences are a disagreement, listed side by side, with no credit line to copy', () => {
  const file = meta([
    { label: 'Licence', value: 'https://creativecommons.org/licenses/by/4.0/', source: 'XMP/RDF cc:license' },
    { label: 'Rights statement', value: 'https://creativecommons.org/publicdomain/zero/1.0/', source: 'XMP/RDF xmpRights:WebStatement' },
  ]);
  const band = licenceBand(none, file);
  assert.equal(band.state, 'disagree');
  assert.deepEqual(band.statements.map((s) => s.name), ['CC BY 4.0', 'CC0 1.0']);
  assert.deepEqual(band.statements[1]!.marks, ['0']);
  assert.equal(band.creditLine, '');
  const html = licenceBandHtml(none, file);
  assert.match(html, /Two statements disagree\. Each is listed as recorded\./);
  assert.doesNotMatch(html, /Copy credit line/);
});

test('NonCommercial and NoDerivatives are named as stated conditions and not interpreted', () => {
  const file = meta([{ label: 'Licence', value: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' }]);
  const band = licenceBand(none, file);
  assert.deepEqual(band.statements[0]!.marks, ['BY', 'NC', 'ND']);
  assert.equal(band.statements[0]!.reviewed, false);
  const html = licenceBandHtml(none, file);
  assert.match(html, /NonCommercial is a stated condition\./);
  assert.match(html, /NoDerivatives is a stated condition\./);
  assert.match(html, /Lolly records these conditions and does not interpret them\./);
});

test('a free-text statement stays words, and nothing recorded says so without implying permission', () => {
  const stated = licenceBand(none, meta([{ label: 'Copyright', value: '(c) 2026 Jo Example' }]));
  assert.equal(stated.state, 'stated');
  assert.equal(stated.statements[0]!.id, null);
  assert.deepEqual(stated.statements[0]!.marks, []);
  assert.equal(stated.creditLine, '');
  const html = licenceBandHtml(none, undefined);
  assert.match(html, /No licence recorded\. That does not mean free to use\./);
  assert.match(html, /data-finding-section="licence"/, 'the band is drawn even when nothing is recorded');
});

test('a credential states its strength, and recorded sources are totalled by licence', () => {
  const report = {
    ...none, found: true, state: 'valid' as const,
    checks: [{ code: 'assertion.dataHash.match', ok: true }, { code: 'claimSignature.validated', ok: true }],
    licence: { url: 'https://creativecommons.org/licenses/by/4.0/', attributionName: 'Ada' },
    ingredients: [
      { title: 'a', rights: { license: 'CC-BY-4.0' } },
      { title: 'b', rights: { license: 'CC BY 4.0' } },
      { title: 'c', rights: { license: 'OFL-1.1' } },
      { title: 'd' },
    ],
  };
  const band = licenceBand(report, undefined, 'poster.png');
  assert.equal(band.statements[0]!.where[0]!.source, 'C2PA licence terms');
  assert.notEqual(band.statements[0]!.where[0]!.strength, 'stated');
  assert.equal(band.creator, 'Ada');
  assert.equal(band.sourceCount, 3);
  assert.deepEqual(band.sources[0], { name: 'CC BY 4.0', count: 2 });
  assert.match(licenceBandHtml(report, undefined, 'poster.png'), /3 sources: 2 CC BY 4\.0, 1 /);
});

test('the band never uses the banned rights wording, and escapes what a file states', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const html = licenceBandHtml(none, meta([{ label: 'Copyright', value: hostile }, { label: 'Artist', value: hostile }]), hostile);
  assert.doesNotMatch(html, /<img/);
  for (const banned of [/copyright verified/i, /legally safe/i, /fully cleared/i, /rights cleared/i, /royalty-free/i]) assert.doesNotMatch(html, banned);
});
