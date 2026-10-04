// SPDX-License-Identifier: MPL-2.0
/**
 * The Node text measure (plan 291 W5) against Chromium: synthetic boxes laid out with
 * Design's own text CSS (`.lolly-box` and `.lolly-box-text` from
 * community/design/styles.css, `textCss` from the renderer) and the variable faces the
 * canvas loads, read back line by line and by `scrollHeight`.
 *
 * Breaks must agree wherever the measure does not flag the box `nearEdge`;
 * `scrollHeight` within 1 px where the breaks agree (Linux Chromium may move a pixel of
 * descent into the ascent); the clipped verdict always. The measure was built and
 * compared on macOS Chromium, so this is also the first check on Linux.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { browserInstalled, closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { measureTextNode, textMeasureSpecOfRow } from '../packages/node-shell/src/text-measure.ts';

const FONTS = new URL('../shells/web/public/fonts/', import.meta.url);
const TRAP = (JSON.parse(readFileSync(new URL('./fixtures/check/trap.boxes.json', import.meta.url), 'utf8')) as Array<Record<string, unknown>>)
  .filter((row) => row.kind === 'text');

const BOXES: Array<Record<string, unknown>> = [
  ...TRAP,
  { id: 'h1', text: 'Every quarter we measure what our customers keep using, and why they stay', fontSize: 72, weight: '500', w: 900, h: 260, lineHeight: 1.12, pad: 0, valign: 'top' },
  { id: 'h2', text: 'Short and wide', fontSize: 112, weight: '500', w: 1600, h: 120, lineHeight: 1.05, pad: 0, valign: 'top' },
  { id: 'b1', text: 'Plans change when the numbers do, so we read them every week and act on what they say.', fontSize: 28, weight: '400', w: 520, h: 140, lineHeight: 1.35, pad: 8, valign: 'middle' },
  { id: 'b2', text: 'A **bold** claim and a plain one,\nthen a second paragraph that wraps across the box.', fontSize: 32, weight: '400', w: 460, h: 200, lineHeight: 1.3, pad: 0, valign: 'top' },
  { id: 'l1', text: '- First point\n- Second point that runs long enough to wrap\n- Third', fontSize: 26, weight: '400', w: 420, h: 150, lineHeight: 1.3, pad: 8, valign: 'top' },
  { id: 'n1', text: 'Overflowingwordwithoutanyspaces', fontSize: 48, weight: '700', w: 300, h: 60, lineHeight: 1.12, pad: 8, valign: 'top' },
  // Chromium's own break rules: no break after / or inside C++, a break after the hyphens of a date.
  { id: 's1', text: 'Choose this and/or that, 24/7 support, read docs/guides/setup today', fontSize: 28, weight: '400', w: 300, h: 160, lineHeight: 1.2, pad: 8, valign: 'top' },
  { id: 's2', text: 'Mixed text with numbers 3.14159 and 2026-10-03 dates 10:30am', fontSize: 28, weight: '400', w: 320, h: 130, lineHeight: 1.2, pad: 8, valign: 'top' },
  { id: 's3', text: 'We write C++ and C# code daily for clients, see https://example.com/a/b', fontSize: 28, weight: '400', w: 200, h: 300, lineHeight: 1.2, pad: 8, valign: 'top' },
];

/** The renderer's subset for these boxes: bold and bullets (the other runs are covered by the unit tests). */
const html = (text: string): string => text.split('\n').map((line) => {
  const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const bullet = /^(\s*)[-*•]\s+(.*)$/.exec(esc);
  const body = bullet ? `${bullet[1]}•  ${bullet[2]}` : esc;
  return body.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}).join('\n');

test('the Node measure agrees with Chromium on breaks, scrollHeight and the clipped verdict', {
  skip: browserInstalled() ? false : 'No browser installed; set LOLLY_BROWSER_CHANNEL=chrome.', timeout: 60000,
}, async () => {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 2000, height: 1200 }, serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.route('https://measure.test/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/fonts/')) {
        await route.fulfill({ contentType: 'font/woff2', body: readFileSync(new URL(decodeURIComponent(url.pathname.slice('/fonts/'.length)), FONTS)) });
        return;
      }
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>
@font-face{font-family:SUSE;src:url(/fonts/SUSE%5Bwght%5D.woff2) format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:SUSE;src:url(/fonts/SUSE-Italic%5Bwght%5D.woff2) format('woff2');font-weight:100 900;font-style:italic}
body{margin:0}
.lolly-box{position:absolute;box-sizing:border-box;display:flex;overflow:hidden}
.lolly-box-text{position:relative;width:100%;margin:0;padding:8px;box-sizing:border-box;line-height:1.12;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}
.lolly-box-text strong{font-weight:bolder}
</style><body></body>`,
      });
    });
    await page.goto('https://measure.test/');
    const read = await page.evaluate(async (boxes) => {
      await document.fonts.load('400 40px SUSE');
      await document.fonts.load('500 40px SUSE');
      await document.fonts.load('700 40px SUSE');
      const out: Record<string, { lines: string[]; scrollHeight: number; clipped: boolean }> = {};
      for (const b of boxes) {
        const box = document.createElement('div');
        box.className = 'lolly-box';
        box.style.cssText = `left:0;top:0;width:${b.w}px;height:${b.h}px;justify-content:flex-start;align-items:${b.valign === 'top' ? 'flex-start' : b.valign === 'bottom' ? 'flex-end' : 'center'}`;
        const t = document.createElement('div');
        t.className = 'lolly-box-text';
        t.style.cssText = `text-align:left;font-family:SUSE;font-size:${b.size}px;font-weight:${b.weight};line-height:${b.lineHeight};padding:${b.pad}px`;
        t.innerHTML = b.html;
        box.appendChild(t);
        document.body.appendChild(box);
        await document.fonts.ready;
        const lines: Array<{ top: number; text: string }> = [];
        const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
          for (let i = 0; i < n.data.length; i++) {
            const ch = n.data[i]!;
            if (ch === '\n') { lines.push({ top: NaN, text: '' }); continue; }
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const rect = [...r.getClientRects()].pop();
            const top = rect ? Math.round(rect.top) : NaN;
            const last = lines[lines.length - 1];
            if (last && (Number.isNaN(last.top) || Math.abs(last.top - top) <= 1)) {
              if (Number.isNaN(last.top)) last.top = top;
              last.text += ch;
            } else lines.push({ top, text: ch });
          }
        }
        out[b.id] = {
          lines: lines.map((l) => l.text.replace(/\s+$/, '')).filter((l, i, all) => l || i < all.length - 1),
          scrollHeight: t.scrollHeight,
          clipped: t.scrollHeight > box.clientHeight + 0.5 || t.scrollWidth > box.clientWidth + 0.5,
        };
        box.remove();
      }
      return out;
    }, BOXES.map((b) => ({ id: String(b.id), w: Number(b.w), h: Number(b.h), valign: String(b.valign ?? 'middle'), size: Number(b.fontSize), weight: Number(b.weight), lineHeight: Number(b.lineHeight), pad: Number(b.pad), html: html(String(b.text)) })));

    let compared = 0;
    for (const b of BOXES) {
      const m = await measureTextNode(textMeasureSpecOfRow({ kind: 'text', ...b }));
      const got = read[String(b.id)]!;
      const ours = m.lines.map((l) => l.text.replace(/\s+$/, ''));
      assert.equal(m.overflow!.clipped, got.clipped, `${b.id}: clipped verdict`);
      if (m.nearEdge) continue;
      assert.deepEqual(ours, got.lines, `${b.id}: line breaks`);
      assert.ok(Math.abs(m.scrollHeight - got.scrollHeight) <= 1, `${b.id}: scrollHeight ${m.scrollHeight} vs ${got.scrollHeight}`);
      compared++;
    }
    assert.ok(compared >= BOXES.length - 3, `only ${compared} of ${BOXES.length} boxes were clear of the edge`);
  } finally {
    await context.close();
    await closeBrowser();
  }
});
