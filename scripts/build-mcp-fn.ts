// SPDX-License-Identifier: MPL-2.0
/**
 * Bundles the MCP serverless handler into a single self-contained
 * `api/mcp/[...path].js` - a catch-all so ONE function serves the JSON-RPC
 * endpoint (`/api/mcp`), the OAuth flow (`/api/mcp/{register,authorize,token}`),
 * and the `/.well-known/oauth-*` discovery docs (routed in via vercel.json).
 *
 * WHY THIS EXISTS
 * Vercel's @vercel/node builder transpiles each `.ts` file to `.js` individually
 * but leaves import *specifiers* untouched. The repo deliberately writes explicit
 * `.ts` extensions (so Node can run the sources directly - see CLAUDE.md), so the
 * traced function ends up full of `import ... from './x.ts'` pointing at files
 * that are now `x.js` → `ERR_MODULE_NOT_FOUND` at runtime.
 *
 * esbuild resolves and inlines ALL first-party code (api entry + services/mcp +
 * engine, following the `.ts` specifiers correctly) into one module. node_modules
 * stay EXTERNAL (`packages: 'external'`) so Vercel's file-tracer includes them
 * normally - this keeps native/wasm deps (@resvg/resvg-js, harfbuzz, jsdom) out
 * of the bundle where esbuild would choke on them.
 *
 * Runs during the Vercel build (see `build:mcp-fn` in package.json / vercel.json
 * buildCommand). The output `api/mcp/[...path].js` (a catch-all route) is
 * generated and committed (so it's present at Vercel function-detection time);
 * the buildCommand regenerates it fresh on every deploy. Only the sibling
 * `api/mcp/[...path].js.map` is git-ignored.
 *
 * A second, small bundle sits beside it: `api/mcp/_rondo-worker.js`, the Worker a
 * rondocode song renders in (packages/node-shell/src/rondo-worker.ts, plan 301).
 * A Worker needs a file of its own, and the underscore keeps Vercel from making it
 * a route. It inlines packages/rondo and the staging bundle's text
 * (packages/rondo/generated/stage.js, through `define`), and keeps QuickJS
 * (quickjs-emscripten-core and @jitl/quickjs-wasmfile-release-sync, whose
 * emscripten module reads its .wasm beside itself) external like every other
 * node_module. The main bundle refers to the worker as `new URL('./_rondo-worker.js',
 * import.meta.url)`, which Vercel's file tracer follows: it carries the worker and,
 * through the worker's imports, QuickJS and its .wasm (checked with @vercel/nft).
 */
import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoBareWorkspaceImports, workspaceAliases } from './lib/workspace-aliases.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Catch-all route file: api/mcp/[...path].js (the dir must exist for esbuild).
const outfile = path.join(root, 'api/mcp/[...path].js');
const ABSENT_RUNTIMES = ['onnxruntime-node', '@huggingface/transformers', '@napi-rs/canvas', 'phonemizer'];
const ABSENT_STUB = path.join(root, 'scripts/mcp-fn-absent-runtime.ts');

// Keep every emoji set in the function without spending its 250 MiB limit on
// expanded SVG strings. The web build still serves the original JSON bundles.
const packs = path.join(root, 'community/emoji-packs');
let rawBytes = 0, packedBytes = 0;
for (const name of await readdir(packs)) {
  if (!name.endsWith('.json') || name === 'index.json') continue;
  if (!name.includes('-')) throw new Error(`Emoji bundle ${name} does not match the function's exclusion pattern`);
  const source = await readFile(path.join(packs, name));
  const compressed = gzipSync(source, { level: 9 });
  await writeFile(path.join(packs, `${name}.gz`), compressed);
  rawBytes += source.byteLength;
  packedBytes += compressed.byteLength;
}
console.log(`Emoji function content: ${(rawBytes / 1024 ** 2).toFixed(1)} -> ${(packedBytes / 1024 ** 2).toFixed(1)} MiB`);

await mkdir(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: [path.join(root, 'services/mcp/src/vercel-entry.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // node_modules stay external - Vercel's tracer bundles them into the function.
  packages: 'external',
  // …but the workspace packages ARE first-party source: alias each to its real
  // entry so esbuild inlines it rather than leaving a bare, dangling import. Left
  // external, `@lolly-tools/<pkg>/<sub>` resolves at runtime to a TYPESCRIPT file
  // that is not in the deployed function - ERR_MODULE_NOT_FOUND on every request,
  // the whole service 500ing on module load rather than failing the build. A
  // hand-kept list did that on 2026-08-01 (a core subpath) and 2026-09-10
  // (node-shell/asset-bytes, a package the list never covered), so the aliases
  // now come from each package's own exports map (scripts/lib/workspace-aliases.ts).
  alias: {
    // The on-device ML/speech runtimes are aliased to a module that rejects on
    // import (see scripts/mcp-fn-absent-runtime.ts): the function never runs them
    // and, left as bare `import('onnxruntime-node')` strings, Vercel's tracer packs
    // hundreds of MB of native binaries into a function capped at 250 MB.
    ...Object.fromEntries(ABSENT_RUNTIMES.map((p) => [p, ABSENT_STUB])),
    ...workspaceAliases(root),
  },
  banner: { js: '// GENERATED by scripts/build-mcp-fn.ts - do not edit by hand.' },
  logLevel: 'info',
});

// The size guard the api-bundles CI job runs: a bundle that names one of the
// heavy runtimes would be traced into the function and fail the deploy, so fail
// the build here instead, where the cause is in view.
const bundled = await readFile(outfile, 'utf-8');
// Only import/require forms count: the tracer follows those, not the package
// names node-shell prints in its "install X" refusals.
const leaked = ABSENT_RUNTIMES.filter((p) =>
  new RegExp(`(?:import|require)\\(\\s*["']${p.replace(/[/@.-]/g, '\\$&')}["']|from\\s*["']${p.replace(/[/@.-]/g, '\\$&')}["']`).test(bundled),
);
if (leaked.length) {
  console.error(`✗ api/mcp/[...path].js still references ${leaked.join(', ')} - the Vercel tracer would pack them into the function`);
  process.exit(1);
}
// The other direction: a workspace import that escaped the alias map would be
// missing from the function entirely (see scripts/lib/workspace-aliases.ts).
assertNoBareWorkspaceImports(bundled, 'api/mcp/[...path].js');
console.log('✓ bundled api/mcp/[...path].js');

// The rondocode render Worker (see the header). Its stage text is defined in, so
// the deployed function needs no copy of packages/rondo on disk.
const workerOut = path.join(root, 'api/mcp/_rondo-worker.js');
const stageText = await readFile(path.join(root, 'packages/rondo/generated/stage.js'), 'utf8');
await build({
  entryPoints: [path.join(root, 'packages/node-shell/src/rondo-worker.ts')],
  outfile: workerOut,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  alias: workspaceAliases(root),
  define: { __LOLLY_RONDO_STAGE__: JSON.stringify(stageText) },
  banner: { js: '// GENERATED by scripts/build-mcp-fn.ts - do not edit by hand.' },
  logLevel: 'info',
});
const worker = await readFile(workerOut, 'utf-8');
assertNoBareWorkspaceImports(worker, 'api/mcp/_rondo-worker.js');
// The Worker must reach QuickJS as the external packages the function carries,
// and must not have kept the from-source path that reads packages/rondo off disk.
for (const pkg of ['quickjs-emscripten-core', '@jitl/quickjs-wasmfile-release-sync']) {
  if (!worker.includes(`from "${pkg}"`)) {
    console.error(`✗ api/mcp/_rondo-worker.js does not import ${pkg} - the song renderer would not start`);
    process.exit(1);
  }
}
if (!worker.includes('__rondoStage') || worker.includes('__LOLLY_RONDO_STAGE__')) {
  console.error('✗ api/mcp/_rondo-worker.js does not carry the staging bundle inline');
  process.exit(1);
}
console.log('✓ bundled api/mcp/_rondo-worker.js');
