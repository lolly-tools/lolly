// SPDX-License-Identifier: MPL-2.0
/**
 * Interactive "Try it" embeds for the in-app docs reader (views/docs.ts) - plan M3.
 *
 * PROGRESSIVE ENHANCEMENT over the static screenshots. The reader injects the built
 * `.docs-content` fragment, whose tool screenshots are committed, C2PA-signed <img>s
 * captured from `url-shot` recipes. For each shot whose capture recipe is a live TOOL
 * render (recoverable from `/info/docs-render-manifest.json`'s `recipes` map, keyed by
 * shot slug - emitted by docs/build.ts's writeDocsManifest), this overlays:
 *
 *   1. a keyboard-accessible "Try it" affordance that OPENS the tool live in the app,
 *      at the recipe's exact route, under the ACTIVE brand (the tool route inherits it);
 *   2. an opt-in in-place LIVE embed that swaps a same-origin <iframe> of the tool over
 *      the static image (the image stays beneath as the baseline until the frame loads,
 *      and is restored on any frame error) - RM-gated (see below).
 *
 * INVARIANTS this module holds to:
 *   - ADDITIVE ONLY. The signed static <img> is never removed; a missing/failed manifest,
 *     a non-tool (view/gallery) recipe, or an absent recipe is a silent no-op.
 *   - CONTENT-GATED. Only shots whose recipe route is `/#/tool/<id>` or `/t/<id>` are
 *     enhanced. View captures (`/#/`, `/#/start`, `/#/u`, …) get nothing.
 *   - REDUCED MOTION. Under reduce, the in-place live embed (which boots a whole app and
 *     can auto-animate) is NOT offered - only the navigate affordance, which leaves for
 *     the tool route that already respects the pref.
 *   - The mastheads and the C2PA cred puck are untouched (the reader hides the puck; this
 *     never re-signs or re-bakes anything).
 *
 * The slug derivation (`file.split('.')[0]`) mirrors build.ts's recipe key exactly, so a
 * localized (`.de`) or dark (`.dark`) file resolves to the same English-keyed recipe.
 */
import { t } from '../i18n.ts';
import { icon } from './icons.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';

/** The subset of the render manifest this module reads. */
interface DocsRenderManifest {
  recipes?: Record<string, { route: string } | undefined>;
}

/** Recover a shot's recipe slug from its served src, matching build.ts's
 *  `file.split('.')[0]` (strips the extension, the `.dark` twin marker, and any `.<lang>`
 *  locale segment - recipes are English-keyed). */
export function shotSlug(src: string): string {
  const file = src.split('/').pop() ?? '';
  return file.split('.')[0] ?? '';
}

/** The tool id when a recipe route mounts a live TOOL (`/#/tool/<id>` / `#/tool/<id>` /
 *  `/t/<id>`), else null. View captures (`/#/`, `/#/start`, `/#/u`, …) return null, which
 *  is the whole content gate. */
export function toolRouteId(route: string): string | null {
  const m = /^\/?#\/tool\/([^/?#&]+)/.exec(route) ?? /^\/t\/([^/?#&]+)/.exec(route);
  return m ? decodeURIComponent(m[1]!) : null;
}

/** The `src` for the in-place live <iframe>: the recipe route forced into full-bleed
 *  (`full`, no sidebar) with any export/copy/download trigger stripped, so the embed shows
 *  the live tool and never auto-downloads. Param encoding is preserved verbatim. */
export function embedSrcFor(route: string): string {
  const qIdx = route.indexOf('?');
  const base = qIdx === -1 ? route : route.slice(0, qIdx);
  const params = (qIdx === -1 ? '' : route.slice(qIdx + 1)).split('&').filter(Boolean);
  const DROP = /^(format|export|copy|output|download|filename|nostage)(=|$)/;
  const kept = params.filter((p) => !DROP.test(p));
  if (!kept.some((p) => p === 'full' || p.startsWith('full='))) kept.push('full');
  return kept.length ? `${base}?${kept.join('&')}` : base;
}

let manifestPromise: Promise<DocsRenderManifest | null> | null = null;
/** Fetch (and cache for the session) the render manifest. A failure is a null, not a throw. */
function loadManifest(): Promise<DocsRenderManifest | null> {
  manifestPromise ??= fetch('/info/docs-render-manifest.json', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<DocsRenderManifest>) : null))
    .catch(() => null);
  return manifestPromise;
}

/** Reset the cached manifest - test seam only. */
export function _resetManifestCache(): void {
  manifestPromise = null;
}

/** Build the pill's inner markup: a trusted static icon (from icons.ts) + an escaped label
 *  written via textContent, so no user/manifest string is ever interpolated as HTML. */
function fillPill(el: HTMLElement, iconSvg: string, label: string): void {
  el.insertAdjacentHTML('beforeend', iconSvg);
  const span = document.createElement('span');
  span.textContent = label;
  el.appendChild(span);
}

/** Toggle the in-place live embed on a shot wrapper. The static <img> stays in flow as the
 *  baseline; the iframe is absolutely overlaid and only reveals once it loads (and removes
 *  itself, restoring the image, on error). */
function toggleLive(wrapper: HTMLElement, embedSrc: string, liveBtn: HTMLButtonElement): void {
  const existing = wrapper.querySelector<HTMLIFrameElement>('iframe.shot-live-frame');
  const setPressed = (on: boolean): void => {
    liveBtn.setAttribute('aria-pressed', String(on));
    const span = liveBtn.querySelector('span');
    if (span) span.textContent = on ? t('Stop') : t('Preview live');
  };
  if (existing) {
    existing.remove();
    wrapper.classList.remove('shot--live', 'shot--live-ready');
    setPressed(false);
    return;
  }
  const frame = document.createElement('iframe');
  frame.className = 'shot-live-frame';
  frame.src = embedSrc;
  frame.title = t('Live preview');
  frame.loading = 'lazy';
  frame.referrerPolicy = 'same-origin';
  frame.addEventListener('load', () => wrapper.classList.add('shot--live-ready'), { once: true });
  frame.addEventListener('error', () => {
    frame.remove();
    wrapper.classList.remove('shot--live', 'shot--live-ready');
    setPressed(false);
  }, { once: true });
  wrapper.classList.add('shot--live');
  wrapper.appendChild(frame);
  setPressed(true);
}

/** Enhance one shot wrapper, given its live-tool recipe route. Idempotent. */
function enhanceShot(wrapper: HTMLElement, route: string, allowEmbed: boolean): void {
  if (wrapper.dataset.tryit) return; // already enhanced
  wrapper.dataset.tryit = 'on';
  wrapper.classList.add('shot--tryable');

  const overlay = document.createElement('span'); // <span>, not <div>: .shot is a <span>
  overlay.className = 'shot-tryit';

  // (1) Navigate: a real anchor at the recipe route. The reader's own anchor handler only
  // claims `a[href^="#"]`, and this href is path-form `/#/…`, so it navigates natively - 
  // hashchange → the app router mounts the tool. Works with no JS, right-clickable, and
  // keyboard-focusable (revealing the overlay via :focus-within).
  const open = document.createElement('a');
  open.className = 'shot-tryit-btn shot-tryit-open';
  open.href = route;
  fillPill(open, icon('externalLink'), t('Try it in the app'));
  overlay.appendChild(open);

  // (2) In-place live embed - opt-in, and only when motion is allowed.
  if (allowEmbed) {
    const embedSrc = embedSrcFor(route);
    const live = document.createElement('button');
    live.type = 'button';
    live.className = 'shot-tryit-btn shot-tryit-live';
    live.setAttribute('aria-pressed', 'false');
    fillPill(live, icon('play', { filled: true }), t('Preview live'));
    live.addEventListener('click', () => toggleLive(wrapper, embedSrc, live));
    overlay.appendChild(live);
  }

  wrapper.appendChild(overlay);

  // The static build already trails these shots with a plain "Try it in the app →" text
  // link; the overlay supersedes it. Hide it only now that the richer affordance exists
  // (progressive: if this JS never runs, the text link remains the baseline).
  const sib = wrapper.nextElementSibling;
  if (sib?.classList.contains('shot-try')) sib.classList.add('shot-try--superseded');
}

/**
 * Walk the injected docs fragment and turn every live-tool screenshot into an interactive
 * "Try it" embed. Never throws; safe to fire-and-forget. `root` is the mounted docs article.
 */
export async function hydrateDocsTryIt(
  root: ParentNode,
  opts: { reducedMotion?: boolean } = {},
): Promise<void> {
  try {
    const shots = Array.from(root.querySelectorAll<HTMLElement>('.shot[data-shot]'));
    if (!shots.length) return;

    const manifest = await loadManifest();
    const recipes = manifest?.recipes;
    if (!recipes) return;
    // The reader may have unmounted while the manifest was in flight.
    if (root instanceof Element && !root.isConnected) return;

    const allowEmbed = !(opts.reducedMotion ?? prefersReducedMotion());

    for (const wrapper of shots) {
      const src = wrapper.getAttribute('data-shot');
      if (!src) continue;
      const route = recipes[shotSlug(src)]?.route;
      if (!route || !toolRouteId(route)) continue; // no recipe, or a view capture → skip
      enhanceShot(wrapper, route, allowEmbed);
    }
  } catch {
    // Purely additive: any failure leaves the static screenshots exactly as injected.
  }
}
