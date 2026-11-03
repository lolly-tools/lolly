// SPDX-License-Identifier: MPL-2.0
/**
 * Split layout DRIFT GUARDS: static reads of the places the two-pane layout is
 * spelt out a second time, where an edit can break an invariant no runtime test
 * sees. The pattern is a11y-prefs-contract.test.ts's.
 *
 *   1. ADDITIVITY. Every stylesheet reference to `data-layout`, `data-posture` or
 *      `data-hand` is an attribute selector on <html> that also requires
 *      `data-layout="split"`, so with the attributes absent (phone and desktop) no
 *      selector matches and those layouts are byte-identical. styles/parts/split.css
 *      holds nothing else, apart from the divider and Swap sides, which exist only
 *      while a split view is mounted.
 *   2. CHROME ONLY. No split rule targets the render canvas or an export stage.
 *   3. THE LAYERS. split.css is imported unlayered and declares its own layers: the
 *      layout in `overrides`, and only !important declarations in `chrome`, where
 *      an earlier layer is what lets them undo a phone rule.
 *   4. THE PRE-PAINT COPY. index.html's inline script decides split before the
 *      module loads, so its thresholds, its storage key and its native global
 *      must equal the module's.
 *
 * Run directly:  node --test shells/web/src/lib/layout-posture-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NATIVE_FOLD_GLOBAL, SPLIT_MAX_ASPECT, SPLIT_MAX_LONG, SPLIT_MIN_ASPECT, SPLIT_MIN_SHORT, SPLIT_POINTER_QUERY, FOLDED_QUERY,
} from './layout-posture.ts';
import { HAND_STORE_KEY } from './hand-pref.ts';

const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB_DIR = dirname(SRC_DIR);

const PROTECTED = ['.tool-canvas', '#tool-canvas', '#tool-canvas-outer', '#tool-content', '.pro-export-canvas', '.me-canvas', '.me-scale'] as const;
/** Elements the split module creates itself: they exist only in split, so their rules need no gate. */
const MODULE_OWNED = /^(?:\.split-divider|\.split-swap|html\.is-split-dragging)\b/;
const ATTRS = /\[data-(?:layout|posture|hand)\b/;

function decomment(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkCss(p, out);
    else if (entry.name.endsWith('.css')) out.push(p);
  }
  return out;
}

interface Rule { selector: string; body: string; at: string[]; line: number; rel: string }

function rules(css: string, rel: string): Rule[] {
  const out: Rule[] = [];
  const at: string[] = [];
  let prelude = '';
  let line = 1;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      const head = prelude.trim();
      prelude = '';
      if (head.startsWith('@')) { at.push(head); i++; continue; }
      let depth = 1;
      let body = '';
      i++;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) break; }
        if (css[i] === '\n') line++;
        body += css[i];
        i++;
      }
      out.push({ selector: head.replace(/\s+/g, ' '), body, at: [...at], line, rel });
      i++;
      continue;
    }
    if (ch === '}') { at.pop(); prelude = ''; i++; continue; }
    prelude += ch;
    i++;
  }
  return out;
}

function arms(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of selector) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((a) => a.trim()).filter(Boolean);
}

/** Drop every :not(...) so an exemption is never read as a target. */
function stripNot(selector: string): string {
  let out = '';
  let i = 0;
  while (i < selector.length) {
    if (selector.startsWith(':not(', i)) {
      let depth = 0;
      let j = i + 4;
      for (; j < selector.length; j++) {
        if (selector[j] === '(') depth++;
        else if (selector[j] === ')') { depth--; if (depth === 0) break; }
      }
      i = j + 1;
      continue;
    }
    out += selector[i];
    i++;
  }
  return out;
}

const read = (rel: string): string => readFileSync(join(SRC_DIR, rel), 'utf8');
const SPLIT_CSS = 'styles/parts/split.css';
const ALL = walkCss(SRC_DIR).map((p) => {
  const rel = relative(SRC_DIR, p).split(sep).join('/');
  return { rel, rules: rules(decomment(readFileSync(p, 'utf8')), rel) };
});
const ALL_RULES = ALL.flatMap((f) => f.rules);

test('sanity: the split sheet and its rules were found', () => {
  const split = ALL_RULES.filter((r) => r.rel === SPLIT_CSS);
  assert.ok(split.length > 30, `only ${split.length} rules in ${SPLIT_CSS}`);
});

/**
 * Could this compound match <html>? A compound led by `html`, `:root`, `*` or a bare
 * attribute can; one led by another element or a class (`.deck-thumb__slide
 * [data-layout="title"]`, a component's own attribute of the same name) cannot.
 */
function couldBeRoot(compound: string): boolean {
  return /^(?:html|:root|\*|\[)/.test(compound);
}

/** The compound selectors of an arm, combinators dropped. */
function compounds(arm: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of arm) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

test('ADDITIVITY: every data-layout / data-posture / data-hand reference that can match <html> requires data-layout="split"', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const r of ALL_RULES) {
    for (const arm of arms(r.selector)) {
      for (const c of compounds(stripNot(arm)).filter((x) => ATTRS.test(x) && couldBeRoot(x))) {
        seen++;
        if (!(c.startsWith('html') && c.includes('[data-layout="split"]'))) bad.push(`${r.rel}:${r.line} ${arm}`);
      }
    }
  }
  assert.ok(seen > 20, `only ${seen} layout references found: the scan has rotted`);
  assert.deepEqual(bad, [], 'a layout attribute on <html> without data-layout="split" can match on phone or desktop');
});

test('ADDITIVITY: every rule in split.css is gated, or styles an element only split creates', () => {
  const bad: string[] = [];
  for (const r of ALL_RULES.filter((x) => x.rel === SPLIT_CSS)) {
    for (const arm of arms(r.selector)) {
      const ok = /^html\[data-layout="split"\]/.test(arm) || MODULE_OWNED.test(arm);
      if (!ok) bad.push(`${r.line} ${arm}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('CHROME ONLY: no split rule targets the render canvas or an export stage', () => {
  const bad: string[] = [];
  for (const r of ALL_RULES) {
    for (const arm of arms(r.selector)) {
      if (!/\[data-layout="split"\]|\.split-/.test(arm)) continue;
      const target = stripNot(arm);
      for (const name of PROTECTED) {
        if (new RegExp(`${name.replace(/[.#]/g, '\\$&')}(?![-\\w])`).test(target)) bad.push(`${r.rel}:${r.line} ${arm}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('THE LAYERS: split.css is imported unlayered, and its top-level blocks are the overrides and chrome layers only', () => {
  const app = read('styles/app.css');
  const line = app.split('\n').find((l) => l.includes("'./parts/split.css'"));
  assert.ok(line, 'app.css imports split.css');
  assert.equal(/layer\(/.test(line!.replace(/\/\*.*$/, '')), false, 'imported without a layer() so its own @layer blocks are top level');
  const css = decomment(read(SPLIT_CSS));
  const topLevel: string[] = [];
  let depth = 0;
  let prelude = '';
  for (const ch of css) {
    if (ch === '{') { if (depth === 0) topLevel.push(prelude.trim()); depth++; prelude = ''; continue; }
    if (ch === '}') { depth--; prelude = ''; continue; }
    if (depth === 0) prelude += ch;
  }
  assert.deepEqual([...new Set(topLevel)].sort(), ['@layer chrome', '@layer overrides']);
});

test('THE LAYERS: the chrome block holds only !important declarations (it exists to undo the phone sheet\'s)', () => {
  const chrome = ALL_RULES.filter((r) => r.rel === SPLIT_CSS && r.at.includes('@layer chrome'));
  assert.ok(chrome.length >= 1);
  for (const r of chrome) {
    for (const d of r.body.split(';').map((s) => s.trim()).filter(Boolean)) {
      assert.match(d, /!important$/, `${r.line}: ${d}`);
    }
  }
});

test('the edge dock\'s split rules are gated the same way', () => {
  const dock = ALL_RULES.filter((r) => r.rel === 'lib/edge-dock.css' && /data-layout/.test(r.selector));
  assert.ok(dock.length >= 4, 'the dock takes the control pane in split');
  for (const r of dock) for (const arm of arms(r.selector)) assert.match(arm, /^html\[data-layout="split"\]/, `${r.line} ${arm}`);
});

// ── The pre-paint copy in index.html ────────────────────────────────────────

const INDEX = readFileSync(join(WEB_DIR, 'index.html'), 'utf8');
const prepaint = ((): string => {
  const i = INDEX.indexOf("localStorage.getItem('lolly-hand')");
  assert.ok(i > 0, 'index.html has the hand mirror read');
  return INDEX.slice(i, INDEX.indexOf('the boot module decides', i));
})();

test('index.html reads the SAME hand key the module writes, and only ever sets "left"', () => {
  assert.ok(prepaint.includes(`localStorage.getItem('${HAND_STORE_KEY}') === 'left'`));
  assert.ok(prepaint.includes("dataset.hand = 'left'"));
  assert.equal(/dataset\.hand\s*=\s*'right'/.test(INDEX), false, 'right is the absence of the attribute');
});

test('index.html\'s size rule uses the module\'s thresholds, pointer query and native global', () => {
  assert.ok(prepaint.includes(`Math.min(lw, lh) >= ${SPLIT_MIN_SHORT}`), 'short side');
  assert.ok(prepaint.includes(`Math.max(lw, lh) <= ${SPLIT_MAX_LONG}`), 'long side');
  assert.ok(prepaint.includes(`la >= ${SPLIT_MIN_ASPECT}`), 'narrowest shape');
  assert.ok(prepaint.includes(`la <= ${SPLIT_MAX_ASPECT}`), 'widest shape');
  assert.ok(prepaint.includes(`matchMedia('${SPLIT_POINTER_QUERY}')`), 'the touch gate');
  assert.ok(prepaint.includes(`window.${NATIVE_FOLD_GLOBAL}`), 'the native fold global');
  assert.ok(prepaint.includes('viewport.segments'), 'the viewport segments');
  assert.ok(prepaint.includes("type === 'folded'"), 'the folded posture');
  assert.equal(FOLDED_QUERY, '(device-posture: folded)');
  assert.ok(prepaint.includes("dataset.layout = 'split'"));
  assert.equal(/dataset\.layout\s*=\s*'(?:phone|desktop)'/.test(INDEX), false, 'phone and desktop are the absence of the attribute');
});

test('index.html never writes data-posture or the --fold-* properties: those need the module\'s geometry', () => {
  assert.equal(/dataset\.posture|--fold-[xywh]/.test(INDEX), false);
});
