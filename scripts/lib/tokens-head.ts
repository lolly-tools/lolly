// SPDX-License-Identifier: MPL-2.0
/**
 * Which `tokens` asset an asset index offers as its design system, and whether
 * every reader in this repository would pick the same asset.
 *
 * Readers pick the design system three ways today:
 * - the web shell (`catalog/sync.ts` writes it as `tokensHead`) and Lolly Work
 *   honour the index's explicit `brandTokens`;
 * - the CLI render bridge, the MCP tokens resource and the design brief take the
 *   first tokens asset that is not a published version of another
 *   (`pickHeadAssetId`, in index order);
 * - the share-card builder (`docs/og-image.ts`) and the Node rebrand reader take
 *   the first tokens asset tagged `brand`.
 *
 * One tokens asset satisfies all three by construction. A pack that ships more,
 * such as a deprecated alias kept after a rename (Lolly Demo's `lolly/tokens/opal`
 * became `lolly/tokens/demo`), has to declare `brandTokens`, list the design
 * system first and keep the `brand` tag off the alias, or the readers diverge.
 * validate-catalog runs this over every brand pack's index.
 */
import { isVersionAssetId, pickHeadAssetId } from '../../engine/src/design-version.ts';

export interface TokensIndexAsset {
  id: string;
  type?: string;
  tags?: readonly string[];
  deprecated?: boolean;
  replacedBy?: string;
}

export interface TokensIndexLike {
  brandTokens?: unknown;
  assets?: readonly TokensIndexAsset[];
}

/** Every reason the index's readers could disagree about its design system; empty when none. */
export function tokensHeadProblems(index: TokensIndexLike): string[] {
  const problems: string[] = [];
  const tokens = (index.assets ?? []).filter(asset => asset.type === 'tokens');
  const ids = tokens.map(asset => asset.id);
  const isVersion = (id: string): boolean => ids.some(other => other !== id && isVersionAssetId(id, other));
  const declared = 'brandTokens' in index ? index.brandTokens : undefined;

  if (declared !== undefined && declared !== null && typeof declared !== 'string') {
    problems.push('brandTokens must be a tokens asset id, or null for a neutral catalogue');
    return problems;
  }
  let declaredBroken = false;
  if (typeof declared === 'string') {
    const head = tokens.find(asset => asset.id === declared);
    const broken = !head ? `brandTokens "${declared}" is not a tokens asset in this index`
      : head.deprecated === true ? `brandTokens "${declared}" is deprecated; point brandTokens at its replacement`
        : isVersion(declared) ? `brandTokens "${declared}" is a published version, not a design system`
          : null;
    if (broken) problems.push(broken);
    declaredBroken = broken !== null;
  }

  for (const asset of tokens) {
    if (asset.deprecated !== true) continue;
    if (asset.tags?.includes('brand')) {
      problems.push(`deprecated tokens asset "${asset.id}" still carries the "brand" tag, so tag readers can pick it`);
    }
    if (asset.replacedBy && !tokens.some(other => other.id === asset.replacedBy)) {
      problems.push(`deprecated tokens asset "${asset.id}" is replaced by "${asset.replacedBy}", which is not a tokens asset`);
    }
  }

  const live = tokens.filter(asset => asset.deprecated !== true && !isVersion(asset.id));
  if (declared === undefined && live.length > 1) {
    problems.push(`${live.length} independent tokens assets (${live.map(asset => asset.id).join(', ')}) and no brandTokens; declare the design system`);
  }

  // null declares a neutral catalogue: nothing for the order and tag readers to agree
  // with. A broken declaration is reported once above rather than once per reader.
  if (declared === null || declaredBroken || !tokens.length) return problems;
  const byOrder = pickHeadAssetId(ids);
  const expected = typeof declared === 'string' ? declared : byOrder;
  if (byOrder && tokens.find(asset => asset.id === byOrder)?.deprecated === true) {
    problems.push(`the first tokens asset in index order, "${byOrder}", is deprecated; list the design system before it`);
  } else if (expected && byOrder !== expected) {
    problems.push(`the first tokens asset in index order is "${byOrder}", not "${expected}", so the CLI, the MCP server and the design brief would read another design system`);
  }
  const byTag = tokens.find(asset => asset.tags?.includes('brand'))?.id;
  if (expected && byTag !== undefined && byTag !== expected) {
    problems.push(`the first tokens asset tagged "brand" is "${byTag}", not "${expected}", so the share cards and the rebrand reader would read another design system`);
  }
  return problems;
}
