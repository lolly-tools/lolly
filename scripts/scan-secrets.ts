#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GITLEAKS_VERSION = '8.29.1';

export type ScanMode = 'history' | 'staged' | 'checkout';

export interface ScanOptions {
  mode: ScanMode;
  confirmUntracked: boolean;
}

export function parseOptions(argv: string[]): ScanOptions {
  let mode: ScanMode = 'history';
  let modeSet = false;
  let confirmUntracked = false;

  for (const arg of argv) {
    if (arg === '--staged' || arg === '--checkout') {
      if (modeSet) throw new Error('choose only one of --staged or --checkout');
      mode = arg === '--staged' ? 'staged' : 'checkout';
      modeSet = true;
    } else if (arg === '--confirm-untracked') {
      confirmUntracked = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  if (confirmUntracked && mode !== 'checkout') {
    throw new Error('--confirm-untracked is only valid with --checkout');
  }
  if (mode === 'checkout' && !confirmUntracked) {
    throw new Error(
      'whole-checkout scanning reads ignored and untracked files; rerun with --confirm-untracked'
    );
  }
  return { mode, confirmUntracked };
}

export function gitleaksArgs(options: ScanOptions): string[] {
  const common = ['--redact', '--no-banner', '--config=.gitleaks.toml'];
  if (options.mode === 'staged') return ['git', ...common, '--staged', '.'];
  if (options.mode === 'checkout') {
    return ['dir', ...common, '--max-target-megabytes=10', '.'];
  }
  return ['git', ...common, '--log-opts=--all', '.'];
}

export function scannerCanary(executable: string): boolean {
  // Split the inert token so this source file does not itself become a finding.
  const token = ['AKIA', 'QWERTYUIOP12ASDF'].join('');
  const result = spawnSync(
    executable,
    [
      'stdin',
      '--redact',
      '--no-banner',
      '--config=.gitleaks.toml',
      '--report-format=json',
      '--report-path=-',
    ],
    { encoding: 'utf8', input: `key=${token}\n` }
  );
  // Gitleaks' documented finding exit code is 1. Also inspect the structured
  // result so a config/runtime error cannot masquerade as a successful canary,
  // and prove that the emitted value is redacted.
  if (result.status !== 1) return false;
  try {
    const findings = JSON.parse(result.stdout) as Array<{ RuleID?: string; Secret?: string }>;
    return (
      findings.length === 1 &&
      findings[0]?.RuleID === 'generic-api-key' &&
      findings[0]?.Secret === 'REDACTED'
    );
  } catch {
    return false;
  }
}

function fail(message: string): never {
  console.error(`secret scan: ${message}`);
  process.exit(1);
}

export function main(argv = process.argv.slice(2)): void {
  let options: ScanOptions;
  try {
    options = parseOptions(argv);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const executable = process.env.GITLEAKS_BIN?.trim() || 'gitleaks';
  const version = spawnSync(executable, ['version'], { encoding: 'utf8' });
  if (version.error) {
    fail(
      `gitleaks ${GITLEAKS_VERSION} is required (set GITLEAKS_BIN to the pinned binary): ${version.error.message}`
    );
  }
  if (version.status !== 0) fail(`could not read gitleaks version (exit ${version.status})`);

  const actual = `${version.stdout ?? ''} ${version.stderr ?? ''}`.match(
    /\b(\d+\.\d+\.\d+)\b/
  )?.[1];
  if (actual !== GITLEAKS_VERSION) {
    fail(`expected gitleaks ${GITLEAKS_VERSION}, found ${actual ?? 'an unknown version'}`);
  }
  if (!scannerCanary(executable)) {
    fail('the pinned scanner failed its detection canary; refusing a false-green scan');
  }

  if (options.mode === 'checkout') {
    console.error(
      'secret scan: explicitly scanning the whole checkout, including ignored and untracked files; findings are redacted'
    );
  }

  const result = spawnSync(executable, gitleaksArgs(options), { stdio: 'inherit' });
  if (result.error) fail(result.error.message);
  process.exit(result.status ?? 1);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) main();
