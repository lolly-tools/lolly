#!/usr/bin/env node
/**
 * Preview-PNG downscaler.
 *
 * Run as: npm run optimize:preview-png   (a post-step after `npm run previews`, like
 * optimize:previews does for the SVG previews)
 *
 * `npm run previews` (build-previews.ts) rasterises expensive tool previews to PNG at
 * full render resolution — up to 3200×2000, 1.4 MB each. They're shown as gallery tile /
 * featured-row previews at ~300–600 CSS px, so they're 4–8× oversized in each dimension.
 * This downscales them to a retina-safe cap and re-encodes at max PNG compression, in
 * place (kept as .png — an <img src> URL's extension pins the MIME type, and build-
 * catalog-index derives the preview path from the filename, so bytes-only changes cause
 * no index drift; previews aren't checksummed).
 *
 * Idempotent: an already-small preview is skipped, and a downscale is only kept when it
 * actually shrinks the file, so re-runs are stable.
 *
 * BUILD-TIME ONLY (sharp / native libvips). Previews are git-ignored + shipped via the
 * archive deploy, so run this locally/CI before deploying — same as optimize:previews.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEWS_DIR = join(ROOT, 'catalog/previews');

// Retina-safe cap: featured/grid previews display at up to ~600 CSS px, so 1280 covers 2×.
const MAX_DIM = 1280;
// Don't bother with previews already at/under the cap and light on disk.
const SKIP_IF_BYTES_LTE = 120 * 1024;

async function run(): Promise<void> {
  let files: string[];
  try {
    files = readdirSync(PREVIEWS_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  } catch {
    console.log('· No catalog/previews/ dir yet (run `npm run previews` first) — nothing to do.');
    return;
  }

  let shrunk = 0, skipped = 0, before = 0, after = 0;
  for (const name of files) {
    const path = join(PREVIEWS_DIR, name);
    const srcBytes = statSync(path).size;
    const meta = await sharp(path).metadata();
    const w = meta.width ?? 0, h = meta.height ?? 0;

    if (srcBytes <= SKIP_IF_BYTES_LTE && w <= MAX_DIM && h <= MAX_DIM) { skipped++; continue; }

    const out = await sharp(path)
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, effort: 10, palette: true })
      .toBuffer();

    if (out.length >= srcBytes) { skipped++; continue; }   // no win → leave the original
    writeFileSync(path, out);
    shrunk++;
    before += srcBytes;
    after += out.length;
  }

  const kb = (n: number): string => Math.round(n / 1024).toLocaleString();
  console.log(
    `✓ Preview PNGs: ${shrunk} downscaled, ${skipped} skipped. ` +
    (shrunk ? `${kb(before)} KB → ${kb(after)} KB (−${kb(before - after)} KB).` : 'nothing to shrink.'),
  );
}

run().catch((e) => { console.error(e); process.exit(1); });
