// SPDX-License-Identifier: MPL-2.0
/**
 * lib/close-button.ts - the one close button. These hold the markup every call site
 * shares: the cross from the icon set, a name for assistive technology, the size and
 * tone classes, escaped attributes, and an element form that equals the markup form.
 * The last test reads the stylesheet, so the look stays in one rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

import { closeButton, closeButtonClass, closeButtonHtml } from './close-button.ts';
import { icon } from './icons.ts';

const parse = (html: string): HTMLButtonElement => {
  const dom = new JSDOM(`<body>${html}</body>`);
  return dom.window.document.body.firstElementChild as HTMLButtonElement;
};

test('the default is a button named Close that draws the icon set\'s cross', () => {
  const html = closeButtonHtml();
  const button = parse(html);
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.getAttribute('type'), 'button');
  assert.equal(button.className, 'close-btn');
  assert.equal(button.getAttribute('aria-label'), 'Close');
  assert.ok(html.endsWith(`>${icon('close')}</button>`), 'the glyph is the shared icon');
  assert.equal(button.children.length, 1);
  assert.equal(button.textContent, '', 'no text character stands in for the cross');
  assert.equal(button.querySelector('svg')?.getAttribute('aria-hidden'), 'true');
});

test('size, ground and tone are classes; the call site adds a class for position', () => {
  assert.equal(closeButtonClass({ size: 'md' }), 'close-btn');
  assert.equal(closeButtonClass({ size: 'sm' }), 'close-btn close-btn--sm');
  assert.equal(closeButtonClass({ solid: true, danger: true }), 'close-btn close-btn--solid close-btn--danger');
  assert.equal(closeButtonClass({ size: 'sm', inherit: true }), 'close-btn close-btn--sm close-btn--inherit');
  assert.equal(parse(closeButtonHtml({ size: 'sm', className: 'toast-close is-late' })).className, 'close-btn close-btn--sm toast-close is-late');
});

test('the label and every attribute value are escaped', () => {
  const button = parse(closeButtonHtml({ label: 'Remove "A & B" <b>', attrs: { 'data-row': '"><img src=x>', title: 'a\'b' } }));
  assert.equal(button.getAttribute('aria-label'), 'Remove "A & B" <b>');
  assert.equal(button.getAttribute('data-row'), '"><img src=x>');
  assert.equal(button.getAttribute('title'), 'a\'b');
  assert.equal(button.querySelector('img'), null);
  assert.equal(button.parentElement?.children.length, 1, 'nothing escapes the button');
  assert.equal(parse(closeButtonHtml({ className: '"><i>' })).parentElement?.querySelector('i'), null);
});

test('attributes: true is bare, a number is written, and false, null and undefined are left out', () => {
  const button = parse(closeButtonHtml({ attrs: { hidden: true, 'data-index': 3, disabled: false, 'data-a': null, 'data-b': undefined, 'data-close': '' } }));
  assert.equal(button.hasAttribute('hidden'), true);
  assert.equal(button.getAttribute('data-index'), '3');
  assert.equal(button.hasAttribute('disabled'), false);
  assert.equal(button.hasAttribute('data-a'), false);
  assert.equal(button.hasAttribute('data-b'), false);
  assert.equal(button.getAttribute('data-close'), '');
});

test('an attribute the component owns, or a name that is not a plain attribute name, is refused', () => {
  for (const name of ['class', 'type', 'aria-label', 'onclick=x', 'data x', 'Data-Up', '']) {
    assert.throws(() => closeButtonHtml({ attrs: { [name]: 'x' } }), /not allowed/, name);
  }
});

test('an empty label writes no name, for a button hidden from assistive technology', () => {
  const button = parse(closeButtonHtml({ label: '', attrs: { 'aria-hidden': 'true', tabindex: -1 } }));
  assert.equal(button.hasAttribute('aria-label'), false);
  assert.equal(button.getAttribute('aria-hidden'), 'true');
  assert.equal(button.getAttribute('tabindex'), '-1');
});

test('the element form is the markup form', () => {
  const dom = new JSDOM('<body></body>');
  const options = { label: 'Dismiss', size: 'sm' as const, className: 'note-close', attrs: { 'data-note-close': true } };
  const button = closeButton(options, dom.window.document);
  assert.equal(button.outerHTML, parse(closeButtonHtml(options)).outerHTML);
  assert.equal(button.ownerDocument, dom.window.document);
  assert.equal(button.parentNode, null, 'it arrives detached, ready to place');
});

test('the look is one rule in the button sheet, with a finger-sized target on touch', () => {
  const css = readFileSync(new URL('../styles/parts/buttons.css', import.meta.url), 'utf8');
  assert.equal(css.match(/^\.close-btn \{/gm)?.length, 1, 'one base rule');
  for (const part of ['.close-btn--sm', '.close-btn--solid', '.close-btn--danger', '.close-btn--inherit', '.close-btn:focus-visible', '.close-btn[hidden]']) {
    assert.ok(css.includes(part), `${part} is styled`);
  }
  const coarse = css.slice(css.indexOf('@media (pointer: coarse)', css.indexOf('.close-btn {')));
  assert.ok(coarse.includes('var(--ui-size-target)'), 'a coarse pointer gets the full target');
});
