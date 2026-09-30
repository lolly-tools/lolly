// SPDX-License-Identifier: MPL-2.0
import type { BrandSystemV1, BrandRuleV1 } from '@lolly-tools/core/brand-system-v1';
import { brandSystemOf, readBrandSystem } from '../../../../../engine/src/brand-system.ts';
import { TOKEN_EXT } from '../../../../../engine/src/token-ext.ts';
import { brandResourceAssetIds } from '../../../../../engine/src/brand-resources.ts';
import { collectAssetTokens } from '../../../../../engine/src/design-version.ts';
import { sha256Hex } from '../../../../../engine/src/bytes.ts';
import type { createBridge } from '../../bridge/index.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebTokensAPI } from '../../bridge/tokens.ts';

export type UsageHost = Awaited<ReturnType<typeof createBridge>> & { tokens: NonNullable<Awaited<ReturnType<typeof createBridge>>['tokens']> };

export function usageSystem(doc: unknown, label: string): BrandSystemV1 {
  const system = brandSystemOf(doc);
  const raw = (doc as { $extensions?: Record<string, { brandSystem?: unknown }> } | null)?.$extensions?.[TOKEN_EXT]?.brandSystem;
  if (!system && raw !== undefined) throw new Error('This guide needs a newer Lolly build or a corrected source. The original guide has been kept.');
  return system ?? { schemaVersion: 1, id: 'local-brand', label, roles: [], bindings: [], rules: [] };
}

/** Preserve the source document and opaque extensions when changing the guide. */
export function withUsageSystem(doc: unknown, system: BrandSystemV1): Record<string, unknown> {
  usageSystem(doc, system.label);
  if (!readBrandSystem(system)) throw new Error('Review the brand roles and rules before saving.');
  const next = structuredClone(doc || {}) as Record<string, unknown>;
  const extensions = (next.$extensions ?? {}) as Record<string, unknown>;
  next.$extensions = { ...extensions, [TOKEN_EXT]: { ...(extensions[TOKEN_EXT] as object ?? {}), brandSystem: structuredClone(system) } };
  return next;
}

export function replaceUsageRule(system: BrandSystemV1, rule: BrandRuleV1): BrandSystemV1 {
  const next = structuredClone(system);
  const index = next.rules.findIndex(item => item.id === rule.id);
  if (index < 0) next.rules.push(rule); else next.rules[index] = rule;
  return next;
}

export function removeUsageRule(system: BrandSystemV1, id: string): BrandSystemV1 {
  const next = structuredClone(system);
  next.rules = next.rules.filter(rule => rule.id !== id);
  for (const group of next.guide?.groups ?? []) group.ruleIds = group.ruleIds.filter(ruleId => ruleId !== id);
  return next;
}

/** Capture before reading, then compare the reviewed head again inside commit. */
export async function usageRevision(host: UsageHost) {
  const snapshot = await host.brandAdoption.capture();
  const doc = await host.tokens.raw();
  return { snapshot, doc };
}

/** Stored byte revisions are checked again when returning to an already measured guide. */
export async function usageDependencies(host: Pick<HostV1, 'assets' | 'tokens'>, doc: unknown): Promise<string> {
  const tokens = host.tokens as (NonNullable<HostV1['tokens']> & Partial<Pick<WebTokensAPI, 'activeRecord'>>) | undefined;
  const record = await tokens?.activeRecord?.();
  const ids = new Set([...brandResourceAssetIds(doc), ...collectAssetTokens(doc).map(ref => ref.id), ...(record?.importedFonts ?? [])]);
  const assets = host.assets as typeof host.assets & { _getUserRecord?(id: string): Promise<{ version?: string; checksum?: string } | null> };
  const resources = await Promise.all([...ids].sort().map(async id => {
    const stored = id.startsWith('user/') ? await assets._getUserRecord?.(id) : null;
    const ref = await host.assets.get(id).catch(() => null);
    return { id, available: !!ref, version: stored?.version ?? ref?.version, checksum: stored?.checksum ?? ref?.checksum, type: ref?.type, format: ref?.format, pin: ref?.pin };
  }));
  const identity = record ? { id: record.id, headId: record.headId, locked: record.locked, importedFonts: record.importedFonts, catalog: record.catalog } : await tokens?.active?.();
  return sha256Hex(new TextEncoder().encode(JSON.stringify({ doc, identity, resources })));
}
