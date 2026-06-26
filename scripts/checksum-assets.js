#!/usr/bin/env node
/**
 * Asset checksum generator.
 *
 * Run as: npm run build:catalog  (or directly: node scripts/checksum-assets.js)
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
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'catalog/assets/index.json');

/** Repo-root-relative path for a catalog URL like "/catalog/assets/...". */
export function localPathForUrl(url) {
  return join(ROOT, url.replace(/^\//, ''));
}

/** SRI SHA-256 for a file's bytes, or null if the file is missing. */
export function sriForFile(absPath) {
  if (!existsSync(absPath)) return null;
  const buf = readFileSync(absPath);
  const digest = createHash('sha256').update(buf).digest('base64');
  return { checksum: `sha256-${digest}`, size: buf.length };
}

function run() {
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  let updated = 0;
  const missing = [];

  for (const asset of index.assets) {
    // Base formats + any locale-specific format variants.
    const formatLists = [asset.formats, ...Object.values(asset.locales ?? {})];
    for (const formats of formatLists) {
      for (const fmt of formats ?? []) {
        const absPath = localPathForUrl(fmt.url);
        const sri = sriForFile(absPath);
        if (!sri) { missing.push(`${asset.id} → ${fmt.url}  (resolved: ${absPath})`); continue; }
        if (fmt.checksum !== sri.checksum || fmt.size !== sri.size) updated++;
        fmt.checksum = sri.checksum;
        fmt.size = sri.size;
      }
    }
  }

  if (missing.length) {
    console.error(`✗ ${missing.length} asset file(s) missing on disk:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  console.log(`✓ Checksummed ${index.assets.length} assets (${updated} entr${updated === 1 ? 'y' : 'ies'} changed)`);
}

run();
