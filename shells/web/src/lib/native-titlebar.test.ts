// SPDX-License-Identifier: MPL-2.0
/**
 * native-titlebar - which presses in the macOS unified title bar move the
 * window, and the contract that keeps its stylesheet out of every other shell.
 *
 * Run with: node --test shells/web/src/lib/native-titlebar.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!doctype html><html><body>
  <div class="featured-viewport" tabindex="0"><ul class="featured-track"><li id="cover"></li></ul></div>
  <nav><a id="tab" href="#/u"><span id="tab-label">Utilities</span></a></nav>
  <div class="chrome-topleft"><button id="back"><svg id="back-icon"></svg></button></div>
  <div class="design-topbar" id="bar"><input id="name"><span id="spacer"></span></div>
  <div role="dialog" aria-modal="true" id="sheet"><p id="sheet-text">Pick a template</p></div>
  <div data-titlebar="none" id="opted-out"><span id="opted-out-child"></span></div>
</body></html>`, { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
(globalThis as { Element?: unknown }).Element = dom.window.Element;

const { isTitlebarDrag, initNativeTitlebar } = await import('./native-titlebar.ts');

/** The composed path a press on this element would report, target first. */
function pathOf(id: string): EventTarget[] {
  const out: EventTarget[] = [];
  for (let n: Node | null = document.getElementById(id); n; n = n.parentNode) out.push(n);
  out.push(window);
  return out;
}

const BAND = 50;

test('empty band moves the window, including over a scroller focusable only for the keyboard', () => {
  assert.equal(isTitlebarDrag(pathOf('spacer'), 20, BAND), true, 'the Design bar background');
  assert.equal(isTitlebarDrag(pathOf('cover'), 20, BAND), true, 'the gallery cover-flow behind the top row');
});

test('controls keep their presses: links, buttons, fields, and anything inside them', () => {
  assert.equal(isTitlebarDrag(pathOf('tab-label'), 20, BAND), false, 'the label inside a nav link');
  assert.equal(isTitlebarDrag(pathOf('back-icon'), 20, BAND), false, 'the icon inside the back button');
  assert.equal(isTitlebarDrag(pathOf('name'), 20, BAND), false, 'the document name field');
});

test('a modal owns every press inside it, and data-titlebar="none" opts a region out', () => {
  assert.equal(isTitlebarDrag(pathOf('sheet-text'), 20, BAND), false);
  assert.equal(isTitlebarDrag(pathOf('opted-out-child'), 20, BAND), false);
});

test('only the band counts', () => {
  assert.equal(isTitlebarDrag(pathOf('spacer'), BAND, BAND), false, 'the band is half-open at its bottom edge');
  assert.equal(isTitlebarDrag(pathOf('spacer'), 400, BAND), false);
  assert.equal(isTitlebarDrag(pathOf('spacer'), -1, BAND), false);
});

test('outside the macOS desktop app it installs nothing', () => {
  let added = 0;
  const original = window.addEventListener.bind(window);
  window.addEventListener = ((...args: Parameters<typeof window.addEventListener>) => { added++; original(...args); }) as typeof window.addEventListener;
  try {
    initNativeTitlebar(); // no html[data-native-titlebar]
    document.documentElement.dataset.nativeTitlebar = 'mac';
    initNativeTitlebar(); // the attribute, but no Tauri bridge (a browser tab)
  } finally {
    window.addEventListener = original;
    delete document.documentElement.dataset.nativeTitlebar;
  }
  assert.equal(added, 0);
});

test('every rule in the stylesheet is gated on the shell attribute', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(here, '..', 'styles', 'parts', 'native-titlebar.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip @media wrappers so their inner rules are checked like the rest.
  const selectors = [...css.replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .flatMap(m => (m[1] ?? '').split(','))
    .map(s => s.trim())
    .filter(Boolean);
  assert.ok(selectors.length > 4, 'the sheet has rules to check');
  for (const s of selectors) {
    assert.ok(s.startsWith('html[data-native-titlebar="mac"]'), `ungated selector: ${s}`);
  }
  const app = readFileSync(join(here, '..', 'styles', 'app.css'), 'utf8');
  assert.match(app, /@import '\.\/parts\/native-titlebar\.css';/, 'imported unlayered, so it can beat the unlayered Design bar sheet');
});
