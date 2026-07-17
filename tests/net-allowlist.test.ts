// SPDX-License-Identifier: MPL-2.0
/**
 * The host.net manifest allowlist (schema `network`) at its contract seams.
 *
 * The cross-shell contract: a tool that declares capabilities:["network"] may
 * carry  network: { allowlist: [...] }  — 1-32 https URL entries, where a
 * trailing /* (the wildcard must follow a path separator) makes an entry a
 * prefix wildcard and a bare entry permits that exact URL only — and the host
 * builds host.net from it, fail-closed: no block / no matching entry ⇒ the
 * fetch rejects before any I/O happens.
 *
 * The two schema copies are kept byte-identical by the existing drift guard
 * (tests/lolly-tools-core.test.ts), so like screen-capture.test.ts this file
 * does not re-compare them — it exercises each copy's real VALIDATOR:
 * validateManifest (engine, schemas/tool.schema.json) and validateTool
 * (@lolly-tools/core, packages/core/schema/tool.schema.json). Enforcement is
 * proven at the CLI bridge, which shares the web shell's createNetAPI module
 * verbatim — the matching rules asserted here are the rules every shell applies.
 *
 * Run with: node --test tests/net-allowlist.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../engine/src/validate.ts';
import { validateTool } from '../packages/core/src/index.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';

/** A well-formed network-capable manifest, optionally with overrides merged in. */
function netManifest(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'weather-poster',
    name: 'Weather Poster',
    version: '1.0.0',
    engineVersion: '^1.0.0',
    status: 'community',
    capabilities: ['network'],
    network: { allowlist: ['https://api.example.com/*'] },
    render: { width: 800, height: 600, formats: ['svg'] },
    inputs: [{ id: 'city', type: 'text' }],
    ...overrides,
  };
}

/** Assert both independent validators agree on a manifest's validity. */
function assertBoth(manifest: unknown, valid: boolean, why: string): void {
  const engine = validateManifest(manifest);
  const core = validateTool(manifest);
  assert.equal(engine.valid, valid, `engine: ${why} — ${JSON.stringify(engine.errors)}`);
  assert.equal(core.valid, valid, `core: ${why} — ${JSON.stringify(core.errors)}`);
}

// ─── schema: both copies, via their real validators ──────────────────────────

test('both validators accept network.allowlist alongside the network capability', () => {
  assertBoth(netManifest(), true, 'a prefix-wildcard https entry must validate');
  assertBoth(
    netManifest({ network: { allowlist: ['https://api.example.com/data.json'] } }),
    true, 'an exact-URL https entry must validate',
  );
  assertBoth(
    netManifest({ network: { allowlist: Array.from({ length: 32 }, (_, i) => `https://api${i}.example.com/*`) } }),
    true, '32 entries is the documented maximum',
  );
});

test('both validators REJECT non-https allowlist entries', () => {
  for (const bad of ['http://api.example.com/*', 'ftp://files.example.com/', 'wss://live.example.com/*', '//api.example.com/*']) {
    assertBoth(netManifest({ network: { allowlist: [bad] } }), false, `non-https entry "${bad}"`);
  }
});

test('both validators REJECT malformed allowlist shapes', () => {
  assertBoth(netManifest({ network: { allowlist: [] } }), false, 'an empty allowlist (minItems 1)');
  assertBoth(
    netManifest({ network: { allowlist: Array.from({ length: 33 }, (_, i) => `https://api${i}.example.com/*`) } }),
    false, '33 entries (maxItems 32)',
  );
  assertBoth(
    netManifest({ network: { allowlist: ['https://api.*.example.com/'] } }),
    false, 'a mid-string wildcard (only a single trailing * is a wildcard)',
  );
  assertBoth(
    netManifest({ network: { allowlist: ['https://api.example.com*'] } }),
    false, 'a trailing wildcard with no path separator (would prefix-match a lookalike host)',
  );
  assertBoth(netManifest({ network: {} }), false, 'a network block without allowlist (required)');
  assertBoth(
    netManifest({ network: { allowlist: ['https://api.example.com/*'], blocklist: [] } }),
    false, 'an unknown key inside network (additionalProperties: false)',
  );
});

// ─── loadTool: the field survives the engine's validate-then-load path ────────

test('loadTool accepts a network manifest and exposes network.allowlist typed', async () => {
  const files: Record<string, string> = {
    'weather-poster/tool.json': JSON.stringify(netManifest()),
    'weather-poster/template.html': '<div data-weather></div>',
  };
  const tool = await loadTool('weather-poster', async (path: string) => {
    const text = files[path];
    if (text === undefined) throw new Error(`404: ${path}`);
    return text;
  });
  assert.deepEqual(tool.manifest.network, { allowlist: ['https://api.example.com/*'] });
});

// ─── enforcement: the CLI host.net, built from the manifest allowlist ─────────

const fakeDom = () => ({ window: {} as Window & typeof globalThis });

/** Run fn with global fetch stubbed; returns the URLs the stub actually served. */
async function withFetchStub(
  respond: () => Response,
  fn: () => Promise<void>,
): Promise<string[]> {
  const served: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    served.push(String(url));
    return respond();
  }) as typeof fetch;
  try { await fn(); } finally { globalThis.fetch = realFetch; }
  return served;
}

test('CLI host.net allows a prefix-wildcard match and denies everything else before I/O', async () => {
  const host = await createCliBridge({ dom: fakeDom(), networkAllowlist: ['https://api.example.com/*'] });
  const served = await withFetchStub(() => new Response('ok'), async () => {
    const res = await host.net!.fetch('https://api.example.com/v2/weather?q=x');
    assert.equal(await res.text(), 'ok');
    await assert.rejects(host.net!.fetch('https://evil.example.com/'), /disallowed/);
    // Prefix means PREFIX of the whole URL string — a lookalike host must not pass.
    await assert.rejects(host.net!.fetch('https://api.example.com.evil.io/'), /disallowed/);
  });
  // The denied fetches never reached the network layer.
  assert.deepEqual(served, ['https://api.example.com/v2/weather?q=x']);
});

test('CLI host.net: a hand-fed no-slash wildcard still stops at the path boundary', async () => {
  // The schema rejects this form, but the CLI/TUI opt is hand-fed — the matcher
  // itself must keep a lookalike host out (matches() forces the '/' boundary).
  const host = await createCliBridge({ dom: fakeDom(), networkAllowlist: ['https://api.example.com*'] });
  const served = await withFetchStub(() => new Response('ok'), async () => {
    await host.net!.fetch('https://api.example.com/v2/weather');
    await assert.rejects(host.net!.fetch('https://api.example.com.evil.io/'), /disallowed/);
  });
  assert.deepEqual(served, ['https://api.example.com/v2/weather']);
});

test('CLI host.net treats a bare entry as exact-URL, not a prefix', async () => {
  const host = await createCliBridge({ dom: fakeDom(), networkAllowlist: ['https://api.example.com/data.json'] });
  const served = await withFetchStub(() => new Response('ok'), async () => {
    await host.net!.fetch('https://api.example.com/data.json');
    await assert.rejects(host.net!.fetch('https://api.example.com/data.json?v=2'), /disallowed/);
  });
  assert.deepEqual(served, ['https://api.example.com/data.json']);
});

test('CLI host.net with no allowlist rejects every fetch (fail-closed default)', async () => {
  const host = await createCliBridge({ dom: fakeDom() });
  assert.ok(host.net, 'host.net must exist even without an allowlist');
  const served = await withFetchStub(() => new Response('ok'), async () => {
    await assert.rejects(host.net!.fetch('https://api.example.com/'), /disallowed/);
  });
  assert.deepEqual(served, []);
});

test('CLI host.net enforces the 64 MB response cap (declared Content-Length fast-fail)', async () => {
  const host = await createCliBridge({ dom: fakeDom(), networkAllowlist: ['https://api.example.com/*'] });
  await withFetchStub(
    () => new Response('tiny', { headers: { 'content-length': String(65 * 1024 * 1024) } }),
    async () => {
      await assert.rejects(host.net!.fetch('https://api.example.com/huge.bin'), /limit/);
    },
  );
});
