#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Engine purity guard — the no-DOM/no-storage/no-network rule, mechanically.
 *
 * Run as: node scripts/check-engine-purity.ts        (exit 1 on any violation)
 *         node scripts/check-engine-purity.ts --json (machine-readable report)
 *
 * CLAUDE.md's core architectural claim is that engine/ "knows NOTHING about
 * brands, the DOM, storage, or networking" — everything platform-specific is
 * injected by a shell through the capability bridge. That holds 100% as of this
 * script landing, but nothing enforced it: engine/tsconfig.json keeps "DOM" in
 * `lib` for the fetch-spec globals (Blob, Response, RequestInit, URL) that
 * browsers and Node share, and its own comment conceded the rule was "enforced
 * in review, not by the compiler". This is the missing half of that gap: a
 * dependency-free scan (node:fs/node:path only, no TypeScript API) over
 * engine/src/**\/*.ts that fails on
 *
 *   - DOM/host globals:  document.  window.  navigator.  OffscreenCanvas
 *                        HTMLElement
 *   - browser storage:   localStorage  sessionStorage
 *   - direct network:    a bare top-level `fetch(` call (host.net.fetch is the
 *                        allowlisted path, and `.fetch(` on any object is fine)
 *   - any `node:` builtin import — the engine must run unchanged in a browser
 *   - any import that escapes engine/src other than the known-legal ones below
 *
 * NO FALSE POSITIVES, or the guard gets deleted the first time it cries wolf.
 * Every one of those identifiers occurs as PROSE somewhere in the engine today
 * — "the cert validity window" (c2pa-verify), "period-wide window"
 * (audio-analyse), "one SVG document" (pdf-svg), "the profile/localStorage/
 * browser-default chain" (url-mode), "browser navigator.language values"
 * (lang.ts) — and the `ContentType=".../presentation.main+xml"` strings in
 * pptx.ts contain `document.` inside a template literal. A sweep of the tree
 * found ~23 such comment/string-only hits. So the scanner runs a small lexer
 * first (`stripNonCode`) that blanks line comments, block comments, single- and
 * double-quoted strings, template literals (recursing into `${...}`
 * substitutions, which ARE code) and regex literals, replacing them with spaces
 * so byte offsets — and therefore reported line/column numbers — stay exact.
 *
 * The navigator.language reference the DOM rule might have needed an exception
 * for was checked by hand: engine/src/lang.ts is a COMMENT explaining where
 * `?lang=` values come from, not a read of the global. There is no code-level
 * navigator use anywhere in the engine, so this script grants no navigator
 * exception at all — if one is ever genuinely needed, add it to
 * ALLOWED_GLOBAL_USES with the reason rather than loosening the rule.
 *
 * KNOWN-LEGAL import escapes (verified by reading the imports, not assumed):
 *   engine/src/geom/path.ts      → type-only `../svg-path.ts` (inside engine/src)
 *   engine/src/validate.ts       → the three JSON schemas in ../../schemas/
 *   engine/src/template.ts       → handlebars             (engine/package.json dep)
 *   engine/src/validate.ts       → ajv/dist/2020.js       (engine/package.json dep)
 *   engine/src/bridge/host-v1.ts → @lolly-tools/core/host-v1 (the SDK contract)
 *   engine/src/loader.ts         → @lolly-tools/core (type-only manifest/render specs)
 *
 * SELF-TEST. Positional path arguments override the scan root, so the matcher
 * can be pointed at a fixture outside engine/src to prove it is not passing
 * vacuously:
 *   node scripts/check-engine-purity.ts /tmp/violation.ts
 * tests/engine-purity.test.ts does that against the exported `scanSource()`,
 * including the comment/string prose cases above.
 *
 * What this does NOT prove: it is a lexical scan, not a type-aware one. An
 * aliased global (`const g = globalThis as any; g.document`) or one reached
 * through a computed member (`g['window']`) is out of reach, and it says nothing
 * about what a SHELL injects through the bridge. It closes the accidental-drift
 * case — someone reaching for `document.createElement` while editing an engine
 * module — which is the case that actually happens.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE_SRC = join(ROOT, 'engine/src');

/** Bare (non-relative) module specifiers engine/src may import. */
const ALLOWED_PACKAGES = new Set([
  'handlebars',                 // engine/src/template.ts — engine/package.json dep
  'ajv/dist/2020.js',           // engine/src/validate.ts — engine/package.json dep
  '@lolly-tools/core/host-v1',  // engine/src/bridge/host-v1.ts — the SDK contract
  '@lolly-tools/core',          // engine/src/loader.ts — type-only manifest/render specs
]);

/** Relative imports that leave engine/src and are nonetheless legal, repo-relative. */
const ALLOWED_ESCAPES = new Set([
  'schemas/tool.schema.json',
  'schemas/asset.schema.json',
  'schemas/asset-ref.schema.json',
]);

/**
 * Deliberate, reviewed exceptions to the global rules, as `<repo-relative
 * file>:<token>`. Empty on purpose — the engine needs none today. Anything added
 * here wants a comment saying why the capability bridge could not carry it.
 */
const ALLOWED_GLOBAL_USES = new Set<string>();

interface Rule {
  /** Token name as reported. */
  token: string;
  /** Matched against code with comments/strings/regexes blanked out. */
  re: RegExp;
  why: string;
}

// Each pattern tolerates an optional `globalThis.` prefix so the obvious dodge is
// caught too, and a match preceded by `.` or an identifier char is discarded (see
// `precededOk`) so `opts.window.width` and `res.fetch(...)` stay clean.
const GLOBAL_PREFIX = '(?:globalThis\\s*\\.\\s*)?';
const RULES: Rule[] = [
  { token: 'document.', re: new RegExp(`${GLOBAL_PREFIX}document\\s*\\.`, 'g'), why: 'the DOM belongs to a shell — go through the host bridge' },
  { token: 'window.', re: new RegExp(`${GLOBAL_PREFIX}window\\s*\\.`, 'g'), why: 'the DOM belongs to a shell — go through the host bridge' },
  { token: 'navigator.', re: new RegExp(`${GLOBAL_PREFIX}navigator\\s*\\.`, 'g'), why: 'a browser-only global — the shell passes in what the engine needs' },
  { token: 'localStorage', re: new RegExp(`${GLOBAL_PREFIX}localStorage\\b`, 'g'), why: 'state goes through host.state, never localStorage' },
  { token: 'sessionStorage', re: new RegExp(`${GLOBAL_PREFIX}sessionStorage\\b`, 'g'), why: 'state goes through host.state, never sessionStorage' },
  { token: 'OffscreenCanvas', re: new RegExp(`${GLOBAL_PREFIX}OffscreenCanvas\\b`, 'g'), why: 'rasterisation is a shell capability (host.export.render)' },
  { token: 'HTMLElement', re: new RegExp(`${GLOBAL_PREFIX}HTMLElement\\b`, 'g'), why: 'the engine must not name DOM types — keep signatures renderer-agnostic' },
  { token: 'fetch(', re: /fetch\s*\(/g, why: 'network access is host.net (allowlisted, fail-closed)' },
];

export interface Violation {
  /** Repo-relative path (or whatever `file` the caller passed to scanSource). */
  file: string;
  line: number;
  column: number;
  token: string;
  why: string;
  /** The source line, trimmed — context for the console report. */
  text: string;
}

// ─── lexer: blank comments, strings, template literals and regexes ────────────

/**
 * Replace every non-code region of `src` with spaces, preserving length and all
 * newlines so offsets (and therefore line/column) still map onto the original.
 * `${...}` substitutions inside template literals are KEPT — they are code.
 */
export function stripNonCode(src: string): string {
  const out = src.split('');
  const n = src.length;
  // Blank a half-open range, keeping newlines so line numbers survive.
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  // Template-literal nesting. -1 = inside the literal's text; any other value is
  // the brace depth at which a `${` substitution started, so the matching `}`
  // returns us to literal text.
  const tmpl: number[] = [];
  let braceDepth = 0;
  let prevSig = '';   // last significant CODE character
  let prevWord = '';  // last identifier/keyword, for regex-vs-divide
  let i = 0;

  while (i < n) {
    const ch = src[i]!;
    const next = src[i + 1];

    if (tmpl.length > 0 && tmpl[tmpl.length - 1] === -1) {
      // Inside template-literal text.
      if (ch === '\\') { blank(i, i + 2); i += 2; continue; }
      if (ch === '`') { tmpl.pop(); prevSig = '`'; prevWord = ''; i++; continue; }
      if (ch === '$' && next === '{') {
        tmpl[tmpl.length - 1] = braceDepth;
        braceDepth++;
        blank(i, i + 2);
        i += 2;
        prevSig = '';
        prevWord = '';
        continue;
      }
      blank(i, i + 1);
      i++;
      continue;
    }

    // ── code mode ──
    if (ch === '/' && next === '/') {
      let j = i;
      while (j < n && src[j] !== '\n') j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === ch || src[j] === '\n') break;
        j++;
      }
      // Blank the CONTENTS only — the quote characters stay, so
      // `moduleSpecifiers` can still find import specifiers in the blanked code
      // (and so an unterminated quote can't swallow the rest of the file).
      const end = Math.min(j + 1, n);
      blank(i + 1, end - 1);
      i = end;
      prevSig = ch;
      prevWord = '';
      continue;
    }
    if (ch === '`') {
      tmpl.push(-1);
      blank(i, i + 1);
      i++;
      continue;
    }
    if (ch === '/' && canStartRegex(prevSig, prevWord)) {
      // Regex literal: consume to the unescaped closing '/', respecting [...].
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const c = src[j]!;
        if (c === '\\') { j += 2; continue; }
        if (c === '\n') break; // unterminated — it was a division after all
        if (inClass) { if (c === ']') inClass = false; }
        else if (c === '[') inClass = true;
        else if (c === '/') { closed = true; break; }
        j++;
      }
      if (closed) {
        let k = j + 1;
        while (k < n && /[a-z]/.test(src[k]!)) k++; // flags
        blank(i, k);
        i = k;
        prevSig = '/';
        prevWord = '';
        continue;
      }
      // else: fall through and treat '/' as an operator
    }
    if (ch === '{') braceDepth++;
    else if (ch === '}') {
      braceDepth--;
      if (tmpl.length > 0 && tmpl[tmpl.length - 1] === braceDepth) {
        // Closing a `${...}` substitution — back to literal text.
        tmpl[tmpl.length - 1] = -1;
        blank(i, i + 1);
        i++;
        prevSig = '';
        prevWord = '';
        continue;
      }
    }
    if (/[A-Za-z0-9_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++;
      prevWord = src.slice(i, j);
      prevSig = src[j - 1]!;
      i = j;
      continue;
    }
    if (!/\s/.test(ch)) { prevSig = ch; prevWord = ''; }
    i++;
  }
  return out.join('');
}

/** Keywords after which a `/` opens a regex literal rather than dividing. */
const REGEX_PRECEDING_WORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await',
]);

function canStartRegex(prevSig: string, prevWord: string): boolean {
  if (prevWord) return REGEX_PRECEDING_WORDS.has(prevWord);
  if (prevSig === '') return true;
  return '(,=:[!&|?{};+-*%~^<>'.includes(prevSig);
}

// ─── matching ────────────────────────────────────────────────────────────────

/**
 * A match is only the GLOBAL if it is not part of a longer identifier
 * (`myWindow.x`, `refetch(`) and not a member access (`opts.window.width`,
 * `res?.fetch(`). `new OffscreenCanvas` and `return fetch(` must still match, so
 * a preceding keyword — identifier chars with whitespace in between — is fine.
 */
function precededOk(code: string, at: number): boolean {
  if (at > 0 && /[A-Za-z0-9_$]/.test(code[at - 1]!)) return false;
  let k = at - 1;
  while (k >= 0 && /\s/.test(code[k]!)) k--;
  return k < 0 || code[k] !== '.';
}

/** Line/column (both 1-based) of a byte offset. */
function positionOf(src: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lastNl = -1;
  for (let k = 0; k < offset; k++) if (src[k] === '\n') { line++; lastNl = k; }
  return { line, column: offset - lastNl };
}

/**
 * Every module specifier in `src`. Keyword+quote positions are found in the
 * BLANKED code (so an import mentioned in a comment is invisible), then the
 * specifier text is read back out of the raw source at that offset.
 */
function moduleSpecifiers(src: string, code: string): { spec: string; offset: number }[] {
  const re = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])/g;
  const out: { spec: string; offset: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const start = m.index + m[0].length;
    const end = src.indexOf(m[1]!, start);
    if (end === -1) continue;
    out.push({ spec: src.slice(start, end), offset: m.index });
  }
  return out;
}

/** null if the specifier is legal for an engine/src module, else the reason. */
function importViolation(file: string, spec: string): string | null {
  if (spec === '') return null;
  if (spec.startsWith('node:')) {
    return 'the engine must run unchanged in a browser — no node: builtins';
  }
  if (!spec.startsWith('.')) {
    return ALLOWED_PACKAGES.has(spec)
      ? null
      : 'unlisted package import — an engine dep must be platform-agnostic and listed in ALLOWED_PACKAGES';
  }
  const abs = resolve(ROOT, dirname(file), spec);
  const inside = relative(ENGINE_SRC, abs);
  if (!inside.startsWith('..') && !inside.startsWith(sep)) return null;
  const repoRel = relative(ROOT, abs).split(sep).join('/');
  return ALLOWED_ESCAPES.has(repoRel)
    ? null
    : `import escapes engine/src (${repoRel}) — the engine may not depend on shells, tools or brands`;
}

/**
 * Scan one module's source. `file` is used for reporting and for resolving
 * relative imports (repo-relative, POSIX separators), so callers can scan
 * fixtures from anywhere.
 */
export function scanSource(file: string, src: string): Violation[] {
  const code = stripNonCode(src);
  const lines = src.split('\n');
  const found: Violation[] = [];
  const push = (offset: number, token: string, why: string): void => {
    if (ALLOWED_GLOBAL_USES.has(`${file}:${token}`)) return;
    const { line, column } = positionOf(src, offset);
    found.push({ file, line, column, token, why, text: (lines[line - 1] ?? '').trim() });
  };

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(code)) !== null) {
      if (precededOk(code, m.index)) push(m.index, rule.token, rule.why);
    }
  }
  for (const { spec, offset } of moduleSpecifiers(src, code)) {
    const bad = importViolation(file, spec);
    if (bad) push(offset, spec, bad);
  }
  return found.sort((a, b) => a.line - b.line || a.column - b.column);
}

// ─── driver ──────────────────────────────────────────────────────────────────

/** Every .ts module under `dir`, recursively, excluding co-located tests. */
function modules(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) modules(p, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/**
 * Scan a file from disk, reporting its path repo-relative — or absolute when it
 * sits outside the repo (a self-test fixture), where `../../..` would be noise.
 */
export function scanFile(absPath: string): Violation[] {
  const rel = relative(ROOT, absPath).split(sep).join('/');
  const label = rel.startsWith('..') ? absPath : rel;
  return scanSource(label, readFileSync(absPath, 'utf8'));
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const roots = args.filter(a => !a.startsWith('-')).map(a => resolve(process.cwd(), a));
  const targets = (roots.length > 0 ? roots : [ENGINE_SRC])
    .flatMap(p => (statSync(p).isDirectory() ? modules(p) : [p]));

  const violations = targets.flatMap(scanFile);

  if (json) {
    console.log(JSON.stringify({ scanned: targets.length, violations }, null, 2));
  } else if (violations.length === 0) {
    console.log(`check-engine-purity: OK - ${targets.length} modules scanned, no DOM/storage/network use and no import escapes.`);
  } else {
    console.error(`check-engine-purity: ${violations.length} violation(s) across ${targets.length} scanned module(s).\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}:${v.column}  ${v.token}  - ${v.why}`);
      console.error(`      ${v.text}`);
    }
    console.error('\nThe engine is platform-agnostic by contract (CLAUDE.md): DOM, storage and');
    console.error('network access belong to a shell and reach the engine through the host bridge.');
  }
  if (violations.length > 0) process.exit(1);
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
