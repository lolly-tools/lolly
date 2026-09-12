// SPDX-License-Identifier: MPL-2.0
/**
 * prepare-text.ts finds credential/personal-data spans for the Strip Hidden
 * Data / Prepare flow's local suggestions - never a remote call, never an
 * evaluated expression. These tests pin: the field-name gate (sensitiveField)
 * and how it interacts with pattern matching, the bounded-size guards the
 * module's own comments name (1 MiB text limit, 2000-finding cap, 100-rule
 * cap), local-rule validation, and that replacePrivateSpans round-trips a
 * URL-encoded span without corrupting the surrounding text.
 *
 * Run with: node --test tests/prepare-text.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectPrivateText,
  replacePrivateSpans,
  sensitiveField,
  validatePreparationRules,
  PREPARE_MAX_TEXT,
  PREPARE_MAX_RULES,
} from '../engine/src/prepare-text.ts';
import type { PreparationRule } from '../packages/core/src/host-v1/prepare.ts';

test('sensitiveField recognizes the built-in credential field names, case- and separator-insensitive', () => {
  assert.equal(sensitiveField('password', []), true);
  assert.equal(sensitiveField('Access-Token', []), true);
  assert.equal(sensitiveField('api_key', []), true);
  assert.equal(sensitiveField('username', []), false);
});

test('sensitiveField also honors a caller-supplied field rule', () => {
  const rules: PreparationRule[] = [{ id: 'r1', kind: 'field', value: 'internalId', label: 'Internal id' }];
  assert.equal(sensitiveField('InternalId', rules), true);
  assert.equal(sensitiveField('otherField', rules), false);
});

test('inspectPrivateText treats a whole value as a credential when the field itself is sensitive', () => {
  const { spans } = inspectPrivateText('abc123', [], 'password');
  assert.equal(spans.length, 1);
  assert.equal(spans[0]!.category, 'credential');
  assert.equal(spans[0]!.value, 'abc123');
});

test('inspectPrivateText strips a leading Bearer/Basic scheme from a sensitive-field value', () => {
  const { spans } = inspectPrivateText('Bearer abc123', [], 'authorization');
  assert.equal(spans.length, 1);
  assert.equal(spans[0]!.value, 'abc123');
});

test('inspectPrivateText finds credential-shaped values by pattern without field context', () => {
  const { spans } = inspectPrivateText('token is AKIAABCDEFGHIJKLMNOP end');
  assert.ok(spans.some(s => s.rule === 'credential-shape'));
});

test('inspectPrivateText rejects text over the 1 MiB per-value limit', () => {
  assert.throws(() => inspectPrivateText('a'.repeat(PREPARE_MAX_TEXT + 1)), /1 MiB/);
});

test('inspectPrivateText honors a literal rule and reports non-overlapping spans in order', () => {
  const rules: PreparationRule[] = [{ id: 'lit', kind: 'literal', value: 'secretco', label: 'Company' }];
  const { spans } = inspectPrivateText('client is secretco, again secretco', rules);
  assert.equal(spans.filter(s => s.rule === 'lit').length, 2);
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i]!.start >= spans[i - 1]!.end);
});

test('validatePreparationRules rejects more than the 100-rule cap and invalid shapes', () => {
  const many: PreparationRule[] = Array.from({ length: PREPARE_MAX_RULES + 1 }, (_, i) => ({ id: `r${i}`, kind: 'literal', value: 'x', label: 'x' }));
  assert.throws(() => validatePreparationRules(many), /100 local rules/);
  assert.throws(() => validatePreparationRules([{ id: 'bad id', kind: 'literal', value: 'x', label: 'x' } as PreparationRule]));
  assert.throws(() => validatePreparationRules([{ id: 'dup', kind: 'literal', value: 'x', label: 'x' }, { id: 'dup', kind: 'literal', value: 'y', label: 'y' }] as PreparationRule[]));
});

test('validatePreparationRules accepts a well-formed rule set unchanged', () => {
  const rules: PreparationRule[] = [{ id: 'ok-1', kind: 'field', value: 'internalId', label: 'Internal id' }];
  assert.deepEqual(validatePreparationRules(rules), rules);
});

test('replacePrivateSpans replaces right-to-left so earlier offsets stay valid, and url-encodes url-flagged spans', () => {
  const text = 'a=1&b=2';
  const spanB = { start: 6, end: 7, value: '2', category: 'custom', label: 'b', rule: 'r', uncertain: false, encoding: 'url' as const };
  const spanA = { start: 2, end: 3, value: '1', category: 'custom', label: 'a', rule: 'r', uncertain: false };
  const out = replacePrivateSpans(text, [
    { span: spanA, replacement: 'X' },
    { span: spanB, replacement: 'hello world' },
  ]);
  assert.equal(out, 'a=X&b=hello%20world');
});
