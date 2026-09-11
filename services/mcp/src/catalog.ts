// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog access: the generated tool index (cheap, for list_tools) and the
 * per-tool manifest (loaded via the engine's loadTool, for describe/render).
 *
 * The index carries enough to list tools (id/name/formats/dims/status/…) but
 * not input specs. Those live only in each tool.json, so describe/render call
 * loadToolCached(). See plans/77-mcp-server.md section 7.
 */

import { readFile } from 'node:fs/promises';
import { loadTool } from '@lolly/engine';
import { CATALOG_INDEX, fetchToolFile } from './paths.ts';

export interface CatalogTemplatePreset {
  id: string;
  name: string;
  description?: string;
}

export interface CatalogTemplate {
  id: string;
  name: string;
  category?: string;
  description?: string;
  thumb?: string;
  presets?: CatalogTemplatePreset[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: string;
  category?: string;
  capabilities?: string[];
  privacy?: string;
  formats: string[];
  width?: number;
  height?: number;
  unit?: string;
  exportable?: boolean;
  icon?: string;
  preview?: string;
  personalized?: boolean;
  featured?: unknown;
  tags?: string[];
  templates?: CatalogTemplate[];
}

export interface CatalogIndex {
  version: string;
  generatedAt: string;
  tools: CatalogEntry[];
}

export type LoadedTool = Awaited<ReturnType<typeof loadTool>>;

let indexCache: Promise<CatalogIndex> | null = null;

/** The generated tool registry. Cached for the process (tools are static in prod). */
export function loadIndex(): Promise<CatalogIndex> {
  return (indexCache ??= readFile(CATALOG_INDEX, 'utf8').then(s => JSON.parse(s) as CatalogIndex));
}

const toolCache = new Map<string, Promise<LoadedTool>>();

/** Load + validate a tool's manifest/template/hooks, cached by id. */
export function loadToolCached(id: string): Promise<LoadedTool> {
  let p = toolCache.get(id);
  if (!p) {
    p = loadTool(id, fetchToolFile);
    toolCache.set(id, p);
    p.catch(() => toolCache.delete(id)); // don't cache failures
  }
  return p;
}

export interface ListFilter {
  q?: string;
  status?: string;
  category?: string;
  format?: string;
  capability?: string;
}

/** Filter the catalog for list_tools. All filters AND together. */
export async function listTools(filter: ListFilter = {}): Promise<CatalogEntry[]> {
  const { tools } = await loadIndex();
  const q = filter.q?.trim().toLowerCase();
  return tools.filter(t => {
    if (filter.status && t.status !== filter.status) return false;
    if (filter.category && t.category !== filter.category) return false;
    if (filter.format && !(t.formats ?? []).map(f => f.toLowerCase()).includes(filter.format.toLowerCase())) return false;
    if (filter.capability && !(t.capabilities ?? []).includes(filter.capability)) return false;
    if (q) {
      // Tags are in the haystack because they carry the words users (and agents)
      // reach for that the prose does not: chart's description says "3-D bars" but its
      // tags say "3d", "bar", "graph". Tokens AND together so a multi-word query
      // like "bar chart" matches across fields; a phrase that matched as one
      // substring before still matches token by token.
      const hay = `${t.id} ${t.name} ${t.description ?? ''} ${t.category ?? ''} ${(t.formats ?? []).join(' ')} ${(t.tags ?? []).join(' ')}`.toLowerCase();
      if (!q.split(/\s+/).every(tok => hay.includes(tok))) return false;
    }
    return true;
  });
}

const TEMPLATE_ID_RE = /^[a-z0-9-]+$/;

/** Metadata-only template listing from the generated catalog. */
export async function listToolTemplates(toolId: string): Promise<CatalogTemplate[]> {
  const entry = (await loadIndex()).tools.find((tool) => tool.id === toolId);
  return entry?.templates ?? [];
}

/**
 * Resolve a built-in template's heavy values file on demand. Explicit inputs are
 * merged by the caller so one agent path can share this base across validate,
 * compile, inspect, build-url and render.
 */
export async function loadTemplateSeed(
  toolId: string,
  templateId: string,
  presetId?: string,
): Promise<{ inputs: Record<string, unknown>; template: CatalogTemplate; preset?: CatalogTemplatePreset }> {
  if (!TEMPLATE_ID_RE.test(templateId)) throw new Error(`Invalid templateId: ${templateId}.`);
  if (presetId && !TEMPLATE_ID_RE.test(presetId)) throw new Error(`Invalid presetId: ${presetId}.`);
  const template = (await listToolTemplates(toolId)).find((item) => item.id === templateId);
  if (!template) throw new Error(`Template not found: ${toolId}/${templateId}. Call lolly_describe_tool to list templates.`);
  const preset = presetId ? template.presets?.find((item) => item.id === presetId) : undefined;
  if (presetId && !preset) throw new Error(`Preset not found: ${toolId}/${templateId}/${presetId}. Call lolly_describe_tool to list presets.`);

  let raw: unknown;
  try {
    raw = JSON.parse(await fetchToolFile(`${toolId}/templates/${templateId}.json`));
  } catch (error) {
    throw new Error(`Template could not be read: ${toolId}/${templateId} (${(error as Error).message}).`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Template is malformed: ${toolId}/${templateId}.`);
  const file = raw as { values?: unknown; presets?: unknown };
  if (!file.values || typeof file.values !== 'object' || Array.isArray(file.values)) throw new Error(`Template has no values object: ${toolId}/${templateId}.`);
  const overlay = presetId && Array.isArray(file.presets)
    ? file.presets.find((item): item is { id: string; values?: unknown } => Boolean(item && typeof item === 'object' && (item as { id?: unknown }).id === presetId))?.values
    : undefined;
  if (presetId && (!overlay || typeof overlay !== 'object' || Array.isArray(overlay))) throw new Error(`Preset has no values object: ${toolId}/${templateId}/${presetId}.`);
  return {
    inputs: { ...(file.values as Record<string, unknown>), ...(overlay as Record<string, unknown> | undefined) },
    template,
    ...(preset ? { preset } : {}),
  };
}
