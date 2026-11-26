// SPDX-License-Identifier: MPL-2.0
/**
 * partner-kit-v1: a partner company's kit, as a guest in the lead brand's work (Lolly
 * Work plan 82, M8; plan 334 M2a). Mirrored by `schemas/partner-kit-v1.schema.json`,
 * with a byte-identical copy under `packages/core/schema/` for the SDK.
 *
 * A kit holds the company's logos pinned by asset version, a few named colours in closed
 * roles and optional rules for placing a mark: clear space in mark-height units, a
 * minimum size and the treatments the partner allows. It holds no fonts, no themes and
 * no token document, so it is never a design system and never moves the chrome. Its
 * logos are catalog assets the kit points at; a kit never carries logo bytes.
 *
 * The bounds below are the ones the engine reader (`readPartnerKit`) enforces. A surface
 * that shows a limit reads it from here, so what a person is told and what the code
 * refuses are the same number.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */

/** Bumped only for a change an older reader would misread. */
export const PARTNER_KIT_SCHEMA_VERSION = 1 as const;

/** The catalog asset type a kit is stored and served as. Never `tokens`: the tokens bridge takes the first `tokens` asset for the design system. */
export const PARTNER_KIT_ASSET_TYPE = 'partner-kit' as const;

/** The most bytes a kit's JSON may take, UTF-8. */
export const PARTNER_KIT_MAX_BYTES = 65_536;
/** The most colours a kit may hold. */
export const PARTNER_KIT_MAX_COLOURS = 12;
/** The longest colour name, in characters. */
export const PARTNER_KIT_MAX_COLOUR_NAME = 60;
/** The longest company name a kit records, in characters. */
export const PARTNER_KIT_MAX_LABEL = 120;
/** The longest logo asset id, in characters. */
export const PARTNER_KIT_MAX_ASSET_ID = 200;
/** The highest logo asset version a kit may pin. */
export const PARTNER_KIT_MAX_LOGO_VERSION = 1_000_000;
/** The widest clear space, in mark heights. */
export const PARTNER_KIT_MAX_CLEAR_SPACE = 4;
/** The largest minimum size in pixels. */
export const PARTNER_KIT_MAX_MIN_PX = 10_000;
/** The largest minimum size in millimetres. */
export const PARTNER_KIT_MAX_MIN_MM = 1_000;
/** The most skill ids a kit may reserve. Nothing reads them yet. */
export const PARTNER_KIT_MAX_SKILLS = 16;
/** The longest source reference, in characters. */
export const PARTNER_KIT_MAX_SOURCE_REFERENCE = 200;

/** The logos a kit can pin: for light surfaces, for dark surfaces and the square mark. */
export const PARTNER_KIT_LOGO_SURFACES = ['light', 'dark', 'mark'] as const;
export type PartnerKitLogoSurfaceV1 = (typeof PARTNER_KIT_LOGO_SURFACES)[number];

/** Closed: what a colour picker groups by and what a lockup generator will read later. */
export const PARTNER_KIT_COLOUR_ROLES = ['primary', 'secondary', 'accent', 'text', 'surface'] as const;
export type PartnerKitColourRoleV1 = (typeof PARTNER_KIT_COLOUR_ROLES)[number];

/** Closed. Present in a kit, the list means "these and no others". */
export const PARTNER_KIT_TREATMENTS = ['colour', 'mono', 'reverse', 'on-photo'] as const;
export type PartnerKitTreatmentV1 = (typeof PARTNER_KIT_TREATMENTS)[number];

/** Clear space units. `mm` and `px` may be added later as additive units. */
export const PARTNER_KIT_CLEAR_SPACE_UNITS = ['mark-height'] as const;
export type PartnerKitClearSpaceUnitV1 = (typeof PARTNER_KIT_CLEAR_SPACE_UNITS)[number];

/** Where a kit came from, for the line that says so. Never bytes and never a fetched URL. */
export const PARTNER_KIT_SOURCE_KINDS = ['tokens', 'lolly', 'logos', 'manual'] as const;
export type PartnerKitSourceKindV1 = (typeof PARTNER_KIT_SOURCE_KINDS)[number];

/** A kit id: the company id, lowercase letters, digits and hyphens. */
export const PARTNER_KIT_ID_PATTERN = '^[a-z0-9][a-z0-9-]{0,63}$';
/**
 * A logo's catalog asset id: slash-separated segments of letters, digits, `_` and `-`,
 * the first starting with a letter or digit (`inst/Qm9v-x1A`, `lolly/logo/primary`).
 * No dots, so no segment can climb a path.
 */
export const PARTNER_KIT_ASSET_ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9_-]*(/[A-Za-z0-9_-]+){0,7}$';
/** A colour value: six-digit hex. */
export const PARTNER_KIT_COLOUR_PATTERN = '^#[0-9A-Fa-f]{6}$';

/** One logo, pinned by asset version so a kit revision names exact bytes. */
export interface PartnerKitLogoV1 {
  id: string;
  version: number;
}

export interface PartnerKitColourV1 {
  role: PartnerKitColourRoleV1;
  name: string;
  /** `#rrggbb`. The reader returns it lower case. */
  value: string;
}

/** Each rule is optional, and an absent rule means the kit states none. */
export interface PartnerKitRulesV1 {
  clearSpace?: { value: number; unit: PartnerKitClearSpaceUnitV1 };
  /** At least one of the two. A mark is measured against each one given. */
  minSize?: { px?: number; mm?: number };
  treatments?: PartnerKitTreatmentV1[];
}

export interface PartnerKitV1 {
  schemaVersion: typeof PARTNER_KIT_SCHEMA_VERSION;
  /** The company id: one kit per company. */
  id: string;
  /** The company's name when the kit was saved. */
  label: string;
  logos: Partial<Record<PartnerKitLogoSurfaceV1, PartnerKitLogoV1>>;
  colours: PartnerKitColourV1[];
  rules?: PartnerKitRulesV1;
  /** Reserved for skills per kit. Nothing reads the field yet. */
  skills?: string[];
  source?: { kind: PartnerKitSourceKindV1; reference?: string };
}

/**
 * A piece's attachment to a kit: the kit asset's catalog id and the asset version
 * attached, which is the kit revision. Saved as `__partnerKit` and carried in a link as
 * `_kit=<id>@<revision>`.
 */
export interface PartnerKitAttachmentV1 {
  id: string;
  revision: number;
}

/** Why a kit was refused. `path` is a JSON pointer into the kit when one applies. */
export interface PartnerKitIssueV1 {
  code: 'kit.json' | 'kit.too-large' | 'kit.schema' | 'kit.logo-duplicate';
  message: string;
  path?: string;
}

/** Every bound a kit carries, for a surface that shows them. */
export const PARTNER_KIT_LIMITS = {
  maxBytes: PARTNER_KIT_MAX_BYTES,
  maxColours: PARTNER_KIT_MAX_COLOURS,
  maxColourName: PARTNER_KIT_MAX_COLOUR_NAME,
  maxLabel: PARTNER_KIT_MAX_LABEL,
  logoSurfaces: PARTNER_KIT_LOGO_SURFACES,
  maxLogoVersion: PARTNER_KIT_MAX_LOGO_VERSION,
  maxClearSpace: PARTNER_KIT_MAX_CLEAR_SPACE,
  maxMinPx: PARTNER_KIT_MAX_MIN_PX,
  maxMinMm: PARTNER_KIT_MAX_MIN_MM,
  maxSkills: PARTNER_KIT_MAX_SKILLS,
} as const;
