#!/usr/bin/env node
/**
 * engine/README.md module-map generator.
 *
 * Run as: node scripts/gen-engine-modules.ts  (no npm alias yet)
 * Check mode: node scripts/gen-engine-modules.ts --check  — exits 1 if the table
 * committed in engine/README.md differs from what a fresh scan produces, so this
 * can become a CI guard exactly like `npm run validate:catalog`.
 *
 * Scans engine/src/*.ts and engine/src/<dir>/*.ts and rewrites the table between
 * the `<!-- engine-modules:start -->` / `<!-- engine-modules:end -->` markers in
 * engine/README.md, following the same marker-rewrite pattern as
 * scripts/build-readme-tools.ts. Idempotent: a second run is a byte-identical
 * no-op.
 *
 * Columns:
 *   Module   — path relative to engine/src/ (index.ts is the barrel, excluded).
 *   Lines    — physical line count of the file.
 *   Purpose  — first sentence of the file's leading doc comment. Both header
 *              styles in the tree are handled: JSDoc `/** ... *\/` blocks, and
 *              `// ─── Title ───` banner comments (where the banner label IS the
 *              purpose). A leading SPDX line is skipped either way.
 *   Public?  — whether engine/src/index.ts re-exports anything from the module.
 *   Test     — `tests/<name>.test.ts` (or `tests/<dir>-<name>.test.ts` for a
 *              subdirectory module) if that file exists; else `indirect` if any
 *              file under tests/ imports the module; else `none`.
 *   Fuzzed   — whether the module basename is a declared target name in
 *              tests/fuzz/targets.ts.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'engine/src');
const INDEX_PATH = join(SRC_DIR, 'index.ts');
const TESTS_DIR = join(ROOT, 'tests');
const FUZZ_TARGETS_PATH = join(TESTS_DIR, 'fuzz/targets.ts');
const README_PATH = join(ROOT, 'engine/README.md');
const START_MARK = '<!-- engine-modules:start -->';
const END_MARK = '<!-- engine-modules:end -->';

/** Longest a Purpose cell may get before it is trimmed at a word boundary. */
const PURPOSE_MAX = 220;

const CHECK = process.argv.includes('--check');

function fail(msg: string): never {
  console.error(`gen-engine-modules: ${msg}`);
  process.exit(1);
}

// Markdown-table-safe cell text: no pipes, no newlines.
function cell(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

// ─── scanning ────────────────────────────────────────────────────────────────

/** Every .ts module under engine/src, one level deep, excluding the barrel. */
function listModules(): string[] {
  const out: string[] = [];
  for (const name of readdirSync(SRC_DIR).sort()) {
    const full = join(SRC_DIR, name);
    if (statSync(full).isDirectory()) {
      for (const child of readdirSync(full).sort()) {
        if (child.endsWith('.ts') && !child.endsWith('.d.ts')) out.push(`${name}/${child}`);
      }
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts') && name !== 'index.ts') {
      out.push(name);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'en'));
}

// ─── purpose extraction ──────────────────────────────────────────────────────

/** Abbreviations whose full stop must not be read as a sentence end. */
const ABBREV = new Set(['e.g.', 'i.e.', 'etc.', 'vs.', 'cf.', 'approx.', 'no.', 'fig.', 'al.', 'inc.']);

/**
 * A `// ─── Title ─── ` banner line, stripped to its label (empty if not one).
 *
 * Only the decoration RUNS at each end are removed. Stripping every `-`/`=` in
 * the line would corrupt the label itself: `row-filter` would lose its hyphen
 * and `/Predictor >= 10` would lose its `=`.
 */
function bannerLabel(line: string): string {
  const body = line.replace(/^\/\/\s?/, '');
  if (!/[─—=*_-]{3,}/.test(body)) return '';
  return body
    .replace(/^[─—=*_\s-]+/, '')
    .replace(/[─—=*_\s-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First sentence of a joined paragraph, minus trailing abbreviation traps. */
function firstSentence(text: string): string {
  const s = text.replace(/\s+/g, ' ').trim();
  let from = 0;
  for (;;) {
    const m = /[.!?](\s|$)/.exec(s.slice(from));
    if (!m) return s;
    const end = from + (m.index ?? 0) + 1;
    const word = s.slice(0, end).split(/\s/).pop()?.toLowerCase() ?? '';
    if (!ABBREV.has(word) && !/^[A-Z]\.$/.test(word)) return s.slice(0, end);
    from = end + 1;
    if (from >= s.length) return s;
  }
}

/** Trim to PURPOSE_MAX at a word boundary. */
function clamp(s: string): string {
  if (s.length <= PURPOSE_MAX) return s;
  const cut = s.slice(0, PURPOSE_MAX);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 40 ? cut.slice(0, sp) : cut).replace(/[,;:.]$/, '')}…`;
}

/**
 * First sentence of the leading doc comment, handling both header styles found
 * in engine/src: a JSDoc block, or a `//` banner/prose block. A leading
 * `// SPDX-License-Identifier:` line is skipped in either case.
 */
function extractPurpose(source: string): string {
  const lines = source.split('\n');
  let i = 0;
  const at = (n: number): string => lines[n]?.trim() ?? '';
  while (i < lines.length && (at(i) === '' || /^\/\/\s*SPDX-/.test(at(i)))) i++;
  if (i >= lines.length) return '';

  const head = at(i);

  if (head.startsWith('/**') || head.startsWith('/*')) {
    const body: string[] = [];
    for (; i < lines.length; i++) {
      let t = at(i);
      const closed = t.includes('*/');
      t = t.replace(/^\/\*\*?/, '').replace(/\*\/.*$/, '').replace(/^\*\s?/, '').trim();
      if (t === '') {
        if (body.length > 0) break; // paragraph break ends the summary
      } else {
        body.push(t);
      }
      if (closed) break;
    }
    return clamp(firstSentence(body.join(' ')));
  }

  if (head.startsWith('//')) {
    const label = bannerLabel(head);
    if (label) return clamp(firstSentence(label));
    const body: string[] = [];
    for (; i < lines.length && at(i).startsWith('//'); i++) {
      const t = at(i).replace(/^\/\/\s?/, '').trim();
      if (t === '') break;
      body.push(t);
    }
    return clamp(firstSentence(body.join(' ')));
  }

  return '';
}

// ─── coverage lookups ────────────────────────────────────────────────────────

/** Module paths (relative to engine/src) that index.ts re-exports from. */
function publicModules(): Set<string> {
  const src = readFileSync(INDEX_PATH, 'utf8');
  const out = new Set<string>();
  for (const m of src.matchAll(/from\s+'\.\/([^']+\.ts)'/g)) { if (m[1]) out.add(m[1]); }
  return out;
}

/** Every file under tests/, recursively. */
function walkTests(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkTests(full, acc);
    else if (/\.(ts|mts|mjs|js)$/.test(name)) acc.push(full);
  }
  return acc;
}

/** Declared fuzz target names in tests/fuzz/targets.ts. */
function fuzzTargets(): Set<string> {
  if (!existsSync(FUZZ_TARGETS_PATH)) return new Set();
  const src = readFileSync(FUZZ_TARGETS_PATH, 'utf8');
  const out = new Set<string>();
  for (const m of src.matchAll(/^\s*name:\s*'([^']+)'/gm)) { if (m[1]) out.add(m[1]); }
  return out;
}

// ─── table ───────────────────────────────────────────────────────────────────

const modules = listModules();
if (modules.length === 0) fail('engine/src has no modules — refusing to write an empty table.');

const pub = publicModules();
const fuzz = fuzzTargets();
const testFiles = walkTests(TESTS_DIR);
const testSources = new Map(testFiles.map(f => [f, readFileSync(f, 'utf8')]));

interface Row {
  module: string;
  lines: number;
  purpose: string;
  isPublic: boolean;
  test: string;
  fuzzed: boolean;
}

const rows: Row[] = modules.map(mod => {
  const source = readFileSync(join(SRC_DIR, mod), 'utf8');
  const lineCount = source.split('\n').length - (source.endsWith('\n') ? 1 : 0);
  const base = mod.replace(/\.ts$/, '');
  const leaf = base.includes('/') ? base.slice(base.indexOf('/') + 1) : base;
  const dashed = base.replace(/\//g, '-');

  const direct = [`${leaf}.test.ts`, `${dashed}.test.ts`].find(n => existsSync(join(TESTS_DIR, n)));
  const needle = `engine/src/${mod}`;
  const indirect = [...testSources.values()].some(s => s.includes(needle));

  return {
    module: mod,
    lines: lineCount,
    purpose: extractPurpose(source),
    isPublic: pub.has(mod),
    test: direct ? `\`tests/${direct}\`` : indirect ? 'indirect' : 'none',
    fuzzed: fuzz.has(leaf),
  };
});

const missingPurpose = rows.filter(r => r.purpose === '').map(r => r.module);

const publicCount = rows.filter(r => r.isPublic).length;
const directCount = rows.filter(r => r.test.startsWith('`')).length;
const indirectCount = rows.filter(r => r.test === 'indirect').length;
const noneCount = rows.filter(r => r.test === 'none').length;
const fuzzCount = rows.filter(r => r.fuzzed).length;

const sentence =
  `**${rows.length} modules** under \`engine/src/\` (excluding the \`index.ts\` barrel): ` +
  `${publicCount} re-exported from \`index.ts\`, ${directCount} with a dedicated \`tests/*.test.ts\`, ` +
  `${indirectCount} covered indirectly, ${noneCount} with no coverage under \`tests/\`, ` +
  `${fuzzCount} wired into the fuzz corpus. ` +
  `Generated by \`node scripts/gen-engine-modules.ts\` — do not hand-edit between the markers.`;

const table = [
  '| Module | Lines | Purpose | Public? | Test | Fuzzed |',
  '|---|--:|---|:--:|---|:--:|',
  ...rows.map(
    r =>
      `| \`${cell(r.module)}\` | ${r.lines} | ${cell(r.purpose)} | ${r.isPublic ? 'yes' : 'no'} | ${r.test} | ${r.fuzzed ? 'yes' : '–'} |`,
  ),
].join('\n');

if (!existsSync(README_PATH)) fail('engine/README.md not found — create it with the markers first.');
const readme = readFileSync(README_PATH, 'utf8');
const start = readme.indexOf(START_MARK);
const end = readme.indexOf(END_MARK);
if (start < 0 || end < 0) fail(`engine/README.md is missing the ${START_MARK} / ${END_MARK} markers.`);
if (end < start) fail('engine/README.md has the engine-modules markers in the wrong order.');

const next = `${readme.slice(0, start + START_MARK.length)}\n${sentence}\n\n${table}\n${readme.slice(end)}`;

if (CHECK) {
  if (next !== readme) {
    fail(
      'engine/README.md module table is stale. Run `node scripts/gen-engine-modules.ts` and commit the result.',
    );
  }
  console.log(`engine/README.md module table is current (${rows.length} modules).`);
} else if (next === readme) {
  console.log(`engine/README.md module table already current (${rows.length} modules).`);
} else {
  writeFileSync(README_PATH, next);
  console.log(
    `engine/README.md module table regenerated (${rows.length} modules, ${publicCount} public, ${directCount} directly tested, ${fuzzCount} fuzzed).`,
  );
}

if (missingPurpose.length > 0) {
  console.warn(
    `gen-engine-modules: ${missingPurpose.length} module(s) have no leading doc comment: ${missingPurpose.join(', ')}`,
  );
}
