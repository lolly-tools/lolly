import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EDITOR_STATE_PARAMS, coerceUiState, encodeUiState, parseEditorState } from './editor-state.ts';

const flags = (q: string) => new URLSearchParams(q);

test('a _ui blob round-trips through encode and parse', () => {
  const got = parseEditorState(flags(`_ui=${encodeUiState({ v: 1, sel: ['a', 'b'], t: 2.5, panel: 'choreograph' })}`));
  assert.deepEqual(got, { select: ['a', 'b'], playhead: 2.5, panel: 'choreograph' });
});

test('the shorthands win over a conflicting _ui', () => {
  const blob = encodeUiState({ v: 1, sel: ['x'], t: 9 });
  const got = parseEditorState(flags(`_ui=${blob}&_sel=a,b&_t=1&_panel=choreograph`));
  assert.deepEqual(got, { select: ['a', 'b'], playhead: 1, panel: 'choreograph' });
});

test('a _ui field the shorthands do not contest survives the overlay', () => {
  const blob = encodeUiState({ v: 1, sel: ['x'], panel: 'choreograph' });
  const got = parseEditorState(flags(`_ui=${blob}&_t=4`));
  assert.deepEqual(got, { select: ['x'], playhead: 4, panel: 'choreograph' });
});

test('an unreadable or unversioned _ui applies nothing and never throws', () => {
  assert.deepEqual(parseEditorState(flags('_ui=%%%')), {});
  assert.deepEqual(parseEditorState(flags(`_ui=${btoa('"just a string"')}`)), {});
  assert.deepEqual(parseEditorState(flags(`_ui=${btoa('{"v":2,"sel":["a"]}')}`)), {});
});

test('unknown keys in the object are ignored, known ones still apply', () => {
  assert.deepEqual(coerceUiState({ v: 1, sel: ['a'], zoom: 3 }), { select: ['a'] });
});

test('coerceUiState refuses non-objects and drops junk-typed fields', () => {
  assert.equal(coerceUiState(null), undefined);
  assert.equal(coerceUiState([1]), undefined);
  assert.equal(coerceUiState('v1'), undefined);
  assert.deepEqual(coerceUiState({ v: 1, sel: 'a', t: 'x', panel: 4 }), {});
  assert.deepEqual(coerceUiState({ v: 1, t: Number.NaN }), {});
});

test('negative playheads clamp to zero, both doors', () => {
  assert.deepEqual(coerceUiState({ v: 1, t: -3 }), { playhead: 0 });
  assert.deepEqual(parseEditorState(flags('_t=-3')), { playhead: 0 });
});

// The RESERVED test's pattern (tests/engine.test.ts): the documented list and the
// parsed one must be the same set.
test('docs/url-mode.md names exactly the editor-state params the shell parses', () => {
  const doc = readFileSync(new URL('../../../../docs/url-mode.md', import.meta.url), 'utf8');
  const para = doc.split('\n').find((l) => l.includes('EDITOR state')) ?? '';
  const documented = new Set([...para.matchAll(/`(_[a-z]+)[=`]/g)].map((m) => m[1]));
  assert.deepEqual(documented, new Set(EDITOR_STATE_PARAMS));
});
