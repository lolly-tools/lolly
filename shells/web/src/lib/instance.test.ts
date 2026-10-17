// SPDX-License-Identifier: MPL-2.0
/**
 * Instance-base unit tests - the pure parts (URL validation/normalization and
 * path prefixing) that don't touch IndexedDB. setInstanceBase/initInstanceBase
 * go through bridge/db.ts's real IndexedDB, which node:test has no fake for
 * (see font-registry.test.ts's header for the same split); _setBaseForTests
 * exercises getInstanceBase/instancePath's reaction to a base without it.
 *
 * Run directly:  node --test shells/web/src/lib/instance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeInstanceBase, instancePath, getInstanceBase, _setBaseForTests, setInstallTag, clientHeaderValue, setInstanceSession, hasInstanceSession, instanceFetch } from './instance.ts';

// ── normalizeInstanceBase ────────────────────────────────────────────────────

test('normalizeInstanceBase: strips trailing slashes', () => {
  assert.equal(normalizeInstanceBase('https://demo.lolly.tools/'), 'https://demo.lolly.tools');
  assert.equal(normalizeInstanceBase('https://demo.lolly.tools///'), 'https://demo.lolly.tools');
});

test('normalizeInstanceBase: keeps an explicit port', () => {
  assert.equal(normalizeInstanceBase('https://192.168.1.5:8443'), 'https://192.168.1.5:8443');
});

test('normalizeInstanceBase: keeps a sub-path deployment', () => {
  assert.equal(normalizeInstanceBase('https://example.com/lolly/'), 'https://example.com/lolly');
});

test('normalizeInstanceBase: drops query and hash (a base is a prefix, not a page)', () => {
  assert.equal(normalizeInstanceBase('https://example.com/lolly?foo=bar#frag'), 'https://example.com/lolly');
});

test('normalizeInstanceBase: rejects http (https only)', () => {
  assert.throws(() => normalizeInstanceBase('http://example.com'), /https/);
});

test('normalizeInstanceBase: rejects embedded credentials', () => {
  assert.throws(() => normalizeInstanceBase('https://user:pass@example.com'), /credentials/);
});

test('normalizeInstanceBase: rejects unparsable input', () => {
  assert.throws(() => normalizeInstanceBase('not a url'), /valid URL/);
});

test('normalizeInstanceBase: trims surrounding whitespace before parsing', () => {
  assert.equal(normalizeInstanceBase('  https://example.com  '), 'https://example.com');
});

// ── instancePath ──────────────────────────────────────────────────────────────

test('instancePath: passthrough when no base is set (default, byte-identical)', () => {
  _setBaseForTests('');
  assert.equal(getInstanceBase(), '');
  assert.equal(instancePath('/catalog/tools/index.json'), '/catalog/tools/index.json');
  assert.equal(instancePath('/tools/qr-code/tool.json'), '/tools/qr-code/tool.json');
});

test('instancePath: prefixes a root-relative path with the base', () => {
  _setBaseForTests('https://demo.lolly.tools');
  assert.equal(getInstanceBase(), 'https://demo.lolly.tools');
  assert.equal(instancePath('/catalog/tools/index.json'), 'https://demo.lolly.tools/catalog/tools/index.json');
  _setBaseForTests('');
});

test('instancePath: joins a non-slash-prefixed path with a single slash', () => {
  _setBaseForTests('https://demo.lolly.tools');
  assert.equal(instancePath('tools/qr-code/tool.json'), 'https://demo.lolly.tools/tools/qr-code/tool.json');
  _setBaseForTests('');
});

test('instancePath: leaves an already-absolute URL untouched (e.g. a re-absolutized asset format URL)', () => {
  _setBaseForTests('https://demo.lolly.tools');
  assert.equal(
    instancePath('https://other-cdn.example.com/asset.png'),
    'https://other-cdn.example.com/asset.png',
  );
  assert.equal(
    instancePath('http://legacy.example.com/asset.png'),
    'http://legacy.example.com/asset.png',
  );
  _setBaseForTests('');
});

test('instancePath: sub-path base composes correctly', () => {
  _setBaseForTests('https://example.com/lolly');
  assert.equal(instancePath('/catalog/assets/index.json'), 'https://example.com/lolly/catalog/assets/index.json');
  _setBaseForTests('');
});

// ── install tag on the client header ─────────────────────────────────────────
// clientHeaderValue is the ONE place the x-lolly-client value is built, so
// these pin the whole install-identity surface the header can ever carry.

test('clientHeaderValue: untagged by default, and the tag joins only while set', () => {
  setInstallTag(null);
  const untagged = clientHeaderValue();
  assert.match(untagged, /^web engine\/\d+\.\d+\.\d+$/, 'no install token unless org/ turned it on');
  setInstallTag('9f2c1a44-7b1e-4e02-8f45-0a1b2c3d4e5f');
  assert.equal(clientHeaderValue(), `${untagged} install/9f2c1a44-7b1e-4e02-8f45-0a1b2c3d4e5f`);
  setInstallTag(null);
  assert.equal(clientHeaderValue(), untagged, 'clearing the tag restores the untagged header');
});

test('setInstallTag: anything outside the header grammar is refused, not escaped', () => {
  const untagged = clientHeaderValue();
  for (const bad of ['has space', 'semi;colon', 'newline\nx', 'x'.repeat(65), '']) {
    setInstallTag(bad);
    assert.equal(clientHeaderValue(), untagged, `refused: ${JSON.stringify(bad)}`);
  }
});

test('native sessions remain bound to the instance that issued them', async (ctx) => {
  const NativeRequest = globalThis.Request;
  // Match the WebView's forbidden-header guard, which Node's Request lacks.
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, init);
      const set = this.headers.set.bind(this.headers);
      this.headers.set = (name, value) => { if (name.toLowerCase() !== 'cookie') set(name, value); };
    }
  };
  ctx.after(() => { globalThis.Request = NativeRequest; });
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const savedLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const requests: Array<{ url: string; headers: Array<[string, string]> }> = [];
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://shell.example' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    __TAURI_INTERNALS__: { invoke: async (_command: string, args: { request: typeof requests[number] }) => {
      requests.push(args.request);
      return { status: 200, statusText: 'OK', url: args.request.url, headers: [], body: [] };
    } },
  } });
  ctx.after(async () => {
    await setInstanceSession(null);
    _setBaseForTests('');
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (savedLocation) Object.defineProperty(globalThis, 'location', savedLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  });
  _setBaseForTests('https://first.example');
  await setInstanceSession('lw_session=test-session');
  assert.ok(hasInstanceSession());
  await instanceFetch('https://first.example/api/v1/session');
  assert.equal(new Headers(requests.at(-1)!.headers).get('cookie'), 'lw_session=test-session');
  await instanceFetch('https://other.example/catalog/assets/index.json');
  assert.equal(new Headers(requests.at(-1)!.headers).get('cookie'), null);
  _setBaseForTests('https://second.example');
  assert.equal(hasInstanceSession(), false);
  await instanceFetch('https://second.example/api/v1/session');
  assert.equal(new Headers(requests.at(-1)!.headers).get('cookie'), null);
  await setInstanceSession('lw_session=late-session', 'https://first.example');
  assert.equal(hasInstanceSession(), false);
});

test('shell readers lower native byte and time bounds before IPC', async ctx => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const savedLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const requests: Array<{ timeoutMs?: number; maxResponseBytes?: number }> = [];
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://shell.example' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    __TAURI_INTERNALS__: { invoke: async (_command: string, args: { request: typeof requests[number] }) => {
      requests.push(args.request);
      return { status: 200, statusText: 'OK', url: 'https://remote.example/file', headers: [], body: [] };
    } },
  } });
  ctx.after(() => {
    for (const [key, value] of [['window', savedWindow], ['location', savedLocation]] as const) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  await instanceFetch('https://remote.example/file', undefined, { timeoutMs: 15000, maxResponseBytes: 32 * 1024 * 1024 });
  assert.equal(requests[0]!.timeoutMs, 15000);
  assert.equal(requests[0]!.maxResponseBytes, 32 * 1024 * 1024);
  await instanceFetch('https://remote.example/media');
  assert.equal(requests[1]!.timeoutMs, undefined);
  assert.equal(requests[1]!.maxResponseBytes, undefined);
  await assert.rejects(instanceFetch('https://remote.example/file', undefined, { maxResponseBytes: 0 }), /positive integers/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(instanceFetch('https://remote.example/file', { signal: abort.signal }), { name: 'AbortError' });
  assert.equal(requests.length, 2);
  let browserFallback = 0;
  await instanceFetch('https://shell.example/catalog/file', {}, { fallbackFetch: async (_url, init) => {
    browserFallback++;
    assert.ok(new Headers(init?.headers).has('x-lolly-client'));
    return new Response('verified bytes');
  } });
  assert.equal(browserFallback, 1);
  assert.equal(requests.length, 2);
});

// ── Redirects to delivery tokens ─────────────────────────────────────────────
// A Work instance may answer a byte route with a 302 to a token address on its
// own origin: `/e/i/<sha256>.<ext>?dt=` for instance-private catalog bytes, or
// `/o/<key>.<ext>?X-Amz-...` for offloaded project files. The native command
// follows the hop in Rust, so the adapter only ever sees the final answer.
// token-url-guard.test.ts pins the other half: nothing the shell keeps is built
// from that final address.

const WORK = 'https://work.example';
const E_TOKEN_URL = `${WORK}/e/i/${'a'.repeat(64)}.png?dt=1.k1.1760702400.${'d'.repeat(43)}`;
const O_TOKEN_URL = `${WORK}/o/${'b'.repeat(64)}.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256`
  + '&X-Amz-Credential=EXAMPLEKEY%2F20261017%2Feu-north-1%2Fs3%2Faws4_request'
  + `&X-Amz-Date=20261017T120000Z&X-Amz-Expires=60&X-Amz-SignedHeaders=host&X-Amz-Signature=${'c'.repeat(64)}`;
const TOKEN_IN_URL = /[?&]dt=|X-Amz-/i;

test('a same-origin 302 to /e/ or /o/ still answers through the Tauri transport', async ctx => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const savedLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const redirects = new Map([
    [`${WORK}/catalog/inst/asset-1/png?v=3`, E_TOKEN_URL],
    [`${WORK}/api/v1/projects/p1/files/f1`, O_TOKEN_URL],
  ]);
  const bytes = [0x89, 0x50, 0x4e, 0x47, 1, 2, 3];
  const requests: Array<{ method: string; url: string; headers: Array<[string, string]> }> = [];
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'tauri://localhost' } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    __TAURI_INTERNALS__: { invoke: async (command: string, args: { request: typeof requests[number] }) => {
      assert.equal(command, 'remote_fetch');
      requests.push(args.request);
      // What remote_fetch returns once it has followed the hop: the final
      // answer, carrying the address it came from (response.url() in Rust).
      const final = redirects.get(args.request.url);
      assert.ok(final, `unexpected native request ${args.request.url}`);
      return {
        status: 200, statusText: 'OK', url: final, body: bytes,
        headers: [['content-type', 'image/png'], ['cache-control', 'private, no-store'], ['referrer-policy', 'no-referrer']],
      };
    } },
  } });
  ctx.after(async () => {
    await setInstanceSession(null);
    _setBaseForTests('');
    for (const [key, value] of [['window', savedWindow], ['location', savedLocation]] as const) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  _setBaseForTests(WORK);
  await setInstanceSession('lw_session=member-session');

  for (const [stable, final] of redirects) {
    const response = await instanceFetch(stable);
    assert.equal(response.ok, true, stable);
    assert.equal(response.status, 200);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], bytes);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.url, final, 'the response reports where its bytes came from, as window.fetch does');
    const sent = requests.at(-1)!;
    assert.equal(sent.method, 'GET');
    assert.equal(sent.url, stable, 'the shell asks for the stable address; the hop happens in Rust');
    assert.equal(new Headers(sent.headers).get('cookie'), 'lw_session=member-session');
    assert.ok(new Headers(sent.headers).has('x-lolly-client'));
  }

  // A token lives for 60 to 300 seconds, so a later read asks for the stable
  // address again instead of reusing the address of an earlier answer.
  await instanceFetch(instancePath('/catalog/inst/asset-1/png?v=3'));
  assert.equal(requests.at(-1)!.url, `${WORK}/catalog/inst/asset-1/png?v=3`);
  assert.equal(requests.length, 3);
  assert.ok(requests.every(request => !TOKEN_IN_URL.test(request.url)), 'no token address is ever sent back as a request');
  assert.equal(getInstanceBase(), WORK, 'a redirect does not move the instance base');
  assert.ok(hasInstanceSession(), 'nor unbind the session from the instance that issued it');
});

test('the native command follows that hop and reports the final address', () => {
  for (const shell of ['tauri-desktop', 'tauri-mobile']) {
    const source = readFileSync(new URL(`../../../${shell}/src-tauri/src/remote_fetch.rs`, import.meta.url), 'utf8');
    assert.match(source, /fn follows_redirect\(status: u16\) -> bool \{\s*matches!\(status, 301 \| 302 \| 303 \| 307 \| 308\)/,
      `${shell} follows a 302`);
    assert.match(source, /if origin\(&url\) != origin\(&next\) \{\s*headers\.remove\(AUTHORIZATION\);\s*headers\.remove\(COOKIE\);\s*\}/,
      `${shell} keeps credentials on the instance origin and drops them on a hop to another one`);
    assert.match(source, /let final_url = response\.url\(\)\.to_string\(\);[\s\S]*?url: final_url,/,
      `${shell} reports the address the bytes came from`);
    const maxUrl = /const MAX_URL_BYTES: usize = (\d+) \* 1024;/.exec(source);
    assert.ok(maxUrl && O_TOKEN_URL.length < Number(maxUrl[1]) * 1024, `${shell} accepts a presigned /o/ address`);
  }
});
