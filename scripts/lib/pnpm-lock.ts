// SPDX-License-Identifier: MPL-2.0
/** Read pnpm's locked graph for dependency audits and release notices. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { parse } from 'yaml';

interface Dependency { version: string }
interface Importer {
  dependencies?: Record<string, Dependency>;
  optionalDependencies?: Record<string, Dependency>;
}
interface Snapshot {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}
interface Package { resolution?: { integrity?: string; tarball?: string } }
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

/** Runtime reachability includes optional dependencies and linked workspace packages. */
export function readPnpmLock(root: string, filename = 'pnpm-lock.yaml'): { packages: Record<string, LockedPackage> } {
  const file = resolve(root, filename);
  const lock = parse(readFileSync(file, 'utf8')) as Lock;
  if (String(lock.lockfileVersion) !== '9.0' || !lock.importers) throw new Error(`Unsupported pnpm lockfile: ${filename}`);
  const runtime = new Set<string>();
  const visitedImporters = new Set<string>();
  function walk(name: string, ref: string, importer: string): void {
    if (ref.startsWith('link:')) {
      walkImporter(posix.normalize(posix.join(importer, ref.slice(5))));
      return;
    }
    const key = lock.snapshots?.[ref] ? ref : `${name}@${ref}`;
    if (runtime.has(key)) return;
    runtime.add(key);
    const snapshot = lock.snapshots?.[key];
    for (const [child, version] of Object.entries({ ...snapshot?.dependencies, ...snapshot?.optionalDependencies })) walk(child, version, importer);
  }
  function walkImporter(id: string): void {
    if (visitedImporters.has(id)) return;
    visitedImporters.add(id);
    const importer = lock.importers[id];
    for (const [name, dep] of Object.entries({ ...importer?.dependencies, ...importer?.optionalDependencies })) walk(name, dep.version, id);
  }
  for (const id of Object.keys(lock.importers)) walkImporter(id);
  const production = new Set([...runtime].map(key => key.split('(')[0]));
  const licenseFile = join(root, 'security/npm-licenses.json');
  const licenses: Record<string, string> = existsSync(licenseFile) ? JSON.parse(readFileSync(licenseFile, 'utf8')) : {};
  const packages: Record<string, LockedPackage> = {};
  for (const [key, metadata] of Object.entries(lock.packages ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const match = /^(@[^/]+\/[^@]+|[^@]+)@([^()]+)$/.exec(key);
    if (!match) throw new Error(`Unsupported package resolution in ${filename}: ${key}`);
    const name = match[1]!;
    const version = match[2]!;
    // A committed cache retains licenses for optional packages unavailable on
    // the current OS. Installed manifests can supply newly added package licenses.
    let license = licenses[key];
    if (!license) {
      for (const importer of Object.keys(lock.importers)) {
        const manifest = join(dirname(file), importer, 'node_modules', name, 'package.json');
        if (!existsSync(manifest)) continue;
        const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
        if (pkg.version === version && typeof pkg.license === 'string') { license = pkg.license; break; }
      }
    }
    const primary = `node_modules/${name}`;
    const path = packages[primary] ? `node_modules/.versions/${name}@${version}/node_modules/${name}` : primary;
    packages[path] = { version, integrity: metadata.resolution?.integrity, resolved: metadata.resolution?.tarball, license, dev: !production.has(key) };
  }
  return { packages };
}
