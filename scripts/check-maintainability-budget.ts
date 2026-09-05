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
}

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

function typeEscapeCount(source: string): number {
  const patterns = [
    /\bany\b/g,
    /\bas\s+unknown\s+as\b/g,
    /@ts-(?:ignore|nocheck|expect-error)\b/g,
    /eslint-disable(?:-next-line)?\b/g,
    /biome-ignore\b/g,
  ];
  return patterns.reduce((total, pattern) => total + [...source.matchAll(pattern)].length, 0);
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
      typeEscapes: typeEscapeCount(source),
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
  };
}

function changedProductionModules(): Set<string> {
  const changed = new Set<string>();
  const collect = (cwd: string, prefix: string): void => {
    for (const args of [
      ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'],
      ['ls-files', '--others', '--exclude-standard'],
    ]) {
      let output = '';
      try {
        output = execFileSync('git', args, { cwd, encoding: 'utf8' });
      } catch {
        continue;
      }
      for (const name of output.trim().split('\n').filter(Boolean)) {
        const relative = `${prefix}${name}`.replaceAll(path.sep, '/');
        if (isProductionModule(path.join(repoRoot, relative))) changed.add(relative);
      }
    }
  };
  collect(repoRoot, '');
  collect(path.join(repoRoot, 'shells', 'web'), 'shells/web/');
  return changed;
}

export function compare(
  baseline: MaintainabilityBaseline,
  current: MaintainabilityBaseline,
  changed = changedProductionModules(),
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
      errors.push(`${filename}: budget improved; run npm run maintainability:baseline to ratchet it down`);
    }
  }

  // A successful extraction can move a module below the 1,500-line reporting
  // threshold (or remove it entirely).  Without this reverse comparison the
  // old allowance would silently remain forever and a later regression could
  // grow back into it.  Require the same explicit ratchet update as any other
  // improvement.
  for (const filename of Object.keys(baseline.modules)) {
    if (!current.modules[filename]) {
      errors.push(`${filename}: budget entry disappeared; run npm run maintainability:baseline to ratchet it down`);
    }
  }

  const baselineCycles = new Set(baseline.cycles.map((cycle) => cycle.join('\0')));
  for (const cycle of current.cycles) {
    if (!baselineCycles.has(cycle.join('\0'))) errors.push(`new dependency cycle: ${cycle.join(' -> ')}`);
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
    console.log(`Wrote ${path.relative(repoRoot, baselinePath)} (${Object.keys(current.modules).length} modules, ${current.cycles.length} cycles).`);
    return;
  }
  const { errors, warnings } = compare(loadBaseline(), current);
  for (const warning of warnings) console.warn(`maintainability warning: ${warning}`);
  if (errors.length) {
    throw new Error(`Maintainability budget failed:\n- ${errors.join('\n- ')}`);
  }
  console.log(`Maintainability budget passed (${Object.keys(current.modules).length} concentrated web modules, ${current.cycles.length} baselined cycles).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
