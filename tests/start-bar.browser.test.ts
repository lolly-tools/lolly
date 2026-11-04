// SPDX-License-Identifier: MPL-2.0
/**
 * The studio's pinned bar (plan 336 P1, P2) against the rooms under the bar.
 *
 *  - A room's popover paints over the bar: the swatch picker in Colours, the help
 *    tip in Logos and anything the Type room raises to popover height, on a desk
 *    and on a phone. The bar used to win, so a tall picker card lost its name row
 *    under the bar.
 *  - The room strip shows when it scrolls: a fade on each end that has rooms past
 *    the edge, on a desk as well as on a phone.
 *  - The studio has one level-one heading, and the heading carries the design
 *    system's name.
 *  - On a phone, a tray that closes by emptying hands focus to a control that is
 *    drawn, not to "Add from…", which the phone bar keeps in the More menu.
 *  - The heading keeps the bar's own face, not the display face base.css gives
 *    every h1.
 *  - Keyboard focus is never left under the pinned bar, or on a phone under the
 *    room bar at the bottom edge (WCAG 2.4.11), focus moving within the bar never
 *    scrolls the page, and a jump inside a room clears the bar once, not twice.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5193 LOLLY_WEBGPU_TEST_ADAPTER=swiftshader node --import ./tests/browser-gpu.ts --test tests/start-bar.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { gotoSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell';
const DESK = { width: 1280, height: 860 };
const PHONE = { width: 390, height: 844 };
const FOUR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><rect width="100" height="100" fill="#C8553D"/>'
  + '<rect x="100" width="100" height="100" fill="#2F6690"/><rect x="200" width="100" height="100" fill="#F6AE2D"/>'
  + '<rect x="300" width="100" height="100" fill="#3A7D44"/></svg>';
const TOKENS = JSON.stringify({ color: { brand: { $type: 'color', $value: '#7A3E9D' }, ink: { $type: 'color', $value: '#1B1B1E' }, paper: { $type: 'color', $value: '#FBF7F0' } } });

async function withPage(viewport: { width: number; height: number }, run: (page: Page) => Promise<void>): Promise<void> {
  const browser: Browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const phone = viewport.width <= 640;
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    });
    await run(await context.newPage());
  } finally {
    await browser.close();
  }
}

/** Open a studio address. A later call only changes the hash, so it waits for the studio to mount again. */
async function open(page: Page, hash: string): Promise<void> {
  await gotoSettled(page, `${origin}/${hash}`);
  await page.locator('.ds-top').waitFor();
}

/** Install a small design system of the test's own, so a room has tokens to show on any profile. */
async function furnish(page: Page): Promise<void> {
  await open(page, '#/start?source=file');
  const file = page.locator('.start-import-modal .start-import-file');
  await file.waitFor({ state: 'attached' });
  await file.setInputFiles({ name: 'tokens.json', mimeType: 'application/json', buffer: Buffer.from(TOKENS) });
  await page.locator('[data-install-plain]').click();
  await page.locator('[data-install-plain]').waitFor({ state: 'hidden' });
}

/**
 * A column of controls at the end of the open room, tall enough to scroll the
 * page on any profile: what the room itself holds differs from one design
 * system to the next, and the bars pad the page whatever the room shows.
 */
function roomColumn(page: Page): Promise<void> {
  return page.evaluate(() => {
    const column = document.createElement('div');
    column.dataset.testColumn = '';
    column.style.cssText = 'display:flex;flex-direction:column;gap:56px;padding-block:56px';
    for (let i = 0; i < 24; i++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Test stop ${i + 1}`;
      button.style.cssText = 'height:32px;align-self:flex-start';
      column.append(button);
    }
    document.querySelector('.ds-main')!.append(column);
  });
}

/** What is drawn near the top of `selector`, and whether that point lies in the bar's band. */
function topOf(page: Page, selector: string): Promise<{ inBar: boolean; hit: string; at: string }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const bar = document.querySelector('.ds-top')?.getBoundingClientRect();
    if (!el || !bar) return { inBar: false, hit: `missing ${sel}`, at: '' };
    const box = el.getBoundingClientRect();
    const y = Math.max(box.top, 0) + 6;
    const hit = document.elementFromPoint(box.left + Math.min(24, box.width / 2), y);
    return { inBar: y < bar.bottom, hit: el.contains(hit) ? 'self' : `${hit?.tagName}.${hit?.className}`, at: `y ${Math.round(y)}, bar ends ${Math.round(bar.bottom)}` };
  }, selector);
}

/** Open the Logos room's help tip, then scroll until its bubble starts under the bar. */
async function logosTipUnderBar(page: Page): Promise<string> {
  await open(page, '#/start?area=logos');
  const tip = page.locator('.ds-shell .help-tip-btn').first();
  await tip.waitFor();
  await tip.evaluate(btn => (btn as HTMLElement).click());
  const pop = '.ds-shell .help-tip-pop:not([hidden])';
  await page.locator(pop).waitFor();
  // The room has to be laid out tall enough to scroll the bubble up that far.
  await page.waitForFunction(() => document.documentElement.scrollHeight > innerHeight + 200);
  await page.evaluate((sel) => {
    const bar = document.querySelector('.ds-top')!.getBoundingClientRect();
    const top = document.querySelector(sel)!.getBoundingClientRect().top;
    window.scrollBy(0, top - (bar.bottom - 24));
  }, pop);
  return pop;
}

/** A layer at the rooms' popover height (the swatch picker's 30), placed over the bar from inside the Type room. */
async function typeLayerOverBar(page: Page): Promise<string> {
  await open(page, '#/start?area=type');
  await page.locator('[data-be-tab-panel="type"]').waitFor();
  await page.evaluate(() => {
    const layer = document.createElement('div');
    layer.dataset.testLayer = '';
    layer.style.cssText = 'position:fixed;top:4px;left:30%;width:120px;height:40px;z-index:30;background:Canvas';
    document.querySelector('[data-be-tab-panel="type"]')!.append(layer);
  });
  return '[data-test-layer]';
}

test('a room popover paints over the pinned bar on a desk', { skip, timeout: 180_000 }, async () => {
  await withPage(DESK, async (page) => {
    await open(page, '#/start?area=color');
    await page.locator('[data-be-pal] .be-swatch').first().waitFor({ state: 'attached' });
    // The starter group opens closed; a design system's own colours would show.
    await page.evaluate(() => document.querySelectorAll('details.be-pal-group').forEach(d => { (d as HTMLDetailsElement).open = true; }));
    await page.locator('[data-be-pal] .be-swatch').last().click();
    await page.locator('.be-editor:not([hidden])').waitFor();
    const card = await topOf(page, '.be-editor:not([hidden])');
    assert.ok(card.inBar, 'the picker card reaches into the bar, or this proves nothing');
    assert.equal(card.hit, 'self', `the picker's name row is drawn, not covered (${card.hit})`);

    const tip = await topOf(page, await logosTipUnderBar(page));
    assert.ok(tip.inBar, `the help tip sits in the bar band (${tip.at})`);
    assert.equal(tip.hit, 'self', `the Logos help tip is drawn over the bar (${tip.hit})`);

    const layer = await topOf(page, await typeLayerOverBar(page));
    assert.equal(layer.hit, 'self', `a Type room layer at popover height is drawn over the bar (${layer.hit})`);
  });
});

test('a room popover paints over the pinned bar on a phone', { skip, timeout: 180_000 }, async () => {
  await withPage(PHONE, async (page) => {
    const tip = await topOf(page, await logosTipUnderBar(page));
    assert.ok(tip.inBar, `the help tip sits in the bar band (${tip.at})`);
    assert.equal(tip.hit, 'self', `the Logos help tip is drawn over the bar (${tip.hit})`);
    const layer = await topOf(page, await typeLayerOverBar(page));
    assert.equal(layer.hit, 'self', `a Type room layer at popover height is drawn over the bar (${layer.hit})`);
  });
});

test('the desk room strip shows a cue on each end that has rooms past it', { skip, timeout: 120_000 }, async () => {
  // Plan 346, change 10: lib/scroll-cue.ts puts a fade and a chevron at each end
  // with rooms past it, and marks those ends on the nav (data-more="start end").
  await withPage({ width: 700, height: 800 }, async (page) => {
    await open(page, '#/start');
    const strip = page.locator('.ds-rooms');
    const nav = page.locator('.ds-room-nav');
    const state = (): Promise<{ scrolls: boolean; more: string; end: string; start: string }> => nav.evaluate((el) => {
      const list = el.querySelector('.ds-rooms') as HTMLElement;
      const shown = (sel: string): string => { const cue = el.querySelector(sel); return cue ? getComputedStyle(cue).display : 'missing'; };
      return { scrolls: list.scrollWidth > list.clientWidth + 1, more: (el as HTMLElement).dataset.more ?? '', end: shown('.scroll-cue--end'), start: shown('.scroll-cue--start') };
    });
    const first = await state();
    assert.ok(first.scrolls, 'eight rooms do not fit a 700px window, or this proves nothing');
    assert.equal(first.more, 'end', 'rooms wait past the far end only');
    assert.notEqual(first.end, 'none', 'the far end shows its cue');
    assert.equal(first.start, 'none', 'the near end shows none');
    await strip.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page.waitForFunction(() => (document.querySelector('.ds-room-nav') as HTMLElement).dataset.more === 'start');
    await page.setViewportSize(DESK);
    await page.waitForFunction(() => !(document.querySelector('.ds-room-nav') as HTMLElement).dataset.more);
    const fits = await state();
    assert.equal(fits.end, 'none', 'a strip that fits shows no cue');
    assert.equal(fits.start, 'none');
  });
});

test('the studio has one level-one heading that carries the design system name', { skip, timeout: 120_000 }, async () => {
  for (const viewport of [DESK, PHONE]) {
    await withPage(viewport, async (page) => {
      await open(page, '#/start');
      await page.locator('[data-start-ds]:not([hidden])').waitFor();
      const name = await page.locator('[data-start-ds]').evaluate(el => (el.querySelector('input') as HTMLInputElement | null)?.value ?? el.textContent?.trim() ?? '');
      assert.ok(name, 'the bar shows a design system name');
      const h1 = page.getByRole('heading', { level: 1 });
      assert.equal(await h1.count(), 1, `one level-one heading at ${viewport.width}px`);
      const text = await h1.evaluate(el => el.textContent?.replace(/\s+/g, ' ').trim() ?? '');
      assert.match(text, /Design system/i);
      assert.ok(text.includes(name), `the heading "${text}" carries "${name}" at ${viewport.width}px`);
    });
  }
});

test('on a phone, an emptied tray hands focus to a control that is drawn', { skip, timeout: 180_000 }, async () => {
  await withPage(PHONE, async (page) => {
    // A furnished system first, so "Add from…" is offered (and kept in the More menu).
    await furnish(page);
    await open(page, '#/start?area=overview&source=file');
    const file = page.locator('.start-import-modal .start-import-file');
    await file.waitFor({ state: 'attached' });
    // The studio reads whether the system is furnished after it mounts.
    await page.waitForFunction(() => (document.querySelector('[data-start-import]') as HTMLElement | null)?.hidden === false);
    await file.setInputFiles({ name: 'four.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(FOUR) });
    await page.locator('[data-colors-tray]').click();
    const all = page.locator('[data-ds-tray-all]').first();
    await all.waitFor();
    await all.focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-start-tray]').waitFor({ state: 'hidden' });
    const focus = await page.waitForFunction(() => {
      const el = document.activeElement as HTMLElement | null;
      return el && el !== document.body ? `${el.tagName}.${el.className}|${el.getClientRects().length}` : null;
    }, undefined, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => 'BODY');
    assert.notEqual(focus, 'BODY', 'focus is not dropped on the page');
    assert.ok(!String(focus).endsWith('|0'), `focus is on a control that is drawn (${focus})`);
  });
});

test('the heading keeps the bar\'s own face when the design system has a display face', { skip, timeout: 120_000 }, async () => {
  await withPage(DESK, async (page) => {
    await open(page, '#/start');
    const faces = await page.evaluate(() => {
      // A display face of the design system's own, whatever the profile ships.
      document.documentElement.style.setProperty('--font-display', '"Lolly Test Display", serif');
      const kicker = document.querySelector('.ds-bar-kicker')!;
      return { tag: kicker.tagName, kicker: getComputedStyle(kicker).fontFamily, bar: getComputedStyle(kicker.parentElement!).fontFamily };
    });
    assert.equal(faces.tag, 'H1');
    assert.doesNotMatch(faces.bar, /Lolly Test Display/, 'the bar itself is chrome, set in the chrome face');
    assert.equal(faces.kicker, faces.bar, 'the label reads in the bar\'s face, not the display face');
  });
});

type Edge = 'top' | 'bottom';

/**
 * Pick two neighbours in the test column's Tab order and scroll so that one of
 * them sits entirely under a pinned bar while the other is in clear view, then
 * focus the clear one without scrolling. `top`: the earlier one is under the top bar, for
 * Shift+Tab to reach. `bottom`: the later one is under the phone's room bar, for
 * Tab to reach. Returns a selector for the hidden one, or null.
 */
function arrange(page: Page, edge: Edge): Promise<string | null> {
  return page.evaluate((edge) => {
    const bar = document.querySelector('.ds-top')!.getBoundingClientRect().bottom;
    const nav = document.querySelector('.ds-room-nav')!;
    const foot = getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight;
    const stops = [...document.querySelectorAll<HTMLElement>('[data-test-column] button')];
    for (let i = 0; i + 1 < stops.length; i++) {
      const [hidden, clear] = edge === 'top' ? [stops[i]!, stops[i + 1]!] : [stops[i + 1]!, stops[i]!];
      const h = hidden.getBoundingClientRect();
      const c = clear.getBoundingClientRect();
      if (h.height < 16 || h.height > bar - 8) continue;
      if ((edge === 'top' ? c.top - h.bottom : h.top - c.bottom) < 24) continue;
      const from = scrollY;
      window.scrollTo(0, from + (edge === 'top' ? h.top - (bar - h.height - 4) : h.bottom - (innerHeight - 4)));
      const h2 = hidden.getBoundingClientRect();
      const c2 = clear.getBoundingClientRect();
      const under = edge === 'top' ? h2.top >= 0 && h2.bottom <= bar : h2.top >= foot && h2.bottom <= innerHeight;
      if (under && c2.top >= bar && c2.bottom <= foot) {
        hidden.dataset.testHidden = edge;
        clear.focus({ preventScroll: true });
        return `[data-test-hidden="${edge}"]`;
      }
      window.scrollTo(0, from);
    }
    return null;
  }, edge);
}

/** The focused control's box against the bars, and whether that control is the one drawn there. */
function focusPlace(page: Page): Promise<{ id: string; clear: boolean; drawn: boolean; at: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const bar = document.querySelector('.ds-top')!.getBoundingClientRect().bottom;
    const nav = document.querySelector('.ds-room-nav')!;
    const foot = getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + Math.min(10, r.width / 2), r.top + r.height / 2);
    return { id: el.dataset.testHidden ?? `${el.tagName}.${el.className}`, clear: r.top >= bar - 1 && r.bottom <= foot + 1, drawn: el.contains(hit), at: `${Math.round(r.top)} to ${Math.round(r.bottom)}, bar ends ${Math.round(bar)}, room bar starts ${Math.round(foot)}` };
  });
}

test('keyboard focus is never left under the pinned bar', { skip, timeout: 240_000 }, async () => {
  for (const [viewport, edges] of [[DESK, ['top']], [PHONE, ['top', 'bottom']]] as const) {
    await withPage(viewport, async (page) => {
      await open(page, '#/start');
      await roomColumn(page);
      for (const edge of edges) {
        const target = await arrange(page, edge);
        assert.ok(target, `a control can be placed under the ${edge} bar at ${viewport.width}px, or this proves nothing`);
        await page.keyboard.press(edge === 'top' ? 'Shift+Tab' : 'Tab');
        const place = await focusPlace(page);
        assert.equal(place.id, edge, `the keyboard reached the control under the ${edge} bar at ${viewport.width}px`);
        assert.ok(place.clear && place.drawn, `the focused control is in view, not under the ${edge} bar at ${viewport.width}px (${place.at})`);
      }
    });
  }
});

test('focus moving within the bar never scrolls the page', { skip, timeout: 240_000 }, async () => {
  for (const viewport of [DESK, PHONE]) {
    await withPage(viewport, async (page) => {
      await open(page, '#/start');
      await page.locator('[data-start-ds]:not([hidden])').waitFor();
      await roomColumn(page);
      const scrolledFocus = (selector: string): Promise<number> => page.evaluate((sel) => {
        window.scrollTo(0, 400);
        (document.activeElement as HTMLElement | null)?.blur?.();
        document.querySelector<HTMLElement>(sel)!.focus();
        return scrollY;
      }, selector);
      // The name is a field only on a system the person may edit.
      const editable = await page.locator('.start-ds-name').count() > 0;
      for (const selector of ['.start-back', ...(editable ? ['.start-ds-name'] : []), '[data-ds-more]', '.ds-room[tabindex="0"]']) {
        assert.equal(await scrolledFocus(selector), 400, `focusing ${selector} leaves the page where it was at ${viewport.width}px`);
      }
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => scrollY), 400, `walking the room strip leaves the page where it was at ${viewport.width}px`);
      await scrolledFocus('[data-ds-more]');
      await page.keyboard.press('Enter');
      await page.locator('.ds-bar-menu [role="menuitem"]').first().waitFor();
      assert.equal(await page.evaluate(() => scrollY), 400, `opening the More menu leaves the page where it was at ${viewport.width}px`);
    });
  }
});

test('a jump inside a room clears the bar once, not twice', { skip, timeout: 240_000 }, async () => {
  await withPage({ width: 1280, height: 600 }, async (page) => {
    await furnish(page);
    await open(page, '#/start?area=tokens');
    const tile = page.locator('.tk-tile').first();
    await tile.waitFor();
    // Room past the last section, so the jump can bring a section to the top.
    await roomColumn(page);
    await tile.click();
    const landing = await page.waitForFunction(() => {
      const sec = (document.activeElement as HTMLElement | null)?.closest('.tk-sec, .tk-adv');
      return sec ? { top: sec.getBoundingClientRect().top, bar: document.querySelector('.ds-top')!.getBoundingClientRect().bottom } : null;
    }).then(h => h.jsonValue());
    assert.ok(landing, 'the tile focuses its section');
    assert.ok(landing.top >= landing.bar && landing.top <= landing.bar + 9, `a Tokens section lands just below the bar (${Math.round(landing.top)}, bar ends ${Math.round(landing.bar)})`);
  });
  await withPage(PHONE, async (page) => {
    await open(page, '#/start?area=skills');
    const skill = page.locator('[data-skill-open]').first();
    await skill.waitFor();
    await skill.click();
    await page.waitForFunction(() => (document.querySelector('#skills-reader')?.getBoundingClientRect().top ?? 9999) < innerHeight / 2);
    const landing = await page.evaluate(() => ({ top: document.querySelector('#skills-reader')!.getBoundingClientRect().top, bar: document.querySelector('.ds-top')!.getBoundingClientRect().bottom }));
    assert.ok(landing.top >= landing.bar && landing.top <= landing.bar + 9, `the skill reader lands just below the bar (${Math.round(landing.top)}, bar ends ${Math.round(landing.bar)})`);
  });
});

test('leaving the studio takes the page padding with it', { skip, timeout: 120_000 }, async () => {
  await withPage(PHONE, async (page) => {
    await open(page, '#/start?area=tokens');
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingTop), 'auto', 'the studio pads the page');
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForFunction(() => !document.querySelector('.ds-top'));
    const after = await page.evaluate(() => ({ pad: getComputedStyle(document.documentElement).scrollPaddingTop, top: document.documentElement.style.getPropertyValue('--ds-sticky-top'), foot: document.documentElement.style.getPropertyValue('--ds-sticky-bottom') }));
    assert.deepEqual(after, { pad: 'auto', top: '', foot: '' });
  });
});
