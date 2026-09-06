// SPDX-License-Identifier: MPL-2.0
/** A brand plus an explicit collection. The nested payload reuses .lolly's
 * integrity, asset closure, sanitisation and collision-safe asset ingest. */
import { strToU8, type Unzipped } from 'fflate';
import { exportBrandPack, type BrandTransferHost } from '../../brand-transfer.ts';
import { buildLollyFile, readLollyFile, ingestLollyFile, type LollyFileContents, type LollyToolBundle } from '../lolly-pack.ts';
import { buildIntegrity, readJson, README_NAME, type BundleEntry } from '../bundle.ts';
import { zipAsync } from '../zip.ts';
import type { BeamPackHost, BeamAssetRecord } from '../beam-pack.ts';
import { designMaterialOf } from '@lolly/engine';
import type { AssetRef } from '@lolly-tools/core/host-v1';

export type BrandPackageHost = BrandTransferHost & BeamPackHost & {
  assets: {
    get(id: string): Promise<AssetRef>;
    _listUserAssets(): Promise<AssetRef[]>;
    query(): Promise<AssetRef[]>;
  };
  export: { download(blob: Blob, filename: string): Promise<unknown> };
};
export type ContentKind = 'sessions' | 'assets' | 'tools';
export interface ContentChoice { id: string; name: string; detail: string; kind: ContentKind }
export interface BrandSelection { sessions: string[]; assets: string[]; tools: string[] }
export const emptyBrandSelection = (): BrandSelection => ({ sessions: [], assets: [], tools: [] });
const nameOf = (value: unknown, fallback: string): string => typeof value === 'string' && value.trim() ? value : fallback;

export async function listBrandContent(host: BrandPackageHost): Promise<ContentChoice[]> {
  const [sessions, uploads, catalog] = await Promise.all([
    host.state.list(), host.assets._listUserAssets(), host.assets.query(),
  ]);
  // query() returns metadata/static URLs. get() would fetch every full-sized
  // catalogue file merely to display this checklist.
  const assets = [...uploads, ...catalog];
  const unique = new Map(assets.filter(r => !designMaterialOf(r.id) && r.type !== 'tokens' && r.type !== 'font').map(r => [r.id, r]));
  const tools = (window as unknown as { __toolIndex?: { tools?: Array<{ id: string; name?: string; category?: string }> } }).__toolIndex?.tools ?? [];
  return [
    ...sessions.map(s => ({ kind: 'sessions' as const, id: s.slot, name: nameOf(s.label, nameOf(s.toolId, s.slot)), detail: nameOf(s.toolId, 'Saved session') })),
    ...[...unique.values()].map(a => ({ kind: 'assets' as const, id: a.id, name: nameOf(a.meta?.name, a.id), detail: `${a.source === 'user' ? 'Upload' : 'Catalogue'} · ${a.format || a.type}` })),
    ...tools.map(tool => ({ kind: 'tools' as const, id: tool.id, name: tool.name || tool.id, detail: tool.category || 'Tool' })),
  ];
}

interface PackedSession { toolId: string; label: string; thumb: string | null; data: unknown }
interface Collection { sessions: PackedSession[]; assets: Array<{ id: string; source: string }> }
interface Receipt { version: 1; payload: string; tools: string[] }
export interface PreparedBrandContent { payload: LollyFileContents; tools: LollyFileContents[] }

export async function buildBrandPackage(
  host: BrandPackageHost, system: string, selection: BrandSelection,
  opts: { resolveTool?: (id: string) => Promise<LollyToolBundle | null>; progress?: (label: string) => void } = {},
): Promise<{ blob: Blob; filename: string; references: number }> {
  opts.progress?.('Preparing the brand…');
  const record = await host.designSystems?.get(system);
  if (!record) throw new Error('This design system is no longer on this device.');
  const brand = await exportBrandPack({ host, storage: {
    getItem: key => key === 'theme' ? record.appearance?.theme ?? 'brand' : null,
    setItem() {},
  } }, { system });
  if (!brand.summary.tokens) throw new Error('This design system has no readable tokens to export.');
  if (!selection.sessions.length && !selection.assets.length && !selection.tools.length) return { ...brand, references: 0 };

  const sessions: PackedSession[] = [];
  const rows = await host.state.list();
  for (const slot of new Set(selection.sessions)) {
    const row = rows.find(s => s.slot === slot);
    const data = await host.state.load(slot);
    if (typeof row?.toolId !== 'string' || !row.toolId || !data) throw new Error(`The selected session “${row?.label || slot}” is no longer available.`);
    opts.progress?.(`Adding ${row.label || row.toolId}…`);
    sessions.push({ toolId: row.toolId, label: nameOf(row.label, row.toolId), thumb: row.thumb ?? null, data });
  }
  const selected = new Set(selection.assets);
  // Selecting a catalogue item explicitly authorises carrying that file. Merely
  // referencing licensed material from a session retains the existing share gate.
  const resolveLibrary = async (id: string) => {
    const [blob, ref] = await Promise.all([host.assets._getBlob(id), host.assets.get(id).catch(() => null)]);
    if (!blob || !ref) return null;
    const meta = ref.meta ?? {};
    const licensed = !selected.has(id) && (meta.brandLock === true || /proprietary|all-rights-reserved|licenseref|premiumbeat/i.test(String(meta.license ?? '')));
    return { bytes: blob, mime: blob.type, type: ref.type, format: ref.format, label: nameOf(meta.name, id), licensed, meta };
  };
  const userAssets = await host.assets._exportUserAssets() as BeamAssetRecord[];
  for (const id of selected) {
    const exists = userAssets.some(a => a.id === id && a.blob) || !!(await host.assets._getBlob(id));
    if (!exists) throw new Error(`The selected file “${id}” is no longer available.`);
  }
  const collection: Collection = { sessions, assets: [...selected].map(id => ({ id, source: id.startsWith('user/') ? 'user' : 'library' })) };
  const payload = await buildLollyFile({ session: collection, toolId: 'brand-collection', name: record.label, userAssets, resolveLibrary });
  for (const id of selected) {
    if (!payload.manifest.assets.some(asset => asset.id === id && asset.kind === 'asset')) {
      throw new Error(`The selected file “${id}” could not be packaged. Deselect it or try again.`);
    }
  }
  const { unzipBrandBytes } = await import('../../brand-transfer.ts');
  const original = await unzipBrandBytes(await brand.blob.arrayBuffer());
  const entries: Record<string, BundleEntry> = { ...original };
  delete entries['manifest.json'];
  const payloadPath = 'content/collection.lolly';
  entries[payloadPath] = [new Uint8Array(await payload.blob.arrayBuffer()), { level: 0 }];
  const toolPaths: string[] = [];
  const resolveTool = opts.resolveTool ?? (async (id: string) => {
    const [{ getTool }, { resolveToolBundle }] = await Promise.all([import('../../bridge/tool-loader.ts'), import('../tool-bundle.ts')]);
    return resolveToolBundle(id, (await getTool(id)).manifest);
  });
  for (const id of new Set(selection.tools)) {
    opts.progress?.(`Adding ${id}…`);
    const tool = await resolveTool(id);
    if (!tool) throw new Error(`The files for “${id}” could not be read. Deselect it or try again.`);
    const packed = await buildLollyFile({ session: null, toolId: id, name: id, userAssets: [], tool });
    const path = `content/tool-${toolPaths.length}.lolly`;
    entries[path] = [new Uint8Array(await packed.blob.arrayBuffer()), { level: 0 }];
    toolPaths.push(path);
  }
  const receipt: Receipt = { version: 1, payload: payloadPath, tools: toolPaths };
  entries['content.json'] = strToU8(JSON.stringify(receipt));
  const manifest = readJson(original, 'manifest.json');
  const counts = { sessions: sessions.length, assets: selected.size, tools: toolPaths.length, references: payload.summary.byReferenceCount };
  entries[README_NAME] = strToU8(new TextDecoder().decode(original[README_NAME]) + `\nSelected local content: ${counts.sessions} sessions, ${counts.assets} files, ${counts.tools} tools.\nRequired session assets travel inside content/collection.lolly. ${counts.references} assets remain external references.\nImport this .lolly in Lolly to add the brand and selected content. Existing sessions are never replaced; tools retain their normal trust prompt.\n`);
  const integrity = await buildIntegrity(entries);
  const zip = await zipAsync({ 'manifest.json': strToU8(JSON.stringify({ ...manifest, formatVersion: 4, minReader: 2, contents: counts, integrity })), ...entries });
  return { blob: new Blob([zip as BlobPart], { type: brand.blob.type }), filename: brand.filename, references: counts.references };
}

/** Verify every nested payload before the brand importer writes anything. */
export async function readBrandContent(files: Unzipped): Promise<PreparedBrandContent | null> {
  if (!files['content.json']) return null;
  const receipt = readJson(files, 'content.json') as Receipt;
  if (receipt?.version !== 1 || receipt.payload !== 'content/collection.lolly' || !Array.isArray(receipt.tools)) throw new Error('This brand collection is not supported.');
  if (receipt.tools.length > 256) throw new Error('This brand collection contains too many tools.');
  const paths = [receipt.payload, ...receipt.tools];
  if (new Set(paths).size !== paths.length) throw new Error('This brand collection repeats a payload.');
  const parsed: LollyFileContents[] = [];
  for (const path of paths) {
    if (typeof path !== 'string' || !/^content\/[a-z0-9-]+\.lolly$/.test(path) || !files[path]) throw new Error('A brand collection file is missing.');
    parsed.push(await readLollyFile(files[path]!));
  }
  const collection = parsed[0]!.session as Collection;
  if (!collection || !Array.isArray(collection.sessions) || collection.sessions.length > 10000 || !Array.isArray(collection.assets)) throw new Error('Invalid brand collection sessions.');
  for (const s of collection.sessions) if (!s || typeof s.toolId !== 'string' || !s.toolId || !s.data || typeof s.data !== 'object') throw new Error('Invalid saved session in this brand collection.');
  for (const tool of parsed.slice(1)) if (!tool.manifest.bundledTool || tool.session !== null) throw new Error('Invalid tool in this brand collection.');
  return { payload: parsed[0]!, tools: parsed.slice(1) };
}

export async function importBrandContent(
  content: PreparedBrandContent, host: BeamPackHost,
  provision?: (tool: LollyFileContents) => Promise<boolean>,
): Promise<{ sessions: number; assets: number; tools: number; skippedTools: number }> {
  const result = { sessions: 0, assets: 0, tools: 0, skippedTools: 0 };
  for (const tool of content.tools) {
    const accepted = provision ? await provision(tool) : await (async () => {
      const [{ provisionLollyTool }, lp] = await Promise.all([import('../drop-router.ts'), import('../lolly-pack.ts')]);
      return provisionLollyTool(tool, lp);
    })();
    if (accepted) result.tools++; else result.skippedTools++;
  }
  const imported = await ingestLollyFile(content.payload, host, { saveSession: false });
  result.assets = imported.imported + imported.deduped;
  const collection = imported.session as Collection;
  const taken = new Set((await host.state.list()).map(s => s.slot));
  const written: string[] = [];
  try { for (const s of collection.sessions) {
    let slot = `${s.toolId}:${Date.now()}`;
    while (taken.has(slot)) slot += '-copy';
    taken.add(slot);
    await host.state.save(slot, { ...(s.data as object), __toolId: s.toolId, __label: s.label }, s.thumb);
    written.push(slot);
    result.sessions++;
  } } catch (error) {
    await Promise.allSettled(written.map(slot => host.state.delete?.(slot)));
    throw error;
  }
  return result;
}
