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

interface Frame { height: number; opacity: number; bodyOpacity: number; contentOpacity: number; translate: string; leaks: boolean; closing: boolean }

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
      const box = section.getBoundingClientRect(), contentStyle = getComputedStyle(section, '::details-content');
      const contentOpacity = Number(contentStyle.opacity || 1);
      frames.push({ height: box.height,
        opacity: Number(rowStyle.opacity) * Number(bodyStyle.opacity) * contentOpacity,
        bodyOpacity: Number(bodyStyle.opacity), contentOpacity, translate: rowStyle.translate,
        leaks: body.contains(document.elementFromPoint(box.x + box.width / 2, box.bottom + 2)), closing: reversed });
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
    assert.ok(frames.every(frame => !frame.leaks), `${label}: keyboard focus does not remove content clipping`);
    if (interpolates) {
      assert.ok(frames.some(frame => frame.height > collapsed + 1 && frame.height < expanded - 1), `${label}: height interpolates`);
      assert.ok(frames.every((frame, i) => !i || frame.height >= frames[i - 1]!.height - 0.1), `${label}: height never reverses`);
    }
    assert.equal(await page.locator('.reveal-item').count(), 0, `${label}: no delayed row restart`);
    const closing = await sample(page, 'close');
    assert.ok(closing.every((frame, i) => !i || frame.height <= closing[i - 1]!.height + 0.1), 'close is monotonic');
    assert.ok(closing.every((frame, i) => !i || frame.opacity <= closing[i - 1]!.opacity + 0.001), 'close never brightens');
    assert.ok(closing.every(frame => !frame.leaks), 'closing content stays clipped');
    assert.equal(closing.at(-1)!.height, collapsed);
  }

  await section.locator('.input-section-body').evaluate(el => { (el as HTMLElement).style.opacity = '0.55'; });
  const custom = await sample(page, 'open');
  assert.ok(custom.every(frame => frame.bodyOpacity <= 0.551), 'fade respects an authored body opacity');
  assert.ok(Math.abs(custom.at(-1)!.bodyOpacity - 0.55) < 0.001);
  await sample(page, 'close');
  await page.addStyleTag({ content: '@layer base { .input-section::details-content { opacity: 0.6; } }' });
  const wrapper = await sample(page, 'open');
  assert.ok(wrapper.every(frame => frame.contentOpacity <= 0.601), 'wrapper fade respects its authored default');
  assert.ok(Math.abs(wrapper.at(-1)!.contentOpacity - 0.6) < 0.001);
  await sample(page, 'close');
  const reverse = await sample(page, 'reverse');
  assert.equal(reverse.at(-1)!.height, collapsed, 'rapid reversal leaves native closed state');
  assert.equal(await section.getAttribute('open'), null);
  assert.ok(reverse.every(frame => !frame.leaks), 'rapid reversal never paints outside the section');
  assert.ok(reverse.some(frame => frame.closing));
  assert.ok(reverse.every((frame, i) => !frame.closing || frame.opacity <= reverse[i - 1]!.opacity + 0.001), 'reversal never jumps to the final opacity');

  await summary.press('Enter');
  await page.waitForTimeout(220);
  await section.locator('.input-row').first().evaluate(el => { el.classList.add('color-picker-field', 'is-open'); });
  assert.equal(await section.evaluate(el => getComputedStyle(el, '::details-content').overflow), 'visible', 'an open picker can extend past the section');
  await sample(page, 'close');
  assert.equal(await section.evaluate(el => getComputedStyle(el, '::details-content').overflow), 'clip', 'closing a section restores clipping even with a picker');
  await section.locator('.input-row').first().evaluate(el => { el.classList.remove('color-picker-field', 'is-open'); });

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

// The asset inspector, the export panel's cost card and the token workspace fold
// <details class="section-card">, which is a flex column. Without a zero minimum the
// content box kept its full height while block-size moved, so the card snapped.
test('a details section card folds with the same motion although it is a flex column', {
  skip: existsSync(executablePath) ? false : 'Install Playwright Chromium or set LOLLY_BROWSER_PATH.', timeout: 60_000,
}, async t => {
  const browser = await chromium.launch({ executablePath });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 600, height: 650 } });
  await page.setContent(`<style>${css}
    body { margin: 40px; font-family: system-ui; }
    .card-body { height: 150px; }
  </style><details class="section-card"><summary class="section-card-summary"><span class="section-card-title">File details</span></summary>
    <div class="card-body">Source, licence and format</div></details>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  if (!await page.evaluate(() => CSS.supports('interpolate-size', 'allow-keywords') && CSS.supports('selector(::details-content)'))) {
    t.skip('This Chromium cannot interpolate a height to auto.');
    return;
  }
  const card = page.locator('details.section-card');
  assert.equal(await card.evaluate(el => getComputedStyle(el).display), 'flex', 'the card is a flex column');
  const collapsed = await card.evaluate(el => el.getBoundingClientRect().height);
  const toggle = (): Promise<number[]> => card.evaluate(async el => {
    const heights: number[] = [], started = performance.now();
    el.querySelector('summary')!.click();
    do {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      heights.push(el.getBoundingClientRect().height);
    } while (performance.now() - started < 350 || heights.length < 10);
    return heights;
  });
  const opening = await toggle(), expanded = opening.at(-1)!;
  assert.ok(expanded > collapsed + 100, JSON.stringify({ collapsed, opening }));
  assert.ok(opening.some(height => height > collapsed + 1 && height < expanded - 1), `opening interpolates: ${JSON.stringify(opening)}`);
  assert.ok(opening.every((height, i) => !i || height >= opening[i - 1]! - 0.1), 'opening never reverses');
  const closing = await toggle();
  assert.ok(closing.some(height => height > collapsed + 1 && height < expanded - 1), `closing interpolates: ${JSON.stringify(closing)}`);
  assert.ok(closing.every((height, i) => !i || height <= closing[i - 1]! + 0.1), 'closing never reverses');
  assert.equal(closing.at(-1), collapsed);
});

// Settings cards are the same collapsible section card as the tool sidebar's sections
// and the Assets inspector's (parts/disclosure.css). They used to open in one jump and
// then cascade their rows in with an overshooting rise, and a card that filled in after
// opening (Storage, Content Credentials, Available offline) snapped to its new height.
test('a Settings card is the shared collapsible card: same head, one fold motion, late content eases', {
  skip: existsSync(executablePath) ? false : 'Install Playwright Chromium or set LOLLY_BROWSER_PATH.', timeout: 60_000,
}, async t => {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import { installGlobalReveal } from './shells/web/src/lib/reveal.ts';
      import { installFoldSettle } from './shells/web/src/lib/disclosure-motion.ts';
      installGlobalReveal();
      installFoldSettle();
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', logLevel: 'silent',
  });
  const browser = await chromium.launch({ executablePath });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
  await page.setContent(`<style>${css}
    @layer views { ${read('styles/parts/profile.css')} }
    body { margin: 40px; font-family: system-ui; }
    .tool-inputs, .profile-view { width: 520px; }
    .row { height: 60px; }
  </style><div class="tool-inputs" data-reveal-sound="off"><details class="input-section"><summary class="input-section-summary">Storage</summary>
    <div class="input-section-body"><div class="row">Row</div></div></details></div>
  <div class="profile-view" data-reveal-sound="off"><details class="profile-card profile-collapse section-card" id="card">
    <summary class="profile-collapse-summary section-card-summary"><h2 class="section-card-title">Storage</h2><span class="profile-summary-value section-card-value">1.2 MB used</span></summary>
    <div class="profile-collapse-body section-card-body" id="card-body"><div class="profile-skeleton"></div></div></details></div>`);
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  if (!await page.evaluate(() => CSS.supports('interpolate-size', 'allow-keywords') && CSS.supports('selector(::details-content)'))) {
    t.skip('This Chromium cannot interpolate a height to auto.');
    return;
  }

  const head = (selector: string) => page.evaluate(sel => {
    const summary = document.querySelector<HTMLElement>(sel)!;
    const style = getComputedStyle(summary), caret = getComputedStyle(summary, '::after');
    const title = summary.querySelector('.section-card-title') ?? summary;
    return { height: Math.round(summary.getBoundingClientRect().height), padding: style.padding, size: getComputedStyle(title).fontSize,
      weight: getComputedStyle(title).fontWeight, transform: getComputedStyle(title).textTransform,
      caret: [caret.width, caret.height, caret.transform, caret.borderRightWidth].join(' ') };
  }, selector);
  assert.deepEqual(await head('#card > summary'), await head('.input-section > summary'), 'the Settings head is the tool section head');

  const card = page.locator('#card');
  const collapsed = await card.evaluate(el => el.getBoundingClientRect().height);
  // Open, optionally replace the body's content after `at` ms, and sample every frame.
  const run = (at: number | null): Promise<{ heights: number[]; cascaded: boolean; moved: boolean }> => card.evaluate(async (el, at) => {
    const body = el.querySelector<HTMLElement>('#card-body')!;
    const heights: number[] = [], started = performance.now();
    let cascaded = false, moved = false, swapped = false;
    el.querySelector('summary')!.click();
    do {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (at !== null && !swapped && performance.now() - started >= at) {
        body.innerHTML = '<div class="row">One</div><div class="row">Two</div><div class="row">Three</div><div class="row">Four</div>';
        swapped = true;
        // A frame is drawn after the microtasks a change queues (the mutation
        // observers among them), so measure from there, as the screen would.
        await new Promise<void>(resolve => queueMicrotask(resolve));
      }
      heights.push(el.getBoundingClientRect().height);
      cascaded ||= !!document.querySelector('.reveal-item');
      moved ||= [...body.children].some(child => getComputedStyle(child).translate !== 'none');
    } while (performance.now() - started < (at ?? 0) + 450 || heights.length < 12);
    return { heights, cascaded, moved };
  }, at);
  const close = () => card.evaluate(async el => {
    el.removeAttribute('open');
    el.querySelector('#card-body')!.innerHTML = '<div class="profile-skeleton"></div>';
    await new Promise(resolve => setTimeout(resolve, 400));
  });
  const smooth = (heights: number[], label: string) => {
    const end = heights.at(-1)!, steps = heights.slice(1).map((h, i) => h - heights[i]!);
    assert.ok(heights.every((h, i) => !i || h >= heights[i - 1]! - 0.1), `${label}: height never reverses ${JSON.stringify(heights)}`);
    assert.ok(Math.max(...steps) < (end - collapsed) * 0.45, `${label}: no single-frame jump ${JSON.stringify(heights)}`);
  };

  const plain = await run(null);
  assert.ok(plain.heights.some(h => h > collapsed + 1 && h < plain.heights.at(-1)! - 1), `the card folds open: ${JSON.stringify(plain.heights)}`);
  smooth(plain.heights, 'open');
  assert.equal(plain.cascaded, false, 'no row cascade on top of the fold');
  assert.equal(plain.moved, false, 'rows do not rise independently');
  await close();

  const late = await run(300);
  assert.ok(late.heights.at(-1)! > collapsed + 200, 'the late content is shown');
  smooth(late.heights, 'content after the fold opened');
  await close();

  const early = await run(60);
  smooth(early.heights, 'content while the fold opens');
  await close();

  for (const preference of ['os', 'app']) {
    if (preference === 'os') await page.emulateMedia({ reducedMotion: 'reduce' });
    else {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => { document.documentElement.dataset.a11yMotion = 'reduce'; });
    }
    const still = await run(300);
    const before = still.heights.filter((_, i) => i < 3), after = still.heights.at(-1)!;
    assert.ok(before.every(h => h === before[0]), `${preference}: the card opens at once`);
    assert.ok(still.heights.every(h => h === before[0] || h === after), `${preference}: late content appears at once ${JSON.stringify(still.heights)}`);
    await close();
  }
});
