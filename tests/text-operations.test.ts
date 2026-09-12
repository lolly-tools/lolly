// SPDX-License-Identifier: MPL-2.0
/**
 * Pins TEXT_OPERATIONS: the discoverable list of text-helper actions and
 * their portable option declarations, consumed by the shells to build the
 * operation picker and its per-operation option UI generically (they render
 * the declared `options`, they never hardcode an operation's fields). Every
 * row must carry a stable id and a well-formed options list, because a
 * shell's UI and any saved/URL-mode state key off the operation id and its
 * option ids.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_OPERATIONS } from '../engine/src/text-operations.ts';

test('every operation has a non-empty id, label, group and keywords', () => {
  for (const op of TEXT_OPERATIONS) {
    assert.ok(op.id.length > 0, 'missing id');
    assert.ok(op.label.length > 0, `${op.id}: missing label`);
    assert.ok(op.group.length > 0, `${op.id}: missing group`);
    assert.ok(Array.isArray(op.keywords) && op.keywords.length > 0, `${op.id}: missing keywords`);
  }
});

test('operation ids are unique', () => {
  const ids = TEXT_OPERATIONS.map((op) => op.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('groups are limited to the four documented buckets', () => {
  const allowed = new Set(['Edit', 'Inspect', 'Convert', 'Generate']);
  for (const op of TEXT_OPERATIONS) {
    assert.ok(allowed.has(op.group), `${op.id}: unexpected group ${op.group}`);
  }
});

test('options, when present, are non-empty and each has a unique id within the operation', () => {
  for (const op of TEXT_OPERATIONS) {
    if (op.options === undefined) continue;
    assert.ok(op.options.length > 0, `${op.id}: options declared but empty`);
    const optIds = op.options.map((o) => o.id);
    assert.equal(new Set(optIds).size, optIds.length, `${op.id}: duplicate option ids`);
  }
});

test('a select option always ships a non-empty choices list and a default among them', () => {
  for (const op of TEXT_OPERATIONS) {
    for (const opt of op.options ?? []) {
      if (opt.type !== 'select') continue;
      assert.ok(Array.isArray(opt.choices) && opt.choices.length > 0, `${op.id}.${opt.id}: no choices`);
      assert.ok(
        opt.choices.includes(opt.default as string),
        `${op.id}.${opt.id}: default ${String(opt.default)} not in choices`
      );
    }
  }
});

test('the ascii operation declares exactly the option ids textAscii accepts', () => {
  // The declaration is what a shell builds its option UI from, so it has to
  // name the same keys the renderer reads (textAscii's opts: style, ink,
  // spacing, width, align). A declared option the renderer ignores is a dead
  // control; an opts key with no declaration is unreachable from any shell.
  const ascii = TEXT_OPERATIONS.find((op) => op.id === 'ascii');
  assert.ok(ascii, 'ascii operation missing');
  const optIds = (ascii!.options ?? []).map((o) => o.id).sort();
  assert.deepEqual(optIds, ['align', 'ink', 'spacing', 'style', 'width']);
});
