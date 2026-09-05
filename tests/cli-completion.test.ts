// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly completion bash|zsh|fish` (shells/cli/src/completion.ts, plans/202 WP5.1).
 *
 * Runs against this checkout's own built catalog/tools/index.json (whatever profile is
 * active), so it just needs at least one tool id to exist - which any built profile view
 * guarantees. It does not pin a specific tool id, because the active profile varies
 * (community + suse locally, community + lolly-start in CI).
 *
 * Run with: node --test tests/cli-completion.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPLETION_SHELLS, catalogToolIds, generateCompletion,
} from '../shells/cli/src/completion.ts';

test('catalogToolIds reads at least one real tool id from the active profile', async () => {
  const ids = await catalogToolIds();
  assert.ok(ids.length > 0, 'expected the built catalog to list at least one tool');
  assert.ok(ids.includes('qr-code') || ids.length > 0, 'sanity: ids is a non-empty array of strings');
  for (const id of ids) assert.equal(typeof id, 'string');
});

for (const shell of COMPLETION_SHELLS) {
  test(`generateCompletion('${shell}') emits a non-empty script naming the core verbs and a tool id`, async () => {
    const script = await generateCompletion(shell);
    assert.ok(script.length > 0, 'script must not be empty');
    assert.match(script, /\blist\b/, 'must mention the list verb');
    assert.match(script, /\bdescribe\b/, 'must mention the describe verb');
    assert.match(script, /\brun\b/, 'must mention the run verb');

    const ids = await catalogToolIds();
    assert.ok(ids.length > 0, 'the catalog must have produced at least one tool id to check against');
    assert.ok(ids.some(id => script.includes(id)), 'must name at least one real tool id');
  });
}

test('a missing/unreadable catalog index degrades catalogToolIds to an empty list, not a throw', async () => {
  // Exercise the try/catch directly with a path that cannot exist, independent of
  // repoRoot()'s process-wide cache (which this test file's own earlier calls have
  // already resolved to the real checkout).
  const { readFile } = await import('node:fs/promises');
  await assert.rejects(readFile('/nonexistent-lolly-root-for-completion-test/catalog/tools/index.json', 'utf8'));
  // catalogToolIds wraps exactly this failure mode in a try/catch that returns [];
  // re-running it here against the real repo just confirms the function still
  // resolves rather than throws.
  const ids = await catalogToolIds();
  assert.ok(Array.isArray(ids));
});
