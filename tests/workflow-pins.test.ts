// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');
const workflowFiles = readdirSync(workflowDir)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => path.join(workflowDir, name));
const automationFiles = [...workflowFiles, path.join(repoRoot, 'action', 'action.yml')];

test('the rendering action defaults to an immutable source commit', () => {
  const action = readFileSync(path.join(repoRoot, 'action/action.yml'), 'utf8');
  const input = action.match(/\n[ ]{2}lolly-ref:\n([\s\S]*?)(?=\n[ ]{2}[a-z][a-z-]*:)/)?.[1];
  assert.ok(input);
  assert.match(input, /default: '[0-9a-f]{40}'/);
});

test('third-party workflow actions are pinned to immutable commits', () => {
  const mutable: string[] = [];
  for (const filename of automationFiles) {
    const relative = path.relative(repoRoot, filename);
    const lines = readFileSync(filename, 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
      if (!match) continue;
      const reference = match[1];
      if (!reference) continue;
      if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
      if (!/@[0-9a-f]{40}$/i.test(reference)) {
        mutable.push(`${relative}:${index + 1}: ${reference}`);
      }
    }
  }
  assert.deepEqual(mutable, [], `mutable action references:\n${mutable.join('\n')}`);
});

test('downloaded CI executables are verified before execution and caches bind the digest', () => {
  const ci = readFileSync(path.join(workflowDir, 'ci.yml'), 'utf8');
  const requirements = [
    ['Gitleaks', 'GITLEAKS_LINUX_X64_SHA256'],
    ['c2patool', 'C2PATOOL_LINUX_X64_SHA256'],
    ['Opengrep', 'OPENGREP_MANYLINUX_X86_SHA256'],
  ] as const;

  for (const [name, variable] of requirements) {
    assert.match(ci, new RegExp(`${variable}: '[0-9a-f]{64}'`), `${name} digest is not pinned`);
    assert.match(
      ci,
      new RegExp(`echo "\\$${variable}  [^\\n]+" \\| sha256sum --check`),
      `${name} is not checked before execution`,
    );
  }

  const c2paDigest = ci.match(/C2PATOOL_LINUX_X64_SHA256: '([0-9a-f]{64})'/)?.[1];
  assert.ok(c2paDigest);
  assert.match(ci, new RegExp(`key: c2patool-[^\\n]*-${c2paDigest}`));

  // cargo-audit is a verified release binary in CI and in the nightly and release-tag audit, never a build.
  const advisories = readFileSync(path.join(workflowDir, 'dependency-audit.yml'), 'utf8');
  const cargoAuditDigests = [ci, advisories].map((text) => {
    assert.match(text, /echo "\$CARGO_AUDIT_LINUX_X64_SHA256 {2}[^\n]+" \| sha256sum --check/, 'cargo-audit is not checked before execution');
    assert.doesNotMatch(text, /cargo install cargo-audit/);
    return text.match(/CARGO_AUDIT_LINUX_X64_SHA256: '([0-9a-f]{64})'/)?.[1];
  });
  assert.ok(cargoAuditDigests[0], 'cargo-audit digest is not pinned');
  assert.equal(cargoAuditDigests[1], cargoAuditDigests[0], 'both workflows pin the same cargo-audit release');
});
