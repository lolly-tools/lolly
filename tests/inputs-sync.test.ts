// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the sidebar input-sync skip decision (shells/web/src/views/
 * inputs-sync.js). This is the logic that lets a keystroke avoid rebuilding the
 * whole control panel: the rebuild is skipped ONLY when the panel already shows
 * the model, so the tests pin down "skip when provably in sync, rebuild on any
 * doubt". The DOM-touching path runs under jsdom (no real layout needed).
 *
 * Run with: node --test tests/inputs-sync.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import {
  canSkipInputsRebuild,
  domReflectsValue,
  visibleInputKey,
} from '../shells/web/src/views/inputs-sync.ts';
import type { SyncableInput } from '../shells/web/src/views/inputs-sync.ts';

// A sidebar-like container whose controls hold the given current DOM values.
function makePanel(html: string): HTMLElement {
  const dom = new JSDOM(`<!DOCTYPE html><div id="panel">${html}</div>`);
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS; // exercise the real escape when present
  return dom.window.document.getElementById('panel') as HTMLElement;
}

const inp = (
  id: string,
  control: SyncableInput['control'],
  value: SyncableInput['value'],
  extra: Partial<SyncableInput> = {},
): SyncableInput => ({ id, control, value, ...extra });

test('first render (no baseline) never skips', () => {
  const el = makePanel('<input type="text" data-input-id="title" value="hi">');
  assert.equal(canSkipInputsRebuild(el, [inp('title', 'text-input', 'hi')], null), false);
});

test('an unchanged model (same object identities) skips', () => {
  const el = makePanel('<input type="text" data-input-id="title" value="hi">');
  const a = inp('title', 'text-input', 'hi');
  assert.equal(canSkipInputsRebuild(el, [a], [a]), true);
});

test('a keystroke the field already shows skips the rebuild', () => {
  const el = makePanel('<input type="text" data-input-id="title" value="hello">');
  const prev = [inp('title', 'text-input', 'hell')];
  const model = [inp('title', 'text-input', 'hello')]; // DOM already shows the typed value
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a value the DOM does not yet show forces a rebuild (clamp / hook side effect)', () => {
  const el = makePanel('<input type="text" data-input-id="count" value="999">');
  const prev = [inp('count', 'text-input', '99')];
  const model = [inp('count', 'text-input', '100')]; // clamped; DOM still shows "999"
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('typing one field while another stays unchanged still skips', () => {
  const el = makePanel(
    '<input type="text" data-input-id="title" value="hello">' +
    '<input type="checkbox" data-input-id="bold" checked>'
  );
  const bold = inp('bold', 'checkbox', true);
  const prev = [inp('title', 'text-input', 'hell'), bold];
  const model = [inp('title', 'text-input', 'hello'), bold]; // bold same ref; title reflected
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a checkbox change the DOM already shows skips', () => {
  const el = makePanel('<input type="checkbox" data-input-id="bold" checked>');
  const prev = [inp('bold', 'checkbox', false)];
  const model = [inp('bold', 'checkbox', true)]; // DOM is checked
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a checkbox change the DOM does not show forces a rebuild', () => {
  const el = makePanel('<input type="checkbox" data-input-id="bold">'); // unchecked
  const prev = [inp('bold', 'checkbox', false)];
  const model = [inp('bold', 'checkbox', true)]; // a hook turned it on; DOM still unchecked
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('a select change the DOM already shows skips', () => {
  const el = makePanel(
    '<select data-input-id="size"><option value="s">s</option><option value="m" selected>m</option></select>'
  );
  const prev = [inp('size', 'select', 's')];
  const model = [inp('size', 'select', 'm')];
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a showIf visibility change forces a rebuild even when values are reflected', () => {
  // adv shows unchecked → model adv=false IS reflected, but flipping it hides "extra",
  // so the set of visible rows changes and the panel must rebuild.
  const el = makePanel('<input type="checkbox" data-input-id="adv">');
  const prev = [inp('adv', 'checkbox', true), inp('extra', 'text-input', 'x', { showIf: { adv: true } })];
  const model = [inp('adv', 'checkbox', false), inp('extra', 'text-input', 'x', { showIf: { adv: true } })];
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('a slider whose DOM already shows the value skips the rebuild (drag/keyboard)', () => {
  // The thumb led the model: mountCustomSlider set aria-valuenow to the committed
  // value, so a rebuild would only flash the panel. Skipping it is what stops the
  // whole section jumping on every slider release.
  const el = makePanel('<div class="custom-slider" data-input-id="scale" aria-valuenow="2"></div>');
  const prev = [inp('scale', 'slider', 1)];
  const model = [inp('scale', 'slider', 2)];
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a slider whose DOM does NOT yet show the value rebuilds (programmatic / clamp)', () => {
  // aria-valuenow still reads the old value (URL/undo/hook set the model), so the
  // DOM must be repainted - a full rebuild, exactly as before.
  const el = makePanel('<div class="custom-slider" data-input-id="scale" aria-valuenow="1"></div>');
  const prev = [inp('scale', 'slider', 1)];
  const model = [inp('scale', 'slider', 2)];
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
  // A slider with no aria-valuenow at all is never "reflected".
  const bare = makePanel('<div class="custom-slider" data-input-id="scale"></div>');
  assert.equal(canSkipInputsRebuild(bare, model, prev), false);
});

test('a model-length change rebuilds (e.g. a block was added)', () => {
  const el = makePanel('<input type="text" data-input-id="title" value="hi">');
  const prev = [inp('title', 'text-input', 'hi')];
  const model = [inp('title', 'text-input', 'hi'), inp('new', 'text-input', '')];
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('a changed input with no matching control rebuilds', () => {
  const el = makePanel('<input type="text" data-input-id="title" value="hi">');
  const prev = [inp('ghost', 'text-input', 'a')];
  const model = [inp('ghost', 'text-input', 'b')];
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('a focused block number field defers the rebuild (caret survives mid-decimal)', () => {
  // Mid-typing "1." in an <input type=number> reports value "" with badInput; a
  // rebuild would recreate the input and scramble the caret. While it holds focus
  // the rebuild is deferred so the browser keeps the in-progress text + caret.
  const dom = new JSDOM(
    '<!DOCTYPE html><div id="panel"><input type="number" data-field-id="scenes:0:hold" value="1.6"></div>'
  );
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS;
  const el = dom.window.document.getElementById('panel') as HTMLElement;
  el.querySelector('input')!.focus();
  // The model's block value changed (a keystroke), which would normally rebuild;
  // because the field is focused, it skips regardless.
  const prev = [inp('scenes', 'blocks', [{ hold: '1.6' }])];
  const model = [inp('scenes', 'blocks', [{ hold: '1' }])];
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a blurred block number field does NOT defer (normal structural rebuild)', () => {
  // Same panel, but nothing focused - a blocks value change is structural and must
  // rebuild, so the deferral must not leak into the unfocused case.
  const dom = new JSDOM(
    '<!DOCTYPE html><div id="panel"><input type="number" data-field-id="scenes:0:hold" value="1.6"></div>'
  );
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS;
  const el = dom.window.document.getElementById('panel') as HTMLElement;
  const prev = [inp('scenes', 'blocks', [{ hold: '1.6' }])];
  const model = [inp('scenes', 'blocks', [{ hold: '1.2' }])];
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('domReflectsValue: a slider reflects via aria-valuenow; other structural controls never do', () => {
  // Slider: aria-valuenow is the authoritative DOM value (numeric compare).
  const match = makePanel('<div class="custom-slider" data-input-id="scale" aria-valuenow="2"></div>');
  assert.equal(domReflectsValue(match, inp('scale', 'slider', 2)), true);
  const stale = makePanel('<div class="custom-slider" data-input-id="scale" aria-valuenow="1"></div>');
  assert.equal(domReflectsValue(stale, inp('scale', 'slider', 2)), false);
  const bare = makePanel('<div class="custom-slider" data-input-id="scale"></div>');
  assert.equal(domReflectsValue(bare, inp('scale', 'slider', 2)), false);
  // A genuinely structural control (colour picker) still never reports reflected.
  const color = makePanel('<div class="color-trigger" data-input-id="tint"></div>');
  assert.equal(domReflectsValue(color, inp('tint', 'color-picker', '#abc')), false);
});

test('visibleInputKey: hides export-group rows and showIf rows that fail their condition', () => {
  const model = [
    inp('title', 'text-input', 'hi'),
    inp('pad', 'text-input', '0', { group: 'export' }),
    inp('extra', 'text-input', 'x', { showIf: { title: 'nope' } }),
  ];
  assert.equal(visibleInputKey(model), 'title');
});

// ─── Block TEXT fields defer too ──────────────────────────────────────────────
// A block text field's caret DOES survive the rebuild (renderInputs restores it by
// data-field-id), so the rebuild was never *destructive* here - it was wasteful, and
// visibly so: replacing every row drops and re-establishes focus within the frame,
// restarting the focus-spotlight opacity transition on every other row and section,
// so the whole sidebar pulses once per keypress. syncInputs patches the one thing
// the rebuild refreshed (the collapsed-pill preview) in place instead.

// A panel whose focusable control is built from markup, with `focus` applied.
function focusedPanel(html: string, focusSelector: string | null = '[data-field-id]'): HTMLElement {
  const dom = new JSDOM(`<!DOCTYPE html><div id="panel">${html}</div>`);
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS;
  const el = dom.window.document.getElementById('panel') as HTMLElement;
  if (focusSelector) el.querySelector<HTMLElement>(focusSelector)!.focus();
  return el;
}

const blocksPair = (before: unknown, after: unknown): [SyncableInput[], SyncableInput[]] => (
  [[inp('links', 'blocks', before as SyncableInput['value'])],
   [inp('links', 'blocks', after as SyncableInput['value'])]]
);

test('a focused block text field defers the rebuild (no per-keypress panel churn)', () => {
  // A block text field renders with NO type attribute - the shape this must match.
  const el = focusedPanel('<input class="block-field" data-field-id="links:0:title" value="Calend">');
  const [prev, model] = blocksPair([{ title: 'Calend' }], [{ title: 'Calenda' }]);
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a focused block textarea defers the rebuild', () => {
  const el = focusedPanel('<textarea class="block-field" data-field-id="links:0:note">hi</textarea>');
  const [prev, model] = blocksPair([{ note: 'hi' }], [{ note: 'hib' }]);
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a blurred block text field does NOT defer (structural rebuild as before)', () => {
  const el = focusedPanel('<input class="block-field" data-field-id="links:0:title" value="Calend">', null);
  const [prev, model] = blocksPair([{ title: 'Calend' }], [{ title: 'Calenda' }]);
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('a focused block range/checkbox/colour field does NOT defer', () => {
  // These commit discretely rather than by typing, so they keep the full rebuild - 
  // which is what repaints a swatch, a slider readout or a showFor-gated sibling.
  for (const html of [
    '<input type="range" class="block-field" data-field-id="links:0:weight" value="2">',
    '<input type="checkbox" class="block-field" data-field-id="links:0:bold">',
    '<input type="color" class="block-field" data-field-id="links:0:tint" value="#30ba78">',
  ]) {
    const el = focusedPanel(html);
    const [prev, model] = blocksPair([{ a: 1 }], [{ a: 2 }]);
    assert.equal(canSkipInputsRebuild(el, model, prev), false, html);
  }
});

test('a focused text field OUTSIDE the panel does not defer another panel rebuild', () => {
  // el.contains guards the deferral: focus in some other surface (a dialog, the
  // export pane) must never freeze this panel's repaint.
  const dom = new JSDOM(
    '<!DOCTYPE html><div id="panel"><input class="block-field" data-field-id="links:0:title" value="a"></div>'
    + '<input id="elsewhere" data-field-id="other:0:x" value="z">'
  );
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS;
  dom.window.document.getElementById('elsewhere')!.focus();
  const el = dom.window.document.getElementById('panel') as HTMLElement;
  const [prev, model] = blocksPair([{ title: 'a' }], [{ title: 'ab' }]);
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('a popped-out table cell defers the rebuild even though it left the panel', () => {
  // A table input can be lifted into a floating panel (lib/float-panel), which
  // mounts it OUTSIDE #tool-inputs. Its cells still hold the authoritative value,
  // so the deferral has to follow the grid rather than the sidebar box - without
  // this, every keystroke rebuilds the sidebar, which tears the panel down and
  // re-pops it, and typing dies after one character.
  const dom = new JSDOM(
    '<!DOCTYPE html><div id="panel"></div>'
    + '<div class="floatp"><div class="table-input" data-table-id="data">'
    + '<textarea class="table-cell" data-field-id="data:t:0:1">Is it open</textarea>'
    + '</div></div>'
  );
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS;
  dom.window.document.querySelector<HTMLElement>('.table-cell')!.focus();
  const el = dom.window.document.getElementById('panel') as HTMLElement;
  const [prev, model] = blocksPair([{ x: 'Is it open' }], [{ x: 'Is it open?' }]);
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a floating field that is NOT a table cell still takes the rebuild', () => {
  // The exemption is scoped to the popped-out grid, not to floating panels at
  // large: anything else out there is a different surface and must not be able
  // to freeze this panel's repaint.
  const dom = new JSDOM(
    '<!DOCTYPE html><div id="panel"></div>'
    + '<div class="floatp"><input data-field-id="other:0:x" value="z"></div>'
  );
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS;
  dom.window.document.querySelector<HTMLElement>('.floatp input')!.focus();
  const el = dom.window.document.getElementById('panel') as HTMLElement;
  const [prev, model] = blocksPair([{ a: 1 }], [{ a: 2 }]);
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});
