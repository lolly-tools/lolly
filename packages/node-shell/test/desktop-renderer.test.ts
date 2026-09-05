// SPDX-License-Identifier: MPL-2.0
/**
 * The desktop renderer rung (plans/202 WP2.2).
 *
 * Nothing here installs, launches or needs a real Lolly app. The rung order and the
 * fall-through are pinned with injected probes; the wire protocol is exercised
 * against a mock server on a real loopback socket, which is the only way to prove
 * the framing agrees with the Rust side that speaks it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DesktopRendererError, desktopExecutableCandidates, desktopInstalled,
  desktopServesRenderEndpoint, launchRenderServer, pingRenderServer, readRenderServer,
  rendererOrder, rendererPreference, rendererStatus, renderServerPath, renderThroughRungs,
  renderViaDesktopCommand, renderViaRenderServer, resetDesktopProbe,
  type RenderServer, type RendererAvailability, type RendererDrivers, type RendererRung,
} from '../src/desktop-renderer.ts';

const NOTHING: RendererAvailability = { running: false, installed: false, chromium: false };

// ── preference and order ─────────────────────────────────────────────────────

test('renderer preference is strict and defaults to auto', () => {
  assert.equal(rendererPreference(undefined), 'auto');
  assert.equal(rendererPreference(''), 'auto');
  assert.equal(rendererPreference('DESKTOP'), 'desktop');
  assert.throws(() => rendererPreference('webkit'), /auto.*desktop.*chromium/);
});

test('auto walks running desktop, then installed desktop, then chromium', () => {
  assert.deepEqual(
    rendererOrder('auto', { running: true, installed: true, chromium: true }),
    ['desktop-running', 'desktop-installed', 'chromium'],
  );
  assert.deepEqual(
    rendererOrder('auto', { running: false, installed: true, chromium: true }),
    ['desktop-installed', 'chromium'],
  );
  assert.deepEqual(rendererOrder('auto', NOTHING), ['chromium'],
    'chromium stays in the order even when unavailable, so its own message is what the caller reads');
});

test('an explicit rung never falls through to another renderer', () => {
  assert.deepEqual(
    rendererOrder('desktop', { running: true, installed: true, chromium: true }),
    ['desktop-running', 'desktop-installed'],
    'desktop may fall from a running app to a launched one; both are still the desktop',
  );
  assert.deepEqual(rendererOrder('desktop', NOTHING), [], 'nothing to try means an error, not Chromium');
  assert.deepEqual(
    rendererOrder('chromium', { running: true, installed: true, chromium: true }),
    ['chromium'],
    'an explicit chromium never starts an app',
  );
});

test('the reported renderer is the best rung this machine has', () => {
  assert.equal(rendererStatus({ running: true, installed: true, chromium: true }), 'desktop-running');
  assert.equal(rendererStatus({ running: false, installed: true, chromium: true }), 'desktop-installed');
  assert.equal(rendererStatus({ running: false, installed: false, chromium: true }), 'chromium');
  assert.equal(rendererStatus(NOTHING), 'none');
  assert.equal(
    rendererStatus({ running: true, installed: true, chromium: true }, 'chromium'),
    'chromium',
    'an explicit Chromium preference is reflected in the environment report',
  );
  assert.equal(
    rendererStatus({ running: false, installed: false, chromium: true }, 'desktop'),
    'none',
    'an unavailable pinned desktop rung is reported honestly',
  );
});

// ── the rung walk ────────────────────────────────────────────────────────────

const SERVER: RenderServer = { port: 1, token: 't', pid: 2, version: '1.0.6', file: '/tmp/render.json' };
const BYTES = { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' };

function drivers(over: Partial<RendererDrivers> = {}): RendererDrivers & { visited: RendererRung[] } {
  const visited: RendererRung[] = [];
  return {
    visited,
    runningServer: () => null,
    installed: () => false,
    launchServer: async () => null,
    renderOnServer: async () => BYTES,
    renderOnChromium: async () => BYTES,
    onFallback: (rung) => visited.push(rung),
    ...over,
  };
}

test('auto uses a running desktop app when there is one', async () => {
  const d = drivers({ runningServer: () => SERVER, installed: () => true });
  const { rung } = await renderThroughRungs('auto', d);
  assert.equal(rung, 'desktop-running');
  assert.deepEqual(d.visited, [], 'nothing failed, so nothing fell through');
});

test('auto starts an installed app when none is running', async () => {
  let launched = 0;
  const d = drivers({
    installed: () => true,
    launchServer: async () => { launched += 1; return SERVER; },
  });
  const { rung } = await renderThroughRungs('auto', d);
  assert.equal(rung, 'desktop-installed');
  assert.equal(launched, 1);
});

test('auto falls all the way to chromium, in order, and says so at each step', async () => {
  const d = drivers({
    runningServer: () => SERVER,
    installed: () => true,
    renderOnServer: async () => { throw new Error('the app refused'); },
    launchServer: async () => SERVER,
  });
  const { rung } = await renderThroughRungs('auto', d);
  assert.equal(rung, 'chromium');
  assert.deepEqual(d.visited, ['desktop-running', 'desktop-installed'],
    'both desktop rungs were tried and reported before Chromium ran');
});

test('auto with no app at all goes straight to chromium', async () => {
  let chromium = 0;
  const d = drivers({ renderOnChromium: async () => { chromium += 1; return BYTES; } });
  const { rung } = await renderThroughRungs('auto', d);
  assert.equal(rung, 'chromium');
  assert.equal(chromium, 1);
});

test('an explicit desktop preference reports the desktop failure and never renders in chromium', async () => {
  let chromium = 0;
  const d = drivers({
    runningServer: () => SERVER,
    renderOnServer: async () => { throw new Error('the app refused'); },
    renderOnChromium: async () => { chromium += 1; return BYTES; },
  });
  await assert.rejects(renderThroughRungs('desktop', d), /the app refused/);
  assert.equal(chromium, 0);
});

test('an explicit desktop preference with no app says how to get one', async () => {
  await assert.rejects(
    renderThroughRungs('desktop', drivers()),
    (err: Error) => err instanceof DesktopRendererError && /LOLLY_DESKTOP_BIN/.test(err.message),
  );
});

test('an explicit chromium preference neither probes nor starts an app', async () => {
  let probed = 0;
  let launched = 0;
  const d = drivers({
    runningServer: () => { probed += 1; return SERVER; },
    installed: () => { probed += 1; return true; },
    launchServer: async () => { launched += 1; return SERVER; },
  });
  const { rung } = await renderThroughRungs('chromium', d);
  assert.equal(rung, 'chromium');
  assert.equal(probed, 0);
  assert.equal(launched, 0);
});

// ── the advert file ──────────────────────────────────────────────────────────

test('the advert is read only when it names a live process and a usable port', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-advert-'));
  try {
    const good = JSON.stringify({ port: 51234, token: 'abc', pid: 4242, version: '1.0.6' });
    const read = (body: string | null) => readRenderServer({
      dataDir: dir, readFile: () => body, alive: () => true,
    });
    assert.equal(read(good)?.port, 51234);
    assert.equal(read(good)?.token, 'abc');

    assert.equal(read(null), null, 'no file, no endpoint');
    assert.equal(read('not json'), null);
    assert.equal(read(JSON.stringify({ port: 51234, pid: 4242 })), null, 'no token, no endpoint');
    assert.equal(read(JSON.stringify({ port: 0, token: 'a', pid: 1 })), null);
    assert.equal(read(JSON.stringify({ port: 99999, token: 'a', pid: 1 })), null);
    assert.equal(read(JSON.stringify({ port: 51234, token: 'a', pid: 0 })), null);

    // The whole point of carrying a pid: a file a crashed app left behind is not
    // an endpoint, however well-formed it looks.
    assert.equal(
      readRenderServer({ dataDir: dir, readFile: () => good, alive: () => false }),
      null,
      'a dead process means no endpoint',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the advert path follows the app data directory, and the override wins', () => {
  const fromEnv = renderServerPath({ env: { LOLLY_RENDER_SERVER: '/custom/render.json' } });
  assert.equal(fromEnv, '/custom/render.json');
  const derived = renderServerPath({ dataDir: '/data/tools.lolly.Desktop', env: {} });
  assert.equal(derived, join('/data/tools.lolly.Desktop', 'render.json'));
  assert.equal(renderServerPath({ dataDir: null, env: {} }), null);
});

test('an explicit desktop binary is always the first platform candidate', () => {
  const env = { LOLLY_DESKTOP_BIN: '/opt/lolly-under-test' };
  for (const platform of ['darwin', 'linux', 'win32'] as const) {
    assert.equal(desktopExecutableCandidates(platform, env, '/home/person')[0], env.LOLLY_DESKTOP_BIN);
  }
});

test('the macOS candidates name the binary inside the bundle, not the product name', () => {
  const mac = desktopExecutableCandidates('darwin', {}, '/home/person');
  // The 1.0.6 install on the machine this was written on is exactly this path.
  // Looking only for a binary called "Lolly" found nothing at all.
  assert.ok(mac.includes('/Applications/Lolly.app/Contents/MacOS/lolly-desktop'), mac.join('\n'));
  assert.ok(mac.includes('/Applications/Lolly.app/Contents/MacOS/Lolly'));
  assert.ok(mac.includes('/home/person/Applications/Lolly.app/Contents/MacOS/lolly-desktop'));
  const linux = desktopExecutableCandidates('linux', { PATH: '/opt/bin' }, '/home/person');
  assert.ok(linux.includes('/usr/bin/lolly-desktop'));
  assert.ok(linux.includes('/opt/bin/lolly-desktop'));
});

test('an app that does not serve the endpoint is not the installed rung', {
  skip: process.platform === 'win32' ? 'the fixtures are POSIX executables' : false,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-probe-'));
  try {
    // Two stand-ins for `Lolly --help`: one from a build that predates the endpoint,
    // one from a build that serves it. Only the second may ever be started with
    // `--render-server`, because the first would read it as "open a window".
    const older = join(dir, 'older');
    const newer = join(dir, 'newer');
    await writeFile(older, '#!/bin/sh\necho "Lolly - the desktop app, run as a command line."\n');
    await writeFile(newer, '#!/bin/sh\necho "Lolly --render-server   the loopback render endpoint"\n');
    await chmod(older, 0o755);
    await chmod(newer, 0o755);
    resetDesktopProbe();

    assert.equal(desktopServesRenderEndpoint(older), false);
    assert.equal(desktopServesRenderEndpoint(newer), true);
    assert.equal(desktopInstalled(older), false, 'an older app is present but is not a render rung');
    assert.equal(desktopInstalled(newer), true);
    assert.equal(desktopInstalled(null), false);

    // And the launch refuses to start the older one at all, so no window appears
    // and no process is left behind.
    assert.equal(await launchRenderServer({ executable: older, waitMs: 1 }), null);
  } finally {
    resetDesktopProbe();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a path that resolves to nothing runnable is not the installed rung', () => {
  // Presence is not the test any more, capability is: a path that answers no
  // `--help` at all cannot be started as an endpoint either.
  resetDesktopProbe();
  assert.equal(desktopInstalled('/resolved/does-not-exist/Lolly'), false);
  assert.equal(desktopInstalled(null), false);
  resetDesktopProbe();
});

// ── the wire protocol, over a real loopback socket ───────────────────────────

interface Mock {
  server: Server;
  descriptor: RenderServer;
  seen: Array<Record<string, unknown>>;
  close: () => Promise<void>;
}

/** A stand-in for the Rust render endpoint: same framing, same reply shape. */
function mockRenderServer(
  answer: (request: Record<string, unknown>) => Record<string, unknown>,
  token = 's3cret',
): Promise<Mock> {
  const seen: Array<Record<string, unknown>> = [];
  const server = createServer((socket: Socket) => {
    const chunks: Buffer[] = [];
    let expected: number | null = null;
    socket.on('data', chunk => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      const all = Buffer.concat(chunks);
      if (expected === null && all.length >= 4) expected = all.readUInt32BE(0);
      if (expected === null || all.length < expected + 4) return;
      const request = JSON.parse(all.subarray(4, 4 + expected).toString('utf8')) as Record<string, unknown>;
      seen.push(request);
      const reply = request.token === token
        ? answer(request)
        : { ok: false, error: 'wrong or missing token' };
      const body = Buffer.from(JSON.stringify(reply), 'utf8');
      const header = Buffer.alloc(4);
      header.writeUInt32BE(body.length, 0);
      socket.end(Buffer.concat([header, body]));
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        server,
        seen,
        descriptor: { port, token, pid: process.pid, version: '1.0.6', file: '(mock)' },
        close: () => new Promise<void>(done => server.close(() => done())),
      });
    });
  });
}

test('a render job travels as one framed request and the bytes come back in the reply', async () => {
  const payload = Buffer.from('<svg>desktop</svg>', 'utf8');
  const mock = await mockRenderServer(() => ({
    ok: true, size: payload.length, filename: 'qr-code.svg', bytes: payload.toString('base64'),
  }));
  try {
    const url = 'https://lolly.tools/#/tool/qr-code?url=x&format=svg&export=1';
    const result = await renderViaRenderServer(mock.descriptor, { toolUrl: url, format: 'svg' });
    assert.equal(new TextDecoder().decode(result.bytes), '<svg>desktop</svg>');
    assert.equal(result.mime, 'image/svg+xml');
    assert.equal(mock.seen.length, 1);
    assert.equal(mock.seen[0]!.toolUrl, url, 'the exact export URL reaches the app, unrewritten');
    assert.equal(mock.seen[0]!.op, 'render');
    assert.equal(mock.seen[0]!.token, 's3cret');
  } finally {
    await mock.close();
  }
});

test('a refusal from the endpoint is the error the caller sees', async () => {
  const mock = await mockRenderServer(() => ({ ok: false, error: 'unknown tool "nope"' }));
  try {
    await assert.rejects(
      renderViaRenderServer(mock.descriptor, { toolId: 'nope', format: 'png' }),
      /unknown tool "nope"/,
    );
  } finally {
    await mock.close();
  }
});

test('a success with no bytes is a failure, never a silent empty file', async () => {
  const mock = await mockRenderServer(() => ({ ok: true, size: 0 }));
  try {
    await assert.rejects(
      renderViaRenderServer(mock.descriptor, { toolId: 'qr-code', format: 'png' }),
      /returned no bytes/,
    );
  } finally {
    await mock.close();
  }
});

test('ping confirms an endpoint, and a closed port is not one', async () => {
  const mock = await mockRenderServer(() => ({ ok: true, pong: true, version: '1.0.6' }));
  try {
    assert.equal(await pingRenderServer(mock.descriptor), true);
    assert.equal(
      await pingRenderServer({ ...mock.descriptor, token: 'wrong' }),
      false,
      'a wrong token is not an endpoint this caller may use',
    );
  } finally {
    await mock.close();
  }
  assert.equal(await pingRenderServer(mock.descriptor, 500), false, 'a closed port answers nothing');
});

// ── the one-shot command path ────────────────────────────────────────────────

test('the one-shot command path passes a tool URL and reads the file the app wrote', {
  skip: process.platform === 'win32' ? 'the fixture is a POSIX executable' : false,
}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-desktop-fixture-'));
  const executable = join(dir, 'fake-lolly');
  try {
    await writeFile(executable, '#!/bin/sh\nout="${2#--output=}"\nprintf desktop-bytes > "$out"\n');
    await chmod(executable, 0o755);
    const result = await renderViaDesktopCommand(
      'https://lolly.tools/#/tool/qr-code?format=svg&export=1', 'svg', executable,
    );
    assert.equal(new TextDecoder().decode(result.bytes), 'desktop-bytes');
    assert.equal(result.mime, 'image/svg+xml');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
