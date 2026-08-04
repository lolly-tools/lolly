// SPDX-License-Identifier: MPL-2.0
/**
 * The printer's own rate card — stored, validated, never a source of prices.
 *
 * A rate card is a JSON document the USER drops (the file their supplier gave
 * them). Lolly multiplies the numbers in it by quantities it COUNTED elsewhere
 * (`engine/src/preflight.ts`); it never originates, defaults, infers, or
 * approximates a price. This module owns the READER only — parsing, schema
 * validation, and the extra-schema invariants a schema-valid card can still
 * violate. Above the ARITHMETIC boundary this module is the READER only; below it
 * `computeCost` does the integer minor-unit arithmetic (Phase 4). There is NO
 * currency FORMATTING anywhere in this file — minor-unit integers go out and the
 * surface formats them, so web and CLI can never print divergent figures
 * (`plans/65-preflight-and-cost.md` §8).
 *
 * DOM-free and pure. Shared verbatim by the web drop path, the CLI/TUI
 * `--rate-card` path, and `scripts/validate-catalog.ts`, so all three validate a
 * card identically — the `computePrintGeometry` / `readSpotColor` placement:
 * one pure function, single source of truth, called from the shells.
 *
 * The digest is content-addressed and computed by the CALLER (async
 * `crypto.subtle` on the web, sync `node:crypto` in Node), so `parseRateCard`
 * stays synchronous and platform-free while still owning the `example-card`
 * refusal that needs the digest in hand.
 */

import {
  KNOWN_FINISH_KINDS,
  minorUnitExponent,
  monetaryFigure,
} from '@lolly-tools/core';
import type { Bound, Count, MonetaryFigure, QuantityKind, QuantityUnit } from '@lolly-tools/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One priced line on the card. As authored — Phase 4 does the integer
 *  minor-unit maths; this reader keeps the number verbatim. */
export interface RateCardLine {
  id: string;
  kind: 'perPlate' | 'perSheet' | 'perArea' | 'perQuantity' | 'perUnit' | 'perJob';
  /** As authored. A finite number ≥ 0 on a usable line; kept verbatim even when
   *  the line is disabled, so the id/kind can still be reported. */
  rate: number;
  finish?: string;
  unit?: string;
  quantityKind?: string;
  breaks?: { min: number; rate: number }[];
  /** A line kept for its id but not costable — a bad rate, an unknown finish, a
   *  missing quantityKind, malformed/absent break semantics. The LINE is disabled
   *  and REPORTED; the card survives (the `readSpotColor` total-function
   *  tolerance, `engine/src/tokens.ts:69-74`). Phase 4 renders it `ℹ Counted only`. */
  disabled?: { reason: DisabledReason };
}

export type DisabledReason =
  | 'bad-rate'
  | 'unknown-finish'
  | 'missing-quantity-kind'
  | 'needs-break-mode';

export interface RateCard {
  /** 16-hex, content-addressed (lowercase SHA-256 prefix of the raw file bytes). */
  digest: string;
  formatVersion: 1;
  /** ISO 4217, FROM THE CARD. Proven real by letting `Intl.NumberFormat` throw.
   *  There is no default currency anywhere in the repo. */
  currency: string;
  taxIncluded: boolean;
  breakMode?: 'flat' | 'marginal';
  minimumCharge?: number;
  sheet?: { width: number; height: number; unit: 'mm' | 'cm' | 'in' | 'pt'; gripperMargin?: number };
  /** A CLAIM typed inside the file. Verified against nothing; rendered as reported
   *  speech, never as provenance. */
  issuer: { name?: string; url?: string; issued?: string; validUntil?: string; note?: string };
  /** Phase 5 catalog-shipped house card. `false` when absent. */
  confidential: boolean;
  /** At least one line survives with a usable numeric rate (else `no-priced-lines`). */
  lines: RateCardLine[];
}

export type RateCardError = { error: 'not-a-rate-card' | 'no-priced-lines' | 'example-card' };

export const isRateCardError = (r: RateCard | RateCardError): r is RateCardError => 'error' in r;

/** The digest of the shipped §5 placeholder example (`tests/fixtures/ratecard.example.json`).
 *  Refused by NAME, belt-and-suspenders beyond the schema-invalid placeholder rates:
 *  a copy whose strings are still placeholders would fail the schema anyway, but the
 *  UNEDITED shipped file is refused with the clearest message regardless. */
export const EXAMPLE_RATECARD_DIGEST = 'ef6b6002525d25ce';

/** The canonical `FinishKind` spellings a card's `finish` may use without a
 *  release. Built from the contract's `KNOWN_FINISH_KINDS`, never hand-copied. An
 *  unrecognised finish disables the line and is reported — the union's own
 *  degradation rule — never discarded. */
const KNOWN_FINISHES: ReadonlySet<string> = new Set<string>(KNOWN_FINISH_KINDS);

// ─── Reader ─────────────────────────────────────────────────────────────────

const decoder = new TextDecoder();

function toText(input: Uint8Array | string): string {
  return typeof input === 'string' ? input : decoder.decode(input);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** Are the breaks well-formed: at least one, first `min === 1`, every subsequent
 *  `min` strictly ascending, every `rate` a finite number ≥ 0. */
function breaksAreValid(breaks: unknown): boolean {
  if (!Array.isArray(breaks) || breaks.length === 0) return false;
  let prevMin = 0;
  for (let i = 0; i < breaks.length; i++) {
    const b = breaks[i];
    if (!isObject(b)) return false;
    const { min, rate } = b as { min: unknown; rate: unknown };
    if (typeof min !== 'number' || !Number.isInteger(min)) return false;
    if (i === 0 ? min !== 1 : min <= prevMin) return false;
    if (!isFiniteRate(rate)) return false;
    prevMin = min;
  }
  return true;
}

/**
 * Parse and validate a dropped rate card. Total-function: never throws. Returns
 * a `RateCard` or one of three refusals. The caller mints `digest` from the raw
 * bytes and injects the Ajv-compiled `schemas/ratecard.schema.json` validator so
 * web, CLI and `validate-catalog` share one Ajv instance and validate identically.
 *
 * Refusals (nothing is stored on a refusal):
 *  - `example-card`   — the digest is the shipped §5 placeholder. Checked first.
 *  - `not-a-rate-card`— unparseable, wrong `$format`, schema-invalid shape, or a
 *                       currency `Intl.NumberFormat` rejects.
 *  - `no-priced-lines`— validates, but no line is costable.
 */
export function parseRateCard(
  input: Uint8Array | string,
  digest: string,
  validate: (doc: unknown) => boolean,
): RateCard | RateCardError {
  // 1. The shipped placeholder example, refused by name — clearest message first.
  if (digest === EXAMPLE_RATECARD_DIGEST) return { error: 'example-card' };

  // 2. Parse JSON; a non-JSON drop is `not-a-rate-card`, not a thrown error.
  let doc: unknown;
  try {
    doc = JSON.parse(toText(input));
  } catch {
    return { error: 'not-a-rate-card' };
  }
  if (!isObject(doc) || doc.$format !== 'lolly-ratecard') return { error: 'not-a-rate-card' };

  // 3. The shape. A `$format`-tagged file that fails the schema is still not a
  //    usable rate card.
  if (!validate(doc)) return { error: 'not-a-rate-card' };

  // 4. ISO 4217 by letting `Intl.NumberFormat` throw — the schema pattern only
  //    proves three uppercase letters, not a real code. No default anywhere.
  const currency = doc.currency as string;
  try {
    new Intl.NumberFormat(undefined, { style: 'currency', currency });
  } catch {
    return { error: 'not-a-rate-card' };
  }

  const breakMode = doc.breakMode as 'flat' | 'marginal' | undefined;
  const rawLines = (doc.lines as unknown[]) ?? [];

  // 5-7. Per line: total-function tolerance (a bad field disables the LINE, never
  //      the card), unique ids, breakMode-required-with-breaks.
  const seen = new Set<string>();
  const lines: RateCardLine[] = [];
  for (const raw of rawLines) {
    const r = raw as Record<string, unknown>;
    const line: RateCardLine = {
      id: r.id as string,
      kind: r.kind as RateCardLine['kind'],
      rate: r.rate as number,
    };
    if (r.finish !== undefined) line.finish = r.finish as string;
    if (r.unit !== undefined) line.unit = r.unit as string;
    if (r.quantityKind !== undefined) line.quantityKind = r.quantityKind as string;
    if (r.breaks !== undefined) line.breaks = r.breaks as { min: number; rate: number }[];

    let disabled: DisabledReason | undefined;

    // 7. A duplicate id keeps the FIRST and disables the later one — never merge
    //    (a merge would fabricate a line).
    if (seen.has(line.id)) {
      disabled = 'bad-rate';
    } else {
      seen.add(line.id);
    }

    // 5. bad-rate — the rate itself. (The schema already rejects a non-number rate
    //    for the strict drop-path validator; kept so a looser injected validator
    //    still degrades the line rather than the card.)
    if (!disabled && !isFiniteRate(line.rate)) disabled = 'bad-rate';

    // 6. breaks: malformed → the line, and breakMode-required-when-breaks.
    if (!disabled && line.breaks !== undefined) {
      if (!breaksAreValid(line.breaks)) disabled = 'bad-rate';
      else if (breakMode === undefined) disabled = 'needs-break-mode';
    }

    // perQuantity must name the quantity it multiplies; a kind the job did not
    //    produce is an uncosted gap, not a guess at the nearest one.
    if (!disabled && line.kind === 'perQuantity') {
      const qk = line.quantityKind;
      if (typeof qk !== 'string' || qk.trim() === '') disabled = 'missing-quantity-kind';
    }

    // An unrecognised finish — report, never discard (open-union degradation rule).
    if (!disabled && typeof line.finish === 'string' && !KNOWN_FINISHES.has(line.finish)) {
      disabled = 'unknown-finish';
    }

    if (disabled) line.disabled = { reason: disabled };
    lines.push(line);
  }

  // 8. A card that stores but can price nothing would sit in the storage meter
  //    forever (the `ingestProfile` rule). Refuse it.
  const anyPriced = lines.some((l) => !l.disabled && isFiniteRate(l.rate));
  if (!anyPriced) return { error: 'no-priced-lines' };

  const card: RateCard = {
    digest,
    formatVersion: 1,
    currency,
    taxIncluded: doc.taxIncluded === true,
    issuer: isObject(doc.issuer) ? (doc.issuer as RateCard['issuer']) : {},
    confidential: doc.confidential === true,
    lines,
  };
  if (breakMode !== undefined) card.breakMode = breakMode;
  if (isFiniteRate(doc.minimumCharge)) card.minimumCharge = doc.minimumCharge;
  if (isObject(doc.sheet)) card.sheet = doc.sheet as RateCard['sheet'];
  return card;
}

// ══════════════════════════════════════════════════════════════════════════════
// ARITHMETIC — Phase 4 (plans/65-preflight-and-cost.md §8).
//
// `computeCost(card, counts, input)` multiplies rates FROM THE CARD by quantities
// preflight COUNTED, in integer minor units, and returns a structured working the
// surface renders and serialises. It never originates, defaults, infers, or
// approximates a price, and it does NO currency formatting (that is the surface's
// job — minor-unit integers out). The one invariant above all: never invent money.
//
// How the honesty rules are enforced HERE, not by convention:
//   Rule 2  — `estimatedTotal` is `null` whenever ANY counted line is uncosted.
//             There is no scalar total to copy; the gap is the headline. A partial
//             card yields rows + `uncosted[]` and a null total, never a subtotal
//             dressed as a total.
//   Rule 3  — every multiplication is a visible `CostRow`; the minimum charge is a
//             visible `CostAdjustment` row, never a silent floor. The rows plus the
//             adjustment deltas SUM to the headline exactly (pinned by a test).
//   Rule 4  — a `Count.bound` of `'ceiling'` rides through the multiplication into
//             `row.subtotalBound`, and any ceiling row makes the whole `bound`
//             `'ceiling'`. A bound is never laundered into an unqualified figure.
//   No default — a rate missing/bad (reader-disabled), a `perSheet` with no sheet
//             count, a `perArea` with no sheet-area count, a `perUnit` with no
//             user-entered run length, a `perQuantity` naming a kind the job did
//             not produce, or a card with breaks and no `breakMode` (reader-
//             disabled) all become a NAMED gap in `uncosted[]`, never a guess.
// ══════════════════════════════════════════════════════════════════════════════

/** The quantity a working row multiplied. Widens `QuantityKind` with the two
 *  non-counted multipliers the model has: a `perJob` line's implicit single job,
 *  and a `perUnit` line's user-entered run length (neither is a preflight count). */
export type CostRowQuantityKind = QuantityKind | 'job' | 'runLength';

/** How a break tier was applied to a row, so the working can name it. */
export interface CostBreakApplied {
  /** `'flat'` — one tier priced every unit; `'marginal'` — this row is one band. */
  readonly mode: 'flat' | 'marginal';
  /** The tier's `min`. */
  readonly min: number;
  /** Inclusive upper bound of a marginal band (absent for flat). */
  readonly upTo?: number;
}

/**
 * One priced multiplication: `quantity × unitRate = subtotal`, all integer minor
 * units. A line with breaks in `'marginal'` mode emits ONE row per contributing
 * band (each a real multiplication that sums to the line total); every other line
 * emits one row per matched count. Structurally a superset of the surface's
 * `SerializedWorkingRow` (`@lolly-tools/core`), plus `breakApplied`.
 */
export interface CostRow {
  readonly lineId: string;
  readonly kind: RateCardLine['kind'];
  readonly quantityKind: CostRowQuantityKind;
  /** The multiplier for THIS row (a marginal band carries its band size, not the
   *  whole count value). */
  readonly quantity: number;
  readonly bound: Bound;
  /** The counted unit, when the multiplier is a preflight count. */
  readonly unit?: QuantityUnit;
  /** Present iff the count was an area count. */
  readonly box?: 'trim' | 'bleed' | 'media';
  /** The card's rate for this row, in minor units. FROM THE CARD; never defaulted. */
  readonly unitRate: number;
  /** `quantity × unitRate`, integer minor units. */
  readonly subtotal: number;
  /** `=== bound` (rule 4): a ceiling quantity yields a ceiling subtotal. */
  readonly subtotalBound: Bound;
  readonly breakApplied?: CostBreakApplied;
}

/** A visible adjustment row (rule 3). The minimum charge is the only one today.
 *  `to = max(subtotalOfCovered, minimumCharge)`, so the visible rows still sum to
 *  the headline; it is never a silent floor. */
export interface CostAdjustment {
  readonly lineId: 'minimum-charge';
  readonly kind: 'adjustment';
  readonly reason: 'minimumCharge';
  /** The priced subtotal before the adjustment, minor units. */
  readonly from: number;
  /** After it, minor units. */
  readonly to: number;
  /** `to - from`, minor units — the visible `+…` row. */
  readonly delta: number;
}

/** Why a counted line could not be priced. Each is a NAMED gap, never a guess. */
export type CostUncostedReason =
  | DisabledReason // the reader already disabled it: bad-rate | unknown-finish | missing-quantity-kind | needs-break-mode
  /** The counted kind this line multiplies is not in `counts[]` (e.g. a perPlate
   *  line but the job produced no plates, a perQuantity kind the job did not make). */
  | 'quantity-not-produced'
  /** A perQuantity line names a `quantityKind` that is not a known `QuantityKind`. */
  | 'quantity-unknown-kind'
  /** A perSheet line, but there is no sheet count (Lolly has no imposition). */
  | 'no-sheet-count'
  /** A perArea line, but there is no `m2-sheet` area count (covered area is not
   *  computable; the whole-sheet area is not derivable without imposition). */
  | 'no-sheet-area'
  /** A perUnit line, but the user entered no run length. It must never default to 1. */
  | 'no-run-length';

/** A counted line the card could not price, and why (rule 2 detail). */
export interface CostUncostedLine {
  readonly lineId: string;
  readonly reason: CostUncostedReason;
}

/** The non-count inputs the arithmetic needs. */
export interface CostInput {
  /** The user-entered run length a `perUnit` line multiplies. Absent → those lines
   *  stay inert (an uncosted gap); it must never default to 1. */
  readonly runLength?: number;
  /** Reference "now" (ms since epoch) for the expiry check. Defaults to
   *  `Date.now()`; injected so the function is testable and otherwise pure. */
  readonly now?: number;
}

/**
 * The structured working. Minor-unit integers throughout; the surface formats.
 * `rows` sum to `subtotalOfCovered`; `rows` + adjustment deltas sum to the headline.
 */
export interface CostWorking {
  /** From the card, never defaulted — the surface formats with it. */
  readonly currency: string;
  /** `card.issuer.validUntil` is in the past. REPORTED, not acted on: the caller
   *  decides whether to suppress money (§5), this function does not. */
  readonly expired: boolean;
  /** Every priced multiplication, in order. */
  readonly rows: readonly CostRow[];
  /** Visible adjustment rows (minimum charge). Empty unless one applied. */
  readonly adjustments: readonly CostAdjustment[];
  /** Every counted line the card could not price. Empty on full coverage. */
  readonly uncosted: readonly CostUncostedLine[];
  /** Card lines that produced at least one priced row. */
  readonly coveredLines: number;
  /** Total lines the card declares. `coveredLines + uncosted.length === totalLines`. */
  readonly totalLines: number;
  /** Sum of every row subtotal, minor units. Always present (even with a null total). */
  readonly subtotalOfCovered: number;
  /** `'ceiling'` iff any priced row is a ceiling (rule 4). */
  readonly bound: Bound;
  /**
   * The headline figure, self-describing (minor units + currency + exponent), or
   * `null` when ANY counted line is uncosted (rule 2). NEVER `0` as a stand-in for
   * "no total" and never a partial scalar. Includes the minimum-charge adjustment.
   */
  readonly estimatedTotal: MonetaryFigure | null;
}

const QUANTITY_KINDS: ReadonlySet<string> = new Set<QuantityKind>([
  'variantRows', 'outputFiles', 'pages', 'processPlates', 'spotPlates', 'finishPlates',
  'sheets', 'area', 'pixels', 'seconds', 'frames', 'inputs',
]);

/** Convert an authored (major-unit) FLAT MONEY AMOUNT (a perJob charge, the
 *  minimum charge) to integer minor units. These are prices in the card's currency,
 *  not per-unit rates multiplied by a counted quantity, so rounding them to the
 *  currency's minor unit is exact and correct. The single `Math.round` collapses any
 *  binary-float artefact (`5.5 * 100`) to the exact integer. A per-unit rate is NOT
 *  rounded here: it stays at full precision until it multiplies its quantity, so a
 *  sub-minor-unit rate (fractions of a cent per impression, routine in print) neither
 *  inflates nor rounds to zero — see `exactMinor` and `priceQuantity`. */
function toMinor(rate: number, exponent: number): number {
  return Math.round(rate * 10 ** exponent);
}

/** An authored (major-unit) per-unit RATE as a full-precision minor-unit value,
 *  UNROUNDED. `0.008` EUR → `0.8`, not `1`. The rounding to integer minor units
 *  happens once, on the final line subtotal (`q × rate`), never on the rate itself
 *  (`plans/65-preflight-and-cost.md` §8; the honesty fix for sub-minor-unit rates). */
function exactMinor(rate: number, exponent: number): number {
  return rate * 10 ** exponent;
}

interface MinorBreak {
  readonly min: number;
  /** Full-precision minor-unit rate (unrounded). Rounded only when a subtotal is formed. */
  readonly rate: number;
}

function breaksToMinor(breaks: { min: number; rate: number }[], exponent: number): MinorBreak[] {
  return breaks.map((b) => ({ min: b.min, rate: exactMinor(b.rate, exponent) }));
}

/** Flat-tier: the single break with the greatest `min ≤ q` prices every unit.
 *  Breaks are ascending and the first `min` is 1 (the reader guarantees both). */
function flatTier(breaks: MinorBreak[], q: number): MinorBreak {
  // Breaks are non-empty and start at min:1 (reader-guaranteed).
  let chosen: MinorBreak = breaks[0]!;
  for (const b of breaks) if (b.min <= q) chosen = b;
  return chosen;
}

interface RowContext {
  readonly quantityKind: CostRowQuantityKind;
  readonly bound: Bound;
  readonly unit?: QuantityUnit;
  readonly box?: 'trim' | 'bleed' | 'media';
}

/**
 * Price one quantity `q` for a line, emitting the working row(s):
 *  - no breaks       → one row, `q × rate`.
 *  - flat-tier       → one row at the applicable tier's rate.
 *  - marginal        → one row per band that `q` reaches (each `bandUnits × bandRate`).
 */
function priceQuantity(
  line: RateCardLine,
  breakMode: 'flat' | 'marginal' | undefined,
  rateExact: number,
  breaksExact: MinorBreak[] | undefined,
  q: number,
  ctx: RowContext,
): CostRow[] {
  const base = {
    lineId: line.id,
    kind: line.kind,
    quantityKind: ctx.quantityKind,
    bound: ctx.bound,
    ...(ctx.unit !== undefined ? { unit: ctx.unit } : {}),
    ...(ctx.box !== undefined ? { box: ctx.box } : {}),
    subtotalBound: ctx.bound,
  };

  // The rate stays full-precision until here; the ONLY rounding is on the finished
  // subtotal (`Math.round(q × rate)`), so a fractional quantity (area m², seconds) can
  // never leave a non-integer minor-unit amount, and a sub-minor-unit rate is neither
  // inflated nor zeroed. `unitRate` is the same rate rendered to the currency's minor
  // unit for display (integer minor units, the money contract); the subtotal is the
  // authoritative figure and is computed from the unrounded rate.
  if (!breaksExact) {
    return [{ ...base, quantity: q, unitRate: Math.round(rateExact), subtotal: Math.round(q * rateExact) }];
  }

  if (breakMode === 'flat') {
    const t = flatTier(breaksExact, q);
    return [
      { ...base, quantity: q, unitRate: Math.round(t.rate), subtotal: Math.round(q * t.rate), breakApplied: { mode: 'flat', min: t.min } },
    ];
  }

  // Marginal: each break with `min ≤ q` is a band; since breaks ascend, those form
  // a prefix, so the next band's boundary is the next break's `min`.
  const rows: CostRow[] = [];
  const active = breaksExact.filter((b) => b.min <= q);
  for (let i = 0; i < active.length; i++) {
    const b = active[i]!;
    const next = active[i + 1];
    const upper = next === undefined ? q : next.min - 1;
    const units = upper - b.min + 1;
    if (units <= 0) continue;
    rows.push({
      ...base,
      quantity: units,
      unitRate: Math.round(b.rate),
      subtotal: Math.round(units * b.rate),
      breakApplied: { mode: 'marginal', min: b.min, upTo: upper },
    });
  }
  return rows;
}

/** The counts a line consumes. A `perArea` line prices the WHOLE SHEET through the
 *  press — the media box only. `checkPrintGeometry` emits three `m2-sheet` area counts
 *  (trim, bleed, media); matching all three would price a single card line three times
 *  (~3× the true sheet area), inventing money. So `perArea` matches the media box alone
 *  (`plans/65-preflight-and-cost.md` §4: "the whole sheet through the press"). */
function countsForLine(line: RateCardLine, counts: readonly Count[]): Count[] {
  switch (line.kind) {
    case 'perPlate':
      return counts.filter((c) =>
        line.finish !== undefined
          ? c.kind === 'finishPlates'
          : c.kind === 'processPlates' || c.kind === 'spotPlates',
      );
    case 'perSheet':
      return counts.filter((c) => c.kind === 'sheets');
    case 'perArea':
      return counts.filter((c) => c.kind === 'area' && c.unit === 'm2-sheet' && c.box === 'media');
    case 'perQuantity':
      return counts.filter((c) => c.kind === line.quantityKind);
    default:
      return [];
  }
}

function gapReason(line: RateCardLine): CostUncostedReason {
  if (line.kind === 'perSheet') return 'no-sheet-count';
  if (line.kind === 'perArea') return 'no-sheet-area';
  return 'quantity-not-produced';
}

/** `validUntil` in the past. A claim inside the file, so an unparseable or absent
 *  date is simply "not expired" — never a reason to suppress. */
function isExpired(card: RateCard, now: number | undefined): boolean {
  const v = card.issuer.validUntil;
  if (typeof v !== 'string' || v.trim() === '') return false;
  const t = Date.parse(v);
  if (Number.isNaN(t)) return false;
  return t < (now ?? Date.now());
}

/**
 * Cost the counted work against a parsed rate card. Pure and total: it multiplies
 * the card's rates by preflight's counts in integer minor units and returns the
 * structured working. It invents nothing — no rate, no currency, no default — and
 * emits a scalar total ONLY when every counted line is priced (rule 2).
 *
 * @param card   a card already read by `parseRateCard` (currency proven usable).
 * @param counts the quantities preflight measured.
 * @param input  the user-entered run length (for `perUnit`) and the expiry `now`.
 */
export function computeCost(card: RateCard, counts: readonly Count[], input: CostInput = {}): CostWorking {
  // The exponent both parse and format read from `Intl` — the ONE source of truth,
  // so a subtotal and its rendering can never disagree. `card.currency` is already
  // proven usable by `parseRateCard`, so this does not throw for a real card.
  const exponent = minorUnitExponent(card.currency);

  const rows: CostRow[] = [];
  const uncosted: CostUncostedLine[] = [];
  let coveredLines = 0;

  for (const line of card.lines) {
    // A line the reader disabled (bad rate, unknown finish, missing quantityKind,
    // breaks with no breakMode) is a named gap carrying its own reason.
    if (line.disabled) {
      uncosted.push({ lineId: line.id, reason: line.disabled.reason });
      continue;
    }

    // A per-unit rate stays at FULL PRECISION until it multiplies its quantity; the
    // subtotal is rounded once (in `priceQuantity`). A perJob line's rate is a flat
    // money amount (quantity 1), so it rounds to minor units directly.
    const rateExact = exactMinor(line.rate, exponent);
    const rateFlat = Math.round(rateExact);
    const breaksExact = line.breaks ? breaksToMinor(line.breaks, exponent) : undefined;

    // Defensive: breaks without a breakMode must have been reader-disabled. If a
    // looser reader let it through, it is still a gap here — never guessed.
    if (breaksExact && card.breakMode === undefined) {
      uncosted.push({ lineId: line.id, reason: 'needs-break-mode' });
      continue;
    }

    let lineRows: CostRow[] = [];

    if (line.kind === 'perJob') {
      // A fixed job charge: one job, exact, consuming no count.
      lineRows = [
        {
          lineId: line.id,
          kind: line.kind,
          quantityKind: 'job',
          quantity: 1,
          bound: 'exact',
          unitRate: rateFlat,
          subtotal: rateFlat,
          subtotalBound: 'exact',
        },
      ];
    } else if (line.kind === 'perUnit') {
      const q = input.runLength;
      if (typeof q !== 'number' || !Number.isInteger(q) || q < 0) {
        uncosted.push({ lineId: line.id, reason: 'no-run-length' });
        continue;
      }
      lineRows = priceQuantity(line, card.breakMode, rateExact, breaksExact, q, {
        quantityKind: 'runLength',
        bound: 'exact',
      });
    } else {
      if (line.kind === 'perQuantity' && !QUANTITY_KINDS.has(line.quantityKind ?? '')) {
        uncosted.push({ lineId: line.id, reason: 'quantity-unknown-kind' });
        continue;
      }
      const matched = countsForLine(line, counts);
      if (matched.length === 0) {
        uncosted.push({ lineId: line.id, reason: gapReason(line) });
        continue;
      }
      for (const c of matched) {
        lineRows.push(
          ...priceQuantity(line, card.breakMode, rateExact, breaksExact, c.value, {
            quantityKind: c.kind,
            bound: c.bound,
            unit: c.unit,
            box: c.box,
          }),
        );
      }
    }

    if (lineRows.length === 0) {
      uncosted.push({ lineId: line.id, reason: gapReason(line) });
      continue;
    }
    rows.push(...lineRows);
    coveredLines++;
  }

  const subtotalOfCovered = rows.reduce((s, r) => s + r.subtotal, 0);
  const bound: Bound = rows.some((r) => r.subtotalBound === 'ceiling') ? 'ceiling' : 'exact';

  // Rule 2: a scalar total exists ONLY when every counted line is priced.
  const fullCoverage = uncosted.length === 0;

  // Rule 3: the minimum charge is a visible adjustment row, applied once after all
  // lines are priced and only on full coverage — never a silent floor.
  const adjustments: CostAdjustment[] = [];
  let headline = subtotalOfCovered;
  if (fullCoverage && card.minimumCharge !== undefined) {
    const minMinor = toMinor(card.minimumCharge, exponent);
    if (minMinor > subtotalOfCovered) {
      adjustments.push({
        lineId: 'minimum-charge',
        kind: 'adjustment',
        reason: 'minimumCharge',
        from: subtotalOfCovered,
        to: minMinor,
        delta: minMinor - subtotalOfCovered,
      });
      headline = minMinor;
    }
  }

  const estimatedTotal: MonetaryFigure | null = fullCoverage
    ? monetaryFigure(headline, card.currency)
    : null;

  return {
    currency: card.currency,
    expired: isExpired(card, input.now),
    rows,
    adjustments,
    uncosted,
    coveredLines,
    totalLines: card.lines.length,
    subtotalOfCovered,
    bound,
    estimatedTotal,
  };
}
