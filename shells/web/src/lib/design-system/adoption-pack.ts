// SPDX-License-Identifier: MPL-2.0
/** Brand-only packages adopt verified material through the local atomic boundary. */
import type { Unzipped } from 'fflate';
import type { BrandImportSummary } from '../../brand-transfer.ts';
import type { DesignSystemRecord } from './registry.ts';
import type { VersionedUserAsset } from '../../bridge/asset-history-types.ts';
import { withDesignSystemIdentity } from '../../../../../engine/src/design-system.ts';
import { TOKEN_EXT } from '../../../../../engine/src/token-ext.ts';
import { readVersionIndex, stripVersionIndex, withVersionIndex, versionAssetId } from '../../../../../engine/src/design-version.ts';
import { readJson, verifyIntegrity } from '../bundle.ts';
import { prepareTokenAdoption, type AdoptionHost } from './adoption-material.ts';

export async function adoptBrandPack(host: AdoptionHost, files: Unzipped, readerVersion: number, opts: { system?: string; create?: DesignSystemRecord; activate?: boolean; validateFile?: (row: VersionedUserAsset) => Promise<void> } = {}): Promise<BrandImportSummary> {
  const manifest = readJson(files, 'manifest.json');
  if (manifest?.format !== 'lolly-brand' || (manifest.minReader ?? manifest.formatVersion ?? 1) > readerVersion) throw new Error('This design system needs a newer Lolly reader.');
  if (!host.brandAdoption) throw new Error('This shell cannot apply a design system safely.');
  const snapshot = await host.brandAdoption.capture({ system: opts.system, create: opts.create, label: manifest.label });
  await verifyIntegrity(files, manifest.integrity, 'This design system');
  const doc = readJson(files, 'tokens.json');
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('This design system has no token document.');
  const rows: VersionedUserAsset[] = [];
  const summary: BrandImportSummary = { tokens: true, fontFamilies: 0, fontFiles: 0, logos: 0, prefs: 0, versions: 0, frozen: 0, versionsSkipped: 0, skipped: 0, failedFonts: 0, packTools: 0, packAssets: 0 };
  const families = new Set<string>();
  const selectedFontIds: string[] = [];
  const types = new Set(['font', 'vector', 'raster', 'video', 'audio', 'lottie', 'model', 'lut', 'palette', 'tokens', 'profile', 'ratecard', 'text', 'data']);
  for (const [path, kind, prefix] of [['fonts.json', 'font', 'user/fonts/'], ['logos.json', 'logo', 'user/logo/'], ['frozen.json', 'frozen', 'user/frozen/']] as const) {
    const declared = readJson(files, path) ?? [];
    if (!Array.isArray(declared) || declared.length > 512) throw new Error('Invalid design-system file inventory.');
    for (const row of declared) {
      if (!row || typeof row.id !== 'string' || !row.id.startsWith(prefix) || typeof row.file !== 'string' || !files[row.file]) throw new Error(`A required file in ${path} is missing.`);
      const type = kind === 'font' ? 'font' : kind === 'logo' ? row.format === 'svg' ? 'vector' : 'raster' : row.type;
      if (!types.has(type)) throw new Error('This design system contains an unsupported file type.');
      rows.push({ id: row.id, type, format: row.format || 'bin', version: typeof row.version === 'string' ? row.version : undefined, blob: new Blob([files[row.file]! as BlobPart], { type: row.mime || 'application/octet-stream' }), meta: row.meta });
      if (kind === 'font') {
        summary.fontFiles++; families.add(String(row.meta?.family || row.id));
        if (row.selected !== false) selectedFontIds.push(row.id);
      }
      else if (kind === 'logo') summary.logos++;
      else summary.frozen++;
    }
  }
  summary.fontFamilies = families.size;
  const localBlob = await host.assets._getBlob(snapshot.record.headId);
  const local = readVersionIndex(localBlob ? JSON.parse(await localBlob.text()) : null);
  const declared = readJson(files, 'versions.json');
  const ledger = declared ? readVersionIndex({ $extensions: { [TOKEN_EXT]: { versions: declared } } }) : readVersionIndex(doc);
  const added = ledger.versions.filter(version => {
    if (local.versions.some(v => v.slug === version.slug)) { summary.versionsSkipped++; return false; }
    const data = readJson(files, `versions/${version.slug}.json`);
    if (!data || typeof data !== 'object') throw new Error(`The published version “${version.slug}” is missing.`);
    rows.push({ id: versionAssetId(snapshot.record.headId, version.slug), type: 'tokens', format: 'json', blob: new Blob([JSON.stringify(stripVersionIndex(data))], { type: 'application/json' }), meta: { name: version.label, kind: 'design-version', slug: version.slug } });
    return true;
  });
  summary.versions = added.length;
  const identified = withDesignSystemIdentity(doc, { id: snapshot.record.id, label: snapshot.record.label });
  const candidateDoc = ledger.versions.length || local.versions.length ? withVersionIndex(identified, { versions: added, active: added.some(v => v.slug === ledger.active) ? ledger.active : null }) : identified;
  const prefs = readJson(files, 'prefs.json');
  const theme = prefs?.theme === 'suse' ? 'brand' : prefs?.theme;
  if (['light', 'dark', 'brand'].includes(theme)) { summary.theme = theme; summary.prefs = 1; }
  const prepared = await prepareTokenAdoption(host, snapshot, candidateDoc, rows, {
    appearance: summary.theme ? { theme: summary.theme } : undefined, retainedVersions: local, selectedFontIds, validateFile: opts.validateFile,
  });
  await host.brandAdoption.commit(prepared.candidate, { activate: opts.activate });
  return summary;
}
