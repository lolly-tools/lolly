// SPDX-License-Identifier: MPL-2.0
/**
 * Repo-root resolution shared by every Node shell (CLI, TUI) and anything they pull in.
 *
 * Two kinds of directory answer "this is a Lolly content root", and the marker has to
 * accept both (plan 244 step 5.1):
 *
 *  - A CHECKOUT, which carries `profiles.json` naming each profile's content packs
 *    (community/, brands/*). This is the marker in a clone, a CI lane and the deployed
 *    Vercel task, and it replaces the old `catalog/tools/index.json` one: the repo-root
 *    `tools/` and `catalog/` symlink views that used to carry it are gone.
 *  - A MATERIALIZED root: a real `tools/` + `catalog/` tree, which is what
 *    `materializeInto` writes. The desktop app exports one beside itself and points
 *    LOLLY_ROOT at it (shells/tauri-desktop/src-tauri/src/root_export.rs), the RPM
 *    payload and the Docker image ship one, and the CLI contract suites build one as a
 *    fixture. Those roots have no profiles.json and never will - the tree they carry is
 *    one profile's composed output.
 *
 * A bundled build (Vercel's esbuild function, scripts/build-mcp-fn.ts) flattens every
 * module's import.meta.url onto the single output file, so a fixed `../../..` no longer
 * finds the root. Resolution order:
 *   1. LOLLY_ROOT: explicit override (checked against the marker)
 *   2. marker-based walk up from this module's directory (works from source AND from
 *      a bundle: the bundle sits under api/, two levels below the deployed root)
 *   3. process.cwd(): a serverless task cwd carries the packs via `includeFiles`
 *   4. the monorepo-relative guess (packages/node-shell/src → three levels up)
 * Mirrors services/mcp/src/paths.ts.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A real `tools/` + `catalog/` tree, i.e. a materializeInto output rather than a
 *  checkout. Read by content-roots.ts, which serves such a root as a single composed
 *  profile because there is no profiles.json to consult. */
export function isMaterializedRoot(root: string): boolean {
  if (!existsSync(join(root, 'tools'))) return false;
  return existsSync(join(root, 'catalog', 'tools', 'index.json'))
    || existsSync(join(root, 'catalog', 'assets', 'index.json'));
}

/** A directory holds Lolly content: a checkout (profiles.json) or a materialized root.
 *  Exported so a shell can ASK whether it has content at all rather than keeping a
 *  second copy of this rule; shells/cli/src/content-root.ts asks the resolver instead,
 *  which is the stronger question ("does a profile here actually resolve"). */
export function hasContentMarker(root: string): boolean {
  return existsSync(join(root, 'profiles.json')) || isMaterializedRoot(root);
}

let cached: string | null = null;

/** Absolute path of the repo root (or the deployed task root) holding the content. */
export function repoRoot(): string {
  if (!cached) cached = resolve();
  return cached;
}

function resolve(): string {
  if (process.env.LOLLY_ROOT && hasContentMarker(process.env.LOLLY_ROOT)) return process.env.LOLLY_ROOT;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (hasContentMarker(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (hasContentMarker(process.cwd())) return process.cwd();
  // Last resort (e.g. a published CLI with no content anywhere above it): the
  // monorepo-relative guess.
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}
