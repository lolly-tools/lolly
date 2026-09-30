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
