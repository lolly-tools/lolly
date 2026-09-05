// SPDX-License-Identifier: MPL-2.0
/** Load the device-private CA environment, then run one reviewed local task. */

import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TASKS = {
  server: ['services/ca/server.mjs'],
  'sign-catalog': ['scripts/sign-credentialed-assets.ts', '--ca', '--catalog'],
  'sign-logos': ['scripts/sign-inline-logos.ts'],
} as const;

export type PrivateCaTask = keyof typeof TASKS;

export function privateCredentialDirectory(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.LOLLY_PRIVATE_DIR?.trim();
  return path.resolve(configured || path.join(REPO, '..', 'lolly-private', 'lolly'));
}

function requirePrivateMode(target: string, kind: 'directory' | 'file'): void {
  const stat = lstatSync(target);
  if (stat.isSymbolicLink() || (kind === 'directory' ? !stat.isDirectory() : !stat.isFile())) {
    throw new Error(`private credential ${kind} is not a regular ${kind}`);
  }
  if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
    throw new Error(`private credential ${kind} is not owned by the current user`);
  }
  if ((stat.mode & 0o077) !== 0) {
    throw new Error(`private credential ${kind} permits group or other access`);
  }
}

export function privateCaEnvPath(env: NodeJS.ProcessEnv = process.env): string {
  const directory = privateCredentialDirectory(env);
  requirePrivateMode(directory, 'directory');
  const envPath = path.join(directory, 'ca.env');
  requirePrivateMode(envPath, 'file');
  return envPath;
}

export function main(argv = process.argv.slice(2)): number {
  const [taskName, ...extraArgs] = argv;
  if (!taskName || !(taskName in TASKS)) {
    console.error(`usage: run-private-ca.ts ${Object.keys(TASKS).join('|')}`);
    return 2;
  }

  try {
    loadEnvFile(privateCaEnvPath());
  } catch (error) {
    console.error(
      `private CA environment refused: ${error instanceof Error ? error.message : String(error)}`
    );
    return 1;
  }

  const task = TASKS[taskName as PrivateCaTask];
  const result = spawnSync(process.execPath, [...task, ...extraArgs], {
    cwd: REPO,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`private CA task failed to start: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = main();
