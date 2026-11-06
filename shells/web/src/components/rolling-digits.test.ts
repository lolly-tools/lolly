// SPDX-License-Identifier: MPL-2.0
/*
 * rolling-digits.ts - the readout whose figures roll to a stepped value.
 *
 * Run directly:  node --test shells/web/src/components/rolling-digits.test.ts
 *
 * jsdom has no layout and runs no transitions, so what is pinned here is the part
 * that carries the accessibility promise and the arithmetic: the real value stays
 * the element's only text, the glyphs are hidden and textless, columns are reused
 * from the right, a digit turns over 9 to 0 in the direction the number moved, and
 * reduced motion or a fast run of values never rolls. Motion itself is looked at in
 * a real browser (plans evidence), not asserted here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.document = dom.window.document;
g.window = dom.window;
let reduce = false;
g.matchMedia = (q: string) => ({ matches: reduce && q.includes('reduce'), addEventListener() {}, removeEventListener() {} });

const { mountRollingDigits, nextPosition, readoutNumber, ROLL_QUIET_MS } = await import('./rolling-digits.ts');

const host = (text: string): HTMLElement => {
  const el = dom.window.document.createElement('span');
  el.textContent = text;
  dom.window.document.body.append(el);
  return el;
};
const positions = (el: HTMLElement): string[] =>
  [...el.querySelectorAll<HTMLElement>('.rd-roll > *')].map(c => (c.classList.contains('rd-col') ? c.style.getPropertyValue('--rd-pos') : `"${c.dataset.ch}"`));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

test('readoutNumber reads the figure a readout shows', () => {
  assert.equal(readoutNumber('125%'), 125);
  assert.equal(readoutNumber('1,250%'), 1250);
  assert.equal(readoutNumber('1920 x 1080 px'), 1920);
  assert.equal(readoutNumber('−12.5'), -12.5);
  assert.ok(Number.isNaN(readoutNumber('Fit')));
});

test('nextPosition turns a digit over the top going up and back under going down', () => {
  assert.equal(nextPosition(19, 9, 0, 1), 20, '9 to 0 upward moves one cell on, into the next set');
  assert.equal(nextPosition(10, 0, 9, -1), 9, '0 to 9 downward moves one cell back');
  assert.equal(nextPosition(13, 3, 7, 1), 17);
  assert.equal(nextPosition(17, 7, 3, -1), 13);
  assert.equal(nextPosition(12, 2, 9, 0), 9, 'no direction takes the shorter way round');
  assert.equal(nextPosition(15, 5, 5, 1), 15);
});

test('the value stays the only text; the glyphs are hidden and carry none', () => {
  const el = host('100%');
  const roll = mountRollingDigits(el);
  assert.equal(el.textContent, '100%');
  assert.equal(roll.text, '100%');
  const real = el.querySelector('.rd-text')!;
  assert.ok(real.classList.contains('visually-hidden'));
  const glyphs = el.querySelector('.rd-roll')!;
  assert.equal(glyphs.getAttribute('aria-hidden'), 'true');
  assert.equal(glyphs.textContent, '', 'a glyph column draws from CSS content, so a reader or a copy finds no second value');
  assert.deepEqual(positions(el), ['11', '10', '10', '"%"']);
});

test('a step rolls the digits that changed, matched from the right', async () => {
  const el = host('80%');
  const roll = mountRollingDigits(el);
  await wait(ROLL_QUIET_MS + 10);
  const cols = [...el.querySelectorAll('.rd-roll > *')];
  roll.set('100%');
  assert.equal(el.textContent, '100%');
  const after = [...el.querySelectorAll('.rd-roll > *')];
  assert.equal(after[1], cols[0], 'the tens column is the one that showed 8');
  assert.equal(after[3], cols[2], 'the sign is kept');
  // 8 to 0 going up turns over the top (18 to 20); the units stay; the hundreds is new.
  assert.deepEqual(positions(el), ['11', '20', '10', '"%"']);
  assert.ok(!after[1]!.classList.contains('rd-col--instant'), 'a step animates');
});

test('a fast run of values and reduced motion are set, never rolled', async () => {
  const el = host('50%');
  const roll = mountRollingDigits(el);
  await wait(ROLL_QUIET_MS + 10);
  roll.set('51%');
  roll.set('52%'); // the next frame of a pinch
  assert.ok(el.querySelector('.rd-col:last-of-type')?.classList.contains('rd-col--instant') ||
    [...el.querySelectorAll('.rd-col')].every(c => c.classList.contains('rd-col--instant')));
  assert.deepEqual(positions(el), ['15', '12', '"%"']);
  reduce = true;
  try {
    await wait(ROLL_QUIET_MS + 10);
    roll.set('49%');
    assert.ok([...el.querySelectorAll('.rd-col')].every(c => c.classList.contains('rd-col--instant')));
    assert.deepEqual(positions(el), ['14', '19', '"%"']);
  } finally { reduce = false; }
});

