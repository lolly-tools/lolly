/**
 * Contract tests for tool-sourced ASSETS — an asset input whose value is a Lolly
 * tool URL (a share link the user pasted into the picker). The runtime must
 * re-render such an id via host.compose.renderUrl (NOT the catalog) on every load,
 * which is what makes the selection persist through URL mode + saved sessions.
 *
 * Uses a fake host (the real render is a shell concern, verified in the browser).
 *
 * Run with: node --test tests/tool-url-asset.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.ts';

const tool: any = {
  manifest: {
    id: 'doc', name: 'Doc', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
    render: { width: 10, height: 10, formats: ['png'] },
    inputs: [{ id: 'hero', type: 'asset', assetType: 'any' }],
  },
  template: '{{#if hero}}<img src="{{asset hero}}">{{else}}<span>no-hero</span>{{/if}}',
};

const TOOL_URL = 'https://lolly.tools/tool/qr-code.svg?url=https://suse.com&w=600&h=600';

test('asset: a tool-URL id re-renders via host.compose.renderUrl, not the catalog', async () => {
  const calls: Array<{ url: string; opts: any }> = [];
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: { get: async (id: string) => { throw new Error('catalog lookup must not run for a tool URL: ' + id); } },
    compose: {
      render: async () => {},
      renderUrl: async (url: string, opts: any) => {
        calls.push({ url, opts });
        return { source: 'remote', id: url, type: 'vector', format: 'svg', url: 'blob:HERO' };
      },
    },
  };
  const rt = await createRuntime(tool, host, { hero: { source: 'remote', id: TOOL_URL, _unresolved: true } });

  assert.equal(calls.length, 1, 'renderUrl called once on mount');
  assert.equal(calls[0]!.url, TOOL_URL);
  // The current tool's id MUST be on the stack so a self-/mutually-referential
  // pasted link trips the bridge cycle/depth guard instead of recursing forever.
  assert.deepEqual([...calls[0]!.opts._stack], ['doc'], 'current tool id pushed onto the recursion stack');
  assert.match(rt.getHydrated(), /<img src="blob:HERO">/, 'the rendered blob reaches the template');
});

test('asset: a tool-URL blanks gracefully (and is recorded) when the shell cannot compose', async () => {
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: { get: async () => { throw new Error('should not be called'); } },
    // no host.compose at all (e.g. a shell that can't render a child to bytes)
  };
  const rt = await createRuntime(tool, host, { hero: { source: 'remote', id: TOOL_URL, _unresolved: true } });
  assert.match(rt.getHydrated(), /no-hero/, '{{#if}} hides the empty slot');
  assert.equal(rt.droppedAssets.length, 1, 'recorded as dropped so the shell can notify the user');
  assert.equal(rt.droppedAssets[0]!.id, TOOL_URL);
});

test('asset: a plain library id still resolves through host.assets.get', async () => {
  let got: string | null = null;
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: { get: async (id: string) => { got = id; return { source: 'library', id, type: 'vector', format: 'svg', url: 'blob:LIB' }; } },
    compose: { render: async () => {}, renderUrl: async () => { throw new Error('renderUrl must not run for a library id'); } },
  };
  const rt = await createRuntime(tool, host, { hero: { source: 'library', id: 'suse/logo/primary', _unresolved: true } });
  assert.equal(got, 'suse/logo/primary');
  assert.match(rt.getHydrated(), /blob:LIB/);
});
