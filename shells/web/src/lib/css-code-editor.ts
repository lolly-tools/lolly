// SPDX-License-Identifier: MPL-2.0
/**
 * A small, dependency-free CSS code editor for the shell (plan 112 M4 - the Custom CSS
 * panel, reusable anywhere). The classic overlay trick: a transparent <textarea> over a
 * coloured <pre> that mirrors it token-for-token (the sandbox pattern), plus a
 * property/value autocomplete. No CodeMirror/Monaco - CSS's vocabulary is bounded, so a
 * ~250-word property list + a compact tokenizer covers it offline and light.
 *
 * The pure halves - `highlightCss` and `cssCompletions` - carry the logic and are unit
 * tested; `mountCssEditor` is the thin DOM wiring around them. Token colours and the
 * dropdown are theme CSS vars (styles/parts/css-editor.css), so it follows the app theme.
 */

// ── Highlighting ─────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function span(cls: string, text: string): string {
  return `<span class="tk-${cls}">${esc(text)}</span>`;
}

// At-rules whose `{ … }` holds nested RULES (selectors), not declarations - so an ident
// inside stays a selector, not a property. `@keyframes` blocks hold keyframe selectors.
const RULE_BLOCK_AT = new Set(['media', 'supports', 'container', 'document', 'layer', 'scope', 'keyframes']);

// One master token pattern, tried left-to-right: comment, string, at-rule, hex colour,
// number(+unit), important, identifier, structural punctuation, any single char.
const TOKEN_RE =
  /\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|@[\w-]+|#[0-9a-fA-F]{3,8}\b|-?(?:\d*\.\d+|\d+)(?:[a-z%]{1,5})?|!important\b|--[\w-]+|[A-Za-z_][\w-]*|[{}();:,]|\s+|[^\s]/g;

/** Highlight CSS into HTML with `tk-*` token spans. Context (selector vs property vs
 *  value) is tracked with a small block stack; imperfect grammar degrades to a plain
 *  colour, never to broken markup (everything is escaped). */
export function highlightCss(src: string): string {
  let out = '';
  const stack: Array<'decl' | 'rules'> = [];
  let pendingAt = '';   // last @rule name since the previous statement boundary
  let inValue = false;  // inside a declaration value (past the `:`)
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(src))) {
    const tok = m[0];
    const c0 = tok[0]!;
    const cur = stack[stack.length - 1];
    if (tok.startsWith('/*')) { out += span('com', tok); continue; }
    if (c0 === '"' || c0 === "'") { out += span('str', tok); continue; }
    if (c0 === '@') { pendingAt = tok.slice(1).toLowerCase(); out += span('at', tok); continue; }
    if (tok === '!important') { out += span('kw', tok); continue; }
    if (tok.startsWith('--')) { out += span('prop', tok); continue; } // custom property
    if (c0 === '#' && /^#[0-9a-fA-F]{3,8}$/.test(tok)) { out += span('num', tok); continue; }
    if (/^-?(?:\d*\.\d+|\d+)/.test(tok) && /\d/.test(tok)) { out += span('num', tok); continue; }
    if (/^\s+$/.test(tok)) { out += esc(tok); continue; }
    if (c0 === '{') {
      stack.push(RULE_BLOCK_AT.has(pendingAt) ? 'rules' : 'decl');
      pendingAt = ''; inValue = false;
      out += span('punc', tok); continue;
    }
    if (c0 === '}') { stack.pop(); inValue = false; pendingAt = ''; out += span('punc', tok); continue; }
    if (c0 === ';') { inValue = false; pendingAt = ''; out += span('punc', tok); continue; }
    if (c0 === ':') { if (cur === 'decl' && !inValue) inValue = true; out += span('punc', tok); continue; }
    if (c0 === '(' || c0 === ')' || c0 === ',') { out += span('punc', tok); continue; }
    if (/^[A-Za-z_][\w-]*$/.test(tok)) {
      // A function call: the next non-space is `(`.
      if (/^\s*\(/.test(src.slice(TOKEN_RE.lastIndex))) { out += span('fn', tok); continue; }
      if (cur === 'decl' && !inValue) { out += span('prop', tok); continue; }
      if (cur === 'decl' && inValue) { out += span('val', tok); continue; }
      out += span('sel', tok); continue;
    }
    // selector combinators / punctuation (. # & > + ~ [ ] * etc.)
    out += /[.#&>+~*[\]=|^$]/.test(c0) ? span('sel', tok) : esc(tok);
  }
  return out;
}

// ── Autocomplete ─────────────────────────────────────────────────────────────────────

/** The bounded CSS property vocabulary (curated common set - the point of "not so big").
 *  Enough to speed up authoring without shipping the full spec. */
export const CSS_PROPERTIES: readonly string[] = [
  'align-content', 'align-items', 'align-self', 'animation', 'animation-delay', 'animation-direction',
  'animation-duration', 'animation-fill-mode', 'animation-iteration-count', 'animation-name',
  'animation-play-state', 'animation-timing-function', 'aspect-ratio', 'backdrop-filter', 'backface-visibility',
  'background', 'background-attachment', 'background-blend-mode', 'background-clip', 'background-color',
  'background-image', 'background-origin', 'background-position', 'background-repeat', 'background-size',
  'block-size', 'border', 'border-bottom', 'border-bottom-color', 'border-bottom-left-radius',
  'border-bottom-right-radius', 'border-bottom-style', 'border-bottom-width', 'border-collapse', 'border-color',
  'border-image', 'border-left', 'border-radius', 'border-right', 'border-spacing', 'border-style', 'border-top',
  'border-top-left-radius', 'border-top-right-radius', 'border-width', 'bottom', 'box-shadow', 'box-sizing',
  'caret-color', 'clip-path', 'color', 'column-count', 'column-gap', 'columns', 'contain', 'content', 'cursor',
  'direction', 'display', 'fill', 'filter', 'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow',
  'flex-shrink', 'flex-wrap', 'float', 'font', 'font-family', 'font-feature-settings', 'font-size',
  'font-stretch', 'font-style', 'font-variant', 'font-variation-settings', 'font-weight', 'gap', 'grid',
  'grid-area', 'grid-auto-columns', 'grid-auto-flow', 'grid-auto-rows', 'grid-column', 'grid-column-gap',
  'grid-gap', 'grid-row', 'grid-row-gap', 'grid-template', 'grid-template-areas', 'grid-template-columns',
  'grid-template-rows', 'height', 'inline-size', 'inset', 'isolation', 'justify-content', 'justify-items',
  'justify-self', 'left', 'letter-spacing', 'line-height', 'list-style', 'margin', 'margin-bottom',
  'margin-left', 'margin-right', 'margin-top', 'mask', 'max-height', 'max-width', 'min-height', 'min-width',
  'mix-blend-mode', 'object-fit', 'object-position', 'opacity', 'order', 'outline', 'outline-color',
  'outline-offset', 'outline-style', 'outline-width', 'overflow', 'overflow-x', 'overflow-y', 'padding',
  'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'perspective', 'perspective-origin',
  'place-content', 'place-items', 'place-self', 'pointer-events', 'position', 'right', 'rotate', 'row-gap',
  'scale', 'stroke', 'stroke-width', 'text-align', 'text-decoration', 'text-indent', 'text-overflow',
  'text-shadow', 'text-transform', 'text-wrap', 'top', 'transform', 'transform-origin', 'transform-style',
  'transition', 'transition-delay', 'transition-duration', 'transition-property', 'transition-timing-function',
  'translate', 'user-select', 'vertical-align', 'visibility', 'white-space', 'width', 'will-change',
  'word-break', 'word-spacing', 'writing-mode', 'z-index',
];

/** Value keywords offered when a known property's value is being typed. */
const VALUE_HINTS: Record<string, readonly string[]> = {
  display: ['block', 'flex', 'grid', 'inline', 'inline-block', 'inline-flex', 'none', 'contents'],
  position: ['absolute', 'relative', 'fixed', 'sticky', 'static'],
  'text-align': ['left', 'center', 'right', 'justify', 'start', 'end'],
  'object-fit': ['cover', 'contain', 'fill', 'none', 'scale-down'],
  'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
  'justify-content': ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  'align-items': ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'],
  overflow: ['visible', 'hidden', 'scroll', 'auto', 'clip'],
  'font-weight': ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'bold', 'normal'],
  cursor: ['pointer', 'default', 'text', 'move', 'grab', 'not-allowed', 'crosshair'],
  'pointer-events': ['auto', 'none'],
  'white-space': ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'],
};

const GLOBAL_VALUES = ['inherit', 'initial', 'unset', 'revert', 'auto', 'none'];

export interface Completion {
  /** Matching option strings, best-first (prefix matches). */
  options: string[];
  /** The token being completed (what the user has typed so far). */
  token: string;
  /** Whether this is a property-name or a value completion (for insert punctuation). */
  kind: 'property' | 'value';
}

/** Compute completions for the text up to the caret. Returns null when there is nothing
 *  useful to offer (empty token, or a value context with no hints for that property). */
export function cssCompletions(before: string): Completion | null {
  // Are we typing a value (past a `:` on the current declaration, before `;`/`{`/`}`)?
  const stmt = before.slice(Math.max(before.lastIndexOf(';'), before.lastIndexOf('{'), before.lastIndexOf('}')) + 1);
  const colon = stmt.indexOf(':');
  const inValue = colon >= 0;

  if (inValue) {
    const prop = stmt.slice(0, colon).trim().toLowerCase();
    const valTok = (stmt.slice(colon + 1).match(/[\w-]*$/)?.[0] ?? '');
    if (!valTok) return null;
    const pool = [...(VALUE_HINTS[prop] ?? []), ...GLOBAL_VALUES];
    const options = dedupePrefix(pool, valTok);
    return options.length ? { options, token: valTok, kind: 'value' } : null;
  }

  const propTok = (before.match(/[A-Za-z-][\w-]*$/)?.[0] ?? '');
  if (!propTok) return null;
  const options = CSS_PROPERTIES.filter((p) => p.startsWith(propTok.toLowerCase())).slice(0, 12);
  return options.length ? { options, token: propTok, kind: 'property' } : null;
}

function dedupePrefix(pool: readonly string[], tok: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of pool) {
    if (v.startsWith(tok.toLowerCase()) && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out.slice(0, 12);
}

// ── DOM component ────────────────────────────────────────────────────────────────────

export interface CssEditorHandle {
  getValue(): string;
  setValue(v: string): void;
  focus(): void;
  destroy(): void;
}

export interface CssEditorOpts {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/** Mount the editor into `host`. Returns a handle; call destroy() to tear it down. */
export function mountCssEditor(host: HTMLElement, opts: CssEditorOpts = {}): CssEditorHandle {
  const wrap = document.createElement('div');
  wrap.className = 'css-ed';
  const pre = document.createElement('pre');
  pre.className = 'css-ed-hl';
  pre.setAttribute('aria-hidden', 'true');
  const ta = document.createElement('textarea');
  ta.className = 'css-ed-ta';
  ta.spellcheck = false;
  ta.autocapitalize = 'off';
  ta.setAttribute('autocorrect', 'off');
  ta.setAttribute('autocomplete', 'off');
  ta.wrap = 'off';
  if (opts.placeholder) ta.placeholder = opts.placeholder;
  if (opts.ariaLabel) ta.setAttribute('aria-label', opts.ariaLabel);
  ta.value = opts.value ?? '';
  const menu = document.createElement('div');
  menu.className = 'css-ed-ac';
  menu.hidden = true;
  wrap.append(pre, ta, menu);
  host.appendChild(wrap);

  let acItems: string[] = [];
  let acIndex = 0;
  let acToken = '';

  function paint(): void {
    // Trailing newline so the <pre> keeps the last line's height in sync with the textarea.
    pre.innerHTML = highlightCss(ta.value) + '\n';
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  }
  function emit(): void { opts.onChange?.(ta.value); }

  function closeMenu(): void { menu.hidden = true; acItems = []; }
  function openMenu(): void {
    const before = ta.value.slice(0, ta.selectionStart);
    const c = cssCompletions(before);
    if (!c) { closeMenu(); return; }
    acItems = c.options; acToken = c.token; acIndex = 0;
    menu.innerHTML = acItems
      .map((o, i) => `<div class="css-ed-ac-item${i === 0 ? ' is-sel' : ''}" data-i="${i}">${esc(o)}</div>`)
      .join('');
    menu.hidden = false;
  }
  function highlightSel(): void {
    for (const el of menu.querySelectorAll<HTMLElement>('.css-ed-ac-item')) {
      el.classList.toggle('is-sel', Number(el.dataset.i) === acIndex);
    }
  }
  function accept(): void {
    if (menu.hidden || !acItems.length) return;
    const pick = acItems[acIndex]!;
    const start = ta.selectionStart - acToken.length;
    const suffix = cssCompletions(ta.value.slice(0, ta.selectionStart))?.kind === 'property' ? ': ' : '';
    ta.setRangeText(pick + suffix, start, ta.selectionStart, 'end');
    closeMenu();
    paint(); emit();
  }

  const onInput = () => { paint(); emit(); openMenu(); };
  const onScroll = () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; };
  const onKey = (e: KeyboardEvent) => {
    if (!menu.hidden) {
      if (e.key === 'ArrowDown') { e.preventDefault(); acIndex = (acIndex + 1) % acItems.length; highlightSel(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); acIndex = (acIndex - 1 + acItems.length) % acItems.length; highlightSel(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(); return; }
      // Escape dismisses just the dropdown - stop it reaching the app's Escape-to-close so
      // the host panel/overlay stays open (Escape with no menu open falls through to close it).
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
    }
    // Two-space indent on Tab when no menu is open.
    if (e.key === 'Tab') {
      e.preventDefault();
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      paint(); emit();
    }
  };
  const onMenuClick = (e: MouseEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.css-ed-ac-item');
    if (item) { acIndex = Number(item.dataset.i); accept(); ta.focus(); }
  };
  const onBlur = () => setTimeout(closeMenu, 120); // let a menu click land first

  ta.addEventListener('input', onInput);
  ta.addEventListener('scroll', onScroll);
  ta.addEventListener('keydown', onKey);
  ta.addEventListener('blur', onBlur);
  menu.addEventListener('mousedown', onMenuClick);
  paint();

  return {
    getValue: () => ta.value,
    setValue: (v: string) => { ta.value = v; paint(); },
    focus: () => ta.focus(),
    destroy: () => {
      ta.removeEventListener('input', onInput);
      ta.removeEventListener('scroll', onScroll);
      ta.removeEventListener('keydown', onKey);
      ta.removeEventListener('blur', onBlur);
      menu.removeEventListener('mousedown', onMenuClick);
      wrap.remove();
    },
  };
}
