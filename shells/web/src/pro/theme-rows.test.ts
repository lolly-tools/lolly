// SPDX-License-Identifier: MPL-2.0
/**
 * Batch rows draw in their session's theme choices (plans/319 A6): light or dark, and
 * a colourway. A row keeps them among its values as `__tokenSelection` (the token
 * context pro/folder-rows.ts carries); this suite pins what A6 adds on top: the CSV
 * `_themes` column, the render's two hosts (the stage painted in the choices, composed
 * children inheriting them) and the preview link. Fixtures are plain light/dark
 * documents and a two-colourway system (the public Lolly Start system plus a
 * Persimmon colourway).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/pro/theme-rows.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { HostV1, TokenResolveOptions } from '@lolly-tools/core/host-v1';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { addColourway, type ColourwayValues } from '../../../../engine/src/colourway.ts';
import { rowFromToolSession, rowFromBatchRow } from './folder-rows.ts';
import { snapshotFromState, rowsFromSnapshot, type SessionRow } from './sessions.ts';
import { batchToCsv, csvToBatch, type IoRow } from './io.ts';
import { rowTokenSelection, documentHosts } from './render-export.ts';
import { rowPreviewRoute, type PreviewRow } from './row-preview.ts';
import { applyBrandVars } from '../brand-vars.ts';
import { inspectTokenDocument } from '../../../../engine/src/token-inspect.ts';
import { parseUrlState } from '@lolly/engine';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

const DARK = { '': 'dark' };
const PERSIMMON_DARK = { '': 'dark', colourway: 'persimmon' };

const PERSIMMON: Record<string, ColourwayValues> = {
  light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
  dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
};

/** Lolly Start (light and dark) with a second colourway beside its canonical one. */
function twoColourways(): Record<string, unknown> {
  const doc = JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
  const result = addColourway(doc, { id: 'persimmon', name: 'Persimmon', values: PERSIMMON });
  assert.ok(result.ok, result.ok ? '' : result.reasons.join(' '));
  return result.doc;
}

/** A host that resolves tokens for real and records what compose calls carry. */
function tokenHost(doc: unknown) {
  const composed: unknown[] = [];
  const host = {
    version: '1', shell: 'web', log: () => {},
    assets: { get: async () => null, query: async () => [] },
    tokens: {
      get: async (opts?: TokenResolveOptions) => createTokenSet(doc, opts),
      colors: async (opts?: TokenResolveOptions) => createTokenSet(doc, opts).colors(),
      resolve: async (ref: string, opts?: TokenResolveOptions) => createTokenSet(doc, opts).resolve(ref),
      inspect: async (opts?: TokenResolveOptions) => inspectTokenDocument(doc, opts),
    },
    compose: { render: async (spec: { tokenSelection?: unknown }) => { composed.push(spec.tokenSelection); return null; } },
  } as unknown as HostV1;
  return { host, composed };
}

/** An element stand-in that records each custom property painted on the element. */
function fakeElement() {
  const props = new Map<string, string>();
  return { props, el: { style: { setProperty: (k: string, v: string) => props.set(k, v), removeProperty: (k: string) => props.delete(k) } } as unknown as HTMLElement };
}

// ── The seam with the token context rows carry (pro/folder-rows.ts) ────────

test('a row opened from a saved session, or from a saved batch, renders in that session\'s choices', async () => {
  // Rows keep `__tokenSelection` among their values (the token context a runtime seeds
  // from); the render reads it there, so the stage and the runtime agree.
  const fromSession = rowFromToolSession({ __toolId: 'design', headline: 'Hi', __tokenSelection: PERSIMMON_DARK } as never);
  assert.deepEqual(rowTokenSelection(fromSession), PERSIMMON_DARK);
  assert.equal(rowTokenSelection(rowFromToolSession({ __toolId: 'design' })), undefined);
  const snap = snapshotFromState({ format: 'png', collapsed: [], colWidths: {}, rows: [
    { toolId: 'design', manifest: null, values: { ...fromSession.values } as SessionRow['values'] },
    { toolId: 'design', manifest: null, values: { headline: 'Plain' } },
  ] });
  const back = await rowsFromSnapshot(JSON.parse(JSON.stringify(snap)), { newRow: (): SessionRow => ({ toolId: '', manifest: null, values: {} }) });
  assert.deepEqual(back.map(r => rowTokenSelection(r)), [PERSIMMON_DARK, undefined]);
  assert.deepEqual(rowTokenSelection(rowFromBatchRow({ toolId: 'design', values: { __tokenSelection: DARK } }, [])), DARK);
});

// ── CSV: the `_themes` column ────────────────────────────────────────────────

const MANIFEST = { id: 'poster', name: 'Poster', inputs: [{ id: 'headline', type: 'text' }] } as unknown as ToolManifest;
const getTool = async (id: string): Promise<{ manifest: ToolManifest }> => { if (id !== 'poster') throw new Error('unknown'); return { manifest: MANIFEST }; };
const makeRow = (): IoRow => ({ toolId: '', manifest: null, values: {} });
const ioRow = (values: Record<string, unknown>): IoRow => ({ toolId: 'poster', manifest: MANIFEST, values: values as IoRow['values'] });
const choicesOf = (rows: readonly IoRow[]) => rows.map(r => r.values.__tokenSelection);

test('CSV round-trips each row\'s theme choices in a `_themes` column after the size columns', async () => {
  const csv = batchToCsv([
    ioRow({ headline: 'Night', __tokenSelection: DARK }),
    ioRow({ headline: 'Orange', __tokenSelection: PERSIMMON_DARK }),
    ioRow({ headline: 'Default' }),
  ]);
  assert.equal(csv.split('\n')[0]!.trim(), 'tool,format,width,height,unit,dpi,_themes,headline');
  assert.doesNotMatch(csv, /__tokenSelection/, 'the stored key never becomes a column of its own');
  const { rows: out, errors } = await csvToBatch(csv, { getTool, makeRow });
  assert.deepEqual(errors, []);
  assert.deepEqual(choicesOf(out), [DARK, PERSIMMON_DARK, undefined], 'read back where a saved session keeps them');
  assert.deepEqual(out.map(r => rowTokenSelection(r)), [DARK, PERSIMMON_DARK, undefined], 'which is where the render reads them');
  assert.deepEqual(out.map(r => r.values.headline), ['Night', 'Orange', 'Default'], '`_themes` is never read as an input');
});

test('a batch without choices, or with a damaged stored map, writes the CSV it always wrote', () => {
  for (const values of [{ headline: 'Hi' }, { headline: 'Hi', __tokenSelection: 'dark' }, { headline: 'Hi', __tokenSelection: {} }]) {
    const csv = batchToCsv([ioRow(values)]);
    assert.equal(csv.split('\n')[0]!.trim(), 'tool,format,width,height,unit,dpi,headline', JSON.stringify(values));
  }
});

test('a `{}` cell is no choice, as the `_themes` link parameter reads it, and raises no issue', async () => {
  const csv = 'tool,_themes,headline\nposter,{},One\nposter, { } ,Two\nposter,[],Three\n';
  const { rows: out, errors } = await csvToBatch(csv, { getTool, makeRow });
  assert.deepEqual(choicesOf(out), [undefined, undefined, undefined]);
  assert.deepEqual(out.map(r => r.values.headline), ['One', 'Two', 'Three']);
  assert.equal(errors.length, 1, 'an array is still not theme choices');
  assert.match(errors[0]!, /^Row 4: the _themes cell is not valid theme choices/);
});

test('a hand-written `_themes` cell that is not theme choices is reported and the row still imports', async () => {
  const csv = 'tool,_themes,headline\nposter,dark,One\nposter,"{""colourway"":""persimmon""}",Two\nposter,,Three\n';
  const { rows: out, errors } = await csvToBatch(csv, { getTool, makeRow });
  assert.deepEqual(choicesOf(out), [undefined, { colourway: 'persimmon' }, undefined]);
  assert.deepEqual(out.map(r => r.values.headline), ['One', 'Two', 'Three']);
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /^Row 2: the _themes cell is not valid theme choices/);
});

// ── The render boundary ──────────────────────────────────────────────────────

test('a render reads a composed child\'s own choices, else the ones the row carries among its values', () => {
  assert.deepEqual(rowTokenSelection({ tokenSelection: DARK, values: { __tokenSelection: PERSIMMON_DARK } }), DARK);
  assert.deepEqual(rowTokenSelection({ values: { __tokenSelection: PERSIMMON_DARK } }), PERSIMMON_DARK);
  assert.equal(rowTokenSelection({ values: { __tokenSelection: 'dark' } }), undefined);
  assert.equal(rowTokenSelection({}), undefined);
});

test('with no choices the render hosts read tokens as the host does, and a plain compose call passes through', async () => {
  const { host, composed } = tokenHost(twoColourways());
  for (const selection of [undefined, {}]) {
    const hosts = documentHosts(host, selection);
    assert.equal(hosts.canvas, hosts.runtime, 'one host: nothing to scope the canvas to');
    assert.equal(hosts.runtime.tokens, host.tokens, 'token reads are the host\'s own, so the stage paints exactly as before');
    assert.equal(hosts.runtime.assets, host.assets);
    await hosts.canvas.compose!.render({ toolId: 'qr-code', inputs: {} });
  }
  assert.deepEqual(composed, [undefined, undefined], 'a compose call that names no choices reaches the bridge as written');
  const bare = { version: '1' } as unknown as HostV1;
  assert.equal(documentHosts(bare, undefined).canvas, bare, 'a host with no compose API is used as it is');
});

test('a tool link in a row with no choices takes the design system\'s own for the groups it leaves out', async () => {
  // The row draws in the stored dark Persimmon; a link in its template names light only.
  const doc = twoColourways();
  doc.$metadata = { ...(doc.$metadata as object ?? {}), activeThemeSelection: PERSIMMON_DARK };
  const { host, composed } = tokenHost(doc);
  await documentHosts(host, undefined).canvas.compose!.render({ toolId: 'qr-code', inputs: {}, tokenSelection: { '': 'light' } } as never);
  assert.deepEqual(composed, [{ '': 'light', colourway: 'persimmon' }]);
  assert.equal(createTokenSet(doc, { selection: composed[0] as Record<string, string> }).resolve('{color.semantic.primary}'), PERSIMMON.light!.primary);
});

test('the canvas of a dark document is painted dark; a light one stays light (plain light and dark)', async () => {
  const doc = JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
  const { host } = tokenHost(doc);
  const text = (sel?: Record<string, string>) => createTokenSet(doc, sel ? { selection: sel } : {}).resolve('{color.semantic.text}');
  assert.notEqual(text(DARK), text({ '': 'light' }), 'the fixture really differs between its looks');
  for (const sel of [DARK, { '': 'light' }]) {
    const { el, props } = fakeElement();
    await applyBrandVars(el, documentHosts(host, sel).canvas);
    assert.equal(props.get('--brand-text'), text(sel), JSON.stringify(sel));
  }
});

test('the canvas of a colourway document is painted in that colourway, in the look it chose', async () => {
  const { host } = tokenHost(twoColourways());
  const { el, props } = fakeElement();
  await applyBrandVars(el, documentHosts(host, PERSIMMON_DARK).canvas);
  assert.equal(props.get('--brand-primary'), PERSIMMON.dark!.primary);
  assert.equal(props.get('--brand-on-primary'), PERSIMMON.dark!['on-primary']);
  const main = fakeElement();
  await applyBrandVars(main.el, documentHosts(host, { '': 'light', colourway: 'main' }).canvas);
  assert.notEqual(main.props.get('--brand-primary'), PERSIMMON.light!.primary, 'the canonical colourway keeps its own lead');
});

test('composed children of a rendered row inherit the row\'s choices; the runtime host leaves token scoping to the runtime', async () => {
  const { host, composed } = tokenHost(twoColourways());
  const hosts = documentHosts(host, PERSIMMON_DARK);
  await hosts.runtime.compose!.render({ toolId: 'qr-code', inputs: {} });
  await hosts.canvas.compose!.render({ toolId: 'qr-code', inputs: {} });
  assert.deepEqual(composed, [PERSIMMON_DARK, PERSIMMON_DARK]);
  assert.equal(hosts.runtime.tokens, host.tokens, 'the runtime scopes its own token reads from tokenSelection');
});

// ── A row's preview link ────────────────────────────────────────────────────

const previewRow = (extra: Partial<PreviewRow> = {}): PreviewRow => ({ toolId: 'poster', values: {}, ...extra });

test('a row\'s preview opens in the choices the row renders in, and a row without any opens as before', () => {
  const route = (row: PreviewRow) => rowPreviewRoute(row, MANIFEST, { format: 'png', unit: 'px' });
  const query = (r: string) => new URLSearchParams(r.slice(r.indexOf('?') + 1));
  for (const selection of [DARK, PERSIMMON_DARK]) {
    const r = route(previewRow({ values: { headline: 'Night', __tokenSelection: selection } }));
    assert.match(r, /^#\/tool\/poster\?/);
    assert.deepEqual(parseUrlState(query(r).toString(), MANIFEST).tokenSelection, selection);
    assert.doesNotMatch(r, /__tokenSelection/);
  }
  // The route pro/index.ts built inline before the route carried theme choices.
  const plain = route(previewRow({ values: { headline: 'Day' } }));
  assert.equal(query(plain).has('_themes'), false);
  assert.equal(plain, '#/tool/poster?headline=Day&format=png&full');
  assert.equal(route(previewRow({ values: { headline: 'Day', __tokenSelection: 'dark' } })), plain, 'a damaged stored map is no choice');
  const sized = route(previewRow({ values: {}, unit: 'in', outWidth: 2, outHeight: 1, format: 'svg' }));
  assert.match(sized, /&full&w=192&h=96$/, 'a physical size shows at its on-screen px size');
  assert.equal(query(sized).get('format'), 'svg', 'the row\'s own format wins over the run\'s');
});
