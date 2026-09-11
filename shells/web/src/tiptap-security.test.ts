// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeAttributes } from '@tiptap/core';

test('Tiptap mergeAttributes keeps an own __proto__ key as data', () => {
  const hostile = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(hostile, '__proto__', {
    configurable: true,
    enumerable: true,
    value: { onload: 'globalThis.__tiptap_probe = true', style: 'background:url(https://invalid.test)' },
    writable: true,
  });

  const merged = mergeAttributes(hostile);

  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal(Object.hasOwn(merged, '__proto__'), true);
  assert.equal(Object.hasOwn(merged, 'onload'), false);
  assert.equal(Object.hasOwn(merged, 'style'), false);
  assert.equal(merged.onload, undefined);
  assert.equal(merged.style, undefined);
});

