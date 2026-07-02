#!/usr/bin/env node
/**
 * Catalog tool-index generator.
 *
 * Run as: npm run build:catalog  (or directly: node scripts/build-catalog-index.js)
 *
 * The tool manifests (`tools/<id>/tool.json`) are the single source of truth.
 * `catalog/tools/index.json` is the denormalised registry the shell fetches at
 * boot — it must never drift from the manifests. This script regenerates it.
 *
 * Each index entry carries only the fields the gallery needs:
 *   id, name, description, version, status, category
 *
 * Existing entry order is preserved — this IS meaningful: the gallery groups by
 * category (ordered by CATEGORY_ORDER) and renders each section in the array's
 * order, so editing it by hand places tools within a section. New tools are appended
 * in directory order. `validate-catalog.js` fails if the committed index ever
 * disagrees with the manifests, so CI catches a forgotten regeneration.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { ToolManifest, Capability } from '@lolly/engine';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/tools/index.json');

/** One entry in catalog/tools/index.json — a denormalised, gallery-facing
 *  projection of a tool manifest. Key order here matches the field emission
 *  order in entryFromManifest, which is the order they land in the committed
 *  JSON (so hand-edits and diffs stay legible). */
export interface CatalogIndexEntry {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: string;
  category?: string;
  capabilities?: Capability[];
  privacy?: 'on-device';
  formats: string[];
  width?: number;
  height?: number;
  exportable: boolean;
  icon?: string;
  preview: string;
  personalized?: boolean;
}

interface CatalogToolIndex {
  version?: string;
  generatedAt?: string;
  tools: CatalogIndexEntry[];
}

export function entryFromManifest(manifest: ToolManifest): CatalogIndexEntry {
  // Output formats the tool supports (tool.json render.formats). Carried so the
  // gallery's tool-info modal can show them per-open without a manifest fetch.
  // (For render.export:false utilities these are the input types they
  // accept, not download formats — the modal gates on `exportable` below.)
  const formats = Array.isArray(manifest.render?.formats) ? manifest.render.formats : [];

  // Whether the tool can be rendered to an exportable file at all. Surfaced so
  // shells can exclude render-only / on-device utilities — which produce
  // output via their own exportFile flow, not the batch render path — without
  // fetching every manifest (/pro batch hides them). Mirrors isExportable() in
  // shells/web/src/pro/render-export.js; drift check in validate-catalog.js.
  const exportable = manifest.render?.export !== false && formats.length > 0;

  // Inline the tool's icon (tools/<id>/icon.svg) so the gallery can show it on
  // every card with no per-card fetch. It uses stroke="currentColor", so the
  // shell themes it via CSS. Read here (not from the manifest) so build:catalog
  // and validate-catalog's drift check stay in lock-step.
  const iconPath = join(ROOT, 'tools', manifest.id, 'icon.svg');
  const icon = existsSync(iconPath)
    ? readFileSync(iconPath, 'utf8').replace(/\s*[\r\n]+\s*/g, '').trim()
    : undefined;

  // Demo preview thumbnail — shown for a tool with no saved session yet, for a
  // fuller gallery on a fresh install. Resolution, highest priority first:
  //   1. A committed authored override: tools/<id>/card.svg (vector) or card.png.
  //   2. Otherwise a BUILD-GENERATED preview at /catalog/previews/<id>.<ext>, where
  //      ext is svg when the tool exports vector (svg in formats), else png — same
  //      choice captureThumbnail makes. Produced by `npm run previews`
  //      (scripts/build-previews.js) into the git-ignored catalog/previews/ dir, so it
  //      need not be committed. The path is derived DETERMINISTICALLY here (not from
  //      disk), so regenerating previews never churns the index; the gallery falls back
  //      to a plain "open to start" tile when the file is absent (dev / not yet built).
  //      Unlike the icon (inlined), the preview PATH is served by the shell's static
  //      handler — a sizeable PNG would bloat the index every shell fetches.
  let preview: string;
  if (existsSync(join(ROOT, 'tools', manifest.id, 'card.svg'))) {
    preview = `/tools/${manifest.id}/card.svg`;
  } else if (existsSync(join(ROOT, 'tools', manifest.id, 'card.png'))) {
    preview = `/tools/${manifest.id}/card.png`;
  } else {
    const ext = exportable && formats.includes('svg') ? 'svg' : 'png';
    preview = `/catalog/previews/${manifest.id}.${ext}`;
  }

  // Whether any input pre-fills from the user profile (bindToProfile). The gallery
  // uses this to scope profile-aware preview regeneration to tools that actually
  // change with the profile — see shells/web/src/personalize-previews.js. Without it
  // the gallery would have to fetch every manifest to find out. Manifest-derived.
  const personalized = (manifest.inputs ?? []).some(i => i.bindToProfile) ? true : undefined;

  return {
    id: manifest.id,
    name: manifest.name,
    ...(manifest.description !== undefined ? { description: manifest.description } : {}),
    version: manifest.version,
    status: manifest.status,
    ...(manifest.category !== undefined ? { category: manifest.category } : {}),
    ...(manifest.capabilities !== undefined ? { capabilities: manifest.capabilities } : {}),
    ...(manifest.privacy !== undefined ? { privacy: manifest.privacy } : {}),
    formats,
    ...(typeof manifest.render?.width === 'number' ? { width: manifest.render.width } : {}),
    ...(typeof manifest.render?.height === 'number' ? { height: manifest.render.height } : {}),
    // NOTE: the original JS also carried a `render.unit` field through to
    // `entry.unit`, but ToolRenderSpec (schemas/tool.schema.json `render`,
    // additionalProperties: false) has no `unit` field — no manifest has ever
    // been able to set it, so that branch was permanently dead. Dropped rather
    // than fabricated.
    exportable,
    ...(icon !== undefined ? { icon } : {}),
    preview,
    ...(personalized !== undefined ? { personalized } : {}),
  };
}

function loadManifests(): Map<string, ToolManifest> {
  const toolsDir = join(ROOT, 'tools');
  const manifests = new Map<string, ToolManifest>();
  for (const dir of readdirSync(toolsDir)) {
    if (!statSync(join(toolsDir, dir)).isDirectory()) continue;
    const p = join(toolsDir, dir, 'tool.json');
    if (!existsSync(p)) continue;
    const parsed: unknown = JSON.parse(readFileSync(p, 'utf8'));
    // JSON trust boundary: tool.json is schema-validated separately
    // (schemas/tool.schema.json via validate-catalog.js); this script only
    // reads fields whose shape it already knows.
    const manifest = parsed as ToolManifest;
    manifests.set(manifest.id, manifest);
  }
  return manifests;
}

function build(): void {
  const manifests = loadManifests();

  // Preserve existing order; append any tools not yet listed.
  const existing: CatalogToolIndex = existsSync(INDEX_PATH)
    ? (JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as CatalogToolIndex)
    : { version: '1', tools: [] };

  const orderedIds = existing.tools.map(t => t.id).filter(id => manifests.has(id));
  for (const id of manifests.keys()) {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }

  const tools = orderedIds.map(id => {
    const manifest = manifests.get(id);
    if (!manifest) throw new Error(`internal: manifest for "${id}" vanished between lookup and use`);
    return entryFromManifest(manifest);
  });

  // Keep generatedAt stable when the tool set is unchanged, so regeneration is
  // idempotent and doesn't produce spurious git churn / false drift signals.
  const unchanged = JSON.stringify(existing.tools) === JSON.stringify(tools);
  const out = {
    version: existing.version ?? '1',
    generatedAt: unchanged && existing.generatedAt ? existing.generatedAt : new Date().toISOString(),
    tools,
  };

  writeFileSync(INDEX_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`✓ Wrote catalog/tools/index.json — ${out.tools.length} tools${unchanged ? ' (unchanged)' : ''}`);
}

// Only regenerate when run directly (`node scripts/build-catalog-index.js`).
// validate-catalog.js imports `entryFromManifest` to share the derivation logic,
// and must NOT trigger this write side effect on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
