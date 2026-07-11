/**
 * Contract tests for BAKED assets — a composed render frozen into a static
 * `data:` ref (engine/src/bake.ts) — plus the engine-owned compose recursion
 * guard (assertComposeStack) that every shell bridge now delegates to.
 *
 * A baked ref must mount from its own persisted bytes: no renderUrl, no catalog
 * lookup, no compose-stack growth. It presents as a plain image (meta.toolUrl
 * stripped at bake time) and degrades predictably — lost bytes drop the slot
 * with reason 'baked-bytes-lost' rather than re-rendering (baking's promise is
 * "these exact bytes"), and a share link serialises the provenance URL
 * (meta.bakedFrom) so recipients get a live re-render.
 *
 * Uses fake hosts (real renders are a shell concern, verified in the browser).
 *
 * Run with: node --test tests/baked-asset.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.ts';
import {
  MAX_COMPOSE_DEPTH, MAX_BAKED_URL_CHARS,
  ComposeGuardError, assertComposeStack, isBakedRef, bakeAssetRef,
  assetIdForUrl, blocksForUrl,
} from '../engine/src/bake.ts';
import { isToolUrl } from '../engine/src/tool-url.ts';
import { serializeUrlState } from '../engine/src/url-mode.ts';

const TOOL_URL = 'https://lolly.tools/tool/qr-code.svg?url=https://suse.com&w=600&h=600';
// Padding-free base64 ('<svg/>') so the hydrated output needs no entity-decoding
// to compare (Handlebars escapes '=').
const DATA_URL = 'data:image/svg+xml;base64,PHN2Zy8+';

// A persisted baked ref, exactly as bakeAssetRef mints one.
const bakedRef = (over: Record<string, any> = {}): any => ({
  source: 'remote', id: 'baked/abc123', type: 'vector', format: 'svg', url: DATA_URL,
  meta: { baked: true, bakedAt: 1750000000000, bakedFrom: TOOL_URL, tool: 'qr-code', name: 'QR Code' },
  ...over,
});

// A live renderUrl result, exactly as the web bridge mints one (meta.toolUrl = id).
const liveRef = (over: Record<string, any> = {}, meta: Record<string, any> = {}): any => ({
  source: 'remote', id: TOOL_URL, type: 'vector', format: 'svg', width: 600, height: 600,
  url: DATA_URL, meta: { tool: 'qr-code', name: 'QR Code', toolUrl: TOOL_URL, ...meta },
  ...over,
});

const heroTool: any = {
  manifest: {
    id: 'doc', name: 'Doc', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
    render: { width: 10, height: 10, formats: ['png'] },
    inputs: [{ id: 'hero', type: 'asset', assetType: 'any' }],
  },
  template: '{{#if hero}}<img src="{{asset hero}}">{{else}}<span>no-hero</span>{{/if}}',
};

// Every byte source booby-trapped: a baked ref resolves from its OWN url or not at all.
function inertHost(): any {
  return {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: { get: async (id: string) => { throw new Error('catalog lookup must not run for a baked ref: ' + id); } },
    compose: {
      render: async () => { throw new Error('compose.render must not run for a baked ref'); },
      renderUrl: async (url: string) => { throw new Error('renderUrl must not run for a baked ref: ' + url); },
    },
  };
}

// ─── mounting from persisted bytes ──────────────────────────────────────────────

test('baked: mounts from its data: URL — no renderUrl, no catalog, nothing dropped', async () => {
  const rt = await createRuntime(heroTool, inertHost(), { hero: bakedRef() });
  assert.ok(rt.getHydrated().includes(`<img src="${DATA_URL}">`), 'the frozen bytes reach the template');
  assert.equal(rt.droppedAssets.length, 0);
  const val: any = rt.getModel().find((i: any) => i.id === 'hero')!.value;
  assert.equal(val.url, DATA_URL, 'the ref survives resolution untouched');
  assert.equal(val.meta.baked, true);
});

test('baked: a block sub-field baked ref mounts from bytes too (shared resolveOne path)', async () => {
  const blockTool: any = {
    manifest: {
      id: 'bdoc', name: 'BDoc', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{
        id: 'rows', type: 'blocks', fields: [
          { id: 'kind', type: 'select', options: [{ value: 'a' }] },
          { id: 'img', type: 'asset', assetType: 'any' },
        ],
      }],
    },
    template: '{{#each rows}}[{{asset this.img}}]{{/each}}',
  };
  const rt = await createRuntime(blockTool, inertHost(), { rows: [{ kind: 'a', img: bakedRef() }] });
  assert.ok(rt.getHydrated().includes(`[${DATA_URL}]`));
  assert.equal(rt.droppedAssets.length, 0);
});

// ─── baked refs consume no compose depth ────────────────────────────────────────

// Chain tool: one composed child plus an `art` asset slot (where the baked ref rides).
const chainTool = (id: string, child: string | null): any => ({
  manifest: {
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
    render: { width: 10, height: 10, formats: ['svg'] },
    inputs: [{ id: 'art', type: 'asset', assetType: 'any' }],
    ...(child ? { capabilities: ['compose'], composes: [{ id: 'child', tool: child }] } : {}),
  },
  template: '{{#if child}}<img src="{{asset child}}">{{/if}}{{#if art}}<img src="{{asset art}}">{{/if}}',
});

// A faithful bridge double running the REAL engine guard for both compose paths:
// render (authored composes) throws through, renderUrl (tool-URL assets) catches
// to null — mirroring the web bridge's graceful-null contract.
function chainHost(tools: Record<string, any>, extraInputs: Record<string, any> = {}) {
  const rendered: string[] = [];
  const urlCalls: Array<{ url: string; stack: string[] }> = [];
  const runtimes: Record<string, any> = {};
  const host: any = {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    assets: { get: async (id: string) => { throw new Error('catalog lookup must not run: ' + id); } },
    compose: {
      async render(spec: any) {
        const { toolId, inputs = {}, _stack = [] } = spec;
        assertComposeStack(_stack, toolId); // the engine-owned guard (bake.ts)
        const t = tools[toolId];
        if (!t) throw new Error(`no tool ${toolId}`);
        runtimes[toolId] = await createRuntime(
          t, host, { ...inputs, ...(extraInputs[toolId] || {}) }, { composeStack: _stack },
        );
        rendered.push(toolId);
        return { source: 'remote', id: `compose:${toolId}`, type: 'vector', format: 'svg', url: `blob:${toolId}` };
      },
      async renderUrl(url: string, opts: any = {}) {
        const stack = [...(opts._stack ?? [])];
        urlCalls.push({ url, stack });
        try { assertComposeStack(stack, 'qr-code'); } catch { return null; }
        return { source: 'remote', id: url, type: 'vector', format: 'svg', url: 'blob:LIVE' };
      },
    },
  };
  return { host, rendered, urlCalls, runtimes };
}

test('baked: consumes no compose depth — the slot resolves at the A→B→C boundary with zero compose calls', async () => {
  const tools = { A: chainTool('A', 'B'), B: chainTool('B', 'C'), C: chainTool('C', null) };
  const { host, rendered, urlCalls, runtimes } = chainHost(tools, { C: { art: bakedRef() } });
  const rt = await createRuntime(tools.A, host, {});

  assert.deepEqual(rendered.sort(), ['B', 'C'], 'the chain still renders to full depth');
  assert.equal(urlCalls.length, 0, 'the baked slot costs no renderUrl call');
  assert.equal(runtimes.C.droppedAssets.length, 0);
  assert.ok(runtimes.C.getHydrated().includes(`<img src="${DATA_URL}">`), 'C shows the frozen bytes');
  assert.match(rt.getHydrated(), /<img src="blob:B">/, 'the compose chain propagates up to A');
});

test('baked: contrast — a LIVE tool-URL ref in the same slot is depth-rejected at the boundary', async () => {
  const tools = { A: chainTool('A', 'B'), B: chainTool('B', 'C'), C: chainTool('C', null) };
  const { host, rendered, urlCalls, runtimes } = chainHost(tools, {
    C: { art: { source: 'remote', id: TOOL_URL, _unresolved: true } },
  });
  await createRuntime(tools.A, host, {});

  assert.deepEqual(rendered.sort(), ['B', 'C'], 'the chain itself still renders');
  assert.equal(urlCalls.length, 1, 'the live slot DOES hit renderUrl');
  assert.deepEqual(urlCalls[0]!.stack, ['A', 'B', 'C'], 'a live embed rides the full ancestor stack');
  assert.equal(runtimes.C.droppedAssets.length, 1, 'depth guard drops the live embed');
  assert.equal(runtimes.C.droppedAssets[0].reason, 'render-failed');
});

// ─── lost bytes ─────────────────────────────────────────────────────────────────

test('baked: lost bytes (blob: url) → dropped with reason baked-bytes-lost, never re-rendered', async () => {
  const rt = await createRuntime(heroTool, inertHost(), { hero: bakedRef({ url: 'blob:GONE' }) });
  assert.match(rt.getHydrated(), /no-hero/, '{{#if}} hides the empty slot');
  assert.equal(rt.getModel().find((i: any) => i.id === 'hero')!.value, null, 'slot cleared');
  assert.equal(rt.droppedAssets.length, 1);
  assert.equal(rt.droppedAssets[0]!.id, 'baked/abc123');
  assert.equal(rt.droppedAssets[0]!.reason, 'baked-bytes-lost');
});

// ─── bakeAssetRef ───────────────────────────────────────────────────────────────

test('bakeAssetRef: freezes identity — baked/bakedAt set, toolUrl stripped, bakedFrom = meta.toolUrl', () => {
  const out: any = bakeAssetRef(liveRef(), { now: 1234567890123 });
  assert.equal(out.meta.baked, true);
  assert.equal(out.meta.bakedAt, 1234567890123);
  assert.equal(out.meta.bakedFrom, TOOL_URL);
  assert.equal('toolUrl' in out.meta, false, 'the live-edit key is gone — baked refs present as plain images');
  assert.equal(out.id, 'baked/' + (1234567890123).toString(36));
  assert.equal(isToolUrl(out.id), false, 'a baked id can never re-enter the live-embed resolve path');
  assert.equal(isBakedRef(out), true);
  assert.equal(out.url, DATA_URL, 'bytes pass through unchanged');
  assert.equal(out.source, 'remote');
  // Non-baked identity survives the spread (a baked ref still knows what it was).
  assert.equal(out.meta.tool, 'qr-code');
  assert.equal(out.meta.name, 'QR Code');
  assert.equal(out.width, 600);
});

test('bakeAssetRef: no meta.toolUrl → bakedFrom falls back to a tool-URL id, else is omitted', () => {
  const fromId: any = bakeAssetRef({ source: 'remote', id: TOOL_URL, type: 'vector', format: 'svg', url: DATA_URL } as any);
  assert.equal(fromId.meta.bakedFrom, TOOL_URL);

  const none: any = bakeAssetRef({ source: 'remote', id: 'x', type: 'vector', format: 'svg', url: DATA_URL } as any);
  assert.equal('bakedFrom' in none.meta, false, 'no mintable provenance → key absent (re-bake unavailable)');
  assert.equal(none.meta.baked, true, 'the bytes still stand');
});

test('bakeAssetRef: blob:-valued meta dies (session-scoped); animated survives', () => {
  const out: any = bakeAssetRef(
    liveRef({}, { posterUrl: 'blob:poster', animationUrl: 'blob:anim', animated: true }),
    { now: 1 },
  );
  assert.equal('posterUrl' in out.meta, false);
  assert.equal('animationUrl' in out.meta, false);
  assert.equal(out.meta.animated, true);
});

test('bakeAssetRef: refuses non-data: bytes with code BAKE_NOT_SELF_CONTAINED', () => {
  assert.throws(
    () => bakeAssetRef(liveRef({ url: 'blob:live' })),
    (e: any) => e instanceof Error && (e as any).code === 'BAKE_NOT_SELF_CONTAINED',
  );
});

test('bakeAssetRef: refuses oversized bytes with code BAKE_TOO_LARGE; the ceiling itself passes', () => {
  const atCap = 'data:'.padEnd(MAX_BAKED_URL_CHARS, 'A');
  assert.throws(
    () => bakeAssetRef(liveRef({ url: atCap + 'A' })),
    (e: any) => e instanceof Error && (e as any).code === 'BAKE_TOO_LARGE',
  );
  assert.equal(bakeAssetRef(liveRef({ url: atCap }), { now: 1 }).url.length, MAX_BAKED_URL_CHARS);
});

// ─── assertComposeStack (the shared guard) ──────────────────────────────────────

test('assertComposeStack: a repeated tool id is a cycle — code, path, message', () => {
  assert.throws(() => assertComposeStack(['a', 'b'], 'a'), (e: any) => {
    assert.ok(e instanceof ComposeGuardError);
    assert.equal(e.name, 'ComposeGuardError');
    assert.equal(e.code, 'cycle');
    assert.deepEqual(e.path, ['a', 'b', 'a']);
    assert.equal(e.message, 'cycle a → b → a');
    return true;
  });
  // Cycle wins when both guards apply — the message names the real problem.
  assert.throws(() => assertComposeStack(['a', 'b', 'c'], 'a'), (e: any) => e.code === 'cycle');
});

test('assertComposeStack: a stack at the budget rejects the next level (default MAX_COMPOSE_DEPTH)', () => {
  assert.equal(MAX_COMPOSE_DEPTH, 3, 'the shared default policy');
  assert.doesNotThrow(() => assertComposeStack([], 'a'));
  assert.doesNotThrow(() => assertComposeStack(['a', 'b'], 'c'));
  assert.throws(() => assertComposeStack(['a', 'b', 'c'], 'd'), (e: any) => {
    assert.ok(e instanceof ComposeGuardError);
    assert.equal(e.code, 'depth');
    assert.deepEqual(e.path, ['a', 'b', 'c', 'd']);
    assert.equal(e.message, 'max depth 3 (a → b → c → d)');
    return true;
  });
});

test('assertComposeStack: custom maxDepth overrides the default in both directions', () => {
  assert.throws(
    () => assertComposeStack(['a'], 'b', 1),
    (e: any) => e.code === 'depth' && e.message === 'max depth 1 (a → b)',
  );
  assert.doesNotThrow(() => assertComposeStack(['a', 'b', 'c'], 'd', 4));
});

// ─── url-mode ───────────────────────────────────────────────────────────────────

test('url-mode: a baked asset serialises to its provenance URL, not the data: bytes', () => {
  const qs = serializeUrlState([{ id: 'logo', type: 'asset', value: bakedRef() }]);
  assert.equal(new URLSearchParams(qs).get('logo'), TOOL_URL, 'recipients degrade to a live re-render');
});

test('url-mode: a baked asset without provenance serialises to its baked id (graceful drop)', () => {
  const ref = bakedRef();
  delete ref.meta.bakedFrom;
  const qs = serializeUrlState([{ id: 'logo', type: 'asset', value: ref }]);
  assert.equal(new URLSearchParams(qs).get('logo'), 'baked/abc123');
});

test('url-mode: a baked ref inside a blocks row serialises as its provenance ref — never the data: bytes', () => {
  const rows = [{ kind: 'a', img: bakedRef() }, { kind: 'b', img: null }];
  const qs = serializeUrlState([{ id: 'rows', type: 'blocks', value: rows as any }]);
  const raw = new URLSearchParams(qs).get('rows')!;
  assert.ok(!raw.includes('data:'), 'the frozen bytes never enter the query');
  const parsed = JSON.parse(raw);
  // The exact unresolved-ref shape URL parsing mints, so the row round-trips
  // through JSON.parse straight into the runtime's resolve path (live re-render).
  assert.deepEqual(parsed[0].img, { source: 'remote', id: TOOL_URL, _unresolved: true });
  assert.deepEqual(parsed[1], { kind: 'b', img: null }, 'non-baked rows pass through untouched');
});

test('blocksForUrl: no provenance → a library ref by baked id (graceful drop); no baked refs → same array', () => {
  const orphan = bakedRef();
  delete orphan.meta.bakedFrom;
  const out: any = blocksForUrl([{ img: orphan }]);
  assert.deepEqual(out[0].img, { source: 'library', id: 'baked/abc123', _unresolved: true });

  const plain = [{ kind: 'a', img: liveRef() }, { kind: 'b' }];
  assert.equal(blocksForUrl(plain), plain, 'untouched rows keep the SAME array (no churn)');
  assert.equal(blocksForUrl('not-rows' as any), 'not-rows', 'non-array values pass through');
});

test('assetIdForUrl: the one link-identity rule — bakedFrom, else id (baked or live alike)', () => {
  assert.equal(assetIdForUrl(bakedRef()), TOOL_URL);
  const orphan = bakedRef();
  delete orphan.meta.bakedFrom;
  assert.equal(assetIdForUrl(orphan), 'baked/abc123');
  assert.equal(assetIdForUrl(liveRef()), TOOL_URL, 'a live embed already shares by its canonical URL id');
  assert.equal(assetIdForUrl({ source: 'library', id: 'suse/logo/primary' } as any), 'suse/logo/primary');
});
