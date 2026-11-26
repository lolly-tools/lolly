// SPDX-License-Identifier: MPL-2.0
/**
 * The palette preview scenes in a real Chromium, in a right-to-left page.
 *
 * Each scene (Poster, Chart, UI card) is laid out left to right at fixed x
 * positions, and the Colours room, the looks and the component gallery inline it
 * into the page. SVG text inherits the page's `direction`, so in Arabic, Urdu or
 * any right-to-left locale `text-anchor` start meant the right end of each line:
 * the poster's headline ran off its left edge and the numbers in its top corner
 * read backwards. This suite renders every scene in an `rtl` page and an `ltr`
 * page and checks that each text run is drawn in the same place, inside the
 * artwork.
 *
 * Self-skips by name where Playwright's Chromium is not installed (`pnpm exec
 * playwright install chromium`); a green run without it means "not exercised".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import type { BrowserType } from 'playwright';
import { palettePreviewSvgs } from './palette-preview.ts';

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();

const PALETTE = ['#1d1d1d', '#525252', '#6f6f6f', '#999999', '#efefef'];

interface TextBox { text: string; left: number; right: number; top: number }

test('the preview scenes keep their left-to-right layout in a right-to-left page',
  { skip: typeof browserOrReason === 'string' ? browserOrReason : false }, async () => {
  const { chromium } = browserOrReason as { chromium: BrowserType };
  const scenes = palettePreviewSvgs(PALETTE);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 500 } });
    const measure = async (dir: 'ltr' | 'rtl', svg: string): Promise<{ width: number; boxes: TextBox[] }> => {
      await page.setContent(`<!doctype html><html dir="${dir}"><body style="margin:0"><div style="width:480px">${svg}</div></body></html>`);
      return page.evaluate(() => {
        const root = document.querySelector('svg')!;
        const frame = root.getBoundingClientRect();
        const boxes = [...root.querySelectorAll('text')].map((el) => {
          const r = el.getBoundingClientRect();
          return { text: el.textContent ?? '', left: r.left - frame.left, right: r.right - frame.left, top: r.top - frame.top };
        });
        return { width: frame.width, boxes };
      });
    };
    for (const scene of scenes) {
      const ltr = await measure('ltr', scene.svg);
      const rtl = await measure('rtl', scene.svg);
      assert.ok(ltr.boxes.length > 0, `${scene.label}: the scene has text`);
      assert.equal(rtl.boxes.length, ltr.boxes.length, `${scene.label}: same text runs in both directions`);
      rtl.boxes.forEach((box, i) => {
        const want = ltr.boxes[i]!;
        assert.equal(box.text, want.text, `${scene.label}: run ${i} keeps its text`);
        assert.ok(Math.abs(box.left - want.left) < 0.5 && Math.abs(box.right - want.right) < 0.5,
          `${scene.label}: "${box.text}" sits at ${box.left.toFixed(1)}-${box.right.toFixed(1)} in rtl, ${want.left.toFixed(1)}-${want.right.toFixed(1)} in ltr`);
        assert.ok(box.left >= -0.5 && box.right <= rtl.width + 0.5,
          `${scene.label}: "${box.text}" stays inside the ${rtl.width}px artwork (${box.left.toFixed(1)}-${box.right.toFixed(1)})`);
      });
    }
  } finally {
    await browser.close();
  }
});
