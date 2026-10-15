// SPDX-License-Identifier: MPL-2.0
/**
 * A design system's own danger red becomes a text red per theme.
 *
 * `lolly.ui.color.status.danger` used to land inline on <html>, the same value
 * in every theme, so a red chosen against white painted straight onto the dark
 * page. It is now the SOURCE of --destructive-text: brand-vars.ts walks it per
 * theme (dangerTextCss) into a sheet of its own, and --ui-color-status-danger
 * reads that, so the inline value must never come back.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/danger-text.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
(globalThis as { Image?: unknown }).Image = undefined;

const { setChromeFollowMirror } = await import('./chrome-follow.ts');
const { applyChromeBrandVars, dangerTextCss } = await import('../brand-vars.ts');

function host(danger: string | null): Parameters<typeof applyChromeBrandVars>[0] {
  return {
    tokens: {
      resolve: async (ref: string) => (ref === '{lolly.ui.color.status.danger}' ? danger : null),
      colors: async () => [],
    },
  } as unknown as Parameters<typeof applyChromeBrandVars>[0];
}

const sheet = (): string | null => document.getElementById('brand-danger-text')?.textContent ?? null;
const inline = (): string => document.documentElement.style.getPropertyValue('--ui-color-status-danger');

test("a design system's danger red is walked per theme, never pinned inline", async () => {
  setChromeFollowMirror(true);
  await applyChromeBrandVars(host('#b00020'));
  assert.equal(sheet(), dangerTextCss('#b00020'));
  assert.match(sheet() ?? '', /\[data-theme="dark"\] \{\n {2}--destructive-text: /);
  assert.equal(inline(), '', 'no inline value to outrank the per-theme reds');
});

test('the red applies with "Interface follows the design system" off too', async () => {
  setChromeFollowMirror(false);
  await applyChromeBrandVars(host('#b00020'));
  assert.equal(sheet(), dangerTextCss('#b00020'), 'a UI token is the design system speaking, not the colour pref');
  setChromeFollowMirror(true);
});

test('no danger red removes the sheet, and Lolly\'s own text reds stand', async () => {
  await applyChromeBrandVars(host('#b00020'));
  assert.ok(sheet());
  await applyChromeBrandVars(host(null));
  assert.equal(sheet(), null);
  assert.equal(inline(), '');
});
