// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createDesignSystemRegistry, type RegistryDb, type DesignSystemRecord } from './registry.ts';
import { removeDesignSystem } from './manage.ts';

const dom = new JSDOM('<!doctype html><html><body><div id="card"></div></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;
globalThis.Event = dom.window.Event as unknown as typeof Event;

const { renderDesignSystemsCard, previewOf } = await import('./design-systems-card.ts');
const { catalogSourceHtml, designSystemRemovalMessage } = await import('./catalog-source.ts');

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

test('switching blocks overlapping actions and reports failure with controls and focus restored', async () => {
  const { mountDesignSystemsCard } = await import('./design-systems-card.ts');
  const body = document.createElement('div'); document.body.append(body);
  let calls = 0, rejectSwitch: (error: Error) => void = () => {};
  const h = { ...host(), designSystems: { ...host().designSystems,
    active: async () => records[0],
    setActive: () => { calls++; return new Promise<void>((_, reject) => { rejectSwitch = reject; }); },
  } };
  const settle = async (): Promise<void> => { for (let i = 0; i < 10; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  mountDesignSystemsCard(body, h as never);
  await settle();
  const hit = body.querySelector<HTMLButtonElement>('[data-ds-act="switch"]')!;
  hit.focus(); hit.click(); await settle();
  assert.equal(body.getAttribute('aria-busy'), 'true');
  assert.match(body.textContent ?? '', /Loading design system/);
  hit.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await settle();
  assert.equal(calls, 1);
  rejectSwitch(new Error('Storage unavailable')); await settle();
  assert.equal(body.hasAttribute('aria-busy'), false);
  assert.equal(body.querySelectorAll('button:disabled').length, 0);
  assert.equal(body.querySelector('[role="status"]')?.textContent, 'Storage unavailable');
  assert.equal(document.activeElement, body.querySelector('[data-ds-act="switch"]'));
  body.remove();
});

test('removing an imported catalogue copy explains the fallback and retains its source after reopening', async () => {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  const of = (name: string) => {
    let rows = stores.get(name);
    if (!rows) { rows = new Map(); stores.set(name, rows); }
    return rows;
  };
  const db: RegistryDb = {
    async get(s, k) { return of(s).get(k); },
    async put(s, v, k) { const key = k ?? (v as { id: string }).id; of(s).set(key, v); return key; },
    async delete(s, k) { of(s).delete(k); },
    async getAll(s) { return [...of(s).values()]; },
    objectStoreNames: { contains: () => true },
  };
  const probe = {
    catalogTokens: async () => ({ id: 'acme/tokens/brand', name: 'Acme Brand Tokens' }),
    legacyHead: async () => null,
  };
  const registry = createDesignSystemRegistry(db, probe);
  const copy: DesignSystemRecord = {
    id: 'copy', label: 'Acme', ns: 'user/ds/copy/', headId: 'user/ds/copy/tokens/brand',
    source: { kind: 'file', fileName: 'acme.json', signature: 'unsigned' }, locked: false, createdAt: 1, lastUsedAt: 1,
  };
  const blobs = new Map([
    ['acme/tokens/brand', new Blob(['{}'])],
    [copy.headId, new Blob(['{}'])],
  ]);
  const assets = {
    _getBlob: async (id: string) => blobs.get(id) ?? null,
    _exportUserAssets: async () => [...blobs.keys()].filter(id => id.startsWith('user/')).map(id => ({ id, type: 'tokens' })),
    _deleteUserAsset: async (id: string) => { blobs.delete(id); },
    _uploadUserAsset: async () => {},
  };
  await registry.put(copy);
  await registry.setActive(copy.id);
  const message = await designSystemRemovalMessage(registry, copy.id);
  assert.match(message, /supplied design system “Acme” will become active/);
  assert.match(message, /Catalogue assets supplied by the instance or app remain available/);
  await removeDesignSystem({ designSystems: registry, assets }, copy.id);
  assert.equal(blobs.has(copy.headId), false);
  assert.equal(blobs.has('acme/tokens/brand'), true);

  const reopened = createDesignSystemRegistry(db, probe);
  assert.equal(await reopened.activeId(), 'shipped');
  const body = document.querySelector<HTMLElement>('#card')!;
  await renderDesignSystemsCard(body, { designSystems: reopened, assets } as never);
  assert.equal(body.querySelector('[data-ds-row="copy"]'), null);
  const supplied = body.querySelector('[data-ds-row="shipped"].is-active')!;
  assert.match(supplied.textContent ?? '', /Managed by this instance/);
  assert.match(supplied.textContent ?? '', /https:\/\/lolly.tools/);
  assert.match(supplied.textContent ?? '', /acme\/tokens\/brand/);
  assert.match(supplied.textContent ?? '', /Asset namespace\s*acme\//);
  assert.equal(supplied.querySelector('[data-ds-act="remove"]'), null);
  assert.equal(supplied.querySelector('.ds-row-origin a')?.getAttribute('href'), '/info/operate/deployment.html#removing-a-catalogue-design-system');
  assert.match(await designSystemRemovalMessage(reopened, 'another'), /“Acme” will stay active/);
});

test('catalogue provenance escapes asset names and does not appear on a local record', () => {
  const record = { ...records[0], headId: '<img src=x>/tokens/brand', source: { kind: 'shipped' } } as DesignSystemRecord;
  const body = document.createElement('div');
  body.innerHTML = catalogSourceHtml(record);
  assert.equal(body.querySelector('img'), null);
  assert.match(body.textContent ?? '', /<img src=x>\/tokens\/brand/);
  assert.equal(catalogSourceHtml({ ...record, source: { kind: 'local' } }), '');
});
