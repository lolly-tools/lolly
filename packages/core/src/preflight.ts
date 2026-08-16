// SPDX-License-Identifier: MPL-2.0
/**
 * Preflight findings - the transport-neutral data model for pre-export checks.
 *
 * ## Why this file exists, and why it is NOT in `host-v1.ts`
 *
 * `host-v1.ts` is what a *shell* provides to a *tool*. A `Finding` never crosses
 * that boundary in either direction:
 *
 *   - A tool never receives findings. Preflight runs before/around an export, in
 *     the shell, over a job description the shell assembled; nothing is handed
 *     back into `onInit`/`beforeExport`.
 *   - A tool never *contributes* a finding. Preflight checks are engine rules over
 *     declared facts (the manifest, the input model, the export settings, the
 *     resolved brand palette). A tool participates only through what its manifest
 *     declares: `render.paginate`, `render.pages`, `render.video`, input `min`/
 *     `max`/`maxLength`. It never contributes by exporting a check function. Letting tool code
 *     emit verdicts would make "is this export correct?" answerable by the thing
 *     being checked.
 *
 * `SpotColor`/`FinishKind` look like a counter-example, but they are genuinely on
 * the bridge: `host.tokens.colors()` returns them to tools. Growing the bridge
 * contract with a type no tool can call would be a lie about the contract's shape.
 *
 * ## Why it is in `@lolly-tools/core` rather than the engine
 *
 * Findings are produced by the engine (`engine/src/preflight.ts` owns the RULES)
 * and consumed by every shell: the web export panel, `lolly preflight --json`, a
 * batch zip manifest, the MCP service. Keeping the *vocabulary* here, beside the
 * manifest contract, lets a consumer that already depends on the SDK read a
 * serialised report without pulling in the engine. The engine re-exports these
 * types from its own barrel, so shell code importing `@lolly/engine` sees them
 * unchanged.
 *
 * ## What is deliberately absent
 *
 * There is no currency, no rate, no price and no monetary field anywhere in this
 * module, and none may be added to it. Preflight counts; it does not cost. A cost
 * layer, if one ever ships, attaches as a SEPARATE sibling object that consumes
 * `Count` values and carries its own provenance caveats. It never lands inside
 * `PreflightReport`, because the moment a report can carry a number that looks
 * like money, an unqualified ceiling gets read as a quote.
 *
 * See `plans/65-preflight-and-cost.md` section 3 (the findings model) and section 6 (honesty rules).
 */

// ─── Severity ───────────────────────────────────────────────────────────────

/**
 * How bad a finding is.
 *
 * Modelled deliberately against the two three-state renderers already in the
 * tree, both of which spell the third state badly:
 *
 *   - `C2paCheck` (`engine/src/c2pa-verify.ts`) is `{ code, ok, explanation }`.
 *     It is two-state by construction, so "expected, not damage" had to be re-derived
 *     OUTSIDE the type by a hard-coded code list in one view
 *     (`shells/web/src/views/valid-verdict.ts` `isExpectedRow`). The CLI does not
 *     share that list, so the two renderers disagree about what counts as damage.
 *   - `PdfFinding` (`host-v1.ts`) has three fields but spells neutral as `''`.
 *     That is falsy, so `if (f.tone)` works in a view, and the neutral case is
 *     *unnameable* in a serialised artifact.
 *
 * So: severity is DATA on the finding, every level is NAMED, and no level is
 * falsy. `'info'` is a permanent, common, first-class state, a count or an
 * honest gap, and must never be rendered with a warning tone.
 */
export type Severity =
  /** A fact, a count, or a named gap. Not a problem. Never styled as one. */
  | 'info'
  /** The export will happen, and it will not be what the settings say. */
  | 'warn'
  /** The export will be wrong, or will not happen at all. */
  | 'error';

/** Sort order for rendering: errors first, then warnings, then info. */
export const SEVERITY_RANK: Readonly<Record<Severity, number>> = { error: 0, warn: 1, info: 2 };

// ─── Facts: the honesty machinery, in the type system ───────────────────────

/**
 * Why a fact could not be supplied.
 *
 * Machine-readable on purpose: a `--json` consumer, a translation catalogue and
 * the export panel must all be able to tell "we cannot know this" apart from "the
 * answer is zero" without parsing an English sentence.
 */
export type UnknownReason =
  /** The user never set it and the platform has no default it may assert. */
  | 'not-set'
  /** A value exists upstream, but THIS transport dropped it. (A batch-snapshot
   *  row carries no profile/bleed/marks: `rowFromBatchRow` maps none of them.) */
  | 'not-carried'
  /** The source was asked and did not answer: a throw, or an empty result that
   *  is indistinguishable from a throw. (`host.tokens.colors()`.) */
  | 'not-resolved'
  /** Only a mounted node can answer it. (`cuts` on a timed stage, `[data-pdf-page]`
   *  boxes, `[data-seq-ms]` timeline length.) */
  | 'needs-mount'
  /** Only a completed render can answer it. (The exact plate set, the frame rate
   *  actually used, output bytes.) */
  | 'needs-render'
  /** No mechanism exists anywhere in the platform. (Ink coverage, %TAC, the area
   *  a finish covers, wall-clock render time.) */
  | 'not-computable';

/**
 * A value the engine may only read after the caller has said whether it HAS it.
 *
 * There is no third shape and no default, so `{ known: false }` can never be
 * destructured into a zero by accident. This is the "an absent setting is never
 * read as an asserted zero" rule enforced by the compiler rather than by review:
 * a collector that does not carry bleed must write
 * `{ known: false, why: 'not-carried' }`, and cannot quietly write `0`.
 */
export type Fact<T> =
  | { readonly known: true; readonly value: T }
  | { readonly known: false; readonly why: UnknownReason };

/** Construct a known fact. */
export const knownFact = <T>(value: T): Fact<T> => ({ known: true, value });
/** Construct an unknown fact with a machine-readable reason. */
export const unknownFact = <T>(why: UnknownReason): Fact<T> => ({ known: false, why });

// ─── Counts ─────────────────────────────────────────────────────────────────

/** What a `Count` is counting. */
export type QuantityKind =
  /** Batch/folder rows. */
  | 'variantRows'
  /** Files this job emits. */
  | 'outputFiles'
  | 'pages'
  | 'processPlates'
  | 'spotPlates'
  | 'finishPlates'
  /** Press sheets. Never emitted: Lolly has no imposition. Named so a consumer
   *  asking for it gets a refusal rather than a substitution. */
  | 'sheets'
  | 'area'
  | 'pixels'
  /** Total area coverage (sum of C+M+Y+K), %. A palette-scoped measurement, the
   *  heaviest brand solid, never the whole render (a photo's TAC needs the
   *  separation). Reported with an explicit scope, so it is never read as the file's. */
  | 'inkCoverage'
  | 'seconds'
  | 'frames'
  | 'inputs';

/**
 * Unit vocabulary.
 *
 * `m2-sheet` is spelled distinctly from any bare area unit because area THROUGH
 * the press is not the same quantity as area COVERED by ink or by a finish, and
 * Lolly can only supply the first. The two must never be substitutable by a
 * consumer reading the field.
 */
export type QuantityUnit =
  | 'file' | 'page' | 'plate' | 'row' | 'input'
  | 'px' | 'pt2' | 'mm2' | 'm2-sheet'
  | 'pct'
  | 's' | 'frame';

/**
 * How tight the number is.
 *
 * REQUIRED, with no default. A default is exactly how a ceiling gets laundered
 * into an unqualified figure: every emitter states which it is, at the point it
 * knows.
 */
export type Bound =
  /** This is the number. */
  | 'exact'
  /** This is an upper bound; the real number is this or less. */
  | 'ceiling';

/** One counted quantity. The seam to any later arithmetic. */
export interface Count {
  readonly kind: QuantityKind;
  readonly value: number;
  readonly unit: QuantityUnit;
  /**
   * REQUIRED for `kind: 'area'`. Trim, bleed and media differ by 5–10%, and a
   * figure applied to the wrong box is a silent error nobody spots.
   */
  readonly box?: 'trim' | 'bleed' | 'media';
  readonly bound: Bound;
  /**
   * Machine-readable provenance: where the number came from, so a consumer can
   * point at the exact declaration that is wrong without parsing prose.
   * e.g. `'manifest.render.paginate'`, `'settings.size'`, `'palette.spot.finish'`.
   */
  readonly basis: string;
}

// ─── Findings ───────────────────────────────────────────────────────────────

/**
 * A stable, dotted, machine-readable finding id. Permanent contract, like a tool
 * id or an asset id: never renamed, never reused for a different meaning.
 *
 * The union is OPEN (`string & {}`) for the same reason `FinishKind` is: the
 * listed members are the canonical spellings and drive editor autocomplete, but
 * a consumer must treat an unrecognised id as "a finding I have no special
 * rendering for" and fall through to `message`. Never as an error, and never as
 * a reason to drop the finding.
 */
export type FindingId =
  // Print / finish correctness
  | 'print.finish-separates-as-ink'
  | 'print.finish-flattened-into-process'
  | 'print.finish-unknown-kind'
  | 'print.no-bleed'
  | 'print.bleed-unknown'
  | 'print.trim-not-physical'
  | 'print.trim-partially-declared'
  | 'print.geometry'
  | 'print.effective-dpi'
  | 'print.image-effective-dpi'
  | 'print.image-dpi-needs-stage'
  | 'print.ink-over-tac'
  | 'print.rich-black'
  // Settings coherence
  | 'settings.format-not-offered'
  | 'settings.print-marks-on-non-print-format'
  | 'settings.press-profile-on-non-separating-format'
  | 'settings.hdr-on-unsupported-format'
  | 'settings.durable-on-unsupported-format'
  | 'settings.aspect-guard'
  // Declared input coherence
  | 'input.required-blank'
  | 'input.number-out-of-range'
  | 'input.text-over-maxlength'
  | 'input.select-value-unknown'
  | 'input.vector-clamped'
  // Counts
  | 'count.pages.paginate'
  | 'count.pages.pages'
  | 'count.pages.unknown'
  | 'count.pages.stage'
  | 'count.sequence-duration'
  | 'count.raster-pixels'
  | 'count.ink-coverage-palette'
  | 'count.video-duration-declared'
  | 'count.cuts-needs-stage'
  | 'count.cuts-inert'
  | 'count.cuts-applies'
  // Plates
  | 'plates.process'
  | 'plates.spot-ceiling'
  | 'plates.finish-ceiling'
  | 'plates.no-spots-declared'
  | 'plates.palette-unresolved'
  // Export behaviour
  | 'export.experimental-watermark'
  // Named refusals: see the `needs` field
  | 'refuse.ink-coverage'
  | 'refuse.finish-covered-area'
  | 'refuse.exact-separation'
  | 'refuse.output-file-size'
  | 'refuse.render-time'
  | 'refuse.video-frames'
  | 'refuse.sequence-duration'
  | 'refuse.trim-when-unset'
  | 'refuse.sheets'
  | 'refuse.locale-count'
  // Collector-side caveats (the shell that took the report, not a rule)
  | 'collect.on-init-not-run'
  | 'collect.flags-not-preflighted'
  // A batch/folder row `planBatch` dropped before the run (`pro/preflight-rows.ts`
  // `skipCaveat`): the row will not be rendered at all, for one of `planBatch`'s
  // three reasons (no template selected, render-only tool, template failed to load).
  | 'collect.row-not-rendered'
  // The requested format is not the format that will render (`pro/preflight-rows.ts`
  // `formatCaveat`). A batch resolves the format through `chooseFormat`, which
  // SUBSTITUTES the tool's first declared format when the requested one is not
  // offered, so the engine's `settings.format-not-offered` can never see it, and
  // without this caveat the substitution is silent until the zip is opened.
  | 'collect.format-substituted'
  | (string & {});

/** Structured, never pre-formatted, always JSON-safe. */
export type Evidence = Readonly<Record<string, string | number | boolean | null>>;

/** One checkable assertion about a job. */
export interface Finding {
  readonly id: FindingId;
  readonly severity: Severity;
  /**
   * One resolved English sentence.
   *
   * This is BOTH the CLI's output and the translation FALLBACK. A shell may
   * translate by `id` and re-interpolate from `evidence`, and MUST fall back to
   * this string when it has no catalogue entry. Translating by id (rather than
   * shipping a pre-translated message) is what keeps `--json` output and a zip
   * report member byte-identical across locales.
   *
   * House copy rules apply: no em-dashes, and never a currency symbol.
   */
  readonly message: string;
  /** The numbers behind the sentence: raw, structured, never pre-formatted. */
  readonly evidence?: Evidence;
  /** What this finding counted, when it counted something. */
  readonly count?: Count;
  /** The declared input this concerns, when it is per-input. */
  readonly inputId?: string;
  /** Batch/folder row index, when the finding is per-row. */
  readonly rowIndex?: number;
  /**
   * Present IFF this finding is a NAMED GAP rather than an assertion: Lolly
   * counted nothing here and is saying so out loud.
   *
   * Invariant, enforced by the engine and relied on by every renderer: a finding
   * with `needs` set has `severity: 'info'` and carries NO `count`. A gap styled
   * as a warning teaches users to dismiss gaps; a gap carrying a number is not a
   * gap.
   */
  readonly needs?: UnknownReason;
}

// ─── The collection context ─────────────────────────────────────────────────
//
// A finding read out of a UI carries none of what qualifies it. The artifact is
// the copy that travels: a `preflight.json` in a batch zip, a `--json` capture
// in CI. A reader must be able to tell a clean report taken with an
// unresolved palette, an un-run `onInit` and a headless stage apart from a clean
// report taken with all three in hand. `plans/65-preflight-and-cost.md` section 6 rule 9
// applied to counts rather than money: a caveat that lives only in a UI string is
// a bug.
//
// These are structural ECHOES of the engine's own setting types, restated here
// (rather than imported) because this package must not depend on the engine.

/** A dimension as reported: `{ value, unit }`, unit free-form (`px`/`mm`/…). */
export interface ReportedDimension {
  readonly value: number;
  readonly unit: string;
}

/** The output size as the collector resolved it, with its provenance intact. */
export interface ReportedSize {
  readonly width: ReportedDimension;
  readonly height: ReportedDimension;
  readonly dpi: number;
  /** `'url' | 'row' | 'size-select' | 'manifest'`. */
  readonly declaredBy: string;
  /** True only when the SOURCE spelled a unit out. */
  readonly unitDeclared: boolean;
}

/** The settings the findings were taken against, echoed into the artifact. */
export interface ReportedSettings {
  readonly format: string;
  readonly size: ReportedSize;
  readonly bleed: Fact<ReportedDimension | null>;
  readonly marks: Fact<Readonly<Record<string, boolean | undefined>> | null>;
  readonly pressProfile: Fact<string | null>;
}

/** What the report was taken against, not just which tool and format. */
export interface ReportedJob {
  readonly toolId: string;
  readonly format: string;
  readonly rowIndex?: number;
  /** Which shell collected the facts: `'web' | 'cli' | 'tui' | …`. */
  readonly source?: string;
  /** `'declared'` means hooks had not run, so hook-patched counts are ceilings. */
  readonly modelPhase?: string;
  /** False means every DOM-derived fact in this report is a stated gap. */
  readonly stageMounted: boolean;
  /** False means no plate ceiling was taken: the brand palette did not resolve. */
  readonly paletteResolved: boolean;
  readonly settings: ReportedSettings;
}

// ─── The report ─────────────────────────────────────────────────────────────

/**
 * The serialised result of one preflight pass.
 *
 * There is NO total, NO currency, NO rate and NO monetary field in this type, and
 * none may be added to it.
 */
export interface PreflightReport {
  readonly $format: 'lolly-preflight';
  readonly formatVersion: 1;
  /** The `ENGINE_VERSION` that produced it. */
  readonly engine: string;
  readonly job: ReportedJob;
  /** Severity-ordered: every error, then every warning, then every info. */
  readonly findings: readonly Finding[];
  /**
   * Every `count` carried by a finding, deduplicated by (kind, box, basis).
   * A convenience index for a consumer that wants quantities without walking
   * findings. Never a second source of truth: each entry is the same object the
   * finding carries.
   */
  readonly counts: readonly Count[];
  /**
   * Every finding with `needs` set, lifted out so a consumer cannot miss them.
   * An omitted gap is indistinguishable from "no problem here", which is the one
   * outcome this whole module exists to prevent.
   */
  readonly gaps: readonly Finding[];
}

/** The `$format` discriminator, so a reader can identify a report on disk. */
export const PREFLIGHT_FORMAT = 'lolly-preflight';
/** Bumped only on a breaking change to `PreflightReport`. */
export const PREFLIGHT_FORMAT_VERSION = 1;
