// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';

import { GITLEAKS_VERSION, gitleaksArgs, parseOptions } from '../scripts/scan-secrets.ts';

test('secret scanner is version-pinned and redacts every scan mode', () => {
  assert.equal(GITLEAKS_VERSION, '8.29.1');

  for (const options of [
    parseOptions([]),
    parseOptions(['--staged']),
    parseOptions(['--checkout', '--confirm-untracked']),
  ]) {
    const args = gitleaksArgs(options);
    assert.ok(args.includes('--redact'));
    assert.ok(args.includes('--config=.gitleaks.toml'));
  }
});

test('the scanner canary is assembled at runtime, not stored as a token', () => {
  const source = ['AKIA', 'QWERTYUIOP12ASDF'].join('');
  assert.equal(source.length, 20);
  assert.match(source, /^AKIA[A-Z0-9]{16}$/);
});

test('whole-checkout secret scanning requires explicit acknowledgement', () => {
  assert.throws(() => parseOptions(['--checkout']), /reads ignored and untracked files/);
  assert.throws(() => parseOptions(['--confirm-untracked']), /only valid with --checkout/);
  assert.throws(() => parseOptions(['--staged', '--checkout']), /choose only one/);
});

test('whole-checkout scanning skips oversized binary/model artifacts', () => {
  const args = gitleaksArgs(parseOptions(['--checkout', '--confirm-untracked']));
  assert.ok(args.includes('--max-target-megabytes=10'));
});
