// SPDX-License-Identifier: MPL-2.0
/**
 * classifyMatteError - the belt-and-braces mapping that keeps a raw runtime string
 * (the std::bad_alloc that started this) out of the Remove-Background dialog.
 *
 * Run: node --test shells/web/src/lib/matte-error.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMatteError } from './matte-error.ts';

test('the OrtRun std::bad_alloc that motivated this is a memory failure', () => {
  // The EXACT string ort-web throws for the full BiRefNet on the wasm32 heap.
  assert.equal(
    classifyMatteError(new Error('failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc')),
    'memory');
});

test('other out-of-memory phrasings all classify as memory', () => {
  for (const m of [
    'Aborted(). Build with -sASSERTIONS for more info. OOM',
    'RangeError: Array buffer allocation failed',
    'Cannot allocate Wasm memory for new instance',
    'memory access out of bounds',
    'failed to grow the wasm heap',
  ]) {
    assert.equal(classifyMatteError(new Error(m)), 'memory', m);
  }
  // A bare RangeError (no useful message) still reads as memory.
  assert.equal(classifyMatteError(new RangeError('')), 'memory');
});

test('a generic ORT runtime exception (ERROR_CODE 6, no alloc word) is NOT memory', () => {
  assert.equal(
    classifyMatteError(new Error('failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: unexpected input rank')),
    'generic');
});

test('abort is detected by name (the dialog stays silent on it)', () => {
  const e = Object.assign(new Error('The matte run was aborted.'), { name: 'AbortError' });
  assert.equal(classifyMatteError(e), 'aborted');
});

test('a not-installed model is recognised by class AND by the worker-flattened message', () => {
  const typed = Object.assign(new Error('nope'), { name: 'ModelNotInstalledError' });
  assert.equal(classifyMatteError(typed), 'not-installed');
  // The wasm worker loses the class across postMessage - only the text survives.
  assert.equal(
    classifyMatteError(new Error("The u2netp matte model isn't downloaded on this device yet.")),
    'not-installed');
});

test('anything else is generic (and never throws on odd inputs)', () => {
  assert.equal(classifyMatteError(new Error('canvas 2d context unavailable')), 'generic');
  assert.equal(classifyMatteError('a bare string'), 'generic');
  assert.equal(classifyMatteError(null), 'generic');
  assert.equal(classifyMatteError(undefined), 'generic');
  assert.equal(classifyMatteError({}), 'generic');
});
