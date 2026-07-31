#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Asset checksum generator.
 *
 * Run as: npm run build:catalog  (or directly: node scripts/checksum-assets.ts)
 *
 * Computes an SRI-format SHA-256 (`sha256-<base64>`) for every asset format file
 * referenced in `catalog/assets/index.json`, and writes it (plus the real byte
 * size) back into the index. This is the integrity guarantee promised in
 * docs/authoring-assets.md — without it the `checksum` fields are placeholders.
 *
 * This runs at BUILD time only. There is deliberately no runtime verification on
 * the asset-fetch path (it would hash every asset on every load — a runtime cost
 * for no offline-PWA benefit). CI runs `validate-catalog.js`, which recomputes
 * and compares, so a stale checksum fails the build rather than a user's device.
 *
 * It also labels each raster format file with its `depth` (bits per channel),
 * sniffed from the container header — see `depthForFormat` below and
 * plans/deeprichpixels.md §10 item 6. Depth follows provenance: the label is a
 * SNIFF of the shipped bytes, never an assertion, and absent always means
 * "unknown", never "8".
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// The ingest path's bounded bit-depth header sniff, reused verbatim so a catalog
// label and a user upload can never disagree about the same bytes. The module is
// DOM-free at import time (its DOM work lives inside sampleImageFile), and
// scripts already import across this boundary — validate-catalog.ts pulls in
// shells/web/src/palette.ts, tests/fuzz/targets.ts fuzzes this very function.
import { depthHint } from '../shells/web/src/lib/image-sample.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/assets/index.json');

/** One format entry (mutated in place with the freshly-computed checksum + size). */
interface AssetFormat {
  url: string;
  checksum?: string;
  size?: number;
  depth?: number;
}

/** One asset row from the catalog index. */
interface Asset {
  id: string;
  type?: string;
  formats?: AssetFormat[];
  locales?: Record<string, AssetFormat[]>;
}

/** Shape of catalog/assets/index.json (only the fields this script touches). */
interface AssetIndex {
  assets: Asset[];
}

/** Repo-root-relative path for a catalog URL like "/catalog/assets/...". */
export function localPathForUrl(url: string): string {
  return join(ROOT, url.replace(/^\//, ''));
}

/** SRI SHA-256 for a file's bytes, or null if the file is missing. The bytes come
 *  back too, so a caller needing to look at them (the depth sniff) reads once. */
export function sriForFile(absPath: string): { checksum: string; size: number; bytes: Uint8Array } | null {
  if (!existsSync(absPath)) return null;
  const buf = readFileSync(absPath);
  const digest = createHash('sha256').update(buf).digest('base64');
  return { checksum: `sha256-${digest}`, size: buf.length, bytes: buf };
}

/**
 * Bits per channel for ONE format file, or null when the answer isn't known
 * cheaply and honestly.
 *
 * The gate is deliberately narrow, because the governing principle of
 * plans/deeprichpixels.md is "never emit bits the pipeline did not produce" —
 * and a label is an emission too:
 *   - only `type: 'raster'` assets are asked at all (an SVG has no channels; a
 *     video/lottie/font/palette depth would be a category error),
 *   - only a container whose header STATES the depth answers (png/tiff/jpeg/
 *     webp). heic/avif are recognised by `depthHint` but bury depth in codec
 *     config boxes, so they stay null rather than being guessed at 8,
 *   - anything malformed, truncated or unrecognised is null.
 *
 * The single source of truth for the parsing is the ingest sniff (`depthHint`),
 * so a catalog label and the upload-time label of the same bytes agree by
 * construction. Shared with validate-catalog.ts, which re-sniffs and compares —
 * that is the drift guard, and it only works because both call THIS function.
 */
export async function depthForFormat(assetType: string | undefined, bytes: Uint8Array): Promise<number | null> {
  if (assetType !== 'raster') return null;
  const hint = await depthHint(bytes);
  return hint.bitsPerChannel;
}

async function run(): Promise<void> {
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as AssetIndex;
  let updated = 0;
  let labelled = 0;
  const missing: string[] = [];

  for (const asset of index.assets) {
    // Base formats + any locale-specific format variants.
    const formatLists = [asset.formats, ...Object.values(asset.locales ?? {})];
    for (const formats of formatLists) {
      for (const fmt of formats ?? []) {
        const absPath = localPathForUrl(fmt.url);
        const sri = sriForFile(absPath);
        if (!sri) { missing.push(`${asset.id} → ${fmt.url}  (resolved: ${absPath})`); continue; }
        const depth = await depthForFormat(asset.type, sri.bytes);
        if (fmt.checksum !== sri.checksum || fmt.size !== sri.size || fmt.depth !== (depth ?? undefined)) updated++;
        fmt.checksum = sri.checksum;
        fmt.size = sri.size;
        // Absent means unknown. An asset that stops being sniffable (retyped,
        // re-encoded to heic) must LOSE its label, not keep a stale one.
        if (depth == null) delete fmt.depth;
        else { fmt.depth = depth; labelled++; }
      }
    }
  }

  if (missing.length) {
    console.error(`✗ ${missing.length} asset file(s) missing on disk:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  console.log(`✓ Checksummed ${index.assets.length} assets (${updated} entr${updated === 1 ? 'y' : 'ies'} changed, ${labelled} depth-labelled)`);
}

// Only rewrite the index when run directly (`node scripts/checksum-assets.ts`).
// validate-catalog.ts imports `depthForFormat` from this module to share the one
// sniff, and must NOT trigger a write as a side effect of the import — the same
// pattern build-catalog-index.ts uses for `entryFromManifest`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
