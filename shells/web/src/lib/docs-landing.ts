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
 *     (`.hero`, `.audience-tab`, `.btn`), so it is wrapped in `@scope (.docs-landing)`
 *     before it reaches the document: loose in the app shell, one `.btn` rule would
 *     repaint every button in the chrome. @scope only asks that the SUBJECT of a
 *     selector be in scope, so the file's `html[data-theme="dark"] .quicknav` ancestor
 *     rules keep working, its nested @media still apply, and @keyframes inside the
 *     block register globally as usual.
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
code{font-family:'SUSE Mono','SF Mono','Fira Code',monospace;font-size:.875em;background:hsl(var(--muted));padding:.15em .35em;border-radius:3px}
pre{background:hsl(var(--muted));color:hsl(var(--foreground));padding:1.25rem 1.5rem;border-radius:8px;overflow-x:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.875rem;line-height:1.5;margin-bottom:1.25rem}
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
 * Both are (0,2,0), so they beat the scoped `.reveal` / `.quicknav` rules (0,1,0) and the
 * `html[data-theme="dark"] .quicknav` one (0,1,1) on specificity alone.
 */
const LANDING_MODE_CSS = `
.docs-reader--landing .reveal,
.docs-reader--landing .reveal.visible { opacity: 1; transform: none; transition: none; }
.docs-reader--landing .quicknav { display: none; }
`;

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
  el.textContent = `@scope (.docs-landing) {\n${ELEMENT_BASELINE}\n${source}\n}\n${LANDING_MODE_CSS}`;
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

export function hydrateLandingCycle(root: ParentNode): void {
  const a = root.querySelector<HTMLAnchorElement>('#heroCycle');
  if (!a) return;
  let data: Array<{ w: string; h: string }>;
  try { data = JSON.parse(a.getAttribute('data-cycle') || ''); } catch { return; }
  if (!Array.isArray(data) || data.length < 2) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // the first word stands
  const word = a.querySelector('span') ?? a;
  let i = 0;
  let hold = 0;
  const seat = (href: string): string => toReaderHref(href) ?? href;
  a.addEventListener('mouseenter', () => { hold = Math.max(hold, Date.now() + 6000); });
  a.addEventListener('focus', () => { hold = Math.max(hold, Date.now() + 6000); });
  const timer = setInterval(() => {
    if (!a.isConnected) { clearInterval(timer); return; }
    if (Date.now() < hold || document.hidden) return;
    i = (i + 1) % data.length;
    a.classList.add('is-swapping');
    setTimeout(() => {
      word.textContent = data[i]!.w;
      a.setAttribute('href', seat(data[i]!.h));
      a.classList.remove('is-swapping');
    }, 240);
  }, 2800);
}

