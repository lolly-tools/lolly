// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { regressions, summarizeDiagnostics } from '../scripts/check-changed-lint.ts';

test('lint ratchet reports only per-file category growth', () => {
  const baseline = { 'a.ts': { 'error/lint/a': 2, 'warning/lint/b': 1 } };
  const current = { 'a.ts': { 'error/lint/a': 1, 'warning/lint/b': 2 } };
  assert.deepEqual(regressions(baseline, current), ['a.ts: warning/lint/b 1 -> 2']);
});

test('lint diagnostics are keyed by severity and category', () => {
  assert.deepEqual(summarizeDiagnostics([
    { severity: 'error', category: 'lint/a', location: { path: 'a.ts' } },
    { severity: 'error', category: 'lint/a', location: { path: 'a.ts' } },
  ]), { 'a.ts': { 'error/lint/a': 2 } });
});
