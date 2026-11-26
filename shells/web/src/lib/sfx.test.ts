// SPDX-License-Identifier: MPL-2.0
/**
 * Which interface cue a click makes, and the sound shape preference.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/sfx.test.ts
 *
 * What is pinned:
 *  - a control's own `data-sfx` always wins;
 *  - a switch steps up as it turns on and down as it turns off: a role="switch" button
 *    is read before its handler flips it, a checkbox after the browser has;
 *  - a <details> summary and an aria-expanded button expand and collapse;
 *  - the sound shape is clamped to 0..1, mirrored to localStorage, adopted from the
 *    profile at boot, and a corrupt value is ignored.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
for (const k of ['HTMLElement', 'HTMLInputElement', 'HTMLLabelElement', 'HTMLDetailsElement', 'Element'] as const) {
  (globalThis as Record<string, unknown>)[k] = dom.window[k];
}

const { cueForTarget, getSfxShape, setSfxShape, hydrateSfxShape, SFX_SHAPE_DEFAULT } = await import('./sfx.ts');

const html = (markup: string): HTMLElement => {
  document.body.innerHTML = markup;
  return document.body.querySelector<HTMLElement>('[data-t]')!;
};

test('a control with data-sfx makes its own cue', () => {
  assert.equal(cueForTarget(html('<button data-t data-sfx="whoosh" aria-expanded="false">x</button>')), 'whoosh');
  assert.equal(cueForTarget(html('<button data-t data-sfx="notACue">x</button>')), 'click', 'an unknown name falls back');
});

test('a switch steps up turning on and down turning off', () => {
  assert.equal(cueForTarget(html('<button data-t role="switch" aria-checked="false"></button>')), 'switchOn');
  assert.equal(cueForTarget(html('<button data-t role="switch" aria-checked="true"></button>')), 'switchOff');
  const box = html('<input data-t type="checkbox">') as HTMLInputElement;
  box.checked = true;    // what the click event sees: the browser flips it before dispatch
  assert.equal(cueForTarget(box), 'switchOn');
  box.checked = false;
  assert.equal(cueForTarget(box), 'switchOff');
});

test('a section opening and closing', () => {
  assert.equal(cueForTarget(html('<details><summary data-t>More</summary>body</details>')), 'expand');
  assert.equal(cueForTarget(html('<details open><summary data-t>More</summary>body</details>')), 'collapse');
  assert.equal(cueForTarget(html('<button data-t aria-expanded="false">Menu</button>')), 'expand');
  assert.equal(cueForTarget(html('<button data-t aria-expanded="true">Menu</button>')), 'collapse');
  assert.equal(cueForTarget(html('<button data-t>Go</button>')), 'click');
});

test('the sound shape: clamped, mirrored, adopted from the profile', () => {
  assert.equal(getSfxShape(), SFX_SHAPE_DEFAULT, 'no stored preference plays the chimes');
  setSfxShape(1.7);
  assert.equal(getSfxShape(), 1);
  assert.equal(localStorage.getItem('lolly:sfxShape'), '1');
  setSfxShape(Number.NaN);
  assert.equal(getSfxShape(), 1, 'a corrupt value is ignored');
  hydrateSfxShape(0.25);
  assert.equal(getSfxShape(), 0.25);
  hydrateSfxShape(undefined);
  assert.equal(getSfxShape(), 0.25, 'a profile with no shape keeps the local one');
});
