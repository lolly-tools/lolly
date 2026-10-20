// SPDX-License-Identifier: MPL-2.0
/**
 * Build the page-walk script: `shells/web/src/capture/page-walk.ts` and the export
 * walker it runs, bundled into one self-contained classic script that a capture
 * injects into a third-party page (it defines `globalThis.__lollyPageWalk`).
 *
 * Built, not committed. Every consumer has esbuild at hand when it needs the
 * script: the CLI and TUI run from source, the web build's Vite plugin calls this
 * at build time, and the MCP function bundle inlines the result when it is
 * bundled. One build per process, cached.
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

let cached: Promise<string> | null = null;

/** The injectable page-walk script source. Throws when esbuild is not installed. */
export function pageWalkScript(): Promise<string> {
  cached ??= buildPageWalkScript().catch((e: unknown) => { cached = null; throw e; });
  return cached;
}

export async function buildPageWalkScript(opts: { minify?: boolean } = {}): Promise<string> {
  const { build } = await import('esbuild');
  const out = await build({
    entryPoints: [PAGE_WALK_ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: opts.minify ?? true,
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
