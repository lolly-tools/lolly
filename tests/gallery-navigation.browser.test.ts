// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { shellSettled } from './helpers/shell-settled.ts';

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
