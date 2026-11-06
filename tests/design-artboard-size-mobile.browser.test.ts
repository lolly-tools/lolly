// SPDX-License-Identifier: MPL-2.0
/**
 * On a phone, Design's artboard size picker opens ABOVE the inspector sheet.
 *
 * The sheet is a body-level `position: fixed` surface stacked over the stage, and the
 * stage is `position: fixed` too, so it is a stacking context of its own: a picker
 * appended to the stage painted behind the sheet whatever its z-index, and a tap on its
 * presets went to the sheet's rows instead. This drives the picker the way a person does on a
 * 390 x 844 phone, from each control that offers it, and asks the page what is on top at
 * the picker's own centre.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { BrowserContext, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';

async function visit(page: Page): Promise<void> {
  await page.goto(`${origin}/t/design?template=blank`);
  await page.waitForFunction(() => !!(window as Window & { lolly?: { ui?: unknown } }).lolly?.ui);
  await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
  // The editor's chrome is imported after the view mounts, and the template seeds itself
  // after that: wait for the layout attribute and for the template's artboard.
  await page.waitForSelector('.tool-stage[data-design-layout]');
  await page.waitForFunction(() => {
    const boxes = (document.getElementById('tool-canvas') as CanvasCommitEl | null)?.__lollyModel?.()
      .find(i => i.id === 'boxes')?.value as Array<Record<string, unknown>> | undefined;
    return !!boxes?.some(b => b.kind === 'frame');
  });
  await page.locator('.tool-stage').evaluate(el => Promise.all(el.getAnimations()
    .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished)));
}

/** The artboards' sizes, read from the document model rather than from the chrome. */
const artboards = (page: Page) => page.evaluate(() => {
  const boxes = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!()
    .find(i => i.id === 'boxes')!.value as Array<Record<string, unknown>>;
  return boxes.filter(b => b.kind === 'frame').map(b => `${b.w}x${b.h}`);
});

/** Is the picker the topmost element at its own centre, and where does it sit? */
const picker = (page: Page) => page.evaluate(() => {
  const panel = document.querySelector<HTMLElement>('.fc-size-panel');
  if (!panel) return null;
  const r = panel.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const bar = document.querySelector('.design-compact-actions')!.getBoundingClientRect();
  return {
    onTop: !!hit && panel.contains(hit),
    hit: hit ? `${hit.tagName.toLowerCase()}.${String((hit as HTMLElement).className)}` : null,
    top: r.top, bottom: r.bottom, left: r.left, right: r.right, barTop: bar.top,
    focused: panel.contains(document.activeElement),
  };
});

async function phone(browser: Awaited<ReturnType<typeof getBrowser>>, large: boolean): Promise<BrowserContext> {
  const context = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true,
    ...(large ? { reducedMotion: 'reduce' as const } : {}),
  });
  if (large) await context.addInitScript(() => localStorage.setItem('lolly-a11y', JSON.stringify({ largeText: true, reduceMotion: true })));
  return context;
}

test('the artboard size picker opens above the phone inspector sheet and its choices land', { skip, timeout: 180000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    for (const large of [false, true]) {
      const label = large ? 'large text, reduced motion' : 'default';
      const context = await phone(browser, large);
      try {
        const page = await context.newPage();
        await visit(page);
        assert.equal(await page.locator('.tool-stage').getAttribute('data-design-layout'), 'compact', 'phone layout');

        // From the inspector sheet: Inspect, then the Document section's Size door.
        await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
        await page.waitForSelector('.design-phone-panel[data-snap="half"][data-tab="inspect"]');
        const door = page.locator('.fc-insp [data-act="documentsize"]');
        await door.tap();
        await page.waitForSelector('.fc-size-panel');
        let at = (await picker(page))!;
        assert.ok(at.onTop, `the picker is on top at its centre (${label}), found ${at.hit}`);
        assert.ok(at.top >= 0 && at.left >= 0 && at.right <= 390, `inside the screen (${label})`);
        assert.ok(at.bottom <= at.barTop, `clear of the bottom bar (${label})`);
        assert.ok(at.focused, `focus moved into the picker (${label})`);

        // A choice changes the artboard.
        const before = await artboards(page);
        const square = page.locator('.fc-size-panel .fc-size-preset', { hasText: 'Square' });
        assert.ok(!before.includes('1080x1080'), 'the starting artboard is not already square');
        await square.tap();
        await page.waitForFunction(() => {
          const boxes = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!()
            .find(i => i.id === 'boxes')!.value as Array<Record<string, unknown>>;
          return boxes.some(b => b.kind === 'frame' && b.w === 1080 && b.h === 1080);
        });
        assert.notDeepEqual(await artboards(page), before, `the artboard changed (${label})`);

        // Escape closes the picker, not the sheet, and focus goes back to the Size door.
        await page.keyboard.press('Escape');
        await page.waitForSelector('.fc-size-panel', { state: 'detached' });
        assert.equal(await page.locator('.design-phone-panel[data-snap="half"]').count(), 1, `the panel stays open (${label})`);
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-act')), 'documentsize',
          `focus is back on the Size door (${label})`);

        // From the bottom bar's More menu, with the sheet still open.
        await page.getByRole('button', { name: 'More', exact: true }).tap();
        await page.locator('.fc-popover [data-pop="size"]').tap();
        await page.waitForSelector('.fc-size-panel');
        at = (await picker(page))!;
        assert.ok(at.onTop, `the picker from More is on top at its centre (${label}), found ${at.hit}`);
        assert.ok(at.bottom <= at.barTop, `clear of the bottom bar from More (${label})`);
        await page.keyboard.press('Escape');
        await page.waitForSelector('.fc-size-panel', { state: 'detached' });
        assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'More', `focus is back on More (${label})`);
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});
