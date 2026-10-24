// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';

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

test('ffmpeg is a pinned release whose archive and cached binaries are verified, not an apt package', () => {
  const ci = readFileSync(path.join(workflowDir, 'ci.yml'), 'utf8');
  assert.doesNotMatch(ci, /apt-get install[^\n]*\bffmpeg\b/, 'ffmpeg comes from the pinned release, not apt');
  const archive = ci.match(/FFMPEG_LINUX_X64_SHA256: '([0-9a-f]{64})'/)?.[1];
  assert.ok(archive, 'ffmpeg archive digest is not pinned');
  assert.match(ci, /echo "\$FFMPEG_LINUX_X64_SHA256 {2}\$archive" \| sha256sum --check/, 'ffmpeg archive is not checked before extraction');
  assert.match(ci, new RegExp(`key: ffmpeg-[^\\n]*-${archive}\\n`), 'the ffmpeg cache key does not bind the archive digest');
  // A cache hit skips the download, so the cached binaries are checked on every run before anything executes them.
  for (const variable of ['FFMPEG_BIN_SHA256', 'FFPROBE_BIN_SHA256']) assert.match(ci, new RegExp(`${variable}: '[0-9a-f]{64}'`), variable);
  const check = ci.split('- name: Check ffmpeg and put it on PATH')[1]?.split('\n      - name: ')[0] ?? '';
  const verify = check.indexOf('sha256sum --check'), firstRun = check.indexOf('"$ff/ffmpeg" -hide_banner');
  assert.ok(verify > 0 && firstRun > verify, 'cached ffmpeg runs before its binaries are verified');
  assert.ok(check.indexOf('>> "$GITHUB_PATH"') > firstRun, 'ffmpeg reaches PATH before its capability check');
});

test('every CI apt install has short command limits, bounded retries and mirror failover', () => {
  const ci = parse(readFileSync(path.join(workflowDir, 'ci.yml'), 'utf8')) as {
    jobs: Record<string, { steps: { name?: string; run?: string; 'timeout-minutes'?: number }[] }>;
  };
  const installs = new Set<string>();
  for (const [job, { steps }] of Object.entries(ci.jobs)) {
    for (const step of steps) {
      const run = step.run ?? '';
      if (!/apt-get\s|install-deps\s/.test(run)) continue;
      const label = `${job}: ${step.name}`;
      installs.add(run);
      assert.ok(step['timeout-minutes'] && step['timeout-minutes'] <= 20, `${label}: missing bounded step timeout`);
      const retry = run.match(/for attempt in 1 2 3 4; do([\s\S]*?)\n\s*done/);
      assert.ok(retry, `${label}: missing four-attempt retry loop`);
      const body = retry[1] ?? '';
      assert.match(body, /if \[ "\$attempt" -gt 1 \]; then\s+sudo timeout -k 10 120 dpkg --configure -a \|\| true\s+if \[ -f \/etc\/apt\/apt-mirrors\.txt \]; then/, `${label}: retries must repair dpkg and switch mirrors`);
      assert.match(body, /printf 'https:\/\/archive\.ubuntu\.com\/ubuntu\/\\tpriority:1\\nhttps:\/\/security\.ubuntu\.com\/ubuntu\/\\tpriority:2\\nhttp:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/\\tpriority:3\\n' \|\s+sudo tee \/etc\/apt\/apt-mirrors\.txt > \/dev\/null\s+fi\s+fi\s+if sudo timeout -k 15 90 apt-get update &&/, `${label}: mirror failover must precede the next update`);
      for (const line of run.split('\n').filter((line) => /apt-get\s|install-deps\s/.test(line))) {
        assert.ok(body.includes(line), `${label}: apt command outside retry loop`);
        assert.match(line, /sudo timeout -k 15 (?:90 apt-get update|180 apt-get install|180 "\$node_bin" \S+ install-deps)\b/, `${label}: apt command lacks a short root timeout`);
      }
      assert.match(body, /; then (?:exit 0|break); fi/, `${label}: missing success path`);
      assert.match(body, /echo "::warning::[^"\n]+ install attempt \$attempt failed or stalled"/, `${label}: missing per-attempt warning`);
      assert.match(body, /sleep 10/, `${label}: missing retry delay`);
      assert.match(run, /exit 1/, `${label}: exhausted retries must fail`);
    }
  }
  assert.ok(installs.size >= 6, 'expected Chromium, Firefox/WebKit, nginx, Poppler, Tauri and qpdf installs');
});
