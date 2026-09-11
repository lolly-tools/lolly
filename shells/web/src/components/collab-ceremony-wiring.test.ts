// SPDX-License-Identifier: MPL-2.0
/**
 * The ceremony dialog's SEAMS - the parts that only matter once a real transport is on
 * the other end (plan 100 section 6.1, section 11.3, section 11.25, section 11.26; wave 2.2).
 *
 * `collab-ceremony.test.ts` pins the screens. This file pins the wiring between them and
 * the thing that actually connects two devices, because every bug here is invisible to a
 * suite that drives the machine by hand:
 *
 *  - ICE arrives from the TRANSPORT, never from a human. A dialog that does not subscribe
 *    to it renders a perfect three-step ceremony that can only ever end on a watchdog - 
 *    both outcomes are pinned here, so the seam cannot quietly go missing again.
 *  - A transport is a peer connection plus three data channels. Every ceremony this
 *    dialog owns hands it back; the one it does not own (the live pair) it must not touch.
 *  - A validation notice is a re-render, and a re-render used to eat the paste field it
 *    was complaining about - the exact text the user needs, at the exact moment section 11.25
 *    calls the ceremony's weak point.
 *  - `showModal()` inerts the whole document outside the dialog, so the shell's
 *    body-level `announce()` cannot be heard from in here at all.
 *  - The ten minutes belong to the invite, not to the screen that shows them.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/collab-ceremony-wiring.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
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

const { STRINGS, fill, openCollabCeremony, spokenPlate } = await import('./collab-ceremony.ts');
type CeremonyConnectedHandle = import('./collab-ceremony.ts').CeremonyConnectedHandle;
type CeremonyEffectsBundle = import('./collab-ceremony.ts').CeremonyEffectsBundle;
type CeremonyTransportEvent = import('./collab-ceremony.ts').CeremonyTransportEvent;
type CollabCeremonyOptions = import('./collab-ceremony.ts').CollabCeremonyOptions;

const { encodeToken, pack, SDP_CODEC_VERSION } = await import('../collab/sdp-codec.ts');
type InviteMeta = import('../collab/sdp-codec.ts').InviteMeta;
type SdpMaterial = import('../collab/sdp-codec.ts').SdpMaterial;

const { CANVAS_OP_VERSION } = await import('@lolly-tools/core/canvas-op-v1');

const { derivePlate } = await import('../collab/plate.ts');

const { CONNECT_WATCHDOG_MS, createCeremony } = await import('../collab/ceremony.ts');
type CeremonyEffects = import('../collab/ceremony.ts').CeremonyEffects;
type CeremonyMachine = import('../collab/ceremony.ts').CeremonyMachine;
type CeremonyRole = import('../collab/ceremony.ts').CeremonyRole;
type CeremonyState = import('../collab/ceremony.ts').CeremonyState;
type CeremonyTimerHandle = import('../collab/ceremony.ts').CeremonyTimerHandle;
type CeremonyTimers = import('../collab/ceremony.ts').CeremonyTimers;
type ToolProbeResult = import('../collab/ceremony.ts').ToolProbeResult;

// ── Harness ───────────────────────────────────────────────────────────────────

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

/** A promise a test resolves by hand, to script the order two async things land in. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  if (!resolve) throw new Error('the Promise executor did not run synchronously');
  return { promise, resolve };
}

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
      opVersion: CANVAS_OP_VERSION,
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

function plainEffects(over: Partial<CeremonyEffects> = {}): CeremonyEffects {
  return {
    createOffer: async () => ({ ok: true, invite: { signal: inviteToken(), toolId: 'qr-code' } }),
    checkTool: async () => ({ status: 'have' }) satisfies ToolProbeResult,
    createAnswer: async () => ({ ok: true, answer: { signal: answerToken() } }),
    applyRemote: async () => ({ ok: true }),
    ...over,
  };
}

/**
 * A transport the dialog can genuinely wire itself to: it publishes ceremony events and
 * it can be closed, and it counts both so ownership is observable rather than assumed.
 */
function transportSource(over: Partial<CeremonyEffectsBundle> = {}) {
  let sinks: ((event: CeremonyTransportEvent) => void)[] = [];
  const counts = { built: 0, subscribed: 0, unsubscribed: 0, closed: 0 };
  const names: string[] = [];
  return {
    counts,
    names,
    /** How many live subscriptions the dialog is holding right now. */
    get wired(): number {
      return sinks.length;
    },
    emit(event: CeremonyTransportEvent): void {
      for (const sink of [...sinks]) sink(event);
    },
    build(name: () => string): CeremonyEffectsBundle {
      counts.built += 1;
      names.push(name());
      return {
        ...plainEffects(over),
        events(send) {
          counts.subscribed += 1;
          sinks.push(send);
          return () => {
            counts.unsubscribed += 1;
            sinks = sinks.filter((entry) => entry !== send);
          };
        },
        close() {
          counts.closed += 1;
        },
      };
    },
  };
}

interface Harness {
  clock: TestClock;
  el: HTMLDialogElement;
  machine(): CeremonyMachine;
  close(): void;
  connected: CeremonyConnectedHandle[];
}

function open(over: Partial<CollabCeremonyOptions> & { role: CeremonyRole }): Harness {
  const clock = new TestClock();
  let captured: CeremonyMachine | null = null;
  const connected: CeremonyConnectedHandle[] = [];
  const handle = openCollabCeremony({
    effects: plainEffects(),
    timers: clock,
    now: () => clock.now,
    linkBase: 'https://lolly.tools/app',
    copy: () => {},
    createMachine: (options) => {
      captured = createCeremony(options);
      return captured;
    },
    onConnected: (h) => connected.push(h),
    ...over,
  });
  return {
    clock,
    el: handle.el,
    machine: () => {
      assert.ok(captured, 'no machine was created yet');
      return captured;
    },
    close: () => handle.close(),
    connected,
  };
}

const headingText = (el: Element): string => el.querySelector('[data-cer-heading]')?.textContent ?? '';
const allText = (el: Element): string => el.textContent ?? '';

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

/** Walk the inviter to the screen where only ICE can move it on. */
async function toConnecting(h: Harness): Promise<void> {
  clickAct(h.el, 'create-invite');
  await settle();
  clickAct(h.el, 'to-waiting');
  typeInto(h.el, '#collab-cer-reply', answerToken());
  clickAct(h.el, 'submit-reply');
  await settle();
  assert.equal(headingText(h.el), STRINGS.connectHeading, 'the inviter should be waiting on ICE');
}

// ── The ICE seam (section 6.1) ───────────────────────────────────────────────────────

test('the transport ICE reaches the machine, and that is the only way a pair connects', async () => {
  const t = transportSource();
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name) });
  await toConnecting(h);

  assert.equal(t.counts.subscribed, 1, 'the dialog subscribes to the transport exactly once');
  assert.equal(t.wired, 1);

  t.emit({ type: 'ice', state: 'connected' });
  t.emit({ type: 'ready' });

  assert.equal(headingText(h.el), STRINGS.connectedHeading);
  assert.equal(h.machine().state.phase, 'connected');
  assert.equal(h.connected.length, 1, 'and the handoff fires for it');
  h.close();
});

test('the acceptor connects on the same seam, from the screen that only waits', async () => {
  const t = transportSource();
  const h = open({ role: 'acceptor', effects: (ctx) => t.build(ctx.name) });
  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  await settle();
  typeInto(h.el, '#collab-cer-name', 'Sam');
  clickAct(h.el, 'join');
  await settle();
  assert.equal(headingText(h.el), STRINGS.answerHeading);

  t.emit({ type: 'ice', state: 'connected' });
  t.emit({ type: 'ready' });
  assert.equal(headingText(h.el), STRINGS.connectedHeading);
  assert.equal(h.connected[0]?.localName, 'Sam');
  h.close();
});

// ── The plate seam (section 1) ───────────────────────────────────────────────────────
//
// `collab-ceremony.test.ts` pins what the plate LOOKS like. What is left for this file is
// how the dialog gets it: the transport never emits a plate event, so the only way the
// number can ever appear is a level read taken while the screen is being built. Both
// tests below fail loudly if that read is ever turned into an edge subscription.

const FP_HERE = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
const FP_THERE = Uint8Array.from({ length: 32 }, (_, i) => (i * 31 + 11) & 0xff);

const plateNode = (el: Element): HTMLElement | null => el.querySelector('[data-cer-plate]');

/** The plate once its digest has landed, or `''` if none ever does. */
async function settlePlate(el: Element): Promise<string> {
  for (let i = 0; i < 20 && !plateNode(el); i++) await settle();
  return plateNode(el)?.textContent ?? '';
}

test('the plate is a LEVEL read off the effects bundle, never an event', async () => {
  // The material becomes available inside `createAnswer`/`applyRemote` - BEFORE ICE
  // connects, and with nothing announcing it. A dialog waiting for a plate event would
  // wait forever and show the connected screen bare; this is the same hazard `iceState`
  // and `channelsReady` exist for, answered the same way.
  let reads = 0;
  const t = transportSource({
    plateMaterial: () => {
      reads += 1;
      return { local: FP_HERE, remote: FP_THERE };
    },
  });
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name) });
  await toConnecting(h);
  assert.ok(reads > 0, 'the read happens while the ceremony renders, not on an edge');

  t.emit({ type: 'ice', state: 'connected' });
  t.emit({ type: 'ready' });
  assert.equal(await settlePlate(h.el), await derivePlate(FP_HERE, FP_THERE));
  assert.ok(allText(h.el).includes(STRINGS.plateBody));
  h.close();
});

test('one pairing is one derivation, so the live region says the plate once', async () => {
  // `render()` runs on every ICE transition and every machine notification. Re-deriving
  // per render would be waste; re-ANNOUNCING per render is the real harm - a screen
  // reader reading six characters out again each time a candidate pair changes is worse
  // than not reading them at all.
  const t = transportSource({ plateMaterial: () => ({ local: FP_HERE, remote: FP_THERE }) });
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name) });
  await toConnecting(h);
  t.emit({ type: 'ice', state: 'connected' });
  t.emit({ type: 'ready' });

  const plate = await settlePlate(h.el);
  const said = fill(STRINGS.plateSpoken, { plate: spokenPlate(plate) });
  const live = h.el.querySelector('[data-cer-live]');
  assert.ok(live, 'the dialog owns its own live region');
  assert.ok([...live.children].some((s) => s.textContent === said), 'the plate was announced once it landed');

  // `speak()` replaces the region's children, so their identity is the tell: if a render
  // re-derived and re-announced, these nodes would be different objects.
  const spoken = [...live.children];
  t.emit({ type: 'ice', state: 'completed' });
  t.emit({ type: 'ice', state: 'connected' });
  await settle();
  await settle();

  assert.equal(plateNode(h.el)?.textContent, plate, 'the plate itself is unchanged');
  assert.deepEqual([...live.children], spoken, 'and it was not read out a second time');
  h.close();
});

test('a transport that publishes no ICE can only ever end on the watchdog', async () => {
  // The failure this seam exists to prevent, pinned from the other side: the screens are
  // all correct, the ceremony is unreachable. Nothing about the copy would show it.
  const h = open({ role: 'inviter', effects: plainEffects() });
  await toConnecting(h);

  h.clock.advance(CONNECT_WATCHDOG_MS);
  assert.equal(headingText(h.el), STRINGS.fail['ice-failed-isolation-suspected'].title);
  assert.equal(h.connected.length, 0);
  h.close();
});

test('the peer op-version hello travels the same seam and lands as the observer-only note', async () => {
  const t = transportSource();
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name) });
  await toConnecting(h);

  // section 11.19: a signalling payload too small for the op version is settled in band, and
  // contract section 9 makes a major gap a watching join rather than a refusal.
  t.emit({ type: 'peer-op-version', opVersion: '99.0.0' });
  t.emit({ type: 'ice', state: 'connected' });
  t.emit({ type: 'ready' });

  assert.equal(headingText(h.el), STRINGS.connectedHeading);
  assert.ok(allText(h.el).includes(STRINGS.observerOnly));
  assert.equal(h.connected[0]?.observerOnly, true);
  h.close();
});

// ── Transport ownership ───────────────────────────────────────────────────────

test('a cancelled ceremony hands its transport back', () => {
  const t = transportSource();
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name) });
  clickAct(h.el, 'create-invite');
  assert.equal(t.counts.built, 1);

  h.close();
  assert.equal(t.counts.closed, 1, 'the peer connection is closed, not left to the collector');
  assert.equal(t.counts.unsubscribed, 1, 'and nothing is still listening to it');
  assert.equal(t.wired, 0);
});

test('a restart closes the spent transport before the factory makes another', async () => {
  const t = transportSource();
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name) });
  await toConnecting(h);
  h.clock.advance(CONNECT_WATCHDOG_MS);
  assert.equal(headingText(h.el), STRINGS.fail['ice-failed-isolation-suspected'].title);

  clickAct(h.el, 'restart');
  // A timed-out ceremony leaves a connection still gathering - "finished" is exactly
  // what it is not, which is why the restart cannot just drop the reference.
  assert.equal(t.counts.closed, 1);
  assert.equal(t.counts.built, 1, 'the replacement is built when the next ceremony needs it');

  clickAct(h.el, 'create-invite');
  await settle();
  assert.equal(t.counts.built, 2);
  assert.equal(t.counts.subscribed, 2, 'the fresh machine is wired to the fresh transport');
  assert.equal(t.wired, 1, 'and the dead one is not still publishing into it');

  h.close();
  assert.equal(t.counts.closed, 2);
});

test('a live pair keeps its transport: the handoff transfers ownership', async () => {
  const t = transportSource();
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name) });
  await toConnecting(h);
  t.emit({ type: 'ice', state: 'connected' });
  t.emit({ type: 'ready' });
  assert.equal(h.connected.length, 1);

  h.connected[0]?.close();
  assert.equal(t.counts.closed, 0, 'closing the dialog must not hang up on the collab it just started');
  assert.equal(t.counts.unsubscribed, 1, 'the dialog does stop listening - the session takes over');
});

test('with nobody to hand it to, a connected transport is still closed with the dialog', async () => {
  const t = transportSource();
  const h = open({ role: 'inviter', effects: (ctx) => t.build(ctx.name), onConnected: undefined });
  await toConnecting(h);
  t.emit({ type: 'ice', state: 'connected' });
  t.emit({ type: 'ready' });

  h.close();
  assert.equal(t.counts.closed, 1);
});

test('a bare CeremonyEffects stays valid: no events, no close, no crash', () => {
  const h = open({ role: 'inviter', effects: plainEffects() });
  clickAct(h.el, 'create-invite');
  h.close();
  assert.equal(h.el.isConnected, false);
});

// ── The paste field survives being told it is wrong (section 11.25) ──────────────────

function caretOf(el: Element, selector: string): { value: string; focused: boolean; start: number | null } {
  const field = el.querySelector<HTMLTextAreaElement>(selector);
  assert.ok(field, `no ${selector} on screen`);
  return {
    value: field.value,
    focused: dom.window.document.activeElement === field,
    start: field.selectionStart,
  };
}

test('an unreadable invite keeps the text and the caret that produced it', () => {
  const h = open({ role: 'acceptor' });
  typeInto(h.el, '#collab-cer-invite', 'this is not a lolly invite at all');
  const field = h.el.querySelector<HTMLTextAreaElement>('#collab-cer-invite');
  assert.ok(field);
  field.focus();
  field.setSelectionRange(4, 4);

  clickAct(h.el, 'submit-invite');

  assert.ok(allText(h.el).includes(STRINGS.inviteUnreadable), 'the mistake is still named');
  const after = caretOf(h.el, '#collab-cer-invite');
  assert.equal(after.value, 'this is not a lolly invite at all', 'nothing to re-paste');
  assert.equal(after.focused, true, 'and nothing to re-find: focus stays in the field');
  assert.equal(after.start, 4, 'caret where it was');
  h.close();
});

test('the reply field survives every one of its three refusals', async () => {
  const h = open({ role: 'inviter' });
  clickAct(h.el, 'create-invite');
  await settle();
  clickAct(h.el, 'to-waiting');

  const wrongKind = inviteToken();
  for (const [text, notice] of [
    ['', STRINGS.replyEmpty],
    ['zzz not a token', STRINGS.replyUnreadable],
    [wrongKind, STRINGS.replyWrongKind],
  ] as const) {
    typeInto(h.el, '#collab-cer-reply', text);
    h.el.querySelector<HTMLTextAreaElement>('#collab-cer-reply')?.focus();
    clickAct(h.el, 'submit-reply');
    assert.ok(allText(h.el).includes(notice), notice);
    assert.equal(caretOf(h.el, '#collab-cer-reply').value, text, `"${notice}" ate the field`);
    assert.equal(caretOf(h.el, '#collab-cer-reply').focused, true, `"${notice}" stole the focus`);
  }

  // The good paste still gets through afterwards.
  typeInto(h.el, '#collab-cer-reply', answerToken());
  clickAct(h.el, 'submit-reply');
  await settle();
  assert.equal(headingText(h.el), STRINGS.connectHeading);
  h.close();
});

test('a refused paste leaves focus on the button a keyboard user pressed', () => {
  const h = open({ role: 'acceptor' });
  typeInto(h.el, '#collab-cer-invite', 'nope');
  const submit = h.el.querySelector<HTMLButtonElement>('[data-act="submit-invite"]');
  assert.ok(submit);
  submit.focus();
  clickAct(h.el, 'submit-invite');

  const again = h.el.querySelector<HTMLButtonElement>('[data-act="submit-invite"]');
  assert.equal(dom.window.document.activeElement, again, 'the rebuilt screen must not drop focus to <body>');
  h.close();
});

test('the acceptor names itself after the probe, so the transport gets a thunk not a value', async () => {
  const thunks: (() => string)[] = [];
  const h = open({
    role: 'acceptor',
    effects: (ctx) => {
      thunks.push(ctx.name);
      return plainEffects();
    },
  });

  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  await settle();
  // The transport was built for the tool probe - before the name screen existed.
  const readName = thunks[0];
  assert.ok(readName, 'the factory ran at the probe');
  assert.equal(readName(), STRINGS.inviteeFallback);

  typeInto(h.el, '#collab-cer-name', 'Sam');
  // Anything the transport snapshotted at construction would still be reading "Invitee",
  // and "Invitee" is what the peer would see (section 4.5).
  assert.equal(readName(), 'Sam');
  h.close();
});

// ── Announcements (section 11.26) ────────────────────────────────────────────────────

const liveText = (el: Element): string => el.querySelector('[data-cer-live]')?.textContent ?? '';

test('the live region is inside the dialog, where showModal cannot inert it', async () => {
  const h = open({ role: 'acceptor' });
  const live = h.el.querySelector('[data-cer-live]');
  assert.ok(live, 'the dialog carries its own live region');
  assert.equal(live.parentElement, h.el, 'as a direct child of the <dialog>, not a body sibling');
  assert.equal(live.getAttribute('aria-live'), 'polite');
  assert.equal(live.getAttribute('role'), 'status');

  // Step 1 announces itself.
  assert.ok(liveText(h.el).includes(STRINGS.acceptHeading));

  // A notice is the announcement that matters most, and it lands in the same place.
  typeInto(h.el, '#collab-cer-invite', 'not an invite');
  clickAct(h.el, 'submit-invite');
  assert.equal(liveText(h.el), STRINGS.inviteUnreadable);

  // Then the next step replaces it.
  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  await settle();
  assert.ok(liveText(h.el).includes(STRINGS.acceptNameHeading));

  // Nothing ever went to the body-level region, which a modal dialog inerts.
  assert.equal(dom.window.document.body.querySelector('[data-a11y-live]'), null);
  h.close();
});

// ── The ten minutes belong to the invite (section 6.1) ───────────────────────────────

test('the countdown is anchored to the mint, not to the screen that shows it', async () => {
  const h = open({ role: 'inviter' });
  clickAct(h.el, 'create-invite');
  await settle();
  assert.equal(headingText(h.el), STRINGS.inviteHeading);

  // Nine minutes spent finding a way to send the invite. The machine's re-arm timer has
  // been running since it was minted; the human has simply not moved on yet.
  h.clock.advance(9 * 60_000);
  clickAct(h.el, 'to-waiting');

  assert.ok(
    allText(h.el).includes(fill(STRINGS.countdown, { time: '1:00' })),
    `the invite has one minute left, not ten: ${allText(h.el)}`,
  );

  // And it really does re-arm a minute later, exactly as the countdown promised.
  h.clock.advance(60_000);
  await settle();
  assert.equal(h.machine().state.rearms, 1);
  assert.ok(allText(h.el).includes(fill(STRINGS.countdown, { time: '10:00' })), 'the fresh invite gets a fresh ten');
  h.close();
});

// ── The acceptor's pre-machine probe ──────────────────────────────────────────

test('a scan that lands after a manual submit cannot pin its verdict on the new invite', async () => {
  const probes: { toolId: string; resolve: (result: ToolProbeResult) => void }[] = [];
  const scanned = deferred<string | null>();

  const h = open({
    role: 'acceptor',
    effects: plainEffects({
      checkTool: (req) => {
        const gate = deferred<ToolProbeResult>();
        probes.push({ toolId: req.toolId, resolve: gate.resolve });
        return gate.promise;
      },
    }),
    scan: () => scanned.promise,
  });

  // Camera on, and then impatience: the invite gets pasted by hand while it is running.
  clickAct(h.el, 'scan');
  typeInto(h.el, '#collab-cer-invite', inviteToken({ toolId: 'qr-code' }));
  clickAct(h.el, 'submit-invite');
  assert.deepEqual(probes.map((p) => p.toolId), ['qr-code']);

  // The scan finally decodes - a DIFFERENT invite, for a different tool.
  scanned.resolve(inviteToken({ toolId: 'street-map' }));
  await settle();
  assert.deepEqual(probes.map((p) => p.toolId), ['qr-code', 'street-map']);

  // The abandoned probe answers late, and must be ignored: its verdict is about a tool
  // nobody is joining any more.
  probes[0]?.resolve({ status: 'missing' });
  await settle();
  assert.notEqual(headingText(h.el), STRINGS.fail['tool-missing'].title, 'a stale probe must not refuse');

  probes[1]?.resolve({ status: 'have' });
  await settle();
  assert.equal(headingText(h.el), STRINGS.acceptNameHeading);
  assert.ok(allText(h.el).includes('street-map'), 'and the screen is about the invite that won');
  h.close();
});

test('a probe that answers after the dialog is gone changes nothing', async () => {
  const probes: ((result: ToolProbeResult) => void)[] = [];
  const closes: (CeremonyState | undefined)[] = [];
  const h = open({
    role: 'acceptor',
    effects: plainEffects({
      checkTool: () => new Promise<ToolProbeResult>((resolve) => { probes.push(resolve); }),
    }),
    onClose: (state) => closes.push(state),
  });
  typeInto(h.el, '#collab-cer-invite', inviteToken());
  clickAct(h.el, 'submit-invite');
  h.close();

  probes[0]?.({ status: 'missing' });
  await settle();
  assert.equal(closes.length, 1);
  assert.equal(h.el.isConnected, false);
});
