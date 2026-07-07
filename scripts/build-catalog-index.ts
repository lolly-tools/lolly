#!/usr/bin/env node
/**
 * Catalog tool-index generator.
 *
 * Run as: npm run build:catalog  (or directly: node scripts/build-catalog-index.ts)
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
import { fileURLToPath, pathToFileURL } from 'node:url';

// Tool manifests and index entries are dynamic JSON; full typing is
// disproportionate, so they're loosely typed and accessed with localized casts.
type Manifest = Record<string, any>;
interface IndexFile {
  version?: string;
  generatedAt?: string;
  tools: Array<Record<string, unknown>>;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/tools/index.json');

// Fields the index mirrors from each manifest. `capabilities` lets the gallery
// gate tools a shell can't fulfil (e.g. 'capture' in the web PWA) without
// fetching every manifest first. `privacy` surfaces the on-device note in the
// gallery's tool-info modal.
const INDEX_FIELDS = ['id', 'name', 'description', 'version', 'status', 'category', 'capabilities', 'privacy', 'new', 'listed'];

export function entryFromManifest(manifest: Manifest): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const f of INDEX_FIELDS) {
    if (manifest[f] !== undefined) entry[f] = manifest[f];
  }
  // Output formats the tool supports (tool.json render.formats). Carried so the
  // gallery's tool-info modal can list them with no per-open manifest fetch.
  // (For render.export:false utilities this is the set of input types they
  // accept, not download formats — the modal gates on `exportable` below.)
  entry.formats = Array.isArray(manifest.render?.formats) ? manifest.render.formats : [];
  // The tool's intended output size — render.width/height in render.unit (px when
  // unset). Carried so the gallery can show "what you'll get" (size + format) on the
  // card and in the info modal with no per-tool manifest fetch. `unit` is included only
  // when it's a physical unit (mm/cm/in/pt); px is the default and stays implicit.
  if (typeof manifest.render?.width === 'number') entry.width = manifest.render.width;
  if (typeof manifest.render?.height === 'number') entry.height = manifest.render.height;
  if (manifest.render?.unit && manifest.render.unit !== 'px') entry.unit = manifest.render.unit;
  // Whether the tool can be rendered to an exportable file at all. Surfaced so
  // shells can exclude render-only / on-device utilities — which produce their
  // output via their own exportFile flow, not the batch render path — without
  // fetching every manifest (/pro batch hides them). Mirrors isExportable() in
  // shells/web/src/pro/render-export.js and the drift check in validate-catalog.js.
  entry.exportable = manifest.render?.export !== false && (manifest.render?.formats?.length ?? 0) > 0;
  // Inline the tool's icon (tools/<id>/icon.svg) so the gallery can show it on
  // every card with no per-card fetch. It uses stroke="currentColor", so the
  // shell themes it via CSS. Read here (not from the manifest) so build:catalog
  // and validate-catalog's drift check stay in lock-step.
  const iconPath = join(ROOT, 'tools', manifest.id, 'icon.svg');
  if (existsSync(iconPath)) entry.icon = readFileSync(iconPath, 'utf8').replace(/\s*[\r\n]+\s*/g, '').trim();
  // Demo preview thumbnail — shown for a tool with no saved session yet, for a
  // fuller gallery on a fresh install. Resolution, highest priority first:
  //   1. A committed authored override: tools/<id>/card.html (self-contained animated
  //      HTML — shown in a sandboxed <iframe>), card.svg (vector), or card.png.
  //   2. Otherwise a BUILD-GENERATED preview at /catalog/previews/<id>.<ext>, where
  //      ext is svg for tools that export vector (svg in formats), else png — the same
  //      choice captureThumbnail makes. Produced by `npm run previews`
  //      (scripts/build-previews.ts) into the git-ignored catalog/previews/ dir, so it
  //      need not be committed. The path is derived DETERMINISTICALLY here (not from
  //      disk), so regenerating previews never churns the index; the gallery falls back
  //      to a plain "open to start" tile when the file is absent (dev / not yet built).
  // Unlike the icon (inlined), the preview is a PATH served by the shell's static
  // handler — a sizeable PNG would bloat the index every shell fetches.
  if (existsSync(join(ROOT, 'tools', manifest.id, 'card.html'))) {
    entry.preview = `/tools/${manifest.id}/card.html`;
  } else if (existsSync(join(ROOT, 'tools', manifest.id, 'card.svg'))) {
    entry.preview = `/tools/${manifest.id}/card.svg`;
  } else if (existsSync(join(ROOT, 'tools', manifest.id, 'card.png'))) {
    entry.preview = `/tools/${manifest.id}/card.png`;
  } else {
    // Vector tools default to a crisp .svg preview; raster/HTML tools to .png. But
    // build-previews decides svg-vs-png from RENDER crispness (isExpensiveThumbSvg —
    // blur filters / thousands of dots / huge paths rasterise to .png; everything else
    // stays crisp .svg), NOT from export formats — so a tool whose export format is
    // html/pdf can still get a vector .svg preview. Honour whichever file build-previews
    // actually produced so the index NEVER points at a 404; only when neither exists yet
    // (dev / pre-generation) do we fall back to the format-based default, keeping the
    // path stable. This disk check is why build:catalog must run after regenerating
    // previews (validate-catalog guards the drift — see scripts/validate-catalog.ts).
    const pv = join(ROOT, 'catalog', 'previews');
    const hasSvg = existsSync(join(pv, `${manifest.id}.svg`));
    const hasWebp = existsSync(join(pv, `${manifest.id}.webp`));
    const hasPng = existsSync(join(pv, `${manifest.id}.png`));
    const wantSvg = entry.exportable && (entry.formats as string[]).includes('svg');
    // Precedence: vector (svg) → WebP (the standard raster form, produced by
    // optimize-preview-webp) → legacy png → format-based default when none exist yet.
    // build-previews writes exactly one form per tool, so ties don't occur in practice.
    const ext = hasSvg ? 'svg'
      : hasWebp ? 'webp'
      : hasPng ? 'png'
      : wantSvg ? 'svg' : 'webp';
    entry.preview = `/catalog/previews/${manifest.id}.${ext}`;
  }
  // Whether any input pre-fills from the user profile (bindToProfile). The gallery
  // uses this to scope profile-aware preview regeneration to the tools that actually
  // change with the profile — see shells/web/src/personalize-previews.js. Without it
  // the gallery would have to fetch every manifest to find out. Manifest-derived.
  if ((manifest.inputs ?? []).some((i: any) => i.bindToProfile)) entry.personalized = true;
  // Featured-row curation (manifest.featured) — carried verbatim so the gallery's
  // cinematic hero row (shells/web/src/components/featured-row.ts) can pick its tiles
  // and cross-fade variants with no per-tool manifest fetch. Not in INDEX_FIELDS (it's
  // an object, so the validator's field-by-field drift check would always trip on it,
  // as with icon/preview); the object copy here is deterministic, so re-running
  // build:catalog on the same manifests is idempotent.
  if (manifest.featured && typeof manifest.featured === 'object') entry.featured = manifest.featured;
  // Example looks (manifest.examples) — carried verbatim so the gallery tile's
  // horizontally-scrollable preview strip (and the featured hero row, when the tool
  // is featured) can render + cross-fade them with no per-tool manifest fetch. Like
  // `featured` above, it's an object/array excluded from INDEX_FIELDS' scalar drift
  // check; the copy here is deterministic, so re-running build:catalog is idempotent.
  if (Array.isArray(manifest.examples)) entry.examples = manifest.examples;
  // Paged tools (render.paged) lay out multiple [data-pdf-page] boxes; the gallery
  // shows each page as its own preview slide instead of input-variant looks.
  if (manifest.render?.paged === true) entry.paged = true;
  return entry;
}

function loadManifests(): Map<string, Manifest> {
  const toolsDir = join(ROOT, 'tools');
  const manifests = new Map<string, Manifest>(); // id → manifest
  for (const dir of readdirSync(toolsDir)) {
    if (!statSync(join(toolsDir, dir)).isDirectory()) continue;
    const p = join(toolsDir, dir, 'tool.json');
    if (!existsSync(p)) continue;
    const manifest = JSON.parse(readFileSync(p, 'utf8'));
    manifests.set(manifest.id, manifest);
  }
  return manifests;
}

function build(): void {
  const manifests = loadManifests();

  // Preserve existing order; append any tools not yet listed.
  const existing: IndexFile = existsSync(INDEX_PATH)
    ? JSON.parse(readFileSync(INDEX_PATH, 'utf8'))
    : { version: '1', tools: [] };

  const orderedIds = existing.tools.map(t => t.id as string).filter(id => manifests.has(id));
  for (const id of manifests.keys()) {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }

  // Every id in orderedIds came from manifests (filtered/keys), so get() is defined.
  const tools = orderedIds.map(id => entryFromManifest(manifests.get(id)!));

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

// Only regenerate when run directly (`node scripts/build-catalog-index.ts`).
// validate-catalog.js imports `entryFromManifest` from this module to share the
// derivation, and must NOT trigger a write as a side effect of the import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
