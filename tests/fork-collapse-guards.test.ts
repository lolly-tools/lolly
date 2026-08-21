// SPDX-License-Identifier: MPL-2.0
/**
 * Anti-drift guards for the terminal-shell fork collapse (pre-GA hardening).
 *
 * These are SOURCE scans, not behaviour tests: the TUI verdict panel and catalog
 * live in .tsx / import-heavy modules this suite cannot exercise under Node
 * type-stripping (the model is shells/tui/src/provenance-default.test.ts). What
 * each guard pins is that a shell REACHES the one shared implementation instead of
 * re-deriving it - so a future editor cannot quietly re-fork the security scrub,
 * the verdict wording, or repo-root resolution and pass CI.
 *
 * The behaviour of the shared code itself is covered in tests/verdict-report.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const CLI = read('../shells/cli/src/validate.ts');
const TUI = read('../shells/tui/src/views/Profile.tsx');
const MCP = read('../services/mcp/src/tools.ts');

// The scrub regex, matched loosely so either the \u-escaped or the literal form trips it.
const SCRUB_RE = /replace\(\s*\/\[[^\]]*007[fF][^\]]*\]/;

test('the control-char scrub lives ONLY in the shared module', () => {
  // The security-sensitive part: three copies of this regex is how one gets patched
  // and two keep the hole. It must be gone from every shell surface.
  assert.doesNotMatch(CLI, SCRUB_RE, 'CLI re-derives the scrub regex');
  assert.doesNotMatch(TUI, SCRUB_RE, 'TUI re-derives the scrub regex');
  assert.doesNotMatch(MCP, SCRUB_RE, 'MCP re-derives the scrub regex');
  const SHARED = read('../packages/node-shell/src/verdict-report.ts');
  assert.match(SHARED, SCRUB_RE, 'the shared module must be the one home of the scrub');
});

test('the CLI validator consumes the shared verdict renderer', () => {
  assert.match(CLI, /from '@lolly-tools\/node-shell\/verdict-report'/);
  assert.match(CLI, /verdictHeadline\(v, \{ elevateParts: true \}\)/,
    'the CLI must elevate parts through the shared renderer, not a private branch');
  assert.match(CLI, /verdictFacts\(report\)/);
  assert.match(CLI, /verdictChecks\(report\)/);
  assert.doesNotMatch(CLI, /const facts: Array<\[string, unknown\]>/,
    'the hand-built facts array must be gone');
});

test('the TUI Profile panel consumes the shared verdict renderer', () => {
  assert.match(TUI, /from '@lolly-tools\/node-shell\/verdict-report'/);
  assert.match(TUI, /verdictHeadline\(v, \{ elevateParts: true \}\)/,
    'the TUI headline must come from the shared renderer, so it cannot drift from the CLI again');
  assert.match(TUI, /verdictFacts\(report\)/);
  assert.match(TUI, /verdictChecks\(report\)/);
  assert.doesNotMatch(TUI, /if \(v\.state === 'lolly'\) push\(/,
    'the hand-copied headline if/else chain must be gone');
});

test('the MCP verify tool consumes the shared facts + checks, keeping its own headline', () => {
  assert.match(MCP, /from '\.\.\/\.\.\/\.\.\/packages\/node-shell\/src\/verdict-report\.ts'/);
  assert.match(MCP, /verdictFacts\(report\)/);
  assert.match(MCP, /verdictChecks\(report\)/);
  // MCP deliberately does NOT elevate parts - that quirk stays a property of the
  // shared slug table, so the flag must not appear here.
  assert.doesNotMatch(MCP, /elevateParts/,
    'MCP must keep parts a flag (no headline elevation)');
});

test('the MCP verify path documents why it ignores caller/env pinned roots', () => {
  // A hosted multi-tenant surface must not READ LOLLY_TRUST_ANCHOR (the two terminal
  // shells do); the reason is required and must stay visible next to the call.
  assert.match(MCP, /multi-tenant/i, 'the reason must be documented at the call site');
  assert.doesNotMatch(MCP, /process\.env\.LOLLY_TRUST_ANCHOR/,
    'MCP must not read the env pin - that would vouch for one tenant on another tenant’s file');
  assert.match(MCP, /verifyC2pa\(bytes, \{ trustAnchors: defaultTrustAnchors\(\{ includeLollyRoot: true \}\) \}\)/,
    'MCP verifies with the built-in set only');
});

test('repoRoot is resolved by the ONE shared resolver in TUI and MCP', () => {
  const tuiCatalog = read('../shells/tui/src/catalog.ts');
  const mcpPaths = read('../services/mcp/src/paths.ts');
  assert.match(tuiCatalog, /import \{ repoRoot \} from '@lolly-tools\/node-shell\/repo-root'/);
  assert.doesNotMatch(tuiCatalog, /export function repoRoot\(\)/,
    'the TUI must not carry its own weaker repoRoot twin');
  assert.match(mcpPaths, /repoRoot \} from '\.\.\/\.\.\/\.\.\/packages\/node-shell\/src\/repo-root\.ts'/);
  assert.match(mcpPaths, /REPO_ROOT = repoRoot\(\)/);
  assert.doesNotMatch(mcpPaths, /function resolveRoot\(\)/,
    'the MCP must not carry its own weaker resolveRoot twin');
});

test('the stale TUI "no Lolly-root pinning" comment is gone', () => {
  // The code pins the Lolly root (includeLollyRoot: true); the old comment claimed
  // the opposite in a security-sensitive verify path. It must not come back.
  assert.doesNotMatch(TUI, /no Lolly-root pinning/,
    'the comment must match the code (the Lolly root IS pinned)');
  assert.match(TUI, /includeLollyRoot: true/,
    'the corrected comment names the actual policy');
});
