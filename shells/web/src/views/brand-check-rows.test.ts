// SPDX-License-Identifier: MPL-2.0
/**
 * The export panel's brand rows read the same catalog facts `lolly check` does (plan 291
 * W3): a catalog icon with a declared theme is a known asset, a theme the catalog does not
 * declare is a reference to review, and a host that cannot answer leaves the check as it
 * was before the catalog facts existed.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brandCheckRows, coverageText, hostBrandCatalog, type BrandCatalogHost } from './brand-check-rows.ts';

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

test('the coverage line reads correctly for one and for many', async () => {
  assert.equal(coverageText({ colors: 1, fonts: 1, assets: 1 }),
    'Compared 1 colour value, 1 font choice and 1 asset ID. Gradients, effects, nested content and subjective quality were not assessed.');
  assert.equal(coverageText({ colors: 0, fonts: 2, assets: 3 }),
    'Compared 0 colour values, 2 font choices and 3 asset IDs. Gradients, effects, nested content and subjective quality were not assessed.');
  const rows = await rowsFor('example/logo/primary', HOST);
  assert.match(rows.find((r) => r.id === 'brand.coverage')?.text ?? '', /^Compared \d+ colour values?, \d+ font choices? and 1 asset ID\./);
});

// Partner kits (plans/82 M8): the marks are measured against the kit, and the kit's own
// colours and logos are the partner's, never off-brand.
const KIT = {
  schemaVersion: 1 as const, id: 'northwind-it', label: 'Northwind IT',
  logos: { light: { id: 'inst/nw-light', version: 2 } },
  colours: [{ role: 'primary' as const, name: 'Northwind blue', value: '#1d4ed8' }],
  rules: { minSize: { px: 96 }, clearSpace: { value: 0.5, unit: 'mark-height' as const }, treatments: ['colour' as const] },
};

test('a partner mark below the kit\'s minimum size and a crowded clear space are rows, and kit colours are not', async () => {
  const boxes = [
    { id: 'logo', name: 'Northwind logo', kind: 'image', image: 'inst/nw-light', x: 40, y: 40, w: 200, h: 48 },
    { id: 'heading', name: 'Heading', kind: 'text', text: 'Join us', fg: '#1d4ed8', font: 'sans', x: 40, y: 96, w: 600, h: 60 },
  ];
  // The app reads the logo's proportions from the host, so the mark is placed exactly.
  const rows = await brandCheckRows({ boxes: () => boxes, snapshot, write: () => undefined, partner: () => ({ kit: KIT, measure: { logoAspect: () => 200 / 48 } }) });
  const texts = rows.map((r) => r.text);
  assert.ok(texts.includes('Northwind IT’s mark is 48 px high; the kit asks for at least 96 px.'), texts.join('\n'));
  assert.ok(texts.includes('“Heading” sits inside Northwind IT’s clear space.'));
  // What the kit states and the check cannot measure is a row of its own.
  assert.match(rows.find((r) => r.id === 'brand.mark.not-measured')?.text ?? '', /^Not measured for Northwind IT’s kit: reversed use/);
  assert.ok(!rows.some((r) => r.id.startsWith('brand.color.heading')), 'Northwind blue is the partner\'s, not off-brand');
  assert.ok(!rows.some((r) => r.id.startsWith('brand.asset.logo')), 'the partner logo is a known asset');
  // Without a kit the same piece reads as before.
  const plain = await brandCheckRows({ boxes: () => boxes, snapshot, write: () => undefined });
  assert.ok(plain.some((r) => r.id.startsWith('brand.color.heading')));
  assert.ok(!plain.some((r) => r.id.startsWith('brand.mark.')));
});

test('the mark rows show even when the design system cannot be read', async () => {
  const rows = await brandCheckRows({
    boxes: () => [{ id: 'logo', kind: 'image', image: 'inst/nw-light', x: 0, y: 0, w: 100, h: 20 }],
    snapshot: async () => undefined, write: () => undefined, partner: () => ({ kit: KIT, measure: {} }),
  });
  assert.deepEqual(rows.map((r) => r.id), ['brand.mark.logo.min-size.px', 'brand.mark.not-measured', 'brand.unavailable']);
  // Without the logo's proportions a contained mark is at most its box's height, and the row says so.
  assert.equal(rows[0]!.text, 'Northwind IT’s mark is at most 20 px high; the kit asks for at least 96 px.');
});

test('the treatment sentences name what the kit allows, with no comma before the last', async () => {
  const { markFindingText } = await import('./brand-check-rows.ts');
  const base = { id: 'x', kind: 'mark' as const, status: 'review' as const, label: 'L', company: 'Northwind IT', rule: 'treatment' as const };
  assert.equal(markFindingText({ ...base, value: 'mono', expected: 'colour, on-photo' }), 'Northwind IT’s mark is drawn in one colour; the kit allows full colour or on a photo.');
  assert.equal(markFindingText({ ...base, value: 'on-photo', expected: 'colour, mono, reverse' }), 'Northwind IT’s mark sits on a photo; the kit allows full colour, one colour or reversed.');
  assert.equal(markFindingText({ ...base, rule: 'clear-space', value: 'Title', related: ['a', 'b', 'c'] }), '“Title” and 2 other layers sit inside Northwind IT’s clear space.');
  assert.equal(markFindingText({ ...base, value: 'recoloured', expected: 'mono' }), 'Northwind IT’s mark is recoloured; the kit allows one colour.');
});
