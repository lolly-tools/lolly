// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-origin-durable.ts and rule 6 of org/team-session-origin.ts: a device copy of
 * a team document is the team document again after a restart (plan 75 J6 step 2, G17),
 * for the same account on the same workspace only.
 *
 * The store runs on a Map here (jsdom has no IndexedDB); everything above it is real:
 * the identity read from the org-config cache org/index.ts keeps, the pruning, and the
 * origin module writing the record when automatic history puts a slot in the address
 * and restoring it when that slot is opened after a restart.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/org/team-origin-durable.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://instance.test/#/tool/poster' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.sessionStorage = dom.window.sessionStorage;
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (local.has(k) ? local.get(k)! : null),
  setItem: (k: string, v: string) => { local.set(k, String(v)); },
  removeItem: (k: string) => { local.delete(k); },
  clear: () => local.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

const durable = await import('./team-origin-durable.ts');
type Rec = import('./team-origin-durable.ts').DurableTeamOrigin;
const origin = await import('./team-session-origin.ts');
const { _setBaseForTests } = await import('../lib/instance.ts');

const rows = new Map<string, Rec>();
durable._setDurableBackendForTests({
  get: async (key) => rows.get(key),
  put: async (rec) => { rows.set(rec.key, rec); },
  delete: async (key) => { rows.delete(key); },
  all: async () => [...rows.values()],
  clear: async () => { rows.clear(); },
});

/** The account as a record stores it: never the id, a digest bound to the workspace. */
const digest = (workspace: string, sub: string): string => createHash('sha256').update(`lolly-team-origin\n${workspace}\n${sub}`).digest('hex');

const ORIGIN = { sessionId: 'sess-1', toolId: 'poster', projectId: 'proj-9', rev: 3, label: 'Spring poster', role: 'editor' as const };
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 20));

/** Sign `account` in to the workspace at `base` ('' = this origin), as org/index.ts
 *  leaves it on the device: the org-config cache with its session block. */
function signIn(account: string, base = '', shape: 'flat' | 'member' = 'flat'): void {
  _setBaseForTests(base);
  const scope = base || 'same-origin';
  local.delete(`lolly:signed-out:${scope}`);
  const session = shape === 'flat' ? { sub: account, email: `${account}@example.test` } : { kind: 'member', user: { sub: account } };
  local.set(`lolly:org-config:${scope}`, JSON.stringify({ at: Date.now(), etag: null, config: { instance: { name: 'lolly.ing' }, session } }));
}
/** What org/index.ts signOutOfInstance leaves behind. */
function signOut(base = ''): void {
  const scope = base || 'same-origin';
  local.delete(`lolly:org-config:${scope}`);
  local.set(`lolly:signed-out:${scope}`, '1');
}
function reset(): void {
  rows.clear();
  local.clear();
  _setBaseForTests('');
  origin._clearTeamSessionOriginForTests();
}
function at(address: string): void {
  dom.window.history.replaceState(null, '', address);
}

test('the identity is the signed-in member of this workspace, from the org-config cache', async () => {
  reset();
  assert.equal(await durable.durableIdentity(), null, 'nobody signed in');
  signIn('ana');
  assert.deepEqual(await durable.durableIdentity(), { workspace: 'https://instance.test', account: digest('https://instance.test', 'ana') });
  signIn('ana', '', 'member');
  assert.deepEqual(await durable.durableIdentity(), { workspace: 'https://instance.test', account: digest('https://instance.test', 'ana') }, 'either session shape');
  signOut();
  assert.equal(await durable.durableIdentity(), null, 'a sign-out ends it');
  signIn('ana', 'https://work.example');
  assert.deepEqual(await durable.durableIdentity(), { workspace: 'https://work.example', account: digest('https://work.example', 'ana') }, 'a remote workspace is its base');
});

test('a record never holds the account id: a dev or proxy id can carry an address', async () => {
  reset();
  signIn('dev:ana@example.test');
  assert.equal(await durable.rememberDurableTeamOrigin({ ...ORIGIN, slot: 'poster:1' }), true);
  const [rec] = [...rows.values()];
  assert.match(rec!.account, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(rec).includes('ana@example.test'), 'no address anywhere in the record');
  assert.equal((await durable.findDurableTeamOrigin('poster', 'poster:1'))?.sessionId, 'sess-1', 'and the same member still finds it');
});

test('dropping the records empties the store and the mark, without any copy being opened', async () => {
  reset();
  signIn('ana');
  await durable.rememberDurableTeamOrigin({ ...ORIGIN, slot: 'poster:1' });
  await durable.rememberDurableTeamOrigin({ ...ORIGIN, sessionId: 'sess-2', slot: 'poster:2' });
  assert.equal(rows.size, 2);
  assert.equal(durable.mayHoldDurableTeamOrigins(), true);
  await durable.dropDurableTeamOrigins();
  assert.equal(rows.size, 0, 'every record is gone at once');
  assert.equal(durable.mayHoldDurableTeamOrigins(), false, 'and the mark');
});

test('a role this shell does not know keeps no record (it fails closed)', async () => {
  reset();
  signIn('ana');
  for (const role of ['commenter', 'viewer', 'reviewer']) {
    assert.equal(await durable.rememberDurableTeamOrigin({ ...ORIGIN, role: role as 'viewer', slot: `poster:${role}` }), false, role);
  }
  assert.equal(rows.size, 0);
  assert.equal(await durable.rememberDurableTeamOrigin({ ...ORIGIN, role: undefined, slot: 'poster:1' }), true, 'an absent role is unknown, not view-only');
});

test('a record is kept for its slot and found again by the same member', async () => {
  reset();
  signIn('ana');
  assert.equal(durable.mayHoldDurableTeamOrigins(), false);
  assert.equal(await durable.rememberDurableTeamOrigin({ ...ORIGIN, slot: 'poster:1' }), true);
  assert.equal(durable.mayHoldDurableTeamOrigins(), true, 'the mark says to look');
  const found = await durable.findDurableTeamOrigin('poster', 'poster:1');
  assert.equal(found?.sessionId, 'sess-1');
  assert.equal(found?.rev, 3, 'the revision it was opened at');
  assert.equal(await durable.findDurableTeamOrigin('chart', 'poster:1'), null, 'never for another tool');
  assert.equal(await durable.findDurableTeamOrigin('poster', 'poster:2'), null, 'never for another copy');
});

test('a viewer\'s copy is never kept, and nothing is kept without a member', async () => {
  reset();
  signIn('lee');
  assert.equal(await durable.rememberDurableTeamOrigin({ ...ORIGIN, role: 'viewer', slot: 'poster:1' }), false);
  signOut();
  assert.equal(await durable.rememberDurableTeamOrigin({ ...ORIGIN, slot: 'poster:1' }), false);
  assert.equal(rows.size, 0);
});

test('another account on this device finds nothing, and the record is dropped', async () => {
  reset();
  signIn('ana');
  await durable.rememberDurableTeamOrigin({ ...ORIGIN, slot: 'poster:1' });
  signIn('lee');
  assert.equal(await durable.findDurableTeamOrigin('poster', 'poster:1'), null, 'Lee never gets Ana\'s team origin');
  assert.equal(rows.size, 0, 'dropped once found under another account');
  assert.equal(durable.mayHoldDurableTeamOrigins(), false, 'and the mark with it');
  signIn('ana');
  assert.equal(await durable.findDurableTeamOrigin('poster', 'poster:1'), null, 'gone for Ana too: an account change ends it');
});

test('a sign-out drops every record of the workspace', async () => {
  reset();
  signIn('ana');
  await durable.rememberDurableTeamOrigin({ ...ORIGIN, slot: 'poster:1' });
  await durable.rememberDurableTeamOrigin({ ...ORIGIN, sessionId: 'sess-2', slot: 'poster:2' });
  signOut();
  assert.equal(await durable.findDurableTeamOrigin('poster', 'poster:1'), null);
  assert.equal(rows.size, 0);
});

test('a record is never used for a different workspace origin', async () => {
  reset();
  signIn('ana', 'https://work.example');
  await durable.rememberDurableTeamOrigin({ ...ORIGIN, slot: 'poster:1' });
  signIn('ana', 'https://other.example');
  assert.equal(await durable.findDurableTeamOrigin('poster', 'poster:1'), null, 'same account, other workspace');
  assert.equal(rows.size, 0, 'Leave or a switch drops it');
});

test('end to end: the device copy is the team document again after a restart', async () => {
  reset();
  signIn('ana');
  at('#/tool/poster?headline=Hi');
  origin.rememberTeamSessionOrigin(ORIGIN, { hash: '#/tool/poster?headline=Hi' });
  assert.equal(origin.consumeTeamSessionOrigin('poster')?.sessionId, 'sess-1');
  // Automatic history makes the device creation and puts its slot in the address.
  at('#/tool/poster?headline=Hello&slot=poster%3A1');
  dom.window.dispatchEvent(new dom.window.Event('lolly:url-state'));
  await origin._flushDurableForTests();
  assert.equal(rows.size, 1, 'the copy\'s origin is kept');
  origin.noteTeamSessionSaved('sess-1', 4);
  await origin._flushDurableForTests();
  assert.equal([...rows.values()][0]?.rev, 4, 'a save moves the kept revision too');

  // Quit and restart: a new page load, an empty tab, the copy opened from Projects.
  dom.window.sessionStorage.clear();
  origin._simulateReloadForTests('navigate');
  at('#/tool/poster?slot=poster%3A1');
  assert.equal(origin.consumeTeamSessionOrigin('poster'), null, 'nothing armed: the mount starts as a device document');
  await settle();
  const back = origin.activeTeamSessionOrigin('poster');
  assert.equal(back?.sessionId, 'sess-1', 'then its durable origin comes back');
  assert.equal(back?.rev, 4, 'at the revision of its last save, so Save quotes it');
  assert.equal(back?.role, 'editor');
});

test('end to end: another account opening the same copy gets a device document', async () => {
  reset();
  signIn('ana');
  at('#/tool/poster?headline=Hi');
  origin.rememberTeamSessionOrigin(ORIGIN, { hash: '#/tool/poster?headline=Hi' });
  origin.consumeTeamSessionOrigin('poster');
  at('#/tool/poster?headline=Hi&slot=poster%3A1');
  dom.window.dispatchEvent(new dom.window.Event('lolly:url-state'));
  await origin._flushDurableForTests();
  signIn('lee');
  dom.window.sessionStorage.clear();
  origin._simulateReloadForTests('navigate');
  at('#/tool/poster?slot=poster%3A1');
  origin.consumeTeamSessionOrigin('poster');
  await settle();
  assert.equal(origin.activeTeamSessionOrigin('poster'), null, 'Save never writes to Ana\'s project as Lee');
});

test('making the copy one\'s own forgets the durable origin', async () => {
  reset();
  signIn('ana');
  at('#/tool/poster?headline=Hi&slot=poster%3A1');
  origin.rememberTeamSessionOrigin(ORIGIN);
  origin.consumeTeamSessionOrigin('poster');
  await origin._flushDurableForTests();
  assert.equal(rows.size, 1);
  origin.detachTeamSessionOrigin('poster');
  await origin._flushDurableForTests();
  assert.equal(origin.activeTeamSessionOrigin('poster'), null);
  assert.equal(rows.size, 0);
});

test('the origin module reads the durable mark by the same key, without loading the store', () => {
  assert.equal(durable.DURABLE_MARK_KEY, 'lolly:team-origins');
  const src = readFileSync(resolve(import.meta.dirname, 'team-session-origin.ts'), 'utf8');
  assert.match(src, /const DURABLE_MARK = 'lolly:team-origins';/);
  assert.doesNotMatch(src, /^import .*team-origin-durable/m, 'the store is loaded lazily, never statically');
  assert.doesNotMatch(src, /^import .*team-scope/m, 'and so is the scope provider');
});
