// SPDX-License-Identifier: MPL-2.0
//
// Regression guard for a real production crash: opening /multi with 2+ sessions that
// SHARE an input (e.g. "Make variants → 4" on the since-removed daily-card) tore the whole view down with
//   TypeError: Cannot read properties of undefined (reading 'render')
// (the router error boundary "This view didn't finish loading").
//
// Root cause: multi-edit's shared-card fan-out "runtime" (multi-edit.ts) is a partial
// adapter - { setInput, getModel } - with NO `manifest`. renderInputs (tool-inputs.ts)
// reads the tool's density hint off `runtime.manifest.render`, and the optional chain was
// on `.render` instead of on `.manifest`, so a manifest-less runtime threw. Regression
// landed with the "dense pro inputs" change (2026-08-04); the shared-card contract comment
// that promised renderInputs only touches setInput/getModel had gone stale.
//
// Two independent guards - either alone stops the crash; both, so drift on either side
// re-fails. A source scan (not a mount) because renderInputs isn't exported and mounting
// /multi needs the full session/host stack; the invariant is textual and exact.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VIEWS = import.meta.dirname;
const toolInputs = readFileSync(resolve(VIEWS, 'tool-inputs.ts'), 'utf8');
const multiEdit = readFileSync(resolve(VIEWS, 'multi-edit.ts'), 'utf8');

test('renderInputs tolerates a manifest-less runtime (optional-chains runtime.manifest)', () => {
  // A bare `runtime.manifest.render` (dot, not `?.`) is the exact shape that crashed.
  assert.doesNotMatch(
    toolInputs, /runtime\.manifest\.render/,
    'tool-inputs.ts reads runtime.manifest.render UNGUARDED - multi-edit passes a manifest-less fanRuntime, so this throws. Optional-chain the manifest.',
  );
  assert.match(
    toolInputs, /runtime\.manifest\?\./,
    'the manifest read must optional-chain the manifest itself (runtime.manifest?.…), not just .render',
  );
});

test('multi-edit shared-card fanRuntime provides a manifest for renderInputs', () => {
  const block = multiEdit.match(/const fanRuntime = \{[\s\S]*?\}\s*as unknown as Runtime/);
  assert.ok(block, 'fanRuntime adapter literal not found - did the shared-card runtime move or get renamed?');
  assert.match(
    block[0], /\bmanifest\s*:/,
    'fanRuntime must expose a `manifest` - renderInputs reads runtime.manifest for the density hint; a { setInput, getModel } adapter alone crashes /multi.',
  );
});
