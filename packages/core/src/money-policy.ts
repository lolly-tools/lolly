// SPDX-License-Identifier: MPL-2.0
/**
 * money-policy — the single, pure decision of whether a surface may render money.
 *
 * This is the degrade-to-counts enforcement, expressed as one testable function so
 * every surface (the export panel, the batch pre-pass, a future Studio inspector)
 * asks the SAME question and cannot drift. It carries NO figures and does NO
 * arithmetic — it only answers "show the worked cost, or show counts alone?".
 *
 * The keyed signal is per-SELECTION provenance, not per-tool navigation: a rate-card
 * selection that arrived in the boot query (`dirtyParams`, `views/tool.ts`) was
 * reached via a link — a share/bookmark round-trip — whereas a selection made by an
 * in-app control this session on this device is held only in memory. There is no
 * ambient "this was shared" boolean, and that is correct: the distinguishing fact is
 * how THIS card selection was made, not how the tool was opened.
 *
 * Consequences enforced here (see `plans/65-preflight-and-cost.md` §5 and Phase 5):
 *   - Rule 1: possession on THIS device is necessary. No card → counts only.
 *   - `validUntil`: expired rates suppress money unless the user explicitly opts in
 *     to using them anyway this session.
 *   - A link always opens on counts. Money is withheld until an explicit per-device
 *     reveal this session — which is device-local memory, never written to the URL.
 *   - A confidential (brand/catalog-shipped) card can ONLY ever be revealed by the
 *     explicit per-device action. Because every brand user holds it by construction,
 *     `hasCard` is trivially true for a client too, so the guard that actually
 *     protects the trade rates is `selectionFromUrl && !revealedThisSession` — a
 *     client always arrives via the link. The reveal for a confidential card must
 *     not persist and must not survive a reload.
 */

/**
 * The inputs the money/counts decision keys on. All device-local facts: nothing here
 * is derived from, or may be encoded into, a URL — the whole point is that a share
 * link carries no money and no card identity.
 */
export interface MoneyContext {
  /** A rate card matching the selection is stored ON THIS DEVICE. Rule 1: necessary. */
  readonly hasCard: boolean;
  /**
   * The card selection arrived in the boot query (`dirtyParams`) — i.e. the mount was
   * reached via a link (share/bookmark). A selection made by an in-app control this
   * session is `false`.
   */
  readonly selectionFromUrl: boolean;
  /**
   * The user clicked the explicit "Show costs?" action on THIS device THIS session.
   * Never written to a URL by `syncUrl`; never persisted for a confidential card.
   */
  readonly revealedThisSession: boolean;
  /** The selected card carries `confidential: true` (brand/catalog-shipped). */
  readonly cardConfidential: boolean;
  /** `now > card.issuer.validUntil`. */
  readonly expired: boolean;
  /** The user explicitly opted in to using expired rates this session. */
  readonly useExpiredAnyway: boolean;
}

/**
 * Decide whether money may be shown for this selection, on this device, right now.
 * Pure: same inputs, same answer, no I/O, no clock, no URL. `false` means degrade to
 * counts (the honest default), never "show a placeholder figure".
 */
export function canShowMoney(c: MoneyContext): boolean {
  // Rule 1 — possession on this device is necessary before anything else.
  if (!c.hasCard) return false;

  // §5 — expired rates suppress money unless the user explicitly opts in this session.
  if (c.expired && !c.useExpiredAnyway) return false;

  // §5 + Phase 5 — a link always opens on counts. Money is withheld until the explicit
  // per-device reveal. A confidential card can be revealed ONLY by that action, and a
  // client always arrives via the link, so this one line is what protects trade rates:
  // it holds whether or not the card happens to be flagged confidential.
  if (c.selectionFromUrl && !c.revealedThisSession) return false;

  // Own-session selection, or an explicit per-device reveal.
  return true;
}
