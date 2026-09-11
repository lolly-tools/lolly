// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="card"></div></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;
globalThis.Event = dom.window.Event as unknown as typeof Event;

const { renderDesignSystemsCard, previewOf } = await import('./design-systems-card.ts');

const records = [
  { id: 'active', label: 'Active brand', ns: 'user/ds/active/', headId: null, source: { kind: 'local' }, locked: false, createdAt: 1, lastUsedAt: 1 },
  { id: 'hosted', label: 'Hosted brand', ns: 'user/ds/hosted/', headId: null, source: { kind: 'hosted', instance: 'https://brand.example', packUrl: null, signature: 'verified' }, locked: true, createdAt: 2, lastUsedAt: 2 },
] as const;

function host() {
  return {
    designSystems: {
      list: async () => [...records],
      activeId: async () => 'active',
    },
    assets: {},
  };
}

test('inactive design-system card is one large switch target with labelled secondary actions', async () => {
  const body = document.querySelector<HTMLElement>('#card')!;
  await renderDesignSystemsCard(body, host() as never);

  const active = body.querySelector<HTMLElement>('[data-ds-row="active"]')!;
  const hosted = body.querySelector<HTMLElement>('[data-ds-row="hosted"]')!;
  const hit = hosted.querySelector<HTMLButtonElement>('.ds-row-hit')!;
  assert.equal(active.querySelector('.ds-row-hit'), null, 'the already-active card is not a fake switch');
  assert.equal(hit.dataset.dsAct, 'switch');
  assert.equal(hit.getAttribute('aria-label'), 'Switch to Hosted brand');
  assert.equal(hosted.querySelector('[data-ds-act="refresh"]')?.textContent?.trim(), 'Check for updates');
  assert.equal(hosted.querySelector('[data-ds-act="fork"]')?.textContent?.trim(), 'Make an editable copy');
  assert.match(body.querySelector('[data-ds-act="file"]')?.textContent ?? '', /Open or import a file/);
  assert.equal(body.querySelectorAll('[data-ds-act="download"]').length, records.length);
});

test('vertical reverse logo is read from each brand on dark surfaces, with primary and circles as fallbacks', async () => {
  const requested: string[] = [];
  let missing = false;
  const doc = { color: { primary: { $type: 'color', $value: '#123024' } }, asset: { logo: {
    'vertical-primary-reverse': { $type: 'asset', $value: 'brand/reverse' },
    'vertical-primary': { $type: 'asset', $value: 'brand/primary' },
  } } };
  const record = { ...records[0], headId: 'user/ds/active/tokens/brand' };
  const h = { ...host(), designSystems: { list: async () => [record], activeId: async () => 'active' }, assets: {
    _getBlob: async () => new Blob([JSON.stringify(doc)]),
    get: async (id: string) => { requested.push(id); if (missing) throw new Error('Missing'); return { url: `/catalog/${id}.svg` }; },
  } };
  assert.equal((await previewOf(h as never, record as never)).logoUrl, '/catalog/brand/reverse.svg');
  assert.deepEqual(requested, ['brand/reverse']);
  const body = document.querySelector<HTMLElement>('#card')!;
  await renderDesignSystemsCard(body, h as never);
  const logo = body.querySelector<HTMLImageElement>('.ds-preview-logo')!;
  assert.ok(logo); assert.equal(body.querySelectorAll('.ds-preview-mark i').length, 2);
  logo.dispatchEvent(new Event('error'));
  assert.equal(body.querySelector('.ds-preview-logo'), null, 'failed image reveals the circle fallback');
  missing = true; requested.length = 0;
  assert.equal((await previewOf(h as never, record as never)).logoUrl, undefined);
  assert.deepEqual(requested, ['brand/reverse', 'brand/primary']);
  doc.color.primary.$value = '#ffffff'; missing = false; requested.length = 0;
  assert.equal((await previewOf(h as never, record as never)).logoUrl, '/catalog/brand/primary.svg');
});
