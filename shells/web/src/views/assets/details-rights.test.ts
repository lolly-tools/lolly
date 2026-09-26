// SPDX-License-Identifier: MPL-2.0
/**
 * The catalog details sheet's rights rows (plan 253, section 7.1).
 *
 * Two things had to change here and both were wrong in the same direction. The
 * Source row printed "SUSE catalog" on every profile, including a public clone
 * that has no SUSE pack at all, and the Licence row uppercased the SPDX id with a
 * blind hyphen-to-space pass, which turns cc-by-sa-4.0 into a string no licence
 * has ever been called. Display is also not delivery: the sheet says what using
 * the work asks of you, and an export receipt is what says it was done.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/assets/details-rights.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { assetRightsRows } from './details-sheet.ts';

const ref = (meta: Record<string, unknown>): AssetRef => ({
  id: 'lolly/photo/lorikeet', type: 'raster', format: 'jpg', url: '', meta,
} as unknown as AssetRef);

test('a work with a full rights record shows creator, licence, credit and the ask', () => {
  const html = assetRightsRows(ref({
    license: 'cc-by-4.0',
    attribution: 'Lorikeet by A. Person, CC BY 4.0.',
    rights: {
      id: 'lolly/photo/lorikeet',
      creators: [{ name: 'A. Person', role: 'creator' }, { name: 'Lolly catalog', role: 'publisher' }],
      sourceUrl: 'https://example.org/lorikeet',
      rights: [{ declaration: 'cc-by-4.0', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }],
    },
  }), false);
  assert.ok(html.includes('credited to A. Person'), 'the creator is credited, separately from the publisher');
  assert.ok(html.includes('Lolly catalog'), 'the publisher is named from the record');
  assert.ok(!html.includes('SUSE catalog'), 'and never from a hard-coded brand');
  assert.ok(html.includes('href="https://example.org/lorikeet"'), 'the original work is reachable');
  assert.ok(html.includes('CC BY 4.0'), 'the canonical licence name is shown');
  assert.ok(html.includes('title="cc-by-4.0"'), 'with the declaration as supplied kept beside it');
  assert.ok(html.includes('Lorikeet by A. Person, CC BY 4.0.'), 'the credit is the readable one');
  assert.ok(html.includes('data-act="copy-credit"'), 'and it can be copied');
  // A tile knows what the work REQUIRES; only an output receipt knows what an
  // export delivered, and a route can carry no credit at all (a clipboard copy,
  // a destination that strips metadata). Plan section 7.1: no permanent
  // completion claim before export.
  assert.ok(html.includes('Credit required. Lolly prepares it for the export routes that can carry it.'));
  assert.ok(!html.includes('included on export'), 'and never a claim the tile cannot check');
});

test('a ShareAlike work says so without being styled as a broken asset', () => {
  const html = assetRightsRows(ref({ license: 'CC BY-SA 4.0' }), false);
  assert.ok(html.includes('CC BY-SA 4.0'));
  assert.ok(html.includes('Credit required. Lolly prepares it for the export routes that can carry it. ShareAlike applies to adapted versions you share.'));
  assert.ok(!/error|invalid|not allowed/i.test(html), 'a condition is not a defect');
});

test('a CC0 dedication asks for no credit and says the courtesy one is welcome', () => {
  const html = assetRightsRows(ref({ license: 'CC0-1.0' }), false);
  assert.ok(html.includes('No credit required. A courtesy credit is welcome.'));
});

test('an absent licence reads as not recorded, and never as permission', () => {
  const html = assetRightsRows(ref({}), false);
  assert.ok(html.includes('Not recorded'));
  assert.ok(html.includes('Licence not recorded.'));
  for (const phrase of ['rights cleared', 'legally safe', 'fully cleared', 'copyright verified']) {
    assert.ok(!html.includes(phrase), `never says "${phrase}"`);
  }
});

test('a recognised but uninterpreted licence says exactly that', () => {
  const html = assetRightsRows(ref({ license: 'CC BY-NC 4.0' }), false);
  assert.ok(html.includes('CC BY-NC 4.0'));
  assert.ok(html.includes('Conditions recorded, not yet interpreted.'),
    'no automatic pass and no automatic ban');
});

test('an upload says it is yours without claiming you own what is in it', () => {
  const html = assetRightsRows(ref({}), true);
  assert.ok(html.includes('Your upload'));
  assert.ok(html.includes('Licence not recorded.'), 'uploading is not a licence declaration');
});

test('the catalog shape a rights record actually ships in is read', () => {
  // schemas/asset.schema.json declares `rights` as `{ works: [...] }`, which is
  // what the shipped emoji packs carry. A reader that only understood a bare
  // work record found nothing in any of them.
  const html = assetRightsRows(ref({
    rights: {
      works: [{
        id: 'community/emoji/openmoji/color',
        title: 'OpenMoji Color 17.0.0',
        creators: [{ name: 'OpenMoji contributors', role: 'creator' }],
        sourceUrl: 'https://example.org/openmoji',
        rights: [{ declaration: 'CC-BY-SA-4.0', assertedBy: 'catalog', evidence: 'notice-file', status: 'parsed' }],
      }],
    },
  }), false);
  assert.ok(html.includes('credited to OpenMoji contributors'));
  assert.ok(html.includes('CC BY-SA 4.0'), 'the licence comes off the structured record when no legacy string is set');
  assert.ok(html.includes('ShareAlike applies to adapted versions you share.'));
});

test('a malformed rights record is ignored rather than trusted', () => {
  const html = assetRightsRows(ref({ license: 'cc-by-4.0', rights: { creators: 'not an array' } }), false);
  assert.ok(html.includes('CC BY 4.0'), 'the legacy licence string still works');
  assert.ok(!html.includes('not an array'), 'nothing from the broken record is printed');
});

test('a non-http source locator never becomes a link', () => {
  const html = assetRightsRows(ref({
    license: 'cc-by-4.0',
    rights: { id: 'x', creators: [], sourceUrl: 'javascript:alert(1)', rights: [] },
  }), false);
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<a href'));
});
