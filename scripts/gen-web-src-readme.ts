#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * shells/web/src/README.md stats generator - the same marker-rewrite pattern as
 * scripts/gen-engine-modules.ts and scripts/build-readme-tools.ts.
 *
 * Run as: node scripts/gen-web-src-readme.ts          (rewrite in place)
 *         node scripts/gen-web-src-readme.ts --check  (exit 1 on drift)
 *
 * WHY. That README opens with a per-directory table of file and line counts and
 * a "largest files" table, both hand-written. maintainability-2026-07-29.md item
 * 5 flagged them as certain to rot: nothing recomputes them, and they are exactly
 * the numbers a new contributor uses to decide where to look first. A stale
 * "3,563 lines, no tests" sends someone to the wrong file.
 *
 * Two generated blocks, each between its own markers:
 *   <!-- web-src-dirs:start -->    per-directory source / test / CSS counts
 *   <!-- web-src-largest:start -->  the largest source files + their test status
 *
 * The prose around them is hand-written and untouched - only the tables move.
 *
 * "Direct test coverage" is deliberately mechanical: a sibling `<name>.test.ts`,
 * or any file under the shell's tree whose text imports the module by basename.
 * It answers "is anything pointed at this file", not "is it well tested" - the
 * hand-written notes in the prose column are where nuance belongs, so the
 * generator emits a plain yes/no and leaves judgement to the reader.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'shells/web/src');
const README = join(SRC, 'README.md');

const DIRS_START = '<!-- web-src-dirs:start -->';
const DIRS_END = '<!-- web-src-dirs:end -->';
const BIG_START = '<!-- web-src-largest:start -->';
const BIG_END = '<!-- web-src-largest:end -->';

/** How many of the largest source files to list. */
const LARGEST_N = 20;

interface FileRow { rel: string; lines: number }

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const lineCount = (p: string): number => readFileSync(p, 'utf8').split('\n').length;

const isTest = (rel: string): boolean => rel.endsWith('.test.ts') || rel.endsWith('.test.js');
const isDecl = (rel: string): boolean => rel.endsWith('.d.ts');
const isSource = (rel: string): boolean => /\.(ts|js)$/.test(rel) && !isTest(rel);
const isCss = (rel: string): boolean => rel.endsWith('.css');

const ALL: FileRow[] = walk(SRC).map((p) => ({
  rel: relative(SRC, p).split(sep).join('/'),
  lines: lineCount(p),
}));

/** Top-level directory of a path, or '' for a file directly under src/. */
const topDir = (rel: string): string => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '');

const fmt = (n: number): string => n.toLocaleString('en-US');
const cell = (files: number, lines: number): string =>
  files ? `${files} file${files === 1 ? '' : 's'}, ${fmt(lines)} lines` : 'none';

function dirsTable(): string {
  const dirs = new Map<string, { sf: number; sl: number; tf: number; tl: number; cf: number; cl: number }>();
  for (const f of ALL) {
    const d = topDir(f.rel);
    if (!d) continue; // top-level files are described in the prose below the table
    const e = dirs.get(d) ?? { sf: 0, sl: 0, tf: 0, tl: 0, cf: 0, cl: 0 };
    if (isCss(f.rel)) { e.cf++; e.cl += f.lines; }
    else if (isTest(f.rel)) { e.tf++; e.tl += f.lines; }
    else if (isSource(f.rel)) { e.sf++; e.sl += f.lines; }
    dirs.set(d, e);
  }
  const rows = [...dirs.entries()]
    // A directory of pure assets (locales/*.json) contributes no .ts/.js/.css and
    // would render as a "none | none | none" row that says nothing.
    .filter(([, e]) => e.sf + e.tf + e.cf > 0)
    .sort((a, b) => b[1].sl - a[1].sl || a[0].localeCompare(b[0]))
    .map(([d, e]) => `| \`${d}/\` | ${cell(e.sf, e.sl)} | ${cell(e.tf, e.tl)} | ${cell(e.cf, e.cl)} |`);

  const top = ALL.filter((f) => !topDir(f.rel) && /\.(ts|js)$/.test(f.rel));
  const topTests = top.filter((f) => isTest(f.rel)).length;
  const topDecls = top.filter((f) => isDecl(f.rel)).length;
  const mainLines = ALL.find((f) => f.rel === 'main.ts')?.lines ?? 0;

  const totalTs = ALL.filter((f) => /\.(ts|js)$/.test(f.rel)).reduce((n, f) => n + f.lines, 0);
  const totalCss = ALL.filter((f) => isCss(f.rel)).reduce((n, f) => n + f.lines, 0);

  return [
    `Roughly ${fmt(Math.round(totalTs / 1000) * 1000)} lines of TypeScript, tests included, and ` +
      `${fmt(Math.round(totalCss / 1000) * 1000)} lines of CSS.`,
    '',
    '| Directory | Source | Tests | CSS |',
    '|---|---|---|---|',
    ...rows,
    '',
    `Plus ${top.length} \`.ts\`/\`.js\` files at the top level of \`src/\`, ${fmt(top.reduce((n, f) => n + f.lines, 0))} ` +
      `lines all told, of which ${topTests} are tests and ${topDecls} are ambient declarations. ` +
      `\`main.ts\` is ${fmt(mainLines)} of that.`,
  ].join('\n');
}

/** Every file that is pointed at by a test, by basename import or sibling suite. */
function testedSet(): Set<string> {
  const tests = ALL.filter((f) => isTest(f.rel));
  const texts = tests.map((f) => readFileSync(join(SRC, f.rel), 'utf8'));
  const tested = new Set<string>();
  for (const f of ALL) {
    if (!isSource(f.rel) || isDecl(f.rel)) continue;
    const base = f.rel.slice(f.rel.lastIndexOf('/') + 1).replace(/\.[jt]s$/, '');
    const sibling = f.rel.replace(/\.[jt]s$/, '.test.ts');
    if (existsSync(join(SRC, sibling))) { tested.add(f.rel); continue; }
    // An import naming this module - `from './export.ts'`, `from '../lib/x.js'`.
    const re = new RegExp(`['"\`][^'"\`]*/${base}\\.[jt]s['"\`]`);
    if (texts.some((t) => re.test(t))) tested.add(f.rel);
  }
  return tested;
}

/**
 * The coverage column of the existing table, keyed by file path.
 *
 * This column is HAND-WRITTEN and worth keeping: the `bridge/export.ts` note
 * names the nine Chromium suites that cover it and the fact they self-skip,
 * which no generator could derive. So the generator refreshes what actually rots
 * - the line counts and which files are in the top N - and carries each existing
 * note across verbatim. A file that enters the table for the first time gets a
 * mechanical yes/none placeholder for a human to write up.
 */
function existingNotes(readme: string): Map<string, string> {
  const notes = new Map<string, string>();
  const i = readme.indexOf(BIG_START);
  const j = readme.indexOf(BIG_END);
  const block = i >= 0 && j > i ? readme.slice(i, j) : readme;
  for (const line of block.split('\n')) {
    const m = /^\|\s*[\d,]+\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (m) notes.set(m[1] as string, m[2] as string);
  }
  return notes;
}

function largestTable(readme: string): string {
  const tested = testedSet();
  const notes = existingNotes(readme);
  const rows = ALL.filter((f) => isSource(f.rel) && !isDecl(f.rel) && /\.ts$/.test(f.rel))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, LARGEST_N)
    .map((f) => {
      const note = notes.get(f.rel) ?? (tested.has(f.rel) ? 'yes' : '**none**');
      return `| ${fmt(f.lines)} | \`${f.rel}\` | ${note} |`;
    });
  return [
    '| Lines | File | Direct test coverage |',
    '|---|---|---|',
    ...rows,
  ].join('\n');
}

function replaceBlock(text: string, start: string, end: string, body: string): string {
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i < 0 || j < 0 || j < i) {
    throw new Error(`markers ${start} / ${end} not found in ${README} - add them around the generated table`);
  }
  return `${text.slice(0, i + start.length)}\n${body}\n${text.slice(j)}`;
}

function render(current: string): string {
  let next = replaceBlock(current, DIRS_START, DIRS_END, dirsTable());
  next = replaceBlock(next, BIG_START, BIG_END, largestTable(current));
  return next;
}

function main(): void {
  if (!existsSync(README) || !statSync(README).isFile()) {
    console.error(`✗ ${relative(ROOT, README)} is missing - is the shells/web submodule checked out?`);
    process.exit(1);
  }
  const current = readFileSync(README, 'utf8');
  let next: string;
  try { next = render(current); }
  catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (process.argv.includes('--check')) {
    if (next !== current) {
      console.error(
        'shells/web/src/README.md stats are stale. Run `npm run build:web-src-readme` and commit the result.',
      );
      process.exit(1);
    }
    console.log('shells/web/src/README.md stats are current.');
    return;
  }
  writeFileSync(README, next);
  console.log(`shells/web/src/README.md stats regenerated (top ${LARGEST_N} files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
