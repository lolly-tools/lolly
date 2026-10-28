// SPDX-License-Identifier: MPL-2.0
/** Exercise file creation and project saves through the real shell and IndexedDB. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { getBrowser, closeBrowser, browserInstalled } from '../packages/node-shell/src/browsers.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
test('Projects creates Write files and Text saves the latest editor contents into a project', {
  skip: browserInstalled() ? false : 'No browser installed; set LOLLY_BROWSER_CHANNEL=chrome.', timeout: 240_000,
}, async () => {
  process.env.LOLLY_ROOT = root;
  process.env.LOLLY_PROFILE = 'lolly-start';
  const { createServer } = await import('vite');
  const require = createRequire(import.meta.url);
  const server = await createServer({ root: join(root, 'shells/web'), configFile: join(root, 'shells/web/vite.config.js'),
    cacheDir: join(root, 'node_modules/.vite-projects-write-test'), server: { host: '127.0.0.1', port: 0, fs: { allow: [root, dirname(require.resolve('harfbuzzjs'))] } }, logLevel: 'error' });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!;
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}#/p`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.locator('.projects').waitFor();
    await page.locator('.projects').evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 500, clientY: 250, button: 2 })));
    await page.locator('.projects-menu [data-act="new-file"]').click();
    const dialog = page.getByRole('dialog', { name: 'New file', exact: true });
    await dialog.locator('[data-file-name]').fill('Roadmap');
    await dialog.locator('[data-file-type]').selectOption('markdown');
    await dialog.getByRole('button', { name: 'Create file', exact: true }).click();
    await page.locator('.text-workspace h1').filter({ hasText: 'Write' }).waitFor();
    await page.getByText('Tool loaded', { exact: true }).waitFor();
    const slot = new URLSearchParams(page.url().split('?')[1]).get('slot')!;
    assert.ok(slot.startsWith('write:'));
    assert.equal(await page.locator('[data-write-name]').inputValue(), 'Roadmap.md');
    assert.equal(await page.locator('[data-document]').isVisible(), true);
    assert.equal(await page.locator('[data-mode="characters"]').isVisible(), false);
    const empty = await page.evaluate(async slot => {
      const path = '/src/lib/host-ref.ts';
      return (await import(path)).getHostRef().state.load(slot);
    }, slot);
    assert.equal(empty.body, '', 'the empty file is durable before editing');
    const text = '# Roadmap\n\nKeep **all** the words.\n\n[Unsafe](javascript:alert(1))';
    await page.locator('[data-editor] textarea').fill(text);
    await page.locator('[data-markdown]').click();
    const preview = page.getByRole('dialog', { name: 'Markdown preview', exact: true });
    assert.equal(await preview.locator('h1').innerText(), 'Roadmap');
    assert.equal(await preview.locator('a[href^="javascript:"]').count(), 0);
    await preview.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('[data-save-project]').click();
    const save = page.locator('dialog.save-dialog');
    await save.waitFor();
    await save.locator('[data-act="save-project"]').click();
    await save.waitFor({ state: 'detached' });
    await page.reload({ waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.locator('[data-editor] textarea').waitFor();
    assert.equal(await page.locator('[data-editor] textarea').inputValue(), text);
    assert.equal(await page.locator('[data-write-name]').inputValue(), 'Roadmap.md');
    // The independent Text utility must file its current editor buffer, including
    // a save made before its normal input debounce has elapsed.
    await page.goto(`${origin}#/tool/text-helper`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.getByText('Tool loaded', { exact: true }).waitFor();
    await page.locator('[data-mode="text"]').click();
    await page.locator('[data-editor] textarea').fill('The final keystrokes stay with this project.');
    await page.locator('[data-save-project]').click();
    await save.waitFor();
    await save.locator('[data-project]').selectOption('__new_project__');
    await save.locator('[data-new-project]').fill('Writing');
    await save.locator('[data-act="save-project"]').click();
    await save.waitFor({ state: 'detached' });
    const kept = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts';
      const host = (await import(path)).getHostRef();
      const profile = await host.profile.get();
      const folder = profile.folders.find((entry: { name: string }) => entry.name === 'Writing');
      const document = await host.state.load(folder.items[0].ref);
      return { folder, document };
    });
    assert.equal(kept.document.__toolId, 'text-helper');
    assert.equal(kept.document.body, 'The final keystrokes stay with this project.');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}#/tool/write?slot=${encodeURIComponent(slot)}`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.locator('[data-write-name]').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Write fits on a phone');
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error(JSON.stringify({ errors, text: (await page.locator('body').innerText()).slice(-4000) }));
    throw error;
  } finally {
    await context.close(); await closeBrowser(); await server.close();
  }
});
