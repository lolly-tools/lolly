// SPDX-License-Identifier: MPL-2.0
/** Audit every authoritative dependency lock declared by security/dependency-roots.json. */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Ecosystem = 'npm' | 'cargo';

export interface DependencyRoot {
  id: string;
  ecosystem: Ecosystem;
  directory: string;
  lockfile: string;
  exposure: 'runtime-and-development' | 'build-toolchain' | 'shipped-runtime';
  owner: string;
}

interface Inventory {
  schemaVersion: 1;
  roots: DependencyRoot[];
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = join(REPO, 'security/dependency-roots.json');
const PRUNED = new Set(['.git', '.claude', 'dist', 'node_modules', 'target', 'vendor']);

function slash(path: string): string {
  return path.split(sep).join('/');
}

export function loadInventory(path = INVENTORY): Inventory {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<Inventory>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.roots)) {
    throw new Error('security/dependency-roots.json must have schemaVersion 1 and a roots array');
  }
  const ids = new Set<string>();
  const locks = new Set<string>();
  for (const root of parsed.roots) {
    if (!root || typeof root.id !== 'string' || !['npm', 'cargo'].includes(root.ecosystem)) {
      throw new Error('dependency root entries require an id and npm/cargo ecosystem');
    }
    if (ids.has(root.id)) throw new Error(`duplicate dependency root id: ${root.id}`);
    if (locks.has(root.lockfile)) throw new Error(`duplicate dependency lock: ${root.lockfile}`);
    ids.add(root.id);
    locks.add(root.lockfile);
  }
  return parsed as Inventory;
}

function walkForLocks(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!PRUNED.has(entry.name)) walkForLocks(absolute, out);
      continue;
    }
    if (entry.isFile() && (entry.name === 'package-lock.json' || entry.name === 'Cargo.lock')) {
      out.push(slash(relative(REPO, absolute)));
    }
  }
}

export function discoverAuthoritativeLocks(): string[] {
  const locks: string[] = [];
  walkForLocks(REPO, locks);
  return locks.sort();
}

export function validateCoverage(inventory: Inventory): void {
  const declared = new Set(inventory.roots.map((root) => root.lockfile));
  const discovered = new Set(discoverAuthoritativeLocks());
  const missingFiles = [...declared].filter((lock) => !existsSync(join(REPO, lock)));
  const uncovered = [...discovered].filter((lock) => !declared.has(lock));
  const stale = [...declared].filter((lock) => !discovered.has(lock));
  if (missingFiles.length || uncovered.length || stale.length) {
    const details = [
      missingFiles.length ? `declared but missing: ${missingFiles.join(', ')}` : '',
      uncovered.length ? `uncovered: ${uncovered.join(', ')}` : '',
      stale.length ? `declared but not authoritative: ${stale.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new Error(`dependency lock inventory drift: ${details}`);
  }
}

function commandAvailable(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, { cwd: REPO, encoding: 'utf8', stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function auditNpm(root: DependencyRoot): void {
  const cwd = join(REPO, root.directory);
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  let report: { metadata?: { vulnerabilities?: Record<string, number> } };
  try {
    report = JSON.parse(result.stdout) as typeof report;
  } catch {
    throw new Error(`${root.id}: npm audit did not return JSON${result.stderr ? ` (${result.stderr.trim()})` : ''}`);
  }
  const counts = report.metadata?.vulnerabilities ?? {};
  const high = Number(counts.high ?? 0);
  const critical = Number(counts.critical ?? 0);
  const total = Number(counts.total ?? 0);
  console.log(`${root.id}: npm audit total=${total} high=${high} critical=${critical}`);
  if (high > 0 || critical > 0) {
    throw new Error(`${root.id}: npm audit found ${high} high and ${critical} critical vulnerabilities`);
  }
  if (result.status !== 0 && total === 0) {
    throw new Error(`${root.id}: npm audit failed with status ${result.status}`);
  }
}

function auditCargo(root: DependencyRoot, noFetch: boolean): void {
  const lockfile = join(REPO, root.lockfile);
  const args = ['audit', '--file', lockfile];
  if (noFetch) args.push('--no-fetch');
  const result = spawnSync('cargo', args, {
    cwd: join(REPO, root.directory),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${root.id}: cargo audit failed`);
  console.log(`${root.id}: cargo audit clean`);
}

export function main(argv = process.argv.slice(2)): void {
  const inventory = loadInventory();
  validateCoverage(inventory);
  console.log(`dependency inventory: ${inventory.roots.length} roots, all lockfiles covered`);
  if (argv.includes('--check')) return;

  const npmOnly = argv.includes('--npm-only');
  const cargoOnly = argv.includes('--cargo-only');
  if (npmOnly && cargoOnly) throw new Error('--npm-only and --cargo-only cannot be combined');

  const roots = inventory.roots.filter((root) =>
    npmOnly ? root.ecosystem === 'npm' : cargoOnly ? root.ecosystem === 'cargo' : true,
  );
  for (const root of roots.filter((item) => item.ecosystem === 'npm')) auditNpm(root);

  const cargoRoots = roots.filter((item) => item.ecosystem === 'cargo');
  if (cargoRoots.length) {
    if (!commandAvailable('cargo', ['audit', '--version'])) {
      throw new Error('cargo-audit is required: cargo install cargo-audit --locked --version 0.22.2');
    }
    // The first audit refreshes RustSec. Later roots reuse that exact database so
    // one repository run cannot receive two different advisory snapshots.
    for (const [index, root] of cargoRoots.entries()) auditCargo(root, index > 0);
  }
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
