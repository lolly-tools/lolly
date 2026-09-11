import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import {
  embedContentPlugins, injectModelsBase, resolveEmbedMode,
} from '../tauri-shared/vite-embed.mjs';
import { tauriCspMeta } from '../tauri-shared/vite-csp.mjs';
// Borrowed from the web shell's config, which owns the format. See the plugin list.
import { precacheManifest } from '../web/vite.config.js';

const webShell  = resolve(__dirname, '../web');
const repoRoot  = resolve(__dirname, '../..');

// The web shell migrated .js → .ts but still references some files by a .js
// specifier (index.html's `/src/main.js` entry; a few `../lib/*.js` imports). The
// web shell's newer rolldown-vite resolves those implicitly; this shell pins an
// older Vite that does not, so map a MISSING .js to its sibling .ts. Only fires
// when the .js is absent and the .ts exists, so it never shadows a real .js.
function jsToTsFallback() {
  return {
    name: 'js-to-ts-fallback',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!source.endsWith('.js')) return null;
      let jsPath;
      if (source.startsWith('/')) jsPath = resolve(webShell, source.slice(1));
      else if (source.startsWith('.') && importer) jsPath = resolve(dirname(importer.split('?')[0]), source);
      else return null; // bare / node_modules specifier - leave alone
      if (existsSync(jsPath)) return null; // a real .js - don't touch it
      const tsPath = jsPath.slice(0, -3) + '.ts';
      return existsSync(tsPath) ? tsPath : null;
    },
  };
}

// Embedded content mode (plans/131 WP-A) - the machinery lives in
// ../tauri-shared/vite-embed.mjs, SHARED with the mobile shell so the two
// configs cannot drift. Default 'neutral' (start brand), matching mobile
// (2026-08-23): every shipped app is the neutral build, and SUSE folks load
// the SUSE brand from a .lolly pack until the internal hosted instance
// exists. `pnpm run build:profile` flips it back to embedding the active
// repo-root profile views for an internal build.
const EMBED_CATALOG = resolveEmbedMode(process.env.LOLLY_EMBED_CATALOG, 'neutral');


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
      // Redirect the web bridge's own sibling imports (./state, ./capture,
      // ./capabilities-provided) to the Tauri versions. Matched by the source's
      // basename + the importer living in a bridge/ dir, so it works for BOTH the
      // absolute fs importer (`vite build`) and the root-relative URL importer the
      // dev server passes (`/src/bridge/index`).
      if (!/[\\/]bridge[\\/]/.test(importer.split('?')[0])) return null;
      // Match on the extension-LESS basename so it holds whether the web bridge
      // imports ./state.js OR ./state.ts. The bridge switched to explicit .ts
      // specifiers (JS→TS migration); keying on '.js' silently missed every
      // override, so the shell shipped web IndexedDB state + a throwing capture stub.
      const name = source.split('?')[0].replace(/^.*[\\/]/, '').replace(/\.[jt]s$/, '');
      return map[name] ?? null;
    },
  };
}

// The desktop shell ships a SMALL bundle (pruneEmbeddedDownloads strips
// dist/models/), so the on-device ML models must be fetched from a model host at
// runtime rather than same-origin. Bake the model host into lib/models-base.ts's
// MODELS_BASE so it applies ONLY to the desktop frontend - the web deploy keeps
// the empty default and self-serves /models/. An override may be passed in the
// environment (VITE_MODELS_BASE).
const MODELS_HOST = process.env.VITE_MODELS_BASE ?? 'https://lolli.li';


export default defineConfig({
  root: webShell,
  publicDir: resolve(webShell, 'public'),
  plugins: [
    // The app's Content Security Policy rides in as a <meta> tag: with a CSP in
    // tauri.conf.json, Tauri's codegen re-serialises every .html asset - the tool
    // templates included - and the signed digests no longer match.
    // Policy + rationale: ../tauri-shared/vite-csp.mjs.
    tauriCspMeta(),
    injectModelsBase(MODELS_HOST),
    jsToTsFallback(),
    overrideBridgeModules({
      'state': resolve(__dirname, 'bridge-overrides/state.ts'),
      'capture': resolve(__dirname, 'bridge-overrides/capture.ts'),
      'capabilities-provided': resolve(__dirname, 'bridge-overrides/capabilities-provided.ts'),
      'export': resolve(__dirname, 'bridge-overrides/export.ts'),
      // There is deliberately no 'matte' override. It existed for ONE model, the
      // full BiRefNet, which needed native ORT because it overran the wasm32
      // address space; both BiRefNet models are gone from the catalogue and every
      // remaining matte model fits the wasm heap, so the desktop shell runs the
      // SAME shared wasm runner as web and CLI.
      // There used to be a 'site-fetch' entry here, for a
      // shells/web/src/bridge/site-fetch.ts that was never added. Removed
      // 2026-09-05 (dead: the map key matched no web module, so it never fired).
      // The Website source reaches the native site_fetch command a different
      // way - see README.md, "Website source transport".
    }),
    // LAST, deliberately: it scans the finished dist/, so it must run after
    // embedContentPlugins' pruneEmbeddedDownloads has removed dist/models/ - otherwise
    // the listing describes files that were then deleted. Model entries are filled in
    // from the committed shells/web/models-manifest.json instead, which is what the
    // rewrite-served web deploys already rely on.
    //
    // Without this the desktop build emitted NO precache.json, and every row of the
    // "Available offline" manager is gated on it (`partAvailable` in
    // views/profile.ts), so the whole model list read "Not offered by this server"
    // even though lolly.tools was serving the models correctly.
    ...embedContentPlugins({
      outDirDefault: resolve(__dirname, 'dist'),
      mode: EMBED_CATALOG,
    }),
    precacheManifest(),
  ],
  // Match shells/web/vite.config.js: the web shell renders ZzFXM songs and encodes
  // video in MODULE workers (src/lib/zzfxm-worker.ts, src/bridge/video-encode.worker.ts),
  // and Vite's default worker format is `iife`, which rollup refuses for a
  // code-splitting build. This config does not extend the web one - it rebuilds the
  // options object by hand - so every such setting has to be repeated here, and this
  // one was not: the desktop/mobile FRONTEND build has failed with
  // `Invalid value "iife" for option "output.format"` since the second worker landed
  // (2026-07-20). Keep in sync with the web shell.
  worker: { format: 'es', plugins: () => [injectModelsBase(MODELS_HOST)] },
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
    // which harfbuzzjs (text-to-path WASM) relies on - without this the frontend
    // build fails in esbuild transpile.
    target: 'esnext',
  },
});
