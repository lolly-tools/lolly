// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { privateCaEnvPath, privateCredentialDirectory } from '../scripts/run-private-ca.ts';

const REPO = path.resolve(import.meta.dirname, '..');

test('private CA environment defaults to the sibling private store', () => {
  assert.match(privateCredentialDirectory({}), /lolly-private[/\\]lolly$/);
});

test('private CA environment accepts only owner-private regular paths', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lolly-private-env-'));
  const store = path.join(root, 'lolly');
  const envPath = path.join(store, 'ca.env');
  try {
    mkdirSync(store, { mode: 0o700 });
    writeFileSync(envPath, 'CA_SERVICE_SECRET=test-only\n', { mode: 0o600 });
    assert.equal(privateCaEnvPath({ LOLLY_PRIVATE_DIR: store }), envPath);

    chmodSync(envPath, 0o644);
    assert.throws(
      () => privateCaEnvPath({ LOLLY_PRIVATE_DIR: store }),
      /permits group or other access/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('private CA environment refuses symlinked credential files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lolly-private-env-'));
  const store = path.join(root, 'lolly');
  const source = path.join(root, 'source.env');
  try {
    mkdirSync(store, { mode: 0o700 });
    writeFileSync(source, 'CA_SERVICE_SECRET=test-only\n', { mode: 0o600 });
    symlinkSync(source, path.join(store, 'ca.env'));
    assert.throws(() => privateCaEnvPath({ LOLLY_PRIVATE_DIR: store }), /not a regular file/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('MCP deploy refuses a broadly readable private environment before sourcing it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lolly-private-env-'));
  const store = path.join(root, 'lolly');
  const envPath = path.join(store, 'mcp-deploy.env');
  try {
    mkdirSync(store, { mode: 0o700 });
    writeFileSync(envPath, 'PROJECT_ID=test-only\n', { mode: 0o644 });
    const result = spawnSync('bash', ['services/mcp/deploy/deploy.sh'], {
      cwd: REPO,
      encoding: 'utf8',
      env: {
        LOLLY_MCP_DEPLOY_ENV_FILE: envPath,
        LOLLY_PRIVATE_DIR: store,
        PATH: process.env.PATH,
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /permits group or other access/);
    assert.doesNotMatch(result.stderr, /LOLLY_MCP_TOKEN/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
