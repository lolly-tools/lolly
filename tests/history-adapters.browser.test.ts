// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const opener = '[data-history-open], [data-topbar="history"]';
const fixtures = [
  { id: 'gradient', selector: 'select[data-input-id="blend"]', key: 'blend', first: 'multiply', second: 'screen', select: true },
  { id: 'chart', selector: 'textarea[data-input-id="data"], [data-input-id="data"] textarea', key: 'data', first: 'Quarter,Revenue\nQ1,17\nQ2,29', second: 'Quarter,Revenue\nQ1,28\nQ2,42' },
  { id: 'snippet', selector: 'textarea[data-input-id="code"], [data-input-id="code"] textarea', key: 'code', first: 'const launch = "autumn";', second: 'const launch = "winter";' },
  { id: 'qr-code', selector: 'input[data-input-id="url"], [data-input-id="url"] input', key: 'url', first: 'https://example.test/autumn', second: 'https://example.test/winter' },
  { id: 'org-chart', selector: '[data-topbar="name"]', key: '__label', first: 'Autumn team', second: 'Winter team' },
  { id: 'pricing-table', selector: '[data-field-id="data:t:0:1"]', key: 'data', first: '$19', second: '$29', table: true },
  { id: 'wordmark', selector: 'input[data-input-id="text"], [data-input-id="text"] input', key: 'text', first: 'Autumn', second: 'Winter' },
];
async function saved(page: Page, key: string, expected: string, table = false): Promise<void> {
  await page.waitForFunction(async ({ key, expected, table }) => {
    const path = '/src/lib/host-ref.ts', slot = history.state?.lollyHistory?.slot;
    if (!slot) return false;
    const state = (await import(path)).getHostRef().state;
    const record = await state.load(slot), value = table ? record?.[key]?.rows?.[0]?.[1] : record?.[key];
    return value === expected;
  }, { key, expected, table });
}
async function reveal(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().evaluate(el => {
    for (let parent: Node | null = el; parent; parent = parent.parentNode ?? (parent instanceof ShadowRoot ? parent.host : null)) if (parent instanceof HTMLDetailsElement) parent.open = true;
  });
}

for (const fixture of fixtures) test(`${fixture.id}: edits recover, checkpoint with a thumbnail, reload, and reopen an older copy`, { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/#/tool/${fixture.id}`, { waitUntil: 'networkidle' });
    await page.locator(opener).waitFor(); await page.keyboard.press('Escape');
    // A visit and onInit/render activity must not manufacture a saved creation.
    await page.waitForTimeout(2100);
    assert.equal(await page.evaluate(async () => { const path = '/src/lib/host-ref.ts'; return (await (await import(path)).getHostRef().state.list()).length; }), 0);
    const edit = async (value: string): Promise<void> => {
      await reveal(page, fixture.selector);
      if (fixture.select) await page.locator(fixture.selector).selectOption(value);
      else await page.locator(fixture.selector).fill(value);
    };
    await edit(fixture.first); await saved(page, fixture.key, fixture.first, fixture.table);
    await page.locator(opener).click();
    await page.locator('.revision-history-entry img:not([hidden])').first().waitFor({ timeout: 15_000 });
    // Keep the first version: automatic checkpoints in the same minute may be
    // compacted, while a named milestone must remain available for this copy.
    await page.locator('.revision-history-entry').first().getByRole('button', { name: 'Name version', exact: true }).click();
    await page.getByRole('textbox', { name: 'Milestone name' }).fill('Initial version');
    await page.getByRole('button', { name: 'Keep milestone', exact: true }).click();
    await page.locator('.revision-history-entry strong', { hasText: 'Initial version' }).waitFor();
    const original = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts', state = (await import(path)).getHostRef().state, slot = history.state.lollyHistory.slot;
      const entry = (await state.history.list({ slot })).entries[0];
      return { slot, id: entry.id, data: await state.history.read(entry.id), head: await state.history.head(slot) };
    });
    assert.equal(fixture.table ? original.data.data.rows[0][1] : original.data[fixture.key], fixture.first);
    if (fixture.id === 'org-chart') assert.ok(original.data.boxes.length > 0);
    await page.reload({ waitUntil: 'networkidle' }); await page.locator(opener).waitFor(); await page.keyboard.press('Escape');
    await reveal(page, fixture.selector); assert.equal(await page.locator(fixture.selector).inputValue(), fixture.first);
    assert.equal(await page.evaluate(() => history.state.lollyHistory.slot), original.slot);
    await edit(fixture.second);
    // Navigation flushes the latest typed inputs without waiting a minute.
    await page.locator(opener).click();
    await page.getByRole('link', { name: 'Open app history', exact: true }).click();
    await page.waitForFunction(async ({ slot, key, value, table }) => {
      const path = '/src/lib/host-ref.ts', state = (await import(path)).getHostRef().state;
      const data = await state.load(slot); return (table ? data?.[key]?.rows?.[0]?.[1] : data?.[key]) === value && (await state.history.list({ slot })).entries.length === 2;
    }, { slot: original.slot, key: fixture.key, value: fixture.second, table: fixture.table });
    await page.locator('.app-history > header').getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.locator('.app-history-row').getByRole('button', { name: 'Versions', exact: true }).click();
    await page.locator('.revision-history-entry').nth(1).getByRole('button', { name: 'Open as a copy', exact: true }).click();
    await page.locator(opener).waitFor();
    await reveal(page, fixture.selector);
    if (fixture.key !== '__label') assert.equal(await page.locator(fixture.selector).inputValue(), fixture.first);
    const final = await page.evaluate(async (original) => {
      const path = '/src/lib/host-ref.ts', state = (await import(path)).getHostRef().state;
      const rows = await state.list();
      const copy = rows.find((row: { slot: string }) => row.slot !== original.slot);
      return { rows: rows.length, copy: await state.load(copy.slot), source: await state.history.read(original.id), latest: await state.load(original.slot) };
    }, original);
    assert.equal(final.rows, 2); assert.deepEqual(final.source, original.data);
    assert.equal(fixture.table ? final.latest.data.rows[0][1] : final.latest[fixture.key], fixture.second);
    assert.equal(final.copy.__toolId, fixture.id);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Snippet history retains an uploaded icon version after replacement and mobile history stays reachable', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`${origin}/#/history`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', assetPath = '/src/bridge/asset-history.ts';
      const db = await (await import(dbPath)).openDB();
      await (await import(assetPath)).writeVersionedUserAsset(db, { id: 'user/upload/history-icon', version: 'v1', format: 'svg', type: 'vector',
        blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="green"/></svg>'], { type: 'image/svg+xml' }) });
    });
    await page.goto(`${origin}/#/tool/snippet?titleIcon=user%2Fupload%2Fhistory-icon`, { waitUntil: 'networkidle' });
    await page.locator(opener).waitFor();
    await page.locator('textarea[data-input-id="code"], [data-input-id="code"] textarea').fill('const history = "kept";');
    await saved(page, 'code', 'const history = "kept";');
    await page.locator(opener).click(); await page.locator('.revision-history-entry img:not([hidden])').first().waitFor();
    const result = await page.evaluate(async () => {
      const hostPath = '/src/lib/host-ref.ts', dbPath = '/src/bridge/db.ts', assetPath = '/src/bridge/asset-history.ts';
      const host = (await import(hostPath)).getHostRef(), db = await (await import(dbPath)).openDB();
      const entry = (await host.state.history.list({ slot: history.state.lollyHistory.slot })).entries[0];
      const data = await host.state.history.read(entry.id);
      await (await import(assetPath)).writeVersionedUserAsset(db, { id: 'user/upload/history-icon', version: 'v2', format: 'svg', type: 'vector',
        blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>'], { type: 'image/svg+xml' }) });
      const blocked = await host.assets._removeUserAssetVersion('user/upload/history-icon', 'v1').then(() => '', (error: Error) => error.message);
      return { pin: data.titleIcon.pin, bytes: await (await host.assets._getBlob('user/upload/history-icon', data.titleIcon.pin)).text(), blocked };
    });
    assert.deepEqual(result.pin, { version: 'v1', format: 'svg' }); assert.match(result.bytes, /circle/); assert.match(result.blocked, /used by a saved creation/);
    const shots = new URL('../plans/221-history-mockups/', import.meta.url); await mkdir(shots, { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('build-history-snippet-desktop.png', shots)) });
    await page.locator('.revision-history-panel').getByRole('button', { name: 'Close', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(opener).click(); await page.locator('.revision-history-panel').waitFor();
    await page.locator('.revision-history-entry img:not([hidden])').first().waitFor();
    assert.ok(await page.locator('.revision-history-panel').evaluate(el => el.scrollWidth <= el.clientWidth));
    assert.equal(await page.locator('#view').evaluate(el => el instanceof HTMLElement && el.inert), true);
    assert.equal(await page.locator('#render-pill').evaluate(el => {
      const box = el.getBoundingClientRect(); return !!document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('.revision-history-panel');
    }), true, 'the floating export controls must stay below the sheet');
    await page.screenshot({ path: fileURLToPath(new URL('build-history-snippet-mobile.png', shots)) });
    await page.locator('.revision-history-panel').getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await page.locator('#view').evaluate(el => el instanceof HTMLElement && el.inert), false);
  } finally { await browser.close(); }
});
