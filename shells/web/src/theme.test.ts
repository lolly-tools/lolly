// SPDX-License-Identifier: MPL-2.0
/**
 * `?theme=` - the session-only URL override (urlThemeOverride).
 *
 * Run directly:  node --test shells/web/src/theme.test.ts
 *
 * The case this file exists for is the COLLISION. `theme` is not an engine-reserved
 * param: it is a declared input id in a dozen shipping tools (quotes, snippet,
 * street-map, deck-builder, …), where `?theme=dark` has always meant "draw the artwork
 * dark". So the override must read on the app's own views and stay silent on every tool
 * address, or every share link ever generated for those tools quietly changes meaning.
 * The rest is validation and the two places the param can ride.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { urlThemeOverride } = await import('./theme.ts');

/** Point the jsdom window at one address. */
function at(url: string): void {
  dom.reconfigure({ url: `https://lolly.tools${url}` });
}

test('reads a valid theme off the hash query and off ?search', () => {
  at('/#/c?theme=dark');
  assert.equal(urlThemeOverride(), 'dark');
  at('/?theme=light');
  assert.equal(urlThemeOverride(), 'light');
  at('/#/p?theme=brand');
  assert.equal(urlThemeOverride(), 'brand');
});

test('absent, empty or unrecognised values are ignored', () => {
  at('/#/c');
  assert.equal(urlThemeOverride(), null);
  at('/#/c?theme=');
  assert.equal(urlThemeOverride(), null);
  at('/#/c?theme=neon');
  assert.equal(urlThemeOverride(), null);
  // A Set, not an object lookup - an inherited key is not a theme.
  at('/#/c?theme=constructor');
  assert.equal(urlThemeOverride(), null);
});

test('never honoured on a tool address - there ?theme= is the tool\'s own input', () => {
  at('/#/tool/quotes?theme=dark');
  assert.equal(urlThemeOverride(), null);
  at('/t/quotes?theme=dark');
  assert.equal(urlThemeOverride(), null);
  at('/design?theme=dark');
  assert.equal(urlThemeOverride(), null);
});

test('a view whose path merely starts with the tool letters still reads it', () => {
  at('/#/table?theme=dark');           // not /t/…
  assert.equal(urlThemeOverride(), 'dark');
  at('/#/data?theme=dark');
  assert.equal(urlThemeOverride(), 'dark');
});
