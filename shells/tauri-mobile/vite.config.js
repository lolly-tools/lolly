import { defineConfig } from 'vite';
import { resolve, extname } from 'node:path';
import { existsSync, statSync, readFileSync, cpSync } from 'node:fs';

const webShell  = resolve(__dirname, '../web');
const repoRoot  = resolve(__dirname, '../..');

const MIME = {
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

function bundleRepoDirs() {
  return {
    name: 'bundle-repo-dirs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith('/tools/') && !url?.startsWith('/catalog/')) return next();
        const filePath = resolve(repoRoot, url.slice(1));
        if (!existsSync(filePath) || !statSync(filePath).isFile()) return next();
        const data = readFileSync(filePath);
        res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
        res.setHeader('Content-Length', data.byteLength);
        res.end(data);
      });
    },
    writeBundle(options) {
      const outDir = options.dir ?? resolve(__dirname, 'dist');
      for (const dir of ['catalog', 'tools']) {
        cpSync(resolve(repoRoot, dir), resolve(outDir, dir), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root: webShell,
  publicDir: resolve(webShell, 'public'),
  plugins: [bundleRepoDirs()],
  resolve: {
    alias: [
      {
        find: /.*\/bridge\/state\.js$/,
        replacement: resolve(__dirname, 'bridge-overrides/state.js'),
      },
    ],
  },
  server: {
    // Separate port from desktop dev server to allow running both simultaneously.
    port: 5174,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
