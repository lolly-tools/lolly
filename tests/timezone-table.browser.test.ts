// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Page } from 'playwright';

const origin = process.env.LOLLY_TIMEZONE_TEST_URL;
const skip = origin ? false : 'LOLLY_TIMEZONE_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
function browserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => { if (!error.message.startsWith('ResizeObserver loop')) errors.push(error.message); });
  return errors;
}
const cell = (row: number, col = 0) => `[data-field-id="locations:t:${row}:${col}"]`;
async function reveal(page: Page): Promise<void> {
  await page.locator('[data-table-id="locations"]').evaluate(el => {
    for (let p: Node | null = el; p; p = p.parentNode ?? (p instanceof ShadowRoot ? p.host : null))
      if (p instanceof HTMLDetailsElement) p.open = true;
  });
}
async function places(page: Page): Promise<any[]> {
  return page.locator('#tool-canvas .tz-state').evaluate(el => JSON.parse(el.textContent!).inputs.locations);
}
async function changed(page: Page, expected: string): Promise<void> {
  await page.waitForFunction(expected => JSON.parse(document.querySelector('#tool-canvas .tz-state')!.textContent!).inputs.locations[0]?.place === expected, expected);
}
async function paste(page: Page, text: string): Promise<void> {
  await page.locator('[data-table-id="locations"]').evaluate((el, text) => {
    const data = new DataTransfer(); data.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }, text);
}

test('Timezone table: first visit, keyboard entry, list paste, row actions and reload', { skip }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = browserErrors(page);
    page.setDefaultTimeout(12_000);
    await page.goto(origin + '/#/tool/timezone', { waitUntil: 'domcontentloaded' });
    await page.locator('.tmpl-chooser-close').click();
    await page.locator('.tool-guide-done').click();
    await reveal(page);
    assert.equal(await page.locator('[data-table-id="locations"] tbody tr:not([data-table-ghost])').count(), 6);
    assert.equal(await page.locator('[data-table-add-col]').count(), 0);
    await page.locator(cell(0)).fill('London, United Kingdom');
    await page.locator(cell(0)).press('Enter');
    assert.equal(await page.locator(cell(1)).evaluate(el => el === document.activeElement), true);
    await changed(page, 'London, United Kingdom');
    await paste(page, 'Nuremberg, DE\nPrague, CZ\nNoosa, Australia');
    await changed(page, 'Nuremberg, DE');
    assert.equal((await places(page)).length, 3);
    await page.locator('[data-table-move-up="1"]').click();
    await changed(page, 'Prague, CZ');
    await page.locator('[data-table-del-row="1"]').click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('#tool-canvas .tz-state')!.textContent!).inputs.locations.length === 2);
    await page.locator(cell(2)).fill('Sofia, BG');
    await page.locator(cell(2)).press('Enter');
    assert.equal(await page.locator(cell(3)).evaluate(el => el === document.activeElement), true);
    await page.locator('[data-table-pop]').click();
    await page.locator('.floatp [data-table-id="locations"]').waitFor();
    await page.locator(cell(0, 2)).fill('Host');
    await page.locator(cell(0, 2)).press('Tab');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#tool-canvas .tz-state')!.textContent!).inputs.locations[0].annotation === 'Host');
    const before = await places(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => { const b = document.querySelector('.floatp')!.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1; });
    await page.reload({ waitUntil: 'networkidle' });
    await reveal(page);
    const content = (rows: any[]) => rows.map(({ __rid, ...row }) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)])));
    assert.deepEqual(content(await places(page)), content(before));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Timezone table: saved object ids, optional fields and large-list deletion survive editing', { skip }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); const errors = browserErrors(page); page.setDefaultTimeout(12_000);
    const rows = Array.from({ length: 75 }, (_, i) => ({ _id: 'row-' + i, place: 'Europe/London', label: 'Studio ' + i, spread: true, longitude: 0, latitude: 0, metadata: 'kept-' + i }));
    await page.goto(origin + '/#/tool/timezone?' + new URLSearchParams({ locations: JSON.stringify(rows) }), { waitUntil: 'domcontentloaded' });
    await page.locator('.tool-guide-done').click(); await reveal(page);
    await page.locator('[data-table-vgrid] .dg-row').first().waitFor();
    assert.ok(await page.locator('[data-table-vgrid] .dg-row').count() < 40);
    assert.equal(await page.locator('.dg-del-col').count(), 0);
    const before = await places(page);
    await page.locator('.dg-rowctl[data-del-row="0"]').click();
    await page.waitForFunction(() => JSON.parse(document.querySelector('#tool-canvas .tz-state')!.textContent!).inputs.locations.length === 74);
    assert.deepEqual((await places(page))[0], before[1]);
    const saved = await places(page);
    await page.evaluate(async locations => { const module = '/src/lib/host-ref.ts'; const host = (await import(module)).getHostRef(); await host.state.save('timezone-table-fixture', { __toolId: 'timezone', locations }); }, saved);
    await page.goto(origin + '/#/tool/timezone?slot=timezone-table-fixture', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => JSON.parse(document.querySelector('#tool-canvas .tz-state')?.textContent || '{}').inputs?.locations?.[0]?._id === 'row-1'); await reveal(page);
    assert.deepEqual(await places(page), saved);
    await page.reload({ waitUntil: 'networkidle' }); await reveal(page);
    assert.deepEqual(await places(page), saved);
    // This tool has no automatic-history adapter: newer URL edits win on
    // refresh, while the explicitly saved record stays unchanged.
    await page.locator('.dg-row .dg-cell[data-row="0"][data-col="0"]').dblclick();
    await page.locator('.dg-editor').fill('Discard this edit');
    await page.locator('.dg-editor').press('Escape');
    assert.equal((await places(page))[0].place, 'Europe/London');
    await page.locator('.dg-row .dg-cell[data-row="0"][data-col="0"]').dblclick();
    await page.locator('.dg-editor').fill('Noosa, AU');
    await page.locator('.dg-editor').press('Enter');
    await changed(page, 'Noosa, AU');
    await page.reload({ waitUntil: 'networkidle' }); await reveal(page);
    await changed(page, 'Noosa, AU');
    assert.equal(await page.evaluate(async () => { const module = '/src/lib/host-ref.ts'; return (await (await import(module)).getHostRef().state.load('timezone-table-fixture')).locations[0].place; }), 'Europe/London');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
