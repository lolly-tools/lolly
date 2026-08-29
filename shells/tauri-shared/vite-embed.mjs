// SPDX-License-Identifier: MPL-2.0
/**
 * Shared embedded-content machinery for the Tauri shells' vite configs
 * (plans/131 WP-A). BOTH shells import from here - the desktop config and the
 * mobile config used to carry hand-kept copies of these plugins, and the copy
 * drifted (the mobile one still had the cpSync dereference bug and no neutral
 * mode). Parent-owned for the same reason bridge-overrides/state-fs.ts is:
 * logic both Tauri shells must agree on lives outside both submodules.
 *
 * What the mode means (each shell picks its own default):
 *   'profile' - embed the active repo-root tools/ + catalog/ views as ever.
 *   'neutral' - the community/app-store build: the lolly-start TOOLSET
 *               (community ∪ brands/lolly-start/tools, composed independently
 *               of the ACTIVE view) plus a ~1 MB neutral catalog seed - the
 *               generated tool index, the asset index filtered to the entries
 *               whose bytes ride along, and those bytes - plus the tool
 *               gallery previews/ so the gallery paints on first run offline.
 *               No og/, no loops/modules media: brand content arrives from the
 *               instance the user connects (lib/instance.ts) or a loaded
 *               .lolly pack. Also drops the /info narration audio (plans/131
 *               B.3: Listen moves to device TTS in the apps).
 *
 * Plain .mjs, node built-ins only: it runs inside each shell's own Vite
 * process via a relative import, so it can depend on nothing either shell
 * would have to install.
 */

import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

// Asset-id prefixes the neutral seed EXCLUDES. An id prefix, not a path glob,
// so a future asset added to an excluded family stays excluded. Everything
// else in the lolly-start asset index ships with its bytes.
const NEUTRAL_EXCLUDED_ASSET_PREFIXES = ['lolly/loops/', 'lolly/modules/'];

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

/** Validate a shell's mode choice loudly at config-eval time. */
export function resolveEmbedMode(value, fallback) {
  const mode = value ?? fallback;
  if (!['profile', 'neutral'].includes(mode)) {
    throw new Error(`LOLLY_EMBED_CATALOG must be 'profile' or 'neutral', got '${mode}'`);
  }
  return mode;
}

// fs.cpSync's `dereference: true` does NOT resolve nested directory symlinks
// (verified on Node v24.19.0: copying the tools/ symlink farm reproduces the
// links) - which is how earlier dmgs embedded dist/tools/* as ABSOLUTE
// symlinks into this repo, resolvable only on the build machine. Hand-rolled
// walk: statSync/copyFileSync follow links, so every entry lands as real
// bytes. assertDistState backstops it - a symlink anywhere in dist fails the
// build.
function copyTreeDereferenced(src, dest) {
  if (!statSync(src).isDirectory()) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    return;
  }
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (entry === '.DS_Store') continue;
    copyTreeDereferenced(join(src, entry), join(dest, entry));
  }
}

/** The blank-brand profile's tool set: community ∪ brands/lolly-start/tools,
 *  later roots winning on id collisions - the same merge
 *  scripts/use-profile.ts performs, minus the overlay (`extends`) machinery,
 *  which the lolly-start profile does not use. A manifest in these roots
 *  declaring `extends` fails the build loudly rather than embedding a
 *  partial tool. */
function planNeutralTools(repoRoot) {
  const cfg = JSON.parse(readFileSync(join(repoRoot, 'profiles.json'), 'utf8'));
  const profile = cfg.profiles['lolly-start'];
  if (!profile) throw new Error('profiles.json has no "lolly-start" profile - the neutral build embeds the blank brand');
  const plan = new Map();
  for (const root of profile.tools) {
    const rootAbs = join(repoRoot, root);
    for (const entry of readdirSync(rootAbs)) {
      if (entry.startsWith('.') || entry.startsWith('_') || entry === 'node_modules') continue;
      const src = join(rootAbs, entry);
      if (!statSync(src).isDirectory()) continue;
      let manifest = null;
      try { manifest = JSON.parse(readFileSync(join(src, 'tool.json'), 'utf8')); }
      catch { /* missing/malformed manifest - validate:catalog owns reporting that */ }
      if (manifest && typeof manifest.extends === 'string') {
        throw new Error(
          `${root}/${entry} declares "extends" - the neutral embed has no overlay composer; ` +
          `port scripts/use-profile.ts's composeToolDir before embedding overlay tools`,
        );
      }
      plan.set(entry, src);
    }
  }
  for (const id of profile.exclude ?? []) plan.delete(id);
  return plan;
}

/** The neutral catalog seed: the generated tool index, the filtered asset
 *  index, and exactly the bytes the kept entries reference - resolved from
 *  each entry's format urls, no dir-level heuristics, so the seed can never
 *  silently include an excluded family or reference a file it didn't embed. */
function copyNeutralCatalog(repoRoot, outDir) {
  const brandCatalog = join(repoRoot, 'brands/lolly-start/catalog');
  const destCatalog = join(outDir, 'catalog');
  copyTreeDereferenced(join(brandCatalog, 'tools'), join(destCatalog, 'tools'));
  // Gallery thumbnails (~7 MB of rendered previews) ride along so the gallery
  // paints on first run OFFLINE, instead of live-rendering every tile - the
  // wait a fresh install shows. Just previews/ - not the 23 MB of og/ cards or
  // the excluded loops/modules media - so the app-store build stays lean.
  copyTreeDereferenced(join(brandCatalog, 'previews'), join(destCatalog, 'previews'));
  const index = JSON.parse(readFileSync(join(brandCatalog, 'assets/index.json'), 'utf8'));
  const kept = index.assets.filter((a) => !NEUTRAL_EXCLUDED_ASSET_PREFIXES.some((p) => a.id.startsWith(p)));
  mkdirSync(join(destCatalog, 'assets'), { recursive: true });
  writeFileSync(join(destCatalog, 'assets/index.json'), JSON.stringify({ ...index, assets: kept }, null, 2) + '\n');
  for (const asset of kept) {
    for (const fmt of asset.formats ?? []) {
      if (!fmt.url?.startsWith('/catalog/')) continue;
      const rel = fmt.url.slice('/catalog/'.length);
      copyTreeDereferenced(join(brandCatalog, rel), join(destCatalog, rel));
    }
  }
  for (const doc of ['README.md', 'NOTICE.md']) {
    if (existsSync(join(brandCatalog, doc))) copyFileSync(join(brandCatalog, doc), join(destCatalog, doc));
  }
}

/**
 * In dev the Vite dev-server middleware handles /tools/ and /catalog/
 * requests (always against the ACTIVE profile views - the neutral mode is a
 * build concern). In production they must be copied into dist/ so the Tauri
 * WebView can reach them.
 */
export function bundleRepoDirs({ repoRoot, outDirDefault, mode }) {
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
      const outDir = options.dir ?? outDirDefault;
      if (mode === 'profile') {
        for (const dir of ['catalog', 'tools']) {
          copyTreeDereferenced(resolve(repoRoot, dir), resolve(outDir, dir));
        }
        return;
      }
      // neutral: the blank-brand tool set + the seed catalog; the active repo
      // views are not consulted, so any profile can stay active locally.
      for (const [id, src] of planNeutralTools(repoRoot)) {
        copyTreeDereferenced(src, join(outDir, 'tools', id));
      }
      copyNeutralCatalog(repoRoot, outDir);
      // Plans/131 B.3: the apps drop the baked Listen narration (~30 MB of
      // .opus that compresses no further). Removing audio-index.json with it
      // makes the player's track resolution return null, so a Listen press
      // no-ops instead of 404ing mid-play.
      rmSync(join(outDir, 'info/audio'), { recursive: true, force: true });
      rmSync(join(outDir, 'info/audio-index.json'), { force: true });
    },
  };
}

/**
 * Keep runtime-downloaded assets OUT of the embedded frontend. The on-device
 * ML models under public/models/ (~1 GB, gitignored + staged) are fetched at
 * RUNTIME via the offline download manager, but Vite's publicDir copy pulls
 * the whole public/ tree into dist/, and Tauri embeds all of frontendDist
 * into the binary. Embedding them pushes the crate past linkable size (the
 * desktop build died on exactly this), so prune them back out after the copy:
 * the apps download them on first use, the same as web.
 */
export function pruneEmbeddedDownloads({ outDirDefault }) {
  const RUNTIME_FETCHED = ['models'];
  return {
    name: 'prune-embedded-downloads',
    writeBundle(options) {
      const outDir = options.dir ?? outDirDefault;
      for (const dir of RUNTIME_FETCHED) {
        rmSync(resolve(outDir, dir), { recursive: true, force: true });
      }
    },
  };
}

/** Fail the build unless dist/ is self-contained and shaped as the mode
 *  promises. */
export function assertDistState({ outDirDefault, mode }) {
  const findSymlinks = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) out.push(p);
      else if (st.isDirectory()) findSymlinks(p, out);
    }
    return out;
  };
  return {
    name: 'assert-dist-state',
    writeBundle(options) {
      const outDir = options.dir ?? outDirDefault;
      const links = findSymlinks(outDir);
      if (links.length) {
        throw new Error(`dist/ contains ${links.length} symlink(s) - the embed would depend on this machine's paths. First: ${links[0]}`);
      }
      const must = (p, why) => {
        if (!existsSync(join(outDir, p))) throw new Error(`dist/${p} missing - ${why}`);
      };
      const mustNot = (p, why) => {
        if (existsSync(join(outDir, p))) throw new Error(`dist/${p} present - ${why}`);
      };
      must('catalog/tools/index.json', 'the embedded tool index');
      must('tools/qr-code/tool.json', 'community tools embed in every mode');
      mustNot('models', 'runtime-downloaded models must never embed (pruneEmbeddedDownloads)');
      if (mode === 'neutral') {
        must('catalog/previews/bundle.json', 'gallery thumbnails embed so first run paints instead of live-rendering every tile');
        mustNot('catalog/og', 'the neutral seed carries no og cards');
        mustNot('catalog/assets/lolly/loops', 'excluded asset family (NEUTRAL_EXCLUDED_ASSET_PREFIXES)');
        mustNot('catalog/assets/lolly/modules', 'excluded asset family (NEUTRAL_EXCLUDED_ASSET_PREFIXES)');
        mustNot('info/audio', 'the apps drop baked narration (plans/131 B.3)');
        mustNot('info/audio-index.json', 'removed with the narration so the Listen player resolves null');
        must('catalog/assets/lolly/tokens/brand.json', 'the neutral brand tokens are the point of the seed');
        const index = JSON.parse(readFileSync(join(outDir, 'catalog/assets/index.json'), 'utf8'));
        for (const asset of index.assets) {
          for (const fmt of asset.formats ?? []) {
            if (fmt.url?.startsWith('/catalog/') && !existsSync(join(outDir, 'catalog', fmt.url.slice('/catalog/'.length)))) {
              throw new Error(`neutral seed: ${asset.id} references ${fmt.url} but the file was not embedded`);
            }
          }
        }
      }
    },
  };
}

/**
 * Inline the model host into MODELS_BASE at its single source
 * (lib/models-base.ts). Why a transform and not `define`: Vite's top-level
 * `define` is NOT forwarded to the separate WORKER bundles, so the speech
 * workers (which import MODELS_BASE) would keep the same-origin '' default
 * and 404 for /models/ in the apps. Register this for BOTH the main build
 * and the worker build (worker.plugins).
 */
export function injectModelsBase(value) {
  return {
    name: 'inject-models-base',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]lib[\\/]models-base\.ts(\?|$)/.test(id)) return null;
      const out = code.replace("import.meta.env?.VITE_MODELS_BASE", JSON.stringify(value));
      if (out === code) throw new Error('inject-models-base: expected VITE_MODELS_BASE read not found in models-base.ts');
      return { code: out, map: null };
    },
  };
}

/** The three content plugins in the order the write hooks must run. */
export function embedContentPlugins(opts) {
  return [bundleRepoDirs(opts), pruneEmbeddedDownloads(opts), assertDistState(opts)];
}
