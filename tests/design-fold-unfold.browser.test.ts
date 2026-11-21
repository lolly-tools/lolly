// SPDX-License-Identifier: MPL-2.0
/**
 * Design on a foldable: open, folded, open again. The layout at rest is a function of the
 * window, so the third reading is the first.
 *
 * The sizes are an iPhone Duo's as its WebKit reports them, 951 x 669 open and 466 x 678
 * shut. Before this was pinned, the same 951 x 669 window came back with the inspector at
 * half height (the column sized its two tabs as a split on every window resize) and with
 * the phone's framing of the canvas (the phone panel's own pan was recorded as the
 * person's zoom). A desktop window narrowed past the phone breakpoint and back is held to
 * the same rule.
 *
 * What this cannot drive is WebKit sending the last size of a fold with no window resize
 * event at all; lib/layout-posture.test.ts replays that order of events.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
type EditorWindow = Window & { lolly?: { ui?: unknown } };

/**
 * Two artboards side by side, given in the address so nothing seeds itself after mount.
 * The layers list starts shut (`_nav=0`): the phone layout shows one of the inspector and
 * the list at a time, and which of them is open afterwards is that rule's business.
 */
const DOC = new URLSearchParams({
  _nav: '0',
  width: '1920', height: '1080',
  boxes: JSON.stringify([
    { id: 'one', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff', name: 'One' },
    { id: 'two', kind: 'frame', x: 2040, y: 0, w: 1920, h: 1080, bg: '#dddddd', name: 'Two' },
    { id: 'disc', kind: 'box', frame: 'one', x: 1200, y: 300, w: 400, h: 400, bg: '#555555', shape: 'circle' },
  ]),
}).toString();

async function visit(page: Page): Promise<void> {
  await page.goto(`${origin}/t/design?${DOC}`);
  await page.waitForFunction(() => !!(window as EditorWindow).lolly?.ui);
  await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
  await page.waitForSelector('.tool-stage[data-design-layout]');
  await page.locator('#tool-canvas [data-box-id="disc"]').waitFor();
  await atRest(page);
}

/** Entrances over, and two frames for the stage's own re-fit, which waits for one. */
async function atRest(page: Page): Promise<void> {
  await page.locator('.tool-stage').evaluate(el => Promise.all(el.getAnimations()
    .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished)));
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await page.waitForTimeout(400);
}

/** Everything a person would call the layout: which panes, where, and the canvas in its pane. */
const reading = (page: Page) => page.evaluate(() => {
  const box = (sel: string): number[] | null => {
    const el = document.querySelector(sel);
    if (!el || getComputedStyle(el).display === 'none') return null;
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map(Math.round);
  };
  const root = document.documentElement;
  const slot = document.querySelector<HTMLElement>('.edge-dock-slot[data-slot="inspector"]');
  return {
    layout: root.dataset.layout ?? null,
    design: document.querySelector<HTMLElement>('.tool-stage')?.dataset.designLayout ?? null,
    column: box('.edge-dock'),
    tabs: [...document.querySelectorAll('.edge-dock-tab')].map(t => t.textContent),
    inspector: box('.edge-dock-slot[data-slot="inspector"]'),
    inspectorInline: slot?.getAttribute('style') ?? null,
    rail: box('.fc-toolbar-dock > .fc-toolbar'),
    railInline: document.querySelector('.fc-toolbar-dock')?.getAttribute('style') ?? null,
    stage: box('.tool-stage'),
    canvas: box('#tool-canvas'),
    view: document.querySelector<HTMLElement>('#tool-canvas')?.parentElement?.style.transform ?? null,
  };
});

async function resize(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await atRest(page);
}

test('Design, open then folded then open: the layout and the framing come back as they were', { skip, timeout: 120000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 951, height: 669 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await visit(page);
    const open = await reading(page);
    assert.equal(open.layout, 'split', 'the inner screen is two panes');
    assert.deepEqual(open.tabs, ['Inspector', 'Export'], 'the control pane has its tabs');
    assert.equal(open.inspectorInline, null);

    await resize(page, 466, 678);
    const shut = await reading(page);
    assert.equal(shut.layout, null, 'the outer screen is the phone layout');
    assert.equal(shut.design, 'compact');
    assert.equal(shut.column, null);

    await resize(page, 951, 669);
    assert.deepEqual(await reading(page), open, 'unfolded again, nothing remembers the fold');

    // And once more, since a first return can leave something for the second.
    await resize(page, 466, 678);
    assert.deepEqual(await reading(page), shut);
    await resize(page, 951, 669);
    assert.deepEqual(await reading(page), open);
  } finally {
    await context.close();
  }
});

test('Design, a desktop window narrowed past the phone breakpoint and back: the same layout', { skip, timeout: 120000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    await visit(page);
    const wide = await reading(page);
    assert.equal(wide.layout, null, 'a mouse-driven window is never two panes');
    assert.equal(wide.design, 'wide');

    // A resize that crosses no breakpoint moves nothing but the widths.
    await resize(page, 1200, 800);
    assert.equal((await reading(page)).inspectorInline, null, 'the tab on screen keeps the full column');

    await resize(page, 600, 800);
    assert.equal((await reading(page)).design, 'compact');
    await resize(page, 1280, 800);
    assert.deepEqual(await reading(page), wide);
  } finally {
    await context.close();
  }
});

test.after(async () => { await closeBrowser(); });
