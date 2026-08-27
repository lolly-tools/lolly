// SPDX-License-Identifier: MPL-2.0
/**
 * print-sheet tool contract tests.
 *
 * Run with: node --test tests/print-sheet-tool.test.ts
 * No test framework - node:test built-in.
 *
 * Loads the REAL tool straight from community/print-sheet and drives it through
 * the engine with a stubbed host - only the host is stubbed; the code under test
 * is the shipped manifest + hooks. Guards:
 *   - pagination: the `pages` input drives the number of [data-pdf-page] boxes,
 *   - the pages/sheets patch collision: the hook publishes its page list as the
 *     `sheets` extra, NOT `pages` (which is an input id). A returned key that
 *     matches an input id is applied as that input's VALUE by the runtime, so a
 *     regression back to `pages` would clobber the count and collapse the sheet
 *     to one page on the next render - this test re-renders and checks it holds,
 *   - the empty state shows the hint and never throws,
 *   - a hostile ?sheet= key (an Object.prototype name) degrades, never throws.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

assert.ok(existsSync(join(TOOLS_DIR, 'print-sheet', 'tool.json')),
  'community/print-sheet/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('print-sheet', fetchFile);

const pageCount = (html: string) => (html.match(/data-pdf-page/g) ?? []).length;

test('pages input drives the number of printed sheets', async () => {
  for (const [n, want] of [[1, 1], [4, 4], [20, 20]] as const) {
    const rt = await createRuntime(tool, baseHost() as any, { rows: 2, cols: 2, pages: n });
    assert.equal(pageCount(rt.getHydrated() as string), want, `pages=${n} should render ${want} sheets`);
  }
});

test('page count survives a re-render (pages/sheets patch collision guard)', async () => {
  // The hook returns its page list as `sheets`. If it ever returns `pages`, the
  // runtime applies that array as the `pages` INPUT's value; the next render then
  // parses [object] to NaN and falls back to one sheet. Drive a second render and
  // check the count holds - this is the exact regression that shipped once.
  const rt = await createRuntime(tool, baseHost() as any, { rows: 2, cols: 2, pages: 3 });
  assert.equal(pageCount(rt.getHydrated() as string), 3, 'first render');
  await rt.setInput('gap', 8 as any);   // any edit re-runs onInput
  assert.equal(pageCount(rt.getHydrated() as string), 3, 'page count must not collapse on re-render');
  // The `pages` input itself must still be the number 3, not the page array.
  const pagesVal = rt.getModel().find((i: any) => i.id === 'pages')?.value;
  assert.equal(pagesVal, 3, 'the pages input value was clobbered by the hook patch');
});

test('empty sheet shows the hint and never throws', async () => {
  const rt = await createRuntime(tool, baseHost() as any, { rows: 2, cols: 2 });
  const html = rt.getHydrated() as string;
  assert.match(html, /Drop designs/, 'empty state hint is shown');
  assert.equal(pageCount(html), 1, 'a default empty sheet is one page');
});

test('a hostile ?sheet= prototype key degrades, never throws', async () => {
  // SHEETS[v] for an Object.prototype key (constructor, toString, …) is truthy but
  // size-less; the own-key guard must fall back to A4 rather than paint a NaN sheet.
  const rt = await createRuntime(tool, baseHost() as any, { sheet: 'constructor' as any, rows: 2, cols: 2 });
  const html = rt.getHydrated() as string;
  assert.doesNotMatch(html, /NaN/, 'no NaN leaked into the sheet');
  assert.ok(pageCount(html) >= 1, 'still renders a sheet');
});
