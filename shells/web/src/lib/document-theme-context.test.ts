// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system context Design's Document controls show (plan 286 section 5.1),
 * and the document-scoped theme choice that context reports.
 *
 * What these tests hold: the strip reads the render snapshot plus the choices the
 * document made itself; Inspect opens on what the canvas shows; Follow the design
 * system drops the document's choices; the choice is saved with the document and
 * comes back on reopen; and none of it writes the design system.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/document-theme-context.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1, TokensSnapshot } from '@lolly-tools/core/host-v1';
import { createDocumentThemeController } from './document-theme.ts';
import type { ThemeSelection } from './document-theme.ts';

/** The public starter pack's shape: one unnamed group, light then dark. */
const LIGHT_DARK = {
  base: { color: { brand: { $type: 'color', $value: '#123456' } } },
  light: { color: { semantic: { text: { $type: 'color', $value: '#111111' } } } },
  dark: { color: { semantic: { text: { $type: 'color', $value: '#eeeeee' } } } },
  $themes: [
    { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
  ],
  $metadata: { tokenSetOrder: ['base', 'light', 'dark'] },
};

const SNAPSHOT: TokensSnapshot = {
  document: LIGHT_DARK,
  system: { id: 'starter', label: 'Starter', active: true, locked: false, source: 'shipped', headId: null },
  version: 'latest',
  selection: { choices: { '': 'light' } },
};

/**
 * A runtime, a host and a log of every place a choice reaches. The host carries the
 * design-system writers a web host has (the registry and the token cache), and each
 * records a call, so a test can show the strip and its actions never reach them.
 */
function rig(start?: ThemeSelection) {
  const log: string[] = [];
  const systemWrites: string[] = [];
  let selection = start;
  let snapshotReads = 0;
  const runtime = {
    get tokenSelection() { return selection; },
    async setTokenSelection(next: ThemeSelection) { log.push(`runtime ${JSON.stringify(next)}`); selection = Object.keys(next).length ? next : undefined; },
  };
  const record = (name: string) => async () => { systemWrites.push(name); };
  const host = {
    version: '1',
    tokens: {
      get: async () => ({}), colors: async () => [], themes: async () => [], resolve: async () => '#000000',
      snapshot: async () => { snapshotReads += 1; return structuredClone(SNAPSHOT); },
      bust: record('tokens.bust'),
    },
    designSystems: { setActive: record('designSystems.setActive'), save: record('designSystems.save'), remove: record('designSystems.remove') },
    state: { save: record('state.save') },
  } as unknown as HostV1;
  const opened: HostV1[] = [];
  const controller = createDocumentThemeController({
    runtime, host,
    canvas: () => null,
    onChange: () => { log.push('repaint'); },
    markDirty: () => { log.push('dirty'); },
    writeRoute: (next) => { log.push(`route ${JSON.stringify(next)}`); },
    openInspector: async (scoped) => { opened.push(scoped); },
  });
  return { controller, log, systemWrites, opened, runtime, reads: () => snapshotReads };
}

test('the strip reads the render snapshot, and the document choices only once the document makes some', async () => {
  const r = rig();
  await r.controller.ready;
  assert.deepEqual(r.controller.context(), { snapshot: SNAPSHOT }, 'a document with no choices of its own follows the design system');
  await r.controller.choose('', 'dark');
  assert.deepEqual(r.controller.context()?.selection, { '': 'dark' });
  assert.equal(r.reads(), 1, 'a choice is read from the runtime, so the design system is not read again');
  r.controller.dispose();
});

test('Inspect opens on what the canvas shows: the render snapshot scoped to the document choices', async () => {
  const r = rig({ '': 'dark' });
  await r.controller.ready;
  await r.controller.inspect();
  assert.equal(r.opened.length, 1);
  const shown = await r.opened[0]!.tokens!.snapshot!();
  assert.deepEqual(shown.selection.choices, { '': 'dark' });
  assert.deepEqual((shown.document as { $metadata: { activeThemeSelection: unknown } }).$metadata.activeThemeSelection, { '': 'dark' });
  assert.deepEqual(LIGHT_DARK.$metadata, { tokenSetOrder: ['base', 'light', 'dark'] }, 'the scoped read is a copy');
  r.controller.dispose();
});

test('Follow the design system clears the address and the runtime, marks the session and reads the system again', async () => {
  const r = rig({ '': 'dark' });
  await r.controller.ready;
  r.log.length = 0;
  await r.controller.follow();
  assert.deepEqual(r.log, ['route null', 'runtime {}', 'dirty', 'repaint']);
  assert.equal(r.runtime.tokenSelection, undefined);
  assert.equal(r.reads(), 2, 'the snapshot read under the old choices is replaced');
  assert.equal(r.controller.context()?.selection, undefined);
  r.log.length = 0;
  await r.controller.follow();
  assert.deepEqual(r.log, [], 'a document already following the design system changes nothing');
  r.controller.dispose();
});

test('no theme choice, Inspect or Follow writes the design system', async () => {
  const r = rig();
  await r.controller.ready;
  await r.controller.choose('', 'dark');
  await r.controller.inspect();
  await r.controller.follow();
  await r.controller.choose('', 'dark');
  assert.deepEqual(r.systemWrites, []);
  assert.deepEqual(r.log.filter((line) => line.startsWith('route')), ['route {"":"dark"}', 'route null', 'route {"":"dark"}']);
  r.controller.dispose();
});

test('with the real engine runtime, the document choice is saved with the session, reopens, and can be dropped', async () => {
  const { createRuntime } = await import('../../../../engine/src/runtime.ts');
  const { loadTool } = await import('../../../../engine/src/loader.ts');
  const { createTokenSet } = await import('../../../../engine/src/tokens.ts');
  const { snapshotSession } = await import('../views/tool-session-snapshot.ts');
  const manifest = {
    id: 'theme-probe', name: 'Theme probe', version: '1.0.0', engineVersion: '^1.0.0', status: 'community', render: { width: 10, height: 10, formats: ['svg'] },
    inputs: [{ id: 'title', type: 'text', default: 'Hello' }],
  };
  const tool = await loadTool(manifest.id, async (path: string) => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg><text>{{title}}</text></svg>';
    throw new Error('No optional source');
  });
  const host = {
    version: '1', shell: 'web', capabilities: [], log: () => {},
    profile: { get: async () => ({}) }, assets: { get: async () => null, query: async () => [] },
    state: { load: async () => null, save: async () => {}, list: async () => [] }, clipboard: {}, export: {},
    tokens: {
      get: async (opts: object = {}) => createTokenSet(LIGHT_DARK, opts), colors: async () => [],
      resolve: async () => undefined, themes: async () => [], snapshot: async () => structuredClone(SNAPSHOT),
    },
  } as unknown as HostV1;
  const save = async (runtime: Awaited<ReturnType<typeof createRuntime>>) =>
    snapshotSession(null, tool.manifest, runtime as never, {}, () => '', () => '') as Record<string, unknown>;

  const first = await createRuntime(tool, host, {} as never);
  const controller = createDocumentThemeController({ runtime: first, host, canvas: () => null, onChange: () => {}, markDirty: () => {}, writeRoute: () => {} });
  await controller.ready;
  await controller.choose('', 'dark');
  const saved = await save(first);
  assert.deepEqual(saved.__tokenSelection, { '': 'dark' });
  controller.dispose();

  const reopened = await createRuntime(tool, host, saved as never);
  assert.deepEqual(reopened.tokenSelection, { '': 'dark' }, 'the reopened document draws in the theme it was saved in');
  const again = createDocumentThemeController({ runtime: reopened, host, canvas: () => null, onChange: () => {}, markDirty: () => {}, writeRoute: () => {} });
  await again.ready;
  assert.deepEqual(again.context()?.selection, { '': 'dark' });
  assert.deepEqual(again.groups().map((g) => g.active), ['dark']);
  await again.follow();
  const followed = await save(reopened);
  assert.equal(Object.hasOwn(followed, '__tokenSelection'), false, 'a document that follows the design system saves no choice of its own');
  assert.equal((await createRuntime(tool, host, followed as never)).tokenSelection, undefined);
  again.dispose();
});
