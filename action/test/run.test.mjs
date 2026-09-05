// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ActionInputError,
  parseJsonArgs,
  parseLegacyArgs,
  resolveWorkspacePath,
  runAction,
  toolArgsFromEnv,
  validateToolArgs,
} from '../run.mjs';

test('legacy args preserve quoted values without invoking a shell', () => {
  assert.deepEqual(
    parseLegacyArgs('--url=https://example.com?a=1 --text="Hello world" --padding=2'),
    ['--url=https://example.com?a=1', '--text=Hello world', '--padding=2'],
  );
});

test('legacy args reject every shell execution/control form', () => {
  for (const payload of [
    '--text=$(touch marker)',
    '--text=`touch marker`',
    '--text=x;touch marker',
    '--text=x&&touch marker',
    '--text=x|touch marker',
    '--text=x>marker',
    '--text=${TOKEN}',
    '--text=x\ntouch marker',
  ]) {
    assert.throws(() => parseLegacyArgs(payload), ActionInputError, payload);
  }
});

test('args-json accepts shell metacharacters as literal argv data', () => {
  assert.deepEqual(
    parseJsonArgs('["--text=$(this is data); | > `still data`", "--size=120"]'),
    ['--text=$(this is data); | > `still data`', '--size=120'],
  );
});

test('only one argument transport is accepted', () => {
  assert.throws(
    () => toolArgsFromEnv({ IN_ARGS: '--size=12', IN_ARGS_JSON: '["--size=12"]' }),
    /only one/,
  );
});

test('tool args cannot override action-owned output controls or add positionals', () => {
  for (const arg of ['--output=/tmp/stolen', '--export=png', '--format=png', 'touch', '--bad key=x']) {
    assert.throws(() => validateToolArgs([arg]), ActionInputError, arg);
  }
});

test('workspace paths reject absolute and parent escapes', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'lolly-action-path-'));
  try {
    assert.equal(resolveWorkspacePath(workspace, 'out/files', 'out-dir'), join(workspace, 'out/files'));
    assert.throws(() => resolveWorkspacePath(workspace, '../escape', 'out-dir'), /inside/);
    assert.throws(() => resolveWorkspacePath(workspace, '/tmp/escape', 'out-dir'), /workspace-relative/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('the runner passes hostile JSON values literally with shell:false', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'lolly-action-run-'));
  const repo = join(workspace, '.lolly-render-action');
  const cliDir = join(repo, 'shells/cli/bin');
  const outputFile = join(workspace, 'github-output.txt');
  const captureFile = join(workspace, 'argv.json');
  const markerFile = join(workspace, 'must-not-exist');
  mkdirSync(cliDir, { recursive: true });
  writeFileSync(
    join(cliDir, 'lolly.ts'),
    `import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const args = process.argv.slice(2);
const output = args.find((arg) => arg.startsWith('--output='))?.slice(9);
if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, '<svg/>'); }
writeFileSync(process.env.CAPTURE_PATH, JSON.stringify(args));
`,
    'utf8',
  );
  writeFileSync(outputFile, '', 'utf8');

  const literal = `--text=$(touch ${markerFile}); | > \`still-data\``;
  try {
    const result = runAction({
      ...process.env,
      GITHUB_WORKSPACE: workspace,
      GITHUB_OUTPUT: outputFile,
      CAPTURE_PATH: captureFile,
      IN_TOOL: 'qr-code',
      IN_ARGS: '',
      IN_ARGS_JSON: JSON.stringify([literal, '--padding=2']),
      IN_ROWS: '',
      IN_FORMAT: 'svg',
      IN_OUT_DIR: './lolly-out',
      IN_BROWSER: 'false',
      IN_PROFILE_ROOT: '',
    }, { cwd: repo });

    const argv = JSON.parse(readFileSync(captureFile, 'utf8'));
    assert.deepEqual(argv.slice(0, 3), ['qr-code', literal, '--padding=2']);
    assert.equal(existsSync(markerFile), false, 'command substitution must remain inert data');
    assert.deepEqual(result.files, ['qr-code.svg']);
    assert.match(readFileSync(outputFile, 'utf8'), /files<<LOLLY_FILES_[a-f0-9]+/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('the runner refuses a symlinked output directory outside the workspace', { skip: process.platform === 'win32' }, () => {
  const workspace = mkdtempSync(join(tmpdir(), 'lolly-action-link-'));
  const outside = mkdtempSync(join(tmpdir(), 'lolly-action-outside-'));
  try {
    symlinkSync(outside, join(workspace, 'linked-out'), 'dir');
    assert.throws(
      () => runAction({
        ...process.env,
        GITHUB_WORKSPACE: workspace,
        GITHUB_OUTPUT: join(workspace, 'github-output.txt'),
        IN_TOOL: 'qr-code',
        IN_ARGS_JSON: '[]',
        IN_FORMAT: 'svg',
        IN_OUT_DIR: './linked-out',
        IN_BROWSER: 'false',
      }, { cwd: workspace }),
      /symlink/,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

