// SPDX-License-Identifier: MPL-2.0
/** Ephemeral real HTTP fixture; no production credentials or admission store. */
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, request, type IncomingHttpHeaders, type Server } from 'node:http';
import { access, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGateway } from '../src/gateway.ts';
import { ResultFiles } from '../src/result-files.ts';
import { MemoryUsageBudget } from '../src/usage-budget.ts';

export type HttpResult = { status: number; headers: IncomingHttpHeaders; bytes: Buffer };
export class ObservedBudget extends MemoryUsageBudget {
  readonly records: number[] = [];
  constructor() { super({ cpuMs: 0, egressBytes: 512 * 1024 * 1024 }); }
  override async record(bytes: number): Promise<void> { this.records.push(bytes); await super.record(bytes); }
}

function exchange(port: number, path: string, method: string, headers: Record<string, string>, body?: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers, signal: AbortSignal.timeout(20_000) }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 64 * 1024 * 1024) res.destroy(new Error('Probe response exceeds its byte bound.'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end(body);
  });
}

export class ResultLinksFixture {
  readonly files: ResultFiles;
  readonly budget = new ObservedBudget();
  readonly env: NodeJS.ProcessEnv;
  readonly server: Server;
  private port = 0;
  private closed = false;
  constructor(lifetimeSeconds = 300, overrides: NodeJS.ProcessEnv = {}) {
    this.files = new ResultFiles(Date.now, lifetimeSeconds);
    this.env = { NODE_ENV: 'production', LOLLY_MCP_PRIVATE_FILES: '1', LOLLY_MCP_REPLICAS: '1',
      LOLLY_MCP_TOKEN: randomBytes(32).toString('base64url'), LOLLY_MCP_SIGNING_SECRET: randomBytes(32).toString('base64url'),
      LOLLY_MCP_PUBLIC_ORIGIN: 'https://result-probe.invalid', LOLLY_MCP_ALLOW_ANONYMOUS: '0',
      LOLLY_ALLOW_IN_MEMORY_RATE_LIMIT: '1', ...overrides };
    const gateway = createGateway(this.env, { resultFiles: this.files, budget: this.budget });
    this.server = createServer((req, res) => {
      void gateway(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500, { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store' });
        res.end();
      });
    });
  }
  async start(): Promise<this> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject); this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address(); assert.ok(address && typeof address !== 'string'); this.port = address.port;
    return this;
  }
  get bearer(): string { return this.env.LOLLY_MCP_TOKEN ?? ''; }
  get origin(): string { return this.env.LOLLY_MCP_PUBLIC_ORIGIN!; }
  http(path: string, bearer = this.bearer, method = 'GET', headers: Record<string, string> = {}, body?: string): Promise<HttpResult> {
    return exchange(this.port, path, method, { 'accept-encoding': 'identity', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers }, body);
  }
  rpc(name: string, args: Record<string, unknown> = {}, bearer = this.bearer): Promise<HttpResult> {
    return this.http('/api/mcp', bearer, 'POST', { 'content-type': 'application/json' },
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }));
  }
  async oauthBearer(): Promise<string> {
    const redirect = 'https://client-probe.invalid/callback';
    const registration = await this.http('/api/mcp/register', '', 'POST', { 'content-type': 'application/json' }, JSON.stringify({ redirect_uris: [redirect] }));
    assert.equal(registration.status, 201);
    const client = JSON.parse(registration.bytes.toString()) as { client_id: string };
    const verifier = randomBytes(32).toString('base64url');
    const form = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect, response_type: 'code',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', passphrase: this.bearer });
    const authorized = await this.http('/api/mcp/authorize', '', 'POST', { 'content-type': 'application/x-www-form-urlencoded' }, form.toString());
    assert.equal(authorized.status, 302); assert.equal(typeof authorized.headers.location, 'string');
    const code = new URL(authorized.headers.location as string).searchParams.get('code'); assert.ok(code);
    const grant = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id, redirect_uri: redirect });
    const exchanged = await this.http('/api/mcp/token', '', 'POST', { 'content-type': 'application/x-www-form-urlencoded' }, grant.toString());
    assert.equal(exchanged.status, 200);
    const token = JSON.parse(exchanged.bytes.toString()) as { access_token: string }; assert.equal(typeof token.access_token, 'string');
    return token.access_token;
  }
  async close(): Promise<void> {
    if (this.closed) return; this.closed = true;
    this.server.closeAllConnections();
    if (this.server.listening) await new Promise<void>((resolve, reject) => this.server.close(error => error ? reject(error) : resolve()));
    await this.files.close();
  }
}

/** Find only this held UUID in a mkdtemp-owned fixture directory. */
export async function heldFilePath(uri: string): Promise<string> {
  const id = new URL(uri).pathname.split('/').pop(); assert.match(id ?? '', /^[a-f0-9-]{36}$/);
  const matches: string[] = [];
  for (const name of await readdir(tmpdir())) {
    if (!name.startsWith('lolly-mcp-results-')) continue;
    const path = join(tmpdir(), name, id!);
    try { await access(path); matches.push(path); } catch { /* Another process's directory has a different UUID. */ }
  }
  assert.equal(matches.length, 1); return matches[0]!;
}

/** A valid blank-page PDF with a real whitespace content stream, not a rendered deck. */
export function pdfByteFixture(streamBytes: number): Buffer {
  const chunks = [Buffer.from('%PDF-1.7\n')]; const offsets = [0]; let position = chunks[0]!.length;
  const object = (id: number, body: Buffer) => {
    offsets.push(position); const bytes = Buffer.concat([Buffer.from(`${id} 0 obj\n`), body, Buffer.from('\nendobj\n')]);
    chunks.push(bytes); position += bytes.length;
  };
  object(1, Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, Buffer.from('<< /Type /Pages /Count 1 /Kids [3 0 R] >>'));
  object(3, Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 32 32] /Contents 4 0 R >>'));
  object(4, Buffer.concat([Buffer.from(`<< /Length ${streamBytes} >>\nstream\n`), Buffer.alloc(streamBytes, 32), Buffer.from('\nendstream')]));
  chunks.push(Buffer.from(`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
