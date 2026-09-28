// SPDX-License-Identifier: MPL-2.0
/** Read pnpm's locked graph for dependency audits and release notices. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { parse } from 'yaml';

interface Dependency { version: string }
interface Importer {
  dependencies?: Record<string, Dependency>;
  devDependencies?: Record<string, Dependency>;
  optionalDependencies?: Record<string, Dependency>;
}
interface Snapshot {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}
interface Package {
  resolution?: { integrity?: string; tarball?: string };
  os?: string[];
  cpu?: string[];
  libc?: string[];
}
interface Lock {
  lockfileVersion: string;
  importers: Record<string, Importer>;
  packages?: Record<string, Package>;
  snapshots?: Record<string, Snapshot>;
}
export interface LockedPackage {
  version: string;
  integrity?: string;
  resolved?: string;
  license?: string;
  dev: boolean;
}
export interface ReadPnpmLockOptions {
  /**
   * Whether a version missing from security/npm-licenses.json may take its
   * licence from an installed package.json. Pass false for a lockfile that is
   * not installed on every machine that runs the generators (CI never installs
   * the Tauri shells), or the output would follow whether this checkout did.
   */
  readInstalled?: boolean;
}
export interface PnpmLockGraph {
  packages: Record<string, LockedPackage>;
  /** Locked `name@version` keys absent from the committed licence cache, sorted. */
  uncached: string[];
}

/**
 * Codepoint order, the same on every machine. `localeCompare` follows the
 * process locale, so a Danish, Czech or Estonian locale would reorder the
 * generated files.
 */
export function byCodepoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True when pnpm installs this package only on matching machines (os, cpu or libc). */
export function isPlatformRestricted(pkg: Package | undefined): boolean {
  return Boolean(pkg?.os?.length || pkg?.cpu?.length || pkg?.libc?.length);
}

/**
 * Licence declared by an installed package.json, in any of the shapes npm
 * accepts: the SPDX string, or the legacy `{ type }` object and `[{ type }]`
 * array. npm documents the array form as a choice, so it becomes an OR.
 */
export function manifestLicense(pkg: { license?: unknown; licenses?: unknown }): string | undefined {
  if (typeof pkg.license === 'string') return pkg.license.trim() || undefined;
  const legacy = pkg.license && typeof pkg.license === 'object' ? [pkg.license].flat() : Array.isArray(pkg.licenses) ? pkg.licenses : [];
  const ids = legacy
    .map(entry => (typeof entry === 'string' ? entry : (entry as { type?: unknown } | null)?.type))
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
    .map(id => id.trim());
  return ids.length ? ids.join(' OR ') : undefined;
}

/** Runtime reachability includes optional dependencies and linked workspace packages. */
export function readPnpmLock(root: string, filename = 'pnpm-lock.yaml', options: ReadPnpmLockOptions = {}): PnpmLockGraph {
  const file = resolve(root, filename);
  const lock = parse(readFileSync(file, 'utf8')) as Lock;
  if (String(lock.lockfileVersion) !== '9.0' || !lock.importers) throw new Error(`Unsupported pnpm lockfile: ${filename}`);

  // Package keys (peer suffix stripped) reachable from every importer through
  // the given importer fields, never entering a package `enter` refuses.
  function reachable(fields: readonly (keyof Importer)[], enter: (key: string) => boolean): Set<string> {
    const seen = new Set<string>();
    const visitedImporters = new Set<string>();
    const found = new Set<string>();
    function walk(name: string, ref: string, importer: string): void {
      if (ref.startsWith('link:')) {
        walkImporter(posix.normalize(posix.join(importer, ref.slice(5))));
        return;
      }
      const key = lock.snapshots?.[ref] ? ref : `${name}@${ref}`;
      if (seen.has(key)) return;
      seen.add(key);
      const packageKey = key.split('(')[0]!;
      if (!enter(packageKey)) return;
      found.add(packageKey);
      const snapshot = lock.snapshots?.[key];
      for (const [child, version] of Object.entries({ ...snapshot?.dependencies, ...snapshot?.optionalDependencies })) walk(child, version, importer);
    }
    function walkImporter(id: string): void {
      if (visitedImporters.has(id)) return;
      visitedImporters.add(id);
      const importer = lock.importers[id];
      const declared: Record<string, Dependency> = Object.assign({}, ...fields.map(field => importer?.[field]));
      for (const [name, dep] of Object.entries(declared)) walk(name, dep.version, id);
    }
    for (const id of Object.keys(lock.importers)) walkImporter(id);
    return found;
  }
  const production = reachable(['dependencies', 'optionalDependencies'], () => true);
  // Installed on every machine: pnpm skips a package whose os, cpu or libc does
  // not match, along with everything reachable only through that package. The
  // rest has the same node_modules path everywhere, because pnpm computes the
  // hoisted layout from the whole lockfile before skipping any platform package.
  const everywhere = reachable(['dependencies', 'devDependencies', 'optionalDependencies'], key => !isPlatformRestricted(lock.packages?.[key]));

  const licenseFile = join(root, 'security/npm-licenses.json');
  const licenses: Record<string, string> = existsSync(licenseFile) ? JSON.parse(readFileSync(licenseFile, 'utf8')) : {};
  const readInstalled = options.readInstalled ?? true;
  const packages: Record<string, LockedPackage> = {};
  const uncached: string[] = [];
  for (const [key, metadata] of Object.entries(lock.packages ?? {}).sort(([a], [b]) => byCodepoint(a, b))) {
    const match = /^(@[^/]+\/[^@]+|[^@]+)@([^()]+)$/.exec(key);
    if (!match) throw new Error(`Unsupported package resolution in ${filename}: ${key}`);
    const name = match[1]!;
    const version = match[2]!;
    // The committed cache records the registry licence of every exact version,
    // including the optional packages built for other operating systems, so it
    // reads the same on every machine. A version it lacks may take its licence
    // from the installed package.json only when every machine installs that
    // package. A platform binary such as @biomejs/cli-linux-x64 is on disk only
    // where it runs, so reading it would give macOS and Linux different files;
    // it stays unlicensed everywhere until `pnpm run update:npm-licenses`.
    let license = licenses[key];
    if (!license) {
      uncached.push(key);
      if (readInstalled && everywhere.has(key)) {
        for (const importer of Object.keys(lock.importers)) {
          const manifest = join(dirname(file), importer, 'node_modules', name, 'package.json');
          if (!existsSync(manifest)) continue;
          const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
          const declared = pkg.version === version ? manifestLicense(pkg) : undefined;
          if (declared) { license = declared; break; }
        }
      }
    }
    const primary = `node_modules/${name}`;
    const path = packages[primary] ? `node_modules/.versions/${name}@${version}/node_modules/${name}` : primary;
    packages[path] = { version, integrity: metadata.resolution?.integrity, resolved: metadata.resolution?.tarball, license, dev: !production.has(key) };
  }
  return { packages, uncached };
}
