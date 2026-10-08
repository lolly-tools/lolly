// SPDX-License-Identifier: MPL-2.0
/** Explicit native image acceptance; run inside the restricted browser image. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
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
  LOLLY_LIVE_ORIGINS: canonicalOrigin,
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
let closeRelay: (() => void) | undefined;
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
  const expectedMetaTools = [
    'compile',
    'inspect',
    'measure',
    'validate',
    'diff',
    'package',
    'list_tools',
    'describe_tool',
    'build_url',
    'render',
    'transform',
    'rebrand',
    'read',
    'check',
    'measure_text',
    'compose',
    'redact',
    'verify',
    'look',
    'sample_color',
    'trace_edges',
  ].map((name) => `lolly_${name}`);
  assert.deepEqual(
    listed.result.tools.map((tool: { name: string }) => tool.name),
    expectedMetaTools
  );
  assert.ok(!listed.result.tools.some((tool: { name: string }) => tool.name.startsWith('files_')));
  // Initialize's recipe count is distinct from the MCP meta-tool count. Verify
  // the MCP image carries every current public recipe and tool file.
  const webRoot = process.env.LOLLY_WEB_DIST;
  assert.ok(webRoot);
  const webIndex = JSON.parse(await readFile(join(webRoot, 'catalog/tools/index.json'), 'utf8'));
  const { listTools } = await import(`${root}/services/mcp/src/catalog.ts`);
  const recipes = await listTools();
  assert.equal(recipes.length, 67);
  assert.deepEqual(
    recipes.map((tool: { id: string }) => tool.id),
    webIndex.tools.map((tool: { id: string }) => tool.id)
  );
  // The web shell beside this image is the unsigned build of the same source:
  // since plan 295 section 1B the web image is gated on WebGPU qualification and
  // the service images are not, so no release signature is there to list the
  // files. Both trees come from the same content resolver, so compare all of
  // them, path for path and byte for byte.
  const toolFiles = async (directory: string): Promise<string[]> =>
    (await readdir(directory, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'))
      .sort();
  const webFiles = await toolFiles(join(webRoot, 'tools'));
  assert.deepEqual(await toolFiles(join(root, 'tools')), webFiles);
  let matchedPublicFiles = 0;
  for (const path of webFiles) {
    assert.match(path, /^[a-z0-9-]+\//);
    assert.ok(!path.split('/').some((part) => part === '..' || part === '.'));
    const [webBytes, mcpBytes]: [Buffer, Buffer] = await Promise.all([
      readFile(join(webRoot, 'tools', path)),
      readFile(join(root, 'tools', path)),
    ]);
    assert.equal(
      createHash('sha256').update(mcpBytes).digest('hex'),
      createHash('sha256').update(webBytes).digest('hex'),
      path
    );
    matchedPublicFiles++;
  }
  assert.ok(matchedPublicFiles >= recipes.length);
  const invite = async (site?: string) =>
    fetch(`${base}/live/invitations`, {
      method: 'POST',
      headers: { ...headers, ...(site ? { origin: site } : {}) },
      body: JSON.stringify({ documentId: 'doc:native-public', permission: 'read' }),
    });
  assert.equal((await invite()).status, 403);
  assert.equal((await invite('https://attacker.invalid')).status, 403);
  const invitation = await invite(canonicalOrigin);
  assert.equal(invitation.status, 201);
  const grant = await invitation.json();
  const { WebSocket } = createRequire(join(root, 'services/mcp/package.json'))('ws');
  const editor = new WebSocket(`${base.replace('http:', 'ws:')}/live/editor`, {
    origin: canonicalOrigin,
  });
  closeRelay = () => editor.terminate();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Public editor WebSocket did not attach')),
      5000
    );
    editor.on('open', () => editor.send(JSON.stringify({ editorToken: grant.editorToken })));
    editor.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
    editor.on('message', (bytes: Buffer) => {
      const request = JSON.parse(bytes.toString());
      if (request.type === 'attached') {
        clearTimeout(timer);
        resolve();
        return;
      }
      editor.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            documentId: 'doc:native-public',
            tool: 'design',
            engine: 'qualification',
            revision: 'native-1',
          },
        })
      );
    });
  });
  const liveCall = async (
    method: string,
    params: Record<string, unknown> = {},
    capability = grant.token
  ) => {
    const response = await fetch(`${base}/live/rpc`, {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${capability}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal(
    (await liveCall('hello', { protocol: 'live-v1', client: 'Native qualification' })).body.result
      .documentId,
    'doc:native-public'
  );
  assert.equal((await liveCall('document.get')).body.result.documentId, 'doc:native-public');
  assert.match(
    (await liveCall('document.get', { documentId: 'doc:other' })).body.error.message,
    /different document/
  );
  assert.match((await liveCall('document.apply')).body.error.message, /reading only/);
  assert.equal((await liveCall('document.get', {}, 'x'.repeat(43))).status, 401);
  const liveList = await fetch(`${base}/live/mcp`, {
    method: 'POST',
    headers: { ...headers, authorization: `Bearer ${grant.token}` },
    body,
  });
  assert.equal(liveList.status, 200);
  const liveTools = (await liveList.json()).result.tools;
  assert.equal(liveTools.length, 9);
  assert.ok(liveTools.every((tool: { name: string }) => tool.name.startsWith('lolly_live_')));
  console.error(
    JSON.stringify({
      nativePreBrowserChecksPassed: true,
      mcpMetaTools: expectedMetaTools.length,
      catalogRecipes: recipes.length,
      matchedPublicFiles,
      publicRelayWebSocketQualified: true,
      crossDocumentRefused: true,
      readOnlyGrantEnforced: true,
      invalidInvitationRefused: true,
      candidateRuntimeQualified: false,
    })
  );
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
  // The regular Chromium diagnostic page exposes its internal namespace and
  // seccomp state; the production exports above still use the default engine.
  const { chromium } = createRequire(join(root, 'services/mcp/package.json'))('playwright-core');
  const diagnosticBrowser = await chromium.launch({
    ...runtime.browserLaunchOptions(),
    channel: 'chromium',
  });
  let sandboxDiagnostics = '';
  try {
    const page = await diagnosticBrowser.newPage();
    await page.goto('chrome://sandbox');
    sandboxDiagnostics = (await page.locator('body').innerText()).slice(0, 8192);
    assert.match(sandboxDiagnostics, /Layer 1 Sandbox\s+Namespace/);
    for (const control of [
      'PID namespaces',
      'Network namespaces',
      'Seccomp-BPF sandbox',
      'Seccomp-BPF sandbox supports TSYNC',
    ]) {
      assert.ok(sandboxDiagnostics.includes(`${control}\tYes`), control);
    }
  } finally {
    await diagnosticBrowser.close();
  }
  console.log(
    JSON.stringify(
      {
        nativeImageProbePassed: true,
        mcpMetaTools: expectedMetaTools.length,
        catalogRecipes: recipes.length,
        matchedPublicFiles,
        publicRelayWebSocketQualified: true,
        crossDocumentRefused: true,
        readOnlyGrantEnforced: true,
        invalidInvitationRefused: true,
        missingAuthRefused: true,
        unavailableAdmissionRefused: true,
        badOriginRefused: true,
        privateFilesDisabled: true,
        chromiumSandbox: true,
        sandboxDiagnostics,
        observedBrowserProcesses: browserCommands.length,
        renders,
        candidateRuntimeQualified: false,
      },
      null,
      2
    )
  );
} finally {
  closeRelay?.();
  await closeBrowser?.();
  await closeWebShell?.();
  server.kill('SIGTERM');
}
