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

/** Which of the two columns are open, and in two panes which tab is the one shown. */
const columns = (page: Page) => page.evaluate(() => {
  const shown = (sel: string): boolean => {
    const el = document.querySelector<HTMLElement>(sel);
    return !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  };
  return {
    tabs: [...document.querySelectorAll('.edge-dock-tab')].map(t => t.textContent),
    front: document.querySelector('.edge-dock-tab[aria-selected="true"]')?.textContent ?? null,
    inspector: shown('.fc-insp'),
    layers: shown('.fc-nav'),
  };
});

// The phone layout shows either the inspector or the layers list. What that rule
// closed comes back with the room, behind the one last brought forward; a column
// opened on purpose while folded stays.
test('Design with both columns, folded and open again: both are back, the same one in front', { skip, timeout: 120000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 951, height: 669 }, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/t/design?${DOC.replace('_nav=0', '_nav=1')}`);
    await page.waitForFunction(() => !!(window as EditorWindow).lolly?.ui);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    await page.locator('#tool-canvas [data-box-id="disc"]').waitFor();
    await atRest(page);
    const open = await columns(page);
    assert.ok(open.tabs.includes('Inspector') && open.tabs.includes('Layers'), `both are tabs of the control pane: ${open.tabs}`);

    await resize(page, 466, 678);
    await resize(page, 951, 669);
    assert.deepEqual(await columns(page), open, 'unfolded again, both tabs and the same one shown');

    // Folded, the panel is put down to its peek to see the canvas. The peek is the
    // panel at rest and not a wish to lose the column: open again, both are back.
    await resize(page, 466, 678);
    assert.equal(await page.locator('.design-phone-panel').getAttribute('data-snap'), 'half', 'the phone panel shows the column in front');
    await page.keyboard.press('Escape');
    await atRest(page);
    assert.equal(await page.locator('.design-phone-panel').getAttribute('data-snap'), 'peek');
    await resize(page, 951, 669);
    assert.deepEqual(await columns(page), open, 'after the peek, both tabs and the same one shown');

    // Folded, the person asks for the list. Open again, the list is the tab shown and
    // the inspector is still a tab of the pane.
    await resize(page, 466, 678);
    await page.locator('.design-phone-panel [data-tab="layers"]').click();
    await atRest(page);
    await resize(page, 951, 669);
    const after = await columns(page);
    assert.deepEqual([...after.tabs].sort(), [...open.tabs].sort());
    assert.equal(after.front, 'Layers');
  } finally {
    await context.close();
  }
});

test('Design with both columns on a desk, narrowed to a phone and back: both are open again', { skip, timeout: 120000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/t/design?${DOC.replace('_nav=0', '_nav=1')}`);
    await page.waitForFunction(() => !!(window as EditorWindow).lolly?.ui);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    await page.locator('#tool-canvas [data-box-id="disc"]').waitFor();
    await atRest(page);
    const wide = await columns(page);
    assert.equal(wide.inspector && wide.layers, true, 'both columns are open on the desk');
    await resize(page, 600, 800);
    await resize(page, 1440, 900);
    assert.deepEqual(await columns(page), wide);
  } finally {
    await context.close();
  }
});

test.after(async () => { await closeBrowser(); });
