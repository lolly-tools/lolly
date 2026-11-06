// SPDX-License-Identifier: MPL-2.0
/**
 * Wayfinding Signage fits its direction labels with a script in the template, in a real
 * Chromium because the fit reads layout. A label left at full size shows its first letter
 * and nothing else, and a link export starts once the canvas has been quiet for 400 ms
 * (waitForQuiescence), so the fit may not depend on a frame arriving before then.
 *
 * Mounted the way the web shell mounts a tool (runTemplateScripts in lib/render-lifecycle.ts:
 * markup first, then each script re-created so it runs).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const LABEL = 'Registration and Conference Information Desk';
const face = readFile(new URL('../shells/web/public/fonts/SUSE[wght].ttf', import.meta.url));

async function signMarkup(directions: Array<{ label: string; arrow: string }>): Promise<string> {
  const tool = await loadTool('wayfinding-signage', (p: string) => readFile(new URL(`../community/${p}`, import.meta.url), 'utf8'));
  const runtime = await createRuntime(tool, baseHost(), { directions: directions as never });
  assert.deepEqual(runtime.hookErrors ?? [], [], 'the hooks render');
  return runtime.getHydrated();
}

/** The markup in place and its scripts run, all in one task, as the shell does. */
function mount(page: Page, markup: string, style = 'width:1123px;height:1588px'): Promise<void> {
  return page.evaluate(({ markup, style }) => {
    const canvas = document.createElement('div');
    canvas.id = 'canvas';
    canvas.setAttribute('style', `position:relative;${style}`);
    document.body.append(canvas);
    canvas.innerHTML = markup;
    canvas.querySelectorAll('script').forEach((old) => {
      const script = document.createElement('script');
      script.textContent = old.textContent;
      old.replaceWith(script);
    });
  }, { markup, style });
}

interface Fit { scale: string; boxes: Array<{ box: number; text: number }> }
const readFit = (page: Page, root = '#canvas'): Promise<Fit> => page.evaluate((root) => {
  const scope = document.querySelector(root)!;
  return {
    scale: scope.querySelector<HTMLElement>('.way')!.style.getPropertyValue('--label-scale'),
    boxes: [...scope.querySelectorAll('.way-label')].map((el) => ({ box: el.clientWidth, text: el.scrollWidth })),
  };
}, root);

function assertFitted(fit: Fit, what: string): void {
  assert.ok(Number(fit.scale) > 0 && Number(fit.scale) < 1, `${what}: the label was shrunk (${fit.scale})`);
  for (const { box, text } of fit.boxes) assert.ok(text <= box, `${what}: the text fits its box (${text} in ${box})`);
}

test('Wayfinding Signage fits its labels', { timeout: 120_000 }, async (t) => {
  let browser: Browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch { t.skip('needs Playwright Chromium'); return; }
  t.after(() => browser.close());
  const one = await signMarkup([{ label: LABEL, arrow: 'right' }]);

  await t.test('with no frame to run in: the fit is done when the script has run', async () => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent('<!doctype html><body>');
    // A busy page: nothing here gets a frame.
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await mount(page, one);
    assertFitted(await readFit(page), 'at once');
  });

  await t.test('more than once: a second fit gives the same answer as the first', async () => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent('<!doctype html><body>');
    await mount(page, one);
    const first = await readFit(page);
    assertFitted(first, 'first');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      // A second render of the same sign runs the script again.
      const again = document.createElement('script');
      again.textContent = document.querySelector('#canvas script')!.textContent;
      document.querySelector('#canvas')!.append(again);
    });
    assert.deepEqual(await readFit(page), first);
  });

  await t.test('when the font arrives late: the labels are measured again in that font', async () => {
    const page = await browser.newPage();
    t.after(() => page.close());
    let release = (): void => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route('http://localhost/**', async (route) => {
      if (new URL(route.request().url()).pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body>' });
      await held;
      return route.fulfill({ status: 200, contentType: 'font/ttf', body: await face });
    });
    await page.goto('http://localhost/');
    await page.addStyleTag({ content: "@font-face{font-family:'Late';src:url(/late.ttf) format('truetype');font-weight:100 900} :root{--font-brand:'Late'}" });
    await mount(page, one);
    const before = await readFit(page);
    assert.equal(await page.evaluate(() => document.fonts.status), 'loading', 'the fixture: laying the label out started the font');
    release();
    await page.evaluate(() => document.fonts.ready);
    const after = await readFit(page);
    assertFitted(after, 'in the font');
    assert.notEqual(after.scale, before.scale, 'the first measure was in the fallback face');
    // The same sign mounted now the font is here is what the late one has to match.
    await page.evaluate(() => { document.querySelector('#canvas')!.id = 'late'; });
    await mount(page, one);
    assert.equal(after.scale, (await readFit(page)).scale);
  });

  await t.test('a sign with no size yet: fitted when it gets one', async () => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent('<!doctype html><body>');
    await mount(page, one, 'display:none;width:1123px;height:1588px');
    assert.equal((await readFit(page)).scale, '1', 'nothing to measure yet');
    await page.evaluate(() => { document.querySelector<HTMLElement>('#canvas')!.style.display = 'block'; });
    await page.waitForFunction(() => document.querySelector<HTMLElement>('#canvas .way')!.style.getPropertyValue('--label-scale') !== '1');
    assertFitted(await readFit(page), 'once shown');
  });

  await t.test('two signs on one page: each fits its own labels', async () => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent('<!doctype html><body>');
    await mount(page, one);
    await page.evaluate(() => { document.querySelector('#canvas')!.id = 'first'; });
    await mount(page, await signMarkup([{ label: 'Hall', arrow: 'left' }, { label: LABEL, arrow: 'right' }, { label: 'Cafe', arrow: 'left' }]));
    assertFitted(await readFit(page, '#first'), 'the first');
    assertFitted(await readFit(page, '#canvas'), 'the second');
  });

  await t.test('labels that already fit keep their full size', async () => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent('<!doctype html><body>');
    await mount(page, await signMarkup([{ label: 'A', arrow: 'left' }, { label: 'B', arrow: 'left' }, { label: 'C', arrow: 'left' }, { label: 'D', arrow: 'left' }]));
    assert.equal((await readFit(page)).scale, '1');
  });
});
