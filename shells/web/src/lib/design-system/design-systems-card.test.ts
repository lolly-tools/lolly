// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
      visible: async () => [...records],
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
  // Its name is what the row shows, the Use pill then the system's name (WCAG 2.5.3).
  const name = (hit.getAttribute('aria-labelledby') ?? '').split(' ').map(id => body.querySelector(`#${id}`)?.textContent?.trim()).join(' ');
  assert.equal(name, 'Use Hosted brand');
  assert.equal(hit.hasAttribute('aria-label'), false);
  assert.equal(hosted.querySelector('[data-ds-act="refresh"]')?.textContent?.trim(), 'Check for updates');
  assert.equal(hosted.querySelector('[data-ds-act="fork"]')?.textContent?.trim(), 'Make an editable copy');
  assert.match(body.querySelector('[data-ds-act="file"]')?.textContent ?? '', /Open or import a file/);
  assert.equal(body.querySelectorAll('[data-ds-act="download"]').length, records.length);
});

const DEMO = JSON.parse(readFileSync(new URL('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8')) as unknown;

test('each app theme gets its own logo on the row cover, horizontal first, and a failed one hands its themes to the monogram', async () => {
  const missing = new Set<string>();
  const record = { ...records[0], label: 'Lolly Demo', headId: 'user/ds/active/tokens/brand' };
  const h = { ...host(), designSystems: { list: async () => [record], visible: async () => [record], activeId: async () => 'active' }, assets: {
    _getBlob: async () => new Blob([JSON.stringify(DEMO)]),
    get: async (id: string) => { if (missing.has(id)) throw new Error('Missing'); return { url: `/catalog/${id}.svg` }; },
  } };
  const logos = async () => (await previewOf(h as never, record as never)).logos;
  assert.deepEqual(await logos(), {
    light: '/catalog/lolly/logo/horizontal.svg', dark: '/catalog/lolly/logo/horizontal-reverse.svg', brand: '/catalog/lolly/logo/horizontal-on-brand.svg',
  }, 'light reads the primary form, dark the reverse, brand the on-brand form');
  missing.add('lolly/logo/horizontal-on-brand');
  assert.equal((await logos()).brand, '/catalog/lolly/logo/horizontal-reverse.svg', 'brand falls back to the reverse');
  missing.add('lolly/logo/horizontal-reverse');
  assert.equal((await logos()).brand, '/catalog/lolly/logo/horizontal.svg', 'then to the primary');
  missing.add('lolly/logo/horizontal');
  assert.deepEqual(await logos(), {
    light: '/catalog/lolly/logo/primary.svg', dark: '/catalog/lolly/logo/reverse.svg', brand: '/catalog/lolly/logo/reverse.svg',
  }, 'with no horizontal file the vertical forms answer');
  missing.clear();

  const body = document.querySelector<HTMLElement>('#card')!;
  await renderDesignSystemsCard(body, h as never);
  const cover = body.querySelector<HTMLElement>('[data-ds-row="active"] .ds-cover.ds-cover--row')!;
  assert.ok(cover, 'the row leads with a cover');
  assert.equal(cover.getAttribute('aria-hidden'), 'true');
  assert.deepEqual([...cover.querySelectorAll('img.ds-cover-logo[data-looks]')].map(img => [img.getAttribute('src'), img.getAttribute('data-looks')]), [
    ['/catalog/lolly/logo/horizontal.svg', 'light'],
    ['/catalog/lolly/logo/horizontal-reverse.svg', 'dark'],
    ['/catalog/lolly/logo/horizontal-on-brand.svg', 'brand'],
  ]);
  const mono = cover.querySelector<HTMLElement>('.ds-cover-mono')!;
  assert.equal(mono.textContent, 'L');
  assert.equal(mono.dataset.looks, '', 'every theme has a logo, so the monogram stays hidden');
  cover.querySelector('img[data-looks="dark"]')!.dispatchEvent(new Event('error'));
  assert.equal(cover.querySelector('img[data-looks="dark"]'), null, 'the failed image leaves');
  assert.equal(mono.dataset.looks, 'dark', 'and the monogram shows in its place under the dark theme');
  assert.equal(body.querySelector('.ds-row-preview'), null, 'the old 391px specimen is gone from the card');
});

test('a row reads its facts on one line: colours, typefaces, colourways when there is a choice, and size', async () => {
  const { designSystemCardHtml } = await import('./design-systems-card.ts');
  const el = document.createElement('div');
  el.innerHTML = designSystemCardHtml(records[0] as never, 'active', 9 * 1024, {
    font: "'SUSE', sans-serif", colors: ['#033633', '#008657'], colorCount: 33, families: ['Outfit', 'SUSE', 'SUSE Mono', 'Extra'], colourways: 6,
  });
  const facts = (): Array<string | null | undefined> => [...el.querySelectorAll('.ds-row-facts > .ds-row-fact')].map(s => s.firstChild?.textContent);
  assert.deepEqual(facts(), ['33 colours', 'Outfit, SUSE, SUSE Mono', '6 colourways', '9 KB']);
  assert.equal(el.querySelector('.ds-row-facts')?.textContent, '33 colours · Outfit, SUSE, SUSE Mono · 6 colourways · 9 KB', 'each separator trails its fact');
  assert.match(el.querySelector('.ds-row-head .ds-row-active')?.textContent ?? '', /Active/);
  assert.doesNotMatch(el.textContent ?? '', /DESIGN SYSTEM|Aa/, 'no eyebrow or type specimen on a row');
  el.innerHTML = designSystemCardHtml(records[0] as never, 'active', undefined, { font: 'x', colors: ['#000000'], colorCount: 1, colourways: 1 });
  assert.deepEqual(facts(), ['1 colour'], 'one colourway is no choice');
});

test('switching marks every control unavailable without disabling it, then reports failure with controls and focus restored', async () => {
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
  const controls = [...body.querySelectorAll<HTMLElement>('[data-ds-act], details.ds-row-more > summary')];
  assert.ok(controls.length > 5);
  assert.ok(controls.every(el => el.getAttribute('aria-disabled') === 'true'), 'every control reads as unavailable');
  assert.equal(body.querySelectorAll(':disabled').length, 0, 'and none is disabled, so the focus stays');
  assert.equal(document.activeElement, hit);
  const menu = body.querySelector<HTMLDetailsElement>('details.ds-row-more')!;
  menu.querySelector<HTMLElement>('summary')!.click();
  assert.equal(menu.open, false, 'a row menu stays shut while the switch runs');
  hit.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await settle();
  assert.equal(calls, 1);
  rejectSwitch(new Error('Storage unavailable')); await settle();
  assert.equal(body.hasAttribute('aria-busy'), false);
  assert.equal(body.querySelectorAll('[aria-disabled="true"]').length, 0);
  assert.equal(body.querySelector('[role="status"]')?.textContent, 'Storage unavailable');
  assert.equal(document.activeElement, body.querySelector('[data-ds-act="switch"]'));
  body.remove();
});

test('a switch made elsewhere moves the active tick while the card is idle, keeping the focus in its row', async () => {
  const { mountDesignSystemsCard } = await import('./design-systems-card.ts');
  const { DESIGN_SYSTEM_CHANGED_EVENT } = await import('./switch.ts');
  const body = document.createElement('div'); document.body.append(body);
  let current = 'active';
  let reads = 0;
  const h = { ...host(), designSystems: { ...host().designSystems,
    visible: async () => { reads++; return [...records]; },
    activeId: async () => current,
  } };
  const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  mountDesignSystemsCard(body, h as never);
  await settle();
  assert.ok(body.querySelector('[data-ds-row="active"].is-active'));
  body.querySelector<HTMLElement>('[data-ds-row="hosted"] [data-ds-act="studio"]')!.focus();
  const before = reads;
  current = 'hosted';
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT, { detail: records[1] }));
  await settle();
  assert.equal(reads, before + 1, 'one event, one read');
  assert.ok(body.querySelector('[data-ds-row="hosted"].is-active'), 'the tick moves to the system now in use');
  assert.ok(body.querySelector('[data-ds-row="active"] .ds-row-hit'), 'the one before becomes a switch target');
  const focused = document.activeElement as HTMLElement | null;
  assert.equal(focused?.dataset.dsAct, 'studio');
  assert.equal(focused?.closest<HTMLElement>('[data-ds-row]')?.dataset.dsRow, 'hosted', 'the focus stays on the same control');
  body.remove();
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT, { detail: records[0] }));
  await settle();
  assert.equal(reads, before + 1, 'a card that left the page no longer listens');
});

// Plan 320 M5: a switch repaints every tool, so it says so and offers the way back.
test('the switch reads Use, then says which system is in use, with Undo', async () => {
  const { mountDesignSystemsCard } = await import('./design-systems-card.ts');
  const body = document.createElement('div'); document.body.append(body);
  let current = 'active';
  const switched: string[] = [];
  const h = { ...host(), designSystems: { ...host().designSystems,
    activeId: async () => current,
    active: async () => records.find(r => r.id === current)!,
    setActive: async (id: string) => { current = id; switched.push(id); },
    bust: () => {},
  } };
  const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  mountDesignSystemsCard(body, h as never);
  await settle();
  const hosted = body.querySelector<HTMLElement>('[data-ds-row="hosted"]')!;
  assert.equal(hosted.querySelector('.ds-row-use')?.textContent?.trim(), 'Use', 'the card says what clicking it does');
  hosted.querySelector<HTMLButtonElement>('[data-ds-act="switch"]')!.click();
  await settle();
  const toast = document.querySelector<HTMLElement>('.undo-toast');
  assert.equal(toast?.querySelector('.undo-toast-msg')?.textContent, 'Using Hosted brand.');
  toast!.querySelector<HTMLButtonElement>('.undo-toast-btn')!.click();
  await settle();
  assert.deepEqual(switched, ['hosted', 'active'], 'Undo goes back to the system in use before');
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
  assert.match(supplied.textContent ?? '', /Came with this app/, 'an unlocked deployment brand is not managed');
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

test('catalogue admin links reject executable and protocol-relative URLs', () => {
  const record = { ...records[0], headId: '', source: { kind: 'shipped' } } as DesignSystemRecord;
  const body = document.createElement('div');
  for (const href of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//example.com/admin', '/\\example.com/admin']) {
    body.innerHTML = catalogSourceHtml(record, href);
    assert.equal(body.querySelectorAll('a').length, 1, href);
    assert.doesNotMatch(body.textContent ?? '', /Manage instance design systems/);
  }
  body.innerHTML = catalogSourceHtml(record, '/admin#/instance?tab=design');
  assert.equal(body.querySelectorAll('a').length, 2);
  assert.equal(body.querySelectorAll('a')[1]!.getAttribute('href'), '/admin#/instance?tab=design');
});


test('source facts report cached origin, version and checksum without claiming the newly chosen connection', async () => {
  const { networkStatus } = await import('../../catalog/sync.ts');
  const { _setBaseForTests } = await import('../instance.ts');
  const record: DesignSystemRecord = { id: 'shipped', label: 'Alpha', ns: '', headId: 'alpha/tokens/brand', source: { kind: 'shipped' }, locked: false, createdAt: 0, lastUsedAt: 0,
    catalog: { origin: 'https://old.example', version: '3.2', checksum: 'sha256-123', available: true } };
  _setBaseForTests('https://new.example'); networkStatus.offline = true;
  try {
    const html = catalogSourceHtml(record, '/admin#/instance?tab=design');
    assert.match(html, /old.example/); assert.doesNotMatch(html, /new.example/);
    assert.match(html, /Cached catalogue/); assert.match(html, /3.2/); assert.match(html, /sha256-123/);
    assert.match(html, /Manage instance design systems/);
    assert.match(catalogSourceHtml({ ...record, headId: '', catalog: { available: false } }), /No selected tokens asset/);
  } finally { networkStatus.offline = false; _setBaseForTests(''); }
});

// Andy, 2026-10-20: managed means people can see the system and cannot edit it,
// which is what a locked catalogue is. Lolly Demo, the starter and any unlocked
// deployment brand are the person's to hide, edit and reset, so none reads as
// managed. (Plan 320 S10 first took the label off the starter.) One colour is singular.
test('only a locked catalogue system reads as managed; an editable one says where it came from', async () => {
  const { sourceLine, designSystemCardHtml } = await import('./design-systems-card.ts');
  const { _setBaseForTests } = await import('../instance.ts');
  const shipped = (headId: string, locked = false) => ({ id: 'shipped', label: 'X', ns: '', headId, source: { kind: 'shipped' }, locked, createdAt: 0, lastUsedAt: 0 }) as never;
  assert.equal(sourceLine(shipped('lolly/tokens/demo')), 'Came with this app');
  assert.equal(sourceLine(shipped('lolly/tokens/brand')), 'Came with this app');
  assert.equal(sourceLine(shipped('acme/tokens/brand')), 'Came with this app');
  assert.equal(sourceLine(shipped('acme/tokens/brand', true)), 'Managed by this instance');
  _setBaseForTests('https://brand.example');
  try {
    assert.equal(sourceLine(shipped('acme/tokens/brand')), 'From this instance');
    assert.equal(sourceLine(shipped('acme/tokens/brand', true)), 'Managed by this instance');
  } finally { _setBaseForTests(''); }
  const one = designSystemCardHtml(records[0] as never, 'active', undefined, { font: 'x', colors: ['#000000'], colorCount: 1 });
  assert.match(one, />1 colour</);
  assert.doesNotMatch(one, /1 colours/);
});

test('Reset to original is offered on an edited Lolly Demo and on Lolly Starter, and nowhere else', async () => {
  const { designSystemCardHtml } = await import('./design-systems-card.ts');
  const preview = { font: 'x', colors: ['#000000'], colorCount: 1 };
  const row = (source: unknown, locked = false) => {
    const el = document.createElement('div');
    el.innerHTML = designSystemCardHtml({ id: 'x', label: 'X', ns: 'user/ds/x/', headId: '', source, locked, createdAt: 0, lastUsedAt: 0 } as never, 'other', undefined, preview);
    return el.querySelector('[data-ds-act="reset"]')?.textContent?.trim() ?? null;
  };
  assert.equal(row({ kind: 'local', from: 'shipped' }), 'Reset to original');
  assert.equal(row({ kind: 'local', from: 'app' }), 'Reset to original');
  assert.equal(row({ kind: 'local' }), null, 'a system made here has no original');
  assert.equal(row({ kind: 'file', signature: 'unsigned' }), null);
  assert.equal(row({ kind: 'local', from: 'app' }, true), null, 'a managed system is never edited');
});

test('the shipped row offers Remove while another system exists, and a removed one offers Bring back', async () => {
  const shipped = { id: 'shipped', label: 'Lolly Demo', ns: '', headId: '', source: { kind: 'shipped' }, locked: false, createdAt: 0, lastUsedAt: 0 };
  const starter = { id: 'lolly-starter', label: 'Lolly Starter', ns: 'user/ds/lolly-starter/', headId: '', source: { kind: 'local' }, locked: false, createdAt: 1, lastUsedAt: 1 };
  const body = document.querySelector<HTMLElement>('#card')!;
  const cardHost = (all: unknown[], visible: unknown[]) => ({
    designSystems: { list: async () => all, visible: async () => visible, activeId: async () => 'shipped' }, assets: {},
  });

  await renderDesignSystemsCard(body, cardHost([shipped, starter], [shipped, starter]) as never);
  const row = body.querySelector<HTMLElement>('[data-ds-row="shipped"]')!;
  assert.equal(row.querySelector('[data-ds-act="remove"]')?.textContent?.trim(), 'Remove');
  assert.equal(body.querySelector('[data-ds-act="restore"]'), null);

  await renderDesignSystemsCard(body, cardHost([shipped], [shipped]) as never);
  assert.equal(body.querySelector('[data-ds-row="shipped"] [data-ds-act="remove"]'), null, 'the only system cannot go');

  await renderDesignSystemsCard(body, cardHost([{ ...shipped, locked: true }, starter], [{ ...shipped, locked: true }, starter]) as never);
  assert.equal(body.querySelector('[data-ds-row="shipped"] [data-ds-act="remove"]'), null, 'a locked build keeps its system');

  await renderDesignSystemsCard(body, cardHost([{ ...shipped, hidden: true }, starter], [starter]) as never);
  assert.equal(body.querySelector('[data-ds-row="shipped"]'), null);
  assert.match(body.querySelector('[data-ds-act="restore"]')?.textContent ?? '', /Bring back Lolly Demo/);
  assert.equal(body.querySelector('[data-ds-row="lolly-starter"] .ds-row-source')?.textContent, 'Made here');

  // After a first edit the person's copy carries the name, so the way back says "original".
  const edited = { ...starter, id: 'default', label: 'Lolly Demo', source: { kind: 'local', from: 'shipped' } };
  const companion = { ...starter, source: { kind: 'local', from: 'app' } };
  await renderDesignSystemsCard(body, cardHost([{ ...shipped, hidden: true }, edited, companion], [edited, companion]) as never);
  assert.match(body.querySelector('[data-ds-act="restore"]')?.textContent ?? '', /Bring back the original Lolly Demo/);
  assert.equal(body.querySelector('[data-ds-row="default"] .ds-row-source')?.textContent, 'Edited here');
  assert.equal(body.querySelector('[data-ds-row="lolly-starter"] .ds-row-source')?.textContent, 'Came with this app');
});

test('a row menu closes on Escape and on a press elsewhere, and only one is open at a time', async () => {
  const { mountDesignSystemsCard } = await import('./design-systems-card.ts');
  const body = document.createElement('div'); document.body.append(body);
  const shippedRow = { id: 'shipped', label: 'Lolly Demo', ns: '', headId: '', source: { kind: 'shipped' }, locked: false, createdAt: 0, lastUsedAt: 0 };
  const starterRow = { id: 'lolly-starter', label: 'Lolly Starter', ns: 'user/ds/lolly-starter/', headId: '', source: { kind: 'local', from: 'app' }, locked: false, createdAt: 1, lastUsedAt: 1 };
  const h = { designSystems: { list: async () => [shippedRow, starterRow], visible: async () => [shippedRow, starterRow], activeId: async () => 'shipped' }, assets: {} };
  const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  mountDesignSystemsCard(body, h as never);
  await settle();
  const [demoMenu, starterMenu] = [...body.querySelectorAll<HTMLDetailsElement>('details.ds-row-more')];
  assert.ok(demoMenu && starterMenu);
  demoMenu.open = true;
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(demoMenu.open, false, 'Escape closes the open menu');
  starterMenu.open = true;
  document.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  assert.equal(starterMenu.open, false, 'a press elsewhere closes the menu');
  demoMenu.open = true;
  starterMenu.open = true;
  starterMenu.dispatchEvent(new window.Event('toggle'));
  assert.equal(demoMenu.open, false, 'opening one menu closes the other');
  assert.equal(starterMenu.open, true);
  body.remove();
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
});

test('a row whose head cannot be read keeps a plain plate and shows no count', async () => {
  const { designSystemCardHtml } = await import('./design-systems-card.ts');
  const el = document.createElement('div');
  el.innerHTML = designSystemCardHtml(records[1] as never, 'active', 12 * 1024, { font: 'x', colors: [], colorCount: 0, families: ['SUSE'], unread: true });
  assert.ok(el.querySelector('.ds-cover.ds-cover--row.is-pending'), 'the plate, not a blank cover drawn as the system');
  assert.equal(el.querySelector('.ds-row-facts')?.textContent, '12 KB', 'the size alone');
  assert.doesNotMatch(el.textContent ?? '', /0 colours/);
});

test('the card hands back a detach that takes its listeners off the page', async () => {
  const { mountDesignSystemsCard } = await import('./design-systems-card.ts');
  const { DESIGN_SYSTEM_CHANGED_EVENT } = await import('./switch.ts');
  const body = document.createElement('div'); document.body.append(body);
  let reads = 0;
  const h = { ...host(), designSystems: { ...host().designSystems, visible: async () => { reads++; return [...records]; } } };
  const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  const detach = mountDesignSystemsCard(body, h as never);
  await settle();
  assert.equal(typeof detach, 'function');
  detach();
  const before = reads;
  window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT, { detail: records[1] }));
  await settle();
  assert.equal(reads, before, 'a detached card does not read, although it is still on the page');
  body.remove();
});

test('a row menu with no room below inside the card opens upward', async () => {
  const { mountDesignSystemsCard } = await import('./design-systems-card.ts');
  const card = document.createElement('div');
  card.style.overflow = 'clip';
  const body = document.createElement('div');
  card.append(body); document.body.append(card);
  const settle = async (): Promise<void> => { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  const detach = mountDesignSystemsCard(body, host() as never);
  await settle();
  const rect = (top: number, bottom: number) => () => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() {} }) as DOMRect;
  card.getBoundingClientRect = rect(0, 400);
  const menus = [...body.querySelectorAll<HTMLDetailsElement>('details.ds-row-more')];
  const last = menus.at(-1)!;
  last.querySelector<HTMLElement>('summary')!.getBoundingClientRect = rect(340, 384);
  last.querySelector<HTMLElement>('.ds-row-menu')!.getBoundingClientRect = rect(390, 540);
  last.open = true;
  last.dispatchEvent(new dom.window.Event('toggle'));
  await settle();
  assert.equal(last.querySelector<HTMLElement>('.ds-row-menu')!.hasAttribute('data-up'), true, 'the last row opens its menu upward');
  last.open = false;
  const first = menus[0]!;
  first.querySelector<HTMLElement>('summary')!.getBoundingClientRect = rect(40, 84);
  first.querySelector<HTMLElement>('.ds-row-menu')!.getBoundingClientRect = rect(90, 240);
  first.open = true;
  first.dispatchEvent(new dom.window.Event('toggle'));
  await settle();
  assert.equal(first.querySelector<HTMLElement>('.ds-row-menu')!.hasAttribute('data-up'), false, 'a row with room below opens downward');
  detach();
  card.remove();
});
