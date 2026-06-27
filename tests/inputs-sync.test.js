/**
 * Unit tests for the sidebar input-sync skip decision (shells/web/src/views/
 * inputs-sync.js). This is the logic that lets a keystroke avoid rebuilding the
 * whole control panel: the rebuild is skipped ONLY when the panel already shows
 * the model, so the tests pin down "skip when provably in sync, rebuild on any
 * doubt". The DOM-touching path runs under jsdom (no real layout needed).
 *
 * Run with: node --test tests/inputs-sync.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  canSkipInputsRebuild,
  domReflectsValue,
  visibleInputKey,
} from '../shells/web/src/views/inputs-sync.js';

// A sidebar-like container whose controls hold the given current DOM values.
function makePanel(html) {
  const dom = new JSDOM(`<!DOCTYPE html><div id="panel">${html}</div>`);
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS; // exercise the real escape when present
  return dom.window.document.getElementById('panel');
}

const inp = (id, control, value, extra = {}) => ({ id, control, value, ...extra });

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

test('a structural control (slider) change always rebuilds', () => {
  const el = makePanel('<div class="custom-slider" data-input-id="scale"></div>');
  const prev = [inp('scale', 'slider', 1)];
  const model = [inp('scale', 'slider', 2)];
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
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
  const el = dom.window.document.getElementById('panel');
  el.querySelector('input').focus();
  // The model's block value changed (a keystroke), which would normally rebuild;
  // because the field is focused, it skips regardless.
  const prev = [inp('scenes', 'blocks', [{ hold: '1.6' }])];
  const model = [inp('scenes', 'blocks', [{ hold: '1' }])];
  assert.equal(canSkipInputsRebuild(el, model, prev), true);
});

test('a blurred block number field does NOT defer (normal structural rebuild)', () => {
  // Same panel, but nothing focused — a blocks value change is structural and must
  // rebuild, so the deferral must not leak into the unfocused case.
  const dom = new JSDOM(
    '<!DOCTYPE html><div id="panel"><input type="number" data-field-id="scenes:0:hold" value="1.6"></div>'
  );
  if (dom.window.CSS) globalThis.CSS = dom.window.CSS;
  const el = dom.window.document.getElementById('panel');
  const prev = [inp('scenes', 'blocks', [{ hold: '1.6' }])];
  const model = [inp('scenes', 'blocks', [{ hold: '1.2' }])];
  assert.equal(canSkipInputsRebuild(el, model, prev), false);
});

test('domReflectsValue: structural controls never report reflected', () => {
  const el = makePanel('<div class="custom-slider" data-input-id="scale"></div>');
  assert.equal(domReflectsValue(el, inp('scale', 'slider', 2)), false);
});

test('visibleInputKey: hides export-group rows and showIf rows that fail their condition', () => {
  const model = [
    inp('title', 'text-input', 'hi'),
    inp('pad', 'text-input', '0', { group: 'export' }),
    inp('extra', 'text-input', 'x', { showIf: { title: 'nope' } }),
  ];
  assert.equal(visibleInputKey(model), 'title');
});
