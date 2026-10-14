// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureConnectPolicy } from '../packages/core/src/connector-origins.ts';

test('browser and native connector paths retain work and refuse unconfigured destinations', {
  skip: process.env.LOLLY_CONNECTOR_BROWSER_TESTS !== '1' && 'Set LOLLY_CONNECTOR_BROWSER_TESTS=1 for isolated HTTPS browser checks.', timeout: 60000,
}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lolly-connector-browser-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(directory, 'key.pem'),
    '-out', join(directory, 'cert.pem'), '-days', '1', '-subj', '/CN=app.example.test', '-addext', 'subjectAltName=DNS:*.example.test'], { stdio: 'ignore' });
  let script = '', policy = '', approvedRequests = 0, otherRequests = 0, received = '';
  const server = createServer({ key: await readFile(join(directory, 'key.pem')), cert: await readFile(join(directory, 'cert.pem')) }, async (request, response) => {
    const host = request.headers.host?.split(':')[0];
    response.setHeader('Content-Security-Policy', policy);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'PUT, GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (request.method === 'OPTIONS') { response.end(); return; }
    if (host === 'other.example.test') { otherRequests++; response.end('other'); return; }
    if (host === 'approved.example.test') {
      approvedRequests++;
      if (request.url === '/redirect') {
        response.writeHead(307, { Location: `https://other.example.test:${port}/upload` }); response.end(); return;
      }
      for await (const bytes of request) received += String(bytes);
      response.end('ok'); return;
    }
    if (request.url === '/connector.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(script); return; }
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><input id="draft" value="saved draft"><script type="module" src="/connector.js"></script>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const port = (server.address() as import('node:net').AddressInfo).port;
  const approved = `https://approved.example.test:${port}`, other = `https://other.example.test:${port}`;
  policy = configureConnectPolicy("default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'", [approved]);
  const { build } = await import('esbuild');
  script = (await build({ stdin: { contents: "import{providerFetch}from'./shells/web/src/lib/provider-auth.ts';window.connectorFetch=providerFetch;", resolveDir: new URL('../', import.meta.url).pathname },
    bundle: true, write: false, platform: 'browser', format: 'esm', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ VITE_CONNECTOR_ORIGINS: approved }) } })).outputFiles[0]!.text;
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true,
    args: ['--no-proxy-server', '--host-resolver-rules=MAP *.example.test 127.0.0.1'] });
  t.after(() => browser.close());
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`https://app.example.test:${port}/`);
  await page.waitForFunction(() => typeof (window as any).connectorFetch === 'function');
  assert.equal(await page.evaluate(async url => (await (window as any).connectorFetch(url, { method: 'PUT', headers: { Authorization: 'fixture' }, body: 'local draft bytes' })).text(), `${approved}/upload`), 'ok');
  assert.equal(received, 'local draft bytes'); assert.equal(approvedRequests, 1);
  const denied = await page.evaluate(async url => {
    try { await (window as any).connectorFetch(url, { method: 'PUT', headers: { Authorization: 'fixture' }, body: 'retained bytes' }); return ''; }
    catch (error) { return String(error); }
  }, `${other}/upload?session=fixture`);
  assert.match(denied, /save your work/); assert.doesNotMatch(denied, /session=fixture/);
  assert.equal(otherRequests, 0); assert.equal(await page.locator('#draft').inputValue(), 'saved draft');
  assert.equal(await page.evaluate(async url => { try { await fetch(url, { method: 'PUT', body: 'retained bytes' }); return false; } catch { return true; } }, `${other}/upload`), true);
  assert.equal(otherRequests, 0);
  assert.equal(await page.evaluate(async url => { try { await (window as any).connectorFetch(url, { method: 'PUT', body: 'draft' }); return false; } catch { return true; } }, `${approved}/redirect`), true);
  assert.equal(otherRequests, 0);
  await page.evaluate(() => {
    (window as any).nativeCalls = [];
    (window as any).__TAURI_INTERNALS__ = { invoke: async (_name: string, args: unknown) => {
      (window as any).nativeCalls.push(args);
      return { status: 200, statusText: 'OK', url: 'https://approved.example.test', headers: [], body: [111, 107] };
    } };
  });
  assert.equal(await page.evaluate(async url => (await (window as any).connectorFetch(url, { method: 'PUT', headers: { Authorization: 'fixture' }, body: 'native bytes' })).text(), `${approved}/upload`), 'ok');
  const calls = await page.evaluate(() => (window as any).nativeCalls);
  assert.equal(calls.length, 1); assert.ok(calls[0].request.allowedOrigins.includes(approved));
  assert.equal(new TextDecoder().decode(Uint8Array.from(calls[0].request.body)), 'native bytes');
  assert.equal(await page.evaluate(async url => { try { await (window as any).connectorFetch(url, { method: 'PUT', body: 'retained bytes' }); return false; } catch { return true; } }, `${other}/upload`), true);
  assert.equal(await page.evaluate(() => (window as any).nativeCalls.length), 1);
  assert.equal(await page.locator('#draft').inputValue(), 'saved draft');
});
