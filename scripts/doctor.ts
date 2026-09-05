// SPDX-License-Identifier: MPL-2.0
/** Read-only repository readiness report with exact repair routes. */

import { spawnSync } from 'node:child_process';
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadInventory, validateCoverage } from './audit-all.ts';
import { SHARDS, shardInventory } from './run-test-suite.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
type State = 'PASS' | 'WARN' | 'FAIL';
interface Finding {
  state: State;
  check: string;
  detail: string;
  repair?: string;
}

// SHA-256 of checkout-relative paths that previously held local credentials.
// Hashes let readiness detect a reintroduced file without publishing the user's
// private naming/layout in a public repository. Values and file contents are
// never read by this check.
export const KNOWN_LOCAL_SECRET_PATH_HASHES = new Set([
  '08d836e562ecb996d9fd818139a18fedf321a2e89ba3a89e61690340340c5c5f',
  '4e54dadc1c58646a6051fd105de0424b70058b88dc1a8426bf6a01e8eb2e0dad',
  '53f6967eecbb6cc15ecb11f30bb9ab3b236a840e85e4c0b262dc316a727186c2',
  '6e7b1110fc135a42a87a7f9dc5601f6a97d1e4298e1c5731777f21147a8fa047',
  '74dd9d08974aed4457940214a64b43ce175d062d74e72309b003f02c24f98b30',
  'a9957d6a1acf60a6854167b1f6e9250c25f2998a71185d9133bbd247865f3395',
  'cd19226c8b10902b5a5573bd5bf39db1e8ab8b8547b1444efe2b5a2a785c3435',
  'd7d8def0d45119ec94630feba303db3b4e936f7cbc7a379838dfd2b1b584356b',
]);

const LOCAL_SECRET_SCAN_SKIP = new Set([
  '.git',
  '.claude',
  'artifacts',
  'catalog',
  'dist',
  'node_modules',
  'target',
  'tools',
  'vendor',
]);

export function countPathHashMatches(root: string, hashes: ReadonlySet<string>): number {
  let matches = 0;
  const visit = (directory: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
      const digest = createHash('sha256').update(relative).digest('hex');
      if (hashes.has(digest)) matches += 1;
      if (entry.isDirectory() && !LOCAL_SECRET_SCAN_SKIP.has(entry.name)) visit(absolute);
    }
  };
  visit(root);
  return matches;
}

function run(command: string, args: string[], cwd = REPO): { ok: boolean; output: string } {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return {
    ok: !result.error && result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

export function parseSubmoduleStatus(output: string): { missing: string[]; conflicted: string[] } {
  const missing: string[] = [];
  const conflicted: string[] = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const target = line.trim().split(/\s+/)[1] ?? '<unknown>';
    if (line.startsWith('-')) missing.push(target);
    if (line.startsWith('U')) conflicted.push(target);
  }
  return { missing, conflicted };
}

export function signingState(
  privateText?: string,
  publicText?: string
): { state: State; detail: string } {
  if (!privateText && !publicText)
    return {
      state: 'WARN',
      detail: 'release catalogue keys are not loaded (normal for development)',
    };
  if (!privateText || !publicText)
    return { state: 'FAIL', detail: 'only one of the private/public catalogue keys is loaded' };
  try {
    const privateKey = createPrivateKey({ key: JSON.parse(privateText), format: 'jwk' });
    const derived = createPublicKey(privateKey).export({ format: 'jwk' });
    const supplied = createPublicKey({ key: JSON.parse(publicText), format: 'jwk' }).export({
      format: 'jwk',
    });
    const same =
      derived.kty === supplied.kty &&
      derived.crv === supplied.crv &&
      derived.x === supplied.x &&
      derived.y === supplied.y;
    return same
      ? { state: 'PASS', detail: 'release catalogue key pair matches' }
      : { state: 'FAIL', detail: 'release catalogue public key does not match the private key' };
  } catch {
    return { state: 'FAIL', detail: 'release catalogue key material is not valid JWK' };
  }
}

function activeProfile(): string | null {
  try {
    const actual = realpathSync(path.join(REPO, 'catalog'));
    const profiles = JSON.parse(readFileSync(path.join(REPO, 'profiles.json'), 'utf8')) as {
      profiles: Record<string, { catalog: string }>;
    };
    return (
      Object.entries(profiles.profiles).find(
        ([, profile]) => realpathSync(path.join(REPO, profile.catalog)) === actual
      )?.[0] ?? null
    );
  } catch {
    return null;
  }
}

function repositories(): string[] {
  const inventory = JSON.parse(
    readFileSync(path.join(REPO, 'security/repository-inventory.json'), 'utf8')
  ) as { repositories: Array<{ path: string }> };
  return inventory.repositories.map((repo) => repo.path);
}

function dirtyRepositories(): string[] {
  return repositories().filter(
    (repo) => run('git', ['status', '--porcelain'], path.join(REPO, repo)).output.length > 0
  );
}

function commandVersion(command: string, args = ['--version']): string | null {
  const result = run(command, args);
  return result.ok ? (result.output.split(/\r?\n/)[0] ?? command) : null;
}

export function inspect(argv = process.argv.slice(2)): Finding[] {
  const findings: Finding[] = [];
  const add = (state: State, check: string, detail: string, repair?: string): void => {
    findings.push({ state, check, detail, repair });
  };
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add(
    nodeMajor >= 22 ? 'PASS' : 'FAIL',
    'Node',
    process.version,
    'install Node >=22.18.0 and run npm ci'
  );
  for (const command of ['npm', 'git', 'cargo']) {
    const version = commandVersion(command);
    add(
      version ? 'PASS' : 'FAIL',
      command,
      version ?? 'not found',
      `install ${command} and ensure it is on PATH`
    );
  }
  add(
    existsSync(path.join(REPO, 'node_modules')) ? 'PASS' : 'FAIL',
    'dependencies',
    'root node_modules',
    'npm ci'
  );

  const profile = activeProfile();
  add(
    profile ? 'PASS' : 'FAIL',
    'profile',
    profile ?? 'catalog view does not match profiles.json',
    'npm run profile:start'
  );
  const submodule = run('git', ['submodule', 'status', '--recursive']);
  const parsed = parseSubmoduleStatus(submodule.output);
  add(
    submodule.ok && !parsed.missing.length && !parsed.conflicted.length ? 'PASS' : 'FAIL',
    'submodules',
    parsed.missing.length || parsed.conflicted.length
      ? `missing=${parsed.missing.length}, conflicted=${parsed.conflicted.length}`
      : `${submodule.output.split(/\r?\n/).filter(Boolean).length} mounted`,
    'git submodule update --init --recursive'
  );
  const dirty = dirtyRepositories();
  add(
    dirty.length ? 'WARN' : 'PASS',
    'working trees',
    dirty.length
      ? `${dirty.length} repositories have uncommitted work: ${dirty.join(', ')}`
      : 'clean'
  );

  try {
    validateCoverage(loadInventory());
    add('PASS', 'dependency locks', 'all authoritative locks inventoried');
  } catch (error) {
    add(
      'FAIL',
      'dependency locks',
      error instanceof Error ? error.message : String(error),
      'edit security/dependency-roots.json, then npm run audit:all'
    );
  }

  for (const [check, command, args, repair] of [
    [
      'release inventory',
      process.execPath,
      ['scripts/release-checklist.ts', '--check'],
      'npm run build:release-checklist',
    ],
    [
      'HostV1 API',
      process.execPath,
      ['scripts/check-host-v1-api.ts', '--check'],
      'review compatibility and engine minor version, then npm run build:host-v1-api',
    ],
    [
      'parser inventory',
      process.execPath,
      ['scripts/build-parser-inventory.ts', '--check'],
      'npm run build:parser-inventory',
    ],
    [
      'maintainability',
      process.execPath,
      ['scripts/check-maintainability-budget.ts'],
      'review the reported module, then npm run maintainability:baseline only for an approved debt change',
    ],
  ] as const) {
    const result = run(command, [...args]);
    const lines = result.output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const failure =
      lines.find((line) => line.startsWith('- ')) ??
      lines.find((line) => line.startsWith('Error:')) ??
      lines.at(-1) ??
      'failed';
    add(
      result.ok ? 'PASS' : 'FAIL',
      check,
      result.ok ? (lines.at(-1) ?? 'clean') : failure,
      repair
    );
  }
  add(
    existsSync(path.join(REPO, 'security/lint-baseline.json')) ? 'PASS' : 'FAIL',
    'lint ratchet',
    'security/lint-baseline.json',
    'npm run lint:baseline'
  );
  add(
    existsSync(path.join(REPO, 'tests/expected-skips.json')) ? 'PASS' : 'FAIL',
    'skip identities',
    'tests/expected-skips.json',
    'download the CI test-skips artifact, then npm run check:skip-identities -- --report=<path> --write'
  );
  const shards = shardInventory();
  add('PASS', 'test shards', SHARDS.map((shard) => `${shard}=${shards[shard].length}`).join(', '));

  const signing = signingState(
    process.env.LOLLY_CATALOG_SIGNING_PRIVATE_JWK,
    process.env.LOLLY_CATALOG_SIGNING_PUBLIC_JWK
  );
  add(
    argv.includes('--release') && signing.state === 'WARN' ? 'FAIL' : signing.state,
    'catalogue signing',
    signing.detail,
    'load both release JWKs from managed secret storage'
  );
  const localSecretCount = countPathHashMatches(REPO, KNOWN_LOCAL_SECRET_PATH_HASHES);
  add(
    localSecretCount ? 'FAIL' : 'PASS',
    'plaintext credentials',
    localSecretCount
      ? `${localSecretCount} known credential file(s) reappeared in the checkout`
      : 'none found',
    'credential owner: rotate/revoke values, migrate to managed storage, then securely remove the local files'
  );
  return findings;
}

export function main(argv = process.argv.slice(2)): number {
  const findings = inspect(argv);
  console.log('Lolly repository doctor (read-only)');
  console.log('STATE  CHECK                 DETAIL');
  for (const finding of findings)
    console.log(`${finding.state.padEnd(6)} ${finding.check.padEnd(21)} ${finding.detail}`);
  const failures = findings.filter((finding) => finding.state === 'FAIL');
  if (failures.length) {
    console.log('\nRepair routes:');
    for (const finding of failures) console.log(`- ${finding.check}: ${finding.repair}`);
  }
  const warnings = findings.filter((finding) => finding.state === 'WARN').length;
  console.log(
    `\nSummary: ${findings.length - failures.length - warnings} pass, ${warnings} warn, ${failures.length} fail`
  );
  return failures.length ? 1 : 0;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = main();
