// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { shellSettled } from './helpers/shell-settled.ts';
import { pollPage } from './helpers/page-poll.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
test('gallery controls support keyboard and native scrolling past pending previews across accessibility preferences', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 90_000,
}, async (ctx) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mobile, reducedMotion: mobile ? 'no-preference' : 'reduce' });
      try {
        const page = await context.newPage();
        await page.addInitScript(() => {
          for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
        });
        await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' }); await shellSettled(page);
        // Real carousel code and styles, with deterministic completion order so
        // native gestures can reach a still-pending pane without racing rendering.
        await page.evaluate(async (mobile) => {
          const path = '/src/views/gallery-carousel.ts';
          const { carouselDotsMarkup, carouselNavMarkup, wireCarousel, markLookReady } = await import(path);
          document.documentElement.dataset.theme = mobile ? 'dark' : 'light';
          document.documentElement.dataset.a11yText = 'large';
          if (mobile) document.documentElement.dataset.a11yMotion = 'reduce';
          const stage = document.createElement('div');
          stage.id = 'carousel-acceptance';
          stage.className = 'tool-masonry';
          stage.style.cssText = 'position:fixed;inset:70px 12px auto;z-index:10000;max-width:330px;display:block';
          stage.innerHTML = `<div class="gtile"><div class="gcar"><div class="gcar-track">${[0, 1, 2].map(i => `<div class="gcar-slide" data-ex-index="${i}"><a class="gcar-open" href="#/tool/qr-code?example=${i}" aria-label="Open example ${i + 1}"><img class="gcar-img" alt=""></a></div>`).join('')}</div>${carouselDotsMarkup(3)}${carouselNavMarkup(3)}</div></div>`;
          document.body.append(stage);
          const car = stage.querySelector('.gcar')!;
          wireCarousel(car);
          const slides = car.querySelectorAll('.gcar-slide');
          for (const i of [0, 2]) {
            const img = slides[i]!.querySelector('img')!;
            img.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${i ? '#285a98' : '#f2c94c'}"/></svg>`);
            await img.decode();
            markLookReady(car, slides[i]);
          }
          const track = car.querySelector('.gcar-track')!;
          track.addEventListener('scroll', () => { if (track.scrollLeft > 20) track.setAttribute('data-did-scroll', '1'); });
        }, mobile);
        const stage = page.locator('#carousel-acceptance');
        const next = stage.getByRole('button', { name: 'Next example' });
        assert.equal(await next.isVisible(), true);
        assert.ok(await next.evaluate(el => Number(getComputedStyle(el).opacity)) > 0);
        await stage.getByRole('link', { name: 'Open example 1' }).focus();
        await page.keyboard.press('Tab');
        assert.equal(await stage.getByRole('button', { name: 'Previous example' }).evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Tab');
        assert.equal(await next.evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Enter');
        const track = stage.locator('.gcar-track');
        assert.equal(await track.evaluate(el => Math.round(el.scrollLeft / el.clientWidth)), 2, 'OS or app reduced motion steps immediately to a ready example');
        assert.equal(await stage.getByRole('link', { name: 'Open example 3' }).count(), 1);
        const pending = stage.locator('[data-ex-index="1"]');
        assert.equal(await pending.evaluate(el => (el as HTMLElement).inert), true);
        await pending.locator('a').evaluate(el => el.focus());
        assert.equal(await next.evaluate(el => el === document.activeElement), true, 'a pending link cannot steal keyboard focus');
        await page.keyboard.press('Enter');
        assert.equal(await track.evaluate(el => Math.round(el.scrollLeft / el.clientWidth)), 0);
        await track.evaluate(el => el.removeAttribute('data-did-scroll'));
        const box = await track.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
        assert.ok(box.width > 0 && box.height > 0);
        ctx.diagnostic(`${mobile ? 'Touch' : 'Wheel'} navigation at ${mobile ? '390' : '1440'}px with large text and reduced motion`);
        if (mobile) {
          const cdp = await context.newCDPSession(page);
          // Start above the overlay arrows so the contact reaches the scroller.
          const y = box.y + box.height * .3;
          assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.gcar-track'), { x: box.x + box.width * .85, y }), true);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .85, y }] });
          for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (.85 - .7 * step / 8), y }] });
            await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
          }
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await cdp.detach();
        } else {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.wheel(box.width, 0);
        }
        await page.waitForFunction(() => document.querySelector('#carousel-acceptance .gcar-track')?.hasAttribute('data-did-scroll'));
        await page.waitForFunction(() => {
          const track = document.querySelector<HTMLElement>('#carousel-acceptance .gcar-track')!;
          const index = Math.round(track.scrollLeft / track.clientWidth);
          return (index === 0 || index === 2) && Math.abs(track.scrollLeft - index * track.clientWidth) < 2;
        });
        await page.evaluate(() => { document.documentElement.dataset.a11yPreviews = 'hidden'; });
        assert.equal(await next.isVisible(), false);
        assert.equal(await stage.locator('.gcar-dots').isVisible(), false);
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});

// The workspace's shelf (plans/82 M6): one card per published thing, at 390 and 360,
// the home search over the shelf, and "New version" on a copy that fell behind its
// template taking the new version in one tap through the copy's own notice. The
// workspace is two fixtures on the dev shell's catalog: a template of Pricing at
// version 2, and QR Code marked as a rules tool built from a workspace template.
test('the workspace shelf shows one card per published thing, answers search, and New version takes the new version in one tap', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 180_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const { createHash } = await import('node:crypto');
  const v2 = JSON.stringify({ toolId: 'pricing-table', values: { heading: 'Version two heading', data: { columns: ['Feature', 'Standard'], rows: [['Price', '€ 2,000']] } } });
  const template = { id: 'inst/m6price', name: 'Partner price sheet', type: 'template', format: 'json', url: '/inst-fixture/m6price.json', tags: [],
    formats: [{ format: 'json', url: '/inst-fixture/m6price.json', size: v2.length, checksum: createHash('sha256').update(v2).digest('hex'), contentType: 'application/json' }],
    meta: { toolId: 'pricing-table', name: 'Partner price sheet', version: 2, editable: ['data'] } };
  const assetIndex = await (await fetch(`${origin}/catalog/assets/index.json?paged=1`)).json() as { assets: unknown[] };
  const assetBody = JSON.stringify({ ...assetIndex, assets: [template, ...assetIndex.assets] });
  const toolBodies = new Map<string, string>();
  for (const file of ['index.json', 'index.slim.json']) {
    const res = await fetch(`${origin}/catalog/tools/${file}`);
    if (!res.ok) continue;
    const index = await res.json() as { tools: Array<Record<string, unknown>> };
    toolBodies.set(file, JSON.stringify({ ...index, tools: index.tools.map((tool) => tool.id === 'qr-code' ? { ...tool, templateId: 'inst/m6rules' } : tool) }));
  }
  const browser = await getBrowser();
  try {
    for (const [width, height] of [[390, 844], [360, 780]] as const) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        await context.addInitScript(() => {
          for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
        });
        await context.route('**/catalog/assets/index.json*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: assetBody }));
        for (const [file, body] of toolBodies) await context.route(`**/catalog/tools/${file}*`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body }));
        await context.route('**/inst-fixture/m6price.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: v2 }));
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${origin}/#/`, { waitUntil: 'networkidle' }); await shellSettled(page);
        // A copy of the price sheet made from version 1, with her own price in the table.
        const mine = { columns: ['Feature', 'Standard'], rows: [['Price', '€ 990']] };
        await page.evaluate(async (data) => {
          const path = '/src/bridge/index.ts';
          const { createBridge } = await import(path);
          const host = await createBridge();
          await host.state.save('pricing-table:m6copy', { __toolId: 'pricing-table', heading: 'Version one heading', data, __template: { ref: 'inst/m6price', version: 1, editable: ['data'] } });
        }, mine);
        await page.reload({ waitUntil: 'networkidle' }); await shellSettled(page);
        const shelf = page.locator('.published-shelf');
        await shelf.waitFor({ timeout: 60_000 });
        const price = shelf.locator('.published-card[data-published-key="inst/m6price"]');
        await price.locator('.published-card-new').waitFor({ timeout: 30_000 });
        const layout = await page.evaluate(() => {
          const reach = (el: Element) => { const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!at && (el === at || el.contains(at)); };
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            keys: [...document.querySelectorAll<HTMLElement>('.published-card')].map((c) => c.dataset.publishedKey),
            qrInGrid: !!document.querySelector('.tool-masonry [data-tool-id="qr-code"], .tool-masonry .gtile[data-id="qr-code"]'),
            cards: [...document.querySelectorAll<HTMLElement>('.published-card')].map((card) => { card.scrollIntoView({ block: 'center' }); const use = card.querySelector('.published-card-use')!; return { use: reach(use), h: use.getBoundingClientRect().height }; }),
          };
        });
        assert.equal(layout.overflow, false, `${width}: no sideways scroll`);
        assert.deepEqual(layout.keys.sort(), ['inst/m6price', 'inst/m6rules'], `${width}: one card per published thing`);
        assert.equal(layout.qrInGrid, false, `${width}: the rules tool left the grid`);
        for (const card of layout.cards) assert.ok(card.use && card.h >= 44, `${width}: Use reachable and at least 44 px (${JSON.stringify(card)})`);
        assert.match(await price.locator('.published-card-copy').innerText(), /^Your copy/);
        // The home search answers from the shelf too.
        await page.evaluate(async () => { const path = '/src/components/search-bar.ts'; (await import(path)).setSearchBarQuery?.('price sheet'); });
        await page.waitForFunction(() => document.querySelector<HTMLElement>('.published-card[data-published-key="inst/m6rules"]')?.hidden === true);
        assert.equal(await price.isVisible(), true);
        await page.evaluate(async () => { const path = '/src/components/search-bar.ts'; (await import(path)).setSearchBarQuery?.(''); });
        // One tap on New version: her copy opens with the new version and her price kept.
        await price.locator('.published-card-new').scrollIntoViewIfNeeded();
        await price.locator('.published-card-new').tap();
        // The tool route rewrites the address from #/tool/...?slot= to its own form soon after
        // it opens, and both keep the slot, so read the whole address.
        await page.waitForFunction(() => location.href.includes('slot=pricing-table%3Am6copy'));
        await page.waitForFunction(() => {
          const model = (document.querySelector('#tool-canvas') as (HTMLElement & { __lollyModel?: () => Array<{ id: string; value: unknown }> }) | null)?.__lollyModel?.();
          return model?.find((i) => i.id === 'heading')?.value === 'Version two heading';
        }, undefined, { timeout: 60_000 });
        const data = await page.evaluate(() => (document.querySelector('#tool-canvas') as HTMLElement & { __lollyModel: () => Array<{ id: string; value: unknown }> }).__lollyModel().find((i) => i.id === 'data')?.value);
        assert.deepEqual(data, mine, `${width}: her price is kept`);
        // The notice comes down when the update has finished, after the new values are in
        // and the references are resolved again (views/tool-template-notices.ts). The new
        // heading shows a few milliseconds before that, so ask until the notice is gone.
        await pollPage(page, async () => {
          const path = '/src/lib/notifications.ts';
          return !(await import(path)).notificationEntries().some((n: { id: string }) => n.id === 'template-version:inst/m6price:2');
        }, undefined, { timeout: 10_000, message: `${width}: the notice is done` });
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});

// A partner programme member's home (plans/82 M6): no first-run featured hero, no
// "Add your details" nudge and no status chip but Experimental, at 390 and 360. The dev
// shell is given a workspace that answers org-config with programmeScoped, the way Work
// does for a programme member, and a staff home on the same shell keeps all three.
test('a programme member home has no featured hero, no details nudge and no status chip but Experimental', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 180_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  try {
    for (const [width, height] of [[390, 844], [360, 780]] as const) {
      const home: Record<string, { hero: boolean; nudge: boolean; chips: string[]; overflow: boolean }> = {};
      for (const who of ['staff', 'member'] as const) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
        try {
          await context.addInitScript(() => {
            for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
          });
          const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
          await context.route('**/api/auth/config', (route) => route.fulfill(json({ mode: 'open', provider: 'oidc', loginPath: '/login' })));
          await context.route('**/api/auth/session', (route) => route.fulfill(json({ kind: 'member', user: { sub: 'u1', email: 'rita@northwind.example', groups: [], role: 'member' } })));
          await context.route('**/api/v1/org-config*', (route) => route.fulfill(json({ instance: { name: 'Example Workspace' }, inboxUnread: 0, can: {}, ...(who === 'member' ? { programmeScoped: true } : {}) })));
          const page = await context.newPage();
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.goto(`${origin}/#/`, { waitUntil: 'networkidle' }); await shellSettled(page);
          await page.locator('.tool-masonry .gtile').first().waitFor({ timeout: 60_000 });
          await page.waitForTimeout(600);
          home[who] = await page.evaluate(() => ({
            hero: !!document.querySelector('.gallery.has-featured'),
            // The "Add your details" nudge; the offline nudge shares its look and stays.
            nudge: !!document.querySelector('.personalize-nudge:not(.offline-nudge)'),
            chips: [...new Set([...document.querySelectorAll('.tool-masonry .badge')].map((b) => b.className))],
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          }));
          assert.deepEqual(errors, [], `${width} ${who}`);
        } finally { await context.close(); }
      }
      const { staff, member } = home;
      assert.equal(member!.hero, false, `${width}: no first-run featured hero (staff: ${staff!.hero})`);
      assert.equal(member!.nudge, false, `${width}: no details nudge (staff: ${staff!.nudge})`);
      assert.ok(member!.chips.every((c) => !/badge-(community|official)\b/.test(c)), `${width}: ${member!.chips.join(' ')}`);
      assert.equal(member!.overflow, false);
      // The staff home on the same workspace is unchanged.
      assert.equal(staff!.hero, true, `${width}: staff keep the hero`);
      assert.ok(staff!.chips.some((c) => /badge-community\b/.test(c)), `${width}: staff keep the chips`);
    }
  } finally { await closeBrowser(); }
});
