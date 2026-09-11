// SPDX-License-Identifier: MPL-2.0
/**
 * What a form control displays (bridge/form-controls.ts).
 *
 * Table-driven and DOM-free on purpose: every case here - a password's bullets, a
 * placeholder standing in for an empty value, a multi-select, a range whose max is
 * below its min - is decidable without layout, so a browser would only make the
 * suite slower, not stricter. The walker's side of this (placement, clipping,
 * vertical centring) is covered in export-form-controls.test.ts, where a browser
 * genuinely is the oracle.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { controlText, rangeFraction, isWidgetControl, type ControlDesc } from './form-controls.ts';

interface Row { name: string; d: ControlDesc; text: string | null; placeholder?: boolean; multiline?: boolean }

const ROWS: Row[] = [
  // ── text-ish inputs ────────────────────────────────────────────────────────
  { name: 'text input shows its value', d: { tag: 'input', type: 'text', value: 'https://lolly.tools' }, text: 'https://lolly.tools' },
  { name: 'a type-less input defaults to text', d: { tag: 'input', value: 'hi' }, text: 'hi' },
  { name: 'number, url, email, search, tel all show their value',
    d: { tag: 'input', type: 'number', value: '42' }, text: '42' },
  { name: 'empty value falls back to the placeholder',
    d: { tag: 'input', type: 'text', value: '', placeholder: 'Enter a URL' }, text: 'Enter a URL', placeholder: true },
  { name: 'a value beats a placeholder',
    d: { tag: 'input', type: 'text', value: 'x', placeholder: 'Enter a URL' }, text: 'x', placeholder: false },
  { name: 'empty with no placeholder shows nothing', d: { tag: 'input', type: 'text', value: '' }, text: null },

  // The one case where echoing the DOM would be a leak rather than a fidelity win.
  { name: 'password shows bullets, never the characters',
    d: { tag: 'input', type: 'password', value: 'hunter2' }, text: '•••••••' },

  // Date/time: the browser paints a locale-formatted string from a closed shadow
  // root. ISO is the honest fallback; asserting it pins the deliberate choice.
  { name: 'date shows the ISO value, not a locale format',
    d: { tag: 'input', type: 'date', value: '2026-07-26' }, text: '2026-07-26' },

  // ── select ─────────────────────────────────────────────────────────────────
  { name: 'select shows its chosen option', d: { tag: 'select', selectedLabels: ['Medium'] }, text: 'Medium' },
  { name: 'a multi-select shows one row per selection',
    d: { tag: 'select', selectedLabels: ['A', 'B'] }, text: 'A\nB', multiline: true },
  { name: 'a select with nothing selected shows nothing', d: { tag: 'select', selectedLabels: [] }, text: null },
  { name: 'an empty-string option label is not a row', d: { tag: 'select', selectedLabels: [''] }, text: null },

  // ── textarea ───────────────────────────────────────────────────────────────
  { name: 'textarea keeps its line breaks',
    d: { tag: 'textarea', value: 'one\ntwo' }, text: 'one\ntwo', multiline: true },
  { name: 'empty textarea falls back to the placeholder',
    d: { tag: 'textarea', value: '', placeholder: 'Notes' }, text: 'Notes', placeholder: true, multiline: true },

  // ── buttons ────────────────────────────────────────────────────────────────
  { name: 'submit labels itself from value', d: { tag: 'input', type: 'submit', value: 'Go' }, text: 'Go' },
  { name: 'submit with no value gets the UA default', d: { tag: 'input', type: 'submit' }, text: 'Submit' },
  { name: 'a bare button input with no value shows nothing', d: { tag: 'input', type: 'button' }, text: null },

  // ── widgets: value is never text ───────────────────────────────────────────
  { name: 'checkbox is not text', d: { tag: 'input', type: 'checkbox', value: 'on', checked: true }, text: null },
  { name: 'range is not text', d: { tag: 'input', type: 'range', value: '5' }, text: null },
  { name: 'color is not text', d: { tag: 'input', type: 'color', value: '#ff0000' }, text: null },
  { name: 'hidden is not text', d: { tag: 'input', type: 'hidden', value: 'secret' }, text: null },
  { name: 'file is not text - the chooser lives in a closed UA shadow root',
    d: { tag: 'input', type: 'file', value: 'C:\\fakepath\\a.png' }, text: null },

  // An unrecognised type must fall through to nothing rather than have some future
  // UA widget mislabelled as its raw value.
  { name: 'an unknown input type shows nothing', d: { tag: 'input', type: 'quantum', value: 'x' }, text: null },
  { name: 'a non-control tag shows nothing', d: { tag: 'div', value: 'x' }, text: null },
];

for (const row of ROWS) {
  test(`controlText: ${row.name}`, () => {
    const got = controlText(row.d);
    if (row.text === null) { assert.equal(got, null); return; }
    assert.ok(got, 'expected text');
    assert.equal(got.text, row.text);
    if (row.placeholder !== undefined) assert.equal(got.placeholder, row.placeholder);
    if (row.multiline !== undefined) assert.equal(got.multiline, row.multiline);
  });
}

test('a password never leaks its characters, at any length', () => {
  const got = controlText({ tag: 'input', type: 'password', value: 'a'.repeat(500) });
  assert.ok(got);
  assert.ok(!/a/.test(got.text), 'the value must not appear in the output');
  assert.equal(got.text.length, 64, 'bulleted length is capped so a pathological value cannot blow up the SVG');
});

// ── range ────────────────────────────────────────────────────────────────────
const RANGES: [string, ControlDesc, number][] = [
  ['default bounds are 0..100', { tag: 'input', type: 'range', value: '25' }, 0.25],
  ['explicit bounds', { tag: 'input', type: 'range', value: '5', min: '0', max: '10' }, 0.5],
  ['negative bounds', { tag: 'input', type: 'range', value: '0', min: '-10', max: '10' }, 0.5],
  ['a value below min clamps to 0', { tag: 'input', type: 'range', value: '-99', min: '0', max: '10' }, 0],
  ['a value above max clamps to 1', { tag: 'input', type: 'range', value: '99', min: '0', max: '10' }, 1],
  ['no value defaults to the midpoint', { tag: 'input', type: 'range', min: '0', max: '10' }, 0.5],
  ['a non-numeric value defaults to the midpoint', { tag: 'input', type: 'range', value: 'abc' }, 0.5],
  // Both of these reach a coordinate, so a NaN here becomes an unparseable SVG.
  ['max below min collapses the range', { tag: 'input', type: 'range', value: '5', min: '10', max: '0' }, 0],
  ['a zero-width range is 0, not NaN', { tag: 'input', type: 'range', value: '5', min: '5', max: '5' }, 0],
];
for (const [name, d, want] of RANGES) {
  test(`rangeFraction: ${name}`, () => {
    const f = rangeFraction(d);
    assert.ok(Number.isFinite(f), `got ${f} - a non-finite fraction becomes an unparseable coordinate`);
    assert.ok(f >= 0 && f <= 1, `fraction out of range: ${f}`);
    assert.equal(Math.round(f * 1000) / 1000, want);
  });
}

test('isWidgetControl separates UA-drawn widgets from text-bearing controls', () => {
  for (const t of ['checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden']) {
    assert.equal(isWidgetControl({ tag: 'input', type: t }), true, `${t} should be a widget`);
  }
  for (const t of ['text', 'number', 'password', 'date', 'submit']) {
    assert.equal(isWidgetControl({ tag: 'input', type: t }), false, `${t} should not be a widget`);
  }
  assert.equal(isWidgetControl({ tag: 'select' }), false);
  assert.equal(isWidgetControl({ tag: 'textarea' }), false);
});
