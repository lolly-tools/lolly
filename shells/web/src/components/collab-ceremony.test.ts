// SPDX-License-Identifier: MPL-2.0
/**
 * The ceremony dialogs (plan 100 section 6.1, section 4.5, section 11.25, section 11.26; wave 2.2).
 *
 * jsdom, a manual clock, and stub effects - the same discipline `collab/ceremony.ts`'s
 * own suite runs on, for the same reason: the screens that matter most here are the
 * ones nobody can reach by hand (a ten-minute countdown running out, a guest network
 * eating the connection, a reply that scans back garbled).
 *
 * Two things are NOT stubbed, on purpose. The codec is real, so every pasted invite
 * and reply in this file is a payload that actually packs and unpacks - which is the
 * only way "unreadable text never reaches the machine" can be tested rather than
 * asserted. And the machine is real in the two progression tests, so the phase order
 * the dialog renders is the phase order the machine produces.
 *
 * What is pinned:
 *  - both roles walk their three numbered steps, and the acceptor probes for the tool
 *    before it is asked for a name;
 *  - the 10-minute re-arm shows a real countdown, and re-arming resets it;
 *  - every `CeremonyEndCause` has its own copy, and the tool-missing refusal names
 *    the tool it is missing;
 *  - Escape sends the machine's cancel event and disposes it;
 *  - the connected handoff fires exactly once, however many times ICE says connected;
 *  - every string the dialog renders comes from STRINGS, checked from both ends (the
 *    rendered DOM, and this module's own source outside the map).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/collab-ceremony.test.ts
 */

import { test } from 'node:test';
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
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  setTimeout(() => cb(0), 0);
  return 0;
}) as unknown as typeof requestAnimationFrame;

// jsdom 25 has no <dialog> showModal/close - shim exactly the surface mountModal uses.
const DialogProto = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
DialogProto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
DialogProto.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

const {
  STRINGS,
  fill,
  fallbackName,
  failureCopy,
  formatCountdown,
  inviteFromSignal,
  openCollabCeremony,
  presentSignal,
  readSignal,
  resolveName,
  spokenPlate,
  tokenFrom,
  INVITE_STAMP,
  JOIN_ROUTE,
  REPLY_ROUTE,
} = await import('./collab-ceremony.ts');
type CollabCeremonyOptions = import('./collab-ceremony.ts').CollabCeremonyOptions;
type CeremonyConnectedHandle = import('./collab-ceremony.ts').CeremonyConnectedHandle;
type CeremonyEffectsBundle = import('./collab-ceremony.ts').CeremonyEffectsBundle;

const { PLATE_RE, derivePlate } = await import('../collab/plate.ts');
type PlateMaterial = import('../collab/plate.ts').PlateMaterial;

const { encodeToken, pack, INVITE_PARAM, ANSWER_PARAM, SDP_CODEC_VERSION } = await import('../collab/sdp-codec.ts');
type SdpMaterial = import('../collab/sdp-codec.ts').SdpMaterial;
type InviteMeta = import('../collab/sdp-codec.ts').InviteMeta;

const { CANVAS_OP_VERSION } = await import('@lolly-tools/core/canvas-op-v1');

const { createCeremony } = await import('../collab/ceremony.ts');
type CeremonyEffects = import('../collab/ceremony.ts').CeremonyEffects;
type CeremonyEndCause = import('../collab/ceremony.ts').CeremonyEndCause;
type CeremonyEvent = import('../collab/ceremony.ts').CeremonyEvent;
type CeremonyMachine = import('../collab/ceremony.ts').CeremonyMachine;
type CeremonyRole = import('../collab/ceremony.ts').CeremonyRole;
type CeremonyState = import('../collab/ceremony.ts').CeremonyState;
type CeremonyTimerHandle = import('../collab/ceremony.ts').CeremonyTimerHandle;
type CeremonyTimers = import('../collab/ceremony.ts').CeremonyTimers;
type ToolProbeResult = import('../collab/ceremony.ts').ToolProbeResult;

// ── Harness ───────────────────────────────────────────────────────────────────

/** The machine's and the dialog's only clock, so a ten-minute wait costs no time. */
class TestClock implements CeremonyTimers {
  now = 0;
  private seq = 0;
  private readonly due = new Map<number, { at: number; fn: () => void }>();

  setTimeout(fn: () => void, ms: number): CeremonyTimerHandle {
    this.seq += 1;
    this.due.set(this.seq, { at: this.now + ms, fn });
    return this.seq;
  }

  clearTimeout(handle: CeremonyTimerHandle): void {
    this.due.delete(handle as number);
  }

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let nextId = -1;
      let nextAt = Number.POSITIVE_INFINITY;
      for (const [id, entry] of this.due) {
        if (entry.at <= target && entry.at < nextAt) {
          nextId = id;
          nextAt = entry.at;
        }
      }
      if (nextId === -1) break;
      const entry = this.due.get(nextId);
      this.due.delete(nextId);
      this.now = nextAt;
      entry?.fn();
    }
    this.now = target;
  }
}

const settle = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

function material(): SdpMaterial {
  return {
    fingerprint: { algo: 'sha-256', bytes: Uint8Array.from({ length: 32 }, (_, i) => (i * 7) & 0xff) },
    iceUfrag: 'ab12',
    icePwd: 'abcdefghijklmnopqrstuv',
    candidates: [{ type: 'host', protocol: 'udp', address: '192.168.1.9', port: 51234 }],
    setupRole: 'actpass',
  };
}

function inviteMeta(over: Partial<InviteMeta> = {}): InviteMeta {
  return {
    v: SDP_CODEC_VERSION,
    toolId: 'qr-code',
    toolVersion: '2.1.0',
    engineVersion: '1.108.0',
    name: 'Priya',
    opVersion: CANVAS_OP_VERSION,
    ...over,
  };
}

/** A real invite token, in the link skin. */
function inviteToken(over: Partial<InviteMeta> = {}): string {
  const packed = pack({ kind: 'invite', material: material(), invite: inviteMeta(over) });
  assert.ok(packed.ok, 'fixture invite must pack');
  return encodeToken(packed.value, 'link');
}

/** A real answer token, in the link skin. */
function answerToken(): string {
  const packed = pack({ kind: 'answer', material: material() });
  assert.ok(packed.ok, 'fixture answer must pack');
  return encodeToken(packed.value, 'link');
}

interface EffectLog {
  offers: number;
  probes: { toolId: string }[];
  answers: number;
  applied: number;
  names: string[];
}

function stubEffects(log: EffectLog, over: Partial<CeremonyEffectsBundle> = {}): CeremonyEffectsBundle {
  return {
    createOffer: async ({ attempt }) => {
      log.offers += 1;
      return { ok: true, invite: { signal: inviteToken({ name: `Host ${attempt}` }), toolId: 'qr-code' } };
    },
    checkTool: async (req) => {
      log.probes.push({ toolId: req.toolId });
      return { status: 'have' } satisfies ToolProbeResult;
    },
    createAnswer: async () => {
      log.answers += 1;
      return { ok: true, answer: { signal: answerToken() } };
    },
    applyRemote: async () => {
      log.applied += 1;
      return { ok: true };
    },
    ...over,
  };
}

function emptyLog(): EffectLog {
  return { offers: 0, probes: [], answers: 0, applied: 0, names: [] };
}

/** A machine whose state the test writes directly - for screens a real run cannot park on. */
function stubMachine(role: CeremonyRole, initial: Partial<CeremonyState> = {}) {
  const subs = new Set<(s: CeremonyState) => void>();
  let state: CeremonyState = {
    role,
    phase: 'idle',
    rearms: 0,
    arming: false,
    reconnecting: false,
    everConnected: false,
    observerOnly: false,
    ...initial,
  };
  const sent: CeremonyEvent[] = [];
  let disposed = 0;
  const machine: CeremonyMachine = {
    get state() { return state; },
    send: (event) => { sent.push(event); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    dispose: () => { disposed += 1; subs.clear(); },
  };
  return {
    machine,
    sent,
    get disposed() { return disposed; },
    set(next: Partial<CeremonyState>) {
      state = { ...state, ...next };
      for (const fn of [...subs]) fn(state);
    },
  };
}

interface Harness {
  clock: TestClock;
  log: EffectLog;
  el: HTMLDialogElement;
  machine(): CeremonyMachine;
  close(): void;
  connected: CeremonyConnectedHandle[];
  closedWith: (CeremonyState | undefined)[];
}

function open(over: Partial<CollabCeremonyOptions> & { role: CeremonyRole }): Harness {
  const clock = new TestClock();
  const log = emptyLog();
  let captured: CeremonyMachine | null = null;
  const connected: CeremonyConnectedHandle[] = [];
  const closedWith: (CeremonyState | undefined)[] = [];
  const handle = openCollabCeremony({
    effects: (ctx) => {
      log.names.push(ctx.name());
      return stubEffects(log);
    },
    timers: clock,
    now: () => clock.now,
    linkBase: 'https://lolly.tools/app',
    copy: () => {},
    createMachine: (options) => {
      captured = createCeremony(options);
      return captured;
    },
    onConnected: (h) => connected.push(h),
    onClose: (s) => closedWith.push(s),
    ...over,
  });
  return {
    clock,
    log,
    el: handle.el,
    machine: () => {
      assert.ok(captured, 'no machine was created yet');
      return captured;
    },
    close: () => handle.close(),
    connected,
    closedWith,
  };
}

// ── DOM readers ───────────────────────────────────────────────────────────────

const headingText = (el: Element): string => el.querySelector('[data-cer-heading]')?.textContent ?? '';
const allText = (el: Element): string => el.textContent ?? '';
const buttons = (el: Element): string[] => [...el.querySelectorAll('button')].map((b) => b.textContent ?? '');

function clickAct(el: Element, act: string): void {
  const btn = el.querySelector<HTMLButtonElement>(`[data-act="${act}"]`);
  assert.ok(btn, `no [data-act="${act}"] on screen: ${allText(el)}`);
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

function typeInto(el: Element, selector: string, value: string): void {
  const field = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  assert.ok(field, `no ${selector} on screen: ${allText(el)}`);
  field.value = value;
  field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

test('resolveName: a cleared field falls back to the role name, never a profile field', () => {
  assert.equal(resolveName('Priya', 'inviter'), 'Priya');
  assert.equal(resolveName('  Sam  ', 'acceptor'), 'Sam');
  assert.equal(resolveName('', 'inviter'), STRINGS.hostFallback);
  assert.equal(resolveName('   ', 'inviter'), STRINGS.hostFallback);
  assert.equal(resolveName(undefined, 'acceptor'), STRINGS.inviteeFallback);
  assert.equal(fallbackName('inviter'), 'Host');
  assert.equal(fallbackName('acceptor'), 'Invitee');
});

test('formatCountdown: m:ss, floored at zero', () => {
  assert.equal(formatCountdown(10 * 60_000), '10:00');
  assert.equal(formatCountdown(9 * 60_000 + 30_000), '9:30');
  assert.equal(formatCountdown(1_000), '0:01');
  assert.equal(formatCountdown(1), '0:01');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(-5_000), '0:00');
});

test('tokenFrom: a bare code, a full link and a lone param all yield the same token', () => {
  const token = inviteToken();
  assert.equal(tokenFrom(token, INVITE_PARAM), token);
  assert.equal(tokenFrom(`  ${token}  `, INVITE_PARAM), token);
  assert.equal(tokenFrom(`https://lolly.tools/app${JOIN_ROUTE}?${INVITE_PARAM}=${token}`, INVITE_PARAM), token);
  assert.equal(tokenFrom(`${INVITE_PARAM}=${token}`, INVITE_PARAM), token);
});

test('readSignal: decodes both skins, and names each way it can fail', () => {
  const token = inviteToken();
  const read = readSignal(token, 'invite');
  assert.ok(read.ok);
  assert.equal(read.value.link, token);
  assert.match(read.value.qr, /^[A-Z2-7]+$/);
  // The QR skin round-trips back to the same payload.
  const viaQr = readSignal(read.value.qr, 'invite');
  assert.ok(viaQr.ok);
  assert.deepEqual(viaQr.value.payload, read.value.payload);

  assert.deepEqual(readSignal('', 'invite'), { ok: false, code: 'empty' });
  assert.deepEqual(readSignal('   ', 'invite'), { ok: false, code: 'empty' });
  assert.deepEqual(readSignal('not a token at all', 'invite'), { ok: false, code: 'unreadable' });
  assert.deepEqual(readSignal(answerToken(), 'invite'), { ok: false, code: 'wrong-kind' });
  assert.deepEqual(readSignal(token, 'answer'), { ok: false, code: 'wrong-kind' });
});

test('presentSignal: a signal the codec cannot read still gives the human something to copy', () => {
  assert.deepEqual(presentSignal('offer-blob', 'invite'), { link: 'offer-blob', qr: 'offer-blob' });
});

test('inviteFromSignal: carries the tool and versions, and leaves colour to be re-derived', () => {
  const read = readSignal(inviteToken(), 'invite');
  assert.ok(read.ok);
  const invite = inviteFromSignal(read.value);
  assert.ok(invite);
  assert.equal(invite.toolId, 'qr-code');
  assert.equal(invite.toolVersion, '2.1.0');
  assert.equal(invite.engineVersion, '1.108.0');
  assert.equal(invite.name, 'Priya');
  assert.equal(invite.opVersion, CANVAS_OP_VERSION);
  assert.equal(invite.colour, undefined);
  assert.equal(invite.signal, read.value.link);
});

// ── Failure copy (section 11.26) ─────────────────────────────────────────────────────

const ALL_CAUSES: CeremonyEndCause[] = [
  'tool-missing',
  'version-major-mismatch',
  'ice-failed-isolation-suspected',
  'connection-lost',
  'timeout',
  'local-rtc-failed',
  'cancelled',
];

test('failureCopy: every end cause has its own screen, and each one names a single action', () => {
  const bodies = new Set<string>();
  const titles = new Set<string>();
  for (const cause of ALL_CAUSES) {
    const copy = failureCopy(cause, { tool: 'qr-code' });
    assert.ok(copy.title.length > 0, `${cause} has no title`);
    assert.ok(copy.body.length > 0, `${cause} has no body`);
    assert.ok(copy.action.length > 0, `${cause} has no action`);
    assert.ok(!copy.body.includes('{'), `${cause} left an unfilled placeholder: ${copy.body}`);
    titles.add(copy.title);
    bodies.add(copy.body);
  }
  assert.equal(titles.size, ALL_CAUSES.length, 'two causes share a title - the copy must be specific per cause');
  assert.equal(bodies.size, ALL_CAUSES.length, 'two causes share a body - the copy must be specific per cause');
  // The map is total over the union, with nothing extra to rot.
  assert.deepEqual(Object.keys(STRINGS.fail).sort(), [...ALL_CAUSES].sort());
});

test('failureCopy: an isolated network says so, and offers the retry rather than a dead end', () => {
  const copy = failureCopy('ice-failed-isolation-suspected');
  assert.equal(copy.body, 'This network blocks device-to-device connections. Try a hotspot or a wired network.');
  assert.equal(copy.restarts, true);
  assert.equal(failureCopy('tool-missing', { tool: 'qr-code' }).restarts, false, 'a missing tool has nothing to retry');
});

// ── Inviter: the three steps ──────────────────────────────────────────────────

test('inviter: name, invite, reply, connect - three numbered steps end to end', async () => {
  const h = open({ role: 'inviter', toolId: 'qr-code', renderQr: () => dom.window.document.createElement('svg') });

  // Step 1: the name form, prefilled from nothing here, with cancel always available.
  assert.equal(headingText(h.el), STRINGS.inviteNameHeading);
  assert.ok(h.el.querySelector('#collab-cer-name'), 'the name field is on step 1');
  assert.ok(buttons(h.el).includes(STRINGS.cancel), 'cancel is visible on step 1');

  typeInto(h.el, '#collab-cer-name', 'Priya');
  clickAct(h.el, 'create-invite');
  assert.equal(headingText(h.el), STRINGS.inviteMintHeading, 'minting has a screen of its own');
  await settle();

  // Step 1 result: the invite, in all three skins.
  assert.equal(headingText(h.el), STRINGS.inviteHeading);
  const link = h.el.querySelector('[data-token="copy-invite-link"]')?.textContent ?? '';
  assert.ok(link.startsWith(`https://lolly.tools/app${JOIN_ROUTE}?${INVITE_PARAM}=`), `bad invite link: ${link}`);
  const code = h.el.querySelector('[data-token="copy-invite-code"]')?.textContent ?? '';
  assert.match(code, /^[A-Z2-7]+$/, 'the code beside the QR is the QR skin');
  assert.ok(h.el.querySelector('.collab-cer-qr'), 'the QR slot is present when the host can draw one');
  assert.ok(allText(h.el).includes(STRINGS.inviteTrust), 'the invite screen states who can join');

  // Step 2: waiting for the reply.
  clickAct(h.el, 'to-waiting');
  assert.equal(headingText(h.el), STRINGS.waitHeading);
  assert.ok(h.el.querySelector('#collab-cer-reply'), 'the reply field is on step 2');
  assert.ok(buttons(h.el).includes(STRINGS.newInvite), 'a new invite is always one click away');
  assert.ok(buttons(h.el).includes(STRINGS.cancel), 'cancel is visible on step 2');

  // A reply that cannot be read is this dialog's problem, not the machine's.
  typeInto(h.el, '#collab-cer-reply', 'zzz not a token');
  clickAct(h.el, 'submit-reply');
  assert.ok(allText(h.el).includes(STRINGS.replyUnreadable), 'an unreadable reply is named on the spot');
  assert.equal(h.machine().state.phase, 'awaiting-answer', 'and it never reached the machine');

  // An invite pasted where the reply goes is a different mistake, said differently.
  typeInto(h.el, '#collab-cer-reply', inviteToken());
  clickAct(h.el, 'submit-reply');
  assert.ok(allText(h.el).includes(STRINGS.replyWrongKind));
  assert.equal(h.machine().state.phase, 'awaiting-answer');

  // The real reply.
  typeInto(h.el, '#collab-cer-reply', answerToken());
  clickAct(h.el, 'submit-reply');
  await settle();
  assert.equal(h.log.applied, 1, 'the decoded answer went to the transport');
  assert.equal(headingText(h.el), STRINGS.connectHeading, 'step 3 is connection progress');

  h.machine().send({ type: 'ice', state: 'connected' });
  h.machine().send({ type: 'ready' });
  assert.equal(headingText(h.el), STRINGS.connectedHeading);
  assert.equal(h.connected.length, 1);
  assert.equal(h.connected[0]!.localName, 'Priya');
  assert.equal(h.connected[0]!.peerName, STRINGS.inviteeFallback, 'an unnamed peer shows as the role name');
  assert.equal(h.connected[0]!.observerOnly, false);

  h.close();
});

test('inviter: clearing the name shows up as Host, and that is what the transport is told', async () => {
  const h = open({ role: 'inviter' });
  typeInto(h.el, '#collab-cer-name', '');
  clickAct(h.el, 'create-invite');
  await settle();
  assert.deepEqual(h.log.names, [STRINGS.hostFallback]);
  h.close();
});

test('inviter: no renderQr means no QR slot, never a broken one (section 11.27)', async () => {
  const h = open({ role: 'inviter' });
  clickAct(h.el, 'create-invite');
  await settle();
  assert.equal(h.el.querySelector('.collab-cer-qr'), null);
  assert.ok(h.el.querySelector('[data-token="copy-invite-code"]'), 'the paste fallback is always there');
  h.close();
});

test('inviter: the invite is two QR tabs (link and code) and the link falls back to a note when its URL is too long to scan', async () => {
  const asked: string[] = [];
  const h = open({
    role: 'inviter', toolId: 'qr-code',
    // Model the real encoder: a URL (byte mode) can overflow the scannable ceiling and
    // comes back null; a bare base32 code always fits.
    renderQr: (text) => { asked.push(text); return text.includes('://') ? null : dom.window.document.createElement('svg'); },
  });
  clickAct(h.el, 'create-invite');
  await settle();

  // Two tabs, link selected first, and BOTH copy targets present at once (hidden panel and
  // all) so the paste fallback never depends on which tab is showing.
  const sel = (act: string) => h.el.querySelector<HTMLElement>(`[data-act="${act}"]`)?.getAttribute('aria-selected');
  assert.ok(h.el.querySelector('[data-act="qr-tab-link"]') && h.el.querySelector('[data-act="qr-tab-code"]'), 'both tabs present');
  assert.equal(sel('qr-tab-link'), 'true', 'link is the default tab');
  assert.equal(sel('qr-tab-code'), 'false');
  assert.ok(h.el.querySelector('[data-token="copy-invite-link"]'), 'the link token is present');
  assert.ok(h.el.querySelector('[data-token="copy-invite-code"]'), 'the code token is present');

  // The link tab tried to encode the actual invite URL, and being too long, showed the note.
  assert.ok(asked.some((t) => t.startsWith(`https://lolly.tools/app${JOIN_ROUTE}?`)), 'the link tab QR is the invite URL');
  assert.ok(allText(h.el).includes(STRINGS.qrLinkTooBig), 'a URL too long to scan shows a note, not an empty box');

  // Switching to the code tab flips the selection; base32 always fits, so it draws a QR.
  clickAct(h.el, 'qr-tab-code');
  await settle();
  assert.equal(sel('qr-tab-code'), 'true', 'the code tab is now selected');
  assert.equal(sel('qr-tab-link'), 'false');
  h.close();
});

test('inviter: tapping the QR enlarges it to a scannable overlay; a tap or Escape dismisses it', async () => {
  const h = open({ role: 'inviter', toolId: 'qr-code', renderQr: () => dom.window.document.createElement('svg') });
  clickAct(h.el, 'create-invite');
  await settle();

  // The QR is now a button, with the tap-to-enlarge affordance beside it.
  assert.ok(h.el.querySelector('[data-act="zoom-qr"]'), 'the QR is a tappable button');
  assert.ok(allText(h.el).includes(STRINGS.qrEnlargeHint), 'and it says so');

  const zoom = (): HTMLDialogElement | null =>
    dom.window.document.querySelector<HTMLDialogElement>('dialog.collab-qr-zoom');

  clickAct(h.el, 'zoom-qr');
  await settle();
  assert.ok(zoom(), 'an enlarge overlay opened');
  assert.ok(zoom()!.hasAttribute('open'), 'and it is showing');
  assert.ok(zoom()!.querySelector('svg'), 'the code is drawn into it at size');
  assert.ok(allText(zoom()!).includes(STRINGS.qrZoomDismiss), 'with the dismiss hint');

  // A tap anywhere on the overlay closes it, leaving the ceremony untouched behind it.
  zoom()!.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.equal(zoom(), null, 'the overlay is gone');
  assert.equal(headingText(h.el), STRINGS.inviteHeading, 'and the invite screen is still there');

  // Escape (the native cancel event) closes the topmost overlay too, not the ceremony.
  clickAct(h.el, 'zoom-qr');
  await settle();
  assert.ok(zoom(), 'the overlay re-opened');
  zoom()!.dispatchEvent(new dom.window.Event('cancel'));
  assert.equal(zoom(), null, 'Escape closed the overlay');
  assert.equal(headingText(h.el), STRINGS.inviteHeading, 'the ceremony is still open');

  // Closing the whole ceremony takes any open overlay down with it.
  clickAct(h.el, 'zoom-qr');
  await settle();
  assert.ok(zoom(), 'overlay up again');
  h.close();
  assert.equal(zoom(), null, 'closing the ceremony also closes the overlay');
});

test('inviter: no scan capability means no scan button', async () => {
  const withScan = open({ role: 'inviter', scan: async () => null });
  clickAct(withScan.el, 'create-invite');
  await settle();
  clickAct(withScan.el, 'to-waiting');
  assert.ok(buttons(withScan.el).includes(STRINGS.scan));
  withScan.close();

  const without = open({ role: 'inviter' });
  clickAct(without.el, 'create-invite');
  await settle();
  clickAct(without.el, 'to-waiting');
  assert.ok(!buttons(without.el).includes(STRINGS.scan));
  without.close();
});

// ── The re-arm countdown (section 6.1) ───────────────────────────────────────────────

test('inviter: the ten minutes are counted down in the open, and a re-arm restarts them', async () => {
  const h = open({ role: 'inviter' });
  clickAct(h.el, 'create-invite');
  await settle();
  clickAct(h.el, 'to-waiting');

  assert.ok(allText(h.el).includes(fill(STRINGS.countdown, { time: '10:00' })), allText(h.el));

  h.clock.advance(30_000);
  assert.ok(allText(h.el).includes(fill(STRINGS.countdown, { time: '9:30' })), allText(h.el));

  h.clock.advance(9 * 60_000);
  assert.ok(allText(h.el).includes(fill(STRINGS.countdown, { time: '0:30' })), allText(h.el));

  // The machine re-mints at the boundary; the dialog says so and starts over.
  h.clock.advance(30_000);
  await settle();
  assert.equal(h.log.offers, 2, 'a fresh offer was minted');
  assert.equal(h.machine().state.rearms, 1);
  assert.ok(allText(h.el).includes(STRINGS.rearmed), 'the human is told the invite changed');
  assert.ok(allText(h.el).includes(fill(STRINGS.countdown, { time: '10:00' })), 'the countdown restarts');

  h.close();
});

test('inviter: "Make a new invite" mints one on demand and clears the spent budget', async () => {
  const h = open({ role: 'inviter' });
  clickAct(h.el, 'create-invite');
  await settle();
  clickAct(h.el, 'to-waiting');
  h.clock.advance(10 * 60_000);
  await settle();
  assert.equal(h.machine().state.rearms, 1);

  clickAct(h.el, 'new-invite');
  await settle();
  assert.equal(h.log.offers, 3);
  assert.equal(h.machine().state.rearms, 0, 'a hand-made invite is a fresh budget');
  assert.equal(headingText(h.el), STRINGS.inviteHeading, 'and it shows the new invite, not the old wait');

  h.close();
});

// ── Acceptor: the three steps ─────────────────────────────────────────────────

test('acceptor: paste, probe, name, reply - and the probe runs before the name is asked for', async () => {
  const h = open({ role: 'acceptor', renderQr: () => dom.window.document.createElement('svg') });

  assert.equal(headingText(h.el), STRINGS.acceptHeading);
  typeInto(h.el, '#collab-cer-invite', 'gibberish');
  clickAct(h.el, 'submit-invite');
  assert.ok(allText(h.el).includes(STRINGS.inviteUnreadable));
  assert.equal(h.log.probes.length, 0, 'nothing unreadable reaches the catalog probe');

  typeInto(h.el, '#collab-cer-invite', answerToken());
  clickAct(h.el, 'submit-invite');
  assert.ok(allText(h.el).includes(STRINGS.inviteWrongKind));

  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  assert.equal(headingText(h.el), STRINGS.probeHeading, 'the probe has a screen of its own');
  await settle();

  assert.deepEqual(h.log.probes, [{ toolId: 'qr-code' }], 'the tool was probed before any name was asked for');
  assert.equal(headingText(h.el), STRINGS.acceptNameHeading);
  assert.ok(allText(h.el).includes('Priya'), 'the inviter is named on the name screen');
  assert.ok(allText(h.el).includes('qr-code'), 'so is the tool');

  typeInto(h.el, '#collab-cer-name', 'Sam');
  clickAct(h.el, 'join');
  await settle();

  assert.equal(headingText(h.el), STRINGS.answerHeading, 'step 3 is the reply, in both skins');
  const link = h.el.querySelector('[data-token="copy-answer-link"]')?.textContent ?? '';
  assert.ok(link.startsWith(`https://lolly.tools/app${REPLY_ROUTE}?${ANSWER_PARAM}=`), `bad reply link: ${link}`);
  assert.match(h.el.querySelector('[data-token="copy-answer-code"]')?.textContent ?? '', /^[A-Z2-7]+$/);
  assert.ok(allText(h.el).includes(STRINGS.answerWait));

  h.machine().send({ type: 'ice', state: 'connected' });
  h.machine().send({ type: 'ready' });
  assert.equal(headingText(h.el), STRINGS.connectedHeading);
  assert.equal(h.connected.length, 1);
  assert.equal(h.connected[0]!.localName, 'Sam');
  assert.equal(h.connected[0]!.peerName, 'Priya');

  h.close();
});

test('acceptor: a missing tool is an honest refusal that names the tool', async () => {
  const log = emptyLog();
  const h = open({
    role: 'acceptor',
    effects: stubEffects(log, { checkTool: async () => ({ status: 'missing' }) }),
  });
  typeInto(h.el, '#collab-cer-invite', inviteToken({ toolId: 'street-map' }));
  clickAct(h.el, 'submit-invite');
  await settle();

  const text = allText(h.el);
  assert.ok(text.includes(STRINGS.fail['tool-missing'].title), text);
  assert.ok(text.includes('street-map'), 'the refusal names the tool that is missing');
  assert.ok(text.includes(STRINGS.fail['tool-missing'].action));
  assert.ok(!h.el.querySelector('#collab-cer-name'), 'nobody is asked to name themselves for a collab that cannot happen');
  h.close();
});

test('acceptor: a major tool skew refuses; a minor one connects with a note', async () => {
  const majorLog = emptyLog();
  const major = open({
    role: 'acceptor',
    effects: stubEffects(majorLog, { checkTool: async () => ({ status: 'version-skew', severity: 'major', localVersion: '1.0.0' }) }),
  });
  typeInto(major.el, '#collab-cer-invite', inviteToken());
  clickAct(major.el, 'submit-invite');
  await settle();
  assert.ok(allText(major.el).includes(STRINGS.fail['version-major-mismatch'].title));
  major.close();

  const minorLog = emptyLog();
  const minor = open({
    role: 'acceptor',
    effects: stubEffects(minorLog, { checkTool: async () => ({ status: 'version-skew', severity: 'minor', localVersion: '2.0.9' }) }),
  });
  typeInto(minor.el, '#collab-cer-invite', inviteToken());
  clickAct(minor.el, 'submit-invite');
  await settle();
  assert.equal(headingText(minor.el), STRINGS.acceptNameHeading, 'a minor skew still joins');
  assert.ok(allText(minor.el).includes(fill(STRINGS.minorSkew, { tool: 'qr-code' })));
  minor.close();
});

test('acceptor: a major op-contract gap notes observer-only rather than refusing (contract section 9)', async () => {
  const h = open({ role: 'acceptor' });
  typeInto(h.el, '#collab-cer-invite', inviteToken({ opVersion: '99.0.0' }));
  clickAct(h.el, 'submit-invite');
  await settle();
  assert.equal(headingText(h.el), STRINGS.acceptNameHeading, 'an op-version gap is not a refusal');
  assert.ok(allText(h.el).includes(STRINGS.observerOnly));
  h.close();
});

// ── Terminal screens, cancel, handoff ─────────────────────────────────────────

test('every end cause renders its own screen, with one action', () => {
  for (const cause of ALL_CAUSES) {
    if (cause === 'cancelled') continue; // a cancel closes the dialog; it never renders
    const stub = stubMachine('inviter');
    const handle = openCollabCeremony({
      role: 'inviter',
      toolId: 'qr-code',
      effects: stubEffects(emptyLog()),
      createMachine: () => stub.machine,
      copy: () => {},
    });
    clickAct(handle.el, 'create-invite');
    stub.set({ phase: 'failed', cause });
    const copy = failureCopy(cause, { tool: 'qr-code' });
    assert.equal(headingText(handle.el), copy.title, cause);
    assert.ok(allText(handle.el).includes(copy.body), cause);
    assert.equal(handle.el.querySelectorAll('.modal-actions button').length, 1, `${cause} must offer exactly one action`);
    handle.close();
  }
});

test('a retryable failure restarts the ceremony instead of closing the dialog', () => {
  const stub = stubMachine('inviter');
  const handle = openCollabCeremony({
    role: 'inviter',
    effects: stubEffects(emptyLog()),
    createMachine: () => stub.machine,
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');
  stub.set({ phase: 'failed', cause: 'ice-failed-isolation-suspected' });
  clickAct(handle.el, 'restart');
  assert.equal(stub.disposed, 1, 'the dead machine is disposed on restart');
  assert.ok(handle.el.isConnected, 'the dialog stays open');
  assert.equal(headingText(handle.el), STRINGS.inviteNameHeading, 'and lands back on step 1');
  handle.close();
});

test('Escape sends the machine cancel event, disposes it, and reports the close once', () => {
  const stub = stubMachine('inviter');
  const closes: (CeremonyState | undefined)[] = [];
  const handle = openCollabCeremony({
    role: 'inviter',
    effects: stubEffects(emptyLog()),
    createMachine: () => stub.machine,
    onClose: (s) => closes.push(s),
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');
  assert.deepEqual(stub.sent, [{ type: 'invite' }]);

  handle.el.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));

  assert.deepEqual(stub.sent.at(-1), { type: 'cancel' }, 'Escape is the machine cancel event');
  assert.equal(stub.disposed, 1, 'and the machine is disposed with it');
  assert.equal(closes.length, 1);
  assert.equal(handle.el.isConnected, false, 'the dialog is gone');

  // Idempotent: a second close changes nothing.
  handle.close();
  assert.equal(closes.length, 1);
  assert.equal(stub.disposed, 1);
});

test('the Cancel button takes the same path as Escape', () => {
  const stub = stubMachine('inviter');
  const handle = openCollabCeremony({
    role: 'inviter',
    effects: stubEffects(emptyLog()),
    createMachine: () => stub.machine,
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');
  clickAct(handle.el, 'cancel');
  assert.deepEqual(stub.sent.at(-1), { type: 'cancel' });
  assert.equal(stub.disposed, 1);
  assert.equal(handle.el.isConnected, false);
});

test('the connected handoff fires once, however often ICE says connected', () => {
  const stub = stubMachine('inviter');
  const seen: CeremonyConnectedHandle[] = [];
  const handle = openCollabCeremony({
    role: 'inviter',
    effects: stubEffects(emptyLog()),
    createMachine: () => stub.machine,
    onConnected: (h) => seen.push(h),
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');

  stub.set({ phase: 'connected', everConnected: true, peer: { name: 'Sam' } });
  stub.set({ phase: 'connected', everConnected: true, peer: { name: 'Sam' }, reconnecting: true });
  stub.set({ phase: 'connected', everConnected: true, peer: { name: 'Sam' }, reconnecting: false });

  assert.equal(seen.length, 1, 'one handoff per ceremony');
  assert.equal(seen[0]!.peerName, 'Sam');
  assert.equal(typeof seen[0]!.close, 'function');
  seen[0]!.close();
  assert.equal(handle.el.isConnected, false, 'the handle can close the dialog');
});

test('a dropped connection rewinds to the fresh invite, and the next one is a new handoff (section 6.1, section 11.3)', () => {
  const stub = stubMachine('inviter');
  const seen: CeremonyConnectedHandle[] = [];
  const handle = openCollabCeremony({
    role: 'inviter',
    effects: stubEffects(emptyLog()),
    createMachine: () => stub.machine,
    onConnected: (h) => seen.push(h),
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');
  stub.set({ phase: 'awaiting-answer', invite: { signal: inviteToken(), toolId: 'qr-code' } });
  clickAct(handle.el, 'to-waiting');
  assert.equal(headingText(handle.el), STRINGS.waitHeading);

  stub.set({ phase: 'connected', everConnected: true });
  assert.equal(seen.length, 1);

  // The machine pre-mints a replacement invite; the human must be looking at it.
  stub.set({ phase: 'reconnect-armed', invite: { signal: inviteToken({ name: 'Host 1' }), toolId: 'qr-code' } });
  assert.equal(headingText(handle.el), STRINGS.inviteHeading, 'the wait step rewinds to the new invite');

  stub.set({ phase: 'connected', everConnected: true });
  assert.equal(seen.length, 2, 'a second connection is a second session, so it hands off again');
  handle.close();
});

test('a quiet link is a note on the connected screen, never a re-pair prompt (section 11.3)', () => {
  const stub = stubMachine('inviter');
  const handle = openCollabCeremony({
    role: 'inviter',
    effects: stubEffects(emptyLog()),
    createMachine: () => stub.machine,
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');
  stub.set({ phase: 'connected', everConnected: true, reconnecting: true });
  assert.equal(headingText(handle.el), STRINGS.connectedHeading);
  assert.ok(allText(handle.el).includes(STRINGS.reconnecting));
  handle.close();
});

// ── A11y ──────────────────────────────────────────────────────────────────────

test('both roles walk 1, 2, 3 - and say so in a form translation cannot move', async () => {
  const step = (el: Element): string => el.querySelector('[data-cer-heading]')?.getAttribute('data-cer-step') ?? '';

  const inviter = open({ role: 'inviter' });
  assert.equal(step(inviter.el), '1');
  clickAct(inviter.el, 'create-invite');
  assert.equal(step(inviter.el), '1', 'minting is still step 1');
  await settle();
  assert.equal(step(inviter.el), '1');
  clickAct(inviter.el, 'to-waiting');
  assert.equal(step(inviter.el), '2');
  typeInto(inviter.el, '#collab-cer-reply', answerToken());
  clickAct(inviter.el, 'submit-reply');
  await settle();
  assert.equal(step(inviter.el), '3');
  inviter.close();

  const acceptor = open({ role: 'acceptor' });
  assert.equal(step(acceptor.el), '1');
  typeInto(acceptor.el, '#collab-cer-invite', inviteToken());
  clickAct(acceptor.el, 'submit-invite');
  assert.equal(step(acceptor.el), '1', 'the probe is still step 1');
  await settle();
  assert.equal(step(acceptor.el), '2');
  clickAct(acceptor.el, 'join');
  await settle();
  assert.equal(step(acceptor.el), '3');
  acceptor.close();
});

test('a failure publishes no step number, whatever step it died on', async () => {
  // A failure can arrive from anywhere in the walk, so it is not a step and must not
  // claim to be one. The catch-all this replaces stamped 3 - "the last of three" - on a
  // ceremony refused while the acceptor was still on step 1 reading the invite.
  const stepAttr = (el: Element): string | null =>
    el.querySelector('[data-cer-heading]')?.getAttribute('data-cer-step') ?? null;

  // Refused on step 1, before any machine exists: the probe reports a major tool skew
  // while the invite is still being checked.
  const acceptor = open({
    role: 'acceptor',
    effects: stubEffects(emptyLog(), {
      checkTool: async () => ({ status: 'version-skew', severity: 'major', localVersion: '1.0.0' }),
    }),
  });
  assert.equal(stepAttr(acceptor.el), '1', 'the acceptor starts on step 1');
  typeInto(acceptor.el, '#collab-cer-invite', inviteToken());
  clickAct(acceptor.el, 'submit-invite');
  await settle();
  assert.equal(headingText(acceptor.el), STRINGS.fail['version-major-mismatch'].title);
  assert.equal(stepAttr(acceptor.el), null, 'a step-1 refusal must not publish itself as step 3');
  acceptor.close();

  // And a failure that arrives from the machine mid-walk is not a step either.
  const stub = stubMachine('inviter');
  const handle = openCollabCeremony({
    role: 'inviter',
    toolId: 'qr-code',
    effects: stubEffects(emptyLog()),
    createMachine: () => stub.machine,
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');
  assert.equal(stepAttr(handle.el), '1', 'minting is still step 1');
  stub.set({ phase: 'failed', cause: 'ice-failed-isolation-suspected' });
  assert.equal(headingText(handle.el), failureCopy('ice-failed-isolation-suspected', { tool: 'qr-code' }).title);
  assert.equal(stepAttr(handle.el), null, 'and the mid-walk failure carries no step');
  handle.close();
});

test('each step moves focus to its heading, and the heading is focusable', async () => {
  const h = open({ role: 'inviter' });
  const first = h.el.querySelector<HTMLElement>('[data-cer-heading]');
  assert.equal(first?.getAttribute('tabindex'), '-1');
  assert.equal(dom.window.document.activeElement, first, 'step 1 takes focus on open');

  clickAct(h.el, 'create-invite');
  await settle();
  const second = h.el.querySelector<HTMLElement>('[data-cer-heading]');
  assert.equal(dom.window.document.activeElement, second, 'the invite screen takes focus');
  assert.notEqual(first, second);

  h.close();
});

test('a countdown tick repaints the time without stealing focus from a half-typed reply', async () => {
  const h = open({ role: 'inviter' });
  clickAct(h.el, 'create-invite');
  await settle();
  clickAct(h.el, 'to-waiting');

  const field = h.el.querySelector<HTMLTextAreaElement>('#collab-cer-reply')!;
  field.value = 'half a rep';
  field.focus();
  assert.equal(dom.window.document.activeElement, field);

  h.clock.advance(5_000);
  assert.equal(dom.window.document.activeElement, field, 'a tick must not move focus');
  assert.equal(field.value, 'half a rep', 'nor wipe what is typed');
  assert.ok(allText(h.el).includes(fill(STRINGS.countdown, { time: '9:55' })));

  h.close();
});

// ── The connection plate (section 1) ─────────────────────────────────────────────────
//
// The plate is the pairing's short authentication string, and the property it rests on is
// not local to this file: BOTH SCREENS MUST SHOW THE SAME SIX CHARACTERS. `plate.ts` pins
// the derivation and `rtc-transport.test.ts` pins the material; what is left for the
// dialog is that it renders the plate for the pairing it is actually in, on both roles,
// and renders nothing at all rather than something wrong. A dialog that shows a plate
// derived from the wrong thing - or shows one role a plate and the other none - turns
// every honest pairing into a suspected attack, which is the failure this test guards against.

/** One pairing's two certificate fingerprints, fixed so a plate can be pinned to them. */
const FP_HERE = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const FP_THERE = Uint8Array.from({ length: 32 }, (_, i) => (i * 31 + 11) & 0xff);
/** A third certificate: the one a re-pairing (or a middleman) would bring. */
const FP_OTHER = Uint8Array.from({ length: 32 }, (_, i) => (i * 13 + 5) & 0xff);

const plateNode = (el: Element): HTMLElement | null => el.querySelector('[data-cer-plate]');

/**
 * The plate on screen once the digest has landed - or `''` when none ever does.
 *
 * The derivation is async (Web Crypto), so a test that reads straight after the connected
 * render sees an empty screen whether the wiring works or not. Looping to a bound serves
 * both directions: a plate that arrives is returned, and a plate that never arrives is a
 * proven absence rather than a race the test happened to win.
 */
/** Wait for the plate to APPEAR. The derivation is a `crypto.subtle` digest on the
 *  thread pool, so a fixed micro-turn spin loses under CI load (the beam-ui lesson,
 *  2026-08-10): real timer turns, generous bound, return the text the moment it
 *  paints. */
async function settlePlate(el: Element): Promise<string> {
  for (let i = 0; i < 2000 && !plateNode(el); i++) await new Promise(r => setTimeout(r, 0));
  return plateNode(el)?.textContent ?? '';
}

/** Assert sustained ABSENCE - the spent-pairing case. Absence cannot be proven by
 *  waiting, so this holds the door open long enough (50 real timer turns, far past
 *  any derivation latency) for a wrong plate to show up if the discard logic ever
 *  breaks, failing loudly the instant one paints. */
async function settleNoPlate(el: Element): Promise<string> {
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 0));
    const node = plateNode(el);
    if (node) return node.textContent ?? '';
  }
  return '';
}

/** An inviter walked all the way to `connected`, with whatever plate material is given. */
async function connectedInviter(over: Partial<CeremonyEffectsBundle>): Promise<Harness> {
  const h = open({ role: 'inviter', effects: stubEffects(emptyLog(), over) });
  clickAct(h.el, 'create-invite');
  await settle();
  clickAct(h.el, 'to-waiting');
  typeInto(h.el, '#collab-cer-reply', answerToken());
  clickAct(h.el, 'submit-reply');
  await settle();
  h.machine().send({ type: 'ice', state: 'connected' });
  h.machine().send({ type: 'ready' });
  return h;
}

/** The same, from the other end. */
async function connectedAcceptor(over: Partial<CeremonyEffectsBundle>): Promise<Harness> {
  const h = open({ role: 'acceptor', effects: stubEffects(emptyLog(), over) });
  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  await settle();
  clickAct(h.el, 'join');
  await settle();
  h.machine().send({ type: 'ice', state: 'connected' });
  h.machine().send({ type: 'ready' });
  return h;
}

test('spokenPlate: the six symbols are said one at a time, with the groups apart', () => {
  // "LOL-123" read as its own text is "lol, one hundred and twenty-three" - which is
  // useless for comparing character by character and, worse, sounds like it matched.
  assert.equal(spokenPlate('ACD-234'), 'A C D, 2 3 4');
  assert.equal(spokenPlate('K7M-9PZ'), 'K 7 M, 9 P Z');
});

test('both roles show the SAME plate, and it is the one their two fingerprints derive', async () => {
  const expected = await derivePlate(FP_HERE, FP_THERE);
  assert.match(expected, PLATE_RE, 'the fixture itself must be a well-formed plate');

  const inviter = await connectedInviter({ plateMaterial: () => ({ local: FP_HERE, remote: FP_THERE }) });
  assert.equal(headingText(inviter.el), STRINGS.connectedHeading);
  assert.equal(await settlePlate(inviter.el), expected, 'the inviter shows the pairing it is in');
  assert.ok(allText(inviter.el).includes(STRINGS.plateBody), 'and one sentence says what a match means');
  inviter.close();

  // The acceptor holds the very same pairing the other way round. `plate.ts` sorts the
  // two fingerprints rather than ordering them by role, and this is what that buys.
  const acceptor = await connectedAcceptor({ plateMaterial: () => ({ local: FP_THERE, remote: FP_HERE }) });
  assert.equal(headingText(acceptor.el), STRINGS.connectedHeading);
  assert.equal(
    await settlePlate(acceptor.el),
    expected,
    'the two screens disagreeing would tell two honest people they are being attacked',
  );
  acceptor.close();

  // A middleman terminates DTLS on both sides, so what it presents is a certificate
  // neither human's device ever saw. It cannot make this number come out.
  assert.notEqual(await derivePlate(FP_HERE, FP_OTHER), expected);
});

test('the plate is announced, spelled out, rather than left to be pronounced', async () => {
  const expected = await derivePlate(FP_HERE, FP_THERE);
  const h = await connectedInviter({ plateMaterial: () => ({ local: FP_HERE, remote: FP_THERE }) });
  assert.equal(await settlePlate(h.el), expected);

  const said = fill(STRINGS.plateSpoken, { plate: spokenPlate(expected) });
  const plate = plateNode(h.el);
  assert.equal(plate?.getAttribute('role'), 'img', 'the element is a leaf, so its own text is not read');
  assert.equal(plate?.getAttribute('aria-label'), said);

  // The digest lands a microtask AFTER the connected screen was announced, so the live
  // region has to speak a second time - otherwise the plate is the one thing on this
  // screen a screen-reader user is never told.
  const live = [...h.el.querySelectorAll('[data-cer-live] span')].map((s) => s.textContent);
  assert.ok(live.includes(said), `the live region never said the plate: ${live.join(' | ')}`);
  assert.ok(live.includes(STRINGS.connectedHeading), 'and it still says which step this is');
  h.close();
});

test('a plate is never read out on a screen that does not show it', async () => {
  // The inviter has both fingerprints the moment `applyRemote` returns, which is a render
  // BEFORE the connected screen - "Step 3 of 3: Connecting". Announcing there would say
  // six characters the other person cannot see yet, on the one screen where the point is
  // that both people are looking at the same thing.
  const h = open({
    role: 'inviter',
    effects: stubEffects(emptyLog(), { plateMaterial: () => ({ local: FP_HERE, remote: FP_THERE }) }),
  });
  clickAct(h.el, 'create-invite');
  await settle();
  clickAct(h.el, 'to-waiting');
  typeInto(h.el, '#collab-cer-reply', answerToken());
  clickAct(h.el, 'submit-reply');
  for (let i = 0; i < 20; i++) await settle();

  assert.equal(headingText(h.el), STRINGS.connectHeading, 'still waiting on ICE');
  assert.equal(plateNode(h.el), null, 'the connecting screen shows no plate…');
  const prefix = STRINGS.plateSpoken.split('{')[0]!;   // the copy up to the plate's own slot
  const said = [...h.el.querySelectorAll('[data-cer-live] span')].map((s) => s.textContent ?? '');
  assert.ok(said.every((line) => !line.startsWith(prefix)), `…so nothing said one either: ${said.join(' | ')}`);

  // And the moment the screen that DOES show it arrives, it is both painted and spoken.
  h.machine().send({ type: 'ice', state: 'connected' });
  h.machine().send({ type: 'ready' });
  const plate = await settlePlate(h.el);
  assert.equal(plate, await derivePlate(FP_HERE, FP_THERE));
  const now = [...h.el.querySelectorAll('[data-cer-live] span')].map((s) => s.textContent);
  assert.ok(now.includes(fill(STRINGS.plateSpoken, { plate: spokenPlate(plate) })), now.join(' | '));
  h.close();
});

test('no material means no plate, and the connected screen is otherwise untouched', async () => {
  // The plain stub declares no `plateMaterial` at all - every hand-driven effects bundle
  // in this suite, and any shell that predates the plate.
  const h = await connectedInviter({});
  assert.equal(headingText(h.el), STRINGS.connectedHeading);
  assert.equal(await settlePlate(h.el), '', 'nothing is shown rather than something wrong');
  assert.ok(!allText(h.el).includes(STRINGS.plateBody), 'and the sentence explaining it goes too');
  assert.ok(buttons(h.el).includes(STRINGS.startEditing), 'an unconfirmable pairing is still a working pairing');
  h.close();
});

test('a plate read that throws is a missing plate, never a broken ceremony', async () => {
  const h = await connectedInviter({
    plateMaterial: () => {
      throw new Error('the transport is mid-teardown');
    },
  });
  assert.equal(headingText(h.el), STRINGS.connectedHeading, 'the pair is live; a diagnostic read cannot unmake that');
  assert.equal(await settlePlate(h.el), '');
  h.close();
});

test('a second pairing gets its own plate, never the spent one', async () => {
  let pair: PlateMaterial | null = { local: FP_HERE, remote: FP_THERE };
  const stub = stubMachine('inviter');
  const handle = openCollabCeremony({
    role: 'inviter',
    effects: stubEffects(emptyLog(), { plateMaterial: () => pair }),
    createMachine: () => stub.machine,
    copy: () => {},
  });
  clickAct(handle.el, 'create-invite');
  stub.set({ phase: 'connected', everConnected: true });
  assert.equal(await settlePlate(handle.el), await derivePlate(FP_HERE, FP_THERE));

  // The link drops. The machine re-mints, the transport opens a new peer connection, and
  // for a moment it has one fingerprint or none - a plate for a connection that no longer
  // exists is exactly the number this whole mechanism exists to make impossible.
  pair = null;
  stub.set({ phase: 'reconnect-armed', invite: { signal: inviteToken(), toolId: 'qr-code' } });
  stub.set({ phase: 'connected', everConnected: true });
  assert.equal(await settleNoPlate(handle.el), '', 'the spent pairing’s plate must not survive it');

  pair = { local: FP_HERE, remote: FP_OTHER };
  stub.set({ phase: 'connected', everConnected: true, reconnecting: false });
  assert.equal(
    await settlePlate(handle.el),
    await derivePlate(FP_HERE, FP_OTHER),
    'the new certificate is a new plate, and both humans read this one out again',
  );
  handle.close();
});

// ── STRINGS coverage ──────────────────────────────────────────────────────────

function stringValues(source: unknown, out: string[] = []): string[] {
  if (typeof source === 'string') out.push(source);
  else if (source && typeof source === 'object') for (const v of Object.values(source)) stringValues(v, out);
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STRING_PATTERNS = stringValues(STRINGS).map(
  (v) => new RegExp(`^${escapeRe(v).replace(/\\\{\w+\\\}/g, '.+')}$`),
);

const fromStrings = (text: string): boolean => STRING_PATTERNS.some((re) => re.test(text));

/** Every word the dialog shows: leaf text plus the attributes screen readers speak. */
function renderedStrings(root: Element): string[] {
  const out: string[] = [];
  const attrs = (el: Element): void => {
    for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
      const value = el.getAttribute(name);
      if (value) out.push(value);
    }
  };
  const walk = (el: Element): void => {
    attrs(el);
    if (el.hasAttribute('data-dynamic')) return; // a token or a caller-drawn QR
    if (el.children.length === 0) {
      const text = (el.textContent ?? '').trim();
      if (text) out.push(text);
      return;
    }
    for (const child of [...el.children]) walk(child);
    for (const child of [...el.childNodes]) {
      if (child.nodeType === 3) {
        const text = (child.textContent ?? '').trim();
        if (text) out.push(text);
      }
    }
  };
  walk(root);
  return out;
}

test('STRINGS: every word the two flows render comes out of the map', async () => {
  const seen: string[] = [];
  const capture = (el: Element): void => { seen.push(...renderedStrings(el)); };

  const inviter = open({ role: 'inviter', toolId: 'qr-code', scan: async () => null, renderQr: () => null });
  capture(inviter.el);                                        // step 1: name
  typeInto(inviter.el, '#collab-cer-name', 'Priya');
  clickAct(inviter.el, 'create-invite');
  capture(inviter.el);                                        // minting
  await settle();
  capture(inviter.el);                                        // step 1: the invite
  clickAct(inviter.el, 'to-waiting');
  capture(inviter.el);                                        // step 2: waiting
  clickAct(inviter.el, 'submit-reply');
  capture(inviter.el);                                        // step 2 + the empty-paste notice
  typeInto(inviter.el, '#collab-cer-reply', answerToken());
  clickAct(inviter.el, 'submit-reply');
  await settle();
  capture(inviter.el);                                        // step 3: connecting
  inviter.machine().send({ type: 'ice', state: 'connected' });
  inviter.machine().send({ type: 'ready' });
  capture(inviter.el);                                        // connected
  inviter.close();

  const acceptor = open({ role: 'acceptor', scan: async () => null, renderQr: () => null });
  capture(acceptor.el);                                       // step 1: paste
  typeInto(acceptor.el, '#collab-cer-invite', inviteToken());
  clickAct(acceptor.el, 'submit-invite');
  capture(acceptor.el);                                       // probing
  await settle();
  capture(acceptor.el);                                       // step 2: name
  clickAct(acceptor.el, 'join');
  await settle();
  capture(acceptor.el);                                       // step 3: the reply
  acceptor.close();

  // The connected screen WITH a plate. The plate's own six characters are a value, not
  // copy (`data-dynamic`), but the sentence beside it and the `aria-label` a screen
  // reader hears in its place are both copy, and neither is reachable from the walk
  // above - the stub effects there carry no fingerprints.
  const plated = await connectedInviter({ plateMaterial: () => ({ local: FP_HERE, remote: FP_THERE }) });
  assert.notEqual(await settlePlate(plated.el), '', 'the plated capture must actually have a plate');
  capture(plated.el);
  plated.close();

  // Every failure screen too.
  for (const cause of ALL_CAUSES) {
    if (cause === 'cancelled') continue;
    const stub = stubMachine('inviter');
    const handle = openCollabCeremony({
      role: 'inviter',
      toolId: 'qr-code',
      effects: stubEffects(emptyLog()),
      createMachine: () => stub.machine,
      copy: () => {},
    });
    clickAct(handle.el, 'create-invite');
    stub.set({ phase: 'failed', cause });
    capture(handle.el);
    handle.close();
  }

  assert.ok(seen.length > 60, `only ${seen.length} strings were rendered - the walk missed the screens`);
  const stray = [...new Set(seen)].filter((text) => !fromStrings(text));
  assert.deepEqual(stray, [], `strings rendered from outside STRINGS:\n${stray.join('\n')}`);
});

/**
 * String literals in TS source, skipping comments. A template literal's `${…}`
 * holes are dropped rather than the whole literal: the interesting case is exactly
 * a sentence smuggled in beside an interpolation. There are no regex literals in
 * the module under test, so a scanner this small is enough.
 */
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

// Non-copy literals that read like a sentence. Each one is here with its reason.
const NOT_COPY = new Set<string>([
  'min(540px, 94vw)',  // the dialog's own width
  'flex:1 1 12rem;min-width:0',  // an inline style whose first declaration has no colon-prefix tell
  'flex:1 1 100%;min-height:4.5rem',
]);

test('STRINGS: acceptor step 3 says the reply has to travel, and names the buttons that send it', async () => {
  // The defect this pins is not a bug in any function: the reply screen minted a code,
  // showed it, and read as finished. Andy's first real run of the ceremony stopped dead
  // here - "I get a quick join and no reply message" - because nothing on the screen said
  // the code still had to go back, and the two buttons said "Copy the link" / "Copy the
  // code", which is what every other screen's buttons say too.
  const h = open({ role: 'acceptor', renderQr: () => null });
  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  await settle();
  clickAct(h.el, 'join');
  await settle();

  assert.equal(headingText(h.el), STRINGS.answerHeading);
  assert.match(STRINGS.answerHeading, /Send this reply back$/, 'the heading is the instruction, not a label');
  assert.ok(allText(h.el).includes(STRINGS.answerBody));
  assert.match(STRINGS.answerBody, /pastes this code, or opens this link/, 'one sentence, and it names both ways');

  const label = (act: string): string =>
    h.el.querySelector(`[data-act="${act}"]`)?.textContent ?? '';
  assert.equal(label('copy-answer-link'), STRINGS.copyReplyLink);
  assert.equal(label('copy-answer-code'), STRINGS.copyReplyCode);
  assert.equal(STRINGS.copyReplyLink, 'Copy reply link');
  assert.equal(STRINGS.copyReplyCode, 'Copy reply code');
  for (const value of [STRINGS.copyReplyLink, STRINGS.copyReplyCode]) {
    assert.notEqual(value, STRINGS.copyLink, 'a button that could be any button is the thing being fixed');
    assert.notEqual(value, STRINGS.copyCode);
  }
  h.close();
});

test('STRINGS: inviter step 2 labels its field for the thing being pasted, countdown untouched', () => {
  // The other half of the same confusion: the inviting window called its field "Reply
  // from the other device", which describes the field rather than asking for anything.
  assert.equal(STRINGS.replyLabel, 'Paste the reply code here');
  assert.equal(STRINGS.countdown, 'This invite works for another {time}.', 'the countdown copy is deliberately unchanged');
  assert.equal(STRINGS.countdownSpent, 'This invite has run out. Make a new one.');
});

test('the dialog states its minted invite where a re-render cannot take it', async () => {
  // `collab/join-route.ts` reads this to answer a second tab's "was this invite made in
  // this browser?" - the own-invite note. Pinned here as well as there because THIS file
  // is the one that writes it, and a rename that only broke the reader would look like a
  // bug in the reader.
  const h = open({ role: 'inviter', toolId: 'qr-code', renderQr: () => null });
  assert.equal(h.el.getAttribute(INVITE_STAMP), null, 'nothing is minted before the invite is');
  typeInto(h.el, '#collab-cer-name', 'Priya');
  clickAct(h.el, 'create-invite');
  await settle();

  const stamped = h.el.getAttribute(INVITE_STAMP) ?? '';
  const shown = h.el.querySelector('[data-token="copy-invite-link"]')?.textContent ?? '';
  assert.ok(stamped.length > 0);
  assert.equal(
    shown,
    `https://lolly.tools/app${JOIN_ROUTE}?${INVITE_PARAM}=${stamped}`,
    'the stamp is byte-for-byte the token in the link the other tab is holding',
  );

  clickAct(h.el, 'to-waiting');
  assert.equal(h.el.querySelector('[data-token="copy-invite-link"]'), null, 'step 2 drops the slot...');
  assert.equal(h.el.getAttribute(INVITE_STAMP), stamped, '...and the stamp outlives it');
  h.close();
});

test('an acceptor dialog stamps nothing - it minted nothing', async () => {
  const h = open({ role: 'acceptor', renderQr: () => null });
  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  await settle();
  assert.equal(h.el.getAttribute(INVITE_STAMP), null);
  h.close();
});

test('STRINGS: the module renders no copy from outside the map', () => {
  const path = fileURLToPath(new URL('./collab-ceremony.ts', import.meta.url));
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
