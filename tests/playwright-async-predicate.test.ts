// SPDX-License-Identifier: MPL-2.0
/**
 * No test or script hands an async function to Playwright's `waitForFunction`.
 *
 * Playwright polls that predicate and stops at the first truthy return. An async
 * function returns a promise, and a promise is truthy, so the wait ends after one call
 * whatever the promise resolves to: it checks once and moves on. That is how the Brand
 * Studio journal test reloaded before the edit it waited for was written, and failed now
 * and then on CI with the shades in their old order. `tests/helpers/page-poll.ts`
 * (`pollPage`) asks the page again until the answer is truthy.
 */
import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const SCAN = ['tests', 'scripts', 'shells', 'services', 'packages', 'engine', 'docs'];
const SKIP = new Set(['node_modules', 'dist', '.vite', 'target', 'public', '.browsers']);
// `waitForFunction(` then, past any whitespace, the `async` keyword.
const ASYNC_PREDICATE = /waitForFunction\(\s*async\b/g;

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith('.')) continue;
    const path = join(dir, name);
    const info = lstatSync(path);
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) yield* sources(path);
    else if (/\.(?:[cm]?[jt]s|tsx)$/.test(name)) yield path;
  }
}

test('no async predicate is passed to waitForFunction', () => {
  const found: string[] = [];
  for (const top of SCAN) {
    for (const file of sources(join(ROOT, top))) {
      if (file === SELF) continue;   // its own examples below
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(ASYNC_PREDICATE)) {
        const line = text.slice(0, match.index).split('\n').length;
        found.push(`${relative(ROOT, file)}:${line}`);
      }
    }
  }
  assert.deepEqual(found, [], 'an async predicate ends the wait after one call; use pollPage from tests/helpers/page-poll.ts');
});

test('the pattern finds the forms it is meant to find', () => {
  const hits = (text: string) => [...text.matchAll(ASYNC_PREDICATE)].length;
  assert.equal(hits('await page.waitForFunction(async () => ready());'), 1);
  assert.equal(hits('await page.waitForFunction(\n  async ({ slot }) => !!slot, arg);'), 1);
  assert.equal(hits('await frame.waitForFunction(async function () { return true; });'), 1);
  assert.equal(hits('await page.waitForFunction(() => window.ready === true);'), 0);
  assert.equal(hits('await page.waitForFunction((n) => count() > n, 3);'), 0);
});
