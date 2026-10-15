// SPDX-License-Identifier: MPL-2.0
/**
 * Bare HSL token guard.
 *
 * The app's shadcn tokens (`--primary`, `--border`, `--muted`, `--card` and the
 * rest) hold a bare `H S% L%` triple, not a colour. A rule that hands one straight
 * to a colour property (`color: var(--primary)`, `stroke="var(--accent,#5c67d5)"`)
 * is invalid at computed-value time and paints nothing, silently: no error, no
 * warning, an inherited colour or no border where the author meant one. The
 * triple only becomes a colour inside `hsl()`, or by reading a `--ui-color-*` role
 * token, which wraps the triple already.
 *
 * The docs reader makes this worse. Its bridge (`parts/docs.css`) re-declares the
 * legacy docs names `--muted`, `--border`, `--pale`, `--page`, `--text`, `--green`,
 * `--dark`, `--light` and `--red` as FINISHED colours, so inside the docs scope
 * `hsl(var(--border))` wraps a colour twice, and `--border: hsl(var(--border))`
 * refers to itself, which is a cycle.
 *
 * Three rules, read from the source text so a new offender fails the moment it is
 * written:
 *   1. A bare token is only read inside `hsl()` / `hsla()`, or as a whole custom
 *      property value (an alias such as `--g1: var(--primary)`, or a partial value
 *      such as `--glow: var(--vf-pass) / 0.55`).
 *   2. In the docs scope the legacy names above are colours, so `hsl(var(--border))`
 *      fails there. The docs scope is all of `parts/docs-landing.css`, all of
 *      `lib/docs-landing.ts` and every CSS rule whose selectors each name
 *      `.docs-content` or `.docs-landing`.
 *   3. No custom property declaration reads its own name.
 *
 * The collector reads declarations rather than keeping a hand list, so a token a
 * later change adds (or renames) is covered without an edit here. The ALLOWED list
 * is empty on purpose: a genuine exception goes in it with a reason, and an entry
 * that no longer matches a violation fails, so it cannot outlive the code it excuses.
 *
 * This is the "defined names used the wrong way" guard. A check for names used but
 * defined nowhere is a different job and lives with the repository house rules.
 * `docs/build.ts` (the static /info stylesheet) sits outside `shells/web/src` and is
 * not scanned.
 *
 * Run directly:  node --test shells/web/src/styles/bare-hsl-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // shells/web/src/

/** The legacy docs names: finished colours inside the docs scope. */
const DOCS_NAMES = new Set([
  '--muted', '--border', '--pale', '--page', '--text', '--green', '--dark', '--light', '--red',
]);

/** Whole-file docs scope, relative to `src/` with forward slashes. */
const DOCS_FILES = new Set(['styles/parts/docs-landing.css', 'lib/docs-landing.ts']);

/** A rule is in the docs scope when every selector in its list contains one of these classes. */
const DOCS_CLASS = /\.docs-(?:content|landing)(?![\w-])/;

interface Allowed {
  /** Path relative to `src/`, forward slashes. */
  file: string;
  /** The trimmed text of the offending line. */
  line: string;
  reason: string;
}

/** Expected empty after the sweep. A stale entry (no matching violation) fails. */
const ALLOWED: Allowed[] = [];

interface Violation {
  file: string;
  line: number;
  text: string;
  why: string;
}

interface Source {
  file: string;
  /** Comments blanked, byte offsets and newlines preserved. */
  text: string;
  /** Half-open offset ranges that are docs scope. */
  docs: Array<[number, number]>;
}

const FIX = 'wrap it in hsl(), or use a --ui-color-* role token';

/** Blank CSS block comments and TS comments while preserving offsets (so line numbers hold). */
function stripComments(text: string, isTs: boolean): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (isTs) out = out.replace(/(^|[ \t])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)));
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(css|ts)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Offset ranges of the style rules in a stylesheet whose selectors are all docs scope. */
function docsRuleRanges(css: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const GROUP_AT = /^@(?:media|supports|layer|scope|container|document)\b/;
  const scan = (from: number, to: number): void => {
    let i = from;
    let preludeStart = from;
    while (i < to) {
      const ch = css[i];
      if (ch === ';') { preludeStart = i + 1; i++; continue; }
      if (ch === '}') { preludeStart = i + 1; i++; continue; }
      if (ch !== '{') { i++; continue; }
      // Find the matching close brace.
      let depth = 1;
      let j = i + 1;
      while (j < to && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      const prelude = css.slice(preludeStart, i).trim();
      if (prelude.startsWith('@')) {
        if (GROUP_AT.test(prelude)) scan(i + 1, j - 1);
      } else if (prelude) {
        const selectors = splitTopLevel(prelude);
        if (selectors.length > 0 && selectors.every((s) => DOCS_CLASS.test(s))) ranges.push([preludeStart, j]);
      }
      i = j;
      preludeStart = j;
    }
  };
  scan(0, css.length);
  return ranges;
}

function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function loadSources(): Source[] {
  return walk(SRC_DIR).map((path): Source => {
    const file = relative(SRC_DIR, path).split(sep).join('/');
    const isTs = file.endsWith('.ts');
    const text = stripComments(readFileSync(path, 'utf8'), isTs);
    let docs: Array<[number, number]> = [];
    if (DOCS_FILES.has(file)) docs = [[0, text.length]];
    else if (!isTs) docs = docsRuleRanges(text);
    return { file, text, docs };
  });
}

/** Bare names: declared as `H S% L%` anywhere, closed over whole-value aliases. */
function collectBare(sources: Source[]): Set<string> {
  const interp = String.raw`\$\{[^}]*\}\s+\$\{[^}]*\}%\s+\$\{[^}]*\}%`;
  const triple = String.raw`-?[\d.]+(?:deg)?\s+[\d.]+%\s+[\d.]+%`;
  const decl = new RegExp(
    String.raw`(?<![\w-])(--[\w-]+)\s*:\s*(?:${triple}|${interp})\s*(?:!important\s*)?(?=[;}\n\`'"]|$)`, 'g');
  const alias = /(?<![\w-])(--[\w-]+)\s*:\s*var\(\s*(--[\w-]+)\s*\)\s*(?:!important\s*)?(?=[;}\n`'"]|$)/g;
  const bare = new Set<string>();
  const aliases: Array<[string, string]> = [];
  for (const { text } of sources) {
    for (const m of text.matchAll(decl)) bare.add(m[1] as string);
    for (const m of text.matchAll(alias)) aliases.push([m[1] as string, m[2] as string]);
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, target] of aliases) {
      if (bare.has(target) && !bare.has(name)) { bare.add(name); grew = true; }
    }
  }
  return bare;
}

function lineAt(text: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function lineText(text: string, line: number): string {
  return (text.split('\n')[line - 1] ?? '').trim();
}

/** Rules 1 and 2: how every `var(--name` is wrapped. */
function checkUses(sources: Source[], bare: Set<string>): Violation[] {
  const found: Violation[] = [];
  for (const src of sources) {
    const { text, file } = src;
    const inDocs = (at: number) => src.docs.some(([a, b]) => at >= a && at < b);
    const stack: string[] = [];
    let boundary = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ';' || ch === '{' || ch === '}') { stack.length = 0; boundary = i + 1; continue; }
      if (ch === ')') { stack.pop(); continue; }
      if (ch !== '(') continue;
      let k = i;
      while (k > 0 && /[\w-]/.test(text.charAt(k - 1))) k--;
      const fn = text.slice(k, i).toLowerCase();
      stack.push(fn);
      if (fn !== 'var') continue;
      const m = /^\(\s*(--[\w-]+)/.exec(text.slice(i, i + 80));
      if (!m) continue;
      const name = m[1] as string;
      const docsHere = inDocs(i);
      const docsName = docsHere && DOCS_NAMES.has(name);
      if (!docsName && !bare.has(name)) continue;
      let d = stack.length - 1;
      while (d >= 0 && stack[d] === 'var') d--;
      const wrapper = d >= 0 ? stack[d] : '';
      const wrappedInHsl = wrapper === 'hsl' || wrapper === 'hsla';
      const line = lineAt(text, i);
      if (docsName) {
        if (wrappedInHsl) {
          found.push({ file, line, text: lineText(text, line),
            why: `${name} is a finished colour in the docs scope, so hsl(var(${name})) wraps a colour twice and is invalid; read var(${name}) directly` });
        }
        continue;
      }
      if (wrappedInHsl) continue;
      // No wrapping function: only a whole custom property value may read a bare token.
      if (!wrapper && /^[\s'"`]*--[\w-]+\s*:/.test(text.slice(boundary, i))) continue;
      found.push({ file, line, text: lineText(text, line),
        why: `${name} is a bare H S% L% triple, not a colour; ${FIX}` });
    }
  }
  return found;
}

/** Rule 3: a custom property whose value reads its own name. */
function checkCycles(sources: Source[]): Violation[] {
  const found: Violation[] = [];
  const re = /(?<![\w-])(--[\w-]+)\s*:[^;{}]*?var\(\s*\1\s*[,)]/g;
  for (const { text, file } of sources) {
    for (const m of text.matchAll(re)) {
      const line = lineAt(text, m.index + m[0].length - 1);
      found.push({ file, line, text: lineText(text, line),
        why: `${m[1]} reads itself, which is a cycle and invalid at computed-value time; read a --ui-color-* role token instead` });
    }
  }
  return found;
}

function report(violations: Violation[]): string {
  return violations.map((v) => `${v.file}:${v.line}: ${v.text}\n    ${v.why}`).join('\n');
}

/** Split violations into the ones the ALLOWED list excuses and the rest; report stale entries. */
function applyAllowed(violations: Violation[]): { open: Violation[]; stale: Allowed[] } {
  const used = new Set<Allowed>();
  const open = violations.filter((v) => {
    const hit = ALLOWED.find((a) => a.file === v.file && a.line === v.text);
    if (hit) used.add(hit);
    return !hit;
  });
  return { open, stale: ALLOWED.filter((a) => !used.has(a)) };
}

const SOURCES = loadSources();
const BARE = collectBare(SOURCES);
const ALL = [...checkUses(SOURCES, BARE), ...checkCycles(SOURCES)];

test('the collector finds the shadcn tokens and their aliases', () => {
  for (const name of ['--primary', '--border', '--muted', '--destructive']) {
    assert.ok(BARE.has(name), `${name} should be collected as a bare token; the collector is broken`);
  }
  assert.ok(SOURCES.length > 200, `expected to scan the whole src tree, scanned ${SOURCES.length} files`);
  assert.ok(
    SOURCES.find((s) => s.file === 'styles/parts/docs.css')!.docs.length > 20,
    'the docs.css docs-scope rules should be found; the rule splitter is broken');
});

test('a bare HSL token is only read inside hsl() or as a whole custom property value (Rules 1 and 2)', () => {
  const { open } = applyAllowed(ALL.filter((v) => !v.why.includes('cycle')));
  assert.equal(open.length, 0, `\n${report(open)}\n`);
});

test('no custom property reads its own name (Rule 3)', () => {
  const { open } = applyAllowed(ALL.filter((v) => v.why.includes('cycle')));
  assert.equal(open.length, 0, `\n${report(open)}\n`);
});

test('every ALLOWED entry still matches a violation', () => {
  const { stale } = applyAllowed(ALL);
  assert.equal(
    stale.length, 0,
    `stale ALLOWED entries (the code they excused is gone, delete them):\n${stale.map((a) => `${a.file}: ${a.line}`).join('\n')}`);
});
