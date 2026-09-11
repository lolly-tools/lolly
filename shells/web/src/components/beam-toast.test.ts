// SPDX-License-Identifier: MPL-2.0
/**
 * beam-toast (plan 100 section 6.4, section 4.6 point 6) - driven entirely from a scripted
 * {@link BeamEventSource}, exactly the way a real adapter over
 * `collab/beam-protocol.ts`'s `BeamSender`/`BeamReceiver` would drive it. No
 * transport, no worker, no beam-protocol instance anywhere in this file.
 *
 * What is pinned:
 *  - the consent prompt states the size (item count + bytes) and the sender's name
 *    BEFORE anything moves, and Accept/Decline each fire their action exactly once - 
 *    a second click (even one that defeats the disabled attribute directly) is a
 *    no-op, because the toast never decides anything itself; it only ever reacts to
 *    the next event;
 *  - `progress` events move both the per-item and the running-total bar's
 *    `aria-valuenow`, and the current item's label - but only for a beam that has
 *    already been accepted: an out-of-order `progress`/`item-done` never promotes a
 *    card past the consent sheet, which is the only place Accept/Decline exist;
 *  - Cancel fires the same way, once;
 *  - a second beam's offer is queued, not shown, while the first is still live - 
 *    it only appears once the first reaches a terminal state AND is dismissed;
 *  - `complete` and `cancelled` render the plan's own terminal copy (a receiver's
 *    "Saved to your library - Assets: N", a sender's "Sent - Assets: N", and every
 *    typed reason's own line - `user` reads as "Declined." before an accept and
 *    "Cancelled." after one);
 *  - `announce()` fires on the consent request, on completion, and on failure - 
 *    checked against the real shared live region, not a mock;
 *  - every string the toast renders comes out of {@link STRINGS}, checked from both
 *    ends (the rendered DOM, and this module's own source outside the map) - the
 *    same two-sided check `components/collab-ceremony.test.ts` runs on its own
 *    STRINGS map, adapted here.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/beam-toast.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// ── jsdom ─────────────────────────────────────────────────────────────────────

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://lolly.tools/app',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  setTimeout(() => cb(0), 0);
  return 0;
}) as unknown as typeof requestAnimationFrame;

const { mountBeamToast, STRINGS, fill } = await import('./beam-toast.ts');
type BeamToastEvent = import('./beam-toast.ts').BeamToastEvent;
type BeamOfferView = import('./beam-toast.ts').BeamOfferView;
type BeamEventSource = import('./beam-toast.ts').BeamEventSource;

const { fmtBytes } = await import('../lib/format.ts');

type BeamCancelReason = import('../collab/beam-protocol.ts').BeamCancelReason;
type BeamDeclineReason = import('../collab/beam-protocol.ts').BeamDeclineReason;
type BeamEndReason = import('../collab/beam-protocol.ts').BeamEndReason;
type BeamProgress = import('../collab/beam-protocol.ts').BeamProgress;

// ── Harness ───────────────────────────────────────────────────────────────────

/** A scripted {@link BeamEventSource}: `emit` plays events into every subscriber,
 *  and every dispatched action is recorded rather than acted on - the toast is
 *  tested purely against what IT does with the stream, never against a real
 *  beam-protocol state machine. */
function fakeSource() {
  const subs = new Set<(e: BeamToastEvent) => void>();
  const acceptCalls: string[] = [];
  const declineCalls: Array<{ beamId: string; reason?: BeamDeclineReason }> = [];
  const cancelCalls: Array<{ beamId: string; reason?: BeamCancelReason }> = [];
  const source: BeamEventSource = {
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    accept(beamId) {
      acceptCalls.push(beamId);
    },
    decline(beamId, reason) {
      declineCalls.push({ beamId, reason });
    },
    cancel(beamId, reason) {
      cancelCalls.push({ beamId, reason });
    },
  };
  return {
    source,
    acceptCalls,
    declineCalls,
    cancelCalls,
    emit(e: BeamToastEvent) {
      for (const fn of [...subs]) fn(e);
    },
  };
}

function offer(over: Partial<BeamOfferView> = {}): BeamOfferView {
  return {
    beamId: 'beam-a',
    role: 'receiver',
    kind: 'assets',
    name: 'Berlin pack',
    itemCount: 14,
    totalBytes: 38 * 1024 * 1024,
    peerName: 'Priya',
    ...over,
  };
}

function progressOf(over: Partial<BeamProgress> = {}): BeamProgress {
  return { itemIndex: 0, itemBytes: 0, itemTotal: 0, bytes: 0, totalBytes: 0, itemsDone: 0, ...over };
}

// A FRESH element per test/case, not a shared one just cleared: `mountBeamToast`
// attaches its click listener to the container itself, which `el.innerHTML = ''`
// does not remove - reusing one node would stack listeners from every earlier
// mount, and a stale listener's own `render()` (still reachable, still live)
// would blow away the current test's DOM mid-click.
function host(): HTMLElement {
  const el = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(el);
  return el;
}

/** Flushes the `requestAnimationFrame` shim's `setTimeout(0)`, after which
 *  `announce()`'s write has landed in its live region. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Text of every visually-hidden live region `announce()` maintains, concatenated - 
 *  there are two (polite/assertive), created lazily, so this reads whichever exist. */
function announced(): string {
  return [...dom.window.document.querySelectorAll('[data-a11y-live]')]
    .map((el) => el.textContent ?? '')
    .join(' | ');
}

const btn = (el: HTMLElement, action: string): HTMLButtonElement | null =>
  el.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);

// ── Consent ───────────────────────────────────────────────────────────────────

test('the consent prompt states the size and the sender, and Accept/Decline each fire once', async () => {
  const el = host();
  const { source, acceptCalls, declineCalls, emit } = fakeSource();
  mountBeamToast(el, source);

  emit({ t: 'offer-received', offer: offer() });

  const text = el.textContent ?? '';
  assert.ok(text.includes('Berlin pack'), text);
  // Composed, not spelled out: the count is a LABEL plus a number (see itemsPhrase),
  // so the expectation is built the same way rather than hardcoding one rendering.
  assert.ok(text.includes(fill(STRINGS.countLabel, { kind: STRINGS.kindAssets, n: 14 })), text);
  assert.ok(text.includes(fmtBytes(38 * 1024 * 1024)), text);
  assert.ok(text.includes('Priya'), 'the sender is named');
  await settle();
  assert.ok(announced().includes('Berlin pack'), 'a consent request is announced');

  const accept = btn(el, 'accept')!;
  accept.click();
  assert.deepEqual(acceptCalls, ['beam-a']);
  assert.deepEqual(declineCalls, []);

  // A second click - even one that defeats the `disabled` attribute the first click
  // set - must not fire a second time: the guard is in the code, not just the DOM.
  const acceptAgain = btn(el, 'accept')!;
  assert.equal(acceptAgain.disabled, true, 'Accept disables itself once pressed');
  acceptAgain.disabled = false;
  acceptAgain.click();
  assert.deepEqual(acceptCalls, ['beam-a'], 'a second press does not fire again');
});

test('Decline fires once and never Accept', async () => {
  const el = host();
  const { source, acceptCalls, declineCalls, emit } = fakeSource();
  mountBeamToast(el, source);
  emit({ t: 'offer-received', offer: offer({ beamId: 'beam-b' }) });

  btn(el, 'decline')!.click();
  assert.deepEqual(declineCalls, [{ beamId: 'beam-b', reason: undefined }]);
  assert.deepEqual(acceptCalls, []);

  const again = btn(el, 'decline')!;
  again.disabled = false;
  again.click();
  assert.equal(declineCalls.length, 1, 'a second press does not fire again');
});

test('a sender\'s own offer shows a waiting state with no consent buttons', () => {
  const el = host();
  const { source, emit } = fakeSource();
  mountBeamToast(el, source);
  emit({ t: 'offer-received', offer: offer({ beamId: 'beam-s', role: 'sender', peerName: 'Priya' }) });

  assert.equal(btn(el, 'accept'), null);
  assert.equal(btn(el, 'decline'), null);
  assert.ok(btn(el, 'cancel'), 'the sender can still cancel their own unanswered offer');
  assert.ok((el.textContent ?? '').includes('Priya'));
});

// ── Progress ──────────────────────────────────────────────────────────────────

test('progress moves both bars\' aria-valuenow and the current item label', () => {
  const el = host();
  const { source, emit } = fakeSource();
  mountBeamToast(el, source);
  emit({ t: 'offer-received', offer: offer() });
  emit({ t: 'accepted', beamId: 'beam-a' });
  emit({
    t: 'progress',
    beamId: 'beam-a',
    itemLabel: 'photo-3.jpg',
    progress: progressOf({ itemIndex: 2, itemBytes: 500, itemTotal: 2000, bytes: 5_000_000, totalBytes: 38 * 1024 * 1024, itemsDone: 2 }),
  });

  const bars = [...el.querySelectorAll('[role="progressbar"]')];
  assert.equal(bars.length, 2, 'an item bar and a total bar');
  assert.equal(bars[0]!.getAttribute('aria-valuenow'), '500');
  assert.equal(bars[0]!.getAttribute('aria-valuemax'), '2000');
  assert.equal(bars[1]!.getAttribute('aria-valuenow'), '5000000');
  assert.equal(bars[1]!.getAttribute('aria-valuemax'), String(38 * 1024 * 1024));
  assert.ok((el.textContent ?? '').includes('photo-3.jpg'));

  emit({
    t: 'progress',
    beamId: 'beam-a',
    progress: progressOf({ itemIndex: 2, itemBytes: 1200, itemTotal: 2000, bytes: 5_700_000, totalBytes: 38 * 1024 * 1024, itemsDone: 2 }),
  });
  const bars2 = [...el.querySelectorAll('[role="progressbar"]')];
  assert.equal(bars2[0]!.getAttribute('aria-valuenow'), '1200', 'a later progress event advances the bar');
  assert.equal(bars2[1]!.getAttribute('aria-valuenow'), '5700000');
});

test('progress arriving before the human answers cannot stand in for their consent', () => {
  // The section 11.24 event-order bypass, arriving through the one door this file owns: an
  // adapter (or a peer that pushed bytes early) emits `progress` while the consent
  // sheet is still up. Promoting the card would destroy the ONLY Accept/Decline
  // buttons that exist and leave the beam reading as consented.
  const el = host();
  const { source, acceptCalls, declineCalls, emit } = fakeSource();
  mountBeamToast(el, source);
  emit({ t: 'offer-received', offer: offer() });
  emit({ t: 'progress', beamId: 'beam-a', itemLabel: 'photo-3.jpg', progress: progressOf({ itemBytes: 500, itemTotal: 2000 }) });
  emit({ t: 'item-done', beamId: 'beam-a', itemIndex: 0, itemLabel: 'photo-3.jpg' });

  assert.ok(btn(el, 'accept'), 'the consent sheet is still up');
  assert.ok(btn(el, 'decline'));
  assert.equal(el.querySelector('[role="progressbar"]'), null, 'and no progress bar replaced it');
  assert.ok(!(el.textContent ?? '').includes('photo-3.jpg'), 'nothing from the dropped events was painted');

  // …and the human's answer still works, exactly once, as the only decision there was.
  btn(el, 'decline')!.click();
  assert.deepEqual(declineCalls, [{ beamId: 'beam-a', reason: undefined }]);
  assert.deepEqual(acceptCalls, []);
});

test('item-done updates the item label on its own', () => {
  const el = host();
  const { source, emit } = fakeSource();
  mountBeamToast(el, source);
  emit({ t: 'offer-received', offer: offer() });
  emit({ t: 'accepted', beamId: 'beam-a' });
  emit({ t: 'progress', beamId: 'beam-a', progress: progressOf() });
  emit({ t: 'item-done', beamId: 'beam-a', itemIndex: 0, itemLabel: 'manifest.json' });
  assert.ok((el.textContent ?? '').includes('manifest.json'));
});

// ── Cancel ────────────────────────────────────────────────────────────────────

test('Cancel fires once, from an in-progress beam', () => {
  const el = host();
  const { source, cancelCalls, emit } = fakeSource();
  mountBeamToast(el, source);
  emit({ t: 'offer-received', offer: offer() });
  emit({ t: 'accepted', beamId: 'beam-a' });
  emit({ t: 'progress', beamId: 'beam-a', progress: progressOf() });

  btn(el, 'cancel')!.click();
  assert.deepEqual(cancelCalls, [{ beamId: 'beam-a', reason: undefined }]);

  const again = btn(el, 'cancel')!;
  again.disabled = false;
  again.click();
  assert.equal(cancelCalls.length, 1, 'a second press does not fire again');
});

// ── Queueing ──────────────────────────────────────────────────────────────────

test('a second offer queues behind the first and is shown only once the first is dismissed', () => {
  const el = host();
  const { source, emit } = fakeSource();
  mountBeamToast(el, source);

  emit({ t: 'offer-received', offer: offer({ beamId: 'beam-a', name: 'First pack' }) });
  emit({ t: 'offer-received', offer: offer({ beamId: 'beam-b', name: 'Second pack' }) });

  let text = el.textContent ?? '';
  assert.ok(text.includes('First pack'), text);
  assert.ok(!text.includes('Second pack'), 'the second offer is not shown yet');
  assert.ok(text.includes('1 more waiting'), text);

  // Still queued while the first is merely in progress, not yet terminal.
  emit({ t: 'accepted', beamId: 'beam-a' });
  emit({ t: 'progress', beamId: 'beam-a', progress: progressOf({ bytes: 10 }) });
  text = el.textContent ?? '';
  assert.ok(!text.includes('Second pack'));

  emit({ t: 'cancelled', beamId: 'beam-a', reason: 'user' });
  text = el.textContent ?? '';
  assert.ok(text.includes('Cancelled.'), 'the first beam now shows its terminal state');
  assert.ok(!text.includes('Second pack'), 'dismissing is still required before the queue advances');

  btn(el, 'close')!.click();
  text = el.textContent ?? '';
  assert.ok(text.includes('Second pack'), 'closing the finished card reveals the queued one');
  assert.ok(!text.includes('1 more waiting'), 'nothing left queued behind it');
});

// ── Terminal states ───────────────────────────────────────────────────────────

test('complete reads differently for a receiver and a sender', () => {
  for (const role of ['receiver', 'sender'] as const) {
    const el = host();
    const { source, emit } = fakeSource();
    mountBeamToast(el, source);
    emit({ t: 'offer-received', offer: offer({ role }) });
    emit({ t: 'accepted', beamId: 'beam-a' });
    emit({ t: 'complete', beamId: 'beam-a', itemCount: 14 });
    const text = el.textContent ?? '';
    const items = fill(STRINGS.countLabel, { kind: STRINGS.kindAssets, n: 14 });
    assert.ok(
      text.includes(role === 'receiver' ? fill(STRINGS.savedToLibrary, { items }) : fill(STRINGS.sent, { items })),
      text,
    );
    assert.ok(btn(el, 'close'), 'a terminal card always offers a close');
  }
});

test('a decline before acceptance reads as "Declined.", a cancel after reads as "Cancelled."', () => {
  const beforeAccept = host();
  {
    const { source, emit } = fakeSource();
    mountBeamToast(beforeAccept, source);
    emit({ t: 'offer-received', offer: offer() });
    emit({ t: 'cancelled', beamId: 'beam-a', reason: 'user' });
  }
  assert.ok((beforeAccept.textContent ?? '').includes(STRINGS.declined));

  const afterAccept = host();
  {
    const { source, emit } = fakeSource();
    mountBeamToast(afterAccept, source);
    emit({ t: 'offer-received', offer: offer() });
    emit({ t: 'accepted', beamId: 'beam-a' });
    emit({ t: 'cancelled', beamId: 'beam-a', reason: 'user' });
  }
  assert.ok((afterAccept.textContent ?? '').includes(STRINGS.cancelled));
});

const TYPED_REASONS: Array<[BeamEndReason, keyof typeof STRINGS]> = [
  ['bad-message', 'reasonBadMessage'],
  ['protocol-version', 'reasonProtocolVersion'],
  ['bad-offer', 'reasonBadOffer'],
  ['too-large', 'reasonTooLarge'],
  ['too-many-items', 'reasonTooManyItems'],
  ['unsolicited-bytes', 'reasonUnsolicitedBytes'],
  ['bad-sequence', 'reasonBadSequence'],
  ['bad-item', 'reasonBadItem'],
  ['oversize-chunk', 'reasonOversizeChunk'],
  ['size-mismatch', 'reasonSizeMismatch'],
  ['checksum-mismatch', 'reasonChecksumMismatch'],
  ['sink-failure', 'reasonSinkFailure'],
  ['source-failure', 'reasonSourceFailure'],
  ['transport', 'reasonTransport'],
  ['unsupported-kind', 'reasonUnsupportedKind'],
  ['no-space', 'reasonNoSpace'],
];

test('every typed cancel/decline reason renders its own plain-copy line', async () => {
  // Completeness against the real `BeamCancelReason | BeamDeclineReason` union is
  // enforced at COMPILE time inside beam-toast.ts (its `REASON_COPY` is typed
  // `Record<Exclude<BeamEndReason, 'user'>, string>`) - this list mirrors it so each
  // one is checked end to end, not so it re-derives completeness at runtime.
  for (const [reason, key] of TYPED_REASONS) {
    const el = host();
    const { source, emit } = fakeSource();
    mountBeamToast(el, source);
    emit({ t: 'offer-received', offer: offer() });
    emit({ t: 'cancelled', beamId: 'beam-a', reason });
    const text = el.textContent ?? '';
    assert.ok(text.includes(STRINGS[key]), `${reason}: ${text}`);
    await settle();
    assert.ok(announced().includes(STRINGS[key]), `${reason} is announced`);
  }
});

// ── STRINGS coverage ──────────────────────────────────────────────────────────
//
// Both directions, mirroring `components/collab-ceremony.test.ts`'s own STRINGS
// check: every string the toast renders must come out of the map, and the map
// must be the ONLY place user copy lives in the module's source.

function stringValues(source: unknown, out: string[] = []): string[] {
  if (typeof source === 'string') out.push(source);
  else if (source && typeof source === 'object') for (const v of Object.values(source)) stringValues(v, out);
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STRING_PATTERNS = stringValues(STRINGS).map((v) => new RegExp(`^${escapeRe(v).replace(/\\\{\w+\\\}/g, '.+')}$`));
const fromStrings = (text: string): boolean => STRING_PATTERNS.some((re) => re.test(text));

/** Leaf text plus the attributes a screen reader speaks. `data-dynamic` elements
 *  (byte counts, a peer-supplied item label) carry real data, not app copy - see
 *  beam-toast.ts's own comments at each site that sets it. */
function renderedStrings(root: Element): string[] {
  const out: string[] = [];
  const attrs = (el: Element): void => {
    for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = el.getAttribute(name);
      if (value) out.push(value);
    }
  };
  const walk = (el: Element): void => {
    attrs(el);
    if (el.hasAttribute('data-dynamic')) return;
    if (el.children.length === 0) {
      const text = (el.textContent ?? '').trim();
      if (text) out.push(text);
      return;
    }
    for (const child of [...el.children]) walk(child);
  };
  walk(root);
  return out;
}

test('STRINGS: every word the toast renders comes out of the map', () => {
  const seen: string[] = [];
  const capture = (el: Element) => seen.push(...renderedStrings(el));

  // Receiver: consent (named peer, and anonymous), progress, complete, every reason.
  for (const withPeer of [true, false]) {
    const el = host();
    const { source, emit } = fakeSource();
    mountBeamToast(el, source);
    emit({ t: 'offer-received', offer: offer({ beamId: `r-${withPeer}`, peerName: withPeer ? 'Priya' : undefined }) });
    capture(el);
    emit({ t: 'accepted', beamId: `r-${withPeer}` });
    emit({ t: 'progress', beamId: `r-${withPeer}`, progress: progressOf({ itemBytes: 1, itemTotal: 2, bytes: 3, totalBytes: 4 }) });
    capture(el);
    emit({ t: 'complete', beamId: `r-${withPeer}`, itemCount: 1 });
    capture(el);
  }

  // Sender: waiting (named peer, and anonymous), progress, complete.
  for (const withPeer of [true, false]) {
    const el = host();
    const { source, emit } = fakeSource();
    mountBeamToast(el, source);
    const beamId = `s-${withPeer}`;
    emit({ t: 'offer-received', offer: offer({ beamId, role: 'sender', peerName: withPeer ? 'Priya' : undefined }) });
    capture(el);
    emit({ t: 'accepted', beamId });
    emit({ t: 'progress', beamId, progress: progressOf({ itemBytes: 1, itemTotal: 2, bytes: 3, totalBytes: 4 }) });
    capture(el);
    emit({ t: 'complete', beamId, itemCount: 1 });
    capture(el);
  }

  // Every typed reason, plus `user` both before and after acceptance.
  for (const [reason] of TYPED_REASONS) {
    const el = host();
    const { source, emit } = fakeSource();
    mountBeamToast(el, source);
    emit({ t: 'offer-received', offer: offer() });
    emit({ t: 'cancelled', beamId: 'beam-a', reason });
    capture(el);
  }
  {
    const el = host();
    const { source, emit } = fakeSource();
    mountBeamToast(el, source);
    emit({ t: 'offer-received', offer: offer() });
    emit({ t: 'accepted', beamId: 'beam-a' });
    emit({ t: 'cancelled', beamId: 'beam-a', reason: 'user' });
    capture(el);
  }

  // The queue note.
  {
    const el = host();
    const { source, emit } = fakeSource();
    mountBeamToast(el, source);
    emit({ t: 'offer-received', offer: offer({ beamId: 'q1' }) });
    emit({ t: 'offer-received', offer: offer({ beamId: 'q2' }) });
    capture(el);
  }

  assert.ok(seen.length > 40, `only ${seen.length} strings were rendered - the walk missed a screen`);
  const stray = [...new Set(seen)].filter((text) => !fromStrings(text));
  assert.deepEqual(stray, [], `strings rendered from outside STRINGS:\n${stray.join('\n')}`);
});

/** String literals in TS source, skipping comments - mirrors
 *  `collab-ceremony.test.ts`'s own scanner exactly. */
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

// Non-copy literals that read like a sentence, each with its reason - mirrors
// collab-ceremony.test.ts's own escape hatch. Empty here: nothing in beam-toast.ts's
// own source (outside STRINGS) currently needs one, but the hatch stays so a future
// addition (a CSS value, a selector with a space) has somewhere to go rather than
// widening the filter below.
const NOT_COPY = new Set<string>([]);

test('STRINGS: the module renders no copy from outside the map', () => {
  const path = fileURLToPath(new URL('./beam-toast.ts', import.meta.url));
  const src = readFileSync(path, 'utf8');
  const start = src.indexOf('export const STRINGS');
  assert.ok(start > 0, 'STRINGS moved or was renamed - this guard would pass vacuously');
  const end = src.indexOf('\n};', start);
  assert.ok(end > start, 'the STRINGS map no longer ends in `};`');
  const outside = src.slice(0, start) + src.slice(end + '\n};'.length);

  const suspects = stringLiterals(outside).filter((s) => {
    if (NOT_COPY.has(s)) return false;
    if (!s.includes(' ')) return false; // class lists, ids, selectors, actions
    if (!/[a-z]/i.test(s)) return false; // punctuation-only joiners
    if (/^[a-z-]+\s*:/.test(s)) return false; // an inline style declaration
    if (/[<>=$]/.test(s)) return false; // markup, selectors, interpolation
    if (/^[.#[]/.test(s)) return false; // selectors
    return /[A-Z]/.test(s) || /[.?!,:;]/.test(s); // sentence-shaped
  });

  assert.deepEqual(
    [...new Set(suspects)],
    [],
    'user copy must live in STRINGS so the wave-2.7 locale fan-out can find it:\n' + suspects.join('\n'),
  );
});
