// SPDX-License-Identifier: MPL-2.0
/**
 * The compact numeric control - components/num-field.ts.
 *
 * What is worth pinning is the promise the Design inspector makes on top of it:
 * ONE commit per gesture, because one commit is one undo step. A scrub across
 * sixty pixels, a burst of arrow keys, a typed expression - each is one write,
 * and a value that has not actually changed is no write at all.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/num-field.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  dom.window.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame;

const { numField, parseNumExpr, KEY_COALESCE_MS } = await import('./num-field.ts');
type Field = ReturnType<typeof numField>;

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Rig {
  f: Field;
  input: HTMLInputElement;
  lbl: HTMLElement;
  commits: number[];
  previews: number[];
  drag(dx: number, mods?: Record<string, unknown>): void;
  /** One step of a drag, for a gesture a test wants to stop in the middle of. */
  press(x: number): void;
  move(x: number): void;
  release(x: number): void;
  key(k: string, mods?: Record<string, unknown>): void;
  type(text: string): void;
}

function rig(opts: Partial<Parameters<typeof numField>[0]> = {}): Rig {
  document.body.innerHTML = '';
  const commits: number[] = [];
  const previews: number[] = [];
  const f = numField({
    id: 'x', label: 'X', value: 100,
    onCommit: (v) => commits.push(v),
    onPreview: (v) => previews.push(v),
    ...opts,
  });
  document.body.appendChild(f.el);
  const input = f.el.querySelector<HTMLInputElement>('.num-field-in')!;
  const lbl = f.el.querySelector<HTMLElement>('.num-field-lbl')!;

  const pointer = (type: string, x: number, mods: Record<string, unknown> = {}): void => {
    const e = new dom.window.Event(type, { bubbles: true }) as unknown as Record<string, unknown>;
    Object.assign(e, { clientX: x, clientY: 0, button: 0, pointerId: 1, pointerType: 'mouse', ...mods });
    (e as unknown as { preventDefault(): void }).preventDefault = () => {};
    lbl.dispatchEvent(e as unknown as Event);
  };
  return {
    f, input, lbl, commits, previews,
    drag(dx, mods = {}) {
      pointer('pointerdown', 0, mods);
      pointer('pointermove', dx / 2, mods);
      pointer('pointermove', dx, mods);
      pointer('pointerup', dx, mods);
    },
    press(x) { pointer('pointerdown', x); },
    move(x) { pointer('pointermove', x); },
    release(x) { pointer('pointerup', x); },
    key(k, mods = {}) {
      input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
    },
    type(text) {
      input.value = text;
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    },
  };
}

// ── the control itself ────────────────────────────────────────────────────────

test('it renders a labelled cell whose input carries a name and the value', () => {
  const r = rig({ unit: 'px', name: 'X position' });
  assert.equal(r.lbl.textContent, 'X');
  assert.equal(r.lbl.getAttribute('aria-hidden'), 'true', 'the handle is not read out twice');
  assert.equal(r.input.value, '100');
  assert.equal(r.input.getAttribute('aria-label'), 'X position');
  assert.equal(r.f.el.querySelector('.num-field-unit')!.textContent, 'px');
  r.f.destroy();
});

// ── scrub ─────────────────────────────────────────────────────────────────────

test('dragging the label scrubs one step per pixel and commits ONCE, on release', () => {
  const r = rig();
  r.drag(40);
  assert.equal(r.input.value, '140');
  assert.deepEqual(r.commits, [140], 'one commit, one undo step');
  assert.deepEqual(r.previews, [120, 140], 'and a preview per move for whatever mirrors it');
  r.f.destroy();
});

test('Shift scrubs by ten and Alt by a tenth', () => {
  const coarse = rig();
  coarse.drag(4, { shiftKey: true });
  assert.deepEqual(coarse.commits, [140]);
  coarse.f.destroy();

  const fine = rig({ step: 1, precision: 1 });
  fine.drag(40, { altKey: true });
  assert.deepEqual(fine.commits, [104], 'a tenth of a step per pixel');
  fine.f.destroy();
});

test('a scrub that ends where it started commits nothing, and a click focuses the field instead', () => {
  const r = rig();
  r.drag(0);
  assert.deepEqual(r.commits, [], 'a press with no travel is a click, not a gesture');
  assert.equal(document.activeElement, r.input, 'and it puts the caret in the number for typing');

  r.drag(30);
  r.commits.length = 0;
  r.drag(-30);            // straight back to 100 from the new base of 130
  assert.deepEqual(r.commits, [100]);
  r.commits.length = 0;
  r.drag(0.4);            // under the slop: never a drag at all
  assert.deepEqual(r.commits, []);
  r.f.destroy();
});

test('a scrub honours min, max and the step precision', () => {
  const r = rig({ value: 5, min: 0, max: 100 });
  r.drag(-400);
  assert.equal(r.input.value, '0');
  assert.deepEqual(r.commits, [0], 'clamped, and still one commit');
  r.commits.length = 0;
  r.drag(4000);
  assert.deepEqual(r.commits, [100]);
  r.f.destroy();

  const lh = rig({ value: 1.12, step: 0.01, min: 0.7, max: 3 });
  lh.drag(8);
  assert.equal(lh.input.value, '1.2', 'two decimals of step, printed without float dust');
  assert.deepEqual(lh.commits, [1.2]);
  lh.f.destroy();
});

// ── arrow keys ────────────────────────────────────────────────────────────────

test('ArrowUp/Down step, with the same modifiers, and a burst is ONE commit', async () => {
  const r = rig();
  r.key('ArrowUp');
  r.key('ArrowUp');
  r.key('ArrowUp', { shiftKey: true });
  assert.equal(r.input.value, '112', 'the field keeps up with every keystroke');
  assert.deepEqual(r.commits, [], 'but the model has not heard a word yet');
  assert.deepEqual(r.previews, [101, 102, 112]);
  await wait(KEY_COALESCE_MS + 40);
  assert.deepEqual(r.commits, [112], 'the burst commits once, as one gesture');

  // Alt asks for a tenth of a step, and the field's own precision decides whether
  // there is such a thing: a whole-pixel field rounds it away and stays put rather
  // than committing 111.9 to a control that can only show 112.
  r.key('ArrowDown', { altKey: true });
  assert.equal(r.input.value, '112');
  await wait(KEY_COALESCE_MS + 40);
  assert.deepEqual(r.commits, [112], 'no second write for a step the field cannot hold');
  r.f.destroy();

  // A field that asked for a third decimal can hold the fine step, and does.
  const fine = rig({ value: 1.12, step: 0.01, precision: 3, min: 0.7, max: 3 });
  fine.key('ArrowDown', { altKey: true });
  assert.equal(fine.input.value, '1.119');
  await wait(KEY_COALESCE_MS + 40);
  assert.deepEqual(fine.commits, [1.119]);
  fine.f.destroy();
});

test('Escape reverts an arrow burst that has not committed yet, and stops there', async () => {
  const r = rig();
  r.key('ArrowUp');
  r.key('ArrowUp');
  assert.equal(r.input.value, '102');
  const esc = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  let sawIt = false;
  document.body.addEventListener('keydown', () => { sawIt = true; });
  r.input.dispatchEvent(esc);
  assert.equal(r.input.value, '100', 'back to the last value the model gave it');
  assert.equal(sawIt, false, 'and the editor never saw the Escape');
  await wait(KEY_COALESCE_MS + 40);
  assert.deepEqual(r.commits, [], 'the pending commit went with it');
  r.f.destroy();
});

test('blur flushes a pending burst rather than losing it', async () => {
  const r = rig();
  r.key('ArrowUp');
  r.input.dispatchEvent(new dom.window.Event('blur', { bubbles: false }));
  assert.deepEqual(r.commits, [101], 'committed on the way out, not 300ms later');
  await wait(KEY_COALESCE_MS + 40);
  assert.deepEqual(r.commits, [101], 'and not twice');
  r.f.destroy();
});

// ── typed expressions ─────────────────────────────────────────────────────────

test('every expression form is read against the current value', () => {
  assert.equal(parseNumExpr('250', 100), 250, 'a plain number is itself');
  assert.equal(parseNumExpr('+10', 100), 110, 'a leading sign is relative');
  assert.equal(parseNumExpr('-5', 100), 95);
  assert.equal(parseNumExpr('50%', 100), 50, 'a percentage is a share of what is there');
  assert.equal(parseNumExpr('150%', 60), 90);
  assert.equal(parseNumExpr('1920/2', 0), 960);
  assert.equal(parseNumExpr('3*4', 0), 12);
  assert.equal(parseNumExpr('(2+3)*4', 0), 20);
  assert.equal(parseNumExpr('120px', 0), 120, 'a unit suffix is ignored');
  assert.equal(parseNumExpr('400 ms', 0), 400);
  assert.equal(parseNumExpr('(-5)', 100), -5, 'the way to type an absolute negative');
  assert.equal(parseNumExpr('0-30', 100), -30, 'and the other way');
  assert.equal(parseNumExpr('1.5', 0), 1.5);
  // Nothing that is not arithmetic gets through, and nothing throws.
  for (const junk of ['', '   ', 'hello', '3+', '*4', '(1+2', '5/0', '1..2']) {
    assert.equal(parseNumExpr(junk, 100), null, `"${junk}" is not a number`);
  }
});

test('a character the grammar cannot read reverts, rather than being deleted so the rest parses', () => {
  // Every one of these used to come back as a number, because the parser stripped each
  // unreadable character wherever it sat and then read what was left: '12,5' became 125,
  // '1e3' became 13 and 'alert(1)' became 1. The junk guard never saw them.
  for (const [text, why] of [
    ['12,5%', 'a comma inside a percentage'],
    ['1e3', 'exponent notation is not this grammar'],
    ['1.2e2', 'nor is it half of one'],
    ['0x10', 'nor hex'],
    ['12px34', 'a unit in the middle of a number is not a unit'],
    ['x=1', 'an assignment is not an expression'],
    ['alert(1)', 'and neither is a call'],
    ['1,000', 'three digits after a comma is a thousand as often as it is a decimal'],
    ['1,2,3', 'and a list of them is neither'],
  ] as Array<[string, string]>) {
    assert.equal(parseNumExpr(text, 100), null, `"${text}": ${why}`);
  }
  // A unit is still dropped where a unit can stand: after a number, at the end or
  // before an operator.
  assert.equal(parseNumExpr('120px', 0), 120);
  assert.equal(parseNumExpr('30deg', 0), 30);
  assert.equal(parseNumExpr('100px + 20px', 0), 120, 'both halves of a sum keep their unit');
  assert.equal(parseNumExpr('1.5rem', 0), 1.5);
});

test('a comma is the decimal separator the other 25 languages type', () => {
  // The app speaks 26 languages and most of them write 12.5 as "12,5" - which is also
  // what `inputMode="decimal"` puts on their phone keypad. Typing it into Line height
  // used to give 125, clamped to the field's max of 3.
  assert.equal(parseNumExpr('12,5', 0), 12.5);
  assert.equal(parseNumExpr('1,12', 0), 1.12);
  assert.equal(parseNumExpr('+2,5', 100), 102.5, 'relative, like its dotted twin');
  assert.equal(parseNumExpr('-2,5', 100), 97.5);
  const lh = rig({ value: 1.12, step: 0.01, min: 0.7, max: 3 });
  lh.type('1,4');
  lh.key('Enter');
  assert.deepEqual(lh.commits, [1.4], 'and it commits the number, not a hundred times it');
  lh.f.destroy();
});

test('typing commits on Enter and on blur, and junk puts the old value back', () => {
  const r = rig();
  r.type('+10');
  r.key('Enter');
  assert.deepEqual(r.commits, [110]);
  assert.equal(r.input.value, '110', 'the field shows the resolved number, not the expression');

  r.type('1920/2');
  r.input.dispatchEvent(new dom.window.Event('blur', { bubbles: false }));
  assert.deepEqual(r.commits, [110, 960]);

  r.type('banana');
  r.key('Enter');
  assert.deepEqual(r.commits, [110, 960], 'nothing was written');
  assert.equal(r.input.value, '960', 'and the field is back on the real value');
  r.f.destroy();
});

test('re-typing the value that is already there commits nothing', () => {
  const r = rig();
  r.type('100');
  r.key('Enter');
  assert.deepEqual(r.commits, []);
  r.type('+0');
  r.key('Enter');
  assert.deepEqual(r.commits, [], 'an expression that resolves to the same number is still no change');
  r.f.destroy();
});

test('Escape reverts typed text without committing it', () => {
  const r = rig();
  r.type('987');
  r.key('Escape');
  assert.equal(r.input.value, '100');
  assert.deepEqual(r.commits, []);
  r.f.destroy();
});

// ── mixed ─────────────────────────────────────────────────────────────────────

test('a mixed field shows the placeholder, and a typed value applies to everything', () => {
  const r = rig({ value: 'mixed' });
  assert.equal(r.input.value, '');
  assert.equal(r.input.placeholder, 'Mixed');
  r.type('24');
  r.key('Enter');
  assert.deepEqual(r.commits, [24], 'no shared value to be unchanged from, so it writes');
  assert.equal(r.input.placeholder, '', 'and it is a plain number from here on');
  r.f.destroy();

  // Scrubbing out of mixed counts from zero: there is no common number to count from.
  const s = rig({ value: 'mixed' });
  s.drag(12);
  assert.deepEqual(s.commits, [12]);
  s.f.destroy();
});

test('set() repaints from the model, including back into mixed, but never over half-typed text', () => {
  const r = rig();
  r.f.set(42);
  assert.equal(r.input.value, '42');
  r.f.set('mixed');
  assert.equal(r.input.value, '');
  assert.equal(r.input.placeholder, 'Mixed');
  assert.deepEqual(r.commits, [], 'a repaint is not a write');

  r.f.set(10);
  r.input.focus();
  r.type('99');
  r.f.set(77);                       // the model echoes while the user is mid-word
  assert.equal(r.input.value, '99', 'what the user typed survives the echo');
  r.key('Enter');
  assert.deepEqual(r.commits, [99]);
  r.f.destroy();
});

// ── announced ─────────────────────────────────────────────────────────────────

test('the input is a spinbutton, so an arrow key is heard and the bounds are known', () => {
  const r = rig({ unit: 'px', name: 'Width', min: 4, max: 2000 });
  assert.equal(r.input.getAttribute('role'), 'spinbutton', 'a text input announces no scripted value change');
  assert.equal(r.input.getAttribute('aria-valuemin'), '4');
  assert.equal(r.input.getAttribute('aria-valuemax'), '2000');
  assert.equal(r.input.getAttribute('aria-valuenow'), '100');
  assert.equal(r.input.getAttribute('aria-valuetext'), '100 px', 'the unit is aria-hidden, so it rides here');

  r.drag(20);
  assert.equal(r.input.getAttribute('aria-valuenow'), '120', 'a scrub says where it ended');
  r.key('ArrowUp');
  assert.equal(r.input.getAttribute('aria-valuenow'), '121', 'every keystroke says the new number');
  r.key('ArrowUp', { shiftKey: true });
  assert.equal(r.input.getAttribute('aria-valuenow'), '131');
  r.f.set(42);
  assert.equal(r.input.getAttribute('aria-valuenow'), '42', 'and a repaint from the model');
  r.f.destroy();

  // No bounds asked for, none claimed: an unbounded field must not report -Infinity.
  const free = rig();
  assert.equal(free.input.getAttribute('aria-valuemin'), null);
  assert.equal(free.input.getAttribute('aria-valuemax'), null);
  assert.equal(free.input.getAttribute('aria-valuetext'), null, 'no unit, no second reading of the number');
  free.f.destroy();
});

test('a mixed field reports that it is mixed rather than a number it does not have', () => {
  const r = rig({ value: 'mixed' });
  assert.equal(r.input.getAttribute('aria-valuenow'), null);
  assert.equal(r.input.getAttribute('aria-valuetext'), 'Mixed');
  r.type('24');
  r.key('Enter');
  assert.equal(r.input.getAttribute('aria-valuenow'), '24', 'and it has one from here on');
  assert.equal(r.input.getAttribute('aria-valuetext'), null);
  r.f.set('mixed');
  assert.equal(r.input.getAttribute('aria-valuenow'), null, 'and back again when the rows disagree');
  r.f.destroy();
});

// ── mid-gesture ───────────────────────────────────────────────────────────────

test('scrubbing() is what a host asks before a rebuild - the press never focuses anything', () => {
  const r = rig();
  assert.equal(r.f.scrubbing(), false);
  // The press is preventDefaulted on purpose (a click on the number types, a press on
  // the label drags), so `document.activeElement` says nothing about this gesture.
  r.press(0);
  r.move(50);
  assert.equal(r.f.scrubbing(), true, 'a host rebuilding now would destroy the field under the finger');
  assert.notEqual(document.activeElement, r.input);
  r.release(50);
  assert.equal(r.f.scrubbing(), false);
  assert.deepEqual(r.commits, [150]);

  r.press(0);
  r.move(20);
  r.f.destroy();
  assert.equal(r.f.scrubbing(), false, 'a torn-down field is not mid-gesture');
});

// ── teardown ──────────────────────────────────────────────────────────────────

test('destroy takes the listeners with it and drops any pending burst', async () => {
  const r = rig();
  r.key('ArrowUp');
  r.f.destroy();
  await wait(KEY_COALESCE_MS + 40);
  assert.deepEqual(r.commits, [], 'a rebuild must not commit from inside the teardown');
  r.drag(50);
  r.key('ArrowUp');
  assert.deepEqual(r.commits, []);
  assert.equal(r.f.el.isConnected, false);
  assert.equal(document.body.classList.contains('is-scrubbing'), false);
});
