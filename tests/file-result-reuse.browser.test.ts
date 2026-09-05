// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_CONVERT_TEST_URL;
test('real UI reuses exact result bytes in the library, a new design and another conversion', { skip: !origin, timeout: 90_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser(); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${origin}/#/convert`, { waitUntil: 'networkidle' });
    await page.locator('[data-file]').setInputFiles({ name: 'design-proof.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect width="300" height="150" fill="#238875"/></svg>') });
    await page.locator('[data-convert]').click(); await page.locator('.convert-output').waitFor();
    const card = page.locator('.convert-output'); await card.locator('.convert-reuse summary').click();
    await card.locator('[data-result-library]').click();
    await page.waitForFunction(() => document.querySelector('[data-status]')?.textContent?.includes('Added to your library'));
    await card.locator('[data-result-library]').click();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.convert-output [data-result-library]')?.disabled);
    const reused = await page.evaluate(async () => {
      const hostPath = '/src/lib/host-ref.ts', storePath = '/src/lib/file-operation-store.ts';
      const host = (await import(hostPath)).getHostRef(); const store = await (await import(storePath)).localFileOperations();
      const operation = (await store.list())[0]; const id = `user/file-result/${operation.id}`; const asset = await host.assets._getUserRecord(id);
      const output = await store.getOutput(operation.id);
      return { id, version: asset.version, sha256: asset.checksum, expected: operation.report.outputs[0].sha256, bytes: [...new Uint8Array(await asset.blob.arrayBuffer())], output: [...new Uint8Array(await output.arrayBuffer())], reference: asset.meta.fileReference, count: (await host.assets._listUserAssets()).filter((a: { id: string }) => a.id.startsWith('user/file-result/')).length };
    });
    assert.deepEqual(reused.bytes, reused.output); assert.equal(reused.sha256, reused.expected); assert.equal(reused.count, 1); assert.equal(reused.reference.role, 'output');
    await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/result-reuse-desktop.png', fullPage: true });
    await card.locator('[data-result-design]').click();
    await page.locator('.platform-layout.convert-view').waitFor({ state: 'detached' });
    await page.locator('[data-box-id="file-image"] img').first().waitFor();
    const image = page.locator('[data-box-id="file-image"] img').first();
    await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('[data-box-id="file-image"] img'); return image?.complete && image.naturalWidth === 300; });
    assert.equal(await image.evaluate(el => (el as HTMLImageElement).naturalHeight), 150);
    assert.equal(await page.locator('[data-action="export-width"]').inputValue(), '300');
    assert.equal(await page.locator('[data-action="export-height"]').inputValue(), '150');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/result-reuse-design.png', fullPage: true });
    // The insert-only bridge refuses a colliding writer instead of replacing.
    const preserved = await page.evaluate(async reused => {
      const path = '/src/lib/host-ref.ts'; const host = (await import(path)).getHostRef(); let refused = false;
      try { await host.assets._uploadUserAsset({ id: reused.id, type: 'raster', format: 'png', version: crypto.randomUUID(), blob: new Blob(['imposter']) }, { expectedVersion: null }); } catch { refused = true; }
      return { refused, version: (await host.assets._getUserRecord(reused.id)).version };
    }, reused);
    assert.equal(preserved.refused, true); assert.equal(preserved.version, reused.version);
    await page.goto(`${origin}/#/convert`, { waitUntil: 'networkidle' });
    await page.locator('[data-operation] .convert-reuse summary').click();
    await page.locator('[data-operation] [data-result-convert]').click();
    await page.locator('.convert-name').waitFor(); assert.equal(await page.locator('.convert-name').innerText(), 'design-proof.png');
    await page.locator('[data-format]').selectOption('jpeg'); await page.locator('[data-convert]').click(); await page.locator('.convert-output').waitFor();
    const chain = await page.evaluate(async expected => {
      const path = '/src/lib/file-operation-store.ts'; const store = await (await import(path)).localFileOperations();
      const record = (await store.list())[0]; return { hash: record.input.sha256, expected, target: record.request.target, state: record.state };
    }, reused.expected);
    assert.equal(chain.hash, chain.expected); assert.equal(chain.target, 'jpeg'); assert.equal(chain.state, 'succeeded');
    assert.deepEqual(errors, []);
  } finally { await context.close(); await closeBrowser(); }
});
