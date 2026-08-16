/**
 * Deterministic section-sign remover for CODE COMMENTS in owned TypeScript.
 *
 * The owner ruling (2026-08-16) is that the section-sign glyph never appears in
 * our writing - prose, docs or comments - because not everyone knows it. Say the
 * word ("section 2", "step 2"). Like the em-dash, the swap itself is mechanical,
 * so it is done deterministically rather than by a model. This uses the
 * TypeScript parser to get the EXACT byte range of every comment, then replaces
 * the glyph only inside those ranges, so a string literal, a regex or verbatim
 * output is never touched. That is what keeps the glyph in the BANNED_CHARS key
 * of check-docs-vernacular.ts, in this checker's own counter and in any test
 * fixture safe: those are code, not comments.
 *
 * The replacement is the glyph plus any run of spaces or tabs after it, rewritten
 * to the word "section" and one space. A spec reference like the glyph then 18.28
 * becomes "section 18.28"; "plans/105" then the glyph then 6 becomes
 * "plans/105 section 6"; and an existing space after the glyph is not doubled.
 *
 * Safety net: after editing a file, it re-parses. If the edit somehow introduced
 * a syntax error the input did not have, the file is left unchanged and reported.
 *
 *   node scripts/strip-comment-section-sign.ts                 # all owned .ts
 *   node scripts/strip-comment-section-sign.ts --dry           # report only
 *   node scripts/strip-comment-section-sign.ts shells/web tests # only these prefixes
 *
 * Idempotent: a second run over clean files changes nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import ts from 'typescript';
import { ownedTsFiles, commentRanges } from './check-code-comment-vernacular.ts';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const GLYPH = '§';

function parseErrorCount(name: string, text: string): number {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, /*setParentNodes*/ false, ts.ScriptKind.TS);
  return ((sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? []).length;
}

/** Replace the section-sign inside comment ranges only. Returns new text + count. */
export function stripFile(name: string, src: string): { out: string; changed: number } {
  const ranges = commentRanges(name, src);
  const re = new RegExp(`${GLYPH}[ \\t]*`, 'g');
  let out = src;
  let changed = 0;
  // Apply from the end so earlier offsets stay valid.
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [s, e] = ranges[i]!;
    const seg = out.slice(s, e);
    const rep = seg.replace(re, () => { changed++; return 'section '; });
    if (rep !== seg) out = out.slice(0, s) + rep + out.slice(e);
  }
  return { out, changed };
}

const dry = process.argv.includes('--dry');
const prefixes = process.argv.slice(2).filter(a => !a.startsWith('--'));
const files = ownedTsFiles()
  .filter(f => prefixes.length === 0 || prefixes.some(p => f === p || f.startsWith(p.replace(/\/$/, '') + '/')));

let totalChanged = 0;
let filesTouched = 0;
const reverted: string[] = [];
for (const rel of files) {
  const abs = join(ROOT, rel);
  const src = readFileSync(abs, 'utf8');
  if (!src.includes(GLYPH)) continue;
  const { out, changed } = stripFile(rel, src);
  if (changed === 0 || out === src) continue;
  if (parseErrorCount(rel, out) > parseErrorCount(rel, src)) { reverted.push(rel); continue; }
  totalChanged += changed;
  filesTouched += 1;
  if (!dry) writeFileSync(abs, out);
}

console.log(`${dry ? '[dry] ' : ''}stripped ${totalChanged} comment section-sign(s) across ${filesTouched} file(s)` +
  (reverted.length ? `; SKIPPED ${reverted.length} (would break parse): ${reverted.join(', ')}` : ''));
