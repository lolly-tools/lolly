// SPDX-License-Identifier: MPL-2.0
/** Emit the shared player as a small app resource that HTML export embeds verbatim. */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function portablePlayer(): Plugin {
  const entry = fileURLToPath(new URL('../src/bridge/portable-player.ts', import.meta.url));
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const watched = new Set<string>();
  let base = '/', cached: Promise<string> | null = null;
  const source = () => {
    if (cached) return cached;
    cached = build({ entryPoints: [entry], absWorkingDir: root, bundle: true, write: false,
    format: 'iife', platform: 'browser', target: 'es2022', minify: true, metafile: true,
    alias: { '@lolly/engine': resolve(root, 'engine/src/index.ts') } }).then(result => {
      for (const path of Object.keys(result.metafile!.inputs)) watched.add(resolve(root, path));
      return result.outputFiles[0]!.text;
    });
    return cached;
  };
  return {
    name: 'lolly-portable-player',
    configResolved(config) { base = config.base; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== base + 'portable/player.js') return next();
        try { const script = await source(); for (const path of watched) server.watcher.add(path);
          res.setHeader('Content-Type', 'text/javascript'); res.setHeader('Cache-Control', 'no-cache'); res.end(script);
        } catch (error) { next(error); }
      });
    },
    handleHotUpdate(ctx) { if (watched.has(ctx.file)) cached = null; },
    async generateBundle() { this.emitFile({ type: 'asset', fileName: 'portable/player.js', source: await source() }); },
  };
}
