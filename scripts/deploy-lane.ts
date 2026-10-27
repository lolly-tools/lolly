// SPDX-License-Identifier: MPL-2.0
/**
 * Fast deploy lanes for the lolly.tools preview (Andy, 2026-10-27: "lets have both webui and docs only
 * lanes so minor css fixes arent held up either").
 *
 * A main commit normally ships to the preview only after its own full ci.yml push run has passed, which
 * takes about 40 minutes. A lane lets a narrow change ship sooner. The base is the newest first-parent
 * ancestor of the source whose full ci.yml push run on main passed. Every path that differs between the
 * base and the source decides the lane, and the lane's job in fast-lanes.yml must have passed on the
 * source itself:
 *
 *   docs  every change is under docs/ (pages, translations, shots, figures, the registry and the /info
 *         builder that the docs lane job runs), or is one of the two /info pages kept outside docs/
 *         (DOCS_PAGES_ELSEWHERE). The policy files a release or security gate reads need full CI, and
 *         the card renderer that build:web also runs needs the web lane. Needs the "docs lane" job.
 *   web   every change is under docs/ or shells/web/, outside the exclusions in WEB_EXCLUDED and
 *         PROTECTED_NAME. Needs the "web lane" job, which needs the docs lane job as well.
 *   full  anything else. Needs the source's own full ci.yml run, as before.
 *
 * Test files never reach the built site, so a changed test takes the lane of the other changes beside
 * it; the full run still tests it after the merge.
 *
 * A lane never overrides a full CI run that has already failed on the source. Releases never use a lane:
 * deployment-suse.yml and the release workflows keep their exact-commit guard.
 *
 * Whoever enforces a lane computes the lane from Git; a label or a commit message never decides the lane.
 * preview-web.yml runs the copy of this file from the base commit, the way ci.yml runs its trusted base
 * policy, so a change to these rules applies only once a commit carrying it has passed full CI. The
 * preview deploy tool in lolly-work carries a Python port, tested against the same cases
 * (tests/fixtures/deploy-lane/cases.json), and a deploy needs both to agree.
 *
 * The workflow copies this file out of the base commit into a temporary directory and runs it there, so
 * it imports Node built-ins only.
 *
 *   node scripts/deploy-lane.ts classify <base> <source>          # print the lane and its reasons
 *   node scripts/deploy-lane.ts qualify <base> <source> <out.json> # the preview-web.yml guard
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Recorded with every decision. The Python port in lolly-work carries the same value. */
export const LANE_POLICY = 'deploy-lane-v1';
export type DeployLane = 'docs' | 'web' | 'full';
export type FastLane = Exclude<DeployLane, 'full'>;
export interface Change { path: string; beforeMode: string; afterMode: string }
export interface LaneDecision { lane: DeployLane; reasons: string[] }

export const CI_WORKFLOW = '.github/workflows/ci.yml';
export const FAST_WORKFLOW = '.github/workflows/fast-lanes.yml';
/** The fast-lanes.yml job each lane needs, by its job name. */
export const LANE_JOB: Readonly<Record<FastLane, string>> = Object.freeze({ docs: 'docs lane', web: 'web lane' });
/** How many first-parent commits back the base may be. Past this the source needs its own full CI. */
export const MAX_BASE_DISTANCE = 50;

const SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** The same list as scripts/ci-qualification.ts (tests/deploy-lane.test.ts keeps them equal). */
export const DEPENDENCY_FILE = /(?:^|\/)(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|\.npmrc|\.pnpmfile\.c?js|Cargo\.toml|Cargo\.lock|rust-toolchain(?:\.toml)?|\.cargo\/config(?:\.toml)?)$/;

/**
 * docs/ files that a release or security gate reads as policy rather than as a page:
 * scripts/webgpu-release-gate.ts and release-checklist.ts read the supported-environment table (the web
 * image build copies it in), and check-parser-assurance.ts reads the parser inventory and its waivers.
 */
export const DOCS_POLICY_FILES: readonly string[] = Object.freeze(['docs/supported-environments.md', 'docs/parser-inventory.md']);

/**
 * docs/ code that build:web runs beyond the /info build: the tool, view and landing card renderers
 * (scripts/build-tool-og.ts, build-view-og.ts, build-og-base.ts) import these. A change here needs the
 * web lane, whose build runs them; the test keeps the list equal to their docs/ imports.
 */
export const DOCS_CARD_CODE: readonly string[] = Object.freeze(['docs/og-image.ts', 'docs/og-opal.ts']);
/** Pages docs/build.ts renders from outside docs/ (its `src: '../...'` entries; the test keeps them equal). */
export const DOCS_PAGES_ELSEWHERE: readonly string[] = Object.freeze(['README.md', 'engine/text-composition.md']);
/** Test files: they never ship, so they never decide a lane. */
const TEST_FILE = /\.test\.(?:ts|js|mjs)$/;

/**
 * Parts of shells/web/ that always need the full suite, whatever the change, and why.
 * Each one is shared with another shell, holds a format or trust decision a rollback cannot undo, or is
 * code the fast checks do not exercise.
 */
export const WEB_EXCLUDED: readonly { prefix: string; reason: string }[] = Object.freeze([
  { prefix: 'shells/web/src/main.ts', reason: 'boot path and service worker registration; the web image build reads it for the WebGPU gate' },
  { prefix: 'shells/web/src/bridge/', reason: 'host bridge: the stored formats the deploy tool checks before a rollback (db.ts, revision-archive-format.ts), the export path the CLI, TUI and MCP drive through the built shell, and the base of both Tauri shells' },
  { prefix: 'shells/web/src/capture/', reason: 'page walk that the CLI and the browser extension bundle' },
  { prefix: 'shells/web/src/catalog/', reason: 'catalog sync, integrity checks and trust store' },
  { prefix: 'shells/web/src/collab/', reason: 'collaboration protocol and its stored channel message format' },
  { prefix: 'shells/web/src/org/', reason: 'organisation accounts, approvals and AI policy' },
  { prefix: 'shells/web/src/ext/', reason: 'control-plane extension entry point' },
  { prefix: 'shells/web/src/vendor/', reason: 'vendored third-party code; licences, SBOM and audit run in full CI' },
  { prefix: 'shells/web/src/ca-root.ts', reason: 'certificate trust anchor' },
  { prefix: 'shells/web/src/lib/sync-', reason: 'personal sync: encryption keys, merge rules and remote stores for data on other devices' },
]);

/**
 * A shells/web/ path with one of these words as a whole name part needs the full suite. The first group is
 * the public-ready UI tier's own list (scripts/ci-qualification.ts classifyChanges); the second adds
 * signing, provenance, stored-data migration, network egress and the service worker.
 */
export const PROTECTED_NAME = /(?:^|[/_.-])(?:auth|account|session|login|signin|signup|password|credential|permission|policy|trust|security|org|admin|invite|collab|gateway|remote|iframe|embed|release|webgpu|profile|identity|connections|instance|csp|integrity|oauth|seal|secret|crypto|sign|signing|signature|c2pa|provenance|redact|sanitize|sanitizer|egress|migration|migrations|sw)(?:[/_.-]|$)/i;

/** shells/web/ areas the web lane accepts, before the exclusions above. */
const WEB_AREAS = /^shells\/web\/(?:src\/|design\/|README\.md$|PERFORMANCE\.md$)/;
/** Static media in shells/web/public/. Its pages, scripts, manifests, sw.js and .well-known/ need full CI. */
const WEB_PUBLIC_MEDIA = /^shells\/web\/public\/(?!\.well-known\/)(?:[^/]+\/)*[^/]+\.(?:png|jpe?g|webp|avif|gif|ico|svg|mp3|mp4|opus|webm|vtt|woff2?)$/;

/** A path no lane accepts: empty, ambiguous, outside the tree, or not a plain regular file. */
function irregular(change: Change): boolean {
  return !change.path || change.path.includes('\\')
    || [...change.path].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || change.path.split('/').some(part => !part || part === '.' || part === '..')
    || ![change.beforeMode, change.afterMode].every(mode => mode === '000000' || mode === '100644')
    || (change.beforeMode === '000000' && change.afterMode === '000000');
}

/** Why one change needs the full suite, or null when a fast lane may take the change. */
export function fullReason(change: Change): string | null {
  const path = change.path;
  if (irregular(change)) return 'not a plain regular file';
  if (DEPENDENCY_FILE.test(path)) return 'dependency manifest or lockfile';
  if (path.startsWith('tests/') || TEST_FILE.test(path)) return null;
  if (path.startsWith('docs/')) return DOCS_POLICY_FILES.includes(path) ? 'read by a release or security gate' : null;
  if (DOCS_PAGES_ELSEWHERE.includes(path)) return null;
  if (!path.startsWith('shells/web/')) return 'outside docs/ and shells/web/';
  const excluded = WEB_EXCLUDED.find(entry => path.startsWith(entry.prefix));
  if (excluded) return excluded.reason;
  if (WEB_PUBLIC_MEDIA.test(path)) return null;
  if (!WEB_AREAS.test(path)) return 'shells/web build input, entry page or served file';
  const name = PROTECTED_NAME.exec(path.slice('shells/web/'.length));
  return name ? `security-sensitive name "${name[0].replace(/^[/_.-]|[/_.-]$/g, '')}"` : null;
}

/** A path the docs lane takes: a test, a docs/ file other than the card renderer, or a page kept outside docs/. */
function docsLane(path: string): boolean {
  return path.startsWith('tests/') || TEST_FILE.test(path) || DOCS_PAGES_ELSEWHERE.includes(path)
    || (path.startsWith('docs/') && !DOCS_CARD_CODE.includes(path));
}

/** The lane for every path that differs between the base and the source. */
export function laneOf(changes: readonly Change[]): LaneDecision {
  if (!changes.length) return { lane: 'full', reasons: ['Nothing differs from the base; the source needs its own full CI run'] };
  const reasons: string[] = [];
  let web = false;
  for (const change of changes) {
    const reason = fullReason(change);
    if (reason) reasons.push(`Full CI required: ${change.path} (${reason})`);
    else if (!docsLane(change.path)) web = true;
  }
  return reasons.length ? { lane: 'full', reasons } : { lane: web ? 'web' : 'docs', reasons: [] };
}

function need(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const hash = (text: string): string => createHash('sha256').update(text).digest('hex');

function git(args: string[], root = process.cwd()): string {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }, encoding: 'utf8',
      timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
}

/** `git diff --raw` between two commits, with no rename detection: a rename is a deletion and an addition. */
export function changesBetween(base: string, source: string, root = process.cwd()): Change[] {
  need(SHA.test(base) && SHA.test(source), 'Exact base and source commits required');
  const records = git(['diff', '--raw', '-z', '--no-abbrev', '--no-renames', '--no-ext-diff', '--no-textconv', base, source, '--'], root).split('\0');
  need(records.pop() === '' && records.length % 2 === 0 && records.length <= 8192, 'Incomplete or oversized change inventory');
  const changes: Change[] = [];
  for (let i = 0; i < records.length; i += 2) {
    const match = /^:(\d{6}) (\d{6}) [a-f0-9]{40} [a-f0-9]{40} [ADMT]$/.exec(records[i] ?? '');
    need(match && records[i + 1], 'Ambiguous changed path');
    changes.push({ path: records[i + 1]!, beforeMode: match[1]!, afterMode: match[2]! });
  }
  need(new Set(changes.map(change => change.path)).size === changes.length, 'Duplicate changed path');
  return changes;
}

/** How many first-parent steps back from the source the base is, or null when it is not on that line. */
export function firstParentDistance(base: string, source: string, root = process.cwd()): number | null {
  const line = git(['rev-list', '--first-parent', `--max-count=${MAX_BASE_DISTANCE + 1}`, source], root).trim().split('\n');
  const index = line.indexOf(base);
  return index < 0 ? null : index;
}

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected JSON object');
  return value as ObjectValue;
}
/** One GitHub REST read: a path such as /repos/o/r/actions/runs/1, answered as parsed JSON. */
export type Provider = (path: string) => Promise<unknown>;

/** Reads the GitHub REST API with GH_TOKEN, bounded like scripts/ci-qualification.ts. */
export const github: Provider = async path => {
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
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
};

/** A workflow run of this repository's own main branch, pushed, for exactly this commit. */
function ownMainPush(run: ObjectValue, workflow: string, repository: string, sha: string): boolean {
  return Number.isSafeInteger(run.id) && Number(run.id) > 0 && run.path === workflow && run.event === 'push'
    && run.head_branch === 'main' && run.head_sha === sha
    && object(run.repository ?? {}).full_name === repository && object(run.head_repository ?? {}).full_name === repository;
}

async function mainPushRuns(provider: Provider, repository: string, workflow: string, sha: string): Promise<ObjectValue[]> {
  const file = workflow.slice(workflow.lastIndexOf('/') + 1);
  const listing = object(await provider(`/repos/${repository}/actions/workflows/${file}/runs?head_sha=${sha}&event=push&branch=main&per_page=20`));
  need(Array.isArray(listing.workflow_runs), 'Invalid workflow run listing');
  return listing.workflow_runs.map(object).filter(run => ownMainPush(run, workflow, repository, sha))
    .sort((a, b) => Number(b.id) - Number(a.id));
}

/** Refuses when a completed full CI push run of the source ended in anything but success or cancellation. */
export async function requireNoFullFailure(provider: Provider, repository: string, source: string): Promise<ObjectValue[]> {
  const runs = await mainPushRuns(provider, repository, CI_WORKFLOW, source);
  const failed = runs.find(run => run.status === 'completed' && run.conclusion !== 'success' && run.conclusion !== 'cancelled');
  need(!failed, `Full CI run ${String(failed?.id)} on the source concluded ${String(failed?.conclusion)}; a lane never overrides that`);
  return runs;
}

export interface FastJob { run: number; attempt: number; job: number; name: string }

/** The newest fast-lanes.yml push run of the source whose lane job passed. */
export async function passedLaneJob(provider: Provider, repository: string, source: string, lane: FastLane): Promise<FastJob> {
  const name = LANE_JOB[lane];
  for (const run of await mainPushRuns(provider, repository, FAST_WORKFLOW, source)) {
    const listing = object(await provider(`/repos/${repository}/actions/runs/${String(run.id)}/jobs?filter=latest&per_page=100`));
    need(Array.isArray(listing.jobs), 'Invalid job listing');
    const jobs = listing.jobs.map(object).filter(job => job.name === name);
    need(jobs.length <= 1, `More than one "${name}" job in run ${String(run.id)}`);
    const job = jobs[0];
    if (job && Number.isSafeInteger(job.id) && job.run_id === run.id && job.head_sha === source
      && job.status === 'completed' && job.conclusion === 'success' && Number.isSafeInteger(job.run_attempt)) {
      return { run: Number(run.id), attempt: Number(job.run_attempt), job: Number(job.id), name };
    }
  }
  throw new Error(`The "${name}" job of ${FAST_WORKFLOW} has not passed on ${source} yet`);
}

export interface LaneRecord {
  version: 1; policy: string; repository: string; source: string; base: string; distance: number; lane: FastLane;
  changes: number; changedPathsSha256: string; fastJob: FastJob; sourceFullCi: { id: number; status: unknown; conclusion: unknown }[];
}

/**
 * The guard preview-web.yml runs when the source has no successful full CI run of its own. The base comes
 * from the workflow (the newest first-parent ancestor with one); this checks it, classifies the change
 * and requires the lane job. Any refusal throws.
 */
export async function qualify(base: string, source: string, repository: string, provider: Provider = github, root = process.cwd()): Promise<LaneRecord> {
  need(SHA.test(base) && SHA.test(source) && base !== source, 'A lane needs a base that differs from the source');
  need(REPOSITORY.test(repository), 'Exact repository required');
  const distance = firstParentDistance(base, source, root);
  need(distance !== null && distance >= 1 && distance <= MAX_BASE_DISTANCE,
    `The base is not within ${MAX_BASE_DISTANCE} first-parent commits of the source`);
  const sourceRuns = await requireNoFullFailure(provider, repository, source);
  const changes = changesBetween(base, source, root);
  const decision = laneOf(changes);
  need(decision.lane !== 'full', ['The source needs its own full CI run:', ...decision.reasons.slice(0, 20),
    ...(decision.reasons.length > 20 ? [`and ${decision.reasons.length - 20} more`] : [])].join('\n  '));
  const lane = decision.lane as FastLane;
  const fastJob = await passedLaneJob(provider, repository, source, lane);
  return { version: 1, policy: LANE_POLICY, repository, source, base, distance, lane, changes: changes.length,
    changedPathsSha256: hash(JSON.stringify(changes)), fastJob,
    sourceFullCi: sourceRuns.map(run => ({ id: Number(run.id), status: run.status, conclusion: run.conclusion })) };
}

async function main(argv: string[]): Promise<void> {
  const [command, base = '', source = '', out] = argv;
  if (command === 'classify') {
    const decision = laneOf(changesBetween(git(['rev-parse', '--verify', `${base}^{commit}`]).trim(), git(['rev-parse', '--verify', `${source}^{commit}`]).trim()));
    console.log(`lane: ${decision.lane}`);
    for (const reason of decision.reasons) console.log(`  ${reason}`);
    return;
  }
  need(command === 'qualify' && out, 'Usage: deploy-lane.ts classify <base> <source> | qualify <base> <source> <out.json>');
  const record = await qualify(base, source, process.env.GITHUB_REPOSITORY ?? '');
  writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  console.log(`${record.lane} lane: ${record.changes} changed paths since ${base.slice(0, 12)}, "${record.fastJob.name}" passed in run ${record.fastJob.run}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); } catch (error) {
    console.error(`Deploy lane refused: ${error instanceof Error ? error.message : 'invalid input'}`);
    process.exitCode = 1;
  }
}
