// SPDX-License-Identifier: MPL-2.0
/** Portable brand vocabulary. Storage is additive; these records do not enforce rules. */
export interface BrandRoleV1 {
  id: string;
  label: string;
  description?: string;
  group?: string;
  resources: Array<{ type: 'token'; path: string } | { type: 'asset'; id: string }>;
}
export interface BrandRuleV1 {
  id: string;
  label: string;
  /** Registered producer/checker kind. Unknown kinds must remain unsupported. */
  kind: string;
  roleIds: string[];
  parameters: Record<string, unknown>;
  scope?: { tools?: string[]; modes?: string[]; outputs?: string[] };
  requirement: 'advisory' | 'required';
  origin: { kind: 'manual'; author: string } | { kind: 'source'; reference: string; locator?: string };
  review: { state: 'draft' } | { state: 'approved'; authority: string };
  description?: string;
}
export interface BrandSystemV1 {
  schemaVersion: 1;
  id: string;
  label: string;
  roles: BrandRoleV1[];
  /** Consumer slots are separate from the brand's role names and identities. */
  bindings: Array<{ id: string; roleId: string; consumer: { tool?: string; slot: string }; modes?: string[] }>;
  rules: BrandRuleV1[];
  /** Presentation order is optional and independent of the studio's rooms. */
  guide?: { groups: Array<{ id: string; label: string; roleIds: string[]; ruleIds: string[]; description?: string }> };
  extensions?: Record<string, unknown>;
}

/** Server-reviewed input mappings, independent of a brand's own terminology. */
export interface BrandPolicyMappingV1 {
  toolId: string;
  example: 'brand-poster' | 'brand-slide-title' | 'brand-slide-content' | 'brand-chart';
  mode: string;
  fields: Partial<Record<'accent' | 'type' | 'device' | 'heading' | 'body', string>>;
}

/**
 * The engine's colour slots. A brand's colour role can fill one; these names stay an
 * implementation detail the interface shows only as the answer to "how does Lolly read this?".
 */
export type ColourSlotV1 = 'primary' | 'on-primary' | 'secondary' | 'surface' | 'text' | 'muted' | 'edge';

/** One colour in a design system's own words: a `roles[]` entry with `group: "colourway"`, or a token nothing declares. */
export interface ColourRoleV1 {
  /** Permanent. Lowercase letters and hyphens, so `--brand-<id>` is a usable variable. */
  id: string;
  /** Free, bounded, inert text. For a role nothing declares, the id made readable. */
  label: string;
  description?: string;
  /** False for a hand-written token the record does not list. It keeps working by name. */
  declared: boolean;
  /** Its token path, `color.semantic.<id>`. */
  path: string;
  /** The slots it fills. Empty means it is read by name only. */
  slots: ColourSlotV1[];
}

/** What fills one slot, and how the file says so. */
export interface ColourSlotReadingV1 {
  slot: ColourSlotV1;
  /** The role that fills the slot; null when the system defines the slot itself. */
  roleId: string | null;
  /** `binding`: the record binds the slot. `self`: the role is the slot. `alias`: only the file's aliases point at the role. `system`: no role fills this slot. */
  source: 'binding' | 'self' | 'alias' | 'system';
  /** False when the record binds the slot and the colours do not link to that role yet. */
  written: boolean;
}

export interface ColourRoleIssueV1 {
  /** Stable, for an interface to explain. */
  code: string;
  message: string;
  subject?: string;
}

/** What a document says about its colour roles. See `readColourRoles` in the engine. */
export interface ColourRolesReadingV1 {
  /** `default`: none at all. `declared`: the record lists some. `undeclared`: the tokens hold some and nothing lists them. */
  state: 'default' | 'declared' | 'undeclared';
  record: 'absent' | 'readable' | 'unreadable';
  /** Declared roles in brand order, then undeclared ones as the document has them. */
  roles: ColourRoleV1[];
  /** The six slots a role can fill. */
  slots: ColourSlotReadingV1[];
  issues: ColourRoleIssueV1[];
}
