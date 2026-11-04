// SPDX-License-Identifier: MPL-2.0
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSessionRecord } from '../packages/node-shell/src/session-store.ts';
import { terminalContent } from './helpers/terminal-content.ts';

const root = await mkdtemp(join(tmpdir(), 'lolly-project-cli-'));
after(() => rm(root, { recursive: true, force: true }));
await terminalContent(root);
const state = join(root, 'state');
const env = { ...process.env, LOLLY_STATE_DIR: state, LOLLY_ROOT: root };
const entry = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
const exec = promisify(execFile);

test('project discovery, private export and explicit copy use the shared records', async () => {
  await writeSessionRecord(state, {
    slot: 'fixture/with spaces',
    label: 'Conference',
    data: { __toolId: 'batch-fixture', label: 'Private fixture', __tui_query: 'w=812' },
  });
  const run = async (args: string[]) =>
    JSON.parse(
      (await exec(process.execPath, [entry, 'projects', ...args, '--json'], { env })).stdout
    );
  const listed = await run(['list', '--query=conference']);
  assert.equal(listed.command, 'projects');
  assert.equal(listed.result.length, 1);
  assert.ok(!JSON.stringify(listed.result).includes('Private fixture'));
  const shown = await run(['show', 'fixture/with spaces']);
  assert.equal(shown.result.data.label, 'Private fixture');
  const path = join(root, 'private project.json');
  await run(['export', 'fixture/with spaces', `--output=${path}`]);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).slot, 'fixture/with spaces');
  if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(run(['export', 'fixture/with spaces', `--output=${path}`]));
  const copy = await run(['copy', 'fixture/with spaces', '--label=Second']);
  assert.notEqual(copy.result.slot, 'fixture/with spaces');
  assert.equal((await run(['list'])).result.length, 2);
  assert.equal((await run(['show', 'fixture/with spaces'])).result.label, 'Conference');
});

test('run reads private input JSON from stdin and explicit flags win', async () => {
  const child = spawn(
    process.execPath,
    [entry, 'run', 'batch-fixture', '--inputs=-', '--label=Explicit', '--share', '--width=812'],
    { env, stdio: ['pipe', 'pipe', 'pipe'] }
  );
  let stdout = '';
  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });
  child.stderr.resume();
  child.stdin.end(JSON.stringify({ label: 'From JSON' }));
  const code = await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(code, 0);
  const query = new URLSearchParams(stdout.trim().split('?')[1]);
  assert.equal(query.get('label'), 'Explicit');
  assert.equal(query.get('w'), '812');
});
