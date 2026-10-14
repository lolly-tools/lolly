// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium, type Page } from 'playwright';

const executablePath = process.env.LOLLY_BROWSER_PATH ?? chromium.executablePath();
const read = (file: string): string => readFileSync(new URL(`../shells/web/src/${file}`, import.meta.url), 'utf8');
const css = `${read('styles/tokens.css')}
  @layer base, primitives, chrome, views;
  @layer base { ${read('styles/parts/base.css')} }
  @layer primitives { ${read('styles/parts/disclosure.css')} }
  @layer chrome { ${read('styles/parts/gallery.css')} ${read('styles/parts/components.css')} }
  ${read('styles/parts/tool.css')}`;

interface Frame { height: number; opacity: number; bodyOpacity: number; translate: string }

async function sample(page: Page, action: 'open' | 'close' | 'reverse'): Promise<Frame[]> {
  return page.evaluate(async action => {
    const section = document.querySelector<HTMLDetailsElement>('.input-section')!;
    const summary = section.querySelector<HTMLElement>('summary')!;
    const body = section.querySelector<HTMLElement>('.input-section-body')!;
    const row = body.querySelector<HTMLElement>('.input-row')!;
    const frames: Frame[] = [];
    const started = performance.now();
    summary.focus();
    summary.click();
    let reversed = false;
    do {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const bodyStyle = getComputedStyle(body), rowStyle = getComputedStyle(row);
      frames.push({ height: section.getBoundingClientRect().height,
        opacity: Number(rowStyle.opacity) * Number(bodyStyle.opacity),
        bodyOpacity: Number(bodyStyle.opacity), translate: rowStyle.translate });
      if (action === 'reverse' && !reversed && performance.now() - started > 65) {
        summary.click(); reversed = true;
      }
    } while (performance.now() - started < 350 || frames.length < 10);
    return frames;
  }, action);
}

test('input disclosures expand once and fade directly to their default opacity', {
  skip: existsSync(executablePath) ? false : 'Install Playwright Chromium or set LOLLY_BROWSER_PATH.', timeout: 60_000,
}, async t => {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import { installGlobalReveal } from './shells/web/src/lib/reveal.ts';
      installGlobalReveal();
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', logLevel: 'silent',
  });
  const browser = await chromium.launch({ executablePath });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 600, height: 650 } });
  await page.setContent(`<style>${css}
    body { margin: 40px; font-family: system-ui; }
    .tool-inputs { width: 320px; }
    .input-row { height: 50px; }
    #next { margin-top: 12px; }
  </style><div class="tool-inputs" data-reveal-sound="off">
    <details class="input-section"><summary class="input-section-summary">Lighting</summary>
      <div class="input-section-body"><div class="input-row">Shadow <input type="range"></div>
      <div class="input-row">Luminance <input type="range"></div>
      <div class="input-row">Fill <input type="range"></div></div>
    </details><button id="next">Next section</button></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const section = page.locator('.input-section'), summary = section.locator('summary');
  const collapsed = await section.evaluate(el => el.getBoundingClientRect().height);
  const interpolates = await page.evaluate(() => CSS.supports('interpolate-size', 'allow-keywords')
    && CSS.supports('selector(::details-content)'));

  for (const label of ['first open', 'repeat open']) {
    const frames = await sample(page, 'open');
    const expanded = frames.at(-1)!.height;
    assert.ok(frames.length >= 5, `${label}: sampled browser frames`);
    assert.ok(expanded > collapsed + 100, JSON.stringify({ collapsed, frames }));
    assert.ok(frames.every(frame => frame.opacity <= 0.701), `${label}: no full-opacity blip`);
    assert.ok(frames.every((frame, i) => !i || frame.opacity >= frames[i - 1]!.opacity - 0.001), `${label}: fade never restarts`);
    assert.ok(Math.abs(frames.at(-1)!.opacity - 0.7) < 0.001, `${label}: focus dimming retained`);
    assert.ok(frames.every(frame => frame.translate === 'none'), `${label}: rows do not bounce independently`);
    if (interpolates) {
      assert.ok(frames.some(frame => frame.height > collapsed + 1 && frame.height < expanded - 1), `${label}: height interpolates`);
      assert.ok(frames.every((frame, i) => !i || frame.height >= frames[i - 1]!.height - 0.1), `${label}: height never reverses`);
    }
    assert.equal(await page.locator('.reveal-item').count(), 0, `${label}: no delayed row restart`);
    const closing = await sample(page, 'close');
    assert.ok(closing.every((frame, i) => !i || frame.height <= closing[i - 1]!.height + 0.1), 'close is monotonic');
    assert.equal(closing.at(-1)!.height, collapsed);
  }

  await section.locator('.input-section-body').evaluate(el => { (el as HTMLElement).style.opacity = '0.55'; });
  const custom = await sample(page, 'open');
  assert.ok(custom.every(frame => frame.bodyOpacity <= 0.551), 'fade respects an authored body opacity');
  assert.ok(Math.abs(custom.at(-1)!.bodyOpacity - 0.55) < 0.001);
  await sample(page, 'close');
  const reverse = await sample(page, 'reverse');
  assert.equal(reverse.at(-1)!.height, collapsed, 'rapid reversal leaves native closed state');
  assert.equal(await section.getAttribute('open'), null);

  await summary.press('Enter');
  await page.waitForTimeout(220);
  assert.notEqual(await section.getAttribute('open'), null, 'native keyboard activation opens the section');
  await summary.press('Space');
  await page.waitForTimeout(220);
  assert.equal(await section.getAttribute('open'), null, 'native keyboard activation closes the section');

  for (const preference of ['os', 'app']) {
    if (preference === 'os') await page.emulateMedia({ reducedMotion: 'reduce' });
    else {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => { document.documentElement.dataset.a11yMotion = 'reduce'; });
    }
    const frames = await sample(page, 'open');
    assert.ok(frames.every(frame => frame.height === frames.at(-1)!.height), `${preference}: no height motion`);
    assert.ok(frames.every(frame => frame.bodyOpacity === 0.55), `${preference}: no entrance fade`);
    await sample(page, 'close');
  }
});
