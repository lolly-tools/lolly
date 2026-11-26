// SPDX-License-Identifier: MPL-2.0
/**
 * On a phone, Design keeps its inspector and its layers list in the tool view's own
 * drop-down panel (views/design-phone-panel.ts on lib/mobile-sheet.ts), the panel every
 * regular tool keeps its inputs in, and its export in the shared bottom-up export panel.
 *
 * Driven the way a person drives it on a 390 x 844 phone: taps, real touch drags through
 * the DevTools protocol, the keyboard. It checks the stops against the tool view's, the
 * canvas band the panel leaves, the grip covering nothing, focus going in and back, and
 * that a wider window, a landscape phone and two panes keep the layouts they had.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { BrowserContext, CDPSession, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
type Browser = Awaited<ReturnType<typeof getBrowser>>;
type EditorWindow = Window & { lolly?: { ui?: { apply(state: unknown): void } } };

/**
 * An artboard with a circle in it, given in the address. Not a template: a template seeds
 * itself after the view mounts and then poses the editor (its panels included), which
 * on a slow runner happens after the test has started opening panels.
 */
const DOC = new URLSearchParams({
  width: '1920', height: '1080',
  boxes: JSON.stringify([
    { id: 'board', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff', name: 'Board' },
    { id: 'disc', kind: 'box', frame: 'board', x: 1200, y: 300, w: 400, h: 400, bg: '#555555', shape: 'circle' },
  ]),
}).toString();

async function visit(page: Page, tool = 'design', query = DOC): Promise<void> {
  await page.goto(`${origin}/t/${tool}${query ? `?${query}` : ''}`);
  await page.waitForFunction(() => !!(window as EditorWindow).lolly?.ui);
  await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
  await page.waitForSelector('.tool-stage[data-design-layout]');
  await page.locator('.tool-stage').evaluate(el => Promise.all(el.getAnimations()
    .filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished)));
  // A tool that starts by offering its templates (org-chart): pass on the offer.
  if (await page.locator('.tmpl-chooser-modal').count()) {
    await page.keyboard.press('Escape');
    await page.locator('.tmpl-chooser-modal').waitFor({ state: 'detached' });
  }
  if (query === DOC) await page.locator('#tool-canvas [data-box-id="disc"]').waitFor();
}

async function phone(browser: Browser, opts: { large?: boolean; dark?: boolean } = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true,
    ...(opts.large ? { reducedMotion: 'reduce' as const } : {}), ...(opts.dark ? { colorScheme: 'dark' as const } : {}),
  });
  if (opts.large) await context.addInitScript(() => localStorage.setItem('lolly-a11y', JSON.stringify({ largeText: true, reduceMotion: true })));
  return context;
}

/** The panel's state, its edge, the grip's box and the bottom bar's top. */
const panel = (page: Page) => page.evaluate(() => {
  const el = document.querySelector<HTMLElement>('.design-phone-panel');
  if (!el) return null;
  const grip = document.querySelector<HTMLElement>('.tool-layout > .sheet-grip')!;
  const g = grip.getBoundingClientRect();
  return {
    snap: el.dataset.snap, tab: el.dataset.tab, top: el.getBoundingClientRect().top, edge: el.getBoundingClientRect().bottom,
    gripTop: g.top, gripBottom: g.bottom, expanded: grip.getAttribute('aria-expanded'),
    barTop: document.querySelector('.design-compact-actions')!.getBoundingClientRect().top,
    active: document.activeElement?.textContent ?? '',
  };
});
/** Wait out the 0.34s settle (or none, under reduced motion). */
const settled = (page: Page) => page.waitForFunction(() => {
  const el = document.querySelector('.design-phone-panel');
  return !!el && el.getAnimations().length === 0 && document.querySelector('.tool-layout > .sheet-grip')!.getAnimations().length === 0;
});

/** The grip's height, and what a press finds one pixel inside and outside each edge. */
const gripHits = (page: Page) => page.evaluate(() => {
  const grip = document.querySelector('.tool-layout > .sheet-grip')!;
  const { top, bottom, height } = grip.getBoundingClientRect();
  const at = (y: number) => document.elementFromPoint(195, y);
  return {
    height: Math.round(height),
    above: !!at(top - 1)?.closest('.design-phone-panel'),
    inTop: at(top + 1) === grip, inBottom: at(bottom - 1) === grip,
    below: !!at(bottom + 1)?.closest('.tool-stage'),
  };
});

/**
 * A drag that stops before the finger lifts. On Linux, Chromium turns a release that is
 * still moving into a fling, and over `touch-action: none` the next tap within about half
 * a second only stops that fling and never becomes a click (a plain page does the same).
 * The panel snaps by where it is let go, not by speed, so the pause changes no stop.
 */
async function touchDrag(cdp: CDPSession, x: number, from: number, to: number, steps = 10): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: from + (to - from) * (i / steps), id: 1 }] });
  }
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => setTimeout(resolve, 40));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: to, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('Design keeps its inputs in the tool view\'s drop-down panel, with the tool view\'s stops', { skip, timeout: 240000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    for (const opts of [{}, { large: true, dark: true }]) {
      const label = opts.large ? 'large text, dark, reduced motion' : 'default';
      const context = await phone(browser, opts);
      try {
        const page = await context.newPage();
        await visit(page);
        // At its peek: the head strip under the top bar, the two tabs, nothing else.
        let p = (await panel(page))!;
        assert.ok(p, `the panel is mounted (${label})`);
        assert.equal(p.snap, 'peek');
        assert.equal(p.expanded, 'false', 'the grip says the panel is folded');
        assert.equal(await page.locator('.is-compact-sheet').count(), 0, 'no bottom sheet');
        assert.equal(await page.locator('.design-phone-panel .fc-insp').count(), 1, 'the live inspector is in the panel');
        assert.equal(await page.locator('.design-phone-panel .fc-nav').count(), 1, 'the live layers list is in the panel');
        assert.deepEqual(await page.locator('.dpp-tabs [role="tab"]').allInnerTexts(), ['Inspect', 'Layer/Page']);
        const topbar = await page.locator('.design-topbar').evaluate(el => el.getBoundingClientRect().bottom);
        assert.ok(Math.abs(p.top - topbar) <= 1, `it hangs from the top bar (${label})`);

        // The bottom bar's Inspect opens the panel to half, the tool view's half, and moves focus in.
        await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
        await settled(page);
        p = (await panel(page))!;
        assert.equal(p.snap, 'half');
        assert.equal(p.expanded, 'true');
        assert.ok(Math.abs(p.edge - 844 / 2) <= 1, `half is the tool view's 50dvh (${label}): ${p.edge}`);
        assert.equal(p.active, 'Inspect', 'focus moved into the panel, onto its tab');
        assert.equal(await page.locator('.dpp-tabs [data-tab="inspect"]').getAttribute('aria-selected'), 'true');

        // A tap on the grip steps on to full, which stops above the bottom bar.
        const cdp = await context.newCDPSession(page);
        await page.touchscreen.tap(195, (p.gripTop + p.gripBottom) / 2);
        await settled(page);
        p = (await panel(page))!;
        assert.equal(p.snap, 'full');
        assert.ok(p.gripBottom <= p.barTop + 0.5, `full never covers the bottom bar (${label})`);
        // A drag released in the middle third stops at half, one in the top third at the peek.
        await touchDrag(cdp, 195, (p.gripTop + p.gripBottom) / 2, 420);
        await settled(page);
        assert.equal((await panel(page))!.snap, 'half');
        p = (await panel(page))!;
        await touchDrag(cdp, 195, (p.gripTop + p.gripBottom) / 2, 150);
        await settled(page);
        assert.equal((await panel(page))!.snap, 'peek');
        // And dragging the head strip itself down opens it, the way a tool's header does.
        const name = (await page.locator('.dpp-name').boundingBox())!;
        await touchDrag(cdp, name.x + name.width / 2, name.y + name.height / 2, 450);
        await settled(page);
        assert.equal((await panel(page))!.snap, 'half', 'the head strip is a handle');

        // The other tab shows the layers list in the same panel.
        await page.locator('.dpp-tabs [data-tab="layers"]').tap();
        await page.waitForSelector('.design-phone-panel[data-tab="layers"] .fc-nav:visible');
        assert.equal(await page.locator('.design-phone-panel .fc-insp:visible').count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Layer/Page', exact: true }).last().getAttribute('aria-pressed'), 'true');

        // Escape folds it to the peek and hands focus back.
        await page.keyboard.press('Escape');
        await settled(page);
        p = (await panel(page))!;
        assert.equal(p.snap, 'peek');
        assert.ok(['Layer/Page', 'Inspect'].includes(p.active), `focus went back (${p.active})`);

        // The keyboard can move the panel through its grip, as a tool's.
        await page.locator('.tool-layout > .sheet-grip').focus();
        await page.keyboard.press('Enter');
        await settled(page);
        assert.equal((await panel(page))!.snap, 'half', 'Enter on the grip steps the panel');
        await cdp.detach();
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});

test('the canvas keeps its band: the selection is framed below the panel, and a canvas drag never moves the panel', { skip, timeout: 180000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await phone(browser);
  try {
    const page = await context.newPage();
    await visit(page);
    const cdp = await context.newCDPSession(page);
    // A drag on the canvas at the peek and at half is the canvas's, never the panel's.
    await touchDrag(cdp, 200, 300, 650);
    assert.equal((await panel(page))!.snap, 'peek', 'a canvas drag at the peek');
    await page.evaluate(() => (window as EditorWindow).lolly!.ui!.apply({ v: 1, sel: ['disc'] }));
    await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
    await settled(page);
    const p = (await panel(page))!;
    assert.equal(p.snap, 'half', 'Inspect opened the panel to half');
    // The selected circle sits in the band between the panel's edge and the bottom bar.
    const disc = await page.locator('#tool-canvas [data-box-id="disc"]').evaluate(el => {
      const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom };
    });
    assert.ok(disc.top >= p.edge && disc.bottom <= p.barTop, `the selection is in view below the panel: ${JSON.stringify(disc)} edge ${p.edge}`);
    // A drag on the pasteboard below the artboard, toward the panel, is still the canvas's.
    const board = await page.locator('#tool-canvas :is([data-box-id="board"], [data-frame-id="board"])').first().evaluate(el => el.getBoundingClientRect().bottom);
    await touchDrag(cdp, 200, Math.round((board + p.barTop) / 2), Math.round(board + 4));
    assert.equal((await panel(page))!.snap, 'half', 'a canvas drag at half');
    // And what is under the grip, either side, is the panel's content and the canvas,
    // never the other way round: the grip covers only the room that is free anyway.
    assert.deepEqual(await gripHits(page), { height: 24, above: true, inTop: true, inBottom: true, below: true }, 'at half');
    await page.keyboard.press('Escape');
    await settled(page);
    assert.deepEqual(await gripHits(page), { height: 24, above: true, inTop: true, inBottom: true, below: true }, 'at the peek');
    await cdp.detach();
  } finally { await context.close(); await closeBrowser(); }
});

test('a focused field with the soft keyboard up keeps the panel where it is', { skip, timeout: 120000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await phone(browser);
  try {
    const page = await context.newPage();
    await visit(page);
    await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
    await settled(page);
    const before = (await panel(page))!;
    const field = page.locator('.design-phone-panel .num-field-in').first();
    await field.focus();
    // A keyboard taking the lower 320px: the visual viewport shrinks, the layout one stays.
    await page.evaluate(() => {
      const vv = window.visualViewport!;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => 844 - 320 });
      vv.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--vv-bottom').trim() === '320px');
    await settled(page);
    const after = (await panel(page))!;
    assert.equal(after.snap, 'half', 'still at half');
    assert.ok(Math.abs(after.edge - before.edge) <= 1, `the panel did not move: ${before.edge} -> ${after.edge}`);
    const box = (await field.boundingBox())!;
    assert.ok(box.y + box.height <= 844 - 320, 'the focused field stays above the keyboard');
    assert.equal(await field.evaluate(el => el === document.activeElement), true, 'and keeps focus');
  } finally { await context.close(); await closeBrowser(); }
});

test('the grip fills the free band in a tool view and covers nothing there', { skip, timeout: 180000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    for (const tool of ['darkroom', 'quote-card']) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true });
      try {
        const page = await context.newPage();
        await page.goto(`${origin}/t/${tool}`);
        await page.waitForSelector('#sheet-grip');
        await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
        await page.waitForSelector('.stage-nav-profile');
        if (await page.locator('.tmpl-chooser-modal').count()) {
          await page.keyboard.press('Escape');
          await page.locator('.tmpl-chooser-modal').waitFor({ state: 'detached' });
        }
        // Measured at rest: the sheet, the grip and the HUD all ease into place at mount.
        await page.waitForFunction(() => ['.sidebar', '#sheet-grip', '.stage-nav', '.tool-stage']
          .every(sel => (document.querySelector(sel)?.getAnimations({ subtree: true }) ?? []).length === 0));
        const r = await page.evaluate(() => {
          const grip = document.getElementById('sheet-grip')!.getBoundingClientRect();
          const body = document.querySelector('.sidebar-body')!.getBoundingClientRect();
          const chip = document.querySelector('.stage-nav-profile')!.getBoundingClientRect();
          const hud = document.querySelector('.stage-nav')!.getBoundingClientRect();
          const hit = (x: number, y: number) => document.elementFromPoint(x, y);
          const g = document.getElementById('sheet-grip');
          return {
            height: grip.height, top: grip.top, bottom: grip.bottom, bodyBottom: body.bottom, hudTop: hud.top,
            // One pixel either side of each edge: hit testing works in whole pixels.
            aboveIsBody: !!hit(60, grip.top - 1)?.closest('.sidebar-body'),
            topIsGrip: hit(60, grip.top + 1) === g,
            bottomIsGrip: hit(chip.left + chip.width / 2, grip.bottom - 1) === g,
            hudBelow: !!hit(chip.left + chip.width / 2, grip.bottom + 1)?.closest('.stage-nav'),
          };
        });
        // Sub-pixel layout puts the edges a fraction apart; the test is that they meet.
        assert.ok(Math.abs(r.height - 36) < 0.5, `${tool}: the grip is the whole 36px band (${r.height})`);
        assert.ok(r.top >= r.bodyBottom - 0.01 && r.top - r.bodyBottom < 0.5, `${tool}: it starts where the controls end (${r.top} / ${r.bodyBottom})`);
        assert.ok(r.bottom <= r.hudTop + 0.01 && r.hudTop - r.bottom < 0.5, `${tool}: it ends where the HUD with the profile chip begins (${r.bottom} / ${r.hudTop})`);
        assert.deepEqual([r.aboveIsBody, r.topIsGrip, r.bottomIsGrip, r.hudBelow], [true, true, true, true], `${tool}: ${JSON.stringify(r)}`);
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});

test('org-chart and record get the same panel; desktop, a landscape phone and two panes keep theirs', { skip, timeout: 240000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    for (const tool of ['org-chart', 'record']) {
      const context = await phone(browser);
      try {
        const page = await context.newPage();
        await visit(page, tool, '');
        assert.equal((await panel(page))?.snap, 'peek', `${tool} has the panel`);
        await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
        await settled(page);
        assert.equal((await panel(page))?.snap, 'half', `${tool} opens it to half`);
      } finally { await context.close(); }
    }
    for (const [width, height, layout] of [[1280, 800, 'wide'], [844, 390, 'compact'], [768, 1024, 'wide']] as const) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width, height }, hasTouch: width !== 1280 });
      try {
        const page = await context.newPage();
        await visit(page);
        assert.equal(await page.locator('.tool-stage').getAttribute('data-design-layout'), layout);
        assert.equal(await page.locator('.design-phone-panel').count(), 0, `no phone panel at ${width} x ${height}`);
        assert.equal(await page.locator('.tool-layout').getAttribute('data-sheet'), null);
        if (width === 844) {
          await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
          await page.waitForSelector('.fc-insp.is-compact-sheet');
        }
      } finally { await context.close(); }
    }
    // A fold: a phone that opens into two panes and folds back. The inspector and the
    // layers list leave the panel for the control pane and come back to the panel.
    const context = await phone(browser);
    try {
      const page = await context.newPage();
      await visit(page);
      await page.getByRole('button', { name: 'Inspect', exact: true }).last().tap();
      await settled(page);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForFunction(() => document.documentElement.dataset.layout === 'split' && !document.querySelector('.design-phone-panel'));
      await page.waitForSelector('.edge-dock .fc-insp');
      assert.equal(await page.locator('.tool-stage .fc-nav, .edge-dock .fc-nav').count(), 1, 'the layers list went home');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForSelector('.design-phone-panel .fc-insp');
      assert.equal(await page.locator('.design-phone-panel .fc-nav').count(), 1);
      assert.equal((await panel(page))?.snap, 'half', 'the open inspector comes back open');
    } finally { await context.close(); }
  } finally { await closeBrowser(); }
});
