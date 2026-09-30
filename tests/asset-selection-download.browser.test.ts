// SPDX-License-Identifier: MPL-2.0
/** Run with LOLLY_ASSETS_TEST_URL=http://localhost:5173 node --test tests/asset-selection-download.browser.test.ts */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { unzipSync, strFromU8 } from 'fflate';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { embedC2pa, extractC2paStore, GENERATED_SOURCE_TYPE } from '../engine/src/index.ts';
import { collectActionChain } from '../engine/src/c2pa-extract.ts';

const origin = process.env.LOLLY_ASSETS_TEST_URL;
test('Assets selection downloads preserve the displayed colours, source history and original bytes', {
  skip: origin ? false : 'no browser origin (set LOLLY_ASSETS_TEST_URL to a local web shell)', timeout: 90_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10"><defs><style>.c1{fill:#000000}.c2{fill:#ffffff}</style></defs><rect class="c1" width="10" height="10"/><rect class="c2" x="10" width="10" height="10"/></svg>';
  const sourcePixels = Buffer.from([0, 0, 0, 255, 255, 255]);
  const png = await embedC2pa(await sharp(sourcePixels, { raw: { width: 2, height: 1, channels: 3 } }).png().toBuffer(), 'png', {
    title: 'Selection check photo', actions: [{ action: 'c2pa.created', digitalSourceType: GENERATED_SOURCE_TYPE }],
  });
  const gif = await sharp(sourcePixels, { raw: { width: 2, height: 1, channels: 3 } }).gif().toBuffer();
  try {
    await page.addInitScript(() => {
      localStorage.setItem('lolly-welcome-dismissed', '1');
      localStorage.setItem('lolly-catalog-collapsed', '[]');
    });
    await page.goto(`${origin}/#/`, { waitUntil: 'networkidle' });
    await page.evaluate(async ({ svg, png, gif }) => {
      const moduleUrl = '/src/lib/host-ref.ts';
      const host = (await import(moduleUrl)).getHostRef();
      const svgUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
      await host.assets._syncFromIndex([
        ...['a', 'b'].map(id => ({ id: `selection-check/icon-${id}`, type: 'vector', name: `Selection check icon ${id}`, tags: ['themable'], version: '1', formats: [{ format: 'svg', url: svgUrl, width: 20, height: 10 }] })),
        { id: 'selection-check/photo', type: 'raster', name: 'Selection check photo', tags: ['photo'], version: '1', formats: [{ format: 'png', url: `data:image/png;base64,${png}`, width: 2, height: 1 }] },
        { id: 'selection-check/gif', type: 'raster', name: 'Selection check gif', tags: ['photo'], version: '1', formats: [{ format: 'gif', url: `data:image/gif;base64,${gif}`, width: 2, height: 1 }] },
      ]);
      host.assets._iconThemes = async () => [{ id: 'persimmon', label: 'Persimmon', c1: '#fe7c3f', c2: '#ff5a2b' }];
      host.assets._photoTreatments = async () => [{ id: 'persimmon', label: 'Persimmon', kind: 'duotone', shadow: '#47190d', highlight: '#ffd3bd' }];
      location.hash = '#/a?q=selection%20check';
    }, { svg, png: Buffer.from(png).toString('base64'), gif: gif.toString('base64') });
    const iconTile = page.locator('.cat-tile[data-id="selection-check/icon-a"]');
    await iconTile.waitFor();
    const iconGroup = page.locator('.cat-group').filter({ has: iconTile });
    const photoTile = page.locator('.cat-tile[data-id="selection-check/photo"]');
    const photoGroup = page.locator('.cat-group').filter({ has: photoTile });
    await iconGroup.locator('[data-theme="persimmon"]').click();
    await photoGroup.locator('[data-treatment="persimmon"]').click();
    await page.waitForFunction(() => document.querySelector<HTMLImageElement>('.cat-tile[data-id="selection-check/icon-a"] .cat-thumb')?.src.startsWith('data:'));
    for (const id of ['icon-a', 'icon-b', 'photo', 'gif']) await page.locator(`.cat-tile[data-id="selection-check/${id}"] .cat-check`).click();
    assert.ok(await page.getByRole('button', { name: 'Download selection', exact: true }).isVisible());
    const downloadZip = async (): Promise<Record<string, Uint8Array>> => {
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download selection', exact: true }).click();
      await page.locator('dialog [data-act="ok"]').click();
      const file = await pending;
      assert.equal(file.suggestedFilename(), 'lolly-assets.zip');
      return unzipSync(await readFile((await file.path())!));
    };
    const zip = await downloadZip();
    assert.equal(Object.keys(zip).filter(name => /\.(svg|png|gif)$/.test(name)).length, 4);
    for (const suffix of ['icon-a.svg', 'icon-b.svg']) {
      const entry = Object.entries(zip).find(([name]) => name.endsWith(suffix));
      assert.ok(entry);
      assert.match(strFromU8(entry[1]), /\.c1\{fill:#fe7c3f\}\.c2\{fill:#ff5a2b\}/);
      const pixels = await sharp(entry[1]).raw().toBuffer();
      assert.deepEqual([...pixels.subarray(0, 3)], [254, 124, 63]);
      const store = extractC2paStore(entry[1]);
      assert.ok(store);
      assert.ok(collectActionChain(store.store).some(action => action.action === 'c2pa.color_adjustments'));
    }
    for (const suffix of ['photo.png', 'gif.png']) {
      const entry = Object.entries(zip).find(([name]) => name.endsWith(suffix));
      assert.ok(entry, 'a treated GIF becomes a still PNG with the matching extension');
      const { data, info } = await sharp(entry[1]).raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([info.width, info.height], [2, 1]);
      for (const [offset, expected] of [[0, [71, 25, 13]], [info.channels, [255, 211, 189]]] as const) {
        expected.forEach((channel, index) => {
          assert.ok(Math.abs(data[offset + index]! - channel) <= 1, 'SVG filter channels match the chosen treatment within byte rounding');
        });
      }
      const store = extractC2paStore(entry[1]);
      assert.ok(store);
      const actions = collectActionChain(store.store);
      assert.ok(actions.some(action => action.action === 'c2pa.color_adjustments'));
      if (suffix === 'photo.png') assert.ok(actions.some(action => action.digitalSourceType === GENERATED_SOURCE_TYPE), 'the source AI credential survives the colour treatment');
    }
    // A tile's own download starts on the same colours as its grid preview.
    await page.locator('.cat-bulkbar [data-bulk="clear"]').click();
    await iconTile.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Download…', exact: true }).click();
    assert.equal(await page.locator('dialog [data-theme="persimmon"]').getAttribute('aria-pressed'), 'true');
    await page.locator('dialog .cat-dl-cancel').click();
    // Rebuild the grid through a sort change and check both previews retain the look.
    await page.locator('.cat-viewopts-btn').click();
    await page.locator('#catalog-sort').selectOption('name');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector<HTMLImageElement>('.cat-tile[data-id="selection-check/icon-a"] .cat-thumb')?.src.startsWith('data:'));
    assert.match(await photoTile.locator('.cat-thumb').getAttribute('style') ?? '', /lolly-pt-persimmon/);
    // Original photos still download byte for byte when the treatment is cleared.
    await photoGroup.locator('[data-treatment=""]').click();
    for (const id of ['icon-a', 'icon-b', 'photo', 'gif']) await page.locator(`.cat-tile[data-id="selection-check/${id}"] .cat-check`).click();
    const originalZip = await downloadZip();
    assert.deepEqual(originalZip['selection-check-photo.png'], png);
    assert.deepEqual(Buffer.from(originalZip['selection-check-gif.gif']!), gif);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
    await closeBrowser();
  }
});
