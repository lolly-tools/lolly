// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_EXPORT_TEST_URL ?? process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'No web shell origin (set LOLLY_EXPORT_TEST_URL)';

test('mounted font checks detect system fallback and an installed Arabic face stays embedded offline', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const arabic = await readFile(new URL('./fixtures/text-composition/fonts/notosansarabic/NotoSansArabic[wdth,wght].ttf', import.meta.url));
    await page.route('**/coverage-arabic.ttf', route => route.fulfill({ contentType: 'font/ttf', body: arabic }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const coveragePath = '/src/bridge/font-coverage.ts', textPath = '/src/bridge/text.ts', registryPath = '/src/bridge/font-registry.ts', portablePath = '/src/bridge/export-portable.ts';
      const { fontCoversText } = await import(coveragePath);
      const { createTextAPI } = await import(textPath);
      const { refreshFontRegistry } = await import(registryPath);
      const { renderPortableHtml } = await import(portablePath);
      const api = createTextAPI();
      const style = { fontFamily: 'SUSE', fontWeight: '700', fontStyle: 'normal' };
      const before = await Promise.all(['Hello', 'Привет мир', 'مرحبا بالعالم'].map(text => fontCoversText(style, text, api)));
      const css = document.createElement('style');
      css.textContent = '@font-face{font-family:"Coverage Arabic";src:url("/coverage-arabic.ttf");font-weight:100 900}';
      document.head.append(css);
      const canvas = document.createElement('div');
      canvas.style.cssText = 'font:700 40px "Coverage Arabic";direction:rtl';
      canvas.textContent = 'مرحبا بالعالم';
      document.body.append(canvas);
      await document.fonts.load('700 40px "Coverage Arabic"', canvas.textContent);
      refreshFontRegistry();
      const after = await fontCoversText(getComputedStyle(canvas), canvas.textContent, api);
      const html = await (await renderPortableHtml(canvas, { title: 'Arabic coverage', lang: 'ar', markup: canvas.outerHTML, styles: '', script: '' })).text();
      return { before, after, html, width: (() => { const range = document.createRange(); range.selectNodeContents(canvas); return range.getBoundingClientRect().width; })() };
    });
    assert.deepEqual(result.before, [true, false, false]);
    assert.equal(result.after, true);
    assert.match(result.html, /data:font\/ttf;base64,/);
    const offline = await browser.newPage(), requests: string[] = [];
    await offline.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    await offline.setContent(result.html);
    await offline.evaluate(() => document.fonts.ready);
    const rendered = await offline.evaluate(() => {
      const canvas = document.body.firstElementChild!;
      const range = document.createRange(); range.selectNodeContents(canvas);
      return { text: canvas.textContent, width: range.getBoundingClientRect().width, loaded: [...document.fonts].some(face => face.family === 'Coverage Arabic' && face.status === 'loaded') };
    });
    assert.equal(rendered.loaded, true);
    assert.equal(rendered.text, 'مرحبا بالعالم');
    assert.equal(rendered.width, result.width);
    assert.deepEqual(requests, []);
  } finally { await browser.close(); }
});
