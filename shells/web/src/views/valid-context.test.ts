// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordedLinks, recordedContacts, contextCardsHtml, locationCardHtml } from './valid-context.ts';
import { renderMetadata } from './valid-metadata.ts';
import { contactUrl, contactLinkHtml } from './valid-links.ts';
import type { VerifyReport } from './valid-verdict.ts';
import type { FileMetadata } from '@lolly/engine';
const report: VerifyReport = { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, delivered: false, format: 'svg', checks: [] };

test('contact destinations cannot supply email headers, extra recipients or dial commands', () => {
  for (const value of ['mailto:ada@example.org?bcc=spy@example.org', 'mailto:ada@example.org%0aBCC:spy@example.org', 'ada@example.org,spy@example.org', 'tel:+447123456789;123', 'tel:*123#', 'tel:123', 'tel:123\n4567']) assert.equal(contactUrl(value), null, value);
  assert.equal(contactUrl('Ada@example.org'), 'mailto:Ada@example.org');
  assert.equal(contactUrl('+44 (7123) 456-789'), 'tel:+447123456789');
  assert.ok(contactLinkHtml('Ada@example.org').includes('data-metadata-url="mailto:Ada@example.org"'));
});

test('links keep exact destinations, deduplicate and scope auxiliary evidence', () => {
  const meta: FileMetadata = { format: 'JPEG', fields: [{ group: 'description', label: 'Link', value: 'https://example.org/full/path?a=1&b=2#part' }, { group: 'description', label: 'Source', value: 'See https://example.org/full/path?a=1&b=2#part' }], appended: { kind: 'gain map', bytes: 50, offset: 100, metadata: { name: 'Apple HDR gain map', xmp: '', fields: [{ group: 'description', label: 'Source', value: 'https://aux.example.org/' }] } } };
  const links = recordedLinks(meta);
  assert.equal(links.length, 2);
  assert.equal(links[0]!.url, 'https://example.org/full/path?a=1&b=2#part');
  assert.deepEqual(links[0]!.sources, ['Link', 'Source']);
  assert.match(links[1]!.sources[0]!, /^Apple HDR gain map:/);
  assert.ok(contextCardsHtml(report, meta).includes('data-copy-evidence'));
});

test('metadata creator, signed author and contacts mentioned in prose remain distinct', () => {
  const meta: FileMetadata = { format: 'SVG', fields: [{ group: 'authorship', label: 'Creator', value: 'Metadata Ada' }, { group: 'authorship', label: 'Contact email', value: 'ada@example.org' }, { group: 'description', label: 'Comment', value: 'Ask another@example.org about this file' }] };
  const contacts = recordedContacts({ ...report, found: true, author: { name: 'Signed Sam', email: 'sam@example.org' } }, meta);
  assert.equal(contacts.length, 3);
  assert.deepEqual(contacts[0]!.values, ['sam@example.org']);
  assert.deepEqual(contacts[1]!.values, ['ada@example.org']);
  assert.equal(contacts[2]!.role, 'Contact mentioned');
  assert.equal(contacts[2]!.name, 'another@example.org');
});

test('contact fields do not guess which of several creators they belong to', () => {
  const meta: FileMetadata = { format: 'SVG', fields: [{ group: 'authorship', label: 'Creator', value: 'Ada' }, { group: 'authorship', label: 'Author', value: 'Sam' }, { group: 'authorship', label: 'Contact email', value: 'studio@example.org' }] };
  const contacts = recordedContacts(report, meta);
  assert.deepEqual(contacts.slice(0, 2).map((c) => c.values), [[], []]);
  assert.equal(contacts[2]!.name, 'Recorded contact');
});

test('locations render offline, expose coordinates and guard invalid fixes', () => {
  const meta: FileMetadata = { format: 'JPEG', fields: [], gps: { lat: 42.695, lon: 23.332 }, mapUrl: 'https://www.openstreetmap.org/?mlat=42.695&mlon=23.332' };
  const html = locationCardHtml(meta);
  assert.ok(html.includes('42.69500, 23.33200'));
  assert.ok(html.includes('<svg') && html.includes('data-metadata-url'));
  assert.ok(!html.includes('<img'));
  assert.equal(locationCardHtml({ ...meta, gps: { lat: NaN, lon: 0 } }), '');
});


test('unsupported link schemes remain visible as inert metadata', () => {
  const html = renderMetadata({ format: 'PDF', fields: [
    { group: 'structure', label: 'Link', value: 'javascript:alert(1)' },
    { group: 'structure', label: 'Link', value: 'mailto:ada@example.org' },
    { group: 'structure', label: 'Link', value: 'tel:+447123456789' },
  ] }, 0);
  assert.ok(html.includes('javascript:alert(1)'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('data-metadata-url="mailto:ada@example.org"'));
  assert.ok(html.includes('data-metadata-url="tel:+447123456789"'));
});

test('the creator and the licence link are said once: Licence shows them, so Personal data does not', () => {
  const fields = [
    { group: 'authorship', label: 'Creator', value: 'Jo Example' },
    { group: 'authorship', label: 'Licence', value: 'https://creativecommons.org/licenses/by/4.0/', source: 'XMP/RDF cc:license' },
    { group: 'description', label: 'Source', value: 'https://example.org/original' },
  ] as FileMetadata['fields'];
  const html = contextCardsHtml(report, { format: 'JPEG', fields });
  assert.doesNotMatch(html, /Jo Example/, 'the creator is in the Licence section');
  assert.doesNotMatch(html, /creativecommons\.org/, 'the licence text is linked from the Licence section');
  assert.match(html, /example\.org/, 'a link nothing else shows is still listed');
  // With no licence statement the Licence section shows no creator, so the creator is listed here.
  assert.match(contextCardsHtml(report, { format: 'JPEG', fields: [fields[0]!] }), /Jo Example/);
  // A creator who brings contact details is still listed, because the details are new.
  const withContact = contextCardsHtml(report, { format: 'JPEG', fields: [...fields, { group: 'authorship', label: 'Contact email', value: 'jo@example.org' }] as FileMetadata['fields'] });
  assert.match(withContact, /Jo Example/);
  assert.match(withContact, /jo@example\.org/);
  // Nothing left to show is no markup at all. The section then keeps its own sentence.
  assert.equal(contextCardsHtml(report, { format: 'JPEG', fields: fields.slice(0, 2) }), '');
});
