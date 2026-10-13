// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseConnectorOrigins, configureConnectPolicy, headerApprovesConnector, connectSources } from '../packages/core/src/connector-origins.ts';
import { ConnectorOriginError, createConnectorGuard } from '../shells/web/src/lib/connector-policy.ts';
import { configureDeploymentOrigins } from '../scripts/configure-connector-origins.ts';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';
import { connectorDevPolicy } from '../scripts/vite-connector-policy.mjs';

test('connector configuration canonicalizes exact HTTPS DNS origins and refuses wider syntax', () => {
  assert.deepEqual(parseConnectorOrigins('https://STORAGE.example.com:443/ https://storage.example.com https://files.example.com:8443'),
    ['https://files.example.com:8443', 'https://storage.example.com']);
  for (const value of ['https:', 'https://*.example.com', 'https://example.com/file', 'https://user@example.com',
    'https://example.com?x=1', 'https://example.com#x', 'https://example.com\n', 'http://example.com',
    'https://example.com:65536', 'https://example.com:0', 'https://example.com.', 'https://127.0.0.1',
    'https://example..com', 'https://localhost', 'https://-files.example.com', 'https://example.com\\other']) {
    assert.throws(() => parseConnectorOrigins(value), Error, value);
  }
  assert.throws(() => parseConnectorOrigins('https://example.com '.repeat(65)));
  assert.deepEqual(parseConnectorOrigins(''), []);
});

test('deployment configuration alters only connect-src and keeps exact fixed API origins', () => {
  const policy = "default-src 'self'; connect-src 'self'; img-src 'self' data:; frame-src 'self'";
  const configured = configureConnectPolicy(policy, ['https://storage.example.com']);
  assert.equal(configured.split(';')[0], policy.split(';')[0]);
  assert.equal(configured.split(';').slice(2).join(';'), policy.split(';').slice(2).join(';'));
  assert.match(configured, /https:\/\/graph.microsoft.com/);
  assert.match(configured, /https:\/\/storage.example.com/);
  assert.doesNotMatch(configured, /https:\/\/\*| https:(?: |;)/);
  const text = configureDeploymentOrigins(`default "${policy}";`, 'https://storage.example.com');
  assert.equal(configureDeploymentOrigins(text, 'https://storage.example.com'), text);
  assert.throws(() => configureDeploymentOrigins('connect-src https:;', ''));
});

test('default deployment connections match the shared public API policy', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const block of config.headers) {
    const policy = block.headers.find((header: { key: string }) => header.key === 'Content-Security-Policy')?.value;
    if (!policy) continue;
    assert.deepEqual(policy.match(/connect-src ([^;]+)/)[1].split(' ').sort(), connectSources().split(' ').sort());
  }
});

test('development policy uses only its exact WebSocket host and configured connector origins', () => {
  let middleware: (request: { headers: { host: string } }, response: any, next: () => void) => void;
  connectorDevPolicy().configureServer({ config: { server: {} }, middlewares: { use: (fn: typeof middleware) => { middleware = fn; } } });
  const headers = new Map<string, string>();
  middleware!({ headers: { host: 'localhost:5173' } }, { setHeader: (name: string, value: string) => headers.set(name, value) }, () => {});
  assert.match(headers.get('Content-Security-Policy')!, /ws:\/\/localhost:5173/);
  assert.doesNotMatch(headers.get('Content-Security-Policy')!.match(/connect-src ([^;]+)/)![1]!, /https:\/\/\*| https:(?: |$)/);
  let rejected = false;
  middleware!({ headers: { host: 'localhost:5173; custom' } }, { end: () => { rejected = true; } }, () => {});
  assert.equal(rejected, true);
});

test('web admission requires an exact origin in every enforced response policy', async () => {
  const origin = 'https://storage.example.com';
  assert.equal(headerApprovesConnector('connect-src https:', origin), false);
  assert.equal(headerApprovesConnector('connect-src https://*.example.com', origin), false);
  assert.equal(headerApprovesConnector(`connect-src ${origin}, connect-src 'self'`, origin), false);
  assert.equal(headerApprovesConnector(`connect-src ${origin}; connect-src 'self'`, origin), true);
  let reads = 0;
  const guard = createConnectorGuard(async () => { reads++; return `connect-src ${origin}`; });
  await guard('https://graph.microsoft.com/v1.0/me');
  assert.equal(reads, 0);
  await guard(`${origin}/upload?session=opaque`);
  await assert.rejects(guard('https://other.example.com/upload?session=opaque'), ConnectorOriginError);
  await assert.rejects(guard(`${origin}:8443/upload`), ConnectorOriginError);
  await assert.rejects(createConnectorGuard(async () => { throw new Error('unavailable'); })(`${origin}/upload`), ConnectorOriginError);
});

test('native configured connector admission never consults mutable deployment headers', async () => {
  const guard = createConnectorGuard(async () => { throw new Error('must not read'); }, true, ['https://storage.example.com']);
  await guard('https://storage.example.com/upload');
  await guard('https://oauth2.googleapis.com/token');
  await assert.rejects(guard('https://other.example.com/upload'), ConnectorOriginError);
  await assert.rejects(guard('https://user:secret@storage.example.com/upload'));
});

test('denied connector sends no credentials or file bytes and keeps the caller data', async () => {
  let transported = 0;
  const bytes = new Uint8Array([1, 2, 3]);
  const guard = createConnectorGuard(async () => "connect-src 'self'");
  const send = async () => {
    await guard('https://unconfigured.example.com/upload?token=opaque');
    transported++;
    return new Request('https://unconfigured.example.com/upload', { method: 'PUT', headers: { Authorization: 'test' }, body: bytes });
  };
  await assert.rejects(send(), error => error instanceof ConnectorOriginError && !error.message.includes('opaque') && error.message.includes('save your work'));
  assert.equal(transported, 0);
  assert.deepEqual(bytes, new Uint8Array([1, 2, 3]));
});

test('sovereign connector configuration renders exact origins and refuses wider grants', { skip: spawnSync('helm', ['version', '--short']).status !== 0 && 'Helm executable is required for connector deployment checks.' }, () => {
  const chart = fileURLToPath(new URL('../deploy/helm/profiles/sovereign/', import.meta.url));
  const fixture = JSON.parse(readFileSync(`${chart}fixture.values.json`, 'utf8'));
  const render = (origins: string[]) => spawnSync('helm', ['template', 'fixture', chart, '--namespace', 'lolly-public', '-f', '-'],
    { input: JSON.stringify({ ...fixture, connectorOrigins: origins }), encoding: 'utf8', timeout: 10000 });
  const baseline = render([]); assert.equal(baseline.status, 0, baseline.stderr);
  const configured = render(['https://storage.example.com:8443']); assert.equal(configured.status, 0, configured.stderr);
  const documents = parseAllDocuments(configured.stdout).map(document => document.toJSON());
  const config = documents.find(document => document.kind === 'ConfigMap' && document.metadata.name === 'fixture-nginx').data['default.conf'];
  assert.equal(config.match(/https:\/\/storage.example.com:8443/g).length, 2);
  assert.doesNotMatch(config.match(/connect-src [^;]+/g).join(' '), /https:\/\/\*| https:(?: |;)/);
  const annotations = (text: string) => parseAllDocuments(text).map(document => document.toJSON())
    .find(document => document.kind === 'Deployment' && document.metadata.name === 'fixture-web').spec.template.metadata.annotations['checksum/nginx'];
  assert.notEqual(annotations(configured.stdout), annotations(baseline.stdout));
  for (const origin of ['https://*.example.com', 'https://storage.example.com/path', 'https:', 'https://storage.example.com:65536']) {
    assert.notEqual(render([origin]).status, 0, origin);
  }
});
