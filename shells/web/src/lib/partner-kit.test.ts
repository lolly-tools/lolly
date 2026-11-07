// SPDX-License-Identifier: MPL-2.0
/**
 * lib/partner-kit.ts (plans/82 M8): which kit a piece opens with, reading the kit at its
 * revision, the Partner swatches, the share link part and what the checks take.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/partner-kit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://work.example/' });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const kitMod = await import('./partner-kit.ts');
const offerMod = await import('./partner-kit-state.ts');
const { attachPieceKit, brandGuestFor, detachPieceKit, loadPartnerKit, openingKit, partnerCheckFor, partnerKitParam, partnerMarkIds, partnerSwatches, pieceKit, releasePieceKit } = kitMod;
const { partnerKitOffer, readPartnerKitOffer, setPartnerKitOffer } = offerMod;

const KIT = {
  schemaVersion: 1, id: 'northwind-it', label: 'Northwind IT',
  logos: { light: { id: 'inst/nw-light', version: 2 }, mark: { id: 'inst/nw-mark', version: 1 } },
  colours: [{ role: 'primary', name: 'Northwind blue', value: '#1d4ed8' }, { role: 'accent', name: 'Signal', value: '#f59e0b' }],
  rules: { minSize: { px: 96 } },
};

function fakeHost(type = 'partner-kit') {
  const asked: string[] = [];
  return {
    asked,
    host: {
      assets: { get: async (id: string) => { asked.push(id); return { id, type, url: `https://work.example/catalog/inst/${id.slice(5)}/json`, source: 'library' }; } },
      log: () => {},
    } as never,
  };
}

function fakeFetch(body: unknown, ok = true) {
  const urls: string[] = [];
  const impl = (async (url: string) => { urls.push(url); return { ok, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }; }) as unknown as typeof fetch;
  return { urls, impl };
}

test('the kit offer reads from org-config, and only a whole one', () => {
  assert.deepEqual(readPartnerKitOffer({ id: 'inst/k1', revision: 2, label: ' Northwind IT ' }), { id: 'inst/k1', revision: 2, label: 'Northwind IT' });
  for (const raw of [null, {}, { id: 'inst/k1', revision: 2 }, { id: 'inst/k1', revision: 0, label: 'N' }, { id: '../x', revision: 1, label: 'N' }, { id: 'inst/k1', revision: 1, label: '  ' }]) {
    assert.equal(readPartnerKitOffer(raw), null, JSON.stringify(raw));
  }
});

test('a link wins, then the saved document; only new work takes the company kit', () => {
  setPartnerKitOffer({ id: 'inst/k1', revision: 3, label: 'Northwind IT' });
  try {
    assert.deepEqual(openingKit({}, null, true), { values: { __partnerKit: { id: 'inst/k1', revision: 3 } }, attachment: { id: 'inst/k1', revision: 3 } });
    assert.deepEqual(openingKit({}, null, false), { values: {}, attachment: null }, 'a reopened piece made before the kit stays without one');
    assert.deepEqual(openingKit({ __partnerKit: { id: 'inst/k1', revision: 1 } }, null, true).attachment, { id: 'inst/k1', revision: 1 }, 'a saved revision is kept, not moved to the live one');
    assert.deepEqual(openingKit({ __partnerKit: { id: 'inst/k1', revision: 1 } }, { id: 'inst/k9', revision: 4 }, false).attachment, { id: 'inst/k9', revision: 4 });
    assert.deepEqual(openingKit({ __partnerKit: 'junk' }, null, false), { values: { __partnerKit: 'junk' }, attachment: null });
  } finally {
    setPartnerKitOffer(null);
  }
  assert.equal(partnerKitOffer(), null);
  assert.deepEqual(openingKit({}, null, true), { values: {}, attachment: null }, 'no company kit, nothing seeded');
});

test('the kit is read at the attached revision, from a partner-kit asset only, and kept per id and revision', async () => {
  const { host, asked } = fakeHost();
  const net = fakeFetch(KIT);
  const kit = await loadPartnerKit(host, { id: 'inst/rev-test', revision: 2 }, net.impl);
  assert.equal(kit?.label, 'Northwind IT');
  assert.equal(new URL(net.urls[0]!).searchParams.get('v'), '2', 'the version route reads the exact revision');
  await loadPartnerKit(host, { id: 'inst/rev-test', revision: 2 }, net.impl);
  assert.equal(net.urls.length, 1, 'read once per id@revision');
  await loadPartnerKit(host, { id: 'inst/rev-test', revision: 3 }, net.impl);
  assert.equal(net.urls.length, 2);
  assert.deepEqual(asked, ['inst/rev-test', 'inst/rev-test']);
  // A tokens asset is never taken for a kit, and bytes that are not a kit read as none.
  assert.equal(await loadPartnerKit(fakeHost('tokens').host, { id: 'inst/tokens', revision: 1 }, fakeFetch(KIT).impl), null);
  assert.equal(await loadPartnerKit(host, { id: 'inst/bad', revision: 1 }, fakeFetch({ ...KIT, fonts: [] }).impl), null);
  assert.equal(await loadPartnerKit(host, { id: 'inst/gone', revision: 1 }, fakeFetch('', false).impl), null);
});

test('attaching gives the piece its kit, swatches, link part, marks and check input; detaching takes them away', async () => {
  const runtime = { getModel: () => [{ id: 'documentUnit', value: 'mm' }, { id: 'documentDpi', value: 300 }] };
  const load = async () => KIT as never;
  const kit = await attachPieceKit({ assets: {} as never, log: () => {} }, runtime, { id: 'inst/k1', revision: 2 }, { load });
  assert.equal(kit?.id, 'northwind-it');
  assert.deepEqual(pieceKit(runtime), { id: 'inst/k1', revision: 2 });
  assert.equal(partnerKitParam(runtime), '_kit=inst%2Fk1%402');
  assert.deepEqual(partnerMarkIds(runtime), ['inst/nw-light', 'inst/nw-mark']);
  assert.deepEqual(brandGuestFor(runtime), { colours: ['#1d4ed8', '#f59e0b'], assets: ['inst/nw-light', 'inst/nw-mark'] });
  assert.deepEqual(partnerCheckFor(runtime)?.measure, { unit: 'mm', dpi: 300 });
  detachPieceKit(runtime);
  assert.equal(pieceKit(runtime), null);
  assert.equal(partnerKitParam(runtime), null);
  assert.equal(brandGuestFor(runtime), undefined);
  releasePieceKit(runtime);
});

test('a kit this person is not served leaves the piece with none and a warning', async () => {
  const runtime = {};
  const warnings: string[] = [];
  const kit = await attachPieceKit({ assets: {} as never, log: (level: string, msg: string) => { if (level === 'warn') warnings.push(msg); } } as never, runtime, { id: 'inst/other-company', revision: 1 }, { load: async () => null });
  assert.equal(kit, null);
  assert.equal(pieceKit(runtime), null);
  assert.match(warnings[0] ?? '', /not available here/);
});

test('the Partner swatches are plain colours under their own heading', () => {
  assert.deepEqual(partnerSwatches(KIT as never), [
    { value: '#1d4ed8', label: 'Northwind blue', group: 'Partner', ref: null },
    { value: '#f59e0b', label: 'Signal', group: 'Partner', ref: null },
  ]);
  assert.deepEqual(partnerSwatches(null), []);
});
