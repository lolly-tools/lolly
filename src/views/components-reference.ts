// SPDX-License-Identifier: MPL-2.0
/**
 * The take-away half of a component card (#/components): what a developer or
 * designer copies out of the library once the preview has told them this is
 * the part they want.
 *
 *   markupOf(stage)     the HTML the stage actually rendered, pretty-printed,
 *                       with the library's own scaffolding removed
 *   importLine(s)       `import { symbol } from 'path'` for a function-rendered
 *                       specimen, or the stylesheet + classes for a CSS-only one
 *   tokensUsedBy(stage) every `var(--…)` a stylesheet rule that matches something
 *                       in the stage reads - the design tokens this part consumes
 *   copyText(text)      clipboard write with a textarea fallback
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
  if (isScaffold(el)) { el.childNodes.forEach(child => serialize(child, depth, out)); return; }
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
  kids.forEach(child => serialize(child, depth + 1, out));
  out.push(`${pad}</${tag}>`);
}

/** The stage's rendered HTML, pretty-printed and free of library scaffolding.
 *  `truncated` is set when the cap cut it short. */
export function markupOf(stage: Element): { html: string; truncated: boolean } {
  const out: string[] = [];
  stage.childNodes.forEach(child => serialize(child, 0, out));
  const html = out.join('\n');
  return html.length > MARKUP_CAP
    ? { html: html.slice(0, MARKUP_CAP).replace(/\n[^\n]*$/, '') + '\n…', truncated: true }
    : { html, truncated: false };
}

/** The function the specimen name credits - `segHtml()` in
 *  "Segmented control (.view-seg via segHtml())" - if any. */
export function symbolOf(s: Specimen): string | null {
  const m = /([A-Za-z_$][\w$]*)\(\)/.exec(s.name);
  return m?.[1] ?? null;
}

/** The first path in `defined` ("a.ts / b.ts" names the owner first). */
export function definedPath(s: Specimen): string | null {
  const first = (s.defined || '').split(/\s*\/\s+(?=[a-z])/)[0]?.trim();
  return first || null;
}

export interface ImportInfo {
  /** `import { x } from 'path'` for a function-rendered part; null for CSS-only. */
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
  const symbol = symbolOf(s);
  const fn = s.kind === 'pure-html-fn' || s.kind === 'wired-fn';
  const line = fn && path && !path.endsWith('.css')
    ? `import { ${symbol ?? '…'} } from '${path}';`
    : null;
  const classes = (s.css || '').startsWith('(') ? [] : (s.css || '').split(/,\s*/).map(c => c.trim()).filter(c => c.startsWith('.'));
  return {
    line,
    stylesheet: path && path.endsWith('.css') ? path : null,
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

/** Clipboard write; the textarea path covers a page without the async API. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
