// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback font slots in a real Chromium (fallback-slots.ts): with the slot property unset,
 * every computed `font-family` is the string it was, for a stylesheet stack, an inline
 * stack and an SVG attribute stack; set, the fallback family follows the tool's own fonts;
 * a rule the tool wrote still wins; and no element's text or attributes change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  let chromium: any;
  try { ({ chromium } = await import('playwright')); } catch { return 'playwright not installed'; }
  try {
    const { existsSync } = await import('node:fs');
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browser = await chromiumOrSkip();
const SKIP = typeof browser === 'string' ? browser : false;

const PAGE = `<!doctype html><div id="c">
  <style>#c .a { font-family: "SUSE", system-ui, -apple-system, sans-serif } #c .won { font-family: "Brand Rule", serif }</style>
  <p class="a">rule</p>
  <p id="inline" style="color: red; font-family:'SUSE', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0">inline</p>
  <svg><text id="attr" font-family="SUSE, system-ui, sans-serif">attr</text><text id="won" class="won" font-family="SUSE, sans-serif">won</text></svg>
  <p id="var" style="font-family: var(--font-brand, sans-serif)">var</p>
</div>`;

test('slots leave every computed stack as it was until the canvas needs a fallback font', { skip: SKIP }, async () => {
  const { build } = await import('esbuild');
  const out = await build({
    stdin: { contents: `import * as m from ${JSON.stringify(`${HERE}fallback-slots.ts`)}; window.__slots = m;`, resolveDir: HERE, loader: 'ts' },
    bundle: true, write: false, format: 'iife',
  });
  const b = await (browser as { chromium: any }).chromium.launch();
  try {
    const page = await b.newPage();
    await page.setContent(PAGE);
    await page.addScriptTag({ content: out.outputFiles[0]!.text });
    const result = await page.evaluate(() => {
      const w = window as unknown as { __slots: typeof import('./fallback-slots.ts') };
      const ids = ['inline', 'attr', 'won', 'var'];
      const read = () => [getComputedStyle(document.querySelector('.a')!).fontFamily, ...ids.map((id) => getComputedStyle(document.getElementById(id)!).fontFamily)];
      const markup = document.getElementById('c')!.outerHTML;
      const before = read();
      const style = document.querySelector('style')!;
      const added = w.__slots.addFallbackSlots(style.sheet);
      const rules = w.__slots.slotRulesFor(document.getElementById('c')!, '#c');
      const head = document.createElement('style');
      head.textContent = rules.join('\n');
      document.head.append(head);
      const slotted = read();
      const sameMarkup = document.getElementById('c')!.outerHTML === markup;
      head.append(`\n#c { ${w.__slots.FALLBACK_SLOT_PROPERTY}: , "Lolly Fallback Noto Sans Arabic"; }`);
      const filled = read();
      return { before, slotted, filled, added, rules: rules.length, sameMarkup };
    });
    assert.equal(result.added, 2, 'both stylesheet stacks name a font first');
    assert.equal(result.rules, 3, 'one inline stack and two attribute stacks; on #won the tool rule still wins');
    assert.deepEqual(result.slotted, result.before, 'nothing moves while the slot is empty');
    assert.ok(result.sameMarkup, 'the canvas markup and its style text are untouched');
    const F = '"Lolly Fallback Noto Sans Arabic"';
    assert.deepEqual(result.filled, [
      `SUSE, ${F}, system-ui, -apple-system, sans-serif`,
      `SUSE, ${F}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
      `SUSE, ${F}, system-ui, sans-serif`,
      `"Brand Rule", ${F}, serif`,
      result.before[4],
    ]);
  } finally { await b.close(); }
});
