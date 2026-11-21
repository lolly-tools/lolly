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
  const nul = await exec(process.execPath, [entry, 'projects', 'list', '--null', '--query=conference'], { env });
  assert.equal(nul.stdout, 'fixture/with spaces\0');
  const files = await exec(process.execPath, [entry, 'projects', 'list', '--null', '--paths', '--query=conference'], { env });
  assert.ok(files.stdout.endsWith('.json\0'));
  assert.equal(JSON.parse(await readFile(files.stdout.slice(0, -1), 'utf8')).slot, 'fixture/with spaces');
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

test('a session whose picture is a file (format 5): export inlines it, copy points at the same file, a rename keeps it', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { previewRefFor } = await import('../engine/src/session-preview.ts');
  const { sessionPicturePath, readSessionRecord } = await import('../packages/node-shell/src/session-store.ts');
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
  const preview = (await previewRefFor(png, 'image/png', { route: 'export-raster' }))!;
  await mkdir(join(state, 'saved-state', 'previews'), { recursive: true });
  await writeFile(sessionPicturePath(state, preview), png);
  await writeSessionRecord(state, { slot: 'pictured', label: 'Pictured', data: { __toolId: 'batch-fixture' }, preview });
  const run = async (args: string[]) => JSON.parse((await exec(process.execPath, [entry, 'projects', ...args, '--json'], { env })).stdout);
  const out = join(root, 'pictured.json');
  await run(['export', 'pictured', `--output=${out}`]);
  const exported = JSON.parse(await readFile(out, 'utf8'));
  assert.equal(exported.thumb, `data:image/png;base64,${btoa(String.fromCharCode(...png))}`, 'the export carries the picture inline, as it always did');
  assert.equal(exported.preview, undefined);
  const copy = await run(['copy', 'pictured', '--label=Copy']);
  assert.equal((await readSessionRecord(state, copy.result.slot))?.preview?.key, preview.key, 'the copy points at the same picture file');
  await writeSessionRecord(state, { slot: 'pictured', label: 'Renamed', data: { __toolId: 'batch-fixture', __label: 'Renamed' } });
  assert.equal((await readSessionRecord(state, 'pictured'))?.preview?.key, preview.key, 'a write with no picture keeps the one the record had');
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
