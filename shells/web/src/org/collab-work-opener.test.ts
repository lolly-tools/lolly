// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-work-opener.ts - the work-collab launch path, both ends.
 *
 * What is proved here:
 *   - the opener hands `lib/collab-mount.ts` a MEMBER connection with the shape the
 *     seam contract names (role, handle, close, toolId, launch, ephemeral, seed);
 *   - the inbox invite action parses the server's message, connects on press, and is
 *     ABSENT - not disabled - without the `collab.join` bit, including through a real
 *     `initOrg()` pass on an instance that grants nothing;
 *   - each way an invite can outlive its session (410 / 403 / 404 / no answer) shows
 *     its OWN sentence, and never opens a socket;
 *   - a room that refuses, is cross-origin, or never answers closes the provider on
 *     the way out rather than leaving a socket behind a failure message.
 *
 * No WebSocket, no IndexedDB and no real timers: the ws client reaches this suite
 * only through the injectable `wiring`, which is also how production keeps it out of
 * a banner's chunk until somebody presses the button.
 *
 * Run directly:  node --test shells/web/src/org/collab-work-opener.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
// Type-only, so it is erased and cannot import the module before the globals below exist
// (the values come through the `await import()` further down, as this harness requires).
import type { WorkCollabDeps, WorkCollabWiring } from './collab-work-opener.ts';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/tool/qr-code', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
// a11y.ts's announce() schedules via rAF; jsdom's pretendToBeVisual only exposes it on
// dom.window, not the bare global this file runs in (same shim as org/collab-share.test.ts).
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

type Handler = (url: string, init?: RequestInit) => Response;
let router: Handler = () => new Response('', { status: 404 });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => router(String(input), init)) as typeof fetch;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const mod = await import('./collab-work-opener.ts');
const {
  STRINGS,
  readCollabInvite,
  openWorkCollab,
  joinWorkCollabFromInvite,
  buildCollabInviteAction,
  registerWorkCollabOpener,
} = mod;

const { initOrg, _resetOrgForTests } = await import('./index.ts');
const { getCollabOpener, openCollabLaunch, _clearCollabOpenersForTests } = await import('../lib/collab-launch.ts');

// ── Fakes ─────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'connecting' | 'joining' | 'live' | 'reconnecting' | 'closed';

/** A provider that is nothing but the four methods this module drives. */
function fakeProvider(initial: Status = 'connecting') {
  const listeners = new Set<(e: unknown) => void>();
  const box = {
    status: initial as Status,
    reason: undefined as string | undefined,
    connects: 0,
    closes: 0,
    subscribed: 0,
    /** Drive the state machine the way the real provider's events do. */
    emit(status: Status, reason?: string): void {
      box.status = status;
      box.reason = reason;
      for (const fn of [...listeners]) fn({ kind: 'state' });
    },
    handle: {
      sessionId: 'ses_1',
      adapter: {},
      connect: async (): Promise<void> => { box.connects++; },
      close: (): void => { box.closes++; box.status = 'closed'; },
      state: () => ({ status: box.status, reason: box.reason, role: 'writer', roster: [], attempt: 0, pending: 0, queued: 0, unsynced: [] }),
      on(fn: (e: unknown) => void): () => void {
        box.subscribed++;
        listeners.add(fn);
        return () => { listeners.delete(fn); box.subscribed--; };
      },
      sendPresence: (): void => {},
      outbox: () => [],
      persisted: async (): Promise<void> => {},
    },
  };
  return box;
}

/** The session handle a work provider is adapted into. Its `close()` closes the
 *  provider, exactly as `createWorkCollabHandle`'s does - the property the delivered
 *  connection's own `close()` stands on. */
function fakeHandleOver(provider: ReturnType<typeof fakeProvider>) {
  return {
    adapter: {},
    role: 'writer',
    self: { clientId: 'c1' },
    presenceIn: { subscribe: () => () => {} },
    sendPresence: () => {},
    events: { subscribe: () => () => {} },
    close: () => { provider.handle.close(); },
  };
}

interface Rig {
  deps: WorkCollabDeps;
  provider: ReturnType<typeof fakeProvider> | null;
  handle: ReturnType<typeof fakeHandleOver> | null;
  built: string[];
  delivered: Array<Record<string, unknown>>;
  fire(): void;
}

/**
 * The whole injectable surface in one place: a provider whose status the case drives,
 * a capture for what reached the mount seam, and a manual timer so the timeout case is
 * assertable without waiting 15 seconds.
 */
function rig(opts: {
  initial?: Status;
  deliver?: boolean;
  canEdit?: boolean;
  canJoin?: boolean;
  fetchSession?: WorkCollabDeps['fetchSession'];
  crossOriginReason?: string;
} = {}): Rig {
  const state: Rig = {
    provider: null,
    handle: null,
    built: [],
    delivered: [],
    fire: () => {},
    deps: {},
  };
  let timeoutFn: (() => void) | null = null;
  state.fire = (): void => { timeoutFn?.(); };
  const wiring: WorkCollabWiring = {
    makeProvider(sessionId: string) {
      state.built.push(sessionId);
      const p = fakeProvider(opts.initial ?? 'live');
      state.provider = p;
      state.handle = fakeHandleOver(p);
      return p.handle as unknown as ReturnType<WorkCollabWiring['makeProvider']>;
    },
    makeHandle: () => state.handle as unknown as ReturnType<WorkCollabWiring['makeHandle']>,
    crossOriginReason: opts.crossOriginReason ?? 'cross-origin-instance',
  };
  state.deps = {
    canEdit: () => opts.canEdit ?? true,
    canJoin: () => opts.canJoin ?? true,
    wiring: () => wiring,
    deliver: (conn) => { state.delivered.push(conn as unknown as Record<string, unknown>); return opts.deliver ?? true; },
    ...(opts.fetchSession ? { fetchSession: opts.fetchSession } : {}),
    setTimer: (fn: () => void) => { timeoutFn = fn; return 1; },
    clearTimer: () => { timeoutFn = null; },
  };
  return state;
}

const okSession = (over: Partial<{ toolId: string; inputs: Record<string, unknown> }> = {}) =>
  (async () => ({ ok: true as const, data: { toolId: over.toolId ?? 'qr-code', inputs: over.inputs ?? { url: 'https://example.test' } } }));

const failSession = (status: number) => (async () => ({ ok: false as const, status }));

const inviteMsg = (over: Record<string, string> = {}) => ({
  kind: 'collab',
  data: { kind: 'collab-invite', sessionId: 'ses_1', projectId: 'prj_1', toolId: 'qr-code', toolVersion: '1.2.0', ...over },
});

function reset(): void {
  _resetOrgForTests();
  _clearCollabOpenersForTests();
  store.clear();
  router = () => new Response('', { status: 404 });
}

// ── The invite payload (pure) ─────────────────────────────────────────────────

test('readCollabInvite reads the server\'s invite message', () => {
  const invite = readCollabInvite(inviteMsg());
  assert.deepEqual(invite, { sessionId: 'ses_1', projectId: 'prj_1', toolId: 'qr-code', toolVersion: '1.2.0' });
});

test('readCollabInvite accepts either marker on its own', () => {
  // The payload's own kind, on a message whose kind the server later renames.
  assert.equal(readCollabInvite({ kind: 'announcement', data: { kind: 'collab-invite', sessionId: 'ses_9' } })?.sessionId, 'ses_9');
  // The message kind, with a payload that only carries the id.
  assert.equal(readCollabInvite({ kind: 'collab', data: { sessionId: 'ses_9' } })?.sessionId, 'ses_9');
});

test('readCollabInvite refuses anything it cannot act on', () => {
  assert.equal(readCollabInvite(null), null);
  assert.equal(readCollabInvite({ kind: 'collab' }), null);                              // no payload
  assert.equal(readCollabInvite({ kind: 'announcement', data: { sessionId: 'x' } }), null); // not an invite
  assert.equal(readCollabInvite({ kind: 'collab', data: { sessionId: '   ' } }), null);   // blank id
  assert.equal(readCollabInvite({ kind: 'collab', data: { sessionId: 'x'.repeat(201) } }), null); // absurd id
});

// ── The opener (Share dialog path) ────────────────────────────────────────────

test('the opener delivers a member CollabConnection', async () => {
  const r = rig();
  const ctx = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fexample.test'], sessionId: 'ses_1' };
  const out = await openWorkCollab(ctx, r.deps);

  assert.deepEqual(out, { ok: true });
  assert.deepEqual(r.built, ['ses_1']);
  assert.equal(r.delivered.length, 1);
  const conn = r.delivered[0]!;
  assert.equal(conn.role, 'member');
  assert.equal(conn.handle, r.handle);
  assert.equal(conn.toolId, 'qr-code');
  assert.equal(conn.launch, ctx);
  assert.equal(conn.ephemeral, false, 'a work collab edits the instance\'s durable session');
  assert.equal(conn.seed, undefined, 'a member is seeded by the join-ack, never by the opener');
  assert.equal(typeof conn.close, 'function');
  assert.equal(r.provider!.connects, 1);
});

test('the delivered close() hangs the provider up', async () => {
  const r = rig();
  await openWorkCollab({ toolId: 'qr-code', baseParts: [], sessionId: 'ses_1' }, r.deps);
  assert.equal(r.provider!.closes, 0, 'a live session is not closed by opening it');
  (r.delivered[0]!.close as () => void)();
  assert.equal(r.provider!.closes, 1);
});

test('a mount that never registered parks the connection, and says so', async () => {
  const r = rig({ deliver: false });
  const out = await openWorkCollab({ baseParts: [], sessionId: 'ses_1' }, r.deps);
  assert.equal(out.ok, false);
  assert.equal(out.ok === false && out.reason, 'no-mount');
  assert.equal(out.ok === false && out.message, STRINGS.noMount);
  // Parked, not hung up: lib/collab-mount.ts holds it for a mount arriving a moment later.
  assert.equal(r.provider!.closes, 0);
});

test('without collab.edit the opener refuses before it builds anything', async () => {
  const r = rig({ canEdit: false });
  const out = await openWorkCollab({ baseParts: [], sessionId: 'ses_1' }, r.deps);
  assert.equal(out.ok === false && out.reason, 'not-permitted');
  assert.equal(out.ok === false && out.message, STRINGS.cannotEdit);
  assert.deepEqual(r.built, []);
  assert.deepEqual(r.delivered, []);
});

test('a session with no instance id refuses honestly rather than guessing one', async () => {
  const r = rig();
  const out = await openWorkCollab({ toolId: 'qr-code', baseParts: [] }, r.deps);
  assert.equal(out.ok === false && out.reason, 'no-session');
  assert.equal(out.ok === false && out.message, STRINGS.noSession);
  assert.deepEqual(r.built, []);
});

test('registerWorkCollabOpener fills the work slot and routes through openCollabLaunch', async () => {
  reset();
  const r = rig();
  const off = registerWorkCollabOpener(r.deps);
  assert.ok(getCollabOpener('work'), 'the Share row is gated on this existing');
  assert.equal(openCollabLaunch('work', { toolId: 'qr-code', baseParts: [], sessionId: 'ses_7' }), true);
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(r.built, ['ses_7']);
  assert.equal(r.delivered.length, 1);
  off();
  assert.equal(getCollabOpener('work'), undefined);
});

// ── The invite path ───────────────────────────────────────────────────────────

test('an invite resolves the session first, then connects as a member', async () => {
  const r = rig({ fetchSession: okSession({ toolId: 'street-map', inputs: { place: 'Nuremberg' } }) });
  const out = await joinWorkCollabFromInvite({ sessionId: 'ses_1', toolId: 'qr-code' }, r.deps);

  assert.deepEqual(out, { ok: true });
  assert.deepEqual(r.built, ['ses_1']);
  const conn = r.delivered[0]!;
  assert.equal(conn.role, 'member');
  assert.equal(conn.toolId, 'street-map', 'the session wins over the invite\'s snapshot');
  assert.equal(conn.launch, undefined, 'an invite has no Share-dialog context');
  // The seam's contract: a member is seeded by the gateway's join-ack, so the fetched
  // inputs must NOT be forwarded as a second, older copy in a different currency.
  assert.equal(conn.seed, undefined);
  assert.equal(conn.seedLater, undefined);
});

test('each way an invite outlives its session gets its own sentence, and no socket', async () => {
  const cases: Array<[number, string, string]> = [
    [410, 'gone', STRINGS.gone],
    [403, 'forbidden', STRINGS.forbidden],
    [404, 'missing', STRINGS.missing],
    // The point of a status-carrying fetch: only a status this module has NO reading for
    // (and `status: 0`, which is what a network error and an unusable body both are) may
    // become the offline sentence. A 401 is an answer - the instance said "who are you?"
    // - and telling that member to check their internet connection instead of to sign in
    // is precisely the mis-diagnosis the fetch was introduced to prevent.
    [401, 'signed-out', STRINGS.signedOut],
    [500, 'server-error', STRINGS.serverError],
    [503, 'server-error', STRINGS.serverError],
    [0, 'unreachable', STRINGS.unreachable],
    [418, 'unreachable', STRINGS.unreachable],
  ];
  for (const [status, reason, message] of cases) {
    const r = rig({ fetchSession: failSession(status) });
    const out = await joinWorkCollabFromInvite({ sessionId: 'ses_1' }, r.deps);
    assert.equal(out.ok, false, `status ${status}`);
    assert.equal(out.ok === false && out.reason, reason, `status ${status}`);
    assert.equal(out.ok === false && out.message, message, `status ${status}`);
    assert.deepEqual(r.built, [], `status ${status} must not open a socket`);
  }
});

test('without collab.join an invite is not joinable at all', async () => {
  const r = rig({ canJoin: false, fetchSession: okSession() });
  const out = await joinWorkCollabFromInvite({ sessionId: 'ses_1' }, r.deps);
  assert.equal(out.ok === false && out.reason, 'not-permitted');
  assert.equal(out.ok === false && out.message, STRINGS.cannotJoin);
  assert.deepEqual(r.built, []);
});

// ── Rooms that do not answer ──────────────────────────────────────────────────

test('a room that never goes live times out and hangs the provider up', async () => {
  const r = rig({ initial: 'connecting', fetchSession: okSession() });
  const pending = joinWorkCollabFromInvite({ sessionId: 'ses_1' }, r.deps);
  await new Promise((res) => setTimeout(res, 0));
  r.fire();                                  // the injected timer, in place of 15 s
  const out = await pending;
  assert.equal(out.ok === false && out.reason, 'timeout');
  assert.equal(out.ok === false && out.message, STRINGS.slow);
  assert.equal(r.provider!.closes, 1, 'a failure must not leave a socket open');
  assert.deepEqual(r.delivered, []);
});

test('a refused room reports the refusal, not a network problem', async () => {
  const r = rig({ initial: 'connecting', fetchSession: okSession() });
  const pending = joinWorkCollabFromInvite({ sessionId: 'ses_1' }, r.deps);
  await new Promise((res) => setTimeout(res, 0));
  r.provider!.emit('closed', 'forbidden');
  const out = await pending;
  assert.equal(out.ok === false && out.reason, 'refused');
  assert.equal(out.ok === false && out.message, STRINGS.refused);
  assert.deepEqual(r.delivered, []);
});

test('a cross-origin gateway is named as such', async () => {
  const r = rig({ initial: 'connecting', fetchSession: okSession() });
  const pending = joinWorkCollabFromInvite({ sessionId: 'ses_1' }, r.deps);
  await new Promise((res) => setTimeout(res, 0));
  r.provider!.emit('closed', 'cross-origin-instance');
  const out = await pending;
  assert.equal(out.ok === false && out.reason, 'cross-origin');
  assert.equal(out.ok === false && out.message, STRINGS.crossOrigin);
});

test('a provider that reaches live only after subscribing is still joined', async () => {
  const r = rig({ initial: 'joining', fetchSession: okSession() });
  const pending = joinWorkCollabFromInvite({ sessionId: 'ses_1' }, r.deps);
  await new Promise((res) => setTimeout(res, 0));
  r.provider!.emit('live');
  assert.deepEqual(await pending, { ok: true });
  assert.equal(r.provider!.subscribed, 0, 'the state subscription is dropped once it has answered');
});

// ── The inbox affordance ──────────────────────────────────────────────────────

test('an invite message gains an "Open the collab" action that connects on press', async () => {
  const r = rig({ fetchSession: okSession() });
  const el = buildCollabInviteAction(inviteMsg(), r.deps);
  assert.ok(el, 'a granted member gets the action');
  const btn = el!.querySelector<HTMLButtonElement>('[data-act="open-collab"]')!;
  assert.equal(btn.textContent, STRINGS.open);

  document.getElementById('app')!.appendChild(el!);
  btn.click();
  assert.equal(btn.disabled, true, 'a second press cannot open a second socket');
  assert.equal(btn.textContent, STRINGS.opening);
  await new Promise((res) => setTimeout(res, 0));
  await new Promise((res) => setTimeout(res, 0));

  assert.deepEqual(r.built, ['ses_1']);
  assert.equal(r.delivered.length, 1);
  assert.equal(r.delivered[0]!.role, 'member');
  assert.equal(el!.isConnected, false, 'the spent control leaves once the mount has it');
});

test('a revoked invite says so in place of the button', async () => {
  const r = rig({ fetchSession: failSession(403) });
  const el = buildCollabInviteAction(inviteMsg(), r.deps)!;
  document.getElementById('app')!.appendChild(el);
  el.querySelector<HTMLButtonElement>('[data-act="open-collab"]')!.click();
  await new Promise((res) => setTimeout(res, 0));
  await new Promise((res) => setTimeout(res, 0));

  assert.equal(el.querySelector('[data-act="open-collab"]'), null);
  assert.equal(el.querySelector<HTMLElement>('[data-collab-invite-error]')?.textContent, STRINGS.forbidden);
  assert.deepEqual(r.built, [], 'a revoked session is never dialled');
  el.remove();
});

test('nothing renders without the can bits, and nothing renders for a non-invite', () => {
  assert.equal(buildCollabInviteAction(inviteMsg(), rig({ canJoin: false }).deps), null);
  assert.equal(buildCollabInviteAction({ kind: 'announcement', data: { sessionId: 'ses_1' } }, rig().deps), null);
  assert.equal(buildCollabInviteAction({ kind: 'collab' }, rig().deps), null);
});

test('an instance that grants nothing renders no action - the real gate, end to end', async () => {
  reset();
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', groups: ['eng'] } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, can: { 'link.create': true } });
    return new Response('', { status: 404 });
  };
  await initOrg();
  // No deps: the module reads canJoinCollab() off the org config it just loaded.
  assert.equal(buildCollabInviteAction(inviteMsg()), null);

  // …and the same instance WITH the bit renders one.
  reset();
  router = (url) => {
    if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
    if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', groups: ['eng'] } });
    if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, can: { 'collab.join': true } });
    return new Response('', { status: 404 });
  };
  await initOrg();
  assert.ok(buildCollabInviteAction(inviteMsg()), 'granted collab.join ⇒ the action renders');
  reset();
});
