// SPDX-License-Identifier: MPL-2.0
/**
 * The document theme control's state plumbing (lib/document-theme.ts, plan 291 W4).
 *
 * A theme choice has to reach four places that each read it on their own: the
 * runtime (linked colours), the address (`_themes`, which scopes the web token
 * bridge), the canvas CSS variables and the saved session. These tests drive the
 * switch with fakes that record each of them, so a regression that updates three
 * and forgets one fails here rather than as a canvas that is half light, half dark.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/document-theme.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import {
  createDocumentThemeController, documentThemeGroups, readThemesRoute, sameThemeSelection,
  switchDocumentTheme, syncThemesRoute, themedHost, themeOptionLabel, withThemeChoice,
} from './document-theme.ts';
import type { ThemeRuntime, ThemeSelection, ThemeSwitchDeps } from './document-theme.ts';

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

/** Two named groups, one of which offers a single option and is therefore no choice. */
const GROUPED = {
  base: {}, light: {}, dark: {}, dense: {},
  $themes: [
    { id: 'l', name: 'light', group: 'mode', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { id: 'd', name: 'dark', group: 'mode', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
    { id: 'tight', name: 'Tight', group: 'density', selectedTokenSets: { dense: 'enabled' } },
  ],
};

const ONE_THEME = { base: {}, $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled' } }] };

test('a design system with light and dark offers one group of two, labelled for people', () => {
  const groups = documentThemeGroups(LIGHT_DARK);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.id, '');
  assert.equal(groups[0]!.label, 'Colour theme');
  assert.deepEqual(groups[0]!.options, [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]);
  assert.equal(groups[0]!.active, 'light', 'no selection means the first theme, as createTokenSet does');
  assert.equal(documentThemeGroups(LIGHT_DARK, { '': 'dark' })[0]!.active, 'dark');
});

test('one theme, no themes and a single-option group draw no control', () => {
  assert.deepEqual(documentThemeGroups(ONE_THEME), []);
  assert.deepEqual(documentThemeGroups({ color: { a: { $type: 'color', $value: '#000' } } }), []);
  assert.deepEqual(documentThemeGroups(null), []);
  const grouped = documentThemeGroups(GROUPED, { mode: 'd' });
  assert.deepEqual(grouped.map((g) => [g.id, g.label, g.active]), [['mode', 'mode', 'd']]);
  assert.equal(themeOptionLabel('Tight'), 'Tight', 'a name the app does not know is the design system\'s own');
});

test('a choice keeps every other group explicit, and selections compare by content', () => {
  const groups = [
    { id: 'mode', label: 'mode', options: [{ id: 'l', label: 'Light' }, { id: 'd', label: 'Dark' }], active: 'l' },
    { id: 'brand', label: 'brand', options: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], active: 'b' },
  ];
  assert.deepEqual(withThemeChoice(groups, 'mode', 'd'), { mode: 'd', brand: 'b' });
  assert.ok(sameThemeSelection({ a: '1', b: '2' }, { b: '2', a: '1' }));
  assert.ok(!sameThemeSelection({ a: '1' }, { a: '2' }));
  assert.ok(!sameThemeSelection({ a: '1' }, undefined));
  assert.ok(sameThemeSelection(undefined, {}));
});

/** Records every place a switch has to reach, in order. */
function fakes(start?: ThemeSelection, opts: { refuse?: boolean; noSetter?: boolean } = {}) {
  const log: string[] = [];
  const reads: unknown[] = [];
  let selection = start;
  const runtime: ThemeRuntime = {
    get tokenSelection() { return selection; },
    ...(opts.noSetter ? {} : {
      async setTokenSelection(next: ThemeSelection) {
        log.push(`runtime ${JSON.stringify(next)}`);
        if (opts.refuse) throw new Error('refused');
        selection = next;
      },
    }),
  };
  const host = {
    version: '1',
    tokens: {
      resolve: async (_ref: string, o: { selection?: ThemeSelection } = {}) => { reads.push(o.selection); return '#000000'; },
      get: async () => ({}), colors: async () => [], themes: async () => [],
    },
  } as unknown as HostV1;
  const canvas = { id: 'tool-canvas' } as unknown as HTMLElement;
  const deps: ThemeSwitchDeps = {
    runtime, host,
    canvas: () => canvas,
    paint: async (el, scoped) => { log.push(`paint ${el.id}`); await scoped.tokens!.resolve('{color.semantic.text}'); },
    writeRoute: (next) => { log.push(`route ${JSON.stringify(next)}`); },
    markDirty: () => { log.push('dirty'); },
  };
  return { deps, log, reads, runtime };
}

test('a switch writes the address, then the runtime, then the canvas variables, then marks the session', async () => {
  const f = fakes({ '': 'light' });
  assert.equal(await switchDocumentTheme(f.deps, { '': 'dark' }), true);
  assert.deepEqual(f.log, ['route {"":"dark"}', 'runtime {"":"dark"}', 'paint tool-canvas', 'dirty']);
  assert.deepEqual(f.reads, [{ '': 'dark' }], 'the canvas variables are read under the new selection, whatever the address form');
  assert.deepEqual(f.runtime.tokenSelection, { '': 'dark' });
});

test('choosing the theme already shown changes nothing', async () => {
  const f = fakes({ '': 'dark' });
  assert.equal(await switchDocumentTheme(f.deps, { '': 'dark' }), false);
  assert.deepEqual(f.log, []);
});

test('a runtime that refuses the change puts the address back and leaves the session clean', async () => {
  const f = fakes({ '': 'light' }, { refuse: true });
  await assert.rejects(switchDocumentTheme(f.deps, { '': 'dark' }), /refused/);
  assert.deepEqual(f.log, ['route {"":"dark"}', 'runtime {"":"dark"}', 'route {"":"light"}']);
  const fresh = fakes(undefined, { refuse: true });
  await assert.rejects(switchDocumentTheme(fresh.deps, { '': 'dark' }));
  assert.equal(fresh.log.at(-1), 'route null', 'a document that had no selection gets its address cleared again');
});

test('a runtime without setTokenSelection offers no control and switches nothing', async () => {
  const f = fakes(undefined, { noSetter: true });
  assert.equal(await switchDocumentTheme(f.deps, { '': 'dark' }), false);
  assert.deepEqual(f.log, []);
  const changes: number[] = [];
  const controller = createDocumentThemeController({ ...f.deps, readDocument: async () => LIGHT_DARK, onChange: () => changes.push(1) });
  await controller.ready;
  assert.deepEqual(controller.groups(), []);
  controller.dispose();
});

test('the controller reads the themes once, applies choices in order and repaints after each', async () => {
  const f = fakes(undefined);
  const changes: string[] = [];
  const controller = createDocumentThemeController({
    ...f.deps, readDocument: async () => LIGHT_DARK, onChange: () => changes.push(controller.groups()[0]?.active ?? 'none'),
  });
  await controller.ready;
  assert.deepEqual(changes, ['light'], 'the first paint follows the read');
  const one = controller.choose('', 'dark');
  const two = controller.choose('', 'light');
  await Promise.all([one, two]);
  assert.deepEqual(f.log.filter((line) => line.startsWith('runtime')), ['runtime {"":"dark"}', 'runtime {"":"light"}']);
  assert.deepEqual(changes, ['light', 'dark', 'light']);
  await controller.choose('', 'sepia');
  assert.equal(f.log.filter((line) => line.startsWith('runtime')).length, 2, 'an option the design system does not declare is ignored');
  controller.dispose();
});

test('a saved selection reaches the address on reopen, and only when the address disagrees', () => {
  const writes: ThemeSelection[] = [];
  const write = (s: ThemeSelection): void => { writes.push(s); };
  assert.equal(syncThemesRoute({ '': 'dark' }, { read: () => null, write }), true);
  assert.equal(syncThemesRoute({ '': 'dark' }, { read: () => '{"":"dark"}', write }), false);
  assert.equal(syncThemesRoute({ '': 'dark' }, { read: () => '{"":"light"}', write }), true);
  assert.equal(syncThemesRoute(undefined, { read: () => null, write }), false);
  assert.equal(syncThemesRoute({ '': 'dark' }, { read: () => '{not json', write }), true, 'an unreadable address is replaced');
  assert.deepEqual(writes, [{ '': 'dark' }, { '': 'dark' }, { '': 'dark' }]);
  assert.equal(readThemesRoute(() => '{bad'), undefined);
});

test('themedHost scopes token reads to the selection and is the host itself without one', async () => {
  const f = fakes();
  assert.equal(themedHost(f.deps.host, undefined), f.deps.host);
  assert.equal(themedHost(f.deps.host, {}), f.deps.host);
  await themedHost(f.deps.host, { '': 'dark' }).tokens!.resolve('{x}');
  assert.deepEqual(f.reads, [{ '': 'dark' }]);
});

test('with the real engine runtime, a choice re-resolves linked colours and the runtime reports it for the session', async () => {
  const { createRuntime } = await import('../../../../engine/src/runtime.ts');
  const { loadTool } = await import('../../../../engine/src/loader.ts');
  const { createTokenSet } = await import('../../../../engine/src/tokens.ts');
  const { withBlockTokenBinding } = await import('../../../../engine/src/token-block-bindings.ts');
  const manifest = {
    id: 'theme-probe', name: 'Theme probe', version: '1.0.0', engineVersion: '^1.0.0', status: 'community', render: { width: 10, height: 10, formats: ['svg'] },
    inputs: [{ id: 'boxes', type: 'blocks', fields: [{ id: 'id', type: 'text' }, { id: 'fg', type: 'color' }, { id: 'tokenLinks', type: 'text', default: '' }], tokenBindingsField: 'tokenLinks', default: [] }],
  };
  const tool = await loadTool(manifest.id, async (path: string) => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg>{{#each boxes}}<g data-fg="{{fg}}"></g>{{/each}}</svg>';
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
  const row = withBlockTokenBinding({ id: 't', fg: '#111111' }, 'tokenLinks', 'fg', { ref: '{color.semantic.text}', value: '#111111' });
  const runtime = await createRuntime(tool, host, { boxes: [row] } as never);
  const routes: Array<ThemeSelection | null> = [];
  let dirty = 0;
  const controller = createDocumentThemeController({
    runtime, host, canvas: () => null, onChange: () => {}, markDirty: () => { dirty += 1; }, writeRoute: (s) => { routes.push(s); },
  });
  await controller.ready;
  assert.deepEqual(controller.groups().map((g) => g.active), ['light']);
  await controller.choose('', 'dark');
  assert.match(runtime.getHydrated(), /data-fg="#eeeeee"/);
  assert.deepEqual(runtime.tokenSelection, { '': 'dark' }, 'what the session snapshot saves as __tokenSelection');
  assert.deepEqual(routes, [{ '': 'dark' }]);
  assert.equal(dirty, 1);
  assert.deepEqual(controller.groups().map((g) => g.active), ['dark']);
  controller.dispose();
});
