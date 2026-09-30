// SPDX-License-Identifier: MPL-2.0
/** Reads portable brand vocabulary and rule records without claiming enforcement. */
import Ajv from 'ajv';
import schema from '@lolly-tools/core/schema/brand-system-v1.schema.json' with { type: 'json' };
import type { BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
import { TOKEN_EXT } from './token-ext.ts';

const validate = new Ajv({ allErrors: false }).compile<BrandSystemV1>(schema);
/** Checks structure and local references only. No rule kind is enforced by this reader. */
export function readBrandSystem(value: unknown): BrandSystemV1 | null {
  if (!validate(value)) return null;
  const unique = (items: { id: string }[]): boolean => new Set(items.map(v => v.id)).size === items.length;
  if (![value.roles, value.bindings, value.rules, value.guide?.groups ?? []].every(unique)) return null;
  const roles = new Set(value.roles.map(v => v.id));
  const rules = new Set(value.rules.map(v => v.id));
  if (value.bindings.some(v => !roles.has(v.roleId)) || value.rules.some(v => v.roleIds.some(id => !roles.has(id)))) return null;
  if (value.guide?.groups.some(v => v.roleIds.some(id => !roles.has(id)) || v.ruleIds.some(id => !rules.has(id)))) return null;
  return structuredClone(value);
}

/** Additive extension: old token/context/package readers can retain the raw payload. */
export function brandSystemOf(doc: unknown): BrandSystemV1 | null {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const ext = (doc as Record<string, unknown>).$extensions;
  if (!ext || typeof ext !== 'object') return null;
  const vendor = (ext as Record<string, unknown>)[TOKEN_EXT];
  if (!vendor || typeof vendor !== 'object') return null;
  return readBrandSystem((vendor as Record<string, unknown>).brandSystem);
}
