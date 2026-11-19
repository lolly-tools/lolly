// SPDX-License-Identifier: MPL-2.0
/**
 * Node's on-disk compile cache for the terminal shells (plans/371, M1.1).
 *
 * A cold `lolly --version` spent about half a second compiling the engine's
 * modules before any work began. Node can keep the compiled form on disk and
 * read it back on the next run; this module turns that on and chooses where the
 * cache lives. It imports nothing but `node:` modules, because everything
 * imported before `enableStartupCache()` runs is compiled without the cache.
 *
 * WHERE THE CACHE LIVES
 *   1. `NODE_COMPILE_CACHE` is set: Node has already turned its own cache on and
 *      this module leaves that choice alone.
 *   2. A repository checkout (this file is `shells/cli/src/startup-cache.ts` and
 *      the checkout has a `node_modules`): `<checkout>/node_modules/.cache/lolly/
 *      compile-cache`. The cache is removed with the checkout, so worktrees that
 *      come and go leave nothing behind in the home directory.
 *   3. The published package: the user's cache directory, in a folder named for
 *      the package version. A new version starts a new folder and removes the
 *      folders of versions that are more than thirty days old.
 *
 * `LOLLY_COMPILE_CACHE=0` turns the cache off, as does Node's own
 * `NODE_DISABLE_COMPILE_CACHE=1`. A cache that cannot be created or written is
 * never an error: the run is slower and otherwise the same.
 */
import module from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OFF = new Set(['0', 'off', 'false', 'no']);
const CACHE_LEAF = 'compile-cache';
const STALE_VERSION_MS = 30 * 24 * 60 * 60 * 1000;
/** A version folder name this module made: digits, dots and an optional suffix. */
const VERSION_DIR = /^\d+\.\d+\.\d+[0-9A-Za-z.+-]*$/;

export interface StartupCacheInputs {
  env: Record<string, string | undefined>;
  platform: string;
  home: string;
  /** The directory that holds this module. */
  here: string;
  hasDir: (path: string) => boolean;
  /** The published package's version; read only when the checkout rule does not apply. */
  packageVersion: () => string | null;
}

export interface StartupCacheChoice {
  dir: string;
  /** True for the published package's versioned folder, whose older siblings are pruned. */
  versioned: boolean;
}

/** The user's cache directory for Lolly on this platform, or null with no home. */
function userCacheBase(env: Record<string, string | undefined>, platform: string, home: string): string | null {
  if (platform === 'darwin') return home ? join(home, 'Library', 'Caches', 'lolly') : null;
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || (home ? join(home, 'AppData', 'Local') : '');
    return local ? join(local, 'lolly', 'Cache') : null;
  }
  const xdg = env.XDG_CACHE_HOME;
  if (xdg?.startsWith('/')) return join(xdg, 'lolly');
  return home ? join(home, '.cache', 'lolly') : null;
}

/** Where this run's compile cache lives, or null when this module must not set one. */
export function startupCacheChoice(input: StartupCacheInputs): StartupCacheChoice | null {
  const { env } = input;
  if (OFF.has(String(env.LOLLY_COMPILE_CACHE ?? '').toLowerCase())) return null;
  if (env.NODE_DISABLE_COMPILE_CACHE) return null;
  if (env.NODE_COMPILE_CACHE) return null;
  const checkoutSuffix = join('shells', 'cli', 'src');
  if (input.here.endsWith(sep + checkoutSuffix)) {
    const root = input.here.slice(0, -(checkoutSuffix.length + 1));
    const modules = join(root, 'node_modules');
    if (input.hasDir(modules)) return { dir: join(modules, '.cache', 'lolly', CACHE_LEAF), versioned: false };
  }
  const base = userCacheBase(env, input.platform, input.home);
  const version = input.packageVersion();
  if (!base || !version || !VERSION_DIR.test(version)) return null;
  return { dir: join(base, CACHE_LEAF, version), versioned: true };
}

/** Remove the cache folders of other versions that are more than thirty days old. */
function pruneOldVersions(dir: string, now: number): void {
  const parent = dirname(dir);
  if (basename(parent) !== CACHE_LEAF) return;
  for (const name of readdirSync(parent)) {
    if (name === basename(dir) || !VERSION_DIR.test(name)) continue;
    const path = join(parent, name);
    try {
      const stat = statSync(path);
      if (stat.isDirectory() && now - stat.mtimeMs > STALE_VERSION_MS) rmSync(path, { recursive: true, force: true });
    } catch { /* another run removed the folder first */ }
  }
}

function isDir(path: string): boolean {
  try { return statSync(path).isDirectory(); } catch { return false; }
}

/** The version in the package.json beside the published `dist/`, or null. */
function publishedVersion(here: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch { return null; }
}

/**
 * Turn the compile cache on for every module loaded after this call. Returns the
 * directory in use, or null when the cache is off or could not be set up.
 */
export function enableStartupCache(): string | null {
  try {
    if (typeof module.enableCompileCache !== 'function') return null;
    const here = dirname(fileURLToPath(import.meta.url));
    const choice = startupCacheChoice({
      env: process.env, platform: process.platform, home: homedir(), here, hasDir: isDir,
      packageVersion: () => publishedVersion(here),
    });
    if (!choice) return null;
    const fresh = !existsSync(choice.dir);
    mkdirSync(choice.dir, { recursive: true, mode: 0o700 });
    const result = module.enableCompileCache(choice.dir);
    const { ENABLED, ALREADY_ENABLED } = module.constants.compileCacheStatus;
    if (result.status !== ENABLED && result.status !== ALREADY_ENABLED) return null;
    if (fresh && choice.versioned) pruneOldVersions(choice.dir, Date.now());
    return result.directory ?? choice.dir;
  } catch {
    return null;
  }
}
