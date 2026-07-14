// SPDX-License-Identifier: MPL-2.0
/**
 * Filesystem-safe token codec (engine/src/fs-token.ts) — the fix for the P0-4
 * desktop session-name collision that silently destroyed data.
 *
 * The Tauri state bridges name each saved session `<encodeFsToken(slot)>.json`.
 * The property that matters: distinct slot names must produce distinct tokens
 * (injective) and each token must decode back to its exact slot. The old
 * `slot.replace(/[^\w.-]/g, '_')` failed injectivity — this proves the codec
 * doesn't.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { encodeFsToken, decodeFsToken } from '../engine/src/fs-token.ts';

// The exact collision set from the action plan (P0-4), plus non-ASCII.
const COLLIDING = ['Q3 Report', 'Q3/Report', 'Q3+Report', 'Q3_Report', 'Björn keynote'];

test('the old sanitiser DID collide these names (regression baseline)', () => {
  const old = (s: string) => s.replace(/[^\w.-]/g, '_');
  const oldTokens = new Set(COLLIDING.map(old));
  // Four of the five collapse to "Q3_Report"; the bug was real.
  assert.ok(oldTokens.size < COLLIDING.length, 'baseline: old scheme collides');
  assert.equal(old('Q3 Report'), old('Q3/Report'));
});

test('encodeFsToken is injective across the colliding set', () => {
  const tokens = COLLIDING.map(encodeFsToken);
  assert.equal(new Set(tokens).size, COLLIDING.length, 'every distinct slot → a distinct token');
});

test('round-trips spaces, /, +, underscore, non-ASCII, emoji, %, and empty', () => {
  const cases = [
    ...COLLIDING,
    '', '.', '..', '李雷', 'a%2Fb', '100% done', 'a\\b:c*d?e"f<g>h|i', "it's a (test)!",
    '🎨 poster', 'tab\tnewline\n', 'a/b/c/../../etc',
  ];
  for (const slot of cases) {
    assert.equal(decodeFsToken(encodeFsToken(slot)), slot, JSON.stringify(slot));
  }
});

test('tokens contain only universally-safe filename characters', () => {
  const cases = [...COLLIDING, 'a/b\\c:d*e?f"g<h>i|j', '🎨', '../escape'];
  for (const slot of cases) {
    const token = encodeFsToken(slot);
    assert.match(token, /^[A-Za-z0-9._%-]*$/, `${JSON.stringify(slot)} → ${token}`);
    // No path separators survive — a token can never escape its directory.
    assert.ok(!token.includes('/') && !token.includes('\\'));
  }
});

test('already-safe names pass through unchanged (legacy files stay put)', () => {
  // A slot with only allowlist chars keeps its name, so a pre-existing
  // "Q3_Report.json" needs no migration and loads as-is.
  assert.equal(encodeFsToken('Q3_Report'), 'Q3_Report');
  assert.equal(encodeFsToken('my-poster.v2'), 'my-poster.v2');
});
