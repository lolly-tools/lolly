// SPDX-License-Identifier: MPL-2.0
/**
 * Repo-root resolution shared by every Node shell (CLI, TUI) and anything they pull in.
 *
 * The monorepo puts catalog/ + tools/ (the gitignored profile views) at the repo root,
 * a fixed number of directory levels above each shell's source — but a bundled build
 * (Vercel's esbuild function, scripts/build-mcp-fn.ts) flattens every module's
 * import.meta.url onto the single output file, so a fixed `../../..` no longer lands
 * on the repo root. Resolution order:
 *   1. LOLLY_ROOT — explicit override (checked against the marker)
 *   2. marker-based walk up from this module's directory (works from source AND from
 *      a bundle — the bundle sits under api/, two levels below the deployed root)
 *   3. process.cwd() — a serverless task cwd carries catalog/ via `includeFiles`
 *   4. the monorepo-relative guess (packages/node-shell/src → three levels up)
 * Mirrors services/mcp/src/paths.ts resolveRoot().
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A directory is the repo root when it carries a built catalog profile view. */
function hasMarker(root: string): boolean {
  return existsSync(join(root, 'catalog', 'tools', 'index.json'))
    || existsSync(join(root, 'catalog', 'assets', 'index.json'));
}

let cached: string | null = null;

/** Absolute path of the repo root (or the deployed task root) holding catalog/. */
export function repoRoot(): string {
  if (!cached) cached = resolve();
  return cached;
}

function resolve(): string {
  if (process.env.LOLLY_ROOT && hasMarker(process.env.LOLLY_ROOT)) return process.env.LOLLY_ROOT;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (hasMarker(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (hasMarker(process.cwd())) return process.cwd();
  // Last resort (e.g. a checkout whose profile views were never built): the
  // monorepo-relative guess.
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}
