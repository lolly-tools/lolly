// SPDX-License-Identifier: MPL-2.0
/**
 * A brand page: one published address that is a press kit and an agent kit at once.
 * This module holds the wire shapes of the folder's two JSON files, `brand.json` and
 * `checks.json`. The engine builds them (`engine/src/brand-page.ts`), a host stores or
 * serves them, and a reader checks files against `brand.json`.
 *
 * Types and constants only: no DOM, no storage, no network.
 */

export const BRAND_PAGE_VERSION = 1 as const;

/** The DESIGN.md format version these files target. It is an alpha format, so the target is recorded. */
export const DESIGN_MD_TARGET = 'alpha' as const;

/** What one file in the folder is for. */
export type BrandPageFileRoleV1 =
  | 'page' | 'page-markdown' | 'page-style'
  | 'design-md' | 'design-md-variant'
  | 'agents' | 'llms' | 'checks'
  | 'tokens' | 'tokens-resolved'
  | 'logo' | 'font' | 'skill' | 'example';

export interface BrandPageFileV1 {
  /** Relative to the folder, forward slashes, never `..`. */
  path: string;
  role: BrandPageFileRoleV1;
  mediaType: string;
  /** Lowercase hex SHA-256 of the file's bytes. */
  sha256: string;
  size: number;
}

/**
 * Why something the system holds is not in the folder.
 * `policy` is a rule of the deployment, `licence` a licence condition, `unknown` means
 * nothing usable was recorded, `content` is something in the material itself and
 * `limit` is a size or count ceiling.
 */
export type BrandPageHeldKindV1 = 'policy' | 'licence' | 'unknown' | 'content' | 'limit';

export interface BrandPageHeldV1 {
  item: string;
  reason: string;
  kind: BrandPageHeldKindV1;
}

export interface BrandPageColourwayV1 {
  id: string;
  name: string;
  /** The mode ids this colourway has files for, such as `light` and `dark`. */
  modes: string[];
}

/** The publisher's own words. Lolly writes no licence or legal claim for them. */
export interface BrandPageUsageV1 {
  statement?: string;
  contact?: string;
  url?: string;
}

/**
 * How a colour pair reads, by WCAG contrast: `body-text` at 4.5:1 or more, `large-text` at
 * 3:1 or more (which also covers graphics). A measurement, not a verdict on any composition.
 */
export type BrandPagePairReadingV1 = 'body-text' | 'large-text' | 'below-3';

export interface BrandPageColourPairV1 {
  id: string;
  label: string;
  foreground: { slot: string; value: string };
  background: { slot: string; value: string };
  /** WCAG 2 contrast, to two decimal places. */
  contrast: number;
  /** APCA Lc, to the nearest whole number. */
  apca: number;
  reads: BrandPagePairReadingV1;
}

export interface BrandPageCheckVariantV1 {
  colourway: string;
  mode: string;
  pairs: BrandPageColourPairV1[];
}

/** `checked` means the rule ran on the listed documents. `not-run` means there was nothing to run on. `unknown` means this build cannot read the rule. */
export type BrandPageRuleStateV1 = 'checked' | 'not-run' | 'unknown';

export interface BrandPageRuleCheckV1 {
  id: string;
  label: string;
  kind: string;
  requirement: 'required' | 'advisory';
  state: BrandPageRuleStateV1;
  findings: number;
  /** A bounded sample of what the rule noted, one entry per finding. */
  notes: Array<{ colourway: string; mode: string; document: string; layer: string; message: string }>;
}

/** `checks.json`. */
export interface BrandPageChecksV1 {
  version: typeof BRAND_PAGE_VERSION;
  statement: string;
  documents: string[];
  variants: BrandPageCheckVariantV1[];
  rules: BrandPageRuleCheckV1[];
}

/** The counts `brand.json` carries, so a reader knows the size of the checks before opening them. */
export interface BrandPageChecksSummaryV1 {
  file: 'checks.json';
  variants: number;
  pairs: number;
  pairsBelow3: number;
  rules: number;
  rulesWithFindings: number;
}

/** One published logo and the surface it is drawn for, so a reader can take the right one. */
export interface BrandPageLogoV1 {
  id: string;
  name: string;
  path: string;
  surface: 'light' | 'dark' | 'any';
  mono: boolean;
  /** The logo this brand leads with on its surface, when the page knows one. */
  primary?: boolean;
  /** The licence on record, or "Owner-published, not an open licence". Absent when the publisher included the logo with nothing on record. */
  licence?: string;
}

/**
 * A colour the design system names in its own words. The values are in the token files
 * for each colourway and mode, and a reader takes them from there through `token`. The
 * label and description are the brand's text: data, never instructions.
 */
export interface BrandPageColourRoleV1 {
  /** Permanent within the design system. */
  id: string;
  label: string;
  description?: string;
  /** The token to use, `color.semantic.<id>`. */
  token: string;
  /** The slots Lolly reads this as. Empty means by name only: no tool picks it by itself. */
  fills: Array<'primary' | 'secondary' | 'surface' | 'text' | 'muted' | 'edge'>;
}

/** `brand.json`. */
export interface BrandPageV1 {
  version: typeof BRAND_PAGE_VERSION;
  id: string;
  name: string;
  /** `sha256:` of the published token document, so an edit gives a new revision. */
  revision: string;
  publishedVersion?: string;
  origin?: string;
  generator: { name: 'lolly'; engine: string; designMd: typeof DESIGN_MD_TARGET };
  usage?: BrandPageUsageV1;
  colourways: BrandPageColourwayV1[];
  files: BrandPageFileV1[];
  /** Added after the first release of this format, so a reader treats it as optional. */
  logos?: BrandPageLogoV1[];
  /** The brand's own colour words, in its order. Absent when it declares none, and on a page from before this field. */
  colourRoles?: BrandPageColourRoleV1[];
  held: BrandPageHeldV1[];
  checks: BrandPageChecksSummaryV1;
  /** A host may add a publish time. It sits outside the digest, so it changes no identity. */
  publishedAt?: string;
  /** Lowercase hex SHA-256 of the canonical manifest without `digest` and `publishedAt`. */
  digest: string;
}
