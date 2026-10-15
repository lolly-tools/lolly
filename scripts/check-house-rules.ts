// SPDX-License-Identifier: MPL-2.0
/**
 * A ratcheting check for the web shell's own CSS house rules.
 *
 * This reads the shell's chrome stylesheets: every .css under shells/web/src
 * (vendor/ excepted), the two <style> blocks in shells/web/index.html and the
 * CSS literals in docs/build.ts that /info ships. It does not check a brand's
 * Design documents; engine/src/design-house-rules.ts does that, against the
 * rules a brand writes for its own artwork. Tool styles (community/, brands/)
 * are out of scope too: a tool's canvas is the user's creative output.
 *
 *   H1  no single-edge border or inset rail on an element with a radius
 *   H2  dashed only for drop areas
 *   H4  durations from the motion tokens (--dur-*, --ui-motion-*)
 *   H5  anything that moves honours both Reduce motion switches
 *   H6  no custom property that nothing defines
 *
 * The numbers are fixed ids that the baseline and review notes refer to, so the
 * gap after H2 is deliberate and nothing is renumbered.
 *
 * scripts/lib/house-rules-why.ts explains each rule in plain words. Today's debt
 * is recorded per file and rule in scripts/house-rules-baseline.json, and a count
 * may only go down, the same three-way ratchet as check-code-comment-vernacular.ts:
 * a rise fails, a new file or rule with findings fails and a fall fails until
 * recorded. Reviewed exceptions (real drop areas and a few shapes the corner
 * logic misreads) live in scripts/data/house-rules-allow.json, matched on file,
 * rule and selector so edits elsewhere in a sheet never break an entry.
 *
 *   node scripts/check-house-rules.ts            check (exit 1 on drift)
 *   node scripts/check-house-rules.ts --write    record a reviewed fall (refuses a rise)
 *   node scripts/check-house-rules.ts --list [--rule=H2] [--file=<path>]
 *
 * Plain string work only: the pre-push hook runs this, so it has to stay quick.
 */
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printHouseRulesWhy } from './lib/house-rules-why.ts';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const BASELINE_PATH = join(ROOT, 'scripts/house-rules-baseline.json');
export const ALLOW_PATH = join(ROOT, 'scripts/data/house-rules-allow.json');

export type RuleId = 'H1' | 'H2' | 'H4' | 'H5' | 'H6';

export const RULES: ReadonlyArray<{ id: RuleId; title: string; reason: string }> = [
  { id: 'H1', title: 'Single-edge rail on a rounded element', reason: 'A stripe on one edge of a rounded box breaks where it meets the curve.' },
  { id: 'H2', title: 'Dashed outside a drop area', reason: 'Dashed means "drop here" and nothing else.' },
  { id: 'H4', title: 'Duration not from a motion token', reason: 'Durations come from --dur-*, --ui-motion-* or --ease-*.' },
  { id: 'H5', title: 'Motion without both Reduce motion rules', reason: 'Anything that moves honours prefers-reduced-motion and data-a11y-motion.' },
  { id: 'H6', title: 'Custom property defined nowhere', reason: 'A var() with no definition and no fallback resolves to nothing.' },
];

export interface Finding {
  file: string;
  line: number;
  rule: RuleId;
  selector: string;
  detail: string;
}

// ─── CSS parsing ──────────────────────────────────────────────────────────────

export interface Decl { prop: string; value: string; line: number }

export interface CssRule {
  /** Selector list, whitespace collapsed; for an at-rule body, the at-rule prelude. */
  selector: string;
  selectors: string[];
  line: number;
  decls: Decl[];
  /** Enclosing at-rule preludes, outermost first. */
  at: string[];
  keyframes: boolean;
  /** Declarations sitting directly inside an at-rule (@font-face, @property). */
  atBody: boolean;
  /** Source order within one parse, for the cascade guess in H1. */
  index: number;
}

/** Collapse runs of whitespace so a selector compares the same however it wraps. */
export function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Replace every comment with spaces, keeping newlines so line numbers survive.
 *  Strings are copied untouched, so a "/*" inside content: "" stays text. */
export function stripComments(text: string): string {
  return text.replace(/"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|\/\*[\s\S]*?(?:\*\/|$)/g,
    (m) => (m.startsWith('/*') ? m.replace(/[^\n]/g, ' ') : m));
}

/** Split on a separator at bracket depth zero. ' ' splits on any whitespace. */
export function splitTop(s: string, sep: ',' | '/' | ' '): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  let quote = '';
  for (const c of s) {
    if (quote) { cur += c; if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    const hit = depth === 0 && (sep === ' ' ? /\s/.test(c) : c === sep);
    if (hit) { parts.push(cur); cur = ''; } else cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Resolve a nested selector against its parent list (CSS nesting, rare here). */
function nestSelectors(parents: string[] | null, own: string[]): string[] {
  if (!parents) return own;
  const parent = parents.length === 1 ? parents[0]! : `:is(${parents.join(', ')})`;
  return own.map((s) => (s.includes('&') ? s.replaceAll('&', parent) : `${parent} ${s}`));
}

/** Parse CSS into leaf rules with their declarations, lines and at-rule context. */
export function parseCss(source: string, lineOffset = 0): CssRule[] {
  const text = stripComments(source);
  const rules: CssRule[] = [];
  const n = text.length;
  let pos = 0;
  let line = 1 + lineOffset;

  const walk = (at: string[], keyframes: boolean, parents: string[] | null, owner: CssRule | null, atPrelude: string | null): void => {
    let start = pos;
    let bufLine = line;
    let started = false;
    let paren = 0;
    let atOwner: CssRule | null = null;
    const reset = (): void => { start = pos; started = false; };
    const flushDecl = (): void => {
      const raw = text.slice(start, pos).trim();
      if (!raw) return;
      const colon = raw.indexOf(':');
      if (colon <= 0) return;
      const name = raw.slice(0, colon).trim();
      const decl = { prop: name.startsWith('--') ? name : name.toLowerCase(), value: raw.slice(colon + 1).trim(), line: bufLine };
      if (owner) { owner.decls.push(decl); return; }
      if (atPrelude === null) return;
      if (!atOwner) {
        atOwner = { selector: atPrelude, selectors: [atPrelude], line: bufLine, decls: [], at, keyframes, atBody: true, index: rules.length };
        rules.push(atOwner);
      }
      atOwner.decls.push(decl);
    };
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { line++; pos++; continue; }
      if (!started && c !== 32 && c !== 9 && c !== 13 && c !== 12) { started = true; bufLine = line; }
      if (c === 34 || c === 39) {
        pos++;
        while (pos < n && text.charCodeAt(pos) !== c && text.charCodeAt(pos) !== 10) pos += text.charCodeAt(pos) === 92 ? 2 : 1;
        if (text.charCodeAt(pos) === c) pos++;
        continue;
      }
      if (c === 40) paren++;
      else if (c === 41) paren = Math.max(0, paren - 1);
      else if (c === 123 && paren === 0) {
        const prelude = normalise(text.slice(start, pos));
        const preludeLine = bufLine;
        pos++;
        if (prelude.startsWith('@')) {
          const isKeyframes = /^@(?:-[a-z]+-)?keyframes\b/i.test(prelude);
          const inner = [...at, prelude];
          if (owner && !isKeyframes) {
            // A nested at-rule keeps the owner's selectors but carries its own
            // context, so a nested reduce block is not read as plain motion.
            const nested: CssRule = { selector: owner.selector, selectors: owner.selectors, line: preludeLine, decls: [], at: inner, keyframes, atBody: false, index: rules.length };
            rules.push(nested);
            walk(inner, keyframes, parents, nested, prelude);
          } else {
            walk(inner, keyframes || isKeyframes, parents, null, prelude);
          }
        } else {
          const selectors = nestSelectors(parents, splitTop(prelude, ',').map(normalise));
          const rule: CssRule = { selector: selectors.join(', '), selectors, line: preludeLine, decls: [], at, keyframes, atBody: false, index: rules.length };
          rules.push(rule);
          walk(at, keyframes, selectors, rule, null);
        }
        reset();
        continue;
      } else if (c === 59 && paren === 0) { flushDecl(); pos++; reset(); continue; }
      else if (c === 125 && paren === 0) { flushDecl(); pos++; return; }
      pos++;
    }
    flushDecl();
  };
  while (pos < n) walk([], false, null, null, null);
  return rules;
}

// ─── Embedded CSS ─────────────────────────────────────────────────────────────

/** The text of a template literal that opens at `start` (just after the backtick),
 *  with every line holding a ${...} interpolation blanked. Those interpolations
 *  pull in real sheets, which are scanned where they live. */
function templateBody(src: string, start: number): string {
  let i = start;
  while (i < src.length && src[i] !== '`') i += src[i] === '\\' ? 2 : 1;
  return src.slice(start, i).split('\n').map((l) => (l.includes('${') ? '' : l)).join('\n');
}

const lineAt = (src: string, index: number): number => src.slice(0, index).split('\n').length;

/** The CSS that docs/build.ts writes into every /info page: the CSS and EDITION_CSS
 *  literals and the <style> inside NOSCRIPT_NAV. lineOffset + local line = host line. */
export function extractDocsCss(buildTs: string): Array<{ text: string; lineOffset: number }> {
  const out: Array<{ text: string; lineOffset: number }> = [];
  for (const name of ['CSS', 'EDITION_CSS']) {
    const m = new RegExp(`^const ${name} = \``, 'm').exec(buildTs);
    if (!m) continue;
    const start = m.index + m[0].length;
    out.push({ text: templateBody(buildTs, start), lineOffset: lineAt(buildTs, start) - 1 });
  }
  const nav = /^const NOSCRIPT_NAV = `/m.exec(buildTs);
  if (nav) {
    const start = nav.index + nav[0].length;
    const body = templateBody(buildTs, start);
    const style = /<style\b[^>]*>([\s\S]*?)<\/style>/i.exec(body);
    if (style) {
      const at = start + style.index + style[0].indexOf('>') + 1;
      out.push({ text: style[1]!, lineOffset: lineAt(buildTs, at) - 1 });
    }
  }
  return out;
}

/** Every <style> block in an HTML file, with HTML comments skipped first so a
 *  comment that mentions <style> never opens a block. */
export function extractHtmlCss(html: string): Array<{ text: string; lineOffset: number }> {
  const clean = html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const out: Array<{ text: string; lineOffset: number }> = [];
  for (const m of clean.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const at = m.index + m[0].indexOf('>') + 1;
    out.push({ text: m[1]!, lineOffset: lineAt(clean, at) - 1 });
  }
  return out;
}

/** Shell sheets that docs/build.ts reads into /info. They get no credit from the
 *  base.css reduce-motion catch-all, because /info never loads base.css. */
export function infoBundledSheets(buildTs: string): string[] {
  const out = new Set<string>();
  for (const m of buildTs.matchAll(/readFileSync\(\s*resolve\(\s*repoRoot\s*,\s*'(shells\/web\/src\/[^']+\.css)'/g)) out.add(m[1]!);
  return [...out].sort();
}

// ─── Values ───────────────────────────────────────────────────────────────────

const stripImportant = (v: string): string => v.replace(/!\s*important\s*$/i, '').trim();

/** A length that draws nothing: 0 in any unit. `none` counts as square too. */
export function isZeroLength(v: string): boolean {
  return /^(?:[+-]?(?:0+\.?0*|\.0+)(?:[a-z%]+)?|none)$/i.test(v.trim());
}

type Corner = 'tl' | 'tr' | 'br' | 'bl';
type Corners = Partial<Record<Corner, boolean>>;
type Edge = 'left' | 'right' | 'top' | 'bottom';

const EDGE_CORNERS: Record<Edge, [Corner, Corner]> = { left: ['tl', 'bl'], right: ['tr', 'br'], top: ['tl', 'tr'], bottom: ['bl', 'br'] };
// Logical edges and corners map to physical ones in a left-to-right writing mode.
const LOGICAL_EDGE: Record<string, Edge> = { left: 'left', right: 'right', top: 'top', bottom: 'bottom', 'inline-start': 'left', 'inline-end': 'right', 'block-start': 'top', 'block-end': 'bottom' };
const PHYSICAL_CORNER: Record<string, Corner> = { 'top-left': 'tl', 'top-right': 'tr', 'bottom-right': 'br', 'bottom-left': 'bl', 'start-start': 'tl', 'start-end': 'tr', 'end-end': 'br', 'end-start': 'bl' };

/** Which corners a rule rounds, from its own border-radius shorthand and longhands.
 *  An unknown value (a var(), inherit) counts as rounded. */
export function radiusCorners(decls: Decl[]): Corners {
  const out: Corners = {};
  for (const d of decls) {
    const v = stripImportant(d.value);
    if (d.prop === 'border-radius') {
      const horizontal = splitTop(v, '/')[0] ?? v;
      const parts = splitTop(horizontal, ' ');
      if (parts.length === 0) continue;
      const [a, b = a, c = a, e = b] = parts as [string, string?, string?, string?];
      out.tl = !isZeroLength(a); out.tr = !isZeroLength(b!); out.br = !isZeroLength(c!); out.bl = !isZeroLength(e!);
      continue;
    }
    const m = /^border-((?:top|bottom)-(?:left|right)|(?:start|end)-(?:start|end))-radius$/.exec(d.prop);
    if (m) out[PHYSICAL_CORNER[m[1]!]!] = !isZeroLength(splitTop(v, ' ')[0] ?? v);
  }
  return out;
}

/** The selector with trailing state qualifiers removed: `.is-*`/`.has-*` classes,
 *  attribute selectors and pseudo-classes. `.be-face.is-set` gives `.be-face`. */
export function baseSelector(sel: string): string {
  const qualifier = /(?:\.(?:is|has)-[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?)$/;
  let s = sel.trim();
  for (;;) {
    const next = s.replace(qualifier, '');
    if (next === s || !next || /[\s>+~]$/.test(next)) break;
    s = next;
  }
  return s;
}

const EDGE_PROP = /^border-(left|right|top|bottom|inline-start|inline-end|block-start|block-end)(-width)?$/;
const LENGTH = /^[+-]?(?:\d*\.?\d+)(?:[a-z%]+)?$/i;

/** A border value that draws nothing on screen. */
function inertBorder(value: string, widthOnly: boolean): boolean {
  const v = stripImportant(value).toLowerCase();
  if (/^(?:inherit|initial|unset|revert|revert-layer)$/.test(v)) return true;
  if (widthOnly) return isZeroLength(v);
  const tokens = splitTop(v, ' ');
  return tokens.some((t) => t === 'none' || t === 'hidden' || t === 'transparent' || (LENGTH.test(t) && isZeroLength(t)));
}

/** The edge an inset shadow paints as a one-sided stripe, or null. A shadow with
 *  blur or with two offsets (or none) is not a rail. Nor is the 1px top/bottom
 *  bevel. */
export function insetRailEdge(part: string): Edge | null {
  const tokens = splitTop(part, ' ');
  if (!tokens.some((t) => t.toLowerCase() === 'inset')) return null;
  const lengths = tokens.filter((t) => LENGTH.test(t) || /^calc\(/i.test(t));
  if (lengths.length < 2) return null;
  const [x, y, blur = '0'] = lengths as [string, string, string?];
  const zx = isZeroLength(x);
  const zy = isZeroLength(y);
  if (zx === zy || !isZeroLength(blur!)) return null;
  if (zx && /^[+-]?1px$/i.test(y)) return null;
  if (!zx) return x.startsWith('-') ? 'right' : 'left';
  return y.startsWith('-') ? 'bottom' : 'top';
}

// ─── Motion ───────────────────────────────────────────────────────────────────

const REDUCE_ATTR = /\[data-a11y-motion=["']?reduce["']?\]/;
const NOT_GROUP = /:not\((?:[^()]|\([^()]*\))*\)/g;

const inOsReduce = (r: CssRule): boolean => r.at.some((a) => /prefers-reduced-motion\s*:\s*reduce/i.test(a));
const inNoPreference = (r: CssRule): boolean => r.at.some((a) => /prefers-reduced-motion\s*:\s*no-preference/i.test(a));
const isAppReduce = (sel: string): boolean => REDUCE_ATTR.test(sel.replace(NOT_GROUP, ''));
const isAppNotReduce = (sel: string): boolean => /:not\(\s*\[data-a11y-motion=["']?reduce["']?\]\s*\)/.test(sel);

/** The key that pairs a moving rule with its reduce rules: the last class that
 *  is not a state qualifier, after the html[data-a11y-motion] prefix and any
 *  :not() groups are dropped. Falls back to the last class, then the selector. */
export function motionKey(sel: string): string {
  const s = sel.replace(/html\[data-a11y-motion=["']?reduce["']?\]\s*/g, '').replace(NOT_GROUP, '');
  const classes = [...s.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!);
  const plain = classes.filter((c) => !/^(?:is|has)-/.test(c));
  return plain.at(-1) ?? classes.at(-1) ?? normalise(s);
}

export interface MotionKeys { os: Set<string>; app: Set<string> }

/** Gather the keys of every reduce rule in a set of parsed sheets. */
export function collectMotionKeys(rules: Iterable<CssRule>): MotionKeys {
  const keys: MotionKeys = { os: new Set(), app: new Set() };
  for (const r of rules) {
    if (r.keyframes || r.atBody) continue;
    const os = inOsReduce(r);
    for (const sel of r.selectors) {
      if (os) keys.os.add(motionKey(sel));
      if (isAppReduce(sel)) keys.app.add(motionKey(sel));
    }
  }
  return keys;
}

const MOVING = /^(?:all|transform|translate|rotate|scale|inset(?:-[\w-]+)?|top|left|right|bottom|margin(?:-[\w-]+)?|(?:min-|max-)?(?:width|height)|(?:min-|max-)?(?:inline|block)-size|grid-template(?:-[\w-]+)?)$/;
const TIMING_WORD = /^(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|allow-discrete|normal|infinite|alternate|alternate-reverse|reverse|forwards|backwards|both|none|running|paused)$/i;
const TIME = /^[+-]?\d*\.?\d+m?s$/i;
const MOTION_VAR = /^var\(\s*--(?:dur-|ui-motion-|ease-)/;

/** The moving properties a transition declaration animates. A part with no
 *  property name transitions `all`; a part that is only a var() is unknown. */
export function movingTransitions(prop: string, value: string): string[] {
  const v = stripImportant(value);
  if (/^none$/i.test(v)) return [];
  const names: string[] = [];
  if (prop === 'transition-property') names.push(...splitTop(v, ',').map((s) => s.toLowerCase()));
  else {
    for (const part of splitTop(v, ',')) {
      const tokens = splitTop(part, ' ');
      const name = tokens.find((t) => !TIME.test(t) && !TIMING_WORD.test(t) && !/^[\w-]+\(/.test(t) && !/^\d/.test(t));
      if (name) names.push(name.toLowerCase());
      // No property name: the part moves `all`, unless a var() other than a
      // motion token could be standing in for the name.
      else if (tokens.every((t) => !/^var\(/i.test(t) || MOTION_VAR.test(t))) names.push('all');
    }
  }
  return names.filter((nm) => MOVING.test(nm));
}

const TIMING_PROP = /^(?:transition|transition-duration|transition-delay|animation|animation-duration|animation-delay)$/;
const MOTION_TOKEN = /^--(?:dur-|ui-motion-|ease-)/;

/** Literal durations in a timing declaration, plus var()s whose own definition
 *  in the same sheet is a literal. `localDefs` maps a custom property to its values. */
export function literalDurations(value: string, localDefs: Map<string, string[]>): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(/var\(\s*(--[\w-]+)[^)]*\)/g)) {
    const name = m[1]!;
    if (MOTION_TOKEN.test(name)) continue;
    for (const def of localDefs.get(name) ?? []) {
      if (literalDurations(def, new Map()).length) { out.push(`var(${name})`); break; }
    }
  }
  const bare = value.replace(/var\((?:[^()]|\([^()]*\))*\)/g, ' ');
  for (const m of bare.matchAll(/(?<![\w.#-])([+-]?\d*\.?\d+)(ms|s)(?![\w-])/gi)) {
    if (Number(m[1]) === 0) continue;
    out.push(m[0]);
  }
  return out;
}

// ─── Definitions (H6) ─────────────────────────────────────────────────────────

export interface Definitions { names: Set<string>; prefixes: string[] }

/** Every custom property name a source defines: `--x:` in CSS or a string,
 *  setProperty('--x', @property --x, a quoted '--x', and a template prefix
 *  `--x-${` that defines every name starting with --x-. */
export function collectDefinitions(sources: Iterable<string>): Definitions {
  const names = new Set<string>();
  const prefixes = new Set<string>();
  const re = /(--[A-Za-z_][\w-]*)\s*:|['"`](--[A-Za-z_][\w-]*)['"`]|@property\s+(--[\w-]+)|(--[A-Za-z_][\w-]*-)\$\{/g;
  for (const src of sources) {
    if (!src.includes('--')) continue;
    for (const m of src.matchAll(re)) {
      if (m[4]) prefixes.add(m[4]);
      else names.add((m[1] ?? m[2] ?? m[3])!);
    }
  }
  return { names, prefixes: [...prefixes] };
}

const isDefined = (name: string, defs: Definitions): boolean =>
  defs.names.has(name) || defs.prefixes.some((p) => name.startsWith(p));

// ─── The scan ─────────────────────────────────────────────────────────────────

export interface ScanContext {
  /** Defined custom properties. Without them H6 is skipped. */
  definitions?: Definitions;
  /** True while base.css still zeroes every animation under both switches. */
  catchAll?: boolean;
  /** A sheet /info bundles: no credit from the base.css catch-all. */
  info?: boolean;
  /** Reduce-rule keys across the pool this sheet ships in; defaults to its own. */
  motionKeys?: MotionKeys;
  lineOffset?: number;
  /** Pre-parsed rules, when the caller already has them. */
  rules?: CssRule[];
}

/** Check one stylesheet (or one embedded block) against every rule in RULES. */
export function scanCss(text: string, file: string, ctx: ScanContext = {}): Finding[] {
  const rules = ctx.rules ?? parseCss(text, ctx.lineOffset ?? 0);
  const keys = ctx.motionKeys ?? collectMotionKeys(rules);
  const catchAll = ctx.catchAll ?? true;
  const findings: Finding[] = [];
  const add = (rule: CssRule, line: number, id: RuleId, detail: string): void => {
    findings.push({ file, line, rule: id, selector: rule.selector, detail: normalise(detail).slice(0, 160) });
  };

  // Index for the H1 radius lookup and the H4 local definitions.
  const bySelector = new Map<string, CssRule[]>();
  const localDefs = new Map<string, string[]>();
  for (const r of rules) {
    for (const s of r.selectors) {
      const list = bySelector.get(s) ?? [];
      list.push(r);
      bySelector.set(s, list);
    }
    for (const d of r.decls) {
      if (!d.prop.startsWith('--')) continue;
      const list = localDefs.get(d.prop) ?? [];
      list.push(d.value);
      localDefs.set(d.prop, list);
    }
  }
  const cornersFor = (rule: CssRule, sel: string): Corners => {
    const base = baseSelector(sel);
    const related = [...new Set([...(bySelector.get(sel) ?? []), ...(bySelector.get(base) ?? [])])]
      .filter((r) => r !== rule && !r.keyframes)
      .sort((a, b) => a.index - b.index);
    const before = related.filter((r) => r.index < rule.index);
    const chain = before.length ? before : related;
    const merged: Corners = {};
    for (const r of chain) Object.assign(merged, radiusCorners(r.decls));
    return Object.assign(merged, radiusCorners(rule.decls));
  };
  const rounded = (rule: CssRule, edge: Edge): boolean =>
    rule.selectors.some((sel) => {
      const c = cornersFor(rule, sel);
      return EDGE_CORNERS[edge].some((k) => c[k] === true);
    });

  for (const rule of rules) {
    const reduceRule = inOsReduce(rule) || rule.selectors.some(isAppReduce);
    for (const d of rule.decls) {
      const text = `${d.prop}: ${d.value}`;
      // H6 reads every declaration, keyframes included.
      if (ctx.definitions) {
        for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
          if (!isDefined(m[1]!, ctx.definitions)) add(rule, d.line, 'H6', `var(${m[1]}) is defined nowhere`);
        }
      }
      if (rule.keyframes) continue;
      // The rest read boxes, and an at-rule body (@font-face, @property) has none.
      if (rule.atBody) continue;
      // H1: a one-sided border or inset stripe where a corner on that edge is rounded.
      const edgeProp = EDGE_PROP.exec(d.prop);
      if (edgeProp && !inertBorder(d.value, Boolean(edgeProp[2]))) {
        if (rounded(rule, LOGICAL_EDGE[edgeProp[1]!]!)) add(rule, d.line, 'H1', text);
      }
      if (d.prop === 'box-shadow') {
        for (const part of splitTop(stripImportant(d.value), ',')) {
          const edge = insetRailEdge(part);
          if (edge && rounded(rule, edge)) add(rule, d.line, 'H1', `box-shadow: ${part}`);
        }
      }
      // H2: dashed, outside a declared drop area.
      if (/^(?:border|outline|column-rule|text-decoration)/.test(d.prop) && /(?<![\w-])dashed(?![\w-])/i.test(d.value)) add(rule, d.line, 'H2', text);
      if (reduceRule) continue;
      // H4: literal durations.
      if (TIMING_PROP.test(d.prop)) {
        for (const t of literalDurations(d.value, localDefs)) add(rule, d.line, 'H4', `${d.prop}: ${t}`);
      }
      // H5: motion that needs both Reduce motion switches.
      const isAnimation = (d.prop === 'animation' || d.prop === 'animation-name') && !/^(?:none|inherit|initial|unset)\b/i.test(stripImportant(d.value));
      const moving = d.prop === 'transition' || d.prop === 'transition-property' ? movingTransitions(d.prop, d.value) : [];
      if (!isAnimation && moving.length === 0) continue;
      if (isAnimation && !ctx.info && catchAll) continue;
      const os = inNoPreference(rule) || rule.selectors.every((s) => keys.os.has(motionKey(s)));
      const app = rule.selectors.every((s) => isAppNotReduce(s) || keys.app.has(motionKey(s)));
      if (os && app) continue;
      const missing = !os && !app ? 'both reduce rules' : !os ? 'the prefers-reduced-motion rule' : 'the data-a11y-motion rule';
      const what = isAnimation ? `${d.prop}: ${d.value}` : `${d.prop}: ${moving.join(', ')}`;
      add(rule, d.line, 'H5', `${what} (missing ${missing})`);
    }
  }
  return findings;
}

/** True while base.css still holds both reduce-motion catch-alls that zero every
 *  app animation outside the canvas. */
export function hasCatchAll(baseCss: string): boolean {
  const rules = parseCss(baseCss);
  const zeroes = (r: CssRule): boolean => r.decls.some((d) => d.prop === 'animation-duration' && /0?\.01ms/.test(d.value));
  const os = rules.some((r) => inOsReduce(r) && r.selectors.some((s) => s.startsWith('*:not(')) && zeroes(r));
  const app = rules.some((r) => r.selectors.some((s) => /^html\[data-a11y-motion="reduce"\] :not\(/.test(s)) && zeroes(r));
  return os && app;
}

// ─── Allowlist and baseline ───────────────────────────────────────────────────

export interface AllowEntry { file: string; rule: RuleId; selector: string; reason: string }

/** Split findings into allowed and counted, and report entries that matched
 *  nothing (stale) or carry a reason of 40 characters or fewer. */
export function checkAllow(findings: Finding[], allow: AllowEntry[]): { allowed: Finding[]; counted: Finding[]; stale: AllowEntry[]; badReason: AllowEntry[] } {
  const key = (file: string, rule: string, sel: string): string => `${file}\n${rule}\n${normalise(sel)}`;
  const entries = new Map(allow.map((e) => [key(e.file, e.rule, e.selector), e] as const));
  const used = new Set<AllowEntry>();
  const allowed: Finding[] = [];
  const counted: Finding[] = [];
  for (const f of findings) {
    const e = entries.get(key(f.file, f.rule, f.selector));
    if (e) { allowed.push(f); used.add(e); } else counted.push(f);
  }
  return {
    allowed,
    counted,
    stale: allow.filter((e) => !used.has(e)),
    badReason: allow.filter((e) => typeof e.reason !== 'string' || e.reason.trim().length <= 40),
  };
}

export type Counts = Record<string, Partial<Record<RuleId, number>>>;

/** Count findings per file and rule. */
export function countByFileRule(findings: Finding[]): Counts {
  const out: Counts = {};
  for (const f of findings) {
    const row = out[f.file] ?? {};
    row[f.rule] = (row[f.rule] ?? 0) + 1;
    out[f.file] = row;
  }
  return out;
}

export interface HouseRulesDrift {
  over: Array<{ file: string; rule: RuleId; was: number; now: number }>;
  fresh: Array<{ file: string; rule: RuleId; now: number }>;
  under: Array<{ file: string; rule: RuleId; was: number; now: number }>;
}

/** Compare counts with the baseline, failing all three ways. A baseline file
 *  that is no longer on disk was not scanned and does not read as an improvement. */
export function drift(current: Counts, baseline: Counts, exists: (file: string) => boolean = (f) => existsSync(join(ROOT, f))): HouseRulesDrift {
  const d: HouseRulesDrift = { over: [], fresh: [], under: [] };
  for (const [file, row] of Object.entries(current)) {
    for (const [rule, now] of Object.entries(row) as Array<[RuleId, number]>) {
      const was = baseline[file]?.[rule];
      if (was === undefined) d.fresh.push({ file, rule, now });
      else if (now > was) d.over.push({ file, rule, was, now });
      else if (now < was) d.under.push({ file, rule, was, now });
    }
  }
  for (const [file, row] of Object.entries(baseline)) {
    for (const [rule, was] of Object.entries(row) as Array<[RuleId, number]>) {
      if (current[file]?.[rule] === undefined && was > 0 && exists(file)) d.under.push({ file, rule, was, now: 0 });
    }
  }
  return d;
}

/** The baseline JSON for `current`: files sorted, rules sorted, zero counts left out. */
export function formatBaseline(current: Counts): string {
  const sorted: Counts = {};
  for (const file of Object.keys(current).sort()) {
    const row: Partial<Record<RuleId, number>> = {};
    for (const rule of (Object.keys(current[file]!) as RuleId[]).sort()) {
      const n = current[file]![rule]!;
      if (n > 0) row[rule] = n;
    }
    if (Object.keys(row).length) sorted[file] = row;
  }
  return JSON.stringify(sorted, null, 2) + '\n';
}

/** What --write would record. It refuses a rise or a new file or rule unless
 *  there is no baseline yet (the first run). */
export function writeBaseline(current: Counts, baseline: Counts | null, exists?: (file: string) => boolean): { ok: true; text: string } | { ok: false; refused: HouseRulesDrift } {
  if (baseline) {
    const d = drift(current, baseline, exists);
    if (d.over.length || d.fresh.length) return { ok: false, refused: d };
  }
  return { ok: true, text: formatBaseline(current) };
}

// ─── The tree ─────────────────────────────────────────────────────────────────

function walkFiles(absDir: string, accept: (name: string) => boolean, skip: (rel: string) => boolean = () => false): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
      const abs = join(dir, name);
      const rel = relative(ROOT, abs);
      let st: ReturnType<typeof lstatSync>;
      try { st = lstatSync(abs); } catch { continue; }
      if (st.isSymbolicLink() || skip(rel)) continue;
      if (st.isDirectory()) visit(abs);
      else if (accept(name)) out.push(rel);
    }
  };
  visit(absDir);
  return out.sort();
}

interface Chunk { file: string; text: string; lineOffset: number; info: boolean; rules: CssRule[] }

/** Every block of CSS in scope, parsed. */
export function loadScope(): { chunks: Chunk[]; catchAll: boolean } {
  const buildTs = readFileSync(join(ROOT, 'docs/build.ts'), 'utf8');
  const info = new Set(infoBundledSheets(buildTs));
  const chunks: Chunk[] = [];
  const push = (file: string, text: string, lineOffset: number, isInfo: boolean): void => {
    chunks.push({ file, text, lineOffset, info: isInfo, rules: parseCss(text, lineOffset) });
  };
  const sheets = walkFiles(join(ROOT, 'shells/web/src'), (n) => n.endsWith('.css'), (rel) => rel.startsWith('shells/web/src/vendor'));
  for (const file of sheets) push(file, readFileSync(join(ROOT, file), 'utf8'), 0, info.has(file));
  for (const block of extractHtmlCss(readFileSync(join(ROOT, 'shells/web/index.html'), 'utf8'))) push('shells/web/index.html', block.text, block.lineOffset, false);
  for (const block of extractDocsCss(buildTs)) push('docs/build.ts', block.text, block.lineOffset, true);
  const basePath = join(ROOT, 'shells/web/src/styles/parts/base.css');
  const catchAll = existsSync(basePath) && hasCatchAll(readFileSync(basePath, 'utf8'));
  return { chunks, catchAll };
}

/** The sources whose custom property definitions count for H6. Test files are
 *  left out so a fixture cannot hide a real gap. */
export function definitionSources(): string[] {
  const files = [
    ...walkFiles(join(ROOT, 'shells/web/src'), (n) => /\.(?:css|ts|html)$/.test(n) && !n.endsWith('.test.ts')),
    'shells/web/index.html',
    ...walkFiles(join(ROOT, 'docs'), (n) => n.endsWith('.ts') && !n.endsWith('.test.ts')),
    ...walkFiles(join(ROOT, 'engine/src'), (n) => n.endsWith('.ts') && !n.endsWith('.test.ts')),
  ];
  for (const pkg of readdirSync(join(ROOT, 'packages'))) {
    const src = join(ROOT, 'packages', pkg, 'src');
    if (existsSync(src)) files.push(...walkFiles(src, (n) => n.endsWith('.ts') && !n.endsWith('.test.ts')));
  }
  return files.map((f) => readFileSync(join(ROOT, f), 'utf8'));
}

/** Scan the whole scope and return every finding, before the allowlist. */
export function scanTree(): { findings: Finding[]; catchAll: boolean } {
  const { chunks, catchAll } = loadScope();
  const definitions = collectDefinitions(definitionSources());
  // The app ships every shell sheet and index.html; /info ships its bundled
  // sheets and the docs/build.ts literals. Reduce rules pair within each pool.
  const appKeys = collectMotionKeys(chunks.filter((c) => c.file !== 'docs/build.ts').flatMap((c) => c.rules));
  const infoKeys = collectMotionKeys(chunks.filter((c) => c.info).flatMap((c) => c.rules));
  const findings: Finding[] = [];
  for (const c of chunks) {
    findings.push(...scanCss(c.text, c.file, { rules: c.rules, definitions, catchAll, info: c.info, motionKeys: c.info ? infoKeys : appKeys }));
  }
  return { findings, catchAll };
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}

const total = (counts: Counts): number => Object.values(counts).reduce((a, row) => a + Object.values(row).reduce((x, y) => x + (y ?? 0), 0), 0);
const fmt = (f: Finding): string => `${f.file}:${f.line}  ${f.rule}  ${f.selector}  ${f.detail}`;

function main(argv: string[]): number {
  const args = argv.filter((a) => a !== '--');
  const { findings, catchAll } = scanTree();
  if (!catchAll) {
    console.error('✗ shells/web/src/styles/parts/base.css no longer holds both reduce-motion catch-alls');
    console.error('  (@media (prefers-reduced-motion: reduce) and html[data-a11y-motion="reduce"], each zeroing animation-duration).');
    console.error('  Every app animation relied on them. Restore both blocks before anything else.');
    printHouseRulesWhy();
    return 1;
  }
  const allow = readJson<AllowEntry[]>(ALLOW_PATH, []);
  const a = checkAllow(findings, allow);

  if (args.includes('--list')) {
    const rule = args.find((x) => x.startsWith('--rule='))?.slice(7);
    const file = args.find((x) => x.startsWith('--file='))?.slice(7);
    const allowedSet = new Set(a.allowed);
    for (const f of findings) {
      if (rule && f.rule !== rule) continue;
      if (file && f.file !== file) continue;
      console.log(`${fmt(f)}${allowedSet.has(f) ? '  [allowed]' : ''}`);
    }
    return 0;
  }

  let failed = false;
  for (const e of a.stale) { console.error(`✗ allowlist entry matches nothing: ${e.file} ${e.rule} "${e.selector}" - delete it from scripts/data/house-rules-allow.json`); failed = true; }
  for (const e of a.badReason) { console.error(`✗ allowlist entry needs a specific reason (over 40 characters): ${e.file} ${e.rule} "${e.selector}"`); failed = true; }

  const current = countByFileRule(a.counted);
  const baselineExists = existsSync(BASELINE_PATH);
  const baseline = readJson<Counts>(BASELINE_PATH, {});

  if (args.includes('--write')) {
    if (failed) { printHouseRulesWhy(); return 1; }
    const w = writeBaseline(current, baselineExists ? baseline : null);
    if (!w.ok) {
      for (const x of w.refused.over) console.error(`✗ refusing to record a rise: ${x.file} ${x.rule} ${x.was} -> ${x.now}`);
      for (const x of w.refused.fresh) console.error(`✗ refusing to record a new entry: ${x.file} ${x.rule} ${x.now}`);
      console.error('\nNothing written. Fix the findings above; the baseline only records falls.');
      printHouseRulesWhy();
      return 1;
    }
    writeFileSync(BASELINE_PATH, w.text);
    console.log(`✓ wrote baseline: ${Object.keys(current).length} files, ${total(current)} findings`);
    return 0;
  }

  const d = drift(current, baseline);
  const show = (file: string, rule: RuleId): void => {
    for (const f of a.counted) if (f.file === file && f.rule === rule) console.error(`    ${fmt(f)}`);
  };
  for (const x of d.over) { console.error(`✗ ${x.file}: ${x.rule} rose ${x.was} -> ${x.now}`); show(x.file, x.rule); }
  for (const x of d.fresh) { console.error(`✗ ${x.file}: ${x.rule} has ${x.now} new finding(s) and no baseline entry (new files and rules start clean)`); show(x.file, x.rule); }
  for (const x of d.under) console.error(`✗ ${x.file}: ${x.rule} fell ${x.was} -> ${x.now} - record the fall: node scripts/check-house-rules.ts --write`);
  if (failed || d.over.length || d.fresh.length || d.under.length) {
    console.error(`\n${d.over.length} rose, ${d.fresh.length} new, ${d.under.length} fell but unrecorded, ${a.stale.length + a.badReason.length} allowlist problem(s). Total now ${total(current)}.`);
    printHouseRulesWhy();
    return 1;
  }
  const perRule = RULES.map((r) => `${r.id} ${a.counted.filter((f) => f.rule === r.id).length}`).join(', ');
  console.log(`✓ CSS house rules hold against the baseline (${perRule}; ${a.allowed.length} allowed)`);
  return 0;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
