// SPDX-License-Identifier: MPL-2.0
/** Asset dependencies in brand vocabulary, independent of labels and rule prose. */
import { TOKEN_EXT } from './token-ext.ts';
type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => !!v && typeof v === 'object' && !Array.isArray(v);

/** Only the known role-resource contract is traversed; opaque extensions stay opaque. */
export function mapBrandResourceIds(doc: unknown, map: (id: string) => string): unknown {
  if (!record(doc) || !record(doc.$extensions)) return doc;
  const vendor = doc.$extensions[TOKEN_EXT];
  if (!record(vendor) || !record(vendor.brandSystem)) return doc;
  const system = vendor.brandSystem;
  if (system.schemaVersion !== 1 || !Array.isArray(system.roles)) return doc;
  const roles = system.roles.map(role => !record(role) || !Array.isArray(role.resources) ? role : {
    ...role, resources: role.resources.map(ref => record(ref) && ref.type === 'asset' && typeof ref.id === 'string' ? { ...ref, id: map(ref.id) } : ref),
  });
  return { ...doc, $extensions: { ...doc.$extensions, [TOKEN_EXT]: { ...vendor, brandSystem: { ...system, roles } } } };
}

export function brandResourceAssetIds(doc: unknown): string[] {
  const ids = new Set<string>();
  mapBrandResourceIds(doc, id => { ids.add(id); return id; });
  return [...ids];
}
