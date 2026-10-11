// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { admissionNamespace } from '../src/admission-namespace.ts';
import { createGateway } from '../src/gateway.ts';
import { startHttpServer } from '../src/http.ts';
import { createWriteTracker } from '../../shared/http-lifecycle.mjs';

const STORE = 'https://admission.example.invalid';
const ENV: NodeJS.ProcessEnv = {
  LOLLY_MCP_ALLOW_ANONYMOUS: '1',
  LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.invalid',
  LOLLY_RATE_LIMIT_REST_URL: STORE,
  LOLLY_RATE_LIMIT_REST_TOKEN: 'synthetic-store-token',
  LOLLY_MCP_RPM: '100',
  LOLLY_BUDGET_CPU_SECONDS_PER_DAY: '0',
  LOLLY_BUDGET_EGRESS_MB_PER_DAY: '1',
};
const INIT = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'namespace-test', version: '1' },
} });

test('namespace defaults preserve existing keys and invalid values refuse both startup paths', () => {
  assert.equal(admissionNamespace({}), 'mcp');
  assert.equal(admissionNamespace({ LOLLY_MCP_ADMISSION_NAMESPACE: 'mcp-restricted_v1' }), 'mcp-restricted_v1');
  assert.equal(admissionNamespace({ LOLLY_MCP_ADMISSION_NAMESPACE: `a${'1'.repeat(63)}` }).length, 64);
  const prior = process.env.LOLLY_MCP_ADMISSION_NAMESPACE;
  try {
    for (const value of ['', ' ', ' mcp', 'mcp ', 'MCP', '1mcp', 'mcp:other', 'mcp/other', 'mcp\nother', 'mcpé', 'a'.repeat(65)]) {
      const env = { ...ENV, LOLLY_MCP_ADMISSION_NAMESPACE: value };
      assert.throws(() => admissionNamespace(env), /LOLLY_MCP_ADMISSION_NAMESPACE/);
      assert.throws(() => createGateway(env), /LOLLY_MCP_ADMISSION_NAMESPACE/);
      process.env.LOLLY_MCP_ADMISSION_NAMESPACE = value;
      assert.throws(() => startHttpServer(0), /LOLLY_MCP_ADMISSION_NAMESPACE/);
    }
  } finally {
    if (prior === undefined) delete process.env.LOLLY_MCP_ADMISSION_NAMESPACE;
    else process.env.LOLLY_MCP_ADMISSION_NAMESPACE = prior;
  }
});

/** A shared REST endpoint evaluates the maintained limiter/budget command shapes. */
function sharedStore(): { fetch: typeof fetch; values: Map<string, number>; commands: string[][] } {
  const values = new Map<string, number>();
  const commands: string[][] = [];
  const rest = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(new URL(String(url)).href, `${STORE}/`, 'The gateway must use only the synthetic shared store');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-store-token');
    const body = JSON.parse(String(init?.body)) as string[];
    commands.push(body);
    let result: unknown;
    if (body[0] === 'MGET') result = body.slice(1).map(key => values.get(key) ?? null);
    else if (body[0] === 'EVAL' && body[2] === '1') {
      const key = body[3]!; const count = (values.get(key) ?? 0) + 1;
      values.set(key, count); result = [count, 60_000];
    } else if (body[0] === 'EVAL' && body[2] === '2') {
      result = [3, 4].map((index, offset) => {
        const key = body[index]!; const count = (values.get(key) ?? 0) + Number(body[5 + offset]);
        values.set(key, count); return count;
      });
    } else throw new Error('Unexpected admission-store command');
    return new Response(JSON.stringify({ result }), { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetch: rest, values, commands };
}

async function serve(env: NodeJS.ProcessEnv): Promise<{ call: () => Promise<{ status: number; body: string }>; close: () => Promise<void>; accounting: () => ReturnType<ReturnType<typeof createWriteTracker>['status']> }> {
  const writes = createWriteTracker();
  const gateway = createGateway(env, { onWrite: writes.begin });
  const server = createServer((req, res) => { void gateway(req, res).catch(() => { res.destroy(); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    call: () => new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port: address.port, path: '/api/mcp', method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(INIT) }, signal: AbortSignal.timeout(5_000),
      }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; if (body.length > 8192) res.destroy(new Error('Unexpected oversized initialization response')); });
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on('error', reject); req.end(INIT);
    }),
    close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }),
    accounting: writes.status,
  };
}

test('real HTTP gateways preserve default rate keys and separate equal subjects on one REST store', async () => {
  const store = sharedStore(); const prior = globalThis.fetch; globalThis.fetch = store.fetch;
  const gateways: Awaited<ReturnType<typeof serve>>[] = [];
  try {
    const legacy = await serve({ ...ENV, LOLLY_MCP_RPM: '1' }); gateways.push(legacy);
    const explicitDefault = await serve({ ...ENV, LOLLY_MCP_RPM: '1', LOLLY_MCP_ADMISSION_NAMESPACE: 'mcp' }); gateways.push(explicitDefault);
    const separate = await serve({ ...ENV, LOLLY_MCP_RPM: '1', LOLLY_MCP_ADMISSION_NAMESPACE: 'mcp-restricted-v1' }); gateways.push(separate);
    assert.equal((await legacy.call()).status, 200);
    assert.equal((await explicitDefault.call()).status, 429, 'Explicit default must see the existing gateway counter');
    assert.equal((await separate.call()).status, 200, 'Equal client address in another namespace must have its own counter');
    assert.equal((await separate.call()).status, 429, 'A namespace must still enforce its own limit');
    const digest = (namespace: string) => createHash('sha256').update(namespace).update('\0mcp\0ip:127.0.0.1').digest('hex');
    assert.equal(store.values.get(`lolly:rl:${digest('mcp')}`), 2);
    assert.equal(store.values.get(`lolly:rl:${digest('mcp-restricted-v1')}`), 2);
    for (const gateway of gateways) assert.equal(gateway.accounting().pendingWrites + gateway.accounting().failedOrAmbiguousWrites, 0);
  } finally {
    await Promise.all(gateways.map(gateway => gateway.close())); globalThis.fetch = prior;
  }
});

test('real HTTP gateways read and write isolated daily budgets and retain the default exhausted budget', async () => {
  const store = sharedStore(); const prior = globalThis.fetch; globalThis.fetch = store.fetch;
  const gateways: Awaited<ReturnType<typeof serve>>[] = [];
  const oneByte = String(1 / (1024 * 1024));
  try {
    const legacy = await serve({ ...ENV, LOLLY_BUDGET_EGRESS_MB_PER_DAY: oneByte }); gateways.push(legacy);
    const separate = await serve({ ...ENV, LOLLY_BUDGET_EGRESS_MB_PER_DAY: oneByte, LOLLY_MCP_ADMISSION_NAMESPACE: 'mcp-restricted-v1' }); gateways.push(separate);
    const first = await legacy.call(); assert.equal(first.status, 200); assert.ok(Buffer.byteLength(first.body) > 1);
    assert.equal((await legacy.call()).status, 503);
    assert.equal((await separate.call()).status, 200, 'Another gateway budget must remain available');
    assert.equal((await separate.call()).status, 503, 'Its own recorded egress must exhaust its own budget');
    const restartedDefault = await serve({ ...ENV, LOLLY_BUDGET_EGRESS_MB_PER_DAY: oneByte }); gateways.push(restartedDefault);
    assert.equal((await restartedDefault.call()).status, 503, 'A restart with the default namespace must not reset the shared budget');
    const day = new Date().toISOString().slice(0, 10);
    for (const namespace of ['mcp', 'mcp-restricted-v1']) {
      const cpu = `lolly:budget:${namespace}:${day}:cpu-ms`; const egress = `lolly:budget:${namespace}:${day}:egress-bytes`;
      assert.ok(store.commands.some(command => command[0] === 'MGET' && command[1] === cpu && command[2] === egress));
      assert.ok(store.commands.some(command => command[0] === 'EVAL' && command[2] === '2' && command[3] === cpu && command[4] === egress));
      assert.ok((store.values.get(egress) ?? 0) > 1);
    }
    for (const gateway of gateways) assert.equal(gateway.accounting().pendingWrites + gateway.accounting().failedOrAmbiguousWrites, 0);
  } finally {
    await Promise.all(gateways.map(gateway => gateway.close())); globalThis.fetch = prior;
  }
});
