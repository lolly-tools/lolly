// SPDX-License-Identifier: MPL-2.0
/**
 * Filesystem anchors for the MCP server.
 *
 * The server reads tool source (tools/<id>/) and the generated catalog from the
 * monorepo, exactly as the CLI does. REPO_ROOT is resolved relative to this
 * file. When this package is split into its own repo (see plans/77-mcp-server.md),
 * only these constants + how tool files are fetched need to change: point
 * fetchToolFile at a vendored snapshot or a remote catalog sync.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Relative import (not `@lolly-tools/node-shell/...`): this file is inlined into the
// serverless bundle, same as render.ts's node-shell imports.
import { repoRoot } from '../../../packages/node-shell/src/repo-root.ts';

// The repo root holding tools/ + catalog/ comes from the ONE shared resolver
// (node-shell/repo-root), in this order: LOLLY_ROOT, then a marker walk UP from
// the module dir (this is the form that survives this bundle, whose flattened
// import.meta.url sits under api/, two levels below the deployed root), then cwd
// (Vercel preserves the data dirs there via `includeFiles`), then the
// monorepo-relative guess. This file used to carry a weaker twin with a fixed
// `../../..` and no walk-up. node-shell's header was written to replace it, but
// this call site was never rewired to use it.
export const REPO_ROOT = repoRoot();
export const TOOLS_DIR = join(REPO_ROOT, 'tools');
export const CATALOG_INDEX = join(REPO_ROOT, 'catalog', 'tools', 'index.json');
export const ASSET_INDEX = join(REPO_ROOT, 'catalog', 'assets', 'index.json');
export const FONTS_DIR = join(REPO_ROOT, 'catalog', 'fonts');

// Scoped Chromium install for the Tier-B (headless-browser) render path. Anchored
// to THIS package's root, not the monorepo, so it travels with the repo split
// (plans/77-mcp-server.md). `pnpm run install:browser` downloads Chromium here; the
// installer and render.ts point PLAYWRIGHT_BROWSERS_PATH at it. An explicit
// PLAYWRIGHT_BROWSERS_PATH (container system cache, prebuilt image) always wins.
export const BROWSERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.browsers');

/** The `fetchFile` loadTool() expects: resolve a tool-relative path to its text. */
export function fetchToolFile(path: string): Promise<string> {
  return readFile(join(TOOLS_DIR, path), 'utf8');
}
