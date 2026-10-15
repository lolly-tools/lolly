// SPDX-License-Identifier: MPL-2.0
/**
 * Landing mode for the in-app documentation reader (#/docs/index) - plans/123.
 *
 * The built /info landing wraps its body in `<main class="docs-landing page-index">`
 * (docs/build.ts), which is the reader's second extraction marker beside `.docs-content`.
 * It is deliberately NOT a `.docs-content`: the article typography scoped to that class
 * (measure, section padding, `.docs-content h2` at (0,1,1)) would out-specify the
 * landing's class-only band rules and restyle every band.
 *
 * Two things the static page takes from its own <head> have to be supplied here,
 * because the reader imports neither:
 *
 *  1. THE BAND CSS. styles/parts/docs-landing.css is the ONE source both surfaces read
 *     (build.ts inlines it, this module injects it). Its selectors are bare class names
 *     (`.hero`, `.audience-tab`, `.quicknav`), so it is wrapped in `@scope (.docs-landing)`
 *     before it reaches the document: loose in the app shell, those rules would
 *     restyle the chrome's own elements. Its nested @media still apply, and @keyframes
 *     inside the block register globally as usual. What @scope does NOT keep is a rule
 *     that starts from <html>: a scoped selector is relative, with `:scope ` implied in
 *     front, so `html[data-theme="dark"] .quicknav` would need an <html> inside the
 *     landing and never matched. That was every dark-theme rule and every Reduce motion
 *     twin in the file, until liftRootConditions (below) rewrote them for the reader.
 *  2. THE REVEAL NEUTRALIZER. The file ships `.reveal{opacity:0;transform:...}` and the
 *     IntersectionObserver that adds `.visible` is a page script the reader strips by
 *     design, so without an override every band mounts invisible. The landing-mode
 *     rules ride in the SAME <style> tag, after the scoped block, so they beat it
 *     wherever the app's cascade layers place the reader's other sheets.
 *
 * The audience strip needs nothing from this module since plan 123 D1 (2026-08-17):
 * it is anchor pills over stacked, always-open cards on both surfaces, and the
 * reader's own in-page anchor handler already intercepts a pill's `#id` jump.
 *
 * Nothing here registers a document- or window-level listener: every listener sits on a
 * node inside the rehosted fragment, which the reader drops on unmount, so landing mode
 * needs no teardown. The injected <style> is a module singleton that outlives the view
 * on purpose - its rules can only match inside a `.docs-landing`, so it costs nothing
 * once the reader has moved on.
 */
import { toAppHref, toReaderHref } from './docs-nav.ts';
import { mountCoverFlow } from './covers-flow.ts';
import { wireAgentCopy } from './agent-copy.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import landingCss from '../styles/parts/docs-landing.css?raw';

/** Marks the singleton <style> so a second landing mount reuses it. */
const STYLE_MARK = 'data-docs-landing';

/**
 * The element defaults the fragment assumes from the static page's global CSS, which the
 * reader does not import - a verbatim mirror of build.ts's base rules (its CSS template,
 * the block after the token variables), because the band rules were authored ON TOP of
 * them. Without this block the fragment inherits the APP's chrome defaults instead and
 * every band "forgets its sizing": 14px body text where the site is 16px, section h2s at
 * 21px/700 where the landing's grammar is 2rem/900/uppercase, collapsed paragraph
 * rhythm, and viewBox-only icons ballooning to the CSS default 300x150. Everything sits
 * INSIDE the scope block at element specificity (0,0,1) - `:scope` is the `.docs-landing`
 * root itself - so every one of the file's own class rules still wins.
 */
const ELEMENT_BASELINE = `
:scope{font-size:16px;line-height:1.65;color:var(--text);font-family:var(--brand-font)}
svg{width:1em;height:1em;flex:none}
a{color:var(--green);text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:'SUSE Mono','SF Mono','Fira Code',monospace;font-size:.875em;background:var(--pale);padding:.15em .35em;border-radius:3px}
pre{background:var(--pale);color:hsl(var(--foreground));padding:1.25rem 1.5rem;border-radius:8px;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.875rem;line-height:1.5;margin-bottom:1.25rem}
pre code{background:none;padding:0;color:inherit;font-size:1em}
h1,h2,h3,h4{line-height:1.25;font-weight:700;margin:0}
h2{font-size:2rem;letter-spacing:0;font-weight:900;text-transform:uppercase}
p{margin:0 0 2rem}
ul{padding-left:1.25rem;margin:0 0 1rem}
li{margin-bottom:.35rem}
hr{border:none;border-top:1px solid var(--border);margin:2rem 0}
strong{font-weight:600}
`;

/**
 * Landing-mode overrides. Unscoped and last in the tag, keyed off the reader's
 * `docs-reader--landing` modifier, which sits on an ancestor of the fragment:
 *   - the reveal neutralizer (see the file header, point 2);
 *   - the sticky in-page quicknav, which is inside the fragment and duplicates the
 *     reader's own navigation. Landing mode hides the TOC slot as well, so the page
 *     carries exactly one jump-nav: none.
 * Both are (0,2,0), so they beat the scoped `.reveal` / `.quicknav` rules (0,1,0) on
 * specificity alone. The file's dark-theme quicknav rule and its Reduce motion reveal
 * twin are (0,2,1) and win on specificity, but neither fights these: the first sets
 * only a background, the second the same values as the neutralizer.
 */
const LANDING_MODE_CSS = `
.docs-reader--landing .reveal,
.docs-reader--landing .reveal.visible { opacity: 1; transform: none; transition: none; }
.docs-reader--landing .quicknav { display: none; }
`;

/** At-rules whose block holds more rules, so the rewrite walks into them. Every other
 *  block (@keyframes, @font-face, @property) is copied as it stands. */
const GROUP_AT_RULE = /^@(?:media|supports|container|layer|scope|starting-style)\b/i;

/** A selector's leading compound, when that compound is the root element: `html` or
 *  `:root` with any qualifiers, or bare attributes only <html> carries in the app and
 *  on /info (the theme, the direction, the language and the a11y switches). */
const ROOT_COMPOUND = /^(?:html|:root)(?![\w-])/i;
const ROOT_ATTRIBUTES = /^(?:\[\s*(?:data-theme|dir|lang|data-a11y-[a-z]+)(?![\w-])[^\]]*\])+$/i;
/** A selector list with an arm that may start at the root, to pass to liftSelectorList.
 *  Most lists fail this at once and are left as they are. */
const ROOT_HINT = /(?:^|,)\s*(?:html|:root|\[\s*(?:data-theme|dir|lang|data-a11y-))/i;

/** Where the compound that starts at `from` ends: the first combinator or whitespace
 *  outside brackets, parentheses and quotes. */
function compoundEnd(sel: string, from: number): number {
  let depth = 0;
  let quote = '';
  for (let i = from; i < sel.length; i++) {
    const ch = sel[i]!;
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '>' || ch === '+' || ch === '~')) return i;
  }
  return sel.length;
}

/** Where a compound's pseudo-element starts (`::after`, or the legacy one-colon form),
 *  or its length when it has none. A pseudo-class may not follow a pseudo-element, so
 *  the condition has to go in front of one. */
function pseudoElementAt(compound: string): number {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < compound.length; i++) {
    const ch = compound[i]!;
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && ch === ':' && (compound[i + 1] === ':' || /^:(?:before|after|first-line|first-letter)(?![\w-])/i.test(compound.slice(i)))) return i;
  }
  return compound.length;
}

/** One selector of a list, its own whitespace kept, with a leading <html> compound
 *  moved onto the next compound. Anything else comes back unchanged. */
function liftArm(arm: string): string {
  const sel = arm.trim();
  // Cheap first: a root compound starts with html, :root or an attribute.
  const c0 = sel[0];
  if (c0 !== 'h' && c0 !== 'H' && c0 !== ':' && c0 !== '[') return arm;
  const lead = arm.slice(0, arm.length - arm.trimStart().length);
  const trail = arm.slice(arm.trimEnd().length);
  const rootEnd = compoundEnd(sel, 0);
  const root = sel.slice(0, rootEnd);
  if (!ROOT_COMPOUND.test(root) && !ROOT_ATTRIBUTES.test(root)) return arm;
  const gap = /^\s+/.exec(sel.slice(rootEnd));
  // Only the descendant form: `html` on its own, or `html > body`, has no subject
  // inside the landing for the condition to ride on.
  if (!gap) return arm;
  const rest = sel.slice(rootEnd + gap[0].length);
  if (!rest || /^[>+~]/.test(rest)) return arm;
  const firstEnd = compoundEnd(rest, 0);
  const first = rest.slice(0, firstEnd);
  const at = pseudoElementAt(first);
  const condition = `:is(${root} *)`;
  return lead + first.slice(0, at) + condition + first.slice(at) + rest.slice(firstEnd) + trail;
}

/** A selector list, split on its top-level commas, each arm lifted. */
function liftSelectorList(prelude: string): string {
  const arms: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    const ch = prelude[i]!;
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { arms.push(prelude.slice(start, i)); start = i + 1; }
  }
  arms.push(prelude.slice(start));
  return arms.map(liftArm).join(',');
}

/**
 * Rewrite every selector that starts at <html> so it still matches inside
 * `@scope (.docs-landing)`. `html[data-theme="dark"] .fmt-chip` becomes
 * `.fmt-chip:is(html[data-theme="dark"] *)`, and the bare form the older bands use,
 * `[data-theme="dark"] .faq-item`, becomes `.faq-item:is([data-theme="dark"] *)`. The
 * condition moves onto the first compound after the root one, where an element meets
 * it exactly when an ancestor carries the attribute: the same match the unscoped page
 * makes. It holds for a direct child of the scope root as well as a deeper one, which
 * a leading `:where(html[...] *)` compound does not, and `:is()` takes its argument's
 * specificity, the same as the compound it replaces, so the reader keeps the cascade
 * the static page has. Comments, declarations, @keyframes and every other selector
 * pass through unchanged.
 *
 * Only the reader's copy is rewritten. The static /info page inlines the file
 * unscoped, and the source keeps the plain `html[...]` form every stylesheet in the
 * app uses, so a rule added later is lifted with the rest instead of quietly missing
 * the reader (tests/docs-reader-scope.test.ts holds the whole file to that).
 */
export function liftRootConditions(css: string): string {
  const n = css.length;
  // The next character that can open or close anything: a brace, a semicolon, a quote,
  // or a slash that may start a comment. The walk jumps between them and only records
  // the selector lists it changes, so it stays cheap on the cold start where it runs,
  // once, before the landing first paints.
  const NEXT = /[{};"'/]/g;
  const edits: Array<[start: number, end: number, text: string]> = [];
  /** The index just past the comment or quoted string that starts at `at` (or past a
   *  lone slash). */
  const skip = (at: number): number => {
    if (css[at] === '/') {
      if (css[at + 1] !== '*') return at + 1;
      const close = css.indexOf('*/', at + 2);
      return close < 0 ? n : close + 2;
    }
    const quote = css[at];
    let j = at + 1;
    while (j < n && css[j] !== quote) j += css[j] === '\\' ? 2 : 1;
    return Math.min(n, j + 1);
  };
  /** The index just past the balanced block that opens at `open`. */
  const blockEnd = (open: number): number => {
    let depth = 0;
    let i = open;
    while (i < n) {
      NEXT.lastIndex = i;
      const m = NEXT.exec(css);
      if (!m) return n;
      const at = m.index;
      const ch = css[at];
      if (ch === '{') { depth++; i = at + 1; }
      else if (ch === '}') { i = at + 1; if (--depth === 0) return i; }
      else if (ch === ';') i = at + 1;
      else i = skip(at);
    }
    return n;
  };
  /** Walk a list of rules from `start`; the index of its closing brace, or n. */
  const walk = (start: number): number => {
    let i = start;
    let from = start;   // where the pending prelude starts
    while (i < n) {
      NEXT.lastIndex = i;
      const m = NEXT.exec(css);
      if (!m) return n;
      const at = m.index;
      const ch = css[at];
      if (ch === '/' || ch === '"' || ch === "'") {
        const end = skip(at);
        // A comment before a rule stays outside its selector, so the selector still
        // starts where the test for <html> looks.
        if (ch === '/' && end > at + 1 && !css.slice(from, at).trim()) from = end;
        i = end;
        continue;
      }
      if (ch === '}') return at;
      if (ch === ';') { i = from = at + 1; continue; }
      const prelude = css.slice(from, at);
      const head = prelude.trim();
      if (head.startsWith('@')) {
        if (GROUP_AT_RULE.test(head)) { const close = walk(at + 1); i = close < n ? close + 1 : n; }
        else i = blockEnd(at);
      } else {
        if (ROOT_HINT.test(prelude)) {
          const lifted = liftSelectorList(prelude);
          if (lifted !== prelude) edits.push([from, at, lifted]);
        }
        i = blockEnd(at);
      }
      from = i;
    }
    return n;
  };
  // A stray closing brace at the top level is stepped over, as the browser would.
  for (let i = 0; i < n; i = walk(i) + 1);
  if (!edits.length) return css;
  let out = '';
  let last = 0;
  for (const [start, end, text] of edits) { out += css.slice(last, start) + text; last = end; }
  return out + css.slice(last);
}

/** The whole text of the reader's landing <style>: the element baseline and the band
 *  CSS inside the scope, the band CSS lifted so its <html> rules match there, and the
 *  landing-mode overrides after the scope. */
export function landingStyleText(source: string): string {
  return `@scope (.docs-landing) {\n${ELEMENT_BASELINE}\n${liftRootConditions(source)}\n}\n${LANDING_MODE_CSS}`;
}

/**
 * Inject the scoped landing stylesheet once per session. Idempotent: a second call (a
 * remount, or a second reader instance) finds the tag and returns.
 */
export function ensureLandingStyles(): void {
  if (document.head.querySelector(`style[${STYLE_MARK}]`)) return;
  // The `?raw` import is a string under Vite. Under the node:test CSS stub it is
  // undefined (tests/css-stub-hooks.mjs), which must degrade to an empty scope block
  // rather than the text "undefined" in a stylesheet.
  const source = typeof landingCss === 'string' ? landingCss : '';
  const el = document.createElement('style');
  el.setAttribute(STYLE_MARK, '');
  el.textContent = landingStyleText(source);
  document.head.appendChild(el);
}

/**
 * Point the fragment's app links back into THIS app instance (decision D3 in plans/123).
 * The built page links out to the deployed app - `/#/tool/qr-code?...` in English,
 * `/?lang=de#/tool/...` in a locale - and each of those is a full page load that would
 * drop the reader, the music and the a11y prefs on the floor. Rewritten to the bare
 * `#/...` route they stay in the SPA. The app-root links (the hero mark and both "Launch
 * App" buttons) go to the tools gallery, the app's main view (Andy, 2026-09-03; they
 * used to go to the dashboard). Labels and copy are untouched.
 *
 * Doc links (`/info/<slug>.html`) are NOT this function's business - views/docs.ts runs
 * rewriteDocLinks over the same fragment for those.
 */
export function adaptLandingLinks(root: ParentNode): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const app = toAppHref(a.getAttribute('href') || '');
    if (app) a.setAttribute('href', app);
    // The static build's liquid-glass script bakes a `backdrop-filter: url(#lg…)`
    // INLINE onto every primary/secondary button; the SVG filter it references is
    // built by a page script the reader strips, and Chromium paints an element
    // whose filter reference is unresolvable as BLANK. Strip the baked style so
    // the fragment's buttons keep their ordinary fill in-app.
    if (a.style.backdropFilter) {
      a.style.removeProperty('backdrop-filter');
      a.style.removeProperty('-webkit-backdrop-filter');
    }
  });
}

/**
 * The ink that reads on a painted fill: black above the relative luminance where the
 * two WCAG ratios cross (about 18%), white below it, so the chosen ink always has the
 * higher contrast of the two. Null when the string is not an rgb()/rgba() colour or the
 * fill is mostly transparent (jsdom's empty computed style, a glass button with no
 * fill), in which case the stylesheet's fallback stands.
 */
export function inkFor(cssColor: string): '#000' | '#fff' | null {
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec((cssColor || '').trim());
  if (!m) return null;
  const a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
  if (!(a > 0.5)) return null;
  const lin = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(+m[1]!) + 0.7152 * lin(+m[2]!) + 0.0722 * lin(+m[3]!);
  return L > 0.179 ? '#000' : '#fff';
}

/**
 * Set the hero's primary button ink from the fill it actually painted. The fill is the
 * active brand's primary (docs-landing.css), which can be anything from the starter's
 * near-black ink to a light pastel, and CSS alone cannot pick a label colour for an
 * unknown fill - so the label used to be a fixed black and vanished on a dark brand
 * (Andy's screenshot, 2026-09-03). Runs once the fragment is in the DOM; a fill the
 * engine cannot report (jsdom) leaves the stylesheet's fallback in place.
 */
export function fitHeroCtaInk(root: ParentNode): void {
  const btn = root.querySelector<HTMLElement>('.hero-cta .btn-primary');
  if (!btn || !btn.isConnected) return;
  let fill = '';
  try { fill = getComputedStyle(btn).backgroundColor; } catch { return; }
  const ink = inkFor(fill);
  if (ink) btn.style.setProperty('--hero-cta-ink', ink);
}

/**
 * The hero's "Lolly is …" cycle, rehosted (plans/177). The static page runs
 * HERO_CYCLE_JS (docs/build.ts); the reader strips scripts, so this is the same
 * behaviour in module form - the deliberate duplication the landing rehost
 * already lives with (see the file header). Word list and receipt hrefs ride
 * the element's own data-cycle attribute, so copy edits never touch this file;
 * hrefs are mapped through toReaderHref so a click stays in the SPA. The
 * interval dies with the element: it self-clears when the node leaves the
 * document, so unmount needs no teardown hook.
 */
/**
 * The covers Cover Flow, rehosted (plans/177; Andy 2026-09-02: the fan belongs
 * in-app too). ONE implementation for both surfaces: lib/covers-flow.ts is what
 * docs/build.ts bundles into the static page's inline script and what this
 * import mounts on the rehosted fragment - no twin to keep in step. The
 * module's listeners live on fragment nodes and its timers self-clear when the
 * root leaves the document, so unmount needs no teardown.
 */
export function hydrateLandingCovers(root: ParentNode): void {
  mountCoverFlow(root);
}

/** The hero's "Copy agent instructions" button, rehosted with the same module the
 *  static page bundles (lib/agent-copy.ts); its text rides on the button. */
export function hydrateLandingAgentCopy(root: ParentNode): void {
  wireAgentCopy(root);
}

export function hydrateLandingCycle(root: ParentNode): void {
  const a = root.querySelector<HTMLAnchorElement>('#heroCycle');
  if (!a) return;
  let data: Array<{ w: string; h: string }>;
  try { data = JSON.parse(a.getAttribute('data-cycle') || ''); } catch { return; }
  if (!Array.isArray(data) || data.length < 2) return;
  // Reduced motion, from the OS or the app's own switch: the first word stands. Asked
  // again on every beat, so asking for less motion mid-cycle stops it at the word shown.
  if (prefersReducedMotion()) return;
  const word = a.querySelector('span') ?? a;
  let i = 0;
  let hold = 0;
  const seat = (href: string): string => toReaderHref(href) ?? href;
  a.addEventListener('mouseenter', () => { hold = Math.max(hold, Date.now() + 6000); });
  a.addEventListener('focus', () => { hold = Math.max(hold, Date.now() + 6000); });
  const timer = setInterval(() => {
    if (!a.isConnected) { clearInterval(timer); return; }
    if (Date.now() < hold || document.hidden || prefersReducedMotion()) return;
    i = (i + 1) % data.length;
    a.classList.add('is-swapping');
    setTimeout(() => {
      word.textContent = data[i]!.w;
      a.setAttribute('href', seat(data[i]!.h));
      a.classList.remove('is-swapping');
    }, 240);
  }, 2800);
}

