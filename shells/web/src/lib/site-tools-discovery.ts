// SPDX-License-Identifier: MPL-2.0
import { presentApis, type AssetRef, type HostV1 } from '@lolly-tools/core/host-v1';
import { buildInputModel } from '../../../../engine/src/inputs.ts';
import { designBrief } from '../../../../engine/src/design-brief.ts';
import { toolSupport } from '../capabilities.ts';
import { getTool } from '../bridge/tool-loader.ts';
import { getInstanceBase } from './instance.ts';
import { catalogRefused } from './catalog-access.ts';
import { getSessionSource } from './session-source.ts';
import { siteToolSources } from './site-tools-context.ts';
import { readSiteProject, type SiteProject } from './site-tools-projects.ts';
import { siteAsset, siteCatalogAssets, siteData, siteInputs, siteMatches, sitePage } from './site-tools-data.ts';
import { registerSiteTools, type SiteToolCall } from './site-tools.ts';

const documentMethods: Record<string, string> = {
  lolly_read_document: 'document.get', lolly_find_layers: 'document.find',
  lolly_read_document_context: 'document.context',
  lolly_apply_document_changes: 'document.apply', lolly_preview_document: 'look', lolly_undo_document_changes: 'history.undo',
};

export function createSiteToolCall(host: HostV1): SiteToolCall {
  return async (name, args) => {
    const sources = siteToolSources(), base = getInstanceBase(), sessionSource = getSessionSource();
    const current = () => {
      if (sources.generation !== siteToolSources().generation || base !== getInstanceBase() || sessionSource !== getSessionSource()) throw new Error('The view or workspace changed. Read context again.');
      if (catalogRefused()) throw new Error('Sign in to this workspace before using site tools.');
    };
    current();
    const project = () => readSiteProject(host, sources.view, current);
    const assetList = async (scope: unknown): Promise<{ assets: AssetRef[]; project?: SiteProject }> => {
      if (scope === 'project') {
        const data = await project(); current();
        if (!data?.id) throw new Error('Open a project or a session in a project first.');
        return { assets: data.assets, project: data };
      }
      if (scope === 'uploads') {
        const api = host.assets as HostV1['assets'] & { _listUserAssets?(): Promise<AssetRef[]> };
        const refs = await api._listUserAssets?.() ?? []; current();
        return { assets: refs.filter(ref => !ref.id.startsWith('user/team/')) };
      }
      if (scope !== 'catalog') throw new Error('Choose project, uploads or catalog as the asset scope.');
      const assets = await siteCatalogAssets(host); current(); return { assets };
    };
    let result: unknown;
    if (documentMethods[name]) {
      if (!sources.editor) throw new Error('Open a Design document to use document actions.');
      result = await sources.editor.request(documentMethods[name], args);
    } else if (name === 'lolly_read_context') {
      const snapshot = await (sources.tool?.host ?? host).tokens?.snapshot?.(); current();
      const data = await project(); current();
      result = { view: sources.view.name,
        capabilities: { project: !!data?.id, document: !!sources.editor && !sources.editor.state().closed, editDocument: !!sources.editor && !sources.editor.state().closed && !sources.editor.state().paused && !sources.tool?.readOnly(),
          documentTransport: 'live-v1', assetScopes: ['project', 'uploads', 'catalog'] },
        browserAgent: sources.editor?.state() ?? null,
        inspectedAsset: sources.asset ? siteAsset(sources.asset, sources.asset.source === 'library' ? 'catalog' : sources.asset.source === 'remote' ? 'project' : 'uploads') : null,
        project: data ? { id: data.id, kind: data.kind, name: data.name, canEdit: data.canEdit } : null,
        tool: sources.tool ? { id: sources.tool.tool.manifest.id, version: sources.tool.tool.manifest.version,
          slot: sources.tool.slot() ?? null, readOnly: sources.tool.readOnly(), inputs: siteData(siteInputs(sources.tool.model(), true), 18_000) } : null,
        designSystem: snapshot ? { system: snapshot.system, version: snapshot.version, selection: snapshot.selection,
          brief: siteData(designBrief(snapshot.document, null, { name: snapshot.system?.label, theme: snapshot.selection.theme ?? undefined }), 20_000) } : null,
      };
    } else if (name === 'lolly_read_project') {
      const data = await project(); current();
      result = data ? { id: data.id, kind: data.kind, name: data.name, canEdit: data.canEdit, ...sitePage(data.items, args) } : { available: false, items: [], total: 0 };
    } else if (name === 'lolly_search_assets') {
      const { assets } = await assetList(args.scope);
      result = sitePage(assets.filter(ref => (!args.type || ref.type === args.type) && siteMatches(args.query, [ref.id, ref.meta?.name, ref.meta?.description, ref.meta?.tags]))
        .map(ref => siteAsset(ref, String(args.scope))), args);
    } else if (name === 'lolly_describe_asset') {
      const { assets, project: data } = await assetList(args.scope);
      const found = assets.find(ref => ref.id === args.id);
      if (!found) throw new Error('This asset is unavailable in the requested scope.');
      const ref = data?.resolve ? await data.resolve(found.id) : found; current();
      const credential = ref.source === 'user' ? await host.assets.credential?.(ref.id) : undefined; current();
      result = { ...siteAsset(ref, String(args.scope)), placement: { id: ref.id, ...(ref.version ? { pin: { version: ref.version, format: ref.format } } : {}) },
        credentials: { storedManifest: credential ? 'present' : 'not-inspected', verification: 'not-checked' } };
    } else {
      const entries = window.__toolIndex?.tools;
      if (name === 'lolly_search_tools') {
        if (!entries) throw new Error('The tool catalog is still loading. Try again after the page has loaded.');
        result = sitePage(entries.filter(entry => (!args.category || entry.category === args.category) && (!args.format || Array.isArray(entry.formats) && entry.formats.includes(args.format))
          && siteMatches(args.query, [entry.id, entry.name, entry.description, entry.en?.name, entry.en?.description, entry.tags]))
          .map(entry => ({ id: entry.id, name: entry.name, description: entry.description, category: entry.category, status: entry.status,
            formats: entry.formats, href: `#/tool/${encodeURIComponent(entry.id)}`,
            availability: toolSupport(entry as Parameters<typeof toolSupport>[0], host.capabilities, presentApis(host)) })), args);
      } else if (name === 'lolly_describe_tool') {
        const active = sources.tool?.tool.manifest.id === args.id ? sources.tool : null;
        if (!active && !entries?.some(entry => entry.id === args.id)) throw new Error('This tool is unavailable in the current catalog.');
        const tool = active?.tool ?? await getTool(String(args.id)); current();
        const model = active?.model() ?? buildInputModel(tool.manifest);
        result = { id: tool.manifest.id, name: tool.manifest.name, version: tool.manifest.version, description: tool.manifest.description,
          status: tool.manifest.status, render: tool.manifest.render, templates: entries?.find(entry => entry.id === tool.manifest.id)?.templates ?? tool.manifest.templates ?? [],
          inputs: siteInputs(model, !!active), availability: toolSupport(tool.manifest, host.capabilities, presentApis(host)),
          href: `#/tool/${encodeURIComponent(tool.manifest.id)}` };
      } else throw new Error('Unknown Lolly site tool.');
    }
    current();
    // SVG previews and document rows use the live protocol's own bounded response contract.
    return documentMethods[name] ? result : siteData(result);
  };
}

export async function installSiteTools(host: HostV1): Promise<void> {
  const dispose = await registerSiteTools(document, createSiteToolCall(host));
  window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
}
