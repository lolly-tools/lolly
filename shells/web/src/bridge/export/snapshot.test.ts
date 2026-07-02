// SPDX-License-Identifier: MPL-2.0
// Unit tests for the pure parts of the export snapshot (finding 8): the
// watermark spec and the outermost-selection rule. The live DOM acquire/release
// is verified via build + reading (see snapshot.ts rationale).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPERIMENTAL_WATERMARK_TEXT, watermarkStyle, selectOutermost,
} from './snapshot.ts';

test('watermark spec is a fixed corner overlay that never intercepts pointers', () => {
  assert.equal(EXPERIMENTAL_WATERMARK_TEXT, 'EXPERIMENTAL — NOT BRAND APPROVED');
  const s = watermarkStyle();
  assert.equal(s.position, 'absolute');
  assert.equal(s.bottom, '8px');
  assert.equal(s.right, '8px');
  assert.equal(s.pointerEvents, 'none');   // must not block the live editor
  assert.equal(s.zIndex, '9999');          // sits above tool content
});

// A minimal element with just the parent link the selection rule reads.
interface Node { parent: Node | null; }
const child = (parent: Node | null): Node => ({ parent });

test('selectOutermost keeps only elements with no marked ancestor', () => {
  const root = child(null);
  const a = child(root);       // marked, outermost
  const b = child(a);          // marked, nested under a
  const c = child(root);       // marked, outermost
  const marked = [a, b, c];
  const out = selectOutermost(marked, n => n.parent);
  assert.deepEqual(out, [a, c]);
});

test('selectOutermost keeps all when none are nested', () => {
  const root = child(null);
  const a = child(root), b = child(root);
  assert.deepEqual(selectOutermost([a, b], n => n.parent), [a, b]);
});

test('selectOutermost drops a deeply nested marked descendant', () => {
  const root = child(null);
  const a = child(root);
  const mid = child(a);        // unmarked intermediate
  const deep = child(mid);     // marked, but a is a marked ancestor
  assert.deepEqual(selectOutermost([a, deep], n => n.parent), [a]);
});
