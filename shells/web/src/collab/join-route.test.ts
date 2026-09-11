// SPDX-License-Identifier: MPL-2.0
/**
 * join-route - the two URL entry points of a private collab (plan 100 section 6.1, section 11.25).
 *
 * The bugs this file exists to catch are all of one kind: a name known in two places.
 * The dialog mints `#/join?inv=…`; the router has to answer to exactly that. The dialog
 * renders a reply field with an id; the handoff has to fill exactly that field. The
 * reply tab posts a message shape; the invite tab has to read exactly that shape. Every
 * one of those is invisible to a unit test that mocks the other side, so this suite
 * uses the REAL dialog, the REAL codec and the REAL router source wherever a name
 * crosses a file boundary:
 *
 *  - the invite/reply links are read off a rendered ceremony and parsed the way
 *    `main.ts` parses a hash, with the router's own branch asserted in its source;
 *  - the invite is delivered into a real acceptor dialog, which has to advance a step;
 *  - the reply handoff runs over a fake BroadcastChannel between a real reply route and
 *    a real inviter dialog, and BOTH outcomes are pinned - delivered, and nobody home.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/collab/join-route.test.ts
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

// jsdom has no `BroadcastChannel`, but NODE does - and a Node one in a jsdom realm is a
// hybrid that exists nowhere: it dispatches a Node `MessageEvent` into a listener while
// `globalThis.Event` is jsdom's, which Node's own dispatch then rejects. Deleting it
// makes this environment shaped like the browser it is standing in for, where a channel
// is either the real thing or absent - and every test that wants one injects a fake.
delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

// jsdom 25 has no <dialog> showModal/close - shim exactly the surface mountModal uses.
const DialogProto = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
DialogProto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
DialogProto.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

const {
  CEREMONY_CHANNEL_NAME,
  CHANNEL_MESSAGE_VERSION,
  CODE_FIELD_SELECTOR,
  INVITE_STAMP_SELECTOR,
  REPLY_ACK_WAIT_MS,
  STRINGS,
  SUBMIT_CODE_ACT,
  answerInviteAsks,
  appLinkBase,
  appendScaffoldNote,
  askOwnInvite,
  canTakeReply,
  createCollabEffects,
  deliverInviteToDialog,
  deliverReplyToDialog,
  dialogInvite,
  handOffConnection,
  inviteAckMessage,
  inviteAskMessage,
  isInviteAck,
  isReplyAck,
  listenForReply,
  noteOwnInvite,
  readInviteAsk,
  mountJoinReplyRoute,
  mountJoinRoute,
  probeLocalTool,
  readReplyBid,
  readReplyGrant,
  readReplyMessage,
  readReplyOffer,
  replyAckMessage,
  replyBidMessage,
  replyMessage,
  replyOfferMessage,
} = await import('./join-route.ts');
type CeremonyChannelLike = import('./join-route.ts').CeremonyChannelLike;

const { openCollabCeremony, STRINGS: DIALOG_STRINGS, JOIN_ROUTE, REPLY_ROUTE } =
  await import('../components/collab-ceremony.ts');
type CeremonyConnectedHandle = import('../components/collab-ceremony.ts').CeremonyConnectedHandle;
type CeremonyEffectsBundle = import('../components/collab-ceremony.ts').CeremonyEffectsBundle;
type CollabCeremonyHandle = import('../components/collab-ceremony.ts').CollabCeremonyHandle;
type CollabCeremonyOptions = import('../components/collab-ceremony.ts').CollabCeremonyOptions;

const { ANSWER_PARAM, INVITE_PARAM, SDP_CODEC_VERSION, encodeToken, pack } = await import('./sdp-codec.ts');
type InviteMeta = import('./sdp-codec.ts').InviteMeta;
type SdpMaterial = import('./sdp-codec.ts').SdpMaterial;

const { _clearCollabMountForTests, parkedCount, registerCollabMount, takeParked } =
  await import('../lib/collab-mount.ts');
type CollabConnection = import('../lib/collab-mount.ts').CollabConnection;
type JoinRouteHost = import('./join-route.ts').JoinRouteHost;
type JoinRouteProfile = import('./join-route.ts').JoinRouteProfile;

const { PRIVATE_COLLAB_FLAG, isFlagOnSync, setFlagMirror } = await import('../feature-flags.ts');
const { initOrg, _resetOrgForTests } = await import('../org/index.ts');
const { announce } = await import('../a11y.ts');

// The live region `announce()` writes into, captured NOW: a11y.ts caches the node it
// created, and `beforeEach` empties <body>, so after the first reset the element is
// detached and unfindable by selector while still being the one announcements land in.
announce('capture the region');
const liveRegion = dom.window.document.querySelector('[data-a11y-live]')!;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function material(): SdpMaterial {
  return {
    fingerprint: { algo: 'sha-256', bytes: Uint8Array.from({ length: 32 }, (_, i) => (i * 7) & 0xff) },
    iceUfrag: 'ab12',
    icePwd: 'abcdefghijklmnopqrstuv',
    candidates: [{ type: 'host', protocol: 'udp', address: '192.168.1.9', port: 51234 }],
    setupRole: 'actpass',
  };
}

function inviteToken(over: Partial<InviteMeta> = {}): string {
  const packed = pack({
    kind: 'invite',
    material: material(),
    invite: {
      v: SDP_CODEC_VERSION,
      toolId: 'qr-code',
      toolVersion: '2.1.0',
      engineVersion: '1.108.0',
      name: 'Priya',
      ...over,
    },
  });
  assert.ok(packed.ok, 'fixture invite must pack');
  return encodeToken(packed.value, 'link');
}

function answerToken(): string {
  const packed = pack({ kind: 'answer', material: material() });
  assert.ok(packed.ok, 'fixture answer must pack');
  return encodeToken(packed.value, 'link');
}

/** Effects that drive the machine by hand - no WebRTC, no camera, no catalog. */
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
/** A macrotask turn, which is what `announce()`'s rAF shim (a setTimeout) needs. */
const frame = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

/**
 * A profile host that really stores what it is given, so "the flag persisted" can be
 * asserted against a RECORD rather than against the localStorage mirror alone. `set` is
 * omitted when `writable` is false - the structure of a host that cannot save.
 */
function profileHost(writable = true): { host: JoinRouteHost; writes: JoinRouteProfile[]; record: () => JoinRouteProfile } {
  let record: JoinRouteProfile = { firstname: 'Sam' };
  const writes: JoinRouteProfile[] = [];
  const profile: JoinRouteHost['profile'] = {
    get: async () => record,
    ...(writable
      ? { set: async (next: JoinRouteProfile) => { record = next; writes.push(next); } }
      : {}),
  };
  return { host: { profile }, writes, record: () => record };
}

const actOn = (el: Element, act: string): HTMLElement | null => el.querySelector<HTMLElement>(`[data-act="${act}"]`);

function view(): HTMLElement {
  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  return el as unknown as HTMLElement;
}

const titleOf = (el: Element): string => el.querySelector('[data-collab-title]')?.textContent ?? '';
const bodyOf = (el: Element): string => el.querySelector('[data-collab-body]')?.textContent ?? '';
const headingOf = (el: Element): string => el.querySelector('[data-cer-heading]')?.textContent ?? '';

/** `#view` as main.ts treats it: one element carrying the mounted route's teardown. */
type RoutedView = HTMLElement & { _cleanup?: () => void };

/** An inviter dialog sitting on step 1 with its invite minted - a window that can take a reply. */
async function waitingInviter(): Promise<CollabCeremonyHandle> {
  const dialog = trackedOpen({ role: 'inviter', effects: plainEffects(), toolId: 'qr-code', copy: () => {} });
  dialog.el.querySelector<HTMLElement>('[data-act="create-invite"]')!.click();
  await settle();
  return dialog;
}

/** Every dialog a test opened, so one leaking into the next is impossible. */
const openDialogs: CollabCeremonyHandle[] = [];
function trackedOpen(opts: CollabCeremonyOptions): CollabCeremonyHandle {
  const handle = openCollabCeremony(opts);
  openDialogs.push(handle);
  return handle;
}

beforeEach(() => {
  while (openDialogs.length) openDialogs.pop()?.close();
  _clearCollabMountForTests();
  dom.window.document.body.replaceChildren();
  // The gate's default read is the real synchronous mirror. Since 2026-08-10 the flag is
  // ON by default, so writing `false` here is not "the shipped state" any more - it is a
  // user who explicitly TURNED IT OFF, which is exactly the arrival the enable card
  // exists for and the state most tests below want. The fresh-profile arrival (no stored
  // choice at all) is its own test, which clears the mirror itself.
  setFlagMirror(PRIVATE_COLLAB_FLAG.id, false);
  liveRegion.textContent = '';
});

// ── A fake BroadcastChannel ───────────────────────────────────────────────────

/**
 * Two endpoints on one name, with the real API's defining behaviour: a message reaches
 * every OTHER endpoint and never the sender. That asymmetry is the whole reason the
 * handoff can use an ack at all, so faking it any other way would test nothing.
 */
function channelHub(): { open(): CeremonyChannelLike; posts: unknown[] } {
  const endpoints = new Set<Endpoint>();
  const posts: unknown[] = [];

  class Endpoint implements CeremonyChannelLike {
    private readonly listeners = new Set<(event: { data?: unknown }) => void>();
    private closed = false;

    postMessage(data: unknown): void {
      if (this.closed) return;
      posts.push(data);
      for (const peer of [...endpoints]) {
        if (peer === this || peer.closed) continue;
        for (const fn of [...peer.listeners]) fn({ data });
      }
    }

    addEventListener(_type: 'message', fn: (event: { data?: unknown }) => void): void {
      this.listeners.add(fn);
    }

    removeEventListener(_type: 'message', fn: (event: { data?: unknown }) => void): void {
      this.listeners.delete(fn);
    }

    close(): void {
      this.closed = true;
      this.listeners.clear();
      endpoints.delete(this);
    }
  }

  return {
    open(): CeremonyChannelLike {
      const endpoint = new Endpoint();
      endpoints.add(endpoint);
      return endpoint;
    },
    posts,
  };
}

// ── #/join: the gates, before anything platform happens ───────────────────────

// ── The flag gate's three arrivals (section 6.3 enable-on-accept) ───────────────────
//
// The old behaviour was one screen: "turn it on in your profile settings, then open the
// link again". That is a dead end at the only moment the reader had a reason to care, so
// the gate asks a different question first - who decided this? - and since 2026-08-10 the
// flag is ON by default, which adds a third arrival that skips the gate entirely. The
// truth table these tests pin:
//
//   fresh profile / no stored choice  → straight into the ceremony, no card at all
//   explicitly off (or an instance default of off, toggle still shown) → the enable card
//   governed off (a control plane HIDES the flag) → the refusal that names the decider
//
// plus the one property that makes the offer safe to show to a stranger: it says nothing
// about the token in the link.

test('#/join: a FRESH profile joins straight away - on by default means no card at all', async () => {
  // The arrival the 2026-08-10 flip is for. No mirror entry for the flag, no profile
  // record, no `flagOn` override: the route's REAL read resolves a missing value to the
  // built-in default, and the reader goes to the ceremony holding the invite they clicked.
  dom.window.localStorage.clear();
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
    profileName: 'Sam',
  });
  await settle();

  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true, 'nothing stored ⇒ the built-in default, which is on');
  assert.equal(actOn(el, 'enable-collab'), null, 'a reader who never turned it off is not asked to turn it on');
  assert.equal(titleOf(el), STRINGS.joinTitle, 'the page behind the dialog is the ordinary join page');
  assert.equal(headingOf(openDialogs.at(-1)!.el), DIALOG_STRINGS.acceptNameHeading, 'and the invite was delivered');
});

test('#/join: an UNGOVERNED device whose user turned it OFF is offered the feature, not a dead end', async () => {
  const el = view();
  let opened = 0;
  const mounting = mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: () => { opened += 1; return { el: null as never, close: () => {} }; },
  });
  await settle();

  assert.equal(titleOf(el), STRINGS.enableTitle);
  assert.equal(bodyOf(el), STRINGS.enableBody, 'one plain paragraph on what the thing is');
  assert.equal(actOn(el, 'enable-collab')?.textContent, STRINGS.enableAction);
  assert.equal(actOn(el, 'enable-decline')?.textContent, STRINGS.enableDecline);
  assert.equal(opened, 0, 'nothing platform happens while the offer is on screen');
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false, 'and showing the card turns nothing on');

  actOn(el, 'enable-decline')!.click();
  await mounting;
});

test('#/join: the enable card is announced when it appears, and again when it is accepted', async () => {
  const el = view();
  const { host } = profileHost();
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  await frame();
  assert.equal(liveRegion.textContent, STRINGS.enableTitle, 'a card nobody can see must still be heard');

  liveRegion.textContent = '';
  actOn(el, 'enable-collab')!.click();
  await mounting;
  await frame();
  assert.equal(liveRegion.textContent, STRINGS.enableDone, 'and the thing it did is said out loud too');
});

test('#/join: a GOVERNED device names the organization as the decider and offers no button', async () => {
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => true,
    openCeremony: () => { throw new Error('unreachable'); },
  });

  assert.equal(titleOf(el), STRINGS.governedTitle);
  assert.match(bodyOf(el), /organization/, 'a refusal that hides who made it is not honest');
  assert.equal(actOn(el, 'enable-collab'), null, 'a button that could not work would be a lie');
  assert.equal(actOn(el, 'enable-decline'), null);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false);
});

test('#/join: "governed" means the flag is FORCED, not merely defaulted by the instance', async () => {
  // The distinction the branch turns on, driven through the real org seam rather than a
  // re-statement of it: `hidden` is a control plane taking the decision away (no toggle
  // exists, the value is forced), while a bare `default` leaves the choice with the user
  // - who must therefore still be offered it.
  const realFetch = globalThis.fetch;
  const plane = (featureFlags: Record<string, { default?: boolean; hidden?: boolean }>) => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown): Response =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/api/auth/config')) return json({ mode: 'open', provider: 'oidc', loginPath: '/login' });
      if (url.includes('/api/auth/session')) return json({ kind: 'member', user: { sub: 'u1', role: 'member' } });
      if (url.includes('/api/v1/org-config')) return json({ instance: { name: 'Acme' }, inboxUnread: 0, featureFlags });
      return new Response('', { status: 404 });
    }) as typeof fetch;
  };

  try {
    // Forced off: the toggle is gone, so the decision is not the reader's to make.
    _resetOrgForTests();
    plane({ [PRIVATE_COLLAB_FLAG.id]: { default: false, hidden: true } });
    await initOrg();
    setFlagMirror(PRIVATE_COLLAB_FLAG.id, false);
    const forced = view();
    await mountJoinRoute(forced, null, `${INVITE_PARAM}=${inviteToken()}`, {
      openCeremony: () => { throw new Error('unreachable'); },
    });
    assert.equal(titleOf(forced), STRINGS.governedTitle, 'a hidden (forced) flag is the organization\'s call');

    // Defaulted off with the toggle still visible: the instance has an opinion, the user
    // still has the say, and the enable card is what respects that.
    _resetOrgForTests();
    plane({ [PRIVATE_COLLAB_FLAG.id]: { default: false, hidden: false } });
    await initOrg();
    setFlagMirror(PRIVATE_COLLAB_FLAG.id, false);
    const defaulted = view();
    const mounting = mountJoinRoute(defaulted, null, `${INVITE_PARAM}=${inviteToken()}`, {
      openCeremony: () => { throw new Error('unreachable'); },
    });
    await settle();
    assert.equal(titleOf(defaulted), STRINGS.enableTitle, 'an instance default is not a decision taken away');
    actOn(defaulted, 'enable-decline')!.click();
    await mounting;
  } finally {
    _resetOrgForTests();
    globalThis.fetch = realFetch;
    setFlagMirror(PRIVATE_COLLAB_FLAG.id, false);
  }
});

test('#/join: "Turn on and continue" writes the flag to the PROFILE, not just the mirror', async () => {
  const el = view();
  const { host, writes, record } = profileHost();
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  actOn(el, 'enable-collab')!.click();
  await mounting;

  // The record, which is what survives a reload - the mirror alone would light the
  // feature up for exactly one page load and lose it on the next boot.
  assert.equal(writes.length, 1, 'the profile was written once');
  assert.equal(record().featureFlags?.[PRIVATE_COLLAB_FLAG.id], true);
  assert.equal(record().firstname, 'Sam', 'and the rest of the record is carried, not clobbered');
  // And the synchronous mirror, which is what every flag-gated surface reads this page load.
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true);
});

test('#/join: turning it on falls straight through into the ceremony, with no reload and no re-paste', async () => {
  const el = view();
  const { host } = profileHost();
  // No `flagOn` override: the gate re-runs its REAL read after the write, which is the
  // thing that makes "no reload" true rather than merely asserted.
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  assert.equal(openDialogs.length, 0, 'no ceremony before the decision');

  actOn(el, 'enable-collab')!.click();
  await mounting;
  await settle();

  const dialog = openDialogs.at(-1)!;
  assert.equal(headingOf(dialog.el), DIALOG_STRINGS.acceptNameHeading, 'the invite was delivered, not asked for again');
  assert.ok(dialog.el.textContent?.includes('qr-code'), 'and it is the SAME invite the link carried');
  assert.equal(titleOf(el), STRINGS.joinTitle, 'the page behind it is the ordinary join page');
  assert.equal(el.textContent?.includes(STRINGS.enableNotSaved), false, 'a saved choice claims nothing else');
});

test('#/join: a host that cannot save the choice says so rather than implying it was kept', async () => {
  const el = view();
  const { host } = profileHost(false); // no `set` at all - the structure of a host that cannot write
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  actOn(el, 'enable-collab')!.click();
  await mounting;
  await settle();

  // The invite still opens - it is time-limited, and refusing it would be the worse
  // answer - but the page does not let the reader believe a preference was saved.
  assert.equal(headingOf(openDialogs.at(-1)!.el), DIALOG_STRINGS.acceptNameHeading);
  assert.ok(el.textContent?.includes(STRINGS.enableNotSaved), el.textContent ?? '');
  await frame();
  assert.equal(liveRegion.textContent, STRINGS.enableNotSaved, 'and it is the line a reader hears, not the cheerful one');
});

test('#/join: "Not now" turns nothing on and says what was not done', async () => {
  const el = view();
  const { host, writes } = profileHost();
  let opened = 0;
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: () => { opened += 1; return { el: null as never, close: () => {} }; },
  });
  await settle();
  actOn(el, 'enable-decline')!.click();
  await mounting;

  assert.equal(titleOf(el), STRINGS.declinedTitle);
  assert.equal(bodyOf(el), STRINGS.declinedBody);
  assert.equal(writes.length, 0, 'declining writes nothing');
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false);
  assert.equal(opened, 0);
  assert.ok(el.querySelector('a[href="#/"]'), 'and the way back is still on the page');
});

test('#/join: Esc is the same answer as "Not now", not a quieter one', async () => {
  const el = view();
  const { host, writes } = profileHost();
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: () => { throw new Error('unreachable'); },
  });
  await settle();
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await mounting;

  assert.equal(titleOf(el), STRINGS.declinedTitle, 'a key that dismissed the offer silently would leave a reader guessing');
  assert.equal(writes.length, 0);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), false);

  // And the listener is gone with the card: a later Escape must not repaint over
  // whatever the reader went on to.
  el.replaceChildren(dom.window.document.createTextNode('THE NEXT VIEW'));
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  assert.equal(el.textContent, 'THE NEXT VIEW');
});

test('#/join: the gate is not an oracle - a mangled invite gets the SAME card as a good one', async () => {
  // The ordering property section 6.3 asks for. If the flag-off screen varied with the token,
  // anyone could learn which blobs this build considers valid without ever turning the
  // feature on, and a reader would be told about a stranger's link before being asked
  // anything at all.
  const cases: Array<[string, string]> = [
    ['good', `${INVITE_PARAM}=${inviteToken()}`],
    ['mangled', `${INVITE_PARAM}=not-a-real-token!!`],
    ['a reply, not an invite', `${INVITE_PARAM}=${answerToken()}`],
    ['nothing at all', ''],
  ];

  for (const [name, params] of cases) {
    const el = view();
    const mounting = mountJoinRoute(el, null, params, { governedOff: () => false, openCeremony: () => { throw new Error('unreachable'); } });
    await settle();
    assert.equal(titleOf(el), STRINGS.enableTitle, `${name}: the ungoverned card must not vary with the token`);
    assert.equal(bodyOf(el), STRINGS.enableBody, `${name}: nor its body`);
    actOn(el, 'enable-decline')!.click();
    await mounting;

    const governed = view();
    await mountJoinRoute(governed, null, params, { governedOff: () => true, openCeremony: () => { throw new Error('unreachable'); } });
    assert.equal(titleOf(governed), STRINGS.governedTitle, `${name}: the governed refusal must not vary either`);
  }
});

test('#/join: once the feature is on, the SAME mangled invite gets its normal error card', async () => {
  // The other half of the property: the verdict is not suppressed, only deferred to the
  // point where the reader has asked for it.
  const el = view();
  const { host } = profileHost();
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=not-a-real-token!!`, {
    governedOff: () => false,
    openCeremony: () => { throw new Error('unreachable'); },
  });
  await settle();
  assert.equal(titleOf(el), STRINGS.enableTitle);
  actOn(el, 'enable-collab')!.click();
  await mounting;

  assert.equal(titleOf(el), STRINGS.unreadableTitle);
  assert.equal(isFlagOnSync(PRIVATE_COLLAB_FLAG), true, 'the choice they made still stands');
});

test('#/join: navigating away from the enable card settles the mount and paints nothing', async () => {
  const el = view() as RoutedView;
  const { host, writes } = profileHost();
  let opened = 0;
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    governedOff: () => false,
    openCeremony: () => { opened += 1; return { el: null as never, close: () => {} }; },
  });
  await settle();
  assert.equal(typeof el._cleanup, 'function', 'the teardown is stamped before the gate, not after it');

  el._cleanup?.();
  delete el._cleanup;
  el.replaceChildren(dom.window.document.createTextNode('THE NEXT VIEW'));
  // The mount was parked on a human. Teardown has to settle it, or this never resolves.
  await mounting;

  assert.equal(el.textContent, 'THE NEXT VIEW', 'no declined card lands on the view that replaced this one');
  assert.equal(writes.length, 0, 'and leaving is not a decision');
  assert.equal(opened, 0);
});

test('#/join: the flag gate still refuses honestly when neither the record nor the mirror took', async () => {
  // The pathological end of the enable path: the write is attempted, nothing sticks, and
  // the re-run gate says the true thing rather than opening a ceremony on a feature that
  // is still off. `flagOn` is pinned off here precisely to stand in for that.
  const el = view();
  const { host } = profileHost();
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => false,
    governedOff: () => false,
    openCeremony: () => { throw new Error('unreachable'); },
  });
  await settle();
  actOn(el, 'enable-collab')!.click();
  await mounting;
  assert.equal(titleOf(el), STRINGS.offTitle);
  assert.equal(bodyOf(el), STRINGS.offBody, 'a refusal that says nothing is a dead end');
});

test('#/join: a link whose invite was emptied on the way says so', async () => {
  // `inv=` PRESENT and blank. A link was built and then damaged, which is a fact about
  // that link - distinct from arriving with no `inv` at all, which is the code door
  // below. The two used to be one screen, and it was the wrong one for both.
  const el = view() as RoutedView;
  const mounting = mountJoinRoute(el, null, `${INVITE_PARAM}=`, {
    flagOn: () => true,
    openCeremony: () => { throw new Error('unreachable'); },
  });
  await mounting;
  assert.equal(titleOf(el), STRINGS.emptyTitle);
  assert.equal(el.querySelector(CODE_FIELD_SELECTOR), null, 'a damaged link is not the code door');
});

test('#/join: an unreadable invite is a plain error view, never a throw', async () => {
  const el = view();
  await assert.doesNotReject(() =>
    mountJoinRoute(el, null, `${INVITE_PARAM}=not-a-real-token!!`, {
      flagOn: () => true,
      openCeremony: () => { throw new Error('unreachable'); },
    }));
  assert.equal(titleOf(el), STRINGS.unreadableTitle);
});

test('#/join: a truncated invite is unreadable rather than half-accepted', async () => {
  const el = view();
  const token = inviteToken();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${token.slice(0, 20)}`, {
    flagOn: () => true,
    openCeremony: () => { throw new Error('unreachable'); },
  });
  assert.equal(titleOf(el), STRINGS.unreadableTitle);
});

test('#/join: a REPLY link opened on the wrong device is named for what it is', async () => {
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    openCeremony: () => { throw new Error('unreachable'); },
  });
  assert.equal(titleOf(el), STRINGS.wrongKindTitle);
});

// ── #/join: the code door ─────────────────────────────────────────────────────
//
// Andy's first real test of the ceremony ended at "how does one use the invite code" - 
// there was an invite code, and no field in the whole app to put it in. These pin the
// field, and pin the thing that makes it safe to have: it decodes with the SAME
// `readSignal` call the URL token decodes with, and then walks the SAME path, so there
// is no second, laxer way into a ceremony.

/** Type into the code door the way a human does: value, input event, button. */
function pasteCode(el: HTMLElement, text: string): void {
  const field = el.querySelector<HTMLTextAreaElement>(CODE_FIELD_SELECTOR);
  assert.ok(field, 'the code door has no field');
  field.value = text;
  field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  actOn(el, 'submit-code')!.click();
}

const noticeOf = (el: Element): string => el.querySelector('.note--warning')?.textContent ?? '';

test('#/join with no invite in the link is a paste card, and a pasted code walks the link path', async () => {
  const el = view();
  const mounting = mountJoinRoute(el, null, '', {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
    channel: null,
  });
  await settle();

  assert.equal(titleOf(el), STRINGS.codeTitle, 'no invite in the link is a door, not a dead end');
  assert.equal(bodyOf(el), STRINGS.codeBody);
  assert.equal(actOn(el, 'submit-code')?.textContent, STRINGS.codeAction);
  assert.equal(openDialogs.length, 0, 'nothing platform happens until there is an invite');

  pasteCode(el, inviteToken());
  await mounting;
  await settle();

  // The end state is the LINK path's end state, arrived at through the field: a real
  // acceptor dialog that ran its own decode and probe and moved off the paste screen.
  const dialog = openDialogs.at(-1)!;
  assert.equal(headingOf(dialog.el), DIALOG_STRINGS.acceptNameHeading);
  assert.ok(dialog.el.textContent?.includes('qr-code'), 'the tool from the pasted invite is named');
  assert.equal(titleOf(el), STRINGS.joinTitle, 'and the page behind it is the ordinary join page');
});

test('#/join: the code door takes a whole invite LINK too, not only the bare code', async () => {
  // What is actually on a person's clipboard is whatever the other device sent them, and
  // that is usually the link. `readSignal` already unwraps one - this pins that the door
  // leans on that rather than demanding the naked token.
  const el = view();
  const mounting = mountJoinRoute(el, null, '', {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
    channel: null,
  });
  await settle();
  pasteCode(el, `https://lolly.tools/${JOIN_ROUTE}?${INVITE_PARAM}=${inviteToken()}`);
  await mounting;
  await settle();
  assert.equal(headingOf(openDialogs.at(-1)!.el), DIALOG_STRINGS.acceptNameHeading);
});

test('#/join: a REPLY code pasted into the code door is named, and the field comes back', async () => {
  const el = view() as RoutedView;
  const reply = answerToken();
  const mounting = mountJoinRoute(el, null, '', {
    flagOn: () => true,
    openCeremony: () => { throw new Error('unreachable'); },
    channel: null,
  });
  await settle();
  pasteCode(el, reply);

  // Not "unreadable" - it decoded perfectly. It is the right code in the wrong window,
  // and the only useful thing to say is where the right window is.
  assert.equal(titleOf(el), STRINGS.codeReplyTitle);
  assert.equal(bodyOf(el), STRINGS.codeReplyBody);
  assert.equal(el.querySelector(CODE_FIELD_SELECTOR), null, 'the misfire is a card, not a notice');

  actOn(el, 'code-retry')!.click();
  assert.equal(titleOf(el), STRINGS.codeTitle, 'and it is one hop back to the field');
  assert.equal(
    el.querySelector<HTMLTextAreaElement>(CODE_FIELD_SELECTOR)?.value,
    reply,
    'what they pasted survives the round trip - retyping it would be the fix for nothing',
  );

  el._cleanup?.();
  await mounting;
});

test('#/join: an empty paste is refused beside the field, not on a page of its own', async () => {
  const el = view() as RoutedView;
  const mounting = mountJoinRoute(el, null, '', {
    flagOn: () => true,
    openCeremony: () => { throw new Error('unreachable'); },
    channel: null,
  });
  await settle();

  actOn(el, 'submit-code')!.click();
  assert.equal(noticeOf(el), STRINGS.codeEmpty);
  assert.equal(titleOf(el), STRINGS.codeTitle, 'a slip does not cost the card');
  assert.ok(el.querySelector(CODE_FIELD_SELECTOR), 'nor the field');

  // And the same for text that is not a Lolly code at all - one paste away from right.
  pasteCode(el, 'not-a-real-token!!');
  assert.equal(noticeOf(el), STRINGS.codeUnreadable);
  assert.equal(
    el.querySelector<HTMLTextAreaElement>(CODE_FIELD_SELECTOR)?.value,
    'not-a-real-token!!',
    'the text stays put so it can be fixed rather than re-found',
  );

  el._cleanup?.();
  await mounting;
});

test('#/join: leaving the code door settles the mount and paints nothing', async () => {
  const el = view() as RoutedView;
  const mounting = mountJoinRoute(el, null, '', {
    flagOn: () => true,
    openCeremony: () => { throw new Error('unreachable'); },
    channel: null,
  });
  await settle();
  assert.equal(titleOf(el), STRINGS.codeTitle);

  el._cleanup?.();
  delete el._cleanup;
  el.replaceChildren(dom.window.document.createTextNode('THE NEXT VIEW'));
  // The mount is parked on a human at a field. Teardown has to settle it, exactly as it
  // does for the enable card, or this never resolves.
  await mounting;
  assert.equal(el.textContent, 'THE NEXT VIEW');
});

// ── #/join: the ceremony it opens ─────────────────────────────────────────────

test('#/join: opens the ACCEPTOR ceremony with the invite already delivered', async () => {
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
    profileName: 'Sam',
  });
  const dialog = openDialogs.at(-1)!;
  // The real dialog ran its own readSignal + probe and moved off the paste screen: the
  // human clicked a link, so being asked to paste the thing they clicked would be theatre.
  await settle();
  assert.equal(headingOf(dialog.el), DIALOG_STRINGS.acceptNameHeading);
  assert.ok(dialog.el.textContent?.includes('qr-code'), 'the tool from the invite is named');
  assert.equal(titleOf(el), STRINGS.joinTitle, 'the page behind the dialog says where you are');
});

test('#/join: a missing tool is the ceremony\'s refusal, not the route\'s', async () => {
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects({ checkTool: async () => ({ status: 'missing' as const }) }),
    renderQr: null,
    scan: null,
  });
  await settle();
  assert.equal(headingOf(openDialogs.at(-1)!.el), DIALOG_STRINGS.fail['tool-missing'].title);
});

test('#/join: closing the ceremony leaves the page saying so', async () => {
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  openDialogs.at(-1)!.close();
  assert.equal(bodyOf(el), STRINGS.joinDone);
});

test('#/join: navigating away closes the dialog without repainting a view being replaced', async () => {
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  (el as RoutedView)._cleanup?.();
  assert.equal(openDialogs.at(-1)!.el.isConnected, false, 'the dialog is gone with the view');
  assert.notEqual(bodyOf(el), STRINGS.joinDone, 'the router is leaving - the page has nothing to say');
});

test('#/join: a route torn down mid-mount opens nothing and keeps the next view\'s teardown', async () => {
  // The profile read is one of three awaits between the first paint and the dialog.
  let arrive: (() => void) | undefined;
  const host = {
    profile: { get: () => new Promise<{ firstname?: string }>((resolve) => { arrive = () => resolve({ firstname: 'Sam' }); }) },
  };

  const el = view() as RoutedView;
  let opened = 0;
  const mounting = mountJoinRoute(el, host, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    openCeremony: (opts) => { opened += 1; return trackedOpen(opts); },
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  assert.equal(typeof el._cleanup, 'function', 'the teardown is stamped before the awaits, not after them');
  assert.ok(arrive, 'the mount is parked on the profile read');

  // Exactly what main.ts does on the next navigation, then the incoming view stamps its own.
  el._cleanup?.();
  delete el._cleanup;
  let nextTornDown = 0;
  el._cleanup = () => { nextTornDown += 1; };
  el.replaceChildren(dom.window.document.createTextNode('THE NEXT VIEW'));

  arrive!();
  await mounting;
  assert.equal(opened, 0, 'no ceremony is opened over a view the router has already left');
  assert.equal(el.textContent, 'THE NEXT VIEW', 'and nothing is painted into it');
  el._cleanup?.();
  assert.equal(nextTornDown, 1, "the next view's own teardown is the one still installed");
});

test('#/join: closing the ceremony hangs up a pair nobody adopted', async () => {
  const el = view();
  let fire: ((handle: CeremonyConnectedHandle) => void) | undefined;
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    // No `effects`: the real composition runs, so there is a transport to hang up.
    openCeremony: (opts) => { fire = opts.onConnected; return trackedOpen({ ...opts, onConnected: undefined }); },
    renderQr: null,
    scan: null,
  });
  await settle();
  fire!({ toolId: 'qr-code', close: () => {} } as unknown as CeremonyConnectedHandle);
  assert.equal(parkedCount(), 1, 'nothing owns co-editing yet, so a completed pairing is parked');

  openDialogs.at(-1)!.close();
  assert.equal(bodyOf(el), STRINGS.joinDone);
  assert.equal(parkedCount(), 0, 'the page says nothing else is being shared, and the peer connection is gone');
});

// ── The own-invite note ───────────────────────────────────────────────────────
//
// Testing an invite in two tabs of one browser is legitimate - it is how this ceremony
// is drilled - and the app used to say nothing about it, so a person who did it had no
// way to tell "this works" from "this is the same device talking to itself". The note is
// that sentence. It is INFORMATION: everything below pins that it never becomes a gate,
// and that its absence leaves the flow byte-for-byte as it was.

test('the invite stamp is the dialog\'s own, and outlives the screen that shows the token', async () => {
  const inviter = await waitingInviter();
  assert.equal(dialogInvite(inviter.el), inviteToken(), 'an inviter states the invite it minted');
  assert.ok(inviter.el.matches(INVITE_STAMP_SELECTOR), 'and states it on the dialog, not inside the screen');

  actOn(inviter.el, 'to-waiting')!.click();
  await settle();
  assert.equal(
    inviter.el.querySelector('[data-token="copy-invite-link"]'),
    null,
    'step 2 has no token slot - which is the whole reason the stamp is not read off one',
  );
  assert.equal(dialogInvite(inviter.el), inviteToken(), 'the answer does not change because the human clicked Next');
});

test('an ACCEPTOR dialog minted nothing, and says so', async () => {
  const dialog = trackedOpen({ role: 'acceptor', effects: plainEffects(), copy: () => {} });
  assert.equal(dialogInvite(dialog.el), '', 'no invite is nobody\'s own invite');
});

test('#/join: an invite minted in this browser gets one dismissible note, and nothing else', async () => {
  const hub = channelHub();
  const inviter = await waitingInviter();
  const stop = listenForReply(hub.open(), () => inviter.el);

  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
    channel: () => hub.open(),
    askMs: 0,
  });
  await settle();

  const dialog = openDialogs.at(-1)!;
  const note = dialog.el.querySelector('[data-collab-own-invite]');
  assert.ok(note, 'the one window that could answer did, so the reader is told');
  assert.ok(note.textContent?.includes(STRINGS.ownInvite));
  assert.equal(dialog.el.firstElementChild, note, 'above the flow, not buried in the step');
  assert.equal(
    headingOf(dialog.el),
    DIALOG_STRINGS.acceptNameHeading,
    'and the ceremony ran exactly as it would have - the note gates nothing',
  );

  actOn(dialog.el, 'dismiss-own-invite')!.click();
  assert.equal(dialog.el.querySelector('[data-collab-own-invite]'), null, 'a note nobody can dismiss is a warning');
  stop();
});

test('#/join: with nobody answering the ask, the flow is byte-identical to one that never asked', async () => {
  // The property that makes an informational ask safe to fire on every join: the ordinary
  // case - an invite from somebody else's device - must not be able to tell it happened.
  const quiet = view();
  await mountJoinRoute(quiet, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true, openCeremony: trackedOpen, effects: plainEffects(), renderQr: null, scan: null,
    channel: null,
  });
  await settle();
  const never = openDialogs.at(-1)!.el.innerHTML;

  // A real channel with a real ceremony window on it - which minted a DIFFERENT invite,
  // so it hears the question and rightly says nothing.
  const hub = channelHub();
  const stranger = await waitingInviter();
  stranger.el.setAttribute('data-cer-invite', answerToken());
  const stop = listenForReply(hub.open(), () => stranger.el);

  const asked = view();
  await mountJoinRoute(asked, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true, openCeremony: trackedOpen, effects: plainEffects(), renderQr: null, scan: null,
    channel: () => hub.open(),
    askMs: 0,
  });
  await settle();
  await frame();

  assert.equal(openDialogs.at(-1)!.el.innerHTML, never, 'silence leaves no trace at all');
  assert.equal(bodyOf(asked), bodyOf(quiet));
  stop();
});

test('the ask is answered only by the window that minted that exact invite', async () => {
  const hub = channelHub();
  const inviter = await waitingInviter();
  const stop = answerInviteAsks(hub.open(), () => inviter.el);

  assert.equal(await askOwnInvite(hub.open(), answerToken(), 0), false, 'a different invite is not this one');
  assert.equal(await askOwnInvite(hub.open(), inviteToken(), 0), true);

  // A window with no dialog left is a window with no answer, and must not be an error.
  const gone = answerInviteAsks(hub.open(), () => null);
  stop();
  assert.equal(await askOwnInvite(hub.open(), inviteToken(), 0), false);
  gone();
});

test('the ask vocabulary is total over what another tab could put on the channel', async () => {
  const ask = inviteAskMessage('r1', 'TOKEN');
  assert.deepEqual(readInviteAsk(ask), { rid: 'r1', inv: 'TOKEN' });
  assert.equal(isInviteAck(inviteAckMessage('r1'), 'r1'), true);
  assert.equal(isInviteAck(inviteAckMessage('r2'), 'r1'), false, 'an ack for another ask is not ours');

  for (const junk of [
    null, undefined, 'a string', 42, [],
    { type: 'collab-invite-ask', v: CHANNEL_MESSAGE_VERSION },                  // no token
    { type: 'collab-invite-ask', v: 1, rid: 'r1', inv: 'TOKEN' },               // another version
    { type: 'collab-invite-ask', v: CHANNEL_MESSAGE_VERSION, rid: 'r1', inv: 7 },
    { type: 'collab-invite-ask', v: CHANNEL_MESSAGE_VERSION, rid: '', inv: 'T' },
    Object.create({ type: 'collab-invite-ask', v: CHANNEL_MESSAGE_VERSION, rid: 'r', inv: 'T' }),
  ]) {
    assert.equal(readInviteAsk(junk), null, `read as an ask: ${JSON.stringify(junk)}`);
    assert.equal(isInviteAck(junk, 'r1'), false);
  }
});

test('a ceremony window answers BOTH questions from one wiring', async () => {
  // `listenForReply` is what `collab/private-opener.ts` calls, and it is the only thing
  // it calls - so if the ask rode a second listener nobody wired, it would never answer
  // in production while passing every unit test of its own.
  const hub = channelHub();
  const inviter = await waitingInviter();
  const stop = listenForReply(hub.open(), () => inviter.el);

  assert.equal(await askOwnInvite(hub.open(), inviteToken(), 0), true);
  stop();
  assert.equal(await askOwnInvite(hub.open(), inviteToken(), 0), false, 'one teardown takes both listeners');
});

// ── The invite/reply link shapes (the names that live in two files) ───────────

test('the link the dialog mints is the route the router registers', async () => {
  const dialog = trackedOpen({
    role: 'inviter',
    effects: plainEffects(),
    toolId: 'qr-code',
    linkBase: 'https://lolly.tools/app',
    copy: () => {},
  });
  dialog.el.querySelector<HTMLElement>('[data-act="create-invite"]')!.click();
  await settle();
  const link = dialog.el.querySelector('[data-token="copy-invite-link"]')?.textContent ?? '';
  assert.ok(link.startsWith('https://lolly.tools/app#/join?inv='), link);

  // Parsed the way main.ts parses a hash: everything after '#', split on the first '?'.
  const [path, query] = link.slice(link.indexOf('#') + 1).split('?');
  const parts = (path ?? '').split('/').filter(Boolean);
  assert.deepEqual(parts, ['join']);
  const token = new URLSearchParams(query).get(INVITE_PARAM) ?? '';

  // And the route built from that query gets all the way to the ceremony.
  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${token}`, {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  assert.equal(headingOf(openDialogs.at(-1)!.el), DIALOG_STRINGS.acceptNameHeading);
});

test('the reply link the dialog mints is the reply route, with the param it actually uses', async () => {
  const dialog = trackedOpen({
    role: 'acceptor',
    effects: plainEffects(),
    linkBase: 'https://lolly.tools/app',
    copy: () => {},
  });
  assert.ok(deliverInviteToDialog(dialog.el, inviteToken()));
  await settle();
  dialog.el.querySelector<HTMLElement>('[data-act="join"]')!.click();
  await settle();
  const link = dialog.el.querySelector('[data-token="copy-answer-link"]')?.textContent ?? '';
  assert.ok(link.startsWith(`https://lolly.tools/app#/join-reply?${ANSWER_PARAM}=`), link);
  const [path, query] = link.slice(link.indexOf('#') + 1).split('?');
  assert.deepEqual((path ?? '').split('/').filter(Boolean), ['join-reply']);
  assert.ok(new URLSearchParams(query).get(ANSWER_PARAM), 'the reply token rides the param the dialog wrote');
});

test('the links a route mints point at the app ROOT, never at this page\'s pathname', async () => {
  // jsdom is at https://lolly.tools/app, so a base built from `pathname` would show up
  // here. It must not: production serves a redirect stub at the tool view's own /t/<id>
  // pathname whose bounce drops the fragment, taking the invite with it.
  assert.equal(appLinkBase(), 'https://lolly.tools/');

  const el = view();
  await mountJoinRoute(el, null, `${INVITE_PARAM}=${inviteToken()}`, {
    flagOn: () => true,
    openCeremony: trackedOpen,
    effects: plainEffects(),
    renderQr: null,
    scan: null,
  });
  await settle();
  const dialog = openDialogs.at(-1)!;
  dialog.el.querySelector<HTMLElement>('[data-act="join"]')!.click();
  await settle();
  const link = dialog.el.querySelector('[data-token="copy-answer-link"]')?.textContent ?? '';
  assert.ok(link.startsWith(`https://lolly.tools/#/join-reply?${ANSWER_PARAM}=`), link);
});

test('the route constants, the router source and this module agree on both paths', () => {
  assert.equal(JOIN_ROUTE, '#/join');
  assert.equal(REPLY_ROUTE, '#/join-reply');
  const main = readFileSync(fileURLToPath(new URL('../main.ts', import.meta.url)), 'utf8');
  assert.ok(main.includes("parts[0] === 'join'"), 'main.ts must route the invite link');
  assert.ok(main.includes("parts[0] === 'join-reply'"), 'main.ts must route the reply link');
  assert.ok(main.includes("./collab/private-opener.ts"), "main.ts must import the 'private' opener at boot");
});

/**
 * main.ts's `fastPath` skips waiting on `catalogReady` and navigates straight from
 * whatever `window.__toolIndex` a previous boot cached (or nothing at all). That is
 * safe for 'gallery'/'dashboard': both reconcile in place once the real sync lands
 * (a re-render, or a patched tool count), so a stale or absent cache costs a flash
 * of slightly-wrong data that self-heals a moment later.
 *
 * `#/join` cannot afford that. `probeLocalTool` (this file, above) answers "have" /
 * "missing" / "version-skew" by reading `window.__toolIndex.tools` directly - the
 * exact global the fast path would leave unsynced - and that answer is not a paint
 * that quietly corrects itself: it is the ONE-SHOT refusal or acceptance the acceptor
 * sees before a peer connection ever opens (section 6.1). A tool the device genuinely has,
 * probed against a stale or empty cached index, reads as "missing" and the pair is
 * told the device cannot join - an honest-sounding refusal for a reason that isn't
 * true, with no retry the stranger clicking the link would know to attempt. Routing
 * `#/join` through `catalogReady` first (the `else` branch) is what makes the probe's
 * answer trustworthy, so it must never join the skip-ahead list.
 */
test('main.ts\'s fastPath skip-ahead excludes #/join - the tool probe needs the synced catalog first', () => {
  const main = readFileSync(fileURLToPath(new URL('../main.ts', import.meta.url)), 'utf8');
  const at = main.indexOf('const fastPath =');
  assert.notEqual(at, -1, 'main.ts no longer declares `const fastPath` - update this guard alongside it');
  const end = main.indexOf(';', at);
  assert.notEqual(end, -1, 'could not find the end of the fastPath declaration');
  const body = main.slice(at, end);
  assert.equal(
    /routeName === 'join'/.test(body),
    false,
    "'join' must not appear in main.ts's fastPath expression - #/join needs catalogReady " +
    'awaited first (see the comment above this test)',
  );
  // A floor so a rewritten expression that dropped both real arms could not pass
  // this test vacuously by matching nothing at all.
  assert.match(body, /routeName === 'gallery'/, 'the fastPath scan no longer sees its gallery arm - has it moved?');
  assert.match(body, /routeName === 'dashboard'/, 'the fastPath scan no longer sees its dashboard arm - has it moved?');
});

// ── The reply handoff (section 11.25) ────────────────────────────────────────────────

test('the channel name is the one both halves meet on', () => {
  assert.equal(CEREMONY_CHANNEL_NAME, 'lolly-collab-ceremony');
});

test('reply messages: only our own shape is read, and nothing throws on the rest', () => {
  const v = CHANNEL_MESSAGE_VERSION;
  const grant = replyMessage('abc', { rid: 'r1', bid: 'b1' });
  assert.equal(readReplyMessage(grant), 'abc');
  assert.equal(readReplyMessage(null), null);
  assert.equal(readReplyMessage('a string'), null);
  assert.equal(readReplyMessage({ type: 'collab-reply', v: 99, signal: 'abc' }), null, 'a future version is not ours');
  assert.equal(readReplyMessage({ type: 'collab-reply', v: 1, signal: 'abc' }), null, 'and neither is a spent one');
  assert.equal(readReplyMessage({ type: 'something-else', v, signal: 'abc' }), null);
  assert.equal(readReplyMessage({ type: 'collab-reply', v, signal: '' }), null);
  assert.equal(readReplyMessage({ type: 'collab-reply', v, signal: 'x'.repeat(9999) }), null, 'capped');
  assert.equal(readReplyMessage({ type: 'collab-reply', v }), null, 'no signal, no delivery');
  // Own-property only: a prototype-borne `signal` is not a payload.
  const proto = Object.create({ signal: 'inherited' }) as Record<string, unknown>;
  proto.type = 'collab-reply';
  proto.v = v;
  assert.equal(readReplyMessage(proto), null);
  assert.equal(isReplyAck(replyAckMessage('r1')), true);
  assert.equal(isReplyAck(grant), false);
});

test('the handoff messages are addressed, and an address that is not ours is not read', () => {
  const v = CHANNEL_MESSAGE_VERSION;
  assert.equal(readReplyOffer(replyOfferMessage('r1')), 'r1');
  assert.equal(readReplyOffer(replyBidMessage('r1', 'b1')), null, 'a bid is not an offer');
  assert.equal(readReplyOffer({ type: 'collab-reply-offer', v, rid: '' }), null, 'an empty id is no id');
  assert.equal(readReplyOffer({ type: 'collab-reply-offer', v, rid: 'x'.repeat(200) }), null, 'bounded');
  assert.equal(readReplyOffer({ type: 'collab-reply-offer', v: 1, rid: 'r1' }), null, 'a spent version is not ours');

  assert.equal(readReplyBid(replyBidMessage('r1', 'b1'), 'r1'), 'b1');
  assert.equal(readReplyBid(replyBidMessage('r1', 'b1'), 'r2'), null, 'a bid for another handoff is not a bid');
  const inherited = Object.create({ bid: 'inherited' }) as Record<string, unknown>;
  inherited.type = 'collab-reply-bid';
  inherited.v = v;
  inherited.rid = 'r1';
  assert.equal(readReplyBid(inherited, 'r1'), null, 'own-property only, here too');

  // The whole correlation, in three lines: the payload is readable ONLY by the window it
  // was addressed to. Everyone else on the channel sees a message that is not for them.
  const grant = replyMessage('abc', { rid: 'r1', bid: 'b1' });
  assert.deepEqual(readReplyGrant(grant, 'b1'), { rid: 'r1', signal: 'abc' });
  assert.equal(readReplyGrant(grant, 'b2'), null, 'a reply addressed elsewhere is not this window\'s');
  assert.equal(readReplyGrant({ type: 'collab-reply', v, signal: 'abc' }, 'b1'), null, 'an unaddressed reply reaches nobody');
  assert.equal(isReplyAck(replyAckMessage('r1'), 'r1'), true);
  assert.equal(isReplyAck(replyAckMessage('r2'), 'r1'), false, 'an ack for another handoff is not ours');
});

test('handoff: a waiting invite window takes the reply, acks it, and this tab stands down', async () => {
  const hub = channelHub();

  // The inviter's tab: a real dialog on step 1, with the listener the opener wires.
  const inviter = trackedOpen({ role: 'inviter', effects: plainEffects(), toolId: 'qr-code', copy: () => {} });
  inviter.el.querySelector<HTMLElement>('[data-act="create-invite"]')!.click();
  await settle();
  const inviterChannel = hub.open();
  const stop = listenForReply(inviterChannel, () => inviter.el);

  // The reply tab.
  const el = view();
  let closed = 0;
  await mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    channel: () => hub.open(),
    closeWindow: () => { closed += 1; },
    didClose: () => false,
  });

  assert.equal(closed, 1, 'a delivered reply tries to get out of the way');
  assert.equal(bodyOf(el), STRINGS.replyDelivered, 'a tab that cannot close says so instead of hanging');
  // The reply landed through the dialog's OWN paste path, so the ceremony moved on.
  assert.equal(headingOf(inviter.el), DIALOG_STRINGS.applyHeading);
  stop();
});

test('handoff: a reply that arrives while the invite is still on screen advances the step first', async () => {
  const hub = channelHub();
  const inviter = await waitingInviter();
  // Step 1 is showing: there is no reply field on screen at all.
  assert.equal(headingOf(inviter.el), DIALOG_STRINGS.inviteHeading);
  assert.equal(inviter.el.querySelector('#collab-cer-reply'), null);
  assert.equal(canTakeReply(inviter.el), true, 'step 1 can still reach the reply field, so it bids');

  const stop = listenForReply(hub.open(), () => inviter.el);
  const el = view();
  await mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    channel: () => hub.open(),
    closeWindow: () => {},
    didClose: () => false,
  });
  assert.equal(headingOf(inviter.el), DIALOG_STRINGS.applyHeading, 'the handoff pressed "Next" for the human');
  assert.equal(bodyOf(el), STRINGS.replyDelivered);
  stop();
});

test('handoff: two invite windows waiting means NEITHER is fed a reply meant for the other', async () => {
  const hub = channelHub();
  const first = await waitingInviter();
  const second = await waitingInviter();
  const stops = [listenForReply(hub.open(), () => first.el), listenForReply(hub.open(), () => second.el)];

  const el = view();
  let closed = 0;
  await mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    channel: () => hub.open(),
    closeWindow: () => { closed += 1; },
  });

  // A reply broadcast raw is a valid answer to BOTH offers, and the one it does not
  // belong to would spend its ceremony connecting to nobody. Neither moved.
  assert.equal(headingOf(first.el), DIALOG_STRINGS.inviteHeading);
  assert.equal(headingOf(second.el), DIALOG_STRINGS.inviteHeading);
  assert.equal(closed, 0, 'and the tab holding the reply does not claim it landed');
  assert.equal(titleOf(el), STRINGS.replyManyTitle);
  assert.ok(el.querySelector('[data-collab-reply-code]')?.textContent, 'the code is still there to paste by hand');
  for (const stop of stops) stop();
});

test('handoff: a window with no reply to take never bids, so nothing is delivered to it', async () => {
  const hub = channelHub();
  // An ACCEPTOR dialog is on the channel too (both roles wire the same listener), and it
  // has no reply field and no way to reach one.
  const acceptor = trackedOpen({ role: 'acceptor', effects: plainEffects(), copy: () => {} });
  assert.equal(canTakeReply(acceptor.el), false);
  const stop = listenForReply(hub.open(), () => acceptor.el);

  const el = view();
  await mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    channel: () => hub.open(),
    closeWindow: () => {},
    // The real deadline is pinned by the fake-clock test below; this one only needs it
    // to expire, and a suite that sleeps 800 ms per case is a suite people stop running.
    waitMs: 20,
  });
  assert.equal(titleOf(el), STRINGS.replyNoWindowTitle, 'a window that cannot take it is not a window that has it');
  stop();
});

test('handoff: a reply nobody was granted is not taken, however well-formed it is', async () => {
  const hub = channelHub();
  const inviter = await waitingInviter();
  const stop = listenForReply(hub.open(), () => inviter.el);
  const sender = hub.open();

  // Addressed to another window: the shape is perfect and the token is real.
  sender.postMessage(replyMessage(answerToken(), { rid: 'r1', bid: 'another-window' }));
  await settle();
  assert.equal(headingOf(inviter.el), DIALOG_STRINGS.inviteHeading);

  // And the un-addressed broadcast an older build would have posted reaches nobody.
  sender.postMessage({ type: 'collab-reply', v: 1, signal: answerToken() });
  sender.postMessage({ type: 'collab-reply', v: CHANNEL_MESSAGE_VERSION, signal: answerToken() });
  await settle();
  assert.equal(headingOf(inviter.el), DIALOG_STRINGS.inviteHeading, 'an unaddressed reply is not this window\'s');
  stop();
});

test('a reply the dialog refuses is never reported as delivered', async () => {
  const inviter = await waitingInviter();
  // The button exists and the press happens; what it does is show a refusal in place.
  assert.equal(deliverReplyToDialog(inviter.el, 'not-a-real-answer-token'), false);
  assert.ok(
    inviter.el.textContent?.includes(DIALOG_STRINGS.replyUnreadable),
    'the dialog shows its own notice, exactly as for a bad paste',
  );
  assert.ok(inviter.el.querySelector('#collab-cer-reply'), 'and the paste step is still on screen');

  assert.equal(deliverReplyToDialog(inviter.el, answerToken()), true, 'a good one still lands');
  assert.equal(headingOf(inviter.el), DIALOG_STRINGS.applyHeading);
});

test('handoff: no waiting window means guidance plus the code, not a spinner', async () => {
  const hub = channelHub();
  const el = view();
  let closed = 0;
  const ticks: number[] = [];
  await mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    // A channel with nobody listening - exactly the "the other tab is gone" case.
    channel: () => hub.open(),
    setTimeout: (fn, ms) => { ticks.push(ms); fn(); return 0; },
    clearTimeout: () => {},
    closeWindow: () => { closed += 1; },
  });
  assert.deepEqual(ticks, [REPLY_ACK_WAIT_MS], 'the wait is bounded and short');
  assert.equal(closed, 0, 'an undelivered reply must never close the tab holding it');
  assert.equal(titleOf(el), STRINGS.replyNoWindowTitle);
  assert.ok(el.querySelector('[data-collab-reply-code]')?.textContent, 'the code stays copyable by hand');
});

test('#/join-reply: a route torn down mid-wait never paints over the view that replaced it', async () => {
  const hub = channelHub();
  const el = view() as RoutedView;
  let fire: (() => void) | undefined;
  let closed = 0;
  const mounting = mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    // Nobody is listening on this hub, so the route is parked on the ack deadline - 
    // the common "nobody home" case, and the whole 800 ms of it.
    channel: () => hub.open(),
    setTimeout: (fn) => { fire = fn; return 0; },
    clearTimeout: () => {},
    closeWindow: () => { closed += 1; },
  });
  await settle();
  assert.equal(typeof el._cleanup, 'function', 'the teardown is stamped before the wait, not after it');

  el._cleanup?.();
  el.replaceChildren(dom.window.document.createTextNode('THE NEXT VIEW'));
  fire?.();
  await mounting;

  assert.equal(el.textContent, 'THE NEXT VIEW', 'the view that replaced this one is untouched');
  assert.equal(closed, 0, 'and a route the router has left does not close the window either');
});

test('handoff: a browser with no BroadcastChannel falls straight to the paste fallback', async () => {
  const el = view();
  await mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, { flagOn: () => true, channel: null });
  assert.equal(titleOf(el), STRINGS.replyNoWindowTitle);
  assert.ok(el.querySelector('[data-collab-reply-code]'), 'the reply is still reachable without the API');
});

test('handoff: the copy button reports what it did', async () => {
  const el = view();
  const copied: string[] = [];
  await mountJoinReplyRoute(el, `${ANSWER_PARAM}=${answerToken()}`, {
    flagOn: () => true,
    channel: null,
    copy: (text) => { copied.push(text); },
  });
  const button = el.querySelector<HTMLButtonElement>('button.btn')!;
  button.click();
  await settle();
  assert.equal(copied.length, 1);
  assert.equal(button.textContent, STRINGS.copied);
});

test('#/join-reply: the gates, each with its own sentence', async () => {
  const off = view();
  await mountJoinReplyRoute(off, `${ANSWER_PARAM}=${answerToken()}`, { flagOn: () => false, channel: null });
  assert.equal(titleOf(off), STRINGS.offTitle);

  const empty = view();
  await mountJoinReplyRoute(empty, '', { flagOn: () => true, channel: null });
  assert.equal(titleOf(empty), STRINGS.replyEmptyTitle);

  const bad = view();
  await mountJoinReplyRoute(bad, `${ANSWER_PARAM}=%%%`, { flagOn: () => true, channel: null });
  assert.equal(titleOf(bad), STRINGS.replyUnreadableTitle);

  const wrong = view();
  await mountJoinReplyRoute(wrong, `${ANSWER_PARAM}=${inviteToken()}`, { flagOn: () => true, channel: null });
  assert.equal(titleOf(wrong), STRINGS.replyWrongKindTitle);
});

test("#/join-reply also answers to the plan's `sig` spelling", async () => {
  const el = view();
  await mountJoinReplyRoute(el, `sig=${answerToken()}`, { flagOn: () => true, channel: null });
  assert.equal(titleOf(el), STRINGS.replyNoWindowTitle, 'it decoded - it just found nobody home');
});

test('delivery helpers refuse rather than half-work when there is no field to fill', () => {
  const empty = dom.window.document.createElement('div') as unknown as HTMLElement;
  assert.equal(deliverReplyToDialog(empty, answerToken()), false);
  assert.equal(deliverInviteToDialog(empty, inviteToken()), false);
});

// ── The tool probe (section 6.1) ─────────────────────────────────────────────────────

test('probeLocalTool: a tool this device does not have is a refusal', () => {
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code' }, []), { status: 'missing' });
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code' }, [{ id: 'street-map', version: '1.0.0' }]), { status: 'missing' });
});

test('probeLocalTool: same version has it, minor skew notes it, major skew refuses', () => {
  const tools = [{ id: 'qr-code', version: '2.1.0' }];
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code', toolVersion: '2.1.0' }, tools), { status: 'have' });
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code', toolVersion: '2.4.1' }, tools), {
    status: 'version-skew', severity: 'minor', localVersion: '2.1.0',
  });
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code', toolVersion: '3.0.0' }, tools), {
    status: 'version-skew', severity: 'major', localVersion: '2.1.0',
  });
});

test('probeLocalTool: an unknown version on either side is not evidence of a gap', () => {
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code' }, [{ id: 'qr-code', version: '2.1.0' }]), { status: 'have' });
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code', toolVersion: '2.1.0' }, [{ id: 'qr-code' }]), { status: 'have' });
  assert.deepEqual(probeLocalTool({ toolId: 'qr-code', toolVersion: 'nightly' }, [{ id: 'qr-code', version: '2.1.0' }]), { status: 'have' });
});

test('probeLocalTool: a prototype-borne id is not a tool this device has', () => {
  // sdp-codec refuses these ids on the way in; the probe scans rather than indexes so it
  // stays right even if a future decoder is more permissive.
  assert.deepEqual(probeLocalTool({ toolId: 'constructor' }, [{ id: 'qr-code', version: '1.0.0' }]), { status: 'missing' });
  assert.deepEqual(probeLocalTool({ toolId: '__proto__' }, [{ id: 'qr-code', version: '1.0.0' }]), { status: 'missing' });
});

// ── The composition, and the handoff to whatever owns co-editing ──────────────

test('createCollabEffects is a factory: one fresh transport per ceremony, name read late', () => {
  const built: string[] = [];
  let name = 'first';
  const factory = createCollabEffects({
    rtc: null,
    probe: () => ({ status: 'have' }),
    onTransport: () => { built.push(name); },
  });
  const bundle = factory({ role: 'acceptor', name: () => name });
  assert.equal(typeof bundle.createOffer, 'function');
  assert.equal(typeof bundle.checkTool, 'function');
  assert.equal(typeof bundle.events, 'function', 'without ICE events no pairing ever connects');
  assert.equal(typeof bundle.close, 'function', 'an unclosed transport is a leaked peer connection');
  name = 'second';
  factory({ role: 'acceptor', name: () => name });
  assert.equal(built.length, 2, 'restart gets a genuinely fresh transport, not the spent one');
  bundle.close?.();
});

test('a connected pair with nothing to take it is parked and said out loud', () => {
  const dialog = dom.window.document.createElement('dialog') as unknown as HTMLElement;
  const conn = {
    role: 'acceptor',
    handle: {} as CollabConnection['handle'],
    toolId: 'qr-code',
    ephemeral: true,
    close: () => {},
  } satisfies CollabConnection;

  assert.equal(handOffConnection(conn, dialog), false, 'the caller is told nobody took it');
  assert.equal(dialog.textContent, STRINGS.scaffold, 'a developer who flipped the flag gets the truth');
  handOffConnection(conn, dialog);
  assert.equal(dialog.querySelectorAll('[data-collab-scaffold]').length, 1, 'the note is idempotent');
  assert.equal(takeParked().length, 2, 'both connections survive for the stitch to adopt');

  const taken: CollabConnection[] = [];
  registerCollabMount((c) => { taken.push(c); });
  assert.equal(handOffConnection(conn, dialog), true);
  assert.equal(taken.length, 1);
});

test('appendScaffoldNote never renders copy from outside STRINGS', () => {
  const el = dom.window.document.createElement('div') as unknown as HTMLElement;
  appendScaffoldNote(el);
  assert.equal(el.textContent, STRINGS.scaffold);
});

// ── Copy discipline ───────────────────────────────────────────────────────────

/** String literals in TS source, skipping comments - the ceremony suite's scanner. */
function stringLiterals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      i++;
      let buf = '';
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { buf += src[i + 1] ?? ''; i += 2; continue; }
        if (c === '`' && src[i] === '$' && src[i + 1] === '{') {
          i += 2;
          let depth = 1;
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            i++;
          }
          continue;
        }
        buf += src[i];
        i++;
      }
      i++;
      out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}

// Non-copy literals that read like a sentence. Each is here with its reason.
const NOT_COPY = new Set<string>([
  'max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem',
  'margin:0 0 .5rem;font-size:1.35rem;font-weight:650',
  'margin:0 0 1rem;color:hsl(var(--muted-foreground))',
  'margin:0 0 .25rem;font-size:12px;font-weight:650',
  'display:block;width:100%;height:auto',
]);

test('STRINGS: join-route renders no copy from outside the map', () => {
  const path = fileURLToPath(new URL('./join-route.ts', import.meta.url));
  const src = readFileSync(path, 'utf8');
  const start = src.indexOf('export const STRINGS');
  assert.ok(start > 0, 'STRINGS moved or was renamed - this guard would pass vacuously');
  const end = src.indexOf('\n} as const;', start);
  assert.ok(end > start, 'the STRINGS map no longer ends in `} as const;`');
  const outside = src.slice(0, start) + src.slice(end + '\n} as const;'.length);

  const suspects = stringLiterals(outside).filter((s) => {
    if (NOT_COPY.has(s)) return false;
    if (!s.includes(' ')) return false;              // class lists, ids, selectors, acts
    if (!/[a-z]/i.test(s)) return false;             // punctuation-only joiners
    if (/^[a-z-]+\s*:/.test(s)) return false;        // an inline style declaration
    if (/[<>=$]/.test(s)) return false;              // markup, selectors, interpolation
    if (/^[.#[]/.test(s)) return false;              // selectors
    return /[A-Z]/.test(s) || /[.?!,:;]/.test(s);    // sentence-shaped
  });

  assert.deepEqual(
    [...new Set(suspects)],
    [],
    'user copy must live in STRINGS so the wave-2.7 locale fan-out can find it:\n' + suspects.join('\n'),
  );
});

test('STRINGS: the gate copy is ten distinct keys, and each one is a translator\'s key', () => {
  // The map's values ARE the catalog keys (i18n.ts looks a translation up by its English
  // source), so two screens sharing a value is not a tidy reuse - it is one catalog entry
  // that both screens must live with in all 26 languages. And an em-dash in a key is a
  // house-style break that would then be fanned out 26 times.
  const gate = {
    governedTitle: STRINGS.governedTitle,
    governedBody: STRINGS.governedBody,
    enableTitle: STRINGS.enableTitle,
    enableBody: STRINGS.enableBody,
    enableAction: STRINGS.enableAction,
    enableDecline: STRINGS.enableDecline,
    enableDone: STRINGS.enableDone,
    enableNotSaved: STRINGS.enableNotSaved,
    declinedTitle: STRINGS.declinedTitle,
    declinedBody: STRINGS.declinedBody,
  };
  const values = Object.values(gate);
  assert.equal(new Set(values).size, values.length, 'two gate screens are sharing one catalog key');
  for (const [name, value] of Object.entries(gate)) {
    assert.ok(value.trim().length > 0, `${name} is empty`);
    assert.equal(/[-–]/.test(value), false, `${name} carries a dash the locale wave must not fan out`);
    assert.equal(value.includes('{'), false, `${name} has a placeholder nothing fills`);
  }

  // Every one of them reaches the DOM through a t()/tRaw() call - the property
  // collab-i18n.test.ts enforces file-wide, asserted here for the screens this wave adds
  // so a bare `STRINGS.enableTitle` render site fails the suite that owns them.
  const src = readFileSync(fileURLToPath(new URL('./join-route.ts', import.meta.url)), 'utf8');
  for (const name of Object.keys(gate)) {
    assert.match(src, new RegExp(`tRaw\\(STRINGS\\.${name}\\)`), `STRINGS.${name} is not rendered through tRaw()`);
  }
});
