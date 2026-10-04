// SPDX-License-Identifier: MPL-2.0
/**
 * check-v1: one findings list for a Design document, a `.lolly` or an export
 * (plan 291, W1). `lolly check`, the `lolly_check` MCP tool and the web page hook
 * all return a `CheckReportV1`, mirrored by `schemas/check-report-v1.schema.json`
 * (with a byte-identical copy under `packages/core/schema/` for the SDK).
 *
 * Five families run in one call: structure (`inspectDesignV1`), render (the
 * mounted audit, through the browser tier), brand (`checkBrandDesign` plus the
 * pack's house rules), verify (the forensic layout rules) and fidelity (the
 * result against a source inventory). Each family reports its own state, so a
 * family that could not run is said out loud rather than read as clean.
 *
 * A finding is a strict subset of plan 276's `OutcomeV1.findings[]` entry
 * (`code`, `severity`, `message`, `path`, `evidence`) plus the plan 195 extras:
 * the affected node (`layerId`, `path`) and the remedy (`suggestion`, `fix`).
 * Severity and evidence reuse the preflight vocabulary rather than redefine those types.
 *
 * Findings are data in the report. A surface never turns one into a `warn()`
 * call, because the global `--strict` would then promote it a second time.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */
import type { Evidence, Severity } from './preflight.ts';

/** Report discriminator, as `PREFLIGHT_FORMAT` is for preflight. */
export const CHECK_FORMAT = 'lolly-check' as const;
/** Bumped only for a change an older reader would misread. */
export const CHECK_FORMAT_VERSION = 1 as const;

/** The five families, in the order a report lists them. */
export const CHECK_FAMILIES = ['structure', 'render', 'brand', 'verify', 'fidelity'] as const;
export type CheckFamily = (typeof CHECK_FAMILIES)[number];

/**
 * What happened to a family on this run. `skipped` is a choice (no `--source`
 * for fidelity, a family the input kind has no use for); `unavailable` is a
 * missing capability (no browser tier, no design system); `failed` is a crash,
 * with the reason in `reason`.
 */
export const CHECK_FAMILY_STATES = ['ran', 'skipped', 'unavailable', 'failed'] as const;
export type CheckFamilyStateKind = (typeof CHECK_FAMILY_STATES)[number];

/**
 * The checker a finding came from. `id` in the origin is that checker's own finding id or rule.
 * `text-measure` predicts clipping from font metrics (plan 291 W5) when the render family
 * could not paint the document. `design-authoring` lowers a document's authoring keys
 * (`$in`, `$style`, `$stack` and the rest, design-authoring-v1) before the structure family
 * reads it, and reports a key it cannot lower. `image-resolution` reads the pixel size of
 * each uploaded or catalog raster from its bytes and reports one drawn at more than twice
 * that size (`design.image.low-resolution`, plan 291 M3b).
 */
export const CHECK_CHECKERS = ['design-v1', 'mounted-audit', 'brand-check', 'house-rules', 'forensic', 'fidelity', 'text-measure', 'design-authoring', 'image-resolution'] as const;
export type CheckCheckerV1 = (typeof CHECK_CHECKERS)[number];

/**
 * Why a finding asks for a person. `review`: a value that may be right and needs
 * a decision. `unknown`: the checker could not decide. `visual-check`: only a
 * look at the rendered result can settle it (text over a photo).
 */
export const CHECK_FINDING_NEEDS = ['review', 'unknown', 'visual-check'] as const;
export type CheckFindingNeedsV1 = (typeof CHECK_FINDING_NEEDS)[number];

/** The overall verdict. */
export const CHECK_OUTCOMES = ['clean', 'review', 'refused', 'failed'] as const;
export type CheckOutcomeV1 = (typeof CHECK_OUTCOMES)[number];

/** Every exit code a check can report. */
export const CHECK_EXIT_CODES = [0, 1, 2, 3, 4, 5] as const;
export type CheckExitCodeV1 = (typeof CHECK_EXIT_CODES)[number];

/**
 * The exit codes by meaning, shared by the CLI and the MCP `exitCode`.
 * 0: no warn or error finding (info allowed). 1: a family crashed. 2: usage.
 * 3: `--browser=require` and no browser tier. 4: an error finding, or any warn
 * under `--strict`. 5: warn findings only, the full report kept, as
 * `rebrand compile` does.
 */
export const CHECK_EXIT = { clean: 0, failed: 1, usage: 2, unavailable: 3, refused: 4, review: 5 } as const;

/** Which exit codes each outcome may carry; the schema holds the same pairing. */
export const CHECK_OUTCOME_EXIT_CODES: Readonly<Record<CheckOutcomeV1, readonly CheckExitCodeV1[]>> = {
  clean: [CHECK_EXIT.clean],
  review: [CHECK_EXIT.review],
  refused: [CHECK_EXIT.refused],
  failed: [CHECK_EXIT.failed, CHECK_EXIT.usage, CHECK_EXIT.unavailable],
};

/** What the check was given. */
export const CHECK_INPUT_KINDS = ['design', 'lolly', 'pdf', 'pptx', 'image'] as const;
export type CheckInputKindV1 = (typeof CHECK_INPUT_KINDS)[number];

/**
 * Where the design system came from, in ladder order: `--file`, then the active
 * terminal system, then the active content profile's head tokens asset.
 */
export const CHECK_DESIGN_SYSTEM_ORIGINS = ['file', 'terminal', 'profile'] as const;
export type CheckDesignSystemOriginV1 = (typeof CHECK_DESIGN_SYSTEM_ORIGINS)[number];

/**
 * A finding code: lower case, dotted, at least two parts, each part letters,
 * digits, dashes or underscores (`design.text.overflow`,
 * `brand.rule.headline-weight`, `verify.eyebrow-heading`, `fidelity.text.missing`).
 * A code is stable across releases; the message is not.
 */
export const CHECK_CODE_PATTERN = '^[a-z][a-z0-9_-]*(\\.[a-z0-9][a-z0-9_-]*)+$';

/** A rectangle in artboard-local px (a document) or page-local px (an export). */
export interface CheckBoxV1 { x: number; y: number; width: number; height: number }

/**
 * A change the brand fix can apply as is (`applyBrandFix`-safe). Present only
 * then. `before` is the value read; a field that was unset is `null`, never left
 * out, so the key survives JSON.
 */
export interface CheckFixV1 { layerId: string; field: string; before: unknown; after: unknown }

/** Where a finding came from, so a reader can trace each finding to its checker. */
export interface CheckOriginV1 {
  checker: CheckCheckerV1;
  /** The checker's own finding id or rule id (`design.text.overflow`, `eyebrow-heading`). */
  id: string;
  /** How the checker knew, when it says (`source-geometry`, `decoded-pixels`, `ocr`). */
  method?: string;
  /** The checker's confidence, 0 to 1, when it states one. */
  confidence?: number;
  /** The forensic contribution (`weak-clue`, `specific-artifact`, `context-excluded`). */
  contribution?: string;
}

export interface CheckFindingV1 {
  /** Stable, dotted, matching `CHECK_CODE_PATTERN`. */
  code: string;
  family: CheckFamily;
  severity: Severity;
  /** English, the same text the app shows. */
  message: string;
  needs?: CheckFindingNeedsV1;
  /** A JSON pointer into the input, `/boxes/<index>/<field>` for a document. */
  path?: string;
  layerId?: string;
  artboardId?: string;
  /** The export page this finding is on, as the forensic reader labels pages. */
  page?: string;
  box?: CheckBoxV1;
  evidence?: Evidence;
  suggestion?: string;
  fix?: CheckFixV1;
  /**
   * The token theme the finding was found in (plan 291 W4). Set when one report checks
   * a document in more than one theme (`--themes`); absent for a single-theme check.
   */
  theme?: string;
  origin: CheckOriginV1;
}

/** One family's state and its tally. The counts are the findings this family contributed. */
export interface CheckFamilyStateV1 {
  state: CheckFamilyStateKind;
  /** Why it was skipped, unavailable or failed; for `ran`, any note worth keeping. */
  reason?: string;
  error: number;
  warn: number;
  info: number;
}

export interface CheckCountsV1 { error: number; warn: number; info: number }

export interface CheckInputV1 {
  kind: CheckInputKindV1;
  name?: string;
  /** Lower-case hex SHA-256 of the input bytes. */
  sha256?: string;
  artboards?: number;
  pages?: number;
}

/** The fidelity comparison against a source, present when `--source` was given and the family ran. */
export interface CheckFidelityV1 {
  slides: { source: number; result: number };
  /** Source strings with no match in the result, normalised. */
  missingStrings: string[];
  /** Source strings the result carries in edited form: deliberate edits are listed, never hidden. */
  editedStrings: Array<{ source: string; result: string }>;
  /** Speaker notes carried, and missing; a note a declared edit covers is in neither count, and is listed in `excepted`. */
  notes: { carried: number; missing: number };
  /**
   * Source strings and speaker notes a declared deliberate edit covers (`lolly check
   * --edits`, the MCP `edits` argument). Their findings stay in the report as `info`
   * with `evidence.excepted`: excepted, never passed. Present when edits were given.
   */
  excepted?: CheckFidelityExceptedV1[];
}

/**
 * A change to the source's wording made on purpose, as `--edits=<edits.json>` lists
 * them (a JSON array of these, or `{ "edits": [...] }`). `result` is what the
 * recreation says instead; left out, the string was dropped on purpose.
 */
export interface CheckFidelityEditV1 {
  source: string;
  result?: string;
  reason: string;
}

/** One fidelity finding a declared edit covers. `result` is what the recreation reads, when it carries the string at all. */
export interface CheckFidelityExceptedV1 {
  slide: number;
  source: string;
  result?: string;
  reason: string;
}

/** The design system the brand family checked against. */
export interface CheckDesignSystemV1 {
  profile?: string;
  origin: CheckDesignSystemOriginV1;
  /** The tokens asset id, for the `profile` origin. */
  tokensAsset?: string;
}

export interface CheckReportV1 {
  format: typeof CHECK_FORMAT;
  version: typeof CHECK_FORMAT_VERSION;
  input: CheckInputV1;
  outcome: CheckOutcomeV1;
  exitCode: CheckExitCodeV1;
  strict: boolean;
  families: Record<CheckFamily, CheckFamilyStateV1>;
  /** The sum over the families, and the tally of `findings` by severity. */
  summary: CheckCountsV1;
  findings: CheckFindingV1[];
  fidelity?: CheckFidelityV1;
  /** `null` when no design system resolved (the brand family is then `unavailable`). */
  designSystem?: CheckDesignSystemV1 | null;
}
