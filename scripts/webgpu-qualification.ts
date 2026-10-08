#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * WebGPU qualification builds (plan 295, P0b).
 *
 * No release may ship the WebGPU startup requirement until its supported-environment
 * table is published (scripts/webgpu-release-gate.ts), and the table can only be
 * filled in by running packaged builds on the environments it lists: WebView2,
 * WebKitGTK, Android WebView and the rest. Every packaged build goes through
 * scripts/build-release-web.ts, which refuses while the table is missing, so without
 * a way past the gate neither could happen first.
 *
 * A qualification build is that way past the gate. It is never anything more:
 *
 * - It is asked for explicitly, with LOLLY_WEBGPU_QUALIFICATION_BUILD=1 (the
 *   packaging workflows set it from their `webgpu_qualification` input). Any other
 *   value is refused rather than guessed at.
 * - It is never a release. A run for a version tag is refused, the catalog is not
 *   signed (the signing key is withheld from every build step), and the frontend is
 *   built in the ordinary unsigned mode, not the release mode with verified trust.
 * - It is marked. The frontend carries MARKER_FILE at its root, the packaging
 *   workflows put the same file beside the packages they upload, and the tools that
 *   publish refuse anything that carries it: the release repackagers, the updater
 *   manifests and the YunoHost release.
 * - It says so. The build prints why the gate was skipped and what is missing from
 *   the table, and in GitHub Actions it also leaves a warning on the run.
 *
 *   node scripts/webgpu-qualification.ts mark <dir>     # write the marker into <dir>
 *   node scripts/webgpu-qualification.ts refuse <dir>   # exit 1 if <dir> holds a marked build
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The explicit switch. */
export const QUALIFICATION_ENV = 'LOLLY_WEBGPU_QUALIFICATION_BUILD';

/** The file that marks a qualification build, in its frontend and beside its packages. */
export const MARKER_FILE = 'WEBGPU-QUALIFICATION-BUILD-NOT-FOR-RELEASE.txt';

/** True when the build was asked to be a qualification build; throws on an unclear value. */
export function isQualificationBuild(env: NodeJS.ProcessEnv): boolean {
  const value = env[QUALIFICATION_ENV];
  if (value === undefined || value === '' || value === '0') return false;
  if (value === '1') return true;
  throw new Error(`${QUALIFICATION_ENV} must be 1 (a WebGPU qualification build) or unset, not "${value}".`);
}

/** A version tag is a release, and a release is never a qualification build. */
export function assertQualificationAllowed(env: NodeJS.ProcessEnv): void {
  const tag = env.GITHUB_REF_TYPE === 'tag' || (env.GITHUB_REF ?? '').startsWith('refs/tags/');
  if (tag) {
    throw new Error(`Refused: ${QUALIFICATION_ENV}=1 on a tag run (${env.GITHUB_REF ?? env.GITHUB_REF_NAME ?? 'tag'}). A tag is a release, and a release must pass the WebGPU release gate.`);
  }
}

/** Publishing tools call this first: a qualification build is never published. */
export function assertNotQualificationBuild(env: NodeJS.ProcessEnv, what: string): void {
  if (isQualificationBuild(env)) {
    throw new Error(`Refused: ${what} publishes a release, and ${QUALIFICATION_ENV}=1 marks this as a WebGPU qualification build, which is never published.`);
  }
}

/** The directories under `dir` (itself included) that hold the marker, at most `depth` levels down. */
export function markedBuilds(dir: string, depth = 3): string[] {
  const found: string[] = [];
  const walk = (current: string, level: number): void => {
    if (existsSync(join(current, MARKER_FILE))) found.push(current);
    if (level >= depth) return;
    for (const name of readdirSync(current)) {
      const child = join(current, name);
      if (statSync(child).isDirectory()) walk(child, level + 1);
    }
  };
  if (existsSync(dir) && statSync(dir).isDirectory()) walk(dir, 0);
  return found;
}

/** Refuse when `dir` holds a marked build, naming where. */
export function assertNoMarkedBuild(dir: string, what: string): void {
  const marked = markedBuilds(dir);
  if (marked.length) {
    throw new Error(`Refused: ${what} was given a WebGPU qualification build (${MARKER_FILE} in ${marked.join(', ')}). Qualification builds are unsigned and never published; use a release build.`);
  }
}

/** The marker's text: what the build is and why it must not be published. */
export function markerText(problems: readonly string[], env: NodeJS.ProcessEnv = process.env): string {
  return [
    'WebGPU qualification build. Not for release.',
    '',
    'This build skipped the WebGPU release gate (plan 295, P0b) so the WebGPU startup',
    'requirement can be qualified on the environments in docs/supported-environments.md.',
    'Its catalog is not signed and the release tools refuse it.',
    '',
    ...(env.GITHUB_SHA ? [`Commit: ${env.GITHUB_SHA}`] : []),
    ...(env.GITHUB_RUN_ID ? [`Run: ${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY ?? ''}/actions/runs/${env.GITHUB_RUN_ID}`] : []),
    ...(problems.length ? ['', 'Release gate problems at build time:', ...problems.map(problem => `  - ${problem}`)] : []),
    '',
  ].join('\n');
}

/** Write the marker into `dir` (created if needed); returns its path. */
export function writeMarker(dir: string, problems: readonly string[] = [], env: NodeJS.ProcessEnv = process.env): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, MARKER_FILE);
  writeFileSync(path, markerText(problems, env));
  return path;
}

/** The log lines a qualification build prints, plus a GitHub warning annotation in Actions. */
export function announceQualificationBuild(problems: readonly string[], env: NodeJS.ProcessEnv = process.env): string[] {
  const lines = [
    `WebGPU qualification build (${QUALIFICATION_ENV}=1): the WebGPU release gate is skipped for this build only.`,
    'The catalog is not signed, the frontend is built unsigned, and the result is marked not for release.',
    ...(problems.length ? ['Release gate problems this build skipped:', ...problems.map(problem => `  - ${problem}`)] : ['The release gate currently passes; this build is still unsigned and not for release.']),
  ];
  for (const line of lines) console.error(line);
  if (env.GITHUB_ACTIONS === 'true') {
    console.log(`::warning title=WebGPU qualification build::Unsigned and not for release. The WebGPU release gate was skipped (${problems.length} problem${problems.length === 1 ? '' : 's'}).`);
  }
  return lines;
}

function cli(argv: string[]): number {
  const [command, dir] = argv;
  if ((command !== 'mark' && command !== 'refuse') || !dir) {
    console.error('usage: node scripts/webgpu-qualification.ts mark <dir> | refuse <dir>');
    return 2;
  }
  try {
    if (command === 'mark') {
      const path = writeMarker(resolve(dir));
      console.log(`Marked as a WebGPU qualification build, not for release: ${path}`);
      if (process.env.GITHUB_ACTIONS === 'true') console.log(`::warning title=WebGPU qualification build::${path} marks these packages as not for release.`);
    } else {
      assertNoMarkedBuild(resolve(dir), 'this release step');
      console.log(`No WebGPU qualification build in ${dir}.`);
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = cli(process.argv.slice(2));
