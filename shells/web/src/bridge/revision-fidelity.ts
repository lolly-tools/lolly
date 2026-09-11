// SPDX-License-Identifier: MPL-2.0
/** On-demand local availability checks. Never fetch assets or decode their bytes. */
import type { IDBPDatabase } from 'idb';
import type { VersionedUserAsset, UserAssetVersion } from './asset-history-types.ts';
import { assetDependency } from '../../../../engine/src/asset-version.ts';
import { revisionDependencies, type RevisionDependency } from './revision-dependencies.ts';
import { readRevision } from './revision-read.ts';
import type { SavedStateData } from './state.ts';

export interface RevisionAssetReplacement { key: string; version: string; format: string }
export interface RevisionAssetStatus {
  key: string;
  id: string;
  label: string;
  status: 'saved' | 'current' | 'missing' | 'embedded' | 'unverified' | 'invalid';
  version?: string;
  format?: string;
  replacement?: RevisionAssetReplacement;
}
export interface RevisionAssetReport { revisionId: string; assets: RevisionAssetStatus[]; truncated: boolean }
export interface RevisionFidelityAPI {
  inspect(id: string): Promise<RevisionAssetReport>;
  /** Returns new inputs only. The caller persists them under a NEW slot. */
  prepareCopy(id: string, choices: RevisionAssetReplacement[]): Promise<SavedStateData>;
}

function usable(record: VersionedUserAsset | undefined, dep: RevisionDependency): boolean {
  return !!record && record.id === dep.id && record.type === dep.type && record.format === dep.format && record.blob instanceof Blob;
}

async function assetStatus(db: IDBPDatabase, dep: RevisionDependency): Promise<RevisionAssetStatus> {
  const row: RevisionAssetStatus = { key: dep.key, id: dep.id, label: dep.label, status: 'unverified', version: dep.pin?.version, format: dep.format };
  if (dep.kind !== 'stored') return { ...row, status: dep.kind };
  if (dep.source === 'user' && dep.id.startsWith('user/')) {
    // The user-assets resolver takes literal ids; catalog theme/treatment
    // modifiers are not currently supported on uploads.
    if (dep.references.some(ref => assetDependency(ref as { id: string }).modifier)) return row;
    const tx = db.transaction(['user-assets', 'user-asset-versions']);
    const current = await tx.objectStore('user-assets').get(dep.id) as VersionedUserAsset | undefined;
    const saved = dep.pin && current?.version !== dep.pin.version
      ? await tx.objectStore('user-asset-versions').get([dep.id, dep.pin.version]) as UserAssetVersion | undefined : undefined;
    await tx.done;
    const exact = current?.version === dep.pin?.version ? current : saved?.assetId === dep.id && saved.version === dep.pin?.version ? saved.record : undefined;
    if (!dep.pin) return { ...row, status: usable(current, dep) ? 'current' : 'missing' };
    if (usable(exact, dep) && exact?.version === dep.pin.version) return { ...row, status: 'saved' };
    const replacement = usable(current, dep) && current?.version && current.version !== dep.pin.version
      ? { key: dep.key, version: current.version, format: current.format } : undefined;
    return { ...row, status: 'missing', replacement };
  }
  if (dep.source !== 'library' || dep.id.startsWith('user/')) return row;
  const tx = db.transaction(['asset-meta', 'asset-blob']);
  const meta = await tx.objectStore('asset-meta').get(dep.id) as { type: string; version?: string; formats: Array<{ format: string }> } | undefined;
  const version = dep.pin?.version ?? meta?.version;
  // A key lookup proves cache presence without materialising a potentially huge Blob.
  const cached = version && dep.format ? await tx.objectStore('asset-blob').getKey(`${dep.id}:${dep.format}:${version}`) : undefined;
  await tx.done;
  // Runtime still needs current catalog metadata even when old bytes are cached.
  if (!meta || meta.type !== dep.type || !meta.formats?.some(format => format.format === dep.format)) return { ...row, status: 'unverified' };
  return { ...row, status: cached ? dep.pin ? 'saved' : 'current' : 'missing' };
}

async function inspectData(db: IDBPDatabase, data: SavedStateData): Promise<{ assets: RevisionAssetStatus[]; truncated: boolean }> {
  const { dependencies, truncated } = revisionDependencies(data);
  const assets: RevisionAssetStatus[] = [];
  // One dependency at a time bounds IDB traffic and keeps large blobs lazy.
  for (const dep of dependencies) assets.push(await assetStatus(db, dep));
  return { assets, truncated };
}

export function createRevisionFidelity(db: IDBPDatabase): RevisionFidelityAPI {
  const read = async (id: string): Promise<SavedStateData> => {
    const data = await readRevision(db, id);
    if (!data) throw new Error('This checkpoint is no longer available.');
    return data;
  };
  return {
    async inspect(id) { return { revisionId: id, ...await inspectData(db, await read(id)) }; },
    async prepareCopy(id, choices) {
      if (!Array.isArray(choices) || !choices.length || choices.length > 128 || new Set(choices.map(choice => choice.key)).size !== choices.length) throw new Error('Choose the current assets to use in this copy.');
      const data = await read(id);
      const { dependencies, truncated } = revisionDependencies(data);
      if (truncated) throw new Error('This version is too complex to repair here. Open it as a copy to review its assets in the tool.');
      for (const choice of choices) {
        const dep = dependencies.find(item => item.key === choice.key);
        const candidate = dep && (await assetStatus(db, dep)).replacement;
        if (!dep || !candidate || candidate.version !== choice.version || candidate.format !== choice.format) throw new Error('An asset changed since this check. Check assets again before creating the copy.');
        for (const ref of dep.references) {
          const { id: base, modifier } = assetDependency(ref as { id: string });
          ref.id = base + modifier;
          ref.pin = { version: candidate.version, format: candidate.format };
          ref.version = candidate.version; ref.format = candidate.format;
          // Old resolved metadata and URLs are not evidence about the replacement.
          delete ref.url; delete ref.checksum; delete ref.width; delete ref.height;
        }
      }
      return data;
    },
  };
}
