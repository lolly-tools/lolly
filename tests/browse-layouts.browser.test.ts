// SPDX-License-Identifier: MPL-2.0
/**
 * Browse layouts in the real shell (plan 302, PR 2: Tools and Utilities, Grid and Card).
 *
 * The hard requirement this file exists for: in Card, EVERY card-size step makes the
 * thumbnail bigger, not only the column wider (plan 296's build moved only the column).
 * Around it, the things a layout switch must never break: the tiles are the same
 * nodes after a round trip, a search still hides tools, the selection dot can be hit,
 * nothing overflows the page, the cards follow the "Yours" shelf with no strip-sized gap,
 * Compact is shorter and keeps every status badge whole,
 * Compact gives a phone two Grid columns, right-to-left mirrors the dot,
 * large text clips nothing, hidden previews leave the icon in the slot, and "+ New"
 * is quiet until the card is hovered and opens the starting points, never a seeded look.
 *
 * Gated on LOLLY_IMPORT_TEST_URL, the lolly-start dev shell CI's browser shard starts.
 * Locally:  LOLLY_IMPORT_TEST_URL=http://127.0.0.1:<port> LOLLY_BROWSER_CHANNEL=chrome \
 *             node --test tests/browse-layouts.browser.test.ts
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import type { Page } from 'playwright-core';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell';
// The shared browser outlives every test body, so close it once or the file never exits.
after(() => closeBrowser());

type Box = { x: number; y: number; width: number; height: number };

async function openGallery(page: Page, route: string, seed: Record<string, string> = {}): Promise<void> {
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('browse-test-seeded')) return;
    sessionStorage.setItem('browse-test-seeded', '1');
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`${origin}/${route}`, { waitUntil: 'load' });
  await page.locator('.tool-masonry .gtile[data-tool-id]').first().waitFor({ timeout: 60_000 });
  await settled(page);
}

/**
 * Wait until the gallery has stopped redrawing. A cold visit paints from the slim
 * index first and mounts again, with new tile nodes, once the full index arrives
 * (views/gallery.ts, paintedFromSlim), so a test that keeps tile nodes must wait for
 * that second mount and then for one quiet second.
 */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { __toolIndex?: unknown }).__toolIndex, null, { timeout: 60_000 });
  await page.evaluate(() => new Promise<void>((resolve) => {
    let grid = document.querySelector('.tool-masonry');
    let quiet = 0;
    const observer = new MutationObserver(() => { quiet = 0; });
    const watch = (): void => { observer.disconnect(); if (grid) observer.observe(grid, { childList: true }); };
    watch();
    const started = Date.now();
    const tick = setInterval(() => {
      const now = document.querySelector('.tool-masonry');
      if (now !== grid) { grid = now; watch(); quiet = 0; } else quiet += 100;
      if ((quiet >= 1000 && grid?.querySelector('.gtile[data-tool-id]')) || Date.now() - started > 20_000) {
        clearInterval(tick);
        observer.disconnect();
        resolve();
      }
    }, 100);
  }));
}

/** The live thumbnail slot of a card: its still look, or the icon that stands in. */
const thumbOf = (page: Page, selector: string): Promise<Box> => page.locator(selector).first().evaluate((tile) => {
  const slot = (tile.querySelector(':scope > .gcar') as HTMLElement | null)?.offsetParent
    ? tile.querySelector(':scope > .gcar')! : tile.querySelector('.gtile-cap > .tool-card-icon')!;
  const r = slot.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});

const thumbVars = (page: Page): Promise<{ w: number; h: number }> => page.locator('.tool-masonry').evaluate((grid) => {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:var(--browse-thumb-w);height:var(--browse-thumb-h)';
  grid.append(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  return { w: r.width, h: r.height };
});

async function openOptions(page: Page): Promise<void> {
  if (await page.locator('#filter-popover').isHidden()) await page.locator('.gallery-viewopts').click();
  await page.locator('#filter-popover').waitFor({ state: 'visible' });
}

/** Move the card-size slider the way a keyboard user does: Home, then step right. */
async function setStep(page: Page, step: number): Promise<void> {
  await openOptions(page);
  const slider = page.locator('#filter-popover').getByRole('slider', { name: 'Card size' });
  await slider.focus();
  await slider.press('Home');
  for (let i = 0; i < step; i++) await slider.press('ArrowRight');
  await page.waitForFunction((want) => (document.querySelector('.tool-masonry')?.getAttribute('data-card-size') ?? '2') === String(want), step);
}

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`Tools Card at ${width}px, ${theme}: every card-size step grows the thumbnail, and a switch keeps the tiles`, { skip, timeout: 120_000 }, async (ctx) => {
      const browser = await getBrowser();
      const mobile = width < 640;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        await openGallery(page, '#/', { theme });

        // Grid to Card through the real control: same nodes, attribute flipped in place.
        const before = await page.evaluate(() => {
          const w = window as unknown as { __tiles: Element[] };
          w.__tiles = [...document.querySelectorAll('.tool-masonry .gtile[data-tool-id]')];
          return w.__tiles.length;
        });
        await openOptions(page);
        const flipStart = Date.now();
        await page.locator('#filter-popover [data-layout-mode="card"]').click();
        await page.locator('.tool-masonry[data-browse-layout="card"]').waitFor();
        ctx.diagnostic(`Grid to Card switch with ${before} tiles: ${Date.now() - flipStart} ms including the click`);
        assert.equal(await page.evaluate(() => {
          const w = window as unknown as { __tiles: Element[] };
          const now = [...document.querySelectorAll('.tool-masonry .gtile[data-tool-id]')];
          return now.length === w.__tiles.length && now.every(el => w.__tiles.includes(el));
        }), true, 'Card draws the same tile nodes; nothing re-rendered');
        assert.match(page.url(), /[?&]layout=card\b/);
        assert.equal(await page.locator('.featured-mount .ftile').count(), 0, 'the favourites strip draws only in Grid');
        assert.equal(await page.locator('#filter-popover [data-be-seg="featured-view"]').isVisible(), false);
        assert.equal(await page.locator('#filter-popover [data-layout-mode="list"]').count(), 0, 'List arrives with its columns, later');

        // The requirement: column AND thumbnail grow at every step, for a look and for an icon.
        const look = '.tool-masonry .gtile--has-preview:not(.is-filtered)';
        const icon = '.tool-masonry .gtile:not(.gtile--has-preview):not(.is-filtered):not(.gtile--hiddenbox)';
        let last: { look: Box; icon: Box; card: number } | null = null;
        for (const step of [0, 1, 2, 3, 4]) {
          await setStep(page, step);
          const now = {
            look: await thumbOf(page, look),
            icon: await thumbOf(page, icon),
            card: await page.locator(look).first().evaluate(el => el.getBoundingClientRect().width),
          };
          const want = await thumbVars(page);
          for (const [kind, box] of [['look', now.look], ['icon', now.icon]] as const) {
            assert.ok(Math.abs(box.width - want.w) <= 1 && Math.abs(box.height - want.h) <= 1,
              `step ${step}: the ${kind} thumbnail is ${box.width}x${box.height}, the step says ${want.w}x${want.h}`);
            if (last) {
              assert.ok(box.width > last[kind].width && box.height > last[kind].height,
                `step ${step}: the ${kind} thumbnail grew from ${last[kind].width}x${last[kind].height} to ${box.width}x${box.height}`);
            }
          }
          if (last && !mobile) assert.ok(now.card >= last.card, `step ${step}: the column does not shrink`);
          last = now;
        }
        await setStep(page, 2);
        await page.keyboard.press('Escape');

        // Nothing overflows the page, and the selection dot is on top where it is drawn.
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'no horizontal overflow');
        const dotHit = await page.locator(look).first().evaluate((tile) => {
          const dot = tile.querySelector<HTMLElement>('.tile-check')!;
          const thumb = tile.querySelector<HTMLElement>(':scope > .gcar')!.getBoundingClientRect();
          const r = dot.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { hit: !!hit && dot.contains(hit), inside: r.left >= thumb.left - 1 && r.bottom <= thumb.bottom + 1 && r.top >= thumb.top - 1 };
        });
        assert.deepEqual(dotHit, { hit: true, inside: true }, 'the dot is hit-testable on the thumbnail corner');

        // Back to Grid: the same nodes again, and the strip returns.
        await openOptions(page);
        await page.locator('#filter-popover [data-layout-mode="grid"]').click();
        assert.equal(await page.locator('.tool-masonry').getAttribute('data-browse-layout'), null);
        assert.equal(await page.evaluate(() => {
          const w = window as unknown as { __tiles: Element[] };
          return [...document.querySelectorAll('.tool-masonry .gtile[data-tool-id]')].every(el => w.__tiles.includes(el));
        }), true);
        assert.doesNotMatch(page.url(), /[?&]layout=/, 'Grid leaves the address');
      } finally {
        await context.close();
      }
    });
  }
}

test('Tools Card: search still hides tools, Compact is shorter, RTL mirrors the dot, large text clips nothing', { skip, timeout: 120_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await openGallery(page, '#/?layout=card&q=qr');
    const filtered = await page.locator('.tool-masonry .gtile.is-filtered').evaluateAll(els => els.map(el => el.getClientRects().length));
    assert.ok(filtered.length > 0, 'the search filtered something');
    assert.deepEqual([...new Set(filtered)], [0], 'a filtered tool has no box in Card');
    assert.ok(await page.locator('.tool-masonry .gtile:not(.is-filtered)[data-tool-id]').count() > 0);

    await page.goto(`${origin}/#/?layout=card`, { waitUntil: 'load' });
    await page.locator('.tool-masonry[data-browse-layout="card"] .gtile[data-tool-id]').first().waitFor();
    await settled(page);
    const cardHeight = (): Promise<number> => page.locator('.tool-masonry .gtile[data-tool-id]').first().evaluate(el => el.getBoundingClientRect().height);
    const comfortable = await cardHeight();
    await openOptions(page);
    await page.locator('#filter-popover [data-density-mode="compact"]').click();
    assert.equal(await page.locator('.tool-masonry').getAttribute('data-browse-density'), 'compact');
    assert.ok(await cardHeight() < comfortable, 'Compact cards are shorter');
    // Compact puts both detail lines on one; the description gives way, never the
    // status badge ("Experimental" is what says exports carry a watermark).
    const badges = await page.locator('.tool-masonry .gtile:not(.is-filtered)[data-tool-id] .gtile-meta > .gtile-status').evaluateAll(els => els.map((el) => {
      const meta = el.parentElement!.getBoundingClientRect(), b = el.querySelector('.badge')!.getBoundingClientRect();
      return b.width > 0 && b.left >= meta.left - 1 && b.right <= meta.right + 1 && el.scrollWidth <= el.clientWidth + 1;
    }));
    assert.ok(badges.length > 0, 'some tool carries a status');
    assert.deepEqual([...new Set(badges)], [true], 'every status badge shows whole in Compact');
    await page.locator('#filter-popover [data-density-mode="comfortable"]').click();
    await page.keyboard.press('Escape');

    // The quiet "+ New": muted at rest, full while its card is hovered.
    const quiet = page.locator('.tool-masonry .gtile:not(.gtile--unavailable)[data-tool-id] .gtile-new-icon').first();
    await page.mouse.move(2, 450);
    assert.ok(Number(await quiet.evaluate(el => getComputedStyle(el).opacity)) < 1, 'quiet at rest');
    await quiet.locator('xpath=ancestor::article[1]').hover();
    await page.waitForFunction((el) => getComputedStyle(el!).opacity === '1', await quiet.elementHandle(), { timeout: 2_000 });
    assert.equal(await page.locator('.tool-masonry .gtile-new:visible').count(), 0, 'Card draws no Grid pill');

    // Right to left: the dot moves to the thumbnail's inline start, the right side.
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    const rtl = await page.locator('.tool-masonry .gtile--has-preview:not(.is-filtered)').first().evaluate((tile) => {
      const t = tile.getBoundingClientRect(), d = tile.querySelector('.tile-check')!.getBoundingClientRect(), th = tile.querySelector(':scope > .gcar')!.getBoundingClientRect();
      return { thumbOnRight: th.right > t.left + t.width / 2, dotOnThumb: d.right <= th.right + 1 && d.left >= th.left - 1 };
    });
    assert.deepEqual(rtl, { thumbOnRight: true, dotOnThumb: true });
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; });

    // Large text: rows grow with the type and nothing in a card is cut off.
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; });
    const clipped = await page.locator('.tool-masonry .gtile:not(.is-filtered)[data-tool-id], .tool-masonry .gtile:not(.is-filtered)[data-tool-id] .gtile-meta').evaluateAll(els =>
      els.filter(el => el.scrollHeight > el.clientHeight + 1).length);
    assert.equal(clipped, 0, 'no clipped text column under large text');
    await page.evaluate(() => { delete document.documentElement.dataset.a11yText; });

    // Hidden previews: the icon takes the slot of a look.
    await page.evaluate(() => { document.documentElement.dataset.a11yPreviews = 'hidden'; });
    const slot = await page.locator('.tool-masonry .gtile--has-preview:not(.is-filtered)').first().evaluate((tile) => {
      const icon = tile.querySelector('.gtile-cap > .tool-card-icon')!.getBoundingClientRect();
      return { gcar: tile.querySelector(':scope > .gcar')!.getClientRects().length, icon: icon.width > 0 && icon.height > 0 };
    });
    assert.deepEqual(slot, { gcar: 0, icon: true });
  } finally {
    await context.close();
  }
});

// The favourites strip draws in Grid only, so in Card the "Yours" shelf leads the page.
// An earlier build left the masonry's top-bar clearance under the shelf as well, an
// empty band of about 90px on a desktop and 60px on a phone above the first card row.
test('Tools Card: the first card row follows the "Yours" shelf, and the shelf clears the top bar inside the view', { skip, timeout: 150_000 }, async () => {
  const browser = await getBrowser();
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    const mobile = width < 640;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await openGallery(page, '#/?layout=card');
      // The shelf shows once three distinct tools have saved sessions (views/yours-shelf.ts).
      await page.evaluate(async () => {
        const path = '/src/lib/host-ref.ts', host = (await import(path)).getHostRef();
        for (const id of ['design', 'chart', 'qr-code']) await host.state.save(`${id}:browse-layouts`, { __toolId: id, __label: id }, null);
      });
      await page.reload({ waitUntil: 'load' });
      await page.locator('.tool-masonry[data-browse-layout="card"] .gtile[data-tool-id]').first().waitFor({ timeout: 60_000 });
      await settled(page);
      await page.locator('.yours-shelf').waitFor();
      const at = await page.evaluate(() => {
        const view = document.querySelector('#view')!.getBoundingClientRect();
        const shelf = document.querySelector('.yours-shelf')!.getBoundingClientRect();
        const first = [...document.querySelectorAll('.tool-masonry .gtile:not(.is-filtered)')].find(el => el.getClientRects().length)!;
        return { gap: first.getBoundingClientRect().top - shelf.bottom, clearance: shelf.top - view.top };
      });
      assert.ok(at.gap >= 0 && at.gap <= 24, `at ${width}px the first card row starts ${at.gap}px below the shelf`);
      // A margin that collapsed through the view would start the page tint below the top bar.
      assert.ok(at.clearance >= 40, `at ${width}px the shelf sits ${at.clearance}px inside the view`);
      if (mobile) {
        // A touch screen shows the dot at rest, so Card draws it as a small ring with no fill.
        const dot = await page.locator('.tool-masonry .gtile--has-preview:not(.is-filtered) .tile-check').first().evaluate((el) => {
          const s = getComputedStyle(el);
          return { opacity: s.opacity, fill: s.backgroundColor, width: el.getBoundingClientRect().width };
        });
        assert.equal(dot.opacity, '1', 'the dot stays reachable on touch');
        assert.equal(dot.fill, 'rgba(0, 0, 0, 0)', 'no disc covers the thumbnail');
        assert.ok(dot.width < 20, `the touch dot is ${dot.width}px`);
      }
    } finally {
      await context.close();
    }
  }
});

test('Tools Grid Compact on a phone: two columns at the default step, where Comfortable draws one', { skip, timeout: 90_000 }, async () => {
  const browser = await getBrowser();
  const columns = async (density: Record<string, string>): Promise<number> => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await openGallery(page, '#/', density);
      return await page.locator('.tool-masonry').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    } finally {
      await context.close();
    }
  };
  assert.equal(await columns({}), 1);
  assert.equal(await columns({ 'lolly-density-tools': 'compact' }), 2);
});

test('Tools Card: the quiet "+ New" opens the starting points, not the look on the card', { skip, timeout: 90_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await openGallery(page, '#/?layout=card');
    // A tile with looks: a click on its body opens the look it shows, seeded with z=.
    // "+ New" sits on the same body and must never be claimed by that click.
    const tile = page.locator('.tool-masonry[data-browse-layout="card"] .gtile--has-preview:not(.is-filtered)[data-tool-id]').first();
    const id = (await tile.getAttribute('data-tool-id'))!;
    const seen: string[] = [];
    page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) seen.push(frame.url()); });
    await tile.hover();
    await tile.locator('.gtile-new-icon').click();
    await page.waitForURL(u => u.pathname === `/${id}` || u.hash.startsWith(`#/tool/${id}`), { timeout: 30_000 });
    await page.waitForTimeout(1_500);
    seen.push(page.url());
    const short = (u: string): string => u.slice(0, 120);
    // An empty `template=` asks for the chooser; a look gives its own template.
    assert.ok(seen.some(u => new RegExp(`#/tool/${id}\\?template=(?:&|$)`).test(u)), `"+ New" asked for the starting points: ${seen.map(short).join(' | ')}`);
    const seeded = seen.filter(u => /[?&]z=/.test(new URL(u).search + new URL(u).hash));
    assert.deepEqual(seeded.map(short), [], 'no look was seeded');
  } finally {
    await context.close();
  }
});

test('Utilities Card: an icon in every slot, and the choice is kept apart from Tools', { skip, timeout: 90_000 }, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await openGallery(page, '#/u', { 'lolly-layout-utilities': 'card' });
    assert.equal(await page.locator('.tool-masonry').getAttribute('data-browse-layout'), 'card');
    const slots = await page.locator('.tool-masonry .gtile:not(.is-filtered):not(.gtile--hiddenbox)').evaluateAll(tiles => tiles.map((tile) => {
      const icon = tile.querySelector('.gtile-cap > .tool-card-icon')?.getBoundingClientRect();
      return !!icon && icon.width > 0 && icon.height > 0;
    }));
    assert.ok(slots.length > 3 && slots.every(Boolean), 'every utility shows its icon as the thumbnail');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await page.goto(`${origin}/#/`, { waitUntil: 'load' });
    await page.locator('.tool-masonry .gtile[data-tool-id]').first().waitFor();
    assert.equal(await page.locator('.tool-masonry').getAttribute('data-browse-layout'), null, 'Tools keeps its own layout');
  } finally {
    await context.close();
  }
});
