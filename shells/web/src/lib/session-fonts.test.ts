// SPDX-License-Identifier: MPL-2.0
/*
 * session-fonts.ts - the font half of a `.lolly` reproducibility receipt.
 *
 * Run directly:  node --test shells/web/src/lib/session-fonts.test.ts
 *
 * jsdom gives a real DOM with a real TreeWalker and a getComputedStyle that reads back
 * inline styles, which is all the walk needs. IndexedDB and the network are absent, and
 * that is deliberate rather than a gap: it is the same shape as a device with no user
 * fonts installed, so the platform faces resolve from PLATFORM_FACES and the source bytes
 * cannot be fetched. The receipt must still name every face it found, unhashed - "I know
 * which face this was but not which copy" is a different answer from silence, and the
 * one this suite pins.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="tool-canvas"></div></body></html>');
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.NodeFilter = dom.window.NodeFilter;

const { collectSessionFonts } = await import('./session-fonts.ts');

function canvas(html: string): Element {
  const el = document.getElementById('tool-canvas')!;
  el.innerHTML = html;
  return el;
}

test('a text run reports the face it resolved to, by identity', async () => {
  const fonts = await collectSessionFonts(canvas(
    '<p style="font-family: SUSE; font-weight: 400; font-style: normal">Hamburgefonstiv</p>',
  ));
  assert.equal(fonts.length, 1);
  const [f] = fonts;
  assert.equal(f!.family.toLowerCase(), 'suse');
  assert.equal(f!.style, 'normal');
  assert.equal(f!.source, 'platform');
  assert.equal(f!.file, '/fonts/SUSE[wght].ttf');
  // No network here, so the source file could not be read. The face is still named and
  // the digest is absent rather than invented.
  assert.equal(f!.sha256, undefined);
});

test('two runs in the same face collapse to one entry - the receipt names dependencies', async () => {
  const fonts = await collectSessionFonts(canvas(
    '<p style="font-family: SUSE; font-weight: 400">First line</p>' +
    '<p style="font-family: SUSE; font-weight: 400">Second line</p>',
  ));
  assert.equal(fonts.length, 1);
});

test('a slant is its own dependency: an italic run needs the italic file', async () => {
  const fonts = await collectSessionFonts(canvas(
    '<p style="font-family: SUSE; font-weight: 400">Upright</p>' +
    '<em style="font-family: SUSE; font-weight: 400; font-style: italic">Slanted</em>',
  ));
  assert.equal(fonts.length, 2);
  const files = fonts.map(f => f.file).sort();
  assert.deepEqual(files, ['/fonts/SUSE-Italic[wght].ttf', '/fonts/SUSE[wght].ttf']);
});

test('an unresolvable family is recorded as platform with no file, never dropped', async () => {
  const fonts = await collectSessionFonts(canvas(
    '<p style="font-family: \'Nonesuch Grotesk\', serif">Whatever the machine had</p>',
  ));
  assert.equal(fonts.length, 1);
  assert.equal(fonts[0]!.family, 'Nonesuch Grotesk');
  assert.equal(fonts[0]!.source, 'platform');
  assert.equal(fonts[0]!.file, undefined);
  assert.equal(fonts[0]!.sha256, undefined);
});

test('whitespace and hidden nodes are not text runs', async () => {
  const fonts = await collectSessionFonts(canvas(
    '<p style="font-family: SUSE">   \n  </p>' +
    '<p style="display: none; font-family: SUSE">Hidden</p>',
  ));
  assert.deepEqual(fonts, []);
});

test('no canvas is an empty receipt, not a thrown share', async () => {
  assert.deepEqual(await collectSessionFonts(null), []);
  assert.deepEqual(await collectSessionFonts(undefined), []);
});
