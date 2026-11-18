// SPDX-License-Identifier: MPL-2.0
/** Audit every authoritative dependency lock declared by security/dependency-roots.json. */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Ecosystem = 'npm' | 'cargo';

/**
 * A reviewed, temporary hold on RustSec advisories for one Cargo root. The audit
 * passes each id to `cargo audit --ignore` for that root only, and
 * validateAdvisoryExceptions fails as soon as the lockfile shows the hold is no
 * longer needed, so an exception cannot outlive its fix.
 */
export interface AdvisoryException {
  /** RustSec ids, passed to cargo audit as --ignore for this root only. */
  advisories: string[];
  /** The vulnerable crate the advisories are filed against. */
  crate: string;
  /** First fixed version of `crate`. A lockfile with no copy older than this version no longer needs the hold. */
  fixedIn: string;
  /** The one crate allowed to pull the vulnerable copy in. */
  via: string;
  /** First release of `via` that carries the fix. Once the lockfile resolves it, the hold must go. */
  viaFixedIn: string;
  approvedBy: string;
  justification: string;
  tracking: string[];
}

/**
 * A reviewed, temporary hold on GitHub advisories for one npm root, for a finding that has
 * no fixed release to move to. The audit leaves a held advisory out of that root's count,
 * and npmHoldProblems fails as soon as the registry lists a fixed version or the advisory
 * stops applying, so a hold ends with the reason for the hold.
 */
export interface NpmAdvisoryHold {
  /** GitHub advisory ids (GHSA-xxxx-xxxx-xxxx) held for this root only. */
  advisories: string[];
  /** The package the advisories are filed against. */
  package: string;
  approvedBy: string;
  justification: string;
  tracking: string[];
}

export interface DependencyRoot {
  id: string;
  ecosystem: Ecosystem;
  directory: string;
  lockfile: string;
  exposure: 'runtime-and-development' | 'build-toolchain' | 'shipped-runtime';
  owner: string;
  advisoryExceptions?: AdvisoryException[];
  npmAdvisoryHolds?: NpmAdvisoryHold[];
}

interface Inventory {
  schemaVersion: 1;
  roots: DependencyRoot[];
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = join(REPO, 'security/dependency-roots.json');
const PRUNED = new Set(['.git', '.claude', '.worktrees', 'dist', 'node_modules', 'target', 'vendor']);
const RUSTSEC_ID = /^RUSTSEC-\d{4}-\d{4}$/;
const GHSA_ID = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
const PLAIN_VERSION = /^\d+\.\d+\.\d+$/;

function slash(path: string): string {
  return path.split(sep).join('/');
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function checkAdvisoryExceptions(root: DependencyRoot): void {
  const list: unknown = root.advisoryExceptions;
  if (list === undefined) return;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`${root.id}: advisoryExceptions must be a non-empty array when present`);
  }
  if (root.ecosystem !== 'cargo') {
    throw new Error(`${root.id}: advisoryExceptions are supported for cargo roots only`);
  }
  const seen = new Set<string>();
  for (const entry of list as Partial<AdvisoryException>[]) {
    const ids = entry?.advisories;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string' && RUSTSEC_ID.test(id))) {
      throw new Error(`${root.id}: an advisory exception needs a non-empty list of RUSTSEC-YYYY-NNNN ids`);
    }
    for (const id of ids) {
      if (seen.has(id)) throw new Error(`${root.id}: ${id} is excepted twice`);
      seen.add(id);
    }
    for (const field of ['crate', 'via', 'approvedBy', 'justification'] as const) {
      if (!nonEmptyString(entry[field])) throw new Error(`${root.id}: advisory exception is missing ${field}`);
    }
    for (const field of ['fixedIn', 'viaFixedIn'] as const) {
      const value = entry[field];
      if (typeof value !== 'string' || !PLAIN_VERSION.test(value)) {
        throw new Error(`${root.id}: advisory exception ${field} must be a plain x.y.z version`);
      }
    }
    if (!Array.isArray(entry.tracking) || entry.tracking.length === 0 || !entry.tracking.every(nonEmptyString)) {
      throw new Error(`${root.id}: advisory exception needs at least one tracking link`);
    }
  }
}

function checkNpmAdvisoryHolds(root: DependencyRoot): void {
  const list: unknown = root.npmAdvisoryHolds;
  if (list === undefined) return;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`${root.id}: npmAdvisoryHolds must be a non-empty array when present`);
  }
  if (root.ecosystem !== 'npm') {
    throw new Error(`${root.id}: npmAdvisoryHolds are supported for npm roots only`);
  }
  const seen = new Set<string>();
  for (const entry of list as Partial<NpmAdvisoryHold>[]) {
    const ids = entry?.advisories;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string' && GHSA_ID.test(id))) {
      throw new Error(`${root.id}: an npm advisory hold needs a non-empty list of GHSA ids`);
    }
    for (const id of ids) {
      if (seen.has(id)) throw new Error(`${root.id}: ${id} is held twice`);
      seen.add(id);
    }
    for (const field of ['package', 'approvedBy', 'justification'] as const) {
      if (!nonEmptyString(entry[field])) throw new Error(`${root.id}: npm advisory hold is missing ${field}`);
    }
    if (!Array.isArray(entry.tracking) || entry.tracking.length === 0 || !entry.tracking.every(nonEmptyString)) {
      throw new Error(`${root.id}: npm advisory hold needs at least one tracking link`);
    }
  }
}

/** Validate a parsed inventory object. loadInventory reads the file and calls this. */
export function parseInventory(parsed: Partial<Inventory>): Inventory {
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
    checkAdvisoryExceptions(root);
    checkNpmAdvisoryHolds(root);
  }
  return parsed as Inventory;
}

export function loadInventory(path = INVENTORY): Inventory {
  return parseInventory(JSON.parse(readFileSync(path, 'utf8')) as Partial<Inventory>);
}

export interface LockedPackage {
  name: string;
  version: string;
  /** Each dependency as Cargo writes it: a bare name, or "name version" when two copies are locked. */
  dependencies: { name: string; version?: string }[];
}

/** Read the [[package]] entries of a Cargo.lock. Only name, version and dependencies are kept. */
export function parseCargoLock(text: string): LockedPackage[] {
  const packages: LockedPackage[] = [];
  for (const block of text.split(/^\[\[package\]\][ \t]*$/m).slice(1)) {
    const name = /^name = "([^"]+)"/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    if (!name || !version) throw new Error('Cargo.lock has a [[package]] entry without a name and version');
    const listed = /^dependencies = \[([^\]]*)\]/m.exec(block)?.[1] ?? '';
    const dependencies = [...listed.matchAll(/"([^"]+)"/g)].map((match) => {
      const [depName = '', depVersion] = (match[1] ?? '').split(' ');
      return depVersion ? { name: depName, version: depVersion } : { name: depName };
    });
    packages.push({ name, version, dependencies });
  }
  return packages;
}

/** Order two Cargo versions. A pre-release sorts below its release (9.0.0-pre3 < 9.0.0). */
export function compareVersions(a: string, b: string): number {
  const split = (version: string): [number[], string] => {
    const [core = '', pre = ''] = (version.split('+')[0] ?? '').split(/-(.*)/s);
    return [core.split('.').map((part) => Number.parseInt(part, 10) || 0), pre];
  };
  const [coreA, preA] = split(a);
  const [coreB, preB] = split(b);
  for (let i = 0; i < 3; i++) {
    const diff = (coreA[i] ?? 0) - (coreB[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (preA === preB) return 0;
  if (!preA) return 1;
  if (!preB) return -1;
  return preA < preB ? -1 : 1;
}

/**
 * Every reason a root's advisory exceptions are no longer justified by its lockfile:
 * no vulnerable copy of the crate is left (it is gone, or every copy is at or past
 * the fix), a crate other than `via` now pulls a vulnerable copy in, or `via` is
 * gone or has reached the release that carries the fix. Any one of these means the
 * --ignore must be removed.
 */
export function advisoryExceptionProblems(root: DependencyRoot, packages: LockedPackage[]): string[] {
  const problems: string[] = [];
  for (const exception of root.advisoryExceptions ?? []) {
    const { crate, fixedIn, via, viaFixedIn } = exception;
    const label = `${root.id}: the exception for ${exception.advisories.join(', ')}`;
    const copies = packages.filter((pkg) => pkg.name === crate);
    const vulnerable = copies.filter((pkg) => compareVersions(pkg.version, fixedIn) < 0);
    if (copies.length === 0) {
      problems.push(`${label} is stale: ${crate} is no longer in ${root.lockfile}. Remove the exception.`);
    } else if (vulnerable.length === 0) {
      const versions = copies.map((pkg) => pkg.version).join(', ');
      problems.push(`${label} is stale: ${crate} resolves to ${versions}, at or past the fix in ${fixedIn}. Remove the exception.`);
    }
    const vulnerableVersions = new Set(vulnerable.map((pkg) => pkg.version));
    const pullsVulnerable = (dep: { name: string; version?: string }) =>
      dep.name === crate && (dep.version ? vulnerableVersions.has(dep.version) : vulnerable.length > 0 && copies.length === 1);
    const parents = [...new Set(packages.filter((pkg) => pkg.dependencies.some(pullsVulnerable)).map((pkg) => pkg.name))];
    const others = parents.filter((name) => name !== via);
    if (others.length) {
      problems.push(`${label} covers ${crate} through ${via} only, but ${others.join(', ')} also pulls a vulnerable copy in.`);
    }
    const viaCopies = packages.filter((pkg) => pkg.name === via);
    if (viaCopies.length === 0) {
      problems.push(`${label} is stale: ${via} is no longer in ${root.lockfile}. Remove the exception.`);
    }
    for (const pkg of viaCopies.filter((copy) => compareVersions(copy.version, viaFixedIn) >= 0)) {
      problems.push(`${label} is stale: ${via} ${pkg.version} carries the upstream fix (${viaFixedIn} or later). Remove the exception and update ${crate}.`);
    }
  }
  return problems;
}

function readLock(lockfile: string): string {
  return readFileSync(join(REPO, lockfile), 'utf8');
}

/** Fail when any declared advisory exception has outlived the state of its lockfile. */
export function validateAdvisoryExceptions(inventory: Inventory, read: (lockfile: string) => string = readLock): void {
  const problems = inventory.roots
    .filter((root) => root.advisoryExceptions?.length)
    .flatMap((root) => advisoryExceptionProblems(root, parseCargoLock(read(root.lockfile))));
  if (problems.length) throw new Error(`advisory exception gate:\n  ${problems.join('\n  ')}`);
}

/** The cargo audit argument list for one root, with that root's --ignore ids and no other root's. */
export function cargoAuditArgs(root: DependencyRoot, lockfile: string, noFetch: boolean): string[] {
  const args = ['audit', '--file', lockfile];
  for (const exception of root.advisoryExceptions ?? []) {
    for (const id of exception.advisories) args.push('--ignore', id);
  }
  if (noFetch) args.push('--no-fetch');
  return args;
}

function walkForLocks(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!PRUNED.has(entry.name)) walkForLocks(absolute, out);
      continue;
    }
    if (entry.isFile() && (entry.name === 'pnpm-lock.yaml' || entry.name === 'Cargo.lock')) {
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

interface NpmAdvisory { severity: string; id: string | null; module: string | null; patched: string | null }

/** pnpm 11 returns npm registry advisories, without npm CLI's metadata summary. */
function npmAdvisories(report: unknown): NpmAdvisory[] {
  if (!report || typeof report !== 'object' || !('advisories' in report)
    || !report.advisories || typeof report.advisories !== 'object' || Array.isArray(report.advisories)) {
    throw new Error('pnpm audit returned an invalid advisory report');
  }
  const list: NpmAdvisory[] = [];
  for (const advisory of Object.values(report.advisories) as Array<Record<string, unknown> | null>) {
    if (!advisory || typeof advisory !== 'object' || !('severity' in advisory)
      || !['info', 'low', 'moderate', 'high', 'critical'].includes(String(advisory.severity))) {
      throw new Error('pnpm audit returned an invalid advisory severity');
    }
    const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
    list.push({
      severity: String(advisory.severity),
      id: text(advisory.github_advisory_id),
      module: text(advisory.module_name),
      patched: text(advisory.patched_versions),
    });
  }
  return list;
}

/** The advisory count for one root. A held advisory id is left out of every number. */
export function auditCounts(report: unknown, held: ReadonlySet<string> = new Set()): { total: number; high: number; critical: number } {
  const counts = { total: 0, high: 0, critical: 0 };
  for (const advisory of npmAdvisories(report)) {
    if (advisory.id && held.has(advisory.id)) continue;
    counts.total++;
    if (advisory.severity === 'high') counts.high++;
    if (advisory.severity === 'critical') counts.critical++;
  }
  return counts;
}

/** A registry range that gives no release: absent, empty, or the registry's "no fix" form. */
function namesNoFix(patched: string | null): boolean {
  return patched === null || /^<\s*0\.0\.0$/.test(patched);
}

/**
 * Every reason a root's npm holds are no longer justified by the audit report: the
 * advisory no longer applies to this root, it is filed against another package, or the
 * registry now lists a fixed version, in which case the update replaces the hold.
 */
export function npmHoldProblems(root: DependencyRoot, report: unknown): string[] {
  const problems: string[] = [];
  const reported = npmAdvisories(report);
  for (const hold of root.npmAdvisoryHolds ?? []) {
    for (const id of hold.advisories) {
      const label = `${root.id}: the hold for ${id}`;
      const found = reported.filter((advisory) => advisory.id === id);
      if (found.length === 0) {
        problems.push(`${label} is stale: the audit no longer reports the advisory. Remove the hold.`);
        continue;
      }
      for (const advisory of found) {
        if (advisory.module !== hold.package) {
          problems.push(`${label} is for ${hold.package}, and the advisory is filed against ${advisory.module ?? 'an unnamed package'}.`);
        } else if (!namesNoFix(advisory.patched)) {
          problems.push(`${label} is stale: ${hold.package} has a fixed release (${advisory.patched}). Update ${hold.package} and remove the hold.`);
        }
      }
    }
  }
  return problems;
}

function auditNpm(root: DependencyRoot): void {
  const cwd = join(REPO, root.directory);
  const result = spawnSync('pnpm', ['audit', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  let report: unknown;
  try {
    report = JSON.parse(result.stdout) as typeof report;
  } catch {
    throw new Error(`${root.id}: pnpm audit did not return JSON${result.stderr ? ` (${result.stderr.trim()})` : ''}`);
  }
  const held = new Set((root.npmAdvisoryHolds ?? []).flatMap((hold) => hold.advisories));
  const problems = npmHoldProblems(root, report);
  if (problems.length) throw new Error(`npm advisory hold gate:\n  ${problems.join('\n  ')}`);
  const { high, critical, total } = auditCounts(report, held);
  console.log(`${root.id}: pnpm audit total=${total} high=${high} critical=${critical}${held.size ? ` held=${[...held].join(',')}` : ''}`);
  if (high > 0 || critical > 0) {
    throw new Error(`${root.id}: pnpm audit found ${high} high and ${critical} critical vulnerabilities`);
  }
  // A held advisory still makes pnpm exit non-zero, so the status is read against the
  // whole report and not against the count that leaves the hold out.
  if (result.status !== 0 && auditCounts(report).total === 0) {
    throw new Error(`${root.id}: pnpm audit failed with status ${result.status}`);
  }
}

function auditCargo(root: DependencyRoot, noFetch: boolean): void {
  const args = cargoAuditArgs(root, join(REPO, root.lockfile), noFetch);
  for (const exception of root.advisoryExceptions ?? []) {
    console.log(`${root.id}: ignoring ${exception.advisories.join(', ')} in ${exception.crate} via ${exception.via}`
      + ` (approved ${exception.approvedBy}; must go once ${exception.via} >= ${exception.viaFixedIn}`
      + ` or ${exception.crate} >= ${exception.fixedIn}; see security/dependency-roots.json)`);
  }
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
  validateAdvisoryExceptions(inventory);
  const held = inventory.roots.flatMap((root) => (root.advisoryExceptions ?? []).flatMap((entry) => entry.advisories));
  if (held.length) console.log(`advisory exceptions: ${held.length} held, each still justified by its lockfile`);
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
