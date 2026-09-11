// SPDX-License-Identifier: MPL-2.0
/**
 * Unit coverage for the website source (sources/website.ts).
 *
 * Everything here runs under bare node with no browser, no extension and no
 * network - which is the design being tested as much as it is the test setup:
 * the transports are injected, so a fake records what was asked for and answers
 * with plain data, and every judgement in the module (address validation, byte
 * decoding, type sniffing, logo pairing, screenshot balancing) is a pure
 * function taking plain data.
 *
 * Two assertions matter more than the rest, because they are the plan's privacy
 * posture rather than a behaviour: a refused address never reaches the
 * transport, and a scan calls the transport exactly once for exactly the
 * address it validated.
 *
 * `extract-site.ts`, `census.ts` and `tray.ts` are the real modules - the point
 * of the happy path is that a page arrives in the tray as candidates, and a stub
 * census could not answer that.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/sources/website.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { candidatesFromCensus } from '../tray.ts';
import {
  SITE_MAX_ASSETS, SITE_MAX_LOGOS, SITE_MAX_LOGO_BYTES, SITE_MAX_URL_CHARS, SITE_MAX_HTML_CHARS,
  balanceShotWeights, coerceFetchResult, detectSiteTransport, normalizeSiteUrl,
  pairLogoAssets, scanWebsite, sniffImageMime, toBytes,
} from './website.ts';
import type { SiteAsset, SiteFetchResult, SiteScanPhase, SiteTransport } from './website.ts';
import type { DesignCensus } from '../census.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PAGE = `<!doctype html>
<html><head>
  <title>Acme Corp - Home</title>
  <meta property="og:site_name" content="Acme">
  <meta name="theme-color" content="#1E4FD8">
  <link rel="apple-touch-icon" href="/touch-icon.png">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap">
  <style>h1 { font-family: "Grotesk Display", sans-serif; color: #1E4FD8 }</style>
</head><body>
  <img src="/img/acme-logo.svg" alt="Acme logo">
  <p style="color:#111111">Hello</p>
</body></html>`;

const SHEET = `
:root { --brand: #1E4FD8 }
body { background: #FFFFFF; font-family: Inter, system-ui, sans-serif }
.cta { background-color: #1E4FD8; color: #FFFFFF }
`;

/** A one-pixel PNG: the eight-byte signature is all `sniffImageMime` reads. */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
const HTML_BYTES = new TextEncoder().encode('<!doctype html><html><body>404</body></html>');

const asset = (url: string, bytes: Uint8Array, mime = 'image/png'): SiteAsset => ({ url, bytes, mime });

/** A transport that answers with fixed material and records every call. */
function fakeTransport(
  answer: Partial<SiteFetchResult> | (() => Promise<never>),
  kind: SiteTransport['kind'] = 'extension',
): SiteTransport & { calls: { url: string; timeoutMs?: number }[] } {
  const calls: { url: string; timeoutMs?: number }[] = [];
  return {
    kind,
    label: kind === 'extension' ? 'extension-tab' : 'native-fetch',
    calls,
    async fetchSite(url, opts) {
      calls.push({ url, timeoutMs: opts?.timeoutMs });
      if (typeof answer === 'function') return answer();
      return {
        html: '', cssTexts: [], assets: [], finalUrl: url,
        ...answer,
      } as SiteFetchResult;
    },
  };
}

const scanned = (r: Awaited<ReturnType<typeof scanWebsite>>): Extract<typeof r, { kind: 'scanned' }> => {
  assert.equal(r.kind, 'scanned', `expected a scan, got ${JSON.stringify(r)}`);
  return r as Extract<typeof r, { kind: 'scanned' }>;
};

// ── Addresses ────────────────────────────────────────────────────────────────

test('normalizeSiteUrl: https is assumed, never http', () => {
  const r = normalizeSiteUrl('suse.com/brand');
  assert.ok(r.ok && r.url === 'https://suse.com/brand');
  assert.ok(r.ok && r.siteHost === 'suse.com');
  // An explicitly unencrypted address is the person's own call and is honoured.
  const plain = normalizeSiteUrl('http://intranet.local/style');
  assert.ok(plain.ok && plain.url === 'http://intranet.local/style');
});

test('normalizeSiteUrl: a bare host:port is a port, not a scheme', () => {
  const r = normalizeSiteUrl('localhost:5173/start');
  assert.ok(r.ok && r.url === 'https://localhost:5173/start');
  assert.ok(r.ok && r.siteHost === 'localhost');
});

test('normalizeSiteUrl: only http(s) is fetchable', () => {
  for (const bad of [
    'javascript:alert(1)', 'data:text/html,<b>', 'file:///etc/passwd',
    'blob:https://x/y', 'chrome-extension://abc/page.html', 'ftp://files.example.com',
    'about:blank', 'mailto:a@b.c', 'view-source:https://example.com',
  ]) {
    const r = normalizeSiteUrl(bad);
    assert.equal(r.ok, false, bad);
    assert.equal((r as { reason: string }).reason, 'unsupported-scheme', bad);
  }
});

test('normalizeSiteUrl: credentials are refused, not stripped', () => {
  const r = normalizeSiteUrl('https://user:secret@example.com/');
  assert.deepEqual(r, { ok: false, reason: 'credentials-in-url' });
  assert.deepEqual(normalizeSiteUrl('https://user@example.com/'), { ok: false, reason: 'credentials-in-url' });
});

test('normalizeSiteUrl: the empty, the unreadable and the enormous', () => {
  assert.deepEqual(normalizeSiteUrl(''), { ok: false, reason: 'empty-url' });
  assert.deepEqual(normalizeSiteUrl('   '), { ok: false, reason: 'empty-url' });
  assert.deepEqual(normalizeSiteUrl(null), { ok: false, reason: 'empty-url' });
  assert.deepEqual(normalizeSiteUrl('https://exa mple.com'), { ok: false, reason: 'unparseable-url' });
  assert.deepEqual(normalizeSiteUrl('https://exa\nmple.com'), { ok: false, reason: 'unparseable-url' });
  assert.deepEqual(normalizeSiteUrl('https://'), { ok: false, reason: 'unparseable-url' });
  assert.deepEqual(
    normalizeSiteUrl(`https://example.com/${'a'.repeat(SITE_MAX_URL_CHARS)}`),
    { ok: false, reason: 'url-too-long' },
  );
});

test('normalizeSiteUrl: a fragment is a route and survives', () => {
  const r = normalizeSiteUrl('example.com/app#/pricing');
  assert.ok(r.ok && r.url === 'https://example.com/app#/pricing');
});

// ── Bytes across a transport boundary ────────────────────────────────────────

test('toBytes: every encoding a transport can carry', () => {
  assert.deepEqual([...(toBytes(new Uint8Array([1, 2, 3])) ?? [])], [1, 2, 3]);
  assert.deepEqual([...(toBytes([1, 2, 3]) ?? [])], [1, 2, 3]);
  assert.deepEqual([...(toBytes('AQID') ?? [])], [1, 2, 3]);              // base64
  assert.deepEqual([...(toBytes('data:image/png;base64,AQID') ?? [])], [1, 2, 3]);
  assert.equal(
    new TextDecoder().decode(toBytes('data:image/svg+xml,%3Csvg%3E') ?? new Uint8Array()),
    '<svg>',
  );
  assert.deepEqual([...(toBytes(new Uint8Array([9, 8, 7]).buffer) ?? [])], [9, 8, 7]);
});

test('toBytes: unreadable input is null, never a throw', () => {
  for (const bad of [null, undefined, 42, {}, '', 'not base64!!', [1, 'x', 3], new Uint8Array(0)]) {
    assert.equal(toBytes(bad), null, JSON.stringify(bad));
  }
});

test('sniffImageMime: the bytes decide, not the server', () => {
  assert.equal(sniffImageMime(PNG_BYTES), 'image/png');
  assert.equal(sniffImageMime(SVG_BYTES), 'image/svg+xml');
  assert.equal(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImageMime(new TextEncoder().encode('GIF89a...')), 'image/gif');
  assert.equal(sniffImageMime(new Uint8Array([0, 0, 1, 0, 1, 0])), 'image/x-icon');
  assert.equal(
    sniffImageMime(new TextEncoder().encode('RIFF____WEBPVP8 ')),
    'image/webp',
  );
  // The case this exists for: a 404 page served where a favicon was asked for.
  assert.equal(sniffImageMime(HTML_BYTES), null);
  assert.equal(sniffImageMime(new Uint8Array([1, 2])), null);
  assert.equal(sniffImageMime(null), null);
});

// ── Coercing a transport's answer ────────────────────────────────────────────

test('coerceFetchResult: wire encodings become the typed shape', () => {
  const { result } = coerceFetchResult({
    html: '<html></html>',
    cssTexts: ['a{}', 42, ''],
    assets: [
      { url: '/a.png', base64: 'AQID', mime: 'IMAGE/PNG' },
      { url: '/b.png', bytes: [4, 5, 6] },
      { url: '', bytes: [1] },              // no address - dropped
      { url: '/c.png' },                    // no bytes - dropped
    ],
    finalUrl: 'https://example.com/final',
    screenshotDataUrl: 'data:image/png;base64,AQID',
  }, 'https://example.com/');

  assert.equal(result.html, '<html></html>');
  assert.deepEqual(result.cssTexts, ['a{}']);
  assert.deepEqual(result.assets.map(a => a.url), ['/a.png', '/b.png']);
  assert.equal(result.assets[0]?.mime, 'image/png');
  assert.deepEqual([...(result.screenshot ?? [])], [1, 2, 3]);
  assert.equal(result.finalUrl, 'https://example.com/final');
});

test('coerceFetchResult: caps truncate and say so', () => {
  const { result, warnings } = coerceFetchResult(
    { html: 'x'.repeat(SITE_MAX_HTML_CHARS + 10) },
    'https://example.com/',
  );
  assert.equal(result.html.length, SITE_MAX_HTML_CHARS);
  assert.ok(warnings.includes('html-truncated'));
});

test('coerceFetchResult: a redirect somewhere unfetchable falls back to the address asked for', () => {
  const { result, warnings } = coerceFetchResult(
    { html: '<p>hi</p>', finalUrl: 'javascript:alert(1)' },
    'https://example.com/',
  );
  assert.equal(result.finalUrl, 'https://example.com/');
  assert.ok(warnings.includes('final-url-invalid'));
});

test('coerceFetchResult: nothing at all is an empty read, not a throw', () => {
  const { result } = coerceFetchResult(undefined, 'https://example.com/');
  assert.deepEqual(result, { html: '', cssTexts: [], assets: [], finalUrl: 'https://example.com/' });
});

test('coerceFetchResult: the asset list is capped by count and by bytes', () => {
  // The ceilings here exist for a transport that regressed, so the test hands it
  // exactly that: more files than any transport should send, and one carrier far
  // over the per-file limit. Both are refused HERE, before `toBytes` allocates.
  const many = Array.from({ length: SITE_MAX_ASSETS + 6 }, (_, i) => ({
    url: `https://acme.com/${i}.png`,
    bytes: [1, 2, 3],
  }));
  const { result, warnings } = coerceFetchResult({ assets: many }, 'https://acme.com/');
  assert.equal(result.assets.length, SITE_MAX_ASSETS);
  assert.ok(warnings.includes('assets-truncated'));

  const huge = 'A'.repeat(SITE_MAX_LOGO_BYTES * 2);   // base64: ~1.5x this in bytes
  const over = coerceFetchResult(
    { assets: [{ url: 'https://acme.com/hero.png', base64: huge }, { url: '/ok.png', bytes: [1] }] },
    'https://acme.com/',
  );
  assert.deepEqual(over.result.assets.map(a => a.url), ['/ok.png']);
  assert.ok(over.warnings.includes('logo-too-large'));
});

test('coerceFetchResult: a screenshot is taken under any of its four spellings', () => {
  // One fact, four field names, because each transport ships the name it ships.
  for (const key of ['screenshot', 'screenshotPng', 'screenshotDataUrl', 'screenshotBase64']) {
    const { result } = coerceFetchResult({ [key]: 'AQID' }, 'https://acme.com/');
    assert.deepEqual([...(result.screenshot ?? [])], [1, 2, 3], key);
  }
});

// ── Logo pairing ─────────────────────────────────────────────────────────────

test('pairLogoAssets: bytes ride along, and the parser keeps its ranking', () => {
  const { candidates } = pairLogoAssets(
    ['https://acme.com/touch-icon.png', 'https://acme.com/logo.svg'],
    [asset('/logo.svg', SVG_BYTES, 'text/plain'), asset('/touch-icon.png', PNG_BYTES)],
    { baseUrl: 'https://acme.com/' },
  );
  assert.deepEqual(candidates.map(c => c.url), [
    'https://acme.com/touch-icon.png', 'https://acme.com/logo.svg',
  ]);
  assert.equal(candidates[0]?.mime, 'image/png');
  // Declared `text/plain`, sniffed as SVG: the bytes win.
  assert.equal(candidates[1]?.mime, 'image/svg+xml');
});

test('pairLogoAssets: a URL with no bytes still travels', () => {
  const { candidates, warnings } = pairLogoAssets(['https://acme.com/og.png'], []);
  assert.deepEqual(candidates, [{ url: 'https://acme.com/og.png' }]);
  assert.deepEqual(warnings, []);
});

test('pairLogoAssets: bytes that are not an image are dropped and reported', () => {
  const { candidates, warnings } = pairLogoAssets(
    ['https://acme.com/favicon.ico'],
    [asset('https://acme.com/favicon.ico', HTML_BYTES, 'image/x-icon')],
  );
  assert.deepEqual(candidates, [{ url: 'https://acme.com/favicon.ico' }]);
  assert.deepEqual(warnings, ['logo-not-image']);
});

test('pairLogoAssets: an over-cap file keeps its URL and loses its bytes', () => {
  const huge = new Uint8Array(SITE_MAX_LOGO_BYTES + 1);
  huge.set(PNG_BYTES, 0);
  const { candidates, warnings } = pairLogoAssets(
    ['https://acme.com/hero.png'],
    [asset('https://acme.com/hero.png', huge)],
  );
  assert.equal(candidates[0]?.bytes, undefined);
  assert.deepEqual(warnings, ['logo-too-large']);
});

test('pairLogoAssets: deduped by resolved address, capped at the room ceiling', () => {
  const urls = Array.from({ length: SITE_MAX_LOGOS + 4 }, (_, i) => `https://acme.com/${i}.png`);
  assert.equal(pairLogoAssets(urls, []).candidates.length, SITE_MAX_LOGOS);

  const { candidates } = pairLogoAssets(
    ['/logo.png', 'https://acme.com/logo.png'],
    [asset('https://acme.com/logo.png', PNG_BYTES)],
    { baseUrl: 'https://acme.com/' },
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.mime, 'image/png');
});

// ── The screenshot's voice ───────────────────────────────────────────────────

const census = (colors: { hex: string; weight: number }[], label = 'x'): DesignCensus => ({
  colors: colors.map(c => ({ ...c, kind: 'fill' as const })),
  gradients: [], fonts: [], source: { kind: 'site', label },
});

test('balanceShotWeights: pixels and declarations get equal voice', () => {
  const site = census([{ hex: '#1E4FD8', weight: 6 }, { hex: '#FFFFFF', weight: 4 }]);
  const shot = census([{ hex: '#FFFFFF', weight: 90_000 }, { hex: '#30BA78', weight: 10_000 }], 'shot');
  const balanced = balanceShotWeights(site, shot);

  const total = balanced.colors.reduce((n, c) => n + c.weight, 0);
  assert.ok(Math.abs(total - 10) < 1e-9, `expected the site's own total, got ${total}`);
  // Proportion inside the screenshot is untouched: 9:1 before, 9:1 after.
  assert.ok(Math.abs((balanced.colors[0]?.weight ?? 0) / (balanced.colors[1]?.weight ?? 1) - 9) < 1e-9);
});

test('balanceShotWeights: with nothing to swamp, nothing is rescaled', () => {
  const shot = census([{ hex: '#30BA78', weight: 5_000 }], 'shot');
  assert.equal(balanceShotWeights(census([]), shot), shot);
  assert.equal(balanceShotWeights(census([{ hex: '#000000', weight: 3 }]), census([])).colors.length, 0);
});

// ── Transport detection ──────────────────────────────────────────────────────

const hostWith = (net: unknown): Parameters<typeof detectSiteTransport>[0] =>
  ({ net } as unknown as Parameters<typeof detectSiteTransport>[0]);

test('detectSiteTransport: no transport is the answer on a plain PWA', () => {
  // No Tauri member, and no extension probe under node: the tile must not render.
  assert.equal(detectSiteTransport(null), null);
  assert.equal(detectSiteTransport(hostWith(undefined)), null);
  assert.equal(detectSiteTransport(hostWith({ fetch: () => Promise.resolve(new Response()) })), null);
});

test('detectSiteTransport: the native member is probed by presence and coerces its answer', async () => {
  const seen: string[] = [];
  const net = {
    async _siteFetch(url: string) {
      seen.push(url);
      return { html: '<p>hi</p>', cssTexts: ['a{}'], assets: [], finalUrl: url };
    },
  };
  const transport = detectSiteTransport(hostWith(net));
  assert.ok(transport, 'expected a native transport');
  assert.equal(transport.kind, 'native');
  assert.equal(transport.label, 'native-fetch');

  const result = await transport.fetchSite('https://acme.com/');
  assert.equal(result.html, '<p>hi</p>');
  assert.deepEqual(seen, ['https://acme.com/']);
});

/**
 * The Tauri global, faked. This is the probe the whole native path hangs on, so
 * the fake is the runtime shape and nothing else: `__TAURI_INTERNALS__.invoke`.
 */
function withTauri<T>(invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>, run: () => T): T {
  const g = globalThis as { window?: unknown };
  const had = 'window' in g;
  const before = g.window;
  g.window = { __TAURI_INTERNALS__: { invoke } };
  try { return run(); } finally {
    if (had) g.window = before;
    else delete g.window;
  }
}

test('detectSiteTransport: a Tauri shell is found through its own global, not through a filename', async () => {
  // THE regression this file exists for. The build-time bridge override that was
  // supposed to supply `_siteFetch` is keyed on a module BASENAME, and there is
  // no web-shell file with that name - so it never fires, and its failure mode
  // is silence: `null` here means the Website tile is simply never rendered, on
  // the two shells the capabilities page names as the way to get one. A probe
  // that owns no filename cannot fail that way, which is why this asserts on the
  // global and on the exact command the Rust registers.
  const calls: { cmd: string; args?: Record<string, unknown> }[] = [];
  const invoke = async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    calls.push({ cmd, args });
    return { html: '<p>native</p>', cssTexts: ['a{}'], assets: [], finalUrl: 'https://acme.com/' };
  };

  const transport = withTauri(invoke, () => detectSiteTransport(null));
  assert.ok(transport, 'a Tauri shell must produce a transport');
  assert.equal(transport.kind, 'native');

  const result = await transport.fetchSite('https://acme.com/', { timeoutMs: 5_000 });
  assert.equal(result.html, '<p>native</p>');
  // `site_fetch` and `timeoutMs` are the contract with
  // shells/tauri-{desktop,mobile}/src-tauri/src/site_fetch.rs - Tauri maps the
  // camelCase key onto that command's `timeout_ms`. A rename there is a rename
  // in website.ts, and nothing else checks the two sides against each other.
  assert.deepEqual(calls, [{ cmd: 'site_fetch', args: { url: 'https://acme.com/', timeoutMs: 5_000 } }]);
});

test('detectSiteTransport: with no timeout asked for, the native side keeps its own default', async () => {
  const calls: Record<string, unknown>[] = [];
  const invoke = async (_cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    calls.push(args ?? {});
    return { html: '<p>hi</p>' };
  };
  const transport = withTauri(invoke, () => detectSiteTransport(null));
  await transport?.fetchSite('https://acme.com/');
  // No `timeoutMs` key at all, rather than an undefined one: the Rust's
  // Option<u64> default is a better number than anything guessed here.
  assert.deepEqual(calls, [{ url: 'https://acme.com/' }]);
});

test('detectSiteTransport: a bridge member outranks the global', async () => {
  // A shell that went to the trouble of providing `_siteFetch` knows something
  // this module does not, so it wins; the global is the fallback that cannot be
  // broken by a rename.
  const seen: string[] = [];
  const net = { async _siteFetch(url: string) { seen.push(url); return { html: '<p>bridge</p>' }; } };
  const invoke = async (): Promise<unknown> => { throw new Error('the global must not be reached'); };
  const transport = withTauri(invoke, () => detectSiteTransport(hostWith(net)));
  const result = await transport?.fetchSite('https://acme.com/');
  assert.equal(result?.html, '<p>bridge</p>');
  assert.deepEqual(seen, ['https://acme.com/']);
});

// ── The extension's wire protocol lives in ONE place ─────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The literals the shipped extension actually answers on.
 *
 * Pinned here as data because this is the drift that shipped: this module used
 * to carry its own extension client, posting `type: 'site'` and matching
 * `type: 'site-result'` with a top-level `id`, while the extension has always
 * spoken `lolly-capture/site` / `lolly-capture/site-result` with a `requestId`
 * and a flat payload. Neither the request nor the reply could ever match, and
 * the symptom was not an error - it was a 60 s wait ending in "{host} took too
 * long to answer", which blames the site for the app's own bug.
 */
const EXT_WIRE = [
  "'lolly-capture/site'",
  "'lolly-capture/site-result'",
  'requestId',
  'bytesBase64',
  'screenshotBase64',
];

test('the extension protocol is stated once, in the bridge, and not restated here', () => {
  const bridge = readFileSync(join(HERE, '../../../bridge/capture-extension.ts'), 'utf8');
  for (const token of EXT_WIRE) {
    assert.ok(bridge.includes(token), `bridge/capture-extension.ts should speak ${token}`);
  }
  // And this module must hold no second client: no relay channel, no postMessage,
  // no message-type literal of its own. It adapts the bridge's transport.
  // Block comments are stripped first - that file EXPLAINS the protocol at
  // length, and prose about a mechanism is the opposite of a second copy of it.
  const self = readFileSync(join(HERE, 'website.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!self.includes('postMessage'), 'sources/website.ts must not post to the extension itself');
  assert.ok(!self.includes('lolly-capture'), 'sources/website.ts must not restate the relay channel');
});

test('the bridge and the extension agree on the wire, when the extension is mounted', () => {
  // shells/chrome-extension is a sibling submodule: present in the umbrella
  // (where this gate runs), absent in a bare clone of the web shell. Absent is a
  // skip with a reason, never a silent pass - and the pinned EXT_WIRE above
  // still guards the web side either way.
  const extDir = join(HERE, '../../../../../chrome-extension');
  const relay = join(extDir, 'content.js');
  const worker = join(extDir, 'background.js');
  if (!existsSync(relay) || !existsSync(worker)) {
    console.log('skipped: shells/chrome-extension is not mounted (submodule not initialised)');
    return;
  }
  const relayText = readFileSync(relay, 'utf8');
  const workerText = readFileSync(worker, 'utf8');

  assert.ok(relayText.includes("'lolly-capture/site'"), 'the relay must match the request type');
  assert.ok(relayText.includes("'lolly-capture/site-result'"), 'the relay must post the reply type');
  assert.ok(relayText.includes('msg.requestId'), 'the relay must carry the request id back');
  // The two payload spellings the bridge decodes.
  assert.ok(workerText.includes('bytesBase64'), 'the worker must send asset bytes as bytesBase64');
  assert.ok(relayText.includes('screenshotBase64') && workerText.includes('screenshotBase64'),
    'the screenshot spelling must survive the relay');
});

// ── The scan ─────────────────────────────────────────────────────────────────

test('scanWebsite: one page becomes candidates, with the host as provenance', async () => {
  const transport = fakeTransport({
    html: PAGE,
    cssTexts: [SHEET],
    assets: [asset('https://acme.com/touch-icon.png', PNG_BYTES)],
    finalUrl: 'https://acme.com/',
  });
  const phases: SiteScanPhase[] = [];
  const result = scanned(await scanWebsite(transport, 'acme.com', p => phases.push(p)));

  assert.equal(result.siteHost, 'acme.com');
  assert.equal(result.finalUrl, 'https://acme.com/');
  assert.equal(result.siteName, 'Acme');
  assert.equal(result.transport, 'extension');
  assert.deepEqual(result.googleFamilies, ['Inter']);
  assert.equal(result.usedScreenshot, false);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(phases, ['fetch', 'read', 'done']);

  // Hexes are `extract-site.ts`'s own normalisation (the engine's
  // `colorToHexString`, which is lower case); the tray and the proposer both
  // resolve through `censusHex`, so nothing downstream depends on the casing.
  assert.equal(result.census.source.label, 'acme.com');
  const hexes = result.census.colors.map(c => c.hex);
  assert.ok(hexes.includes('#1e4fd8'), `declared brand colour missing: ${hexes.join(',')}`);
  assert.ok(hexes.includes('#ffffff'));

  // The parser's ranking survives, and the bytes are paired onto the top pick.
  assert.equal(result.logoCandidates[0]?.url, 'https://acme.com/touch-icon.png');
  assert.equal(result.logoCandidates[0]?.mime, 'image/png');
  assert.ok(result.logoCandidates.some(c => c.url === 'https://acme.com/img/acme-logo.svg'));

  // …and the census feeds the tray with no further adaptation.
  const candidates = candidatesFromCensus(result.census).map(c => `${c.type}:${c.value}`);
  assert.ok(candidates.includes('color:#1e4fd8'));
  assert.ok(candidates.includes('font:Inter'));
  assert.ok(candidates.includes('name:Acme'));
  assert.equal(candidatesFromCensus(result.census)[0]?.provenance.label, 'acme.com');
});

test('scanWebsite: the transport is called once, for the address that was validated', async () => {
  const transport = fakeTransport({ html: PAGE, finalUrl: 'https://acme.com/' });
  await scanWebsite(transport, '  acme.com  ', undefined, { timeoutMs: 1_234 });
  assert.deepEqual(transport.calls, [{ url: 'https://acme.com/', timeoutMs: 1_234 }]);
});

test('scanWebsite: a refused address never reaches the transport', async () => {
  const transport = fakeTransport({ html: PAGE });
  for (const [input, reason] of [
    ['', 'empty-url'],
    ['javascript:alert(1)', 'unsupported-scheme'],
    ['https://user:pw@acme.com/', 'credentials-in-url'],
    ['https://ac me.com', 'unparseable-url'],
  ] as const) {
    const r = await scanWebsite(transport, input);
    assert.deepEqual(r, { kind: 'refused', reason });
  }
  assert.deepEqual(transport.calls, []);
});

test('scanWebsite: no transport is a reason, not a crash', async () => {
  assert.deepEqual(await scanWebsite(null, 'acme.com'), { kind: 'refused', reason: 'no-transport' });
  assert.deepEqual(
    await scanWebsite({ kind: 'native', label: 'x' } as unknown as SiteTransport, 'acme.com'),
    { kind: 'refused', reason: 'no-transport' },
  );
});

test('scanWebsite: a transport failure comes back as a reason with its own words', async () => {
  const boom = fakeTransport(() => Promise.reject(new Error('the extension refused')));
  assert.deepEqual(await scanWebsite(boom, 'acme.com'), {
    kind: 'refused', reason: 'fetch-failed', detail: 'the extension refused',
  });

  const late = fakeTransport(() => Promise.reject(new Error('timeout')));
  assert.deepEqual(await scanWebsite(late, 'acme.com'), { kind: 'refused', reason: 'timeout' });
});

test('scanWebsite: a transport that never answers hits the backstop', async () => {
  const silent = fakeTransport(() => new Promise<never>(() => { /* never settles */ }));
  const started = Date.now();
  const r = await scanWebsite(silent, 'acme.com', undefined, { timeoutMs: 10 });
  assert.deepEqual(r, { kind: 'refused', reason: 'timeout' });
  assert.ok(Date.now() - started < 5_000, 'the backstop should not wait for the default deadline');
});

test('scanWebsite: a page with no markup is an empty read', async () => {
  const blank = fakeTransport({ html: '   ', finalUrl: 'https://acme.com/' });
  assert.deepEqual(await scanWebsite(blank, 'acme.com'), { kind: 'refused', reason: 'empty-page' });
});

test('scanWebsite: a screenshot that cannot be decoded here is a warning, not a loss', async () => {
  // Headless: there is no canvas to decode with, so the painted-colour bonus is
  // skipped and said so. The stylesheet census is unaffected.
  const transport = fakeTransport({
    html: PAGE, cssTexts: [SHEET], finalUrl: 'https://acme.com/', screenshot: PNG_BYTES,
  });
  const result = scanned(await scanWebsite(transport, 'acme.com'));
  assert.equal(result.usedScreenshot, false);
  assert.deepEqual(result.warnings, ['screenshot-failed']);
  assert.ok(result.census.colors.some(c => c.hex === '#1e4fd8'));
});

test('scanWebsite: a hostile page degrades, it does not throw', async () => {
  const nasty = fakeTransport({
    html: `<title>${'<'.repeat(5_000)}</title><style>${'a{color:#'.repeat(5_000)}`,
    cssTexts: ['{'.repeat(50_000)],
    assets: [asset('https://acme.com/x', HTML_BYTES, 'image/png')],
    finalUrl: 'https://acme.com/',
  });
  const result = scanned(await scanWebsite(nasty, 'acme.com'));
  assert.ok(Array.isArray(result.census.colors));
  assert.ok(Array.isArray(result.logoCandidates));
});
