// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { LoadedTool } from '../../../../engine/src/loader.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';

export interface SiteToolSource {
  tool: LoadedTool;
  host: HostV1;
  model(): InputModelItem[];
  slot(): string | undefined;
  folder(): string | null;
  readOnly(): boolean;
  current(): boolean;
}
export interface SiteEditorSource {
  request(method: string, params: Record<string, unknown>): Promise<unknown>;
  close(): void;
  state(): { closed: boolean; connected: boolean; paused: boolean };
}
export interface SiteView { name: string; folderId?: string | null; projectId?: string }

let generation = 0;
let tool: SiteToolSource | null = null;
let editor: SiteEditorSource | null = null;
let inspection: (() => AssetRef | null) | null = null;
let view: SiteView = { name: 'loading' };

/** Mount-owned sources let site tools follow the same lifecycle as the ordinary UI. */
export function publishSiteTool(source: SiteToolSource): () => void {
  tool = source;
  return () => { if (tool === source) tool = null; };
}
export function publishSiteEditor(source: SiteEditorSource): () => void {
  editor?.close(); editor = source;
  return () => { source.close(); if (editor === source) editor = null; };
}
export function publishSiteInspection(source: () => AssetRef | null): () => void {
  inspection = source;
  return () => { if (inspection === source) inspection = null; };
}
export function siteToolSources() {
  return { generation, view, tool: tool?.current() ? tool : null, editor, asset: inspection?.() ?? null };
}
/** Called after navigation is accepted, before an outgoing view can start teardown. */
export function clearSiteToolSources(next: SiteView = { name: 'loading' }): void {
  generation++;
  view = next;
  editor?.close(); editor = null; tool = null; inspection = null;
}
