// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { createInterface } from 'node:readline';
import test from 'node:test';
import { RedisRestRateLimiter as CaRateLimiter } from '../services/ca/lib/rate-limit.mjs';
import { RedisRestRateLimiter as McpRateLimiter } from '../services/mcp/src/rate-limit.ts';
import { RedisRestUsageBudget } from '../services/mcp/src/usage-budget.ts';
import { createHttpLifecycle, createWriteTracker } from '../services/shared/http-lifecycle.mjs';

const TOKEN = 'test_operator_credential_01234567890123456789';
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

async function start(lifecycle: ReturnType<typeof createHttpLifecycle>) {
  lifecycle.server.listen(0, '127.0.0.1');
  await once(lifecycle.server, 'listening');
  if (lifecycle.controlServer && !lifecycle.controlServer.listening)
    await once(lifecycle.controlServer, 'listening');
  const main = lifecycle.server.address();
  assert.ok(main && typeof main !== 'string');
  const operator = lifecycle.controlServer?.address();
  return {
    publicUrl: `http://127.0.0.1:${main.port}`,
    controlUrl:
      operator && typeof operator !== 'string' ? `http://127.0.0.1:${operator.port}` : null,
  };
}

async function dispose(lifecycle: ReturnType<typeof createHttpLifecycle>) {
  lifecycle.server.closeAllConnections();
  await new Promise<void>((done) => lifecycle.server.close(() => done()));
  if (lifecycle.controlServer) {
    lifecycle.controlServer.closeAllConnections();
    await new Promise<void>((done) => lifecycle.controlServer!.close(() => done()));
  }
}

test('authenticated drain gates new work and retains an aborted client through its final usage write', {
  timeout: 5000,
}, async (t) => {
  const work = deferred(),
    writing = deferred(),
    writeDone = deferred(),
    entered = deferred();
  const writes = createWriteTracker();
  let calls = 0,
    records = 0;
  const budget = new RedisRestUsageBudget({
    url: 'https://redis.invalid',
    token: 'synthetic',
    namespace: 'mcp',
    limits: { cpuMs: 10000, egressBytes: 10000 },
    cpu: () => 0,
    onWrite: writes.begin,
    fetchImpl: (async () => {
      records += 1;
      if (records === 1) {
        writing.resolve();
        await writeDone.promise;
      }
      return new Response(JSON.stringify({ result: [0, 123] }));
    }) as typeof fetch,
  });
  const lifecycle = createHttpLifecycle({
    env: { LOLLY_OPERATOR_DRAIN_TOKEN: TOKEN, LOLLY_OPERATOR_DRAIN_PORT: String(await freePort()) },
    writes,
    handler: async (_req, res) => {
      calls += 1;
      entered.resolve();
      await work.promise;
      await budget.record(123);
      res.end('complete');
    },
    flushAccounting: () => budget.record(0),
  });
  t.after(async () => {
    work.resolve();
    writeDone.resolve();
    await dispose(lifecycle);
  });
  const { publicUrl, controlUrl } = await start(lifecycle);
  assert.ok(controlUrl);
  assert.equal(
    lifecycle.controlServer!.address() &&
      (lifecycle.controlServer!.address() as { address: string }).address,
    '127.0.0.1'
  );
  assert.equal((await fetch(controlUrl + '/begin', { method: 'POST' })).status, 401);
  assert.equal(lifecycle.status().draining, false);
  const client = request(publicUrl + '/long');
  client.on('error', () => {});
  client.end();
  await entered.promise;
  const closed = new Promise<void>((done) => client.once('close', () => done()));
  client.destroy();
  await closed;
  assert.equal(lifecycle.status().activeHandlers, 1);
  const first = await (
    await fetch(controlUrl + '/begin', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
    })
  ).json();
  assert.equal(first.activeHandlers, 1);
  assert.equal(first.settled, false);
  const second = await (
    await fetch(controlUrl + '/begin', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
    })
  ).json();
  assert.equal(second.beganAt, first.beganAt);
  assert.equal((await fetch(publicUrl + '/another')).status, 503);
  assert.equal(calls, 1);
  assert.equal((await fetch(publicUrl + '/readyz')).status, 503);
  assert.equal((await fetch(publicUrl + '/healthz')).status, 200);
  work.resolve();
  await writing.promise;
  assert.equal(lifecycle.status().pendingWrites, 1);
  assert.equal(lifecycle.status().activeHandlers, 1);
  await assert.rejects(lifecycle.waitForSettled(10), /not settled/);
  assert.equal(lifecycle.status().pendingWrites, 1);
  writeDone.resolve();
  const settled = await lifecycle.waitForSettled(1000);
  assert.equal(settled.activeHandlers, 0);
  assert.equal(settled.pendingWrites, 0);
  assert.equal(settled.settled, true);
  assert.equal(records, 2, 'normal usage plus exactly one final CPU flush');
  await lifecycle.waitForSettled(100);
  assert.equal(records, 2, 'no drain retry/reset or repeated flush');
});

test('queued and active jobs prevent settled status even without a socket', async (t) => {
  let active = 1,
    queued = 2,
    flushes = 0;
  const lifecycle = createHttpLifecycle({
    env: {},
    handler: async (_req, res) => {
      res.end();
    },
    queueStatus: () => ({ active, queued }),
    flushAccounting: async () => {
      flushes += 1;
    },
  });
  t.after(() => dispose(lifecycle));
  await start(lifecycle);
  assert.equal(lifecycle.begin().settled, false);
  await assert.rejects(lifecycle.waitForSettled(10), /not settled/);
  assert.equal(flushes, 0);
  active = 0;
  queued = 0;
  assert.equal((await lifecycle.waitForSettled(1000)).settled, true);
  assert.equal(flushes, 1);
});

test('swallowed daily accounting failures remain sticky and never qualify an idle drain', async (t) => {
  const writes = createWriteTracker();
  const budget = new RedisRestUsageBudget({
    url: 'https://redis.invalid',
    token: 'synthetic',
    namespace: 'mcp',
    limits: { cpuMs: 1000, egressBytes: 1000 },
    onWrite: writes.begin,
    fetchImpl: (async () => new Response('{}', { status: 503 })) as typeof fetch,
  });
  const lifecycle = createHttpLifecycle({
    env: {},
    writes,
    handler: async (_req, res) => {
      await budget.record(4);
      res.end('finished');
    },
    flushAccounting: () => budget.record(0),
  });
  t.after(() => dispose(lifecycle));
  const { publicUrl } = await start(lifecycle);
  assert.equal((await fetch(publicUrl)).status, 200);
  assert.equal(writes.status().failedOrAmbiguousWrites, 1);
  await assert.rejects(lifecycle.waitForSettled(1000), /not settled/);
  assert.equal(lifecycle.status().workFinished, true);
  assert.equal(lifecycle.status().settled, false);
  assert.equal(writes.status().failedOrAmbiguousWrites, 2);
  await assert.rejects(lifecycle.waitForSettled(100), /not settled/);
  assert.equal(
    writes.status().failedOrAmbiguousWrites,
    2,
    'diagnostics cannot be reset or writes retried by begin/status'
  );
});

test('operator control is absent without a token, rejects bodies, and never appears on the public listener', async (t) => {
  assert.throws(
    () =>
      createHttpLifecycle({
        env: { LOLLY_OPERATOR_DRAIN_TOKEN: 'short' },
        handler: async () => {},
      }),
    /token must/
  );
  assert.throws(
    () =>
      createHttpLifecycle({ env: { LOLLY_OPERATOR_DRAIN_PORT: '8792' }, handler: async () => {} }),
    /requires its own token/
  );
  assert.throws(
    () =>
      createHttpLifecycle({
        env: { LOLLY_OPERATOR_DRAIN_TOKEN: TOKEN, CA_SERVICE_SECRET: TOKEN },
        handler: async () => {},
      }),
    /distinct/
  );
  const lifecycle = createHttpLifecycle({
    env: { LOLLY_OPERATOR_DRAIN_TOKEN: TOKEN, LOLLY_OPERATOR_DRAIN_PORT: String(await freePort()) },
    handler: async (_req, res) => {
      res.writeHead(404);
      res.end();
    },
  });
  t.after(() => dispose(lifecycle));
  const { publicUrl, controlUrl } = await start(lifecycle);
  assert.ok(controlUrl);
  assert.equal(
    (await fetch(publicUrl + '/status', { headers: { authorization: `Bearer ${TOKEN}` } })).status,
    404
  );
  assert.equal(
    (
      await fetch(publicUrl + '/begin', {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
      })
    ).status,
    404
  );
  assert.equal(lifecycle.status().draining, false);
  assert.equal(
    (
      await fetch(controlUrl + '/begin', {
        method: 'POST',
        body: 'x',
        headers: { authorization: `Bearer ${TOKEN}` },
      })
    ).status,
    413
  );
  assert.equal(lifecycle.status().draining, false);
  const noToken = createHttpLifecycle({
    env: {},
    handler: async (_req, res) => {
      res.end();
    },
  });
  assert.equal(noToken.controlServer, null);
  await dispose(noToken);
});

test('SIGTERM finishes an accepted request and accounting before stopping the listener', {
  timeout: 5000,
}, async (t) => {
  const child = spawn(
    process.execPath,
    [new URL('./fixtures/public-http-drain/child.mjs', import.meta.url).pathname],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  const messages: Record<string, unknown>[] = [];
  const waiters = new Map<string, (message: Record<string, unknown>) => void>();
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const message = JSON.parse(line);
    messages.push(message);
    waiters.get(message.event)?.(message);
  });
  const message = (event: string): Promise<Record<string, unknown>> => {
    const found = messages.find((x) => x.event === event);
    return found ? Promise.resolve(found) : new Promise((done) => waiters.set(event, done));
  };
  const exited = once(child, 'exit');
  const listening = await message('listening');
  const response = fetch(`http://127.0.0.1:${listening.port}/long`);
  await message('accepted');
  child.kill('SIGTERM');
  const draining = await message('draining');
  assert.equal(draining.activeHandlers, 1);
  assert.equal(draining.settled, false);
  assert.equal(child.exitCode, null);
  child.stdin.write('release\n');
  assert.equal(await (await response).text(), 'complete');
  const settled = await message('settled');
  assert.equal(settled.settled, true);
  assert.equal(settled.committedWrites, 1);
  const [code, signal] = await exited;
  assert.equal(code, 0);
  assert.equal(signal, null);
});

test('the standalone CA listener retains health while its private control drains public requests', {
  timeout: 5000,
}, async (t) => {
  const port = await freePort();
  const controlPort = await freePort();
  const child = spawn(
    process.execPath,
    [new URL('../services/ca/server.mjs', import.meta.url).pathname],
    {
      env: {
        PATH: process.env.PATH,
        PORT: String(port),
        CA_SERVICE_SECRET: 'synthetic_ca_service_credential_0123456789',
        LOLLY_OPERATOR_DRAIN_TOKEN: TOKEN,
        LOLLY_OPERATOR_DRAIN_PORT: String(controlPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  const exited = once(child, 'exit');
  const lines = createInterface({ input: child.stdout });
  await new Promise<void>((done) => {
    lines.on('line', (line) => {
      if (line.startsWith('lolly-ca listening')) done();
    });
  });
  const publicUrl = `http://127.0.0.1:${port}`;
  const controlUrl = `http://127.0.0.1:${controlPort}`;
  assert.equal((await fetch(`${publicUrl}/readyz`)).status, 200);
  assert.equal((await fetch(`${publicUrl}/api/ca/health`)).status, 200);
  assert.equal((await fetch(`${controlUrl}/status`)).status, 401);
  const headers = { authorization: `Bearer ${TOKEN}` };
  assert.equal((await fetch(`${controlUrl}/begin`, { method: 'POST', headers })).status, 200);
  assert.equal((await fetch(`${publicUrl}/readyz`)).status, 503);
  assert.equal((await fetch(`${publicUrl}/api/ca/root.pem`)).status, 503);
  assert.equal((await fetch(`${publicUrl}/api/ca/health`)).status, 200);
  const state = await (await fetch(`${controlUrl}/status`, { headers })).json();
  assert.equal(state.settled, true);
  assert.equal(state.activeHandlers, 0);
  child.kill('SIGTERM');
  const [code, signal] = await exited;
  assert.equal(code, 0);
  assert.equal(signal, null);
});

test('MCP and CA rate-write acknowledgement failures are tracked with identical admission ABI', async () => {
  for (const RateLimiter of [McpRateLimiter, CaRateLimiter]) {
    const writes = createWriteTracker();
    let script = '';
    const limiter = new RateLimiter({
      url: 'https://redis.invalid',
      token: 'synthetic',
      namespace: 'mcp',
      onWrite: writes.begin,
      fetchImpl: (async (_url: string, options: RequestInit) => {
        script = JSON.parse(String(options.body))[1];
        throw new Error('acknowledgement lost');
      }) as typeof fetch,
    });
    await assert.rejects(limiter.consume('auth', 'synthetic', 2, 60000), /unavailable/);
    assert.equal(writes.status().pendingWrites, 0);
    assert.equal(writes.status().failedOrAmbiguousWrites, 1);
    assert.equal(
      createHash('sha256').update(script).digest('hex'),
      '201b7eca2348b893c8d4dcf378a6a500a6c3c4d2a67545bc8f17c83470b0db0c'
    );
  }
});

test('unexpected handler and queue diagnostic failures cannot become settled', async (t) => {
  const lifecycle = createHttpLifecycle({
    env: {},
    handler: async () => {
      throw new Error('test failure');
    },
  });
  t.after(() => dispose(lifecycle));
  const { publicUrl } = await start(lifecycle);
  assert.equal((await fetch(publicUrl)).status, 500);
  await assert.rejects(lifecycle.waitForSettled(1000), /not settled/);
  assert.equal(lifecycle.status().handlerFailures, 1);
  assert.equal(lifecycle.status().settled, false);
  const invalid = createHttpLifecycle({
    env: {},
    handler: async () => {},
    queueStatus: () => {
      throw new Error('not observable');
    },
  });
  t.after(() => dispose(invalid));
  assert.equal(invalid.begin().settled, false);
  await assert.rejects(invalid.waitForSettled(10), /not settled/);
  assert.ok(invalid.status().diagnosticFailures > 0);
});

test('malformed budget acknowledgements cannot certify a committed final write', async () => {
  for (const result of [
    [null, null],
    ['bad', 1],
    [-1, 1],
    [1, 1.5],
    [1, Number.MAX_SAFE_INTEGER + 1],
  ]) {
    const writes = createWriteTracker();
    const budget = new RedisRestUsageBudget({
      url: 'https://redis.invalid',
      token: 'synthetic',
      namespace: 'mcp',
      limits: { cpuMs: 1000, egressBytes: 1000 },
      onWrite: writes.begin,
      fetchImpl: (async () => new Response(JSON.stringify({ result }))) as typeof fetch,
    });
    await budget.record(1);
    assert.equal(writes.status().committedWrites, 0);
    assert.equal(writes.status().failedOrAmbiguousWrites, 1);
  }
});
