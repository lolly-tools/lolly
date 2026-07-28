// scratch: Colour Lab layout audit shots. Delete when done.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'before';
const DIR = `/tmp/lab-${OUT}`;
fs.mkdirSync(DIR, { recursive: true });

const WIDTHS = [320, 390, 660, 840, 1440];
const b = await chromium.launch();
const report = {};

for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5174/#/lab?c=oklch(62%25%200.19%20260)', { waitUntil: 'networkidle' });
  await page.waitForSelector('.lab-charts', { timeout: 15000 });
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; };
    const plots = [...document.querySelectorAll('[data-okls-plot]')].map(e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
    // body horizontal overflow
    const de = document.documentElement;
    const hOverflow = de.scrollWidth - de.clientWidth;
    // the notation table's copy column position
    const copy = q('.lab-notations .lab-copy');
    const copyR = copy ? copy.getBoundingClientRect() : null;
    // hit test over the back pill area
    const at = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.className?.toString?.() || e.tagName) : null; };
    // hidden card occupying a row?
    const press = q('.lab-press');
    const pressBox = press ? press.getBoundingClientRect() : null;
    return {
      hOverflow,
      scrollWidth: de.scrollWidth, clientWidth: de.clientWidth,
      plots,
      solid: box('.lab-solid'),
      charts: box('.lab-charts'),
      blendTo: box('.lab-blend-to'),
      blendPicker: box('.lab-blend-picker'),
      blendRamp: box('[data-lab-blend]'),
      copyCol: copyR ? { x: Math.round(copyR.x), right: Math.round(copyR.right) } : null,
      hitAt120_28: at(120, 28),
      pressHidden: press?.hidden, pressBox: pressBox ? { w: Math.round(pressBox.width), h: Math.round(pressBox.height) } : null,
      boundsBox: (() => { const e = q('[data-lab-bounds]'); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), cls: e.className }; })(),
      solidTouchAction: q('.lab-solid') ? getComputedStyle(q('.lab-solid')).touchAction : null,
      altWhiteSpace: q('.lab-sw-alt') ? getComputedStyle(q('.lab-sw-alt')).whiteSpace : null,
    };
  });
  report[w] = m;

  await page.screenshot({ path: `${DIR}/${w}-full.png`, fullPage: true });
  // step 4 region
  const blend = await page.$('.lab-blend-to');
  if (blend) {
    await blend.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/${w}-step4.png` });
  }
  const charts = await page.$('.lab-charts');
  if (charts) { await charts.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: `${DIR}/${w}-charts.png` }); }
  const nota = await page.$('.lab-notations');
  if (nota) { await nota.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await page.screenshot({ path: `${DIR}/${w}-notations.png` }); }
  await ctx.close();
}
await b.close();
fs.writeFileSync(`${DIR}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
