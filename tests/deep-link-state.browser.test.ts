// SPDX-License-Identifier: MPL-2.0
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { expandQuery } from '../engine/src/url-pack.ts';

const origin = process.env.LOLLY_DEEP_LINK_TEST_URL;
const skip = origin ? false : 'LOLLY_DEEP_LINK_TEST_URL environment variable not set';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
after(closeBrowser);

async function open(path: string) {
  const context = await (await getBrowser()).newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  await page.goto(origin! + path);
  return { page, context };
}
const query = async (href: string) => new URLSearchParams(await expandQuery(new URL(href).search.slice(1)));

test('tool content and output settings survive first sync, a fresh context and same-tool navigation', { skip, timeout: 90_000 }, async () => {
  const { page, context } = await open('/t/qr-code?p=text&text=Test&join=false&width=500&height=400&c2pa=0&meta=off&depth=16');
  try {
    await page.waitForFunction(() => new URLSearchParams(location.search).get('c2pa') === '0' && !!document.querySelector('[data-action="export-width"]'));
    const params = await query(page.url());
    for (const [key, value] of Object.entries({ p: 'text', text: 'Test', join: 'false', w: '500', h: '400', c2pa: '0', meta: 'off', depth: '16' })) assert.equal(params.get(key), value, key);
    const fresh = await (await getBrowser()).newContext();
    try {
      const reopened = await fresh.newPage(); await reopened.goto(page.url());
      await reopened.waitForFunction(() => (document.querySelector('[data-input-id="text"]') as HTMLInputElement)?.value === 'Test');
      assert.equal(await reopened.locator('[data-input-id="join"]').isChecked(), false);
      assert.equal(await reopened.locator('[data-action="export-width"]').inputValue(), '500');
      assert.equal(await reopened.locator('[data-action="pdf-c2pa"]').isChecked(), false);
    } finally { await fresh.close(); }
    await page.evaluate(() => { history.pushState(null, '', '/t/qr-code?p=text&text=Other'); window.dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForFunction(() => (document.querySelector('[data-input-id="text"]') as HTMLInputElement)?.value === 'Other');
    await page.goBack();
    await page.waitForFunction(() => (document.querySelector('[data-input-id="text"]') as HTMLInputElement)?.value === 'Test');
    await page.locator('#render-fab').click();
    await page.waitForFunction(() => new URLSearchParams(location.search).has('options'));
    await page.locator('[data-action="export-width"]').fill('650');
    await page.locator('[data-action="export-width"]').dispatchEvent('change');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('w') === '650');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !new URLSearchParams(location.search).has('options'));
    assert.equal((await query(page.url())).get('w'), '650', 'closing export keeps edits made over its history entry');
  } finally { await context.close(); }
});

test('live Gallery and Assets filters agree with reload and browser history', { skip, timeout: 90_000 }, async () => {
  const { page, context } = await open('/#/?q=qr');
  try {
    await page.locator('.gallery-search').fill('chart');
    await page.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('q') === 'chart');
    await page.locator('#spotlight-listbox').waitFor({ state: 'visible' });
    await page.evaluate(() => { location.hash = '/?q=gradient'; });
    await page.waitForFunction(() => (document.querySelector('.gallery-search') as HTMLInputElement)?.value === 'gradient');
    await page.goBack();
    await page.waitForFunction(() => (document.querySelector('.gallery-search') as HTMLInputElement)?.value === 'chart');
    await page.goto(origin! + '/#/a?q=logo&type=vector');
    await page.locator('[data-cat-toggle]').first().click();
    let params = new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
    assert.equal(params.get('q'), 'logo'); assert.equal(params.get('type'), 'vector'); assert.ok(params.has('section'));
    await page.locator('[data-typefilter="all"]').click();
    await page.locator('.gallery-search').fill('font');
    await page.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('q') === 'font');
    const before = await page.locator('.cat-group:not(.is-collapsed)').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.group));
    await page.reload();
    await page.waitForFunction(() => (document.querySelector('.gallery-search') as HTMLInputElement)?.value === 'font');
    params = new URLSearchParams(new URL(page.url()).hash.split('?')[1]); assert.equal(params.get('type'), 'all');
    assert.deepEqual(await page.locator('.cat-group:not(.is-collapsed)').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.group)), before);
  } finally { await context.close(); }
});

test('Design workspace state restores while Share contains only content and output', { skip, timeout: 120_000 }, async () => {
  const { page, context } = await open('/design?bx=shape,box,100,100,180,120&_sel=shape&_t=2&c2pa=0');
  try {
    await page.waitForFunction(() => !!(window as unknown as { lolly?: { ui?: unknown } }).lolly?.ui);
    await page.evaluate(() => (window as unknown as { lolly: { ui: { apply(state: unknown): void } } }).lolly.ui.apply({ v: 1, sel: ['shape'], t: 3 }));
    await page.waitForFunction(() => {
      const value = new URLSearchParams(location.search).get('_ui');
      return value && JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/'))).t === 3;
    });
    const href = page.url();
    await page.locator('[data-topbar="share"]').click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('_dialog') === 'share');
    const shared = await query(await page.locator('.share-link-field').inputValue());
    for (const key of ['_ui', '_view', '_sel', '_t', '_panel', '_dialog', '_appearance', '_nav', '_inspector', 'slot', 'full', 'options']) assert.equal(shared.has(key), false, key);
    assert.ok(shared.get('bx')); assert.equal(shared.get('c2pa'), '0');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.share-link-field'));
    assert.equal(new URLSearchParams(new URL(page.url()).search).has('_dialog'), false);
    const fresh = await (await getBrowser()).newContext();
    try {
      const reopened = await fresh.newPage(); await reopened.goto(href);
      await reopened.waitForFunction(() => {
        const state = (window as unknown as { lolly?: { ui?: { getState(): { sel: string[]; t: number } } } }).lolly?.ui?.getState();
        return state?.t === 3 && state.sel.includes('shape');
      });
    } finally { await fresh.close(); }
    assert.equal((await query(page.url())).get('bx'), (await query(href)).get('bx'));
    await page.evaluate(() => {
      const params = new URLSearchParams(location.search);
      params.set('_ui', btoa(JSON.stringify({ v: 1, sel: [], timeline: false })));
      history.pushState(history.state, '', `${location.pathname}?${params}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(() => {
      const state = (window as unknown as { lolly?: { ui?: { getState(): { sel: string[]; timeline: boolean } } } }).lolly?.ui?.getState();
      return state?.timeline === false && state.sel.length === 0;
    });
    assert.equal(await page.locator('.unsaved-dialog').count(), 0);
  } finally { await context.close(); }
});

test('settings focus, open cards and search restore without changing saved preferences', { skip, timeout: 90_000 }, async () => {
  const { page, context } = await open('/#/settings');
  try {
    await page.locator('[data-nav="a11y-section"]').click();
    await page.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('focus') === 'a11y-section');
    await page.locator('#profile-nav-search').fill('accessibility');
    await page.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('q') === 'accessibility');
    await page.reload();
    await page.waitForFunction(() => (document.querySelector('#profile-nav-search') as HTMLInputElement)?.value === 'accessibility');
    assert.equal(await page.locator('#a11y-section').evaluate(node => (node as HTMLDetailsElement).open), true);
    await page.evaluate(() => { localStorage.setItem('lolly-profile-open', '{"details-section":true}'); });
    await page.goto(origin! + '/#/settings?_open=');
    await page.locator('#profile-nav-search').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('lolly-profile-open')), '{"details-section":true}');
  } finally { await context.close(); }
});

test('path shortcuts and installed-app view forms preserve queries in the actual router', { skip, timeout: 90_000 }, async () => {
  const { page, context } = await open('/components?section=cl-foundations&q=button&mode=live');
  try {
    await page.locator('.cl-search-input').waitFor();
    assert.equal(await page.locator('.cl-search-input').inputValue(), 'button');
    assert.equal(await page.locator('.cl-mode-filter').inputValue(), 'live');
    const hash = await page.evaluate(async () => { const path = '/src/lib/deep-link.ts'; return (await import(path)).deepLinkToHash('lolly://projects?view=list&sort=name'); });
    await page.goto(origin! + '/' + hash);
    await page.locator('.projects-view').waitFor();
    assert.ok(page.url().includes('view=list'));
    for (const route of ['history', 'learning']) {
      const target = await page.evaluate(async name => { const path = '/src/lib/deep-link.ts'; return (await import(path)).deepLinkToHash(`lolly://${name}`); }, route);
      assert.equal(target, `#/${route}`);
      await page.goto('about:blank');
      await page.goto(origin! + '/' + target);
      await page.locator(route === 'learning' ? '.learning-ui' : '.history-view').waitFor();
    }
  } finally { await context.close(); }
});
