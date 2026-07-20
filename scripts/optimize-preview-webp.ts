#!/usr/bin/env node
/**
 * Raster preview → WebP converter.
 *
 * `npm run previews` rasterises the previews it can't keep as vector — a canvas tool
 * (code-canvas), a dense-synthetic-vector tool the SVG walker would make expensive to
 * paint (filter-halftone, street-map), or a photo-heavy look — to PNG at up to render
 * resolution (code-canvas.png alone is 1.46 MB). Shown as gallery tiles at ~300–600 CSS px
 * they're both oversized AND in a format 3–5× heavier than it needs to be.
 *
 * This resizes every raster preview (default <id>.png AND look <id>.look<i>.png) to a
 * retina-safe cap and re-encodes as WebP — typically a 5–10× byte cut — then removes the
 * .png so a tool never carries both. build-catalog-index.ts prefers .webp over .png, and
 * build-preview-bundle.ts references look rasters as .webp first, so the switch is picked
 * up with no other change. Runs as the final step of `npm run previews`.
 *
 * Idempotent: a tool already on .webp (no .png) is left untouched; re-encoding only ever
 * runs on a remaining .png. BUILD-TIME ONLY (sharp / native libvips).
 */

import { readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { stampBitmap } from './lib/stamp-media.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEWS_DIR = join(ROOT, 'catalog/previews');

// Retina-safe cap: the featured hero shows a preview at ~400 CSS px, grid tiles smaller,
// so 1024 covers 2× on the largest surface while keeping bytes down.
const MAX_DIM = 1024;

async function run(): Promise<void> {
  let files: string[];
  try {
    files = readdirSync(PREVIEWS_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  } catch {
    console.log('· No catalog/previews/ dir yet (run `npm run previews` first) — nothing to do.');
    return;
  }
  if (!files.length) { console.log('✓ Preview rasters: none to convert (all vector / already WebP).'); return; }

  let converted = 0, before = 0, after = 0;
  for (const name of files) {
    const pngPath = join(PREVIEWS_DIR, name);
    const webpPath = pngPath.replace(/\.png$/i, '.webp');
    const srcBytes = statSync(pngPath).size;
    // Resize to a lossless intermediate, then hand it to the shared stamper: it imprints
    // the pixels (robust strength, since the WebP is lossy) and embeds a "made with Lolly"
    // C2PA credential, re-encoding to WebP q80 in one pass (no double compression).
    const resized = await sharp(pngPath)
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const id = name.replace(/\.png$/i, '');
    const out = await stampBitmap(new Uint8Array(resized), 'webp', { id, name: id }, { webpQuality: 80 });
    // Write the .webp and drop the .png (a tool carries exactly one raster form). Even if
    // WebP weren't smaller for some pathological input it's still the format we standardise
    // on, so always switch — these are lossy thumbnails, not deliverables.
    writeFileSync(webpPath, Buffer.from(out));
    unlinkSync(pngPath);
    converted++;
    before += srcBytes;
    after += out.length;
  }

  const kb = (n: number): string => Math.round(n / 1024).toLocaleString();
  console.log(
    `✓ Preview rasters → WebP: ${converted} converted. ${kb(before)} KB → ${kb(after)} KB (−${kb(before - after)} KB).`,
  );
}

run().catch((e) => { console.error(e); process.exit(1); });
