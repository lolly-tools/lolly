// SPDX-License-Identifier: MPL-2.0
/** Explicit native image acceptance; run inside the restricted browser image. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(process.env.LOLLY_IMAGE_ROOT || '/app');
const canonicalOrigin = 'https://public.example';
const token = randomBytes(32).toString('base64url');
assert.equal(process.env.LOLLY_BROWSER_NO_SANDBOX, '0');
assert.equal(process.env.LOLLY_MCP_PRIVATE_FILES, '0');
assert.equal(process.env.LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT, '0');
assert.equal(process.env.LOLLY_MCP_ALLOW_ANONYMOUS, '0');
const environment = {
  ...process.env,
  NODE_ENV: 'production',
  LOLLY_MCP_TOKEN: token,
  LOLLY_MCP_SIGNING_SECRET: randomBytes(32).toString('base64url'),
  LOLLY_MCP_PUBLIC_ORIGIN: canonicalOrigin,
  LOLLY_MCP_ALLOWED_ORIGINS: canonicalOrigin,
  PORT: '8790',
};
for (const name of Object.keys(environment)) {
  if (/^(LOLLY_RATE_LIMIT_REST_|UPSTASH_REDIS_REST_|KV_REST_API_)/.test(name))
    delete (environment as NodeJS.ProcessEnv)[name];
}
const server = spawn(process.execPath, ['services/mcp/src/http.ts'], {
  cwd: root,
  env: environment,
  stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
server.stderr.on('data', (chunk: Buffer) => {
  stderr = (stderr + chunk.toString()).slice(-4096);
});
let closeBrowser: (() => Promise<void>) | undefined;
let closeWebShell: (() => Promise<void>) | undefined;
try {
  const base = 'http://127.0.0.1:8790';
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(server.exitCode, null, `MCP boot failed: ${stderr}`);
    try {
      ready = (await fetch(`${base}/.well-known/oauth-authorization-server`)).ok;
    } catch {
      /* The listener is still starting. */
    }
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, `MCP did not boot: ${stderr}`);
  const metadata = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
  assert.equal(metadata.issuer, canonicalOrigin);
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const headers = { 'content-type': 'application/json' };
  const denied = await fetch(`${base}/api/mcp`, { method: 'POST', headers, body });
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get('www-authenticate') || '', /https:\/\/public\.example/);
  const unavailable = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { ...headers, authorization: `Bearer ${token}` },
    body,
  });
  assert.equal(unavailable.status, 503, 'missing durable admission must fail closed');
  const origin = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { ...headers, origin: 'https://attacker.invalid' },
    body,
  });
  assert.equal(origin.status, 403);
  const { dispatch } = await import(`${root}/services/mcp/src/server.ts`);
  const listed = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(listed.result.tools.length, 67);
  assert.ok(!listed.result.tools.some((tool: { name: string }) => tool.name.startsWith('files_')));
  const runtime = await import(`${root}/services/mcp/src/render.ts`);
  closeBrowser = runtime.closeBrowser;
  closeWebShell = runtime.closeWebShell;
  assert.equal(runtime.browserLaunchOptions().chromiumSandbox, true);
  assert.ok(!runtime.browserLaunchOptions().args.includes('--no-sandbox'));
  const renders: Record<string, { tier: string; bytes: number; sha256: string }> = {};
  for (const format of ['svg', 'png', 'pdf']) {
    const result = await runtime.render(
      'qr-code',
      'url=https%3A%2F%2Flolly.tools%2Fqualification',
      {
        format,
        width: 256,
        height: 256,
      }
    );
    assert.ok(result.bytes.length > 100);
    if (format === 'svg') assert.match(Buffer.from(result.bytes).toString(), /<svg/);
    if (format === 'png')
      assert.equal(Buffer.from(result.bytes).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    if (format === 'pdf') {
      assert.equal(Buffer.from(result.bytes).subarray(0, 5).toString(), '%PDF-');
      assert.equal(result.tier, 'B');
    }
    renders[format] = {
      tier: result.tier,
      bytes: result.bytes.length,
      sha256: createHash('sha256').update(result.bytes).digest('hex'),
    };
  }
  const browserCommands: string[][] = [];
  for (const pid of await readdir('/proc')) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const command = (await readFile(join('/proc', pid, 'cmdline'), 'utf8')).split('\0');
      if (command[0]?.startsWith('/opt/lolly-browsers/')) browserCommands.push(command);
    } catch {
      /* Short-lived processes can exit during the snapshot. */
    }
  }
  assert.ok(browserCommands.length > 0, 'actual running Chromium process is required');
  assert.ok(
    browserCommands.every((command) => !command.includes('--no-sandbox')),
    'actual Chromium launch must retain its sandbox'
  );
  console.log(
    JSON.stringify(
      {
        nativeImageProbePassed: true,
        tools: 67,
        missingAuthRefused: true,
        unavailableAdmissionRefused: true,
        badOriginRefused: true,
        privateFilesDisabled: true,
        chromiumSandbox: true,
        observedBrowserProcesses: browserCommands.length,
        renders,
        candidateRuntimeQualified: false,
      },
      null,
      2
    )
  );
} finally {
  await closeBrowser?.();
  await closeWebShell?.();
  server.kill('SIGTERM');
}
