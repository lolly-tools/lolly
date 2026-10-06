// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import type { UiState } from '../shells/web/src/lib/editor-state.ts';
import { expandQuery } from '../engine/src/url-pack.ts';
import { setTimeout as wait } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { parseUrlState } from '../engine/src/url-mode.ts';
const manifest = JSON.parse(readFileSync(new URL('../community/design/tool.json', import.meta.url), 'utf8'));
const sharedInk = async (url: string) => {
  const state = parseUrlState(await expandQuery(new URL(url).search), manifest);
  return (state.values.boxes as Array<Record<string, unknown>>)?.find(b => b.id === 'headline')?.fg;
};

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
type EditorWindow = Window & { lolly?: { ui?: { getState(): UiState; apply(state: UiState): void } } };
const select = (page: Page, ids = ['headline']): Promise<void> => page.evaluate(sel => {
  (window as EditorWindow).lolly!.ui!.apply({ v: 1, sel });
}, ids);
const selection = (page: Page) => page.evaluate(() => (window as EditorWindow).lolly!.ui!.getState().sel);
const readInk = (page: Page) => page.evaluate(() => {
  const boxes = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(i => i.id === 'boxes')!.value as Array<Record<string, unknown>>;
  return boxes.find(b => b.id === 'headline')?.fg;
});
async function visit(page: Page): Promise<void> {
  await page.goto(`${origin}/t/design?template=video&editingRange=hdr`);
  await page.waitForFunction(() => !!(window as EditorWindow).lolly?.ui);
  await page.waitForSelector('.tl-panel:not([hidden])');
  // The editor paints before the mount finishes, and the shared Loading card
  // (components/view-loading.ts) keeps the page inert until then: keys pressed on
  // the timeline handle before it closes go to the card.
  await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
}

test('Design keeps compact actions, panels and timeline resizing usable across the viewport matrix', { skip, timeout: 180000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    for (const [width, height] of [[320, 568], [360, 640], [390, 844], [768, 1024], [844, 390], [1024, 768], [1440, 1000]]) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: width!, height: height! }, hasTouch: true });
      try {
        const page = await context.newPage();
        await visit(page);
        const compact = await page.locator('.tool-stage').getAttribute('data-design-layout') === 'compact';
        if (compact) {
          const profile = page.locator('.design-topbar .profile-link:visible');
          const box = (await profile.boundingBox())!;
          assert.ok(box.width >= 44 && box.height >= 44 && box.x + box.width <= width!, 'profile queue stays reachable on phones');
        }
        const title = (await page.locator('.dtb-name').boundingBox())!;
        const exp = (await page.locator('[data-topbar="export"]').boundingBox())!;
        assert.ok(title.width >= 90, `readable title at ${width}`);
        assert.ok(exp.x >= 0 && exp.x + exp.width <= width! && exp.width >= 44, `Export at ${width}`);
        const handle = page.getByRole('separator', { name: 'Resize timeline' });
        assert.ok((await handle.boundingBox())!.height >= 44);
        await handle.focus(); await handle.press('Home');
        const before = (await page.locator('.tl-panel').boundingBox())!.height;
        await handle.press('End');
        const after = (await page.locator('.tl-panel').boundingBox())!.height;
        assert.ok(after > before, `resize range at ${width} x ${height}`);
        if (width === 390) {
          await handle.press('Home');
          const rect = (await handle.boundingBox())!;
          const client = await context.newCDPSession(page);
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + 100, y: rect.y + 22 }] });
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: rect.x + 100, y: rect.y - 26 }] });
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          assert.ok((await page.locator('.tl-panel').boundingBox())!.height > before + 30, 'a real touch drag changes timeline height');
          await client.detach();
        }
        if (compact) {
          const actions = (await page.locator('.design-compact-actions').boundingBox())!;
          const timeline = (await page.locator('.tl-panel').boundingBox())!;
          assert.ok(timeline.y + timeline.height <= actions.y + 1);
          for (const button of await page.locator('.design-compact-actions button:visible').all()) {
            const rect = (await button.boundingBox())!;
            assert.ok(rect.width >= 44 && rect.height >= 44);
          }
          await page.getByRole('button', { name: 'Layer/Page', exact: true }).click();
          await page.waitForSelector('.tl-panel', { state: 'hidden' });
          await page.getByRole('button', { name: 'Inspect', exact: true }).click();
        } else {
          await handle.blur();
          if (await page.locator('[data-topbar="navigator"]').getAttribute('aria-pressed') !== 'true') await page.keyboard.press('Alt+2');
          if (await page.locator('[data-topbar="inspector"]').getAttribute('aria-pressed') !== 'true') await page.keyboard.press('Alt+3');
        }
        await page.waitForSelector('.fc-insp:not([hidden])');
        await select(page);
        const inspector = (await page.locator('.fc-insp:not([hidden])').boundingBox())!;
        if (compact) {
          const background = await page.locator('.fc-insp.is-compact-sheet').evaluate(el => getComputedStyle(el).backgroundColor);
          assert.notEqual(background, 'rgba(0, 0, 0, 0)', 'the inspector sheet has a background');
          await page.getByRole('button', { name: 'Add', exact: true }).click();
          const menu = page.locator('.fc-popover');
          const menuBox = (await menu.boundingBox())!;
          const actionBox = (await page.locator('.design-compact-actions').boundingBox())!;
          assert.ok(menuBox.y >= 0 && menuBox.y + menuBox.height <= actionBox.y, `Add stays above the bottom bar at ${width}`);
          const webpage = menu.getByRole('menuitem', { name: 'Web page', exact: true });
          await webpage.scrollIntoViewIfNeeded();
          const webpageBox = (await webpage.boundingBox())!;
          assert.ok(webpageBox.y >= menuBox.y && webpageBox.y + webpageBox.height <= actionBox.y, 'Web page is reachable by scrolling');
          await webpage.click();
          await menu.waitFor({ state: 'hidden' });
          await page.getByRole('button', { name: 'Inspect', exact: true }).click();
          assert.ok(inspector.y > 90, 'a visible preview remains above the sheet');
          assert.equal(await page.locator('.fc-nav:not(.is-collapsed):visible').count(), 0);
        } else if (width! <= 1024) {
          assert.equal(await page.locator('.fc-nav:not(.is-collapsed):visible').count(), 0);
          assert.ok(width! - inspector.width >= Math.min(480, width! / 2));
        }
        assert.deepEqual(await selection(page), ['headline']);
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});

test('phone inspector preserves P3 through undo and reload, and Escape dismisses one surface at a time', { skip, timeout: 120000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await visit(page); await select(page);
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    const original = await readInk(page);
    const field = page.locator('[data-color-field="fc-insp-fg"]');
    await field.locator('.color-trigger').click();
    if (await field.locator('.color-fine-toggle').getAttribute('aria-expanded') === 'false') await field.locator('.color-fine-toggle').click();
    await field.locator('.color-input').fill('color(display-p3 1 0 0)');
    await field.locator('.color-input').press('Tab');
    assert.equal(await readInk(page), 'color(display-p3 1 0 0)');
    await page.keyboard.press('Escape');
    assert.equal(await field.locator('.color-popover').isVisible(), false);
    assert.equal(await page.locator('.is-compact-sheet').count(), 1);
    // A pending inspector paint can replace the trigger after locator resolution.
    // Read the live trigger and focus together, after that paint settles.
    await page.waitForFunction(() => document.querySelector('[data-color-field="fc-insp-fg"] .color-trigger') === document.activeElement);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.is-compact-sheet').count(), 0);
    assert.deepEqual(await selection(page), ['headline']);
    // The runtime paints before its coalesced address-bar update under load.
    // Wait for the authored colour in the actual share state, not a fixed delay.
    let saved = page.url();
    for (let attempt = 0; attempt < 100; attempt++) {
      saved = page.url();
      if (await sharedInk(saved) === 'color(display-p3 1 0 0)') break;
      await wait(50);
    }
    assert.equal(await sharedInk(saved), 'color(display-p3 1 0 0)', 'the shared URL includes the authored colour');
    await page.locator('[data-topbar="compact-undo"]').click();
    await page.waitForFunction(value => {
      const boxes = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(i => i.id === 'boxes')!.value as Array<Record<string, unknown>>;
      return boxes.find(b => b.id === 'headline')?.fg === value;
    }, original);
    await page.goto(saved);
    await page.waitForFunction(() => !!(window as EditorWindow).lolly?.ui);
    assert.equal(await readInk(page), 'color(display-p3 1 0 0)');
    await select(page); await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    await page.locator('.fc-insp-tabs').getByRole('button', { name: 'Document', exact: true }).click();
    assert.deepEqual(await selection(page), ['headline']);
    await page.waitForFunction(() => document.querySelector('.emoji-style-summary')?.textContent?.includes('Fluent Emoji High Contrast'));
    await page.locator('[data-doc="editingRange"]').selectOption('sdr');
    await page.locator('.fc-insp-tabs').getByRole('button', { name: 'Selection', exact: true }).click();
    await field.locator('.color-trigger').click();
    if (await field.locator('.color-fine-toggle').getAttribute('aria-expanded') === 'false') await field.locator('.color-fine-toggle').click();
    await field.locator('.color-input').fill('color(display-p3 0 1 0)');
    await field.locator('.color-input').press('Tab');
    assert.match(String(await readInk(page)), /^#[a-f\d]{6}$/i);
  } finally { await context.close(); await closeBrowser(); }
});

test('compact editing survives rotation, enlarged text, RTL and returning from inline text', { skip, timeout: 90000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce', colorScheme: 'dark' });
  try {
    const page = await context.newPage();
    await visit(page); await select(page);
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    await page.locator('[data-act="edittext"]').click();
    await page.waitForSelector('.tool-stage.is-text-editing');
    await page.waitForSelector('.is-compact-sheet', { state: 'detached' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.waitForSelector('.tool-stage.is-text-editing', { state: 'detached' });
    assert.deepEqual(await selection(page), ['headline']);
    await page.getByRole('button', { name: 'Inspect', exact: true }).click();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => document.querySelector('.is-compact-sheet')?.getBoundingClientRect().width === 844);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForSelector('.is-compact-sheet', { state: 'detached' });
    await page.waitForSelector('.fc-insp:not([hidden])');
    assert.deepEqual(await selection(page), ['headline']);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForSelector('.is-compact-sheet');
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.style.fontSize = '200%';
      document.documentElement.style.setProperty('--safe-bottom-fb', '24px');
      window.dispatchEvent(new Event('resize'));
    });
    const exp = (await page.locator('[data-topbar="export"]').boundingBox())!;
    assert.ok(exp.x >= 0 && exp.x + exp.width <= 360);
    assert.ok((await page.locator('.dtb-name').boundingBox())!.width >= 90);
    const actions = (await page.locator('.design-compact-actions').boundingBox())!;
    assert.equal(actions.height, 84, 'the safe area is included in panel reserves');
    const inspector = (await page.locator('.is-compact-sheet').boundingBox())!;
    assert.ok(inspector.y + inspector.height <= actions.y + 1);
    await page.locator('[data-act-col="close"]').click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.waitForSelector('.fc-popover');
    assert.match(await page.locator('.fc-popover').innerText(), /Text/);
    await page.keyboard.press('Escape');
    await page.locator('[data-topbar="more"]').click();
    await page.getByRole('menuitem', { name: 'Design outcome', exact: true }).click();
    assert.ok(await page.getByRole('menuitemcheckbox', { name: 'Video', exact: true }).count() || await page.getByRole('menuitem', { name: 'Video', exact: true }).count());
  } finally { await context.close(); await closeBrowser(); }
});
