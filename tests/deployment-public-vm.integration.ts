// SPDX-License-Identifier: MPL-2.0
// Run explicitly in the deployment qualification lane, with Caddy and Docker.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const command = (args: string[], timeout = 30_000): string => {
  const result = spawnSync(args[0] ?? '', args.slice(1), {
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, `${args[0]}: ${result.stderr || String(result.error)}`);
  return result.stdout.trim();
};
async function listen(server: Server): Promise<number> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}
async function unusedPort(): Promise<number> {
  const server = createServer();
  const port = await listen(server);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  return port;
}
async function ready(url: string, diagnostics: () => string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      /* The fixture may still be starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`Fixture did not become ready at ${url}: ${diagnostics()}`);
}
async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

test('public VM Caddy and native nginx preserve routes, custody and model streaming', {
  timeout: 120_000,
}, async (t) => {
  command(['caddy', 'version']);
  command(['docker', 'version', '--format', '{{.Server.Version}}']);
  const image = read('deploy/docker/web.Dockerfile').match(
    /^FROM (ghcr\.io\/nginx\/nginx-unprivileged:[^\s]+) AS runtime$/m
  )?.[1];
  assert.ok(image, 'The public fixture must use the actual digest-pinned web runtime');
  const directory = mkdtempSync(join(tmpdir(), 'lolly-public-vm-'));
  chmodSync(directory, 0o755);
  const site = join(directory, 'site');
  const put = (path: string, content: string | Uint8Array) => {
    const destination = join(site, path);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o755 });
    writeFileSync(destination, content, { mode: 0o644 });
  };
  put('index.html', 'APP SHELL');
  put('any-site/index.html', 'ANY SITE');
  const vercel = JSON.parse(read('vercel.json')) as {
    rewrites: { source: string; destination: string }[];
  };
  const fixed = vercel.rewrites.filter(
    (route) =>
      route.destination.startsWith('/') &&
      !route.destination.startsWith('/api/') &&
      !route.source.includes(':') &&
      !route.source.includes('(')
  );
  for (const route of fixed) put(route.destination.slice(1), `FILE ${route.destination}`);
  put('t/design.html', 'FILE /t/design.html');
  put('t/qr-code.html', 'FILE /t/qr-code.html');
  for (const path of [
    'info/start/hello.html',
    'info/de/start/hello.html',
    'info/hello.html',
    'info/de/hello.html',
  ])
    put(path, `FILE /${path}`);
  put('info/proof.c2pa', 'credential');
  put('info/sitemap.xml', '<xml/>');
  put('.well-known/openai-apps-challenge', 'public challenge');
  put(
    'models/specimen.onnx',
    Uint8Array.from({ length: 64 }, (_, i) => i)
  );
  put('models/.lolly-model-release.json', 'OPERATOR METADATA');
  put('_app/app-hash.js', 'hashed app');
  put('ort-hf/runtime.wasm', 'wasm');
  put('ort/runtime.wasm', 'wasm');
  put('fonts/specimen.woff2', 'font');
  put('catalog/fonts/specimen.woff2', 'font');
  put('catalog/previews/specimen.svg', '<svg/>');
  for (const path of [
    'catalog/tools/index.json',
    'catalog/tools/index.slim.json',
    'catalog/assets/index.json',
    'precache.json',
  ])
    put(path, '{}');
  put('sw.js', 'service worker');
  put('manifest.webmanifest', '{}');
  let caddy: ChildProcess | undefined;
  let caddyLog = '';
  const container = `lolly-public-fixture-${process.pid}-${Date.now()}`;
  const upstreams: Server[] = [];
  let upgraded: IncomingMessage | undefined;
  try {
    command(
      [
        'docker',
        'run',
        '--detach',
        '--rm',
        '--name',
        container,
        '--read-only',
        '--tmpfs',
        '/tmp:size=16m,mode=1777',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--memory',
        '128m',
        '--pids-limit',
        '64',
        '--cpus',
        '0.5',
        '--publish',
        '127.0.0.1::8080',
        '--volume',
        `${site}:/usr/share/nginx/html:ro`,
        '--volume',
        `${join(root, 'deploy/docker/public.nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`,
        '--volume',
        `${join(root, 'deploy/docker/security-headers.conf')}:/etc/nginx/security-headers.conf:ro`,
        image,
      ],
      60_000
    );
    const ports = JSON.parse(
      command(['docker', 'inspect', container, '--format', '{{json .NetworkSettings.Ports}}'])
    ) as Record<string, { HostIp: string; HostPort: string }[]>;
    const published = ports['8080/tcp']?.find((item) => item.HostIp === '127.0.0.1');
    assert.ok(published, 'nginx fixture must only publish on loopback');
    const nginxPort = Number(published.HostPort);
    await ready(`http://127.0.0.1:${nginxPort}/healthz`, () =>
      command(['docker', 'logs', container])
    );
    command(['docker', 'exec', container, 'nginx', '-t']);

    const apiPorts: number[] = [];
    for (const name of ['mcp', 'ca', 'penpot']) {
      const server = createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        try {
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
        } catch (error) {
          if (!req.aborted) throw error;
          res.destroy();
          return;
        }
        res.setHeader('set-cookie', `fixture_${name}=private; HttpOnly`);
        res.setHeader('cache-control', 'no-store');
        if (req.url?.startsWith('/api/penpot/rpc/import-binfile')) {
          res.setHeader('content-type', 'text/event-stream');
          res.write('data: first\n\n');
          setTimeout(() => res.end('data: second\n\n'), 200);
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            service: name,
            url: req.url,
            headers: req.headers,
            bytes: Buffer.concat(chunks).length,
          })
        );
      });
      if (name === 'mcp')
        server.on('upgrade', (req, socket) => {
          upgraded = req;
          socket.end(
            'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'
          );
        });
      upstreams.push(server);
      apiPorts.push(await listen(server));
    }
    const mcpPort = apiPorts[0],
      caPort = apiPorts[1],
      penpotPort = apiPorts[2];
    assert.ok(mcpPort && caPort && penpotPort);
    const port = await unusedPort();
    const redirectPort = await unusedPort();
    const env = {
      ...process.env,
      LOLLY_PUBLIC_HOST: 'public.example',
      LOLLY_PUBLIC_REDIRECT_HOSTS: 'www.public.example',
      LOLLY_PUBLIC_ACME_EMAIL: 'operator@example.com',
      XDG_DATA_HOME: join(directory, 'data'),
      XDG_CONFIG_HOME: join(directory, 'config'),
    };
    const production = spawnSync(
      'caddy',
      ['adapt', '--config', join(root, 'deploy/docker/public.caddy'), '--adapter', 'caddyfile'],
      { env, encoding: 'utf8' }
    );
    assert.equal(production.status, 0, production.stderr);
    const adapted = JSON.parse(production.stdout) as {
      apps: { http: { servers: Record<string, { routes: unknown[] }> } };
    };
    assert.ok(Object.keys(adapted.apps.http.servers).length > 0);
    const config = read('deploy/docker/public.caddy')
      .replace('admin off', 'admin off\n\tauto_https off')
      .replace('{$LOLLY_PUBLIC_HOST} {', `http://127.0.0.1:${port} {`)
      .replace('{$LOLLY_PUBLIC_REDIRECT_HOSTS} {', `http://127.0.0.1:${redirectPort} {`)
      .replaceAll('\ttls {$LOLLY_PUBLIC_ACME_EMAIL}\n', '')
      .replaceAll('127.0.0.1:8880', `127.0.0.1:${nginxPort}`)
      .replaceAll('127.0.0.1:8890', `127.0.0.1:${mcpPort}`)
      .replaceAll('127.0.0.1:8887', `127.0.0.1:${caPort}`)
      .replaceAll('127.0.0.1:8891', `127.0.0.1:${penpotPort}`)
      .replaceAll('import public_proxy 8890', `import public_proxy ${mcpPort}`)
      .replaceAll('import public_proxy 8891', `import public_proxy ${penpotPort}`);
    const configPath = join(directory, 'Caddyfile');
    writeFileSync(configPath, config);
    caddy = spawn('caddy', ['run', '--config', configPath, '--adapter', 'caddyfile'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const record = (chunk: Buffer) => {
      caddyLog = (caddyLog + chunk.toString()).slice(-16_384);
    };
    caddy.stdout?.on('data', record);
    caddy.stderr?.on('data', record);
    const base = `http://127.0.0.1:${port}`;
    await ready(`${base}/healthz`, () => caddyLog);

    await t.test(
      'fixed aliases, translated docs and discovery serve their actual files',
      async () => {
        for (const route of fixed) {
          const response = await fetch(`${base}${route.source}?proof=kept`);
          assert.equal(response.status, 200, route.source);
          assert.equal(await response.text(), `FILE ${route.destination}`, route.source);
          assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        }
        for (const [path, file] of [
          ['/t/qr-code', '/t/qr-code.html'],
          ['/docs/start/hello', '/info/start/hello.html'],
          ['/docs/de/start/hello', '/info/de/start/hello.html'],
          ['/docs/hello', '/info/hello.html'],
          ['/docs/de/hello', '/info/de/hello.html'],
        ] as const)
          assert.equal(await (await fetch(`${base}${path}`)).text(), `FILE ${file}`);
        const head = await fetch(`${base}/docs/start/hello`, { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), '');
        assert.match(
          (await fetch(`${base}/agents.md`)).headers.get('content-type') ?? '',
          /^text\/markdown/
        );
        assert.match(
          (await fetch(`${base}/openapi.json`)).headers.get('content-type') ?? '',
          /^application\/json/
        );
        assert.match(
          (await fetch(`${base}/info/proof.c2pa`)).headers.get('content-type') ?? '',
          /^application\/c2pa/
        );
        assert.match(
          (await fetch(`${base}/.well-known/openai-apps-challenge`)).headers.get('content-type') ??
            '',
          /^text\/plain/
        );
      }
    );
    await t.test(
      'reserved missing files and unknown API paths cannot receive the app shell',
      async () => {
        for (const path of [
          '/api/unknown',
          '/api/penpot/rpc/delete-file',
          '/api/fetch-image/extra',
          '/live/unknown',
          '/tool/a_b.svg',
          '/docs/de/start/missing',
          '/docs/invalid/extra',
          '/info/missing.html',
          '/catalog/missing.json',
          '/icons/missing.svg',
          '/ort/missing.wasm',
          '/ort-hf/missing.wasm',
          '/_app/missing.js',
          '/models/missing.onnx',
          '/fonts/missing.woff2',
          '/t/missing',
          '/view/missing.html',
          '/.well-known/unknown',
          '/models/.lolly-model-release.json',
        ]) {
          const response = await fetch(`${base}${path}`);
          assert.equal(response.status, 404, path);
          assert.notEqual(await response.text(), 'APP SHELL', path);
        }
        assert.equal(await (await fetch(`${base}/client-route`)).text(), 'APP SHELL');
      }
    );
    await t.test('cache and security policies survive all static response locations', async () => {
      for (const [path, cache] of [
        ['/', 'public, max-age=0, must-revalidate'],
        ['/?proof=kept', 'public, max-age=0, must-revalidate'],
        ['/index.html', 'public, max-age=0, must-revalidate'],
        ['/client-route', 'public, max-age=0, must-revalidate'],
        ['/_app/app-hash.js', 'public, max-age=31536000, immutable'],
        ['/ort-hf/runtime.wasm', 'public, max-age=31536000, immutable'],
        ['/ort/runtime.wasm', 'public, max-age=86400, stale-while-revalidate=604800'],
        ['/fonts/specimen.woff2', 'public, max-age=86400, stale-while-revalidate=604800'],
        ['/catalog/fonts/specimen.woff2', 'public, max-age=86400, stale-while-revalidate=604800'],
        [
          '/catalog/previews/specimen.svg',
          'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        ],
        ['/catalog/tools/index.json', 'public, max-age=0, must-revalidate'],
        ['/catalog/tools/index.slim.json', 'public, max-age=0, must-revalidate'],
        ['/catalog/assets/index.json', 'public, max-age=0, must-revalidate'],
        ['/sw.js', 'public, max-age=0, must-revalidate'],
        ['/precache.json', 'public, max-age=0, must-revalidate'],
        ['/manifest.webmanifest', 'public, max-age=0, must-revalidate'],
        ['/info/proof.c2pa', 'public, max-age=0, must-revalidate'],
      ] as const) {
        const response = await fetch(`${base}${path}`);
        assert.equal(response.status, 200, path);
        assert.equal(response.headers.get('cache-control'), cache, path);
        assert.equal(response.headers.get('cross-origin-embedder-policy'), 'credentialless', path);
        assert.match(
          response.headers.get('content-security-policy') ?? '',
          /object-src 'none'/,
          path
        );
      }
      for (const path of ['/', '/?proof=kept', '/index.html']) {
        const response = await fetch(`${base}${path}`, { method: 'HEAD' });
        assert.equal(response.status, 200, path);
        assert.equal(
          response.headers.get('cache-control'),
          'public, max-age=0, must-revalidate',
          path
        );
        assert.equal(await response.text(), '', path);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
      }
      assert.equal(await (await fetch(`${base}/`)).text(), 'APP SHELL');
      const usual =
        (await fetch(`${base}/client-route`)).headers.get('content-security-policy') ?? '';
      const any = (await fetch(`${base}/any-site/`)).headers.get('content-security-policy') ?? '';
      assert.ok(!usual.includes("frame-src 'self' blob: https: "));
      assert.ok(any.includes("frame-src 'self' blob: https: "));
      assert.ok(usual.includes('wss://public.example'));
    });
    await t.test(
      'native model GET, HEAD, Range and conditional requests stay bounded and same-origin',
      async () => {
        const full = await fetch(`${base}/models/specimen.onnx`);
        assert.equal(full.status, 200);
        assert.equal(full.headers.get('access-control-allow-origin'), '*');
        assert.equal(full.headers.get('accept-ranges'), 'bytes');
        assert.equal((await full.arrayBuffer()).byteLength, 64);
        const head = await fetch(`${base}/models/specimen.onnx`, { method: 'HEAD' });
        assert.equal(head.status, 200);
        assert.equal(head.headers.get('content-length'), '64');
        assert.equal(await head.text(), '');
        const partial = await fetch(`${base}/models/specimen.onnx`, {
          headers: { range: 'bytes=5-9' },
        });
        assert.equal(partial.status, 206);
        assert.equal(partial.headers.get('content-range'), 'bytes 5-9/64');
        assert.deepEqual(
          new Uint8Array(await partial.arrayBuffer()),
          Uint8Array.from([5, 6, 7, 8, 9])
        );
        assert.equal(
          (await fetch(`${base}/models/specimen.onnx`, { headers: { range: 'bytes=99-100' } }))
            .status,
          416
        );
        const etag = head.headers.get('etag');
        assert.ok(etag);
        assert.equal(
          (await fetch(`${base}/models/specimen.onnx`, { headers: { 'if-none-match': etag } }))
            .status,
          304
        );
        assert.equal((await fetch(`${base}/models/specimen.onnx`, { method: 'POST' })).status, 405);
      }
    );
    await t.test(
      'API prefixes, query strings and explicit bearer survive while ambient credentials are removed',
      async () => {
        type Echo = {
          service: string;
          url: string;
          headers: Record<string, string>;
          bytes: number;
        };
        for (const [path, service] of [
          ['/api/mcp', 'mcp'],
          ['/api/mcp/authorize?client_id=fixture&state=opaque', 'mcp'],
          ['/api/fetch-image?url=https%3A%2F%2Fexample.com%2Fimage.png', 'mcp'],
          ['/tool/qr-code.svg?url=https%3A%2F%2Fexample.com', 'mcp'],
          ['/.well-known/oauth-authorization-server', 'mcp'],
          ['/.well-known/oauth-protected-resource/api/mcp', 'mcp'],
          ['/live/invitations', 'mcp'],
          ['/live/rpc', 'mcp'],
          ['/live/mcp', 'mcp'],
          ['/api/penpot/rpc/get-all-projects', 'penpot'],
        ] as const) {
          const response = await fetch(`${base}${path}`, {
            headers: {
              authorization: 'Bearer explicit-capability',
              cookie: 'ambient=private',
              'proxy-authorization': 'Basic private',
              'x-forwarded-for': '203.0.113.10',
              'x-real-ip': '203.0.113.11',
              forwarded: 'for=203.0.113.12',
              'x-vercel-forwarded-for': '203.0.113.13',
            },
          });
          assert.equal(response.status, 200, `${path}: ${caddyLog}`);
          const value = (await response.json()) as Echo;
          assert.equal(value.service, service, path);
          assert.equal(value.url, path, path);
          assert.equal(value.headers.authorization, 'Bearer explicit-capability', path);
          assert.equal(value.headers.cookie, undefined, path);
          assert.equal(value.headers['proxy-authorization'], undefined, path);
          assert.equal(value.headers['x-forwarded-for'], '127.0.0.1', path);
          assert.equal(value.headers['x-forwarded-proto'], 'https', path);
          assert.equal(value.headers.host, 'public.example', path);
          for (const key of ['forwarded', 'x-real-ip', 'x-vercel-forwarded-for'])
            assert.equal(value.headers[key], undefined, path);
          assert.equal(response.headers.get('set-cookie'), null, path);
        }
        const ca = await fetch(`${base}/api/ca/callback/google?code=opaque&state=opaque`, {
          headers: { cookie: 'lolly_ca_state=signed', 'proxy-authorization': 'Basic private' },
        });
        const value = (await ca.json()) as Echo;
        assert.equal(value.service, 'ca');
        assert.equal(value.headers.cookie, 'lolly_ca_state=signed');
        assert.equal(value.headers.host, 'public.example');
        assert.equal(value.headers['x-forwarded-proto'], 'https');
        assert.match(ca.headers.get('set-cookie') ?? '', /^fixture_ca=/);
        const tooLarge = await fetch(`${base}/api/ca/enroll`, {
          method: 'POST',
          body: 'x'.repeat(65537),
        });
        assert.equal(tooLarge.status, 413);
        for (const path of [
          '/api/mcp',
          '/api/ca/enroll',
          '/api/penpot/rpc/get-all-projects',
          '/live/invitations',
        ]) {
          assert.equal(
            (await fetch(`${base}${path}`, { headers: { origin: 'https://foreign.example' } }))
              .status,
            403,
            path
          );
          assert.equal(
            (await fetch(`${base}${path}`, { headers: { origin: 'https://public.example.evil' } }))
              .status,
            403,
            path
          );
          assert.equal(
            (await fetch(`${base}${path}`, { headers: { origin: 'https://public.example' } }))
              .status,
            200,
            path
          );
        }
      }
    );
    await t.test(
      'Penpot event streams arrive before completion and relay upgrades retain exact path and origin',
      async () => {
        const response = await fetch(`${base}/api/penpot/rpc/import-binfile`, {
          method: 'POST',
          body: 'fixture',
          headers: { authorization: 'Bearer penpot-custody' },
        });
        assert.equal(response.headers.get('set-cookie'), null);
        assert.ok(response.body);
        const reader = response.body.getReader();
        const first = await reader.read();
        assert.ok(!first.done);
        assert.equal(new TextDecoder().decode(first.value), 'data: first\n\n');
        await reader.cancel();
        await new Promise<void>((resolve, reject) => {
          const req = request(`${base}/live/editor`, {
            headers: {
              connection: 'Upgrade',
              upgrade: 'websocket',
              origin: 'https://public.example',
              cookie: 'ambient=private',
            },
          });
          req.once('upgrade', (_res, socket) => {
            socket.destroy();
            resolve();
          });
          req.once('response', (res) => reject(new Error(`Upgrade answered ${res.statusCode}`)));
          req.once('error', reject);
          req.setTimeout(3000, () => req.destroy(new Error('Upgrade timed out')));
          req.end();
        });
        assert.ok(upgraded);
        assert.equal(upgraded.url, '/live/editor');
        assert.equal(upgraded.headers.origin, 'https://public.example');
        assert.equal(upgraded.headers.cookie, undefined);
      }
    );
    await t.test('owned hostname and legacy route redirects retain path and query', async () => {
      const alias = await fetch(`http://127.0.0.1:${redirectPort}/docs/hello?language=de`, {
        redirect: 'manual',
      });
      assert.equal(alias.status, 308);
      assert.equal(alias.headers.get('location'), 'https://public.example/docs/hello?language=de');
      for (const [path, destination] of [
        ['/t/layout-studio?z=kept', '/design?z=kept'],
        ['/sitemap.xml?proof=kept', '/info/sitemap.xml?proof=kept'],
      ] as const) {
        const response = await fetch(`${base}${path}`, { redirect: 'manual' });
        assert.equal(response.status, 308);
        assert.ok(response.headers.get('location')?.endsWith(destination ?? 'invalid'));
      }
    });
  } finally {
    await stop(caddy);
    for (const server of upstreams) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    spawnSync('docker', ['rm', '--force', container], { encoding: 'utf8', timeout: 10_000 });
    rmSync(directory, { recursive: true, force: true });
  }
});
