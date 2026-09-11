// SPDX-License-Identifier: MPL-2.0
/**
 * Bridge-side tests for host.speech that run in plain Node - no Worker, no
 * DOM. Only the pure seams: the hard input bound must reject BEFORE anything
 * touches the worker (which is also what makes it testable here: if the check
 * ran after ensureWorker(), this environment would throw on the missing
 * Worker constructor instead of rejecting with the length error).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createSpeechAPI } from './speech.ts';
import { MAX_INPUT_CHARS } from '../lib/speech-kokoro.ts';

describe('synthesize input bound', () => {
  test('rejects over-limit text before spawning a worker', async () => {
    const api = createSpeechAPI();
    await assert.rejects(
      api.synthesize('a'.repeat(MAX_INPUT_CHARS + 1)),
      /speech input too long: 100001 chars \(max 100000\)/,
    );
  });

  test('text exactly at the limit passes the bound (and fails later, on the missing Worker)', async () => {
    const api = createSpeechAPI();
    // ensureWorker throws synchronously in Node (no Worker constructor) - 
    // which is itself the proof the length check ran and passed first.
    let err: unknown;
    try { await api.synthesize('a'.repeat(MAX_INPUT_CHARS)); } catch (e) { err = e; }
    assert.ok(err, 'expected a failure in Node');
    assert.ok(!/too long/.test(String(err)), 'must not be the length bound');
  });
});
