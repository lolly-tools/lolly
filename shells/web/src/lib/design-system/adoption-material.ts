// SPDX-License-Identifier: MPL-2.0
/** Build a complete, isolated local material candidate before its atomic commit. */
import { brandResourceAssetIds } from '../../../../../engine/src/brand-resources.ts';
import { collectAssetTokens, readVersionIndex, withVersionIndex, docChecksum, frozenAssetId, sha256Hex } from '../../../../../engine/src/design-version.ts';
import type { VersionIndex } from '../../../../../engine/src/design-version.ts';
import type { AdoptionSnapshot, BrandAdoptionAPI } from '../../bridge/brand-adoption.ts';
import type { VersionedUserAsset } from '../../bridge/asset-history-types.ts';
import { rewriteAssetRefs } from './namespace.ts';
import { validateAdoptionFile } from './adoption-validate.ts';

export interface AdoptionHost {
  brandAdoption?: BrandAdoptionAPI;
  assets: {
    _getBlob(id: string): Promise<Blob | null>;
    get(id: string): Promise<{ type: VersionedUserAsset['type']; format?: string; meta?: Record<string, unknown> }>;
  };
}

export function adoptionOf(host: object): BrandAdoptionAPI | undefined {
  return (host as { brandAdoption?: BrandAdoptionAPI }).brandAdoption;
}

export async function prepareTokenAdoption(
  host: AdoptionHost, snapshot: AdoptionSnapshot, document: unknown,
  incoming: VersionedUserAsset[] = [],
  options: { labelIfNew?: string; appearance?: { theme?: 'light' | 'dark' | 'brand' }; retainedVersions?: VersionIndex; selectedFontIds?: string[]; validateFile?: (row: VersionedUserAsset) => Promise<void> } = {},
) {
  if (!host.brandAdoption) throw new Error('This shell cannot apply a design system safely. Update Lolly and try again.');
  const doc = structuredClone(document);
  const previousBlob = options.retainedVersions ? null : await host.assets._getBlob(snapshot.record.headId);
  const retained = options.retainedVersions ?? readVersionIndex(previousBlob ? JSON.parse(await previousBlob.text()) : null);
  const imported = readVersionIndex(doc);
  for (const entry of imported.versions) {
    if (!retained.versions.some(v => v.slug === entry.slug) && !incoming.some(row => row.type === 'tokens' && row.meta?.slug === entry.slug)) {
      throw new Error('This token file lists published versions without their files. Import the .lolly package instead.');
    }
  }
  const materialDoc = imported.versions.length ? withVersionIndex(doc, { ...imported, versions: imported.versions.filter(entry => !retained.versions.some(v => v.slug === entry.slug)) }) : doc;
  const resources = new Map(incoming.map(row => [row.id, structuredClone(row)]));
  if (resources.size !== incoming.length || resources.size > 512) throw new Error('This design system has duplicate or excessive resources.');
  const documents: unknown[] = [materialDoc];
  for (const row of incoming) if (row.type === 'tokens') {
    if (!row.blob || row.blob.size > 8 * 1024 * 1024) throw new Error('A token version is missing or too large.');
    documents.push(JSON.parse(await row.blob.text()));
  }
  const required = new Set<string>();
  for (const source of documents) {
    for (const ref of collectAssetTokens(source)) required.add(ref.id);
    for (const id of brandResourceAssetIds(source)) required.add(id);
    for (const version of readVersionIndex(source).versions) for (const pin of version.assets ?? []) required.add(pin.frozenId ?? pin.id);
  }
  for (const id of required) {
    if (required.size > 512) throw new Error('This design system has too many resource references.');
    if (resources.has(id)) continue;
    const [blob, ref] = await Promise.all([host.assets._getBlob(id), host.assets.get(id)]);
    if (!blob || !ref) throw new Error(`The required file “${id}” is unavailable. Add the file and review again.`);
    resources.set(id, { id, type: ref.type, format: ref.format || 'bin', blob, meta: ref.meta });
  }
  for (const source of documents) for (const entry of readVersionIndex(source).versions) for (const pin of entry.assets ?? []) {
    const row = resources.get(pin.frozenId ?? pin.id);
    if (!row?.blob || await sha256Hex(new Uint8Array(await row.blob.arrayBuffer())) !== pin.sha256) throw new Error(`A file in the published version “${entry.label}” does not match its recorded bytes.`);
  }
  const revision = crypto.randomUUID();
  const mapping = new Map<string, string>();
  let index = 0;
  for (const row of resources.values()) {
    const id = row.id.startsWith('user/frozen/') && row.blob ? frozenAssetId(await sha256Hex(new Uint8Array(await row.blob.arrayBuffer()))) : row.type === 'tokens' ? row.id : row.type === 'font'
      ? `${snapshot.record.ns}fonts/adopt-${revision}/${index++}`
      : `${snapshot.record.ns}logo/adopt-${revision}/${index++}`;
    mapping.set(row.id, id);
  }
  const rewrite = (source: unknown): unknown => {
    const result = rewriteAssetRefs(source, id => mapping.get(id) ?? id);
    const ledger = readVersionIndex(result);
    if (!ledger.versions.length) return result;
    return withVersionIndex(result, { ...ledger, versions: ledger.versions.map(v => ({ ...v, assets: v.assets?.map(pin => ({
      ...pin, id: mapping.get(pin.id) ?? pin.id,
      version: resources.get(pin.frozenId ?? pin.id)?.version || revision,
      ...(pin.frozenId ? { frozenId: mapping.get(pin.frozenId) ?? pin.frozenId } : {}),
    })) })) });
  };
  const staged: VersionedUserAsset[] = [];
  const versionChecksums = new Map<string, string>();
  for (const row of resources.values()) {
    if (!row.blob) throw new Error(`The required file “${row.id}” has no bytes.`);
    await (options.validateFile ?? validateAdoptionFile)(row);
    const payload = row.type === 'tokens' ? rewrite(JSON.parse(await row.blob.text())) : null;
    if (payload && typeof row.meta?.slug === 'string') versionChecksums.set(row.meta.slug, await docChecksum(payload));
    staged.push({ ...row, id: mapping.get(row.id)!, version: row.version || revision,
      blob: payload ? new Blob([JSON.stringify(payload)], { type: 'application/json' }) : row.blob,
      meta: { ...row.meta, adoption: revision },
    });
  }
  let candidateDoc = rewrite(materialDoc);
  const mapped = readVersionIndex(candidateDoc);
  if (retained.versions.length || mapped.versions.length) {
    candidateDoc = withVersionIndex(candidateDoc, { active: retained.active ?? mapped.active, versions: [...retained.versions, ...mapped.versions.map(v => ({ ...v, checksum: versionChecksums.get(v.slug) ?? v.checksum }))].sort((a, b) => a.date.localeCompare(b.date)) });
  }
  const fonts = options.selectedFontIds
    ? options.selectedFontIds.map(id => mapping.get(id) ?? id)
    : staged.filter(row => row.type === 'font').map(row => row.id);
  const candidate = await host.brandAdoption.prepare(snapshot, {
    doc: candidateDoc, assets: staged, labelIfNew: options.labelIfNew, appearance: options.appearance,
    ...(fonts.length || options.selectedFontIds ? { importedFonts: fonts } : {}),
  });
  return { candidate, doc: candidateDoc };
}
