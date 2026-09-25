// SPDX-License-Identifier: MPL-2.0
/**
 * lib/section-bands.ts over schemas/section-vocabulary.json: which band a section
 * name is in, the order a column of sections is drawn in, and the one case where a
 * band is drawn with a band head instead of a label (`isBandHead`).
 *
 * The Rebrand decision column is the reason the last two exist: its sections are
 * Objects, Decision, Colours, Fonts, Background and Layout, with Position as a row of
 * Layout rather than a section, so its ladder is Content, Style, Layout and nothing
 * else, and Layout is a band holding only itself.
 *
 * The band head's own look is probed in a real Chromium over panel.css: the caret
 * stands on the same x as a section head's caret, the rule is drawn, the flag is a
 * word rather than a pill, and a shut band turns its caret the way a shut section
 * does. It skips by name where Playwright's Chromium is not installed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import type { BrowserType } from 'playwright';

import { bandMeta, isBandHead, orderSections, resolveBands, sectionGlyph } from './section-bands.ts';

test('the decision column names are in the vocabulary, in the bands the spec gives them', () => {
  const bands = resolveBands(['Objects', 'Decision', 'Colours', 'Fonts', 'Background', 'Layout', 'Position']);
  assert.deepEqual(Object.fromEntries(bands), {
    Objects: 'content', Decision: 'content',
    Colours: 'style', Fonts: 'style', Background: 'style',
    Layout: 'layout', Position: 'layout',
  });
  assert.equal(sectionGlyph('Objects'), 'layers');
  assert.equal(sectionGlyph('Decision'), 'layers');
  assert.equal(sectionGlyph('Colours'), 'palette');
  assert.equal(sectionGlyph('Fonts'), 'font');
  assert.equal(sectionGlyph('Background'), 'image', 'Background keeps its picture, not the palette');
});

test('the names are known on their own, not only by inheriting from the section before', () => {
  // Each name first, where an unknown name would fall to Content.
  assert.equal(resolveBands(['Colours']).get('Colours'), 'style');
  assert.equal(resolveBands(['Fonts']).get('Fonts'), 'style');
  // And after a Style section, where an unknown name would stay in Style.
  assert.equal(resolveBands(['Colour', 'Objects']).get('Objects'), 'content');
  assert.equal(resolveBands(['Colour', 'Decision']).get('Decision'), 'content');
  // Case and spacing are not the author's contract.
  assert.equal(resolveBands([' colours ']).get(' colours '), 'style');
});

test('a column declared in another order is drawn Content, Style, Layout', () => {
  assert.deepEqual(
    orderSections(['Layout', 'Background', 'Fonts', 'Colours', 'Objects', 'Decision']),
    ['Objects', 'Decision', 'Background', 'Fonts', 'Colours', 'Layout'],
    'band order first, the declared order inside a band after',
  );
});

test('isBandHead: a band of one section with the band\'s own name, and never otherwise', () => {
  assert.equal(bandMeta('layout').title, 'Layout');
  assert.equal(isBandHead('layout', ['Layout']), true);
  assert.equal(isBandHead('layout', ['layout']), true, 'the word, not its case');
  assert.equal(isBandHead('style', ['Style']), true);
  // Two sections: the label stays and each section keeps its head.
  assert.equal(isBandHead('layout', ['Layout', 'Position']), false);
  assert.equal(isBandHead('layout', ['Position', 'Layout']), false);
  // One section with another name: still a label over a head.
  assert.equal(isBandHead('layout', ['Position']), false);
  assert.equal(isBandHead('style', ['Colours']), false);
  assert.equal(isBandHead('content', ['Objects']), false);
  // A band's name under another band is not that band's head.
  assert.equal(isBandHead('style', ['Layout']), false);
  // Nothing in the band: nothing to be the head of.
  assert.equal(isBandHead('layout', []), false);
});

// ─── the band head's look, in Chromium ───────────────────────────────────────

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

interface HeadProbe {
  display: string;
  secCaretRight: number;
  headCaretRight: number;
  headCaretRightNoFlag: number;
  ruleHeight: string;
  ruleColour: string;
  flagBackground: string;
  flagTransform: string;
  headTransform: string;
  shutCaret: string;
  secShutCaret: string;
  height: number;
}

test('the band head draws as the band rule with the caret on the section carets\' x', {
  skip: typeof browserOrReason === 'string' ? browserOrReason : false,
}, async () => {
  if (typeof browserOrReason === 'string') return;
  const css = ['../styles/tokens.css', '../styles/parts/panel.css']
    .map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')).join('\n');
  const browser = await browserOrReason.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
    await page.setContent(`<!doctype html><html data-theme="light"><head><style>:root { --a11y-fs: 1; }\n${css}</style></head><body style="margin:0">
      <aside class="lp" style="width: 320px"><div class="lp-scroll">
        <div class="lp-band"><p class="lp-band-label">Style</p>
          <section class="lp-sec"><button type="button" class="lp-sec-head" aria-expanded="false"><svg></svg><span class="lp-sec-name">Colours</span><em class="lp-sec-flag">18 to check</em><i class="lp-caret" aria-hidden="true"></i></button></section>
        </div>
        <div class="lp-band" id="one">
          <button type="button" class="lp-band-head" aria-expanded="true"><span class="lp-band-name">Layout</span><em class="lp-sec-flag">Suggested</em><i class="lp-caret" aria-hidden="true"></i></button>
          <div class="lp-rows"><p>tile</p></div>
        </div>
        <div class="lp-band" id="two">
          <button type="button" class="lp-band-head" aria-expanded="false"><span class="lp-band-name">Layout</span><i class="lp-caret" aria-hidden="true"></i></button>
        </div>
      </div></aside></body></html>`);
    const probe = await page.evaluate((): HeadProbe => {
      const head = document.querySelector<HTMLElement>('#one .lp-band-head')!;
      const bare = document.querySelector<HTMLElement>('#two .lp-band-head')!;
      const right = (el: Element): number => Math.round(el.getBoundingClientRect().right);
      const rule = getComputedStyle(head, '::after');
      const flag = getComputedStyle(head.querySelector('.lp-sec-flag')!);
      const caretTurn = (el: Element): string => getComputedStyle(el.querySelector('.lp-caret')!, '::before').transform;
      return {
        display: getComputedStyle(head).display,
        secCaretRight: right(document.querySelector('.lp-sec-head .lp-caret')!),
        headCaretRight: right(head.querySelector('.lp-caret')!),
        headCaretRightNoFlag: right(bare.querySelector('.lp-caret')!),
        ruleHeight: rule.height,
        ruleColour: rule.backgroundColor,
        flagBackground: flag.backgroundColor,
        flagTransform: flag.textTransform,
        headTransform: getComputedStyle(head).textTransform,
        shutCaret: caretTurn(bare),
        secShutCaret: caretTurn(document.querySelector('.lp-sec-head')!),
        height: head.getBoundingClientRect().height,
      };
    });
    assert.equal(probe.display, 'grid');
    assert.equal(probe.headCaretRight, probe.secCaretRight, 'the band caret stands on the section carets\' x');
    assert.equal(probe.headCaretRightNoFlag, probe.secCaretRight, 'with or without a flag');
    assert.equal(probe.ruleHeight, '1px', 'the rule is drawn');
    assert.notEqual(probe.ruleColour, 'rgba(0, 0, 0, 0)');
    assert.equal(probe.flagBackground, 'rgba(0, 0, 0, 0)', 'the flag is a word beside the rule, not a pill');
    assert.equal(probe.flagTransform, 'none', 'in sentence case');
    assert.equal(probe.headTransform, 'uppercase', 'the band word keeps the band type');
    assert.equal(probe.shutCaret, probe.secShutCaret, 'a shut band turns its caret like a shut section');
    assert.ok(probe.height >= 24, `a target of at least 24px (${probe.height})`);
  } finally {
    await browser.close();
  }
});
