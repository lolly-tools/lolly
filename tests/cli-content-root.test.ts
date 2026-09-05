// SPDX-License-Identifier: MPL-2.0
/**
 * The no-content refusal (plans/202 WP1.2, plans/131).
 *
 * The published CLI carries no tools and no catalog, so the first thing many people will
 * do is run it with nothing to render. That has to answer with the routes to a root and
 * exit 3 UNAVAILABLE_HERE - the "impossible in THIS installation" code - rather than an
 * ENOENT at exit 2, which reads as "you typed it wrong".
 *
 * Run with: node --test tests/cli-content-root.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import {
  assertContentRoot, needsContentRoot, noContentRootMessage,
} from '../shells/cli/src/content-root.ts';
import { EXIT } from '../shells/cli/src/exit-codes.ts';

const EMPTY = mkdtempSync(join(tmpdir(), 'lolly-no-content-'));

test('the commands that need tools and a catalog are the ones that render', () => {
  for (const cmd of ['list', 'describe', 'run', 'assets', 'batch', 'smoke', 'preflight', 'tui', 'qr-code', undefined]) {
    assert.equal(needsContentRoot(cmd), true, `${cmd} needs content`);
  }
  // File-in file-out and the design-system store work on a bare install.
  for (const cmd of ['validate', 'system', 'start', 'completion', 'models', 'speak', 'ocr', 'pack']) {
    assert.equal(needsContentRoot(cmd), false, `${cmd} must run with no catalog`);
  }
});

test('a root with no catalog index refuses with exit 3 and a stable kind', () => {
  assert.throws(
    () => assertContentRoot(EMPTY, {}),
    (err: Error & { exit?: number; kind?: string }) => {
      assert.equal(err.exit, EXIT.UNAVAILABLE_HERE);
      assert.equal(err.kind, 'NO_CONTENT_ROOT');
      return true;
    },
  );
});

test('the message names all three routes, and no fourth one', () => {
  const message = noContentRootMessage(EMPTY, {});
  assert.match(message, /LOLLY_ROOT=/, 'route 1: a directory holding tools/ and catalog/');
  assert.match(message, /desktop app/i, 'route 2: the installed app');
  assert.match(message, /lolly system import/, 'route 3: a design-system pack');
  // `lolly system import` stores colours, fonts and logos (shells/cli/src/system.ts). It
  // adds no tools, and the message must not imply it does.
  assert.match(message, /adds no tools/i);
  // There is no download to offer, so nothing may read like one.
  assert.doesNotMatch(message, /\b(download|curl|wget|https?:\/\/)/i);
});

test('a LOLLY_ROOT that was set but has no catalog is named in the message', () => {
  const message = noContentRootMessage(EMPTY, { LOLLY_ROOT: EMPTY });
  assert.match(message, /LOLLY_ROOT is set to/);
  assert.ok(message.includes(EMPTY));
});

test('this checkout HAS content, so the guard stays out of the way', () => {
  assert.doesNotThrow(() => assertContentRoot(repoRoot(), {}));
});
