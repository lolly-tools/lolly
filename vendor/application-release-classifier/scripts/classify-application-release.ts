// SPDX-License-Identifier: MPL-2.0
/** Advise release scope from exact clean Git commits; never authorize promotion. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PATHS = 4096;
const MAX_PATH_BYTES = 1024;
const ZERO = '0'.repeat(40);
const MODES = new Set(['000000', '100644', '100755', '120000', '160000']);
type Repository = 'lolly' | 'lolly-work';
export type ChangedPath = {
  path: string; status: 'A' | 'D' | 'M' | 'T';
  beforeMode: string; afterMode: string; beforeObject: string; afterObject: string;
};
export type Classification = 'no-change' | 'web-shell-only' | 'full-or-paired-required';
export type ReleaseClassification = {
  version: 1; rulesVersion: 'application-release-classification-1'; repository: Repository;
  base: string; candidate: string; baseTree: string; candidateTree: string;
  classification: Classification; reasons: string[]; changedPaths: ChangedPath[]; changedPathsSha256: string;
  advisory: true; normalCiRequired: true; privateCompatibilityReviewRequired: true;
  artifactReuseAuthorized: false; promotionAuthorized: false;
};
function requireThat(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(reason);
}
function git(repo: string, args: string[]): Buffer {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_') && key !== 'GIT_OPTIONAL_LOCKS' && key !== 'GIT_TERMINAL_PROMPT') delete env[key];
  }
  const result = spawnSync('git', ['--no-pager', '--no-replace-objects', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', ...args],
    { cwd: repo, env, timeout: 15000, maxBuffer: MAX_BYTES });
  requireThat(!result.error && result.signal === null && result.status === 0,
    'Bounded read-only Git inspection failed.');
  requireThat(result.stdout.length <= MAX_BYTES, 'Git inventory exceeds its byte bound.');
  return result.stdout;
}
function text(bytes: Buffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('Git paths must be valid UTF-8.'); }
}
function clean(repo: string, candidate: string): void {
  requireThat(text(git(repo, ['rev-parse', '--verify', 'HEAD'])).trim() === candidate,
    'The clean checkout must be at the exact candidate commit.');
  requireThat(git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']).length === 0,
    'Tracked, untracked or submodule changes refuse classification.');
}
function safePath(path: string): void {
  requireThat(path.length > 0 && Buffer.byteLength(path) <= MAX_PATH_BYTES && !path.startsWith('/')
    && !path.includes('\\') && !/[\u0000-\u001f\u007f\u2028-\u202e\u2066-\u2069]/.test(path)
    && path.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'Unsafe or oversized changed path.');
}
export function parseApplicationReleaseInventory(bytes: Buffer): ChangedPath[] {
  requireThat(bytes.length <= MAX_BYTES, 'Git inventory exceeds its byte bound.');
  if (!bytes.length) return [];
  const parts = text(bytes).split('\0');
  requireThat(parts.pop() === '' && parts.length % 2 === 0 && parts.length / 2 <= MAX_PATHS,
    'Incomplete or oversized changed-path inventory.');
  const seen = new Set<string>(), changes: ChangedPath[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const header = parts[i], path = parts[i + 1];
    requireThat(header !== undefined && path !== undefined, 'Missing changed-path record.');
    const match = /^:(\d{6}) (\d{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([ADMT])$/.exec(header);
    requireThat(match && match[1] && match[2] && match[3] && match[4] && match[5], 'Ambiguous changed-path record.');
    safePath(path); requireThat(!seen.has(path), 'Duplicate changed path.'); seen.add(path);
    requireThat(MODES.has(match[1]) && MODES.has(match[2]), 'Unknown Git file mode.');
    requireThat((match[1] === '000000') === (match[3] === ZERO)
      && (match[2] === '000000') === (match[4] === ZERO), 'Inconsistent changed object identity.');
    requireThat(match[5] === 'A' ? match[1] === '000000' && match[2] !== '000000'
      : match[5] === 'D' ? match[1] !== '000000' && match[2] === '000000'
      : match[1] !== '000000' && match[2] !== '000000', 'Inconsistent changed-path status.');
    changes.push({ path, beforeMode: match[1], afterMode: match[2], beforeObject: match[3], afterObject: match[4],
      status: match[5] as ChangedPath['status'] });
  }
  return changes.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}
function regular(change: ChangedPath): boolean {
  return [change.beforeMode, change.afterMode].every(mode => mode === '000000' || mode === '100644' || mode === '100755');
}
function releaseGate(path: string): boolean {
  return /(?:release-gate|supported-environments|support-matrix|browser-support|webgpu-qualification)/i.test(path);
}
function web(path: string): boolean {
  if (releaseGate(path)) return false;
  return /^shells\/web\/src\/.+\.(?:ts|css|html|svg)$/.test(path) || path === 'shells/web/src/README.md'
    || path === 'shells/web/index.html' || path === 'shells/web/public/sw.js';
}
function test(path: string): boolean { return !releaseGate(path) && /^tests\/.+\.test\.ts$/.test(path); }
function scope(repository: Repository, changes: ChangedPath[]): Pick<ReleaseClassification, 'classification' | 'reasons'> {
  if (!changes.length) return { classification: 'no-change', reasons: ['No committed tree changes.'] };
  if (repository === 'lolly' && changes.every(change => regular(change) && (web(change.path) || test(change.path)))
    && changes.some(change => web(change.path) && !change.path.endsWith('.test.ts') && !change.path.endsWith('.md'))) {
    return { classification: 'web-shell-only', reasons: ['Only reviewed web-shell paths and test fixtures changed; shared contract and release inputs are unchanged.'] };
  }
  return { classification: 'full-or-paired-required', reasons: [repository === 'lolly-work'
    ? 'Work changes require existing backend or paired qualification; no narrower Work rule is implemented.'
    : 'Shared contract, release inputs, unknown paths or mixed changes require broader qualification.'] };
}
function repositoryKind(repo: string, candidate: string): Repository {
  const mode = text(git(repo, ['ls-tree', candidate, '--', 'package.json']));
  requireThat(/^100644 blob [a-f0-9]{40}\tpackage\.json\n$/.test(mode), 'A regular committed root package.json is required.');
  const pkg: unknown = JSON.parse(text(git(repo, ['show', `${candidate}:package.json`])));
  requireThat(pkg !== null && typeof pkg === 'object' && 'name' in pkg && (pkg.name === 'lolly' || pkg.name === 'lolly-work'),
    'Only explicit Lolly or Lolly Work repository layouts are supported.');
  const kind = pkg.name;
  const paths = kind === 'lolly' ? ['engine/src/version.ts', 'packages/core/src/host-v1.ts', 'schemas/tool.schema.json',
    'profiles.json', 'shells/web/src/main.ts'] : ['engine-pin.json', 'server/src/main.ts', 'deploy/helm/Chart.yaml'];
  const rows = text(git(repo, ['ls-tree', '-r', candidate, '--', ...paths])).trim().split('\n');
  requireThat(rows.length === paths.length && rows.every(row => /^100644 blob [a-f0-9]{40}\t/.test(row))
    && rows.every(row => paths.includes(row.split('\t')[1] ?? ''))
    && new Set(rows.map(row => row.split('\t')[1])).size === paths.length, 'Missing or ambiguous repository layout.');
  return kind;
}
export function classifyApplicationRelease(options: { repo: string; base: string; candidate: string }): ReleaseClassification {
  requireThat(isAbsolute(options.repo) && resolve(options.repo) === options.repo && realpathSync(options.repo) === options.repo
    && lstatSync(options.repo).isDirectory(), 'Repository must be an absolute canonical directory without symlinks.');
  requireThat(SHA.test(options.base) && SHA.test(options.candidate), 'Base and candidate require full lowercase commit hashes.');
  const repo = options.repo;
  requireThat(realpathSync(text(git(repo, ['rev-parse', '--show-toplevel'])).trim()) === repo,
    'Use the exact Git working-tree root.');
  const common = resolve(repo, text(git(repo, ['rev-parse', '--git-common-dir'])).trim());
  requireThat(!existsSync(join(common, 'info/grafts')), 'Local ancestry grafts refuse immutable range inspection.');
  for (const commit of [options.base, options.candidate]) {
    requireThat(text(git(repo, ['cat-file', '-t', commit])).trim() === 'commit', 'Inputs must identify commit objects, not tags or trees.');
  }
  clean(repo, options.candidate);
  git(repo, ['merge-base', '--is-ancestor', options.base, options.candidate]);
  const repository = repositoryKind(repo, options.candidate);
  const changes = parseApplicationReleaseInventory(git(repo, ['diff', '--raw', '-z', '--no-abbrev', '--no-renames', '--no-ext-diff', '--no-textconv',
    options.base, options.candidate, '--']));
  const baseTree = text(git(repo, ['rev-parse', `${options.base}^{tree}`])).trim();
  const candidateTree = text(git(repo, ['rev-parse', `${options.candidate}^{tree}`])).trim();
  requireThat(SHA.test(baseTree) && SHA.test(candidateTree), 'Missing immutable tree identities.');
  clean(repo, options.candidate);
  return { version: 1, rulesVersion: 'application-release-classification-1', repository, base: options.base, candidate: options.candidate,
    baseTree, candidateTree, ...scope(repository, changes), changedPaths: changes,
    changedPathsSha256: createHash('sha256').update(JSON.stringify(changes)).digest('hex'), advisory: true,
    normalCiRequired: true, privateCompatibilityReviewRequired: true, artifactReuseAuthorized: false, promotionAuthorized: false };
}
export function classificationArguments(argv: string[]): { repo: string; base: string; candidate: string } {
  requireThat(argv.length === 6, 'Supply exactly --repo, --base and --candidate.');
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    requireThat(key && ['--repo', '--base', '--candidate'].includes(key) && value && !values.has(key), 'Unknown or duplicate option.');
    values.set(key, value);
  }
  const repo = values.get('--repo'), base = values.get('--base'), candidate = values.get('--candidate');
  requireThat(repo && base && candidate, 'Missing explicit classification input.'); return { repo, base, candidate };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(classifyApplicationRelease(classificationArguments(process.argv.slice(2))))); }
  catch { console.error(JSON.stringify({ status: 'REFUSED', reason: 'Release classification inputs failed read-only checks; no release is authorized.' })); process.exitCode = 1; }
}
