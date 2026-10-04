// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-session-origin.ts rule 4: a team document's origin survives a RELOAD of the
 * tab, and nothing else (plan 74, W-SHARE-UI).
 *
 * The one-shot and per-tool rules are proved in team-session-origin.test.ts; this file
 * proves the mirror: written while an origin is live, read back once by the first mount
 * of a page load and only for its own tool, removed whenever the origin ends inside the
 * page, kept only through the release that happens while the page unloads. It also
 * covers the two ways a save moves the origin (a new revision, a newly saved document)
 * and storage that refuses to work.
 *
 * Kept in its own file, beside rather than inside the existing suite, so it cannot
 * collide with work on that suite's jsdom harness.
 *
 * Run directly:  node --test shells/web/src/org/team-session-origin-reload.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/#/tool/qr-code' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
const realStorage = dom.window.sessionStorage;
globalThis.sessionStorage = realStorage;

const {
  rememberTeamSessionOrigin, consumeTeamSessionOrigin, activeTeamSessionOrigin, releaseTeamSessionOrigin,
  adoptTeamSessionOrigin, noteTeamSessionSaved, TEAM_ORIGIN_STORAGE_KEY,
  carryTeamSessionOriginToRemount, teamOriginGeneration,
  _clearTeamSessionOriginForTests, _simulateReloadForTests,
} = await import('./team-session-origin.ts');

const ORIGIN = { sessionId: 'sess-1', toolId: 'qr-code', projectId: 'proj-9', rev: 3, label: 'Cover' };
const HOME = '#/tool/qr-code';
/** The mirror's origin fields (the address it was written at is checked on its own). */
const mirror = (): unknown => {
  const raw = realStorage.getItem(TEAM_ORIGIN_STORAGE_KEY);
  if (!raw) return null;
  const { hash: _hash, ...origin } = JSON.parse(raw) as Record<string, unknown>;
  return origin;
};
/** What a page load does to this module: the page unloads (teardown may release), then
 *  a fresh module state starts. `type` is the browser's navigation type for the new
 *  load: 'reload' for a reload, 'navigate' for a bookmark, a typed address or a link. */
function reload(type: 'reload' | 'navigate' | 'back_forward' = 'reload'): void {
  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  releaseTeamSessionOrigin();
  _simulateReloadForTests(type);
}
function at(hash: string): void {
  dom.window.history.replaceState(null, '', hash);
}

test('a live origin is mirrored, with its revision and label', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  assert.deepEqual(mirror(), ORIGIN);
});

test('a reload restores it for the first mount of the same tool', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  reload();
  assert.deepEqual(mirror(), ORIGIN, 'the unload release keeps the mirror');
  assert.deepEqual(consumeTeamSessionOrigin('qr-code'), ORIGIN);
  assert.deepEqual(activeTeamSessionOrigin('qr-code'), ORIGIN);
});

test('after the restore, a remount gets nothing (rule 2 still holds)', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  reload();
  consumeTeamSessionOrigin('qr-code');
  releaseTeamSessionOrigin();
  assert.equal(consumeTeamSessionOrigin('qr-code'), null);
  assert.equal(mirror(), null);
});

test('a reload whose first mount is another tool restores nothing, then or later', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  reload();
  assert.equal(consumeTeamSessionOrigin('street-map'), null);
  assert.equal(mirror(), null, 'navigating to a different tool clears it');
  assert.equal(consumeTeamSessionOrigin('qr-code'), null);
});

test('leaving the tool inside the page clears the mirror, so a later reload restores nothing', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  releaseTeamSessionOrigin(); // teardown on the way to Projects, no unload
  assert.equal(mirror(), null);
  _simulateReloadForTests(); // reload while on Projects
  assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'a local session of the same tool is not a team document');
});

test('a page back from the back/forward cache counts its releases again', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  dom.window.dispatchEvent(new dom.window.Event('pageshow'));
  releaseTeamSessionOrigin();
  assert.equal(mirror(), null);
});

test('a new document (any unarmed mount) ends the origin', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  releaseTeamSessionOrigin();
  consumeTeamSessionOrigin('qr-code'); // "+ New" in the same tool
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
  assert.equal(mirror(), null);
});

test('noteTeamSessionSaved moves the live origin to the new revision, and only for its session', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  noteTeamSessionSaved('other-session', 99);
  assert.equal(activeTeamSessionOrigin('qr-code')?.rev, 3);
  noteTeamSessionSaved('sess-1', 4, 'Cover v2');
  assert.deepEqual(activeTeamSessionOrigin('qr-code'), { ...ORIGIN, rev: 4, label: 'Cover v2' });
  assert.deepEqual(mirror(), { ...ORIGIN, rev: 4, label: 'Cover v2' });
});

test('adoptTeamSessionOrigin makes a just-saved document a team document', () => {
  _clearTeamSessionOriginForTests();
  consumeTeamSessionOrigin('qr-code'); // an ordinary local mount
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
  const adopted = adoptTeamSessionOrigin({ sessionId: 'new-1', toolId: 'qr-code', projectId: 'p1', rev: 1 });
  assert.deepEqual(adopted, { sessionId: 'new-1', toolId: 'qr-code', projectId: 'p1', rev: 1 });
  assert.deepEqual(activeTeamSessionOrigin('qr-code'), adopted);
  assert.deepEqual(mirror(), adopted);
  assert.equal(adoptTeamSessionOrigin({ sessionId: ' ', toolId: 'qr-code' }), null, 'a blank id adopts nothing');
  assert.deepEqual(activeTeamSessionOrigin('qr-code'), adopted);
});

test('a malformed mirror restores nothing', () => {
  _clearTeamSessionOriginForTests();
  realStorage.setItem(TEAM_ORIGIN_STORAGE_KEY, '{not json');
  assert.equal(consumeTeamSessionOrigin('qr-code'), null);
  _clearTeamSessionOriginForTests();
  realStorage.setItem(TEAM_ORIGIN_STORAGE_KEY, JSON.stringify({ toolId: 'qr-code' }));
  assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'no session id, no origin');
});

test('storage that throws never breaks the in-page origin', () => {
  _clearTeamSessionOriginForTests();
  const boom = (): never => { throw new Error('blocked'); };
  globalThis.sessionStorage = { getItem: boom, setItem: boom, removeItem: boom } as unknown as Storage;
  try {
    rememberTeamSessionOrigin(ORIGIN);
    assert.deepEqual(consumeTeamSessionOrigin('qr-code'), ORIGIN);
    noteTeamSessionSaved('sess-1', 5);
    assert.equal(activeTeamSessionOrigin('qr-code')?.rev, 5);
    assert.doesNotThrow(() => releaseTeamSessionOrigin());
    _simulateReloadForTests();
    assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'nothing to restore, and no throw');
  } finally {
    globalThis.sessionStorage = realStorage;
  }
});

// ── Only a reload of the same address restores (review finding: any page load did) ──

test('a fresh page load in the same tab restores nothing, even for the same tool', () => {
  _clearTeamSessionOriginForTests();
  at(HOME);
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  reload('navigate'); // a bookmark to the app, a typed address, a docs link
  assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'a new document is not the team session');
  assert.equal(mirror(), null, 'and the mirror is gone');
});

test('a reload whose first tool mount is another address of that tool restores nothing', () => {
  _clearTeamSessionOriginForTests();
  at('#/tool/qr-code?text=team');
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  reload();
  at(HOME); // a blank document of the same tool
  assert.equal(consumeTeamSessionOrigin('qr-code'), null);
  assert.equal(mirror(), null);
  at(HOME);
});

test('back to the same address from another page restores it', () => {
  _clearTeamSessionOriginForTests();
  at('#/tool/qr-code?text=team');
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  reload('back_forward');
  assert.deepEqual(consumeTeamSessionOrigin('qr-code'), ORIGIN);
  at(HOME);
});

test('the mirror follows the address while the document is edited', () => {
  _clearTeamSessionOriginForTests();
  at('#/tool/qr-code?text=a');
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  at('#/tool/qr-code?text=ab');
  dom.window.dispatchEvent(new dom.window.Event('lolly:url-state'));
  assert.equal((JSON.parse(realStorage.getItem(TEAM_ORIGIN_STORAGE_KEY)!) as { hash: string }).hash, '#/tool/qr-code?text=ab');
  reload();
  assert.deepEqual(consumeTeamSessionOrigin('qr-code'), ORIGIN);
  at(HOME);
});

test('a stash armed for one address is not spent by a mount at another', () => {
  _clearTeamSessionOriginForTests();
  at(HOME);
  rememberTeamSessionOrigin(ORIGIN, { hash: '#/tool/qr-code?text=theirs' });
  assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'the navigation it was armed for never happened');
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
});

test('a stash matches its address despite encoding, order and view-only params', () => {
  _clearTeamSessionOriginForTests();
  rememberTeamSessionOrigin(ORIGIN, { hash: '#/tool/qr-code?b=2&a=hello%20world' });
  at('#/tool/qr-code?a=hello+world&b=2&_panel=export');
  assert.deepEqual(consumeTeamSessionOrigin('qr-code'), ORIGIN);
  at(HOME);
});

// ── An in-app remount of the same document, and a save that resolves late ─────────

test('a carried origin survives an in-app remount of the same document', () => {
  _clearTeamSessionOriginForTests();
  at(HOME);
  rememberTeamSessionOrigin(ORIGIN);
  consumeTeamSessionOrigin('qr-code');
  carryTeamSessionOriginToRemount('qr-code');
  releaseTeamSessionOrigin(); // the teardown of the forced remount
  assert.deepEqual(consumeTeamSessionOrigin('qr-code'), ORIGIN);
  carryTeamSessionOriginToRemount('street-map');
  releaseTeamSessionOrigin();
  assert.equal(consumeTeamSessionOrigin('qr-code'), null, 'only the live tool is carried');
});

test('the tool view carries the origin before its design-system Reload remounts', () => {
  const src = readFileSync(new URL('../views/tool/design-system.ts', import.meta.url), 'utf8');
  const reloadAt = src.indexOf("'#ds-switched-reload'");
  const carryAt = src.indexOf('carryTeamSessionOriginToRemount', reloadAt);
  const remountAt = src.indexOf("'lolly:remount'", reloadAt);
  assert.ok(reloadAt > 0 && carryAt > reloadAt && carryAt < remountAt, 'carry, then remount');
});

test('a save that resolves after the next mount adopts nothing', () => {
  _clearTeamSessionOriginForTests();
  consumeTeamSessionOrigin('qr-code');
  const generation = teamOriginGeneration();
  consumeTeamSessionOrigin('qr-code'); // the person moved to another document of the tool
  assert.equal(adoptTeamSessionOrigin({ sessionId: 'late', toolId: 'qr-code', rev: 1 }, { generation }), null);
  assert.equal(activeTeamSessionOrigin('qr-code'), null);
  assert.equal(mirror(), null);
});

test('a reload through a tool preview redirect restores only the same pretty tool address', () => {
  _clearTeamSessionOriginForTests();
  dom.window.history.replaceState(null, '', '/t/qr-code?text=team');
  rememberTeamSessionOrigin(ORIGIN); consumeTeamSessionOrigin('qr-code');
  reload('navigate');
  realStorage.setItem('lolly:tool-reload', JSON.stringify({ toolId: 'qr-code', type: 'reload', address: '/t/qr-code?text=team', at: Date.now() }));
  dom.window.history.replaceState(null, '', '/#/tool/qr-code?text=team');
  assert.deepEqual(consumeTeamSessionOrigin('qr-code'), ORIGIN);
  assert.equal(realStorage.getItem('lolly:tool-reload'), null, 'the redirect hint is spent once');
  at(HOME);
});
test('a preview redirect cannot restore an origin at a different document address', () => {
  _clearTeamSessionOriginForTests();
  dom.window.history.replaceState(null, '', '/t/qr-code?text=team');
  rememberTeamSessionOrigin(ORIGIN); consumeTeamSessionOrigin('qr-code'); reload('navigate');
  realStorage.setItem('lolly:tool-reload', JSON.stringify({ toolId: 'qr-code', type: 'reload', address: '/t/qr-code?text=team', at: Date.now() }));
  dom.window.history.replaceState(null, '', '/#/tool/qr-code?text=local');
  assert.equal(consumeTeamSessionOrigin('qr-code'), null); assert.equal(mirror(), null);
  at(HOME);
});
