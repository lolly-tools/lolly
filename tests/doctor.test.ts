// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { countPathHashMatches, parseSubmoduleStatus, signingState } from '../scripts/doctor.ts';

test('doctor classifies missing and conflicted submodules', () => {
  assert.deepEqual(parseSubmoduleStatus('-abc one\nUdef two\n abc three\n'), {
    missing: ['one'],
    conflicted: ['two'],
  });
});

test('doctor verifies catalogue signing key pairs without exposing them', () => {
  const first = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const second = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privateJwk = JSON.stringify(first.privateKey.export({ format: 'jwk' }));
  const publicJwk = JSON.stringify(first.publicKey.export({ format: 'jwk' }));
  const wrongJwk = JSON.stringify(second.publicKey.export({ format: 'jwk' }));
  assert.equal(signingState(privateJwk, publicJwk).state, 'PASS');
  assert.equal(signingState(privateJwk, wrongJwk).state, 'FAIL');
  assert.equal(signingState().state, 'WARN');
});

test('doctor detects inventoried paths by hash without reading file contents', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lolly-doctor-paths-'));
  const relative = 'nested/private.env';
  try {
    mkdirSync(path.join(root, 'nested'));
    writeFileSync(path.join(root, relative), 'never inspected');
    const hashes = new Set([createHash('sha256').update(relative).digest('hex')]);
    assert.equal(countPathHashMatches(root, hashes), 1);
    assert.equal(countPathHashMatches(root, new Set()), 0);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
