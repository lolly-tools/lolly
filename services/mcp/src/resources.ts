// SPDX-License-Identifier: MPL-2.0
/**
 * MCP resources - read-only brand context so an agent can be on-brand instead of
 * guessing: the catalog, per-tool docs, brand assets, and design tokens.
 * See plans/77-mcp-server.md section 3.2.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { designBrief } from '../../../engine/src/design-brief.ts';
import { briefCatalogSummary, readProfileBriefCatalog, readProfileTokenDocument } from '@lolly-tools/node-shell/design-brief';
import { createTokenSet, pickHeadAssetId } from '@lolly/engine';
import { assetIndex, contentUrl, previewsDir } from './paths.ts';
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
  { uri: 'lolly://design-context', name: 'Design context', description: 'The effective design system with resolved tokens, recorded source observations, coverage and explicit brand rules, plus the brief: approved colour pairings, type per role, logos per surface, icons and their themes, media families, the slide master and machine-checkable house rules. Read-only.', mimeType: 'application/json' },
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
  const idx = assetIndex<AssetIndex>();
  const tokenAsset = headTokensAsset(idx.assets);
  if (!tokenAsset) return { uri, mimeType: 'application/json', text: JSON.stringify({ colors: [], note: 'No tokens asset in catalog.' }) };
  const tokenUrl = tokenAsset.formats[0]!.url;
  const tokenPath = contentUrl(tokenUrl);
  if (!tokenPath) throw new Error(`Tokens asset ${tokenAsset.id}: ${tokenUrl} is not in this profile's catalog.`);
  const doc = JSON.parse(await readFile(tokenPath, 'utf8'));
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
  const idx = assetIndex<AssetIndex>();
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

/** The tool's committed gallery preview: `<id>.svg`, else its first example look. */
async function previewResource(uri: string, id: string): Promise<ResourceContent> {
  for (const file of [`${id}.svg`, `${id}.look0.svg`]) {
    try {
      const text = await readFile(join(previewsDir(), file), 'utf8');
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

/**
 * lolly://design-context: the brief `lolly system context --json` prints, built the same
 * way from the same design system `lolly_check` checks against, the content profile's
 * head tokens asset. The CLI's ladder also tries `--file` and the terminal's active
 * system first; this server reads neither, so its `origin` is always the profile (or null
 * when the profile ships no tokens). The raw token document goes in, as the CLI's does:
 * no render-time theme selection is projected into `tokens.$metadata`.
 */
export function designContextResource(uri = 'lolly://design-context'): ResourceContent {
  const tokens = readProfileTokenDocument();
  const catalog = readProfileBriefCatalog();
  const origin = tokens ? { kind: 'profile' as const, profile: tokens.profile, tokensAsset: tokens.tokensAsset } : null;
  const brief = designBrief(tokens?.doc ?? null, catalog, { ...(tokens?.label ? { name: tokens.label } : {}), theme: undefined });
  const result = { ...brief, origin, catalog: briefCatalogSummary(catalog) };
  return { uri, mimeType: 'application/json', text: JSON.stringify(result, null, 2) };
}

export async function readResource(uri: string): Promise<ResourceContent> {
  if (uri === 'lolly://catalog') {
    const idx = await loadIndex();
    return { uri, mimeType: 'application/json', text: JSON.stringify(idx, null, 2) };
  }
  if (uri === 'lolly://assets') return assetsListing(uri);
  if (uri === 'lolly://tokens') return tokensResource(uri);
  if (uri === 'lolly://design-context') return designContextResource(uri);

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
