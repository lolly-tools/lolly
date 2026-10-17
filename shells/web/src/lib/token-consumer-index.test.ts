// SPDX-License-Identifier: MPL-2.0
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { withBlockTokenBinding } from '../../../../engine/src/token-block-bindings.ts';
import {
  buildTokenConsumerIndex, createTokenConsumerCheck, manifestTokenUses, sessionTokenUses, summariseTokenConsumers,
  TOKEN_CONSUMER_STALE_CHECK_MS, tokenConsumerIndexStale, tokenConsumerSectionHtml, tokenConsumerSentences, webTokenConsumerSources,
  type TokenConsumerSessionEntry, type TokenConsumerSources,
} from './token-consumer-index.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const INK = '{color.brand.ink}';
type Row = Parameters<typeof withBlockTokenBinding>[0];

/** A Design-shaped session: a typed input link, layer links (linked, custom, run) and a composed text story. */
function designSession(): Record<string, unknown> {
  let layer: Row = { kind: 'rect', fill: '#000000', w: 10 };
  layer = withBlockTokenBinding(layer, 'tokenLinks', 'fill', { ref: INK, value: '#112233' });
  layer = withBlockTokenBinding(layer, 'tokenLinks', 'w', { ref: '{size.card}', value: 12 });
  layer = withBlockTokenBinding(layer, 'tokenLinks', 'w', 14);
  const runs = JSON.parse(String(layer.tokenLinks)) as Record<string, unknown>;
  runs.__runs = { '0a0b0c': { ref: '{color.brand.accent}', value: '#0a0b0c' } };
  layer = { ...layer, tokenLinks: JSON.stringify(runs) };
  const paragraph = withBlockTokenBinding({ lineHeight: 1 }, 'tokenLinks', 'lineHeight', { ref: '{line.body}', value: 1.4 });
  const textDocument = JSON.stringify({ version: 1, styles: [], stories: [{ id: 's1', revision: 0, paragraphs: [{ id: 'p1', paragraph }] }] });
  return { __toolId: 'design', __label: 'Launch poster', title: { ref: '{text.headline}', value: 'Hello' }, boxes: [layer], textDocument };
}

test('a session reports typed links, layer links, run links and paragraph links with their kind', () => {
  const { uses, truncated } = sessionTokenUses(designSession());
  assert.equal(truncated, false);
  const by = (path: string) => uses.filter(use => use.path === path).map(use => `${use.where}:${use.kind}`);
  assert.deepEqual(by('text.headline'), ['title:linked']);
  assert.deepEqual(by('color.brand.ink'), ['boxes[0].fill:linked']);
  assert.deepEqual(by('size.card'), ['boxes[0].w:custom']);
  assert.deepEqual(by('color.brand.accent'), ['boxes[0].text:linked']);
  assert.deepEqual(by('line.body'), ['textDocument.stories[0].paragraphs[0].paragraph.lineHeight:linked']);
});

test('literal alias text is not a link unless the manifest types the input as colour or number', () => {
  const data = { title: '{color.brand.ink}', accent: '{color.brand.ink}', __tokenLinks: { size: '{size.card}' }, __label: '{color.brand.ink}' };
  assert.deepEqual(sessionTokenUses(data).uses.map(use => `${use.path}@${use.where}:${use.kind}`), ['size.card@size:custom']);
  const typed = sessionTokenUses(data, { typedInputs: new Set(['accent']) }).uses.map(use => `${use.where}:${use.kind}`);
  assert.deepEqual(typed, ['accent:linked', 'size:custom']);
});

test('an unresolved link stays a link, and a walk past the node limit is reported as cut short', () => {
  assert.deepEqual(sessionTokenUses({ accent: { ref: INK, status: 'unresolved' } }).uses.map(use => use.kind), ['unresolved']);
  const big = { rows: Array.from({ length: 50 }, () => ({ fill: { ref: INK, value: '#000000' } })) };
  const cut = sessionTokenUses(big, { nodeLimit: 20 });
  assert.equal(cut.truncated, true);
  assert.ok(cut.uses.length < 50);
});

test('a manifest declares colour and number defaults, block field defaults and example values', () => {
  const { uses, typedInputs } = manifestTokenUses({
    inputs: [
      { id: 'accent', type: 'color', default: INK },
      { id: 'headline', type: 'text', default: '{color.brand.ink}' },
      { id: 'gap', type: 'number', default: 4 },
      { id: 'boxes', type: 'blocks', fields: [{ id: 'fg', type: 'color', default: '{color.semantic.text}' }, { id: 'label', default: '{x.y}' }] },
    ],
    examples: [{ label: 'Night', values: { accent: '{color.brand.night}', headline: '{color.brand.ink}' } }],
  });
  assert.deepEqual([...typedInputs].sort(), ['accent', 'gap']);
  assert.deepEqual(uses.map(use => `${use.path}@${use.where}:${use.kind}`), [
    'color.brand.ink@accent:default',
    'color.semantic.text@boxes.fg:default',
    'color.brand.night@examples[0].accent:example',
  ]);
});

function fakeSources(sessions: Record<string, unknown>, overrides: Partial<TokenConsumerSources> = {}): TokenConsumerSources & { entries: TokenConsumerSessionEntry[] } {
  const entries: TokenConsumerSessionEntry[] = Object.keys(sessions).map((slot, index) => ({ slot, toolId: 'design', updatedAt: `2026-10-0${index + 1}T00:00:00Z`, ...(index === 0 ? { designSystem: { id: 'beacon', label: 'Beacon' } } : index === 1 ? { designSystem: { id: 'other', label: 'Other' } } : {}) }));
  return {
    entries,
    listSessions: async () => entries,
    loadSession: async slot => { const data = sessions[slot]; if (data instanceof Error) throw data; return data ?? null; },
    listTools: async () => [{ id: 'poster', name: 'Poster' }, { id: 'broken' }],
    loadManifest: async id => { if (id === 'broken') throw new Error('offline'); return { inputs: [{ id: 'accent', type: 'color', default: INK }] }; },
    systemId: async () => 'beacon',
    ...overrides,
  };
}

test('the index counts distinct sessions and tools inside labelled scopes, and never counts what it did not read', async () => {
  const sources = fakeSources({
    'design:1': designSession(),
    'design:2': { accent: INK, __toolId: 'design' },
    'design:3': { __tokenLinks: { accent: INK } },
    'design:4': new Error('corrupt'),
    '__trash__:design:5': designSession(),
  }, { listTools: async () => [{ id: 'poster', name: 'Poster' }, { id: 'broken' }], loadManifest: async id => { if (id === 'broken') throw new Error('offline'); return { id, inputs: [{ id: 'accent', type: 'color', default: INK }] }; } });
  // The second session stores a bare colour alias; the Design manifest is not in this catalog, so
  // the alias is literal text there. Poster's manifest is read, so its default counts.
  const progress: string[] = [];
  const index = await buildTokenConsumerIndex(sources, { onProgress: (done, total) => progress.push(`${done}/${total}`) });
  assert.deepEqual(index.sessions, { kind: 'local-sessions', available: true, listed: 4, read: 3, skipped: 1, partial: 0 });
  assert.deepEqual(index.tools, { kind: 'mounted-catalog', available: true, listed: 2, read: 1, skipped: 1, partial: 0 });
  assert.equal(progress.at(-1), '6/6');
  const summary = summariseTokenConsumers(index, 'color.brand.ink');
  assert.equal(summary.sessions.following, 1);
  assert.equal(summary.sessions.customOnly, 1);
  assert.equal(summary.sessions.thisSystem, 1);
  assert.equal(summary.sessions.unrecorded, 1);
  assert.equal(summary.tools.matched, 1);
  assert.ok(!summary.uses.some(use => use.id.startsWith('__trash__')), 'hidden slots are not saved work');
  const sentences = tokenConsumerSentences(summary, true).join(' ');
  assert.match(sentences, /link this token directly: 1 of 3 read\./);
  assert.match(sentences, /custom value that remembers this token: 1\./);
  assert.match(sentences, /not read, so not counted: 1\./);
  assert.match(sentences, /Tools in the mounted catalog that name this token directly as a default or example: 1 of 1 read\./);
  assert.match(sentences, /Tools not read, so not counted: 1\./);
  assert.doesNotMatch(sentences, /\ball\b|\bevery\b|\bnone use\b/i);
});

test('the catalog types bare colour aliases in sessions of the same tool', async () => {
  const sources = fakeSources({ 'poster:1': { accent: INK } }, { listSessions: async () => [{ slot: 'poster:1', toolId: 'poster' }] });
  const index = await buildTokenConsumerIndex(sources);
  assert.deepEqual(summariseTokenConsumers(index, 'color.brand.ink').uses.filter(use => use.scope === 'local-sessions').map(use => use.kind), ['linked']);
});

test('counts are direct: a link to an alias counts under the alias, and the scope says so', async () => {
  const sources = fakeSources({ 'design:1': { text: { ref: '{color.text.primary}', value: '#111111' } } }, {
    listTools: async () => [{ id: 'poster', name: 'Poster' }],
    loadManifest: async () => ({ inputs: [{ id: 'accent', type: 'color', default: '{color.text.primary}' }] }),
  });
  const index = await buildTokenConsumerIndex(sources);
  const primitive = summariseTokenConsumers(index, 'color.brand.ink');
  const alias = summariseTokenConsumers(index, 'color.text.primary');
  assert.equal(primitive.sessions.following, 0);
  assert.equal(primitive.tools.matched, 0);
  assert.equal(alias.sessions.following, 1);
  assert.equal(alias.tools.matched, 1);
  const lines = tokenConsumerSentences(primitive, false).join(' ');
  assert.match(lines, /link this token directly: 0 of 1 read\./);
  assert.match(lines, /name this token directly as a default or example: 0 of 1 read\./);
  assert.match(tokenConsumerSectionHtml({ status: 'ready', index, stale: false }, 'color.brand.ink'), /Links to another token that refers to this one are counted under that token\./);
});

test('a source that cannot list is unavailable rather than zero, and limits are reported as skipped', async () => {
  const none = await buildTokenConsumerIndex({ listSessions: async () => { throw new Error('blocked'); }, loadSession: async () => null });
  assert.equal(none.sessions.available, false);
  assert.equal(none.tools.available, false);
  const lines = tokenConsumerSentences(summariseTokenConsumers(none, 'color.brand.ink'), false).join(' ');
  assert.match(lines, /could not be listed, so none are counted/);
  assert.match(lines, /has not loaded on this device, so no tools are counted/);
  const limited = await buildTokenConsumerIndex(fakeSources({ a: {}, b: {}, c: {} }), { limits: { sessions: 2, tools: 1 } });
  assert.equal(limited.sessions.read, 2);
  assert.equal(limited.sessions.skipped, 1);
  assert.equal(limited.tools.skipped, 1);
});

test('cancelling stops the check without producing an index', async () => {
  const controller = new AbortController();
  const sources = fakeSources({ a: {}, b: {} }, { loadSession: async () => { controller.abort(); return {}; } });
  await assert.rejects(buildTokenConsumerIndex(sources, { signal: controller.signal }), (error: Error) => error.name === 'AbortError');
});

test('saving, adding or removing a session makes an index stale; hidden slots do not', async () => {
  const sources = fakeSources({ a: {}, b: {} });
  const index = await buildTokenConsumerIndex(sources);
  assert.equal(await tokenConsumerIndexStale(index, sources), false);
  sources.entries.push({ slot: '__trash__:x', updatedAt: 'later' });
  assert.equal(await tokenConsumerIndexStale(index, sources), false);
  sources.entries[0]!.updatedAt = '2026-10-17T00:00:00Z';
  assert.equal(await tokenConsumerIndexStale(index, sources), true);
});

test('after a check, renders list saved sessions at most once per interval, and not at all once stale', async () => {
  const dom = new JSDOM('<div data-root></div>', { url: 'https://lolly.test/#/start' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  const settle = async (): Promise<void> => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  try {
    const sources = fakeSources({ a: {}, b: {} });
    const list = sources.listSessions!;
    let lists = 0;
    sources.listSessions = async () => { lists++; return list(); };
    const root = dom.window.document.querySelector<HTMLElement>('[data-root]')!;
    const said: string[] = [];
    const check = createTokenConsumerCheck(sources, { root: () => root, announce: message => said.push(message) });
    const render = (): void => { root.innerHTML = check.html('x'); };
    render();
    check.click(root.querySelector<HTMLElement>('[data-tw-consumers-check]')!);
    for (let i = 0; i < 20 && !said.length; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(lists, 1);
    for (let i = 0; i < 5; i++) render();
    await settle();
    assert.equal(lists, 1, 'the check has just listed the sessions');
    mock.timers.tick(TOKEN_CONSUMER_STALE_CHECK_MS);
    render(); render();
    await settle();
    assert.equal(lists, 2, 'one list per interval');
    sources.entries[0]!.updatedAt = '2026-10-17T00:00:00Z';
    render();
    await settle();
    assert.equal(lists, 2, 'still inside the interval');
    mock.timers.tick(TOKEN_CONSUMER_STALE_CHECK_MS);
    render();
    await settle();
    assert.equal(lists, 3);
    assert.match(root.textContent!, /Saved sessions changed after this check/);
    mock.timers.tick(TOKEN_CONSUMER_STALE_CHECK_MS);
    render();
    await settle();
    assert.equal(lists, 3, 'a stale index is not listed again');
    assert.match(root.textContent!, /Saved sessions changed after this check/);
    check.dispose();
  } finally { mock.timers.reset(); dom.window.close(); }
});

test('every section state states its scope, and ready lists the uses it found', async () => {
  for (const state of [{ status: 'idle' as const }, { status: 'cancelled' as const }]) {
    const html = tokenConsumerSectionHtml(state, 'color.brand.ink');
    assert.match(html, /data-tw-consumers-check/);
  }
  assert.match(tokenConsumerSectionHtml({ status: 'idle' }, 'x'), /are not counted\./);
  assert.match(tokenConsumerSectionHtml({ status: 'loading', done: 2, total: 5 }, 'x'), /Checking 2 of 5/);
  assert.match(tokenConsumerSectionHtml({ status: 'cancelled' }, 'x'), /Nothing was counted/);
  const index = await buildTokenConsumerIndex(fakeSources({ 'design:1': designSession() }));
  const ready = tokenConsumerSectionHtml({ status: 'ready', index, stale: true }, 'color.brand.ink');
  assert.match(ready, /Launch poster/);
  assert.match(ready, /<code>boxes\[0\]\.fill<\/code>/);
  assert.match(ready, /Saved sessions changed after this check/);
  assert.match(ready, /are not counted\./);
});

test('the check paints only its section, keeps focus on its button and announces the result', async () => {
  const dom = new JSDOM('<main><button id="other">Other</button><div data-root></div></main>', { url: 'https://lolly.test/#/start' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement });
  try {
    const root = dom.window.document.querySelector<HTMLElement>('[data-root]')!;
    const said: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const check = createTokenConsumerCheck(fakeSources({ 'design:1': designSession() }, { loadSession: async () => { await gate; return designSession(); } }), { root: () => root, announce: message => said.push(message) });
    root.innerHTML = check.html('color.brand.ink');
    root.querySelector<HTMLButtonElement>('[data-tw-consumers-check]')!.focus();
    assert.equal(check.click(root.querySelector<HTMLElement>('[data-tw-consumers-check]')!), true);
    assert.equal(root.querySelector('[data-tw-consumers]')!.getAttribute('aria-busy'), 'true');
    assert.equal(dom.window.document.activeElement, root.querySelector('[data-tw-consumers-cancel]'));
    release();
    for (let i = 0; i < 20 && !said.length; i++) await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(said, ['Saved work check finished.']);
    assert.match(root.textContent!, /link this token directly: 1 of 1 read\./);
    assert.equal(dom.window.document.activeElement, root.querySelector('[data-tw-consumers-check]'));
    // Another token reads the same index without a second check.
    root.innerHTML = check.html('line.body');
    assert.match(root.textContent!, /link this token directly: 1 of 1 read\./);
    assert.equal(check.click(dom.window.document.querySelector<HTMLElement>('#other')!), false);
    check.dispose();
  } finally { dom.window.close(); }
});

test('the web sources read the state bridge, the loaded catalog index and the session design-system stamp', async () => {
  const host = {
    state: {
      list: async () => [{ slot: 's1', toolId: 'design', toolVersion: '1', updatedAt: 'now', designSystem: { id: 'beacon', label: 'Beacon' } }, { slot: 's2', toolId: 'qr', toolVersion: '1', updatedAt: 'now', designSystem: 'junk' }],
      load: async (slot: string) => ({ slot }),
      save: async () => {}, delete: async () => {},
    },
    tokens: { activeRecord: async () => ({ id: 'beacon', label: 'Beacon' }) },
  } as unknown as Pick<HostV1, 'state' | 'tokens'>;
  const requested: string[] = [];
  const sources = webTokenConsumerSources(host, toolId => async path => { requested.push(`${toolId} ${path}`); return JSON.stringify({ id: toolId, inputs: [] }); });
  assert.deepEqual(await sources.listSessions!(), [
    { slot: 's1', toolId: 'design', label: undefined, updatedAt: 'now', designSystem: { id: 'beacon', label: 'Beacon' } },
    { slot: 's2', toolId: 'qr', label: undefined, updatedAt: 'now' },
  ]);
  assert.deepEqual(await sources.loadSession!('s1'), { slot: 's1' });
  assert.equal(await sources.systemId!(), 'beacon');
  const global = globalThis as { __toolIndex?: unknown };
  const previous = global.__toolIndex;
  try {
    delete global.__toolIndex;
    assert.equal(await sources.listTools!(), null);
    // A tool added from a file is merged into the same list, marked `_installed`; it is not catalog scope.
    global.__toolIndex = { tools: [{ id: 'poster', name: 'Poster' }, { id: 'qr' }, { name: 'no id' }, { id: 'side', name: 'Side', _installed: true }] };
    assert.deepEqual(await sources.listTools!(), [{ id: 'poster', name: 'Poster' }, { id: 'qr', name: 'qr' }]);
  } finally { global.__toolIndex = previous; }
  // Manifests are requested in the loader's `<toolId>/tool.json` form, which its signed-catalog fallback needs.
  assert.deepEqual(await sources.loadManifest!('poster'), { id: 'poster', inputs: [] });
  assert.deepEqual(requested, ['poster poster/tool.json']);
});
