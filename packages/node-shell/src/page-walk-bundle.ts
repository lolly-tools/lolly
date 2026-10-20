// SPDX-License-Identifier: MPL-2.0
/**
 * Build the page-walk script: `shells/web/src/capture/page-walk.ts` and the export
 * walker it runs, bundled into one self-contained classic script that a capture
 * injects into a third-party page (it defines `globalThis.__lollyPageWalk`).
 *
 * Built, not committed. The CLI and TUI run from source and build the script on
 * first use, once per process. The MCP function has no esbuild where it runs, so
 * scripts/build-mcp-fn.ts builds the script at bundle time and defines it in as
 * `__LOLLY_PAGE_WALK__`, the way it carries the rondocode stage.
 *
 * The font registry is swapped for `page-walk-fonts.ts` (see that file for why),
 * and `import.meta.env` carries the values a production Vite build gives the app.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = resolve(HERE, '../../../shells/web/src');
export const PAGE_WALK_ENTRY = join(WEB_SRC, 'capture/page-walk.ts');
const FONT_STUB = join(WEB_SRC, 'capture/page-walk-fonts.ts');

/** The script, defined in by a bundler that built it ahead of time. Undefined from source. */
declare const __LOLLY_PAGE_WALK__: string | undefined;

let cached: Promise<string> | null = null;

/** The injectable page-walk script source. Throws when esbuild is not installed. */
export function pageWalkScript(): Promise<string> {
  if (typeof __LOLLY_PAGE_WALK__ === 'string') return Promise.resolve(__LOLLY_PAGE_WALK__);
  cached ??= buildPageWalkScript().catch((e: unknown) => { cached = null; throw e; });
  return cached;
}

/** `mangle: false` keeps identifiers as written while still minifying (see build-mcp-fn.ts). */
export async function buildPageWalkScript(opts: { minify?: boolean; mangle?: boolean } = {}): Promise<string> {
  const { build } = await import('esbuild');
  const out = await build({
    entryPoints: [PAGE_WALK_ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minifyWhitespace: opts.minify ?? true,
    minifySyntax: opts.minify ?? true,
    minifyIdentifiers: (opts.minify ?? true) && opts.mangle !== false,
    legalComments: 'none',
    logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'production', BASE_URL: '/' }) },
    loader: { '.css': 'empty', '.wasm': 'empty' },
    plugins: [{
      name: 'page-walk-stubs',
      setup(b) {
        b.onResolve({ filter: /(^|\/)font-registry\.ts$/ }, () => ({ path: FONT_STUB }));
      },
    }],
  });
  const file = out.outputFiles[0];
  if (!file) throw new Error('page-walk build produced no output');
  return file.text;
}
