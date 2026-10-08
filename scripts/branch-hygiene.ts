// SPDX-License-Identifier: MPL-2.0
/**
 * Branch and worktree hygiene for this repository, or any other checkout.
 *
 * Reports every remote branch, local branch and worktree against the remote's
 * main branch. With --prune it removes only what main already holds and nobody
 * is using, and it writes the sha of everything it removes to a log first, so
 * each action can be undone. Report-only is the default.
 *
 *   node scripts/branch-hygiene.ts                        # this checkout
 *   node scripts/branch-hygiene.ts . ../lolly-work        # two repositories
 *   node scripts/branch-hygiene.ts --prune                # act on the plan
 *   node scripts/branch-hygiene.ts --remote-only --check  # the weekly workflow
 *
 * A branch is IN_MAIN when it has no commits beyond main, or when merging it
 * into main changes nothing (git merge-tree gives back main's own tree, which
 * also catches squash and rebase merges). OPEN_PR marks a branch that an open
 * pull request uses as its head or base. Everything else is UNIQUE and is never
 * touched.
 *
 * --prune deletes only:
 *  - remote branches that are IN_MAIN, have no open pull request and are not
 *    main or a protected branch (the push carries a lease on the sha seen, so a
 *    branch someone pushed to since is left alone);
 *  - worktrees that no process has as its working directory, whose index has
 *    not changed for --idle-minutes, that hold no uncommitted work apart from
 *    regenerable noise, no initialised submodule, no nested worktree and no
 *    ignored file outside the regenerable list, and whose HEAD is in main or on
 *    a remote branch that stays. Ignored plans/ notes move to
 *    plans/worktree-notes/<name>/ first;
 *  - local branches that are IN_MAIN and that no remaining worktree has checked
 *    out.
 */
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Pure classification (unit tested in tests/branch-hygiene.test.ts)
// ---------------------------------------------------------------------------

export type BranchStatus = 'MAIN' | 'IN_MAIN' | 'OPEN_PR' | 'UNIQUE';

export interface BranchFacts {
  name: string;
  isMain: boolean;
  /** Commits on the branch that main does not have. */
  ahead: number;
  /** Tree of main merged with the branch, or null when the merge conflicts or fails. */
  mergedTree: string | null;
  mainTree: string;
  /** Open pull requests that use the branch as their head or base. */
  openPrs: readonly number[];
}

export interface BranchVerdict {
  status: BranchStatus;
  /** True when main already holds every change on the branch. */
  inMain: boolean;
  detail: string;
}

export function classifyBranch(facts: BranchFacts): BranchVerdict {
  if (facts.isMain) return { status: 'MAIN', inMain: true, detail: 'main branch' };
  const inMain = facts.ahead === 0 || (facts.mergedTree !== null && facts.mergedTree === facts.mainTree);
  const commits = `${facts.ahead} commit${facts.ahead === 1 ? '' : 's'}`;
  const detail = facts.ahead === 0
    ? 'no commits beyond main'
    : inMain ? `${commits}, changes already in main` : `${commits} not in main`;
  if (facts.openPrs.length) {
    const prs = facts.openPrs.map((n) => `#${n}`).join(', ');
    return { status: 'OPEN_PR', inMain, detail: `open PR ${prs}; ${detail}` };
  }
  return { status: inMain ? 'IN_MAIN' : 'UNIQUE', inMain, detail };
}

export interface Decision {
  act: boolean;
  why: string;
}

const KEEP_NAMES = new Set(['main', 'master', 'HEAD']);

export interface RemoteDecisionInput {
  name: string;
  verdict: BranchVerdict;
  protectedBranch: boolean;
}

export interface RemoteDecisionContext {
  mainBranch: string;
  /** False when the open pull requests could not be read: nothing on the remote is deleted then. */
  prsKnown: boolean;
  /** False when the fetch failed, so the remote-tracking refs may be stale. */
  refsFresh: boolean;
  /** False when the protected branches could not be read. */
  protectionKnown: boolean;
}

export function decideRemote(branch: RemoteDecisionInput, ctx: RemoteDecisionContext): Decision {
  if (branch.verdict.status === 'MAIN' || branch.name === ctx.mainBranch || KEEP_NAMES.has(branch.name)) {
    return { act: false, why: 'main branch' };
  }
  if (branch.verdict.status === 'OPEN_PR') return { act: false, why: 'open pull request' };
  if (branch.verdict.status !== 'IN_MAIN') return { act: false, why: 'has changes that are not in main' };
  if (branch.protectedBranch) return { act: false, why: 'protected branch' };
  if (!ctx.prsKnown) return { act: false, why: 'open pull requests could not be read' };
  if (!ctx.refsFresh) return { act: false, why: 'fetch failed, remote refs may be stale' };
  if (!ctx.protectionKnown) return { act: false, why: 'branch protection could not be read' };
  return { act: true, why: 'in main, no open pull request' };
}

export interface WorktreeFacts {
  path: string;
  isMain: boolean;
  branch: string | null;
  head: string;
  locked: boolean;
  /** Registered with git but the directory is gone. */
  missing: boolean;
  /** Processes whose working directory is inside the worktree; null when that could not be checked. */
  cwdPids: readonly number[] | null;
  /** Minutes since the worktree's index last changed; null when unknown. */
  indexAgeMinutes: number | null;
  /** Uncommitted paths that are not regenerable noise. */
  dirty: readonly string[];
  /** Ignored paths that are neither regenerable nor plans/ notes; null until scanned. */
  ignoredKeep: readonly string[] | null;
  submoduleInitialised: boolean;
  /** Another registered worktree lives inside this one. */
  containsWorktree: boolean;
  headInMain: boolean;
  /** Remote branches (short names) whose history contains HEAD. */
  headOnRemote: readonly string[];
}

export interface WorktreeDecisionContext {
  idleMinutes: number;
  /** Remote branches this run deletes; they do not count as a safe home for HEAD. */
  prunedRemotes: ReadonlySet<string>;
}

export function decideWorktree(w: WorktreeFacts, ctx: WorktreeDecisionContext): Decision {
  if (w.isMain) return { act: false, why: 'main checkout' };
  if (w.locked) return { act: false, why: 'locked' };
  const remoteHome = w.headOnRemote.filter((name) => !ctx.prunedRemotes.has(name));
  const headSafe = w.headInMain || remoteHome.length > 0;
  if (w.missing) {
    // Only the administrative entry is left. A branch ref keeps the commits;
    // a detached HEAD that is nowhere else would become unreachable.
    if (w.branch !== null || headSafe) return { act: true, why: 'directory is gone' };
    return { act: false, why: 'directory is gone, but its detached HEAD is not in main or on a remote branch' };
  }
  if (w.cwdPids === null) return { act: false, why: 'could not check for processes using it' };
  if (w.cwdPids.length) return { act: false, why: `in use (pid ${w.cwdPids.join(', ')})` };
  if (w.indexAgeMinutes === null) return { act: false, why: 'index age unknown' };
  if (w.indexAgeMinutes < ctx.idleMinutes) return { act: false, why: `index changed ${Math.max(0, Math.floor(w.indexAgeMinutes))} min ago` };
  if (w.containsWorktree) return { act: false, why: 'another worktree lives inside it' };
  if (w.submoduleInitialised) return { act: false, why: 'has an initialised submodule' };
  if (w.dirty.length) return { act: false, why: `${w.dirty.length} uncommitted file${w.dirty.length === 1 ? '' : 's'}` };
  if (!headSafe) return { act: false, why: 'HEAD is not in main or on a remote branch' };
  if (w.ignoredKeep === null) return { act: false, why: 'ignored files not scanned' };
  if (w.ignoredKeep.length) {
    const shown = w.ignoredKeep.slice(0, 3).join(', ');
    const more = w.ignoredKeep.length > 3 ? ` and ${w.ignoredKeep.length - 3} more` : '';
    return { act: false, why: `ignored files to check by hand: ${shown}${more}` };
  }
  return { act: true, why: w.headInMain ? 'idle, clean, HEAD in main' : `idle, clean, HEAD on ${remoteHome[0]}` };
}

export interface LocalDecisionInput {
  name: string;
  verdict: BranchVerdict;
  /** Worktree paths that have the branch checked out. */
  checkedOutIn: readonly string[];
}

export interface LocalDecisionContext {
  mainBranch: string;
  /** Worktrees this run removes. */
  removedWorktrees: ReadonlySet<string>;
}

export function decideLocal(branch: LocalDecisionInput, ctx: LocalDecisionContext): Decision {
  if (branch.name === ctx.mainBranch || KEEP_NAMES.has(branch.name)) return { act: false, why: 'main branch' };
  const users = branch.checkedOutIn.filter((p) => !ctx.removedWorktrees.has(p));
  if (users.length) return { act: false, why: `checked out in ${users.join(', ')}` };
  if (branch.verdict.status === 'OPEN_PR') return { act: false, why: 'open pull request' };
  if (branch.verdict.status !== 'IN_MAIN') return { act: false, why: 'has changes that are not in main' };
  return { act: true, why: 'in main, not checked out' };
}

/** Uncommitted entries that a build or install recreates: node_modules links and hashed docs bundles. */
export const NOISE_PATTERNS: readonly RegExp[] = [
  /(?:^|\/)node_modules(?:\/|$)/,
  /^shells\/web\/public\/info\/docs\.[\w-]+\.(?:js|css)$/,
];

export interface StatusEntry {
  /** The two-letter porcelain v1 code, for example ' M', '??' or '!!'. */
  code: string;
  path: string;
}

/**
 * Noise is safe to lose with the worktree. A deleted gitlink (' D' on a
 * submodule path) means the submodule directory is absent, which loses nothing
 * by itself; an initialised submodule is refused separately.
 */
export function isNoise(entry: StatusEntry, submodulePaths: ReadonlySet<string>): boolean {
  const p = entry.path.replace(/\/$/, '');
  if (NOISE_PATTERNS.some((re) => re.test(p))) return true;
  return entry.code === ' D' && submodulePaths.has(p);
}

/** Ignored paths that are build output, caches or downloads and may go with the worktree. */
export const REGENERABLE_IGNORED: readonly RegExp[] = [
  /(?:^|\/)node_modules(?:\/|$)/,
  /(?:^|\/)(?:dist|target|coverage|\.vite|\.vite-temp|\.turbo|\.cache|\.vercel)(?:\/|$)/,
  /^shells\/web\/public\/(?:info|t|view|ort|ort-hf|viz-presets|models|examples)(?:\/|$)/,
  /^community\/emoji-packs\/[^/]+\.json\.gz$/,
  /(?:^|\/)\.DS_Store$/,
  /\.tsbuildinfo$/,
];

export type IgnoredKind = 'regenerable' | 'notes' | 'keep';

export function classifyIgnored(entryPath: string): IgnoredKind {
  const p = entryPath.replace(/\/$/, '');
  if (p === 'plans' || p.startsWith('plans/')) return 'notes';
  if (REGENERABLE_IGNORED.some((re) => re.test(p))) return 'regenerable';
  return 'keep';
}

/** Parse `git status --porcelain=v1 -z`. A rename or copy carries its source as the next field. */
export function parseStatusZ(text: string): StatusEntry[] {
  const fields = text.split('\0');
  const entries: StatusEntry[] = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field || field.length < 4) continue;
    const code = field.slice(0, 2);
    entries.push({ code, path: field.slice(3) });
    if (code[0] === 'R' || code[0] === 'C') i++;
  }
  return entries;
}

export interface WorktreeEntry {
  path: string;
  head: string;
  branch: string | null;
  locked: boolean;
  prunable: boolean;
  bare: boolean;
}

/** Parse `git worktree list --porcelain`. The first entry is the main checkout. */
export function parseWorktreePorcelain(text: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: WorktreeEntry | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice(9), head: '', branch: null, locked: false, prunable: false, bare: false };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace(/^refs\/heads\//, '');
    } else if (line === 'locked' || line.startsWith('locked ')) {
      current.locked = true;
    } else if (line === 'prunable' || line.startsWith('prunable ')) {
      current.prunable = true;
    } else if (line === 'bare') {
      current.bare = true;
    }
  }
  return entries;
}

export interface CwdEntry {
  pid: number;
  path: string;
}

/** Parse `lsof -d cwd -F pn`: a `p<pid>` line, then an `n<path>` line for its working directory. */
export function parseLsofCwd(text: string): CwdEntry[] {
  const entries: CwdEntry[] = [];
  let pid = -1;
  for (const line of text.split('\n')) {
    if (line.startsWith('p')) pid = Number(line.slice(1));
    else if (line.startsWith('n') && pid > 0) entries.push({ pid, path: line.slice(1) });
  }
  return entries;
}

/**
 * Give each process to the deepest worktree that contains its working
 * directory, so a shell inside .worktrees/x counts for x and not for the
 * surrounding main checkout.
 */
export function assignCwds(worktreePaths: readonly string[], cwds: readonly CwdEntry[]): Map<string, number[]> {
  const result = new Map<string, number[]>(worktreePaths.map((p) => [p, []]));
  const byDepth = [...worktreePaths].sort((a, b) => b.length - a.length);
  for (const cwd of cwds) {
    const owner = byDepth.find((p) => cwd.path === p || cwd.path.startsWith(`${p}/`));
    if (owner) result.get(owner)!.push(cwd.pid);
  }
  return result;
}

const TEMP_ROOTS = ['/tmp/', '/private/tmp/', '/var/folders/', '/private/var/folders/'];

export function worktreeLocationWarnings(worktreePath: string, mainCheckout: string): string[] {
  const warnings: string[] = [];
  if (TEMP_ROOTS.some((root) => `${worktreePath}/`.startsWith(root))) {
    warnings.push('in a temporary directory that macOS empties nightly; push the branch and move the worktree');
  }
  if (`${worktreePath}/`.includes('/plans/')) warnings.push('inside a plans/ directory');
  if (!worktreePath.startsWith(`${mainCheckout}/.worktrees/`)) {
    warnings.push(`outside ${path.basename(mainCheckout)}/.worktrees/`);
  }
  return warnings;
}

const DISCOURAGED_PREFIXES = ['backup/', 'scratch/', 'deploy/', 'integrate/', 'archive/'];

export function branchNameWarning(name: string): string | null {
  const prefix = DISCOURAGED_PREFIXES.find((p) => name.startsWith(p));
  return prefix ? `${prefix}* branch; keep superseded work as an archive/* tag instead` : null;
}

/** owner/repo for a GitHub remote URL, or null for any other host. */
export function parseGithubSlug(url: string): string | null {
  const match = url.trim().match(/github\.com[:/]+([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

export interface CheckInput {
  name: string;
  verdict: BranchVerdict;
  protectedBranch: boolean;
}

/** What the weekly workflow reports: too many branches, or merged branches still on the remote. */
export function checkFindings(remote: readonly CheckInput[], maxBranches: number): string[] {
  const findings: string[] = [];
  const nonMain = remote.filter((b) => b.verdict.status !== 'MAIN');
  if (nonMain.length > maxBranches) {
    findings.push(`${nonMain.length} non-main branches on the remote (limit ${maxBranches})`);
  }
  const merged = remote.filter((b) => b.verdict.status === 'IN_MAIN' && !b.protectedBranch);
  if (merged.length) {
    findings.push(`${merged.length} branch${merged.length === 1 ? '' : 'es'} already in main still on the remote: ${merged.map((b) => b.name).join(', ')}`);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface Options {
  repos: string[];
  prune: boolean;
  fetch: boolean;
  remoteOnly: boolean;
  remote: string;
  main: string | null;
  idleMinutes: number;
  format: 'text' | 'json' | 'markdown';
  check: boolean;
  maxBranches: number;
}

const USAGE = `Usage: node scripts/branch-hygiene.ts [repo-path ...] [options]

  --prune              delete what the report marks for pruning (default: report only)
  --no-fetch           use the remote-tracking refs as they are
  --remote-only        report remote branches only (what the weekly workflow runs)
  --remote=<name>      remote to compare against (default origin)
  --main=<branch>      main branch name (default: the remote's HEAD, else main)
  --idle-minutes=<n>   a worktree counts as idle after n minutes without an index change (default 30)
  --json, --markdown   output format (default: text)
  --check              exit 1 when the remote has more than --max-branches non-main
                       branches or keeps a branch that is already in main
  --max-branches=<n>   limit for --check (default 10)`;

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    repos: [],
    prune: false,
    fetch: true,
    remoteOnly: false,
    remote: 'origin',
    main: null,
    idleMinutes: 30,
    format: 'text',
    check: false,
    maxBranches: 10,
  };
  const positiveInt = (flag: string, value: string): number => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${flag} needs a whole number, got ${value}`);
    return n;
  };
  for (const arg of argv) {
    const [flag, value = ''] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg];
    if (flag === '--prune') options.prune = true;
    else if (flag === '--no-fetch') options.fetch = false;
    else if (flag === '--remote-only') options.remoteOnly = true;
    else if (flag === '--remote' && value) options.remote = value;
    else if (flag === '--main' && value) options.main = value;
    else if (flag === '--idle-minutes') options.idleMinutes = positiveInt(flag, value);
    else if (flag === '--json') options.format = 'json';
    else if (flag === '--markdown') options.format = 'markdown';
    else if (flag === '--check') options.check = true;
    else if (flag === '--max-branches') options.maxBranches = positiveInt(flag, value);
    else if (flag === '--') continue;
    else if (arg.startsWith('-')) throw new Error(`unknown option ${arg}`);
    else options.repos.push(arg);
  }
  if (!options.repos.length) options.repos.push('.');
  return options;
}

// ---------------------------------------------------------------------------
// Git and process helpers
// ---------------------------------------------------------------------------

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(cmd: string, args: readonly string[], cwd: string, timeoutMs = 300_000): RunResult {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    timeout: timeoutMs,
    // A report never rewrites another session's index: git status skips its optional index refresh.
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: `${result.stderr ?? ''}${result.error ? String(result.error) : ''}`,
  };
}

function git(cwd: string, args: readonly string[]): string {
  const result = run('git', args, cwd);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function gitOk(cwd: string, args: readonly string[]): boolean {
  return run('git', args, cwd).status === 0;
}

function canonical(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function listCwds(): CwdEntry[] | null {
  const result = run('lsof', ['-n', '-P', '-w', '-d', 'cwd', '-F', 'pn'], '/', 60_000);
  if (!result.stdout.trim()) return null;
  return parseLsofCwd(result.stdout).filter((entry) => entry.pid !== process.pid);
}

function gh(args: readonly string[], cwd: string): string | null {
  const result = run('gh', args, cwd, 120_000);
  return result.status === 0 ? result.stdout : null;
}

// ---------------------------------------------------------------------------
// Collecting a report
// ---------------------------------------------------------------------------

export interface RemoteBranch {
  name: string;
  sha: string;
  date: string;
  verdict: BranchVerdict;
  protectedBranch: boolean;
  warning: string | null;
  decision: Decision;
}

export interface LocalBranch {
  name: string;
  sha: string;
  date: string;
  upstream: string;
  upstreamGone: boolean;
  verdict: BranchVerdict;
  checkedOutIn: string[];
  warning: string | null;
  decision: Decision;
}

export interface Worktree extends WorktreeFacts {
  noise: number;
  notes: string[];
  indexMtimeMs: number | null;
  warnings: string[];
  decision: Decision;
}

export interface RepoReport {
  root: string;
  commonDir: string;
  slug: string | null;
  remote: string;
  mainBranch: string;
  mainSha: string;
  fetched: boolean;
  prsKnown: boolean;
  remoteBranches: RemoteBranch[];
  localBranches: LocalBranch[] | null;
  worktrees: Worktree[] | null;
  mainCheckout: { branch: string | null; behind: number; dirty: number } | null;
  warnings: string[];
}

const BEHIND_WARNING = 20;

class Classifier {
  private readonly cache = new Map<string, { ahead: number; mergedTree: string | null }>();
  private readonly root: string;
  private readonly mainRef: string;
  readonly mainTree: string;

  constructor(root: string, mainRef: string, mainTree: string) {
    this.root = root;
    this.mainRef = mainRef;
    this.mainTree = mainTree;
  }

  facts(sha: string): { ahead: number; mergedTree: string | null } {
    const cached = this.cache.get(sha);
    if (cached) return cached;
    const ahead = Number(git(this.root, ['rev-list', '--count', `${this.mainRef}..${sha}`]).trim());
    let mergedTree: string | null = null;
    if (ahead > 0) {
      const merge = run('git', ['merge-tree', '--write-tree', '--no-messages', this.mainRef, sha], this.root);
      if (merge.status === 0) mergedTree = merge.stdout.split('\n')[0]!.trim();
    }
    const result = { ahead, mergedTree };
    this.cache.set(sha, result);
    return result;
  }

  verdict(name: string, sha: string, isMain: boolean, openPrs: readonly number[]): BranchVerdict {
    if (isMain) return classifyBranch({ name, isMain, ahead: 0, mergedTree: null, mainTree: this.mainTree, openPrs });
    const { ahead, mergedTree } = this.facts(sha);
    return classifyBranch({ name, isMain, ahead, mergedTree, mainTree: this.mainTree, openPrs });
  }
}

function openPullRequests(slug: string | null, cwd: string): Map<string, number[]> | null {
  if (!slug) return null;
  const limit = 1000;
  const out = gh(['pr', 'list', '--repo', slug, '--state', 'open', '--limit', String(limit), '--json', 'number,headRefName,baseRefName'], cwd);
  if (out === null) return null;
  const byBranch = new Map<string, number[]>();
  const add = (name: string, n: number): void => {
    const list = byBranch.get(name) ?? [];
    if (!list.includes(n)) list.push(n);
    byBranch.set(name, list);
  };
  try {
    const list = JSON.parse(out) as { number: number; headRefName: string; baseRefName: string }[];
    // A full page may have left some pull requests out, so treat the list as unknown.
    if (!Array.isArray(list) || list.length >= limit) return null;
    for (const pr of list) {
      add(pr.headRefName, pr.number);
      add(pr.baseRefName, pr.number);
    }
  } catch {
    return null;
  }
  return byBranch;
}

function protectedBranches(slug: string | null, cwd: string): Set<string> | null {
  if (!slug) return null;
  const out = gh(['api', '--paginate', `repos/${slug}/branches?protected=true&per_page=100`, '--jq', '.[].name'], cwd);
  return out === null ? null : new Set(out.split('\n').filter(Boolean));
}

function remoteContaining(root: string, remote: string, sha: string): string[] {
  const out = run('git', ['for-each-ref', '--contains', sha, '--format=%(refname)', `refs/remotes/${remote}/`], root);
  if (out.status !== 0) return [];
  const prefix = `refs/remotes/${remote}/`;
  return out.stdout.split('\n').filter(Boolean).map((ref) => ref.slice(prefix.length)).filter((n) => n !== 'HEAD');
}

function submodulePaths(dir: string): Set<string> {
  if (!existsSync(path.join(dir, '.gitmodules'))) return new Set();
  const out = run('git', ['config', '-f', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$'], dir);
  return new Set(out.stdout.split('\n').filter(Boolean).map((line) => line.slice(line.indexOf(' ') + 1)));
}

function statusEntries(dir: string, ignored: boolean): StatusEntry[] {
  const args = ['status', '--porcelain=v1', '-z', '--untracked-files=normal'];
  if (ignored) args.push('--ignored=matching');
  return parseStatusZ(git(dir, args));
}

function gitDirOf(dir: string): string | null {
  const out = run('git', ['rev-parse', '--absolute-git-dir'], dir);
  return out.status === 0 ? out.stdout.trim() : null;
}

function indexMtime(gitDir: string | null): number | null {
  if (!gitDir) return null;
  try {
    return statSync(path.join(gitDir, 'index')).mtimeMs;
  } catch {
    return null;
  }
}

function hasInitialisedSubmodule(dir: string, gitDir: string | null, submodules: ReadonlySet<string>): boolean {
  if (gitDir) {
    const modules = path.join(gitDir, 'modules');
    if (existsSync(modules) && readdirSync(modules).length) return true;
  }
  return [...submodules].some((p) => existsSync(path.join(dir, p, '.git')));
}

export function collectRepo(target: string, options: Options): RepoReport {
  const start = canonical(path.resolve(target));
  const top = git(start, ['rev-parse', '--show-toplevel']).trim();
  const commonDir = canonical(git(top, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
  const entries = parseWorktreePorcelain(git(top, ['worktree', 'list', '--porcelain']));
  const root = canonical(entries[0]?.path ?? top);
  const remote = options.remote;
  const warnings: string[] = [];

  let fetched = false;
  if (options.fetch) {
    const fetch = run('git', ['fetch', '--prune', '--quiet', '--no-recurse-submodules', remote], root);
    fetched = fetch.status === 0;
    if (!fetched) warnings.push(`git fetch ${remote} failed: ${fetch.stderr.trim().split('\n')[0] ?? ''}`);
  }
  const remoteHead = run('git', ['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`], root).stdout.trim();
  const mainBranch = options.main ?? (remoteHead ? remoteHead.slice(remote.length + 1) : 'main');
  const mainRef = `refs/remotes/${remote}/${mainBranch}`;
  const mainSha = git(root, ['rev-parse', mainRef]).trim();
  const classifier = new Classifier(root, mainRef, git(root, ['rev-parse', `${mainRef}^{tree}`]).trim());
  const remoteUrl = run('git', ['remote', 'get-url', remote], root).stdout.trim();
  const slug = parseGithubSlug(remoteUrl);
  const prs = openPullRequests(slug, root);
  const prsKnown = prs !== null;
  if (!prsKnown) warnings.push('open pull requests could not be read (gh missing, offline, or not a GitHub remote); remote branches are kept');
  const guarded = protectedBranches(slug, root);
  const protectionKnown = guarded !== null;
  const refsFresh = fetched || !options.fetch;

  const remoteRefs = git(root, ['for-each-ref', '--format=%(refname)%09%(objectname)%09%(committerdate:short)', `refs/remotes/${remote}/`]);
  const remoteBranches: RemoteBranch[] = [];
  for (const line of remoteRefs.split('\n').filter(Boolean)) {
    const [ref = '', sha = '', date = ''] = line.split('\t');
    const name = ref.slice(`refs/remotes/${remote}/`.length);
    if (name === 'HEAD') continue;
    const verdict = classifier.verdict(name, sha, name === mainBranch, prs?.get(name) ?? []);
    const protectedBranch = guarded?.has(name) ?? false;
    const decision = decideRemote({ name, verdict, protectedBranch }, { mainBranch, prsKnown, refsFresh, protectionKnown });
    remoteBranches.push({ name, sha, date, verdict, protectedBranch, warning: branchNameWarning(name), decision });
  }
  const prunedRemotes = new Set(remoteBranches.filter((b) => b.decision.act).map((b) => b.name));

  if (options.remoteOnly) {
    return { root, commonDir, slug, remote, mainBranch, mainSha, fetched, prsKnown, remoteBranches, localBranches: null, worktrees: null, mainCheckout: null, warnings };
  }

  const worktrees = collectWorktrees(root, entries, classifier, remote, options.idleMinutes, prunedRemotes);
  const removed = new Set(worktrees.filter((w) => w.decision.act).map((w) => w.path));

  const localRefs = git(root, ['for-each-ref', '--format=%(refname:lstrip=2)%09%(objectname)%09%(committerdate:short)%09%(upstream:short)%09%(upstream:track)', 'refs/heads/']);
  const localBranches: LocalBranch[] = [];
  for (const line of localRefs.split('\n').filter(Boolean)) {
    const [name = '', sha = '', date = '', upstream = '', track = ''] = line.split('\t');
    // Every pull request uses main as its base; that says nothing about the local main branch.
    const verdict = classifier.verdict(name, sha, false, name === mainBranch ? [] : (prs?.get(name) ?? []));
    const checkedOutIn = worktrees.filter((w) => w.branch === name).map((w) => w.path);
    const decision = decideLocal({ name, verdict, checkedOutIn }, { mainBranch, removedWorktrees: removed });
    localBranches.push({ name, sha, date, upstream, upstreamGone: track === '[gone]', verdict, checkedOutIn, warning: branchNameWarning(name), decision });
  }

  const main = worktrees[0];
  let mainCheckout: RepoReport['mainCheckout'] = null;
  if (main && !main.missing) {
    const behind = Number(git(root, ['rev-list', '--count', `HEAD..${mainRef}`]).trim());
    mainCheckout = { branch: main.branch, behind, dirty: main.dirty.length };
    if (main.branch !== mainBranch) warnings.push(`the main checkout is on ${main.branch ?? 'a detached HEAD'}, not ${mainBranch}`);
    if (behind > BEHIND_WARNING) warnings.push(`the main checkout is ${behind} commits behind ${remote}/${mainBranch}`);
    if (main.dirty.length) warnings.push(`the main checkout holds ${main.dirty.length} uncommitted files; commit them to a branch and push`);
  }
  for (const w of worktrees) for (const warning of w.warnings) warnings.push(`worktree ${displayPath(w.path, root)}: ${warning}`);
  for (const b of remoteBranches) if (b.warning) warnings.push(`remote ${b.name}: ${b.warning}`);
  for (const b of localBranches) if (b.warning) warnings.push(`local ${b.name}: ${b.warning}`);

  return { root, commonDir, slug, remote, mainBranch, mainSha, fetched, prsKnown, remoteBranches, localBranches, worktrees, mainCheckout, warnings };
}

function collectWorktrees(
  root: string,
  entries: readonly WorktreeEntry[],
  classifier: Classifier,
  remote: string,
  idleMinutes: number,
  prunedRemotes: ReadonlySet<string>
): Worktree[] {
  const cwds = listCwds();
  const paths = entries.map((e, i) => (i === 0 ? root : canonical(e.path)));
  const owners = cwds ? assignCwds(paths, cwds) : null;
  const now = Date.now();
  const worktrees: Worktree[] = [];
  entries.forEach((entry, i) => {
    const wtPath = paths[i]!;
    const isMain = i === 0;
    const missing = entry.prunable || !existsSync(wtPath);
    const gitDir = missing ? null : gitDirOf(wtPath);
    const mtime = indexMtime(gitDir);
    const submodules = missing ? new Set<string>() : submodulePaths(wtPath);
    const dirty: string[] = [];
    let noise = 0;
    if (!missing) {
      try {
        for (const status of statusEntries(wtPath, false)) {
          if (isNoise(status, submodules)) noise++;
          else dirty.push(status.path);
        }
      } catch {
        dirty.push('(git status failed)');
      }
    }
    const head = entry.head;
    const headInMain = head ? classifier.verdict(entry.branch ?? head, head, false, []).inMain : false;
    const facts: WorktreeFacts = {
      path: wtPath,
      isMain,
      branch: entry.branch,
      head,
      locked: entry.locked,
      missing,
      cwdPids: owners ? (owners.get(wtPath) ?? []) : null,
      indexAgeMinutes: mtime === null ? null : (now - mtime) / 60_000,
      dirty,
      ignoredKeep: null,
      submoduleInitialised: missing ? false : hasInitialisedSubmodule(wtPath, gitDir, submodules),
      containsWorktree: paths.some((other) => other !== wtPath && other.startsWith(`${wtPath}/`)),
      headInMain,
      headOnRemote: head && !headInMain ? remoteContaining(root, remote, head) : [],
    };
    let notes: string[] = [];
    let decision = decideWorktree(facts, { idleMinutes, prunedRemotes });
    // Only a worktree that passes every other test pays for the ignored-file scan.
    if (!missing && decideWorktree({ ...facts, ignoredKeep: [] }, { idleMinutes, prunedRemotes }).act) {
      const keep: string[] = [];
      try {
        for (const status of statusEntries(wtPath, true)) {
          if (status.code !== '!!') continue;
          const kind = classifyIgnored(status.path);
          if (kind === 'notes') notes.push(status.path);
          else if (kind === 'keep') keep.push(status.path);
        }
      } catch {
        keep.push('(git status --ignored failed)');
      }
      facts.ignoredKeep = keep;
      decision = decideWorktree(facts, { idleMinutes, prunedRemotes });
      if (!decision.act) notes = [];
    }
    worktrees.push({
      ...facts,
      noise,
      notes,
      indexMtimeMs: mtime,
      warnings: isMain ? [] : worktreeLocationWarnings(wtPath, root),
      decision,
    });
  });
  return worktrees;
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
}

class ActionLog {
  readonly notesRoot: string;
  readonly file: string;
  constructor(report: RepoReport) {
    const ignored = gitOk(report.root, ['check-ignore', '-q', 'plans/worktree-notes/probe']);
    this.notesRoot = ignored ? path.join(report.root, 'plans', 'worktree-notes') : path.join(report.commonDir, 'branch-hygiene');
    this.file = path.join(this.notesRoot, `branch-hygiene-${stamp()}.log`);
  }
  write(line: string): void {
    mkdirSync(this.notesRoot, { recursive: true });
    appendFileSync(this.file, `${new Date().toISOString()} ${line}\n`);
    console.log(`  ${line}`);
  }
}

function moveNotes(worktree: Worktree, log: ActionLog): boolean {
  for (const rel of worktree.notes) {
    const src = path.join(worktree.path, rel.replace(/\/$/, ''));
    if (!existsSync(src) || lstatSync(src).isSymbolicLink()) continue;
    let dst = path.join(log.notesRoot, path.basename(worktree.path), rel.replace(/\/$/, ''));
    if (existsSync(dst)) dst = `${dst}-${stamp()}`;
    mkdirSync(path.dirname(dst), { recursive: true });
    try {
      renameSync(src, dst);
    } catch {
      try {
        cpSync(src, dst, { recursive: true, verbatimSymlinks: true });
        rmSync(src, { recursive: true, force: true });
      } catch (error) {
        log.write(`notes-move-failed ${src}: ${String(error)}; worktree kept`);
        return false;
      }
    }
    log.write(`notes-moved ${src} -> ${dst}`);
  }
  return true;
}

/** Re-read the facts that could have changed since the report; a reason means skip. */
function recheckWorktree(worktree: Worktree, cwds: CwdEntry[] | null): string | null {
  if (!existsSync(worktree.path)) return 'directory vanished';
  if (cwds === null) return 'could not check for processes using it';
  const owners = assignCwds([worktree.path], cwds).get(worktree.path) ?? [];
  if (owners.length) return `now in use (pid ${owners.join(', ')})`;
  const head = run('git', ['rev-parse', 'HEAD'], worktree.path).stdout.trim();
  if (head !== worktree.head) return 'HEAD moved';
  if (indexMtime(gitDirOf(worktree.path)) !== worktree.indexMtimeMs) return 'index changed';
  try {
    const submodules = submodulePaths(worktree.path);
    if (hasInitialisedSubmodule(worktree.path, gitDirOf(worktree.path), submodules)) return 'a submodule was initialised';
    const status = statusEntries(worktree.path, false);
    const dirty = status.filter((s) => !isNoise(s, submodules));
    if (dirty.length) return `${dirty.length} uncommitted files appeared`;
    const ignored = statusEntries(worktree.path, true).filter((s) => s.code === '!!');
    const keep = ignored.filter((s) => classifyIgnored(s.path) === 'keep');
    if (keep.length) return `ignored files to check by hand appeared: ${keep.map((s) => s.path).join(', ')}`;
    // Refresh what the removal acts on: --force only for noise, and every current plans/ note moves.
    worktree.noise = status.length;
    worktree.notes = ignored.filter((s) => classifyIgnored(s.path) === 'notes').map((s) => s.path);
  } catch (error) {
    return `git status failed: ${(error as Error).message}`;
  }
  return null;
}

export function prune(report: RepoReport): void {
  const log = new ActionLog(report);
  console.log(`\nPruning ${report.root} (log: ${log.file})`);

  for (const b of report.remoteBranches.filter((x) => x.decision.act)) {
    log.write(`remote-branch ${report.remote}/${b.name} ${b.sha} restore: git push ${report.remote} ${b.sha}:refs/heads/${b.name}`);
    // The lease refuses the delete if the branch moved since the fetch. --no-verify:
    // a delete carries no content for the pre-push wording gate to read.
    const push = run('git', ['push', '--no-verify', '--quiet', `--force-with-lease=refs/heads/${b.name}:${b.sha}`, report.remote, `:refs/heads/${b.name}`], report.root);
    log.write(push.status === 0 ? `  deleted ${report.remote}/${b.name}` : `  FAILED ${report.remote}/${b.name}: ${push.stderr.trim()}`);
  }

  const worktrees = report.worktrees ?? [];
  const missing = worktrees.filter((w) => w.missing && !w.locked && !w.isMain);
  if (missing.length && missing.every((w) => w.decision.act)) {
    for (const w of missing) log.write(`worktree-entry ${w.path} ${w.head} ${w.branch ?? '(detached)'} restore: git worktree add ${w.path} ${w.branch ?? w.head}`);
    const result = run('git', ['worktree', 'prune'], report.root);
    log.write(result.status === 0 ? '  pruned entries for missing worktrees' : `  FAILED git worktree prune: ${result.stderr.trim()}`);
  } else if (missing.some((w) => w.decision.act)) {
    console.log('  skipped missing-worktree entries: another missing worktree holds the only reference to its HEAD');
  }

  const candidates = worktrees.filter((w) => w.decision.act && !w.missing);
  const cwds = candidates.length ? listCwds() : null;
  for (const w of candidates) {
    const reason = recheckWorktree(w, cwds);
    if (reason) {
      console.log(`  skipped worktree ${w.path}: ${reason}`);
      continue;
    }
    log.write(`worktree ${w.path} ${w.head} ${w.branch ?? '(detached)'} restore: git worktree add ${w.path} ${w.branch ?? w.head}`);
    if (!moveNotes(w, log)) continue;
    const args = ['worktree', 'remove'];
    if (w.noise > 0) args.push('--force');
    args.push(w.path);
    const result = run('git', args, report.root);
    log.write(result.status === 0 ? `  removed ${w.path}` : `  FAILED ${w.path}: ${result.stderr.trim()}`);
  }

  for (const b of (report.localBranches ?? []).filter((x) => x.decision.act)) {
    const now = run('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${b.name}`], report.root).stdout.trim();
    if (now !== b.sha) {
      console.log(`  skipped local ${b.name}: moved since the report`);
      continue;
    }
    log.write(`local-branch ${b.name} ${b.sha} restore: git branch ${b.name} ${b.sha}`);
    // git refuses to delete a branch that any worktree still has checked out.
    const result = run('git', ['branch', '-D', b.name], report.root);
    log.write(result.status === 0 ? `  deleted ${b.name}` : `  FAILED ${b.name}: ${result.stderr.trim()}`);
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function short(sha: string): string {
  return sha.slice(0, 9);
}

function counts<T extends { verdict: BranchVerdict }>(list: readonly T[]): string {
  const tally = new Map<BranchStatus, number>();
  for (const item of list) tally.set(item.verdict.status, (tally.get(item.verdict.status) ?? 0) + 1);
  return (['IN_MAIN', 'OPEN_PR', 'UNIQUE', 'MAIN'] as const)
    .filter((s) => tally.get(s))
    .map((s) => `${s} ${tally.get(s)}`)
    .join(', ');
}

function displayPath(p: string, root: string): string {
  if (p === root) return '.';
  if (p.startsWith(`${root}/`)) return p.slice(root.length + 1);
  const home = process.env.HOME;
  return home && p.startsWith(`${home}/`) ? `~/${p.slice(home.length + 1)}` : p;
}

function mark(decision: Decision): string {
  return decision.act ? 'PRUNE' : 'keep ';
}

export function renderText(report: RepoReport, pruning: boolean): string {
  const lines: string[] = [];
  const where = report.slug ? `${report.slug}, ` : '';
  lines.push(`== ${report.root} (${where}${report.remote}/${report.mainBranch} at ${short(report.mainSha)})`);
  const pad = (s: string, n: number): string => (s.length >= n ? s : s + ' '.repeat(n - s.length));

  lines.push(`\nRemote branches: ${report.remoteBranches.length} (${counts(report.remoteBranches)})`);
  for (const b of report.remoteBranches) {
    // A kept IN_MAIN branch is the one case where the reason is not already in the status.
    const why = b.verdict.status === 'IN_MAIN' && !b.decision.act ? `; kept: ${b.decision.why}` : '';
    lines.push(`  ${mark(b.decision)} ${pad(b.verdict.status, 7)} ${pad(b.name, 48)} ${short(b.sha)} ${b.date}  ${b.verdict.detail}${why}`);
  }

  if (report.localBranches) {
    lines.push(`\nLocal branches: ${report.localBranches.length} (${counts(report.localBranches)})`);
    for (const b of report.localBranches) {
      const upstream = b.upstream ? ` [${b.upstream}${b.upstreamGone ? ', gone' : ''}]` : '';
      const where = b.checkedOutIn.length ? `; checked out in ${b.checkedOutIn.map((p) => displayPath(p, report.root)).join(', ')}` : '';
      lines.push(`  ${mark(b.decision)} ${pad(b.verdict.status, 7)} ${pad(b.name, 48)} ${short(b.sha)} ${b.date}${upstream}  ${b.verdict.detail}${where}`);
    }
  }

  if (report.worktrees) {
    lines.push(`\nWorktrees: ${report.worktrees.length}`);
    for (const w of report.worktrees) {
      const idle = w.indexAgeMinutes === null ? '?' : `${Math.max(0, Math.floor(w.indexAgeMinutes))}m`;
      const cwd = w.cwdPids === null ? '?' : w.cwdPids.length ? `pid ${w.cwdPids.join(',')}` : '-';
      const head = w.missing ? 'missing' : w.headInMain ? 'in main' : w.headOnRemote.length ? `on ${w.headOnRemote[0]}` : 'not pushed';
      const notes = w.notes.length ? `, notes: ${w.notes.join(' ')}` : '';
      lines.push(`  ${mark(w.decision)} ${pad(displayPath(w.path, report.root), 52)} ${pad(w.branch ?? `(detached ${short(w.head)})`, 44)} cwd:${cwd} idle:${idle} dirty:${w.dirty.length} noise:${w.noise} head:${head}${notes}  ${w.decision.why}`);
    }
  }

  if (report.warnings.length) {
    lines.push('\nWarnings:');
    for (const warning of report.warnings) lines.push(`  - ${warning}`);
  }

  const plan = [
    `${report.remoteBranches.filter((b) => b.decision.act).length} remote branches`,
    report.worktrees ? `${report.worktrees.filter((w) => w.decision.act).length} worktrees` : '',
    report.localBranches ? `${report.localBranches.filter((b) => b.decision.act).length} local branches` : '',
  ].filter(Boolean).join(', ');
  lines.push(`\n${pruning ? 'Pruning' : 'Would prune (pass --prune to act)'}: ${plan}`);
  return lines.join('\n');
}

export function renderMarkdown(report: RepoReport, findings: readonly string[]): string {
  const lines: string[] = [];
  const name = report.slug ?? path.basename(report.root);
  lines.push(`Weekly report for \`${name}\` against \`${report.remote}/${report.mainBranch}\` at \`${short(report.mainSha)}\`.`, '');
  if (findings.length) {
    for (const finding of findings) lines.push(`- ${finding}`);
  } else {
    lines.push('- No findings.');
  }
  lines.push('', '| Branch | Status | Last commit | Detail |', '|---|---|---|---|');
  for (const b of report.remoteBranches) {
    lines.push(`| \`${b.name}\` | ${b.verdict.status} | ${b.date} | ${b.verdict.detail}${b.warning ? `; ${b.warning}` : ''} |`);
  }
  lines.push(
    '',
    'Branches marked IN_MAIN hold nothing that main lacks. To delete them, and the matching local branches and idle worktrees, run `node scripts/branch-hygiene.ts --prune` from a checkout; it logs every sha it removes.'
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function main(argv: readonly string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  let options: Options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const reports: RepoReport[] = [];
  let failed = false;
  for (const repo of options.repos) {
    try {
      const report = collectRepo(repo, options);
      // Two paths into one repository (a worktree and its main checkout) report once.
      if (!reports.some((r) => r.commonDir === report.commonDir)) reports.push(report);
    } catch (error) {
      console.error(`branch-hygiene: ${repo}: ${(error as Error).message}`);
      failed = true;
    }
  }
  let findingsTotal = 0;
  const outputs: string[] = [];
  const withFindings = reports.map((report) => ({ ...report, findings: checkFindings(report.remoteBranches, options.maxBranches) }));
  for (const report of withFindings) {
    findingsTotal += report.findings.length;
    if (options.format === 'markdown') outputs.push(renderMarkdown(report, report.findings));
    else if (options.format === 'text') {
      outputs.push(renderText(report, options.prune));
      if (options.check) outputs.push(report.findings.length ? report.findings.map((f) => `CHECK: ${f}`).join('\n') : 'CHECK: clean');
    }
  }
  if (options.format === 'json') console.log(JSON.stringify(withFindings, null, 2));
  else console.log(outputs.join('\n\n'));
  if (options.prune) for (const report of reports) prune(report);
  if (failed) return 2;
  return options.check && findingsTotal ? 1 : 0;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = main(process.argv.slice(2));
