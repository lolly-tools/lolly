// SPDX-License-Identifier: MPL-2.0

/**
 * A no-growth ratchet for the browser shell's concentrated implementation files.
 * This deliberately measures web-only code in place: DOM/editor/export concerns do
 * not become shared or CLI code merely to improve this report.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const baselinePath = path.join(repoRoot, 'security', 'maintainability-baseline.json');
const WEB_ROOT = path.join(repoRoot, 'shells', 'web', 'src');
const SOFT_MODULE_LINES = 1_500;
const HARD_MODULE_LINES = 2_500;
const HOTSPOT_LINES = 2_000;

export interface ModuleMetric {
  lines: number;
  largestFunctionLines: number;
  importFanIn: number;
  importFanOut: number;
  typeEscapes: number;
}

export interface MaintainabilityBaseline {
  version: 1;
  scope: 'shells/web/src';
  exclusions: Array<{ pattern: string; reason: string }>;
  modules: Record<string, ModuleMetric>;
  cycles: string[][];
  /** Runtime imports that run against the layering (a lib/, bridge/, components/, collab/, org/,
   *  pro/ or catalog/ module importing from views/). Views may import anything below them; the
   *  layers below must not reach up. Existing edges are baselined; a new one fails. */
  layerViolations?: string[];
  /** Type escapes (the `any` type, `as unknown as`, ts-ignore, biome-ignore; counted in code, not
   *  in comments or strings) per production module, every
   *  module, not only the concentrated ones. A module may only ratchet down; a new module starts
   *  clean or is added deliberately with --write. */
  typeEscapes?: Record<string, number>;
}
/** Directories that sit below views/ and must never import from it. */
const LOWER_LAYERS = ['lib/', 'bridge/', 'components/', 'collab/', 'org/', 'pro/', 'catalog/'];

export const EXCLUSIONS = [
  { pattern: '**/*.test.{ts,js}', reason: 'test implementation' },
  { pattern: '**/*.d.{ts,mts}', reason: 'declaration artifact' },
  { pattern: 'locales/**', reason: 'declarative translation data' },
  { pattern: 'vendor/**', reason: 'vendored/generated third-party code' },
] as const;

function walk(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) found.push(...walk(absolute));
    else found.push(absolute);
  }
  return found;
}

function isProductionModule(filename: string): boolean {
  if (!/\.(?:ts|js)$/.test(filename) || /\.d\.(?:ts|mts)$/.test(filename)) return false;
  const relative = path.relative(WEB_ROOT, filename).replaceAll(path.sep, '/');
  return !relative.includes('.test.') && !relative.startsWith('locales/') && !relative.startsWith('vendor/');
}

function logicalLines(source: string): number {
  let inBlock = false;
  let count = 0;
  for (const raw of source.split(/\r?\n/)) {
    let line = raw.trim();
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end < 0) continue;
      inBlock = false;
      line = line.slice(end + 2).trim();
    }
    while (line.startsWith('/*')) {
      const end = line.indexOf('*/', 2);
      if (end < 0) {
        inBlock = true;
        line = '';
        break;
      }
      line = line.slice(end + 2).trim();
    }
    if (line && !line.startsWith('//') && !line.startsWith('*')) count += 1;
  }
  return count;
}

function largestFunctionLines(filename: string, source: string): number {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  let largest = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && 'body' in node && node.body) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
      const end = sourceFile.getLineAndCharacterOfPosition(node.end).line;
      largest = Math.max(largest, end - start + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return largest;
}

function typeEscapeCount(filename: string, source: string): number {
  // Counted from the syntax tree, not the raw text: the word "any" inside a comment or a
  // string is prose, and a metric that counted it made six honest new modules "carry a
  // type escape" in 2026-09. `any` counts where it is the type; `as unknown as` where it
  // is an expression; the suppression directives count wherever they appear, since a
  // comment is where they live.
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) count += 1;
    else if (
      ts.isAsExpression(node) &&
      ts.isAsExpression(node.expression) &&
      node.expression.type.kind === ts.SyntaxKind.UnknownKeyword
    ) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const directives = [
    /@ts-(?:ignore|nocheck|expect-error)\b/g,
    /eslint-disable(?:-next-line)?\b/g,
    /biome-ignore\b/g,
  ];
  return directives.reduce((total, pattern) => total + [...source.matchAll(pattern)].length, count);
}

function importSpecifiers(source: string): string[] {
  // Type-only imports (`import type ... from`, `export type ... from`) erase at compile time,
  // so they are not runtime dependency edges and cannot form a load-order cycle.
  const runtimeSource = source.replace(/\b(?:import|export)\s+type\s+[^;]*?\bfrom\s*['"][^'"]+['"]/g, '');
  const matches = runtimeSource.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g);
  return [...matches].flatMap((match) => {
    const value = match[1];
    return value?.startsWith('.') ? [value] : [];
  });
}

function resolveImport(from: string, specifier: string, known: Set<string>): string | null {
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js')]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

function stronglyConnected(graph: Map<string, Set<string>>): string[][] {
  let index = 0;
  const indexes = new Map<string, number>();
  const lows = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  const visit = (node: string): void => {
    indexes.set(node, index);
    lows.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!indexes.has(next)) {
        visit(next);
        lows.set(node, Math.min(lows.get(node)!, lows.get(next)!));
      } else if (onStack.has(next)) {
        lows.set(node, Math.min(lows.get(node)!, indexes.get(next)!));
      }
    }
    if (lows.get(node) !== indexes.get(node)) return;
    const component: string[] = [];
    let current: string;
    do {
      current = stack.pop()!;
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    if (component.length > 1 || graph.get(node)?.has(node)) cycles.push(component.sort());
  };

  for (const node of [...graph.keys()].sort()) if (!indexes.has(node)) visit(node);
  return cycles.sort((a, b) => a.join('\0').localeCompare(b.join('\0')));
}

export function measure(): MaintainabilityBaseline {
  const files = walk(WEB_ROOT).filter(isProductionModule).sort();
  const known = new Set(files);
  const sources = new Map(files.map((filename) => [filename, readFileSync(filename, 'utf8')]));
  const graph = new Map<string, Set<string>>();
  const fanIn = new Map(files.map((filename) => [filename, 0]));
  for (const filename of files) {
    const edges = new Set<string>();
    for (const specifier of importSpecifiers(sources.get(filename)!)) {
      const target = resolveImport(filename, specifier, known);
      if (target) edges.add(target);
    }
    graph.set(filename, edges);
    for (const target of edges) fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
  }

  const layerViolations: string[] = [];
  const typeEscapes: Record<string, number> = {};
  for (const filename of files) {
    const relative = path.relative(WEB_ROOT, filename).replaceAll(path.sep, '/');
    const escapes = typeEscapeCount(filename, sources.get(filename)!);
    if (escapes > 0) typeEscapes[path.relative(repoRoot, filename).replaceAll(path.sep, '/')] = escapes;
    if (!LOWER_LAYERS.some((layer) => relative.startsWith(layer))) continue;
    for (const target of graph.get(filename) ?? []) {
      const targetRel = path.relative(WEB_ROOT, target).replaceAll(path.sep, '/');
      if (targetRel.startsWith('views/')) layerViolations.push(`${relative} -> ${targetRel}`);
    }
  }
  layerViolations.sort();

  const modules: Record<string, ModuleMetric> = {};
  for (const filename of files) {
    const source = sources.get(filename)!;
    const lines = logicalLines(source);
    if (lines < SOFT_MODULE_LINES) continue;
    const relative = path.relative(repoRoot, filename).replaceAll(path.sep, '/');
    modules[relative] = {
      lines,
      largestFunctionLines: largestFunctionLines(filename, source),
      importFanIn: fanIn.get(filename) ?? 0,
      importFanOut: graph.get(filename)?.size ?? 0,
      typeEscapes: typeEscapeCount(filename, source),
    };
  }

  return {
    version: 1,
    scope: 'shells/web/src',
    exclusions: EXCLUSIONS.map((entry) => ({ ...entry })),
    modules,
    cycles: stronglyConnected(graph).map((cycle) =>
      cycle.map((filename) => path.relative(repoRoot, filename).replaceAll(path.sep, '/')),
    ),
    layerViolations,
    typeEscapes,
  };
}

/**
 * Which files count as changed. The function and type-escape ratchets judge only the files
 * a change touches, so this list decides what they see.
 *
 * The working tree is compared with a base commit:
 * - the commit named by `--base=<rev>` or MAINTAINABILITY_BASE, else origin/<GITHUB_BASE_REF>,
 *   else origin/main. The base is the merge base of HEAD with that commit, so a branch is
 *   judged on its own committed and uncommitted changes, and not on what main did after the
 *   branch started. CI passes HEAD^1 for a pull request (GitHub checks out a merge commit
 *   whose first parent is the target branch) and the replaced main commit for a main push.
 * - During a merge from the target branch, the base is the commit being merged in. A file
 *   that the merge brings in unchanged from main is then not this branch's change.
 * - In a shallow checkout with no common history, the named commit itself is the base.
 * - Locally with no origin/main, the base is HEAD: only uncommitted work counts, as before.
 * In CI (GITHUB_ACTIONS or CI set to true) a base that cannot be found is an error, so the
 * ratchet never quietly checks nothing.
 */
export interface ChangeBase {
  /** The commit the working tree is compared with. */
  commit: string;
  /** How the commit was chosen, for the log line. */
  source: string;
}

export interface ChangeSelectionOptions {
  /** Repository to read. Defaults to this checkout. */
  cwd?: string;
  /** Environment to read the CI settings from. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** A base revision from the command line (--base=<rev>). */
  base?: string;
}

const WEB_PREFIX = 'shells/web/src/';

function gitRunner(cwd: string, env: NodeJS.ProcessEnv): (...args: string[]) => string | null {
  return (...args) => {
    try {
      return execFileSync('git', args, {
        cwd,
        env,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return null;
    }
  };
}

function inCi(env: NodeJS.ProcessEnv): boolean {
  return env.GITHUB_ACTIONS === 'true' || env.CI === 'true';
}

export function resolveChangeBase(options: ChangeSelectionOptions = {}): ChangeBase {
  const env = options.env ?? process.env;
  const git = gitRunner(options.cwd ?? repoRoot, env);
  const commitOf = (rev: string): string | null =>
    git('rev-parse', '--verify', '--quiet', `${rev}^{commit}`)?.trim() || null;
  const isAncestor = (older: string, newer: string): boolean => git('merge-base', '--is-ancestor', older, newer) !== null;

  const explicit = options.base || env.MAINTAINABILITY_BASE || '';
  const target = explicit || (env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : 'origin/main');
  const targetCommit = commitOf(target);
  if (!targetCommit) {
    if (explicit || inCi(env)) {
      throw new Error(
        `cannot list the files this change touches: ${target} is not a commit in this checkout. ` +
          'Fetch it, or name another base with --base=<rev> or MAINTAINABILITY_BASE.',
      );
    }
    return { commit: 'HEAD', source: `HEAD (${target} is not in this checkout, so only uncommitted work counts)` };
  }

  const mergeBase = git('merge-base', 'HEAD', targetCommit)?.trim() || null;
  let commit = mergeBase ?? targetCommit;
  let source = mergeBase ? `merge base of HEAD and ${target}` : `${target} (no common history in this checkout)`;
  const mergeHead = commitOf('MERGE_HEAD');
  if (mergeHead && mergeHead !== commit && isAncestor(mergeHead, targetCommit) && isAncestor(commit, mergeHead)) {
    commit = mergeHead;
    source = `MERGE_HEAD, a merge from ${target} in progress`;
  }
  return { commit, source: `${source}, ${commit.slice(0, 12)}` };
}

/** Production modules under shells/web/src that differ from the base, uncommitted and untracked files included. */
export function changedProductionModules(options: ChangeSelectionOptions = {}): { base: ChangeBase; changed: Set<string> } {
  const env = options.env ?? process.env;
  const git = gitRunner(options.cwd ?? repoRoot, env);
  const base = resolveChangeBase(options);
  const changed = new Set<string>();
  for (const args of [
    ['diff', '--name-only', '-z', '--diff-filter=ACMRTU', base.commit, '--', WEB_PREFIX],
    ['ls-files', '-z', '--others', '--exclude-standard', '--', WEB_PREFIX],
  ]) {
    const output = git(...args);
    if (output === null) {
      if (inCi(env)) throw new Error(`cannot list the files this change touches: git ${args.join(' ')} failed`);
      continue;
    }
    for (const name of output.split('\0').filter(Boolean)) {
      if (name.startsWith(WEB_PREFIX) && isProductionModule(path.join(repoRoot, name))) changed.add(name);
    }
  }
  return { base, changed };
}

function baseArgument(argv: string[]): string | undefined {
  const index = argv.findIndex((arg) => arg === '--base' || arg.startsWith('--base='));
  if (index < 0) return undefined;
  const arg = argv[index]!;
  return arg === '--base' ? argv[index + 1] : arg.slice('--base='.length);
}

export function compare(
  baseline: MaintainabilityBaseline,
  current: MaintainabilityBaseline,
  changed = changedProductionModules().changed,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [filename, metric] of Object.entries(current.modules)) {
    const previous = baseline.modules[filename];
    if (!previous) {
      if (metric.lines > HARD_MODULE_LINES) {
        errors.push(`${filename}: new production module is ${metric.lines} logical lines (hard limit ${HARD_MODULE_LINES})`);
      } else if (metric.lines > SOFT_MODULE_LINES) {
        warnings.push(`${filename}: new production module is ${metric.lines} logical lines (soft limit ${SOFT_MODULE_LINES})`);
      }
      continue;
    }
    if (previous.lines >= HOTSPOT_LINES && metric.lines > previous.lines) {
      errors.push(`${filename}: hotspot grew ${previous.lines} -> ${metric.lines} logical lines; extract a web-shell seam`);
    }
    if (changed.has(filename) && metric.largestFunctionLines > Math.max(150, previous.largestFunctionLines)) {
      errors.push(`${filename}: largest function grew ${previous.largestFunctionLines} -> ${metric.largestFunctionLines} lines`);
    }
    if (changed.has(filename) && metric.typeEscapes > previous.typeEscapes) {
      errors.push(`${filename}: type-escape markers grew ${previous.typeEscapes} -> ${metric.typeEscapes}`);
    }
    if (
      metric.lines < previous.lines ||
      metric.largestFunctionLines < previous.largestFunctionLines ||
      metric.typeEscapes < previous.typeEscapes
    ) {
      errors.push(`${filename}: budget improved; run pnpm run maintainability:baseline to ratchet it down`);
    }
  }

  // A successful extraction can move a module below the 1,500-line reporting
  // threshold (or remove it entirely).  Without this reverse comparison the
  // old allowance would silently remain forever and a later regression could
  // grow back into it.  Require the same explicit ratchet update as any other
  // improvement.
  for (const filename of Object.keys(baseline.modules)) {
    if (!current.modules[filename]) {
      errors.push(`${filename}: budget entry disappeared; run pnpm run maintainability:baseline to ratchet it down`);
    }
  }

  const baselineCycles = new Set(baseline.cycles.map((cycle) => cycle.join('\0')));
  for (const cycle of current.cycles) {
    if (!baselineCycles.has(cycle.join('\0'))) errors.push(`new dependency cycle: ${cycle.join(' -> ')}`);
  }
  // layering: a lower layer reaching up into views/
  const knownEdges = new Set(baseline.layerViolations ?? []);
  for (const edge of current.layerViolations ?? []) {
    if (!knownEdges.has(edge)) errors.push(`new upward import: ${edge} - lib/bridge/components must not import from views/; move the shared piece down`);
  }
  for (const edge of knownEdges) {
    if (!(current.layerViolations ?? []).includes(edge)) errors.push(`upward import ${edge} is gone; run pnpm run maintainability:baseline to ratchet it down`);
  }
  // type escapes, every module: only ever down
  if (baseline.typeEscapes) {
    for (const [filename, count] of Object.entries(current.typeEscapes ?? {})) {
      const previous = baseline.typeEscapes[filename];
      if (previous === undefined) errors.push(`${filename}: new module carries ${count} type escape(s) (any / as unknown as / ts-ignore); write it clean, or add it deliberately with pnpm run maintainability:baseline`);
      else if (count > previous) errors.push(`${filename}: type escapes grew ${previous} -> ${count}`);
      else if (count < previous) errors.push(`${filename}: type escapes fell ${previous} -> ${count}; run pnpm run maintainability:baseline to ratchet it down`);
    }
    for (const [filename, previous] of Object.entries(baseline.typeEscapes)) {
      if (!(filename in (current.typeEscapes ?? {}))) errors.push(`${filename}: its ${previous} type escape(s) are gone; run pnpm run maintainability:baseline to ratchet it down`);
    }
  }
  return { errors, warnings };
}

function loadBaseline(): MaintainabilityBaseline {
  if (!existsSync(baselinePath)) throw new Error(`missing ${path.relative(repoRoot, baselinePath)}`);
  return JSON.parse(readFileSync(baselinePath, 'utf8')) as MaintainabilityBaseline;
}

function main(): void {
  const current = measure();
  if (process.argv.includes('--write')) {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Wrote ${path.relative(repoRoot, baselinePath)} (${Object.keys(current.modules).length} modules, ${current.cycles.length} cycles, ${(current.layerViolations ?? []).length} upward imports, ${Object.keys(current.typeEscapes ?? {}).length} modules with type escapes).`);
    return;
  }
  const { base, changed } = changedProductionModules({ base: baseArgument(process.argv.slice(2)) });
  console.log(`Changed web modules: ${changed.size}, compared with the ${base.source}.`);
  const { errors, warnings } = compare(loadBaseline(), current, changed);
  for (const warning of warnings) console.warn(`maintainability warning: ${warning}`);
  if (errors.length) {
    throw new Error(`Maintainability budget failed:\n- ${errors.join('\n- ')}`);
  }
  console.log(`Maintainability budget passed (${Object.keys(current.modules).length} concentrated web modules, ${current.cycles.length} baselined cycles, ${(current.layerViolations ?? []).length} baselined upward imports, ${Object.keys(current.typeEscapes ?? {}).length} modules with type escapes).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
