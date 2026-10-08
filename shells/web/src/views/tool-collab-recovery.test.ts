// SPDX-License-Identifier: MPL-2.0
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { retainCanvasRecovery, canvasRecoveryValues } from '../lib/canvas-recovery.ts';
import { _resetNotificationsForTests, dismissNotification, notificationEntries } from '../lib/notifications.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { _resetRecoveryCopiesForTests, mountCollabRecovery, RECOVERY_MAX_AGE_MS } from './tool-collab-recovery.ts';
import { RECOVERY_OWNER_KEY, recoveryOwner } from '../lib/collab-recovery-owner.ts';

beforeEach(() => { _resetNotificationsForTests(); _resetRecoveryCopiesForTests(); });
const WORKSPACE = 'https://lolly.ing';
const flush = async (turns = 6): Promise<void> => { for (let i = 0; i < turns; i++) await new Promise(resolve => setImmediate(resolve)); };
/** The earlier-copies scan starts on a 0 ms timer: wait for timers first, or a fast machine flushes before the scan has begun. */
const scanned = async (): Promise<void> => { await new Promise(resolve => setTimeout(resolve, 0)); await flush(12); };
const workspaceDom = (html = '<div></div>') => new JSDOM(html, { url: `${WORKSPACE}/` });
const byText = (root: ParentNode, text: string) => [...root.querySelectorAll('button')].find(button => button.textContent === text);
/** A device library with the four state calls the recovery view uses. */
function library(entries: Array<[string, object]> = []) {
  const saved = new Map<string, object>(entries);
  const host = { state: {
    load: async (slot: string) => saved.get(slot) ?? null,
    save: async (slot: string, value: object) => { saved.set(slot, value); },
    delete: async (slot: string) => { saved.delete(slot); },
    list: async () => [...saved.keys()].map(slot => ({ slot, toolId: 'design', toolVersion: '1', updatedAt: new Date().toISOString() })),
  } } as unknown as HostV1;
  return { saved, host };
}
const owned = (account: string, ageMs: number, origin = WORKSPACE) =>
  ({ __toolId: 'design', title: 'Copy', [RECOVERY_OWNER_KEY]: { origin, account, at: new Date(Date.now() - ageMs).toISOString() } });
/** Capture what Open recovery copy asks the router for, without a browser. */
function captureNavigation(): { hrefs: string[]; restore(): void } {
  const hrefs: string[] = [], previous = { location: globalThis.location, window: globalThis.window };
  const location = { set hash(value: string) { hrefs.push(value); }, get hash() { return hrefs.at(-1) ?? ''; } };
  Object.assign(globalThis, { location, window: { dispatchEvent: (event: Event) => { hrefs.push(`event:${event.type}`); return true; } } });
  return { hrefs, restore: () => { Object.assign(globalThis, previous); } };
}

test('interrupted work saves to a new device slot without changing the shared canvas or an earlier save', async () => {
  const dom = workspaceDom('<div id="stage"><div id="canvas">Team canvas</div></div>');
  const stage = dom.window.document.getElementById('stage')!, canvas = dom.window.document.getElementById('canvas')!;
  const { saved, host } = library([['earlier', { title: 'Earlier device save' }]]), runtime = {};
  const ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design', title: 'Shared title' }, label: 'Design' }), () => 'u1');
  try {
    retainCanvasRecovery(runtime, { title: 'Interrupted local title' }, 'Interrupted text', 'draft-one');
    await flush();
    const { [RECOVERY_OWNER_KEY]: owner, ...copy } = saved.get('collab-recovery:draft-one') as Record<string, unknown>;
    assert.deepEqual(copy, { __toolId: 'design', title: 'Interrupted local title', __label: 'Design · Interrupted text' });
    assert.deepEqual({ ...recoveryOwner({ [RECOVERY_OWNER_KEY]: owner }), at: 'at' }, { origin: WORKSPACE, account: 'u1', at: 'at' });
    assert.deepEqual(saved.get('earlier'), { title: 'Earlier device save' });
    assert.equal(canvas.outerHTML, '<div id="canvas">Team canvas</div>');
    assert.match(stage.querySelector('[role="status"]')!.textContent!, /saved on this device/);
    assert.equal(byText(stage, 'Open recovery copy')!.hidden, false);
    retainCanvasRecovery(runtime, { title: 'Different value' }, 'Interrupted text', 'draft-one');
    assert.equal((saved.get('collab-recovery:draft-one') as { title: string }).title, 'Interrupted local title');
    ui.teardown(); assert.equal(stage.querySelector('.collab-recovery'), null);
  } finally { ui.teardown(); dom.window.close(); }
});

test('a device quota failure keeps the downloadable draft, never says saved and offers no copy to open', async () => {
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!;
  const downloads: Array<{ name: string; value: Record<string, unknown> }> = [];
  const host = { state: { load: async () => null, save: async () => { throw new Error('quota'); } },
    export: { download: async (blob: Blob, name: string) => { downloads.push({ name, value: JSON.parse(await blob.text()) }); } } } as unknown as HostV1;
  const runtime = {}, ui = mountCollabRecovery(runtime, host, stage, () => ({ state: {} }), () => 'u1');
  try {
    retainCanvasRecovery(runtime, { title: 'Keep this' }, 'Interrupted text');
    await flush();
    assert.match(stage.querySelector('[role="status"]')!.textContent!, /could not be saved/);
    assert.equal(byText(stage, 'Open recovery copy')!.hidden, true);
    const queued = notificationEntries().find(entry => entry.id.endsWith(':unsaved'))!;
    assert.equal(queued.action?.label, 'Download recovery copy');
    byText(stage, 'Download recovery copy')!.click();
    await flush();
    assert.equal(downloads[0]!.name, 'lolly-recovery.json');
    assert.equal(downloads[0]!.value.title, 'Keep this');
    assert.equal(RECOVERY_OWNER_KEY in downloads[0]!.value, false, 'the account binding stays on this device');
  } finally { ui.teardown(); dom.window.close(); }
});

test('an archived projection restores declared row IDs and keeps compound fields without resurrecting deleted rows', () => {
  const model = [{ id: 'boxes', type: 'blocks', canvas: { idField: 'uid' }, fields: [{ id: 'uid' }], value: [{ uid: 'one', x: 5, effect: { blur: 2 } }, { uid: 'gone', x: 5 }] },
    { id: 'title', type: 'text', value: 'Current' }] as InputModelItem[];
  const origin = { client: 'seed', clock: 0 };
  const values = canvasRecoveryValues(model, [
    { k: 'add', col: 'boxes', id: 'one', row: { x: 90 }, orderKey: 'a', origin }, { k: 'param', key: 'title', value: 'Draft', origin },
  ]);
  assert.deepEqual(values, { title: 'Draft', boxes: [{ uid: 'one', x: 90, effect: { blur: 2 } }] });
  assert.equal((model[0]!.value as { x: number }[])[0]!.x, 5);
});

test('a stored recovery notice stays until the person dismisses it, with a queued Open recovery copy', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!, runtime = {};
  const { saved, host } = library();
  const ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }), () => 'u1');
  const nav = captureNavigation();
  try {
    retainCanvasRecovery(runtime, { title: 'Keep me' }, 'Interrupted text', 'brief');
    await flush();
    const notice = stage.querySelector<HTMLElement>('.collab-recovery')!;
    t.mock.timers.tick(10 * 60_000); assert.equal(notice.hidden, false); assert.ok(saved.has('collab-recovery:brief'));
    const queued = notificationEntries().find(entry => entry.id === 'collab-recovery:brief')!;
    assert.equal(queued.dismissed, false);
    assert.equal(queued.body, 'Your interrupted edit is saved as a separate copy on this device. Accepted changes are already in the shared document.');
    assert.equal(queued.action?.label, 'Open recovery copy');
    await queued.action!.run!();
    assert.deepEqual(nav.hrefs, ['#/tool/design?slot=collab-recovery%3Abrief', 'event:lolly:remount']);
    byText(stage, 'Open recovery copy')!.click();
    await flush();
    assert.deepEqual(nav.hrefs.slice(2), ['#/tool/design?slot=collab-recovery%3Abrief', 'event:lolly:remount'], 'the stage notice opens the same copy');
    byText(stage, 'Dismiss')!.click();
    assert.equal(notice.hidden, true);
    assert.equal(notificationEntries().find(entry => entry.id === 'collab-recovery:brief')!.dismissed, true);
    ui.teardown();
    assert.equal(notificationEntries().find(entry => entry.id === 'collab-recovery:brief')?.dismissed, true, 'a dismissed copy stays dismissed in the queue');
  } finally { nav.restore(); ui.teardown(); dom.window.close(); }
});

test('a saved copy stays in the queue after the document closes, offering Open and Download, until dismissed', async () => {
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!, runtime = {};
  const { saved, host } = library(), downloads: Array<Record<string, unknown>> = [];
  Object.assign(host, { export: { download: async (blob: Blob) => { downloads.push(JSON.parse(await blob.text())); } } });
  let ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }), () => 'u1');
  const nav = captureNavigation();
  try {
    retainCanvasRecovery(runtime, { title: 'Keep me' }, 'Interrupted text', 'kept');
    await flush();
    ui.teardown();
    const queued = notificationEntries().find(entry => entry.id === 'collab-recovery:kept')!;
    assert.equal(queued.dismissed, false, 'leaving the document does not withdraw the notice');
    assert.equal(queued.action?.label, 'Open recovery copy'); assert.equal(queued.secondary?.label, 'Download recovery copy');
    await queued.secondary!.run();
    assert.equal(downloads[0]!.title, 'Keep me'); assert.equal(RECOVERY_OWNER_KEY in downloads[0]!, false);
    await queued.action!.run!();
    assert.deepEqual(nav.hrefs, ['#/tool/design?slot=collab-recovery%3Akept', 'event:lolly:remount'], 'the copy opens after the document closed');
    // The next live document belongs to another account: the copy is no longer listed or opened.
    ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }), () => 'u2');
    assert.equal(notificationEntries().some(entry => entry.id === 'collab-recovery:kept'), false);
    assert.ok(saved.has('collab-recovery:kept'), 'the copy itself stays on the device');
    ui.teardown();
    ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }), () => 'u1');
    dismissNotification('collab-recovery:kept');
    assert.equal(notificationEntries().find(entry => entry.id === 'collab-recovery:kept')?.dismissed, true);
  } finally { nav.restore(); ui.teardown(); dom.window.close(); }
});

test('a copy with no known tool offers Download as its action', async () => {
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!, runtime = {};
  const { host } = library([['collab-recovery:loose', { title: 'Loose', [RECOVERY_OWNER_KEY]: owned('u1', 60_000)[RECOVERY_OWNER_KEY] }]]);
  const ui = mountCollabRecovery(runtime, host, stage, () => ({ state: {} }), () => 'u1');
  try {
    await scanned();
    const queued = notificationEntries().find(entry => entry.id === 'collab-recovery:loose')!;
    assert.equal(queued.action?.label, 'Download recovery copy'); assert.equal(queued.secondary, undefined);
  } finally { ui.teardown(); dom.window.close(); }
});

test('dismissing the queued notice closes the stage notice, and a replayed copy stays closed', async () => {
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!, runtime = {};
  const { host } = library();
  let ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }), () => 'u1');
  try {
    retainCanvasRecovery(runtime, { title: 'Keep me' }, 'Interrupted text', 'replayed');
    await flush();
    dismissNotification('collab-recovery:replayed');
    assert.equal(stage.querySelector<HTMLElement>('.collab-recovery')!.hidden, true);
    ui.teardown();
    ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }), () => 'u1');
    await flush();
    assert.equal(stage.querySelector<HTMLElement>('.collab-recovery')!.hidden, true);
  } finally { ui.teardown(); dom.window.close(); }
});

test('storage retries automatically and keeps the notice after the retry safely saves the draft', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!, runtime = {};
  let attempts = 0, stored: unknown;
  const host = { state: { load: async () => stored, save: async (_id: string, value: unknown) => { if (++attempts === 1) throw Error('temporary'); stored = value; } } } as unknown as HostV1;
  const ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }));
  try {
    retainCanvasRecovery(runtime, { title: 'Retry safely' }, 'Interrupted text');
    await flush();
    const notice = stage.querySelector<HTMLElement>('.collab-recovery')!;
    assert.match(notice.textContent!, /could not be saved/); t.mock.timers.tick(2_000);
    await flush(); assert.equal(attempts, 2); assert.match(notice.textContent!, /saved on this device/);
    assert.equal(notificationEntries().some(entry => entry.id.endsWith(':unsaved')), false, 'the failure notice is withdrawn once saved');
    t.mock.timers.tick(60_000); assert.equal(notice.hidden, false); assert.equal((stored as { title: string }).title, 'Retry safely');
  } finally { ui.teardown(); dom.window.close(); }
});

test('S-27: copies from another account or workspace are not listed or opened, and copies older than 30 days are removed', async () => {
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!, runtime = {};
  const day = 24 * 60 * 60 * 1000, legacy = { __toolId: 'design', title: 'Written before copies were bound' };
  const { saved, host } = library([
    ['collab-recovery:mine', owned('u1', day)],
    ['collab-recovery:theirs', owned('u2', day)],
    ['collab-recovery:elsewhere', owned('u1', day, 'https://other.example')],
    ['collab-recovery:old', owned('u1', RECOVERY_MAX_AGE_MS + day)],
    ['collab-recovery:old-theirs', owned('u2', RECOVERY_MAX_AGE_MS + day)],
    ['collab-recovery:legacy', legacy],
    ['design:1', owned('u2', RECOVERY_MAX_AGE_MS + day)],
  ]);
  let account = 'u1';
  const ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }), () => account);
  const nav = captureNavigation();
  try {
    await scanned();
    assert.deepEqual(notificationEntries().map(entry => entry.id), ['collab-recovery:mine']);
    assert.deepEqual([...saved.keys()].sort(), ['collab-recovery:elsewhere', 'collab-recovery:legacy', 'collab-recovery:mine', 'collab-recovery:theirs', 'design:1']);
    assert.deepEqual(saved.get('collab-recovery:legacy'), legacy, 'a copy with no binding is neither listed nor removed');

    // A draft whose slot another account holds is never written over or offered.
    retainCanvasRecovery(runtime, { title: 'Mine now' }, 'Interrupted text', 'theirs');
    await flush();
    assert.equal((saved.get('collab-recovery:theirs') as { title: string }).title, 'Copy');
    assert.match(stage.querySelector('[role="status"]')!.textContent!, /could not be saved/);
    assert.equal(byText(stage, 'Open recovery copy')!.hidden, true);

    // The listed copy is checked again when opened: after the account changes, nothing opens.
    const listed = notificationEntries().find(entry => entry.id === 'collab-recovery:mine')!;
    account = 'u2';
    await listed.action!.run!();
    assert.deepEqual(nav.hrefs, []);
    assert.equal(notificationEntries().some(entry => entry.id === 'collab-recovery:mine'), false);
  } finally { nav.restore(); ui.teardown(); dom.window.close(); }
});

test('a private pairing binds its copies to no account and lists only those', async () => {
  const dom = workspaceDom(), stage = dom.window.document.querySelector('div')!, runtime = {};
  const { host } = library([['collab-recovery:paired', owned('', 60_000)], ['collab-recovery:member', owned('u1', 60_000)]]);
  const ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design' } }));
  try {
    await scanned();
    assert.deepEqual(notificationEntries().map(entry => entry.id), ['collab-recovery:paired']);
  } finally { ui.teardown(); dom.window.close(); }
});
