// SPDX-License-Identifier: MPL-2.0
/** Shared managed-input projection and evidence checks. These do not inspect pixels. */
import type { BrandPolicyMappingV1, BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
import { BRAND_EXAMPLES, checkResolvedBrandRules, resolveBrandRule, type BrandFacts, type BrandRuleResult, type BrandSlot } from './brand-rules.ts';
import { productionDigest } from './production/contract.ts';
export { brandSystemOf } from './brand-system.ts';
export { brandRuleDisposition } from './brand-rules.ts';

export function parseBrandPolicyMappings(raw: unknown): BrandPolicyMappingV1[] {
  if (!Array.isArray(raw) || raw.length > 128) throw new Error('Provide at most 128 tool mappings.');
  const tools = new Set<string>();
  return raw.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid tool mapping.');
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(k => !['toolId', 'example', 'mode', 'fields'].includes(k)) || typeof v.toolId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(v.toolId) || tools.has(v.toolId)
      || !(BRAND_EXAMPLES as readonly unknown[]).includes(v.example) || typeof v.mode !== 'string' || !v.mode.trim() || v.mode.length > 200
      || !v.fields || typeof v.fields !== 'object' || Array.isArray(v.fields)) throw new Error('Invalid or duplicate tool mapping.');
    tools.add(v.toolId);
    const fields = Object.entries(v.fields);
    if (!fields.length || fields.some(([slot, id]) => !['accent', 'type', 'device', 'heading', 'body'].includes(slot) || typeof id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(id))
      || new Set(fields.map(([, id]) => id)).size !== fields.length) throw new Error('Map each slot to a distinct declared input.');
    return { toolId: v.toolId, example: v.example, mode: v.mode, fields: Object.fromEntries(fields) } as BrandPolicyMappingV1;
  });
}

export function resolveBrandPolicy(system: BrandSystemV1, doc: unknown, toolId: string, output: string, mapping?: BrandPolicyMappingV1): BrandRuleResult[] {
  if (mapping && mapping.toolId !== toolId) throw new Error('Brand mapping belongs to another tool.');
  return system.rules.map(rule => resolveBrandRule(rule, system, doc, { tool: toolId, output, mode: mapping?.mode ?? 'Default', ...(mapping ? { adapter: mapping.example } : {}) }));
}

export function checkBrandPolicyValues(results: BrandRuleResult[], mapping: BrandPolicyMappingV1 | undefined, values: Record<string, unknown>): BrandRuleResult[] {
  const facts: BrandFacts = {};
  for (const [slot, id] of Object.entries(mapping?.fields ?? {})) {
    if (Object.hasOwn(values, id)) facts[slot as BrandSlot] = { value: values[id] };
  }
  return checkResolvedBrandRules(results, facts);
}

/** Hashes must come from the runtime that exported these bytes, never request data. */
export async function checkBrandPolicyDigests(results: BrandRuleResult[], mapping: BrandPolicyMappingV1 | undefined, initial: Record<string, unknown>, observed: Record<string, string>): Promise<BrandRuleResult[]> {
  return Promise.all(results.map(async result => {
    const c = result.constraint, id = c && mapping?.fields[c.slot];
    if (!c || !id || !Object.hasOwn(observed, id)) return result;
    if (c.kind === 'fixed-artwork') return { ...result, state: 'unknown', reason: 'The artwork input is constrained; visible fixed artwork has not been measured by this adapter.' };
    let value: unknown;
    if (c.values) {
      value = (await Promise.all(c.values.map(async candidate => ({ candidate, hash: await productionDigest(candidate) })))).find(candidate => candidate.hash === observed[id])?.candidate;
      if (value === undefined) return { ...result, state: 'fail', reason: 'The exported runtime input is outside the approved choices.' };
    } else if (Object.hasOwn(initial, id) && await productionDigest(initial[id]) === observed[id]) value = initial[id];
    return checkResolvedBrandRules([result], { [c.slot]: { value } })[0]!;
  }));
}
