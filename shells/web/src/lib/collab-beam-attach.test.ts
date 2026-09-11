// SPDX-License-Identifier: MPL-2.0
/**
 * attachCollabBeam - where a live collab grows a SEND control, and where it must not
 * (plan 100 section 6.4, section 7).
 *
 * `collab/beam-ui.test.ts` proves the beam works once it exists. This one proves the
 * gate in front of it, which is the half a user can actually be misled by:
 *
 *   - a WORK collab never gets the control. Track B's transport carries ops and presence
 *     and no bulk lane at all (section 7), so the absence is STRUCTURAL - there is no flag to
 *     forget, and no code path where a work collab could be handed a beam;
 *   - a mount for a different tool never gets another collab's beam;
 *   - the action's visibility tracks the LANE, not the mount: pre-connect (and after the
 *     pair drops) `available()` is false, so the pill hides a button that could only
 *     fail. It comes back on its own when the lane opens, because the predicate is
 *     re-read on every paint rather than sampled once;
 *   - a beam belongs to its mount: closing the attachment closes the session, and so
 *     does the plan being disarmed (a pair dying with a toast on screen).
 *
 * The DOM seam is `collab-live-mount.ts`'s own injected {@link LiveMountEnvironment},
 * exactly as `collab-live-mount.test.ts` drives it - plus jsdom, because the attachment
 * really does mount the real toast into a real container.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/collab-beam-attach.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/app' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  setTimeout(() => cb(0), 0);
  return 0;
}) as unknown as typeof requestAnimationFrame;

const {
  _clearLiveCollabForTests,
  _setLiveMountEnvironmentForTests,
  attachCollabBeam,
  mountLiveCollab,
} = await import('./collab-live-mount.ts');
const { _clearCollabMountForTests } = await import('./collab-mount.ts');
const { _clearCollabSessionSourceForTests, acquireCollabSession } = await import('./collab-session-source.ts');
const { createMemoryStateAPI } = await import('./ephemeral-state.ts');

type CollabConnection = import('./collab-mount.ts').CollabConnection;
type CollabSessionHandle = import('./collab-session.ts').CollabSessionHandle;
type LiveMountEnvironment = import('./collab-live-mount.ts').LiveMountEnvironment;
type RtcInboundMessage = import('../collab/rtc-transport.ts').RtcInboundMessage;

// ── Fakes ─────────────────────────────────────────────────────────────────────

function handle(): CollabSessionHandle {
  return {
    adapter: {} as CollabSessionHandle['adapter'],
    role: 'writer',
    self: { clientId: 'device-1' },
    presenceIn: { subscribe: () => () => {} },
    sendPresence: () => {},
    events: { subscribe: () => () => {} },
    close: () => {},
  };
}

/**
 * The two members a beam reads off a transport, and nothing else - the bulk lane and
 * the `message` stream. `open` is mutable so a test can drop the pair mid-assertion,
 * which is the whole point of the availability predicate.
 */
function makeTransport(open = true) {
  const listeners = new Set<(m: RtcInboundMessage) => void>();
  const api = {
    open,
    beam: {
      lowThreshold: 4096,
      json: () => {},
      binary: () => {},
      onDrain: () => () => {},
      bufferedAmount: () => 0,
      isOpen: () => api.open,
    },
    on(_type: 'message', fn: (m: RtcInboundMessage) => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
  return api;
}

function environment(): LiveMountEnvironment {
  const env: LiveMountEnvironment = {
    currentQuery: () => '',
    onToolRoute: () => false,
    navigate: () => {},
    makeEphemeralState: async () => createMemoryStateAPI(),
  };
  _setLiveMountEnvironmentForTests(env);
  return env;
}

/** A connection as `lib/collab-mount.ts` receives one. `beam` is the Track A extra. */
function conn(over: Partial<CollabConnection> & { beam?: unknown } = {}): CollabConnection {
  return {
    role: 'inviter',
    toolId: 'design',
    ephemeral: false,
    handle: handle(),
    close: () => {},
    ...over,
  } as CollabConnection;
}

/** Take the armed plan through the hand-off the tool view would perform, so the module
 *  is in the state `attachCollabBeam` is really called from (`adopted`, not `pending`). */
function adopt(toolId = 'design'): void {
  acquireCollabSession(toolId, null);
}

const HOST = {
  state: {
    list: async () => [],
    load: async () => null,
    save: async () => undefined,
  },
  assets: {
    _exportUserAssets: async () => [],
    _uploadUserAsset: async () => undefined,
  },
};

beforeEach(() => {
  _clearLiveCollabForTests();
  _clearCollabMountForTests();
  _clearCollabSessionSourceForTests();
});

// ── The gate ─────────────────────────────────────────────────────────────────

test('a WORK collab grows no send control - the server path has no beam', async () => {
  environment();
  // Track B's connection: a session handle, a close, and no bulk lane anywhere. The
  // 'member' role is the tell (`lib/collab-mount.ts`: an org room has no ceremony).
  await mountLiveCollab(conn({ role: 'member', ephemeral: false }));
  adopt();

  const attached = await attachCollabBeam({
    toolId: 'design',
    host: HOST,
    currentSession: () => ({ state: { __toolId: 'design' } }),
  });
  assert.equal(attached, null, 'a work collab must not be handed a beam it cannot carry');
});

test('a malformed beam link is refused as firmly as a missing one', async () => {
  environment();
  await mountLiveCollab(conn({ beam: { transport: { on: () => () => {} }, role: 'inviter' } }));
  adopt();
  assert.equal(
    await attachCollabBeam({ toolId: 'design', host: HOST, currentSession: () => null }),
    null,
    'a transport with no bulk lane is not a beam',
  );
});

test('another tool\'s mount is never handed this collab\'s beam', async () => {
  environment();
  await mountLiveCollab(conn({ beam: { transport: makeTransport(), role: 'inviter' } }));
  adopt();
  assert.equal(
    await attachCollabBeam({ toolId: 'qr-code', host: HOST, currentSession: () => null }),
    null,
    'section 6.2a pins a private collab to the session it was started from',
  );
});

// ── Visibility tracks the lane, live ─────────────────────────────────────────

test('the action is present but UNAVAILABLE until the bulk lane opens, and again once it closes', async () => {
  environment();
  const t = makeTransport(false);          // paired, channel not open yet
  await mountLiveCollab(conn({ beam: { transport: t, role: 'inviter', peerName: 'Sam' } }));
  adopt();

  const attached = await attachCollabBeam({
    toolId: 'design',
    host: HOST,
    currentSession: () => ({ state: { __toolId: 'design' } }),
    container: document.createElement('div'),
  });
  assert.ok(attached, 'a private collab with a lane must get the control');
  assert.equal(attached.actions.length, 1);
  const [action] = attached.actions;
  assert.equal(action!.kind, 'send-session');

  assert.equal(action!.available?.(), false, 'pre-connect: the pill must hide a button that can only fail');

  t.open = true;
  assert.equal(action!.available?.(), true, 'the predicate is re-read, not sampled at mount');

  t.open = false;
  assert.equal(action!.available?.(), false, 'a dropped pair takes its send control with it');

  attached.close();
});

test('a send with no open lane rejects, so the pill announces rather than failing silently', async () => {
  environment();
  const t = makeTransport(false);
  await mountLiveCollab(conn({ beam: { transport: t, role: 'inviter' } }));
  adopt();

  const attached = (await attachCollabBeam({
    toolId: 'design',
    host: HOST,
    currentSession: () => ({ state: { __toolId: 'design' } }),
    container: document.createElement('div'),
  }))!;
  // The refusal is a REJECTION on purpose: everything that fails before the offer frame
  // has no toast card to appear in, so the pill's `runAction` is the only surface left.
  await assert.rejects(
    () => Promise.resolve(attached.actions[0]!.onSelect()),
    /lane-closed/,
    'a refusal before the offer must reach the human',
  );
  attached.close();
});

// ── Lifetime ─────────────────────────────────────────────────────────────────

test('a second attach replaces the first, and close is the mount\'s to call', async () => {
  environment();
  await mountLiveCollab(conn({ beam: { transport: makeTransport(), role: 'inviter' } }));
  adopt();

  const opts = {
    toolId: 'design',
    host: HOST,
    currentSession: () => ({ state: { __toolId: 'design' } }),
  };
  const first = (await attachCollabBeam(opts))!;
  assert.equal(document.querySelectorAll('.beam-toast-host').length, 1, 'one toast container per collab');

  const second = (await attachCollabBeam(opts))!;
  assert.equal(
    document.querySelectorAll('.beam-toast-host').length, 1,
    'a remount must not leave a toast subscribed through a session nobody holds',
  );

  second.close();
  assert.equal(document.querySelectorAll('.beam-toast-host').length, 0);
  // The replaced one is already down; closing it again is a no-op, not a double dispose.
  first.close();
  assert.equal(document.querySelectorAll('.beam-toast-host').length, 0);
});

test('a pair that dies takes its beam down with it, without the mount having to notice', async () => {
  environment();
  await mountLiveCollab(conn({ beam: { transport: makeTransport(), role: 'inviter' } }));
  adopt();
  await attachCollabBeam({
    toolId: 'design',
    host: HOST,
    currentSession: () => ({ state: { __toolId: 'design' } }),
  });
  assert.equal(document.querySelectorAll('.beam-toast-host').length, 1);

  // What `_clearLiveCollabForTests` stands in for in production: the plan being
  // disarmed (a second ceremony, or a session that closed before its mount).
  _clearLiveCollabForTests();
  assert.equal(
    document.querySelectorAll('.beam-toast-host').length, 0,
    'a consent sheet for a pair that no longer exists is the one lie this must not tell',
  );
});
