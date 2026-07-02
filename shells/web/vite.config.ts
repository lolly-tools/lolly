import { defineConfig, type Plugin } from 'vite';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, statSync, readFileSync, cpSync } from 'node:fs';

// ESM has no __dirname; derive this module's directory from its own URL. (Vite
// bundles the config and would shim __dirname, but deriving it keeps the source
// honest under plain ESM and under tsc.)
const here = dirname(fileURLToPath(import.meta.url));

// Repo root is two directories up from shells/web/.
const repoRoot = resolve(here, '..', '..');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

// Vite resolve.alias only rewrites JS import statements — it has no effect on
// browser fetch() calls. This plugin adds an actual HTTP handler for /tools/,
// /catalog/, and /schemas/ so that fetch('/tools/qr-code/tool.json') works in
// dev — and so the schema $id URLs (https://lolly.tools/schemas/*.schema.json)
// resolve to the real files in both dev and the production build.
function serveRepoStatic(): Plugin {
  return {
    name: 'serve-repo-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        // Serve /info/* directly from public/info/ before the SPA fallback runs.
        if (url?.startsWith('/info')) {
          const normalized = (url === '/info' || url === '/info/') ? '/info/index.html' : url;
          const filePath = resolve(here, 'public', normalized.slice(1));
          if (existsSync(filePath) && statSync(filePath).isFile()) {
            const data = readFileSync(filePath);
            res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'text/html; charset=utf-8');
            res.setHeader('Content-Length', data.byteLength);
            res.end(data);
            return;
          }
        }

        if (!url?.startsWith('/tools/') && !url?.startsWith('/catalog/') && !url?.startsWith('/schemas/')) return next();
        const filePath = resolve(repoRoot, url.slice(1));
        if (!existsSync(filePath) || !statSync(filePath).isFile()) return next();
        const data = readFileSync(filePath);
        res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
        res.setHeader('Content-Length', data.byteLength);
        res.end(data);
      });
    },
    closeBundle() {
      const outDir = resolve(here, 'dist');
      for (const dir of ['catalog', 'tools', 'schemas']) {
        const src = resolve(repoRoot, dir);
        if (existsSync(src)) cpSync(src, resolve(outDir, dir), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  plugins: [serveRepoStatic()],
  resolve: {
    alias: {
      '@lolly/engine': resolve(repoRoot, 'engine/src/index.ts'),
    },
  },
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: 'dist',
  },
});
