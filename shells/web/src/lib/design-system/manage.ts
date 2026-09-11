// SPDX-License-Identifier: MPL-2.0
/**
 * manage.ts - creating, renaming and removing design systems (plans/186
 * sections 3.1, 3.2 and 5). DOM-free; the profile card and the studio call it.
 *
 * Creating a system mints a fresh namespace and seeds its head from the shipped
 * catalog document (or from another record's head, for "Make an editable copy"),
 * with the version index stripped and the new identity written in. It does NOT
 * switch to it: the caller decides, because a copy made for later and a system
 * made to work in now are different gestures.
 *
 * Removing a system deletes exactly the material in its namespace (tokens,
 * versions, fonts, logos) and nothing else: personal uploads are outside every
 * system, and frozen bytes are shared by content and reclaimed by a later scan.
 * The shipped system cannot be removed.
 */
import {
  DEFAULT_DESIGN_SYSTEM_ID, SHIPPED_DESIGN_SYSTEM_ID, designMaterialOf, designSystemHeadId, designSystemNamespace,
  isDesignSystemId, slugifyDesignSystemId, withDesignSystemIdentity,
} from '../../../../../engine/src/design-system.ts';
import { stripVersionIndex } from '../../../../../engine/src/design-version.ts';
import { installUserTokens } from '../../bridge/tokens.ts';
import type { DesignSystemRecord, DesignSystemRegistry, DesignSystemSource } from './registry.ts';

export interface ManageHost {
  designSystems: DesignSystemRegistry;
  assets: {
    _getBlob(id: string): Promise<Blob | null>;
    _exportUserAssets(): Promise<Array<{ id: string; type: string }>>;
    _deleteUserAsset(id: string): Promise<void>;
    _uploadUserAsset(record: { id: string; type: 'tokens'; format: string; blob: Blob; version?: string; meta?: Record<string, unknown> }, opts?: { skipQuota?: boolean }): Promise<void>;
    _getUserRecord?(id: string): Promise<{ meta?: Record<string, unknown> } | null>;
  };
  tokens?: { bust?(opts?: { lock?: boolean }): void; isLocked?(): Promise<boolean> };
}

/** A slug for `label` that no record on the device uses yet: `acme`, then `acme-2`... */
export async function uniqueDesignSystemId(registry: DesignSystemRegistry, label: string): Promise<string> {
  const base = slugifyDesignSystemId(label);
  const taken = new Set((await registry.list()).map(r => r.id));
  // `default` and `shipped` are records with meanings of their own; a person's
  // "Default" label must not land on the legacy namespace.
  taken.add(DEFAULT_DESIGN_SYSTEM_ID); taken.add(SHIPPED_DESIGN_SYSTEM_ID);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 48 - String(n).length - 1)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('design systems: no free id for that name');
}

async function readJson(blob: Blob | null): Promise<unknown> {
  if (!blob) return null;
  try { return JSON.parse(await blob.text()); } catch { return null; }
}

/**
 * Create a design system. `seedFrom` names the record whose head document seeds
 * the new head (default: the shipped system, so a new system starts as the
 * starter). Returns the new record; the pointer is untouched.
 */
export async function createDesignSystem(
  host: ManageHost,
  opts: { label: string; seedFrom?: string; source?: DesignSystemSource; locked?: boolean },
): Promise<DesignSystemRecord> {
  const registry = host.designSystems;
  const label = opts.label.trim() || 'My design system';
  const id = await uniqueDesignSystemId(registry, label);
  const seedId = opts.seedFrom ?? SHIPPED_DESIGN_SYSTEM_ID;
  const seed = await registry.get(seedId);
  if (!seed) throw new Error(`design systems: nothing to seed from (“${seedId}”)`);
  const seedDoc = seed.headId ? await readJson(await host.assets._getBlob(seed.headId).catch(() => null)) : null;
  const doc = withDesignSystemIdentity(stripVersionIndex(seedDoc ?? {}), { id, label });
  const now = Date.now();
  const record: DesignSystemRecord = {
    id,
    label,
    ns: designSystemNamespace(id),
    headId: designSystemHeadId(id),
    source: opts.source ?? (seed.source.kind === 'shipped' ? { kind: 'local' } : { kind: 'local', forkedFrom: { id: seed.id, ...(seed.source.kind === 'hosted' && seed.source.version ? { version: seed.source.version } : {}) } }),
    locked: !!opts.locked,
    createdAt: now,
    lastUsedAt: now,
  };
  await registry.put(record);
  // The head write goes through the chokepoint so the build lock, the quota and
  // the record label all apply exactly as for any other install.
  await installUserTokens(host as unknown as Parameters<typeof installUserTokens>[0], doc, { system: id, label });
  return record;
}

/** Rename a record. The head document's identity follows on its next write. */
export async function renameDesignSystem(host: ManageHost, id: string, label: string): Promise<void> {
  const record = await host.designSystems.get(id);
  if (!record) throw new Error(`design systems: no system “${id}”`);
  const next = label.trim();
  if (!next) return;
  await host.designSystems.put({ ...record, label: next });
}

/**
 * Remove a design system and the material in its namespace. Returns how many
 * asset rows were deleted. The caller switches afterwards if it was active
 * (the registry already moved the pointer to `shipped`).
 */
export async function removeDesignSystem(host: ManageHost, id: string): Promise<{ deleted: number; wasActive: boolean }> {
  if (!isDesignSystemId(id) || id === SHIPPED_DESIGN_SYSTEM_ID) {
    throw new Error('design systems: the shipped system cannot be removed');
  }
  const registry = host.designSystems;
  const record = await registry.get(id);
  if (!record) throw new Error(`design systems: no system “${id}”`);
  const wasActive = (await registry.activeId()) === id;
  let deleted = 0;
  const rows = await host.assets._exportUserAssets().catch(() => [] as Array<{ id: string; type: string }>);
  for (const row of rows) {
    const material = designMaterialOf(row.id);
    if (!material || material.systemId !== id) continue;
    try { await host.assets._deleteUserAsset(row.id); deleted++; } catch { /* one stuck row never blocks the rest */ }
  }
  await registry.remove(id);
  host.tokens?.bust?.({ lock: true });
  return { deleted, wasActive };
}
