// SPDX-License-Identifier: MPL-2.0
/**
 * The pure Kokoro logic moved to engine/src/speech-text.ts (roadmap section 4's
 * one-synthesis-layer rule) and its unit tests moved with it - 
 * tests/speech-text.test.ts in the repo-root suite. What is left to pin HERE
 * is this shell's contract: lib/speech-kokoro.ts must re-export the engine
 * module's implementation, identically - the worker and bridge import from it
 * by path, and a fork (a copy, a "small local fix") would put the web shell's
 * words out of step with every other surface.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as shell from './speech-kokoro.ts';
import * as engine from '../../../../engine/src/speech-text.ts';

test('lib/speech-kokoro.ts re-exports the engine speech-text module verbatim', () => {
  const engineKeys = Object.keys(engine).sort();
  assert.ok(engineKeys.length > 0, 'engine module exports something');
  for (const key of engineKeys) {
    assert.ok(key in shell, `missing re-export: ${key}`);
    assert.strictEqual(
      (shell as Record<string, unknown>)[key],
      (engine as Record<string, unknown>)[key],
      `${key} must be the engine's own binding, not a copy`,
    );
  }
  // And nothing shell-local has crept in beside the re-export.
  assert.deepEqual(Object.keys(shell).sort(), engineKeys);
});
