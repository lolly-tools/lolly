// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly run design --document=<authoring json> --export=png` draws the artboard the
 * authoring keys describe (plan 291 W5). A PNG is drawn by the browser tier, so this
 * runs where one is installed.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { browserInstalled } from '@lolly-tools/node-shell/browsers';

const ROOT = new URL('..', import.meta.url);
const INPUT = new URL('./fixtures/author/input.json', import.meta.url).pathname;

test('run design --document renders an authoring document to PNG', {
  skip: browserInstalled() ? false : 'No browser installed; set LOLLY_BROWSER_CHANNEL=chrome.', timeout: 180_000,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-authoring-run-'));
  try {
    const output = join(dir, 'a1.png');
    const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'run', 'design', `--document=${INPUT}`, '--export=png', '--s=a1', `--output=${output}`], {
      cwd: ROOT, encoding: 'utf8', timeout: 170_000,
      env: { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1' },
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /Read 51 layers from .*authoring keys lowered/);
    const png = await readFile(output);
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1920, 1080]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
