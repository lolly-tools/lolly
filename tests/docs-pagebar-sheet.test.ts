// SPDX-License-Identifier: MPL-2.0
/**
 * The docs page bar's sheet must not hang inside a backdrop-filtered box.
 *
 * The page bar ("Start v Glossary") opens a scrolling sheet of sections, headings and
 * pages, positioned below the bar. With `backdrop-filter` set on the bar itself, iOS
 * Safari drew the sheet but its pages did nothing when pressed (reported on
 * lolly.tools/info, 2026-11-10). The bar's blurred ground is drawn by `::before`, as
 * the site bar's is, so the bar itself sets no filter. This pins that rule in every
 * stylesheet that styles the bar: the shared docs-chrome.css, the app's docs.css and
 * the /info site stylesheet inlined in docs/build.ts.
 *
 * Run with: node --test tests/docs-pagebar-sheet.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const SHEETS = [
  'shells/web/src/styles/parts/docs-chrome.css',
  'shells/web/src/styles/parts/docs.css',
  'docs/build.ts',
];

/** Every rule as [selector, body], comments removed. Good enough for flat CSS. */
function rules(css: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push([m[1]!.trim(), m[2]!]);
  return out;
}

test('the page bar draws its blur on ::before, never on the bar that holds the sheet', () => {
  let ground = 0;
  for (const file of SHEETS) {
    for (const [selector, body] of rules(read(file))) {
      for (const part of selector.split(',').map((s) => s.trim())) {
        if (!/\.doc-pagebar(?![-\w])/.test(part)) continue;
        const onBar = /\.doc-pagebar$/.test(part) || /\.doc-pagebar:(?!:)/.test(part);
        if (onBar) assert.doesNotMatch(body, /backdrop-filter/, `${file}: "${part}" sets a backdrop filter on the bar itself`);
        if (/\.doc-pagebar::before$/.test(part) && /backdrop-filter/.test(body)) ground++;
      }
    }
  }
  assert.ok(ground >= 1, 'the bar keeps its blurred ground on ::before');
});
