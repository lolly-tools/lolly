/**
 * Deterministic em-dash remover for CODE COMMENTS in owned TypeScript.
 *
 * The de-verbose comment rewrite is a judgment task for a model, but the em dash
 * itself is mechanical, and doing it deterministically is both free and safer than
 * asking a model. This uses the TypeScript scanner to get the EXACT byte range of
 * every comment, then replaces em dashes only inside those ranges, so a string
 * literal, a template literal, a regex or verbatim CLI output is never touched.
 *
 * Safety net: after editing a file, it re-parses the result. If the edit somehow
 * introduced a syntax error the input did not have (a mis-scanned regex comment,
 * say), the file is left unchanged and reported, never written broken.
 *
 *   node scripts/strip-comment-emdash.ts                 # all owned .ts
 *   node scripts/strip-comment-emdash.ts --dry           # report only, write nothing
 *   node scripts/strip-comment-emdash.ts shells/web tests # only under these prefixes
 *
 * Idempotent: a second run over clean files changes nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import ts from 'typescript';
import { ownedTsFiles, commentRanges } from './check-code-comment-vernacular.ts';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function parseErrorCount(name: string, text: string): number {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, /*setParentNodes*/ false, ts.ScriptKind.TS);
  return ((sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? []).length;
}

/** Replace em dashes inside comment ranges only. Returns the new text + count. */
export function stripFile(name: string, src: string): { out: string; changed: number } {
  const ranges = commentRanges(name, src);
  let out = src;
  let changed = 0;
  // Apply from the end so earlier offsets stay valid. Collapse only spaces/tabs
  // around the dash - never a newline, so a dash at a line break cannot merge lines.
  for (let i = ranges.length - 1; i >= 0; i--) {
    const [s, e] = ranges[i]!;
    const seg = out.slice(s, e);
    const rep = seg.replace(/[ \t]*—[ \t]*/g, () => { changed++; return ' - '; });
    if (rep !== seg) out = out.slice(0, s) + rep + out.slice(e);
  }
  return { out, changed };
}

const dry = process.argv.includes('--dry');
const excludeArg = process.argv.find(a => a.startsWith('--exclude='));
const exclude = new Set((excludeArg ? excludeArg.slice('--exclude='.length) : '').split(',').filter(Boolean));
const prefixes = process.argv.slice(2).filter(a => !a.startsWith('--'));
const files = ownedTsFiles()
  .filter(f => prefixes.length === 0 || prefixes.some(p => f === p || f.startsWith(p.replace(/\/$/, '') + '/')))
  .filter(f => !exclude.has(f));

let totalChanged = 0;
let filesTouched = 0;
const reverted: string[] = [];
for (const rel of files) {
  const abs = join(ROOT, rel);
  const src = readFileSync(abs, 'utf8');
  if (!src.includes('—')) continue;
  const { out, changed } = stripFile(rel, src);
  if (changed === 0 || out === src) continue;
  // Safety net: never write a file the edit broke.
  if (parseErrorCount(rel, out) > parseErrorCount(rel, src)) { reverted.push(rel); continue; }
  totalChanged += changed;
  filesTouched += 1;
  if (!dry) writeFileSync(abs, out);
}

console.log(`${dry ? '[dry] ' : ''}stripped ${totalChanged} comment em-dash(es) across ${filesTouched} file(s)` +
  (reverted.length ? `; SKIPPED ${reverted.length} (would break parse): ${reverted.join(', ')}` : ''));
