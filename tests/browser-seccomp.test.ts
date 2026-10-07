// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const directory = new URL('../deploy/docker/seccomp/', import.meta.url);
const baselineBytes = readFileSync(new URL('containerd-v2.2.7-no-caps.json', directory));
const browserBytes = readFileSync(new URL('public-browser-sandbox.json', directory));
interface Rule {
  names: string[];
  action: string;
  errnoRet?: number;
  args?: { index: number; value: number; valueTwo?: number; op: string }[];
}
interface Profile {
  defaultAction: string;
  syscalls: Rule[];
  [key: string]: unknown;
}
const baseline = JSON.parse(baselineBytes.toString()) as Profile;
const browser = JSON.parse(browserBytes.toString()) as Profile;
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

test('browser profile is pinned to the captured no-capability RuntimeDefault', () => {
  assert.equal(
    hash(baselineBytes),
    'db20464841fe2183251850805de9269b69f2f4acc819d6a9f7276d12a469b5b3'
  );
  assert.equal(
    hash(browserBytes),
    '8f01960c1777252f6c70b64e00fdccec95e86b37f7617cb798df3e36fd987a9b'
  );
  assert.equal(baseline.defaultAction, 'SCMP_ACT_ERRNO');
  assert.equal(baseline.syscalls.length, 13);
});

test('only the four measured Chromium namespace calls extend the original permissions', () => {
  const { syscalls: original, ...originalProperties } = baseline;
  const { syscalls: extended, ...extendedProperties } = browser;
  assert.deepEqual(extendedProperties, originalProperties);
  assert.equal(extended.length, original.length + 1);
  assert.deepEqual(extended.slice(0, original.length), original);
  assert.deepEqual(extended.at(-1), {
    names: ['clone', 'setns', 'unshare', 'chroot'],
    action: 'SCMP_ACT_ALLOW',
    args: [],
  });
  for (const syscall of [
    'mount',
    'bpf',
    'reboot',
    'init_module',
    'finit_module',
    'delete_module',
  ]) {
    assert.equal(
      extended.some((rule) => rule.action === 'SCMP_ACT_ALLOW' && rule.names.includes(syscall)),
      false,
      syscall
    );
  }
  const clone3 = extended.find((rule) => rule.names.includes('clone3'));
  assert.ok(clone3);
  assert.equal(clone3.action, 'SCMP_ACT_ERRNO');
  assert.equal(clone3.errnoRet, 38);
});
