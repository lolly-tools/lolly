// SPDX-License-Identifier: MPL-2.0
/**
 * A private collab's history over the real pieces (plan 221 section 9): two rtc handles
 * on an in-memory wire, the live mount's history role, the tool view's participation
 * rule, the session log, and the automatic history controller over the real state bridge
 * and revision store on the in-memory IndexedDB.
 *
 * - The host's device keeps the converged document. A peer's edit made while the host
 *   is idle reaches a checkpoint in the host's own store, and never the session log,
 *   which would file it under the host's name.
 * - The invitee's device keeps nothing. Its mount gets no history controller, even over
 *   the device's own store, and that database stays empty however much either side edits.
 *
 * `views/tool/setup.ts` makes the same calls in the same order: `mountHistoryRole`, then
 * `historyParticipation` with `role.shared`, then `mountActionHistory`, then
 * `role.followPeerEdits` with that controller. The last test pins the view to them.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/collab-host-history.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import type { IDBPDatabase } from 'idb';
import { memoryDb, type Stores } from '../bridge/idb-memory.test-utils.ts';
import type { SavedStateData, StateDb } from '../bridge/state.ts';
import type { CollabConnection } from './collab-mount.ts';
import type { RtcCollabHandle, RtcHandleTransport } from '../collab/rtc-handle.ts';
import type { RtcInboundMessage, RtcTransportEventMap, RtcTransportState } from '../collab/rtc-transport.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/#/tool/poster', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history, FileReader: dom.window.FileReader });

const { createStateAPI } = await import('../bridge/state.ts');
const { createRevisionStore } = await import('../bridge/revision-history.ts');
const { mountActionHistory, mountCollabActionHistory, PREVIEW_TIMING } = await import('../views/tool-revision-history.ts');
const { historyParticipation } = await import('../views/tool-history-adapters.ts');
const { createRtcCollabHandle } = await import('../collab/rtc-handle.ts');
const live = await import('./collab-live-mount.ts');
const { acquireCollabSession, getCollabSessionSource, _clearCollabSessionSourceForTests } = await import('./collab-session-source.ts');
const { createMemoryStateAPI } = await import('./ephemeral-state.ts');
Object.assign(PREVIEW_TIMING, { quietMs: 5, idleTimeoutMs: 5, intervalMs: 60_000 });

/** A document tool: text inputs and the default export bar, so history enrols the tool. */
const MANIFEST = { id: 'poster', inputs: [{ id: 'title', type: 'text' }, { id: 'subtitle', type: 'text' }] };

/** One end of an in-memory wire: what a handle sends arrives at its peer, in order. */
class Wire implements RtcHandleTransport {
  peer: Wire | null = null;
  readonly clientId: string;
  private readonly listeners = new Set<(message: RtcInboundMessage) => void>();
  constructor(clientId: string) { this.clientId = clientId; }
  state(): RtcTransportState { return { connection: 'live' } as RtcTransportState; }
  sendOp(op: unknown) { this.peer?.deliver({ lane: 'ops', kind: 'op', op } as RtcInboundMessage); return 'sent' as const; }
  sendPresence() { return 'sent' as const; }
  deliver(message: RtcInboundMessage): void { for (const fn of [...this.listeners]) fn(message); }
  on<K extends keyof RtcTransportEventMap>(type: K, fn: (value: RtcTransportEventMap[K]) => void): () => void {
    if (type !== 'message') return () => {};
    const listener = fn as (message: RtcInboundMessage) => void;
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  close(): void { this.peer = null; }
}

/** The backstop restatement is not under test, so its timer never fires. */
const INERT = { setTimeout: () => 0, clearTimeout: () => {} };

function pair(): { host: RtcCollabHandle; guest: RtcCollabHandle } {
  const a = new Wire('host'), b = new Wire('guest');
  a.peer = b; b.peer = a;
  return {
    host: createRtcCollabHandle({ transport: a, role: 'inviter', self: { clientId: 'host', name: 'Ada' }, timers: INERT }),
    guest: createRtcCollabHandle({ transport: b, role: 'acceptor', self: { clientId: 'guest', name: 'Grace' }, timers: INERT }),
  };
}

let clock = 0;
/** A scalar edit, minted the way the plumbing mints one, sent in the next microtask. */
async function edit(side: RtcCollabHandle, key: string, value: string): Promise<void> {
  side.adapter.apply({ k: 'param', key, value, origin: { client: side.self.clientId, clock: ++clock } });
  await new Promise(resolve => { setTimeout(resolve, 0); });
}

/** The tool's document after the plumbing applies each edit: the converged parameters. */
function document(side: RtcCollabHandle): SavedStateData {
  return { __toolId: 'poster', ...Object.fromEntries(side.docState().params) };
}

function connection(handle: RtcCollabHandle, role: 'inviter' | 'acceptor'): CollabConnection {
  return { role, handle, toolId: 'poster', ephemeral: role === 'acceptor', close: () => { handle.close(); } };
}

function liveEnvironment(): void {
  live._setLiveMountEnvironmentForTests({
    currentQuery: () => '', onToolRoute: () => false, navigate: () => {},
    makeEphemeralState: async () => createMemoryStateAPI(),
  });
}

function rows(stores: Stores): Record<string, number> {
  return Object.fromEntries([...stores].filter(([, map]) => map.size > 0).map(([name, map]) => [name, map.size]));
}

test("the host's own store keeps the converged document, peer edits included", async () => {
  live._clearLiveCollabForTests(); _clearCollabSessionSourceForTests(); liveEnvironment();
  const { host, guest } = pair();
  await live.mountLiveCollab(connection(host, 'inviter'));
  const collabHandle = acquireCollabSession('poster', null);
  assert.equal(collabHandle, host, "the inviter's mount adopted its session");
  const ephemeralState = live.takeEphemeralState('poster');
  assert.equal(ephemeralState, null, 'the inviter edits its real store');

  const role = live.mountHistoryRole({ toolId: 'poster', collabHandle, ephemeralState, sessionSource: !!getCollabSessionSource(), frame: fn => fn() });
  assert.ok(role.hostHistory, 'the host owns the document');
  assert.equal(role.shared, false, 'so its mount is not counted as shared');
  const participation = historyParticipation(MANIFEST, role.shared);
  assert.equal(participation.localHistory, true, 'and keeps local history like any creation');
  assert.equal(role.followPeerEdits(undefined), null, 'a tool with no local history follows nothing');

  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  let slot: string | null = null;
  const controller = mountActionHistory({
    enabled: participation.localHistory, host: { state, export: { render: async () => new dom.window.Blob([]) } } as never,
    toolId: 'poster', el: null, canvas: null, getSlot: () => slot, setSlot: next => { slot = next; }, takeFolder: () => null,
    snapshot: () => document(host),
  });
  assert.ok(controller);
  // The session log, wired as the view wires it: the host's own edits reach both.
  const capture = mountCollabActionHistory({ handle: collabHandle, snapshot: () => document(host), toolId: 'poster', open: async () => {} });
  assert.ok(capture);
  const ownEdit = (): void => { controller.changed(); capture.changed(); };
  const off = role.followPeerEdits(controller);
  assert.ok(off, 'the host follows peer edits into its own history');
  try {
    // The host makes no edit of its own. Without the peer-edit signal the controller
    // would never learn the document changed, and this flush would write nothing.
    await edit(guest, 'title', 'Written by the guest');
    assert.equal(host.docState().params.get('title'), 'Written by the guest', 'the edit converged on the host');
    await controller.flush(); capture.flush();

    assert.ok(slot, 'the first change filed the shared document in the host’s Projects');
    const saved = await state.load(slot);
    assert.equal(saved?.title, 'Written by the guest');
    const page = await state.history!.list({ slot });
    assert.equal(page.entries.length, 1);
    assert.equal(page.entries[0]?.reason, 'automatic');
    assert.equal((await state.history!.read(page.entries[0]!.id))?.title, 'Written by the guest');
    assert.equal((await host.history!.list()).entries.length, 0, 'the guest’s edit is not filed under the host’s name in the session log');

    // A host edit and a second guest edit land in the same history.
    ownEdit();
    await edit(host, 'subtitle', 'and the host');
    await edit(guest, 'title', 'Revised by the guest');
    await controller.flush(); capture.flush();
    const latest = await state.history!.list({ slot });
    assert.equal(latest.entries.length, 2);
    assert.deepEqual(await state.history!.read(latest.entries[0]!.id), { __toolId: 'poster', title: 'Revised by the guest', subtitle: 'and the host' });
    assert.ok((rows(stores).revisions ?? 0) >= 2);
    const log = await host.history!.list();
    assert.equal(log.entries.length, 1, 'the host’s own edit is in its session log');
    assert.deepEqual(log.entries[0]?.actor, { id: 'host', label: 'Ada' });
  } finally {
    off(); capture.dispose(); controller.dispose(); host.close(); guest.close();
  }
});

test("the invitee's device writes nothing durable, whatever either side edits", async () => {
  live._clearLiveCollabForTests(); _clearCollabSessionSourceForTests(); liveEnvironment();
  const { host, guest } = pair();
  await live.mountLiveCollab(connection(guest, 'acceptor'));
  const collabHandle = acquireCollabSession('poster', null);
  assert.equal(collabHandle, guest);
  const ephemeralState = live.takeEphemeralState('poster');
  assert.ok(ephemeralState, 'the acceptor edits a memory copy');

  const role = live.mountHistoryRole({ toolId: 'poster', collabHandle, ephemeralState, sessionSource: !!getCollabSessionSource(), frame: fn => fn() });
  assert.equal(role.hostHistory, null, 'an invitee is never the host');
  assert.equal(role.shared, true);
  const participation = historyParticipation(MANIFEST, role.shared);
  assert.equal(participation.localHistory, false);
  assert.equal(participation.recordDeviceActivity, false);

  // The device's own store: the copy state the view keeps for Save a copy, and the one
  // place a mistake in the role would write.
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const library = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  assert.ok(library.history);
  let slot: string | null = null;
  const mount = (state: unknown, enabled: boolean) => mountActionHistory({
    enabled, host: { state, export: { render: async () => new dom.window.Blob([]) } } as never,
    toolId: 'poster', el: null, canvas: null, getSlot: () => slot, setSlot: next => { slot = next; }, takeFolder: () => null,
    snapshot: () => document(guest),
  });
  assert.equal(mount(ephemeralState, participation.localHistory), undefined, 'no history controller for an invitee');
  assert.equal(mount(library, participation.localHistory), undefined, 'not even over the device’s own store');
  assert.equal(mount(ephemeralState, true), undefined, 'and the memory bridge has no history to give one');
  // Were a durable controller mounted here anyway, the invitee's role would still feed it nothing.
  const stray = mount(library, true);
  assert.ok(stray);
  assert.equal(role.followPeerEdits(stray), null, 'an invitee follows no peer edits into durable history');

  // What the invitee does have: the session's memory log and memory saves.
  const capture = mountCollabActionHistory({ handle: collabHandle, snapshot: () => document(guest), toolId: 'poster', open: async () => {} });
  assert.ok(capture);
  try {
    await edit(host, 'title', 'Written by the host');
    await edit(guest, 'subtitle', 'Written by the guest');
    capture.changed(); capture.flush();
    await stray.flush();
    await ephemeralState.save('poster:live', document(guest));
    assert.equal((await guest.history!.list()).entries.length, 1);
    assert.equal((await ephemeralState.list()).length, 1);
    assert.deepEqual(rows(stores), {}, 'not one row in the device’s own database');
  } finally {
    capture.dispose(); stray.dispose(); host.close(); guest.close();
  }
  assert.equal((await guest.history!.list()).entries.length, 0, 'leaving drops the memory log');
});

test('the tool view takes its history role from mountHistoryRole and feeds peer edits to its own history only', () => {
  // The whole feature, not one file, the way the source-pinning tests in views/ read the view.
  const dir = join(import.meta.dirname, '..', 'views', 'tool');
  const view = [join(dir, '..', 'tool.ts'), ...readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort().map(f => join(dir, f))]
    .map(file => readFileSync(file, 'utf8')).join('\n');
  assert.match(view, /const historyRole = mountHistoryRole\(\{ toolId, collabHandle, ephemeralState, sessionSource: !!getCollabSessionSource\(\) \}\);/);
  assert.match(view, /\.\.\.historyParticipation\(tview\.tool\.manifest, historyRole\.shared\),/, 'participation reads the role, so the host keeps local history');
  assert.match(view, /historyRole\.followPeerEdits\(actionsApi\?\.history\)/, 'peer edits go to the history controller and nothing else');
  assert.doesNotMatch(view, /onPeerEdit\(/, 'the view never subscribes to peer edits itself, so the session log cannot hear them');
});
