// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly tui` - the interactive shell started from the one-shot one (plans/202 WP1.4).
 *
 * The behaviour worth pinning is the boring one: the verb is reserved (so no tool id can
 * ever shadow it), it resolves a real entry on this disk, and starting it with no
 * terminal fails the way the TUI itself fails, with the TUI's own sentence and a
 * non-zero code. A verb that swallowed the child's exit code would report success for a
 * shell that never started.
 *
 * Run with: node --test tests/cli-tui-verb.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { RESERVED_SUBCOMMANDS } from '../shells/cli/src/args.ts';
import { resolveTuiLaunch } from '../shells/cli/src/tui.ts';

const run = promisify(execFile);
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOLLY = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');

test('`tui` is a reserved subcommand, so a tool id can never shadow it', () => {
  assert.ok((RESERVED_SUBCOMMANDS as readonly string[]).includes('tui'));
});

test('in the checkout, the launch resolves to the .tsx entry under the tsx loader', () => {
  const launch = resolveTuiLaunch();
  assert.equal(launch.kind, 'repo');
  const entry = launch.args.at(-1)!;
  assert.ok(entry.endsWith(join('shells', 'tui', 'bin', 'lolly-tui.tsx')), `unexpected entry: ${entry}`);
  assert.ok(existsSync(entry), 'the TUI entry must exist on disk');
  assert.equal(launch.args[0], '--import', 'the .tsx source needs a loader, since Node does not strip JSX');
  assert.match(launch.args[1]!, /^file:\/\/.*tsx/, 'the loader is passed as an absolute file URL, not a bare specifier');
});

test('`lolly tui` with no terminal exits non-zero and says a terminal is needed', async () => {
  await assert.rejects(
    // Piped stdio means the child sees no TTY, the same situation as `lolly tui | cat`
    // or a CI runner.
    () => run(process.execPath, [LOLLY, 'tui'], { encoding: 'utf8' }),
    (err: Error & { code?: number; stderr?: string; stdout?: string }) => {
      assert.ok(typeof err.code === 'number' && err.code !== 0, `expected a non-zero exit, got ${err.code}`);
      assert.match(err.stderr ?? '', /interactive terminal \(TTY\)/);
      assert.equal(err.stdout, '', 'stdout carries the payload and nothing else');
      return true;
    },
  );
});
