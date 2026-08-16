// SPDX-License-Identifier: MPL-2.0
/**
 * Static guard: convergence must never read the wall clock or unseeded randomness
 * (plan 100 §11.7, §13 wave 0.6). LWW ordering in the canvas-op contract rides
 * Lamport `(clock, client)` only (`packages/core/src/canvas-op-v1.ts`'s `beats`) - 
 * an airgapped device with a wrong system clock still converges identically with
 * its peers, "and it doesn't matter" (§11.7). Any of these landing in the merge
 * path (or in the testkit that stands in for a real adapter in the shared
 * conformance suite) would make two peers order ops differently depending on
 * physical clocks or unseeded entropy, which is precisely the bug this pins
 * against forever:
 *
 *   - `Date.now` / `new Date(` / `new Date;` - the system clock;
 *   - `performance.now` - monotonic, but a different origin on every device;
 *   - `Math.random` - an unseeded PRNG;
 *   - `crypto.randomUUID` / `crypto.getRandomValues` - unseeded entropy, and
 *     directly adjacent work: ULID minting (wave 0.3) needs randomness and lives
 *     one module away, in the shell.
 *
 * The list is the ways this codebase could plausibly do it, not a proof of
 * completeness - a determined caller can always launder a clock through an
 * argument. It is a ratchet against the accidental case.
 *
 * Grep-based rather than typechecked: "this token never appears" is not a
 * property any compiler enforces, so this test IS the enforcement. No import of
 * the modules under test - a byte-level guard should survive even a change that
 * breaks their types.
 *
 * Run with: node --test tests/canvas-op-no-wallclock.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'packages/core/src/canvas-op-v1.ts',
  'packages/core/src/canvas-op-testkit.ts',
] as const;

// Deliberately loose - a STORED reference (`const now = Date.now`) is exactly as
// dangerous as a direct call (`Date.now()`), so no trailing `(` is required on the
// member-access tokens. `new Date` is matched with either a paren or a statement
// end (`new Date;` / `new Date)` are legal and yield the current time), but never
// bare: `Date` alone is the TYPE, used legitimately in doc comments and signatures.
const PATTERN = /Date\.now|Math\.random|performance\.now|crypto\.(randomUUID|getRandomValues)|new Date\s*[(;,)\]]/;

// Exact `.trim()`ed line content allowed to match, each with the reason it is not
// a violation. Currently: one doc comment in the testkit that NAMES the forbidden
// tokens to document their absence from the seeded PRNG below it - the opposite of
// a violation. If a real usage is ever added, it must NOT be added here; fix the
// source instead (or, if truly legitimate - e.g. a debug-only dev log gated out of
// the convergence path - add it with a comment justifying exactly why it cannot
// affect merge order).
const ALLOWLIST: readonly string[] = [
  '/** Deterministic 32-bit PRNG - no Date.now / Math.random, so a failing seed reproduces',
];

test('canvas-op-v1 + canvas-op-testkit never read the wall clock or unseeded randomness', () => {
  const offenders: string[] = [];
  for (const rel of FILES) {
    const lines = readFileSync(join(root, rel), 'utf8').split('\n');
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (PATTERN.test(line) && !ALLOWLIST.includes(line)) {
        offenders.push(`${rel}:${i + 1}: ${line}`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    'wall-clock/random token found outside the allowlist — LWW must ride Lamport ' +
    `(clock, client) only (plan 100 §11.7):\n${offenders.join('\n')}`,
  );
});

test('the allowlisted line still exists verbatim (catches silent drift either way)', () => {
  // If the comment's wording changes, this fails - forcing a deliberate look at
  // whether the new wording still just NAMES the tokens (update ALLOWLIST) or has
  // become a real usage (fix the source instead). A silently stale allowlist entry
  // would otherwise mask a rename from ever being noticed.
  const text = readFileSync(join(root, 'packages/core/src/canvas-op-testkit.ts'), 'utf8');
  for (const allowed of ALLOWLIST) {
    assert.ok(text.includes(allowed), `allowlisted line no longer found verbatim: ${allowed}`);
  }
});
