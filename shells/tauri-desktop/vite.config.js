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

// In dev the Vite dev-server middleware handles /tools/ and /catalog/ requests.
// In production they must be copied into dist/ so the Tauri WebView can reach them.
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

// Swap specific web-shell bridge modules for Tauri-native implementations.
// Implemented as a resolveId plugin rather than resolve.alias because the bridge
// imports are RELATIVE siblings ("./capture.js" from bridge/index.js): a path
// regex can't match a relative specifier without also risking same-named files
// elsewhere, so we resolve against the importer and replace only the exact web
// bridge file. (state.js → filesystem state; capture.js → native page capture.)
function overrideBridgeModules(map) {
  return {
    name: 'override-bridge-modules',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null;
      // Redirect the web bridge's own sibling imports (./state.ts, ./capture.ts,
      // ./capabilities-provided.ts) to the Tauri versions. Matched by the source's
      // basename + the importer living in a bridge/ dir, so it works for BOTH the
      // absolute fs importer (`vite build`) and the root-relative URL importer the
      // dev server passes (`/src/bridge/index.js`).
      if (!/[\\/]bridge[\\/]/.test(importer.split('?')[0])) return null;
      const name = source.split('?')[0].replace(/^.*[\\/]/, '');
      return map[name] ?? null;
    },
  };
}

export default defineConfig({
  root: webShell,
  publicDir: resolve(webShell, 'public'),
  plugins: [
    overrideBridgeModules({
      'state.ts': resolve(__dirname, 'bridge-overrides/state.js'),
      'capture.ts': resolve(__dirname, 'bridge-overrides/capture.js'),
      'capabilities-provided.ts': resolve(__dirname, 'bridge-overrides/capabilities-provided.js'),
    }),
    bundleRepoDirs(),
  ],
  // The dev server pre-bundles deps with esbuild, whose default target rejects
  // harfbuzzjs's top-level await (same issue as build.target below). Without this
  // the dev server boots then crashes as soon as a module pulls in harfbuzz.
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // The desktop shell always runs in a modern Tauri WebView (recent Chromium /
    // WebKit), so target esnext. The default (es2020) forbids top-level await,
    // which harfbuzzjs (text-to-path WASM) relies on — without this the frontend
    // build fails in esbuild transpile.
    target: 'esnext',
  },
});
