// SPDX-License-Identifier: MPL-2.0
/**
 * private-opener - the `'private'` slot of `lib/collab-launch.ts` (plan 100 section 0, section 6.1).
 *
 * Three properties, and each of them has already been a bug in some codebase:
 *
 *  - the SLOT is registered by importing the module, because that is the whole contract
 *    `lib/collab-share-private.ts` gates its row on. A registration that never happens
 *    is a row that never renders, silently, forever;
 *  - the FLAG is read on every open, not once at registration, so turning it on in the
 *    profile works without a reload and turning it off stops opening things;
 *  - the reply listener (section 11.25) lives exactly as long as the dialog. A listener that
 *    outlives its dialog would ack a reply into a window that is gone, and the tab that
 *    sent it would close believing it landed.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/collab/private-opener.test.ts
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ── jsdom ─────────────────────────────────────────────────────────────────────

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/app' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
(globalThis as { location?: Location }).location = dom.window.location as unknown as Location;
(globalThis as { Event?: typeof Event }).Event = dom.window.Event as unknown as typeof Event;
(globalThis as { Element?: typeof Element }).Element = dom.window.Element as unknown as typeof Element;
(globalThis as { localStorage?: Storage }).localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  setTimeout(() => cb(0), 0);
  return 0;
}) as unknown as typeof requestAnimationFrame;

const DialogProto = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
DialogProto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
DialogProto.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

const { getCollabOpener, openCollabLaunch } = await import('../lib/collab-launch.ts');
const { PRIVATE_COLLAB_FLAG, setFlagMirror } = await import('../feature-flags.ts');
const { _clearCollabMountForTests, parkedCount, registerCollabMount, takeParked } =
  await import('../lib/collab-mount.ts');
type CollabConnection = import('../lib/collab-mount.ts').CollabConnection;

// The import IS the registration - that side effect is the thing under test below.
const { openPrivateCollab } = await import('./private-opener.ts');

const { openCollabCeremony } = await import('../components/collab-ceremony.ts');
type CeremonyEffectsBundle = import('../components/collab-ceremony.ts').CeremonyEffectsBundle;
type CeremonyConnectedHandle = import('../components/collab-ceremony.ts').CeremonyConnectedHandle;
type CollabCeremonyHandle = import('../components/collab-ceremony.ts').CollabCeremonyHandle;
type CollabCeremonyOptions = import('../components/collab-ceremony.ts').CollabCeremonyOptions;

const { SDP_CODEC_VERSION, encodeToken, pack } = await import('./sdp-codec.ts');
type SdpMaterial = import('./sdp-codec.ts').SdpMaterial;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function material(): SdpMaterial {
  return {
    fingerprint: { algo: 'sha-256', bytes: Uint8Array.from({ length: 32 }, (_, i) => (i * 3) & 0xff) },
    iceUfrag: 'ab12',
    icePwd: 'abcdefghijklmnopqrstuv',
    candidates: [{ type: 'host', protocol: 'udp', address: '10.0.0.4', port: 40404 }],
    setupRole: 'actpass',
  };
}

function inviteToken(): string {
  const packed = pack({
    kind: 'invite',
    material: material(),
    invite: { v: SDP_CODEC_VERSION, toolId: 'qr-code', toolVersion: '2.1.0', engineVersion: '1.108.0' },
  });
  assert.ok(packed.ok);
  return encodeToken(packed.value, 'link');
}

function answerToken(): string {
  const packed = pack({ kind: 'answer', material: material() });
  assert.ok(packed.ok);
  return encodeToken(packed.value, 'link');
}

function plainEffects(over: Partial<CeremonyEffectsBundle> = {}): CeremonyEffectsBundle {
  return {
    createOffer: async () => ({ ok: true, invite: { signal: inviteToken(), toolId: 'qr-code' } }),
    checkTool: async () => ({ status: 'have' as const }),
    createAnswer: async () => ({ ok: true, answer: { signal: answerToken() } }),
    applyRemote: async () => ({ ok: true }),
    ...over,
  };
}

const settle = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

const opened: CollabCeremonyHandle[] = [];
function trackedOpen(opts: CollabCeremonyOptions): CollabCeremonyHandle {
  const handle = openCollabCeremony(opts);
  opened.push(handle);
  return handle;
}

/** The fake BroadcastChannel hub from the join-route suite, minus what is unused here. */
function channelHub() {
  const endpoints = new Set<Endpoint>();
  class Endpoint {
    readonly listeners = new Set<(event: { data?: unknown }) => void>();
    closed = false;
    postMessage(data: unknown): void {
      for (const peer of [...endpoints]) {
        if (peer === this || peer.closed) continue;
        for (const fn of [...peer.listeners]) fn({ data });
      }
    }
    addEventListener(_type: 'message', fn: (event: { data?: unknown }) => void): void { this.listeners.add(fn); }
    removeEventListener(_type: 'message', fn: (event: { data?: unknown }) => void): void { this.listeners.delete(fn); }
    close(): void { this.closed = true; this.listeners.clear(); endpoints.delete(this); }
  }
  return {
    open: () => { const e = new Endpoint(); endpoints.add(e); return e; },
    /** How many endpoints are open and still listening. */
    listening: () => [...endpoints].filter((e) => !e.closed && e.listeners.size > 0).length,
  };
}

beforeEach(() => {
  while (opened.length) opened.pop()?.close();
  _clearCollabMountForTests();
  // Explicitly OFF, and every test that wants the other state writes `true` itself: the
  // flag has been ON by default since 2026-08-10, so no test here may lean on a default
  // in either direction - the point of this file is that the opener reads the flag on
  // every press rather than capturing it at registration.
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, false);
  dom.window.document.body.replaceChildren();
});

// ── Registration ──────────────────────────────────────────────────────────────

test("importing the module registers the 'private' slot - that IS the wiring", () => {
  assert.equal(typeof getCollabOpener('private'), 'function');
  assert.equal(getCollabOpener('work'), undefined, "the other track is not this file's business");
});

test('the registered opener is inert while the flag is off, and never throws at the Share row', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, false);
  // openCollabLaunch reports that an opener exists - the row is allowed to render - and
  // the refusal happens inside, where the live flag is.
  assert.equal(openCollabLaunch('private', { toolId: 'qr-code', baseParts: [] }), true);
  await settle();
  assert.equal(dom.window.document.querySelector('dialog'), null, 'nothing was opened');
});

test('the flag is read per open, not captured at registration', async () => {
  const off = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: trackedOpen,
    effects: plainEffects(),
  });
  assert.equal(off, null, 'the mirror beforeEach wrote is off - a user who turned the flag off');
  assert.equal(opened.length, 0);

  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  const on = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  assert.ok(on, 'flipping the flag needs no reload');
  assert.equal(opened.length, 1);
});

// ── The ceremony it opens ─────────────────────────────────────────────────────

test('it opens the INVITER role, carrying the session it was launched from', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  const seen: CollabCeremonyOptions[] = [];
  await openPrivateCollab({ toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fsuse.com'] }, {
    openCeremony: (opts) => { seen.push(opts); return trackedOpen(opts); },
    effects: plainEffects(),
    profileName: 'Andy',
    renderQr: null,
    scan: null,
  });
  assert.equal(seen[0]?.role, 'inviter');
  assert.equal(seen[0]?.toolId, 'qr-code');
  assert.equal(seen[0]?.profileName, 'Andy');
  const dialog = opened.at(-1)!;
  dialog.el.querySelector<HTMLElement>('[data-act="create-invite"]')!.click();
  await settle();
  assert.ok(dialog.el.textContent?.includes('#/join?inv='), 'the invite it mints points at the join route');
});

// ── The handoff to whatever owns co-editing ───────────────────────────────────

test('a connected pair reaches the mount registry, tagged as the inviter side (section 6.2a)', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  const taken: CollabConnection[] = [];
  registerCollabMount((conn) => { taken.push(conn); });

  let fire: ((handle: CeremonyConnectedHandle) => void) | undefined;
  const built: unknown[] = [];
  const dialog = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: (opts) => {
      fire = opts.onConnected;
      return trackedOpen({ ...opts, onConnected: undefined });
    },
    // No `effects` - so the real composition runs and reports the transport it built.
    // A jsdom process has no RTCPeerConnection, which the transport treats as a typed
    // refusal rather than a throw; what matters here is that the object arrives.
    onTransport: (transport) => { built.push(transport); },
    renderQr: null,
    scan: null,
  });
  assert.ok(fire, 'the dialog was given an onConnected to fire');
  // The transport is built when the ceremony starts, not when the dialog opens - so
  // start one, exactly as pressing "Create the invite" does.
  dialog!.el.querySelector<HTMLElement>('[data-act="create-invite"]')!.click();
  await settle();
  assert.equal(built.length, 1, 'the composition reported the transport it built');

  fire!({ toolId: 'qr-code', close: () => {} } as unknown as CeremonyConnectedHandle);
  assert.equal(taken.length, 1, 'the mount took it');
  assert.equal(taken[0]?.role, 'inviter');
  assert.equal(taken[0]?.ephemeral, false, 'the inviter owns the saved session');
  assert.equal(taken[0]?.toolId, 'qr-code');
  assert.deepEqual(taken[0]?.launch?.baseParts, []);
  // The seam is transport-agnostic since wave 2.5: what the adopter gets is a built
  // session handle plus the `close()` that hangs the pair up, not the RtcTransport.
  assert.ok(taken[0]?.handle?.adapter, 'the adopter needs a session it can mount');
  assert.equal(typeof taken[0]?.close, 'function', 'and the one thing that can hang it up');
  assert.equal(taken[0]?.seed, undefined, 'an empty model serialises to no seed at all');
});

test('with nothing registered the pair is parked, and the dialog says so honestly', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  let fire: ((handle: CeremonyConnectedHandle) => void) | undefined;
  const dialog = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: (opts) => { fire = opts.onConnected; return trackedOpen({ ...opts, onConnected: undefined }); },
    renderQr: null,
    scan: null,
  });
  dialog!.el.querySelector<HTMLElement>('[data-act="create-invite"]')!.click();
  await settle();
  fire!({ toolId: 'qr-code', close: () => {} } as unknown as CeremonyConnectedHandle);

  const parked = takeParked();
  assert.equal(parked.length, 1, 'a completed pairing is never thrown away for want of an adopter');
  assert.ok(dialog?.el.querySelector('[data-collab-scaffold]'), 'the note is on screen, not in the console');
});

test('closing the dialog hangs up a parked pair rather than leaving it open for the page\'s life', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  let fire: ((handle: CeremonyConnectedHandle) => void) | undefined;
  const dialog = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: (opts) => { fire = opts.onConnected; return trackedOpen({ ...opts, onConnected: undefined }); },
    renderQr: null,
    scan: null,
  });
  dialog!.el.querySelector<HTMLElement>('[data-act="create-invite"]')!.click();
  await settle();
  fire!({ toolId: 'qr-code', close: () => {} } as unknown as CeremonyConnectedHandle);
  assert.equal(parkedCount(), 1, 'nothing owns co-editing yet');

  dialog!.close();
  assert.equal(parkedCount(), 0, 'the ceremony is over, so the peer connection it made is over too');
});

test('an injected-effects opener with no transport behind it hands the mount nothing', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  const taken: CollabConnection[] = [];
  registerCollabMount((conn) => { taken.push(conn); });
  let fire: ((handle: CeremonyConnectedHandle) => void) | undefined;
  await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: (opts) => { fire = opts.onConnected; return trackedOpen({ ...opts, onConnected: undefined }); },
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  fire!({ toolId: 'qr-code', close: () => {} } as unknown as CeremonyConnectedHandle);
  assert.equal(taken.length, 0, 'a connection with no way to send on it is worse than none');
  assert.equal(takeParked().length, 0);
});

// ── The reply listener (section 11.25) ───────────────────────────────────────────────

test('the reply listener lives exactly as long as the dialog', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  let stops = 0;
  let seenDialog: ParentNode | null = null;
  const dialog = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
    listen: (get) => { seenDialog = get(); return () => { stops += 1; }; },
  });
  assert.ok(dialog);
  assert.equal(seenDialog, dialog!.el, 'the listener is pointed at the dialog it belongs to');
  assert.equal(stops, 0);
  dialog!.close();
  assert.equal(stops, 1, 'a listener that outlives its dialog would ack into a closed window');
  dialog!.close();
  assert.equal(stops, 1, 'and it is torn down exactly once');
});

test('the production path opens a real channel and closes it with the dialog', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  const hub = channelHub();
  const dialog = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: trackedOpen,
    // No `effects`, so the real wiring loads and the real listenForReply is used.
    channel: () => hub.open() as never,
    renderQr: null,
    scan: null,
  });
  assert.equal(hub.listening(), 1, 'the invite window is subscribed the moment it opens');
  dialog!.close();
  assert.equal(hub.listening(), 0, 'and unsubscribed the moment it closes');
});

test('a browser with no BroadcastChannel opens the ceremony anyway', async () => {
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, true);
  const dialog = await openPrivateCollab({ toolId: 'qr-code', baseParts: [] }, {
    openCeremony: trackedOpen,
    channel: null,
    renderQr: null,
    scan: null,
  });
  assert.ok(dialog, 'the reply link is one skin of three - losing it is not losing the ceremony');
});
