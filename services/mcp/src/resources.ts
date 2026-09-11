// SPDX-License-Identifier: MPL-2.0
/**
 * MCP resources - read-only brand context so an agent can be on-brand instead of
 * guessing: the catalog, per-tool docs, brand assets, and design tokens.
 * See plans/77-mcp-server.md section 3.2.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTokenSet, pickHeadAssetId } from '@lolly/engine';
import { ASSET_INDEX, REPO_ROOT } from './paths.ts';
import { loadIndex, loadToolCached } from './catalog.ts';
import { toolInputSchema } from './schema.ts';
import { withHost } from './host.ts';

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export const RESOURCES = [
  { uri: 'lolly://catalog', name: 'Tool catalog', description: 'The full generated Lolly tool index.', mimeType: 'application/json' },
  { uri: 'lolly://assets', name: 'Brand asset listing', description: 'Every catalog asset id with its type, name, tags and formats - the ids lolly://asset/{id} resolves.', mimeType: 'application/json' },
  { uri: 'lolly://tokens', name: 'Brand design tokens', description: "On-brand colour swatches (DTCG) with names and CMYK, from the design system's edit head - never one of its published versions.", mimeType: 'application/json' },
];

export const RESOURCE_TEMPLATES = [
  { uriTemplate: 'lolly://tool/{id}', name: 'Tool details', description: 'A tool manifest summary + input JSON Schema + examples.', mimeType: 'application/json' },
  { uriTemplate: 'lolly://tool/{id}/preview', name: 'Tool preview', description: "The tool's committed catalog preview (SVG), where one exists.", mimeType: 'image/svg+xml' },
  { uriTemplate: 'lolly://asset/{id}', name: 'Brand asset', description: 'A catalog asset (logo, palette, font) resolved to bytes.', mimeType: 'application/octet-stream' },
];

interface AssetIndex {
  assets: { id: string; type: string; name?: string; tags?: string[]; formats: { format: string; url: string }[] }[];
}

/**
 * The catalog's HEAD design system: the one `type:'tokens'` asset that is not a
 * published version of another (plans/97 section 6a).
 *
 * A version ships as a child id (`<head>/<slug>`), so the old `.find(a => a.type
 * === 'tokens')` could hand an agent a frozen snapshot as "the brand" purely on
 * index order. The rule comes from the engine, not from here: the web bridge and
 * the CLI apply the same predicate, and an agent that reads different tokens from
 * the ones a render uses is worse than one that reads none.
 *
 * Exported for the MCP suite - the fixture this needs is a two-asset index, which
 * the real catalog (one tokens asset, and thus byte-identical to the old `.find`)
 * cannot supply.
 */
export function headTokensAsset<T extends { id: string; type: string }>(assets: readonly T[]): T | undefined {
  const tokens = assets.filter(a => a.type === 'tokens');
  const headId = pickHeadAssetId(tokens.map(a => a.id));
  return tokens.find(a => a.id === headId);
}

async function tokensResource(uri: string): Promise<ResourceContent> {
  const idx = JSON.parse(await readFile(ASSET_INDEX, 'utf8')) as AssetIndex;
  const tokenAsset = headTokensAsset(idx.assets);
  if (!tokenAsset) return { uri, mimeType: 'application/json', text: JSON.stringify({ colors: [], note: 'No tokens asset in catalog.' }) };
  const doc = JSON.parse(await readFile(join(REPO_ROOT, tokenAsset.formats[0]!.url.replace(/^\//, '')), 'utf8'));
  const set = createTokenSet(doc);
  return { uri, mimeType: 'application/json', text: JSON.stringify({ colors: set.colors() }, null, 2) };
}

function parseDataUrl(url: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  return { mime: m[1] || 'application/octet-stream', base64: m[2] ? m[3]! : Buffer.from(decodeURIComponent(m[3]!)).toString('base64') };
}

/** The catalog listing an agent needs to pick a REAL asset id instead of hallucinating one. */
async function assetsListing(uri: string): Promise<ResourceContent> {
  const idx = JSON.parse(await readFile(ASSET_INDEX, 'utf8')) as AssetIndex;
  // Same listing shape host.assets.query resolves (id/type/name/tags), minus bytes;
  // fetch an individual asset via lolly://asset/{id}.
  const assets = idx.assets.map(a => ({
    id: a.id, type: a.type,
    ...(a.name ? { name: a.name } : {}),
    tags: a.tags ?? [],
    formats: (a.formats ?? []).map(f => f.format),
  }));
  return { uri, mimeType: 'application/json', text: JSON.stringify({ count: assets.length, assets }, null, 2) };
}

const PREVIEWS_DIR = join(REPO_ROOT, 'catalog', 'previews');

/** The tool's committed gallery preview: `<id>.svg`, else its first example look. */
async function previewResource(uri: string, id: string): Promise<ResourceContent> {
  for (const file of [`${id}.svg`, `${id}.look0.svg`]) {
    try {
      const text = await readFile(join(PREVIEWS_DIR, file), 'utf8');
      return { uri, mimeType: 'image/svg+xml', text };
    } catch { /* try the next candidate */ }
  }
  throw new Error(`No SVG preview for tool: ${id}`);
}

async function assetResource(uri: string, id: string): Promise<ResourceContent> {
  return withHost({}, async (_dom, host) => {
    const ref = await host.assets.get(id);
    const parsed = parseDataUrl(ref.url);
    if (!parsed) return { uri, mimeType: 'application/json', text: JSON.stringify({ id: ref.id, type: ref.type, format: ref.format, meta: ref.meta }) };
    if (parsed.mime.startsWith('image/svg') || parsed.mime.startsWith('text/') || parsed.mime === 'application/json') {
      return { uri, mimeType: parsed.mime, text: Buffer.from(parsed.base64, 'base64').toString('utf8') };
    }
    return { uri, mimeType: parsed.mime, blob: parsed.base64 };
  });
}

export async function readResource(uri: string): Promise<ResourceContent> {
  if (uri === 'lolly://catalog') {
    const idx = await loadIndex();
    return { uri, mimeType: 'application/json', text: JSON.stringify(idx, null, 2) };
  }
  if (uri === 'lolly://assets') return assetsListing(uri);
  if (uri === 'lolly://tokens') return tokensResource(uri);

  const previewMatch = /^lolly:\/\/tool\/([a-z0-9-]+)\/preview$/.exec(uri);
  if (previewMatch) return previewResource(uri, previewMatch[1]!);

  const toolMatch = /^lolly:\/\/tool\/([a-z0-9-]+)$/.exec(uri);
  if (toolMatch) {
    const tool = await loadToolCached(toolMatch[1]!).catch(() => null);
    if (!tool) throw new Error(`Tool not found: ${toolMatch[1]}`);
    const m = tool.manifest;
    return {
      uri, mimeType: 'application/json',
      text: JSON.stringify({ id: m.id, name: m.name, description: m.description, status: m.status, formats: m.render.formats, width: m.render.width, height: m.render.height, inputSchema: toolInputSchema(m) }, null, 2),
    };
  }

  const assetMatch = /^lolly:\/\/asset\/(.+)$/.exec(uri);
  if (assetMatch) return assetResource(uri, decodeURIComponent(assetMatch[1]!));

  throw new Error(`Unknown resource: ${uri}`);
}
