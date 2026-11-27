// SPDX-License-Identifier: MPL-2.0
/**
 * LOLLY_HOOK_WORKER=1 runs a tool's hooks in a worker thread. The thread must not keep
 * the CLI alive once the render is written: adding a 'message' listener to a Worker refs
 * its port again, so an unref made before the listeners is undone and the process never
 * exits. This runs the real CLI and asserts that the file is written and the process ends.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('the CLI exits after a render whose hooks ran in a worker thread', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-hook-worker-exit-'));
  try {
    const output = join(dir, 'qr.svg');
    const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'qr-code', '--url=https://example.com', `--output=${output}`], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, LOLLY_HOOK_WORKER: '1', LOLLY_STATE_DIR: join(dir, 'state') },
    });
    assert.equal(run.signal, null, 'the process ended by itself, not by the timeout');
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /hooks running in a worker thread/, 'the hooks did run in a thread');
    assert.match(await readFile(output, 'utf8'), /^<svg|<\?xml/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
