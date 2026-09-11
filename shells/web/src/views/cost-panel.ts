// SPDX-License-Identifier: MPL-2.0
/**
 * The cost panel - "Cost, worked out from your rate card"
 * (plans/65-preflight-and-cost.md section 6, Phases 4/5).
 *
 * The engine owns the ARITHMETIC (`engine/src/rate-card.ts` `computeCost`, integer
 * minor units, no formatting); `@lolly-tools/core` owns the CURRENCY formatter and
 * the degrade predicate (`money.ts` `formatMoney`, `money-policy.ts` `canShowMoney`).
 * This module owns only the two shell-side halves: turning a computed working into a
 * VIEW, and writing that view into the panel's DOM. `views/tool-actions.ts` collects
 * the card, computes the working, and builds the {@link CostPanelContext}.
 *
 * The invariant above all: **never invent money.** Every figure here is
 * `formatMoney(minorUnits, card.currency)` - a rate the user supplied times a
 * quantity Lolly counted. There is no default currency, no placeholder, no zero
 * stand-in. When money may not be shown (`canShowMoney` is false), the working table
 * is NOT rendered - the panel degrades to a plain explanation, never to a hidden or
 * greyed-out figure.
 *
 * Decisions carried from the preflight card and required here:
 *
 *  1. **Chrome, never the export.** The card carries `data-export-hide` and is a real
 *     `<details>`; it must never move a pixel of the exported PNG/SVG/PDF - a render
 *     is the user's creative output and its geometry is shared with the CLI.
 *  2. **Format first, interpolate second.** Every amount is formatted by
 *     `Intl.NumberFormat` (via `formatMoney`) BEFORE it enters a translated string.
 *     The `t()` strings live in `lib/cost-strings.ts`; a currency symbol in any of
 *     them is a bug, and the amount, issuer and date never split across strings.
 *  3. **A link cannot show money.** `canShowMoney` withholds the figure for any mount
 *     reached via a link until an explicit per-device reveal - see `costView`'s gate
 *     and `cost-panel.test.ts`, which proves the working table is unreachable from a
 *     link-provenance context.
 */

import { formatMoney } from '@lolly-tools/core';
import { canShowMoney } from '@lolly-tools/core';
import type { MoneyContext } from '@lolly-tools/core';
import type { CostWorking, CostRow } from '@lolly/engine';
import type { RateCardsHost } from '../lib/rate-cards.ts';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import {
  costHeading, noCardBody, figureLine, disclaimerLine, showArithmetic,
  partialCoverageHeadline, upTo, reportedSource, minimumChargeApplied,
  showCostsPrompt, ratesExpired, useExpiredAnyway, figureExpiredNote,
} from '../lib/cost-strings.ts';

// ─── The view model (pure - this is the tested half) ────────────────────────

/** One priced multiplication, already formatted. */
export interface CostRowVM {
  /** `plate-setup (perPlate)` - the card line id + kind, so a reader can point at it. */
  readonly line: string;
  /** `4 plate × €35.00` - the counted quantity times the card's rate, formatted. */
  readonly calc: string;
  /** `up to €140.00` - the subtotal, `up to …` when the count is a ceiling (rule 4). */
  readonly amount: string;
}

/** A visible adjustment row (the minimum charge), already formatted (rule 3). */
export interface CostAdjustmentVM {
  readonly label: string;
  /** `+ €30.00` - a string-free amount cell (no translatable content). */
  readonly amount: string;
}

export type CostMode = 'no-card' | 'suppressed' | 'working';

export interface CostView {
  /** False when there is nothing to say (job not costable): the card is not rendered. */
  readonly show: boolean;
  readonly heading: string;
  readonly mode: CostMode;
  /** The `no-card` explanation, or the `suppressed` reason. */
  readonly message?: string;
  /** The per-device reveal action label, present only when a link withheld money. */
  readonly revealPrompt?: string;
  /** The opt-in-to-expired action label, present only when expiry withheld money. */
  readonly expiredAction?: string;
  /** `The file says: …. Lolly has not verified this.` - reported speech (section 5). */
  readonly reportedSource?: string;
  readonly rows?: readonly CostRowVM[];
  readonly adjustments?: readonly CostAdjustmentVM[];
  /**
   * The partial-coverage headline (rule 2): `N of M cost lines are not priced …`.
   * Present iff `total` is null. There is no scalar figure alongside it to copy.
   */
  readonly headline?: string;
  /**
   * The full-coverage figure with its source inline (`€X using Issuer rates dated D`),
   * or `null` on partial coverage. NEVER a bare number, never a partial scalar.
   */
  readonly total?: string | null;
  /**
   * The expiry stamp on a figure computed from opted-in expired rates (section 5). Present
   * only on the working path when the card had lapsed and the user opted in - the
   * caveat rides WITH the figure so a lapsed total is never read as a current one.
   */
  readonly expiredNote?: string;
  readonly disclaimer?: string;
}

/** What the shell knows about the job + card that the pure view needs. */
export interface CostPanelContext {
  /** The job produced at least one count a rate card could price. Off → hide entirely. */
  readonly costable: boolean;
  /** The `canShowMoney` inputs - the degrade decision keys entirely on these. */
  readonly money: MoneyContext;
  /** The issuer name the card CLAIMS (reported speech, unverified). */
  readonly issuerName?: string;
  /** The issue date the card claims. */
  readonly issued?: string;
  /** The valid-until the card claims (for the expiry message). */
  readonly validUntil?: string;
  /** The reader's locale for date formatting. Undefined = runtime default (valid.ts rule). */
  readonly locale?: string;
}

/**
 * The typed context the `cost-authoring` slot mount site passes to a hydrated
 * authoring extension (the `CostAuthoringContext` named in
 * `@lolly-tools/core/extension-v1`'s SLOT_REGISTRY). It carries exactly the two
 * things the extracted authoring furniture needs: the storage/consumption rail it
 * writes cards to, and a callback so a newly-dropped or removed card re-prices the
 * panel immediately. This is the CONSUMER-side type: core owns it; the furniture in
 * `src/ext/cost-authoring.ts` (and any control-plane/community supplier) imports it.
 *
 * Core keeps the door + the counts + the calculator + card CONSUMPTION; only the
 * AUTHORING UI is hydrated. With the slot empty, nothing here is ever constructed.
 */
export interface CostAuthoringContext {
  /** The user-asset store the authoring UI reads/writes cards through (consumption
   *  plumbing that stays in core - the furniture never re-implements storage). */
  readonly host: RateCardsHost;
  /** A card landed or left the library - re-run the cost pass so the panel reprices. */
  onChange(): void | Promise<void>;
}

// ─── formatting helpers (pure) ──────────────────────────────────────────────

/** Format integer minor units with the card's currency. There is no default
 *  currency: `working.currency` came from the card. `formatMoney` throws on a bad
 *  code rather than degrading to a symbol, so a corrupt card fails loudly. */
const money = (minorUnits: number, currency: string): string =>
  formatMoney({ minorUnits, currency });

/** A subtotal, prefixed `up to …` when the contributing count is a ceiling (rule 4):
 *  a bound is never laundered into an unqualified figure by multiplying it. */
const boundAmount = (minorUnits: number, currency: string, ceiling: boolean): string =>
  ceiling ? upTo(money(minorUnits, currency)) : money(minorUnits, currency);

/** A card's claimed date, formatted for the reader, or the raw claim if unparseable
 *  (it is a claim inside a dropped file, never trusted as a real date). */
const claimedDate = (raw: string | undefined, locale: string | undefined): string => {
  if (!raw) return '';
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return raw;
  try {
    return new Date(t).toLocaleDateString(locale, { dateStyle: 'medium' });
  } catch {
    return raw;
  }
};

/** One working row → its formatted view. */
const rowVM = (r: CostRow, currency: string): CostRowVM => {
  const noun = r.unit ?? (r.quantityKind === 'job' ? 'job' : r.quantityKind === 'runLength' ? 'unit' : '');
  const box = r.box ? ` ${r.box}` : '';
  const qty = noun ? `${r.quantity} ${noun}${box}` : String(r.quantity);
  const brk = r.breakApplied
    ? (r.breakApplied.mode === 'flat'
      ? ` (tier from ${r.breakApplied.min})`
      : ` (band ${r.breakApplied.min}–${r.breakApplied.upTo})`)
    : '';
  return {
    line: `${r.lineId} (${r.kind})`,
    calc: `${qty} × ${money(r.unitRate, currency)}${brk}`,
    amount: boundAmount(r.subtotal, currency, r.subtotalBound === 'ceiling'),
  };
};

// ─── working → view ─────────────────────────────────────────────────────────

/**
 * Turn a computed working (or its absence) into everything the card renders. Pure:
 * no DOM, no globals beyond the i18n catalog. This is the half worth testing, and
 * the half that PROVES the degrade - a link-provenance `ctx.money` never reaches the
 * `working` branch, so a formatted figure is unreachable from a link.
 */
export function costView(working: CostWorking | null, ctx: CostPanelContext): CostView {
  const heading = costHeading();

  // Not a costable job → nothing to say; do not clutter the export panel.
  if (!ctx.costable) return { show: false, heading, mode: 'no-card' };

  // Rule 1 - no card on this device → hide the panel entirely. There is no in-app way
  // to load a rate card yet, so the count-only explanation was just clutter on every
  // export. (noCardBody stays available for when card loading ships and this returns
  // show:true again.)
  if (!ctx.money.hasCard) {
    void noCardBody;
    return { show: false, heading, mode: 'no-card' };
  }

  // The degrade gate. When money may not be shown, the working table is NEVER built:
  // the view degrades to an explanation, never a hidden/greyed figure. This is the
  // single decision point; there is no other path to a rendered figure.
  if (!canShowMoney(ctx.money)) {
    // Expiry is checked first, matching canShowMoney's own order.
    if (ctx.money.expired && !ctx.money.useExpiredAnyway) {
      return {
        show: true, heading, mode: 'suppressed',
        message: ratesExpired(claimedDate(ctx.validUntil, ctx.locale) || (ctx.validUntil ?? '')),
        expiredAction: useExpiredAnyway(),
      };
    }
    // Otherwise it was reached via a link and not yet revealed on this device.
    return {
      show: true, heading, mode: 'suppressed',
      message: noCardBody(),
      revealPrompt: showCostsPrompt(),
    };
  }

  // Money may be shown. A costable job with a resolved card always has a working.
  if (!working) return { show: true, heading, mode: 'no-card', message: noCardBody() };

  const cur = working.currency;
  const rows = working.rows.map(r => rowVM(r, cur));
  const adjustments: CostAdjustmentVM[] = working.adjustments.map(a => ({
    label: minimumChargeApplied(),
    amount: `+ ${money(a.delta, cur)}`,
  }));

  const source = ctx.issuerName || ctx.issued
    ? reportedSource(ctx.issuerName ?? '', claimedDate(ctx.issued, ctx.locale) || (ctx.issued ?? ''))
    : undefined;

  let headline: string | undefined;
  let total: string | null = null;
  if (working.estimatedTotal) {
    // Full coverage → a scalar total, ALWAYS with its source inline. A ceiling bound
    // rides through as "up to".
    const figure = boundAmount(working.estimatedTotal.minorUnits, cur, working.bound === 'ceiling');
    total = figureLine(figure, ctx.issuerName ?? '', claimedDate(ctx.issued, ctx.locale) || (ctx.issued ?? ''));
  } else {
    // Partial → NO scalar total (rule 2). The gap is the headline. "including the
    // press run" is appended by the string only when a perSheet line is uncosted.
    const pressRun = working.uncosted.some(u => u.reason === 'no-sheet-count');
    headline = partialCoverageHeadline(working.uncosted.length, working.totalLines);
    if (!pressRun) {
      // Trim the press-run clause when no sheet line is the culprit. The string bakes
      // it in for the common print case; strip it when it does not apply.
      headline = headline.replace(', including the press run', '');
    }
  }

  // section 5: if money is shown despite an expired card, it was reached only by the explicit
  // opt-in, so the figure is stamped with the expiry date - inseparable from the total.
  const expiredNote = ctx.money.expired && ctx.money.useExpiredAnyway
    ? figureExpiredNote(claimedDate(ctx.validUntil, ctx.locale) || (ctx.validUntil ?? ''))
    : undefined;

  return {
    show: true, heading, mode: 'working',
    reportedSource: source,
    rows, adjustments, headline, total,
    expiredNote,
    disclaimer: disclaimerLine(),
  };
}

// ─── DOM ────────────────────────────────────────────────────────────────────

/**
 * The card's static markup, assembled with the rest of the export panel. A real
 * `<details>` reusing `.section-card`, hidden until {@link applyCostPanel} has
 * something true to say. `data-export-hide` keeps it out of every export stage.
 */
export function costPanelHtml(): string {
  return `
      <details class="section-card export-cost" data-cost-section data-export-hide style="display:none">
        <summary class="section-card-head cost-head">${icon('tag', { className: 'section-card-icon' })}<span data-cost-heading></span></summary>
        <div class="cost-body" data-cost-body></div>
        <div class="cost-authoring" data-cost-authoring></div>
      </details>`;
}

/** The body markup for `view`. Exported for the test; escaped throughout. */
export function costBodyHtml(view: CostView): string {
  if (view.mode === 'no-card') {
    return `<p class="cost-note">${escape(view.message ?? '')}</p>`;
  }
  if (view.mode === 'suppressed') {
    const action = view.revealPrompt
      ? `<button type="button" class="cost-reveal" data-cost-reveal>${escape(view.revealPrompt)}</button>`
      : view.expiredAction
        ? `<button type="button" class="cost-reveal" data-cost-use-expired>${escape(view.expiredAction)}</button>`
        : '';
    return `<p class="cost-note">${escape(view.message ?? '')}</p>${action}`;
  }

  // working
  const source = view.reportedSource
    ? `<p class="cost-source">${escape(view.reportedSource)}</p>` : '';
  const rows = (view.rows ?? []).map(r =>
    `<div class="cost-row"><span class="cost-row-line">${escape(r.line)}</span><span class="cost-row-calc">${escape(r.calc)}</span><span class="cost-row-amount">${escape(r.amount)}</span></div>`).join('');
  const adjustments = (view.adjustments ?? []).map(a =>
    `<div class="cost-row is-adjustment"><span class="cost-row-line">${escape(a.label)}</span><span class="cost-row-calc"></span><span class="cost-row-amount">${escape(a.amount)}</span></div>`).join('');
  const working = `<details class="cost-working"><summary>${escape(showArithmetic())}</summary><div class="cost-working-rows">${rows}${adjustments}</div></details>`;
  const outcome = view.total != null
    ? `<p class="cost-total">${escape(view.total)}</p>`
    : `<p class="cost-headline">${escape(view.headline ?? '')}</p>`;
  const expired = view.expiredNote
    ? `<p class="cost-expired">${escape(view.expiredNote)}</p>` : '';
  const disclaimer = view.disclaimer
    ? `<p class="cost-disclaimer">${escape(view.disclaimer)}</p>` : '';
  // Total/headline first (the answer), the expiry stamp, the arithmetic reveal, the hedge.
  return `${source}${outcome}${expired}${working}${disclaimer}`;
}

/**
 * Write `view` into the panel, or hide the card when there is nothing to say. Never
 * opens the card, never moves focus, never touches the Download button. The
 * open/closed state the user chose is preserved across refreshes.
 */
export function applyCostPanel(panel: Element | null | undefined, view: CostView): void {
  const card = panel?.querySelector<HTMLElement>('[data-cost-section]');
  if (!card) return;
  if (!view.show) {
    card.style.display = 'none';
    card.removeAttribute('open');
    return;
  }
  card.style.display = 'flex';
  card.dataset.mode = view.mode;
  const headingEl = card.querySelector<HTMLElement>('[data-cost-heading]');
  if (headingEl) headingEl.textContent = view.heading;
  const body = card.querySelector<HTMLElement>('[data-cost-body]');
  if (body) body.innerHTML = costBodyHtml(view);
}
