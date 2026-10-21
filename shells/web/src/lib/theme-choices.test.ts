// SPDX-License-Identifier: MPL-2.0
/**
 * Theme choices away from the tool view's canvas (plans/319 A6): reading a stored
 * choice map, merging a composed child's own choices over the document's (filled from
 * the design system's own choices when the document made none), and the per-mount
 * compose wrapper that hands the document's choices to every child.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/theme-choices.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AssetRef, HostV1, TokenResolveOptions } from '@lolly-tools/core/host-v1';
import { childSelection, composeSelection, effectiveThemeChoices, savedTokenSelection, withComposeSelection } from './theme-choices.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { inspectTokenDocument } from '../../../../engine/src/token-inspect.ts';
import { resolveTokenSelection } from '../../../../engine/src/token-selection.ts';
import { addColourway } from '../../../../engine/src/colourway.ts';

const DARK = { '': 'dark' };
const PERSIMMON = { '': 'light', colourway: 'persimmon' };
const PERSIMMON_DARK = { '': 'dark', colourway: 'persimmon' };

/** A host whose compose API records what each call was handed. */
function recordingHost() {
  const calls: Array<{ via: string; tokenSelection: unknown }> = [];
  const ref = { source: 'remote', id: 'x', type: 'vector', url: 'blob:x' } as AssetRef;
  const host = {
    version: '1', shell: 'web',
    compose: {
      render: async (spec: { tokenSelection?: unknown }) => { calls.push({ via: 'render', tokenSelection: spec.tokenSelection }); return ref; },
      renderUrl: async (_url: string, opts: { tokenSelection?: unknown } = {}) => { calls.push({ via: 'renderUrl', tokenSelection: opts.tokenSelection }); return ref; },
      _describeUrl: async () => null,
    },
  } as unknown as HostV1;
  return { host, calls };
}

// ── A stored choice map ──────────────────────────────────────────────────────

test('a stored theme choice is read only when it is a non-empty map of theme ids', () => {
  assert.deepEqual(savedTokenSelection(DARK), DARK);
  assert.deepEqual(savedTokenSelection(PERSIMMON_DARK), PERSIMMON_DARK);
  const tooMany = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`g${i}`, 'a']));
  for (const bad of [undefined, null, 'dark', 3, ['dark'], {}, { '': 3 }, { '': null }, { '': 'x'.repeat(257) }, tooMany]) {
    assert.equal(savedTokenSelection(bad), undefined, JSON.stringify(bad)?.slice(0, 40));
  }
});

test('the limits are the ones the engine applies to `_themes`', () => {
  const most = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`g${i}`, 'a']));
  assert.deepEqual(savedTokenSelection(most), most, '64 groups is the most');
  assert.deepEqual(savedTokenSelection({ '': 'x'.repeat(256) }), { '': 'x'.repeat(256) }, 'and 256 characters the longest theme id');
});

test('a read choice map is a copy, so nothing written to it reaches the stored record', () => {
  const stored = { '': 'dark' };
  const read = savedTokenSelection(stored)!;
  read[''] = 'light';
  assert.equal(stored[''], 'dark');
});

// ── Merging a child's own choices over the document's ───────────────────────

test('the child\'s own choices win group by group; nothing named gives no selection', () => {
  assert.deepEqual(composeSelection(PERSIMMON, DARK), PERSIMMON_DARK);
  assert.deepEqual(composeSelection(PERSIMMON, undefined), PERSIMMON);
  assert.deepEqual(composeSelection(undefined, DARK), DARK);
  assert.equal(composeSelection(undefined, undefined), undefined);
  assert.equal(composeSelection({}, {}), undefined, 'an empty map is no choice');
  const inherited = { ...PERSIMMON };
  composeSelection(inherited, DARK);
  assert.deepEqual(inherited, PERSIMMON, 'the inherited map is never written to');
});

// ── The per-mount compose wrapper ────────────────────────────────────────────

test('every compose call carries the document\'s choices as they are at the moment of the call', async () => {
  const { host, calls } = recordingHost();
  let current: Record<string, string> | undefined = DARK;
  const wrapped = withComposeSelection(host, () => current);
  await wrapped.compose!.render({ toolId: 'qr-code', inputs: {} });
  current = PERSIMMON;
  await wrapped.compose!.renderUrl!('https://lolly.tools/tool/qr-code.svg?url=x');
  current = undefined;
  await wrapped.compose!.render({ toolId: 'qr-code', inputs: {} });
  assert.deepEqual(calls, [
    { via: 'render', tokenSelection: DARK },
    { via: 'renderUrl', tokenSelection: PERSIMMON },
    { via: 'render', tokenSelection: undefined },
  ]);
});

test('a spec that names its own choices keeps them over the document\'s', async () => {
  const { host, calls } = recordingHost();
  const wrapped = withComposeSelection(host, () => PERSIMMON);
  await wrapped.compose!.render({ toolId: 'qr-code', inputs: {}, tokenSelection: DARK } as never);
  await wrapped.compose!.renderUrl!('https://lolly.tools/tool/qr-code.svg?url=x', { tokenSelection: DARK } as never);
  assert.deepEqual(calls.map(c => c.tokenSelection), [PERSIMMON_DARK, PERSIMMON_DARK]);
});

test('with no choices the spec reaches the bridge as the caller wrote it', async () => {
  const { host } = recordingHost();
  let seen: unknown;
  (host.compose as { render: unknown }).render = async (spec: unknown) => { seen = spec; return null; };
  const spec = { toolId: 'qr-code', inputs: { url: 'x' } };
  await withComposeSelection(host, () => undefined).compose!.render(spec);
  assert.equal(seen, spec, 'not even copied, so nothing about a document without choices changes');
});

test('the wrapper keeps every other host member and the web-only picker helper', () => {
  const { host } = recordingHost();
  const original = host.compose!;
  const originalRender = original.render;
  const wrapped = withComposeSelection(host, () => DARK);
  assert.notEqual(wrapped, host, 'a new host, the shell host is never written to');
  assert.equal(wrapped.version, '1');
  assert.equal(typeof (wrapped.compose as unknown as { _describeUrl: unknown })._describeUrl, 'function');
  assert.equal(host.compose, original, 'the shell host keeps its own compose API');
  assert.equal(original.render, originalRender, 'and that API is not rewritten');
  const bare = { version: '1' } as unknown as HostV1;
  assert.equal(withComposeSelection(bare, () => DARK), bare, 'a host with no compose API is returned as it is');
  const renderOnly = { version: '1', compose: { render: async () => null } } as unknown as HostV1;
  assert.equal('renderUrl' in withComposeSelection(renderOnly, () => DARK).compose!, false, 'and a missing renderUrl stays missing');
});

// ── A document that made no choice ───────────────────────────────────────────

const PERSIMMON_VALUES = {
  light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
  dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
};

/** Lolly Start, the plain light and dark system every public clone ships. */
function lollyStart(): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
}

/** Lolly Start with a Persimmon colourway, its design system set to `stored`. */
function storedOn(stored: Record<string, string> | undefined, doc: Record<string, unknown> = lollyStart()): Record<string, unknown> {
  const result = addColourway(doc, { id: 'persimmon', name: 'Persimmon', values: PERSIMMON_VALUES });
  assert.ok(result.ok, result.ok ? '' : result.reasons.join(' '));
  const out = structuredClone(result.doc) as Record<string, unknown>;
  if (stored) out.$metadata = { ...(out.$metadata as object ?? {}), activeThemeSelection: stored };
  return out;
}

/** A host whose token reads resolve `doc` for real and count each read of the choices
 *  it draws in. `via` picks which of the two reads it offers. */
function tokenHost(doc: unknown, via: 'snapshot' | 'inspect' | 'both' = 'both') {
  const reads: string[] = [];
  const calls: unknown[] = [];
  const tokens: Record<string, unknown> = {
    get: async (opts?: TokenResolveOptions) => createTokenSet(doc, opts),
    colors: async (opts?: TokenResolveOptions) => createTokenSet(doc, opts).colors(),
    resolve: async (ref: string, opts?: TokenResolveOptions) => createTokenSet(doc, opts).resolve(ref),
  };
  if (via !== 'inspect') tokens.snapshot = async () => { reads.push('snapshot'); return { document: doc, system: null, version: 'latest', selection: { choices: resolveTokenSelection(doc).choices } }; };
  if (via !== 'snapshot') tokens.inspect = async (opts?: TokenResolveOptions) => { reads.push('inspect'); return inspectTokenDocument(doc, opts); };
  const ref = { source: 'remote', id: 'x', type: 'vector', url: 'blob:x' } as AssetRef;
  const host = {
    version: '1', shell: 'web', tokens,
    compose: {
      render: async (spec: { tokenSelection?: unknown }) => { calls.push(spec.tokenSelection); return ref; },
      renderUrl: async (_url: string, opts: { tokenSelection?: unknown } = {}) => { calls.push(opts.tokenSelection); return ref; },
    },
  } as unknown as HostV1;
  return { host, reads, calls };
}

const primaryOf = (doc: unknown, selection: Record<string, string> | undefined): string =>
  createTokenSet(doc, selection ? { selection } : {}).resolve('{color.semantic.primary}') as string;

test('the choices a host draws in are its stored ones, read from the snapshot or else an inspection', async () => {
  const doc = storedOn(PERSIMMON_DARK);
  for (const via of ['snapshot', 'inspect', 'both'] as const) {
    const { host, reads } = tokenHost(doc, via);
    assert.deepEqual(await effectiveThemeChoices(host), PERSIMMON_DARK, via);
    assert.deepEqual(reads, [via === 'inspect' ? 'inspect' : 'snapshot'], 'one read, the snapshot first, as the runtime reads them');
  }
  assert.equal(await effectiveThemeChoices({ version: '1' } as unknown as HostV1), undefined, 'no token API, no choices');
  const failing = { version: '1', tokens: { snapshot: async () => { throw new Error('offline'); } } } as unknown as HostV1;
  assert.equal(await effectiveThemeChoices(failing), undefined, 'a failed read is no choice, never an error');
});

test('a link that names only light, in a document that made no choice, keeps the stored colourway', async () => {
  const doc = storedOn(PERSIMMON_DARK);
  const { host } = tokenHost(doc);
  assert.equal(primaryOf(doc, undefined), PERSIMMON_VALUES.dark.primary, 'the document draws dark Persimmon from its stored choices');
  const child = await childSelection(host, undefined, { '': 'light' });
  assert.deepEqual(child, { '': 'light', colourway: 'persimmon' });
  assert.equal(primaryOf(doc, child), PERSIMMON_VALUES.light.primary, 'the child is light Persimmon');
  assert.notEqual(primaryOf(doc, { '': 'light' }), PERSIMMON_VALUES.light.primary, 'the link alone, as an explicit selection, would have lost Persimmon');
});

test('a document\'s own choices are never filled from the stored ones, and nothing named reads nothing', async () => {
  const { host, reads } = tokenHost(storedOn(PERSIMMON_DARK));
  assert.deepEqual(await childSelection(host, DARK, { colourway: 'main' }), { '': 'dark', colourway: 'main' });
  assert.deepEqual(await childSelection(host, { '': 'light' }, { colourway: 'persimmon' }), PERSIMMON);
  assert.deepEqual(await childSelection(host, DARK, undefined), DARK);
  assert.equal(await childSelection(host, undefined, undefined), undefined, 'a child with no choices reads the unscoped bridge, as before');
  assert.equal(await childSelection(host, undefined, {}), undefined, 'an empty map is no choice');
  assert.deepEqual(reads, [], 'the design system is read only when a link names some groups and the document none');
});

test('on a plain light and dark system the link\'s choice is the whole selection', async () => {
  const doc = lollyStart();
  doc.$metadata = { ...(doc.$metadata as object ?? {}), activeThemeSelection: DARK };
  const { host } = tokenHost(doc);
  assert.deepEqual(await childSelection(host, undefined, { '': 'light' }), { '': 'light' }, 'one group, nothing to fill');
  const unset = tokenHost(storedOn(undefined)).host;
  assert.deepEqual(await childSelection(unset, undefined, { '': 'dark' }), { '': 'dark', colourway: 'main' }, 'a system with no stored choice fills its canonical options');
});

test('the wrapper fills a link\'s missing groups from the design system when the document made no choice', async () => {
  const { host, calls } = tokenHost(storedOn(PERSIMMON_DARK));
  const wrapped = withComposeSelection(host, () => undefined);
  await wrapped.compose!.render({ toolId: 'qr-code', inputs: {}, tokenSelection: { '': 'light' } } as never);
  await wrapped.compose!.renderUrl!('https://lolly.tools/tool/qr-code.svg?url=x', { tokenSelection: { '': 'light' } } as never);
  await wrapped.compose!.render({ toolId: 'qr-code', inputs: {} });
  assert.deepEqual(calls, [PERSIMMON, PERSIMMON, undefined]);
  const explicit = tokenHost(storedOn(PERSIMMON_DARK));
  await withComposeSelection(explicit.host, () => DARK).compose!.render({ toolId: 'qr-code', inputs: {}, tokenSelection: { colourway: 'main' } } as never);
  assert.deepEqual(explicit.calls, [{ '': 'dark', colourway: 'main' }], 'a document with choices of its own hands over only those');
});
