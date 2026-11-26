// SPDX-License-Identifier: MPL-2.0
/**
 * What may travel inside a `.lolly`, and the credits file that records it
 * (plan 253, section 7.3 and the section 2 inventory row on the editable vehicle).
 *
 * This pins a BEHAVIOUR CHANGE. The old gate was a regular expression over the
 * licence label - `proprietary|all-rights-reserved|licenseref|premiumbeat` - and
 * everything it did not match travelled, so a catalog work with NO licence
 * recorded was passed on as though it were free to pass on. Missing licence
 * information is not evidence of free redistribution, so an unrecorded or
 * not-yet-interpreted licence is now held back with its reason, and the pack's
 * CREDITS.txt says what travelled, what did not and why. The credits text is
 * pinned in tests/asset-rights.test.ts, beside the engine function that writes the text.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/lolly-vehicle-rights.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redistribution } from './tool-lolly-vehicle.ts';

test('a reviewed licence that permits passing on the source travels, with its notices', () => {
  const out = redistribution({
    license: 'cc-by-4.0',
    rights: { rights: [{ declaration: 'cc-by-4.0', notices: ['Twemoji by Twitter, CC BY 4.0.'] }] },
  });
  assert.equal(out.travels, true);
  assert.equal(out.reason, '');
  assert.equal(out.licence, 'CC BY 4.0');
  assert.deepEqual(out.notices, ['Twemoji by Twitter, CC BY 4.0.']);
});

test('an unmarked catalog work is now HELD BACK - this is the behaviour change', () => {
  const out = redistribution({ name: 'some catalog art' });
  assert.equal(out.travels, false, 'it used to travel by default; it no longer does');
  assert.equal(out.reason, 'licence not recorded');
  assert.equal(out.licence, '');
});

test('a LicenseRef is data, not a proprietary verdict, but it still does not travel', () => {
  const out = redistribution({ license: 'LicenseRef-SUSE-Proprietary' });
  assert.equal(out.travels, false);
  assert.ok(out.reason.includes('not yet interpreted'),
    'the reason is that these rules do not carry that definition');
  assert.ok(!/proprietary by/i.test(out.reason), 'and not that the spelling looked proprietary');
});

test('a recognised but unreviewed licence is held back with its own sentence', () => {
  const out = redistribution({ license: 'CC BY-NC 4.0' });
  assert.equal(out.travels, false);
  assert.ok(out.reason.includes('CC-BY-NC-4.0'));
  assert.ok(out.reason.includes('not yet interpreted'));
});

test('a brand-locked pack is held back for its own reason, ahead of any licence', () => {
  const out = redistribution({ brandLock: true, license: 'cc-by-4.0' });
  assert.equal(out.travels, false);
  assert.ok(out.reason.includes('authoritative on this device'));
  assert.equal(out.kind, 'policy', 'a deployment rule is not a licence condition');
});

test('an asset that records its licence only in the structured record is read the same way here', () => {
  // The details sheet falls back to the structured record when the legacy string
  // is absent. This gate used to read `meta.license` alone, so the same asset
  // could be held back as unrecorded while its own sheet showed its licence.
  const out = redistribution({
    rights: {
      works: [{
        id: 'community/emoji/twemoji/color',
        creators: [{ name: 'Twitter, Inc. and other contributors' }],
        rights: [{ declaration: 'CC-BY-4.0', assertedBy: 'catalog', evidence: 'notice-file', status: 'parsed' }],
      }],
    },
  });
  assert.equal(out.travels, true);
  assert.equal(out.licence, 'CC BY 4.0');
  assert.equal(out.kind, 'licence');
});

test('an evidence record that was looked for and found empty is not a declaration', () => {
  const out = redistribution({
    rights: { works: [{ id: 'x', creators: [], rights: [{ declaration: '', assertedBy: 'exporter', evidence: 'native-metadata', status: 'missing' }] }] },
  });
  assert.equal(out.travels, false);
  assert.equal(out.reason, 'licence not recorded');
  assert.equal(out.kind, 'unknown');
});

test('a rights record that is not shaped like one yields no notices and no crash', () => {
  assert.deepEqual(redistribution({ license: 'MIT', rights: 'nope' }).notices, []);
  assert.deepEqual(redistribution({ license: 'MIT', rights: { rights: [{ notices: 'nope' }] } }).notices, []);
  assert.equal(redistribution({ license: 'MIT' }).travels, true);
});

test('a built .lolly carries CREDITS.txt, under the integrity map, and still opens', async () => {
  const { buildLollyFile, readLollyFile } = await import('../lib/lolly-pack.ts');
  const carriedId = 'lolly/photo/lorikeet';
  const heldId = 'lolly/pattern/unmarked';
  const session = {
    __toolId: 'demo-tool',
    a: { id: carriedId, source: 'library', type: 'raster', format: 'jpg', url: '' },
    b: { id: heldId, source: 'library', type: 'vector', format: 'svg', url: '' },
  };
  const built = await buildLollyFile({
    session,
    toolId: 'demo-tool',
    userAssets: [],
    resolveLibrary: async (id) => id === carriedId
      ? {
          bytes: new Uint8Array([1, 2, 3]), mime: 'image/jpeg', type: 'raster', format: 'jpg',
          label: 'Lorikeet', licence: 'CC BY 4.0', credit: 'Lorikeet by A. Person, CC BY 4.0.',
          notices: ['Keep this notice.'],
        }
      : {
          bytes: new Uint8Array([4, 5, 6]), mime: 'image/svg+xml', type: 'vector', format: 'svg',
          label: 'Unmarked pattern', licensed: true, holdReason: 'licence not recorded',
        },
  });
  assert.equal(built.summary.credits, true, 'the summary says a credits file travelled');
  assert.equal(built.summary.licensedExcluded, 1, 'the unmarked work was held back');

  const read = await readLollyFile(await built.blob.arrayBuffer());
  const credits = new TextDecoder().decode(read.files['CREDITS.txt']!);
  assert.ok(credits.includes('Lorikeet'), 'the carried work is named');
  assert.ok(credits.includes('notice:  Keep this notice.'), 'with the notice its licence asks to travel');
  assert.ok(credits.includes('Unmarked pattern'), 'and so is the one that stayed behind');
  assert.ok(credits.includes('reason:  licence not recorded'));
  assert.ok(read.manifest.integrity?.['CREDITS.txt'], 'it rides the integrity map like every other part');
});

test('a share with no catalog work at all carries no credits file', async () => {
  const { buildLollyFile } = await import('../lib/lolly-pack.ts');
  const built = await buildLollyFile({ session: { __toolId: 'demo-tool' }, toolId: 'demo-tool', userAssets: [] });
  assert.equal(built.summary.credits, false);
});
