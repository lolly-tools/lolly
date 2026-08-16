/**
 * Ratcheting vernacular gate for CODE COMMENTS in the owned TypeScript.
 *
 * Humans read comments, so the plain-language rule that governs the docs governs
 * them too (owner directive, 2026-08-16): no em dashes, and none of the claudism
 * phrases from the shared ban list in check-docs-vernacular.ts.
 *
 * The tree carries tens of thousands of comment em dashes today, so a hard "zero"
 * gate would be all red on day one. This is a RATCHET instead, the same pattern as
 * primitive-guards.test.ts R10: a per-file baseline (scripts/vernacular-code-baseline.json)
 * that can only go DOWN. A new file must be clean. A file that improves must lower
 * its baseline (run --write to lock the win). A file that regresses fails. So the
 * count is driven to zero over many passes, and no new comment can add to it.
 *
 *   node scripts/check-code-comment-vernacular.ts            # check (exit 1 on drift)
 *   node scripts/check-code-comment-vernacular.ts --write    # regenerate the baseline
 *
 * SCOPE: comment LINES only (a line whose first non-space char starts //, /*, * or
 * *​/). That is where the whole backlog lives, and it never matches an em dash that
 * sits inside a string literal, a regex or verbatim CLI output, which must not move.
 * Trailing comments after code are out of scope for the same safety reason.
 */
import { readFileSync, readdirSync, lstatSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import ts from 'typescript';
import { BANNED_PHRASES } from './check-docs-vernacular.ts';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const BASELINE_PATH = join(ROOT, 'scripts/vernacular-code-baseline.json');

/** Directory names never descended into. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'dist', 'build', 'coverage']);

/** Repo-relative paths (dir or file prefix) that are vendored, generated or a
 *  gitignored profile VIEW. The tools/ and catalog/ roots are symlink views, so
 *  scanning them would double-count community/ and brands/ under a second path. */
function isExcluded(rel: string): boolean {
  return (
    rel === 'tools' || rel.startsWith('tools/') ||
    rel === 'catalog' || rel.startsWith('catalog/') ||
    rel === 'api/mcp' || rel === 'api/ca' ||
    rel.endsWith('/public/info') || rel.includes('/public/info/') ||
    /\/lib$/.test(rel) && rel.startsWith('tools/')
  );
}

/** Walk owned .ts, never following a symlink (the profile views are symlinks). */
export function ownedTsFiles(): string[] {
  const out: string[] = [];
  const visit = (absDir: string): void => {
    let entries: string[];
    try { entries = readdirSync(absDir); } catch { return; }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const abs = join(absDir, name);
      const rel = relative(ROOT, abs);
      let st;
      try { st = lstatSync(abs); } catch { continue; }
      if (st.isSymbolicLink()) continue; // never follow the tools/ + catalog/ views
      if (st.isDirectory()) {
        if (!isExcluded(rel)) visit(abs);
      } else if (name.endsWith('.ts') && !name.endsWith('.min.ts') && !name.endsWith('.d.ts')) {
        if (!isExcluded(rel)) out.push(rel);
      }
    }
  };
  visit(ROOT);
  return out.sort();
}

/**
 * The EXACT byte ranges of every comment, via the TypeScript parser. A parser,
 * not a bare scanner: the scanner has no regex context, so a `/regex/` earlier in
 * a file throws its state off and it misses later comments. The parser delimits
 * tokens correctly, and leading/trailing trivia between tokens is unambiguously
 * whitespace and comments - so a string literal is never mistaken for a comment,
 * and a comment after a regex is never missed. Shared with the em-dash stripper.
 */
export function commentRanges(name: string, src: string): Array<[number, number]> {
  const sf = ts.createSourceFile(name, src, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TS);
  const seen = new Set<string>();
  const ranges: Array<[number, number]> = [];
  const add = (rs: ts.CommentRange[] | undefined): void => {
    for (const r of rs ?? []) {
      const key = `${r.pos}:${r.end}`;
      if (!seen.has(key)) { seen.add(key); ranges.push([r.pos, r.end]); }
    }
  };
  const visit = (node: ts.Node): void => {
    add(ts.getLeadingCommentRanges(src, node.getFullStart()));
    add(ts.getTrailingCommentRanges(src, node.getEnd()));
    node.forEachChild(visit);
  };
  visit(sf);
  add(ts.getLeadingCommentRanges(src, sf.endOfFileToken.getFullStart()));
  return ranges;
}

/**
 * Phrases from the shared docs list that are legitimate DOMAIN terms in this
 * codebase's CODE, so they must not count as claudisms in a comment. This is the
 * code-side equivalent of the docs gate's ALLOW entries: "transcription" is a
 * shipped feature (host.speech, transcribeCached()), and "admissible" is used in
 * its mathematical sense (an admissible root/fit). Keyed by the phrase's `what`.
 */
const CODE_EXEMPT = new Set<string>([
  '"transcribe" family as prose (say quote/copy; the speech feature and API names carry ALLOW entries)',
  '"admissible" (any variation)',
  'prose "smoke test"', // a real testing term; a test file may name itself a smoke test
]);
const CODE_PHRASES = BANNED_PHRASES.filter(p => !CODE_EXEMPT.has(p.what));

/** Count of banned tokens (em dashes + claudism phrase hits) in a file's comments. */
export function countFile(rel: string): number {
  const abs = join(ROOT, rel);
  let src: string;
  try { src = readFileSync(abs, 'utf8'); } catch { return 0; }
  // Fast path: a file with no em dash and no phrase trigger anywhere has nothing
  // in a comment either, so skip the parse. Most files hit this after the sweep.
  if (!src.includes('—') && !CODE_PHRASES.some(({ re }) => re.test(src))) return 0;
  let n = 0;
  for (const [s, e] of commentRanges(rel, src)) {
    const seg = src.slice(s, e);
    n += (seg.match(/—/g) ?? []).length;
    for (const line of seg.split('\n')) {
      for (const { re } of CODE_PHRASES) if (re.test(line)) n += 1;
    }
  }
  return n;
}

/** Current per-file counts, only files with a non-zero count. */
export function scanCode(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rel of ownedTsFiles()) {
    const n = countFile(rel);
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

export interface CodeVernacularDrift {
  over: Array<{ file: string; was: number; now: number }>;   // regressed above baseline
  fresh: Array<{ file: string; now: number }>;               // new file, not clean
  under: Array<{ file: string; was: number; now: number }>;  // improved, baseline stale
}

export function loadBaseline(): Record<string, number> {
  if (!existsSync(BASELINE_PATH)) return {};
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

/** Compare current counts to the baseline. The ratchet fails in all three ways:
 *  a regression, a new dirty file, and an un-recorded improvement (attrition win),
 *  so the baseline always states the real floor. */
export function drift(current = scanCode(), baseline = loadBaseline()): CodeVernacularDrift {
  const over: CodeVernacularDrift['over'] = [];
  const fresh: CodeVernacularDrift['fresh'] = [];
  const under: CodeVernacularDrift['under'] = [];
  for (const [file, now] of Object.entries(current)) {
    const was = baseline[file];
    if (was === undefined) fresh.push({ file, now });
    else if (now > was) over.push({ file, was, now });
    else if (now < was) under.push({ file, was, now });
  }
  for (const [file, was] of Object.entries(baseline)) {
    if (current[file] === undefined) under.push({ file, was, now: 0 }); // cleared: lock it
  }
  return { over, fresh, under };
}

export function total(counts: Record<string, number>): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  const current = scanCode();
  if (process.argv.includes('--write')) {
    const sorted: Record<string, number> = {};
    for (const k of Object.keys(current).sort()) sorted[k] = current[k]!;
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`✓ wrote baseline: ${Object.keys(sorted).length} files, ${total(sorted)} tokens`);
    process.exit(0);
  }
  const d = drift(current);
  for (const x of d.over) console.error(`✗ ${x.file}: comment claudisms rose ${x.was} → ${x.now}`);
  for (const x of d.fresh) console.error(`✗ ${x.file}: new file has ${x.now} comment claudism(s) — write comments in plain English (no em dashes, no tics)`);
  for (const x of d.under) console.error(`✗ ${x.file}: improved ${x.was} → ${x.now} — run: node scripts/check-code-comment-vernacular.ts --write`);
  if (d.over.length || d.fresh.length || d.under.length) {
    console.error(`\n${d.over.length} regressed, ${d.fresh.length} new-dirty, ${d.under.length} improved-but-unrecorded. Total now ${total(current)}.`);
    process.exit(1);
  }
  console.log(`✓ code-comment vernacular clean against baseline (${total(current)} tokens across ${Object.keys(current).length} files)`);
}
