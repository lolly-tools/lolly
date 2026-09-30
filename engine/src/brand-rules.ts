// SPDX-License-Identifier: MPL-2.0
/** Bounded predicates for named example slots. Unknown rules never establish a pass. */
import type { BrandRuleV1, BrandSystemV1 } from '@lolly-tools/core/brand-system-v1';
import type { DesignToolDraftV1 } from '@lolly-tools/core/design-tool-v1';
import { createTokenSet } from './tokens.ts';

export const BRAND_RULE_KINDS = ['color-choices', 'font-choices', 'fixed-artwork', 'text-length'] as const;
export type BrandRuleKind = (typeof BRAND_RULE_KINDS)[number];
export const BRAND_EXAMPLES = ['brand-poster', 'brand-slide-title', 'brand-slide-content', 'brand-chart'] as const;
export type BrandExample = (typeof BRAND_EXAMPLES)[number];
export type BrandSlot = 'accent' | 'type' | 'device' | 'heading' | 'body';
export interface BrandRuleContext { tool: string; mode: string; output: string; adapter?: BrandExample }
export interface BrandRuleConstraint { slot: BrandSlot; kind: BrandRuleKind; values?: string[]; max?: number }
export interface BrandRuleResult {
  id: string; state: 'pass' | 'fail' | 'unknown' | 'outside'; reason: string;
  enforced: boolean; constraint?: BrandRuleConstraint;
}
export interface BrandSlotFact { value: unknown; fixed?: boolean }
export type BrandFacts = Partial<Record<BrandSlot, BrandSlotFact>>;

export function brandRuleSlot(kind: string): BrandSlot | null {
  return kind === 'color-choices' ? 'accent' : kind === 'font-choices' ? 'type' : kind === 'fixed-artwork' ? 'device' : null;
}

/** These are example adapters, not aliases for every tool that renders a colour. */
export function resolveBrandRule(rule: BrandRuleV1, system: BrandSystemV1, doc: unknown, context: BrandRuleContext): BrandRuleResult {
  const result = (state: BrandRuleResult['state'], reason: string, constraint?: BrandRuleConstraint): BrandRuleResult => ({
    id: rule.id, state, reason, enforced: rule.review.state === 'approved' && rule.requirement === 'required', ...(constraint ? { constraint } : {}),
  });
  if (rule.scope?.tools && !rule.scope.tools.includes(context.tool) && !(context.adapter && rule.scope.tools.includes(context.adapter)) || rule.scope?.modes && !rule.scope.modes.includes(context.mode) || rule.scope?.outputs && !rule.scope.outputs.includes(context.output)) return result('outside', 'This rule applies to another example, mode or format.');
  if (!(BRAND_RULE_KINDS as readonly string[]).includes(rule.kind)) return result('unknown', 'This rule kind has no checker in this build.');
  if (!(BRAND_EXAMPLES as readonly string[]).includes(context.adapter ?? context.tool)) return result('unknown', 'This tool has no adapter for this rule.');
  const kind = rule.kind as BrandRuleKind;
  const slot = kind === 'text-length' && ['heading', 'body'].includes(String(rule.parameters.slot)) ? rule.parameters.slot as BrandSlot : brandRuleSlot(kind);
  const keys = kind === 'text-length' ? ['slot', 'max'] : ['slot'];
  if (!slot || rule.parameters.slot !== slot || Object.keys(rule.parameters).some(key => !keys.includes(key))) return result('unknown', 'Review the rule parameters. This checker does not interpret additional conditions.');
  if ((context.adapter ?? context.tool) === 'brand-chart' && (slot === 'device' || slot === 'body')) return result('unknown', 'The chart example has no matching field.');
  if (kind === 'text-length') {
    const max = rule.parameters.max;
    if (!Number.isInteger(max) || Number(max) < 1 || Number(max) > 10000) return result('unknown', 'Choose a text limit between 1 and 10,000 UTF-16 units.');
    return result('unknown', 'Text has not been measured.', { kind, slot, max: Number(max) });
  }
  const roles = rule.roleIds.map(id => system.roles.find(role => role.id === id));
  if (!roles.length || roles.some(role => !role?.resources.length)) return result('unknown', 'Choose a brand role with resources.');
  if (roles.some(role => !system.bindings.some(binding => binding.roleId === role!.id && [context.tool, context.adapter].includes(binding.consumer.tool) && binding.consumer.tool !== undefined && binding.consumer.slot === slot && (!binding.modes || binding.modes.includes(context.mode))))) return result('unknown', 'Map each brand role to this example field.');
  const tokens = createTokenSet(doc, { theme: context.mode });
  const values: string[] = [];
  for (const role of roles) for (const ref of role!.resources) {
    if (kind === 'fixed-artwork') {
      if (ref.type !== 'asset') return result('unknown', 'Fixed artwork needs one asset resource.');
      values.push(ref.id);
    } else {
      if (ref.type !== 'token') return result('unknown', 'Colour and font choices need token resources.');
      const token = tokens.get(ref.path);
      const value = tokens.resolve(`{${ref.path}}`);
      if (token?.type !== (kind === 'color-choices' ? 'color' : 'fontFamily') || typeof value !== 'string' || !value || value.startsWith('{')) return result('unknown', 'A referenced token is missing or cannot be resolved as a single colour or font family.');
      values.push(value);
    }
  }
  const unique = [...new Set(values)];
  if (kind === 'fixed-artwork' && unique.length !== 1) return result('unknown', 'Fixed artwork needs exactly one asset.');
  return result('unknown', 'The example has not been measured.', { kind, slot, values: unique });
}

export function checkBrandRules(system: BrandSystemV1, doc: unknown, context: BrandRuleContext, facts: BrandFacts): BrandRuleResult[] {
  return checkResolvedBrandRules(system.rules.map(rule => resolveBrandRule(rule, system, doc, context)), facts);
}

/** Reuse the same predicates with facts collected by another trusted shell adapter. */
export function checkResolvedBrandRules(results: BrandRuleResult[], facts: BrandFacts): BrandRuleResult[] {
  return results.map(result => {
    const constraint = result.constraint;
    if (!constraint) return result;
    const fact = facts[constraint.slot];
    if (!fact || typeof fact.value !== 'string' || constraint.kind === 'fixed-artwork' && fact.fixed === undefined) return result;
    const matches = constraint.kind === 'text-length' ? fact.value.length <= constraint.max! : constraint.values!.includes(fact.value) && (constraint.kind !== 'fixed-artwork' || fact.fixed === true);
    return { ...result, state: matches ? 'pass' : 'fail', reason: matches ? 'The observed field meets this rule.' : constraint.kind === 'text-length' ? `Shorten this field to ${constraint.max} UTF-16 units.` : 'The observed field is outside this rule’s choices.' };
  });
}

/** Compile approved required constraints into the existing portable Design policy. */
export function constrainBrandPoster(draft: DesignToolDraftV1, results: BrandRuleResult[], fields: Partial<Record<BrandSlot, string>>): DesignToolDraftV1 {
  const next = structuredClone(draft);
  for (const result of results) {
    if (!result.enforced || result.state === 'outside') continue;
    if (result.state !== 'pass') throw new Error('Resolve required rules before compiling this poster. Unchecked examples can be exported as drafts.');
    if (!result.constraint) throw new Error('A required rule cannot be compiled for this poster. Keep the example as a draft.');
    const c = result.constraint;
    if (c.kind === 'fixed-artwork') {
      if (result.state !== 'pass' || fields.device) throw new Error('The required artwork must be present and fixed.');
      const fixed = next.variants.flatMap(variant => variant.boxes.filter(box => {
        const image = box.image;
        return (typeof image === 'string' ? image : image && typeof image === 'object' && 'id' in image ? image.id : null) === c.values![0];
      }).map(box => ({ variantId: variant.id, layerId: String(box.id) })));
      if (next.variants.some(variant => !fixed.some(box => box.variantId === variant.id)) || next.inputs.some(input => input.targets.some(target => fixed.some(box => box.variantId === target.variantId && box.layerId === target.layerId))) || next.choices.some(choice => choice.options.some(option => option.writes.some(target => fixed.some(box => box.variantId === target.variantId && box.layerId === target.layerId))))) throw new Error('The required artwork must be present in every layout and have no editable targets.');
      continue;
    }
    const field = next.inputs.find(input => input.input.id === fields[c.slot]);
    if (!field) throw new Error('A required rule has no editable field in this poster.');
    if (c.kind === 'text-length') field.input.maxLength = Math.min(Number(field.input.maxLength) || 10000, c.max!);
    else {
      field.approved = field.approved ? field.approved.filter(value => c.values!.includes(value)) : [...c.values!];
      if (!field.approved.length) throw new Error('The required rules have no choices in common.');
      field.input.type = 'select';
      field.input.options = field.approved.map(value => ({ value, label: value }));
      if (!field.approved.includes(String(field.input.default))) field.input.default = field.approved[0]!;
    }
  }
  return next;
}

/** An output with missing required facts is a draft; a known required failure blocks. */
export function brandRuleDisposition(results: BrandRuleResult[]): 'blocked' | 'draft' | 'checked' {
  const required = results.filter(result => result.enforced && result.state !== 'outside');
  return required.some(result => result.state === 'fail') ? 'blocked' : required.some(result => result.state === 'unknown') ? 'draft' : 'checked';
}
