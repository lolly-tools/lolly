#!/usr/bin/env node
/**
 * Catalog tool-index generator.
 *
 * Run as: npm run build:catalog  (or directly: node scripts/build-catalog-index.js)
 *
 * The tool manifests (`tools/<id>/tool.json`) are the single source of truth.
 * `catalog/tools/index.json` is a denormalised registry the shell fetches at
 * boot — it must never drift from the manifests. This script regenerates it.
 *
 * Each index entry carries only the fields the gallery needs:
 *   id, name, description, version, status, category
 *
 * Existing entry order is preserved and IS meaningful: the gallery groups by
 * category (ordered by CATEGORY_ORDER) and renders each section in this array's
 * order, so editing it hand-places tools within a section. New tools are appended
 * in directory order. `validate-catalog.js` fails if the committed index ever
 * disagrees with the manifests, so CI catches a forgotten regeneration.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/tools/index.json');

// Fields the index mirrors from each manifest. `capabilities` lets the gallery
// gate tools a shell can't fulfil (e.g. 'capture' in the web PWA) without
// fetching every manifest first.
const INDEX_FIELDS = ['id', 'name', 'description', 'version', 'status', 'category', 'capabilities'];

export function entryFromManifest(manifest) {
  const entry = {};
  for (const f of INDEX_FIELDS) {
    if (manifest[f] !== undefined) entry[f] = manifest[f];
  }
  // Whether the tool can be rendered to an exportable file at all. Surfaced so
  // shells can exclude render-only / on-device utilities — which produce their
  // output via their own exportFile flow, not the batch render path — without
  // fetching every manifest (/pro batch hides them). Mirrors isExportable() in
  // shells/web/src/pro/render-export.js and the drift check in validate-catalog.js.
  entry.exportable = manifest.render?.export !== false && (manifest.render?.formats?.length ?? 0) > 0;
  return entry;
}

function loadManifests() {
  const toolsDir = join(ROOT, 'tools');
  const manifests = new Map(); // id → manifest
  for (const dir of readdirSync(toolsDir)) {
    if (!statSync(join(toolsDir, dir)).isDirectory()) continue;
    const p = join(toolsDir, dir, 'tool.json');
    if (!existsSync(p)) continue;
    const manifest = JSON.parse(readFileSync(p, 'utf8'));
    manifests.set(manifest.id, manifest);
  }
  return manifests;
}

function build() {
  const manifests = loadManifests();

  // Preserve existing order; append any tools not yet listed.
  const existing = existsSync(INDEX_PATH)
    ? JSON.parse(readFileSync(INDEX_PATH, 'utf8'))
    : { version: '1', tools: [] };

  const orderedIds = existing.tools.map(t => t.id).filter(id => manifests.has(id));
  for (const id of manifests.keys()) {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }

  const tools = orderedIds.map(id => entryFromManifest(manifests.get(id)));

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

build();
