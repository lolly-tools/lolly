// SPDX-License-Identifier: MPL-2.0
/**
 * The W4 resolve order across the three M4 passes (plan 291 integrate): theme-linked
 * colours first (normaliseDesignColourRefs, through resolveBlockTokenBindings or the
 * write-time hook), then the surface pass that picks `?theme=auto` marks from the colour
 * a layer sits on, then the asset reads, where a photo look bakes the variant of the
 * active theme. Each builder tested its own pass; this file checks that one document
 * goes through all three on mount, on setTokenSelection, after a blocks setInput and on
 * resolveRefs, and that no render ever shows a half-switched theme.
 *
 * The runtime runs the colours first. The surface pass also re-resolves linked colours
 * for its own judgement, so a pick agrees with the theme even if that order changed; a
 * scratch run with the order reversed still passes here. What fails these tests is a
 * pass left out: no re-pick after an edit, asset reads without the theme choice, or a
 * theme switch that skips the colours (each checked by mutation on 2026-10-03).
 *
 * Public: brands/lolly-start (light and dark themes, a Tone look with a dark variant,
 * no logo-surface rule, so a mark flips to its reverse treatment on a dark surface).
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-theme-resolve-order.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';

type Row = Record<string, unknown>;
const START = fileURLToPath(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url));
const startDoc = (): any => JSON.parse(readFileSync(START, 'utf8'));

const PHOTO = `user/media/${'ab'.repeat(32)}?treatment=tone`;
const LIGHT_SURFACE = '#ffffff';
const DARK_SURFACE = '#1d1d1d';

let toolSeq = 0;
function designDouble(): any {
  return {
    manifest: {
      id: `resolve-order-${++toolSeq}`, name: 'Resolve order double', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{
        id: 'boxes', type: 'blocks', default: [],
        fields: [
          { id: 'id', type: 'text' }, { id: 'kind', type: 'text' }, { id: 'frame', type: 'text' },
          { id: 'x', type: 'number' }, { id: 'y', type: 'number' }, { id: 'w', type: 'number' }, { id: 'h', type: 'number' },
          { id: 'bg', type: 'color' }, { id: 'image', type: 'asset' }, { id: 'tokenLinks', type: 'text' },
        ],
        canvas: { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', frameField: 'frame', fillField: 'bg', imageField: 'image', frameKind: 'frame' },
        tokenBindingsField: 'tokenLinks',
      }],
    },
    template: '{{#each boxes}}<i>{{this.image.url}}</i>{{/each}}',
    hooksSource: null,
  };
}

/** A host over one token document (swappable), recording every asset read with the
 *  theme choice it carried. */
function startHost(state: { doc: any }) {
  const reads: Array<{ id: string; theme: string }> = [];
  const host: any = {
    version: '1',
    shell: 'test',
    profile: { get: async () => ({}) },
    assets: {
      get: async (id: string, opts: { tokenSelection?: Record<string, string> } = {}) => {
        reads.push({ id, theme: opts.tokenSelection?.[''] ?? 'default' });
        return { id, url: `asset:${id}`, meta: {} };
      },
      query: async () => [],
    },
    tokens: {
      get: async (opts = {}) => createTokenSet(state.doc, opts),
      colors: async (opts = {}) => createTokenSet(state.doc, opts).colors(),
      resolve: async (ref: string, opts = {}) => createTokenSet(state.doc, opts).resolve(ref),
      snapshot: async () => ({ document: state.doc, system: null, version: null, selection: { choices: {} } }),
    },
    log: () => {},
  };
  return { host, reads };
}

const rowsOf = (model: any[]): Row[] => model.find((i) => i.id === 'boxes').value as Row[];
const rowOf = (rt: any, id: string): any => rowsOf(rt.getModel()).find((r) => r.id === id);
/** A row's link for one field. The Design tool declares `tokenLinks` as text, so it is stored as JSON. */
const linkOf = (row: any, field: string): any => (typeof row.tokenLinks === 'string' ? JSON.parse(row.tokenLinks) : row.tokenLinks ?? {})[field];

/** One emitted render: the stored frame colour, the mark's surface and the theme the photo was read in. */
function snapshotOf(model: any[]) {
  const rows = rowsOf(model);
  const frame = rows.find((r) => r.id === 'f') as any;
  const mark = rows.find((r) => r.id === 'mark') as any;
  return { bg: frame?.bg, surface: mark?.image?.meta?.surfaceVariant?.surface ?? null, markUrl: mark?.image?.url ?? null };
}

function documentRows(): Row[] {
  return [
    // The frame colour is a theme reference, written as a bare alias: the normaliser
    // must turn it into this theme's literal plus a link before anything reads the frame colour.
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 1000, h: 500, bg: '{color.semantic.surface}' },
    { id: 'photo', kind: 'image', frame: 'f', x: 0, y: 0, w: 400, h: 500, image: PHOTO },
    { id: 'mark', kind: 'image', frame: 'f', x: 800, y: 420, w: 160, h: 40, image: 'lolly/logo/primary?theme=auto' },
  ];
}

test('mount: the colour is lowered, the mark picked from it and the photo read in the theme, all in the saved theme', async () => {
  const state = { doc: startDoc() };
  const { host, reads } = startHost(state);
  const rt: any = await createRuntime(designDouble(), host, { boxes: documentRows() as never, __tokenSelection: { '': 'dark' } } as never);
  const frame = rowOf(rt, 'f');
  assert.equal(frame.bg, DARK_SURFACE, 'the alias is stored as the dark literal');
  assert.equal(linkOf(frame, 'bg').ref, '{color.semantic.surface}', 'and the link keeps the reference');
  assert.deepEqual(rowOf(rt, 'mark').image.meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });
  assert.equal(rowOf(rt, 'mark').image.id, 'lolly/logo/primary?theme=auto', 'the authored id stays the reference');
  assert.deepEqual(reads.filter((r) => r.id === PHOTO), [{ id: PHOTO, theme: 'dark' }], 'the look bakes the dark variant');
  rt.destroy?.();
});

test('setTokenSelection: the colours, the surface pick and the looks all switch, and no render shows a half-switched theme', async () => {
  const state = { doc: startDoc() };
  const { host, reads } = startHost(state);
  const rt: any = await createRuntime(designDouble(), host, { boxes: documentRows() as never });
  assert.deepEqual(snapshotOf(rt.getModel()), { bg: LIGHT_SURFACE, surface: 'light', markUrl: 'asset:lolly/logo/primary' });

  const seen: ReturnType<typeof snapshotOf>[] = [];
  const off = rt.subscribe(({ model }: any) => seen.push(snapshotOf(model)));
  seen.length = 0;
  reads.length = 0;
  await rt.setTokenSelection({ '': 'dark' });
  assert.deepEqual(snapshotOf(rt.getModel()), { bg: DARK_SURFACE, surface: 'dark', markUrl: 'asset:lolly/logo/reverse' });
  assert.ok(seen.length >= 1, 'the switch repaints');
  for (const s of seen) {
    const dark = s.bg === DARK_SURFACE;
    assert.equal(s.surface, dark ? 'dark' : 'light', `a render paired a ${s.bg} frame with a ${s.surface} mark`);
  }
  assert.deepEqual(reads.filter((r) => r.id === PHOTO).map((r) => r.theme), ['dark'], 'the photo is read again in the new theme');
  assert.ok(reads.some((r) => r.id === 'lolly/logo/reverse'), 'the mark resolves its new pick');

  reads.length = 0;
  await rt.setTokenSelection({});
  assert.deepEqual(snapshotOf(rt.getModel()), { bg: LIGHT_SURFACE, surface: 'light', markUrl: 'asset:lolly/logo/primary' });
  assert.deepEqual(reads.filter((r) => r.id === PHOTO).map((r) => r.theme), ['default']);
  off();
  rt.destroy?.();
});

test('setInput: a panel written as an alias is stored as a literal, and the mark is re-picked against it', async () => {
  const state = { doc: startDoc() };
  const { host } = startHost(state);
  const rt: any = await createRuntime(designDouble(), host, { boxes: documentRows() as never });
  assert.equal(rowOf(rt, 'mark').image.meta.surfaceVariant.surface, 'light');
  // A live edit drops a panel under the mark, its colour written as a raw alias (what an
  // agent's set op or the web preflight fix sends). Text ink is dark in the light theme.
  const rows = rowsOf(rt.getModel()).slice();
  rows.splice(2, 0, { id: 'panel', kind: 'box', frame: 'f', x: 700, y: 380, w: 300, h: 120, bg: '{color.semantic.text}' });
  await rt.setInput('boxes', rows as never);
  const panel = rowOf(rt, 'panel');
  assert.equal(panel.bg, '#1d1d1d', 'stored as the literal, never the alias that paints transparent');
  assert.equal(linkOf(panel, 'bg').ref, '{color.semantic.text}');
  assert.deepEqual(rowOf(rt, 'mark').image.meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });

  // The same document in dark: the panel's ink is light there, so the mark comes back.
  await rt.setTokenSelection({ '': 'dark' });
  assert.equal(rowOf(rt, 'panel').bg, '#ffffff');
  assert.deepEqual(rowOf(rt, 'mark').image.meta.surfaceVariant, { id: 'lolly/logo/primary', surface: 'light' });
  rt.destroy?.();
});

test('resolveRefs: a design-system edit re-resolves the colour, and the mark follows it', async () => {
  const state = { doc: startDoc() };
  const { host, reads } = startHost(state);
  const rt: any = await createRuntime(designDouble(), host, { boxes: documentRows() as never });
  assert.equal(rowOf(rt, 'f').bg, LIGHT_SURFACE);
  // The design system now paints its light surface dark (an edit in the brand editor).
  const edited = startDoc();
  edited.light.color.semantic.surface.$value = '{color.ramp.neutral.1}';
  state.doc = edited;
  reads.length = 0;
  await rt.resolveRefs();
  assert.equal(rowOf(rt, 'f').bg, DARK_SURFACE, 'the cached literal follows the token');
  assert.deepEqual(rowOf(rt, 'mark').image.meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });
  assert.deepEqual(reads.filter((r) => r.id === PHOTO).map((r) => r.theme), ['default'], 'a resolve with no theme change reads the base look');
  rt.destroy?.();
});
