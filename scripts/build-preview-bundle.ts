#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Preview-look bundle generator.
 *
 * The gallery's featured hero row and every example-carousel tile demonstrate "one tool,
 * many on-brand outputs" by showing a handful of EXAMPLE LOOKS (manifest.examples, or the
 * pre-`examples` alias manifest.featured.variants). Historically each look was rendered
 * LIVE on the client at gallery load - spinning up the engine off-screen (~350 ms each),
 * fetching that look's photos/logos through a main-thread canvas, and rasterising. With
 * dozens of looks across the catalog that dominated first-load CPU + network (measured
 * gallery LCP 8.3 s / TBT 730 ms - see components/featured-row.ts).
 *
 * `npm run previews` now ALSO pre-renders each look to a committed, SVGO-optimised
 * catalog/previews/<id>.look<i>.svg (or .webp/.png when the look is raster-heavy). This
 * script writes the MANIFEST over those files: catalog/previews/bundle.json maps
 * `<toolId>:<i>` → { src, sig }, and the gallery fetches it ONCE
 * (shells/web/src/lib/preview-bundle.ts) to get a ready <img> src per look - no engine.
 * The live render becomes a background enhancement only for looks that aren't bundled (a
 * fresh look whose file hasn't been generated yet, or a profile-personalised preview).
 *
 * It used to INLINE every SVG look into this file instead of referencing it, and that got
 * measurably worse as looks converted to vector: 83 inlined SVGs was 2.57 MB of SVG text,
 * a 2.64 MB / 1.05 MB brotli bundle, and every tile's art waited behind the whole megabyte.
 * The bundle's job was to avoid a LIVE ENGINE RENDER, never to avoid an image request - the
 * looks are static same-origin files the browser fetches lazily, per tile, out of the
 * service worker's stale-while-revalidate cache. Referencing them makes the same file
 * 29 KB (8 KB gz), and it stays in that range however many looks go vector.
 *
 * Wired into `npm run build:catalog` so it regenerates deterministically after the index.
 * Idempotent: same look files + manifests → byte-identical bundle. Safe to run with no
 * look files present (an empty/partial bundle just means the client live-renders those
 * looks, exactly as before) - so it never has to wait on `npm run previews`.
 *
 *   node scripts/build-preview-bundle.ts
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOLS_DIR = join(ROOT, 'tools');
const PREVIEWS_DIR = join(ROOT, 'catalog', 'previews');
const BUNDLE_PATH = join(PREVIEWS_DIR, 'bundle.json');

/** One example look, as authored in a manifest. */
interface Look { values?: Record<string, unknown>; theme?: string }
interface Manifest {
  id: string;
  examples?: Look[];
  featured?: { variants?: Look[] };
}

/**
 * The looks a tile cross-fades through - the canonical source is `examples`; the
 * `featured.variants` object is the pre-`examples` alias kept working for tools authored
 * before it. MUST mirror resolveExamples() in shells/web/src/components/featured-row.ts so
 * the look INDEX (and therefore the bundle key `<id>:<i>`) lines up with what the client
 * asks renderFeaturedVariant for.
 */
function resolveLooks(m: Manifest): Look[] {
  return m.examples ?? m.featured?.variants ?? [];
}

/** A bundle entry: the same-origin path to the look file, plus the look's sig. */
interface BundleEntry { src: string; sig: string }

function loadManifests(): Manifest[] {
  const out: Manifest[] = [];
  for (const dir of readdirSync(TOOLS_DIR)) {
    const p = join(TOOLS_DIR, dir, 'tool.json');
    if (!statSync(join(TOOLS_DIR, dir)).isDirectory() || !existsSync(p)) continue;
    out.push(JSON.parse(readFileSync(p, 'utf8')) as Manifest);
  }
  return out;
}

function build(): void {
  if (!existsSync(PREVIEWS_DIR)) {
    console.log('No catalog/previews dir yet - nothing to bundle.');
    return;
  }
  const bundle: Record<string, BundleEntry> = {};
  let svgRef = 0, rasterRef = 0;

  for (const m of loadManifests()) {
    const looks = resolveLooks(m);
    for (let i = 0; i < looks.length; i++) {
      // sig MUST equal JSON.stringify(look.values) in featured-render.ts - a mismatch there
      // rejects the bundled look and the client live-renders it, so a stale bundle self-heals.
      const sig = JSON.stringify(looks[i]!.values ?? {});

      // Committed authored override - an animated APNG (or a hand-made look) that lives in
      // the tool dir at tools/<id>/look<i>.{png,webp,svg}, served at /tools/<id>/…. It's the
      // per-look analogue of the tools/<id>/card.* card override, and WINS over any
      // build-generated catalog/previews/<id>.look<i>.* - so it survives `npm run previews`
      // (which never writes into tools/). Referenced at its tool-dir path, same as a
      // generated look is referenced at its previews path.
      const ovrDir = join(TOOLS_DIR, m.id);
      const ovrSvg = join(ovrDir, `look${i}.svg`);
      if (existsSync(ovrSvg)) {
        bundle[`${m.id}:${i}`] = { src: `/tools/${m.id}/look${i}.svg`, sig };
        svgRef++;
        continue;
      }
      const ovrRaster = ['png', 'webp'].find((ext) => existsSync(join(ovrDir, `look${i}.${ext}`)));
      if (ovrRaster) {
        bundle[`${m.id}:${i}`] = { src: `/tools/${m.id}/look${i}.${ovrRaster}`, sig };
        rasterRef++;
        continue;
      }

      const svgFile = join(PREVIEWS_DIR, `${m.id}.look${i}.svg`);
      if (existsSync(svgFile)) {
        bundle[`${m.id}:${i}`] = { src: `/catalog/previews/${m.id}.look${i}.svg`, sig };
        svgRef++;
        continue;
      }
      // Raster look (dense/expensive vector or photo-heavy). webp preferred, then png.
      const raster = ['webp', 'png'].find((ext) => existsSync(join(PREVIEWS_DIR, `${m.id}.look${i}.${ext}`)));
      if (raster) {
        bundle[`${m.id}:${i}`] = { src: `/catalog/previews/${m.id}.look${i}.${raster}`, sig };
        rasterRef++;
      }
      // No look file yet → no entry; the client live-renders this look (unchanged behaviour).
    }
  }

  // Deterministic key order so re-running is byte-idempotent (no spurious git churn).
  const sorted: Record<string, BundleEntry> = {};
  for (const k of Object.keys(bundle).sort()) sorted[k] = bundle[k]!;
  const json = JSON.stringify(sorted);
  const prev = existsSync(BUNDLE_PATH) ? readFileSync(BUNDLE_PATH, 'utf8') : '';
  if (json === prev) {
    console.log(`✓ preview bundle unchanged - ${Object.keys(sorted).length} looks (${svgRef} svg, ${rasterRef} raster)`);
    return;
  }
  writeFileSync(BUNDLE_PATH, json);
  console.log(`✓ Wrote ${BUNDLE_PATH.replace(ROOT + '/', '')} - ${Object.keys(sorted).length} looks (${svgRef} svg, ${rasterRef} raster), ${(json.length / 1024).toFixed(1)} KB`);
}

build();
