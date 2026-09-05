#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog tool-index generator.
 *
 * Run as: npm run build:catalog  (or directly: node scripts/build-catalog-index.ts)
 *
 * The tool manifests (`tools/<id>/tool.json`) are the single source of truth.
 * `catalog/tools/index.json` is a denormalised registry the shell fetches at
 * boot - it must never drift from the manifests. This script regenerates it.
 *
 * Each index entry carries only the fields the gallery needs:
 *   id, name, description, version, status, category
 *
 * It also emits `catalog/tools/index.slim.json` - the same tools in the same order,
 * cut down to what the gallery GRID paints with (see slimEntry). The full index is
 * 551 KB raw / 168 KB gz (suse profile, 2026-08-26) and the first-ever gallery paint
 * used to block on all of it; the slim cut is 73 KB raw / 19 KB gz and is what boot
 * reads for that first paint, while the full index keeps syncing behind it for tool
 * views, search and the info dialog (plans/155 Task 3.8). Both files are generated -
 * never hand-edit either.
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
const SLIM_INDEX_PATH = join(ROOT, 'catalog/tools/index.slim.json');

// Tool id → the date its tool.json was first added (YYYY-MM-DD), minted by
// scripts/gen-tool-added-dates.ts from the packs' git history and COMMITTED -
// the builder never asks git itself, so the index regenerates byte-identically
// on shallow CI checkouts (the validate-catalog drift gate). Feeds the info
// dialog's "Added" line (the retired "New" badge's honest replacement).
const ADDED_DATES: Record<string, string> = (() => {
  const p = join(ROOT, 'scripts/data/tool-added-dates.json');
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
})();

// Fields the index mirrors from each manifest. `capabilities` lets the gallery
// gate tools a shell can't fulfil (e.g. 'capture' in the web PWA) without
// fetching every manifest first. `privacy` surfaces the on-device note in the
// gallery's tool-info modal. `tags` is what makes a tool findable by the words a
// designer actually types - "foil", "riso", "emboss" - rather than only by the
// handful that happen to appear in its name or description.
const INDEX_FIELDS = ['id', 'name', 'description', 'version', 'status', 'category', 'capabilities', 'privacy', 'new', 'listed', 'tags'];

/**
 * Is this .png an ANIMATED png (APNG)? A still PNG and an APNG share the extension, the
 * signature and the MIME type, so the file itself is the only thing that can answer - and
 * the answer decides whether the file is a tool's still `preview` or its `anim`.
 *
 * The test is the spec's own: an `acTL` (animation control) chunk, which must appear
 * BEFORE the first `IDAT` to be honoured. A later `acTL` is ignored by decoders, so a
 * plain indexOf would call a still image animated. Reading the head is enough - a card is
 * a few hundred KB at most, and the chunks that matter are at the front.
 */
export function isAnimatedPng(file: string): boolean {
  let head: Buffer;
  try { head = readFileSync(file); } catch { return false; }
  const acTL = head.indexOf('acTL', 0, 'latin1');
  if (acTL < 0) return false;
  const idat = head.indexOf('IDAT', 0, 'latin1');
  return idat < 0 || acTL < idat;
}

export function entryFromManifest(manifest: Manifest): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const f of INDEX_FIELDS) {
    if (manifest[f] !== undefined) entry[f] = manifest[f];
  }
  // When this tool was first added to its pack (see ADDED_DATES above). Full index
  // only - it paints the info dialog, never the grid, so it stays off the slim cut.
  if (ADDED_DATES[manifest.id]) entry.added = ADDED_DATES[manifest.id];
  // Output formats the tool supports (tool.json render.formats). Carried so the
  // gallery's tool-info modal can list them with no per-open manifest fetch.
  // (For render.export:false utilities this is the set of input types they
  // accept, not download formats - the modal gates on `exportable` below.)
  entry.formats = Array.isArray(manifest.render?.formats) ? manifest.render.formats : [];
  // The tool's intended output size - render.width/height in render.unit (px when
  // unset). Carried so the gallery can show "what you'll get" (size + format) on the
  // card and in the info modal with no per-tool manifest fetch. `unit` is included only
  // when it's a physical unit (mm/cm/in/pt); px is the default and stays implicit.
  if (typeof manifest.render?.width === 'number') entry.width = manifest.render.width;
  if (typeof manifest.render?.height === 'number') entry.height = manifest.render.height;
  if (manifest.render?.unit && manifest.render.unit !== 'px') entry.unit = manifest.render.unit;
  // Whether the tool can be rendered to an exportable file at all. Surfaced so
  // shells can exclude render-only / on-device utilities - which produce their
  // output via their own exportFile flow, not the batch render path - without
  // fetching every manifest (/pro batch hides them). Mirrors isExportable() in
  // shells/web/src/pro/render-export.js and the drift check in validate-catalog.js.
  entry.exportable = manifest.render?.export !== false && (manifest.render?.formats?.length ?? 0) > 0;
  // File-in → bytes-out utilities need a path picker in terminal shells. Carry
  // the manifest-derived fact rather than teaching the TUI an id list every time
  // one ships. This is deliberately computed, not authored catalog metadata.
  if (manifest.hooks?.exportFile === true
      && (manifest.inputs ?? []).some((input: any) => input.type === 'file')) {
    entry.fileTransform = true;
  }
  // Inline the tool's icon (tools/<id>/icon.svg) so the gallery can show it on
  // every card with no per-card fetch. It uses stroke="currentColor", so the
  // shell themes it via CSS. Read here (not from the manifest) so build:catalog
  // and validate-catalog's drift check stay in lock-step.
  const iconPath = join(ROOT, 'tools', manifest.id, 'icon.svg');
  if (existsSync(iconPath)) entry.icon = readFileSync(iconPath, 'utf8').replace(/\s*[\r\n]+\s*/g, '').trim();
  // Demo preview thumbnail - shown for a tool with no saved session yet, for a
  // fuller gallery on a fresh install. Resolution, highest priority first:
  //   1. A committed authored override: tools/<id>/card.html (self-contained animated
  //      HTML - shown in a sandboxed <iframe>), card.svg (vector), or card.png.
  //   2. Otherwise a BUILD-GENERATED preview at /catalog/previews/<id>.<ext>, where
  //      ext is svg for tools that export vector (svg in formats), else png - the same
  //      choice captureThumbnail makes. Produced by `npm run previews`
  //      (scripts/build-previews.ts) into the git-ignored catalog/previews/ dir, so it
  //      need not be committed. The path is derived DETERMINISTICALLY here (not from
  //      disk), so regenerating previews never churns the index; the gallery falls back
  //      to a plain "open to start" tile when the file is absent (dev / not yet built).
  // Unlike the icon (inlined), the preview is a PATH served by the shell's static
  // handler - a sizeable PNG would bloat the index every shell fetches.
  //
  // MOTION is resolved separately, into `anim`, and `preview` stays the STILL file
  // (plans/155 WP-5.3). A tool whose content genuinely animates can commit a
  // tools/<id>/card.webm, or an APNG tools/<id>/card.png; the surfaces play it only on
  // hover / focus / the centered tile, so pointing `preview` at it would hand every
  // surface a file it has to download just to paint a thumbnail. An APNG card.png is
  // therefore NOT a candidate for `preview` either - hence the acTL sniff below, which is
  // the only way to tell one from a still PNG of the same name.
  const animCard = join(ROOT, 'tools', manifest.id, 'card.webm');
  const pngCard = join(ROOT, 'tools', manifest.id, 'card.png');
  const pngCardAnimated = existsSync(pngCard) && isAnimatedPng(pngCard);
  if (existsSync(animCard)) entry.anim = `/tools/${manifest.id}/card.webm`;
  else if (pngCardAnimated) entry.anim = `/tools/${manifest.id}/card.png`;

  if (existsSync(join(ROOT, 'tools', manifest.id, 'card.html'))) {
    entry.preview = `/tools/${manifest.id}/card.html`;
  } else if (existsSync(join(ROOT, 'tools', manifest.id, 'card.svg'))) {
    entry.preview = `/tools/${manifest.id}/card.svg`;
  } else if (existsSync(pngCard) && !pngCardAnimated) {
    entry.preview = `/tools/${manifest.id}/card.png`;
  } else {
    // Vector tools default to a crisp .svg preview; raster/HTML tools to .png. But
    // build-previews decides svg-vs-png from RENDER crispness (isExpensiveThumbSvg - 
    // blur filters / thousands of dots / huge paths rasterise to .png; everything else
    // stays crisp .svg), NOT from export formats - so a tool whose export format is
    // html/pdf can still get a vector .svg preview. Honour whichever file build-previews
    // actually produced so the index NEVER points at a 404; only when neither exists yet
    // (dev / pre-generation) do we fall back to the format-based default, keeping the
    // path stable. This disk check is why build:catalog must run after regenerating
    // previews (validate-catalog guards the drift - see scripts/validate-catalog.ts).
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
  // Whether any input pre-fills from the user profile (bindToProfile) AND is actually
  // visible at the tool's default input values. The gallery uses this to scope
  // profile-aware preview regeneration to tools whose DEFAULT render changes with the
  // profile - see shells/web/src/personalize-previews.js. A bindToProfile input hidden
  // behind a default-off toggle (e.g. the filter tools' firstname/lastname under a
  // lower-third `showIf: { lowerThird: true }`) does NOT change the default preview, so
  // it must not mark the tool personalized - otherwise the gallery would needlessly
  // re-render it and swap the committed illustrative card (tools/<id>/card.svg) for a
  // live render. Without this flag the gallery would have to fetch every manifest to
  // find out. Manifest-derived.
  const inputs: any[] = manifest.inputs ?? [];
  const defaultOf = (id: string) => inputs.find((i) => i.id === id)?.default;
  const activeAtDefault = (input: any) =>
    !input.showIf || Object.entries(input.showIf).every(([k, v]) => defaultOf(k) === v);
  if (inputs.some((i: any) => i.bindToProfile && activeAtDefault(i))) entry.personalized = true;
  // Featured-row curation (manifest.featured) - carried verbatim so the gallery's
  // cinematic hero row (shells/web/src/components/featured-row.ts) can pick its tiles
  // and cross-fade variants with no per-tool manifest fetch. Not in INDEX_FIELDS (it's
  // an object, so the validator's field-by-field drift check would always trip on it,
  // as with icon/preview); the object copy here is deterministic, so re-running
  // build:catalog on the same manifests is idempotent.
  if (manifest.featured && typeof manifest.featured === 'object') entry.featured = manifest.featured;
  // Example looks (manifest.examples) - carried verbatim so the gallery tile's
  // horizontally-scrollable preview strip (and the featured hero row, when the tool
  // is featured) can render + cross-fade them with no per-tool manifest fetch. Like
  // `featured` above, it's an object/array excluded from INDEX_FIELDS' scalar drift
  // check; the copy here is deterministic, so re-running build:catalog is idempotent.
  if (Array.isArray(manifest.examples)) entry.examples = manifest.examples;
  // "New from template" starting points. SOURCE OF TRUTH = per-template files at
  // tools/<id>/templates/<tid>.json ({ id, name, category?, description?, thumb?, values }).
  // The index carries METADATA ONLY (id/name/category/description/thumb) - never the
  // heavy `values` seed, which a client fetches on demand (chooser-select and the
  // reserved `?template=<id>` launcher). This keeps the synced index lean no matter how
  // many templates land or how large a free-canvas `boxes` blob grows. The scan mirrors
  // the i18n subdir walk below (same ROOT/tools/<id>/<subdir> join + existsSync guard +
  // sorted readdir for a deterministic, idempotent order); it is excluded from
  // INDEX_FIELDS' scalar drift check, and validate-catalog re-derives + asserts it.
  const templatesDir = join(ROOT, 'tools', manifest.id, 'templates');
  if (existsSync(templatesDir)) {
    const templates: Array<Record<string, unknown>> = [];
    for (const file of readdirSync(templatesDir).sort()) {
      if (!file.endsWith('.json')) continue;
      let t: Record<string, unknown>;
      try { t = JSON.parse(readFileSync(join(templatesDir, file), 'utf8')); } catch { continue; }
      if (typeof t.id !== 'string' || !t.id) continue;
      if (typeof t.name !== 'string' || !t.name) continue;
      const meta: Record<string, unknown> = {};
      // METADATA ONLY - `values` is deliberately excluded so the index stays lean.
      for (const k of ['id', 'name', 'category', 'description', 'thumb']) {
        if (t[k] !== undefined) meta[k] = t[k];
      }
      // Presets (plans/142): a template's curated variants - each a values OVERLAY
      // on the template base. Same metadata-only rule: id/name/description ride the
      // index (the chooser's variant chips and the `?preset=` launcher need them);
      // the overlay values stay in the template file, fetched with it.
      if (Array.isArray(t.presets)) {
        const presets = (t.presets as unknown[]).flatMap(p => {
          if (!p || typeof p !== 'object') return [];
          const pr = p as Record<string, unknown>;
          if (typeof pr.id !== 'string' || !pr.id || typeof pr.name !== 'string' || !pr.name) return [];
          const pm: Record<string, unknown> = { id: pr.id, name: pr.name };
          if (pr.description !== undefined) pm.description = pr.description;
          return [pm];
        });
        if (presets.length) meta.presets = presets;
      }
      templates.push(meta);
    }
    if (templates.length) entry.templates = templates;
  }
  // Paged tools (render.paged) lay out multiple [data-pdf-page] boxes; the gallery
  // shows each page as its own preview slide instead of input-variant looks.
  if (manifest.render?.paged === true) entry.paged = true;
  // Gallery-card translations (plans/38-localize.md section 7) - folded from the SAME
  // tools/<id>/i18n/<lang>.json sidecars engine/src/loader.ts's
  // applyManifestI18n reads at tool-load time, but only the three fields the
  // gallery card itself shows (name/description/blurb) - the rest of a
  // sidecar (input labels, etc.) is loader-only and never reaches the index.
  // A locale only gets an entry when its sidecar actually supplies one of
  // these, so the index doesn't carry empty `{}` noise for partial sidecars.
  const i18nDir = join(ROOT, 'tools', manifest.id, 'i18n');
  if (existsSync(i18nDir)) {
    const i18n: Record<string, { name?: string; description?: string; blurb?: string }> = {};
    for (const file of readdirSync(i18nDir)) {
      if (!file.endsWith('.json')) continue;
      const lang = file.replace(/\.json$/, '');
      let overlay: Record<string, unknown>;
      try { overlay = JSON.parse(readFileSync(join(i18nDir, file), 'utf8')); } catch { continue; }
      const localeEntry: { name?: string; description?: string; blurb?: string } = {};
      if (typeof overlay.name === 'string') localeEntry.name = overlay.name;
      if (typeof overlay.description === 'string') localeEntry.description = overlay.description;
      if (typeof overlay['featured.blurb'] === 'string') localeEntry.blurb = overlay['featured.blurb'] as string;
      if (Object.keys(localeEntry).length) i18n[lang] = localeEntry;
    }
    if (Object.keys(i18n).length) entry.i18n = i18n;
  }
  return entry;
}

// Fields the SLIM index mirrors from a full index entry (see slimEntry below).
// The set is "everything the gallery GRID paints with", and nothing else - each
// omission below is a measured one:
//   i18n      335 KB of the index's 434 KB of compact JSON - 26 locale blocks per tool,
//             each a translated name/description/blurb.
//             The slim paint renders English and the full index (which arrives moments
//             later) re-runs localizeToolIndex, exactly as Task 3.7 already does while
//             a locale chunk is in flight.
//   templates  17 KB - the "N templates" chip and the info dialog. Both are post-paint.
//   examples   22 KB - the values/theme of each example look. Deliberately absent:
//             without `formats` a slim tile can't build its example carousel at all,
//             which is the point (Task 4.3 - chrome first, art behind it), and the
//             looks' identity still rides `looks` below.
//   formats/width/height/unit/exportable/paged/privacy/version - info-dialog and
//             carousel inputs, none of which change the tile's box.
//   anim      the motion file (WP-5.3). Nothing plays it until a hover, a focus or the
//             centered tile on touch, and the full index has arrived long before a human
//             produces any of those - so the first paint would carry a URL it cannot use.
// `icon` IS carried despite the plan text ("no inline icon SVG"): it is 24 KB raw /
// ~4 KB gz, and it is the ONE thing Task 4.3's skeleton is made of - the
// .gtile-iconfill-trace shimmer strokes the tool's own icon while its art streams in.
// A slim index without it paints an empty box, not a named tile.
// `listed`/`capabilities`/`new` are carried (≈280 bytes total) because each one
// ADDS or REMOVES a tile / a badge: without them an unlisted mechanism would flash
// into the grid and a desktop-only tool would flip to "Desktop app only" on the
// upgrade paint.
const SLIM_FIELDS = ['id', 'name', 'description', 'category', 'tags', 'status', 'capabilities', 'new', 'listed', 'icon', 'preview', 'featured'];

/**
 * The slim (first-paint) form of one full index entry - plans/155 Task 3.8.
 *
 * Derived FROM the full entry rather than from the manifest a second time, so the
 * two files cannot disagree by construction: whatever entryFromManifest decided
 * about a preview path or an icon is what the slim copy carries. scripts/
 * validate-catalog.ts re-derives with this same function to fail a stale slim file.
 *
 * `looks` is the signature list for a tool's example looks - one `{ sig }` per look, in
 * manifest order, where sig is `JSON.stringify(values)`, the SAME contract
 * build-preview-bundle.ts writes and lib/preview-bundle.ts compares (a mismatch there
 * means the bundle predates a manifest edit). It carries no values of its own, so a
 * slim-only surface can pair look i with its pre-rendered file without the 22 KB of
 * example bodies. No shell reads it yet - the slim gallery paint deliberately shows
 * the committed preview, not the carousel - so treat it as a list of signatures,
 * not as a licence to re-inline look values here.
 */
export function slimEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const slim: Record<string, unknown> = {};
  for (const f of SLIM_FIELDS) {
    if (entry[f] !== undefined) slim[f] = entry[f];
  }
  const examples = entry.examples;
  if (Array.isArray(examples) && examples.length) {
    slim.looks = examples.map((v) => ({ sig: JSON.stringify((v as { values?: unknown } | null)?.values ?? {}) }));
  }
  return slim;
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

  // The slim companion the first gallery paint reads (plans/155 Task 3.8). Same
  // tools in the same order (that order IS the gallery's within-section layout),
  // same version + generatedAt watermark - so a slim file can never claim to
  // describe a different catalog than the full one it was cut from.
  //
  // Written COMPACT, unlike the pretty-printed full index: this is the one catalog
  // file on the first-paint critical path, indentation is ~30% of its raw bytes,
  // and nobody reads it by hand - validate-catalog re-derives every entry, so its
  // review value is a machine check, not a git diff.
  const slim = {
    version: out.version,
    generatedAt: out.generatedAt,
    tools: tools.map(slimEntry),
  };
  writeFileSync(SLIM_INDEX_PATH, JSON.stringify(slim) + '\n');

  const kb = (p: string) => (statSync(p).size / 1024).toFixed(1);
  console.log(`✓ Wrote catalog/tools/index.json - ${out.tools.length} tools${unchanged ? ' (unchanged)' : ''} (${kb(INDEX_PATH)} KB)`);
  console.log(`✓ Wrote catalog/tools/index.slim.json - first-paint index (${kb(SLIM_INDEX_PATH)} KB)`);
}

// Only regenerate when run directly (`node scripts/build-catalog-index.ts`).
// validate-catalog.js imports `entryFromManifest` from this module to share the
// derivation, and must NOT trigger a write as a side effect of the import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
