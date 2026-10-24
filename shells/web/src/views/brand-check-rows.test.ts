// SPDX-License-Identifier: MPL-2.0
/**
 * The export panel's brand rows read the same catalog facts `lolly check` does (plan 291
 * W3): a catalog icon with a declared theme is a known asset, a theme the catalog does not
 * declare is a reference to review, and a host that cannot answer leaves the check as it
 * was before the catalog facts existed.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandCheckRows, coverageText, hostAssetNames, hostBrandCatalog, type BrandCatalogHost } from './brand-check-rows.ts';

const DOC = {
  color: { ink: { $type: 'color', $value: '#112233' } },
  font: { brand: { $type: 'fontFamily', $value: 'Example Sans' } },
  asset: { logo: { $type: 'string', $value: 'example/logo/primary' } },
};
const snapshot = async () => ({ document: DOC, system: null, version: 'latest', selection: {} });

const HOST: BrandCatalogHost = {
  assets: {
    query: async () => [{ id: 'example/icons/brain' }, { id: 'example/photos/sea' }, { id: 'example/logo/primary' }],
    _iconThemes: async () => [{ id: 'ember', c1: '#ff6600', c2: '#112233' }],
    _photoTreatments: async () => [{ id: 'duo', kind: 'duotone', shadow: '#112233', highlight: '#ffffff' }],
  },
};

const rowsFor = (image: string, host?: BrandCatalogHost) => brandCheckRows({
  boxes: () => [{ id: 'icon', name: 'Icon', kind: 'image', image }],
  snapshot,
  write: () => undefined,
  ...(host ? { catalog: () => hostBrandCatalog(host) } : {}),
});
const findingRows = (rows: Awaited<ReturnType<typeof brandCheckRows>>) => rows.filter((r) => r.id.startsWith('brand.') && r.id.includes('.icon.'));

test('a themed catalog icon is a known asset in the export panel', async () => {
  assert.deepEqual(findingRows(await rowsFor('example/icons/brain?theme=ember', HOST)), []);
  // Without the catalog facts the same icon is outside the declared asset IDs, as before.
  assert.deepEqual(findingRows(await rowsFor('example/icons/brain?theme=ember')).map((r) => r.id), ['brand.asset.icon.image']);
});

test('an undeclared theme reads as a theme to review, not as a colour', async () => {
  const rows = findingRows(await rowsFor('example/icons/brain?theme=lava', HOST));
  assert.deepEqual(rows.map((r) => r.id), ['brand.reference.icon.image']);
  assert.match(rows[0]!.text, /icon theme or photo treatment in example\/icons\/brain\?theme=lava is not declared/);
  assert.doesNotMatch(rows[0]!.text, /colour/);
});

test('the host catalog reads asset ids, themes and treatments, and survives a host that throws', async () => {
  assert.deepEqual(await hostBrandCatalog(HOST), {
    assets: ['example/icons/brain', 'example/photos/sea', 'example/logo/primary'],
    iconThemes: ['ember'],
    treatments: ['duo'],
  });
  const broken: BrandCatalogHost = { assets: { query: async () => { throw new Error('offline'); } } };
  assert.deepEqual(await hostBrandCatalog(broken), { assets: [] });
  assert.deepEqual(await hostBrandCatalog(undefined), { assets: [] });
});

test('the host asset names keep each id and its display name, and a host that cannot answer gives none', async () => {
  let queried: unknown;
  const named: BrandCatalogHost = {
    assets: {
      query: async (filter) => {
        queried = filter;
        return [
          { id: 'example/logo/primary', meta: { name: ' Example Wordmark ' } },
          { id: 'example/logo/reverse', meta: { name: '' } },
          { id: 'example/photos/sea' },
        ];
      },
    },
  };
  assert.deepEqual(await hostAssetNames(named), {
    assets: [{ id: 'example/logo/primary', name: 'Example Wordmark' }, { id: 'example/logo/reverse' }, { id: 'example/photos/sea' }],
  });
  assert.deepEqual(queried, { includeDeprecated: true }, 'the same query hostBrandCatalog makes');
  assert.equal(await hostAssetNames({ assets: { query: async () => { throw new Error('offline'); } } }), undefined);
  assert.equal(await hostAssetNames({ assets: {} }), undefined);
  assert.equal(await hostAssetNames(undefined), undefined);
});

test('the coverage line reads correctly for one and for many', async () => {
  assert.equal(coverageText({ colors: 1, fonts: 1, assets: 1 }),
    'Compared 1 colour value, 1 font choice and 1 asset ID. Gradients, effects, nested content and subjective quality were not assessed.');
  assert.equal(coverageText({ colors: 0, fonts: 2, assets: 3 }),
    'Compared 0 colour values, 2 font choices and 3 asset IDs. Gradients, effects, nested content and subjective quality were not assessed.');
  const rows = await rowsFor('example/logo/primary', HOST);
  assert.match(rows.find((r) => r.id === 'brand.coverage')?.text ?? '', /^Compared \d+ colour values?, \d+ font choices? and 1 asset ID\./);
});
