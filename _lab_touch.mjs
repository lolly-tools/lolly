// scratch: CDP touch checks for the Colour Lab. Delete when done.
import { chromium } from 'playwright';

const b = await chromium.launch();

async function open() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto('http://localhost:5174/#/lab?c=%233a81f6', { waitUntil: 'networkidle' });
  await page.waitForSelector('.lab-solid', { timeout: 15000 });
  await page.waitForTimeout(1200);
  return { ctx, page, cdp };
}

const swipe = async (cdp, x, y, dx, dy, steps = 12) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / steps, y: y + dy * i / steps }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

// ── 1. Vertical swipe on the 3D solid must SCROLL and must NOT turn it ──────
{
  const { ctx, page, cdp } = await open();
  await page.evaluate(() => document.querySelector('.lab-solid').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => { const r = document.querySelector('.lab-solid').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const before = await page.evaluate(() => ({ y: window.scrollY, note: document.querySelector('[data-lab-solid-note]').textContent }));
  await swipe(cdp, box.x, box.y, 0, -220);
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ y: window.scrollY, note: document.querySelector('[data-lab-solid-note]').textContent }));
  console.log('VERTICAL on solid: scrollY', before.y, '→', after.y, '| note', JSON.stringify(before.note), '→', JSON.stringify(after.note));
  await ctx.close();
}

// ── 2. Horizontal swipe must TURN it and must NOT scroll ───────────────────
{
  const { ctx, page, cdp } = await open();
  await page.evaluate(() => document.querySelector('.lab-solid').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => { const r = document.querySelector('.lab-solid').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const before = await page.evaluate(() => ({ y: window.scrollY, note: document.querySelector('[data-lab-solid-note]').textContent }));
  await swipe(cdp, box.x, box.y, 140, 0);
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ y: window.scrollY, note: document.querySelector('[data-lab-solid-note]').textContent }));
  console.log('HORIZONTAL on solid: scrollY', before.y, '→', after.y, '| note', JSON.stringify(before.note), '→', JSON.stringify(after.note));
  await ctx.close();
}

// ── 3. Hit-test under the sticky bar, and the tick's touch size ─────────────
{
  const { ctx, page, cdp } = await open();
  const top = await page.evaluate(() => {
    const at = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.className?.toString?.() || e.tagName) : null; };
    return { at120_28: at(120, 28), backH: Math.round(document.querySelector('.lab-back').getBoundingClientRect().height) };
  });
  // scroll so a picker control would previously have sat under the pill
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(400);
  const scrolled = await page.evaluate(() => {
    const at = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.className?.toString?.() || e.tagName) : null; };
    const back = document.querySelector('.lab-back').getBoundingClientRect();
    return { atJustBelowBar: at(120, Math.round(back.bottom) + 4), barBottom: Math.round(back.bottom), barTop: Math.round(back.top) };
  });
  const tick = await page.evaluate(() => { const e = document.querySelector('[data-lab-bounds]'); const r = e.getBoundingClientRect(); const lab = e.closest('label').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), rowH: Math.round(lab.height), cls: e.className }; });
  // the tooltip on a swatch value: tap it and see whether the bubble is opaque
  const tip = await page.evaluate(() => {
    const el = document.querySelector('[data-lab-sw-primary]');
    el.focus();
    const cs = getComputedStyle(el, '::after');
    return { tabindex: el.tabIndex, role: el.getAttribute('role'), tip: el.dataset.tip, opacity: cs.opacity, hasTitle: el.hasAttribute('title') };
  });
  console.log('STICKY BAR', JSON.stringify(top), JSON.stringify(scrolled));
  console.log('TICK', JSON.stringify(tick));
  console.log('TIP', JSON.stringify(tip));
  await ctx.close();
}

await b.close();
