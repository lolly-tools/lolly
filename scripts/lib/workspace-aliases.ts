// SPDX-License-Identifier: MPL-2.0
/**
 * The workspace packages a serverless bundle must INLINE, read from each
 * package's own `exports` map so a new subpath can never be left behind as a
 * bare import again.
 *
 * The bundles (scripts/build-mcp-fn.ts, scripts/build-ca-fn.ts) keep node_modules
 * external for Vercel's file tracer. A workspace package left external resolves,
 * at runtime, to a TypeScript file that is not in the deployed function -
 * ERR_MODULE_NOT_FOUND on every request, the whole function 500ing on module
 * load rather than the build failing. It broke that way on 2026-08-01
 * (`@lolly-tools/core`, hand-listed aliases missed a subpath) and again on
 * 2026-09-10 (`@lolly-tools/node-shell/asset-bytes`, a package the list never
 * covered). Generating the aliases from the exports maps closes both holes;
 * `assertNoBareWorkspaceImports` is the guard on the output for anything else.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const WORKSPACE_PACKAGES: Record<string, string> = {
  '@lolly-tools/core': 'packages/core',
  '@lolly-tools/node-shell': 'packages/node-shell',
};

function exportTarget(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return exportTarget(v.import ?? v.node ?? v.default ?? null);
  }
  return null;
}

/** esbuild `alias` entries: the engine plus every subpath each workspace package exports. */
export function workspaceAliases(root: string): Record<string, string> {
  const alias: Record<string, string> = { '@lolly/engine': path.join(root, 'engine/src/index.ts') };
  for (const [name, dir] of Object.entries(WORKSPACE_PACKAGES)) {
    const pkg = JSON.parse(readFileSync(path.join(root, dir, 'package.json'), 'utf8')) as { exports?: Record<string, unknown> };
    for (const [sub, value] of Object.entries(pkg.exports ?? {})) {
      const target = exportTarget(value);
      if (!target) continue;
      const specifier = sub === '.' ? name : `${name}/${sub.replace(/^\.\//, '')}`;
      alias[specifier] = path.join(root, dir, target);
    }
  }
  return alias;
}

// Only import forms, each on its own line the way esbuild emits them; an error
// message that happens to say `from '@lolly-tools/core'` is not an import.
const BARE_IMPORT_RE = /(?:^|\n)\s*(?:import|export)\b[^\n;]*?\bfrom\s*["'](@lolly(?:-tools)?\/[^"']+)["']|\b(?:import|require)\s*\(\s*["'](@lolly(?:-tools)?\/[^"']+)["']\s*\)/g;

/** Exit the build when `bundled` still names a workspace package as a bare import. */
export function assertNoBareWorkspaceImports(bundled: string, outfile: string): void {
  const leaked = new Set<string>();
  for (const m of bundled.matchAll(BARE_IMPORT_RE)) leaked.add(m[1] ?? m[2] ?? '');
  leaked.delete('');
  if (!leaked.size) return;
  console.error(`✗ ${outfile} still imports ${[...leaked].join(', ')} as bare specifiers - ERR_MODULE_NOT_FOUND in the deployed function`);
  process.exit(1);
}
