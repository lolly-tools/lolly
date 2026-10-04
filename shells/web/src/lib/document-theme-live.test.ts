// SPDX-License-Identifier: MPL-2.0
/**
 * A document theme that holds after the switch (plan 291 W4, M4 fixes).
 *
 * Three ways the Design view used to fall back to the theme a document opened in:
 *  1. an undo, a redo or a peer's patch wrote back rows whose linked colours were
 *     cached in the theme they were recorded in;
 *  2. the inspector's Token links captured the theme at mount, so a link made after
 *     a switch stored the other theme's value;
 *  3. the packed address (`?z=`) swallowed `_themes`, which the web token bridge
 *     reads plain, so after the first large edit every unscoped reader went back to
 *     the default theme.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/document-theme-live.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createDocumentThemeController, liveThemedHost } from './document-theme.ts';
import type { ThemeSelection } from './document-theme.ts';
import { BESIDE_PACK_PARAMS, copyBesidePackParams, copyWorkspaceParams, packableContent } from './tool-url-state.ts';
import { designTokenInspectorOptions } from '../views/design-token-bindings.ts';

/** The public starter pack's shape: one unnamed group, light then dark. */
const LIGHT_DARK = {
  base: { color: { ramp: { n1: { $type: 'color', $value: '#1d1d1d' }, n9: { $type: 'color', $value: '#ffffff' } } } },
  light: { color: { semantic: { text: { $type: 'color', $value: '{color.ramp.n1}' }, surface: { $type: 'color', $value: '{color.ramp.n9}' } } } },
  dark: { color: { semantic: { text: { $type: 'color', $value: '{color.ramp.n9}' }, surface: { $type: 'color', $value: '{color.ramp.n1}' } } } },
  $themes: [
    { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
  ],
  $metadata: { tokenSetOrder: ['base', 'light', 'dark'] },
};

/** A host that records the selection every token and asset read was scoped to. */
function recordingHost() {
  const reads: Array<{ via: string; selection: unknown }> = [];
  const host = {
    version: '1', shell: 'web', capabilities: [], log: () => {},
    assets: { get: async (_id: string, opts: { tokenSelection?: unknown } = {}) => { reads.push({ via: 'assets', selection: opts.tokenSelection }); return null; }, query: async () => [] },
    tokens: {
      get: async (opts: { selection?: unknown } = {}) => { reads.push({ via: 'get', selection: opts.selection }); return null; },
      colors: async () => [], resolve: async () => undefined,
    },
  } as unknown as HostV1;
  return { host, reads };
}

// ── 2. the inspector's token host follows the runtime ──────────────────────────────

test('liveThemedHost reads the runtime selection at each call, not when it was built', async () => {
  const { host, reads } = recordingHost();
  const runtime: { tokenSelection?: ThemeSelection } = { tokenSelection: { '': 'dark' } };
  const live = liveThemedHost(host, runtime);
  await live.tokens!.get();
  await live.assets.get('lolly/photo/x');
  runtime.tokenSelection = { '': 'light' };
  await live.tokens!.get();
  await live.assets.get('lolly/photo/x');
  runtime.tokenSelection = undefined;
  await live.tokens!.get();
  assert.deepEqual(reads, [
    { via: 'get', selection: { '': 'dark' } }, { via: 'assets', selection: { '': 'dark' } },
    { via: 'get', selection: { '': 'light' } }, { via: 'assets', selection: { '': 'light' } },
    { via: 'get', selection: undefined },
  ]);
  const bare = { version: '1' } as unknown as HostV1;
  assert.equal(liveThemedHost(bare, runtime), bare, 'a host with nothing to scope is returned as it is');
});

test('the Design inspector links a token in the theme the document shows now, not the one it opened in', async () => {
  const { host, reads } = recordingHost();
  // The runtime's getter, as Runtime exposes it: a switch replaces what it returns.
  let selection: ThemeSelection | undefined = { '': 'dark' };
  const runtime = { getModel: () => [{ id: 'boxes', type: 'blocks', tokenBindingsField: 'tokenLinks' }], get tokenSelection() { return selection; } };
  const options = designTokenInspectorOptions(runtime as never, host, { blockId: 'boxes', commit: () => {} } as never, { endGesture: () => {} }, []);
  selection = { '': 'light' };
  await options.tokens!.host.tokens!.get();
  assert.deepEqual(reads.at(-1), { via: 'get', selection: { '': 'light' } }, 'the switch made after the inspector mounted');
});

// ── 3. `_themes` stays readable beside a packed token ──────────────────────────────

test('a packed address keeps _themes beside the token, and an opened link still reads it', async () => {
  const { packQuery, expandQuery, parseUrlState } = await import('@lolly/engine');
  assert.deepEqual([...BESIDE_PACK_PARAMS], ['_themes']);
  const params = new URLSearchParams({ title: 'x'.repeat(40), _themes: JSON.stringify({ '': 'dark' }), _ui: 'abc', slot: 's1' });
  const content = packableContent(params);
  assert.deepEqual([...content.keys()], ['title'], 'workspace keys and _themes stay out of the token');
  assert.ok(params.has('_themes'), 'the caller params are not changed');
  const token = await packQuery(content.toString());
  assert.ok(token);
  const latest = new URLSearchParams({ z: token! });
  copyWorkspaceParams(latest, params);
  copyBesidePackParams(latest, params);
  assert.equal(latest.get('_themes'), '{"":"dark"}', 'what bridge/tokens.ts routeChoiceText reads');
  const opened = new URLSearchParams(await expandQuery(latest.toString()));
  assert.equal(opened.get('title'), 'x'.repeat(40));
  const state = parseUrlState(opened.toString(), { id: 'p', inputs: [{ id: 'title', type: 'text' }] } as never);
  assert.deepEqual(state.tokenSelection, { '': 'dark' });
  // Nothing to keep: no stray key appears.
  const none = new URLSearchParams({ z: 'abc' });
  copyBesidePackParams(none, new URLSearchParams({ title: 'y' }));
  assert.equal(none.toString(), 'z=abc');
});

test('both bar-packing paths keep _themes out of the token and beside it', () => {
  const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  for (const [file, src] of [['views/tool/session.ts', read('../views/tool/session.ts')], ['views/tool/shared.ts', read('../views/tool/shared.ts')]] as const) {
    const packs = src.split('packQuery(').length - 1;
    assert.ok(packs >= 1, `${file} packs the bar`);
    assert.equal(src.split('packableContent(').length - 1, packs, `${file}: every packed query is built by packableContent`);
    assert.equal(src.split('copyBesidePackParams(').length - 1, packs, `${file}: every packed address gets _themes back beside the token`);
  }
});

// ── 1. history and peer writes land in the theme in force ─────────────────────────

async function themedRuntime() {
  const { createRuntime } = await import('../../../../engine/src/runtime.ts');
  const { loadTool } = await import('../../../../engine/src/loader.ts');
  const { createTokenSet } = await import('../../../../engine/src/tokens.ts');
  const { withBlockTokenBinding } = await import('../../../../engine/src/token-block-bindings.ts');
  const manifest = {
    id: 'theme-replay', name: 'Theme replay', version: '1.0.0', engineVersion: '^1.0.0', status: 'community', render: { width: 10, height: 10, formats: ['svg'] },
    inputs: [{ id: 'boxes', type: 'blocks', fields: [{ id: 'id', type: 'text' }, { id: 'x', type: 'number' }, { id: 'bg', type: 'color' }, { id: 'fg', type: 'color' }, { id: 'tokenLinks', type: 'text', default: '' }], tokenBindingsField: 'tokenLinks', default: [] }],
  };
  const tool = await loadTool(manifest.id, async (path: string) => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg>{{#each boxes}}<g data-bg="{{bg}}" data-fg="{{fg}}"></g>{{/each}}</svg>';
    throw new Error('No optional source');
  });
  const host = {
    version: '1', shell: 'web', capabilities: [], log: () => {},
    profile: { get: async () => ({}) }, assets: { get: async () => null, query: async () => [] },
    state: { load: async () => null, save: async () => {}, list: async () => [] }, clipboard: {}, export: {},
    tokens: {
      get: async (opts: object = {}) => createTokenSet(LIGHT_DARK, opts), colors: async () => [],
      resolve: async () => undefined, themes: async () => [], snapshot: async () => ({ document: LIGHT_DARK, system: null, version: null, selection: {} }),
    },
  } as unknown as HostV1;
  // Saved in dark: a frame on the surface colour, a title in the text colour.
  let frame = withBlockTokenBinding({ id: 'f', x: 0, bg: '#1d1d1d' }, 'tokenLinks', 'bg', { ref: '{color.semantic.surface}', value: '#1d1d1d' });
  frame = withBlockTokenBinding(frame, 'tokenLinks', 'fg', { ref: '{color.semantic.text}', value: '#ffffff' });
  const runtime = await createRuntime(tool, host, { boxes: [frame], __tokenSelection: { '': 'dark' } } as never);
  const controller = createDocumentThemeController({ runtime, host, canvas: () => null, onChange: () => {}, markDirty: () => {}, writeRoute: () => {} });
  await controller.ready;
  const row = (): Record<string, unknown> => (runtime.getModel().find((i) => i.id === 'boxes')!.value as Record<string, unknown>[])[0]!;
  return { runtime, controller, row };
}

test('an undo after a theme switch keeps the linked colours of the theme in force (applyHistory: setInput)', async () => {
  const { runtime, controller, row } = await themedRuntime();
  assert.deepEqual([row().bg, row().fg], ['#1d1d1d', '#ffffff'], 'opened in dark');
  // A nudge: the history entry stores dark literals on both sides.
  const before = structuredClone(runtime.getModel().find((i) => i.id === 'boxes')!.value);
  await runtime.setInput('boxes', [{ ...row(), x: 10 }] as never);
  await controller.choose('', 'light');
  assert.deepEqual([row().bg, row().fg, row().x], ['#ffffff', '#1d1d1d', 10], 'the switch re-resolved the links');
  // Undo writes the stored dark rows back, the way views/tool/history.ts applyHistory does.
  await runtime.setInput('boxes', structuredClone(before) as never, { restoreTokenRefs: undefined });
  assert.equal(row().x, 0, 'the nudge was undone');
  assert.deepEqual([row().bg, row().fg], ['#ffffff', '#1d1d1d'], 'and the colours stay light');
  assert.match(runtime.getHydrated(), /data-bg="#ffffff" data-fg="#1d1d1d"/);
  controller.dispose();
});

test('a transaction undo or a peer patch after a theme switch lands in the theme in force (applyEntry and collab: applyPatch)', async () => {
  const { runtime, controller, row } = await themedRuntime();
  const darkRows = structuredClone(runtime.getModel().find((i) => i.id === 'boxes')!.value) as Record<string, unknown>[];
  await controller.choose('', 'light');
  await runtime.applyPatch({ boxes: [{ ...darkRows[0]!, x: 5 }] });
  assert.equal(row().x, 5);
  assert.deepEqual([row().bg, row().fg], ['#ffffff', '#1d1d1d']);
  // Back to dark: a light peer's rows land dark here.
  const lightRows = structuredClone(runtime.getModel().find((i) => i.id === 'boxes')!.value) as Record<string, unknown>[];
  await controller.choose('', 'dark');
  await runtime.applyPatch({ boxes: [{ ...lightRows[0]!, x: 6 }] });
  assert.deepEqual([row().bg, row().fg, row().x], ['#1d1d1d', '#ffffff', 6]);
  controller.dispose();
});
