// SPDX-License-Identifier: MPL-2.0
/**
 * A Design document too large for a link leaves the address (perf review C1 step 3, S7).
 *
 * Past the pack limit the address keeps its workspace, `_view` and the slot of the copy
 * automatic history saved, so pinch, pan and edit writes stay small. Share offers that
 * copy's link for this device, labelled as such, and the .lolly file, and a reload
 * restores the document from the slot. A small document's address still carries the document.
 *
 * Run against a served web shell:
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:4187 node --import ./tests/css-stub.mjs --test tests/design-large-address.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Page } from 'playwright';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { shellSettled } from './helpers/shell-settled.ts';
import { settledUrl } from './helpers/settled-address.ts';
import { BESIDE_PACK_PARAMS, RESULT_CONTEXT_PARAMS, WORKSPACE_PARAMS } from '../shells/web/src/lib/tool-url-state.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Serve the web shell and set LOLLY_EXPORT_TEST_URL.';

/** Text rows whose content passes the 256 KiB pack limit (engine/src/url-pack.ts). */
function largeRows(count = 320): Array<Record<string, unknown>> {
  const words = 'large documents leave the address and keep a pointer to the saved copy instead of their content ';
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`, kind: 'text', x: 40 + (i % 16) * 120, y: 40 + Math.floor(i / 16) * 90, w: 110, h: 80, rot: 0,
    fontSize: 12, fg: '#1d1d1d', text: `${i}: ${words.repeat(10)}`,
  }));
}

async function setBoxes(page: Page, rows: Array<Record<string, unknown>>): Promise<void> {
  await page.evaluate((value) => (window as unknown as { __lollySetInput(id: string, value: unknown): void }).__lollySetInput('boxes', value), rows);
  await page.waitForFunction((n) => document.querySelectorAll('#tool-canvas .lolly-box[data-box-id]').length === n, rows.length, { timeout: 60_000 });
}

const modelRows = (page: Page): Promise<number> => page.evaluate(() =>
  ((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(input => input.id === 'boxes')!.value as unknown[]).length);

test('a large Design document keeps a pointer in the address, shares the device link and reloads from its slot', { skip, timeout: 240_000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/design?c2pa=0&imprint=0`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.waitForFunction(() => typeof (window as unknown as { __lollySetInput?: unknown }).__lollySetInput === 'function' && !!document.querySelector('#tool-canvas'));

    // A small document: the address carries it, readable or packed.
    await setBoxes(page, largeRows(3));
    const small = new URL(await settledUrl(page)).searchParams;
    assert.ok(small.has('bx') || small.has('boxes') || small.has('z'), `a small document stays in the address: ${[...small.keys()].join(',')}`);

    // Past the limit: once automatic history has saved a copy, the address is the pointer.
    const rows = largeRows();
    await setBoxes(page, rows);
    await page.waitForFunction(() => {
      const params = new URLSearchParams(location.search);
      return params.has('slot') && !params.has('bx') && !params.has('boxes') && !params.has('z');
    }, undefined, { timeout: 60_000 });
    const address = await settledUrl(page);
    const pointer = new URL(address).searchParams;
    assert.ok(address.length < 2_000, `the pointer address is small (${address.length} characters)`);
    const kept = new Set<string>([...WORKSPACE_PARAMS, ...BESIDE_PACK_PARAMS, ...RESULT_CONTEXT_PARAMS]);
    for (const key of pointer.keys()) assert.ok(kept.has(key), `only workspace and pointer keys remain, not ${key}`);
    const slot = pointer.get('slot')!;

    // Share: no link can carry it, so the field holds this device's link and says so.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { __copied: string }).__copied = text; } } });
    });
    await page.locator('[data-topbar="share"]').click();
    const field = page.locator('.share-link-field');
    await page.waitForFunction(() => (document.querySelector<HTMLInputElement>('.share-link-field')?.value ?? '').includes('slot='));
    const link = new URL(await field.inputValue());
    assert.equal(link.searchParams.get('slot'), slot);
    assert.equal(link.searchParams.has('bx') || link.searchParams.has('z'), false);
    assert.equal(await field.getAttribute('aria-label'), 'Link that opens this creation on this device only');
    assert.equal(await page.locator('[data-device-link-note]').isVisible(), true);
    assert.match(await page.locator('[data-share-warning]').innerText(), /too large for a link[\s\S]*\.lolly/);
    await page.locator('.share-copy-btn').click();
    await page.waitForFunction(() => !!(window as unknown as { __copied?: string }).__copied);
    assert.equal(await page.evaluate(() => (window as unknown as { __copied: string }).__copied), link.href, 'Copy link copies the device link');
    await page.keyboard.press('Escape');

    // A reload restores the document from the slot the address points at.
    await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
    await page.waitForFunction((n) => document.querySelectorAll('#tool-canvas .lolly-box[data-box-id]').length === n, rows.length, { timeout: 60_000 });
    assert.equal(await modelRows(page), rows.length);
    assert.equal(await page.locator('#tool-canvas [data-box-id="t319"]').count(), 1);
    assert.equal(new URL(await settledUrl(page)).searchParams.get('slot'), slot, 'still the pointer after the reload');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
