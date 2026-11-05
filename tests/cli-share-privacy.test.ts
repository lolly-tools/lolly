// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
const env = { ...process.env, LOLLY_PROFILE: 'lolly-demo' };

test('CLI links omit personal fields unless explicitly reviewed and retain requested export settings', async () => {
  const args = [
    entry,
    'run',
    'captions',
    '--transcript=PERSONAL_SHARE_FIXTURE',
    '--share',
    '--width=812',
    '--export=pdf',
  ];
  const publicLink = await run(process.execPath, args, { env });
  assert.ok(!publicLink.stdout.includes('PERSONAL_SHARE_FIXTURE'));
  assert.match(publicLink.stderr, /omits personal fields: transcript/);
  const params = new URLSearchParams(publicLink.stdout.trim().split('?')[1]);
  assert.equal(params.get('w'), '812');
  assert.equal(params.get('format'), 'pdf');
  const reviewed = await run(process.execPath, [...args, '--include-personal'], { env });
  assert.ok(reviewed.stdout.includes('PERSONAL_SHARE_FIXTURE'));
});
