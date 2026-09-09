// SPDX-License-Identifier: MPL-2.0
/**
 * Text sources must not carry raw NUL bytes. A single 0x00 makes git classify the
 * file as binary: no diff in review, no blame, `git grep` and `cut` choke on it.
 * Seven files had one on 2026-09-08 (a NUL used as a key separator or a hostile-
 * input fixture, typed as the character instead of the escape). Write the
 * six-character escape instead.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const REPO = join(import.meta.dirname, '..');
const ROOTS = ['engine/src', 'shells/web/src', 'shells/cli/src', 'shells/tui/src', 'packages', 'scripts', 'tests', 'services/mcp/src'];
const TEXT = /\.(?:ts|mts|js|mjs|cjs|css|json|md|html|yml|yaml|txt|svg)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'vendor', '.browsers', 'fixtures', 'golden', 'corpus']);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) yield* walk(full);
    else if (TEXT.test(name) && !/\.min\.js$/.test(name)) yield full;
  }
}

test('no text source under the engine, shells, packages, scripts or tests holds a raw NUL byte', () => {
  const offenders: string[] = [];
  let scanned = 0;
  for (const root of ROOTS) {
    const abs = join(REPO, root);
    if (!statSync(abs, { throwIfNoEntry: false })) continue;
    for (const file of walk(abs)) {
      scanned += 1;
      if (readFileSync(file).includes(0)) offenders.push(relative(REPO, file));
    }
  }
  assert.ok(scanned > 1000, `expected to scan the tree, saw ${scanned} files`);
  assert.deepEqual(offenders, [], `raw NUL bytes in: ${offenders.join(', ')} - write the \\u0000 escape instead`);
});
