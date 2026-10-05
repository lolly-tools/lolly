// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
export interface AssetSourceNode { id: string; label: string; count?: number; children?: AssetSourceNode[]; selectable?: boolean }
export interface CatalogSourceStatus { id: string; label: string; status: 'current' | 'stale' | 'unavailable' | 'pending'; count?: number; lastSyncedAt?: string }
interface Taxonomy { id: string; name: string; kind: 'section' | 'collection' | 'folder'; parentId?: string }
export function assetTaxonomy(asset: AssetRef): Taxonomy[] {
  const actual = asset.meta?.providerTaxonomy;
  if (Array.isArray(actual)) return actual.filter((v): v is Taxonomy => !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string' && ['section', 'collection', 'folder'].includes(v.kind));
  return (['section', 'collection'] as const).flatMap(kind => {
    const values = asset.meta?.[kind === 'section' ? 'providerSections' : 'providerCollections'];
    return Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string').map(name => ({ id: `legacy:${name}`, name, kind })) : [];
  });
}
export const sourceNodeId = (provider: string, kind?: string, id?: string): string => JSON.stringify(kind ? [provider, kind, id] : [provider]);
export function matchesAssetSource(asset: AssetRef, selection: string): boolean {
  if (!selection || selection === 'all') return true;
  if (selection === 'device') return asset.source === 'user' && !asset.meta?.projectId;
  if (selection === 'projects') return !!asset.meta?.projectId;
  if (selection === 'catalog') return asset.source === 'library' && !asset.meta?.provider;
  let parts: unknown; try { parts = JSON.parse(selection); } catch { return false; }
  if (!Array.isArray(parts) || parts[0] !== asset.meta?.provider) return false;
  return parts.length === 1 || assetTaxonomy(asset).some(node => node.kind === parts[1] && node.id === parts[2]);
}
export function buildAssetSourceTree(assets: readonly AssetRef[], statuses: readonly CatalogSourceStatus[] = []): AssetSourceNode[] {
  const providers = new Map<string, { label: string; assets: AssetRef[] }>();
  for (const status of statuses) providers.set(status.id, { label: status.label, assets: [] });
  for (const asset of assets) {
    const id = asset.meta?.provider;
    if (typeof id !== 'string') continue;
    const group = providers.get(id) ?? { label: String(asset.meta?.providerLabel || id), assets: [] }; group.assets.push(asset); providers.set(id, group);
  }
  return [
    { id: 'all', label: 'All assets', count: assets.length },
    { id: 'device', label: 'On this device', count: assets.filter(a => matchesAssetSource(a, 'device')).length },
    { id: 'projects', label: 'Projects', count: assets.filter(a => matchesAssetSource(a, 'projects')).length },
    { id: 'catalog', label: 'Design system', count: assets.filter(a => matchesAssetSource(a, 'catalog')).length },
    ...[...providers].sort((a, b) => a[1].label.localeCompare(b[1].label) || a[0].localeCompare(b[0])).map(([provider, group]) => {
      const nodes = new Map<string, AssetSourceNode>();
      const parents = new Map<string, string>();
      for (const asset of group.assets) for (const taxonomy of [...new Map(assetTaxonomy(asset).map(node => [`${node.kind}:${node.id}`, node])).values()]) {
        const id = sourceNodeId(provider, taxonomy.kind, taxonomy.id);
        const node = nodes.get(id) ?? { id, label: taxonomy.name, count: 0 }; node.count = (node.count ?? 0) + 1; nodes.set(id, node);
        if (taxonomy.parentId) parents.set(id, sourceNodeId(provider, taxonomy.kind, taxonomy.parentId));
      }
      const children = (['section', 'collection', 'folder'] as const).flatMap(kind => {
        const items = [...nodes.values()].filter(n => (JSON.parse(n.id) as string[])[1] === kind).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
        const roots = items.filter(item => {
          const parentId = parents.get(item.id), parent = parentId ? nodes.get(parentId) : undefined;
          if (!parent || parent === item) return true;
          const seen = new Set([item.id]); let ancestor: string | undefined = parentId;
          while (ancestor) { if (seen.has(ancestor)) return true; seen.add(ancestor); ancestor = parents.get(ancestor); }
          parent.children ??= []; parent.children.push(item); return false;
        });
        return items.length ? [{ id: `${provider}:${kind}:group`, label: kind === 'section' ? 'Sections' : kind === 'collection' ? 'Collections' : 'Folders', selectable: false, children: roots }] : [];
      });
      const status = statuses.find(s => s.id === provider);
      return { id: sourceNodeId(provider), label: group.label, ...(group.assets.length || !status || status.count !== undefined ? { count: group.assets.length } : {}), children };
    }),
  ];
}
