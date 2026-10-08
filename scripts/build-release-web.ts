#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build a deployable web or Tauri frontend. Unlike the ordinary frontend
 * commands (unsigned local/development artifacts), this path requires catalog
 * signing material and bakes an explicit verified-only trust mode into the
 * client.
 *
 * Tauri has to be signed AFTER its target-specific Vite build: neutral mode
 * composes a different tool tree from the active profile, and each Tauri shell
 * substitutes native bridge modules. Signing the resulting dist/ binds exactly
 * the bytes the native package embeds without pretending shells/web/dist is
 * interchangeable with it.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWebGpuReleaseAllowed, webGpuReleaseProblems } from './webgpu-release-gate.ts';
import { announceQualificationBuild, assertQualificationAllowed, isQualificationBuild, writeMarker } from './webgpu-qualification.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export type ReleaseFrontend = 'web' | 'tauri-desktop' | 'tauri-mobile';

const TAURI_DIR: Record<Exclude<ReleaseFrontend, 'web'>, string> = {
  'tauri-desktop': 'shells/tauri-desktop',
  'tauri-mobile': 'shells/tauri-mobile',
};

export function validateReleaseEnvironment(env: NodeJS.ProcessEnv): void {
  if (env.VITE_REQUIRE_AI_POLICY !== undefined && !['true', 'false'].includes(env.VITE_REQUIRE_AI_POLICY)) {
    throw new Error('VITE_REQUIRE_AI_POLICY must be true or false');
  }
  if (!env.LOLLY_CATALOG_SIGNING_KEY?.trim()) {
    throw new Error('LOLLY_CATALOG_SIGNING_KEY is required for a release web build');
  }
  const publicMaterial = env.VITE_CATALOG_PUBLIC_KEY_JWK?.trim();
  if (!publicMaterial) {
    throw new Error('VITE_CATALOG_PUBLIC_KEY_JWK is required for a release web build');
  }

  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(publicMaterial) as JsonWebKey;
  } catch {
    throw new Error('VITE_CATALOG_PUBLIC_KEY_JWK must be valid JWK JSON');
  }
  if (
    jwk.kty !== 'EC' || jwk.crv !== 'P-256' ||
    typeof jwk.x !== 'string' || !jwk.x || typeof jwk.y !== 'string' || !jwk.y
  ) {
    throw new Error('VITE_CATALOG_PUBLIC_KEY_JWK must be an EC P-256 public key');
  }
  if (typeof jwk.d === 'string' && jwk.d) {
    throw new Error('VITE_CATALOG_PUBLIC_KEY_JWK must not contain private key material');
  }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  // Windows cannot execute a .cmd shim through spawn without a shell. The
  // invoking package manager supplies its JavaScript entry point instead.
  const packageEntry = process.platform === 'win32' && command === 'pnpm.cmd'
    ? env.npm_execpath : undefined;
  if (process.platform === 'win32' && command === 'pnpm.cmd' && !packageEntry) {
    throw new Error('Run the release wrapper through pnpm on Windows.');
  }
  const result = packageEntry
    ? spawnSync(process.execPath, [packageEntry, ...args], { cwd: ROOT, env, stdio: 'inherit' })
    : spawnSync(command, args, { cwd: ROOT, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function parseReleaseFrontend(value: string | undefined): ReleaseFrontend {
  const target = value ?? 'web';
  if (target === 'web' || target === 'tauri-desktop' || target === 'tauri-mobile') return target;
  throw new Error(`unknown release frontend "${target}" (expected web, tauri-desktop, or tauri-mobile)`);
}

function sign(env: NodeJS.ProcessEnv, extraArgs: string[] = []): void {
  run(process.execPath, ['scripts/sign-catalog.ts', ...extraArgs], env);
}

/**
 * A WebGPU qualification build (scripts/webgpu-qualification.ts): the same frontend
 * build without the release gate, without signing and without the release trust mode,
 * marked not for release. It exists so plan 295 P0b can qualify the packaged webviews
 * the release gate is waiting on; it never replaces a release build.
 */
export function qualificationMain(target: ReleaseFrontend, env: NodeJS.ProcessEnv = process.env): void {
  assertQualificationAllowed(env);
  // The web frontend is what the public image and every web deployment build from,
  // so it never takes this path. The browsers P0b qualifies need no exception: the
  // ordinary `pnpm run build:web` and the dev shell are not gated.
  if (target === 'web') {
    throw new Error('Refused: a WebGPU qualification build is for the packaged apps (tauri-desktop, tauri-mobile). For browsers, qualify `pnpm run build:web` or the dev shell, which the release gate does not cover.');
  }
  const problems = webGpuReleaseProblems();
  announceQualificationBuild(problems, env);
  // Nothing downstream signs: the signing key never reaches a child process. The public
  // pin goes too, because a frontend that carries a pin trusts only signed catalogs
  // (catalog/integrity.ts), and this one is built in the unsigned development mode.
  const build: NodeJS.ProcessEnv = { ...env };
  for (const name of ['LOLLY_CATALOG_SIGNING_KEY', 'VITE_CATALOG_PUBLIC_KEY_JWK', 'LOLLY_RELEASE_BUILD', 'VITE_CATALOG_TRUST_MODE']) delete build[name];
  const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const shellDir = TAURI_DIR[target];
  run(packageManager, ['-C', shellDir, 'run', 'build:frontend'], build);
  writeMarker(resolve(ROOT, shellDir, 'dist'), problems, env);
}

export function main(): void {
  const target = parseReleaseFrontend(process.argv[2]);
  if (isQualificationBuild(process.env)) { qualificationMain(target); return; }
  assertWebGpuReleaseAllowed();
  validateReleaseEnvironment(process.env);
  const env = {
    ...process.env,
    LOLLY_RELEASE_BUILD: '1',
    VITE_CATALOG_TRUST_MODE: 'verified',
  };
  const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  if (target === 'web') {
    sign(env);
    run(packageManager, ['run', 'build:web'], env);
    run(process.execPath, ['scripts/verify-release-catalog.ts', '--root', 'shells/web/dist'], env);
    return;
  }

  const shellDir = TAURI_DIR[target];
  // Both Tauri configs import helpers from the web Vite config. Its release
  // guard is evaluated while loading that module, before the target-specific
  // dist directory exists, and deliberately requires the source catalogue to
  // have a valid envelope. Sign that source first; the output catalogue is
  // still signed again below so the native package is bound to the exact bytes
  // it embeds (including neutral/profile composition).
  sign(env);
  run(packageManager, ['-C', shellDir, 'run', 'build:frontend'], env);
  sign(env, [
    '--tools', `${shellDir}/dist/tools`,
    '--index', `${shellDir}/dist/catalog/tools/index.json`,
    '--out', `${shellDir}/dist/catalog/tools/index.sig.json`,
  ]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
