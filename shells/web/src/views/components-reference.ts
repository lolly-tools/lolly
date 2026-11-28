// SPDX-License-Identifier: MPL-2.0
/**
 * The take-away half of a component card (#/components): what a developer or
 * designer copies out of the library once the preview has told them this is
 * the part they want.
 *
 *   markupOf(stage)     the HTML the stage actually rendered, pretty-printed,
 *                       with the library's own scaffolding removed
 *   importInfo(s)       `import { symbol } from 'path'` when the specimen gives
 *                       the functions it is made with, and the stylesheet and
 *                       classes for a CSS-only one
 *   tokensUsedBy(stage) every `var(--…)` a stylesheet rule that matches something
 *                       in the stage reads - the design tokens this part consumes
 *
 * All of it runs on demand, the first time a card's reference block opens, so
 * the library page stays as light as it was when the block was prose.
 */

import type { Specimen } from './components-data.ts';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Attributes the library adds for its own wiring - never part of the component. */
const LIBRARY_ATTR = /^data-cl-|^data-lolly-ui-/;
/** Cap on the copied markup - the icon registry alone is 157 inline SVGs. */
export const MARKUP_CAP = 24_000;

function attrText(el: Element): string {
  const parts: string[] = [];
  for (const { name, value } of el.attributes) {
    if (LIBRARY_ATTR.test(name)) continue;
    if (name === 'role' && value === 'presentation' && /^h[1-6]$/i.test(el.tagName)) continue; // the library's outline fix
    let v = value;
    if (name === 'class') {
      v = value.split(/\s+/).filter(c => c && !c.startsWith('cl-')).join(' ');
      if (!v) continue;
    }
    parts.push(v === '' ? name : `${name}="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

/** Library scaffolding: an element whose classes are ALL `cl-*` (a demo wrapper,
 *  a layout grid for the sample) - rendered as its children, at the same depth. */
function isScaffold(el: Element): boolean {
  const classes = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  return classes.length > 0 && classes.every(c => c.startsWith('cl-'));
}

function serialize(node: Node, depth: number, out: string[]): void {
  if (node.nodeType === 3) {
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) out.push('  '.repeat(depth) + text.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  if (isScaffold(el)) { el.childNodes.forEach(child => { serialize(child, depth, out); }); return; }
  const tag = el.tagName.toLowerCase();
  const pad = '  '.repeat(depth);
  if (VOID.has(tag)) { out.push(`${pad}<${tag}${attrText(el)}>`); return; }
  const kids = [...el.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent || '').trim()));
  const onlyText = kids.length > 0 && kids.every(n => n.nodeType === 3);
  if (!kids.length) { out.push(`${pad}<${tag}${attrText(el)}></${tag}>`); return; }
  if (onlyText) {
    const text = kids.map(n => (n.textContent || '').replace(/\s+/g, ' ').trim()).join(' ').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    out.push(`${pad}<${tag}${attrText(el)}>${text}</${tag}>`);
    return;
  }
  out.push(`${pad}<${tag}${attrText(el)}>`);
  kids.forEach(child => { serialize(child, depth + 1, out); });
  out.push(`${pad}</${tag}>`);
}

/** The stage's rendered HTML, pretty-printed and free of library scaffolding.
 *  `truncated` is set when the cap cut it short. */
export function markupOf(stage: Element): { html: string; truncated: boolean } {
  const out: string[] = [];
  stage.childNodes.forEach(child => { serialize(child, 0, out); });
  const html = out.join('\n');
  return html.length > MARKUP_CAP
    ? { html: html.slice(0, MARKUP_CAP).replace(/\n[^\n]*$/, '') + '\n…', truncated: true }
    : { html, truncated: false };
}

/** An identifier written as code is camelCase with a capital inside it
 *  (`mountZoomHud`, `segHtml`), which no ordinary word in a name is. */
const SYMBOL = /\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/g;

/**
 * The functions a specimen says it is made with: the camelCase identifiers in the
 * bracketed asides of its name, "Zoom HUD (mountZoomHud)" or "Segmented control
 * (.view-seg via segHtml())", and in the aside after its first path,
 * "view-loading.ts (beginViewLoading)". In the order written, each once. A guard in
 * components-reference.test.ts holds every one to a real export of the file `defined`
 * gives first, so an import line is never invented.
 */
export function symbolsOf(s: Specimen): string[] {
  let asides = '';
  let depth = 0;
  for (const ch of s.name) {
    if (ch === '(') { depth++; asides += ' '; continue; }
    if (ch === ')') { depth = Math.max(0, depth - 1); continue; }
    if (depth > 0) asides += ch;
  }
  const owner = (s.defined || '').split(/\s*\/\s+(?=[a-z])/)[0] ?? '';
  asides += ' ' + (/\(([^)]*)\)/.exec(owner)?.[1] ?? '');
  return [...new Set(asides.match(SYMBOL) ?? [])];
}

/** The first path in `defined` ("a.ts / b.ts" gives the owner first), without
 *  the aside that gives its function. */
export function definedPath(s: Specimen): string | null {
  const first = (s.defined || '').split(/\s*\/\s+(?=[a-z])/)[0]?.replace(/\s*\(.*$/, '').trim();
  return first || null;
}

export interface ImportInfo {
  /** `import { x } from 'path'` when the specimen gives its functions; else null. */
  line: string | null;
  /** The stylesheet that owns a CSS-only part, when `defined` names one. */
  stylesheet: string | null;
  /** The classes a CSS-only part is built from. */
  classes: string[];
  /** The call that produced the sample, when the data carries one. */
  call: string | null;
}

export function importInfo(s: Specimen): ImportInfo {
  const path = definedPath(s);
  const symbols = symbolsOf(s);
  const line = symbols.length && path && !path.endsWith('.css')
    ? `import { ${symbols.join(', ')} } from '${path}';`
    : null;
  const classes = (s.css || '').startsWith('(') ? [] : (s.css || '').split(/,\s*/).map(c => c.trim()).filter(c => c.startsWith('.'));
  return {
    line,
    stylesheet: path?.endsWith('.css') ? path : null,
    classes,
    call: s.code?.trim() || null,
  };
}

function* rulesOf(list: CSSRuleList): Generator<CSSStyleRule> {
  for (const rule of list) {
    if (rule instanceof CSSStyleRule) yield rule;
    else if ('cssRules' in rule) yield* rulesOf((rule as CSSGroupingRule).cssRules);
  }
}

/**
 * Every custom property the matching stylesheet rules (and the stage's inline
 * styles) read. `--ui-*` first - those are the semantic tokens the token table
 * documents - then everything else in first-seen order.
 */
export function tokensUsedBy(stage: Element): string[] {
  const seen = new Set<string>();
  const take = (css: string): void => {
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) seen.add(m[1]!);
  };
  for (const el of [stage, ...stage.querySelectorAll('*')]) take((el as HTMLElement).style?.cssText || '');
  const doc = stage.ownerDocument;
  for (const sheet of doc.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin
    for (const rule of rulesOf(rules)) {
      const css = rule.style.cssText;
      if (!css.includes('var(')) continue;
      const sel = rule.selectorText;
      try {
        if (stage.querySelector(sel) || stage.matches(sel)) take(css);
      } catch { /* a selector this engine cannot parse */ }
    }
  }
  const all = [...seen];
  return [...all.filter(v => v.startsWith('--ui-')), ...all.filter(v => !v.startsWith('--ui-'))];
}
