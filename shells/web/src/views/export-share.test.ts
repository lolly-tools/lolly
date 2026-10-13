// SPDX-License-Identifier: MPL-2.0
/**
 * views/export-share.ts - the Share deep link a tool mount reads (plan 74).
 *
 * Starting a work collab from the docked Share panel remounts the tool at the address
 * the panel was open at, which still carries `_dialog=share`. The remount read that flag
 * and opened the Share dialog as a modal over the live session. These cases pin the
 * rule (a live collab mount clears the flags and opens nothing) and that the tool view
 * reads the deep link through that rule and nowhere else.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/export-share.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { ToolViewCtx } from './tool/context.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/t/frame' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;

const { clearShareDeepLink, shareDeepLink } = await import('./export-share.ts');
const { replaceRouteUrl, routeParams } = await import('../lib/url-state.ts');
const { WORKSPACE_PARAMS, copyWorkspaceParams } = await import('../lib/tool-url-state.ts');

const flags = (query: string): URLSearchParams => new URLSearchParams(query);

test('no share flag: nothing to do, live or not', () => {
  assert.equal(shareDeepLink(flags(''), false), null);
  assert.equal(shareDeepLink(flags('title=Hi&_dialog=history'), false), null, 'another dialog is not the Share deep link');
  assert.equal(shareDeepLink(flags('_dialog=history'), true), null);
});

test('an ordinary mount reopens the share UI from either flag', () => {
  assert.deepEqual(shareDeepLink(flags('_dialog=share'), false), { kind: 'open' });
  assert.deepEqual(shareDeepLink(flags('share'), false), { kind: 'open' });
  assert.deepEqual(shareDeepLink(flags('share=1&title=Hi'), false), { kind: 'open' });
});

test('a live collab mount opens nothing and clears the flags it found', () => {
  assert.deepEqual(shareDeepLink(flags('title=Hi&_dialog=share'), true), { kind: 'clear', changes: { _dialog: null } });
  assert.deepEqual(shareDeepLink(flags('share'), true), { kind: 'clear', changes: { share: null } });
  assert.deepEqual(shareDeepLink(flags('share&_dialog=share'), true), { kind: 'clear', changes: { share: null, _dialog: null } });
  assert.deepEqual(shareDeepLink(flags('share&_dialog=history'), true), { kind: 'clear', changes: { share: null } },
    'another open dialog keeps its flag');
});

test('a live clear outlasts the mount\'s first address write', () => {
  // The bar the remount runs at, and the mount's own flags read from it (setup.ts: tview.urlFlags).
  dom.window.history.replaceState(null, '', '/t/frame?title=Hi&_dialog=share');
  const urlFlags = routeParams();
  const link = shareDeepLink(urlFlags, true);
  assert.equal(link?.kind, 'clear');
  if (link?.kind === 'clear') clearShareDeepLink(urlFlags, link.changes);
  assert.equal(routeParams().get('_dialog'), null, 'cleared from the bar');
  assert.equal(urlFlags.get('_dialog'), null, 'cleared from the mount\'s flags');

  // views/tool/session.ts syncUrl, first write (barSeq 0): every workspace key the bar
  // lacks comes back from the mount's flags. `_dialog` is one, so a bar-only clear returned.
  assert.ok((WORKSPACE_PARAMS as readonly string[]).includes('_dialog'));
  const live = routeParams();
  for (const key of WORKSPACE_PARAMS) if (!live.has(key) && urlFlags.has(key)) live.set(key, urlFlags.get(key)!);
  const params = new URLSearchParams('title=Hi');
  copyWorkspaceParams(params, live);
  replaceRouteUrl(`/t/frame?${params}`);
  assert.equal(routeParams().get('_dialog'), null, `bar after the first write: ${dom.window.location.href}`);
  assert.equal(routeParams().get('title'), 'Hi');
});

test('the first address write still restores workspace keys from the mount\'s flags', () => {
  // Pins the model in the case above to the real syncUrl.
  const session = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tool', 'session.ts'), 'utf8');
  assert.match(session, /barSeq\.v === 0\) \{\s*for \(const key of WORKSPACE_PARAMS\) \{\s*if \(!live\.has\(key\) && tview\.urlFlags\.has\(key\)\)/);
});

test('the tool view reads the Share deep link only through shareDeepLink, with its collab handle', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const feature = [join(here, 'tool.ts'), ...readdirSync(join(here, 'tool'))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(here, 'tool', f))]
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  assert.match(feature, /shareDeepLink\(urlFlags, !!tview\.collabHandle\)/);
  assert.match(feature, /clearShareDeepLink\(urlFlags, shareLink\.changes\)/, 'the clear reaches the mount\'s flags, not only the bar');
  assert.doesNotMatch(feature, /get\('_dialog'\) === 'share'/, 'no second reader that would open the dialog over a live collab');
});

test('a cold ?share=1 opens after agent guidance and the mounted editor are ready', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const setup = readFileSync(join(here, 'tool', 'setup.ts'), 'utf8');
  const session = readFileSync(join(here, 'tool', 'session.ts'), 'utf8');
  const agents = readFileSync(join(here, 'tool-agent-guidance.ts'), 'utf8');
  assert.deepEqual(shareDeepLink(new URLSearchParams('share=1'), false), { kind: 'open' });
  assert.doesNotMatch(setup, /requestAnimationFrame\(\(\) => showShareDialog/);
  assert.match(session, /await mountToolAgentGuidance\(tview, documentId\)/);
  assert.match(session, /await finishToolAgentShare\(tview, documentId, agentInvitationsReady, \(\) => showShareDialog\(runtime, actionsEl, tview\.tool\.manifest\)\)/);
  assert.match(agents, /await ready;[\s\S]*shareDeepLink\(tview\.urlFlags, !!tview\.collabHandle\)\?\.kind === 'open'[\s\S]*open\(\)/);
});

test('?share=1 waits for the editor promise before opening the mounted Share controller', async () => {
  const { finishToolAgentShare } = await import('./tool-agent-guidance.ts');
  const viewEl = document.createElement('main'); const actionsEl = document.createElement('div');
  viewEl.append(actionsEl); document.body.replaceChildren(viewEl);
  let opened = 0;
  actionsEl.addEventListener('lolly:share-open', event => { event.preventDefault(); opened++; });
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>(done => { resolveReady = done; });
  const tview = { viewEl, actionsEl, mountLifecycle: { disposed: false }, urlFlags: flags('share=1'), runtime: {}, tool: { manifest: {} } } as unknown as ToolViewCtx;
  const pending = finishToolAgentShare(tview, 'doc:startup', ready, () => {
    actionsEl.dispatchEvent(new CustomEvent('lolly:share-open', { cancelable: true }));
  });
  await new Promise(done => setImmediate(done));
  assert.equal(opened, 0, 'the startup request cannot create an early generic modal');
  resolveReady(); await pending;
  assert.equal(opened, 1, 'the ready request reaches the mounted dock controller');
  viewEl.remove();
});
