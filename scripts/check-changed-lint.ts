// SPDX-License-Identifier: MPL-2.0
/** No-new-diagnostic ratchet for Biome-governed first-party source. */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(REPO, 'security', 'lint-baseline.json');
const ROOTS = ['action', 'docs', 'engine', 'packages', 'scripts', 'services', 'shells', 'tests'];
const PRUNED = new Set(['.git', '.browsers', '.vercel', 'api', 'dist', 'locales', 'node_modules', 'public', 'target', 'vendor']);
const SOURCE = /\.(?:cjs|css|js|mjs|ts|tsx)$/;

interface Diagnostic { severity: string; category?: string; location?: { path?: string } }
interface LintBaseline {
  schemaVersion: 1;
  scope: string;
  diagnostics: Record<string, Record<string, number>>;
}

function slash(value: string): string { return value.replaceAll(path.sep, '/'); }

function walk(directory: string, output: string[]): void {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory).sort()) {
    if (PRUNED.has(entry) || entry.endsWith('.min.js')) continue;
    const absolute = path.join(directory, entry);
    const stats = lstatSync(absolute);
    if (stats.isSymbolicLink()) continue;
    if (stats.isDirectory()) walk(absolute, output);
    else if (SOURCE.test(entry) && !/\.d\.(?:ts|mts)$/.test(entry) && !entry.endsWith('.config.js')) {
      output.push(slash(path.relative(REPO, absolute)));
    }
  }
}

export function discoverLintSource(): string[] {
  const files: string[] = [];
  for (const root of ROOTS) walk(path.join(REPO, root), files);
  return files.sort();
}

function gitLines(cwd: string, args: string[]): string[] {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).filter(Boolean);
  } catch { return []; }
}

export function changedLintSource(): string[] {
  const known = new Set(discoverLintSource());
  const changed = new Set<string>();
  const base = process.env.LOLLY_LINT_BASE?.trim();
  const rootArgs = base ? ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`] : ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'];
  for (const file of [...gitLines(REPO, rootArgs), ...gitLines(REPO, ['ls-files', '--others', '--exclude-standard'])]) {
    const normalized = slash(file);
    if (known.has(normalized)) changed.add(normalized);
  }
  // Root Git only sees a changed gitlink. Inspect every mounted repository so
  // day-to-day submodule edits receive the same gate before their pointer moves.
  for (const line of readFileSync(path.join(REPO, '.gitmodules'), 'utf8').split(/\r?\n/)) {
    const match = /^\s*path\s*=\s*(.+)\s*$/.exec(line);
    if (!match) continue;
    const prefix = match[1]!.trim();
    const cwd = path.join(REPO, prefix);
    if (!existsSync(cwd)) continue;
    for (const file of [...gitLines(cwd, ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']), ...gitLines(cwd, ['ls-files', '--others', '--exclude-standard'])]) {
      const normalized = slash(path.join(prefix, file));
      if (known.has(normalized)) changed.add(normalized);
    }
  }
  return [...changed].sort();
}

function runBiome(files: string[]): Diagnostic[] {
  const executable = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'biome.cmd' : 'biome');
  const diagnostics: Diagnostic[] = [];
  for (let index = 0; index < files.length; index += 150) {
    const chunk = files.slice(index, index + 150);
    const result = spawnSync(executable, ['lint', '--reporter=json', '--max-diagnostics=none', ...chunk], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    let parsed: { diagnostics?: Diagnostic[] };
    try { parsed = JSON.parse(result.stdout); }
    catch { throw new Error(`Biome did not return JSON: ${result.stderr.trim()}`); }
    diagnostics.push(...(parsed.diagnostics ?? []));
  }
  return diagnostics;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): Record<string, Record<string, number>> {
  const summary: Record<string, Record<string, number>> = {};
  for (const diagnostic of diagnostics) {
    const file = slash(diagnostic.location?.path ?? '<unknown>');
    const category = `${diagnostic.severity}/${diagnostic.category ?? 'unknown'}`;
    summary[file] ??= {};
    summary[file][category] = (summary[file][category] ?? 0) + 1;
  }
  return summary;
}

export function regressions(
  baseline: Record<string, Record<string, number>>,
  current: Record<string, Record<string, number>>,
): string[] {
  const failures: string[] = [];
  for (const [file, categories] of Object.entries(current)) {
    for (const [category, count] of Object.entries(categories)) {
      const allowed = baseline[file]?.[category] ?? 0;
      if (count > allowed) failures.push(`${file}: ${category} ${allowed} -> ${count}`);
    }
  }
  return failures.sort();
}

export function main(argv = process.argv.slice(2)): number {
  const all = argv.includes('--all') || argv.includes('--write');
  const files = all ? discoverLintSource() : changedLintSource();
  if (!files.length) {
    console.log('changed-source lint: no Biome-governed source changed');
    return 0;
  }
  const current = summarizeDiagnostics(runBiome(files));
  if (argv.includes('--write')) {
    const baseline: LintBaseline = {
      schemaVersion: 1,
      scope: 'Biome-governed first-party TS/JS/CSS; generated, vendored, locale and tool-data trees excluded',
      diagnostics: current,
    };
    writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`lint baseline: ${files.length} files, ${Object.keys(current).length} with diagnostics`);
    return 0;
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as LintBaseline;
  if (baseline.schemaVersion !== 1) throw new Error('unsupported lint baseline schema');
  const failures = regressions(baseline.diagnostics, current);
  for (const failure of failures) console.error(failure);
  if (failures.length) {
    console.error(`changed-source lint: ${failures.length} no-new-diagnostic regression(s)`);
    return 1;
  }
  console.log(`changed-source lint: ${files.length} files checked; no new diagnostics`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
