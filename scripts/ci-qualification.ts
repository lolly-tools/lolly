// SPDX-License-Identifier: MPL-2.0
/** Qualify one immutable CI attempt; this never publishes an application. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const POLICY = 'scripts/ci-qualification.ts';
export const WORKFLOW = '.github/workflows/ci.yml';
export const PUBLIC_JOBS = ['secret history scan', 'typecheck', 'build + bundle budget', 'test (contracts)',
  'test (security)', 'validate catalog', 'smoke (render every tool)', 'opengrep (custom rules + new findings)',
  'deployment scope', 'test (public-ready UI)'] as const;
export const RELEASE_JOBS = [...PUBLIC_JOBS, 'test (unit:engine)', 'test (unit:web)', 'test (tools)',
  'test (browser 1/4)', 'test (browser 2/4)', 'test (browser 3/4)', 'test (browser 4/4)', 'test (browser)',
  'test (tauri)', 'test (conformance)', 'test (fuzz:regression)', 'api bundle drift', 'render-action self-test',
  'npm audit (high+critical)'] as const;
export type Tier = 'public-ready' | 'release-ready';
export interface Identity {
  source: string; tree: string; base: string; headSha: string; repository: string; repositoryId: number;
  headRepository: string; headBranch: string; event: 'push' | 'pull_request'; runId: number; runAttempt: number;
}
export interface Change { path: string; beforeMode: string; afterMode: string }
export interface Scope extends Identity {
  version: 1; publicReadyEligible: boolean; policyCommit: string; policySha256: string | null;
  changedPathsSha256: string; changes: Change[]; reasons: string[];
}
type ObjectValue = Record<string, unknown>;
export interface Job extends ObjectValue { id: number; name: string; status: string; conclusion: unknown }
function need(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function object(value: unknown): ObjectValue {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected JSON object');
  return value as ObjectValue;
}
export const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
function git(args: string[], root = process.cwd()): string {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }, encoding: 'utf8',
      timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
}

/** Deliberately narrower than shell compatibility: startup, bridges and auth need the full suite. */
export function classifyChanges(changes: Change[]): { publicReadyEligible: boolean; reasons: string[] } {
  const protectedName = /(?:^|[/_.-])(?:auth|account|session|login|signin|signup|password|credential|permission|policy|trust|security|org|admin|invite|collab|gateway|remote|iframe|embed|release|webgpu|profile|identity|connections|instance)(?:[/_.-]|$)/i;
  const ui = (name: string) => !protectedName.test(name) && (
    /^shells\/web\/src\/(?:components|styles|views)\/.+\.(?:ts|css|html|svg)$/.test(name)
    || /^shells\/web\/src\/lib\/(?:edge-dock(?:-split-default)?|lolly-ui-tokens)(?:\.test)?\.(?:ts|css)$/.test(name)
    || ['shells/web/src/primitive-guards.test.ts', 'shells/web/src/README.md',
      'shells/web/design/chrome-tokens.json', 'shells/web/design/ui-semantics.json', 'tests/chrome-tokens.test.ts'].includes(name));
  const reasons = changes.filter(change => !change.path || change.path.includes('\\')
    || [...change.path].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || change.path.split('/').some(part => !part || part === '.' || part === '..')
    || ![change.beforeMode, change.afterMode].every(mode => mode === '000000' || mode === '100644')
    || !ui(change.path)).map(change => `Full release required: ${change.path}`);
  if (!changes.some(change => ui(change.path) && !change.path.endsWith('.test.ts') && !change.path.endsWith('.md'))) {
    reasons.push('A substantive UI change is required for the public-ready tier');
  }
  return { publicReadyEligible: reasons.length === 0, reasons };
}

export function identity(env: NodeJS.ProcessEnv = process.env): Identity {
  const source = git(['rev-parse', 'HEAD']).trim(), tree = git(['rev-parse', 'HEAD^{tree}']).trim();
  const value = { source, tree, base: env.CI_BASE_SHA ?? '', headSha: env.CI_HEAD_SHA ?? '',
    repository: env.GITHUB_REPOSITORY ?? '', repositoryId: Number(env.GITHUB_REPOSITORY_ID),
    headRepository: env.CI_HEAD_REPOSITORY ?? '', headBranch: env.CI_HEAD_BRANCH ?? '',
    event: env.GITHUB_EVENT_NAME, runId: Number(env.GITHUB_RUN_ID), runAttempt: Number(env.GITHUB_RUN_ATTEMPT) };
  need(source === env.GITHUB_SHA && [source, tree, value.base, value.headSha].every(sha => SHA.test(sha)), 'Exact source/base/tree required');
  need(REPOSITORY.test(value.repository) && REPOSITORY.test(value.headRepository), 'Exact repository identities required');
  need([value.repositoryId, value.runId, value.runAttempt].every(n => Number.isSafeInteger(n) && n > 0), 'Positive provider identities required');
  need(value.event === 'push' || value.event === 'pull_request', 'Unsupported CI event');
  need(value.headBranch.length > 0 && value.headBranch.length < 256 && !/[\r\n]/.test(value.headBranch), 'Invalid head branch');
  if (value.event === 'push') need(value.headBranch === 'main' && value.headRepository === value.repository && value.headSha === source, 'Main push source differs');
  return value as Identity;
}

export function inspectScope(id: Identity, root = process.cwd(), policyPath = fileURLToPath(import.meta.url)): Scope {
  git(['merge-base', '--is-ancestor', id.base, id.source], root);
  const policy = readFileSync(policyPath);
  need(Buffer.from(git(['show', `${id.base}:${POLICY}`], root)).equals(policy), 'Classifier must be exact trusted base bytes');
  const inventory = git(['diff', '--raw', '-z', '--no-abbrev', '--no-renames', '--no-ext-diff', '--no-textconv', id.base, id.source, '--'], root);
  const records = inventory.split('\0');
  need(records.pop() === '' && records.length % 2 === 0 && records.length <= 8192, 'Incomplete or oversized change inventory');
  const changes: Change[] = [];
  for (let i = 0; i < records.length; i += 2) {
    const match = /^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} [ADMT]$/.exec(records[i] ?? '');
    need(match && records[i + 1], 'Ambiguous changed path');
    changes.push({ path: records[i + 1]!, beforeMode: match[1]!, afterMode: match[2]! });
  }
  need(new Set(changes.map(change => change.path)).size === changes.length, 'Duplicate changed path');
  return { version: 1, ...id, ...classifyChanges(changes), policyCommit: id.base, policySha256: hash(policy),
    changedPathsSha256: hash(JSON.stringify(changes)), changes };
}

export function validateScope(value: unknown, id: Identity): Scope {
  const scope = object(value);
  for (const [key, expected] of Object.entries(id)) need(scope[key] === expected, `Scope ${key} differs`);
  need(scope.version === 1 && typeof scope.publicReadyEligible === 'boolean' && scope.policyCommit === id.base, 'Invalid scope policy');
  need(Array.isArray(scope.changes) && Array.isArray(scope.reasons) && scope.changes.length <= 4096, 'Missing scope inventory');
  need(scope.changedPathsSha256 === hash(JSON.stringify(scope.changes)), 'Scope inventory digest differs');
  need(scope.policySha256 === null || /^[a-f0-9]{64}$/.test(String(scope.policySha256)), 'Invalid policy digest');
  if (scope.publicReadyEligible) {
    need(scope.policySha256 !== null && classifyChanges(scope.changes as Change[]).publicReadyEligible, 'Public-ready scope is not eligible');
  }
  return scope as unknown as Scope;
}

/** Check every provider job, including jobs outside the selected tier. */
export function assessJobs(runValue: unknown, pages: unknown[], id: Identity, scope: Scope, tier: Tier, aggregate = false): { ready: boolean; jobs: Job[]; required: string[] } {
  const run = object(runValue);
  need(run.id === id.runId && run.run_attempt === id.runAttempt && run.head_sha === id.headSha
    && run.path === WORKFLOW && run.event === id.event && run.head_branch === id.headBranch
    && object(run.repository).full_name === id.repository && object(run.repository).id === id.repositoryId
    && object(run.head_repository).full_name === id.headRepository, 'Provider run identity differs');
  need(['queued', 'pending', 'in_progress', 'completed'].includes(String(run.status)), 'Unknown provider run status');
  need(run.conclusion === null || run.conclusion === 'success', 'Provider run has a known failure');
  need(run.status !== 'completed' || run.conclusion === 'success', 'Completed provider run did not succeed');
  need(tier !== 'public-ready' || scope.publicReadyEligible, 'Broad changes require release-ready');
  const jobs: Job[] = [];
  let total: number | undefined;
  for (const value of pages) {
    const page = object(value);
    need(Number.isSafeInteger(page.total_count) && Number(page.total_count) > 0 && Number(page.total_count) <= 1000
      && Array.isArray(page.jobs), 'Invalid complete job inventory');
    total ??= Number(page.total_count); need(page.total_count === total, 'Job inventory changed during pagination');
    jobs.push(...page.jobs.map(value => object(value) as Job));
  }
  need(jobs.length === total && new Set(jobs.map(job => job.id)).size === jobs.length
    && new Set(jobs.map(job => job.name)).size === jobs.length, 'Incomplete or duplicate job inventory');
  for (const job of jobs) {
    need(Number.isSafeInteger(job.id) && job.id > 0 && typeof job.name === 'string' && job.run_id === id.runId
      && job.run_attempt === id.runAttempt && job.head_sha === id.headSha && job.head_branch === id.headBranch
      && job.workflow_name === 'CI', 'Provider job identity differs');
    need(['queued', 'pending', 'waiting', 'in_progress', 'completed'].includes(job.status), 'Unknown job status');
    if (job.conclusion === 'skipped') {
      need(job.status === 'completed' && (job.name === 'verified instance shell'
        || (job.name === 'public-ready' && !scope.publicReadyEligible)), 'Unreviewed skipped job');
    } else {
      need(job.conclusion === null || job.conclusion === 'success', `Known failed job: ${job.name}`);
      need(job.status !== 'completed' || job.conclusion === 'success', `Completed job did not succeed: ${job.name}`);
    }
  }
  const required: string[] = [...(tier === 'public-ready' ? PUBLIC_JOBS : RELEASE_JOBS), ...(aggregate ? [tier] : [])];
  return { ready: required.every(name => jobs.some(job => job.name === name && job.status === 'completed' && job.conclusion === 'success')), jobs, required };
}

async function provider(path: string): Promise<{ bytes: Buffer; value: unknown }> {
  const token = process.env.GH_TOKEN;
  need(token && !/[\r\n]/.test(token), 'Missing provider read token');
  const response = await fetch(`https://api.github.com${path}`, { redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } });
  need(response.status === 200 && response.body, `Provider read failed (${response.status})`);
  const chunks: Uint8Array[] = []; let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength; need(size <= 4 * 1024 * 1024, 'Provider response exceeds bound'); chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  const bytes = Buffer.concat(chunks); return { bytes, value: JSON.parse(bytes.toString('utf8')) as unknown };
}

export async function qualify(id: Identity, scope: Scope, tier: Tier, out: string, aggregate: boolean): Promise<void> {
  mkdirSync(out, { recursive: true });
  const deadline = Date.now() + (tier === 'public-ready' ? 45 : 115) * 60 * 1000;
  let snapshot = 0;
  for (;;) {
    const run = await provider(`/repos/${id.repository}/actions/runs/${id.runId}`);
    const pages: Awaited<ReturnType<typeof provider>>[] = [];
    for (let page = 1; page <= 10; page++) {
      const next = await provider(`/repos/${id.repository}/actions/runs/${id.runId}/attempts/${id.runAttempt}/jobs?per_page=100&page=${page}`);
      pages.push(next);
      if (page * 100 >= Number(object(next.value).total_count)) break;
    }
    const dir = resolve(out, `snapshot-${String(++snapshot).padStart(3, '0')}`); mkdirSync(dir);
    writeFileSync(resolve(dir, 'run.original.json'), run.bytes, { flag: 'wx' });
    pages.forEach((page, i) => { writeFileSync(resolve(dir, `jobs-${i + 1}.original.json`), page.bytes, { flag: 'wx' }); });
    const assessment = assessJobs(run.value, pages.map(page => page.value), id, scope, tier, aggregate);
    if (assessment.ready) {
      writeFileSync(resolve(out, 'run.original.json'), run.bytes, { flag: 'wx' });
      pages.forEach((page, i) => { writeFileSync(resolve(out, `jobs-${i + 1}.original.json`), page.bytes, { flag: 'wx' }); });
      writeFileSync(resolve(out, 'scope.json'), `${JSON.stringify(scope, null, 2)}\n`, { flag: 'wx' });
      const report = { version: 1, status: 'CI_QUALIFIED', qualificationTier: tier, fullSuiteQualified: tier === 'release-ready', ...id,
        workflow: WORKFLOW, scope: { publicReadyEligible: scope.publicReadyEligible, policyCommit: scope.policyCommit,
          policySha256: scope.policySha256, changedPathsSha256: scope.changedPathsSha256 },
        requiredJobs: assessment.required.map(name => { const job = assessment.jobs.find(job => job.name === name)!;
          return { id: job.id, name, conclusion: job.conclusion }; }),
        provider: { run: { path: 'run.original.json', sha256: hash(run.bytes) }, jobs: pages.map((page, i) => ({ path: `jobs-${i + 1}.original.json`, sha256: hash(page.bytes) })) },
        capturedAt: new Date().toISOString(), publicationEligible: id.event === 'push' && id.headBranch === 'main'
          && id.source === id.headSha && id.headRepository === id.repository,
        knownFailuresRejected: true, lateFailureCheckRequired: true, productionMutation: false };
      writeFileSync(resolve(out, 'qualification.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
      console.log(`${tier}: ${assessment.required.length} exact-attempt checks passed; fresh failure scan required before publication`);
      return;
    }
    need(Date.now() < deadline && object(run.value).status !== 'completed', 'Required checks did not finish successfully');
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const id = identity();
  if (command === 'scope') {
    need(args.length === 1 && args[0], 'Scope output path required');
    const scope = inspectScope(id); mkdirSync(dirname(resolve(args[0])), { recursive: true });
    writeFileSync(args[0], `${JSON.stringify(scope, null, 2)}\n`, { flag: 'wx' });
    need(process.env.GITHUB_OUTPUT, 'Missing workflow output');
    appendFileSync(process.env.GITHUB_OUTPUT, `public-ready=${scope.publicReadyEligible}\n`);
    return;
  }
  need(command === 'qualify' || command === 'gate', 'Expected scope, qualify or gate');
  need(args.length === 3 && (args[0] === 'public-ready' || args[0] === 'release-ready' || args[0] === 'auto') && args[1] && args[2], 'Tier, scope and output required');
  const scope = validateScope(JSON.parse(readFileSync(args[1], 'utf8')), id);
  if (scope.policySha256 !== null) {
    const inspected = inspectScope(id);
    need(inspected.changedPathsSha256 === scope.changedPathsSha256 && inspected.policySha256 === scope.policySha256
      && inspected.publicReadyEligible === scope.publicReadyEligible, 'Scope differs from trusted Git source');
  } else {
    need(!scope.publicReadyEligible && scope.changes.length === 0, 'Bootstrap scope must require the full suite');
    let policyExists = false;
    try { git(['cat-file', '-e', `${id.base}:${POLICY}`]); policyExists = true; } catch { /* Missing base policy keeps bootstrap full-only. */ }
    need(!policyExists, 'Existing trusted policy cannot be omitted');
  }
  const tier = args[0] === 'auto' ? (scope.publicReadyEligible ? 'public-ready' : 'release-ready') : args[0];
  await qualify(id, scope, tier, args[2], command === 'gate');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(`CI qualification refused: ${error instanceof Error ? error.message : 'invalid input'}`); process.exitCode = 1; }
}
