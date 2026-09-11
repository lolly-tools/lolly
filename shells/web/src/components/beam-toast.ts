// SPDX-License-Identifier: MPL-2.0
/**
 * beam-toast - the consent + progress UI for a **beam** (plan 100 section 6.4, section 4.6 point 6:
 * "Beam: progress/consent rides the existing toast/progress pill pattern (`.pro-toast`
 * family), with cancel; never a blocking modal.").
 *
 * WHAT THIS FILE IS NOT. It never imports `../collab/beam-protocol.ts`'s
 * `BeamSender`/`BeamReceiver` (only their exported TYPES, for the reason vocabulary),
 * never touches `RTCDataChannel`, and never imports any of the in-flight collab UI
 * (`collab-pill.ts`, `collab-ceremony.ts`, `collab-focus.ts`, `collab-overlay.ts`).
 * Like `beam-protocol.ts` itself, this is a pure consumer of a documented contract - 
 * here, an EVENT STREAM rather than a wire - so it mounts and is fully exercised
 * headlessly with a fake {@link BeamEventSource}, with no transport, no worker, and no
 * beam-protocol instance anywhere in this file or its test.
 *
 * ── The event union ───────────────────────────────────────────────────────────
 *
 * {@link BeamToastEvent} is shaped to be a thin, direct read of
 * `BeamSender`/`BeamReceiver`'s own `subscribe(state => …)` surface (see
 * `beam-protocol.ts`'s `BeamSendState`/`BeamRecvState`/`BeamProgress`), so an adapter
 * written elsewhere has almost nothing to translate:
 *
 *   beam-protocol phase transition                    → BeamToastEvent
 *   -------------------------------------------------    -----------------
 *   an offer exists (`'offered'`, either side)         → 'offer-received'
 *   the peer accepted (sender) / I accepted (receiver) → 'accepted'
 *   `nextChunk()` / `receiveBinary()` advance `progress`→ 'progress'
 *   an item's `finalize`+verify settles                → 'item-done'
 *   `'complete'`                                       → 'complete'
 *   `'declined'` or `'cancelled'`                       → 'cancelled' { reason }
 *
 * `BeamSendState.reason`/`BeamRecvState.reason` is already typed `BeamEndReason`
 * (`BeamCancelReason | BeamDeclineReason`), imported here as a TYPE ONLY, so the copy
 * map below is exhaustive against the real wire vocabulary and a future reason added
 * to the protocol fails this file's typecheck instead of rendering silently blank.
 *
 * ── The action channel ────────────────────────────────────────────────────────
 *
 * Events flow ONE way, adapter → toast. The toast never mutates its own idea of a
 * beam's state on a click - it calls back through {@link BeamEventSource}'s
 * `accept`/`decline`/`cancel` (the same object that supplies `subscribe`, doing double
 * duty as a small port rather than forcing a second constructor argument) and waits for
 * the resulting event to arrive before it paints anything new. That is what makes
 * "fires accept/decline once" a real guarantee rather than a UI promise: a second click
 * cannot desync the toast from whatever beam-protocol actually decided, because the
 * toast never decided anything on its own. The same rule runs the other way: an event
 * that arrives out of order never PROMOTES a card past a decision the human has not
 * made. A `progress` frame for a card still showing the consent sheet is dropped, not
 * treated as an implied acceptance - see `apply()`'s `progress` case.
 *
 * ── Queueing (section 6.4: "never a blocking modal … multiple beams queue, one visible at a
 * time") ──
 *
 * One `mountBeamToast()` call is a single toast HOST that can receive events for
 * several different `beamId`s over time (e.g. two people beam something back to back,
 * or an outgoing beam and an incoming one overlap). Internally it is a FIFO queue of
 * per-beam card state; only the front of the queue is ever painted. A card is removed
 * from the queue ONLY by an explicit dismiss (the ✕), which is offered ONLY once a beam
 * has reached a terminal state (`complete`/`cancelled`) - there is deliberately no way
 * to "hide" a beam that is still being decided or still in flight, so a queued offer
 * never silently pre-empts one the human hasn't answered yet, and a queued beam never
 * quietly loses its own terminal result before it's been shown.
 *
 * ── A11y ───────────────────────────────────────────────────────────────────────
 *
 * `announce()` fires at exactly three moments - a consent request landing (receiver
 * role only: the sender's own "waiting to be accepted" card is not a request FOR the
 * local human), completion, and failure - never on every progress tick, which would
 * spam a live region on a beam sending many small chunks. Progress is instead exposed
 * the way a progress bar should be: `role="progressbar"` + `aria-valuenow` on both bars
 * (current item and running total), read on demand rather than narrated continuously.
 * The entrance animation is reduced-motion-guarded in `beam-toast.css`; nothing else
 * here moves.
 *
 * ── Copy ───────────────────────────────────────────────────────────────────────
 *
 * One map, one namespace. Every value in {@link STRINGS} IS its own catalog key - 
 * `i18n.ts` looks a translation up by the English source - and the lazy `collab`
 * namespace carries the translations (this copy appears only once a collab is running,
 * so it has no business in a boot catalog). `tRaw`, not `t`: every string below is
 * `escape()`d at its sink or handed to `announce()`, so t()'s param escaping would
 * double-escape a peer's name into `O&#39;Brien`.
 */

import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';
import { currentLang, loadNamespace, tRaw } from '../i18n.ts';
import { fmtBytes } from '../lib/format.ts';
import type {
  BeamCancelReason,
  BeamDeclineReason,
  BeamEndReason,
  BeamKind,
  BeamProgress,
} from '../collab/beam-protocol.ts';
import './beam-toast.css';

// ── Copy ──────────────────────────────────────────────────────────────────────

export const STRINGS = {
  // Consent (receiver only).
  consentPrompt: "Receive '{name}' - {items}, {size}?",
  fromPeer: 'From {peer}',
  accept: 'Accept',
  decline: 'Decline',

  // Sender, before the peer has answered.
  waitingFor: "Waiting for {peer} to accept '{name}'…",
  waitingForGeneric: "Waiting for the other device to accept '{name}'…",

  // In progress, both roles.
  sendingTitle: "Sending '{name}'",
  receivingTitle: "Receiving '{name}'",
  itemProgress: '{done} of {count}',
  totalProgress: 'Total',
  cancel: 'Cancel',

  // Terminal.
  savedToLibrary: 'Saved to your library - {items}',
  sent: 'Sent - {items}',
  declined: 'Declined.',
  cancelled: 'Cancelled.',
  close: 'Close',

  // Queue.
  queueMore: '{n} more waiting',

  // The item count, per beam kind (BEAM_KINDS: session/assets/project/tag-pack).
  // A LABEL and a number, never a numeral in front of a noun - see itemsPhrase.
  countLabel: '{kind}: {n}',
  kindItems: 'Items',
  kindAssets: 'Assets',
  kindSessions: 'Sessions',
  kindProjects: 'Projects',

  // Typed cancel/decline reasons - one line each, exhaustive against BeamEndReason
  // (see REASON_COPY below; TypeScript enforces completeness against the real
  // union, so a reason beam-protocol adds later fails this file's typecheck
  // instead of rendering blank). `user` is handled separately (declined/cancelled
  // above), since the same wire word means two different things depending on
  // whether the beam had been accepted yet.
  reasonBadMessage: "Something arrived that Lolly couldn't read. Nothing was saved.",
  reasonProtocolVersion: 'The other device is running a different version of Lolly.',
  reasonBadOffer: "That offer didn't add up. Nothing was saved.",
  reasonTooLarge: 'Too large for this device.',
  reasonTooManyItems: 'Too many items for this device.',
  reasonUnsolicitedBytes: 'Data arrived before it was accepted. Nothing was saved.',
  reasonBadSequence: 'The transfer arrived out of order. Nothing was saved.',
  reasonBadItem: "The transfer referred to something that wasn't offered. Nothing was saved.",
  reasonOversizeChunk: 'A piece of the transfer was too big. Nothing was saved.',
  reasonSizeMismatch: "The transfer didn't match its declared size. Nothing was saved.",
  reasonChecksumMismatch: "The transfer didn't verify. Nothing was saved.",
  reasonSinkFailure: "This device couldn't store the transfer.",
  reasonSourceFailure: "The other device couldn't read the file.",
  reasonTransport: 'The connection dropped.',
  reasonUnsupportedKind: "This device can't receive that kind of beam.",
  reasonNoSpace: 'Not enough space on this device.',
};

/**
 * Fill `{placeholder}` slots in a copy string.
 *
 * A named re-export of `tRaw`, kept so this file's suite builds its expectations with
 * the verb it always had. In English the two are the same substitution; in any other
 * language `tRaw` looks the source up in the `collab` catalog first.
 *
 * @deprecated for new code - call {@link tRaw} directly.
 */
export const fill = tRaw;

// The two tables below hold KEY NAMES (`keyof typeof STRINGS`), not copy. That is what
// keeps the "every STRINGS reference sits inside a t()/tRaw() call" rule true of this
// file - a table of resolved strings would be a set of untranslated references that the
// scan cannot tell apart from a missed one - and TypeScript still checks both for
// exhaustiveness and for typos against the map's own keys.

const KIND_LABEL_KEYS: Record<BeamKind, keyof typeof STRINGS> = {
  session: 'kindSessions',
  assets: 'kindAssets',
  project: 'kindProjects',
  'tag-pack': 'kindItems',
};

/**
 * "Assets: 14" - the beam's kind as a label, then the count.
 *
 * NOT "{n} assets". A numeral in front of a noun forces agreement the catalog format
 * cannot express: i18n.ts's `t()`/`tRaw()` is `String.replaceAll` over `{name}` slots
 * and nothing more, so there is no plural category to select on. The previous version
 * carried one singular slot and one plural slot and asked every translator to put the
 * language's GENERAL counting form in the plural one, which is wrong for a Slavic 2-4
 * ("2 zasobów"), wrong for an Arabic dual, and - visible in the shipped catalogs - 
 * pushed Chinese into smuggling a measure word into the noun itself (`项素材`,
 * `个会话`), where it reads as a fragment anywhere the count is not directly in front.
 *
 * Detaching the count removes the agreement instead of guessing at it: `Assets` is a
 * bare label in its citation form, `{n}` never governs it, and every language gets a
 * form that is right for every number. The joiner is its own key so a locale can
 * repunctuate (`资产：14`) or reorder it without touching the labels.
 *
 * The real plural rule (Intl.PluralRules over `one|few|many` catalog entries) is still
 * the eventual answer, and it is a change to the catalog FORMAT and therefore to every
 * corpus at once. This phrasing is correct in the meantime rather than agreed-upon-wrong.
 */
function itemsPhrase(kind: BeamKind, n: number): string {
  return tRaw(STRINGS.countLabel, { kind: tRaw(STRINGS[KIND_LABEL_KEYS[kind]]), n });
}

/** Every reason except `user`, which reads differently depending on whether the beam
 *  had been accepted yet (see {@link reasonCopy}) - kept out of this table so its two
 *  meanings can't be muddled into one generic line. */
const REASON_KEYS: Record<Exclude<BeamEndReason, 'user'>, keyof typeof STRINGS> = {
  'bad-message': 'reasonBadMessage',
  'protocol-version': 'reasonProtocolVersion',
  'bad-offer': 'reasonBadOffer',
  'too-large': 'reasonTooLarge',
  'too-many-items': 'reasonTooManyItems',
  'unsolicited-bytes': 'reasonUnsolicitedBytes',
  'bad-sequence': 'reasonBadSequence',
  'bad-item': 'reasonBadItem',
  'oversize-chunk': 'reasonOversizeChunk',
  'size-mismatch': 'reasonSizeMismatch',
  'checksum-mismatch': 'reasonChecksumMismatch',
  'sink-failure': 'reasonSinkFailure',
  'source-failure': 'reasonSourceFailure',
  transport: 'reasonTransport',
  'unsupported-kind': 'reasonUnsupportedKind',
  'no-space': 'reasonNoSpace',
};

/** Plain copy for a terminal `cancelled` event. `everAccepted` disambiguates `user`:
 *  pressed before anyone accepted reads as a decline, after as a cancel. */
function reasonCopy(reason: BeamEndReason, everAccepted: boolean): string {
  if (reason === 'user') return tRaw(everAccepted ? STRINGS.cancelled : STRINGS.declined);
  return tRaw(STRINGS[REASON_KEYS[reason]]);
}

// ── The event union ──────────────────────────────────────────────────────────

export type BeamRole = 'sender' | 'receiver';

/** What a beam offer looks like to a human. Deliberately NOT `beam-protocol.ts`'s own
 *  `BeamOfferMessage` - that has no notion of the human on the other end, which is a
 *  presence concern (plan section 4.6's naming rules), not a wire concern. `peerName` is
 *  already the resolved display string ("Priya", "Host", "Invitee") by the time it
 *  reaches here. */
export interface BeamOfferView {
  readonly beamId: string;
  readonly role: BeamRole;
  readonly kind: BeamKind;
  /** The pack's own name - "Berlin pack", a session's title, … */
  readonly name: string;
  /** The real payload count the consent sheet should say (an adapter building this
   *  from `lib/beam-pack.ts`'s manifest-plus-items offer excludes the bookkeeping
   *  manifest entry - this is what a human should be told, not `items.length`). */
  readonly itemCount: number;
  readonly totalBytes: number;
  /** Absent when the adapter has no presence identity to offer. */
  readonly peerName?: string;
}

export type BeamToastEvent =
  | { readonly t: 'offer-received'; readonly offer: BeamOfferView }
  | { readonly t: 'accepted'; readonly beamId: string }
  | { readonly t: 'progress'; readonly beamId: string; readonly progress: BeamProgress; readonly itemLabel?: string }
  | { readonly t: 'item-done'; readonly beamId: string; readonly itemIndex: number; readonly itemLabel?: string }
  | { readonly t: 'complete'; readonly beamId: string; readonly itemCount: number }
  | { readonly t: 'cancelled'; readonly beamId: string; readonly reason: BeamEndReason };

/**
 * The single object a caller hands to {@link mountBeamToast} - a stream in
 * (`subscribe`) and the three actions the toast can dispatch back out. One object
 * rather than two arguments so a caller wires exactly one adapter per beam direction
 * (or one multiplexed adapter covering both), and so this file never has to reconcile
 * two independently-lived handles.
 */
export interface BeamEventSource {
  /** Called once per event, in order. Returns an unsubscribe function. */
  subscribe(fn: (event: BeamToastEvent) => void): () => void;
  /** The consent gate's yes (receiver only; a no-op if `beamId` isn't awaiting one). */
  accept(beamId: string): void;
  /** The consent gate's no (receiver only). */
  decline(beamId: string, reason?: BeamDeclineReason): void;
  /** Either side's stop, at any phase. */
  cancel(beamId: string, reason?: BeamCancelReason): void;
}

export interface BeamToastHandle {
  /** Unsubscribes from the source and clears the mounted toast, if any. */
  dispose(): void;
}

// ── Per-beam card state ─────────────────────────────────────────────────────────

interface Card {
  offer: BeamOfferView;
  accepted: boolean;
  /** Guards a second click on the current phase's primary action(s) - reset when the
   *  card moves into the accepted/active phase, so Cancel there starts out enabled
   *  regardless of whether Accept had already been pressed to get here. */
  decided: boolean;
  progress?: BeamProgress;
  itemLabel?: string;
  terminal?: { kind: 'complete'; itemCount: number } | { kind: 'cancelled'; reason: BeamEndReason };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function progressBar(label: string, valueLabel: string, now: number, max: number, extraClass = ''): string {
  const pct = max > 0 ? Math.min(100, Math.round((now / max) * 100)) : 0;
  // `valueLabel` is computed byte counts ("12.0 MB / 38.0 MB"), not app copy - marked
  // `data-dynamic` so the STRINGS-coverage walk (beam-toast.test.ts) doesn't expect a
  // number to come out of the copy map (the same convention `collab-ceremony.ts` uses
  // for its own scanned/peer-supplied text).
  return `<div class="beam-toast-bar-row">
    <span class="beam-toast-bar-label"><span>${escape(label)}</span><span data-dynamic="true">${escape(valueLabel)}</span></span>
    <div class="beam-toast-track" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${now}"><span class="beam-toast-fill${extraClass}" style="width:${pct}%"></span></div>
  </div>`;
}

function renderCard(card: Card, extraQueued: number): string {
  const { offer } = card;
  let body: string;
  let closeBtn = '';

  if (card.terminal) {
    body = card.terminal.kind === 'complete'
      ? `<p class="beam-toast-terminal">${escape(tRaw(offer.role === 'receiver' ? STRINGS.savedToLibrary : STRINGS.sent, { items: itemsPhrase(offer.kind, card.terminal.itemCount) }))}</p>`
      : `<p class="beam-toast-terminal beam-toast-terminal--err">${escape(reasonCopy(card.terminal.reason, card.accepted))}</p>`;
    // The ✕ dismisses ONLY once a beam is done deciding - see the file header's
    // queueing note for why an in-flight or undecided beam never gets one. The glyph
    // itself isn't copy (a screen reader is told "Close" via `aria-label`, from
    // STRINGS) - `data-dynamic` here means "skip the leaf text, keep the attrs".
    closeBtn = `<button type="button" class="beam-toast-close" data-action="close" data-dynamic="true" aria-label="${escape(tRaw(STRINGS.close))}">✕</button>`;
  } else if (!card.accepted) {
    if (offer.role === 'receiver') {
      const prompt = tRaw(STRINGS.consentPrompt, {
        name: offer.name,
        items: itemsPhrase(offer.kind, offer.itemCount),
        size: fmtBytes(offer.totalBytes),
      });
      const peer = offer.peerName ? `<p class="beam-toast-peer">${escape(tRaw(STRINGS.fromPeer, { peer: offer.peerName }))}</p>` : '';
      body = `<p class="beam-toast-msg">${escape(prompt)}</p>${peer}
        <div class="beam-toast-actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="decline"${card.decided ? ' disabled' : ''}>${escape(tRaw(STRINGS.decline))}</button>
          <button type="button" class="btn btn--primary btn--sm" data-action="accept"${card.decided ? ' disabled' : ''}>${escape(tRaw(STRINGS.accept))}</button>
        </div>`;
    } else {
      const msg = offer.peerName
        ? tRaw(STRINGS.waitingFor, { peer: offer.peerName, name: offer.name })
        : tRaw(STRINGS.waitingForGeneric, { name: offer.name });
      body = `<p class="beam-toast-msg">${escape(msg)}</p>
        <div class="beam-toast-actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="cancel"${card.decided ? ' disabled' : ''}>${escape(tRaw(STRINGS.cancel))}</button>
        </div>`;
    }
  } else {
    const p = card.progress;
    const posDisplay = Math.min(offer.itemCount, (p?.itemIndex ?? 0) + 1);
    // The item's own label (a filename, an asset name, …) is peer/sender-supplied
    // data, not app copy - `data-dynamic` for the same reason as the byte counts above.
    const itemLine = card.itemLabel ? `<p class="beam-toast-item" data-dynamic="true">${escape(card.itemLabel)}</p>` : '';
    const itemBar = progressBar(
      tRaw(STRINGS.itemProgress, { done: posDisplay, count: offer.itemCount }),
      `${fmtBytes(p?.itemBytes ?? 0)} / ${fmtBytes(p?.itemTotal ?? 0)}`,
      p?.itemBytes ?? 0,
      p?.itemTotal ?? 0,
    );
    const totalBar = progressBar(
      tRaw(STRINGS.totalProgress),
      `${fmtBytes(p?.bytes ?? 0)} / ${fmtBytes(offer.totalBytes)}`,
      p?.bytes ?? 0,
      offer.totalBytes,
      ' beam-toast-fill--total',
    );
    body = `<p class="beam-toast-msg">${escape(tRaw(offer.role === 'receiver' ? STRINGS.receivingTitle : STRINGS.sendingTitle, { name: offer.name }))}</p>
      ${itemLine}${itemBar}${totalBar}
      <div class="beam-toast-actions">
        <button type="button" class="btn btn--ghost btn--sm" data-action="cancel"${card.decided ? ' disabled' : ''}>${escape(tRaw(STRINGS.cancel))}</button>
      </div>`;
  }

  const queueNote = extraQueued > 0 ? `<p class="beam-toast-queue">${escape(tRaw(STRINGS.queueMore, { n: extraQueued }))}</p>` : '';
  // Deliberately NO `role="status"` here: `container.innerHTML` is reassigned wholesale
  // on every render (including once per progress tick), so a live-region role on this
  // node would have assistive tech treat every re-paint as freshly-arrived content and
  // re-announce it - exactly the spam the file header's a11y section rules out. The
  // three real announcements go through `announce()`'s own stable, dedicated region.
  return `<div class="beam-toast">${closeBtn}${body}${queueNote}</div>`;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountBeamToast(container: HTMLElement, source: BeamEventSource): BeamToastHandle {
  const cards = new Map<string, Card>();
  const queue: string[] = [];

  const frontId = (): string | undefined => queue[0];

  function render(): void {
    const id = frontId();
    if (id === undefined) {
      container.innerHTML = '';
      return;
    }
    const card = cards.get(id);
    if (!card) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = renderCard(card, Math.max(0, queue.length - 1));
  }

  function dismissFront(): void {
    const id = queue.shift();
    if (id !== undefined) cards.delete(id);
    render();
  }

  function apply(event: BeamToastEvent): void {
    switch (event.t) {
      case 'offer-received': {
        const id = event.offer.beamId;
        if (cards.has(id)) return; // duplicate offer for a known beam - ignore
        cards.set(id, { offer: event.offer, accepted: false, decided: false });
        queue.push(id);
        if (event.offer.role === 'receiver') {
          announce(tRaw(STRINGS.consentPrompt, {
            name: event.offer.name,
            items: itemsPhrase(event.offer.kind, event.offer.itemCount),
            size: fmtBytes(event.offer.totalBytes),
          }));
        }
        render();
        return;
      }
      case 'accepted': {
        const card = cards.get(event.beamId);
        if (!card) return;
        card.accepted = true;
        card.decided = false;
        if (event.beamId === frontId()) render();
        return;
      }
      // `progress` and `item-done` describe a beam that is already moving. Neither may
      // ADVANCE a card into the accepted phase: the consent sheet is the only place
      // `accept`/`decline` exist, so treating an early progress frame as consent would
      // destroy the buttons and leave the human unable to answer while the card reads
      // as though they had - the section 11.24 event-order bypass, arriving through the one
      // door this file owns. (`beam-protocol.ts`'s receiver refuses pre-consent bytes
      // too; this layer must hold on its own, because it is specified against an
      // untyped event stream from an adapter it does not control.)
      case 'progress': {
        const card = cards.get(event.beamId);
        if (!card || !card.accepted) return;
        card.progress = event.progress;
        if (event.itemLabel !== undefined) card.itemLabel = event.itemLabel;
        if (event.beamId === frontId()) render();
        return;
      }
      case 'item-done': {
        const card = cards.get(event.beamId);
        if (!card || !card.accepted) return;
        if (event.itemLabel !== undefined) card.itemLabel = event.itemLabel;
        if (event.beamId === frontId()) render();
        return;
      }
      case 'complete': {
        const card = cards.get(event.beamId);
        if (!card) return;
        card.terminal = { kind: 'complete', itemCount: event.itemCount };
        announce(tRaw(card.offer.role === 'receiver' ? STRINGS.savedToLibrary : STRINGS.sent, {
          items: itemsPhrase(card.offer.kind, event.itemCount),
        }));
        if (event.beamId === frontId()) render();
        return;
      }
      case 'cancelled': {
        const card = cards.get(event.beamId);
        if (!card) return;
        card.terminal = { kind: 'cancelled', reason: event.reason };
        announce(reasonCopy(event.reason, card.accepted));
        if (event.beamId === frontId()) render();
        return;
      }
    }
  }

  function onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest<HTMLButtonElement>('[data-action]');
    if (!btn || !container.contains(btn)) return;
    const id = frontId();
    if (id === undefined) return;
    const card = cards.get(id);
    if (!card) return;
    const action = btn.dataset.action;
    switch (action) {
      case 'accept':
        if (card.decided) return;
        card.decided = true;
        render();
        source.accept(id);
        return;
      case 'decline':
        if (card.decided) return;
        card.decided = true;
        render();
        source.decline(id);
        return;
      case 'cancel':
        if (card.decided) return;
        card.decided = true;
        render();
        source.cancel(id);
        return;
      case 'close':
        dismissFront();
        return;
    }
  }

  container.addEventListener('click', onClick);
  const unsubscribe = source.subscribe(apply);
  render();

  // The toast's copy lives in the lazy `collab` namespace (i18n.ts), which the mount is
  // the natural moment to ask for. English skips it outright rather than relying on
  // loadNamespace's own early return: the repaint would be pure churn in the language
  // the map is written in, and skipping it keeps an English build behaving exactly as it
  // did before this wave. A repaint is safe at any time - `render()` rebuilds the front
  // card from state and this container has no live region on it (see renderCard).
  let disposed = false;
  if (currentLang() !== 'en') {
    void loadNamespace('collab').then(() => { if (!disposed) render(); });
  }

  return {
    dispose() {
      disposed = true;
      unsubscribe();
      container.removeEventListener('click', onClick);
      container.innerHTML = '';
    },
  };
}
