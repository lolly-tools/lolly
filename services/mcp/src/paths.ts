// SPDX-License-Identifier: MPL-2.0
/**
 * Filesystem anchors for the MCP server.
 *
 * The server reads tool source and the generated catalog from the monorepo, exactly as
 * the CLI does, and asks the same resolver where those are: content lives in mounted
 * packs (community/, brands/*) named by profiles.json, not under a repo-root `tools/`
 * or `catalog/` directory (plan 244). A packaged root that carries a real tools/ +
 * catalog/ tree resolves through the same call, so a vendored snapshot still works.
 *
 * NOTHING HERE RESOLVES AT IMPORT TIME. This file is inlined into the serverless
 * bundle, where module evaluation is the cold start: a throw there is a 500 with no
 * body and no log line pointing at the cause, which is how the 2026-09-10 outage
 * happened. So the content roots resolve on first use and a missing profile fails the
 * one request that needed it.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Relative imports (not `@lolly-tools/node-shell/...`): this file is inlined into the
// serverless bundle, same as render.ts's node-shell imports.
import { repoRoot } from '../../../packages/node-shell/src/repo-root.ts';
import {
  catalogFile, contentRoots, contentUrlFile, toolFile, type ContentRoots,
} from '../../../packages/node-shell/src/content-roots.ts';

// The root holding the content packs comes from the ONE shared resolver
// (node-shell/repo-root), in this order: LOLLY_ROOT, then a marker walk UP from
// the module dir (this is the form that survives this bundle, whose flattened
// import.meta.url sits under api/, two levels below the deployed root), then cwd
// (Vercel preserves the data dirs there via `includeFiles`), then the
// monorepo-relative guess. This file used to carry a weaker twin with a fixed
// `../../..` and no walk-up. node-shell's header was written to replace it, but
// this call site was never rewired to use it.
export const REPO_ROOT = repoRoot();

/** The active profile, resolved once per process on first use. */
let roots: ContentRoots | null = null;
function content(): ContentRoots {
  if (!roots) roots = contentRoots();
  return roots;
}

/** The generated tool registry of the active profile. */
export function catalogIndexPath(): string {
  return catalogFile('tools/index.json', content());
}

/** The generated asset registry of the active profile. */
export function assetIndexPath(): string {
  return catalogFile('assets/index.json', content());
}

/** Catalog fonts, for the resvg raster path (render.ts). */
export function fontsDir(): string {
  return catalogFile('fonts', content());
}

/** Committed gallery previews (resources.ts serves them as `lolly://preview/{id}`). */
export function previewsDir(): string {
  return catalogFile('previews', content());
}

/** A site-absolute content url (`/catalog/assets/...`, `/tools/<id>/...`) onto disk -
 *  the form an asset's `formats[].url` carries. null when the url names neither
 *  namespace, or when the file is not in this profile's packs. */
export function contentUrl(url: string): string | null {
  return contentUrlFile(url, content());
}

// Scoped Chromium install for the Tier-B (headless-browser) render path. Anchored
// to THIS package's root, not the monorepo, so it travels with the repo split
// (plans/77-mcp-server.md). `pnpm run install:browser` downloads Chromium here; the
// installer and render.ts point PLAYWRIGHT_BROWSERS_PATH at it. An explicit
// PLAYWRIGHT_BROWSERS_PATH (container system cache, prebuilt image) always wins.
export const BROWSERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.browsers');

/**
 * The `fetchFile` loadTool() expects: resolve a `<id>/<rel>` path to its text.
 *
 * The resolver answers per tool, so an id is only ever matched against the profile's
 * own tool directories and can never name a path - stronger than the old join onto a
 * tools/ root, which is why tools.ts's id slug rule is a request-shape check now
 * rather than the thing standing between a crafted id and the filesystem. A `..` in
 * the tool-relative part is refused here for the same reason.
 */
export async function fetchToolFile(path: string): Promise<string> {
  const [id, ...rest] = path.split('/').filter(Boolean);
  const rel = rest.join('/');
  const abs = id && rel && !rest.includes('..') ? toolFile(id, rel, content()) : null;
  if (!abs) {
    const err = new Error(`ENOENT: no such tool file, open '${path}'`) as Error & { code?: string };
    err.code = 'ENOENT';
    throw err;
  }
  return readFile(abs, 'utf8');
}
