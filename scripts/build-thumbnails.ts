#!/usr/bin/env node
/**
 * Raster thumbnail-derivative generator.
 *
 * Run as: npm run optimize:thumbnails
 *   (then: npm run build:catalog && npm run validate:catalog — same chain as optimize:assets)
 *
 * The landing gallery renders its featured/personalized tile previews through the real
 * engine path (renderRowToBlob → createRuntime), which resolves each example's photo
 * refs via host.assets.get. With only the full-res original on file, a single preview
 * dragged a 200–467 KB JPEG through a main-thread canvas — measured gallery LCP 8.3s.
 *
 * This emits a small WebP derivative next to each raster asset (`<name>.thumb.webp`) and
 * registers it as an extra `formats[]` entry with `format: "thumb"`. The web bridge's
 * preview path (render-export.ts `withThumbAssets`) asks host.assets.get for the "thumb"
 * format; pickFormat returns it when present and falls back to the original otherwise, so
 * this is purely additive — real tool use and exports still resolve the full-res original.
 *
 * checksum/size are deliberately left blank here — `checksum-assets.ts` (run right after,
 * via build:catalog) stamps them from the committed bytes, and validate-catalog.ts then
 * verifies existence + checksum. So no schema or validator changes are needed: a "thumb"
 * entry rides the existing formats[] machinery.
 *
 * BUILD-TIME ONLY. sharp (native libvips) does not run on the Vercel deploy build, so the
 * derivatives — like catalog/previews/ and catalog/og/ — are generated locally/CI and
 * COMMITTED. Deterministic: same source + params → identical bytes, so re-runs don't churn.
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/assets/index.json');

/** Repo-root-relative path for a catalog URL like "/catalog/assets/...".
 * Inlined (not imported from checksum-assets.ts) so this script has no import side-effects. */
function localPathForUrl(url: string): string {
  return join(ROOT, url.replace(/^\//, ''));
}

// Longest-side cap for a derivative. The featured render composes into ~720×560 and the
// catalog grid downscales further, so 800 keeps tile previews crisp (incl. retina) while
// slashing bytes. WebP q72 is a well-tested photo/UI sweet spot.
const THUMB_MAX = 800;
const THUMB_QUALITY = 72;
const THUMB_FORMAT = 'thumb';            // the format string the preview path requests
const THUMB_SUFFIX = '.thumb.webp';

// Skip the encode entirely for assets already small enough that a derivative can't
// meaningfully help (avoids littering the repo with near-useless files).
const SKIP_IF_WIDTH_LTE = THUMB_MAX;
const SKIP_IF_BYTES_LTE = 50 * 1024;
// Only KEEP a generated thumb if it's at least this much smaller than the source.
const KEEP_IF_UNDER_FRACTION = 0.9;

const SOURCE_FORMAT_RE = /^(jpe?g|png|webp)$/i;

interface AssetFormat { format: string; url: string; checksum?: string; size?: number; width?: number; height?: number; }
interface Asset { id: string; type?: string; formats?: AssetFormat[]; meta?: { animated?: boolean } & Record<string, unknown>; }
interface AssetIndex { assets: Asset[] }

/** Absolute path for a `/catalog/...` URL, and the `.thumb.webp` sibling of a source url. */
function thumbUrlFor(sourceUrl: string): string {
  return sourceUrl.replace(/\.[^./]+$/, '') + THUMB_SUFFIX;
}

async function run(): Promise<void> {
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as AssetIndex;
  let made = 0, skipped = 0, removed = 0, srcBytes = 0, thumbBytes = 0;
  const missing: string[] = [];

  for (const asset of index.assets) {
    // Strip any prior thumb entry up front so this run is the single source of truth
    // (idempotent — a thumb we still want is re-added below with identical bytes).
    const priorThumbs = (asset.formats ?? []).filter(f => f.format === THUMB_FORMAT);
    if (priorThumbs.length) asset.formats = asset.formats!.filter(f => f.format !== THUMB_FORMAT);

    const cleanupOrphan = (url: string): void => {
      const p = localPathForUrl(url);
      if (existsSync(p)) { rmSync(p); removed++; }
    };

    // Only still, non-animated rasters. Animated raster (gif/apng/animated-webp) is stored
    // VERBATIM — downscaling would flatten it to one frame — and vector/lottie/video have
    // no bytes to shrink here.
    if (asset.type !== 'raster' || asset.meta?.animated) {
      for (const t of priorThumbs) cleanupOrphan(t.url);
      continue;
    }
    const source = (asset.formats ?? []).find(f => SOURCE_FORMAT_RE.test(f.format));
    if (!source) { for (const t of priorThumbs) cleanupOrphan(t.url); continue; }

    const srcPath = localPathForUrl(source.url);
    if (!existsSync(srcPath)) { missing.push(`${asset.id} → ${source.url}`); continue; }

    const srcBuf = readFileSync(srcPath);
    const meta = await sharp(srcBuf).metadata();
    const w = meta.width ?? 0;

    // Cheap skip: an asset already at/under the cap AND small on disk gains ~nothing.
    if (w > 0 && w <= SKIP_IF_WIDTH_LTE && srcBuf.length <= SKIP_IF_BYTES_LTE) {
      for (const t of priorThumbs) cleanupOrphan(t.url);
      skipped++;
      continue;
    }

    const out = await sharp(srcBuf)
      .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer({ resolveWithObject: true });

    // Only keep it if it's a real win over the original bytes.
    if (out.data.length >= srcBuf.length * KEEP_IF_UNDER_FRACTION) {
      for (const t of priorThumbs) cleanupOrphan(t.url);
      skipped++;
      continue;
    }

    const thumbUrl = thumbUrlFor(source.url);
    writeFileSync(localPathForUrl(thumbUrl), out.data);
    // Append after the original; checksum/size filled by checksum-assets.ts next.
    asset.formats!.push({ format: THUMB_FORMAT, url: thumbUrl, width: out.info.width, height: out.info.height });
    made++;
    srcBytes += srcBuf.length;
    thumbBytes += out.data.length;
  }

  if (missing.length) {
    console.error(`✗ ${missing.length} source file(s) missing on disk:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  const saved = srcBytes - thumbBytes;
  const mb = (n: number): string => (n / (1024 * 1024)).toFixed(1);
  console.log(
    `✓ Thumbnails: ${made} generated, ${skipped} skipped (already small)` +
    `${removed ? `, ${removed} orphan(s) removed` : ''}. ` +
    `Preview payload for these assets: ${mb(srcBytes)} MB → ${mb(thumbBytes)} MB (−${mb(saved)} MB). ` +
    `Now run: npm run build:catalog && npm run validate:catalog`,
  );
}

run().catch((e) => { console.error(e); process.exit(1); });
