// SPDX-License-Identifier: MPL-2.0
/** PDF rendering resources are served locally and loaded only by the viewer. */
import { readFileSync, readdirSync, createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
const require = createRequire(import.meta.url);
export function pdfViewerAssets(): Plugin {
  const root = dirname(require.resolve('pdfjs-dist/package.json'));
  const prefix = '/lib/pdfjs-6.4.299/';
  const files = new Map<string, string>();
  for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    for (const file of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (file.isFile()) files.set(`${prefix}${dir}/${file.name}`, join(root, dir, file.name));
    }
  }
  return { name: 'lolly-pdf-viewer-assets',
    generateBundle() { for (const [url, path] of files) this.emitFile({ type: 'asset', fileName: url.slice(1), source: readFileSync(path) }); },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = files.get((req.url ?? '').split('?')[0]!); if (!path) return next();
        res.setHeader('Content-Type', path.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'); createReadStream(path).pipe(res);
      });
    },
  };
}

/**
 * The element PDF.js's stylesheet is confined to: the scrolling container
 * shells/web/src/components/pdf-asset-viewer.ts hands to PDFViewer. The pages,
 * text layer and annotation layer all render inside it; the viewer's toolbar,
 * search and page rail are Lolly controls outside that container.
 */
export const PDF_VIEWER_SCOPE = '.asset-pdf-scroll';

/** The stylesheet the viewer imports, matched on its module id. */
const PDF_VIEWER_CSS = /[\\/]pdfjs-dist[\\/]web[\\/]pdf_viewer\.css$/;

/**
 * Custom properties PDF.js's own JavaScript reads from, or writes to, the
 * document root rather than the viewer: PDFViewer sets
 * `--viewer-container-height` inline on `<html>`, and the annotation editors
 * read `--outline-width` and `--freetext-padding` from `<html>`'s computed
 * style. Each one keeps its declaration on `:root`, so the scope element
 * neither hides the value PDF.js writes nor lacks the one PDF.js reads.
 * No Lolly stylesheet uses these names.
 */
export const PDF_JS_ROOT_VARS = ['--viewer-container-height', '--outline-width', '--freetext-padding'] as const;

/**
 * PDF.js's `pdf_viewer.css` with every rule confined to `scope`.
 *
 * The file is written for PDF.js's own viewer page, not for a component inside
 * another app. It styles bare class names such as `.sidebar`, `.dialog` and
 * `.toggle-button` and sets `color-scheme: light dark` on `:root`. Imported as
 * it stands, all of it reached the whole app the first time any PDF was
 * previewed, and stayed until the page reloaded. The tool sidebar then took
 * PDF.js's sidebar panel (#23222b when the computer is in dark mode) under
 * Lolly's own ink, and the root colour scheme stopped following the app theme.
 *
 * So the whole sheet is nested under `scope`. Its `:root` rules become the
 * scope element itself, and its `color-scheme: light dark` becomes `inherit`,
 * so the viewer follows the app theme rather than the computer's. The build's
 * CSS minifier unnests the result into plain selectors that all start with
 * `scope`. The only rule left on the document root is one block holding the
 * PDF_JS_ROOT_VARS declarations. A `:root` this rewrite does not recognise
 * throws, so a PDF.js update that adds one fails the build instead of leaking
 * again.
 */
export function scopePdfViewerCss(css: string, scope = PDF_VIEWER_SCOPE): string {
  const rootDecls: string[] = [];
  let body = css;
  for (const name of PDF_JS_ROOT_VARS) {
    body = body.replace(new RegExp(`^[ \\t]*${name}\\s*:[^;{}]*;[ \\t]*\\n`, 'gm'), (decl) => {
      rootDecls.push(decl.trim());
      return '';
    });
  }
  const scoped = body
    .replace(/^(\s*):root(?=\s*[{,])/gm, '$1&')
    .replace(/color-scheme:\s*light\s+dark\s*;/g, 'color-scheme: inherit;');
  const stray = /:root\b/.exec(scoped);
  if (stray) {
    const line = scoped.slice(0, stray.index).split('\n').length;
    throw new Error(`pdf_viewer.css: a :root selector on line ${line} is not in a form scopePdfViewerCss rewrites`);
  }
  const root = rootDecls.length ? `:root {\n  ${rootDecls.join('\n  ')}\n}\n` : '';
  return `${scope} {\n${scoped}\n}\n${root}`;
}

/** Confines PDF.js's viewer stylesheet before Vite's own CSS pipeline reads the file. */
export function pdfViewerCssScope(): Plugin {
  return {
    name: 'lolly-pdf-viewer-css-scope',
    enforce: 'pre',
    transform(code, id) {
      const [path, query = ''] = id.split('?');
      if (!PDF_VIEWER_CSS.test(path!)) return null;
      // `?raw` and `?url` turn the file into a JavaScript module before this
      // hook runs, so only the stylesheet forms are rewritten (a plain import,
      // `?direct`, `?inline` and the dev server's `?t=` reloads).
      const params = new URLSearchParams(query);
      if (params.has('raw') || params.has('url')) return null;
      return { code: scopePdfViewerCss(code), map: null };
    },
  };
}
