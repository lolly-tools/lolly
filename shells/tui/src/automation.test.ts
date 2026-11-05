// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { TERMINAL_WORKFLOWS } from './automation.ts';
import { startCliProcess } from './cli-process.ts';

test('terminal actions delegate to existing commands and do not fetch models', () => {
  assert.deepEqual(TERMINAL_WORKFLOWS.find((workflow) => workflow.id === 'models')?.args({}), [
    'models',
    'ls',
  ]);
  const path = '/tmp/source with spaces; $(not-a-shell).csv';
  const args = TERMINAL_WORKFLOWS.find((workflow) => workflow.id === 'convert')!.args({
    source: path,
    format: 'json',
    output: '/tmp/output.json',
  });
  assert.equal(args[2], path);
  assert.equal(args[3], '--to=json');
  assert.ok(!TERMINAL_WORKFLOWS.some((workflow) => workflow.args({}).includes('fetch')));
});

test('the shared process transport reaches a real content-free CLI entry', async () => {
  const child = startCliProcess(['--version']);
  let output = '';
  child.stdout.on('data', (data) => {
    output += data.toString();
  });
  child.stderr.resume();
  assert.equal(await new Promise((resolve) => child.once('close', resolve)), 0);
  assert.match(output, /^lolly \d/);
});
