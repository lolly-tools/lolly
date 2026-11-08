// SPDX-License-Identifier: MPL-2.0
// scripts/ci/fetch-release-asset.sh: the public release URL first, the REST API
// through gh second, the token only in the environment, and nothing left
// behind on failure. Fake curl and gh stand in for the network.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'ci', 'fetch-release-asset.sh');
const TOKEN = 'synthetic-token-value-7f3a';

function run(options: { curl: 'ok' | 'fail'; gh: 'ok' | 'fail' | 'absent'; env?: Record<string, string>; args?: string[]; trace?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-fetch-release-'));
  try {
    const bin = join(dir, 'bin'), out = join(dir, 'out');
    mkdirSync(bin); mkdirSync(out);
    const log = join(dir, 'calls.log');
    const tool = (name: string, body: string) => {
      writeFileSync(join(bin, name), `#!/bin/bash\nprintf '%s\\n' "${name} $*" >> "${log}"\n${body}\n`);
      chmodSync(join(bin, name), 0o755);
    };
    tool('curl', options.curl === 'ok'
      ? 'while (($#)); do if [[ "$1" == --output ]]; then printf direct > "$2"; fi; shift; done'
      : 'echo "curl: (56) The requested URL returned error: 504" >&2; exit 56');
    if (options.gh !== 'absent') {
      tool('gh', options.gh === 'ok'
        ? `printf 'GH_TOKEN=%s\\n' "\${GH_TOKEN:-}" >> "${log}"\nwhile (($#)); do if [[ "$1" == --output ]]; then printf api > "$2"; fi; shift; done`
        : 'exit 1');
    }
    tool('sleep', 'exit 0');
    // Only the fakes and the few utilities the script needs, so a real gh or curl is never reachable.
    for (const name of ['mktemp', 'dirname', 'mv', 'rm']) {
      const found = ['/usr/bin', '/bin'].map(root => join(root, name)).find(path => existsSync(path));
      assert.ok(found, name);
      symlinkSync(found, join(bin, name));
    }
    const env = { PATH: bin, ...options.env };
    const output = join(out, 'asset.tar.gz');
    const args = options.args ?? ['rustsec/rustsec', 'cargo-audit/v0.22.2', 'cargo-audit-x86_64-unknown-linux-musl-v0.22.2.tgz', output];
    const result = spawnSync('/bin/bash', [...(options.trace ? ['-x'] : []), SCRIPT, ...args], { env, encoding: 'utf8' });
    const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
    return {
      status: result.status, stdout: result.stdout, stderr: result.stderr, calls,
      bytes: existsSync(output) ? readFileSync(output, 'utf8') : null,
      leftovers: readdirSync(out).filter(name => name !== 'asset.tar.gz'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the public release URL is tried first, with the tag encoded as the workflows wrote it', () => {
  const result = run({ curl: 'ok', gh: 'ok', env: { GH_TOKEN: TOKEN } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.bytes, 'direct');
  assert.match(result.calls, /^curl .*--proto =https --proto-redir =https .*https:\/\/github\.com\/rustsec\/rustsec\/releases\/download\/cargo-audit%2Fv0\.22\.2\/cargo-audit-x86_64-unknown-linux-musl-v0\.22\.2\.tgz$/m);
  assert.doesNotMatch(result.calls, /^gh /m, 'gh is not used when the URL works');
  assert.deepEqual(result.leftovers, []);
});

test('a failing release URL falls back to the REST API, and the token stays in the environment', () => {
  const result = run({ curl: 'fail', gh: 'ok', env: { GITHUB_TOKEN: TOKEN } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.bytes, 'api');
  assert.match(result.calls, /^gh release download cargo-audit\/v0\.22\.2 --repo rustsec\/rustsec --pattern cargo-audit-x86_64-unknown-linux-musl-v0\.22\.2\.tgz --output \S+ --clobber$/m);
  assert.match(result.calls, new RegExp(`^GH_TOKEN=${TOKEN}$`, 'm'), 'gh reads GITHUB_TOKEN as GH_TOKEN');
  const argv = result.calls.split('\n').filter(line => /^(?:curl|gh) /.test(line)).join('\n');
  assert.doesNotMatch(argv, new RegExp(TOKEN), 'the token is never an argument');
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(TOKEN), 'the token is never printed');
  assert.match(result.stdout, /::warning::Release download failed/);
  assert.match(result.stdout, /through the REST API/);
  assert.deepEqual(result.leftovers, []);
});

test('tracing with bash -x never prints the token', () => {
  for (const env of [{ GH_TOKEN: TOKEN }, { GITHUB_TOKEN: TOKEN }]) {
    const result = run({ curl: 'fail', gh: 'ok', env, trace: true });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, new RegExp(TOKEN));
  }
});

test('when both routes fail the step fails and no file is left behind', () => {
  const result = run({ curl: 'fail', gh: 'fail', env: { GH_TOKEN: TOKEN } });
  assert.notEqual(result.status, 0);
  assert.equal(result.bytes, null);
  assert.deepEqual(result.leftovers, []);
  assert.equal(result.calls.split('\n').filter(line => line.startsWith('gh ')).length, 3, 'three API attempts');
});

test('the API route refuses to run without a token or without gh', () => {
  const noToken = run({ curl: 'fail', gh: 'ok' });
  assert.notEqual(noToken.status, 0);
  assert.match(noToken.stderr, /needs GH_TOKEN or GITHUB_TOKEN/);
  assert.doesNotMatch(noToken.calls, /^gh /m);
  const noGh = run({ curl: 'fail', gh: 'absent', env: { GH_TOKEN: TOKEN } });
  assert.notEqual(noGh.status, 0);
  assert.match(noGh.stderr, /needs the gh CLI/);
  for (const result of [noToken, noGh]) assert.deepEqual(result.leftovers, []);
});

test('names that gh would read as a glob, and malformed repositories, are refused before any download', () => {
  for (const args of [
    ['owner/repo', 'v1', 'tool_*_linux.tar.gz', '/dev/null/x'],
    ['owner/repo', 'v1', 'tool[1].tar.gz', '/dev/null/x'],
    ['owner', 'v1', 'tool.tar.gz', '/dev/null/x'],
    ['owner/repo', 'v1 ', 'tool.tar.gz', '/dev/null/x'],
  ]) {
    const result = run({ curl: 'ok', gh: 'ok', env: { GH_TOKEN: TOKEN }, args });
    assert.notEqual(result.status, 0, args.join(' '));
    assert.equal(result.calls, '', args.join(' '));
  }
});
