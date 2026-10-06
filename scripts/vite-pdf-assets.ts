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
