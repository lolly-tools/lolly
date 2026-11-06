// SPDX-License-Identifier: MPL-2.0
/**
 * On a phone, every menu, panel and floating control Design opens sits ABOVE the
 * inspector's panel, and every row of it takes a tap.
 *
 * The stage is `position: fixed`, so it is a stacking context of its own, and the
 * inspector sheet is a body-level fixed surface stacked over the stage. A menu appended to the
 * stage (the bottom bar's More, the top bar's own menus, the File menu, a context menu)
 * painted behind the sheet whatever its z-index, and a tap on its lower rows went to the
 * sheet instead. This drives each one the way a person does on a 390 x 844 phone with the
 * sheet open, and asks the page what is on top at the middle of every row.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { BrowserContext, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';

/**
 * An artboard with a circle in it, given in the address rather than by a template: a
 * template seeds itself after the view mounts and then poses the editor's panels, which
 * on a slow runner happens after the test has opened the inspector.
 */
const DOC = new URLSearchParams({
  width: '1920', height: '1080',
  boxes: JSON.stringify([
    { id: 'board', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff', name: 'Board' },
    { id: 'disc', kind: 'box', frame: 'board', x: 1200, y: 300, w: 400, h: 400, bg: '#555555', shape: 'circle' },
  ]),
}).toString();

async function visit(page: Page): Promise<void> {
  await page.goto(`${origin}/t/design?${DOC}`);
  await page.waitForFunction(() => !!(window as Window & { lolly?: { ui?: unknown } }).lolly?.ui);
  await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
  // The editor's chrome is imported after the view mounts; the layout attribute is its own.
  await page.waitForSelector('.tool-stage[data-design-layout]');
  await page.locator('.tool-stage').evaluate(el => Promise.all(el.getAnimations()
    .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished)));
  await page.locator('#tool-canvas [data-box-id="disc"]').waitFor();
}

async function phone(browser: Awaited<ReturnType<typeof getBrowser>>, large: boolean): Promise<BrowserContext> {
  const context = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true,
    ...(large ? { reducedMotion: 'reduce' as const } : {}),
  });
  if (large) await context.addInitScript(() => localStorage.setItem('lolly-a11y', JSON.stringify({ largeText: true, reduceMotion: true })));
  return context;
}

/** The inspector open at half in the phone panel (views/design-phone-panel.ts). */
async function openSheet(page: Page): Promise<void> {
  if (await page.locator('.design-phone-panel[data-snap="half"][data-tab="inspect"]').count()) return;
  await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
  await page.waitForSelector('.design-phone-panel[data-snap="half"][data-tab="inspect"]');
}
/** The part of the screen the open panel covers. */
const panelBox = (page: Page) => page.locator('.design-phone-panel').evaluate(el => {
  const r = el.getBoundingClientRect(); return { top: r.top, edge: r.bottom };
});

/**
 * For each row of the open menu: brought into view inside the menu's own scroll, is the
 * row the topmost element at its middle, and does it sit on the screen above the bar?
 * Returns the rows that fail, by label, with what was hit instead.
 */
const coveredRows = (page: Page, menu: string, row: string) => page.evaluate(([menuSel, rowSel]) => {
  const root = document.querySelector<HTMLElement>(menuSel!);
  if (!root) return ['(no menu)'];
  const bar = document.querySelector('.design-compact-actions')!.getBoundingClientRect();
  const bad: string[] = [];
  const rows = [...root.querySelectorAll<HTMLElement>(rowSel!)].filter(r => r.getBoundingClientRect().height > 0);
  if (!rows.length) return ['(no rows)'];
  for (const r of rows) {
    r.scrollIntoView({ block: 'nearest' });
    const b = r.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const hit = document.elementFromPoint(x, y);
    const label = (r.textContent || '').trim().slice(0, 32);
    if (!hit || !r.contains(hit)) bad.push(`${label} -> ${hit ? `${hit.tagName.toLowerCase()}.${String((hit as HTMLElement).className).slice(0, 40)}` : 'nothing'}`);
    else if (y < 0 || y > bar.top || b.left < 0 || b.right > innerWidth) bad.push(`${label} off the screen or under the bar`);
  }
  return bad;
}, [menu, row] as const);

/** Is a floating surface on top at its middle and four inset corners, and above the bar? */
const surfaceOnTop = (page: Page, sel: string) => page.evaluate((s) => {
  const el = document.querySelector<HTMLElement>(s);
  if (!el) return `${s}: not open`;
  const r = el.getBoundingClientRect();
  const bar = document.querySelector('.design-compact-actions')!.getBoundingClientRect();
  for (const [fx, fy] of [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]] as const) {
    const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
    if (!hit || !el.contains(hit)) return `${s}: covered at ${fx},${fy} by ${hit ? String((hit as HTMLElement).className).slice(0, 40) : 'nothing'}`;
  }
  if (r.top < 0 || r.left < 0 || r.right > innerWidth + 0.5 || r.bottom > bar.top + 0.5) return `${s}: runs off the screen or under the bar`;
  return '';
}, sel);

const closeAll = async (page: Page): Promise<void> => {
  for (let i = 0; i < 3 && await page.locator('.fc-popover, .fc-panel, .dtb-menu').count(); i++) {
    await page.keyboard.press('Escape');
  }
};

test('every phone menu and panel Design opens sits above the inspector sheet and takes taps', { skip, timeout: 300000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    for (const large of [false, true]) {
      const label = large ? 'large text, reduced motion' : 'default';
      const context = await phone(browser, large);
      try {
        const page = await context.newPage();
        await visit(page);
        assert.equal(await page.locator('.tool-stage').getAttribute('data-design-layout'), 'compact', 'phone layout');

        // The bottom bar's More menu, with the sheet open.
        await openSheet(page);
        await page.getByRole('button', { name: 'More', exact: true }).tap();
        await page.waitForSelector('.fc-popover');
        assert.deepEqual(await coveredRows(page, '.fc-popover', '.fc-pop-item, .fc-pop-gitem'), [], `More (${label})`);
        // Escape closes the menu, not the sheet, and focus goes back to the More button.
        await page.keyboard.press('Escape');
        await page.waitForSelector('.fc-popover', { state: 'detached' });
        assert.equal(await page.locator('.design-phone-panel[data-snap="half"]').count(), 1, `the panel stays open (${label})`);
        assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'More', `focus is back on More (${label})`);

        // The top bar's own menu, then the File menu it leads to.
        await page.locator('[data-topbar="more"]').tap();
        await page.waitForSelector('.dtb-menu');
        assert.deepEqual(await coveredRows(page, '.dtb-menu', '.dtb-menu-item'), [], `top bar menu (${label})`);
        await page.locator('.dtb-menu .dtb-menu-item', { hasText: 'File menu' }).tap();
        await page.waitForSelector('.fc-popover');
        assert.deepEqual(await coveredRows(page, '.fc-popover', '.fc-pop-item, .fc-pop-gitem'), [], `File menu (${label})`);
        await closeAll(page);

        // The context menu, opened at a point on the canvas just below the panel: a menu
        // that tall is pulled up to fit above the bar, so it lies over the panel.
        await openSheet(page);
        const { edge } = await panelBox(page);
        // A right-click's event, sent to whatever is at the point: on a phone it is what a
        // long press gives (Android) and what the two-finger tap opens.
        await page.evaluate((y) => {
          document.elementFromPoint(120, y)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: y, button: 2 }));
        }, edge + 40);
        await page.waitForSelector('.fc-popover');
        assert.deepEqual(await coveredRows(page, '.fc-popover', '.fc-pop-item, .fc-pop-gitem'), [], `context menu (${label})`);
        await closeAll(page);

        // Panels the More menu opens.
        for (const [row, sel] of [['Document info', '.fc-info-panel'], ['Custom CSS', '.fc-css-panel'], ['Import a design', '.fc-import-panel']] as const) {
          await openSheet(page);
          await page.getByRole('button', { name: 'More', exact: true }).tap();
          await page.locator('.fc-popover .fc-pop-item', { hasText: row }).first().tap();
          await page.waitForSelector(sel);
          assert.equal(await surfaceOnTop(page, sel), '', `${row} (${label})`);
          await closeAll(page);
        }
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});

test('a camera\'s controls stay above the inspector sheet that is inspecting it', { skip, timeout: 180000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await phone(browser, false);
  try {
    const page = await context.newPage();
    await visit(page);
    // Add a camera and select the camera: its Start camera control appears beside the box.
    await page.getByRole('button', { name: 'Add', exact: true }).tap();
    await page.locator('.fc-popover .fc-pop-item', { hasText: 'Camera' }).tap();
    await page.touchscreen.tap(200, 250);
    await page.waitForSelector('.live-camera-controls:not([hidden])');
    await openSheet(page);
    // Move the camera until its top edge is inside the area the panel covers, which is
    // where the controls are placed: level with the camera's top.
    const target = (await panelBox(page)).edge - 60;
    await page.evaluate((target) => {
      const canvas = document.getElementById('tool-canvas') as CanvasCommitEl;
      const marker = canvas.querySelector<HTMLElement>('[data-live-camera]')!;
      const id = marker.closest<HTMLElement>('[data-box-id]')!.dataset.boxId;
      const boxes = canvas.__lollyModel!().find(i => i.id === 'boxes')!.value as Array<Record<string, number | string>>;
      const box = boxes.find(b => b.id === id)!;
      const r = marker.getBoundingClientRect();
      const scale = r.height / Number(box.h);
      canvas.__lollyCommit!('boxes', boxes.map(b => b.id === id ? { ...b, y: Number(b.y) + (target - r.top) / scale } : b) as never);
    }, target);
    await page.waitForFunction((top) => {
      const r = document.querySelector('[data-live-camera]')?.getBoundingClientRect();
      return !!r && Math.abs(r.top - top) < 4;
    }, target);
    await page.waitForFunction(() => {
      const c = document.querySelector('.live-camera-controls');
      return !!c && c.getBoundingClientRect().top > 0;
    });
    assert.deepEqual(await coveredRows(page, '.live-camera-controls', 'button'), [], 'the camera controls take taps');
  } finally { await context.close(); await closeBrowser(); }
});

test('on a wide window the menus stay where they always were', { skip, timeout: 120000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await visit(page);
    assert.equal(await page.locator('.tool-stage').getAttribute('data-design-layout'), 'wide');
    await page.locator('[data-topbar="present-menu"]').click();
    await page.waitForSelector('.dtb-menu');
    assert.equal(await page.locator('.design-topbar > .dtb-menu').count(), 1, 'the Present menu hangs from the bar');
    await page.keyboard.press('Escape');
    await page.locator('[data-topbar="file"]').click();
    await page.waitForSelector('.fc-popover');
    assert.equal(await page.locator('.tool-stage > .fc-popover:not(.fc-popover--viewport)').count(), 1, 'the File menu opens in the stage');
  } finally { await context.close(); await closeBrowser(); }
});
