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

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export type ReleaseFrontend = 'web' | 'tauri-desktop' | 'tauri-mobile';

const TAURI_DIR: Record<Exclude<ReleaseFrontend, 'web'>, string> = {
  'tauri-desktop': 'shells/tauri-desktop',
  'tauri-mobile': 'shells/tauri-mobile',
};

export function validateReleaseEnvironment(env: NodeJS.ProcessEnv): void {
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
  const result = spawnSync(command, args, { cwd: ROOT, env, stdio: 'inherit' });
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

export function main(): void {
  validateReleaseEnvironment(process.env);
  const target = parseReleaseFrontend(process.argv[2]);
  const env = {
    ...process.env,
    LOLLY_RELEASE_BUILD: '1',
    VITE_CATALOG_TRUST_MODE: 'verified',
  };
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if (target === 'web') {
    sign(env);
    run(npm, ['run', 'build:web'], env);
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
  run(npm, ['--prefix', shellDir, 'run', 'build:frontend'], env);
  sign(env, [
    '--tools', `${shellDir}/dist/tools`,
    '--index', `${shellDir}/dist/catalog/tools/index.json`,
    '--out', `${shellDir}/dist/catalog/tools/index.sig.json`,
  ]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
